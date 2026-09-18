/**
 * Complete catalog of all REST API endpoints available in the AttendanceV5L application.
 */
const API_ENDPOINTS = [
  // 1. Employees & Enrolled Users
  {
    id: 'get-users',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'GET',
    path: '/api/v1/users',
    alias: '/api/employees',
    description: 'Get all enrolled employees with complete profile details, shift assignments, and punch stats',
    parameters: {
      status: 'Filter by active status (active, inactive, all). Default: all',
      department: 'Filter by department name (optional)',
      search: 'Search keyword across Name, User ID, NIC, Phone (optional)'
    }
  },
  {
    id: 'get-user-by-id',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'GET',
    path: '/api/v1/users/:userId',
    alias: '/api/employees/:userId',
    description: 'Get a single employee profile with assigned shift rules and statistics',
    parameters: {
      userId: 'Employee User ID (e.g. 44) [Path, required]'
    }
  },
  {
    id: 'create-employee',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'POST',
    path: '/api/employees',
    description: 'Create or update an employee profile in the database and optionally push to SpeedFace',
    body: {
      user_id: 'string (required, e.g. "44")',
      name: 'string (required, e.g. "Kamal Perera")',
      department: 'string (optional)',
      position: 'string (optional)',
      nic: 'string (optional)',
      phone: 'string (optional)',
      email: 'string (optional)',
      card_number: 'string (optional)',
      shift_id: 'number (optional)',
      sync_to_device: 'boolean (optional, default: true)'
    }
  },
  {
    id: 'toggle-employee-active',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'POST',
    path: '/api/employees/:id/toggle-active',
    description: 'Toggle employee active/inactive status',
    parameters: {
      id: 'Employee ID or User ID [Path, required]'
    }
  },
  {
    id: 'delete-employee',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'DELETE',
    path: '/api/employees/:id',
    description: 'Permanently delete employee from database and SpeedFace device',
    parameters: {
      id: 'Employee ID [Path, required]'
    }
  },
  {
    id: 'assign-shift',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'POST',
    path: '/api/employees/assign-shift',
    description: 'Assign a shift policy to one or multiple employees',
    body: {
      user_ids: 'array of strings (e.g. ["44", "45"])',
      shift_id: 'number (e.g. 1)'
    }
  },
  {
    id: 'sync-all-employees',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'POST',
    path: '/api/employees/sync-all',
    description: 'Bulk upload all local employee names and credentials to SpeedFace terminal hardware',
    body: {}
  },
  {
    id: 'export-employees',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'GET',
    path: '/api/employees/export',
    description: 'Export all employee directory records to Excel (.xlsx) or CSV file',
    parameters: {
      format: 'Export format: "xlsx" or "csv" (default: "xlsx")',
      status: 'Filter by status: "active", "inactive", or "all"'
    }
  },
  {
    id: 'employee-sample-template',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'GET',
    path: '/api/employees/sample-template',
    description: 'Download standard Excel (.xlsx) template for bulk employee import',
    parameters: {}
  },
  {
    id: 'parse-employees',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'POST',
    path: '/api/employees/parse',
    description: 'Parse uploaded employee Excel file and return validation preview',
    body: 'Multipart form data containing "file"'
  },
  {
    id: 'upload-employees',
    category: 'employees',
    categoryName: '👥 Employees & Profiles',
    method: 'POST',
    path: '/api/employees/upload',
    description: 'Confirm and commit parsed employee records into SQLite database',
    body: {
      employees: 'Array of employee objects',
      syncToDevice: 'boolean (optional)'
    }
  },

  // 2. Attendance & Reports
  {
    id: 'user-attendance',
    category: 'attendance',
    categoryName: '📊 Attendance & Reports',
    method: 'GET',
    path: '/api/v1/users/:userId/attendance',
    alias: '/api/users/:userId/attendance',
    description: 'Get calculated attendance with daily status, punctuality, grace, short leaves, OT, and period totals for a user',
    parameters: {
      userId: 'Employee User ID [Path, required]',
      month: 'Target month in YYYY-MM format (optional, e.g. 2026-09)',
      startDate: 'Range start date YYYY-MM-DD (optional)',
      endDate: 'Range end date YYYY-MM-DD (optional)',
      date: 'Single date YYYY-MM-DD (optional)',
      includePunches: 'Include raw punches for each day (true/false, default: true)'
    }
  },
  {
    id: 'get-records',
    category: 'attendance',
    categoryName: '📊 Attendance & Reports',
    method: 'GET',
    path: '/api/records',
    description: 'Get paginated raw biometric punch logs with verify modes and punch states',
    parameters: {
      page: 'Page number (default: 1)',
      limit: 'Records per page (default: 50)',
      userId: 'Filter by user ID (optional)',
      date: 'Filter by exact date YYYY-MM-DD (optional)',
      startDate: 'Filter from date YYYY-MM-DD (optional)',
      endDate: 'Filter to date YYYY-MM-DD (optional)',
      search: 'Search keyword (optional)'
    }
  },
  {
    id: 'export-records',
    category: 'attendance',
    categoryName: '📊 Attendance & Reports',
    method: 'GET',
    path: '/api/records/export',
    description: 'Export raw biometric punches to Excel (.xlsx) or CSV file',
    parameters: {
      format: 'Export format: "xlsx" or "csv"',
      userId: 'Filter by user ID (optional)',
      startDate: 'Filter start date (optional)',
      endDate: 'Filter end date (optional)'
    }
  },
  {
    id: 'get-records-daily',
    category: 'attendance',
    categoryName: '📊 Attendance & Reports',
    method: 'GET',
    path: '/api/records/daily',
    description: 'Get daily roll call attendance report with In/Out times, hours worked, and punctuality flags',
    parameters: {
      date: 'Date in YYYY-MM-DD format (default: today)',
      department: 'Filter by department (optional)',
      search: 'Search query (optional)'
    }
  },
  {
    id: 'export-records-daily',
    category: 'attendance',
    categoryName: '📊 Attendance & Reports',
    method: 'GET',
    path: '/api/records/daily/export',
    description: 'Export daily roll call report to Excel (.xlsx) or CSV',
    parameters: {
      date: 'Date in YYYY-MM-DD format',
      format: 'Export format: "xlsx" or "csv"'
    }
  },
  {
    id: 'get-reports-data',
    category: 'attendance',
    categoryName: '📊 Attendance & Reports',
    method: 'GET',
    path: '/api/reports/data',
    description: 'Get aggregated period timesheet data for report generation and printing',
    parameters: {
      type: 'Report type: "daily", "weekly", "monthly", "custom"',
      month: 'Month YYYY-MM',
      startDate: 'Start date YYYY-MM-DD',
      endDate: 'End date YYYY-MM-DD',
      userId: 'Single employee filter (optional)'
    }
  },
  {
    id: 'export-reports',
    category: 'attendance',
    categoryName: '📊 Attendance & Reports',
    method: 'GET',
    path: '/api/reports/export',
    description: 'Export structured timesheets (A4 Timesheets, Punch Books, Monthly Matrices) to Excel or CSV',
    parameters: {
      type: 'Report layout: "daily", "weekly", "monthly", "book", "matrix"',
      format: 'Export format: "xlsx" or "csv"',
      month: 'Month YYYY-MM'
    }
  },
  {
    id: 'get-stats',
    category: 'attendance',
    categoryName: '📊 Attendance & Reports',
    method: 'GET',
    path: '/api/stats',
    description: 'Get dashboard KPI summary statistics (today presents, total punches, registered employees, terminal online state)',
    parameters: {}
  },

  // 3. Terminal & Time Sync
  {
    id: 'get-device-time-status',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'GET',
    path: '/api/device/time-status',
    description: 'Get live time comparison across SpeedFace Terminal, Online Atomic Internet Time, and Local PC with drift calculation',
    parameters: {
      timeZone: 'Timezone (default: "Asia/Colombo")'
    }
  },
  {
    id: 'get-time-online',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'GET',
    path: '/api/time/online',
    description: 'Fetch official internet atomic time from NTP Stratum-1, TimeAPI, or Google Atomic HTTP',
    parameters: {
      timeZone: 'Timezone (default: "Asia/Colombo")'
    }
  },
  {
    id: 'sync-device-time',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'POST',
    path: '/api/device/sync-time',
    description: 'Synchronize SpeedFace terminal clock using Online Atomic Time, Manual Custom Timestamp, or PC Clock',
    body: {
      mode: '"online" | "manual" | "pc" (default: "online")',
      customTime: 'string (required if mode is "manual", e.g. "2026-09-18 11:30:00")',
      timeZone: 'string (optional, default: "Asia/Colombo")'
    }
  },
  {
    id: 'get-device-status',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'GET',
    path: '/api/device/status',
    description: 'Check SpeedFace-V5L terminal connection health and network interface routing',
    parameters: {}
  },
  {
    id: 'test-device-conn',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'POST',
    path: '/api/device/test',
    description: 'Test direct TCP connection and retrieve device specifications (log count, enrolled users, log capacity)',
    body: {
      ip: 'string (optional)',
      port: 'number (optional)',
      interfaceIp: 'string (optional)'
    }
  },
  {
    id: 'sync-device-data',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'POST',
    path: '/api/device/sync',
    description: 'Pull attendance records and users from SpeedFace device over TCP port 4370 into SQLite database',
    body: {
      ip: 'string (optional)',
      interfaceIp: 'string (optional)'
    }
  },
  {
    id: 'stop-device-sync',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'POST',
    path: '/api/device/sync/stop',
    description: 'Halt active device synchronization and safely close active TCP socket',
    body: {}
  },
  {
    id: 'reboot-device',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'POST',
    path: '/api/device/reboot',
    description: 'Remotely trigger warm reboot of SpeedFace terminal hardware',
    body: {
      interfaceIp: 'string (optional)'
    }
  },
  {
    id: 'get-data-summary',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'GET',
    path: '/api/device/data-summary',
    description: 'Get detailed count summary of attendance logs, employees, and shifts before database reset/purge',
    parameters: {}
  },
  {
    id: 'reset-device-data',
    category: 'device',
    categoryName: '🕒 Terminal & Time Sync',
    method: 'POST',
    path: '/api/device/reset-data',
    description: 'Purge local attendance logs, reset employee list, or wipe terminal hardware logs',
    body: {
      action: '"purge_attendance" | "purge_all" | "clear_device_logs"',
      confirmation: 'string (safety token)'
    }
  },

  // 4. Shifts & Holidays
  {
    id: 'get-shifts',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'GET',
    path: '/api/shifts',
    description: 'List all working shift configurations (start time, end time, grace periods, short leaves, OT rules)',
    parameters: {}
  },
  {
    id: 'create-shift',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'POST',
    path: '/api/shifts',
    description: 'Create a new working shift policy',
    body: {
      shift_name: 'string (required)',
      start_time: 'string HH:mm:ss (required)',
      end_time: 'string HH:mm:ss (required)',
      grace_minutes: 'number',
      short_leave_mins: 'number',
      half_day_hours: 'number',
      full_day_hours: 'number',
      ot_enabled: 'boolean'
    }
  },
  {
    id: 'update-shift',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'PUT',
    path: '/api/shifts/:id',
    description: 'Update existing shift policy parameters',
    parameters: {
      id: 'Shift ID [Path, required]'
    },
    body: {
      shift_name: 'string',
      start_time: 'string',
      end_time: 'string'
    }
  },
  {
    id: 'delete-shift',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'DELETE',
    path: '/api/shifts/:id',
    description: 'Delete a shift policy (employees will revert to standard Default Shift)',
    parameters: {
      id: 'Shift ID [Path, required]'
    }
  },
  {
    id: 'get-holidays',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'GET',
    path: '/api/holidays',
    description: 'List all organization holidays and public/bank holidays',
    parameters: {
      year: 'Filter by year (optional, e.g. 2026)'
    }
  },
  {
    id: 'create-holiday',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'POST',
    path: '/api/holidays',
    description: 'Add a new official holiday',
    body: {
      holiday_date: 'string YYYY-MM-DD (required)',
      holiday_name: 'string (required)',
      holiday_type: 'string ("public", "bank", "custom")'
    }
  },
  {
    id: 'delete-holiday',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'DELETE',
    path: '/api/holidays/:id',
    description: 'Delete a holiday by ID',
    parameters: {
      id: 'Holiday ID [Path, required]'
    }
  },
  {
    id: 'parse-holidays',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'POST',
    path: '/api/holidays/parse',
    description: 'Parse uploaded holidays Excel sheet for preview',
    body: 'Multipart form data'
  },
  {
    id: 'upload-holidays',
    category: 'shifts',
    categoryName: '⏰ Shifts & Holidays',
    method: 'POST',
    path: '/api/holidays/upload',
    description: 'Confirm and commit parsed holidays into database',
    body: {
      holidays: 'Array of holiday objects'
    }
  },

  // 5. Cloud Sync (Firebase Firestore)
  {
    id: 'get-firebase-status',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'GET',
    path: '/api/firebase/status',
    description: 'Get Firestore cloud sync status, configured organization partition ID, quota status, and pending queue count',
    parameters: {}
  },
  {
    id: 'test-firebase-conn',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'POST',
    path: '/api/firebase/test-connection',
    description: 'Perform real-time read and write probe against Firestore cloud database',
    body: {}
  },
  {
    id: 'sync-firebase-now',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'POST',
    path: '/api/firebase/sync-now',
    description: 'Immediately upload pending local attendance punches to Firestore partition',
    body: {
      force: 'boolean (optional, bypasses cooldown)',
      limit: 'number (batch limit, e.g. 500)'
    }
  },
  {
    id: 'stop-firebase-sync',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'POST',
    path: '/api/firebase/stop-sync',
    description: 'Cancel active Firestore batch upload without losing any local records',
    body: {}
  },
  {
    id: 'stop-all-sync',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'POST',
    path: '/api/sync/stop',
    description: 'Universal Stop Sync: Instantly halts both SpeedFace device downloads and Firestore cloud uploads',
    body: {}
  },
  {
    id: 'sync-firebase-employees',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'POST',
    path: '/api/firebase/sync-employees',
    description: 'Sync local employee registry to multi-organization Firestore directory',
    body: {}
  },
  {
    id: 'reset-firebase-sync',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'POST',
    path: '/api/firebase/reset-sync',
    description: 'Reset cloud sync flags across local attendance records or employee directory to allow re-upload to Firestore',
    body: {
      scope: 'string ("all", "attendance", "employees")'
    }
  },
  {
    id: 'config-firebase-org',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'POST',
    path: '/api/firebase/config',
    alias: '/api/firebase/pair-organization',
    description: 'Configure and pair multi-organization partition settings in Firestore',
    body: {
      orgName: 'string (e.g. "Head Office")',
      orgId: 'string (e.g. "demo_corp")'
    }
  },
  {
    id: 'save-firebase-credentials',
    category: 'cloud',
    categoryName: '🔥 Cloud Sync (Firestore)',
    method: 'POST',
    path: '/api/firebase/upload-key',
    alias: '/api/firebase/save-credentials',
    description: 'Install or update Firebase service account credentials JSON',
    body: {
      keyData: 'object (service account key json object or string)'
    }
  },

  // 6. System Health, Network & Backups
  {
    id: 'get-health',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/health',
    alias: '/api/health',
    description: 'Server health check (uptime, memory RSS/heap, database connection, record counts, active WebSocket clients)',
    parameters: {}
  },
  {
    id: 'get-network-ips',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/api/network-ips',
    description: 'List all active non-internal IPv4 addresses assigned to host machine',
    parameters: {}
  },
  {
    id: 'get-network-interfaces',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/api/network-interfaces',
    description: 'Get detailed network adapters with interface names, MAC addresses, subnets, and SpeedFace reachability',
    parameters: {}
  },
  {
    id: 'test-network-interface',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'POST',
    path: '/api/network-interfaces/test',
    description: 'Test TCP socket route to SpeedFace through a specific network interface adapter',
    body: {
      interfaceIp: 'string (required, e.g. "192.168.10.55")'
    }
  },
  {
    id: 'get-settings',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/api/settings',
    description: 'Retrieve all application, device, and letterhead configuration settings',
    parameters: {}
  },
  {
    id: 'save-settings',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'POST',
    path: '/api/settings',
    description: 'Save application configuration parameters (device IP, port, auto-sync intervals, network interface)',
    body: {
      device_ip: 'string',
      device_port: 'number',
      network_interface: 'string',
      network_interface_ip: 'string',
      auto_sync_interval: 'number',
      auto_sync_enabled: 'string'
    }
  },
  {
    id: 'get-sync-logs',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/api/sync-logs',
    description: 'Retrieve historical synchronization logs with record additions and status codes',
    parameters: {
      limit: 'number (default: 50)'
    }
  },
  {
    id: 'get-system-logs',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/api/system/logs',
    description: 'Retrieve rolling system event logs from server logger',
    parameters: {
      lines: 'number (default: 100)'
    }
  },
  {
    id: 'get-backups',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/api/system/backups',
    description: 'List automated SQLite database backup archive files with file sizes and timestamps',
    parameters: {}
  },
  {
    id: 'create-backup',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'POST',
    path: '/api/system/backups/create',
    description: 'Trigger immediate manual snapshot backup of SQLite database',
    body: {}
  },
  {
    id: 'download-backup',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/api/system/backups/download/:filename',
    description: 'Download SQLite database backup archive file (.db / .gz)',
    parameters: {
      filename: 'Backup filename [Path, required]'
    }
  },
  {
    id: 'get-api-docs',
    category: 'system',
    categoryName: '⚙️ System & Network',
    method: 'GET',
    path: '/api/v1/docs',
    alias: '/api/v1',
    description: 'Complete machine-readable JSON catalog of all API endpoints in the system',
    parameters: {}
  }
];

module.exports = {
  API_ENDPOINTS
};
