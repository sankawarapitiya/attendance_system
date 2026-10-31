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
  try {
    await dbRun(`ALTER TABLE attendance_records ADD COLUMN org_id TEXT DEFAULT 'DSOFFICE_LUNUGAMWEHERA'`);
  } catch (e) {}
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_att_synced_cloud ON attendance_records(synced_to_cloud)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_att_org ON attendance_records(org_id)`);

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
      org_id TEXT DEFAULT 'DSOFFICE_LUNUGAMWEHERA',
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
    'org_id TEXT DEFAULT \'DSOFFICE_LUNUGAMWEHERA\'',
    'synced_to_cloud INTEGER DEFAULT 0',
    'cloud_synced_at DATETIME DEFAULT NULL',
    'leave_category_id INTEGER DEFAULT 1'
  ];
  for (const col of extraCols) {
    try {
      await dbRun(`ALTER TABLE employees ADD COLUMN ${col}`);
    } catch (e) {
      // already exists
    }
  }

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_emp_org ON employees(org_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_emp_leave_category ON employees(leave_category_id)`);
  await dbRun(`UPDATE employees SET leave_category_id = 1 WHERE leave_category_id IS NULL OR leave_category_id = 0`);

  // Ensure org_id is not empty for all existing records
  await dbRun(`UPDATE employees SET org_id = 'DSOFFICE_LUNUGAMWEHERA' WHERE org_id IS NULL OR org_id = ''`);
  await dbRun(`UPDATE attendance_records SET org_id = 'DSOFFICE_LUNUGAMWEHERA' WHERE org_id IS NULL OR org_id = ''`);

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

  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN org_id TEXT DEFAULT 'DSOFFICE_LUNUGAMWEHERA'`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN sync_status TEXT DEFAULT 'PENDING'`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN cloud_synced_at DATETIME DEFAULT NULL`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE working_shifts ADD COLUMN updated_at DATETIME DEFAULT NULL`);
  } catch (e) {}
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_shifts_org ON working_shifts(org_id)`);
  await dbRun(`UPDATE working_shifts SET org_id = 'DSOFFICE_LUNUGAMWEHERA' WHERE org_id IS NULL OR org_id = ''`);

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

  try {
    await dbRun(`ALTER TABLE holidays ADD COLUMN org_id TEXT DEFAULT 'DSOFFICE_LUNUGAMWEHERA'`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE holidays ADD COLUMN sync_status TEXT DEFAULT 'PENDING'`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE holidays ADD COLUMN cloud_synced_at DATETIME DEFAULT NULL`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE holidays ADD COLUMN updated_at DATETIME DEFAULT NULL`);
  } catch (e) {}
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_holidays_org ON holidays(org_id)`);
  await dbRun(`UPDATE holidays SET org_id = 'DSOFFICE_LUNUGAMWEHERA' WHERE org_id IS NULL OR org_id = ''`);

  // Leave Categories Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS leave_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#2563eb',
      is_default INTEGER DEFAULT 0,
      org_id TEXT DEFAULT 'DSOFFICE_LUNUGAMWEHERA',
      sync_status TEXT DEFAULT 'PENDING',
      cloud_synced_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, org_id)
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_cat_org ON leave_categories(org_id)`);

  // Leave Types Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      days_allowed REAL NOT NULL DEFAULT 14.0,
      carry_forward_days REAL DEFAULT 0.0,
      is_paid INTEGER DEFAULT 1,
      color TEXT DEFAULT '#10b981',
      description TEXT,
      deduction_priority INTEGER DEFAULT 1,
      enable_auto_deduct INTEGER DEFAULT 1,
      is_duty_leave INTEGER DEFAULT 0,
      is_compensatory_leave INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES leave_categories(id) ON DELETE CASCADE,
      UNIQUE(category_id, name)
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_type_cat ON leave_types(category_id)`);

  // Employee Leave Balances Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS employee_leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      leave_type_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      allocated_days REAL NOT NULL DEFAULT 0.0,
      used_days REAL NOT NULL DEFAULT 0.0,
      remaining_days REAL NOT NULL DEFAULT 0.0,
      org_id TEXT DEFAULT 'DSOFFICE_LUNUGAMWEHERA',
      sync_status TEXT DEFAULT 'PENDING',
      cloud_synced_at DATETIME DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES employees(user_id) ON DELETE CASCADE,
      FOREIGN KEY(leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
      UNIQUE(user_id, leave_type_id, year)
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_emp_leave_bal ON employee_leave_balances(user_id, year)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_emp_leave_bal_org ON employee_leave_balances(org_id)`);

  // Safe migrations for carried_forward_days and notes on employee_leave_balances
  try {
    await dbRun(`ALTER TABLE employee_leave_balances ADD COLUMN carried_forward_days REAL DEFAULT 0.0`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE employee_leave_balances ADD COLUMN notes TEXT DEFAULT ''`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE employee_leave_balances ADD COLUMN carried_fwd_cutoff_date DATE DEFAULT NULL`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE employee_leave_balances ADD COLUMN no_pay_days REAL DEFAULT 0.0`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE employee_leave_balances ADD COLUMN auto_deducted_days REAL DEFAULT 0.0`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE employee_leave_balances ADD COLUMN request_deducted_days REAL DEFAULT 0.0`);
  } catch (e) {}

  // Safe migrations for deduction_priority and enable_auto_deduct on leave_types
  try {
    await dbRun(`ALTER TABLE leave_types ADD COLUMN deduction_priority INTEGER DEFAULT 1`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE leave_types ADD COLUMN enable_auto_deduct INTEGER DEFAULT 1`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE leave_types ADD COLUMN is_duty_leave INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE leave_types ADD COLUMN is_compensatory_leave INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await dbRun(`UPDATE leave_types SET deduction_priority = 1 WHERE UPPER(code) = 'CAS' AND (deduction_priority IS NULL OR deduction_priority = 1)`);
    await dbRun(`UPDATE leave_types SET deduction_priority = 2 WHERE UPPER(code) = 'MED' AND (deduction_priority IS NULL OR deduction_priority = 1)`);
    await dbRun(`UPDATE leave_types SET deduction_priority = 3 WHERE UPPER(code) = 'ANN' AND (deduction_priority IS NULL OR deduction_priority = 1)`);
    await dbRun(`UPDATE leave_types SET is_duty_leave = 1, days_allowed = 0, carry_forward_days = 0, enable_auto_deduct = 0, deduction_priority = 99 WHERE UPPER(code) = 'DUTY' OR LOWER(name) LIKE '%duty leave%'`);
    await dbRun(`UPDATE leave_types SET is_compensatory_leave = 1, days_allowed = 0, carry_forward_days = 0, enable_auto_deduct = 0, deduction_priority = 99 WHERE UPPER(code) = 'COMP' OR LOWER(name) LIKE '%compensatory%'`);
  } catch (e) {}

  // Leave Requests Table (supports request & approval workflow)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      leave_type_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days_requested REAL NOT NULL DEFAULT 1.0,
      day_type TEXT DEFAULT 'FULL_DAY',
      reason TEXT,
      emergency_contact TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      action_by TEXT,
      action_at DATETIME,
      action_remarks TEXT,
      qualifying_date DATE DEFAULT NULL,
      compensatory_source_type TEXT DEFAULT NULL,
      org_id TEXT DEFAULT 'DSOFFICE_LUNUGAMWEHERA',
      sync_status TEXT DEFAULT 'PENDING',
      cloud_synced_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES employees(user_id) ON DELETE CASCADE,
      FOREIGN KEY(leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT
    )
  `);
  // Safe migrations for qualifying_date and compensatory_source_type on leave_requests
  try {
    await dbRun(`ALTER TABLE leave_requests ADD COLUMN qualifying_date DATE DEFAULT NULL`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE leave_requests ADD COLUMN compensatory_source_type TEXT DEFAULT NULL`);
  } catch (e) {}

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_req_user ON leave_requests(user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_req_status ON leave_requests(status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_req_org ON leave_requests(org_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_req_dates ON leave_requests(start_date, end_date)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_req_qualifying ON leave_requests(qualifying_date)`);


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

  // 6. System Users Table for Role-Based Multi-Organization Authentication
  await dbRun(`
    CREATE TABLE IF NOT EXISTS system_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE,
      email TEXT NOT NULL,
      username TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      org_id TEXT NOT NULL,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      firebase_uid TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_sys_user_email ON system_users(email)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_sys_user_username ON system_users(username)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_sys_user_org ON system_users(org_id)`);

  // Safe migrations for system_users cloud sync columns
  try {
    await dbRun(`ALTER TABLE system_users ADD COLUMN synced_to_cloud INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE system_users ADD COLUMN cloud_synced_at DATETIME DEFAULT NULL`);
  } catch (e) {}

  // Seed default organization system users if empty
  const userCount = await dbGet(`SELECT COUNT(*) as count FROM system_users`);
  if (!userCount || userCount.count === 0) {
    const orgRow = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_org_id'`);
    const defaultOrg = orgRow ? orgRow.value : 'DSOFFICE_LUNUGAMWEHERA';
    await dbRun(`
      INSERT INTO system_users (uid, email, username, password_hash, display_name, role, org_id)
      VALUES 
        ('usr_admin_1', 'admin@lunugamwehera.gov.lk', 'admin', 'admin123', 'System Administrator', 'admin', ?),
        ('usr_manager_1', 'manager@lunugamwehera.gov.lk', 'manager', 'manager123', 'HR Attendance Manager', 'manager', ?),
        ('usr_staff_1', 'staff@lunugamwehera.gov.lk', 'staff', 'staff123', 'Office Staff Member', 'staff', ?)
    `, [defaultOrg, defaultOrg, defaultOrg]);
    console.log('[DB] Seeded default organization system users (admin, manager, staff).');
  }

  // Seed default shifts if empty
  const shiftCount = await dbGet(`SELECT COUNT(*) as count FROM working_shifts`);
  if (!shiftCount || shiftCount.count === 0) {
    await dbRun(`
      INSERT INTO working_shifts (id, name, start_time, end_time, grace_period_mins, half_day_hours, late_half_day_hours, full_day_hours, work_days, color, is_default)
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

  // Seed default leave categories and types if empty
  const catCount = await dbGet(`SELECT COUNT(*) as count FROM leave_categories`);
  if (!catCount || catCount.count === 0) {
    const defaultOrg = 'DSOFFICE_LUNUGAMWEHERA';
    // 1. Permanent (default)
    const resPerm = await dbRun(`
      INSERT INTO leave_categories (name, description, color, is_default, org_id, sync_status)
      VALUES ('Permanent', 'Full-time permanent staff leave scheme', '#2563eb', 1, ?, 'PENDING')
    `, [defaultOrg]);
    const permId = resPerm.lastID || 1;

    await dbRun(`
      INSERT INTO leave_types (category_id, name, code, days_allowed, carry_forward_days, is_paid, color, description)
      VALUES 
        (?, 'Casual Leave', 'CAS', 14.0, 0.0, 1, '#10b981', 'Standard annual casual leave entitlement'),
        (?, 'Annual Leave', 'ANN', 14.0, 5.0, 1, '#2563eb', 'Annual vacation leave with optional carry forward'),
        (?, 'Medical / Sick Leave', 'MED', 21.0, 0.0, 1, '#ef4444', 'Medical allowance with medical certificate requirement')
    `, [permId, permId, permId]);

    // 2. Probation
    const resProb = await dbRun(`
      INSERT INTO leave_categories (name, description, color, is_default, org_id, sync_status)
      VALUES ('Probation', 'Probationary appointment staff policy', '#f59e0b', 0, ?, 'PENDING')
    `, [defaultOrg]);
    const probId = resProb.lastID || 2;

    await dbRun(`
      INSERT INTO leave_types (category_id, name, code, days_allowed, carry_forward_days, is_paid, color, description)
      VALUES 
        (?, 'Casual Leave', 'CAS', 7.0, 0.0, 1, '#10b981', 'Probationary casual entitlement'),
        (?, 'Medical / Sick Leave', 'MED', 7.0, 0.0, 1, '#ef4444', 'Medical illness leave during probation')
    `, [probId, probId]);

    // 3. Temporary
    const resTemp = await dbRun(`
      INSERT INTO leave_categories (name, description, color, is_default, org_id, sync_status)
      VALUES ('Temporary', 'Casual / Temporary / Contract basis staff', '#64748b', 0, ?, 'PENDING')
    `, [defaultOrg]);
    const tempId = resTemp.lastID || 3;

    await dbRun(`
      INSERT INTO leave_types (category_id, name, code, days_allowed, carry_forward_days, is_paid, color, description)
      VALUES 
        (?, 'Casual Leave', 'CAS', 7.0, 0.0, 1, '#10b981', 'Temporary staff casual leave'),
        (?, 'Medical / Sick Leave', 'MED', 7.0, 0.0, 1, '#ef4444', 'Temporary medical assistance leave')
    `, [tempId, tempId]);

    console.log('[DB] Seeded default leave categories (Permanent, Probation, Temporary) and types.');
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

// Get attendance records for a specific date range
async function getAttendanceByDateRange(startDate, endDate, onlyUnsynced = false) {
  const startStr = `${startDate} 00:00:00`;
  const endStr = `${endDate} 23:59:59`;
  let sql = `
    SELECT a.*, 
           e.name as employee_name, 
           e.department, 
           e.role, 
           e.employee_service_id,
           e.card_no
    FROM attendance_records a
    LEFT JOIN employees e ON a.user_id = e.user_id
    WHERE a.punch_time >= ? AND a.punch_time <= ?
  `;
  const params = [startStr, endStr];
  if (onlyUnsynced) {
    sql += ` AND (a.synced_to_cloud = 0 OR a.synced_to_cloud IS NULL)`;
  }
  sql += ` ORDER BY a.punch_time ASC`;
  return dbAll(sql, params);
}

// Insert / merge attendance records downloaded from Cloud Firestore into local SQLite
async function insertAttendanceFromCloud(records) {
  if (!records || records.length === 0) return { inserted: 0, total: 0 };

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO attendance_records (
          user_sn, user_id, punch_time, verify_mode, verify_name,
          punch_state, punch_state_name, work_code, temperature,
          mask_status, device_ip, device_sn, source, synced_to_cloud, cloud_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `);

      let insertedCount = 0;
      for (const rec of records) {
        const verifyName = rec.verify_name || getVerifyModeName(rec.verify_mode || rec.verifyMode);
        const punchStateName = rec.punch_state_name || getPunchStateName(rec.punch_state || rec.punchState);
        const userId = String(rec.user_id || rec.userId || '').trim();
        const punchTime = rec.punch_time || rec.punchTime;
        if (!userId || !punchTime) continue;

        stmt.run(
          rec.user_sn || 0,
          userId,
          punchTime,
          rec.verify_mode !== undefined ? rec.verify_mode : (rec.verifyMode !== undefined ? rec.verifyMode : 15),
          verifyName,
          rec.punch_state !== undefined ? rec.punch_state : (rec.punchState !== undefined ? rec.punchState : 0),
          punchStateName,
          rec.work_code || rec.workCode || 0,
          rec.temperature !== undefined ? rec.temperature : null,
          rec.mask_status !== undefined ? rec.mask_status : (rec.maskStatus !== undefined ? rec.maskStatus : null),
          rec.device_ip || rec.deviceIp || 'Cloud Firestore',
          rec.device_sn || rec.deviceSn || '',
          rec.source || 'CLOUD_SYNC',
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
          resolve({ inserted: insertedCount, total: records.length });
        });
      });
    });
  });
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

// Get system user by email, username, or display name (flexible matching)
async function getSystemUserByIdentifier(identifier, orgId) {
  if (!identifier) return null;
  const clean = String(identifier).trim().toLowerCase();
  const cleanNoSpaces = clean.replace(/\s+/g, '');
  if (orgId) {
    const cleanOrg = String(orgId).trim().toLowerCase();
    const user = await dbGet(`
      SELECT * FROM system_users 
      WHERE (
        LOWER(TRIM(email)) = ? 
        OR LOWER(TRIM(username)) = ? 
        OR LOWER(TRIM(display_name)) = ?
        OR LOWER(REPLACE(username, ' ', '')) = ?
        OR LOWER(REPLACE(display_name, ' ', '')) = ?
        OR LOWER(REPLACE(email, ' ', '')) = ?
      ) 
      AND (LOWER(TRIM(org_id)) = ? OR org_id = 'DEFAULT' OR org_id IS NULL) 
      AND COALESCE(is_active, 1) = 1
    `, [clean, clean, clean, cleanNoSpaces, cleanNoSpaces, cleanNoSpaces, cleanOrg]);
    return user || null;
  }
  return dbGet(`
    SELECT * FROM system_users 
    WHERE (
      LOWER(TRIM(email)) = ? 
      OR LOWER(TRIM(username)) = ? 
      OR LOWER(TRIM(display_name)) = ?
      OR LOWER(REPLACE(username, ' ', '')) = ?
      OR LOWER(REPLACE(display_name, ' ', '')) = ?
      OR LOWER(REPLACE(email, ' ', '')) = ?
    ) 
    AND COALESCE(is_active, 1) = 1
  `, [clean, clean, clean, cleanNoSpaces, cleanNoSpaces, cleanNoSpaces]);
}

// Get all valid/known organization partition IDs in system
async function getValidOrganizationIds() {
  const orgs = new Set();

  try {
    const settingOrg = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_org_id'`);
    if (settingOrg && settingOrg.value && settingOrg.value.trim()) {
      orgs.add(settingOrg.value.trim().toUpperCase());
    }
  } catch (e) {}

  try {
    const licRow = await dbGet(`SELECT value FROM settings WHERE key = 'system_license_data'`);
    if (licRow && licRow.value) {
      const match = licRow.value.match(/-----BEGIN SPEEDFACE LICENSE-----\r?\n([\s\S]+?)\r?\n-----END SPEEDFACE LICENSE-----/);
      if (match) {
        const decoded = JSON.parse(Buffer.from(match[1].trim(), 'base64').toString('utf8'));
        const licOrg = decoded?.payload?.orgId;
        if (licOrg && licOrg !== '*' && licOrg.trim()) {
          orgs.add(licOrg.trim().toUpperCase());
        }
      }
    }
  } catch (e) {}

  try {
    const empOrgs = await dbAll(`SELECT DISTINCT org_id FROM employees WHERE org_id IS NOT NULL AND org_id != ''`);
    empOrgs.forEach(r => { if (r.org_id) orgs.add(r.org_id.trim().toUpperCase()); });
  } catch (e) {}

  try {
    const userOrgs = await dbAll(`SELECT DISTINCT org_id FROM system_users WHERE org_id IS NOT NULL AND org_id != ''`);
    userOrgs.forEach(r => { if (r.org_id && r.org_id !== 'DEFAULT') orgs.add(r.org_id.trim().toUpperCase()); });
  } catch (e) {}

  try {
    const shiftOrgs = await dbAll(`SELECT DISTINCT org_id FROM working_shifts WHERE org_id IS NOT NULL AND org_id != ''`);
    shiftOrgs.forEach(r => { if (r.org_id && r.org_id !== 'DEFAULT') orgs.add(r.org_id.trim().toUpperCase()); });
  } catch (e) {}

  try {
    const leaveOrgs = await dbAll(`SELECT DISTINCT org_id FROM leave_categories WHERE org_id IS NOT NULL AND org_id != ''`);
    leaveOrgs.forEach(r => { if (r.org_id) orgs.add(r.org_id.trim().toUpperCase()); });
  } catch (e) {}

  if (orgs.size === 0) {
    orgs.add('DSOFFICE_LUNUGAMWEHERA');
  }

  return Array.from(orgs);
}

// Get system user by UID
async function getSystemUserByUid(uid) {
  if (!uid) return null;
  return dbGet(`SELECT * FROM system_users WHERE uid = ?`, [uid]);
}

// Get all system users for an organization
async function getSystemUsersByOrg(orgId) {
  if (!orgId) return [];
  return dbAll(`
    SELECT id, uid, email, username, display_name, role, org_id, phone, is_active, created_at, updated_at 
    FROM system_users 
    WHERE org_id = ? 
    ORDER BY role ASC, display_name ASC
  `, [orgId]);
}

// Create or update a system user
async function saveSystemUser(userData) {
  const uid = userData.uid || ('usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  const email = (userData.email || '').trim().toLowerCase();
  const username = (userData.username || email.split('@')[0] || uid).trim().toLowerCase();
  const displayName = userData.display_name || userData.displayName || username;
  const role = userData.role || 'staff';
  const orgId = (userData.org_id || userData.orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const phone = userData.phone || '';
  const passwordHash = userData.password || userData.password_hash || 'password123';
  const firebaseUid = userData.firebase_uid || userData.firebaseUid || null;

  await dbRun(`
    INSERT INTO system_users (uid, email, username, password_hash, display_name, role, org_id, phone, firebase_uid, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(uid) DO UPDATE SET
      email = excluded.email,
      username = excluded.username,
      display_name = excluded.display_name,
      role = excluded.role,
      org_id = excluded.org_id,
      phone = excluded.phone,
      firebase_uid = COALESCE(excluded.firebase_uid, system_users.firebase_uid),
      updated_at = CURRENT_TIMESTAMP
  `, [uid, email, username, passwordHash, displayName, role, orgId, phone, firebaseUid]);

  return getSystemUserByUid(uid);
}

// Delete system user
async function deleteSystemUser(uid) {
  return dbRun(`DELETE FROM system_users WHERE uid = ?`, [uid]);
}

// -------------------------------------------------------------
// Multi-Organization Working Shifts & Holidays Helpers
// -------------------------------------------------------------

// Get shifts for an organization (with fallback to default if none configured)
async function getShiftsByOrg(orgId) {
  let sql = `
    SELECT 
      s.*,
      COUNT(e.user_id) as employee_count
    FROM working_shifts s
    LEFT JOIN employees e ON s.id = e.shift_id
  `;
  const params = [];
  if (orgId) {
    sql += ` WHERE (UPPER(s.org_id) = ? OR s.org_id = 'DEFAULT' OR s.org_id IS NULL)`;
    params.push(String(orgId).trim().toUpperCase());
  }
  sql += ` GROUP BY s.id ORDER BY s.id ASC`;
  const shifts = await dbAll(sql, params);
  if ((!shifts || shifts.length === 0) && orgId) {
    return dbAll(`
      SELECT 
        s.*,
        COUNT(e.user_id) as employee_count
      FROM working_shifts s
      LEFT JOIN employees e ON s.id = e.shift_id
      GROUP BY s.id
      ORDER BY s.id ASC
    `);
  }
  return shifts;
}

// Get holidays for an organization (with fallback to default if none configured)
async function getHolidaysByOrg(orgId) {
  let sql = `SELECT * FROM holidays`;
  const params = [];
  if (orgId) {
    sql += ` WHERE (UPPER(org_id) = ? OR org_id = 'DEFAULT' OR org_id IS NULL)`;
    params.push(String(orgId).trim().toUpperCase());
  }
  sql += ` ORDER BY holiday_date ASC`;
  const holidays = await dbAll(sql, params);
  if ((!holidays || holidays.length === 0) && orgId) {
    return dbAll(`SELECT * FROM holidays ORDER BY holiday_date ASC`);
  }
  return holidays;
}

// Upsert working shift downloaded from Firestore into local SQLite
async function upsertWorkingShiftFromCloud(shiftData, orgId) {
  const targetOrg = (orgId || shiftData.org_id || shiftData.organizationId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const name = (shiftData.name || '').trim();
  if (!name) return null;

  let existing = null;
  const rawId = parseInt(shiftData.id, 10);
  if (!isNaN(rawId) && rawId > 0) {
    existing = await dbGet(`SELECT id FROM working_shifts WHERE id = ?`, [rawId]);
  }
  if (!existing) {
    existing = await dbGet(`SELECT id FROM working_shifts WHERE name = ? AND (UPPER(org_id) = ? OR org_id = 'DEFAULT')`, [name, targetOrg]);
  }

  const startTime = shiftData.start_time || shiftData.startTime || '09:00';
  const endTime = shiftData.end_time || shiftData.endTime || '18:00';
  const graceMins = parseInt(shiftData.grace_period_mins ?? shiftData.gracePeriodMins ?? 15, 10);
  const monthlyGraceDays = parseInt(shiftData.monthly_grace_days ?? shiftData.monthlyGraceDays ?? 2, 10);
  const lateCoverEnd = shiftData.late_cover_end ?? shiftData.lateCoverEnd ? 1 : 0;
  const halfDayHours = parseFloat(shiftData.half_day_hours ?? shiftData.halfDayHours ?? 3.5);
  const lateHalfDayHours = parseFloat(shiftData.late_half_day_hours ?? shiftData.lateHalfDayHours ?? 4.0);
  const fullDayHours = parseFloat(shiftData.full_day_hours ?? shiftData.fullDayHours ?? 7.75);
  const workDays = shiftData.work_days || shiftData.workDays || '1,2,3,4,5';
  const color = shiftData.color || '#2563eb';
  const isDefault = shiftData.is_default ?? shiftData.isDefault ? 1 : 0;
  const monthlyShortLeaves = parseInt(shiftData.monthly_short_leaves ?? shiftData.monthlyShortLeaves ?? 2, 10);
  const morningShortStart = shiftData.morning_short_leave_start || shiftData.morningShortLeaveStart || '09:00';
  const morningShortEnd = shiftData.morning_short_leave_end || shiftData.morningShortLeaveEnd || '10:00';
  const eveningShortStart = shiftData.evening_short_leave_start || shiftData.eveningShortLeaveStart || '14:45';
  const eveningShortEnd = shiftData.evening_short_leave_end || shiftData.eveningShortLeaveEnd || '16:15';
  const disallowSameDay = shiftData.disallow_grace_and_short_leave_same_day ?? shiftData.disallowGraceAndShortLeaveSameDay ? 1 : 0;
  const otMin = parseInt(shiftData.ot_min_mins ?? shiftData.otMinMins ?? 60, 10);
  const otStep = parseInt(shiftData.ot_step_mins ?? shiftData.otStepMins ?? 15, 10);
  const enableGrace = shiftData.enable_morning_grace ?? shiftData.enableMorningGrace ? 1 : 0;
  const enableShort = shiftData.enable_short_leave ?? shiftData.enableShortLeave ? 1 : 0;
  const enableHalf = shiftData.enable_half_day_calc ?? shiftData.enableHalfDayCalc ? 1 : 0;
  const enableOt = shiftData.enable_overtime ?? shiftData.enableOvertime ? 1 : 0;

  if (existing) {
    await dbRun(`
      UPDATE working_shifts SET
        name = ?, start_time = ?, end_time = ?, grace_period_mins = ?,
        monthly_grace_days = ?, late_cover_end = ?, half_day_hours = ?, late_half_day_hours = ?, full_day_hours = ?,
        work_days = ?, color = ?, is_default = ?, monthly_short_leaves = ?,
        morning_short_leave_start = ?, morning_short_leave_end = ?, evening_short_leave_start = ?, evening_short_leave_end = ?,
        disallow_grace_and_short_leave_same_day = ?, ot_min_mins = ?, ot_step_mins = ?,
        enable_morning_grace = ?, enable_short_leave = ?, enable_half_day_calc = ?, enable_overtime = ?,
        org_id = ?, sync_status = 'SYNCED', cloud_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, startTime, endTime, graceMins, monthlyGraceDays, lateCoverEnd, halfDayHours, lateHalfDayHours, fullDayHours,
      workDays, color, isDefault, monthlyShortLeaves, morningShortStart, morningShortEnd, eveningShortStart, eveningShortEnd,
      disallowSameDay, otMin, otStep, enableGrace, enableShort, enableHalf, enableOt, targetOrg, existing.id
    ]);
    return existing.id;
  } else {
    let res;
    if (!isNaN(rawId) && rawId > 0) {
      res = await dbRun(`
        INSERT INTO working_shifts (
          id, name, start_time, end_time, grace_period_mins,
          monthly_grace_days, late_cover_end, half_day_hours, late_half_day_hours, full_day_hours,
          work_days, color, is_default, monthly_short_leaves,
          morning_short_leave_start, morning_short_leave_end, evening_short_leave_start, evening_short_leave_end,
          disallow_grace_and_short_leave_same_day, ot_min_mins, ot_step_mins,
          enable_morning_grace, enable_short_leave, enable_half_day_calc, enable_overtime,
          org_id, sync_status, cloud_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', CURRENT_TIMESTAMP)
      `, [
        rawId, name, startTime, endTime, graceMins, monthlyGraceDays, lateCoverEnd, halfDayHours, lateHalfDayHours, fullDayHours,
        workDays, color, isDefault, monthlyShortLeaves, morningShortStart, morningShortEnd, eveningShortStart, eveningShortEnd,
        disallowSameDay, otMin, otStep, enableGrace, enableShort, enableHalf, enableOt, targetOrg
      ]);
    } else {
      res = await dbRun(`
        INSERT INTO working_shifts (
          name, start_time, end_time, grace_period_mins,
          monthly_grace_days, late_cover_end, half_day_hours, late_half_day_hours, full_day_hours,
          work_days, color, is_default, monthly_short_leaves,
          morning_short_leave_start, morning_short_leave_end, evening_short_leave_start, evening_short_leave_end,
          disallow_grace_and_short_leave_same_day, ot_min_mins, ot_step_mins,
          enable_morning_grace, enable_short_leave, enable_half_day_calc, enable_overtime,
          org_id, sync_status, cloud_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', CURRENT_TIMESTAMP)
      `, [
        name, startTime, endTime, graceMins, monthlyGraceDays, lateCoverEnd, halfDayHours, lateHalfDayHours, fullDayHours,
        workDays, color, isDefault, monthlyShortLeaves, morningShortStart, morningShortEnd, eveningShortStart, eveningShortEnd,
        disallowSameDay, otMin, otStep, enableGrace, enableShort, enableHalf, enableOt, targetOrg
      ]);
    }
    return res.lastID;
  }
}

// Upsert holiday downloaded from Firestore into local SQLite
async function upsertHolidayFromCloud(holidayData, orgId) {
  const targetOrg = (orgId || holidayData.org_id || holidayData.organizationId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const name = (holidayData.name || '').trim();
  const holidayDate = (holidayData.holiday_date || holidayData.holidayDate || '').slice(0, 10).trim();
  if (!name || !holidayDate) return null;

  const holidayType = holidayData.holiday_type || holidayData.holidayType || 'Public Holiday';
  const bankHoliday = holidayData.bank_holiday ?? holidayData.bankHoliday ? 1 : 0;
  const publicHoliday = holidayData.public_holiday !== undefined ? (holidayData.public_holiday ? 1 : 0) : (holidayData.publicHoliday !== undefined ? (holidayData.publicHoliday ? 1 : 0) : 1);
  const mercantileHoliday = holidayData.mercantile_holiday ?? holidayData.mercantileHoliday ? 1 : 0;
  const isRecurring = holidayData.is_recurring ?? holidayData.isRecurring ? 1 : 0;

  const existing = await dbGet(`SELECT id FROM holidays WHERE holiday_date = ? AND name = ?`, [holidayDate, name]);

  if (existing) {
    await dbRun(`
      UPDATE holidays SET
        holiday_type = ?,
        bank_holiday = ?,
        public_holiday = ?,
        mercantile_holiday = ?,
        is_recurring = ?,
        org_id = ?,
        sync_status = 'SYNCED',
        cloud_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [holidayType, bankHoliday, publicHoliday, mercantileHoliday, isRecurring, targetOrg, existing.id]);
    return existing.id;
  } else {
    const res = await dbRun(`
      INSERT INTO holidays (
        name, holiday_date, holiday_type, bank_holiday, public_holiday, mercantile_holiday, is_recurring, org_id, sync_status, cloud_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', CURRENT_TIMESTAMP)
    `, [name, holidayDate, holidayType, bankHoliday, publicHoliday, mercantileHoliday, isRecurring, targetOrg]);
    return res.lastID;
  }
}

// Mark working shifts as synced to cloud
async function markShiftsCloudSynced(shiftIds = []) {
  if (!shiftIds || shiftIds.length === 0) return 0;
  const placeholders = shiftIds.map(() => '?').join(',');
  const res = await dbRun(`
    UPDATE working_shifts
    SET sync_status = 'SYNCED', cloud_synced_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `, shiftIds);
  return res.changes || 0;
}

// Mark holidays as synced to cloud
async function markHolidaysCloudSynced(holidayIds = []) {
  if (!holidayIds || holidayIds.length === 0) return 0;
  const placeholders = holidayIds.map(() => '?').join(',');
  const res = await dbRun(`
    UPDATE holidays
    SET sync_status = 'SYNCED', cloud_synced_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `, holidayIds);
  return res.changes || 0;
}


// -------------------------------------------------------------
// Multi-Organization Leave Management Helpers
// -------------------------------------------------------------

// Get all leave categories with count of types and count of assigned employees
async function getLeaveCategories(orgId) {
  let sql = `
    SELECT 
      c.*,
      COUNT(DISTINCT t.id) as types_count,
      COUNT(DISTINCT e.user_id) as employee_count
    FROM leave_categories c
    LEFT JOIN leave_types t ON c.id = t.category_id
    LEFT JOIN employees e ON c.id = COALESCE(e.leave_category_id, 1)
  `;
  const params = [];
  if (orgId && orgId !== 'ALL') {
    sql += ` WHERE (UPPER(c.org_id) = ? OR c.org_id = 'DEFAULT' OR c.org_id IS NULL)`;
    params.push(String(orgId).trim().toUpperCase());
  }
  sql += ` GROUP BY c.id ORDER BY c.is_default DESC, c.id ASC`;
  let categories = await dbAll(sql, params);
  if ((!categories || categories.length === 0) && orgId && orgId !== 'ALL') {
    categories = await dbAll(`
      SELECT 
        c.*,
        COUNT(DISTINCT t.id) as types_count,
        COUNT(DISTINCT e.user_id) as employee_count
      FROM leave_categories c
      LEFT JOIN leave_types t ON c.id = t.category_id
      LEFT JOIN employees e ON c.id = COALESCE(e.leave_category_id, 1)
      GROUP BY c.id
      ORDER BY c.is_default DESC, c.id ASC
    `);
  }

  // Attach leave types to each category (ordered by auto-deduction priority)
  for (const cat of categories) {
    cat.leave_types = await dbAll(
      `SELECT * FROM leave_types WHERE category_id = ? ORDER BY COALESCE(deduction_priority, 99) ASC, id ASC`,
      [cat.id]
    );
  }
  return categories;
}

// Get single leave category by ID
async function getLeaveCategoryById(id) {
  const cat = await dbGet(`SELECT * FROM leave_categories WHERE id = ?`, [id]);
  if (!cat) return null;
  cat.leave_types = await dbAll(`SELECT * FROM leave_types WHERE category_id = ? ORDER BY id ASC`, [id]);
  return cat;
}

// Save or Update Leave Category
async function saveLeaveCategory(catData, orgId) {
  const targetOrg = (orgId || catData.org_id || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const name = (catData.name || '').trim();
  if (!name) throw new Error('Category name is required');
  const description = catData.description || '';
  const color = catData.color || '#2563eb';
  const isDefault = (catData.is_default || catData.isDefault) ? 1 : 0;
  const rawId = parseInt(catData.id, 10);

  if (isDefault === 1) {
    // Unset default on other categories in this org
    await dbRun(`UPDATE leave_categories SET is_default = 0 WHERE (UPPER(org_id) = ? OR org_id = 'DEFAULT')`, [targetOrg]);
  }

  if (rawId && !isNaN(rawId)) {
    await dbRun(`
      UPDATE leave_categories SET
        name = ?, description = ?, color = ?, is_default = ?, org_id = ?,
        sync_status = 'PENDING', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, color, isDefault, targetOrg, rawId]);
    return { id: rawId, name, description, color, is_default: isDefault, org_id: targetOrg };
  } else {
    const res = await dbRun(`
      INSERT INTO leave_categories (name, description, color, is_default, org_id, sync_status, updated_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
    `, [name, description, color, isDefault, targetOrg]);
    return { id: res.lastID, name, description, color, is_default: isDefault, org_id: targetOrg };
  }
}

// Delete Leave Category (reassigning employees to default category id=1)
async function deleteLeaveCategory(id) {
  const catId = parseInt(id, 10);
  const cat = await dbGet(`SELECT * FROM leave_categories WHERE id = ?`, [catId]);
  if (!cat) throw new Error('Leave category not found');
  if (cat.is_default || catId === 1) {
    throw new Error('Cannot delete the default leave category');
  }

  // Find fallback default category
  const defaultCat = (await dbGet(`SELECT id FROM leave_categories WHERE is_default = 1 LIMIT 1`)) || { id: 1 };
  await dbRun(`UPDATE employees SET leave_category_id = ? WHERE leave_category_id = ?`, [defaultCat.id, catId]);
  await dbRun(`DELETE FROM leave_types WHERE category_id = ?`, [catId]);
  await dbRun(`DELETE FROM leave_categories WHERE id = ?`, [catId]);
  return { success: true, reassignedCategoryId: defaultCat.id };
}

// Get Leave Types by Category (ordered by auto-deduction priority)
async function getLeaveTypesByCategory(categoryId) {
  return dbAll(`SELECT * FROM leave_types WHERE category_id = ? ORDER BY COALESCE(deduction_priority, 99) ASC, id ASC`, [categoryId]);
}

// Save or Update Leave Type
async function saveLeaveType(typeData) {
  const categoryId = parseInt(typeData.category_id, 10);
  if (!categoryId) throw new Error('Valid category_id is required');
  const name = (typeData.name || '').trim();
  if (!name) throw new Error('Leave type name is required');
  const code = (typeData.code || name.substring(0, 3).toUpperCase()).trim();

  const isDutyLeave = typeData.is_duty_leave !== undefined
    ? (typeData.is_duty_leave ? 1 : 0)
    : (code.toUpperCase() === 'DUTY' || name.toLowerCase().includes('duty leave') ? 1 : 0);

  const isCompensatoryLeave = typeData.is_compensatory_leave !== undefined
    ? (typeData.is_compensatory_leave ? 1 : 0)
    : (code.toUpperCase() === 'COMP' || name.toLowerCase().includes('compensatory') ? 1 : 0);

  const isQuotaExempt = isDutyLeave || isCompensatoryLeave;

  // If Duty Leave or Compensatory Leave: it has no quota, no carry-forward, and cannot be used for unrequested absence reduction
  const daysAllowed = isQuotaExempt ? 0.0 : parseFloat(typeData.days_allowed ?? 14.0);
  const carryForwardDays = isQuotaExempt ? 0.0 : parseFloat(typeData.carry_forward_days ?? 0.0);
  const isPaid = typeData.is_paid !== undefined ? (typeData.is_paid ? 1 : 0) : 1;
  const color = typeData.color || (isDutyLeave ? '#6366f1' : (isCompensatoryLeave ? '#0284c7' : '#10b981'));
  const description = typeData.description || (isDutyLeave ? 'Official Duty Leave (No quota - approved requests are not counted as leave)' : (isCompensatoryLeave ? 'Compensatory Leave (Earned Comp-Off - No Quota)' : ''));
  const deductionPriority = isQuotaExempt ? 99 : parseInt(typeData.deduction_priority ?? 1, 10);
  const enableAutoDeduct = isQuotaExempt ? 0 : (typeData.enable_auto_deduct !== undefined ? (typeData.enable_auto_deduct ? 1 : 0) : 1);
  const rawId = parseInt(typeData.id, 10);

  // Mark parent category as pending sync
  await dbRun(`UPDATE leave_categories SET sync_status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [categoryId]);

  if (rawId && !isNaN(rawId)) {
    await dbRun(`
      UPDATE leave_types SET
        name = ?, code = ?, days_allowed = ?, carry_forward_days = ?,
        is_paid = ?, color = ?, description = ?, deduction_priority = ?,
        enable_auto_deduct = ?, is_duty_leave = ?, is_compensatory_leave = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, code, daysAllowed, carryForwardDays, isPaid, color, description, deductionPriority, enableAutoDeduct, isDutyLeave, isCompensatoryLeave, rawId]);
    return {
      id: rawId, category_id: categoryId, name, code, days_allowed: daysAllowed,
      carry_forward_days: carryForwardDays, is_paid: isPaid, color, description,
      deduction_priority: deductionPriority, enable_auto_deduct: enableAutoDeduct,
      is_duty_leave: isDutyLeave, is_compensatory_leave: isCompensatoryLeave
    };
  } else {
    const res = await dbRun(`
      INSERT INTO leave_types (
        category_id, name, code, days_allowed, carry_forward_days, is_paid, color, description,
        deduction_priority, enable_auto_deduct, is_duty_leave, is_compensatory_leave
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [categoryId, name, code, daysAllowed, carryForwardDays, isPaid, color, description, deductionPriority, enableAutoDeduct, isDutyLeave, isCompensatoryLeave]);
    return {
      id: res.lastID, category_id: categoryId, name, code, days_allowed: daysAllowed,
      carry_forward_days: carryForwardDays, is_paid: isPaid, color, description,
      deduction_priority: deductionPriority, enable_auto_deduct: enableAutoDeduct,
      is_duty_leave: isDutyLeave, is_compensatory_leave: isCompensatoryLeave
    };
  }
}

// Delete Leave Type
async function deleteLeaveType(id) {
  const typeId = parseInt(id, 10);
  const type = await dbGet(`SELECT category_id FROM leave_types WHERE id = ?`, [typeId]);
  if (type) {
    await dbRun(`UPDATE leave_categories SET sync_status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [type.category_id]);
  }
  await dbRun(`DELETE FROM employee_leave_balances WHERE leave_type_id = ?`, [typeId]);
  await dbRun(`DELETE FROM leave_types WHERE id = ?`, [typeId]);
  return { success: true };
}

// Initialize / Sync Employee Leave Balances for a given employee and year
async function initializeEmployeeLeaveBalances(userId, categoryId, year, orgId) {
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const catId = parseInt(categoryId, 10) || 1;
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  const types = await dbAll(`SELECT * FROM leave_types WHERE category_id = ?`, [catId]);
  if (!types || types.length === 0) return 0;

  let initializedCount = 0;
  for (const t of types) {
    const existing = await dbGet(
      `SELECT * FROM employee_leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [userId, t.id, yr]
    );

    if (existing) {
      const allocated = t.days_allowed;
      const cf = parseFloat(existing.carried_forward_days) || 0.0;
      const remaining = Math.max(0, (allocated + cf) - (existing.used_days || 0));
      await dbRun(`
        UPDATE employee_leave_balances SET
          allocated_days = ?, remaining_days = ?, org_id = ?, sync_status = 'PENDING', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [allocated, remaining, targetOrg, existing.id]);
    } else {
      await dbRun(`
        INSERT INTO employee_leave_balances (user_id, leave_type_id, year, allocated_days, carried_forward_days, used_days, remaining_days, notes, org_id, sync_status)
        VALUES (?, ?, ?, ?, 0.0, 0.0, ?, '', ?, 'PENDING')
      `, [userId, t.id, yr, t.days_allowed, t.days_allowed, targetOrg]);
    }
    initializedCount++;
  }
  return initializedCount;
}

// Bulk or Single Assign Leave Category to Employees
async function assignLeaveCategoryToEmployees({ leaveCategoryId, userIds = [], department = '', orgId = '', reinitializeBalances = true, year }) {
  const catId = parseInt(leaveCategoryId, 10);
  if (!catId) throw new Error('Valid leave_category_id is required');
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  let targetUserIds = [];

  if (Array.isArray(userIds) && userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(',');
    await dbRun(
      `UPDATE employees SET leave_category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id IN (${placeholders})`,
      [catId, ...userIds]
    );
    targetUserIds = userIds;
  } else if (department) {
    const emps = await dbAll(`SELECT user_id FROM employees WHERE department = ?`, [department]);
    targetUserIds = emps.map(e => e.user_id);
    await dbRun(
      `UPDATE employees SET leave_category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE department = ?`,
      [catId, department]
    );
  } else {
    const emps = await dbAll(`SELECT user_id FROM employees`);
    targetUserIds = emps.map(e => e.user_id);
    await dbRun(`UPDATE employees SET leave_category_id = ?, updated_at = CURRENT_TIMESTAMP`, [catId]);
  }

  if (reinitializeBalances && targetUserIds.length > 0) {
    for (const uId of targetUserIds) {
      await initializeEmployeeLeaveBalances(uId, catId, yr, targetOrg);
    }
  }

  return { success: true, count: targetUserIds.length, userIds: targetUserIds };
}

// Get Employee Leave Balances for a specific user and year
async function getEmployeeLeaveBalances(userId, year) {
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const emp = await dbGet(`
    SELECT e.user_id, e.name, e.department, e.role, e.employee_service_id, e.employment_status, e.photo,
           e.leave_category_id, e.org_id,
           c.name as leave_category_name, c.color as leave_category_color
    FROM employees e
    LEFT JOIN leave_categories c ON COALESCE(e.leave_category_id, 1) = c.id
    WHERE e.user_id = ?
  `, [userId]);

  if (!emp) return null;

  const catId = emp.leave_category_id || 1;
  let balances = await dbAll(`
    SELECT 
      b.*,
      t.name as leave_type_name,
      t.code as leave_type_code,
      t.days_allowed as type_days_allowed,
      t.is_paid as type_is_paid,
      t.color as leave_type_color,
      t.carry_forward_days as type_carry_forward,
      COALESCE(t.deduction_priority, 1) as deduction_priority,
      COALESCE(t.enable_auto_deduct, 1) as enable_auto_deduct,
      COALESCE(t.is_duty_leave, 0) as is_duty_leave,
      COALESCE(t.is_compensatory_leave, 0) as is_compensatory_leave
    FROM employee_leave_balances b
    JOIN leave_types t ON b.leave_type_id = t.id
    WHERE b.user_id = ? AND b.year = ? AND t.category_id = ?
    ORDER BY COALESCE(t.deduction_priority, 99) ASC, t.id ASC
  `, [userId, yr, catId]);

  if (!balances || balances.length === 0) {
    await initializeEmployeeLeaveBalances(userId, catId, yr, emp.org_id || 'DSOFFICE_LUNUGAMWEHERA');
    balances = await dbAll(`
      SELECT 
        b.*,
        t.name as leave_type_name,
        t.code as leave_type_code,
        t.days_allowed as type_days_allowed,
        t.is_paid as type_is_paid,
        t.color as leave_type_color,
        t.carry_forward_days as type_carry_forward,
        COALESCE(t.deduction_priority, 1) as deduction_priority,
        COALESCE(t.enable_auto_deduct, 1) as enable_auto_deduct,
        COALESCE(t.is_duty_leave, 0) as is_duty_leave,
        COALESCE(t.is_compensatory_leave, 0) as is_compensatory_leave
      FROM employee_leave_balances b
      JOIN leave_types t ON b.leave_type_id = t.id
      WHERE b.user_id = ? AND b.year = ? AND t.category_id = ?
      ORDER BY COALESCE(t.deduction_priority, 99) ASC, t.id ASC
    `, [userId, yr, catId]);
  }

  return {
    user_id: emp.user_id,
    name: emp.name,
    department: emp.department,
    role: emp.role,
    employee_service_id: emp.employee_service_id || '',
    employment_status: emp.employment_status || 'Permanent',
    photo: emp.photo || null,
    leave_category_id: catId,
    leave_category_name: emp.leave_category_name || 'Permanent',
    leave_category_color: emp.leave_category_color || '#2563eb',
    year: yr,
    carried_fwd_cutoff_date: balances[0]?.carried_fwd_cutoff_date || null,
    no_pay_days: balances[0]?.no_pay_days || 0.0,
    balances: balances || []
  };
}

// Adjust/Save Employee Leave Balance (supporting manual previous balance, allocated, used, notes, cutoff till date, no-pay days)
async function saveEmployeeLeaveBalance({
  userId,
  leaveTypeId,
  year,
  allocatedDays,
  carriedForwardDays = 0,
  usedDays = 0,
  remainingDays = null,
  notes = '',
  orgId,
  carriedFwdCutoffDate = null,
  noPayDays = 0,
  autoDeductedDays = 0,
  requestDeductedDays = 0
}) {
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const ltId = parseInt(leaveTypeId, 10);
  const alloc = parseFloat(allocatedDays) || 0.0;
  const cf = parseFloat(carriedForwardDays) || 0.0;
  const used = parseFloat(usedDays) || 0.0;
  const remaining = (remainingDays !== null && remainingDays !== undefined && !isNaN(parseFloat(remainingDays)))
    ? parseFloat(remainingDays)
    : Math.max(0, (alloc + cf) - used);
  const notesStr = (notes || '').trim();
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const cutoffDate = carriedFwdCutoffDate ? String(carriedFwdCutoffDate).slice(0, 10) : null;
  const npDays = parseFloat(noPayDays) || 0.0;
  const autoDed = parseFloat(autoDeductedDays) || 0.0;
  const reqDed = parseFloat(requestDeductedDays) || 0.0;

  const existing = await dbGet(
    `SELECT id FROM employee_leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
    [userId, ltId, yr]
  );

  if (existing) {
    await dbRun(`
      UPDATE employee_leave_balances SET
        allocated_days = ?, carried_forward_days = ?, used_days = ?, remaining_days = ?, notes = ?, org_id = ?,
        carried_fwd_cutoff_date = ?, no_pay_days = ?, auto_deducted_days = ?, request_deducted_days = ?,
        sync_status = 'PENDING', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [alloc, cf, used, remaining, notesStr, targetOrg, cutoffDate, npDays, autoDed, reqDed, existing.id]);
    return {
      id: existing.id, user_id: userId, leave_type_id: ltId, year: yr,
      allocated_days: alloc, carried_forward_days: cf, used_days: used, remaining_days: remaining,
      notes: notesStr, carried_fwd_cutoff_date: cutoffDate, no_pay_days: npDays,
      auto_deducted_days: autoDed, request_deducted_days: reqDed
    };
  } else {
    const res = await dbRun(`
      INSERT INTO employee_leave_balances (
        user_id, leave_type_id, year, allocated_days, carried_forward_days, used_days, remaining_days, notes,
        org_id, carried_fwd_cutoff_date, no_pay_days, auto_deducted_days, request_deducted_days, sync_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `, [userId, ltId, yr, alloc, cf, used, remaining, notesStr, targetOrg, cutoffDate, npDays, autoDed, reqDed]);
    return {
      id: res.lastID, user_id: userId, leave_type_id: ltId, year: yr,
      allocated_days: alloc, carried_forward_days: cf, used_days: used, remaining_days: remaining,
      notes: notesStr, carried_fwd_cutoff_date: cutoffDate, no_pay_days: npDays,
      auto_deducted_days: autoDed, request_deducted_days: reqDed
    };
  }
}

// Calculate / Roll Forward yearly leave balances for employees with carry-forward rules
async function calculateYearlyLeaveBalances({ year, orgId, overwriteManual = false, userIds = [] }) {
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const prevYr = yr - 1;
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  let emps = [];
  if (Array.isArray(userIds) && userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(',');
    emps = await dbAll(
      `SELECT user_id, name, department, leave_category_id, org_id FROM employees WHERE user_id IN (${placeholders})`,
      userIds
    );
  } else {
    emps = await dbAll(`
      SELECT user_id, name, department, leave_category_id, org_id FROM employees
      WHERE (UPPER(org_id) = ? OR org_id IS NULL OR org_id = '')
    `, [targetOrg]);
  }

  if (!emps || emps.length === 0) {
    return { success: true, count: 0, year: yr, message: 'No employees found to calculate' };
  }

  let processedCount = 0;
  for (const emp of emps) {
    const catId = emp.leave_category_id || 1;
    const types = await dbAll(`SELECT * FROM leave_types WHERE category_id = ? ORDER BY id ASC`, [catId]);
    if (!types || types.length === 0) continue;

    for (const t of types) {
      const existingCurrent = await dbGet(
        `SELECT * FROM employee_leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
        [emp.user_id, t.id, yr]
      );

      const existingPrev = await dbGet(
        `SELECT * FROM employee_leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
        [emp.user_id, t.id, prevYr]
      );

      let cf = 0.0;
      if (existingCurrent && !overwriteManual && (parseFloat(existingCurrent.carried_forward_days) || 0) > 0) {
        // Retain existing manual previous balance unless explicit overwrite requested
        cf = parseFloat(existingCurrent.carried_forward_days) || 0.0;
      } else if (existingPrev && (parseFloat(t.carry_forward_days) || 0) > 0) {
        const prevRemaining = Math.max(0, parseFloat(existingPrev.remaining_days) || 0);
        cf = Math.min(prevRemaining, parseFloat(t.carry_forward_days) || 0);
      }

      const allocated = parseFloat(t.days_allowed) || 0.0;
      const used = existingCurrent ? (parseFloat(existingCurrent.used_days) || 0.0) : 0.0;
      const remaining = Math.max(0, (allocated + cf) - used);

      if (existingCurrent) {
        await dbRun(`
          UPDATE employee_leave_balances SET
            allocated_days = ?, carried_forward_days = ?, remaining_days = ?, org_id = ?,
            sync_status = 'PENDING', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [allocated, cf, remaining, targetOrg, existingCurrent.id]);
      } else {
        await dbRun(`
          INSERT INTO employee_leave_balances (user_id, leave_type_id, year, allocated_days, carried_forward_days, used_days, remaining_days, notes, org_id, sync_status)
          VALUES (?, ?, ?, ?, ?, 0.0, ?, '', ?, 'PENDING')
        `, [emp.user_id, t.id, yr, allocated, cf, remaining, targetOrg]);
      }
    }
    processedCount++;
  }

  return { success: true, count: processedCount, year: yr, message: `Successfully calculated ${yr} leave balances for ${processedCount} employee(s)` };
}

// Get all employees with their category and leave balances breakdown for a given year
async function getYearlyLeaveOverview({ year, orgId, department = '', categoryId = '', search = '' }) {
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const targetOrg = (orgId && orgId !== 'ALL') ? String(orgId).trim().toUpperCase() : '';

  let whereClauses = ['COALESCE(e.is_active, 1) = 1'];
  let params = [];

  if (targetOrg) {
    whereClauses.push("(UPPER(e.org_id) = ? OR e.org_id IS NULL OR e.org_id = '')");
    params.push(targetOrg);
  }

  if (department && department !== 'all') {
    whereClauses.push('e.department = ?');
    params.push(department);
  }

  if (categoryId && categoryId !== 'all') {
    whereClauses.push('COALESCE(e.leave_category_id, 1) = ?');
    params.push(parseInt(categoryId, 10));
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(e.user_id) LIKE ? OR LOWER(e.name) LIKE ? OR LOWER(e.employee_service_id) LIKE ? OR LOWER(e.nic) LIKE ?)');
    params.push(q, q, q, q);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const emps = await dbAll(`
    SELECT 
      e.user_id, e.name, e.department, e.role, e.employee_service_id, e.photo, e.org_id,
      COALESCE(e.leave_category_id, 1) as leave_category_id,
      lc.name as leave_category_name, lc.color as leave_category_color
    FROM employees e
    LEFT JOIN leave_categories lc ON COALESCE(e.leave_category_id, 1) = lc.id
    ${whereSql}
    ORDER BY CAST(e.user_id AS INTEGER) ASC, e.user_id ASC
  `, params);

  let totalAllocatedSum = 0;
  let totalCarriedSum = 0;
  let totalUsedSum = 0;
  let totalRemainingSum = 0;

  const resultEmployees = [];

  for (const emp of emps) {
    const balData = await getEmployeeLeaveBalances(emp.user_id, yr);
    const balances = balData ? (balData.balances || []) : [];

    let empAlloc = 0;
    let empCf = 0;
    let empUsed = 0;
    let empRem = 0;

    balances.forEach(b => {
      empAlloc += parseFloat(b.allocated_days || 0);
      empCf += parseFloat(b.carried_forward_days || 0);
      empUsed += parseFloat(b.used_days || 0);
      empRem += parseFloat(b.remaining_days || 0);
    });

    totalAllocatedSum += empAlloc;
    totalCarriedSum += empCf;
    totalUsedSum += empUsed;
    totalRemainingSum += empRem;

    const empCutoffDate = balData?.carried_fwd_cutoff_date || balances[0]?.carried_fwd_cutoff_date || null;
    const empNoPay = parseFloat(balData?.no_pay_days || balances[0]?.no_pay_days || 0.0);

    resultEmployees.push({
      user_id: emp.user_id,
      name: emp.name,
      employee_service_id: emp.employee_service_id || '',
      department: emp.department || 'General',
      role: emp.role || 'Staff',
      photo: emp.photo || '',
      leave_category_id: emp.leave_category_id,
      leave_category_name: emp.leave_category_name || 'Permanent',
      leave_category_color: emp.leave_category_color || '#2563eb',
      year: yr,
      carried_fwd_cutoff_date: empCutoffDate,
      no_pay_days: empNoPay,
      total_allocated: empAlloc,
      total_carried_forward: empCf,
      total_used: empUsed,
      total_remaining: empRem,
      balances
    });
  }

  const totalNoPaySum = resultEmployees.reduce((sum, e) => sum + (e.no_pay_days || 0), 0);

  return {
    success: true,
    year: yr,
    employees: resultEmployees,
    summary: {
      totalEmployees: resultEmployees.length,
      totalAllocated: totalAllocatedSum,
      totalCarriedForward: totalCarriedSum,
      totalUsed: totalUsedSum,
      totalRemaining: totalRemainingSum,
      totalNoPay: totalNoPaySum
    }
  };
}

// Get all employee leave balances for an organization and year (for Cloud sync)
async function getOrganizationLeaveBalances(orgId, year) {
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  const emps = await dbAll(`
    SELECT DISTINCT e.user_id, e.name, e.department, e.leave_category_id,
           c.name as leave_category_name, c.color as leave_category_color
    FROM employees e
    LEFT JOIN leave_categories c ON COALESCE(e.leave_category_id, 1) = c.id
    WHERE (UPPER(e.org_id) = ? OR e.org_id IS NULL OR e.org_id = '')
  `, [targetOrg]);

  const results = [];
  for (const emp of emps) {
    const balData = await getEmployeeLeaveBalances(emp.user_id, yr);
    if (balData) {
      results.push(balData);
    }
  }
  return results;
}

// Upsert Leave Category downloaded from Cloud
async function upsertLeaveCategoryFromCloud(data, orgId) {
  const targetOrg = (orgId || data.org_id || data.organizationId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const name = (data.name || '').trim();
  if (!name) return null;

  let existing = null;
  const rawId = parseInt(data.id, 10);
  if (!isNaN(rawId) && rawId > 0) {
    existing = await dbGet(`SELECT id FROM leave_categories WHERE id = ?`, [rawId]);
  }
  if (!existing) {
    existing = await dbGet(`SELECT id FROM leave_categories WHERE name = ? AND UPPER(org_id) = ?`, [name, targetOrg]);
  }

  const description = data.description || '';
  const color = data.color || '#2563eb';
  const isDefault = data.isDefault || data.is_default ? 1 : 0;

  let categoryId = null;
  if (existing) {
    await dbRun(`
      UPDATE leave_categories SET
        name = ?, description = ?, color = ?, is_default = ?, org_id = ?,
        sync_status = 'SYNCED', cloud_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, color, isDefault, targetOrg, existing.id]);
    categoryId = existing.id;
  } else if (!isNaN(rawId) && rawId > 0) {
    await dbRun(`
      INSERT INTO leave_categories (id, name, description, color, is_default, org_id, sync_status, cloud_synced_at)
      VALUES (?, ?, ?, ?, ?, ?, 'SYNCED', CURRENT_TIMESTAMP)
    `, [rawId, name, description, color, isDefault, targetOrg]);
    categoryId = rawId;
  } else {
    const res = await dbRun(`
      INSERT INTO leave_categories (name, description, color, is_default, org_id, sync_status, cloud_synced_at)
      VALUES (?, ?, ?, ?, ?, 'SYNCED', CURRENT_TIMESTAMP)
    `, [name, description, color, isDefault, targetOrg]);
    categoryId = res.lastID;
  }

  // Upsert nested leave types
  if (Array.isArray(data.leaveTypes) && data.leaveTypes.length > 0) {
    for (const lt of data.leaveTypes) {
      const ltName = (lt.name || '').trim();
      if (!ltName) continue;
      const ltCode = (lt.code || ltName.substring(0, 3).toUpperCase()).trim();
      const ltDays = parseFloat(lt.daysAllowed ?? lt.days_allowed ?? 14.0);
      const ltCarry = parseFloat(lt.carryForwardDays ?? lt.carry_forward_days ?? 0.0);
      const ltPaid = (lt.isPaid !== undefined ? lt.isPaid : lt.is_paid) ? 1 : 0;
      const ltColor = lt.color || '#10b981';
      const ltDesc = lt.description || '';

      const existLt = await dbGet(`SELECT id FROM leave_types WHERE category_id = ? AND name = ?`, [categoryId, ltName]);
      if (existLt) {
        await dbRun(`
          UPDATE leave_types SET
            code = ?, days_allowed = ?, carry_forward_days = ?, is_paid = ?, color = ?, description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [ltCode, ltDays, ltCarry, ltPaid, ltColor, ltDesc, existLt.id]);
      } else {
        await dbRun(`
          INSERT INTO leave_types (category_id, name, code, days_allowed, carry_forward_days, is_paid, color, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [categoryId, ltName, ltCode, ltDays, ltCarry, ltPaid, ltColor, ltDesc]);
      }
    }
  }

  return categoryId;
}

// Upsert Leave Balances downloaded from Cloud
async function upsertLeaveBalancesFromCloud(data, orgId) {
  const targetOrg = (orgId || data.organizationId || data.org_id || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const userId = String(data.userId || data.user_id || '').trim();
  const year = parseInt(data.year, 10) || new Date().getFullYear();
  if (!userId || !Array.isArray(data.balances)) return 0;

  let count = 0;
  for (const b of data.balances) {
    const leaveTypeId = parseInt(b.leaveTypeId || b.leave_type_id, 10);
    if (!leaveTypeId) continue;
    const allocated = parseFloat(b.allocatedDays ?? b.allocated_days ?? 0);
    const carriedForward = parseFloat(b.carriedForwardDays ?? b.carried_forward_days ?? 0);
    const used = parseFloat(b.usedDays ?? b.used_days ?? 0);
    const remaining = parseFloat(b.remainingDays ?? b.remaining_days ?? ((allocated + carriedForward) - used));
    const notesStr = (b.notes || '').trim();

    const existing = await dbGet(
      `SELECT id FROM employee_leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [userId, leaveTypeId, year]
    );

    if (existing) {
      await dbRun(`
        UPDATE employee_leave_balances SET
          allocated_days = ?, carried_forward_days = ?, used_days = ?, remaining_days = ?, notes = ?, org_id = ?,
          sync_status = 'SYNCED', cloud_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [allocated, carriedForward, used, remaining, notesStr, targetOrg, existing.id]);
    } else {
      await dbRun(`
        INSERT INTO employee_leave_balances (user_id, leave_type_id, year, allocated_days, carried_forward_days, used_days, remaining_days, notes, org_id, sync_status, cloud_synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', CURRENT_TIMESTAMP)
      `, [userId, leaveTypeId, year, allocated, carriedForward, used, remaining, notesStr, targetOrg]);
    }
    count++;
  }
  return count;
}

// Mark categories as synced to cloud
async function markLeaveCategoriesCloudSynced(categoryIds = []) {
  if (!categoryIds || categoryIds.length === 0) return 0;
  const placeholders = categoryIds.map(() => '?').join(',');
  const res = await dbRun(`
    UPDATE leave_categories
    SET sync_status = 'SYNCED', cloud_synced_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `, categoryIds);
  return res.changes || 0;
}

// Mark balances as synced to cloud
async function markEmployeeBalancesCloudSynced(balanceIds = []) {
  if (!balanceIds || balanceIds.length === 0) return 0;
  const placeholders = balanceIds.map(() => '?').join(',');
  const res = await dbRun(`
    UPDATE employee_leave_balances
    SET sync_status = 'SYNCED', cloud_synced_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `, balanceIds);
  return res.changes || 0;
}


// -------------------------------------------------------------
// Leave Requests & Approvals
// -------------------------------------------------------------

// Create Leave Request (defaults to PENDING)
async function createLeaveRequest({ userId, leaveTypeId, startDate, endDate, daysRequested, dayType = 'FULL_DAY', reason = '', emergencyContact = '', qualifyingDate = null, compensatorySourceType = null, orgId }) {
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const uId = String(userId).trim();
  const ltId = parseInt(leaveTypeId, 10);
  const days = parseFloat(daysRequested) || 1.0;
  const dType = dayType || 'FULL_DAY';
  const rsn = (reason || '').trim();
  const contact = (emergencyContact || '').trim();
  const qDate = qualifyingDate ? String(qualifyingDate).trim().slice(0, 10) : null;
  const cSource = compensatorySourceType ? String(compensatorySourceType).trim() : null;

  const emp = await dbGet(`SELECT user_id, name, org_id FROM employees WHERE user_id = ?`, [uId]);
  if (!emp) throw new Error(`Employee User #${uId} not found`);

  const lt = await dbGet(`SELECT id, name, days_allowed FROM leave_types WHERE id = ?`, [ltId]);
  if (!lt) throw new Error(`Leave type ID ${ltId} not found`);

  const res = await dbRun(`
    INSERT INTO leave_requests (
      user_id, leave_type_id, start_date, end_date, days_requested, day_type, reason, emergency_contact,
      qualifying_date, compensatory_source_type, status, org_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `, [uId, ltId, startDate, endDate, days, dType, rsn, contact, qDate, cSource, targetOrg]);

  return getLeaveRequestById(res.lastID);
}

// Get Leave Request by ID
async function getLeaveRequestById(id) {
  const reqId = parseInt(id, 10);
  return dbGet(`
    SELECT 
      r.*,
      e.name as employee_name,
      e.department as employee_department,
      e.role as employee_role,
      e.employee_service_id,
      e.employment_status,
      e.photo as employee_photo,
      t.name as leave_type_name,
      t.code as leave_type_code,
      t.color as leave_type_color,
      t.is_paid as leave_type_is_paid,
      COALESCE(t.is_duty_leave, 0) as is_duty_leave,
      COALESCE(t.is_compensatory_leave, 0) as is_compensatory_leave,
      c.name as category_name
    FROM leave_requests r
    LEFT JOIN employees e ON r.user_id = e.user_id
    LEFT JOIN leave_types t ON r.leave_type_id = t.id
    LEFT JOIN leave_categories c ON t.category_id = c.id
    WHERE r.id = ?
  `, [reqId]);
}

// Get Leave Requests with filters
async function getLeaveRequests({ orgId, status, userId, department, year, search, limit = 100, offset = 0 } = {}) {
  let sql = `
    SELECT 
      r.*,
      e.name as employee_name,
      e.department as employee_department,
      e.role as employee_role,
      e.employee_service_id,
      e.employment_status,
      e.photo as employee_photo,
      t.name as leave_type_name,
      t.code as leave_type_code,
      t.color as leave_type_color,
      t.is_paid as leave_type_is_paid,
      COALESCE(t.is_duty_leave, 0) as is_duty_leave,
      COALESCE(t.is_compensatory_leave, 0) as is_compensatory_leave,
      c.name as category_name
    FROM leave_requests r
    LEFT JOIN employees e ON r.user_id = e.user_id
    LEFT JOIN leave_types t ON r.leave_type_id = t.id
    LEFT JOIN leave_categories c ON t.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (orgId && orgId !== 'ALL') {
    sql += ` AND (UPPER(r.org_id) = ? OR r.org_id IS NULL)`;
    params.push(String(orgId).trim().toUpperCase());
  }

  if (status && status !== 'ALL') {
    sql += ` AND UPPER(r.status) = ?`;
    params.push(String(status).trim().toUpperCase());
  }

  if (userId) {
    sql += ` AND r.user_id = ?`;
    params.push(String(userId).trim());
  }

  if (department && department !== 'all') {
    sql += ` AND e.department = ?`;
    params.push(department);
  }

  if (year) {
    sql += ` AND (strftime('%Y', r.start_date) = ? OR strftime('%Y', r.end_date) = ?)`;
    params.push(String(year), String(year));
  }

  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    sql += ` AND (
      LOWER(COALESCE(e.name, '')) LIKE ? OR 
      LOWER(r.user_id) LIKE ? OR 
      LOWER(COALESCE(e.employee_service_id, '')) LIKE ? OR
      LOWER(COALESCE(r.reason, '')) LIKE ? OR
      LOWER(COALESCE(t.name, '')) LIKE ?
    )`;
    params.push(term, term, term, term, term);
  }

  sql += ` ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit, 10) || 100, parseInt(offset, 10) || 0);

  return dbAll(sql, params);
}

// Get Leave Request KPI Statistics
async function getLeaveRequestStats(orgId, year) {
  const yr = String(year || new Date().getFullYear());
  const targetOrg = orgId && orgId !== 'ALL' ? String(orgId).trim().toUpperCase() : null;

  let baseSql = `FROM leave_requests WHERE (strftime('%Y', start_date) = ? OR strftime('%Y', end_date) = ?)`;
  const params = [yr, yr];
  if (targetOrg) {
    baseSql += ` AND (UPPER(org_id) = ? OR org_id IS NULL)`;
    params.push(targetOrg);
  }

  const pending = await dbGet(`SELECT COUNT(*) as count ${baseSql} AND status = 'PENDING'`, params);
  const approved = await dbGet(`SELECT COUNT(*) as count, COALESCE(SUM(days_requested), 0) as total_days ${baseSql} AND status = 'APPROVED'`, params);
  const rejected = await dbGet(`SELECT COUNT(*) as count ${baseSql} AND status = 'REJECTED'`, params);
  const cancelled = await dbGet(`SELECT COUNT(*) as count ${baseSql} AND status = 'CANCELLED'`, params);
  const total = await dbGet(`SELECT COUNT(*) as count ${baseSql}`, params);

  const todayStr = new Date().toISOString().slice(0, 10);
  let todaySql = `SELECT COUNT(DISTINCT user_id) as count FROM leave_requests WHERE status = 'APPROVED' AND start_date <= ? AND end_date >= ?`;
  const todayParams = [todayStr, todayStr];
  if (targetOrg) {
    todaySql += ` AND (UPPER(org_id) = ? OR org_id IS NULL)`;
    todayParams.push(targetOrg);
  }
  const todayOnLeave = await dbGet(todaySql, todayParams);

  return {
    year: parseInt(yr, 10),
    pending: pending?.count || 0,
    approved: approved?.count || 0,
    approvedDays: approved?.total_days || 0,
    rejected: rejected?.count || 0,
    cancelled: cancelled?.count || 0,
    total: total?.count || 0,
    todayOnLeave: todayOnLeave?.count || 0
  };
}

// Update Leave Request Status (Admin / Manager Approve, Reject, Cancel)
// Deducts from / restores employee_leave_balances automatically!
async function updateLeaveRequestStatus({ id, status, actionBy, actionRemarks = '', orgId }) {
  const reqId = parseInt(id, 10);
  const newStatus = String(status).trim().toUpperCase();
  if (!['APPROVED', 'REJECTED', 'CANCELLED', 'PENDING'].includes(newStatus)) {
    throw new Error(`Invalid status "${status}". Allowed: APPROVED, REJECTED, CANCELLED, PENDING`);
  }

  const existing = await getLeaveRequestById(reqId);
  if (!existing) throw new Error(`Leave request #${reqId} not found`);

  const prevStatus = existing.status;
  const targetOrg = (orgId || existing.org_id || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const reqYear = parseInt((existing.start_date || '').substring(0, 4), 10) || new Date().getFullYear();
  const days = parseFloat(existing.days_requested) || 0;

  // Check if this is a Duty Leave or Compensatory Leave (which has no quota and does not count as leave)
  const reqLeaveType = await dbGet(`SELECT id, is_duty_leave, is_compensatory_leave, code FROM leave_types WHERE id = ?`, [existing.leave_type_id]);
  const isDutyLeave = reqLeaveType?.is_duty_leave === 1 || (reqLeaveType?.code && reqLeaveType.code.toUpperCase() === 'DUTY');
  const isCompLeave = reqLeaveType?.is_compensatory_leave === 1 || (reqLeaveType?.code && reqLeaveType.code.toUpperCase() === 'COMP');
  const isQuotaExempt = isDutyLeave || isCompLeave;

  // If transitioning to APPROVED: deduct from employee leave balances (unless Duty / Compensatory Leave)
  if (newStatus === 'APPROVED' && prevStatus !== 'APPROVED' && !isQuotaExempt) {
    let bal = await dbGet(`
      SELECT * FROM employee_leave_balances 
      WHERE user_id = ? AND leave_type_id = ? AND year = ?
    `, [existing.user_id, existing.leave_type_id, reqYear]);

    if (!bal) {
      const emp = await dbGet(`SELECT leave_category_id FROM employees WHERE user_id = ?`, [existing.user_id]);
      const catId = emp?.leave_category_id || 1;
      await initializeEmployeeLeaveBalances(existing.user_id, catId, reqYear, targetOrg);
      bal = await dbGet(`
        SELECT * FROM employee_leave_balances 
        WHERE user_id = ? AND leave_type_id = ? AND year = ?
      `, [existing.user_id, existing.leave_type_id, reqYear]);
    }

    if (bal) {
      const curUsed = parseFloat(bal.used_days) || 0;
      const alloc = parseFloat(bal.allocated_days) || 0;
      const cf = parseFloat(bal.carried_forward_days) || 0;
      const updatedUsed = curUsed + days;
      const updatedRemaining = Math.max(0, (alloc + cf) - updatedUsed);

      await dbRun(`
        UPDATE employee_leave_balances SET
          used_days = ?, remaining_days = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updatedUsed, updatedRemaining, bal.id]);
    }
  }

  // If transitioning FROM APPROVED to REJECTED or CANCELLED or PENDING: restore days (unless Duty / Compensatory Leave)
  if (prevStatus === 'APPROVED' && newStatus !== 'APPROVED' && !isQuotaExempt) {
    const bal = await dbGet(`
      SELECT * FROM employee_leave_balances 
      WHERE user_id = ? AND leave_type_id = ? AND year = ?
    `, [existing.user_id, existing.leave_type_id, reqYear]);

    if (bal) {
      const curUsed = parseFloat(bal.used_days) || 0;
      const alloc = parseFloat(bal.allocated_days) || 0;
      const cf = parseFloat(bal.carried_forward_days) || 0;
      const updatedUsed = Math.max(0, curUsed - days);
      const updatedRemaining = Math.max(0, (alloc + cf) - updatedUsed);

      await dbRun(`
        UPDATE employee_leave_balances SET
          used_days = ?, remaining_days = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updatedUsed, updatedRemaining, bal.id]);
    }
  }

  await dbRun(`
    UPDATE leave_requests SET
      status = ?,
      action_by = ?,
      action_at = CURRENT_TIMESTAMP,
      action_remarks = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newStatus, actionBy || 'Authorized Manager', actionRemarks, reqId]);

  return getLeaveRequestById(reqId);
}

// Delete Leave Request
async function deleteLeaveRequest(id) {
  const reqId = parseInt(id, 10);
  const existing = await getLeaveRequestById(reqId);
  if (!existing) return false;

  // If was approved, restore days before deletion
  if (existing.status === 'APPROVED') {
    const reqYear = parseInt((existing.start_date || '').substring(0, 4), 10) || new Date().getFullYear();
    const days = parseFloat(existing.days_requested) || 0;
    const bal = await dbGet(`
      SELECT * FROM employee_leave_balances 
      WHERE user_id = ? AND leave_type_id = ? AND year = ?
    `, [existing.user_id, existing.leave_type_id, reqYear]);

    if (bal) {
      const curUsed = parseFloat(bal.used_days) || 0;
      const alloc = parseFloat(bal.allocated_days) || 0;
      const cf = parseFloat(bal.carried_forward_days) || 0;
      const updatedUsed = Math.max(0, curUsed - days);
      const updatedRemaining = Math.max(0, (alloc + cf) - updatedUsed);

      await dbRun(`
        UPDATE employee_leave_balances SET
          used_days = ?, remaining_days = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updatedUsed, updatedRemaining, bal.id]);
    }
  }

  await dbRun(`DELETE FROM leave_requests WHERE id = ?`, [reqId]);
  return true;
}

// ============================================================================
// ATTENDANCE LOG SCAN & AUTO LEAVE DEDUCTION ENGINE
// ============================================================================

/**
 * Calculates leave deductions and no-pay leaves for an employee based on attendance logs
 * after a specified cutoff date (baseline carried-forward till date).
 *
 * Workflow:
 * 1. Up to cutoffDate: Previous Carried-Forward balance is treated as fixed/set.
 * 2. After cutoffDate: Scans each day up to today/year-end.
 * 3. If absent on a working day:
 *    a) If approved leave request exists for that date: deduct from requested leave type.
 *    b) If unrequested: auto-reduce in order of policy deduction_priority (Casual -> Medical -> etc.).
 *    c) If all eligible paid leaves exhausted: record as No-Pay Leave.
 */
async function calculateAttendanceLeavesForEmployee({ userId, year, cutoffDate, orgId, persist = false }) {
  const { getDayClassification } = require('./shiftEngine');
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  // 1. Get employee & shift details
  const emp = await dbGet(`
    SELECT e.*, s.work_days, s.start_time, s.end_time, s.color as shift_color,
           COALESCE(e.leave_category_id, 1) as leave_cat_id
    FROM employees e
    LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
    WHERE e.user_id = ?
  `, [userId]);

  if (!emp) throw new Error(`Employee #${userId} not found`);

  // 2. Determine effective cutoff date (till date)
  let effectiveCutoff = cutoffDate;
  if (!effectiveCutoff) {
    const existingBal = await dbGet(
      `SELECT carried_fwd_cutoff_date FROM employee_leave_balances WHERE user_id = ? AND year = ? AND carried_fwd_cutoff_date IS NOT NULL LIMIT 1`,
      [userId, yr]
    );
    if (existingBal?.carried_fwd_cutoff_date) {
      effectiveCutoff = existingBal.carried_fwd_cutoff_date;
    } else {
      effectiveCutoff = `${yr}-01-01`;
    }
  }

  // Helper for safe YYYY-MM-DD date formatting without timezone shifts
  const formatLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 3. Date range to scan attendance logs: from day after cutoff till today (or year end)
  const cutoffDt = new Date(effectiveCutoff + 'T00:00:00');
  const startDt = new Date(cutoffDt);
  startDt.setDate(startDt.getDate() + 1);
  const startDate = formatLocalDate(startDt);

  const todayStr = formatLocalDate(new Date());
  const maxYearDate = `${yr}-12-31`;
  const endDate = todayStr < maxYearDate ? todayStr : maxYearDate;

  // 4. Fetch holidays
  const holidays = await dbAll(`
    SELECT * FROM holidays 
    WHERE (UPPER(org_id) = ? OR org_id = 'DEFAULT' OR org_id IS NULL)
  `, [targetOrg]);

  // 5. Fetch configured leave types for employee's category, ordered by deduction priority
  const leaveTypes = await dbAll(`
    SELECT * FROM leave_types 
    WHERE category_id = ? 
    ORDER BY COALESCE(deduction_priority, 99) ASC, id ASC
  `, [emp.leave_cat_id]);

  // 6. Fetch employee balances for this year
  const balances = await dbAll(`
    SELECT * FROM employee_leave_balances WHERE user_id = ? AND year = ?
  `, [userId, yr]);

  const balanceMap = {};
  balances.forEach(b => { balanceMap[b.leave_type_id] = b; });

  // Initialize available pool per leave type
  const pools = {};
  const usedByRequest = {};
  const usedByAuto = {};
  const typeMeta = {};

  leaveTypes.forEach(t => {
    const b = balanceMap[t.id];
    const alloc = parseFloat(b?.allocated_days ?? t.days_allowed ?? 0);
    const cf = parseFloat(b?.carried_forward_days ?? 0);
    pools[t.id] = alloc + cf;
    usedByRequest[t.id] = 0.0;
    usedByAuto[t.id] = 0.0;
    typeMeta[t.id] = t;
  });

  // 7. If startDate > endDate, cutoff is today or in future -> 0 deductions after cutoff
  if (startDate > endDate) {
    const defaultBalances = leaveTypes.map(t => {
      const b = balanceMap[t.id];
      const alloc = parseFloat(b?.allocated_days ?? t.days_allowed ?? 0);
      const cf = parseFloat(b?.carried_forward_days ?? 0);
      return {
        leave_type_id: t.id,
        leave_type_name: t.name,
        leave_type_code: t.code,
        leave_type_color: t.color || '#2563eb',
        deduction_priority: t.deduction_priority || 1,
        enable_auto_deduct: t.enable_auto_deduct !== 0 ? 1 : 0,
        is_duty_leave: t.is_duty_leave ? 1 : 0,
        allocated_days: alloc,
        carried_forward_days: cf,
        request_deducted_days: 0,
        auto_deducted_days: 0,
        used_days: 0,
        remaining_days: alloc + cf,
        no_pay_days: 0,
        carried_fwd_cutoff_date: effectiveCutoff,
        notes: b?.notes || ''
      };
    });

    return {
      success: true,
      userId,
      employeeName: emp.name,
      year: yr,
      cutoffDate: effectiveCutoff,
      startDate,
      endDate,
      totalWorkingDays: 0,
      totalPresentDays: 0,
      totalAbsentDays: 0,
      noPayDays: 0,
      absentLog: [],
      balances: defaultBalances
    };
  }

  // 8. Fetch distinct punch dates for this employee between startDate and endDate
  const punchRows = await dbAll(`
    SELECT DISTINCT DATE(punch_time) as pdate
    FROM attendance_records
    WHERE user_id = ? AND punch_time >= ? AND punch_time <= ?
  `, [userId, `${startDate} 00:00:00`, `${endDate} 23:59:59`]);

  const punchDatesSet = new Set(punchRows.map(r => r.pdate));

  // 9. Fetch approved leave requests overlapping [startDate, endDate]
  const requests = await dbAll(`
    SELECT r.*, t.name as leave_type_name, t.code as leave_type_code,
           COALESCE(t.is_duty_leave, 0) as type_is_duty_leave,
           COALESCE(t.is_compensatory_leave, 0) as type_is_compensatory_leave
    FROM leave_requests r
    LEFT JOIN leave_types t ON r.leave_type_id = t.id
    WHERE r.user_id = ? AND r.status = 'APPROVED'
      AND r.start_date <= ? AND r.end_date >= ?
  `, [userId, endDate, startDate]);

  // 10. Day-by-day iteration
  const absentLog = [];
  let totalWorkingDays = 0;
  let totalPresentDays = 0;
  let noPayDays = 0.0;

  const cur = new Date(startDate + 'T00:00:00');
  const stop = new Date(endDate + 'T00:00:00');

  while (cur <= stop) {
    const curDateStr = formatLocalDate(cur);
    const dayClass = getDayClassification(curDateStr, emp, holidays);

    if (dayClass.isWorkingDay) {
      totalWorkingDays++;

      if (punchDatesSet.has(curDateStr)) {
        totalPresentDays++;
      } else {
        // Employee is ABSENT on a scheduled working day!
        // Check if there is an approved leave request for this date
        const matchedReq = requests.find(r => r.start_date <= curDateStr && r.end_date >= curDateStr);

        if (matchedReq) {
          const reqTypeId = matchedReq.leave_type_id;
          const reqType = typeMeta[reqTypeId] || {
            name: matchedReq.leave_type_name || 'Requested Leave',
            code: matchedReq.leave_type_code || 'REQ',
            is_duty_leave: matchedReq.type_is_duty_leave || 0,
            is_compensatory_leave: matchedReq.type_is_compensatory_leave || 0
          };
          const deductAmount = (matchedReq.day_type === 'FIRST_HALF' || matchedReq.day_type === 'SECOND_HALF') ? 0.5 : 1.0;
          const isDuty = Boolean(reqType.is_duty_leave || matchedReq.type_is_duty_leave) ||
                         (reqType.code && reqType.code.toUpperCase() === 'DUTY') ||
                         (matchedReq.leave_type_code && matchedReq.leave_type_code.toUpperCase() === 'DUTY');
          const isComp = Boolean(reqType.is_compensatory_leave || matchedReq.type_is_compensatory_leave) ||
                         (reqType.code && reqType.code.toUpperCase() === 'COMP') ||
                         (matchedReq.leave_type_code && matchedReq.leave_type_code.toUpperCase() === 'COMP');

          if (isDuty) {
            // Duty leave: If it is requested and approved, it is NOT counted as leave (Official Duty)
            absentLog.push({
              date: curDateStr,
              dayName: dayClass.name,
              status: 'ABSENT',
              resolution: 'DUTY_APPROVED',
              leaveTypeId: reqTypeId,
              leaveTypeName: reqType.name,
              leaveTypeCode: reqType.code,
              deductedDays: 0,
              isApprovedRequest: true,
              isDutyLeave: true,
              notes: `Approved Duty Leave #${matchedReq.id}: ${matchedReq.reason || 'Official Duty (Not counted as leave)'}`
            });
            // Do NOT deduct from pools, do NOT add to usedByRequest!
          } else if (isComp) {
            // Compensatory leave: If it is requested and approved, it is NOT counted against annual quota (Earned Comp-Off)
            const refText = matchedReq.qualifying_date ? ` (Ref: ${matchedReq.qualifying_date})` : '';
            absentLog.push({
              date: curDateStr,
              dayName: dayClass.name,
              status: 'ABSENT',
              resolution: 'COMPENSATORY_APPROVED',
              leaveTypeId: reqTypeId,
              leaveTypeName: reqType.name,
              leaveTypeCode: reqType.code,
              deductedDays: 0,
              isApprovedRequest: true,
              isCompensatoryLeave: true,
              qualifyingDate: matchedReq.qualifying_date,
              notes: `Approved Compensatory Leave #${matchedReq.id}${refText}: ${matchedReq.reason || 'Compensatory Leave (0 quota deducted)'}`
            });
            // Do NOT deduct from pools, do NOT add to usedByRequest!
          } else {
            usedByRequest[reqTypeId] = (usedByRequest[reqTypeId] || 0) + deductAmount;
            pools[reqTypeId] = (pools[reqTypeId] || 0) - deductAmount;

            absentLog.push({
              date: curDateStr,
              dayName: dayClass.name,
              status: 'ABSENT',
              resolution: 'APPROVED_REQUEST',
              leaveTypeId: reqTypeId,
              leaveTypeName: reqType.name,
              leaveTypeCode: reqType.code,
              deductedDays: deductAmount,
              isApprovedRequest: true,
              notes: `Approved Request #${matchedReq.id}: ${matchedReq.reason || reqType.name}`
            });
          }
        } else {
          // Unrequested absence: Auto-deduct by priority order!
          // Find first leave type in priority list that has pool > 0 and enable_auto_deduct != 0
          let deductedType = null;
          for (const t of leaveTypes) {
            if (t.enable_auto_deduct !== 0 && (pools[t.id] || 0) >= 1.0) {
              deductedType = t;
              break;
            }
          }

          if (deductedType) {
            usedByAuto[deductedType.id] = (usedByAuto[deductedType.id] || 0) + 1.0;
            pools[deductedType.id] = (pools[deductedType.id] || 0) - 1.0;

            absentLog.push({
              date: curDateStr,
              dayName: dayClass.name,
              status: 'ABSENT',
              resolution: 'AUTO_DEDUCTED',
              leaveTypeId: deductedType.id,
              leaveTypeName: deductedType.name,
              leaveTypeCode: deductedType.code,
              priority: deductedType.deduction_priority || 1,
              deductedDays: 1.0,
              notes: `Auto-deducted from ${deductedType.name} (Priority ${deductedType.deduction_priority || 1})`
            });
          } else {
            // All eligible leave balances are exhausted! Count as No-Pay / Unpaid Leave!
            noPayDays += 1.0;
            absentLog.push({
              date: curDateStr,
              dayName: dayClass.name,
              status: 'ABSENT',
              resolution: 'NO_PAY',
              leaveTypeId: null,
              leaveTypeName: 'No-Pay Leave',
              leaveTypeCode: 'NOPAY',
              deductedDays: 1.0,
              notes: 'All paid leave quotas exhausted (No-Pay / Unpaid Absence)'
            });
          }
        }
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  // 11. Compile final balance summaries per leave type
  const calculatedBalances = leaveTypes.map(t => {
    const b = balanceMap[t.id];
    const alloc = parseFloat(b?.allocated_days ?? t.days_allowed ?? 0);
    const cf = parseFloat(b?.carried_forward_days ?? 0);
    const reqDed = usedByRequest[t.id] || 0.0;
    const autoDed = usedByAuto[t.id] || 0.0;
    const totalUsed = reqDed + autoDed;
    const remaining = Math.max(0, (alloc + cf) - totalUsed);

    return {
      leave_type_id: t.id,
      leave_type_name: t.name,
      leave_type_code: t.code,
      leave_type_color: t.color || '#2563eb',
      deduction_priority: t.deduction_priority || 1,
      enable_auto_deduct: t.enable_auto_deduct !== 0 ? 1 : 0,
      is_duty_leave: t.is_duty_leave ? 1 : 0,
      allocated_days: alloc,
      carried_forward_days: cf,
      request_deducted_days: reqDed,
      auto_deducted_days: autoDed,
      used_days: totalUsed,
      remaining_days: remaining,
      no_pay_days: noPayDays,
      carried_fwd_cutoff_date: effectiveCutoff,
      notes: b?.notes || ''
    };
  });

  // 12. If persist requested, save directly into employee_leave_balances
  if (persist) {
    for (const cb of calculatedBalances) {
      await saveEmployeeLeaveBalance({
        userId,
        leaveTypeId: cb.leave_type_id,
        year: yr,
        allocatedDays: cb.allocated_days,
        carriedForwardDays: cb.carried_forward_days,
        usedDays: cb.used_days,
        remainingDays: cb.remaining_days,
        notes: cb.notes,
        orgId: targetOrg,
        carriedFwdCutoffDate: effectiveCutoff,
        noPayDays: noPayDays,
        autoDeductedDays: cb.auto_deducted_days,
        requestDeductedDays: cb.request_deducted_days
      });
    }
  }

  return {
    success: true,
    userId,
    employeeName: emp.name,
    year: yr,
    cutoffDate: effectiveCutoff,
    startDate,
    endDate,
    totalWorkingDays,
    totalPresentDays,
    totalAbsentDays: absentLog.length,
    noPayDays,
    balances: calculatedBalances,
    absentLog
  };
}

/**
 * Batch calculate attendance-based leave deductions for all employees in an organization
 */
async function calculateAllEmployeesAttendanceLeaves({ year, defaultCutoffDate, orgId, persist = true }) {
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  const emps = await dbAll(`
    SELECT user_id, name, department, leave_category_id, org_id FROM employees
    WHERE (UPPER(org_id) = ? OR org_id IS NULL OR org_id = '') AND COALESCE(is_active, 1) = 1
    ORDER BY CAST(user_id AS INTEGER) ASC
  `, [targetOrg]);

  const results = [];
  for (const emp of emps) {
    try {
      const res = await calculateAttendanceLeavesForEmployee({
        userId: emp.user_id,
        year: yr,
        cutoffDate: defaultCutoffDate,
        orgId: targetOrg,
        persist
      });
      results.push(res);
    } catch (e) {
      console.warn(`[LEAVE-ATTENDANCE] Error calculating User #${emp.user_id}:`, e.message);
    }
  }

  return {
    success: true,
    year: yr,
    processedCount: results.length,
    defaultCutoffDate,
    resultsSummary: results.map(r => ({
      userId: r.userId,
      employeeName: r.employeeName,
      totalAbsentDays: r.totalAbsentDays,
      noPayDays: r.noPayDays
    }))
  };
}

/**
 * Get eligible qualifying dates for Compensatory Leave (worked off-days and approved duty leaves)
 */
async function getCompensatoryEligibleDates({ userId, year, orgId }) {
  const { getDayClassification } = require('./shiftEngine');
  const uId = String(userId).trim();
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const targetOrg = (orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  // 1. Get employee & shift details
  const emp = await dbGet(`
    SELECT e.*, s.work_days, s.start_time, s.end_time, s.color as shift_color,
           COALESCE(e.leave_category_id, 1) as leave_cat_id
    FROM employees e
    LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
    WHERE e.user_id = ?
  `, [uId]);
  if (!emp) throw new Error(`Employee #${uId} not found`);

  // 2. Holidays for organization
  const holidays = await dbAll(`
    SELECT * FROM holidays 
    WHERE (UPPER(org_id) = ? OR org_id = 'DEFAULT' OR org_id IS NULL)
  `, [targetOrg]);

  // 3. Fetch attendance punch dates for user in year
  const punches = await dbAll(`
    SELECT DATE(punch_time) as pdate,
           MIN(TIME(punch_time)) as first_punch,
           MAX(TIME(punch_time)) as last_punch,
           COUNT(*) as punch_count
    FROM attendance_records
    WHERE user_id = ? AND punch_time >= ? AND punch_time <= ?
    GROUP BY DATE(punch_time)
    ORDER BY pdate DESC
  `, [uId, `${yr}-01-01 00:00:00`, `${yr}-12-31 23:59:59`]);

  const punchMap = {};
  punches.forEach(p => {
    punchMap[p.pdate] = p;
  });

  // 4. Fetch approved Duty Leave requests for user in year
  const dutyRequests = await dbAll(`
    SELECT r.id, r.start_date, r.end_date, r.days_requested, r.reason,
           t.name as leave_type_name, t.code as leave_type_code
    FROM leave_requests r
    JOIN leave_types t ON r.leave_type_id = t.id
    WHERE r.user_id = ? AND UPPER(r.status) = 'APPROVED'
      AND (t.is_duty_leave = 1 OR UPPER(t.code) IN ('DUTY', 'DL') OR LOWER(t.name) LIKE '%duty%')
      AND r.start_date >= ? AND r.start_date <= ?
    ORDER BY r.start_date DESC
  `, [uId, `${yr}-01-01`, `${yr}-12-31`]);

  // 5. Fetch already claimed qualifying dates from existing Compensatory requests
  const existingClaims = await dbAll(`
    SELECT r.id, r.status, r.qualifying_date, r.start_date, r.reason
    FROM leave_requests r
    JOIN leave_types t ON r.leave_type_id = t.id
    WHERE r.user_id = ? AND r.status NOT IN ('REJECTED', 'CANCELLED')
      AND r.qualifying_date IS NOT NULL
      AND (t.is_compensatory_leave = 1 OR UPPER(t.code) IN ('COMP', 'CL') OR LOWER(t.name) LIKE '%compensatory%')
  `, [uId]);

  const claimedMap = {};
  existingClaims.forEach(c => {
    claimedMap[c.qualifying_date] = c;
  });

  const dateMap = {};

  // (A) Process Worked Off-Days (punches recorded on scheduled off-days, weekends, or holidays)
  for (const p of punches) {
    const dayClass = getDayClassification(p.pdate, emp, holidays);
    const isOffDay = !dayClass.isWorkingDay;
    if (!isOffDay) continue; // Regular workdays do not qualify for compensatory leave

    const isClaimed = Boolean(claimedMap[p.pdate]);
    const claimInfo = claimedMap[p.pdate];
    const offDayLabel = dayClass.label || dayClass.name;

    dateMap[p.pdate] = {
      date: p.pdate,
      dayName: dayClass.name,
      dayClassType: dayClass.type,
      dayLabel: offDayLabel,
      isOffDay: true,
      hasPunches: true,
      punchCount: p.punch_count,
      punchSummary: `${p.punch_count} punches (${p.first_punch?.substring(0, 5) || ''} to ${p.last_punch?.substring(0, 5) || ''})`,
      firstPunch: p.first_punch,
      lastPunch: p.last_punch,
      hasDutyLeave: false,
      dutyRequestId: null,
      dutyReason: null,
      sourceType: 'WORKED_OFF_DAY',
      label: `Worked ${offDayLabel} (${p.first_punch?.substring(0, 5) || ''} - ${p.last_punch?.substring(0, 5) || ''}, ${p.punch_count} punches)`,
      isClaimed,
      claimedRequestId: claimInfo?.id || null,
      claimedStatus: claimInfo?.status || null
    };
  }

  // (B) Process Approved Duty Leave dates (especially those on scheduled off-days/weekends/holidays)
  for (const dr of dutyRequests) {
    if (!dr.start_date) continue;
    const [sY, sM, sD] = dr.start_date.split('-').map(Number);
    const [eY, eM, eD] = (dr.end_date || dr.start_date).split('-').map(Number);
    const cur = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);

    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dStr = `${y}-${m}-${d}`;

      const dayClass = getDayClassification(dStr, emp, holidays);
      const isOffDay = !dayClass.isWorkingDay;
      const punch = punchMap[dStr];
      const hasPunches = Boolean(punch);
      const isClaimed = Boolean(claimedMap[dStr]);
      const claimInfo = claimedMap[dStr];
      const offDayLabel = dayClass.label || dayClass.name;

      let sourceType = 'DUTY_LEAVE';
      let label = '';

      if (isOffDay && hasPunches) {
        sourceType = 'DUTY_WORKED_OFF_DAY';
        label = `Approved Duty on ${offDayLabel} (#${dr.id}: ${dr.reason || 'Official Duty'}) • Worked (${punch.first_punch?.substring(0, 5) || ''} - ${punch.last_punch?.substring(0, 5) || ''}, ${punch.punch_count} punches)`;
      } else if (isOffDay) {
        sourceType = 'DUTY_OFF_DAY';
        label = `Approved Duty on ${offDayLabel} (#${dr.id}: ${dr.reason || 'Official Duty'})`;
      } else if (hasPunches) {
        sourceType = 'DUTY_LEAVE';
        label = `Approved Duty Leave #${dr.id} (${dayClass.name}): ${dr.reason || 'Official Duty'} • Worked (${punch.first_punch?.substring(0, 5) || ''} - ${punch.last_punch?.substring(0, 5) || ''})`;
      } else {
        sourceType = 'DUTY_LEAVE';
        label = `Approved Duty Leave #${dr.id} (${dayClass.name}): ${dr.reason || 'Official Duty'}`;
      }

      dateMap[dStr] = {
        date: dStr,
        dayName: dayClass.name,
        dayClassType: dayClass.type,
        dayLabel: offDayLabel,
        isOffDay,
        hasPunches,
        punchCount: punch ? punch.punch_count : 0,
        punchSummary: punch 
          ? `${punch.punch_count} punches (${punch.first_punch?.substring(0, 5) || ''} to ${punch.last_punch?.substring(0, 5) || ''})`
          : 'Official Duty Authorized (No punches)',
        firstPunch: punch ? punch.first_punch : null,
        lastPunch: punch ? punch.last_punch : null,
        hasDutyLeave: true,
        dutyRequestId: dr.id,
        dutyReason: dr.reason,
        sourceType,
        label,
        isClaimed,
        claimedRequestId: claimInfo?.id || null,
        claimedStatus: claimInfo?.status || null
      };

      cur.setDate(cur.getDate() + 1);
    }
  }

  const eligibleDates = Object.values(dateMap);

  // Sorting:
  // 1. Unclaimed first (claimed at bottom)
  // 2. Off-day duties (DUTY_WORKED_OFF_DAY, DUTY_OFF_DAY) rank 1
  //    Worked off-day punches (WORKED_OFF_DAY) rank 2
  //    Other duty leaves (DUTY_LEAVE) rank 3
  // 3. Date descending (newest dates first)
  const getRank = (item) => {
    if (item.sourceType === 'DUTY_WORKED_OFF_DAY' || item.sourceType === 'DUTY_OFF_DAY') return 1;
    if (item.sourceType === 'WORKED_OFF_DAY') return 2;
    if (item.sourceType === 'DUTY_LEAVE') return 3;
    return 4;
  };

  eligibleDates.sort((a, b) => {
    if (a.isClaimed !== b.isClaimed) return a.isClaimed ? 1 : -1;
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return b.date.localeCompare(a.date);
  });

  return {
    success: true,
    userId: uId,
    year: yr,
    employeeName: emp.name,
    totalEligible: eligibleDates.length,
    eligibleDates
  };
}



/**
 * Upsert full employee profiles downloaded from Cloud Firestore into local SQLite
 */
async function upsertEmployeesFromCloud(employeesList = [], targetOrgId = 'DSOFFICE_LUNUGAMWEHERA') {
  if (!employeesList || employeesList.length === 0) return { inserted: 0, total: 0 };
  const org = (targetOrgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT INTO employees (
          user_id, name, department, role, employee_service_id, card_no,
          email, phone, nic, gender, birthday, appointment_date,
          employment_status, is_active, leave_category_id, photo, org_id,
          synced_to_cloud, cloud_synced_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          name = CASE WHEN excluded.name IS NOT NULL AND excluded.name != '' THEN excluded.name ELSE employees.name END,
          department = COALESCE(excluded.department, employees.department),
          role = COALESCE(excluded.role, employees.role),
          employee_service_id = COALESCE(excluded.employee_service_id, employees.employee_service_id),
          card_no = COALESCE(excluded.card_no, employees.card_no),
          email = COALESCE(excluded.email, employees.email),
          phone = COALESCE(excluded.phone, employees.phone),
          nic = COALESCE(excluded.nic, employees.nic),
          gender = COALESCE(excluded.gender, employees.gender),
          birthday = COALESCE(excluded.birthday, employees.birthday),
          appointment_date = COALESCE(excluded.appointment_date, employees.appointment_date),
          employment_status = COALESCE(excluded.employment_status, employees.employment_status),
          is_active = excluded.is_active,
          leave_category_id = COALESCE(excluded.leave_category_id, employees.leave_category_id),
          photo = COALESCE(excluded.photo, employees.photo),
          org_id = excluded.org_id,
          synced_to_cloud = 1,
          cloud_synced_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `);

      let count = 0;
      for (const e of employeesList) {
        const uid = String(e.userId || e.user_id || e.rawUserId || '').trim();
        if (!uid) continue;
        const name = (e.name || e.employeeName || '').trim();
        const dept = e.department || 'General';
        const role = e.role || 'Staff';
        const serviceId = e.employeeServiceId || e.employee_service_id || '';
        const cardNo = e.cardNo || e.card_no || '';
        const email = e.email || '';
        const phone = e.phone || '';
        const nic = e.nic || '';
        const gender = e.gender || '';
        const bday = e.birthday || '';
        const appDate = e.appointmentDate || e.appointment_date || '';
        const empStatus = e.employmentStatus || e.employment_status || 'Active';
        const isActive = (e.isActive !== undefined ? (e.isActive ? 1 : 0) : (e.is_active !== undefined ? e.is_active : 1));
        const leaveCatId = parseInt(e.leaveCategoryId || e.leave_category_id, 10) || 1;
        const photo = e.photoUrl || e.photo || null;
        const empOrg = (e.organizationId || e.org_id || org).trim().toUpperCase();

        stmt.run(
          uid, name, dept, role, serviceId, cardNo,
          email, phone, nic, gender, bday, appDate,
          empStatus, isActive, leaveCatId, photo, empOrg,
          function (err) {
            if (!err) count++;
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
          resolve({ inserted: count, total: employeesList.length });
        });
      });
    });
  });
}

/**
 * Upsert system users downloaded from Cloud Firestore into local SQLite
 */
async function upsertSystemUsersFromCloud(usersList = [], targetOrgId = 'DSOFFICE_LUNUGAMWEHERA') {
  if (!usersList || usersList.length === 0) return { inserted: 0, total: 0 };
  const org = (targetOrgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  let count = 0;
  for (const u of usersList) {
    const uid = String(u.uid || u.id || '').trim();
    if (!uid) continue;
    const username = (u.username || '').trim() || uid;
    const email = (u.email || '').trim().toLowerCase();
    const displayName = (u.displayName || u.display_name || username).trim();
    const role = (u.role || 'staff').toLowerCase();
    const pwdHash = u.passwordHash || u.password_hash || '';
    const userOrg = (u.organizationId || u.org_id || org).trim().toUpperCase();
    const isActive = u.isActive !== undefined ? (u.isActive ? 1 : 0) : (u.is_active !== undefined ? u.is_active : 1);

    await dbRun(`
      INSERT INTO system_users (
        uid, username, email, display_name, role, password_hash, org_id, is_active,
        synced_to_cloud, cloud_synced_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(uid) DO UPDATE SET
        username = excluded.username,
        email = excluded.email,
        display_name = excluded.display_name,
        role = excluded.role,
        password_hash = CASE WHEN excluded.password_hash != '' THEN excluded.password_hash ELSE system_users.password_hash END,
        org_id = excluded.org_id,
        is_active = excluded.is_active,
        synced_to_cloud = 1,
        cloud_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [uid, username, email, displayName, role, pwdHash, userOrg, isActive]);
    count++;
  }
  return { inserted: count, total: usersList.length };
}

/**
 * Upsert leave requests downloaded from Cloud Firestore into local SQLite
 */
async function upsertLeaveRequestsFromCloud(requestsList = [], targetOrgId = 'DSOFFICE_LUNUGAMWEHERA') {
  if (!requestsList || requestsList.length === 0) return { inserted: 0, total: 0 };
  const org = (targetOrgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();

  let count = 0;
  for (const r of requestsList) {
    const id = parseInt(r.id || r.requestId, 10);
    const userId = String(r.userId || r.user_id || '').trim();
    const leaveTypeId = parseInt(r.leaveTypeId || r.leave_type_id, 10) || 1;
    const startDate = r.startDate || r.start_date;
    const endDate = r.endDate || r.end_date || startDate;
    const daysReq = parseFloat(r.daysRequested || r.days_requested) || 1.0;
    const dayType = r.dayType || r.day_type || 'FULL_DAY';
    const reason = r.reason || '';
    const contact = r.emergencyContact || r.emergency_contact || '';
    const qDate = r.qualifyingDate || r.qualifying_date || null;
    const cSource = r.compensatorySourceType || r.compensatory_source_type || null;
    const status = (r.status || 'PENDING').toUpperCase();
    const reqOrg = (r.organizationId || r.org_id || org).trim().toUpperCase();

    if (!userId || !startDate) continue;

    if (id) {
      await dbRun(`
        INSERT INTO leave_requests (
          id, user_id, leave_type_id, start_date, end_date, days_requested, day_type, reason,
          emergency_contact, qualifying_date, compensatory_source_type, status, org_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          leave_type_id = excluded.leave_type_id,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          days_requested = excluded.days_requested,
          day_type = excluded.day_type,
          reason = excluded.reason,
          emergency_contact = excluded.emergency_contact,
          qualifying_date = excluded.qualifying_date,
          compensatory_source_type = excluded.compensatory_source_type,
          status = excluded.status,
          org_id = excluded.org_id,
          updated_at = CURRENT_TIMESTAMP
      `, [id, userId, leaveTypeId, startDate, endDate, daysReq, dayType, reason, contact, qDate, cSource, status, reqOrg]);
    } else {
      await dbRun(`
        INSERT INTO leave_requests (
          user_id, leave_type_id, start_date, end_date, days_requested, day_type, reason,
          emergency_contact, qualifying_date, compensatory_source_type, status, org_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [userId, leaveTypeId, startDate, endDate, daysReq, dayType, reason, contact, qDate, cSource, status, reqOrg]);
    }
    count++;
  }
  return { inserted: count, total: requestsList.length };
}

/**
 * Get map of settings from SQLite
 */
async function getSettingsMap(keys = []) {
  let rows;
  if (keys && keys.length > 0) {
    const placeholders = keys.map(() => '?').join(',');
    rows = await dbAll(`SELECT key, value FROM settings WHERE key IN (${placeholders})`, keys);
  } else {
    rows = await dbAll(`SELECT key, value FROM settings`);
  }
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return map;
}

/**
 * Upsert key-value pairs into SQLite settings table
 */
async function upsertSettings(settingsMap = {}) {
  if (!settingsMap || typeof settingsMap !== 'object') return 0;
  const entries = Object.entries(settingsMap);
  let count = 0;
  for (const [k, v] of entries) {
    if (k && v !== undefined && v !== null) {
      await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [String(k), String(v)]);
      count++;
    }
  }
  return count;
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
  getCloudSyncStats,
  getAttendanceByDateRange,
  insertAttendanceFromCloud,
  getSystemUserByIdentifier,
  getValidOrganizationIds,
  getSystemUserByUid,
  getSystemUsersByOrg,
  saveSystemUser,
  deleteSystemUser,
  getShiftsByOrg,
  getHolidaysByOrg,
  upsertWorkingShiftFromCloud,
  upsertHolidayFromCloud,
  markShiftsCloudSynced,
  markHolidaysCloudSynced,
  getLeaveCategories,
  getLeaveCategoryById,
  saveLeaveCategory,
  deleteLeaveCategory,
  getLeaveTypesByCategory,
  saveLeaveType,
  deleteLeaveType,
  initializeEmployeeLeaveBalances,
  assignLeaveCategoryToEmployees,
  getEmployeeLeaveBalances,
  saveEmployeeLeaveBalance,
  calculateYearlyLeaveBalances,
  calculateAttendanceLeavesForEmployee,
  calculateAllEmployeesAttendanceLeaves,
  getYearlyLeaveOverview,
  getOrganizationLeaveBalances,
  upsertLeaveCategoryFromCloud,
  upsertLeaveBalancesFromCloud,
  markLeaveCategoriesCloudSynced,
  markEmployeeBalancesCloudSynced,
  createLeaveRequest,
  getLeaveRequestById,
  getLeaveRequests,
  getLeaveRequestStats,
  updateLeaveRequestStatus,
  deleteLeaveRequest,
  getCompensatoryEligibleDates,
  upsertEmployeesFromCloud,
  upsertSystemUsersFromCloud,
  upsertLeaveRequestsFromCloud,
  getSettingsMap,
  upsertSettings,


};
