const path = require('path');
const fs = require('fs');
const { insertAttendanceBatch, upsertEmployees, dbRun, getVerifyModeName, getPunchStateName } = require('./db');
const { firebaseService } = require('./firebaseService');

// In-memory device command queue: { [deviceSn]: Array<{ id, cmd }> }
const deviceCommandQueues = {};

// Active connected device tracker: { [deviceSn]: { sn, ip, lastSeen, pushver, firmware } }
const connectedDevices = {};

// Register broadcast callback to push live events to WebSockets
let wsBroadcastFn = null;
function setWebSocketBroadcast(fn) {
  wsBroadcastFn = fn;
}

function broadcastLivePunch(record) {
  if (wsBroadcastFn) {
    try {
      wsBroadcastFn({
        type: 'LIVE_PUNCH',
        data: record
      });
    } catch (err) {
      console.warn('Failed to broadcast live punch:', err.message);
    }
  }
}

/**
 * Parses tab-separated ATTLOG payload from SpeedFace ADMS push.
 * Line format: <EnrollNumber>\t<DateTime>\t<VerifyMode>\t<InOutStatus>\t<WorkCode>\t<Reserved>\t<Temperature>\t<Mask>
 */
function parseAttlogBody(bodyText, deviceSn, deviceIp) {
  const records = [];
  if (!bodyText) return records;

  const lines = bodyText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split('\t');
    if (parts.length < 2) continue;

    const userId = parts[0].trim();
    const punchTime = parts[1].trim();
    const verifyMode = parts.length > 2 ? parseInt(parts[2], 10) || 15 : 15;
    const punchState = parts.length > 3 ? parseInt(parts[3], 10) || 0 : 0;
    const workCode = parts.length > 4 ? parseInt(parts[4], 10) || 0 : 0;
    
    // Some SpeedFace models send temperature and mask in later columns
    let temperature = null;
    let maskStatus = null;
    if (parts.length >= 7) {
      const tempVal = parseFloat(parts[6]);
      if (!isNaN(tempVal) && tempVal > 30 && tempVal < 45) {
        temperature = tempVal;
      }
    }
    if (parts.length >= 8) {
      maskStatus = parseInt(parts[7], 10);
    }

    if (userId && punchTime) {
      records.push({
        user_id: userId,
        punch_time: punchTime,
        verify_mode: verifyMode,
        verify_name: getVerifyModeName(verifyMode),
        punch_state: punchState,
        punch_state_name: getPunchStateName(punchState),
        work_code: workCode,
        temperature,
        mask_status: maskStatus,
        device_ip: deviceIp,
        device_sn: deviceSn,
        source: 'ADMS_PUSH'
      });
    }
  }

  return records;
}

/**
 * Parses user information pushed from device.
 */
function parseUserBody(bodyText) {
  const users = [];
  if (!bodyText) return users;

  const lines = bodyText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split('\t');
    const userObj = {};
    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key && val) {
        userObj[key.trim()] = val.trim();
      }
    }

    const userId = userObj.PIN || userObj.USERID || userObj.Uid;
    if (userId) {
      users.push({
        userId,
        name: userObj.Name || '',
        cardno: userObj.Card || '',
        role: parseInt(userObj.Pri || '0', 10)
      });
    }
  }
  return users;
}

/**
 * Express router handler for ZKTeco ADMS / IClock endpoints.
 */
function setupAdmsRoutes(app) {
  // Middleware to capture raw text bodies for /iclock/ endpoints
  app.use('/iclock', (req, res, next) => {
    if (req.is('text/*') || req.is('application/octet-stream') || req.headers['content-type'] === 'text/plain') {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        req.rawBody = data;
        next();
      });
    } else {
      next();
    }
  });

  // 1. GET /iclock/cdata - Device registration, heartbeat, handshake
  app.get('/iclock/cdata', async (req, res) => {
    const sn = req.query.SN || req.query.sn || 'UNKNOWN_SN';
    const pushver = req.query.pushver || '2.4.0';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const cleanIp = clientIp.replace(/^.*:/, '');

    connectedDevices[sn] = {
      sn,
      ip: cleanIp,
      pushver,
      lastSeen: new Date().toISOString(),
      status: 'ONLINE'
    };

    console.log(`[ADMS] Handshake from SpeedFace device SN=${sn} at IP=${cleanIp}`);

    // Return device configuration (enabling Realtime push)
    const configResponse = [
      `GET OPTION FROM: ${sn}`,
      `Stamp=${Date.now()}`,
      `OpStamp=${Date.now()}`,
      `PhotoStamp=${Date.now()}`,
      `ErrorDelay=30`,
      `Delay=10`,
      `TransTimes=00:00;14:00`,
      `TransInterval=1`,
      `TransFlag=1111000000`,
      `TimeZone=5.5`,
      `Realtime=1`,
      `Encrypt=0`,
      `ServerVer=3.4.1`,
      `PushProtVer=2.4.1`,
      ''
    ].join('\r\n');

    res.set('Content-Type', 'text/plain');
    return res.send(configResponse);
  });

  // 2. POST /iclock/cdata - Device uploads attendance records or users
  app.post('/iclock/cdata', async (req, res) => {
    const sn = req.query.SN || req.query.sn || 'UNKNOWN_SN';
    const table = (req.query.table || req.query.TABLE || 'ATTLOG').toUpperCase();
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace(/^.*:/, '');

    connectedDevices[sn] = {
      ...(connectedDevices[sn] || {}),
      sn,
      ip: clientIp,
      lastSeen: new Date().toISOString(),
      status: 'ONLINE'
    };

    const rawData = req.rawBody || req.body || '';
    const bodyStr = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);

    if (table.includes('ATTLOG') || table.includes('OPERLOG')) {
      const records = parseAttlogBody(bodyStr, sn, clientIp);
      if (records.length > 0) {
        try {
          const result = await insertAttendanceBatch(records);
          console.log(`[ADMS] Received ${records.length} punches from SN=${sn}. Stored: ${result.inserted} new.`);

          // Broadcast the latest punch live to the UI
          records.forEach((rec) => broadcastLivePunch(rec));

          // Non-blocking auto-upload to Firebase Firestore
          firebaseService.syncPendingAttendance({ limit: 500 }).catch(() => {});

          // Log sync event
          await dbRun(
            `INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message) VALUES (?, ?, ?, ?, ?)`,
            ['ADMS_PUSH', 'SUCCESS', result.inserted, records.length, `Received from SN=${sn}`]
          );
        } catch (dbErr) {
          console.error('[ADMS] DB insertion error:', dbErr.message);
        }
      }
      res.set('Content-Type', 'text/plain');
      return res.send('OK');
    }

    if (table.includes('USER')) {
      const users = parseUserBody(bodyStr);
      if (users.length > 0) {
        await upsertEmployees(users);
        console.log(`[ADMS] Synced ${users.length} users from SN=${sn}`);
      }
      res.set('Content-Type', 'text/plain');
      return res.send('OK');
    }

    // Default response for other tables
    res.set('Content-Type', 'text/plain');
    return res.send('OK');
  });

  // 3. GET /iclock/getrequest - Device polls for pending commands
  app.get('/iclock/getrequest', (req, res) => {
    const sn = req.query.SN || req.query.sn || 'UNKNOWN_SN';
    const queue = deviceCommandQueues[sn] || [];

    if (queue.length > 0) {
      const nextCmd = queue.shift();
      console.log(`[ADMS] Dispatching command to device SN=${sn}: ${nextCmd.cmd}`);
      res.set('Content-Type', 'text/plain');
      return res.send(`C:${nextCmd.id}:${nextCmd.cmd}`);
    }

    res.set('Content-Type', 'text/plain');
    return res.send('OK');
  });

  // 4. POST /iclock/devicecmd - Device sends command execution result
  app.post('/iclock/devicecmd', (req, res) => {
    const sn = req.query.SN || req.query.sn || 'UNKNOWN_SN';
    console.log(`[ADMS] Command response from SN=${sn}`);
    res.set('Content-Type', 'text/plain');
    return res.send('OK');
  });

  // 5. GET /iclock/fdata - Device requests photo file
  app.get('/iclock/fdata', (req, res) => {
    const fileName = req.query.FileName || req.query.filename || '';
    if (!fileName) {
      return res.status(404).send('Not Found');
    }
    const cleanFileName = path.basename(fileName);
    const photoPath = path.join(__dirname, '..', 'public', 'uploads', 'photos', cleanFileName);
    if (fs.existsSync(photoPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      return res.sendFile(photoPath);
    }
    res.status(404).send('Not Found');
  });

  // 6. GET /iclock/photo/:filename
  app.get(['/iclock/photo/:filename', '/iclock/file/:filename'], (req, res) => {
    const cleanFileName = path.basename(req.params.filename);
    const photoPath = path.join(__dirname, '..', 'public', 'uploads', 'photos', cleanFileName);
    if (fs.existsSync(photoPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      return res.sendFile(photoPath);
    }
    res.status(404).send('Not Found');
  });
}

function queuePhotoUpload(userId, base64Data) {
  const size = Buffer.byteLength(base64Data, 'base64');
  const cmdUserPic = `DATA UPDATE USERPIC PIN=${userId}\tSize=${size}\tContent=${base64Data}`;
  const cmdBioPhoto = `DATA UPDATE BIOPHOTO PIN=${userId}\tType=9\tSize=${size}\tContent=${base64Data}`;

  const sns = Object.keys(connectedDevices);
  if (sns.length === 0) {
    queueDeviceCommand('DEFAULT', cmdUserPic);
    queueDeviceCommand('DEFAULT', cmdBioPhoto);
  } else {
    for (const sn of sns) {
      queueDeviceCommand(sn, cmdUserPic);
      queueDeviceCommand(sn, cmdBioPhoto);
    }
  }
}

function queueDeviceCommand(sn, cmd) {
  if (!deviceCommandQueues[sn]) {
    deviceCommandQueues[sn] = [];
  }
  const cmdId = Date.now().toString(36);
  deviceCommandQueues[sn].push({ id: cmdId, cmd });
  return cmdId;
}

function getConnectedAdmsDevices() {
  const now = Date.now();
  return Object.values(connectedDevices).filter((dev) => {
    if (!dev.lastSeen) return false;
    const diffMs = now - new Date(dev.lastSeen).getTime();
    return diffMs < 90000; // Seen within last 90 seconds
  });
}

module.exports = {
  setupAdmsRoutes,
  setWebSocketBroadcast,
  broadcastLivePunch,
  queueDeviceCommand,
  queuePhotoUpload,
  getConnectedAdmsDevices
};
