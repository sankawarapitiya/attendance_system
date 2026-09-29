const net = require('net');
const os = require('os');
const ZKLib = require('node-zklib');
const { COMMANDS, REQUEST_DATA } = require('node-zklib/constants');
const { getVerifyModeName, getPunchStateName } = require('./db');

/**
 * Returns all active, non-internal IPv4 addresses assigned to this machine.
 */
function getActiveLocalIpv4s() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const netInfo of interfaces[name]) {
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        ips.push(netInfo.address);
      }
    }
  }
  return ips;
}

/**
 * Decodes the 32-bit encoded timestamp used by ZKTeco SpeedFace-V5L firmware.
 * Format:
 * second = time % 60;
 * minute = ((time - second) / 60) % 60;
 * hour = ((time - second) / 3600) % 24;
 * day = (((time - second) / 86400) % 31) + 1;
 * month = ((((time - second) / 86400) - (day - 1)) / 31) % 12 + 1;
 * year = 2000 + floor(...);
 */
function decodeZKTime(time) {
  if (!time || time <= 0) return null;
  
  const second = time % 60;
  time = Math.floor((time - second) / 60);
  const minute = time % 60;
  time = Math.floor((time - minute) / 60);
  const hour = time % 24;
  time = Math.floor((time - hour) / 24);
  const day = (time % 31) + 1;
  time = Math.floor((time - (day - 1)) / 31);
  const month = (time % 12) + 1;
  time = Math.floor((time - (month - 1)) / 12);
  const year = time + 2000;

  // Format as YYYY-MM-DD HH:mm:ss
  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Encodes a JavaScript Date into ZKTeco 32-bit integer timestamp.
 */
function encodeZKTime(date = new Date()) {
  const year = date.getFullYear() - 2000;
  const month = date.getMonth(); // 0-11
  const day = date.getDate() - 1; // 0-30
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return (
    ((year * 12 + month) * 31 + day) * (24 * 60 * 60) +
    (hour * 60 + minute) * 60 +
    second
  );
}

class SpeedFaceClient {
  constructor(ip = '192.168.10.15', port = 4370, timeout = 7000, localAddress = null) {
    this.ip = ip;
    this.port = parseInt(port, 10) || 4370;
    this.timeout = timeout;
    this.localAddress = localAddress;
  }

  createInstance() {
    const zk = new ZKLib(this.ip, this.port, this.timeout, 4000);
    const activeIps = getActiveLocalIpv4s();
    const validBindAddr = (this.localAddress && activeIps.includes(this.localAddress)) ? this.localAddress : null;

    if (this.localAddress && !validBindAddr) {
      console.warn(`[SpeedFaceClient] Configured interface IP ${this.localAddress} is not active on this host (${activeIps.join(', ')}). Connecting via default routing.`);
    }

    zk.zklibTcp.createSocket = function(cbError, cbClose) {
      return new Promise((resolve, reject) => {
        let socket = new net.Socket();
        this.socket = socket;
        let hasResolved = false;

        const connectWith = (bindAddr) => {
          socket.removeAllListeners('error');
          socket.removeAllListeners('connect');
          socket.removeAllListeners('close');

          socket.once('error', (err) => {
            if (bindAddr && (err.code === 'EADDRNOTAVAIL' || err.code === 'EINVAL')) {
              console.warn(`[SpeedFaceClient] Socket bind to ${bindAddr} failed (${err.code}). Retrying without localAddress...`);
              try { socket.destroy(); } catch (e) {}
              socket = new net.Socket();
              this.socket = socket;
              connectWith(null);
              return;
            }
            if (!hasResolved) reject(err);
            cbError && cbError(err);
          });

          socket.once('connect', () => {
            hasResolved = true;
            resolve(socket);
          });

          socket.once('close', (err) => {
            this.socket = null;
            cbClose && cbClose('tcp');
          });

          if (this.timeout) {
            socket.setTimeout(this.timeout);
          }

          const connectOpts = { port: this.port, host: this.ip };
          if (bindAddr) connectOpts.localAddress = bindAddr;
          socket.connect(connectOpts);
        };

        connectWith(validBindAddr);
      });
    };

    this.activeZk = zk;
    return zk;
  }

  /**
   * Immediately aborts and destroys any active socket connection.
   */
  abort() {
    if (this.activeZk) {
      try {
        if (this.activeZk.zklibTcp && this.activeZk.zklibTcp.socket) {
          this.activeZk.zklibTcp.socket.destroy();
        }
        this.activeZk.disconnect().catch(() => {});
      } catch (e) {}
      this.activeZk = null;
    }
  }

  /**
   * Tests TCP connection and retrieves device information.
   */
  async testConnection() {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      let info = {};
      try {
        info = await zk.getInfo();
      } catch (err) {
        console.warn('Could not get full info:', err.message);
      }

      // Query device time
      let deviceTime = null;
      try {
        const timeRes = await zk.zklibTcp.executeCmd(COMMANDS.CMD_GET_TIME, '');
        if (timeRes && timeRes.length >= 12) {
          const rawTime = timeRes.readUInt32LE(8);
          deviceTime = decodeZKTime(rawTime);
        }
      } catch (tErr) {
        console.warn('Could not get device time:', tErr.message);
      }

      await zk.disconnect();
      return {
        success: true,
        ip: this.ip,
        port: this.port,
        deviceTime,
        userCounts: info.userCounts || 0,
        logCounts: info.logCounts || 0,
        logCapacity: info.logCapacity || 200000
      };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      return {
        success: false,
        ip: this.ip,
        port: this.port,
        error: err.message || 'Connection failed'
      };
    }
  }

  /**
   * Pulls all users enrolled on the SpeedFace device.
   */
  async getUsers() {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      const usersRes = await zk.getUsers();
      await zk.disconnect();

      const users = (usersRes && usersRes.data) || [];
      return users.map((u) => ({
        uid: u.uid,
        userId: String(u.userId || u.uid).trim(),
        name: (u.name || '').trim(),
        role: u.role,
        cardNo: u.cardno || 0,
        password: u.password || ''
      }));
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Pulls and decodes attendance logs using the SpeedFace 49-byte packet format.
   */
  async getAttendances() {
    const zk = this.createInstance();
    try {
      await zk.createSocket();

      // Read raw attendance buffer
      const res = await zk.zklibTcp.readWithBuffer(REQUEST_DATA.GET_ATTENDANCE_LOGS);
      await zk.disconnect();

      if (!res || !res.data || res.data.length < 4) {
        return [];
      }

      // First 4 bytes indicate total data payload size
      const buf = res.data.subarray(4);

      // Auto-detect record packet size:
      // Standard ZKTeco Linux firmware uses 40-byte records.
      // SpeedFace extended face recognition firmware uses 49-byte records.
      let RECORD_SIZE = 40;
      if (buf.length % 40 === 0 && buf.length % 49 !== 0) {
        RECORD_SIZE = 40;
      } else if (buf.length % 49 === 0 && buf.length % 40 !== 0) {
        RECORD_SIZE = 49;
      } else {
        // Sample candidate records to test for valid realistic timestamps (between 2020 and next year)
        const checkCandidate = (size) => {
          let valid = 0;
          const count = Math.min(10, Math.floor(buf.length / size));
          for (let s = 0; s < count; s++) {
            if (s * size + 31 <= buf.length) {
              const tu = buf.readUInt32LE(s * size + 27);
              const dt = decodeZKTime(tu);
              if (dt) {
                const yr = parseInt(dt.slice(0, 4), 10);
                if (yr >= 2020 && yr <= 2028) valid++;
              }
            }
          }
          return valid;
        };
        const valid40 = checkCandidate(40);
        const valid49 = checkCandidate(49);
        RECORD_SIZE = (valid49 > valid40) ? 49 : 40;
      }

      const totalRecords = Math.floor(buf.length / RECORD_SIZE);

      const records = [];
      const currentYear = new Date().getFullYear();

      for (let i = 0; i < totalRecords; i++) {
        const slice = buf.subarray(i * RECORD_SIZE, (i + 1) * RECORD_SIZE);
        const userSn = slice.readUInt16LE(0);
        const userId = slice.subarray(2, 26).toString('ascii').replace(/\0/g, '').trim();
        const verifyMode = slice.readUInt8(26);
        const timeUint = slice.readUInt32LE(27);
        const punchState = slice.readUInt8(31);
        const workCode = slice.readUInt8(32);

        // Skip blank or invalid entries
        if (!userId || timeUint === 0) continue;

        const punchTime = decodeZKTime(timeUint);
        if (!punchTime) continue;

        // Ensure reasonable year (2020 to currentYear) and reject impossible future years like 2035
        const year = parseInt(punchTime.slice(0, 4), 10);
        if (isNaN(year) || year < 2020 || year > currentYear) continue;
        if (!/^[a-zA-Z0-9_-]+$/.test(userId)) continue;

        records.push({
          user_sn: userSn,
          user_id: userId,
          punch_time: punchTime,
          verify_mode: verifyMode,
          verify_name: getVerifyModeName(verifyMode),
          punch_state: punchState,
          punch_state_name: getPunchStateName(punchState),
          work_code: workCode,
          device_ip: this.ip,
          source: 'DIRECT_SYNC'
        });
      }

      return records;
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Retrieves the current clock time from the SpeedFace terminal.
   */
  async getTime() {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      const timeRes = await zk.zklibTcp.executeCmd(COMMANDS.CMD_GET_TIME, '');
      let deviceTime = null;
      let rawTime = null;
      if (timeRes && timeRes.length >= 12) {
        rawTime = timeRes.readUInt32LE(8);
        deviceTime = decodeZKTime(rawTime);
      }
      await zk.disconnect();
      return { success: true, deviceTime, rawTime };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Synchronizes the SpeedFace terminal's clock with the specified date/time or current computer time.
   * @param {Date|string|number} [targetDate] - Custom Date, ISO string, or timestamp. If omitted/null, uses current time.
   */
  async syncTime(targetDate = null) {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      let dateToSet;
      if (!targetDate) {
        dateToSet = new Date();
      } else if (targetDate instanceof Date) {
        dateToSet = targetDate;
      } else {
        dateToSet = new Date(targetDate);
      }

      if (isNaN(dateToSet.getTime())) {
        throw new Error('Invalid date/time provided for synchronization.');
      }

      const encoded = encodeZKTime(dateToSet);
      const timeBuf = Buffer.alloc(4);
      timeBuf.writeUInt32LE(encoded, 0);

      await zk.zklibTcp.executeCmd(COMMANDS.CMD_SET_TIME, timeBuf);

      // Verify and read back confirmed device time
      let confirmedTime = null;
      try {
        const timeRes = await zk.zklibTcp.executeCmd(COMMANDS.CMD_GET_TIME, '');
        if (timeRes && timeRes.length >= 12) {
          const rawTime = timeRes.readUInt32LE(8);
          confirmedTime = decodeZKTime(rawTime);
        }
      } catch (e) {
        console.warn('Could not read back confirmed time:', e.message);
      }

      await zk.disconnect();
      return { 
        success: true, 
        syncedTime: confirmedTime || dateToSet.toISOString(),
        formattedTime: confirmedTime || dateToSet.toLocaleString('sv-SE').replace('T', ' ')
      };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Sets or updates a single user on the SpeedFace terminal.
   */
  async setUser({ userId, name = '', role = 0, cardNo = 0, password = '', uid = null }) {
    const zk = this.createInstance();
    try {
      await zk.createSocket();

      let userUid = uid;
      let userCard = cardNo;
      let userPwd = password;

      if (!userUid) {
        try {
          const allUsers = await zk.getUsers();
          const existing = allUsers.data.find(u => String(u.userId) === String(userId));
          if (existing) {
            userUid = existing.uid;
            if (!userPwd && existing.password) userPwd = existing.password;
            if (!userCard && existing.cardno) userCard = existing.cardno;
          } else {
            const maxUid = allUsers.data.reduce((max, u) => Math.max(max, u.uid || 0), 0);
            userUid = maxUid + 1;
          }
        } catch (e) {
          userUid = parseInt(userId, 10) || 1;
        }
      }

      // 72-byte SpeedFace user packet
      const buf = Buffer.alloc(72, 0);
      buf.writeUInt16LE(userUid, 0);

      // Role: 14 = Admin, 0 = Normal User
      const roleCode = (role === 14 || String(role).toLowerCase() === 'admin') ? 14 : 0;
      buf.writeUInt8(roleCode, 2);

      if (userPwd) buf.write(String(userPwd).slice(0, 8), 3, 'ascii');
      if (name) buf.write(String(name).slice(0, 24), 11, 'ascii');
      if (userCard) buf.writeUInt32LE(parseInt(userCard, 10) || 0, 35);
      if (userId) buf.write(String(userId).slice(0, 24), 48, 'ascii');

      await zk.zklibTcp.executeCmd(COMMANDS.CMD_USER_WRQ, buf);
      await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
      await zk.disconnect();

      return { success: true, userId, name, uid: userUid };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Deletes a user and their enrolled biometrics from the SpeedFace terminal.
   */
  async deleteUser(userId) {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      let userUid = null;

      try {
        const allUsers = await zk.getUsers();
        const existing = allUsers.data.find(u => String(u.userId) === String(userId) || String(u.uid) === String(userId));
        if (existing) {
          userUid = existing.uid;
        }
      } catch (e) {
        console.warn(`[ZK] Could not fetch user list for delete: ${e.message}`);
      }

      if (userUid === null || isNaN(userUid)) {
        const parsed = parseInt(userId, 10);
        userUid = (!isNaN(parsed) && parsed >= 0 && parsed <= 65535) ? parsed : 0;
      }
      const safeUid = (userUid & 0xFFFF);

      // 1. Delete user from terminal (CMD_DELETE_USER: 18)
      try {
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(safeUid, 0);
        await zk.zklibTcp.executeCmd(COMMANDS.CMD_DELETE_USER, buf);
      } catch (cmdErr) {
        // Fallback: try 72-byte buffer with userId
        const buf72 = Buffer.alloc(72, 0);
        buf72.writeUInt16LE(safeUid, 0);
        buf72.write(String(userId).slice(0, 24), 48, 'ascii');
        await zk.zklibTcp.executeCmd(COMMANDS.CMD_DELETE_USER, buf72);
      }

      // 2. Delete user biometric templates if any (CMD_DELETE_USERTEMP: 19)
      try {
        const tempBuf = Buffer.alloc(3);
        tempBuf.writeUInt16LE(safeUid, 0);
        tempBuf.writeUInt8(0xFF, 2); // all fingers / face templates
        await zk.zklibTcp.executeCmd(COMMANDS.CMD_DELETE_USERTEMP, tempBuf);
      } catch (tErr) {}

      await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
      await zk.disconnect();

      return { success: true, userId, uid: safeUid };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Uploads user photo / face template over TCP port 4370.
   */
  async uploadUserPhoto(userId, photoBuffer) {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      const fileName = `${userId}.jpg\0`;
      const fnBuf = Buffer.from(fileName, 'ascii');

      // CMD_PREPARE_DATA (1500)
      const prepBuf = Buffer.alloc(4);
      prepBuf.writeUInt32LE(photoBuffer.length, 0);
      try {
        await zk.zklibTcp.executeCmd(COMMANDS.CMD_PREPARE_DATA, prepBuf);
      } catch (e) {}

      // CMD_DATA_WRRQ (1503)
      const dataPayload = Buffer.concat([fnBuf, photoBuffer]);
      try {
        await zk.zklibTcp.executeCmd(COMMANDS.CMD_DATA_WRRQ, dataPayload);
        await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
      } catch (e) {}

      await zk.disconnect();
      return { success: true };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      return { success: false, error: err.message };
    }
  }

  /**
   * Pushes a batch of users to the SpeedFace terminal.
   */
  async setUsersBatch(users = []) {
    if (!users || users.length === 0) return { success: true, count: 0 };
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      const allUsers = await zk.getUsers();
      const existingMap = {};
      allUsers.data.forEach(u => { existingMap[String(u.userId)] = u; });

      let maxUid = allUsers.data.reduce((max, u) => Math.max(max, u.uid || 0), 0);
      let updatedCount = 0;

      for (const u of users) {
        const userId = String(u.user_id || u.userId).trim();
        if (!userId) continue;

        const existing = existingMap[userId];
        const userUid = existing ? existing.uid : (++maxUid);
        const name = (u.name || '').trim();
        const roleCode = (u.role === 14 || String(u.role).toLowerCase() === 'admin') ? 14 : 0;
        const cardNo = u.card_no || (existing ? existing.cardno : 0);
        const password = u.password || (existing ? existing.password : '');

        const buf = Buffer.alloc(72, 0);
        buf.writeUInt16LE(userUid, 0);
        buf.writeUInt8(roleCode, 2);
        if (password) buf.write(String(password).slice(0, 8), 3, 'ascii');
        if (name) buf.write(String(name).slice(0, 24), 11, 'ascii');
        if (cardNo) buf.writeUInt32LE(parseInt(cardNo, 10) || 0, 35);
        buf.write(String(userId).slice(0, 24), 48, 'ascii');

        await zk.zklibTcp.executeCmd(COMMANDS.CMD_USER_WRQ, buf);
        updatedCount++;
      }

      await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
      await zk.disconnect();
      return { success: true, count: updatedCount };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Clears attendance log records stored on the physical SpeedFace terminal.
   */
  async clearAttendanceLogs() {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      await zk.clearAttendanceLog();
      await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
      await zk.disconnect();
      return { success: true, message: 'Terminal attendance logs cleared successfully' };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Pulls and decodes device operation/audit logs (OPLOG / SuperLog).
   */
  async getDeviceAuditLogs() {
    const zk = this.createInstance();
    try {
      await zk.createSocket();

      // Read raw operation log buffer using CMD_OPLOG_RRQ (command 34 / 0x22)
      const reqData = Buffer.from([0x01, 0x22, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      let res = null;
      try {
        res = await zk.zklibTcp.readWithBuffer(reqData);
      } catch (err) {
        console.warn(`[SpeedFaceClient] CMD_OPLOG_RRQ direct read notice: ${err.message}`);
      }

      await zk.disconnect();

      if (!res || !res.data || res.data.length < 4) {
        return [];
      }

      const buf = res.data.subarray(4);
      return parseDeviceAuditLogBuffer(buf, this.ip);
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }

  /**
   * Clears device audit / operation logs stored on the physical SpeedFace terminal.
   */
  async clearDeviceAuditLogs() {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      await zk.zklibTcp.executeCmd(COMMANDS.CMD_CLEAR_OPLOG || 33, '');
      await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
      await zk.disconnect();
      return { success: true, message: 'Terminal operation audit logs cleared successfully' };
    } catch (err) {
      try { await zk.disconnect(); } catch (e) {}
      throw err;
    }
  }
}

/**
 * ZKTeco Standard Operation Codes Mapping
 */
const OPERATION_CODES = {
  1: { name: 'POWER_ON', label: 'Power On / Startup', category: 'SYSTEM_CONFIG', icon: '⚡' },
  2: { name: 'POWER_OFF', label: 'Power Off / Shutdown', category: 'SYSTEM_CONFIG', icon: '🔌' },
  3: { name: 'ADMIN_LOGIN', label: 'Administrator Verification / Login', category: 'SECURITY_ADMIN', icon: '🔑' },
  4: { name: 'OPEN_MENU', label: 'Device System Menu Opened', category: 'SECURITY_ADMIN', icon: '📋' },
  5: { name: 'CHANGE_SETTING', label: 'Device Settings Modified', category: 'SYSTEM_CONFIG', icon: '⚙️' },
  6: { name: 'ENROLL_USER', label: 'New User Registered', category: 'USER_MGMT', icon: '👤' },
  7: { name: 'ENROLL_FINGER', label: 'Fingerprint Enrolled', category: 'USER_MGMT', icon: '👆' },
  8: { name: 'ENROLL_PASSWORD', label: 'PIN / Password Changed', category: 'SECURITY_ADMIN', icon: '🔒' },
  9: { name: 'ENROLL_CARD', label: 'RFID Card Enrolled', category: 'USER_MGMT', icon: '💳' },
  10: { name: 'DELETE_USER', label: 'User Deleted', category: 'USER_MGMT', icon: '🗑️' },
  11: { name: 'DELETE_FINGER', label: 'Fingerprint Deleted', category: 'USER_MGMT', icon: '❌' },
  12: { name: 'DELETE_PASSWORD', label: 'Password Cleared', category: 'SECURITY_ADMIN', icon: '🔓' },
  13: { name: 'DELETE_CARD', label: 'RFID Card Unlinked', category: 'USER_MGMT', icon: '💳' },
  14: { name: 'CLEAR_DATA', label: 'Terminal Data Cleared', category: 'DATA_MGMT', icon: '⚠️' },
  15: { name: 'CLEAR_ATT_LOG', label: 'Attendance Records Cleared', category: 'DATA_MGMT', icon: '🧹' },
  16: { name: 'MODIFY_TIME', label: 'Terminal Clock / Time Adjusted', category: 'SYSTEM_CONFIG', icon: '🕒' },
  17: { name: 'RESTORE_DEFAULT', label: 'Factory Settings Restored', category: 'SYSTEM_CONFIG', icon: '🔄' },
  18: { name: 'CLEAR_ADMIN', label: 'Admin Rights Cleared', category: 'SECURITY_ADMIN', icon: '🛡️' },
  19: { name: 'CHANGE_PRIVILEGE', label: 'User Privilege / Role Changed', category: 'USER_MGMT', icon: '⭐' },
  20: { name: 'MODIFY_USER_INFO', label: 'Employee Information Modified', category: 'USER_MGMT', icon: '✏️' },
  21: { name: 'UNLOCK_DOOR', label: 'Door Unlocked (Access Granted)', category: 'SECURITY_ADMIN', icon: '🚪' },
  22: { name: 'ALARM_TRIGGERED', label: 'Security Alarm Triggered', category: 'SECURITY_ADMIN', icon: '🚨' },
  23: { name: 'ALARM_SILENCED', label: 'Alarm Silenced / Cleared', category: 'SECURITY_ADMIN', icon: '🔕' },
  24: { name: 'ENROLL_FACE', label: 'Face Biometrics Enrolled', category: 'USER_MGMT', icon: '👤' },
  25: { name: 'DELETE_FACE', label: 'Face Biometrics Deleted', category: 'USER_MGMT', icon: '🗑️' },
  26: { name: 'ENROLL_PALM', label: 'Palm Biometrics Enrolled', category: 'USER_MGMT', icon: '✋' },
  27: { name: 'DELETE_PALM', label: 'Palm Biometrics Deleted', category: 'USER_MGMT', icon: '✋' },
  28: { name: 'SYNC_CLOUD', label: 'Cloud ADMS Sync Completed', category: 'DATA_MGMT', icon: '☁️' },
  29: { name: 'REBOOT', label: 'Terminal Rebooted', category: 'SYSTEM_CONFIG', icon: '🔄' },
  30: { name: 'EXPORT_DATA', label: 'Data Exported to USB/Net', category: 'DATA_MGMT', icon: '📤' },
  31: { name: 'IMPORT_DATA', label: 'Data Imported from USB/Net', category: 'DATA_MGMT', icon: '📥' }
};

function decodeOpCode(code) {
  const numericCode = parseInt(code, 10);
  if (OPERATION_CODES[numericCode]) {
    return OPERATION_CODES[numericCode];
  }
  return {
    name: `OP_CODE_${numericCode || code}`,
    label: `Device Operation (${numericCode || code})`,
    category: 'SYSTEM_CONFIG',
    icon: '⚙️'
  };
}

/**
 * Parses raw operation log buffer from ZKTeco/SpeedFace terminal.
 * Supports both text stream and binary record formats.
 */
function parseDeviceAuditLogBuffer(buf, deviceIp = '192.168.10.15') {
  const records = [];
  if (!buf || buf.length < 4) return records;

  // 1. Text payload check (e.g. ASCII stream starting with OPLOG)
  const preview = buf.subarray(0, Math.min(buf.length, 100)).toString('utf8');
  if (preview.includes('OPLOG') || preview.includes('\t')) {
    const lines = buf.toString('utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('\t');
      // Format: OPLOG <OpType>\t<OpWho>\t<OpTime>\t<Value1>\t<Value2>\t<Value3>
      let opType = 0;
      let adminId = '';
      let timeStr = '';
      let p1 = 0, p2 = 0, p3 = 0;

      if (parts[0].startsWith('OPLOG')) {
        const headerParts = parts[0].split(/\s+/);
        opType = parseInt(headerParts[1] || '0', 10);
        adminId = parts.length > 1 ? parts[1].trim() : '';
        timeStr = parts.length > 2 ? parts[2].trim() : '';
        p1 = parts.length > 3 ? parseInt(parts[3], 10) || 0 : 0;
        p2 = parts.length > 4 ? parseInt(parts[4], 10) || 0 : 0;
        p3 = parts.length > 5 ? parseInt(parts[5], 10) || 0 : 0;
      } else if (parts.length >= 3) {
        adminId = parts[0].trim();
        timeStr = parts[1].trim();
        opType = parseInt(parts[2], 10) || 0;
        p1 = parts.length > 3 ? parseInt(parts[3], 10) || 0 : 0;
        p2 = parts.length > 4 ? parseInt(parts[4], 10) || 0 : 0;
        p3 = parts.length > 5 ? parseInt(parts[5], 10) || 0 : 0;
      }

      if (timeStr) {
        const opInfo = decodeOpCode(opType);
        records.push({
          admin_id: adminId || '0',
          target_user_id: p1 > 0 ? String(p1) : '',
          action_code: opType,
          action_name: opInfo.name,
          category: opInfo.category,
          timestamp: timeStr,
          params1: p1,
          params2: p2,
          params3: p3,
          details: `${opInfo.label} (Code ${opType})`,
          device_ip: deviceIp,
          source: 'DIRECT_TCP'
        });
      }
    }
    if (records.length > 0) return records;
  }

  // 2. Binary record format detection
  // Common sizes in ZKTeco firmware: 16, 24, 28, 32, 36, 40, 48
  const candidateSizes = [16, 24, 28, 32, 36, 40, 48];
  let detectedSize = null;
  let timeOffset = 4;

  for (const size of candidateSizes) {
    if (buf.length >= size && buf.length % size === 0) {
      // Check if time uint is at offset 4 or offset 2
      for (const offset of [4, 2, 8, 27]) {
        if (offset + 4 <= size) {
          const t = buf.readUInt32LE(offset);
          const decoded = decodeZKTime(t);
          if (decoded) {
            const yr = parseInt(decoded.slice(0, 4), 10);
            if (yr >= 2000 && yr <= 2035) {
              detectedSize = size;
              timeOffset = offset;
              break;
            }
          }
        }
      }
      if (detectedSize) break;
    }
  }

  const recordSize = detectedSize || 16;
  const total = Math.floor(buf.length / recordSize);

  for (let i = 0; i < total; i++) {
    const slice = buf.subarray(i * recordSize, (i + 1) * recordSize);
    let adminId = '0';
    let opCode = 0;
    let timeUint = 0;
    let p1 = 0, p2 = 0, p3 = 0;
    let targetUserId = '';

    if (recordSize === 16) {
      adminId = String(slice.readUInt16LE(0));
      opCode = slice.readUInt16LE(2);
      timeUint = slice.readUInt32LE(4);
      p1 = slice.readUInt16LE(8);
      p2 = slice.readUInt16LE(10);
      p3 = slice.readUInt16LE(12);
      targetUserId = String(slice.readUInt16LE(14) || '');
    } else if (recordSize === 24) {
      adminId = String(slice.readUInt16LE(0));
      opCode = slice.readUInt16LE(2);
      timeUint = slice.readUInt32LE(4);
      targetUserId = String(slice.readUInt32LE(8) || '');
      p1 = slice.readUInt32LE(12);
      p2 = slice.readUInt32LE(16);
      p3 = slice.readUInt32LE(20);
    } else {
      // Generic fallback for other sizes
      adminId = String(slice.readUInt16LE(0));
      opCode = slice.readUInt8(2) || slice.readUInt16LE(2);
      timeUint = timeOffset + 4 <= slice.length ? slice.readUInt32LE(timeOffset) : 0;
      if (slice.length >= timeOffset + 8) p1 = slice.readUInt16LE(timeOffset + 4);
      if (slice.length >= timeOffset + 10) p2 = slice.readUInt16LE(timeOffset + 6);
      if (slice.length >= timeOffset + 12) p3 = slice.readUInt16LE(timeOffset + 8);
    }

    if (timeUint === 0) continue;
    const punchTime = decodeZKTime(timeUint);
    if (!punchTime) continue;

    const yr = parseInt(punchTime.slice(0, 4), 10);
    if (isNaN(yr) || yr < 2000 || yr > 2035) continue;

    const opInfo = decodeOpCode(opCode);
    records.push({
      admin_id: adminId === '0' ? 'Admin' : adminId,
      target_user_id: targetUserId === '0' ? '' : targetUserId,
      action_code: opCode,
      action_name: opInfo.name,
      category: opInfo.category,
      timestamp: punchTime,
      params1: p1,
      params2: p2,
      params3: p3,
      details: `${opInfo.label} (Code: ${opCode})`,
      device_ip: deviceIp,
      source: 'DIRECT_TCP'
    });
  }

  return records;
}

module.exports = {
  SpeedFaceClient,
  decodeZKTime,
  encodeZKTime,
  OPERATION_CODES,
  decodeOpCode,
  parseDeviceAuditLogBuffer
};
