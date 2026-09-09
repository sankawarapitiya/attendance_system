const XLSX = require('xlsx');

/**
 * Prepares formatted rows for export.
 */
function formatRecordsForExport(rows) {
  return rows.map((r, index) => ({
    '#': index + 1,
    'User ID': r.user_id,
    'Employee Name': r.employee_name || 'Unassigned',
    'Department': r.department || 'General',
    'Punch Time': r.punch_time,
    'Shift': r.shift_name ? `${r.shift_name} (${r.shift_start || ''}-${r.shift_end || ''})` : 'General Shift',
    'Day Type': r.day_type_label || (r.day_type === 'WEEKEND' ? 'Weekend Off' : (r.day_type === 'HOLIDAY' ? 'Holiday' : 'Working Day')),
    'Punctuality / Status': r.punctuality_label || 'Present',
    'OT (Hours)': r.ot_hours ? `${r.ot_hours} H` : '0 H',
    'Verification Mode': r.verify_name || (r.verify_mode === 15 ? 'Face Recognition 👤' : `Mode ${r.verify_mode}`),
    'Punch State': r.punch_state_name || (r.punch_state === 0 ? 'Check-In' : 'Check-Out'),
    'Work Code': r.work_code || 0,
    'Temperature': r.temperature ? `${r.temperature} °C` : '-',
    'Mask': r.mask_status === 1 ? 'Yes' : (r.mask_status === 0 ? 'No' : '-'),
    'Device IP': r.device_ip || '192.168.10.15',
    'Source': r.source || 'DIRECT_SYNC'
  }));
}

/**
 * Generates an Excel buffer (.xlsx) from attendance records.
 */
function generateExcelBuffer(rows, sheetName = 'Attendance Records') {
  const formattedData = formatRecordsForExport(rows);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Auto-fit column widths
  const colWidths = [
    { wch: 6 },  // #
    { wch: 12 }, // User ID
    { wch: 22 }, // Employee Name
    { wch: 16 }, // Department
    { wch: 22 }, // Punch Time
    { wch: 22 }, // Shift
    { wch: 16 }, // Day Type
    { wch: 24 }, // Punctuality / Status
    { wch: 14 }, // OT (Hours)
    { wch: 22 }, // Verification Mode
    { wch: 14 }, // Punch State
    { wch: 12 }, // Work Code
    { wch: 14 }, // Temperature
    { wch: 8 },  // Mask
    { wch: 16 }, // Device IP
    { wch: 14 }  // Source
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates a CSV string (.csv) from attendance records.
 */
function generateCsvString(rows) {
  const formattedData = formatRecordsForExport(rows);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Prepares formatted employee rows for export.
 */
function formatEmployeesForExport(employees) {
  return employees.map((e, index) => ({
    '#': index + 1,
    'FingerPrint ID': e.user_id,
    'Order ID': e.order_by_id || '-',
    'Service ID': e.employee_service_id || '-',
    'NIC': e.nic || '-',
    'Title': e.title || '-',
    'Full Name': e.name || 'Unassigned',
    'Gender': e.gender || '-',
    'Birthday': e.birthday || '-',
    'Appointment Date': e.appointment_date || '-',
    'Status': e.employment_status || '-',
    'Active Status': e.is_active === 0 ? 'Inactive' : 'Active',
    'Mobile / Phone': e.phone || '-',
    'Email': e.email || '-',
    'Department': e.department || 'General',
    'Role': e.role || 'Staff',
    'Assigned Shift': e.shift_name ? `${e.shift_name} (${e.shift_start || ''}-${e.shift_end || ''})` : 'General Shift',
    'Card #': e.card_no || '-',
    'Total Punches': e.total_punches || 0,
    'Last Seen': e.last_seen || 'Never',
    'Enrolled Date': e.created_at || '-'
  }));
}

/**
 * Generates an Excel buffer (.xlsx) from employee list.
 */
function generateEmployeeExcelBuffer(employees, sheetName = 'Employees') {
  const formattedData = formatEmployeesForExport(employees);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  const colWidths = [
    { wch: 6 },  // #
    { wch: 14 }, // FingerPrint ID
    { wch: 10 }, // Order ID
    { wch: 14 }, // Service ID
    { wch: 18 }, // NIC
    { wch: 8 },  // Title
    { wch: 26 }, // Full Name
    { wch: 10 }, // Gender
    { wch: 14 }, // Birthday
    { wch: 16 }, // Appointment Date
    { wch: 14 }, // Status
    { wch: 14 }, // Active Status
    { wch: 16 }, // Mobile / Phone
    { wch: 22 }, // Email
    { wch: 18 }, // Department
    { wch: 14 }, // Role
    { wch: 24 }, // Assigned Shift
    { wch: 12 }, // Card #
    { wch: 14 }, // Total Punches
    { wch: 22 }, // Last Seen
    { wch: 22 }  // Enrolled Date
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates a CSV string (.csv) from employee list.
 */
function generateEmployeeCsvString(employees) {
  const formattedData = formatEmployeesForExport(employees);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Prepares formatted rows for Daily Attendance export.
 */
function formatDailyForExport(rows) {
  return rows.map((r, index) => ({
    '#': index + 1,
    'Date': r.date,
    'Day': r.day_name || '',
    'User ID': r.user_id,
    'Employee Name': r.employee_name || 'Unassigned',
    'Department': r.department || 'General',
    'Shift': r.shift_name ? `${r.shift_name} (${r.shift_start}-${r.shift_end})` : 'General Shift',
    'Check-In (First Punch)': r.check_in_time || '-',
    'Check-In Status': r.check_in_label || '-',
    'Check-Out (Last Punch)': r.check_out_time || '-',
    'Check-Out Status': r.check_out_label || '-',
    'Punches Today': r.punch_count !== undefined ? r.punch_count : 0,
    'Worked Duration': r.worked_formatted || '-',
    'OT (Hours)': r.ot_hours ? `${r.ot_hours} H` : '0 H',
    'Daily Status': r.daily_status || 'Present'
  }));
}

/**
 * Generates an Excel buffer (.xlsx) for Daily Attendance summary.
 */
function generateDailyExcelBuffer(rows, sheetName = 'Daily Attendance') {
  const formattedData = formatDailyForExport(rows);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const colWidths = [
    { wch: 6 },  // #
    { wch: 14 }, // Date
    { wch: 12 }, // Day
    { wch: 12 }, // User ID
    { wch: 22 }, // Employee Name
    { wch: 16 }, // Department
    { wch: 22 }, // Shift
    { wch: 22 }, // Check-In (First Punch)
    { wch: 24 }, // Check-In Status
    { wch: 22 }, // Check-Out (Last Punch)
    { wch: 26 }, // Check-Out Status
    { wch: 14 }, // Punches Today
    { wch: 16 }, // Worked Duration
    { wch: 14 }, // OT (Hours)
    { wch: 26 }  // Daily Status
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates a CSV string (.csv) for Daily Attendance summary.
 */
function generateDailyCsvString(rows) {
  const formattedData = formatDailyForExport(rows);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Generates an Excel buffer (.xlsx) for Weekly All Users Summary.
 */
function generateWeeklyAllUsersExcelBuffer(rows, periodLabel = 'Weekly Attendance Report') {
  const formatted = rows.map((r, i) => ({
    '#': i + 1,
    'User ID': r.user_id,
    'Employee Name': r.employee_name || 'Unassigned',
    'Department': r.department || 'General',
    'Shift': r.shift_name || 'General Shift',
    'Scheduled Days': r.scheduled_days || 0,
    'Days Present': r.days_present || 0,
    'Days Absent': r.days_absent || 0,
    'Half Days': r.half_days || 0,
    'Late / Grace': r.late_or_grace || 0,
    'Total Worked Time': r.total_worked_formatted || '0h 0m',
    'Total OT (Hours)': r.total_ot_hours ? `${r.total_ot_hours} H` : '0 H',
    'Attendance %': r.attendance_pct || '0%'
  }));

  const worksheet = XLSX.utils.json_to_sheet(formatted);
  worksheet['!cols'] = [
    { wch: 6 },  { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 20 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 18 }, { wch: 16 }, { wch: 14 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Weekly Summary');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function generateWeeklyAllUsersCsvString(rows) {
  const formatted = rows.map((r, i) => ({
    '#': i + 1,
    'User ID': r.user_id,
    'Employee Name': r.employee_name || 'Unassigned',
    'Department': r.department || 'General',
    'Shift': r.shift_name || 'General Shift',
    'Scheduled Days': r.scheduled_days || 0,
    'Days Present': r.days_present || 0,
    'Days Absent': r.days_absent || 0,
    'Half Days': r.half_days || 0,
    'Late / Grace': r.late_or_grace || 0,
    'Total Worked Time': r.total_worked_formatted || '0h 0m',
    'Total OT (Hours)': r.total_ot_hours ? `${r.total_ot_hours} H` : '0 H',
    'Attendance %': r.attendance_pct || '0%'
  }));
  const worksheet = XLSX.utils.json_to_sheet(formatted);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Generates an Excel buffer (.xlsx) for Monthly All Users Summary.
 */
function generateMonthlyAllUsersExcelBuffer(rows, periodLabel = 'Monthly Attendance Report') {
  const formatted = rows.map((r, i) => ({
    '#': i + 1,
    'User ID': r.user_id,
    'Employee Name': r.employee_name || 'Unassigned',
    'Department': r.department || 'General',
    'Shift': r.shift_name || 'General Shift',
    'Month Work Days': r.month_working_days || 0,
    'Days Present': r.days_present || 0,
    'Days Absent': r.days_absent || 0,
    'Half Days': r.half_days || 0,
    'Grace Used': r.grace_used || 0,
    'Short Leaves Used': r.short_leave_used || 0,
    'Total Worked Time': r.total_worked_formatted || '0h 0m',
    'Total OT (Hours)': r.total_ot_hours ? `${r.total_ot_hours} H` : '0 H',
    'Attendance %': r.attendance_pct || '0%'
  }));

  const worksheet = XLSX.utils.json_to_sheet(formatted);
  worksheet['!cols'] = [
    { wch: 6 },  { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 20 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly Summary');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function generateMonthlyAllUsersCsvString(rows) {
  const formatted = rows.map((r, i) => ({
    '#': i + 1,
    'User ID': r.user_id,
    'Employee Name': r.employee_name || 'Unassigned',
    'Department': r.department || 'General',
    'Shift': r.shift_name || 'General Shift',
    'Month Work Days': r.month_working_days || 0,
    'Days Present': r.days_present || 0,
    'Days Absent': r.days_absent || 0,
    'Half Days': r.half_days || 0,
    'Grace Used': r.grace_used || 0,
    'Short Leaves Used': r.short_leave_used || 0,
    'Total Worked Time': r.total_worked_formatted || '0h 0m',
    'Total OT (Hours)': r.total_ot_hours ? `${r.total_ot_hours} H` : '0 H',
    'Attendance %': r.attendance_pct || '0%'
  }));
  const worksheet = XLSX.utils.json_to_sheet(formatted);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Generates an Excel buffer (.xlsx) for Individual Employee Timesheet (Weekly or Monthly).
 */
function generateEmployeeTimesheetExcelBuffer(employee, timesheet, totals, periodLabel = 'Employee Timesheet') {
  const formatted = timesheet.map((r, i) => ({
    '#': i + 1,
    'Date': r.date,
    'Day': r.day_name || '',
    'Shift': r.shift_name ? `${r.shift_name} (${r.shift_start}-${r.shift_end})` : 'General Shift',
    'Check-In (First Punch)': r.check_in_time || '-',
    'Check-In Status': r.check_in_label || '-',
    'Check-Out (Last Punch)': r.check_out_time || '-',
    'Check-Out Status': r.check_out_label || '-',
    'Punches': r.punch_count || 0,
    'Worked Duration': r.worked_formatted || '-',
    'OT (Hours)': r.ot_hours ? `${r.ot_hours} H` : '0 H',
    'Daily Status': r.daily_status || 'Present'
  }));

  const worksheet = XLSX.utils.json_to_sheet(formatted);
  worksheet['!cols'] = [
    { wch: 6 },  { wch: 14 }, { wch: 12 }, { wch: 24 },
    { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 24 },
    { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 26 }
  ];

  const workbook = XLSX.utils.book_new();
  const safeSheetName = `ID_${employee.user_id || 'User'}`.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function generateEmployeeTimesheetCsvString(employee, timesheet, totals, periodLabel = 'Employee Timesheet') {
  const formatted = timesheet.map((r, i) => ({
    '#': i + 1,
    'Date': r.date,
    'Day': r.day_name || '',
    'Shift': r.shift_name ? `${r.shift_name} (${r.shift_start}-${r.shift_end})` : 'General Shift',
    'Check-In (First Punch)': r.check_in_time || '-',
    'Check-In Status': r.check_in_label || '-',
    'Check-Out (Last Punch)': r.check_out_time || '-',
    'Check-Out Status': r.check_out_label || '-',
    'Punches': r.punch_count || 0,
    'Worked Duration': r.worked_formatted || '-',
    'OT (Hours)': r.ot_hours ? `${r.ot_hours} H` : '0 H',
    'Daily Status': r.daily_status || 'Present'
  }));
  const worksheet = XLSX.utils.json_to_sheet(formatted);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Generates an Excel buffer (.xlsx) for Monthly All Users Complete Day-by-Day Book.
 */
function generateMonthlyBookExcelBuffer(users, periodLabel = 'Monthly Timesheets All Staff') {
  const rows = [];
  users.forEach(u => {
    const emp = u.employee || {};
    (u.timesheet || []).forEach(r => {
      rows.push({
        'User ID': emp.user_id,
        'Employee Name': emp.employee_name || 'Unassigned',
        'Service ID': emp.employee_service_id || '',
        'NIC': emp.nic || '',
        'Department': emp.department || 'General',
        'Date': r.date,
        'Day': r.day_name || '',
        'Shift': r.shift_name ? `${r.shift_name} (${r.shift_start}-${r.shift_end})` : 'General Shift',
        'First In': (r.punch_count > 0 && r.check_in_time) ? r.check_in_time : '-',
        'Check-In Status': r.check_in_label || (r.punch_count === 0 ? 'Absent' : 'Normal'),
        'Last Out': (r.punch_count > 0 && r.check_out_time) ? r.check_out_time : '-',
        'Check-Out Status': r.check_out_label || (r.punch_count === 0 ? '-' : 'Normal'),
        'Punches': r.punch_count || 0,
        'Worked Duration': r.worked_formatted || '0h 0m',
        'OT (Hours)': r.ot_hours || 0,
        'Daily Status': r.daily_status || (r.punch_count === 0 ? 'Absent' : 'Present')
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 10 }, { wch: 16 },
    { wch: 10 }, { wch: 16 }, { wch: 8 },  { wch: 14 }, { wch: 10 }, { wch: 20 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'All Staff Month Timesheets');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function generateMonthlyBookCsvString(users) {
  const rows = [];
  users.forEach(u => {
    const emp = u.employee || {};
    (u.timesheet || []).forEach(r => {
      rows.push({
        'User ID': emp.user_id,
        'Employee Name': emp.employee_name || 'Unassigned',
        'Service ID': emp.employee_service_id || '',
        'NIC': emp.nic || '',
        'Department': emp.department || 'General',
        'Date': r.date,
        'Day': r.day_name || '',
        'Shift': r.shift_name ? `${r.shift_name} (${r.shift_start}-${r.shift_end})` : 'General Shift',
        'First In': (r.punch_count > 0 && r.check_in_time) ? r.check_in_time : '-',
        'Check-In Status': r.check_in_label || (r.punch_count === 0 ? 'Absent' : 'Normal'),
        'Last Out': (r.punch_count > 0 && r.check_out_time) ? r.check_out_time : '-',
        'Check-Out Status': r.check_out_label || (r.punch_count === 0 ? '-' : 'Normal'),
        'Punches': r.punch_count || 0,
        'Worked Duration': r.worked_formatted || '0h 0m',
        'OT (Hours)': r.ot_hours || 0,
        'Daily Status': r.daily_status || (r.punch_count === 0 ? 'Absent' : 'Present')
      });
    });
  });
  const worksheet = XLSX.utils.json_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Generates an Excel buffer (.xlsx) for Monthly Attendance Matrix (Users Vertical, Days Horizontal).
 */
function generateMonthlyMatrixExcelBuffer(data) {
  const dateList = data.dateList || [];
  const records = data.records || [];

  const rows = records.map((rec, index) => {
    const emp = rec.employee || {};
    const tot = rec.totals || {};
    const days = rec.days || {};

    const row = {
      '#': index + 1,
      'User ID': emp.user_id,
      'Employee Name': emp.employee_name || 'Unassigned',
      'Service ID': emp.employee_service_id || '',
      'Department': emp.department || 'General',
      'Shift': emp.shift_name || 'General Shift'
    };

    dateList.forEach(dStr => {
      const d = days[dStr];
      const colHeader = d && d.day_name ? `${dStr} (${d.day_name.slice(0, 3)})` : dStr;
      if (!d) {
        row[colHeader] = '-';
      } else if (d.punch_count > 0) {
        const inOut = `${d.check_in_time} - ${d.check_out_time}`;
        const workStr = d.worked_formatted && d.worked_formatted !== '-' ? ` (${d.worked_formatted})` : '';
        const otStr = d.ot_hours > 0 ? `, +${d.ot_hours}H OT` : '';
        row[colHeader] = `${inOut}${workStr} [${d.daily_status}${otStr}]`;
      } else if (d.day_type === 'WEEKEND') {
        row[colHeader] = 'Weekend (OFF)';
      } else if (d.day_type === 'HOLIDAY') {
        row[colHeader] = `Holiday (${d.day_name || ''})`;
      } else {
        row[colHeader] = 'Absent';
      }
    });

    row['Work Days'] = tot.scheduledWorkDays || 0;
    row['Present'] = tot.daysPresent || 0;
    row['Absent'] = tot.daysAbsent || 0;
    row['Half Days'] = tot.halfDays || 0;
    row['Grace Used'] = tot.graceUsed || 0;
    row['Short Leaves'] = tot.shortLeaveUsed || 0;
    row['Total Worked Time'] = tot.totalWorkedFormatted || '0h 0m';
    row['Total OT (Hours)'] = tot.totalOtHours || 0;
    row['Attendance %'] = tot.attendance_pct || '0%';

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column width calculations
  const colWidths = [
    { wch: 5 },  // #
    { wch: 10 }, // User ID
    { wch: 22 }, // Employee Name
    { wch: 12 }, // Service ID
    { wch: 16 }, // Department
    { wch: 18 }  // Shift
  ];

  dateList.forEach(() => {
    colWidths.push({ wch: 22 });
  });

  colWidths.push(
    { wch: 11 }, // Work Days
    { wch: 9 },  // Present
    { wch: 9 },  // Absent
    { wch: 10 }, // Half Days
    { wch: 11 }, // Grace Used
    { wch: 12 }, // Short Leaves
    { wch: 18 }, // Total Worked Time
    { wch: 15 }, // Total OT (Hours)
    { wch: 14 }  // Attendance %
  );

  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Matrix');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function generateMonthlyMatrixCsvString(data) {
  const dateList = data.dateList || [];
  const records = data.records || [];

  const rows = records.map((rec, index) => {
    const emp = rec.employee || {};
    const tot = rec.totals || {};
    const days = rec.days || {};

    const row = {
      '#': index + 1,
      'User ID': emp.user_id,
      'Employee Name': emp.employee_name || 'Unassigned',
      'Service ID': emp.employee_service_id || '',
      'Department': emp.department || 'General',
      'Shift': emp.shift_name || 'General Shift'
    };

    dateList.forEach(dStr => {
      const d = days[dStr];
      const colHeader = d && d.day_name ? `${dStr} (${d.day_name.slice(0, 3)})` : dStr;
      if (!d) {
        row[colHeader] = '-';
      } else if (d.punch_count > 0) {
        const inOut = `${d.check_in_time} - ${d.check_out_time}`;
        const workStr = d.worked_formatted && d.worked_formatted !== '-' ? ` (${d.worked_formatted})` : '';
        const otStr = d.ot_hours > 0 ? `, +${d.ot_hours}H OT` : '';
        row[colHeader] = `${inOut}${workStr} [${d.daily_status}${otStr}]`;
      } else if (d.day_type === 'WEEKEND') {
        row[colHeader] = 'Weekend (OFF)';
      } else if (d.day_type === 'HOLIDAY') {
        row[colHeader] = `Holiday (${d.day_name || ''})`;
      } else {
        row[colHeader] = 'Absent';
      }
    });

    row['Work Days'] = tot.scheduledWorkDays || 0;
    row['Present'] = tot.daysPresent || 0;
    row['Absent'] = tot.daysAbsent || 0;
    row['Half Days'] = tot.halfDays || 0;
    row['Grace Used'] = tot.graceUsed || 0;
    row['Short Leaves'] = tot.shortLeaveUsed || 0;
    row['Total Worked Time'] = tot.totalWorkedFormatted || '0h 0m';
    row['Total OT (Hours)'] = tot.totalOtHours || 0;
    row['Attendance %'] = tot.attendance_pct || '0%';

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(worksheet);
}

module.exports = {
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
};
