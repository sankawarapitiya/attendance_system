const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('./config');

const DB_PATH = config.dbPath;

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

// Promisify database methods for cleaner async/await
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

// Initialize schema
async function initDatabase() {
  // Production Performance & Concurrency Pragmas
  try {
    await dbRun(`PRAGMA journal_mode = WAL;`);
    await dbRun(`PRAGMA synchronous = NORMAL;`);
    await dbRun(`PRAGMA busy_timeout = 10000;`);
    await dbRun(`PRAGMA cache_size = -64000;`);
    await dbRun(`PRAGMA foreign_keys = ON;`);
  } catch (pErr) {
    console.warn('[DB] Pragma initialization note:', pErr.message);
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_sn INTEGER,
      user_id TEXT NOT NULL,
      punch_time DATETIME NOT NULL,
      verify_mode INTEGER DEFAULT 15,
      verify_name TEXT,
      punch_state INTEGER DEFAULT 0,
      punch_state_name TEXT,
      work_code INTEGER DEFAULT 0,
      temperature REAL DEFAULT NULL,
      mask_status INTEGER DEFAULT NULL,
      device_ip TEXT DEFAULT '192.168.10.15',
      device_sn TEXT DEFAULT '',
      source TEXT DEFAULT 'DIRECT_SYNC',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, punch_time) ON CONFLICT IGNORE
    )
  `);

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_att_user_id ON attendance_records(user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_att_punch_time ON attendance_records(punch_time)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_att_device ON attendance_records(device_ip)`);

  // Cloud Sync Columns Migration for attendance_records
  try {
    await dbRun(`ALTER TABLE attendance_records ADD COLUMN synced_to_cloud INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE attendance_records ADD COLUMN cloud_synced_at DATETIME DEFAULT NULL`);
  } catch (e) {}
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_att_synced_cloud ON attendance_records(synced_to_cloud)`);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS employees (
      user_id TEXT PRIMARY KEY,
      name TEXT,
      department TEXT DEFAULT 'General',
      role TEXT DEFAULT 'Staff',
      card_no TEXT,
      email TEXT,
      phone TEXT,
      photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await dbRun(`ALTER TABLE employees ADD COLUMN photo TEXT`);
  } catch (e) {
    // column already exists
  }

  try {
    await dbRun(`ALTER TABLE employees ADD COLUMN shift_id INTEGER DEFAULT 1`);
  } catch (e) {
    // column already exists
  }

  const extraCols = [
    'employee_service_id TEXT',
    'nic TEXT',
    'title TEXT',
    'first_name TEXT',
    'last_name TEXT',
    'gender TEXT',
    'birthday TEXT',
    'appointment_date TEXT',
    'employment_status TEXT',
    'order_by_id TEXT',
    'is_active INTEGER DEFAULT 1',
    'synced_to_cloud INTEGER DEFAULT 0',
    'cloud_synced_at DATETIME DEFAULT NULL'
  ];
  for (const col of extraCols) {
    try {
      await dbRun(`ALTER TABLE employees ADD COLUMN ${col}`);
    } catch (e) {
      // already exists
    }
  }

  // Ensure is_active is 1 for all existing records
  await dbRun(`UPDATE employees SET is_active = 1 WHERE is_active IS NULL`);

  // Working Shifts Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS working_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      grace_period_mins INTEGER DEFAULT 15,
      monthly_grace_days INTEGER DEFAULT 2,
      late_cover_end INTEGER DEFAULT 1,
      half_day_hours REAL DEFAULT 3.5,
      late_half_day_hours REAL DEFAULT 4.0,
      full_day_hours REAL DEFAULT 7.75,
      work_days TEXT DEFAULT '1,2,3,4,5',
      color TEXT DEFAULT '#2563eb',
      is_default INTEGER DEFAULT 0,
      monthly_short_leaves INTEGER DEFAULT 2,
      morning_short_leave_start TEXT DEFAULT '09:00',
      morning_short_leave_end TEXT DEFAULT '10:00',
      evening_short_leave_start TEXT DEFAULT '14:45',
      evening_short_leave_end TEXT DEFAULT '16:15',
      disallow_grace_and_short_leave_same_day INTEGER DEFAULT 1,
      ot_min_mins INTEGER DEFAULT 60,
      ot_step_mins INTEGER DEFAULT 15,
      enable_morning_grace INTEGER DEFAULT 1,
      enable_short_leave INTEGER DEFAULT 1,
      enable_half_day_calc INTEGER DEFAULT 1,
      enable_overtime INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN monthly_grace_days INTEGER DEFAULT 2`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN late_cover_end INTEGER DEFAULT 1`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN late_half_day_hours REAL DEFAULT 4.0`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN monthly_short_leaves INTEGER DEFAULT 2`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN morning_short_leave_start TEXT DEFAULT '09:00'`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN morning_short_leave_end TEXT DEFAULT '10:00'`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN evening_short_leave_start TEXT DEFAULT '14:45'`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN evening_short_leave_end TEXT DEFAULT '16:15'`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN disallow_grace_and_short_leave_same_day INTEGER DEFAULT 1`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN ot_min_mins INTEGER DEFAULT 60`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN ot_step_mins INTEGER DEFAULT 15`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN enable_morning_grace INTEGER DEFAULT 1`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN enable_short_leave INTEGER DEFAULT 1`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN enable_half_day_calc INTEGER DEFAULT 1`);
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN enable_overtime INTEGER DEFAULT 1`);
  } catch (e) {}

  // Holidays Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      holiday_date DATE NOT NULL,
      holiday_type TEXT DEFAULT 'Public Holiday',
      bank_holiday INTEGER DEFAULT 0,
      public_holiday INTEGER DEFAULT 1,
      mercantile_holiday INTEGER DEFAULT 0,
      is_recurring INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(holiday_date, name) ON CONFLICT IGNORE
    )
  `);

  try {
    await dbRun(`ALTER TABLE holidays ADD COLUMN bank_holiday INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE holidays ADD COLUMN public_holiday INTEGER DEFAULT 1`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE holidays ADD COLUMN mercantile_holiday INTEGER DEFAULT 0`);
  } catch (e) {}

  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT,
      status TEXT,
      records_synced INTEGER,
      total_records INTEGER,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default shifts if empty
  const shiftCount = await dbGet(`SELECT COUNT(*) as count FROM working_shifts`);
  if (!shiftCount || shiftCount.count === 0) {
    await dbRun(`
      INSERT INTO working_shifts (id, name, start_time, end_time, grace_period_mins, half_day_hours, three_fourths_hours, full_day_hours, work_days, color, is_default)
      VALUES 
        (1, 'General Shift', '09:00', '18:00', 15, 4.0, 6.0, 8.0, '1,2,3,4,5', '#2563eb', 1),
        (2, 'Morning Shift', '07:00', '15:30', 10, 4.0, 6.0, 8.0, '1,2,3,4,5,6', '#059669', 0),
        (3, 'Night Shift', '20:00', '05:00', 15, 4.0, 6.0, 8.0, '1,2,3,4,5', '#7c3aed', 0)
    `);
    console.log('Seeded default working shifts.');
  }

  // Seed initial sample holidays if empty
  const holidayCount = await dbGet(`SELECT COUNT(*) as count FROM holidays`);
  if (!holidayCount || holidayCount.count === 0) {
    const yr = new Date().getFullYear();
    await dbRun(`
      INSERT OR IGNORE INTO holidays (name, holiday_date, holiday_type, is_recurring)
      VALUES 
        ('New Year Day', '${yr}-01-01', 'Public Holiday', 1),
        ('Labor Day', '${yr}-05-01', 'Public Holiday', 1),
        ('Independence Day', '${yr}-08-15', 'Public Holiday', 1),
        ('Christmas Day', '${yr}-12-25', 'Public Holiday', 1)
    `);
    console.log('Seeded default holidays.');
  }

  // Default device settings
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('device_ip', '192.168.10.15')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('device_port', '4370')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_sync_interval', '60')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_sync_enabled', 'true')`);

  let defaultIface = 'Ethernet';
  let defaultIfaceIp = '192.168.10.55';
  try {
    const os = require('os');
    const ifaces = os.networkInterfaces();
    for (const [name, nets] of Object.entries(ifaces)) {
      const match = (nets || []).find(n => n.family === 'IPv4' && !n.internal && n.address.startsWith('192.168.10.'));
      if (match) {
        defaultIface = name;
        defaultIfaceIp = match.address;
        break;
      }
    }
  } catch (e) {}

  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('network_interface', ?)`, [defaultIface]);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('network_interface_ip', ?)`, [defaultIfaceIp]);

  // Default organization & company profile settings
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('org_name', 'National Institute of Fisheries and Nautical Engineering')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('org_subtitle', 'Head Office - Human Resources & Attendance Division')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('org_address', 'Crow Island, Mattakkuliya, Colombo 15, Sri Lanka')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('org_phone', '+94 11 252 0451 / 071 813 4698')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('org_email', 'info@nifne.ac.lk')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('org_website', 'www.nifne.ac.lk')`);
  await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('org_footer', 'SpeedFace-V5L Automated Biometric Attendance & Payroll System')`);

  console.log('Database tables & indexes initialized successfully.');
}

// Verification mode helper
function getVerifyModeName(code) {
  const map = {
    0: 'Password 🔑',
    1: 'Fingerprint 👆',
    2: 'Card 💳',
    3: 'Password 🔑',
    4: 'Palm ✋',
    15: 'Face Recognition 👤',
    49: 'Face Recognition 👤',
    51: 'Face Recognition 👤'
  };
  return map[code] || `Mode ${code}`;
}

// Punch state helper
function getPunchStateName(code) {
  const map = {
    0: 'Check-In',
    1: 'Check-Out',
    2: 'Break-Out',
    3: 'Break-In',
    4: 'Overtime-In',
    5: 'Overtime-Out'
  };
  return map[code] || `State ${code}`;
}

// Insert batch attendance records with transaction
async function insertAttendanceBatch(records) {
  if (!records || records.length === 0) return { inserted: 0 };

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO attendance_records (
          user_sn, user_id, punch_time, verify_mode, verify_name,
          punch_state, punch_state_name, work_code, temperature,
          mask_status, device_ip, device_sn, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let insertedCount = 0;
      for (const rec of records) {
        const verifyName = rec.verify_name || getVerifyModeName(rec.verify_mode);
        const punchStateName = rec.punch_state_name || getPunchStateName(rec.punch_state);
        
        stmt.run(
          rec.user_sn || 0,
          String(rec.user_id).trim(),
          rec.punch_time,
          rec.verify_mode !== undefined ? rec.verify_mode : 15,
          verifyName,
          rec.punch_state !== undefined ? rec.punch_state : 0,
          punchStateName,
          rec.work_code || 0,
          rec.temperature || null,
          rec.mask_status !== undefined ? rec.mask_status : null,
          rec.device_ip || '192.168.10.15',
          rec.device_sn || '',
          rec.source || 'DIRECT_SYNC',
          function (err) {
            if (!err && this.changes > 0) {
              insertedCount++;
            }
          }
        );
      }

      stmt.finalize((err) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        db.run('COMMIT', (commitErr) => {
          if (commitErr) return reject(commitErr);
          resolve({ inserted: insertedCount });
        });
      });
    });
  });
}

// Upsert users / employees into database
async function upsertEmployees(users) {
  if (!users || users.length === 0) return 0;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT INTO employees (user_id, name, card_no)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          name = CASE WHEN (excluded.name IS NOT NULL AND excluded.name != '') THEN excluded.name ELSE employees.name END,
          card_no = CASE WHEN (excluded.card_no IS NOT NULL AND excluded.card_no != '') THEN excluded.card_no ELSE employees.card_no END,
          updated_at = CURRENT_TIMESTAMP
      `);

      let count = 0;
      for (const u of users) {
        const uid = String(u.userId || u.user_id || u.uid).trim();
        const name = (u.name || '').trim();
        const cardNo = String(u.cardno || u.card_no || '').trim();
        if (uid) {
          stmt.run(uid, name, cardNo);
          count++;
        }
      }

      stmt.finalize((err) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        db.run('COMMIT', (commitErr) => {
          if (commitErr) return reject(commitErr);
          resolve(count);
        });
      });
    });
  });
}

/**
 * Creates a point-in-time snapshot backup of the database to config.backupDir
 */
async function runDatabaseBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFilename = `attendance_backup_${timestamp}.db`;
  const backupFilePath = path.join(config.backupDir, backupFilename);

  try {
    // In modern SQLite, VACUUM INTO creates a live consistent snapshot even with active transactions
    await dbRun(`VACUUM INTO ?`, [backupFilePath]);
    console.log(`[DB] Automated database backup created: ${backupFilename}`);
    pruneOldBackups();
    return { success: true, filename: backupFilename, path: backupFilePath };
  } catch (err) {
    try {
      fs.copyFileSync(config.dbPath, backupFilePath);
      console.log(`[DB] File-copy database backup created: ${backupFilename}`);
      pruneOldBackups();
      return { success: true, filename: backupFilename, path: backupFilePath };
    } catch (copyErr) {
      console.error(`[DB] Failed to create database backup: ${copyErr.message}`);
      return { success: false, error: copyErr.message };
    }
  }
}

function pruneOldBackups() {
  try {
    if (!fs.existsSync(config.backupDir)) return;
    const files = fs.readdirSync(config.backupDir)
      .filter(f => f.startsWith('attendance_backup_') && f.endsWith('.db'))
      .map(f => {
        const fullPath = path.join(config.backupDir, f);
        return {
          name: f,
          path: fullPath,
          size: fs.statSync(fullPath).size,
          time: fs.statSync(fullPath).mtimeMs
        };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > config.maxBackups) {
      const toDelete = files.slice(config.maxBackups);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
          console.log(`[DB] Pruned old backup: ${file.name}`);
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[DB] Backup prune note:', err.message);
  }
}

let backupTimer = null;
function initBackupScheduler() {
  // Initial backup 60 seconds after server starts
  setTimeout(runDatabaseBackup, 60000);

  // Periodic backup based on config.backupIntervalHours
  const intervalMs = Math.max(1, config.backupIntervalHours) * 3600 * 1000;
  backupTimer = setInterval(runDatabaseBackup, intervalMs);
  console.log(`[DB] Automated backup scheduler active: Every ${config.backupIntervalHours}h (retaining up to ${config.maxBackups} copies)`);
}

function closeDatabase() {
  return new Promise((resolve) => {
    if (backupTimer) clearInterval(backupTimer);
    try {
      db.run(`PRAGMA wal_checkpoint(TRUNCATE);`, () => {
        db.close((err) => {
          if (err) console.error('[DB] Error closing database:', err.message);
          else console.log('[DB] Database cleanly closed and WAL checkpointed.');
          resolve();
        });
      });
    } catch (e) {
      db.close(() => resolve());
    }
  });
}

// Fetch attendance records pending cloud sync
async function getUnsyncedAttendance(limit = 500) {
  return dbAll(`
    SELECT a.*, 
           e.name as employee_name, 
           e.department, 
           e.role, 
           e.employee_service_id,
           e.card_no
    FROM attendance_records a
    LEFT JOIN employees e ON a.user_id = e.user_id
    WHERE a.synced_to_cloud = 0 OR a.synced_to_cloud IS NULL
    ORDER BY a.punch_time ASC
    LIMIT ?
  `, [limit]);
}

// Mark attendance records as successfully synced to cloud
async function markAttendanceCloudSynced(recordIds = []) {
  if (!recordIds || recordIds.length === 0) return 0;
  const placeholders = recordIds.map(() => '?').join(',');
  const res = await dbRun(`
    UPDATE attendance_records
    SET synced_to_cloud = 1, cloud_synced_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `, recordIds);
  return res.changes || 0;
}

// Fetch employees pending cloud sync
async function getUnsyncedEmployees(limit = 500) {
  return dbAll(`
    SELECT * FROM employees
    WHERE synced_to_cloud = 0 OR synced_to_cloud IS NULL
    ORDER BY user_id ASC
    LIMIT ?
  `, [limit]);
}

// Mark employees as synced to cloud
async function markEmployeesCloudSynced(userIds = []) {
  if (!userIds || userIds.length === 0) return 0;
  const placeholders = userIds.map(() => '?').join(',');
  const res = await dbRun(`
    UPDATE employees
    SET synced_to_cloud = 1, cloud_synced_at = CURRENT_TIMESTAMP
    WHERE user_id IN (${placeholders})
  `, userIds);
  return res.changes || 0;
}

// Get cloud synchronization metrics
async function getCloudSyncStats() {
  const row = await dbGet(`
    SELECT
      (SELECT COUNT(*) FROM attendance_records) as total_attendance,
      (SELECT COUNT(*) FROM attendance_records WHERE synced_to_cloud = 1) as synced_attendance,
      (SELECT COUNT(*) FROM attendance_records WHERE synced_to_cloud = 0 OR synced_to_cloud IS NULL) as pending_attendance,
      (SELECT MAX(cloud_synced_at) FROM attendance_records) as last_cloud_synced_at,
      (SELECT COUNT(*) FROM employees) as total_employees,
      (SELECT COUNT(*) FROM employees WHERE synced_to_cloud = 1) as synced_employees
  `);
  return row || {
    total_attendance: 0,
    synced_attendance: 0,
    pending_attendance: 0,
    last_cloud_synced_at: null,
    total_employees: 0,
    synced_employees: 0
  };
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDatabase,
  runDatabaseBackup,
  pruneOldBackups,
  initBackupScheduler,
  closeDatabase,
  getVerifyModeName,
  getPunchStateName,
  insertAttendanceBatch,
  upsertEmployees,
  getUnsyncedAttendance,
  markAttendanceCloudSynced,
  getUnsyncedEmployees,
  markEmployeesCloudSynced,
  getCloudSyncStats
};
