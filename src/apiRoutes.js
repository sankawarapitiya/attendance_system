const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { dbAll, dbGet, dbRun, runDatabaseBackup } = require('./db');
const { syncFromDevice, checkDeviceHealth, getSyncStatus, startAutoSync, stopAutoSync } = require('./syncService');
const { SpeedFaceClient } = require('./zktProtocol');
const config = require('./config');
const logger = require('./logger');
const { 
  generateExcelBuffer, 
  generateCsvString,
  generateEmployeeExcelBuffer,
  generateEmployeeCsvString,
  generateDailyExcelBuffer,
  generateDailyCsvString,
  generateWeeklyAllUsersExcelBuffer,
  generateWeeklyAllUsersCsvString,
  generateMonthlyAllUsersExcelBuffer,
  generateMonthlyAllUsersCsvString,
  generateMonthlyBookExcelBuffer,
  generateMonthlyBookCsvString,
  generateMonthlyMatrixExcelBuffer,
  generateMonthlyMatrixCsvString,
  generateEmployeeTimesheetExcelBuffer,
  generateEmployeeTimesheetCsvString
} = require('./exportService');
const { getConnectedAdmsDevices, queueDeviceCommand, queuePhotoUpload } = require('./admsServer');
const { 
  getDayClassification, 
  evaluatePunchPunctuality, 
  buildMonthlyGraceAndLateMap,
  computeDailyAttendanceSummary
} = require('./shiftEngine');
const {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  getUserCalculatedAttendance
} = require('./reportService');
const { parseHolidaysInput } = require('./holidayParser');
const { parseEmployeesInput } = require('./employeeParser');
const XLSX = require('xlsx');

const router = express.Router();

function ipToLong(ip) {
  try {
    return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
  } catch (e) {
    return 0;
  }
}

function isSameSubnet(ip1, ip2, netmask = '255.255.255.0') {
  try {
    const mask = ipToLong(netmask);
    return (ipToLong(ip1) & mask) === (ipToLong(ip2) & mask);
  } catch (e) {
    return false;
  }
}

// Helper to get local IPv4 network interfaces
function getLocalIps(deviceIp = '192.168.10.15') {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        const inSameSubnet = deviceIp ? isSameSubnet(net.address, deviceIp, net.netmask) : false;
        addresses.push({
          interface: name,
          name: name,
          ip: net.address,
          netmask: net.netmask,
          mac: net.mac,
          cidr: net.cidr,
          inSameSubnet
        });
      }
    }
  }
  return addresses;
}

// 1. Dashboard summary stats
router.get('/stats', async (req, res) => {
  try {
    const totalRecordsRow = await dbGet(`SELECT COUNT(*) as count FROM attendance_records`);
    const todayRecordsRow = await dbGet(`
      SELECT COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
      FROM attendance_records
      WHERE strftime('%Y-%m-%d', punch_time) = strftime('%Y-%m-%d', 'now', 'localtime')
    `);
    const totalEmployeesRow = await dbGet(`SELECT COUNT(*) as count FROM employees`);
    const latestPunch = await dbGet(`
      SELECT a.*, e.name as employee_name
      FROM attendance_records a
      LEFT JOIN employees e ON a.user_id = e.user_id
      ORDER BY a.punch_time DESC LIMIT 1
    `);

    const syncStatus = getSyncStatus();
    const admsDevices = getConnectedAdmsDevices();
    const isOnline = Boolean(syncStatus.deviceOnline || admsDevices.length > 0);

    res.json({
      success: true,
      stats: {
        totalRecords: totalRecordsRow ? totalRecordsRow.count : 0,
        todayRecords: todayRecordsRow ? todayRecordsRow.count : 0,
        todayUniqueUsers: todayRecordsRow ? todayRecordsRow.unique_users : 0,
        totalEmployees: totalEmployeesRow ? totalEmployeesRow.count : 0,
        latestPunch: latestPunch || null,
        syncStatus,
        deviceOnline: isOnline,
        deviceInfo: syncStatus.deviceInfo || null,
        deviceIp: (syncStatus.deviceInfo && syncStatus.deviceInfo.ip) || '192.168.10.15',
        admsConnected: admsDevices.length > 0,
        admsDevices
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper to build SQL WHERE clause from query filters
function buildRecordsQuery(query) {
  const conditions = [];
  const queryParams = [];

  if (query.userId) {
    conditions.push(`a.user_id = ?`);
    queryParams.push(query.userId);
  }
  if (query.startDate) {
    conditions.push(`strftime('%Y-%m-%d', a.punch_time) >= ?`);
    queryParams.push(query.startDate);
  }
  if (query.endDate) {
    conditions.push(`strftime('%Y-%m-%d', a.punch_time) <= ?`);
    queryParams.push(query.endDate);
  }
  if (query.verifyMode !== undefined && query.verifyMode !== '') {
    conditions.push(`a.verify_mode = ?`);
    queryParams.push(parseInt(query.verifyMode, 10));
  }
  if (query.punchState !== undefined && query.punchState !== '') {
    conditions.push(`a.punch_state = ?`);
    queryParams.push(parseInt(query.punchState, 10));
  }
  if (query.search) {
    conditions.push(`(a.user_id LIKE ? OR e.name LIKE ? OR e.department LIKE ? OR e.employee_service_id LIKE ? OR e.nic LIKE ? OR e.phone LIKE ?)`);
    const term = `%${query.search}%`;
    queryParams.push(term, term, term, term, term, term);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, queryParams };
}

// 2. Fetch attendance records with pagination & filters
router.get('/records', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const { whereSql, queryParams } = buildRecordsQuery(req.query);

    const countSql = `
      SELECT COUNT(*) as total
      FROM attendance_records a
      LEFT JOIN employees e ON a.user_id = e.user_id
      ${whereSql}
    `;
    const countRow = await dbGet(countSql, queryParams);
    const total = countRow ? countRow.total : 0;

    const dataSql = `
      SELECT 
        a.id, a.user_sn, a.user_id, a.punch_time, 
        a.verify_mode, a.verify_name, a.punch_state, a.punch_state_name,
        a.work_code, a.temperature, a.mask_status, a.device_ip, a.source,
        e.name as employee_name, e.department, e.role, e.photo as employee_photo, e.shift_id,
        e.employee_service_id, e.nic, e.phone as employee_phone,
        s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
        s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
        s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end, s.disallow_grace_and_short_leave_same_day,
        s.ot_min_mins, s.ot_step_mins,
        s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
        s.work_days, s.color as shift_color
      FROM attendance_records a
      LEFT JOIN employees e ON a.user_id = e.user_id
      LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
      ${whereSql}
      ORDER BY a.punch_time DESC
      LIMIT ? OFFSET ?
    `;

    const records = await dbAll(dataSql, [...queryParams, limit, offset]);
    const holidays = await dbAll(`SELECT * FROM holidays`);

    // Ensure 100% accurate first punch (Check-In) and last punch (Check-Out)
    // by fetching full day context for the users and dates in this page:
    let graceHelper;
    if (records.length > 0) {
      const userIds = [...new Set(records.map(r => r.user_id))];
      const dates = [...new Set(records.map(r => String(r.punch_time).slice(0, 10)))];
      const months = [...new Set(dates.map(d => d.slice(0, 7)))];

      const contextSql = `
        SELECT 
          a.id, a.user_id, a.punch_time, a.punch_state,
          s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
          s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
          s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end, s.disallow_grace_and_short_leave_same_day,
          s.ot_min_mins, s.ot_step_mins,
          s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
          s.work_days
        FROM attendance_records a
        LEFT JOIN employees e ON a.user_id = e.user_id
        LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
        WHERE strftime('%Y-%m', a.punch_time) IN (${months.map(() => '?').join(',')})
          AND a.user_id IN (${userIds.map(() => '?').join(',')})
        ORDER BY a.punch_time ASC
      `;
      const contextRecords = await dbAll(contextSql, [...months, ...userIds]);
      graceHelper = buildMonthlyGraceAndLateMap(contextRecords, holidays);
    } else {
      graceHelper = buildMonthlyGraceAndLateMap([], holidays);
    }

    const enrichedRecords = records.map((r) => {
      const shiftObj = {
        name: r.shift_name || 'General Shift',
        start_time: r.shift_start || '08:30',
        end_time: r.shift_end || '16:15',
        grace_period_mins: r.grace_period_mins !== undefined ? r.grace_period_mins : 30,
        monthly_grace_days: r.monthly_grace_days !== undefined ? r.monthly_grace_days : 2,
        late_cover_end: r.late_cover_end !== undefined ? r.late_cover_end : 1,
        half_day_hours: r.half_day_hours !== undefined ? r.half_day_hours : 3.5,
        late_half_day_hours: r.late_half_day_hours !== undefined ? r.late_half_day_hours : 4.0,
        full_day_hours: r.full_day_hours !== undefined ? r.full_day_hours : 7.75,
        monthly_short_leaves: r.monthly_short_leaves !== undefined ? r.monthly_short_leaves : 2,
        morning_short_leave_start: r.morning_short_leave_start || '09:00',
        morning_short_leave_end: r.morning_short_leave_end || '10:00',
        evening_short_leave_start: r.evening_short_leave_start || '14:45',
        evening_short_leave_end: r.evening_short_leave_end || '16:15',
        disallow_grace_and_short_leave_same_day: r.disallow_grace_and_short_leave_same_day !== undefined ? r.disallow_grace_and_short_leave_same_day : 1,
        ot_min_mins: r.ot_min_mins !== undefined ? r.ot_min_mins : 60,
        ot_step_mins: r.ot_step_mins !== undefined ? r.ot_step_mins : 15,
        enable_morning_grace: r.enable_morning_grace !== undefined ? r.enable_morning_grace : 1,
        enable_short_leave: r.enable_short_leave !== undefined ? r.enable_short_leave : 1,
        enable_half_day_calc: r.enable_half_day_calc !== undefined ? r.enable_half_day_calc : 1,
        enable_overtime: r.enable_overtime !== undefined ? r.enable_overtime : 1,
        work_days: r.work_days || '1,2,3,4,5'
      };
      const dayClass = getDayClassification(r.punch_time, shiftObj, holidays);
      const dateStr = String(r.punch_time).slice(0, 10);
      const context = graceHelper.getContext(r.user_id, dateStr);
      const punctuality = evaluatePunchPunctuality(r.punch_time, shiftObj, dayClass, r.punch_state, context, r.id);

      return {
        ...r,
        punch_role: punctuality.role,
        punch_role_label: punctuality.roleLabel,
        punch_role_badge: punctuality.roleBadge,
        punch_state_name: punctuality.roleLabel || r.punch_state_name,
        day_type: dayClass.type,
        day_type_label: dayClass.label,
        day_name: dayClass.name,
        day_icon: dayClass.icon,
        day_badge: dayClass.badgeClass,
        is_working_day: dayClass.isWorkingDay,
        punctuality_status: punctuality.status,
        punctuality_label: punctuality.label,
        punctuality_badge: punctuality.badgeClass,
        punctuality_icon: punctuality.icon,
        late_minutes: punctuality.lateMinutes || 0,
        early_minutes: punctuality.earlyMinutes || 0,
        ot_hours: punctuality.otHours || 0
      };
    });

    res.json({
      success: true,
      records: enrichedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Export records to Excel or CSV
router.get('/records/export', async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const { whereSql, queryParams } = buildRecordsQuery(req.query);

    const dataSql = `
      SELECT 
        a.id, a.user_sn, a.user_id, a.punch_time, 
        a.verify_mode, a.verify_name, a.punch_state, a.punch_state_name,
        a.work_code, a.temperature, a.mask_status, a.device_ip, a.source,
        e.name as employee_name, e.department, e.role, e.shift_id,
        s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
        s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
        s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end, s.disallow_grace_and_short_leave_same_day,
        s.ot_min_mins, s.ot_step_mins,
        s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
        s.work_days
      FROM attendance_records a
      LEFT JOIN employees e ON a.user_id = e.user_id
      LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
      ${whereSql}
      ORDER BY a.punch_time DESC
      LIMIT 100000
    `;

    const records = await dbAll(dataSql, queryParams);
    const holidays = await dbAll(`SELECT * FROM holidays`);
    let graceHelper;
    if (records.length > 0) {
      const userIds = [...new Set(records.map(r => r.user_id))];
      const todayYm = String(todayStr).slice(0, 7);
      const contextSql = `
        SELECT 
          a.id, a.user_id, a.punch_time, a.punch_state,
          s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
          s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
          s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end, s.disallow_grace_and_short_leave_same_day,
          s.ot_min_mins, s.ot_step_mins,
          s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
          s.work_days
        FROM attendance_records a
        LEFT JOIN employees e ON a.user_id = e.user_id
        LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
        WHERE strftime('%Y-%m', a.punch_time) = ?
          AND a.user_id IN (${userIds.map(() => '?').join(',')})
        ORDER BY a.punch_time ASC
      `;
      const contextRecords = await dbAll(contextSql, [todayYm, ...userIds]);
      graceHelper = buildMonthlyGraceAndLateMap(contextRecords, holidays);
    } else {
      graceHelper = buildMonthlyGraceAndLateMap([], holidays);
    }

    const enrichedRecords = records.map((r) => {
      const shiftObj = {
        name: r.shift_name || 'General Shift',
        start_time: r.shift_start || '08:30',
        end_time: r.shift_end || '16:15',
        grace_period_mins: r.grace_period_mins !== undefined ? r.grace_period_mins : 30,
        monthly_grace_days: r.monthly_grace_days !== undefined ? r.monthly_grace_days : 2,
        late_cover_end: r.late_cover_end !== undefined ? r.late_cover_end : 1,
        half_day_hours: r.half_day_hours !== undefined ? r.half_day_hours : 3.5,
        late_half_day_hours: r.late_half_day_hours !== undefined ? r.late_half_day_hours : 4.0,
        full_day_hours: r.full_day_hours !== undefined ? r.full_day_hours : 7.75,
        monthly_short_leaves: r.monthly_short_leaves !== undefined ? r.monthly_short_leaves : 2,
        morning_short_leave_start: r.morning_short_leave_start || '09:00',
        morning_short_leave_end: r.morning_short_leave_end || '10:00',
        evening_short_leave_start: r.evening_short_leave_start || '14:45',
        evening_short_leave_end: r.evening_short_leave_end || '16:15',
        disallow_grace_and_short_leave_same_day: r.disallow_grace_and_short_leave_same_day !== undefined ? r.disallow_grace_and_short_leave_same_day : 1,
        ot_min_mins: r.ot_min_mins !== undefined ? r.ot_min_mins : 60,
        ot_step_mins: r.ot_step_mins !== undefined ? r.ot_step_mins : 15,
        enable_morning_grace: r.enable_morning_grace !== undefined ? r.enable_morning_grace : 1,
        enable_short_leave: r.enable_short_leave !== undefined ? r.enable_short_leave : 1,
        enable_half_day_calc: r.enable_half_day_calc !== undefined ? r.enable_half_day_calc : 1,
        enable_overtime: r.enable_overtime !== undefined ? r.enable_overtime : 1,
        work_days: r.work_days || '1,2,3,4,5'
      };
      const dayClass = getDayClassification(r.punch_time, shiftObj, holidays);
      const dateStr = String(r.punch_time).slice(0, 10);
      const context = graceHelper.getContext(r.user_id, dateStr);
      const punctuality = evaluatePunchPunctuality(r.punch_time, shiftObj, dayClass, r.punch_state, context, r.id);

      return {
        ...r,
        punch_role: punctuality.role,
        punch_role_label: punctuality.roleLabel,
        punch_state_name: punctuality.roleLabel || r.punch_state_name,
        day_type: dayClass.type,
        day_type_label: dayClass.label,
        punctuality_label: punctuality.label,
        ot_hours: punctuality.otHours || 0
      };
    });

    const dateStamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const csvData = generateCsvString(enrichedRecords);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="SpeedFace_Attendance_${dateStamp}.csv"`);
      return res.send(csvData);
    } else {
      const buffer = generateExcelBuffer(enrichedRecords);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="SpeedFace_Attendance_${dateStamp}.xlsx"`);
      return res.send(buffer);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3b. Daily Attendance Summary (1 row per user per day, first punch = check-in, last punch = check-out)
router.get('/records/daily', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    // Determine target dates
    let targetDate = req.query.date || '';
    let startDate = req.query.startDate || '';
    let endDate = req.query.endDate || '';
    const quickDate = req.query.quickDate || '';

    // If quickDate is 'all', show across all records
    const isAllRecords = (quickDate === 'all' && !startDate && !endDate && !targetDate);

    // If no date at all specified, default to today
    if (!targetDate && !startDate && !endDate && !isAllRecords) {
      targetDate = new Date().toISOString().split('T')[0];
    }

    // Build conditions for attendance records
    const conditions = [];
    const queryParams = [];

    if (targetDate) {
      conditions.push(`strftime('%Y-%m-%d', a.punch_time) = ?`);
      queryParams.push(targetDate);
    } else {
      if (startDate) {
        conditions.push(`strftime('%Y-%m-%d', a.punch_time) >= ?`);
        queryParams.push(startDate);
      }
      if (endDate) {
        conditions.push(`strftime('%Y-%m-%d', a.punch_time) <= ?`);
        queryParams.push(endDate);
      }
    }

    if (req.query.userId) {
      conditions.push(`a.user_id = ?`);
      queryParams.push(req.query.userId);
    } else if (req.query.includeInactive !== 'true') {
      conditions.push(`COALESCE(e.is_active, 1) = 1`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataSql = `
      SELECT 
        a.id, a.user_sn, a.user_id, a.punch_time, 
        a.verify_mode, a.verify_name, a.punch_state, a.punch_state_name,
        a.work_code, a.temperature, a.mask_status, a.device_ip, a.source,
        e.name as employee_name, e.department, e.role, e.photo as employee_photo, e.shift_id,
        s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
        s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
        s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end, s.disallow_grace_and_short_leave_same_day,
        s.ot_min_mins, s.ot_step_mins,
        s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
        s.work_days, s.color as shift_color
      FROM attendance_records a
      LEFT JOIN employees e ON a.user_id = e.user_id
      LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
      ${whereSql}
      ORDER BY a.punch_time ASC
    `;

    const records = await dbAll(dataSql, queryParams);
    const holidays = await dbAll(`SELECT * FROM holidays`);

    // Fetch all employees to include all enrolled users
    const empConditions = [];
    const empParams = [];
    if (req.query.userId) {
      empConditions.push(`e.user_id = ?`);
      empParams.push(req.query.userId);
    } else if (req.query.includeInactive !== 'true') {
      empConditions.push(`COALESCE(e.is_active, 1) = 1`);
    }
    const empWhere = empConditions.length > 0 ? `WHERE ${empConditions.join(' AND ')}` : '';

    let allEmployees = [];
    if (!isAllRecords || targetDate || (startDate && endDate && startDate === endDate)) {
      allEmployees = await dbAll(`
        SELECT e.user_id, e.name as employee_name, e.department, e.role, e.photo as employee_photo, e.shift_id,
               s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
               s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
               s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end, s.disallow_grace_and_short_leave_same_day,
               s.ot_min_mins, s.ot_step_mins,
               s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
               s.work_days, s.color as shift_color
        FROM employees e
        LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
        ${empWhere}
        ORDER BY CAST(e.user_id AS INTEGER) ASC
      `, empParams);
    }

    const targetDatesList = targetDate ? [targetDate] : (startDate && endDate && startDate === endDate ? [startDate] : []);
    let allDailyRows = computeDailyAttendanceSummary(records, holidays, allEmployees, targetDatesList);

    // Calculate overall stats before client-side filters
    const stats = {
      date: targetDate || (startDate && endDate && startDate === endDate ? startDate : 'Selected Period'),
      totalEnrolled: allEmployees.length > 0 ? allEmployees.length : allDailyRows.length,
      present: allDailyRows.filter(r => r.punch_count > 0).length,
      absent: allDailyRows.filter(r => r.punch_count === 0).length,
      onTime: allDailyRows.filter(r => r.daily_status && (r.daily_status.includes('On Time') || r.daily_status.includes('Full Day'))).length,
      lateOrGrace: allDailyRows.filter(r => r.daily_status && (r.daily_status.includes('Late') || r.daily_status.includes('Grace'))).length,
      otCount: allDailyRows.filter(r => r.ot_hours > 0).length
    };

    // Filter by statusFilter
    const statusFilter = req.query.statusFilter || 'all';
    if (statusFilter === 'present') {
      allDailyRows = allDailyRows.filter(r => r.punch_count > 0);
    } else if (statusFilter === 'absent') {
      allDailyRows = allDailyRows.filter(r => r.punch_count === 0);
    } else if (statusFilter === 'late') {
      allDailyRows = allDailyRows.filter(r => r.daily_status && (r.daily_status.includes('Late') || r.daily_status.includes('Grace')));
    } else if (statusFilter === 'ontime') {
      allDailyRows = allDailyRows.filter(r => r.daily_status && (r.daily_status.includes('On Time') || r.daily_status.includes('Full Day')));
    }

    // Filter by search
    if (req.query.search) {
      const term = req.query.search.toLowerCase().trim();
      allDailyRows = allDailyRows.filter(r => 
        String(r.user_id).toLowerCase().includes(term) ||
        String(r.employee_name).toLowerCase().includes(term) ||
        String(r.department).toLowerCase().includes(term)
      );
    }

    const total = allDailyRows.length;
    const paginatedDaily = allDailyRows.slice(offset, offset + limit);

    res.json({
      success: true,
      stats,
      records: paginatedDaily,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3c. Export Daily Attendance Summary to Excel or CSV
router.get('/records/daily/export', async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();

    let targetDate = req.query.date || '';
    let startDate = req.query.startDate || '';
    let endDate = req.query.endDate || '';
    const quickDate = req.query.quickDate || '';

    const isAllRecords = (quickDate === 'all' && !startDate && !endDate && !targetDate);

    if (!targetDate && !startDate && !endDate && !isAllRecords) {
      targetDate = new Date().toISOString().split('T')[0];
    }

    const conditions = [];
    const queryParams = [];

    if (targetDate) {
      conditions.push(`strftime('%Y-%m-%d', a.punch_time) = ?`);
      queryParams.push(targetDate);
    } else {
      if (startDate) {
        conditions.push(`strftime('%Y-%m-%d', a.punch_time) >= ?`);
        queryParams.push(startDate);
      }
      if (endDate) {
        conditions.push(`strftime('%Y-%m-%d', a.punch_time) <= ?`);
        queryParams.push(endDate);
      }
    }

    if (req.query.userId) {
      conditions.push(`a.user_id = ?`);
      queryParams.push(req.query.userId);
    } else if (req.query.includeInactive !== 'true') {
      conditions.push(`COALESCE(e.is_active, 1) = 1`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataSql = `
      SELECT 
        a.id, a.user_sn, a.user_id, a.punch_time, 
        a.verify_mode, a.verify_name, a.punch_state, a.punch_state_name,
        a.work_code, a.temperature, a.mask_status, a.device_ip, a.source,
        e.name as employee_name, e.department, e.role, e.shift_id,
        s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
        s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
        s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end, s.disallow_grace_and_short_leave_same_day,
        s.ot_min_mins, s.ot_step_mins,
        s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
        s.work_days
      FROM attendance_records a
      LEFT JOIN employees e ON a.user_id = e.user_id
      LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
      ${whereSql}
      ORDER BY a.punch_time ASC
      LIMIT 100000
    `;

    const records = await dbAll(dataSql, queryParams);
    const holidays = await dbAll(`SELECT * FROM holidays`);

    const empConditions = [];
    const empParams = [];
    if (req.query.userId) {
      empConditions.push(`e.user_id = ?`);
      empParams.push(req.query.userId);
    } else if (req.query.includeInactive !== 'true') {
      empConditions.push(`COALESCE(e.is_active, 1) = 1`);
    }
    const empWhere = empConditions.length > 0 ? `WHERE ${empConditions.join(' AND ')}` : '';

    let allEmployees = [];
    if (!isAllRecords || targetDate || (startDate && endDate && startDate === endDate)) {
      allEmployees = await dbAll(`
        SELECT e.user_id, e.name as employee_name, e.department, e.role, e.photo as employee_photo, e.shift_id,
               s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
               s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
               s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end, s.disallow_grace_and_short_leave_same_day,
               s.ot_min_mins, s.ot_step_mins,
               s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
               s.work_days, s.color as shift_color
        FROM employees e
        LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
        ${empWhere}
        ORDER BY CAST(e.user_id AS INTEGER) ASC
      `, empParams);
    }

    const targetDatesList = targetDate ? [targetDate] : (startDate && endDate && startDate === endDate ? [startDate] : []);
    let dailyRows = computeDailyAttendanceSummary(records, holidays, allEmployees, targetDatesList);

    // Filter by statusFilter
    const statusFilter = req.query.statusFilter || 'all';
    if (statusFilter === 'present') {
      dailyRows = dailyRows.filter(r => r.punch_count > 0);
    } else if (statusFilter === 'absent') {
      dailyRows = dailyRows.filter(r => r.punch_count === 0);
    } else if (statusFilter === 'late') {
      dailyRows = dailyRows.filter(r => r.daily_status && (r.daily_status.includes('Late') || r.daily_status.includes('Grace')));
    } else if (statusFilter === 'ontime') {
      dailyRows = dailyRows.filter(r => r.daily_status && (r.daily_status.includes('On Time') || r.daily_status.includes('Full Day')));
    }

    // Filter by search
    if (req.query.search) {
      const term = req.query.search.toLowerCase().trim();
      dailyRows = dailyRows.filter(r => 
        String(r.user_id).toLowerCase().includes(term) ||
        String(r.employee_name).toLowerCase().includes(term) ||
        String(r.department).toLowerCase().includes(term)
      );
    }

    const dateStamp = targetDate || new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const csvData = generateDailyCsvString(dailyRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="SpeedFace_Daily_Attendance_${dateStamp}.csv"`);
      return res.send(csvData);
    } else {
      const buffer = generateDailyExcelBuffer(dailyRows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="SpeedFace_Daily_Attendance_${dateStamp}.xlsx"`);
      return res.send(buffer);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3B. Reports & Timesheets (Daily, Weekly, Monthly)
// ==========================================

// GET /api/reports/data
router.get('/reports/data', async (req, res) => {
  try {
    const { type = 'daily', scope = 'all', userId, date, startDate, endDate, month, search, statusFilter } = req.query;
    const activeOnly = (req.query.includeInactive === 'true' || req.query.activeOnly === 'false') ? false : true;

    let result;
    if (type === 'daily') {
      result = await generateDailyReport(date, { userId, search, statusFilter, activeOnly });
    } else if (type === 'weekly') {
      result = await generateWeeklyReport(startDate, endDate, { userId, search, scope, activeOnly });
    } else if (type === 'monthly') {
      result = await generateMonthlyReport(month, { userId, search, scope, activeOnly });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid report type. Expected daily, weekly, or monthly.' });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/export
router.get('/reports/export', async (req, res) => {
  try {
    const { type = 'daily', scope = 'all', userId, date, startDate, endDate, month, search, statusFilter, format = 'xlsx' } = req.query;
    const activeOnly = (req.query.includeInactive === 'true' || req.query.activeOnly === 'false') ? false : true;

    if (type === 'daily') {
      const data = await generateDailyReport(date, { userId, search, statusFilter, activeOnly });
      const filename = `Daily_Report_${data.date}`;
      if (format === 'csv') {
        const csvData = generateDailyCsvString(data.records);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send(csvData);
      } else {
        const buffer = generateDailyExcelBuffer(data.records);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        return res.send(buffer);
      }
    } else if (type === 'weekly') {
      const data = await generateWeeklyReport(startDate, endDate, { userId, search, scope, activeOnly });
      if (scope === 'single') {
        const filename = `Timesheet_ID${userId}_Week_${data.startDate}_to_${data.endDate}`;
        if (format === 'csv') {
          const csvData = generateEmployeeTimesheetCsvString(data.employee, data.timesheet, data.totals, data.periodLabel);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          return res.send(csvData);
        } else {
          const buffer = generateEmployeeTimesheetExcelBuffer(data.employee, data.timesheet, data.totals, data.periodLabel);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          return res.send(buffer);
        }
      } else {
        const filename = `Weekly_Report_All_Users_${data.startDate}_to_${data.endDate}`;
        if (format === 'csv') {
          const csvData = generateWeeklyAllUsersCsvString(data.records);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          return res.send(csvData);
        } else {
          const buffer = generateWeeklyAllUsersExcelBuffer(data.records, data.periodLabel);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          return res.send(buffer);
        }
      }
    } else if (type === 'monthly') {
      const data = await generateMonthlyReport(month, { userId, search, scope, activeOnly });
      if (scope === 'single') {
        const filename = `Timesheet_ID${userId}_Month_${data.month}`;
        if (format === 'csv') {
          const csvData = generateEmployeeTimesheetCsvString(data.employee, data.timesheet, data.totals, data.periodLabel);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          return res.send(csvData);
        } else {
          const buffer = generateEmployeeTimesheetExcelBuffer(data.employee, data.timesheet, data.totals, data.periodLabel);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          return res.send(buffer);
        }
      } else if (scope === 'monthly_book') {
        const filename = `Monthly_Timesheets_All_Staff_Book_${data.month}`;
        if (format === 'csv') {
          const csvData = generateMonthlyBookCsvString(data.users || []);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          return res.send(csvData);
        } else {
          const buffer = generateMonthlyBookExcelBuffer(data.users || [], data.periodLabel);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          return res.send(buffer);
        }
      } else if (scope === 'monthly_matrix') {
        const filename = `Monthly_Attendance_Matrix_${data.month}`;
        if (format === 'csv') {
          const csvData = generateMonthlyMatrixCsvString(data);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          return res.send(csvData);
        } else {
          const buffer = generateMonthlyMatrixExcelBuffer(data);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          return res.send(buffer);
        }
      } else {
        const filename = `Monthly_Report_All_Users_${data.month}`;
        if (format === 'csv') {
          const csvData = generateMonthlyAllUsersCsvString(data.records);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          return res.send(csvData);
        } else {
          const buffer = generateMonthlyAllUsersExcelBuffer(data.records, data.periodLabel);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          return res.send(buffer);
        }
      }
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Trigger manual device sync
router.post('/device/sync', async (req, res) => {
  try {
    const body = req.body || {};
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const portSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
    const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);

    const ip = body.ip || (ipSetting ? ipSetting.value : '192.168.10.15');
    const port = parseInt(body.port || (portSetting ? portSetting.value : 4370), 10);
    const localAddress = body.interfaceIp || (ifaceIpSetting ? ifaceIpSetting.value : null);

    const result = await syncFromDevice(ip, port, localAddress);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Live device health and status check
router.get('/device/status', async (req, res) => {
  try {
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const portSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
    const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);

    const ip = ipSetting ? ipSetting.value : '192.168.10.15';
    const port = parseInt(portSetting ? portSetting.value : 4370, 10);
    const localAddress = ifaceIpSetting ? ifaceIpSetting.value : null;

    const health = await checkDeviceHealth(ip, port, localAddress);
    res.json({ success: true, ...health });
  } catch (err) {
    res.status(500).json({ success: false, online: false, error: err.message });
  }
});

// Test connection to device on demand
router.post('/device/test', async (req, res) => {
  try {
    const body = req.body || {};
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const portSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
    const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);

    const ip = body.ip || (ipSetting ? ipSetting.value : '192.168.10.15');
    const port = parseInt(body.port || (portSetting ? portSetting.value : 4370), 10);
    const localAddress = body.interfaceIp || (ifaceIpSetting ? ifaceIpSetting.value : null);

    const result = await checkDeviceHealth(ip, port, localAddress);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, online: false, error: err.message });
  }
});

// 6. Synchronize device clock
router.post('/device/sync-time', async (req, res) => {
  try {
    const body = req.body || {};
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const portSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
    const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);

    const ip = body.ip || (ipSetting ? ipSetting.value : '192.168.10.15');
    const port = parseInt(body.port || (portSetting ? portSetting.value : 4370), 10);
    const localAddress = body.interfaceIp || (ifaceIpSetting ? ifaceIpSetting.value : null);

    const client = new SpeedFaceClient(ip, port, 6000, localAddress);
    const result = await client.syncTime();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Reboot terminal
router.post('/device/reboot', async (req, res) => {
  try {
    const body = req.body || {};
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const portSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
    const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);

    const ip = body.ip || (ipSetting ? ipSetting.value : '192.168.10.15');
    const port = parseInt(body.port || (portSetting ? portSetting.value : 4370), 10);
    const localAddress = body.interfaceIp || (ifaceIpSetting ? ifaceIpSetting.value : null);

    const client = new SpeedFaceClient(ip, port, 6000, localAddress);
    const result = await client.reboot();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Data metrics summary for Data Management & Reset
router.get('/device/data-summary', async (req, res) => {
  try {
    const attCount = await dbGet(`SELECT COUNT(*) as count FROM attendance_records`);
    const empCount = await dbGet(`SELECT COUNT(*) as count FROM employees`);
    const logCount = await dbGet(`SELECT COUNT(*) as count FROM sync_logs`);

    res.json({
      success: true,
      attendanceCount: attCount?.count || 0,
      employeeCount: empCount?.count || 0,
      syncLogCount: logCount?.count || 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download full database backup as JSON
router.get('/device/backup-download', async (req, res) => {
  try {
    const attendance = await dbAll(`SELECT * FROM attendance_records ORDER BY punch_time DESC`);
    const employees = await dbAll(`SELECT * FROM employees ORDER BY user_id ASC`);
    const shifts = await dbAll(`SELECT * FROM working_shifts ORDER BY id ASC`);
    const holidays = await dbAll(`SELECT * FROM holidays ORDER BY holiday_date ASC`);
    const settings = await dbAll(`SELECT * FROM settings`);

    const backup = {
      backup_timestamp: new Date().toISOString(),
      attendance_records: attendance,
      employees: employees,
      working_shifts: shifts,
      holidays: holidays,
      settings: settings
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_backup_${dateStr}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset employees, attendance records, and/or terminal logs
router.post('/device/reset-data', async (req, res) => {
  try {
    const {
      resetAttendance = false,
      resetEmployees = false,
      resetSyncLogs = false,
      clearTerminalLogs = false,
      confirmText = ''
    } = req.body || {};

    if (String(confirmText).trim().toUpperCase() !== 'RESET') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation failed. Please type RESET to confirm data deletion.'
      });
    }

    if (!resetAttendance && !resetEmployees && !resetSyncLogs && !clearTerminalLogs) {
      return res.status(400).json({
        success: false,
        error: 'No reset options were selected. Please select at least one item to reset.'
      });
    }

    let deletedAttendance = 0;
    let deletedEmployees = 0;
    let deletedLogs = 0;
    let terminalResult = null;

    if (resetAttendance) {
      const row = await dbGet(`SELECT COUNT(*) as count FROM attendance_records`);
      deletedAttendance = row ? row.count : 0;
      await dbRun(`DELETE FROM attendance_records`);
    }

    if (resetEmployees) {
      const row = await dbGet(`SELECT COUNT(*) as count FROM employees`);
      deletedEmployees = row ? row.count : 0;
      await dbRun(`DELETE FROM employees`);
    }

    if (resetSyncLogs) {
      const row = await dbGet(`SELECT COUNT(*) as count FROM sync_logs`);
      deletedLogs = row ? row.count : 0;
      await dbRun(`DELETE FROM sync_logs`);
    }

    // Optional clearing of punch records on physical hardware terminal
    if (clearTerminalLogs) {
      const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
      const portSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
      const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);

      const ip = ipSetting ? ipSetting.value : '192.168.10.15';
      const port = parseInt(portSetting ? portSetting.value : 4370, 10);
      const localAddress = ifaceIpSetting ? ifaceIpSetting.value : null;

      try {
        const client = new SpeedFaceClient(ip, port, 8000, localAddress);
        terminalResult = await client.clearAttendanceLogs();
      } catch (tErr) {
        terminalResult = { success: false, error: tErr.message };
      }
    }

    // Vacuum database to reclaim disk space
    try {
      await dbRun(`VACUUM`);
    } catch (vErr) {}

    // Audit log
    const auditMsg = `Data reset performed: ${deletedAttendance} attendance records deleted, ${deletedEmployees} employees deleted, ${deletedLogs} sync logs cleared.${clearTerminalLogs ? ' Terminal punch logs also wiped.' : ''}`;
    try {
      await dbRun(`
        INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message)
        VALUES ('SYSTEM_RESET', 'SUCCESS', 0, 0, ?)
      `, [auditMsg]);
    } catch (lErr) {}

    res.json({
      success: true,
      message: auditMsg,
      deletedAttendance,
      deletedEmployees,
      deletedLogs,
      terminalResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Employee Directory management & Export
router.get('/employees/export', async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const employees = await dbAll(`
      SELECT 
        e.*,
        s.name as shift_name,
        s.start_time as shift_start,
        s.end_time as shift_end,
        COUNT(a.id) as total_punches,
        MAX(a.punch_time) as last_seen
      FROM employees e
      LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
      LEFT JOIN attendance_records a ON e.user_id = a.user_id
      GROUP BY e.user_id
      ORDER BY CAST(e.user_id AS INTEGER) ASC, e.user_id ASC
    `);

    const dateStamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const csvData = generateEmployeeCsvString(employees);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="SpeedFace_Employees_${dateStamp}.csv"`);
      return res.send(csvData);
    } else {
      const buffer = generateEmployeeExcelBuffer(employees);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="SpeedFace_Employees_${dateStamp}.xlsx"`);
      return res.send(buffer);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.1 Employee Sample Template Download
router.get('/employees/sample-template', async (req, res) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const sampleRows = [
      {
        'FingerPrint ID': '101',
        'Service ID': 'EMP001',
        'NIC': '198512345678',
        'Title': 'Mr',
        'Full Name': 'Sampath Perera',
        'Gender': 'Male',
        'Birthday': '1985-04-12',
        'Appointment Date': '2020-01-15',
        'Status': 'Permanent',
        'Active Status': 'Active',
        'Mobile / Phone': '0771234567',
        'Email': 'sampath@company.com',
        'Department': 'Information Technology',
        'Role': 'Systems Administrator',
        'Assigned Shift': 'General Shift',
        'Card #': '1004523'
      },
      {
        'FingerPrint ID': '102',
        'Service ID': 'EMP002',
        'NIC': '199056781234',
        'Title': 'Ms',
        'Full Name': 'Nirmala Fernando',
        'Gender': 'Female',
        'Birthday': '1990-08-20',
        'Appointment Date': '2021-05-10',
        'Status': 'Permanent',
        'Active Status': 'Active',
        'Mobile / Phone': '0719876543',
        'Email': 'nirmala@company.com',
        'Department': 'Finance & Accounts',
        'Role': 'Senior Accountant',
        'Assigned Shift': 'General Shift',
        'Card #': '1004524'
      },
      {
        'FingerPrint ID': '103',
        'Service ID': 'EMP003',
        'NIC': '199523456789',
        'Title': 'Mr',
        'Full Name': 'Kasun Jayasinghe',
        'Gender': 'Male',
        'Birthday': '1995-11-03',
        'Appointment Date': '2023-02-01',
        'Status': 'Contract',
        'Active Status': 'Active',
        'Mobile / Phone': '0751122334',
        'Email': 'kasun@company.com',
        'Department': 'Operations',
        'Role': 'Field Officer',
        'Assigned Shift': 'General Shift',
        'Card #': ''
      }
    ];

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(sampleRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees_Template');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="SpeedFace_Employees_Template.xlsx"');
      return res.send(buffer);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(sampleRows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="SpeedFace_Employees_Template.csv"');
      return res.send(csv);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.2 Parse Employee File / CSV (for client preview)
router.post('/employees/parse', async (req, res) => {
  try {
    const { csvText, fileData } = req.body;
    let list = { valid: [], errors: [] };
    const shifts = await dbAll('SELECT id, name FROM working_shifts');

    if (fileData) {
      let buffer;
      if (fileData.startsWith('data:')) {
        const base64Data = fileData.split(';base64,')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
      list = parseEmployeesInput(buffer, shifts);
    } else if (csvText) {
      list = parseEmployeesInput(csvText, shifts);
    } else {
      return res.status(400).json({ success: false, error: 'No file data or CSV text provided' });
    }

    res.json({
      success: true,
      count: list.valid.length,
      employees: list.valid,
      errors: list.errors
    });
  } catch (err) {
    res.status(400).json({ success: false, error: `Parse error: ${err.message}` });
  }
});

// 8.3 Bulk Upload / Import Employees
router.post('/employees/upload', async (req, res) => {
  try {
    const { csvText, fileData, employees: preParsed, replaceExisting = false, syncToDevice = false } = req.body;
    let employeeList = [];
    const shifts = await dbAll('SELECT id, name FROM working_shifts');

    if (Array.isArray(preParsed) && preParsed.length > 0) {
      employeeList = preParsed;
    } else if (fileData) {
      let buffer;
      if (fileData.startsWith('data:')) {
        const base64Data = fileData.split(';base64,')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
      const parsed = parseEmployeesInput(buffer, shifts);
      employeeList = parsed.valid;
    } else if (csvText) {
      const parsed = parseEmployeesInput(csvText, shifts);
      employeeList = parsed.valid;
    } else {
      return res.status(400).json({ success: false, error: 'No employee records or file data provided' });
    }

    if (employeeList.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid employee records found to import' });
    }

    if (replaceExisting) {
      await dbRun('DELETE FROM employees');
    }

    let insertedCount = 0;
    for (const emp of employeeList) {
      if (!emp.user_id) continue;
      const sId = parseInt(emp.shift_id, 10) || 1;
      const activeVal = emp.is_active !== undefined ? (emp.is_active ? 1 : 0) : 1;

      await dbRun(`
        INSERT INTO employees (
          user_id, name, department, role, email, phone, shift_id,
          employee_service_id, nic, title, first_name, last_name, gender, birthday, appointment_date, employment_status, order_by_id, is_active, card_no, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          department = excluded.department,
          role = excluded.role,
          email = excluded.email,
          phone = excluded.phone,
          shift_id = excluded.shift_id,
          employee_service_id = COALESCE(excluded.employee_service_id, employees.employee_service_id),
          nic = COALESCE(excluded.nic, employees.nic),
          title = COALESCE(excluded.title, employees.title),
          first_name = COALESCE(excluded.first_name, employees.first_name),
          last_name = COALESCE(excluded.last_name, employees.last_name),
          gender = COALESCE(excluded.gender, employees.gender),
          birthday = COALESCE(excluded.birthday, employees.birthday),
          appointment_date = COALESCE(excluded.appointment_date, employees.appointment_date),
          employment_status = COALESCE(excluded.employment_status, employees.employment_status),
          order_by_id = COALESCE(excluded.order_by_id, employees.order_by_id),
          is_active = excluded.is_active,
          card_no = COALESCE(excluded.card_no, employees.card_no),
          updated_at = CURRENT_TIMESTAMP
      `, [
        emp.user_id,
        emp.name || `Employee ${emp.user_id}`,
        emp.department || 'General',
        emp.role || 'Staff',
        emp.email || null,
        emp.phone || null,
        sId,
        emp.employee_service_id || null,
        emp.nic || null,
        emp.title || null,
        emp.first_name || null,
        emp.last_name || null,
        emp.gender || null,
        emp.birthday || null,
        emp.appointment_date || null,
        emp.employment_status || 'Permanent',
        emp.order_by_id || null,
        activeVal,
        emp.card_no || null
      ]);
      insertedCount++;
    }

    let deviceSyncCount = 0;
    let deviceSyncError = null;

    if (syncToDevice && insertedCount > 0) {
      try {
        const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
        const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);
        const ip = ipSetting ? ipSetting.value : '192.168.10.15';
        const localAddress = ifaceIpSetting ? ifaceIpSetting.value : null;

        const client = new SpeedFaceClient(ip, 4370, 8000, localAddress);
        const usersToSync = employeeList.filter(e => e.user_id).map(e => ({
          user_id: e.user_id,
          name: e.name || `Employee ${e.user_id}`,
          role: (e.role === 'Admin' || e.role === '14') ? 14 : 0
        }));

        const pushRes = await client.setUsersBatch(usersToSync);
        if (pushRes && pushRes.success) {
          deviceSyncCount = pushRes.count || usersToSync.length;
        } else if (pushRes && pushRes.error) {
          deviceSyncError = pushRes.error;
        }
      } catch (devErr) {
        deviceSyncError = devErr.message;
      }
    }

    // Add audit log entry
    const auditMsg = `Employee batch upload: ${insertedCount} employees ${replaceExisting ? 'imported (replaced)' : 'imported/updated'}.${deviceSyncCount > 0 ? ` ${deviceSyncCount} pushed to terminal.` : ''}`;
    try {
      await dbRun(`
        INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message)
        VALUES ('EMPLOYEE_IMPORT', 'SUCCESS', ?, ?, ?)
      `, [insertedCount, employeeList.length, auditMsg]);
    } catch (lErr) {}

    res.json({
      success: true,
      count: insertedCount,
      deviceSyncCount,
      deviceSyncError,
      message: auditMsg
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/employees', async (req, res) => {
  try {
    const status = req.query.status || 'all';
    let whereClause = '';
    if (status === 'active') {
      whereClause = 'WHERE COALESCE(e.is_active, 1) = 1';
    } else if (status === 'inactive') {
      whereClause = 'WHERE COALESCE(e.is_active, 1) = 0';
    }

    const employees = await dbAll(`
      SELECT 
        e.*,
        COALESCE(e.is_active, 1) as is_active,
        s.name as shift_name,
        s.start_time as shift_start,
        s.end_time as shift_end,
        s.color as shift_color,
        s.work_days as shift_work_days,
        COUNT(a.id) as total_punches,
        MAX(a.punch_time) as last_seen
      FROM employees e
      LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
      LEFT JOIN attendance_records a ON e.user_id = a.user_id
      ${whereClause}
      GROUP BY e.user_id
      ORDER BY CAST(e.user_id AS INTEGER) ASC, e.user_id ASC
    `);

    const countRow = await dbGet(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN COALESCE(is_active, 1) = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN COALESCE(is_active, 1) = 0 THEN 1 ELSE 0 END) as inactive
      FROM employees
    `);

    res.json({
      success: true,
      employees,
      counts: {
        total: countRow?.total || 0,
        active: countRow?.active || 0,
        inactive: countRow?.inactive || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quick toggle active status for an employee
router.post('/employees/:id/toggle-active', async (req, res) => {
  try {
    const userId = req.params.id;
    const emp = await dbGet(`SELECT user_id, name, is_active FROM employees WHERE user_id = ?`, [userId]);
    if (!emp) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    const current = emp.is_active !== undefined && emp.is_active !== null ? emp.is_active : 1;
    const newStatus = current === 1 ? 0 : 1;
    await dbRun(`UPDATE employees SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [newStatus, userId]);
    res.json({
      success: true,
      user_id: userId,
      is_active: newStatus,
      message: `Employee ${emp.name || userId} is now ${newStatus === 1 ? 'Active' : 'Inactive'}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/employees', async (req, res) => {
  try {
    const {
      user_id, name, department, role, email, phone, photo, shift_id = 1, syncToDevice = true,
      employee_service_id, nic, title, first_name, last_name, gender, birthday, appointment_date, employment_status, order_by_id, is_active
    } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    let photoPath = null;
    let photoBuffer = null;
    let cleanBase64 = null;

    if (photo) {
      if (photo.startsWith('data:image')) {
        cleanBase64 = photo.replace(/^data:image\/\w+;base64,/, '');
      } else if (photo.startsWith('/uploads/')) {
        photoPath = photo;
      } else if (photo.length > 100) {
        cleanBase64 = photo;
      }

      if (cleanBase64) {
        photoBuffer = Buffer.from(cleanBase64, 'base64');
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'photos');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, `${user_id}.jpg`);
        fs.writeFileSync(filePath, photoBuffer);
        photoPath = `/uploads/photos/${user_id}.jpg`;
      }
    }

    const sId = parseInt(shift_id, 10) || 1;

    if (photoPath !== null) {
      await dbRun(`
        INSERT INTO employees (
          user_id, name, department, role, email, phone, photo, shift_id,
          employee_service_id, nic, title, first_name, last_name, gender, birthday, appointment_date, employment_status, order_by_id, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          department = excluded.department,
          role = excluded.role,
          email = excluded.email,
          phone = excluded.phone,
          photo = excluded.photo,
          shift_id = excluded.shift_id,
          employee_service_id = COALESCE(excluded.employee_service_id, employees.employee_service_id),
          nic = COALESCE(excluded.nic, employees.nic),
          title = COALESCE(excluded.title, employees.title),
          first_name = COALESCE(excluded.first_name, employees.first_name),
          last_name = COALESCE(excluded.last_name, employees.last_name),
          gender = COALESCE(excluded.gender, employees.gender),
          birthday = COALESCE(excluded.birthday, employees.birthday),
          appointment_date = COALESCE(excluded.appointment_date, employees.appointment_date),
          employment_status = COALESCE(excluded.employment_status, employees.employment_status),
          order_by_id = COALESCE(excluded.order_by_id, employees.order_by_id),
          is_active = excluded.is_active,
          updated_at = CURRENT_TIMESTAMP
      `, [user_id, name || '', department || 'General', role || 'Staff', email || '', phone || '', photoPath, sId,
          employee_service_id || null, nic || null, title || null, first_name || null, last_name || null, gender || null, birthday || null, appointment_date || null, employment_status || null, order_by_id || null, activeVal]);
    } else {
      await dbRun(`
        INSERT INTO employees (
          user_id, name, department, role, email, phone, shift_id,
          employee_service_id, nic, title, first_name, last_name, gender, birthday, appointment_date, employment_status, order_by_id, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          department = excluded.department,
          role = excluded.role,
          email = excluded.email,
          phone = excluded.phone,
          shift_id = excluded.shift_id,
          employee_service_id = COALESCE(excluded.employee_service_id, employees.employee_service_id),
          nic = COALESCE(excluded.nic, employees.nic),
          title = COALESCE(excluded.title, employees.title),
          first_name = COALESCE(excluded.first_name, employees.first_name),
          last_name = COALESCE(excluded.last_name, employees.last_name),
          gender = COALESCE(excluded.gender, employees.gender),
          birthday = COALESCE(excluded.birthday, employees.birthday),
          appointment_date = COALESCE(excluded.appointment_date, employees.appointment_date),
          employment_status = COALESCE(excluded.employment_status, employees.employment_status),
          order_by_id = COALESCE(excluded.order_by_id, employees.order_by_id),
          is_active = excluded.is_active,
          updated_at = CURRENT_TIMESTAMP
      `, [user_id, name || '', department || 'General', role || 'Staff', email || '', phone || '', sId,
          employee_service_id || null, nic || null, title || null, first_name || null, last_name || null, gender || null, birthday || null, appointment_date || null, employment_status || null, order_by_id || null, activeVal]);
    }

    let deviceSynced = false;
    let photoSynced = false;
    let deviceError = null;

    if (syncToDevice) {
      try {
        const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
        const ip = ipSetting ? ipSetting.value : '192.168.10.15';
        const client = new SpeedFaceClient(ip, 4370, 6000);
        
        await client.setUser({
          userId: user_id,
          name: name || '',
          role: (role === 'Admin' || role === '14' || role === 14) ? 14 : 0
        });
        deviceSynced = true;

        if (photoBuffer && cleanBase64) {
          queuePhotoUpload(user_id, cleanBase64);
          const pRes = await client.uploadUserPhoto(user_id, photoBuffer);
          if (pRes && pRes.success) {
            photoSynced = true;
          }
        }
      } catch (dErr) {
        console.warn('[EMPLOYEE] Could not sync user to device:', dErr.message);
        deviceError = dErr.message;
      }
    }

    let msg = 'Employee updated successfully!';
    if (deviceSynced) {
      msg = photoBuffer 
        ? 'Employee details & photo synced to SpeedFace terminal!' 
        : 'Employee updated and synced to SpeedFace device!';
    } else if (deviceError) {
      msg = `Employee updated locally (Device sync notice: ${deviceError})`;
    }

    res.json({ 
      success: true, 
      deviceSynced,
      photoSynced,
      photoUrl: photoPath,
      deviceError,
      message: msg
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk assign shift to employees
router.post('/employees/assign-shift', async (req, res) => {
  try {
    const { shift_id, user_ids = [], department = '' } = req.body;
    if (!shift_id) {
      return res.status(400).json({ success: false, error: 'Shift ID is required' });
    }

    const sId = parseInt(shift_id, 10);
    let updatedCount = 0;

    if (Array.isArray(user_ids) && user_ids.length > 0) {
      const placeholders = user_ids.map(() => '?').join(',');
      const result = await dbRun(
        `UPDATE employees SET shift_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id IN (${placeholders})`,
        [sId, ...user_ids]
      );
      updatedCount = result.changes;
    } else if (department) {
      const result = await dbRun(
        `UPDATE employees SET shift_id = ?, updated_at = CURRENT_TIMESTAMP WHERE department = ?`,
        [sId, department]
      );
      updatedCount = result.changes;
    } else {
      const result = await dbRun(`UPDATE employees SET shift_id = ?, updated_at = CURRENT_TIMESTAMP`, [sId]);
      updatedCount = result.changes;
    }

    res.json({ success: true, count: updatedCount, message: `Assigned shift to ${updatedCount} employee(s)!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Working Shifts CRUD
router.get('/shifts', async (req, res) => {
  try {
    const shifts = await dbAll(`
      SELECT 
        s.*,
        COUNT(e.user_id) as employee_count
      FROM working_shifts s
      LEFT JOIN employees e ON s.id = e.shift_id
      GROUP BY s.id
      ORDER BY s.id ASC
    `);
    res.json({ success: true, shifts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/shifts', async (req, res) => {
  try {
    const { 
      name, 
      start_time, 
      end_time, 
      grace_period_mins = 30, 
      monthly_grace_days = 2,
      late_cover_end = 1,
      half_day_hours = 3.5, 
      late_half_day_hours = 4.0,
      full_day_hours = 7.75, 
      monthly_short_leaves = 2,
      morning_short_leave_start = '09:00',
      morning_short_leave_end = '10:00',
      evening_short_leave_start = '14:45',
      evening_short_leave_end = '16:15',
      disallow_grace_and_short_leave_same_day = 1,
      ot_min_mins = 60,
      ot_step_mins = 15,
      enable_morning_grace = 1,
      enable_short_leave = 1,
      enable_half_day_calc = 1,
      enable_overtime = 1,
      work_days = '1,2,3,4,5', 
      color = '#2563eb', 
      is_default = 0 
    } = req.body;

    if (!name || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'Shift name, start time, and end time are required' });
    }

    if (is_default) {
      await dbRun(`UPDATE working_shifts SET is_default = 0`);
    }

    const result = await dbRun(`
      INSERT INTO working_shifts (
        name, start_time, end_time, grace_period_mins, monthly_grace_days, late_cover_end, 
        half_day_hours, late_half_day_hours, full_day_hours, 
        monthly_short_leaves, morning_short_leave_start, morning_short_leave_end, evening_short_leave_start, evening_short_leave_end, disallow_grace_and_short_leave_same_day,
        ot_min_mins, ot_step_mins,
        enable_morning_grace, enable_short_leave, enable_half_day_calc, enable_overtime,
        work_days, color, is_default
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(), 
      start_time.trim(), 
      end_time.trim(), 
      parseInt(grace_period_mins, 10) || 30, 
      parseInt(monthly_grace_days, 10) || 2,
      late_cover_end ? 1 : 0,
      parseFloat(half_day_hours) || 3.5, 
      parseFloat(late_half_day_hours) || 4.0,
      parseFloat(full_day_hours) || 7.75, 
      parseInt(monthly_short_leaves, 10) || 2,
      (morning_short_leave_start || '09:00').trim(),
      (morning_short_leave_end || '10:00').trim(),
      (evening_short_leave_start || '14:45').trim(),
      (evening_short_leave_end || '16:15').trim(),
      disallow_grace_and_short_leave_same_day ? 1 : 0,
      parseInt(ot_min_mins, 10) || 60,
      parseInt(ot_step_mins, 10) || 15,
      enable_morning_grace !== undefined ? (enable_morning_grace ? 1 : 0) : 1,
      enable_short_leave !== undefined ? (enable_short_leave ? 1 : 0) : 1,
      enable_half_day_calc !== undefined ? (enable_half_day_calc ? 1 : 0) : 1,
      enable_overtime !== undefined ? (enable_overtime ? 1 : 0) : 1,
      work_days.trim(), 
      color || '#2563eb', 
      is_default ? 1 : 0
    ]);

    res.json({ success: true, id: result.lastID, message: 'Working shift created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/shifts/:id', async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id, 10);
    const { 
      name, 
      start_time, 
      end_time, 
      grace_period_mins, 
      monthly_grace_days,
      late_cover_end,
      half_day_hours, 
      late_half_day_hours,
      full_day_hours, 
      monthly_short_leaves,
      morning_short_leave_start,
      morning_short_leave_end,
      evening_short_leave_start,
      evening_short_leave_end,
      disallow_grace_and_short_leave_same_day,
      ot_min_mins,
      ot_step_mins,
      enable_morning_grace,
      enable_short_leave,
      enable_half_day_calc,
      enable_overtime,
      work_days, 
      color, 
      is_default 
    } = req.body;

    if (is_default) {
      await dbRun(`UPDATE working_shifts SET is_default = 0`);
    }

    await dbRun(`
      UPDATE working_shifts SET
        name = COALESCE(?, name),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        grace_period_mins = COALESCE(?, grace_period_mins),
        monthly_grace_days = COALESCE(?, monthly_grace_days),
        late_cover_end = COALESCE(?, late_cover_end),
        half_day_hours = COALESCE(?, half_day_hours),
        late_half_day_hours = COALESCE(?, late_half_day_hours),
        full_day_hours = COALESCE(?, full_day_hours),
        monthly_short_leaves = COALESCE(?, monthly_short_leaves),
        morning_short_leave_start = COALESCE(?, morning_short_leave_start),
        morning_short_leave_end = COALESCE(?, morning_short_leave_end),
        evening_short_leave_start = COALESCE(?, evening_short_leave_start),
        evening_short_leave_end = COALESCE(?, evening_short_leave_end),
        disallow_grace_and_short_leave_same_day = COALESCE(?, disallow_grace_and_short_leave_same_day),
        ot_min_mins = COALESCE(?, ot_min_mins),
        ot_step_mins = COALESCE(?, ot_step_mins),
        enable_morning_grace = COALESCE(?, enable_morning_grace),
        enable_short_leave = COALESCE(?, enable_short_leave),
        enable_half_day_calc = COALESCE(?, enable_half_day_calc),
        enable_overtime = COALESCE(?, enable_overtime),
        work_days = COALESCE(?, work_days),
        color = COALESCE(?, color),
        is_default = COALESCE(?, is_default)
      WHERE id = ?
    `, [
      name ? name.trim() : null,
      start_time ? start_time.trim() : null,
      end_time ? end_time.trim() : null,
      grace_period_mins !== undefined ? parseInt(grace_period_mins, 10) : null,
      monthly_grace_days !== undefined ? parseInt(monthly_grace_days, 10) : null,
      late_cover_end !== undefined ? (late_cover_end ? 1 : 0) : null,
      half_day_hours !== undefined ? parseFloat(half_day_hours) : null,
      late_half_day_hours !== undefined ? parseFloat(late_half_day_hours) : null,
      full_day_hours !== undefined ? parseFloat(full_day_hours) : null,
      monthly_short_leaves !== undefined ? parseInt(monthly_short_leaves, 10) : null,
      morning_short_leave_start ? morning_short_leave_start.trim() : null,
      morning_short_leave_end ? morning_short_leave_end.trim() : null,
      evening_short_leave_start ? evening_short_leave_start.trim() : null,
      evening_short_leave_end ? evening_short_leave_end.trim() : null,
      disallow_grace_and_short_leave_same_day !== undefined ? (disallow_grace_and_short_leave_same_day ? 1 : 0) : null,
      ot_min_mins !== undefined ? parseInt(ot_min_mins, 10) : null,
      ot_step_mins !== undefined ? parseInt(ot_step_mins, 10) : null,
      enable_morning_grace !== undefined ? (enable_morning_grace ? 1 : 0) : null,
      enable_short_leave !== undefined ? (enable_short_leave ? 1 : 0) : null,
      enable_half_day_calc !== undefined ? (enable_half_day_calc ? 1 : 0) : null,
      enable_overtime !== undefined ? (enable_overtime ? 1 : 0) : null,
      work_days ? work_days.trim() : null,
      color || null,
      is_default !== undefined ? (is_default ? 1 : 0) : null,
      shiftId
    ]);

    res.json({ success: true, message: 'Working shift updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/shifts/:id', async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id, 10);
    const shift = await dbGet(`SELECT * FROM working_shifts WHERE id = ?`, [shiftId]);
    if (!shift) {
      return res.status(404).json({ success: false, error: 'Shift not found' });
    }
    if (shift.is_default || shiftId === 1) {
      return res.status(400).json({ success: false, error: 'Cannot delete the default working shift' });
    }

    // Reassign employees to default shift (1)
    await dbRun(`UPDATE employees SET shift_id = 1 WHERE shift_id = ?`, [shiftId]);
    await dbRun(`DELETE FROM working_shifts WHERE id = ?`, [shiftId]);

    res.json({ success: true, message: 'Shift deleted, assigned employees moved to default shift' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Holidays CRUD
router.get('/holidays', async (req, res) => {
  try {
    const holidays = await dbAll(`SELECT * FROM holidays ORDER BY holiday_date ASC`);
    res.json({ success: true, holidays });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/holidays', async (req, res) => {
  try {
    const {
      name,
      holiday_date,
      holiday_type = 'Public Holiday',
      is_recurring = 0,
      bank_holiday = 0,
      public_holiday = 1,
      mercantile_holiday = 0
    } = req.body;

    if (!name || !holiday_date) {
      return res.status(400).json({ success: false, error: 'Holiday name and date are required' });
    }

    await dbRun(`
      INSERT OR REPLACE INTO holidays (name, holiday_date, holiday_type, bank_holiday, public_holiday, mercantile_holiday, is_recurring)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      holiday_date.trim(),
      holiday_type.trim(),
      bank_holiday ? 1 : 0,
      public_holiday ? 1 : 0,
      mercantile_holiday ? 1 : 0,
      is_recurring ? 1 : 0
    ]);

    res.json({ success: true, message: 'Holiday saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/holidays/parse', async (req, res) => {
  try {
    const { csvText, fileData } = req.body;
    let list = [];

    if (fileData) {
      const base64Content = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      const buffer = Buffer.from(base64Content, 'base64');
      list = parseHolidaysInput(buffer);
    } else if (csvText) {
      list = parseHolidaysInput(csvText);
    } else {
      return res.status(400).json({ success: false, error: 'No file data or CSV text provided' });
    }

    res.json({
      success: true,
      count: list.length,
      holidays: list
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/holidays/upload', async (req, res) => {
  try {
    const { csvText, fileData, holidays: preParsed, replaceExisting = false } = req.body;
    let list = [];

    if (Array.isArray(preParsed) && preParsed.length > 0) {
      list = preParsed;
    } else if (fileData) {
      const base64Content = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      const buffer = Buffer.from(base64Content, 'base64');
      list = parseHolidaysInput(buffer);
    } else if (csvText) {
      list = parseHolidaysInput(csvText);
    } else {
      return res.status(400).json({ success: false, error: 'No file data, CSV text, or holiday records provided' });
    }

    if (!list || list.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid holiday records found in upload' });
    }

    if (replaceExisting) {
      await dbRun(`DELETE FROM holidays`);
    }

    let insertedCount = 0;
    for (const h of list) {
      if (!h.name || !h.holiday_date) continue;
      await dbRun(`
        INSERT OR REPLACE INTO holidays (name, holiday_date, holiday_type, bank_holiday, public_holiday, mercantile_holiday, is_recurring)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        h.name.trim(),
        h.holiday_date.trim(),
        (h.holiday_type || 'Public Holiday').trim(),
        h.bank_holiday ? 1 : 0,
        h.public_holiday !== undefined ? (h.public_holiday ? 1 : 0) : 1,
        h.mercantile_holiday ? 1 : 0,
        h.is_recurring ? 1 : 0
      ]);
      insertedCount++;
    }

    res.json({
      success: true,
      message: `Successfully processed and saved ${insertedCount} holidays.`,
      count: insertedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/holidays/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await dbRun(`DELETE FROM holidays WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Holiday removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Push all customized employees to SpeedFace device in batch
router.post('/employees/sync-all', async (req, res) => {
  try {
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const ip = ipSetting ? ipSetting.value : '192.168.10.15';
    const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);
    const localAddress = ifaceIpSetting ? ifaceIpSetting.value : null;

    const employees = await dbAll(`SELECT * FROM employees WHERE name IS NOT NULL AND name != ''`);
    if (!employees || employees.length === 0) {
      return res.json({ success: true, count: 0, message: 'No employee names configured yet to sync' });
    }

    const client = new SpeedFaceClient(ip, 4370, 10000, localAddress);
    const result = await client.setUsersBatch(employees);

    res.json({
      success: true,
      count: result.count,
      message: `Successfully synced ${result.count} employee(s) to SpeedFace terminal!`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Local network IPs for SpeedFace Cloud Server setup
router.get('/network-ips', async (req, res) => {
  try {
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const deviceIp = ipSetting ? ipSetting.value : '192.168.10.15';
    const ips = getLocalIps(deviceIp);
    res.json({
      success: true,
      serverPort: 8088,
      ips
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Network interfaces list with active selection and subnet matching
router.get('/network-interfaces', async (req, res) => {
  try {
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const ifaceSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface'`);
    const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);

    const deviceIp = ipSetting ? ipSetting.value : '192.168.10.15';
    const interfaces = getLocalIps(deviceIp);

    res.json({
      success: true,
      interfaces,
      selectedInterface: ifaceSetting ? ifaceSetting.value : (interfaces[0]?.name || ''),
      selectedInterfaceIp: ifaceIpSetting ? ifaceIpSetting.value : (interfaces[0]?.ip || ''),
      deviceIp,
      serverPort: 8088
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test connection on specific network interface
router.post('/network-interfaces/test', async (req, res) => {
  try {
    const body = req.body || {};
    const ipSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
    const portSetting = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
    const ifaceIpSetting = await dbGet(`SELECT value FROM settings WHERE key = 'network_interface_ip'`);

    const deviceIp = body.deviceIp || (ipSetting ? ipSetting.value : '192.168.10.15');
    const port = parseInt(body.port || (portSetting ? portSetting.value : 4370), 10);
    const interfaceIp = body.interfaceIp || (ifaceIpSetting ? ifaceIpSetting.value : null);

    const client = new SpeedFaceClient(deviceIp, port, 4000, interfaceIp);
    const result = await client.testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Settings management
router.get('/settings', async (req, res) => {
  try {
    const rows = await dbAll(`SELECT key, value FROM settings`);
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const body = req.body || {};
    const settingKeys = [
      'device_ip', 'device_port', 'auto_sync_interval', 'auto_sync_enabled',
      'network_interface', 'network_interface_ip',
      'org_name', 'org_subtitle', 'org_address', 'org_phone', 'org_email', 'org_website', 'org_footer', 'org_logo'
    ];

    for (const key of settingKeys) {
      if (body[key] !== undefined) {
        await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, String(body[key]).trim()]);
      }
    }

    if (body.auto_sync_enabled !== undefined) {
      if (String(body.auto_sync_enabled) === 'false') {
        stopAutoSync();
      } else {
        startAutoSync(parseInt(body.auto_sync_interval || '60', 10));
      }
    }

    const rows = await dbAll(`SELECT key, value FROM settings`);
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    // Trigger instant check on newly saved interface & IP in background
    setTimeout(() => {
      checkDeviceHealth(settings.device_ip, settings.device_port, settings.network_interface_ip).catch(() => {});
    }, 100);

    res.json({ success: true, message: 'Settings saved successfully', settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Sync History Logs
router.get('/sync-logs', async (req, res) => {
  try {
    const logs = await dbAll(`SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 30`);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Production System Diagnostics & Backups
router.get('/system/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const logs = logger.getRecentLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/system/backups', (req, res) => {
  try {
    if (!fs.existsSync(config.backupDir)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(config.backupDir)
      .filter(f => f.startsWith('attendance_backup_') && f.endsWith('.db'))
      .map(f => {
        const fullPath = path.join(config.backupDir, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          createdAt: stats.mtime.toISOString(),
          createdAtFormatted: stats.mtime.toLocaleString()
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, count: files.length, backups: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/system/backups/create', async (req, res) => {
  try {
    const result = await runDatabaseBackup();
    if (result.success) {
      res.json({ success: true, message: `Backup created successfully: ${result.filename}`, backup: result });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to create backup' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/system/backups/download/:filename', (req, res) => {
  try {
    const rawFilename = req.params.filename;
    // Security check against directory traversal
    const safeFilename = path.basename(rawFilename);
    const fullPath = path.join(config.backupDir, safeFilename);

    if (!fs.existsSync(fullPath) || !safeFilename.endsWith('.db')) {
      return res.status(404).json({ success: false, error: 'Backup file not found' });
    }

    res.download(fullPath, safeFilename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// API SERVICE - INTEGRATION REST ENDPOINTS
// =========================================================================

/**
 * GET /api/v1/docs & GET /api/v1
 * Returns metadata and schema documentation for available REST endpoints.
 */
router.get(['/v1', '/v1/docs'], (req, res) => {
  res.json({
    success: true,
    service: 'SpeedFace-V5L Attendance API Service',
    version: '1.0.0',
    description: 'RESTful API for accessing employee profiles and calculated attendance records.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/users',
        alias: '/api/users',
        description: 'Get all enrolled users with complete profile details, shift assignments, and punch stats',
        parameters: {
          status: 'Filter by active status (active, inactive, all). Default: all',
          department: 'Filter by department name',
          search: 'Search across User ID, Name, NIC, Service ID, Phone, Email',
          page: 'Page number (optional)',
          limit: 'Page size limit (optional)'
        }
      },
      {
        method: 'GET',
        path: '/api/v1/users/:userId/attendance',
        alias: '/api/users/:userId/attendance',
        description: 'Get calculated attendance records with daily status, punctuality, grace, short leaves, OT, and period totals for a user',
        parameters: {
          userId: 'Employee User ID (Path parameter, required)',
          month: 'Target month in YYYY-MM format (e.g. 2026-09). Defaults to current month',
          date: 'Single date in YYYY-MM-DD format (optional)',
          startDate: 'Range start date in YYYY-MM-DD format (optional)',
          endDate: 'Range end date in YYYY-MM-DD format (optional)',
          includePunches: 'Include array of raw punches for each day (true/false, default: true)'
        }
      }
    ]
  });
});

/**
 * GET /api/v1/users & GET /api/users
 * Returns list of all users with full profile details, assigned shift details,
 * active status, and overall punch statistics.
 */
router.get(['/v1/users', '/users'], async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    // Filter by status
    const status = (req.query.status || 'all').toLowerCase();
    if (status === 'active') {
      conditions.push('COALESCE(e.is_active, 1) = 1');
    } else if (status === 'inactive') {
      conditions.push('COALESCE(e.is_active, 1) = 0');
    }

    // Filter by department
    if (req.query.department) {
      conditions.push('e.department = ?');
      params.push(req.query.department);
    }

    // Filter by search
    if (req.query.search) {
      conditions.push('(e.user_id LIKE ? OR e.name LIKE ? OR e.employee_service_id LIKE ? OR e.nic LIKE ? OR e.phone LIKE ? OR e.email LIKE ?)');
      const term = `%${req.query.search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count matching filters
    const countSql = `SELECT COUNT(*) as total FROM employees e ${whereSql}`;
    const countRow = await dbGet(countSql, params);
    const total = countRow ? countRow.total : 0;

    // Pagination
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    let paginationSql = '';
    const queryParams = [...params];

    if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      paginationSql = 'LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);
    }

    const sql = `
      SELECT 
        e.user_id, e.name, e.department, e.role, e.card_no, e.email, e.phone, e.photo,
        e.employee_service_id, e.nic, e.title, e.first_name, e.last_name, e.gender, 
        e.birthday, e.appointment_date, e.employment_status, e.order_by_id,
        COALESCE(e.is_active, 1) as is_active,
        e.created_at, e.updated_at,
        s.id as shift_id, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
        s.grace_period_mins, s.monthly_grace_days, s.half_day_hours, s.full_day_hours,
        s.monthly_short_leaves, s.work_days, s.color as shift_color, s.enable_overtime,
        COALESCE(att.total_punches, 0) as total_punches,
        att.first_punch, att.last_punch
      FROM employees e
      LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as total_punches, MIN(punch_time) as first_punch, MAX(punch_time) as last_punch
        FROM attendance_records
        GROUP BY user_id
      ) att ON e.user_id = att.user_id
      ${whereSql}
      ORDER BY CAST(e.user_id AS INTEGER) ASC
      ${paginationSql}
    `;

    const rows = await dbAll(sql, queryParams);

    const users = rows.map(r => ({
      user_id: r.user_id,
      name: r.name,
      title: r.title || null,
      first_name: r.first_name || null,
      last_name: r.last_name || null,
      department: r.department || 'General',
      role: r.role || 'Staff',
      employee_service_id: r.employee_service_id || null,
      nic: r.nic || null,
      gender: r.gender || null,
      birthday: r.birthday || null,
      appointment_date: r.appointment_date || null,
      employment_status: r.employment_status || null,
      order_by_id: r.order_by_id || null,
      phone: r.phone || null,
      email: r.email || null,
      card_no: r.card_no || null,
      photo: r.photo || null,
      is_active: Boolean(r.is_active),
      shift: {
        id: r.shift_id || 1,
        name: r.shift_name || 'General Shift',
        start_time: r.shift_start || '08:30',
        end_time: r.shift_end || '16:15',
        grace_period_mins: r.grace_period_mins !== undefined ? r.grace_period_mins : 30,
        monthly_grace_days: r.monthly_grace_days !== undefined ? r.monthly_grace_days : 2,
        monthly_short_leaves: r.monthly_short_leaves !== undefined ? r.monthly_short_leaves : 2,
        half_day_hours: r.half_day_hours !== undefined ? r.half_day_hours : 3.5,
        full_day_hours: r.full_day_hours !== undefined ? r.full_day_hours : 7.75,
        enable_overtime: Boolean(r.enable_overtime !== 0),
        work_days: r.work_days || '1,2,3,4,5'
      },
      attendance_summary: {
        total_punches: r.total_punches,
        first_punch: r.first_punch || null,
        last_punch: r.last_punch || null
      },
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

    const response = {
      success: true,
      total,
      count: users.length,
      filters: {
        status,
        department: req.query.department || null,
        search: req.query.search || null
      },
      users
    };

    if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
      response.pagination = {
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    res.json(response);
  } catch (err) {
    logger.error('API_USERS', `Failed to retrieve users: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/users/:userId/attendance & aliases
 * Returns calculated attendance records and period totals for the given user ID.
 */
router.get([
  '/v1/users/:userId/attendance',
  '/users/:userId/attendance',
  '/attendance/user/:userId'
], async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const attendanceData = await getUserCalculatedAttendance(userId, req.query);
    if (!attendanceData) {
      return res.status(404).json({
        success: false,
        error: `User with ID '${userId}' not found.`
      });
    }

    res.json(attendanceData);
  } catch (err) {
    logger.error('API_USER_ATTENDANCE', `Failed to calculate attendance for user ${req.params.userId}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
