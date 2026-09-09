const { SpeedFaceClient } = require('./zktProtocol');
const { insertAttendanceBatch, upsertEmployees, dbRun, dbGet } = require('./db');
const { broadcastLivePunch, getConnectedAdmsDevices } = require('./admsServer');

let isSyncing = false;
let isHealthChecking = false;
let syncTimer = null;
let healthCheckTimer = null;
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
async function syncFromDevice(deviceIp = '192.168.10.15', devicePort = 4370, localAddress = null) {
  if (isSyncing) {
    return { success: false, message: 'A synchronization is already in progress' };
  }

  isSyncing = true;
  lastSyncStatus.status = 'SYNCING';
  notifyWs('SYNC_STATUS', { status: 'SYNCING', message: 'Connecting to device...' });

  if (!localAddress) {
    try {
      const netSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);
      if (netSetting && netSetting.value) localAddress = netSetting.value;
    } catch (e) {}
  }

  const client = new SpeedFaceClient(deviceIp, devicePort, 10000, localAddress);
  const startTime = Date.now();

  try {
    // 1. Test connection and get device info
    console.log(`[SYNC] Connecting to SpeedFace at ${deviceIp}:${devicePort}...`);
    const connInfo = await client.testConnection();
    
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

    // 3. Fetch Attendance Records (SpeedFace 49-byte format)
    notifyWs('SYNC_STATUS', { status: 'SYNCING', message: 'Reading attendance logs from terminal...' });
    const records = await client.getAttendances();
    console.log(`[SYNC] Pulled ${records.length} records from ${deviceIp}. Inserting into database...`);

    const insertResult = await insertAttendanceBatch(records);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    lastSyncStatus.lastSyncTime = new Date().toISOString();
    lastSyncStatus.status = 'SUCCESS';
    lastSyncStatus.totalSynced = insertResult.inserted;
    lastSyncStatus.error = null;

    console.log(`[SYNC] Done! Total logs on device: ${records.length}. New records inserted: ${insertResult.inserted}. Took ${duration}s.`);

    // Log to DB
    await dbRun(
      `INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message) VALUES (?, ?, ?, ?, ?)`,
      ['DIRECT_SYNC', 'SUCCESS', insertResult.inserted, records.length, `Completed in ${duration}s`]
    );

    // If new records were found, broadcast each one to the live punch feed!
    if (insertResult.inserted > 0) {
      const newRecs = records.slice(-insertResult.inserted);
      for (const nr of newRecs) {
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

    isSyncing = false;
    return {
      success: true,
      newRecords: insertResult.inserted,
      totalDeviceLogs: records.length,
      userCounts: connInfo.userCounts,
      durationSeconds: duration
    };
  } catch (err) {
    isSyncing = false;
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
    return { ip, port, localAddress, enabled };
  }

  // 1. Run initial health check immediately
  resolveTarget().then(({ ip, port, localAddress }) => {
    checkDeviceHealth(ip, port, localAddress);
  });

  // 2. Health check / fast watcher every 5 seconds
  healthCheckTimer = setInterval(async () => {
    try {
      const { ip, port, localAddress } = await resolveTarget();
      await checkDeviceHealth(ip, port, localAddress);
    } catch (err) {}
  }, 5000);

  // 3. Periodic full sync
  syncTimer = setInterval(async () => {
    try {
      const { ip, port, localAddress, enabled } = await resolveTarget();
      if (!enabled) return;
      await syncFromDevice(ip, port, localAddress);
    } catch (err) {
      console.warn('[SYNC] Scheduled sync cycle error:', err.message);
    }
  }, ms);
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
}

function getSyncStatus() {
  return {
    isSyncing,
    ...lastSyncStatus
  };
}

module.exports = {
  syncFromDevice,
  checkDeviceHealth,
  startAutoSync,
  stopAutoSync,
  getSyncStatus,
  setSyncWsBroadcast
};
