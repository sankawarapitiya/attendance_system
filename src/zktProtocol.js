const net = require('net');
const ZKLib = require('node-zklib');
const { COMMANDS, REQUEST_DATA } = require('node-zklib/constants');
const { getVerifyModeName, getPunchStateName } = require('./db');

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
    if (this.localAddress) {
      const bindAddr = this.localAddress;
      zk.zklibTcp.createSocket = function(cbError, cbClose) {
        return new Promise((resolve, reject) => {
          this.socket = new net.Socket();
          this.socket.once('error', (err) => {
            reject(err);
            cbError && cbError(err);
          });
          this.socket.once('connect', () => {
            resolve(this.socket);
          });
          this.socket.once('close', (err) => {
            this.socket = null;
            cbClose && cbClose('tcp');
          });
          if (this.timeout) {
            this.socket.setTimeout(this.timeout);
          }
          this.socket.connect({ port: this.port, host: this.ip, localAddress: bindAddr });
        });
      };
    }
    return zk;
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
      const RECORD_SIZE = 49;
      const totalRecords = Math.floor(buf.length / RECORD_SIZE);

      const records = [];
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

        // Ensure reasonable year (2000 - 2035) and valid alphanumeric userId
        const year = parseInt(punchTime.slice(0, 4), 10);
        if (isNaN(year) || year < 2000 || year > 2035) continue;
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
   * Synchronizes the SpeedFace terminal's clock with the computer's current time.
   */
  async syncTime() {
    const zk = this.createInstance();
    try {
      await zk.createSocket();
      const now = new Date();
      const encoded = encodeZKTime(now);
      const timeBuf = Buffer.alloc(4);
      timeBuf.writeUInt32LE(encoded, 0);

      await zk.zklibTcp.executeCmd(COMMANDS.CMD_SET_TIME, timeBuf);
      await zk.disconnect();
      return { success: true, syncedTime: now.toISOString() };
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
}

module.exports = {
  SpeedFaceClient,
  decodeZKTime,
  encodeZKTime
};
