const { dbAll, dbGet } = require('./db');
const {
  DAY_NAMES,
  timeToMinutes,
  getDayClassification,
  computeDailyAttendanceSummary,
  buildMonthlyGraceAndLateMap
} = require('./shiftEngine');

/**
 * Returns ISO date string 'YYYY-MM-DD'
 */
function toYmd(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to fetch all enrolled employees with shift information
 */
async function getEnrolledEmployees(userId = null, search = '', { activeOnly = true } = {}) {
  const conditions = [];
  const params = [];

  if (activeOnly) {
    conditions.push('COALESCE(e.is_active, 1) = 1');
  }
  if (userId) {
    conditions.push('e.user_id = ?');
    params.push(String(userId));
  }
  if (search) {
    conditions.push('(e.user_id LIKE ? OR e.name LIKE ? OR e.department LIKE ? OR e.employee_service_id LIKE ? OR e.nic LIKE ? OR e.phone LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term, term, term);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      e.user_id, e.name as employee_name, e.department, e.role, e.photo as employee_photo, e.shift_id,
      e.employee_service_id, e.nic, e.title, e.first_name, e.last_name, e.gender, e.birthday, e.appointment_date, e.employment_status, e.order_by_id, e.phone, e.email,
      COALESCE(e.is_active, 1) as is_active,
      s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
      s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
      s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end,
      s.disallow_grace_and_short_leave_same_day, s.ot_min_mins, s.ot_step_mins,
      s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
      s.work_days, s.color as shift_color
    FROM employees e
    LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
    ${whereSql}
    ORDER BY CAST(e.user_id AS INTEGER) ASC
  `;
  return await dbAll(sql, params);
}

/**
 * Generates Daily Report for all users or a single employee
 */
async function generateDailyReport(targetDate, { userId = null, search = '', statusFilter = 'all', activeOnly = true } = {}) {
  const dateStr = targetDate || toYmd(new Date());
  const monthStart = dateStr.slice(0, 7) + '-01';
  const holidays = await dbAll('SELECT * FROM holidays');
  const allEmployees = await getEnrolledEmployees(userId, search, { activeOnly });

  const conds = [
    `strftime('%Y-%m-%d', a.punch_time) >= ?`,
    `strftime('%Y-%m-%d', a.punch_time) <= ?`
  ];
  const params = [monthStart, dateStr];

  if (activeOnly) {
    conds.push('COALESCE(e.is_active, 1) = 1');
  }
  if (userId) {
    conds.push('a.user_id = ?');
    params.push(String(userId));
  }

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
    WHERE ${conds.join(' AND ')}
    ORDER BY a.punch_time ASC
  `;

  const records = await dbAll(dataSql, params);
  let dailyRows = computeDailyAttendanceSummary(records, holidays, allEmployees, [dateStr]);

  const stats = {
    date: dateStr,
    totalEnrolled: allEmployees.length,
    present: dailyRows.filter(r => r.punch_count > 0).length,
    absent: dailyRows.filter(r => r.punch_count === 0).length,
    onTime: dailyRows.filter(r => r.daily_status && (r.daily_status.includes('On Time') || r.daily_status.includes('Full Day'))).length,
    lateOrGrace: dailyRows.filter(r => r.daily_status && (r.daily_status.includes('Late') || r.daily_status.includes('Grace'))).length,
    otCount: dailyRows.filter(r => r.ot_hours > 0).length
  };

  if (statusFilter === 'present') {
    dailyRows = dailyRows.filter(r => r.punch_count > 0);
  } else if (statusFilter === 'absent') {
    dailyRows = dailyRows.filter(r => r.punch_count === 0);
  } else if (statusFilter === 'late') {
    dailyRows = dailyRows.filter(r => r.daily_status && (r.daily_status.includes('Late') || r.daily_status.includes('Grace')));
  } else if (statusFilter === 'ontime') {
    dailyRows = dailyRows.filter(r => r.daily_status && (r.daily_status.includes('On Time') || r.daily_status.includes('Full Day')));
  }

  return {
    type: 'daily',
    date: dateStr,
    stats,
    records: dailyRows
  };
}

/**
 * Generates Weekly Report (Monday to Sunday)
 */
async function generateWeeklyReport(startDateStr, endDateStr, { userId = null, search = '', scope = 'all', activeOnly = true } = {}) {
  let startD, endD;
  if (startDateStr && endDateStr) {
    startD = new Date(startDateStr);
    endD = new Date(endDateStr);
  } else if (startDateStr) {
    startD = new Date(startDateStr);
    const day = startD.getDay();
    const diff = startD.getDate() - day + (day === 0 ? -6 : 1);
    startD = new Date(startD.setDate(diff));
    endD = new Date(startD);
    endD.setDate(startD.getDate() + 6);
  } else {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    startD = new Date(now.setDate(diff));
    endD = new Date(startD);
    endD.setDate(startD.getDate() + 6);
  }

  const sYmd = toYmd(startD);
  const eYmd = toYmd(endD);

  const dateList = [];
  const cur = new Date(startD);
  while (cur <= endD) {
    dateList.push(toYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const holidays = await dbAll('SELECT * FROM holidays');
  const allEmployees = await getEnrolledEmployees(userId, search, { activeOnly });

  const monthStart = sYmd.slice(0, 7) + '-01';
  const conds = [
    `strftime('%Y-%m-%d', a.punch_time) >= ?`,
    `strftime('%Y-%m-%d', a.punch_time) <= ?`
  ];
  const params = [monthStart, eYmd];

  if (activeOnly) {
    conds.push('COALESCE(e.is_active, 1) = 1');
  }
  if (userId) {
    conds.push('a.user_id = ?');
    params.push(String(userId));
  }

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
    WHERE ${conds.join(' AND ')}
    ORDER BY a.punch_time ASC
  `;

  const records = await dbAll(dataSql, params);
  const dailyRows = computeDailyAttendanceSummary(records, holidays, allEmployees, dateList);

  if (scope === 'single' && userId) {
    const userRows = dailyRows.filter(r => String(r.user_id) === String(userId));
    const emp = allEmployees.find(e => String(e.user_id) === String(userId)) || {
      user_id: userId,
      employee_name: userRows[0]?.employee_name || 'Unassigned',
      department: userRows[0]?.department || 'General',
      shift_name: userRows[0]?.shift_name || 'General Shift'
    };

    let totalWorkedMins = 0;
    let totalOtHours = 0;
    let daysPresent = 0;
    let daysAbsent = 0;
    let scheduledWorkDays = 0;

    userRows.forEach(r => {
      totalWorkedMins += r.worked_minutes || 0;
      totalOtHours += r.ot_hours || 0;
      if (r.punch_count > 0) {
        daysPresent++;
      } else if (r.daily_status === 'Absent') {
        daysAbsent++;
      }
      if (r.day_type === 'WEEKDAY') {
        scheduledWorkDays++;
      }
    });

    const hours = Math.floor(totalWorkedMins / 60);
    const mins = totalWorkedMins % 60;

    return {
      type: 'weekly',
      scope: 'single',
      periodLabel: `Week of ${sYmd} to ${eYmd}`,
      startDate: sYmd,
      endDate: eYmd,
      employee: emp,
      totals: {
        scheduledWorkDays,
        daysPresent,
        daysAbsent,
        totalWorkedMins,
        totalWorkedFormatted: `${hours}h ${mins}m`,
        totalOtHours: Number(totalOtHours.toFixed(2))
      },
      timesheet: userRows
    };
  }

  // Company-wide All Users Summary
  const userMap = {};
  allEmployees.forEach(emp => {
    userMap[String(emp.user_id)] = {
      user_id: String(emp.user_id),
      employee_name: emp.employee_name || '',
      department: emp.department || 'General',
      shift_name: emp.shift_name || 'General Shift',
      scheduled_days: 0,
      days_present: 0,
      days_absent: 0,
      half_days: 0,
      late_or_grace: 0,
      total_worked_mins: 0,
      total_ot_hours: 0
    };
  });

  dailyRows.forEach(r => {
    const uid = String(r.user_id);
    if (!userMap[uid]) {
      userMap[uid] = {
        user_id: uid,
        employee_name: r.employee_name || '',
        department: r.department || 'General',
        shift_name: r.shift_name || 'General Shift',
        scheduled_days: 0,
        days_present: 0,
        days_absent: 0,
        half_days: 0,
        late_or_grace: 0,
        total_worked_mins: 0,
        total_ot_hours: 0
      };
    }
    const item = userMap[uid];
    if (r.day_type === 'WEEKDAY') item.scheduled_days++;
    if (r.punch_count > 0) {
      item.days_present++;
      item.total_worked_mins += r.worked_minutes || 0;
      item.total_ot_hours += r.ot_hours || 0;
      if (r.daily_status && r.daily_status.includes('Half Day')) item.half_days++;
      if (r.daily_status && (r.daily_status.includes('Late') || r.daily_status.includes('Grace'))) item.late_or_grace++;
    } else if (r.daily_status === 'Absent') {
      item.days_absent++;
    }
  });

  const summaryList = Object.values(userMap).map(u => {
    const h = Math.floor(u.total_worked_mins / 60);
    const m = u.total_worked_mins % 60;
    const attPct = u.scheduled_days > 0 ? ((u.days_present / u.scheduled_days) * 100).toFixed(1) + '%' : '0%';
    return {
      ...u,
      total_worked_formatted: `${h}h ${m}m`,
      total_ot_hours: Number(u.total_ot_hours.toFixed(2)),
      attendance_pct: attPct
    };
  });

  summaryList.sort((a, b) => {
    const idA = parseInt(a.user_id, 10);
    const idB = parseInt(b.user_id, 10);
    if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
    return a.user_id.localeCompare(b.user_id);
  });

  return {
    type: 'weekly',
    scope: 'all',
    periodLabel: `Week of ${sYmd} to ${eYmd}`,
    startDate: sYmd,
    endDate: eYmd,
    dateList,
    totalEnrolled: allEmployees.length,
    records: summaryList
  };
}

/**
 * Generates Monthly Report (Full calendar month)
 */
async function generateMonthlyReport(yearMonthStr, { userId = null, search = '', scope = 'all', activeOnly = true } = {}) {
  const now = new Date();
  const ym = yearMonthStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = ym.split('-').map(n => parseInt(n, 10));

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const sYmd = toYmd(firstDay);
  const eYmd = toYmd(lastDay);

  const dateList = [];
  const cur = new Date(firstDay);
  while (cur <= lastDay) {
    dateList.push(toYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const holidays = await dbAll('SELECT * FROM holidays');
  const allEmployees = await getEnrolledEmployees(userId, search, { activeOnly });

  const conds = [
    `strftime('%Y-%m-%d', a.punch_time) >= ?`,
    `strftime('%Y-%m-%d', a.punch_time) <= ?`
  ];
  const params = [sYmd, eYmd];

  if (activeOnly) {
    conds.push('COALESCE(e.is_active, 1) = 1');
  }
  if (userId) {
    conds.push('a.user_id = ?');
    params.push(String(userId));
  }

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
    WHERE ${conds.join(' AND ')}
    ORDER BY a.punch_time ASC
  `;

  const records = await dbAll(dataSql, params);
  const dailyRows = computeDailyAttendanceSummary(records, holidays, allEmployees, dateList);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthTitle = `${monthNames[month - 1]} ${year}`;

  if (scope === 'single' && userId) {
    const userRows = dailyRows.filter(r => String(r.user_id) === String(userId));
    userRows.sort((a, b) => a.date.localeCompare(b.date));

    const emp = allEmployees.find(e => String(e.user_id) === String(userId)) || {
      user_id: userId,
      employee_name: userRows[0]?.employee_name || 'Unassigned',
      department: userRows[0]?.department || 'General',
      shift_name: userRows[0]?.shift_name || 'General Shift'
    };

    let totalWorkedMins = 0;
    let totalOtHours = 0;
    let daysPresent = 0;
    let daysAbsent = 0;
    let scheduledWorkDays = 0;
    let halfDays = 0;
    let graceUsed = 0;
    let shortLeaveUsed = 0;

    userRows.forEach(r => {
      totalWorkedMins += r.worked_minutes || 0;
      totalOtHours += r.ot_hours || 0;
      if (r.punch_count > 0) {
        daysPresent++;
      } else if (r.daily_status === 'Absent') {
        daysAbsent++;
      }
      if (r.day_type === 'WEEKDAY') scheduledWorkDays++;
      if (r.daily_status && r.daily_status.includes('Half Day')) halfDays++;
      if (r.check_in_status === 'ON_TIME_GRACE' || (r.daily_status && r.daily_status.includes('Grace'))) graceUsed++;
      if (r.daily_status && r.daily_status.includes('Short Leave')) shortLeaveUsed++;
    });

    const hours = Math.floor(totalWorkedMins / 60);
    const mins = totalWorkedMins % 60;
    const attPct = scheduledWorkDays > 0 ? ((daysPresent / scheduledWorkDays) * 100).toFixed(1) + '%' : '0%';

    return {
      type: 'monthly',
      scope: 'single',
      month: ym,
      periodLabel: monthTitle,
      employee: emp,
      totals: {
        monthDays: dateList.length,
        scheduledWorkDays,
        daysPresent,
        daysAbsent,
        halfDays,
        graceUsed,
        shortLeaveUsed,
        totalWorkedMins,
        totalWorkedFormatted: `${hours}h ${mins}m`,
        totalOtHours: Number(totalOtHours.toFixed(2)),
        attendance_pct: attPct
      },
      timesheet: userRows
    };
  }

  // Monthly Book: 1 Complete Page per User with Full Calendar Month Day-by-Day Timesheet
  if (scope === 'monthly_book') {
    const userTimesheets = {};
    dailyRows.forEach(r => {
      const uid = String(r.user_id);
      if (!userTimesheets[uid]) {
        userTimesheets[uid] = [];
      }
      userTimesheets[uid].push(r);
    });

    const userBookList = [];
    allEmployees.forEach(emp => {
      const uid = String(emp.user_id);
      const rows = userTimesheets[uid] || [];
      rows.sort((a, b) => a.date.localeCompare(b.date));

      const todayStr = toYmd(new Date());
      let totalWorkedMins = 0;
      let totalOtHours = 0;
      let daysPresent = 0;
      let daysAbsent = 0;
      let elapsedWorkDays = 0;
      let totalMonthWorkDays = 0;
      let halfDays = 0;
      let graceUsed = 0;
      let shortLeaveUsed = 0;

      rows.forEach(r => {
        totalWorkedMins += r.worked_minutes || 0;
        totalOtHours += r.ot_hours || 0;
        const isFuture = r.date > todayStr;
        if (r.punch_count > 0) {
          daysPresent++;
        } else if (r.daily_status === 'Absent' || (!isFuture && r.day_type === 'WEEKDAY' && r.punch_count === 0)) {
          daysAbsent++;
        }
        if (r.day_type === 'WEEKDAY') {
          totalMonthWorkDays++;
          if (!isFuture) elapsedWorkDays++;
        }
        if (r.daily_status && r.daily_status.includes('Half Day')) halfDays++;
        if (r.check_in_status === 'ON_TIME_GRACE' || (r.daily_status && r.daily_status.includes('Grace'))) graceUsed++;
        if (r.daily_status && r.daily_status.includes('Short Leave')) shortLeaveUsed++;
      });

      const hours = Math.floor(totalWorkedMins / 60);
      const mins = totalWorkedMins % 60;
      const baseWorkDays = elapsedWorkDays > 0 ? elapsedWorkDays : totalMonthWorkDays;
      const attPct = baseWorkDays > 0 ? ((daysPresent / baseWorkDays) * 100).toFixed(1) + '%' : '0%';

      userBookList.push({
        employee: emp,
        totals: {
          monthDays: dateList.length,
          scheduledWorkDays: totalMonthWorkDays,
          elapsedWorkDays,
          daysPresent,
          daysAbsent,
          halfDays,
          graceUsed,
          shortLeaveUsed,
          totalWorkedMins,
          totalWorkedFormatted: `${hours}h ${mins}m`,
          totalOtHours: Number(totalOtHours.toFixed(2)),
          attendance_pct: attPct
        },
        timesheet: rows
      });
    });

    userBookList.sort((a, b) => {
      const idA = parseInt(a.employee.user_id, 10);
      const idB = parseInt(b.employee.user_id, 10);
      if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
      return a.employee.user_id.localeCompare(b.employee.user_id);
    });

    return {
      type: 'monthly',
      scope: 'monthly_book',
      month: ym,
      periodLabel: monthTitle,
      totalEnrolled: allEmployees.length,
      totalUsers: userBookList.length,
      users: userBookList
    };
  }

  // Monthly Matrix / Register: All Days Horizontal, Employees Vertical
  if (scope === 'monthly_matrix') {
    const userTimesheets = {};
    dailyRows.forEach(r => {
      const uid = String(r.user_id);
      if (!userTimesheets[uid]) {
        userTimesheets[uid] = {};
      }
      userTimesheets[uid][r.date] = r;
    });

    const matrixRecords = [];
    allEmployees.forEach(emp => {
      const uid = String(emp.user_id);
      const dayMap = userTimesheets[uid] || {};

      let totalWorkedMins = 0;
      let totalOtHours = 0;
      let daysPresent = 0;
      let daysAbsent = 0;
      let scheduledWorkDays = 0;
      let halfDays = 0;
      let graceUsed = 0;
      let shortLeaveUsed = 0;

      const days = {};
      dateList.forEach(dStr => {
        const r = dayMap[dStr];
        if (r) {
          totalWorkedMins += r.worked_minutes || 0;
          totalOtHours += r.ot_hours || 0;
          if (r.punch_count > 0) {
            daysPresent++;
          } else if (r.daily_status === 'Absent') {
            daysAbsent++;
          }
          if (r.day_type === 'WEEKDAY') scheduledWorkDays++;
          if (r.daily_status && r.daily_status.includes('Half Day')) halfDays++;
          if (r.check_in_status === 'ON_TIME_GRACE' || (r.daily_status && r.daily_status.includes('Grace'))) graceUsed++;
          if (r.daily_status && r.daily_status.includes('Short Leave')) shortLeaveUsed++;

          days[dStr] = {
            date: dStr,
            day_name: r.day_name || '',
            day_type: r.day_type || 'WEEKDAY',
            check_in_time: (r.punch_count > 0 && r.check_in_time && r.check_in_time !== '-') ? r.check_in_time : '-',
            check_in_badge: r.check_in_badge || 'badge-on-time',
            check_in_label: r.check_in_label || 'On Time',
            check_out_time: (r.punch_count > 0 && r.check_out_time && r.check_out_time !== '-') ? r.check_out_time : '-',
            check_out_badge: r.check_out_badge || 'badge-on-time',
            check_out_label: r.check_out_label || 'Full Day',
            punch_count: r.punch_count || 0,
            worked_minutes: r.worked_minutes || 0,
            worked_formatted: r.worked_formatted !== '-' ? r.worked_formatted : '-',
            ot_hours: r.ot_hours || 0,
            daily_status: r.daily_status || (r.punch_count === 0 ? 'Absent' : 'Present'),
            daily_badge: r.daily_badge || 'badge-on-time'
          };
        } else {
          days[dStr] = {
            date: dStr,
            day_name: '',
            day_type: 'WEEKDAY',
            check_in_time: '-',
            check_in_badge: 'badge-absent',
            check_in_label: 'Absent',
            check_out_time: '-',
            check_out_badge: 'badge-tag',
            check_out_label: '-',
            punch_count: 0,
            worked_minutes: 0,
            worked_formatted: '-',
            ot_hours: 0,
            daily_status: 'Absent',
            daily_badge: 'badge-absent'
          };
        }
      });

      const hours = Math.floor(totalWorkedMins / 60);
      const mins = totalWorkedMins % 60;
      const attPct = scheduledWorkDays > 0 ? ((daysPresent / scheduledWorkDays) * 100).toFixed(1) + '%' : '0%';

      matrixRecords.push({
        employee: emp,
        days,
        totals: {
          monthDays: dateList.length,
          scheduledWorkDays,
          daysPresent,
          daysAbsent,
          halfDays,
          graceUsed,
          shortLeaveUsed,
          totalWorkedMins,
          totalWorkedFormatted: `${hours}h ${mins}m`,
          totalOtHours: Number(totalOtHours.toFixed(2)),
          attendance_pct: attPct
        }
      });
    });

    matrixRecords.sort((a, b) => {
      const idA = parseInt(a.employee.user_id, 10);
      const idB = parseInt(b.employee.user_id, 10);
      if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
      return a.employee.user_id.localeCompare(b.employee.user_id);
    });

    return {
      type: 'monthly',
      scope: 'monthly_matrix',
      month: ym,
      periodLabel: monthTitle,
      dateList,
      totalEnrolled: allEmployees.length,
      totalUsers: matrixRecords.length,
      records: matrixRecords
    };
  }

  // Company-wide Monthly Summary
  const userMap = {};
  allEmployees.forEach(emp => {
    userMap[String(emp.user_id)] = {
      user_id: String(emp.user_id),
      employee_name: emp.employee_name || '',
      department: emp.department || 'General',
      shift_name: emp.shift_name || 'General Shift',
      month_working_days: 0,
      days_present: 0,
      days_absent: 0,
      half_days: 0,
      grace_used: 0,
      short_leave_used: 0,
      total_worked_mins: 0,
      total_ot_hours: 0
    };
  });

  dailyRows.forEach(r => {
    const uid = String(r.user_id);
    if (!userMap[uid]) {
      userMap[uid] = {
        user_id: uid,
        employee_name: r.employee_name || '',
        department: r.department || 'General',
        shift_name: r.shift_name || 'General Shift',
        month_working_days: 0,
        days_present: 0,
        days_absent: 0,
        half_days: 0,
        grace_used: 0,
        short_leave_used: 0,
        total_worked_mins: 0,
        total_ot_hours: 0
      };
    }
    const item = userMap[uid];
    if (r.day_type === 'WEEKDAY') item.month_working_days++;
    if (r.punch_count > 0) {
      item.days_present++;
      item.total_worked_mins += r.worked_minutes || 0;
      item.total_ot_hours += r.ot_hours || 0;
      if (r.daily_status && r.daily_status.includes('Half Day')) item.half_days++;
      if (r.check_in_status === 'ON_TIME_GRACE' || (r.daily_status && r.daily_status.includes('Grace'))) item.grace_used++;
      if (r.daily_status && r.daily_status.includes('Short Leave')) item.short_leave_used++;
    } else if (r.daily_status === 'Absent') {
      item.days_absent++;
    }
  });

  const summaryList = Object.values(userMap).map(u => {
    const h = Math.floor(u.total_worked_mins / 60);
    const m = u.total_worked_mins % 60;
    const attPct = u.month_working_days > 0 ? ((u.days_present / u.month_working_days) * 100).toFixed(1) + '%' : '0%';
    return {
      ...u,
      total_worked_formatted: `${h}h ${m}m`,
      total_ot_hours: Number(u.total_ot_hours.toFixed(2)),
      attendance_pct: attPct
    };
  });

  summaryList.sort((a, b) => {
    const idA = parseInt(a.user_id, 10);
    const idB = parseInt(b.user_id, 10);
    if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
    return a.user_id.localeCompare(b.user_id);
  });

  return {
    type: 'monthly',
    scope: 'all',
    month: ym,
    periodLabel: monthTitle,
    totalEnrolled: allEmployees.length,
    records: summaryList
  };
}

/**
 * Calculates full attendance details for a specific user ID across a month or custom date range.
 * Integrates shiftEngine rules: Grace periods (max 2/month), short leaves (max 2/month),
 * half-day hours, full-day hours, overtime hours, punctuality badges and daily statuses.
 *
 * @param {string} userId - The user ID to query
 * @param {Object} options - { month, startDate, endDate, date, includePunches }
 * @returns {Object|null} - Attendance details object or null if employee not found
 */
async function getUserCalculatedAttendance(userId, options = {}) {
  if (!userId) return null;
  const uid = String(userId).trim();

  // 1. Fetch employee details + assigned shift
  const empRows = await getEnrolledEmployees(uid, '', { activeOnly: false });
  if (!empRows || empRows.length === 0) {
    return null;
  }
  const emp = empRows[0];

  // 2. Resolve date range
  let startDateStr = '';
  let endDateStr = '';
  let periodType = 'month';
  let periodLabel = '';

  if (options.date) {
    startDateStr = String(options.date).slice(0, 10);
    endDateStr = startDateStr;
    periodType = 'date';
    periodLabel = startDateStr;
  } else if (options.startDate && options.endDate) {
    startDateStr = String(options.startDate).slice(0, 10);
    endDateStr = String(options.endDate).slice(0, 10);
    periodType = 'custom_range';
    periodLabel = `${startDateStr} to ${endDateStr}`;
  } else {
    // Default to specified month or current month (YYYY-MM)
    const ym = options.month ? String(options.month).slice(0, 7) : new Date().toISOString().slice(0, 7);
    const [yStr, mStr] = ym.split('-');
    const year = parseInt(yStr, 10) || new Date().getFullYear();
    const month = parseInt(mStr, 10) || (new Date().getMonth() + 1);
    const lastDay = new Date(year, month, 0).getDate();
    startDateStr = `${ym}-01`;
    endDateStr = `${ym}-${String(lastDay).padStart(2, '0')}`;
    periodType = 'month';
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    periodLabel = `${monthNames[month - 1]} ${year}`;
  }

  // Ensure startDate <= endDate
  if (startDateStr > endDateStr) {
    const tmp = startDateStr;
    startDateStr = endDateStr;
    endDateStr = tmp;
  }

  // 3. Generate all target dates in range
  const targetDates = [];
  const curr = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    targetDates.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
  }

  // 4. Determine context date range for grace and short-leave evaluation
  // Grace rules evaluate within calendar months (e.g. max 2 per month).
  // So we fetch context from the 1st day of the start month to the end date.
  const contextStartStr = startDateStr.slice(0, 7) + '-01';

  // 5. Query punches and holidays
  const holidays = await dbAll('SELECT * FROM holidays');

  const punchSql = `
    SELECT 
      a.id, a.user_sn, a.user_id, a.punch_time, 
      a.verify_mode, a.verify_name, a.punch_state, a.punch_state_name,
      a.work_code, a.temperature, a.mask_status, a.device_ip, a.source,
      e.name as employee_name, e.department, e.role, e.photo as employee_photo, e.shift_id,
      s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
      s.grace_period_mins, s.monthly_grace_days, s.late_cover_end, s.half_day_hours, s.late_half_day_hours, s.full_day_hours,
      s.monthly_short_leaves, s.morning_short_leave_start, s.morning_short_leave_end, s.evening_short_leave_start, s.evening_short_leave_end,
      s.disallow_grace_and_short_leave_same_day, s.ot_min_mins, s.ot_step_mins,
      s.enable_morning_grace, s.enable_short_leave, s.enable_half_day_calc, s.enable_overtime,
      s.work_days, s.color as shift_color
    FROM attendance_records a
    LEFT JOIN employees e ON a.user_id = e.user_id
    LEFT JOIN working_shifts s ON COALESCE(e.shift_id, 1) = s.id
    WHERE a.user_id = ?
      AND strftime('%Y-%m-%d', a.punch_time) >= ?
      AND strftime('%Y-%m-%d', a.punch_time) <= ?
    ORDER BY a.punch_time ASC
  `;
  const contextRecords = await dbAll(punchSql, [uid, contextStartStr, endDateStr]);

  // 6. Compute daily attendance summary using shiftEngine
  const allDailyRows = computeDailyAttendanceSummary(contextRecords, holidays, [emp], targetDates);

  // Filter to requested range only (in case context fetched earlier dates)
  const targetDateSet = new Set(targetDates);
  const filteredRows = allDailyRows.filter(r => targetDateSet.has(r.date));

  // Sort dates chronologically ASC
  filteredRows.sort((a, b) => a.date.localeCompare(b.date));

  // 7. Group raw punches by date for optional inclusion
  const punchesByDate = {};
  contextRecords.forEach(r => {
    const d = String(r.punch_time).slice(0, 10);
    if (!punchesByDate[d]) punchesByDate[d] = [];
    punchesByDate[d].push({
      id: r.id,
      punch_time: r.punch_time,
      time: String(r.punch_time).slice(11, 19),
      verify_mode: r.verify_mode,
      verify_name: r.verify_name,
      punch_state: r.punch_state,
      punch_state_name: r.punch_state_name,
      device_ip: r.device_ip
    });
  });

  const includePunches = options.includePunches !== false && options.includePunches !== 'false';
  const todayStr = toYmd(new Date());

  // 8. Enrich daily records and compute totals
  let scheduledWorkDays = 0;
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let fullDays = 0;
  let lateDays = 0;
  let graceUsedDays = 0;
  let shortLeavesUsed = 0;
  let weekendDays = 0;
  let holidayDays = 0;
  let totalWorkedMinutes = 0;
  let totalOtHours = 0;

  const enrichedRecords = filteredRows.map(row => {
    const isFuture = row.date > todayStr;
    const isWorkingDay = row.day_type === 'WEEKDAY';
    const isPresent = row.punch_count > 0;
    const isAbsent = !isPresent && isWorkingDay && !isFuture;
    const isHalfDay = isPresent && (row.check_out_status === 'HALF_DAY' || (row.daily_status && row.daily_status.includes('Half Day')));
    const isGrace = isPresent && (row.check_in_status === 'ON_TIME_GRACE' || (row.daily_status && row.daily_status.includes('Grace')));
    const isLate = isPresent && (row.check_in_status === 'LATE_IN' || (row.daily_status && row.daily_status.includes('Late')));
    const isShortLeave = isPresent && (
      (row.check_out_status && row.check_out_status.includes('SHORT_LEAVE')) || 
      (row.daily_status && row.daily_status.includes('Short Leave'))
    );

    if (isWorkingDay) scheduledWorkDays++;
    if (row.day_type === 'WEEKEND') weekendDays++;
    if (row.day_type === 'HOLIDAY') holidayDays++;

    if (isPresent) {
      presentDays++;
      totalWorkedMinutes += (row.worked_minutes || 0);
      totalOtHours += (row.ot_hours || 0);
      if (isHalfDay) halfDays++;
      else fullDays++;
      if (isLate) lateDays++;
      if (isGrace) graceUsedDays++;
      if (isShortLeave) shortLeavesUsed++;
    } else if (isAbsent) {
      absentDays++;
    }

    const item = {
      date: row.date,
      day_name: row.day_name,
      day_type: row.day_type,
      is_working_day: isWorkingDay,
      is_future: isFuture,
      first_punch: row.first_punch_time,
      check_in_time: row.check_in_time,
      check_in_status: row.check_in_status,
      check_in_label: row.check_in_label,
      last_punch: row.last_punch_time,
      check_out_time: row.check_out_time,
      check_out_status: row.check_out_status,
      check_out_label: row.check_out_label,
      punch_count: row.punch_count,
      worked_minutes: row.worked_minutes,
      worked_formatted: row.worked_formatted,
      ot_hours: Number((row.ot_hours || 0).toFixed(2)),
      daily_status: row.daily_status,
      daily_badge: row.daily_badge,
      flags: {
        is_present: isPresent,
        is_absent: isAbsent,
        is_half_day: isHalfDay,
        is_full_day: isPresent && !isHalfDay,
        is_late: isLate,
        is_grace_applied: isGrace,
        is_short_leave_applied: isShortLeave
      }
    };

    if (includePunches) {
      item.punches = punchesByDate[row.date] || [];
    }

    return item;
  });

  const workedHours = Math.floor(totalWorkedMinutes / 60);
  const workedMins = totalWorkedMinutes % 60;
  const attendanceRate = scheduledWorkDays > 0 ? Number(((presentDays / scheduledWorkDays) * 100).toFixed(1)) : 0;

  return {
    success: true,
    user: {
      user_id: emp.user_id,
      name: emp.employee_name || emp.name,
      title: emp.title || null,
      first_name: emp.first_name || null,
      last_name: emp.last_name || null,
      department: emp.department || 'General',
      role: emp.role || 'Staff',
      employee_service_id: emp.employee_service_id || null,
      nic: emp.nic || null,
      gender: emp.gender || null,
      birthday: emp.birthday || null,
      appointment_date: emp.appointment_date || null,
      employment_status: emp.employment_status || null,
      phone: emp.phone || null,
      email: emp.email || null,
      is_active: Boolean(emp.is_active),
      shift: {
        id: emp.shift_id,
        name: emp.shift_name || 'General Shift',
        start_time: emp.shift_start || '08:30',
        end_time: emp.shift_end || '16:15',
        grace_period_mins: emp.grace_period_mins !== undefined ? emp.grace_period_mins : 30,
        monthly_grace_days: emp.monthly_grace_days !== undefined ? emp.monthly_grace_days : 2,
        monthly_short_leaves: emp.monthly_short_leaves !== undefined ? emp.monthly_short_leaves : 2,
        half_day_hours: emp.half_day_hours !== undefined ? emp.half_day_hours : 3.5,
        full_day_hours: emp.full_day_hours !== undefined ? emp.full_day_hours : 7.75,
        enable_overtime: Boolean(emp.enable_overtime !== 0),
        work_days: emp.work_days || '1,2,3,4,5'
      }
    },
    period: {
      type: periodType,
      label: periodLabel,
      start_date: startDateStr,
      end_date: endDateStr,
      total_calendar_days: targetDates.length
    },
    totals: {
      scheduled_work_days: scheduledWorkDays,
      present_days: presentDays,
      absent_days: absentDays,
      half_days: halfDays,
      full_days_present: fullDays,
      late_days: lateDays,
      grace_days_used: graceUsedDays,
      short_leaves_used: shortLeavesUsed,
      weekend_days: weekendDays,
      holiday_days: holidayDays,
      total_worked_minutes: totalWorkedMinutes,
      total_worked_formatted: `${workedHours}h ${workedMins}m`,
      total_ot_hours: Number(totalOtHours.toFixed(2)),
      attendance_percentage: `${attendanceRate}%`,
      attendance_rate: attendanceRate
    },
    records: enrichedRecords
  };
}

module.exports = {
  getEnrolledEmployees,
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  getUserCalculatedAttendance
};
