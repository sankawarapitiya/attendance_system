const { SpeedFaceClient } = require('./zktProtocol');

/**
 * Fetches accurate atomic time from online internet time authorities.
 * Falls back through timeapi.io -> worldtimeapi.org -> Google/Cloudflare atomic HTTP date.
 */
async function getOnlineTime(timeZone = 'Asia/Colombo') {
  // 1. TimeAPI.io (Highly detailed, timezone aware)
  try {
    const res = await fetch(`https://timeapi.io/api/time/current/zone?timeZone=${encodeURIComponent(timeZone)}`, {
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.dateTime) {
        const d = new Date(data.dateTime);
        const formatted = data.dateTime.replace('T', ' ').slice(0, 19);
        return {
          success: true,
          source: 'TimeAPI.io (Atomic Clock Reference)',
          timeZone,
          formatted,
          iso: d.toISOString(),
          epochMs: d.getTime(),
          date: d
        };
      }
    }
  } catch (err) {}

  // 2. WorldTimeAPI.org
  try {
    const res = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(timeZone)}`, {
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.datetime) {
        const d = new Date(data.datetime);
        const formatted = d.toLocaleString('sv-SE', { timeZone }).replace('T', ' ');
        return {
          success: true,
          source: 'WorldTimeAPI (NTP Stratum-1)',
          timeZone,
          formatted,
          iso: d.toISOString(),
          epochMs: d.getTime(),
          date: d
        };
      }
    }
  } catch (err) {}

  // 3. HTTP Atomic Date Header from Google / Cloudflare
  for (const url of ['https://www.google.com', 'https://cloudflare.com']) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2500) });
      const headerDate = res.headers.get('date');
      if (headerDate) {
        const d = new Date(headerDate);
        if (!isNaN(d.getTime())) {
          const formatted = d.toLocaleString('sv-SE', { timeZone }).replace('T', ' ');
          return {
            success: true,
            source: `${new URL(url).hostname} (Atomic HTTP)`,
            timeZone,
            formatted,
            iso: d.toISOString(),
            epochMs: d.getTime(),
            date: d
          };
        }
      }
    } catch (err) {}
  }

  return {
    success: false,
    error: 'Internet time servers unreachable. Host or device is currently offline.',
    isOffline: true
  };
}

/**
 * Fetches authoritative cloud server time from Firebase / Google Cloud infrastructure.
 */
async function getCloudTime(timeZone = 'Asia/Colombo') {
  for (const url of ['https://firestore.googleapis.com', 'https://www.googleapis.com', 'https://www.google.com']) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2500) });
      const headerDate = res.headers.get('date');
      if (headerDate) {
        const d = new Date(headerDate);
        if (!isNaN(d.getTime())) {
          const formatted = d.toLocaleString('sv-SE', { timeZone }).replace('T', ' ');
          return {
            success: true,
            source: 'Firebase / Google Cloud RTC',
            timeZone,
            formatted,
            iso: d.toISOString(),
            epochMs: d.getTime(),
            date: d
          };
        }
      }
    } catch (err) {}
  }

  // Fallback to getOnlineTime
  return await getOnlineTime(timeZone);
}

/**
 * Checks current time across Terminal, Server System, Cloud Server, and Online Atomic Time.
 */
async function getDeviceTimeStatus({ ip = '192.168.10.15', port = 4370, localAddress = null, timeZone = 'Asia/Colombo' } = {}) {
  const serverDate = new Date();
  const serverFormatted = serverDate.toLocaleString('sv-SE', { timeZone }).replace('T', ' ');

  // Fetch online time, cloud time, and device time in parallel
  const [onlineResult, cloudResult, deviceResult] = await Promise.allSettled([
    getOnlineTime(timeZone),
    getCloudTime(timeZone),
    (async () => {
      const client = new SpeedFaceClient(ip, port, 4000, localAddress);
      return await client.getTime();
    })()
  ]);

  const online = onlineResult.status === 'fulfilled' ? onlineResult.value : { success: false, error: 'Failed to fetch online time' };
  const cloud = cloudResult.status === 'fulfilled' ? cloudResult.value : { success: false, error: 'Failed to fetch cloud time' };
  const device = deviceResult.status === 'fulfilled' ? deviceResult.value : { success: false, error: deviceResult.reason?.message || 'Device unreachable' };

  let driftSeconds = null;
  let driftStatus = 'UNKNOWN';

  // Compare device against authoritative online/cloud time, or server time
  const compareTarget = (cloud.success && cloud.formatted) ? cloud.formatted : ((online.success && online.formatted) ? online.formatted : serverFormatted);
  if (device.success && device.deviceTime && compareTarget) {
    const devEpoch = new Date(device.deviceTime.replace(' ', 'T')).getTime();
    const targetEpoch = new Date(compareTarget.replace(' ', 'T')).getTime();
    if (!isNaN(devEpoch) && !isNaN(targetEpoch)) {
      driftSeconds = Math.round((devEpoch - targetEpoch) / 1000);
      if (Math.abs(driftSeconds) <= 2) {
        driftStatus = 'IN_SYNC';
      } else if (driftSeconds > 2) {
        driftStatus = 'AHEAD';
      } else {
        driftStatus = 'BEHIND';
      }
    }
  }

  return {
    success: true,
    timeZone,
    serverTime: {
      formatted: serverFormatted,
      iso: serverDate.toISOString(),
      epochMs: serverDate.getTime()
    },
    pcTime: {
      formatted: serverFormatted,
      iso: serverDate.toISOString(),
      epochMs: serverDate.getTime()
    },
    cloudTime: cloud.success ? cloud : null,
    onlineTime: online.success ? online : null,
    isOnline: Boolean(online.success || cloud.success),
    deviceTime: device.success ? device.deviceTime : null,
    isDeviceOnline: Boolean(device.success),
    deviceError: device.success ? null : device.error,
    driftSeconds,
    driftStatus
  };
}

/**
 * Synchronizes the SpeedFace terminal time.
 * @param {Object} opts
 * @param {'server'|'cloud'|'manual'|'online'|'pc'} opts.mode - Sync method
 * @param {string} [opts.customTime] - Required for 'manual' mode (YYYY-MM-DD HH:mm:ss or ISO)
 * @param {string} [opts.ip]
 * @param {number} [opts.port]
 * @param {string} [opts.localAddress]
 * @param {string} [opts.timeZone]
 */
async function syncDeviceTime({ mode = 'server', customTime = null, ip = '192.168.10.15', port = 4370, localAddress = null, timeZone = 'Asia/Colombo' } = {}) {
  let targetDate = null;
  let sourceDescription = '';

  if (mode === 'cloud') {
    const cloud = await getCloudTime(timeZone);
    if (!cloud.success) {
      throw new Error(`Cannot update from cloud time: ${cloud.error || 'Cloud time servers unreachable'}`);
    }
    const [dPart, tPart] = cloud.formatted.split(' ');
    const [yyyy, mm, dd] = dPart.split('-').map(Number);
    const [hh, min, ss] = tPart.split(':').map(Number);
    targetDate = new Date(yyyy, mm - 1, dd, hh, min, ss);
    sourceDescription = `Cloud Atomic Time (${cloud.source} - ${timeZone})`;
  } else if (mode === 'online') {
    const online = await getOnlineTime(timeZone);
    if (!online.success) {
      throw new Error(`Cannot update from online time: ${online.error || 'Internet time servers unreachable'}`);
    }
    const [dPart, tPart] = online.formatted.split(' ');
    const [yyyy, mm, dd] = dPart.split('-').map(Number);
    const [hh, min, ss] = tPart.split(':').map(Number);
    targetDate = new Date(yyyy, mm - 1, dd, hh, min, ss);
    sourceDescription = `Online Atomic Time (${online.source} - ${timeZone})`;
  } else if (mode === 'manual') {
    if (!customTime) {
      throw new Error('Please select or specify a valid date and time for manual update.');
    }
    const cleaned = String(customTime).replace('T', ' ');
    const parts = cleaned.split(' ');
    if (parts.length < 2) {
      throw new Error('Invalid manual date format. Required: YYYY-MM-DD HH:mm:ss');
    }
    const [dPart, tPart] = parts;
    const [yyyy, mm, dd] = dPart.split('-').map(Number);
    const timePieces = tPart.split(':').map(Number);
    const hh = timePieces[0] || 0;
    const min = timePieces[1] || 0;
    const ss = timePieces[2] || 0;

    targetDate = new Date(yyyy, mm - 1, dd, hh, min, ss);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid manual date/time values provided.');
    }
    sourceDescription = `Manual Adjustment (${targetDate.toLocaleString('sv-SE').replace('T', ' ')})`;
  } else {
    // Mode: 'server' or 'pc'
    targetDate = new Date();
    sourceDescription = 'Attendance Server System Clock';
  }

  const client = new SpeedFaceClient(ip, port, 6000, localAddress);
  const result = await client.syncTime(targetDate);

  return {
    success: true,
    mode,
    source: sourceDescription,
    appliedTime: targetDate.toLocaleString('sv-SE').replace('T', ' '),
    confirmedDeviceTime: result.formattedTime || result.syncedTime,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getOnlineTime,
  getCloudTime,
  getDeviceTimeStatus,
  syncDeviceTime
};
