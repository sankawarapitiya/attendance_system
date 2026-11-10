const os = require('os');
const config = require('./config');
const { SpeedFaceClient } = require('./zktProtocol');
const { 
  insertAttendanceBatch, 
  upsertEmployees, 
  dbRun, 
  dbGet,
  dbAll,
  getAllTerminals,
  getTerminalById,
  getTerminalByIp,
  updateTerminalMetrics
} = require('./db');
const { broadcastLivePunch, getConnectedAdmsDevices } = require('./admsServer');
const { firebaseService } = require('./firebaseService');

/**
 * Validates the preferred interface IP against the host machine's active network adapters.
 * If preferredIp is stale or missing, automatically finds the active adapter on the same subnet
 * as targetDeviceIp, auto-corrects the database settings, and returns the valid IP.
 */
async function getOrDetectLocalAddress(preferredIp, targetDeviceIp = '192.168.10.15') {
  const interfaces = os.networkInterfaces();
  const allActiveIps = [];

  for (const name of Object.keys(interfaces)) {
    for (const netInfo of interfaces[name]) {
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        allActiveIps.push({ name, ip: netInfo.address, netmask: netInfo.netmask });
      }
    }
  }

  // 1. If preferredIp is valid and currently assigned to this PC, use it
  if (preferredIp && allActiveIps.some(i => i.ip === preferredIp)) {
    return preferredIp;
  }

  // 2. Look for an active interface on the same subnet as target device
  if (targetDeviceIp) {
    const targetPrefix = targetDeviceIp.split('.').slice(0, 3).join('.');
    const sameSubnet = allActiveIps.find(i => i.ip.split('.').slice(0, 3).join('.') === targetPrefix);
    if (sameSubnet) {
      if (preferredIp && preferredIp !== sameSubnet.ip) {
        try {
          await dbRun(`UPDATE settings SET value = ? WHERE key = 'network_interface_ip'`, [sameSubnet.ip]);
          await dbRun(`UPDATE settings SET value = ? WHERE key = 'network_interface'`, [sameSubnet.name]);
          console.log(`[NETWORK] Auto-corrected stale network interface IP from ${preferredIp} to active ${sameSubnet.ip} (${sameSubnet.name})`);
        } catch (e) {}
      }
      return sameSubnet.ip;
    }
  }

  // 3. Fall back to first non-internal IPv4 if any exist
  if (allActiveIps.length > 0) {
    return allActiveIps[0].ip;
  }

  return null;
}

let isSyncing = false;
let isHealthChecking = false;
let activeClient = null;
let stopSyncRequested = false;
let syncTimer = null;
let healthCheckTimer = null;
let cloudSyncTimer = null;
let lastKnownLogCount = 0;

let lastSyncStatus = {
  lastSyncTime: null,
  status: 'IDLE',
  totalSynced: 0,
  deviceOnline: false,
  deviceInfo: null,
  error: null
};

// WebSocket broadcast helper for sync progress updates
let wsBroadcastFn = null;
function setSyncWsBroadcast(fn) {
  wsBroadcastFn = fn;
}

function notifyWs(type, payload) {
  if (wsBroadcastFn) {
    try {
      wsBroadcastFn({ type, data: payload });
    } catch (err) {}
  }
}

/**
 * Actively checks whether the SpeedFace device is online & reachable.
 * Updates lastSyncStatus.deviceOnline and broadcasts DEVICE_STATUS over WebSocket.
 */
/**
 * Checks health of a single terminal and updates its database record.
 */
async function checkTerminalHealth(termOrId, localAddress = null) {
  let terminal;
  if (typeof termOrId === 'object' && termOrId !== null) {
    terminal = termOrId;
  } else {
    terminal = await getTerminalById(termOrId);
  }
  if (!terminal) return { success: false, error: 'Terminal not found' };

  const deviceIp = terminal.ip;
  const devicePort = terminal.port || 4370;

  try {
    if (!localAddress) {
      try {
        const netSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);
        if (netSetting && netSetting.value) localAddress = netSetting.value;
      } catch (e) {}
    }
    localAddress = await getOrDetectLocalAddress(localAddress, deviceIp);
    const client = new SpeedFaceClient(deviceIp, devicePort, 4000, localAddress);
    const connInfo = await client.testConnection();

    if (connInfo && connInfo.success) {
      const now = new Date().toISOString();
      const prevLogs = terminal.log_count || 0;
      await updateTerminalMetrics(terminal.id, {
        status: 'ONLINE',
        last_seen: now,
        user_count: connInfo.userCounts || terminal.user_count,
        log_count: connInfo.logCounts || terminal.log_count,
        serial_number: connInfo.serialNumber || terminal.serial_number,
        firmware: connInfo.firmware || terminal.firmware
      });

      // Live punch watcher: If terminal log count increased, trigger live sync immediately!
      if (connInfo.logCounts && prevLogs > 0 && connInfo.logCounts > prevLogs) {
        console.log(`[LIVE SYNC] New punch detected on terminal ${terminal.name || deviceIp} (${prevLogs} -> ${connInfo.logCounts}). Syncing punches live...`);
        setTimeout(() => syncTerminal(terminal.id), 100);
      }

      notifyWs('TERMINAL_STATUS', {
        terminalId: terminal.id,
        name: terminal.name,
        ip: deviceIp,
        port: devicePort,
        online: true,
        deviceInfo: connInfo
      });

      return { success: true, online: true, terminalId: terminal.id, ...connInfo };
    } else {
      throw new Error(connInfo ? connInfo.error : 'Connection test failed');
    }
  } catch (err) {
    // Check ADMS push
    const admsDevices = getConnectedAdmsDevices();
    const matchedAdms = admsDevices.find(d => d.ip === deviceIp || d.sn === terminal.serial_number);
    if (matchedAdms) {
      const now = new Date().toISOString();
      await updateTerminalMetrics(terminal.id, {
        status: 'ONLINE',
        last_seen: now
      });
      notifyWs('TERMINAL_STATUS', {
        terminalId: terminal.id,
        name: terminal.name,
        ip: deviceIp,
        port: devicePort,
        online: true,
        source: 'ADMS_PUSH',
        matchedAdms
      });
      return { success: true, online: true, source: 'ADMS_PUSH', terminalId: terminal.id };
    }

    await updateTerminalMetrics(terminal.id, { status: 'OFFLINE' });
    notifyWs('TERMINAL_STATUS', {
      terminalId: terminal.id,
      name: terminal.name,
      ip: deviceIp,
      port: devicePort,
      online: false,
      error: err.message
    });
    return { success: false, online: false, terminalId: terminal.id, error: err.message };
  }
}

/**
 * Checks health of all enabled terminals in fleet.
 */
async function checkAllTerminalsHealth() {
  try {
    const terminals = await getAllTerminals();
    const enabledTerms = terminals.filter(t => t.is_enabled);
    const results = [];

    for (const t of enabledTerms) {
      const res = await checkTerminalHealth(t);
      results.push(res);
    }

    const updatedTerminals = await getAllTerminals();
    const total = updatedTerminals.length;
    const online = updatedTerminals.filter(t => t.status === 'ONLINE').length;
    const offline = total - online;

    notifyWs('FLEET_STATUS', {
      total,
      online,
      offline,
      terminals: updatedTerminals
    });

    return { total, online, offline, terminals: updatedTerminals };
  } catch (err) {
    console.warn('[SYNC] Fleet health check error:', err.message);
    return { error: err.message };
  }
}

async function checkDeviceHealth(deviceIp = '192.168.10.15', devicePort = 4370, localAddress = null) {
  if (isSyncing || isHealthChecking) {
    return {
      online: lastSyncStatus.deviceOnline,
      deviceInfo: lastSyncStatus.deviceInfo,
      status: lastSyncStatus.status
    };
  }

  isHealthChecking = true;

  try {
    if (!localAddress) {
      try {
        const netSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);
        if (netSetting && netSetting.value) localAddress = netSetting.value;
      } catch (e) {}
    }
    localAddress = await getOrDetectLocalAddress(localAddress, deviceIp);
    const client = new SpeedFaceClient(deviceIp, devicePort, 4000, localAddress);
    const connInfo = await client.testConnection();

    if (connInfo && connInfo.success) {
      const wasOffline = !lastSyncStatus.deviceOnline;
      lastSyncStatus.deviceOnline = true;
      lastSyncStatus.deviceInfo = connInfo;
      lastSyncStatus.error = null;

      if (connInfo.logCounts) {
        if (lastKnownLogCount > 0 && connInfo.logCounts > lastKnownLogCount) {
          console.log(`[WATCHER] New punch detected! Count changed: ${lastKnownLogCount} -> ${connInfo.logCounts}. Syncing immediately...`);
          lastKnownLogCount = connInfo.logCounts;
          // Trigger sync in background without blocking health check
          setTimeout(() => syncFromDevice(deviceIp, devicePort), 100);
        } else {
          lastKnownLogCount = connInfo.logCounts;
        }
      }

      notifyWs('DEVICE_STATUS', {
        online: true,
        ip: deviceIp,
        port: devicePort,
        deviceInfo: connInfo
      });

      isHealthChecking = false;
      return { success: true, online: true, ...connInfo };
    } else {
      throw new Error(connInfo ? connInfo.error : 'Connection test failed');
    }
  } catch (err) {
    // Check if device is active via ADMS cloud push
    const admsDevices = getConnectedAdmsDevices();
    if (admsDevices.length > 0) {
      lastSyncStatus.deviceOnline = true;
      notifyWs('DEVICE_STATUS', {
        online: true,
        ip: deviceIp,
        port: devicePort,
        source: 'ADMS_PUSH',
        admsDevices
      });
      isHealthChecking = false;
      return { success: true, online: true, source: 'ADMS_PUSH', admsDevices };
    }

    lastSyncStatus.deviceOnline = false;
    lastSyncStatus.error = err.message;

    notifyWs('DEVICE_STATUS', {
      online: false,
      ip: deviceIp,
      port: devicePort,
      error: err.message
    });

    isHealthChecking = false;
    return { success: false, online: false, error: err.message };
  }
}

/**
 * Performs a full or incremental sync from the SpeedFace device.
 */
/**
 * Synchronize attendance and users from a single terminal by ID.
 */
async function syncTerminal(termId) {
  const terminal = await getTerminalById(termId);
  if (!terminal) throw new Error(`Terminal ID ${termId} not found`);
  if (!terminal.is_enabled) throw new Error(`Terminal "${terminal.name}" is currently disabled`);
  return syncFromDevice(terminal.ip, terminal.port, null, terminal.id, terminal.name);
}

/**
 * Synchronize all enabled terminals in the fleet where auto_sync = 1.
 */
async function syncAllTerminals() {
  if (isSyncing) return { success: false, message: 'A synchronization is already in progress' };
  const terminals = await getAllTerminals();
  const activeTerms = terminals.filter(t => t.is_enabled && t.auto_sync);
  if (activeTerms.length === 0) {
    return { success: true, message: 'No enabled terminals configured for auto-sync', syncedCount: 0 };
  }

  const results = [];
  for (const term of activeTerms) {
    if (stopSyncRequested) break;
    try {
      const r = await syncFromDevice(term.ip, term.port, null, term.id, term.name);
      results.push({ terminalId: term.id, name: term.name, ...r });
    } catch (err) {
      results.push({ terminalId: term.id, name: term.name, success: false, error: err.message });
    }
  }

  return { success: true, results };
}


/**
 * Pushes active employees from database to a biometric terminal (or all terminals).
 * @param {string|number} terminalId - specific terminal ID or 'all'
 * @param {Array<string>} userIds - optional array of specific user_ids to push
 * @param {string} overrideLocalAddress - optional local network adapter IP
 */
async function pushEmployeesToTerminal(terminalId, userIds = null, overrideLocalAddress = null) {
  if (config.isCloudDeploy) {
    return {
      success: false,
      cloudMode: true,
      message: 'Direct hardware terminal push is disabled in Cloud Deploy mode. Attendance and employee records are managed via Google Cloud Firestore.'
    };
  }

  // 1. Fetch active employees from local database
  let employeesQuery = "SELECT user_id, name, role, card_no, employee_service_id FROM employees WHERE (name IS NOT NULL AND name != '') OR (user_id IS NOT NULL)";
  const params = [];
  if (Array.isArray(userIds) && userIds.length > 0) {
    employeesQuery += " AND user_id IN (" + userIds.map(() => '?').join(',') + ")";
    params.push(...userIds);
  } else {
    employeesQuery += " AND (is_active = 1 OR is_active IS NULL)";
  }
  employeesQuery += " ORDER BY user_id ASC";

  const employees = await dbAll(employeesQuery, params);
  if (!employees || employees.length === 0) {
    return {
      success: true,
      count: 0,
      total: 0,
      message: 'No active employees found to copy to terminal.'
    };
  }

  // Map employees for SpeedFace terminal registration
  const formattedUsers = employees.map(e => ({
    user_id: String(e.user_id).trim(),
    name: (e.name || ('User ' + e.user_id)).trim(),
    role: (e.role === 'Admin' || e.role === '14' || e.role === 14) ? 14 : 0,
    card_no: e.card_no ? (parseInt(e.card_no, 10) || 0) : 0
  }));

  // If terminalId is 'all', sync across all enabled terminals in fleet
  if (terminalId === 'all') {
    const terminals = await getAllTerminals();
    const activeTerms = terminals.filter(t => t.is_enabled);
    if (activeTerms.length === 0) {
      return { success: false, error: 'No enabled biometric terminals found in fleet.' };
    }

    const results = [];
    for (const term of activeTerms) {
      try {
        const localAddress = await getOrDetectLocalAddress(overrideLocalAddress, term.ip);
        const client = new SpeedFaceClient(term.ip, term.port || 4370, 6000, localAddress);
        const res = await client.setUsersBatch(formattedUsers);

        await updateTerminalMetrics(term.id, {
          user_count: formattedUsers.length,
          last_seen: new Date().toISOString()
        });

        await dbRun(
          "INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message) VALUES (?, ?, ?, ?, ?)",
          ['EMPLOYEE_PUSH', 'SUCCESS', res.count, formattedUsers.length, 'Copied ' + res.count + ' employees to terminal "' + term.name + '" (' + term.ip + ')']
        );

        results.push({ id: term.id, name: term.name, ip: term.ip, success: true, count: res.count });
      } catch (tErr) {
        results.push({ id: term.id, name: term.name, ip: term.ip, success: false, error: tErr.message });
      }
    }

    const successful = results.filter(r => r.success);
    return {
      success: successful.length > 0,
      totalEmployees: formattedUsers.length,
      terminalsUpdated: successful.length,
      totalTerminals: activeTerms.length,
      message: 'Copied ' + formattedUsers.length + ' employee(s) to ' + successful.length + '/' + activeTerms.length + ' active terminal(s)',
      results
    };
  }

  // Single terminal target
  const terminal = await getTerminalById(terminalId);
  if (!terminal) throw new Error('Terminal ID ' + terminalId + ' not found');

  const localAddress = await getOrDetectLocalAddress(overrideLocalAddress, terminal.ip);
  const client = new SpeedFaceClient(terminal.ip, terminal.port || 4370, 6000, localAddress);
  const res = await client.setUsersBatch(formattedUsers);

  await updateTerminalMetrics(terminal.id, {
    user_count: formattedUsers.length,
    last_seen: new Date().toISOString()
  });

  await dbRun(
    "INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message) VALUES (?, ?, ?, ?, ?)",
    ['EMPLOYEE_PUSH', 'SUCCESS', res.count, formattedUsers.length, 'Copied ' + res.count + ' employees to terminal "' + terminal.name + '" (' + terminal.ip + ')']
  );

  return {
    success: true,
    terminalId: terminal.id,
    terminalName: terminal.name,
    count: res.count,
    total: formattedUsers.length,
    message: 'Successfully copied ' + res.count + ' employee(s) to ' + terminal.name + '!'
  };
}

/**
 * Clears attendance punch logs stored in the physical terminal hardware buffer.
 * @param {string|number} terminalId - specific terminal ID or 'all'
 * @param {string} overrideLocalAddress - optional local network adapter IP
 */
async function clearTerminalLogs(terminalId, overrideLocalAddress = null) {
  if (config.isCloudDeploy) {
    return {
      success: false,
      cloudMode: true,
      message: 'Direct hardware terminal clearing is disabled in Cloud Deploy mode.'
    };
  }

  // If terminalId is 'all', clear across all active terminals
  if (terminalId === 'all') {
    const terminals = await getAllTerminals();
    const activeTerms = terminals.filter(t => t.is_enabled);
    if (activeTerms.length === 0) {
      return { success: false, error: 'No enabled biometric terminals found in fleet.' };
    }

    const results = [];
    for (const term of activeTerms) {
      try {
        const localAddress = await getOrDetectLocalAddress(overrideLocalAddress, term.ip);
        const client = new SpeedFaceClient(term.ip, term.port || 4370, 6000, localAddress);
        await client.clearAttendanceLogs();

        await updateTerminalMetrics(term.id, {
          log_count: 0,
          last_seen: new Date().toISOString()
        });

        await dbRun(
          "INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message) VALUES (?, ?, ?, ?, ?)",
          ['TERMINAL_PURGE', 'SUCCESS', 0, 0, 'Erased hardware punch logs on terminal "' + term.name + '" (' + term.ip + ')']
        );

        results.push({ id: term.id, name: term.name, ip: term.ip, success: true });
      } catch (tErr) {
        results.push({ id: term.id, name: term.name, ip: term.ip, success: false, error: tErr.message });
      }
    }

    const successful = results.filter(r => r.success);
    return {
      success: successful.length > 0,
      terminalsCleared: successful.length,
      totalTerminals: activeTerms.length,
      message: 'Erased attendance records on ' + successful.length + '/' + activeTerms.length + ' terminal(s)',
      results
    };
  }

  // Single terminal target
  const terminal = await getTerminalById(terminalId);
  if (!terminal) throw new Error('Terminal ID ' + terminalId + ' not found');

  const localAddress = await getOrDetectLocalAddress(overrideLocalAddress, terminal.ip);
  const client = new SpeedFaceClient(terminal.ip, terminal.port || 4370, 6000, localAddress);
  await client.clearAttendanceLogs();

  await updateTerminalMetrics(terminal.id, {
    log_count: 0,
    last_seen: new Date().toISOString()
  });

  await dbRun(
    "INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message) VALUES (?, ?, ?, ?, ?)",
    ['TERMINAL_PURGE', 'SUCCESS', 0, 0, 'Erased hardware punch logs on terminal "' + terminal.name + '" (' + terminal.ip + ')']
  );

  return {
    success: true,
    terminalId: terminal.id,
    terminalName: terminal.name,
    message: 'Attendance records successfully erased on "' + terminal.name + '". Device punch buffer reset to 0.'
  };
}

async function syncFromDevice(deviceIp = '192.168.10.15', devicePort = 4370, localAddress = null, terminalId = null, terminalName = null) {
  if (isSyncing) {
    return { success: false, message: 'A synchronization is already in progress' };
  }

  isSyncing = true;
  stopSyncRequested = false;
  lastSyncStatus.status = 'SYNCING';
  notifyWs('SYNC_STATUS', { status: 'SYNCING', message: 'Connecting to device...' });

  if (!localAddress) {
    try {
      const netSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);
      if (netSetting && netSetting.value) localAddress = netSetting.value;
    } catch (e) {}
  }

  localAddress = await getOrDetectLocalAddress(localAddress, deviceIp);
  const client = new SpeedFaceClient(deviceIp, devicePort, 10000, localAddress);
  activeClient = client;
  const startTime = Date.now();

  try {
    if (stopSyncRequested) {
      throw new Error('Synchronization stopped by user');
    }

    // 1. Test connection and get device info
    console.log(`[SYNC] Connecting to SpeedFace at ${deviceIp}:${devicePort}...`);
    const connInfo = await client.testConnection();
    
    if (stopSyncRequested) {
      throw new Error('Synchronization stopped by user');
    }

    if (!connInfo.success) {
      throw new Error(connInfo.error || 'Failed to establish connection to device');
    }

    lastSyncStatus.deviceOnline = true;
    lastSyncStatus.deviceInfo = connInfo;
    if (connInfo.logCounts) {
      lastKnownLogCount = connInfo.logCounts;
    }

    notifyWs('DEVICE_STATUS', {
      online: true,
      ip: deviceIp,
      port: devicePort,
      deviceInfo: connInfo
    });

    if (stopSyncRequested) {
      throw new Error('Synchronization stopped by user');
    }

    // 2. Fetch Users
    notifyWs('SYNC_STATUS', { status: 'SYNCING', message: 'Fetching enrolled employees...' });
    let users = [];
    try {
      users = await client.getUsers();
      if (users.length > 0) {
        await upsertEmployees(users);
        console.log(`[SYNC] Synced ${users.length} users into employee registry.`);
      }
    } catch (uErr) {
      console.warn('[SYNC] Notice: User list retrieval:', uErr.message);
    }

    if (stopSyncRequested) {
      throw new Error('Synchronization stopped by user');
    }

    // 3. Fetch Attendance Records (SpeedFace 49-byte format)
    notifyWs('SYNC_STATUS', { status: 'SYNCING', message: 'Reading attendance logs from terminal...' });
    const records = await client.getAttendances();
    if (stopSyncRequested) {
      throw new Error('Synchronization stopped by user');
    }

    console.log(`[SYNC] Pulled ${records.length} records from ${deviceIp}. Inserting into database...`);

    // Resolve active organization partition for incoming biometric records
    let targetOrgId = null;
    try {
      const orgRow = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_org_id'`);
      targetOrgId = (orgRow && orgRow.value ? orgRow.value.trim() : 'DSOFFICE_LUNUGAMWEHERA').toUpperCase();
    } catch (e) {
      targetOrgId = 'DSOFFICE_LUNUGAMWEHERA';
    }

    const insertResult = await insertAttendanceBatch(records, targetOrgId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    lastSyncStatus.lastSyncTime = new Date().toISOString();
    lastSyncStatus.status = 'SUCCESS';
    lastSyncStatus.totalSynced = insertResult.inserted;
    lastSyncStatus.error = null;

    // Update terminal metrics in database
    let matchedTermId = terminalId;
    if (!matchedTermId) {
      try {
        const mTerm = await getTerminalByIp(deviceIp);
        if (mTerm) matchedTermId = mTerm.id;
      } catch (e) {}
    }
    if (matchedTermId) {
      try {
        await updateTerminalMetrics(matchedTermId, {
          status: 'ONLINE',
          last_sync: lastSyncStatus.lastSyncTime,
          last_seen: lastSyncStatus.lastSyncTime,
          log_count: records.length,
          user_count: users ? users.length : undefined
        });
      } catch (e) {}
    }

    console.log(`[SYNC] Done! Total logs on device: ${records.length}. New records inserted: ${insertResult.inserted}. Took ${duration}s.`);

    // Log to DB
    await dbRun(
      `INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message) VALUES (?, ?, ?, ?, ?)`,
      ['DIRECT_SYNC', 'SUCCESS', insertResult.inserted, records.length, `Completed in ${duration}s`]
    );

    // If new records were found, update feed and notify dashboard!
    if (insertResult.inserted > 0) {
      const newRecs = records.slice(-insertResult.inserted);
      // Broadcast at most the latest 3 punches to live feed so batch sync does not flood WebSocket/clients
      const feedPreview = newRecs.slice(-3);
      for (const nr of feedPreview) {
        try {
          const emp = await dbGet(`SELECT name, department FROM employees WHERE user_id = ?`, [nr.user_id]);
          broadcastLivePunch({
            ...nr,
            employee_name: emp ? emp.name : ''
          });
        } catch (e) {
          broadcastLivePunch(nr);
        }
      }

      notifyWs('NEW_RECORDS_SYNCED', {
        newCount: insertResult.inserted,
        totalDeviceLogs: records.length
      });
    }

    notifyWs('SYNC_STATUS', {
      status: 'IDLE',
      lastSync: lastSyncStatus.lastSyncTime,
      newRecords: insertResult.inserted,
      totalRecords: records.length,
      deviceOnline: true
    });

    // Live Auto-Upload: Instantly upload new/pending records to Firebase Firestore organization partition
    if (!stopSyncRequested) {
      firebaseService.syncPendingAttendance({ orgId: targetOrgId, limit: 500 }).then(cloudRes => {
        if (cloudRes && cloudRes.success && cloudRes.uploadedCount > 0) {
          console.log(`[LIVE SYNC] Uploaded ${cloudRes.uploadedCount} latest punch(es) to Firestore partition: ${targetOrgId}`);
          notifyWs('FIREBASE_SYNC_PROGRESS', cloudRes);
        }
      }).catch(err => {
        console.warn('[LIVE SYNC] Cloud partition upload notice:', err.message);
      });
    }

    return {
      success: true,
      newRecords: insertResult.inserted,
      totalDeviceLogs: records.length,
      userCounts: connInfo.userCounts,
      durationSeconds: duration
    };
  } catch (err) {
    if (stopSyncRequested) {
      lastSyncStatus.status = 'STOPPED';
      lastSyncStatus.error = 'Sync stopped by user';
      console.log('[SYNC] Device sync stopped by user.');
      notifyWs('SYNC_STATUS', {
        status: 'STOPPED',
        message: 'Machine synchronization stopped by user',
        deviceOnline: lastSyncStatus.deviceOnline
      });
      return {
        success: false,
        stopped: true,
        message: 'Synchronization stopped by user'
      };
    }

    lastSyncStatus.status = 'ERROR';
    lastSyncStatus.deviceOnline = false;
    lastSyncStatus.error = err.message;

    console.error(`[SYNC] Sync failed:`, err.message);

    await dbRun(
      `INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message) VALUES (?, ?, ?, ?, ?)`,
      ['DIRECT_SYNC', 'FAILED', 0, 0, err.message]
    );

    notifyWs('SYNC_STATUS', {
      status: 'ERROR',
      error: err.message,
      deviceOnline: false
    });

    notifyWs('DEVICE_STATUS', {
      online: false,
      ip: deviceIp,
      port: devicePort,
      error: err.message
    });

    return {
      success: false,
      error: err.message
    };
  } finally {
    isSyncing = false;
    activeClient = null;
  }
}

/**
 * Starts automated health checking & background sync.
 */
function startAutoSync(intervalSeconds = 60, getSettingsFn) {
  if (syncTimer) clearInterval(syncTimer);
  if (healthCheckTimer) clearInterval(healthCheckTimer);

  const ms = Math.max(15, intervalSeconds) * 1000;
  console.log(`[SYNC] Automated background sync scheduled every ${intervalSeconds}s.`);

  async function resolveTarget() {
    let ip = '192.168.10.15';
    let port = 4370;
    let localAddress = null;
    let enabled = true;

    if (getSettingsFn) {
      try {
        const settings = await getSettingsFn();
        if (settings.auto_sync_enabled === 'false') enabled = false;
        if (settings.device_ip) ip = settings.device_ip;
        if (settings.device_port) port = parseInt(settings.device_port, 10);
        if (settings.network_interface_ip) localAddress = settings.network_interface_ip;
      } catch (e) {}
    } else {
      try {
        const ipRow = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
        const portRow = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
        const ifaceRow = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);
        const autoRow = await dbGet(`SELECT value FROM settings WHERE key = 'auto_sync_enabled'`);
        if (autoRow && autoRow.value === 'false') enabled = false;
        if (ipRow && ipRow.value) ip = ipRow.value;
        if (portRow && portRow.value) port = parseInt(portRow.value, 10);
        if (ifaceRow && ifaceRow.value) localAddress = ifaceRow.value;
      } catch (e) {}
    }
    localAddress = await getOrDetectLocalAddress(localAddress, ip);
    return { ip, port, localAddress, enabled };
  }

  // 1. Run initial health check immediately
  resolveTarget().then(({ ip, port, localAddress }) => {
    checkDeviceHealth(ip, port, localAddress);
  });

  // 2. Health check / fast watcher every 10 seconds for all terminals
  healthCheckTimer = setInterval(async () => {
    try {
      await checkAllTerminalsHealth();
    } catch (err) {}
  }, 10000);

  // 3. Periodic full sync across all active terminals
  syncTimer = setInterval(async () => {
    try {
      const { enabled } = await resolveTarget();
      if (!enabled) return;
      await syncAllTerminals();
    } catch (err) {
      console.warn('[SYNC] Scheduled fleet sync cycle error:', err.message);
    }
  }, ms);

  // 4. Periodic background cloud-first master sync to Firebase Firestore
  if (cloudSyncTimer) clearInterval(cloudSyncTimer);
  cloudSyncTimer = setInterval(async () => {
    try {
      const status = await firebaseService.getStatus();
      if (status.configured && status.enabled && status.autoSync) {
        if (status.quotaExceeded && status.quotaExceededUntil && Date.now() < status.quotaExceededUntil) {
          // In quota backoff cooldown - skip this interval
          return;
        }
        // Cloud-first: checks cloud data first, then synchronizes local new records across multiple servers
        const cloudRes = await firebaseService.syncAllCloudFirst({ reason: 'BACKGROUND_TIMER', daysBack: 7 });
        if (cloudRes.success) {
          notifyWs('FIREBASE_SYNC_PROGRESS', cloudRes);
        }
      }
    } catch (cErr) {
      console.warn('[SYNC] Scheduled cloud-first sync cycle error:', cErr.message);
    }
  }, Math.max(30000, ms));
}

function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  if (cloudSyncTimer) {
    clearInterval(cloudSyncTimer);
    cloudSyncTimer = null;
  }
}

/**
 * Stops any in-progress device synchronization and updates state.
 */
async function cancelDeviceSync() {
  if (!isSyncing && !activeClient) {
    return { success: true, message: 'No device synchronization in progress', isSyncing: false };
  }

  stopSyncRequested = true;
  if (activeClient) {
    try {
      activeClient.abort();
    } catch (e) {}
    activeClient = null;
  }

  isSyncing = false;
  lastSyncStatus.status = 'STOPPED';
  lastSyncStatus.error = 'Machine synchronization stopped by user';

  notifyWs('SYNC_STATUS', {
    status: 'STOPPED',
    message: 'Machine synchronization stopped by user',
    deviceOnline: lastSyncStatus.deviceOnline
  });

  return { success: true, message: 'Machine synchronization stopped' };
}

function getSyncStatus() {
  return {
    isSyncing,
    ...lastSyncStatus
  };
}

module.exports = {
  syncFromDevice,
  cancelDeviceSync,
  checkDeviceHealth,
  checkTerminalHealth,
  checkAllTerminalsHealth,
  syncTerminal,
  syncAllTerminals,
  pushEmployeesToTerminal,
  clearTerminalLogs,
  startAutoSync,
  stopAutoSync,
  getSyncStatus,
  setSyncWsBroadcast
};
