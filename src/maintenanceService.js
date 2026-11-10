const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const logger = require('./logger');
const config = require('./config');
const {
  dbGet,
  dbRun,
  saveColdStorageArchive,
  getColdStorageArchives,
  getColdStorageArchiveById,
  deleteColdStorageArchive,
  getPrunableAttendanceCount,
  getPrunableAttendanceRecords,
  deleteAttendanceRecordsByIds,
  getMaintenanceDbStats
} = require('./db');

const ARCHIVES_DIR = path.join(__dirname, '..', 'data', 'archives');

// Ensure archives directory exists
if (!fs.existsSync(ARCHIVES_DIR)) {
  fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
}

let autoPruneTimer = null;
let wsBroadcastFn = null;

function setMaintenanceWsBroadcast(fn) {
  wsBroadcastFn = fn;
}

function broadcastMaintenance(data) {
  if (typeof wsBroadcastFn === 'function') {
    try {
      wsBroadcastFn({ type: 'MAINTENANCE_UPDATE', ...data });
    } catch (e) {}
  }
}

/**
 * Get current database storage metrics, retention configuration, and prunable record counts
 */
async function getMaintenanceStatus(orgId = 'ALL') {
  try {
    const dbStats = await getMaintenanceDbStats(orgId);

    // Read configured settings
    const retentionRow = await dbGet(`SELECT value FROM settings WHERE key = 'maintenance_retention_days'`);
    const autoPruneRow = await dbGet(`SELECT value FROM settings WHERE key = 'maintenance_auto_prune_enabled'`);
    const requireSyncRow = await dbGet(`SELECT value FROM settings WHERE key = 'maintenance_require_synced'`);
    const formatRow = await dbGet(`SELECT value FROM settings WHERE key = 'maintenance_archive_format'`);

    const retentionDays = parseInt(retentionRow?.value || '90', 10);
    const autoPruneEnabled = autoPruneRow?.value === 'true';
    const requireSynced = requireSyncRow?.value !== 'false'; // default true
    const archiveFormat = formatRow?.value || 'JSON';

    const cutoffDate = new Date(Date.now() - retentionDays * 86400000).toISOString().replace('T', ' ').substring(0, 19);
    const prunableCount = await getPrunableAttendanceCount(cutoffDate, orgId, requireSynced);

    // Get active SQLite file size
    let dbFileSizeBytes = 0;
    let walFileSizeBytes = 0;
    try {
      if (fs.existsSync(config.dbPath)) {
        dbFileSizeBytes = fs.statSync(config.dbPath).size;
      }
      const walPath = config.dbPath + '-wal';
      if (fs.existsSync(walPath)) {
        walFileSizeBytes = fs.statSync(walPath).size;
      }
    } catch (e) {}

    const totalDbBytes = dbFileSizeBytes + walFileSizeBytes;

    return {
      success: true,
      orgId,
      retentionDays,
      cutoffDate,
      autoPruneEnabled,
      requireSynced,
      archiveFormat,
      totalAttendanceRecords: dbStats.totalRecords,
      prunableRecords: prunableCount,
      oldestRecordDate: dbStats.oldestPunch,
      newestRecordDate: dbStats.newestPunch,
      totalArchivesCount: dbStats.totalArchives,
      totalArchivedRecords: dbStats.totalArchivedRecords,
      totalArchiveBytes: dbStats.totalArchiveBytes,
      databaseSize: {
        bytes: totalDbBytes,
        formatted: (totalDbBytes / (1024 * 1024)).toFixed(2) + ' MB',
        dbFileMb: (dbFileSizeBytes / (1024 * 1024)).toFixed(2) + ' MB',
        walFileMb: (walFileSizeBytes / (1024 * 1024)).toFixed(2) + ' MB'
      }
    };
  } catch (err) {
    logger.error('MAINTENANCE', 'Error getting maintenance status:', err.message);
    throw err;
  }
}

/**
 * Save maintenance retention and automation settings
 */
async function saveMaintenanceSettings({
  retentionDays,
  autoPruneEnabled,
  requireSynced,
  archiveFormat
}) {
  if (retentionDays !== undefined) {
    const days = Math.max(7, Math.min(1095, parseInt(retentionDays, 10) || 90));
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_retention_days', ?)`, [String(days)]);
  }
  if (autoPruneEnabled !== undefined) {
    const val = autoPruneEnabled === true || autoPruneEnabled === 'true' ? 'true' : 'false';
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_auto_prune_enabled', ?)`, [val]);
  }
  if (requireSynced !== undefined) {
    const val = requireSynced === true || requireSynced === 'true' ? 'true' : 'false';
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_require_synced', ?)`, [val]);
  }
  if (archiveFormat !== undefined) {
    const fmt = archiveFormat === 'CSV' ? 'CSV' : 'JSON';
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_archive_format', ?)`, [fmt]);
  }

  // Refresh automated scheduler state
  initAutoPruneScheduler();

  return getMaintenanceStatus();
}

/**
 * Performs Cold Storage Export & Database Pruning
 */
async function executeColdStorageExportAndPrune({
  orgId = 'ALL',
  retentionDays = null,
  requireSynced = null,
  format = 'JSON',
  createdBy = 'SYSTEM',
  isAuto = false
}) {
  const startTime = Date.now();
  logger.info('MAINTENANCE', `Initiating Cold Storage Export & Prune (Org: ${orgId}, Auto: ${isAuto}, By: ${createdBy})...`);

  // Resolve retention days
  let effRetentionDays = retentionDays;
  if (!effRetentionDays) {
    const row = await dbGet(`SELECT value FROM settings WHERE key = 'maintenance_retention_days'`);
    effRetentionDays = parseInt(row?.value || '90', 10);
  }

  // Resolve require synced
  let effRequireSynced = requireSynced;
  if (effRequireSynced === null || effRequireSynced === undefined) {
    const row = await dbGet(`SELECT value FROM settings WHERE key = 'maintenance_require_synced'`);
    effRequireSynced = row?.value !== 'false';
  }

  const cutoffDate = new Date(Date.now() - effRetentionDays * 86400000).toISOString().replace('T', ' ').substring(0, 19);

  // 1. Fetch eligible records
  const records = await getPrunableAttendanceRecords(cutoffDate, orgId, effRequireSynced, 250000);
  if (!records || records.length === 0) {
    logger.info('MAINTENANCE', `No records found older than ${cutoffDate} matching pruning criteria.`);
    return {
      success: true,
      prunedCount: 0,
      recordCount: 0,
      message: `No records older than retention cutoff (${effRetentionDays} days / ${cutoffDate}) found eligible for archiving.`
    };
  }

  const recordCount = records.length;
  const startDate = records[0].punch_time;
  const endDate = records[recordCount - 1].punch_time;
  const cleanOrgTag = (orgId && orgId !== 'ALL' ? orgId : 'MULTI_TENANT').replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveId = `ARCH_${cleanOrgTag}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  let filename = '';
  let filePath = '';
  let fileSizeBytes = 0;
  let sha256Hash = '';

  // 2. Generate archive payload
  if (format === 'CSV') {
    filename = `attendance_archive_${cleanOrgTag}_${timestampStr}.csv`;
    filePath = path.join(ARCHIVES_DIR, filename);

    const headers = [
      'id', 'user_id', 'user_sn', 'emp_code', 'first_name', 'last_name',
      'department', 'designation', 'punch_time', 'verify_mode', 'verify_name',
      'punch_state', 'punch_state_name', 'work_code', 'device_ip', 'device_sn',
      'org_id', 'synced_to_cloud', 'cloud_synced_at'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    };

    const csvLines = [headers.join(',')];
    for (const r of records) {
      csvLines.push([
        r.id, r.user_id, r.user_sn, r.emp_code || '', r.first_name || '', r.last_name || '',
        r.department || '', r.designation || '', r.punch_time, r.verify_mode, r.verify_name,
        r.punch_state, r.punch_state_name, r.work_code, r.device_ip, r.device_sn,
        r.org_id, r.synced_to_cloud, r.cloud_synced_at
      ].map(escapeCsv).join(','));
    }

    const csvContent = csvLines.join('\n');
    fs.writeFileSync(filePath, csvContent, 'utf8');
    fileSizeBytes = fs.statSync(filePath).size;
    sha256Hash = crypto.createHash('sha256').update(csvContent).digest('hex');
  } else {
    // Default: JSON Archive format
    filename = `attendance_archive_${cleanOrgTag}_${timestampStr}.json`;
    filePath = path.join(ARCHIVES_DIR, filename);

    const archiveManifest = {
      archiveId,
      orgId,
      recordCount,
      startDate,
      endDate,
      retentionDays: effRetentionDays,
      cutoffDate,
      exportedAt: new Date().toISOString(),
      exportedBy: createdBy,
      systemMode: isAuto ? 'AUTOMATED_SCHEDULE' : 'MANUAL_EXPORT',
      softwareVersion: 'SpeedFace Attendance v4.0.0'
    };

    const jsonContent = JSON.stringify({
      manifest: archiveManifest,
      records
    }, null, 2);

    fs.writeFileSync(filePath, jsonContent, 'utf8');
    fileSizeBytes = fs.statSync(filePath).size;
    sha256Hash = crypto.createHash('sha256').update(jsonContent).digest('hex');
  }

  // 3. Register archive batch in database
  const savedArchive = await saveColdStorageArchive({
    archive_id: archiveId,
    org_id: orgId,
    filename,
    file_path: filePath,
    format,
    record_count: recordCount,
    start_date: startDate,
    end_date: endDate,
    file_size_bytes: fileSizeBytes,
    sha256_hash: sha256Hash,
    retention_days: effRetentionDays,
    status: 'COMPLETED',
    pruned: 1,
    created_by: createdBy
  });

  // 4. Safely prune attendance records from active SQLite database
  const recordIds = records.map(r => r.id);
  const deletedCount = await deleteAttendanceRecordsByIds(recordIds);

  // 5. Purge old sync logs older than cutoff date
  try {
    await dbRun(`DELETE FROM sync_logs WHERE created_at <= ?`, [cutoffDate]);
  } catch (e) {}

  // 6. Compact SQLite database via incremental vacuum or vacuum
  try {
    await dbRun(`PRAGMA optimize`);
    await dbRun(`VACUUM`);
  } catch (vErr) {
    logger.warn('MAINTENANCE', 'Vacuum notice:', vErr.message);
  }

  const durationMs = Date.now() - startTime;
  logger.info('MAINTENANCE', `Cold Storage Export & Pruning Complete: ${deletedCount} records pruned, archive saved as "${filename}" (${(fileSizeBytes / 1024).toFixed(1)} KB) in ${durationMs}ms.`);

  const result = {
    success: true,
    archiveId,
    filename,
    filePath,
    recordCount,
    prunedCount: deletedCount,
    startDate,
    endDate,
    fileSizeBytes,
    fileSizeFormatted: (fileSizeBytes / 1024).toFixed(1) + ' KB',
    sha256Hash,
    durationMs,
    message: `Successfully archived and pruned ${deletedCount} attendance records into cold storage file "${filename}".`
  };

  // Broadcast WebSocket notification to connected UI clients
  broadcastMaintenance({
    event: 'PRUNE_COMPLETED',
    archiveId,
    recordCount,
    prunedCount: deletedCount,
    orgId,
    filename
  });

  return result;
}

/**
 * Get list of all cold storage archives
 */
async function getArchiveList(orgId = 'ALL') {
  const archives = await getColdStorageArchives(orgId);
  return archives.map(a => ({
    ...a,
    fileSizeFormatted: (a.file_size_bytes / 1024).toFixed(1) + ' KB',
    existsOnDisk: fs.existsSync(a.file_path)
  }));
}

/**
 * Get archive file path for download
 */
async function getArchiveDownloadInfo(archiveId) {
  const archive = await getColdStorageArchiveById(archiveId);
  if (!archive) {
    throw new Error('Archive not found with ID: ' + archiveId);
  }
  if (!fs.existsSync(archive.file_path)) {
    throw new Error('Archive file does not exist on disk: ' + archive.filename);
  }
  return {
    filePath: archive.file_path,
    filename: archive.filename,
    format: archive.format || 'JSON',
    recordCount: archive.record_count,
    fileSizeBytes: archive.file_size_bytes
  };
}

/**
 * Delete archive file and database registry entry
 */
async function deleteArchive(archiveId) {
  const archive = await getColdStorageArchiveById(archiveId);
  if (!archive) return false;

  // Delete file from filesystem
  try {
    if (fs.existsSync(archive.file_path)) {
      fs.unlinkSync(archive.file_path);
    }
  } catch (e) {
    logger.warn('MAINTENANCE', `Notice removing file ${archive.file_path}:`, e.message);
  }

  // Delete DB record
  await deleteColdStorageArchive(archiveId);
  return true;
}

/**
 * Initialize background scheduled auto-pruning timer (checks daily)
 */
function initAutoPruneScheduler() {
  if (autoPruneTimer) {
    clearInterval(autoPruneTimer);
    autoPruneTimer = null;
  }

  // Daily interval check (every 24 hours)
  const INTERVAL_24H = 24 * 60 * 60 * 1000;
  autoPruneTimer = setInterval(async () => {
    try {
      const setting = await dbGet(`SELECT value FROM settings WHERE key = 'maintenance_auto_prune_enabled'`);
      if (setting && setting.value === 'true') {
        logger.info('MAINTENANCE', 'Running daily automated cold storage export and pruning cycle...');
        await executeColdStorageExportAndPrune({
          orgId: 'ALL',
          isAuto: true,
          createdBy: 'SCHEDULED_TASK'
        });
      }
    } catch (err) {
      logger.error('MAINTENANCE', 'Automated scheduled pruning error:', err.message);
    }
  }, INTERVAL_24H);

  logger.info('MAINTENANCE', 'Automated SQLite Pruning & Cold Storage scheduler initialized.');
}

module.exports = {
  setMaintenanceWsBroadcast,
  getMaintenanceStatus,
  saveMaintenanceSettings,
  executeColdStorageExportAndPrune,
  getArchiveList,
  getArchiveDownloadInfo,
  deleteArchive,
  initAutoPruneScheduler
};
