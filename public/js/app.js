// Default Print & PDF Options (Top Level Constant)
const DEFAULT_PRINT_OPTIONS = {
  pageSize: 'a4-landscape', // 'a4-landscape' | 'a4-portrait' | 'letter-landscape' | 'letter-portrait' | 'legal-landscape' | 'legal-portrait' | 'a3-landscape'
  margin: 'normal',         // 'compact' | 'normal' | 'wide' | 'zero'
  fontScale: 'standard',    // 'compact' | 'standard' | 'large'
  colorMode: 'color',       // 'color' | 'ink-saver'
  repeatHeaders: true,      // repeat <thead> on every page
  showLetterhead: true,     // organization info / logo
  showHeaderMeta: true,     // date range & timestamp badge
  showSignatures: true,     // 3 signature blocks at bottom
  sig1Title: 'Prepared By',
  sig1Sub: 'HR / Attendance Officer',
  sig2Title: 'Checked & Verified By',
  sig2Sub: 'Head of Department',
  sig3Title: 'Authorized Approval',
  sig3Sub: 'Director / General Manager',
  bookScope: 'all'          // 'all' | 'selected'
};

// Default Report Table Columns Definition (Top Level Constant)
const REPORT_COLUMNS_DEF = {
  daily: [
    { key: 'col-idx', label: '# (Row Number)', default: true },
    { key: 'col-date', label: 'Date', default: true },
    { key: 'col-day', label: 'Day of Week', default: true },
    { key: 'col-uid', label: 'User ID', default: true },
    { key: 'col-emp', label: 'Employee Name', default: true },
    { key: 'col-dept', label: 'Department', default: true },
    { key: 'col-shift', label: 'Shift Name', default: true },
    { key: 'col-checkin', label: 'Check-In (First Punch)', default: true },
    { key: 'col-checkout', label: 'Check-Out (Last Punch)', default: true },
    { key: 'col-worked', label: 'Worked Time', default: true },
    { key: 'col-ot', label: 'Overtime (Hours)', default: true },
    { key: 'col-status', label: 'Daily Status Badge', default: true }
  ],
  weekly_all: [
    { key: 'col-idx', label: '# (Row Number)', default: true },
    { key: 'col-uid', label: 'User ID', default: true },
    { key: 'col-emp', label: 'Employee Name', default: true },
    { key: 'col-dept', label: 'Department', default: true },
    { key: 'col-shift', label: 'Shift Name', default: true },
    { key: 'col-sched', label: 'Scheduled Days', default: true },
    { key: 'col-present', label: 'Days Present', default: true },
    { key: 'col-absent', label: 'Days Absent', default: true },
    { key: 'col-half', label: 'Half Days', default: true },
    { key: 'col-late', label: 'Late / Grace', default: true },
    { key: 'col-worked', label: 'Total Worked Time', default: true },
    { key: 'col-ot', label: 'Total OT (Hours)', default: true },
    { key: 'col-rate', label: 'Attendance Rate %', default: true }
  ],
  monthly_all: [
    { key: 'col-idx', label: '# (Row Number)', default: true },
    { key: 'col-uid', label: 'User ID', default: true },
    { key: 'col-emp', label: 'Employee Name', default: true },
    { key: 'col-dept', label: 'Department', default: true },
    { key: 'col-shift', label: 'Shift Name', default: true },
    { key: 'col-workdays', label: 'Month Work Days', default: true },
    { key: 'col-present', label: 'Days Present', default: true },
    { key: 'col-absent', label: 'Days Absent', default: true },
    { key: 'col-half', label: 'Half Days', default: true },
    { key: 'col-grace', label: 'Grace Used (X/2)', default: true },
    { key: 'col-shortleave', label: 'Short Leaves (Y/2)', default: true },
    { key: 'col-worked', label: 'Total Worked Time', default: true },
    { key: 'col-ot', label: 'Total OT (Hours)', default: true },
    { key: 'col-rate', label: 'Attendance Rate %', default: true }
  ],
  timesheet: [
    { key: 'col-idx', label: '# (Row Number)', default: true },
    { key: 'col-date', label: 'Date', default: true },
    { key: 'col-day', label: 'Day of Week', default: true },
    { key: 'col-shift', label: 'Shift Name', default: true },
    { key: 'col-checkin', label: 'Check-In (First Punch)', default: true },
    { key: 'col-checkout', label: 'Check-Out (Last Punch)', default: true },
    { key: 'col-punches', label: 'Punches Count', default: true },
    { key: 'col-worked', label: 'Worked Duration', default: true },
    { key: 'col-ot', label: 'Overtime (Hours)', default: true },
    { key: 'col-status', label: 'Daily Status Badge', default: true }
  ],
  monthly_matrix: [
    { key: 'col-idx', label: '# (Row Number)', default: true },
    { key: 'col-uid', label: 'User ID', default: true },
    { key: 'col-emp', label: 'Employee Name', default: true },
    { key: 'col-dept', label: 'Department', default: true },
    { key: 'col-shift', label: 'Shift Name', default: true },
    { key: 'col-totals', label: 'Month Summary & Totals', default: true }
  ]
};

// Immediate global window bindings so inline onclicks never encounter ReferenceError
window.openPrintOptionsModal = window.openPrintOptionsModal || function() {
  const modal = document.getElementById('printOptionsModal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
};
window.closePrintOptionsModal = window.closePrintOptionsModal || function() {
  const modal = document.getElementById('printOptionsModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
};
window.toggleReportColumnsMenu = window.toggleReportColumnsMenu || function(e) {
  if (e) {
    if (e.stopPropagation) e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  const menu = document.getElementById('reportColumnsMenu');
  if (menu) {
    const isOpen = menu.style.display === 'block';
    if (isOpen) {
      menu.style.display = 'none';
    } else {
      menu.style.display = 'block';
      if (typeof renderReportColumnSelector === 'function') {
        renderReportColumnSelector();
      }
    }
  }
};
window.closeReportColumnsMenu = window.closeReportColumnsMenu || function() {
  const menu = document.getElementById('reportColumnsMenu');
  if (menu) menu.style.display = 'none';
};

// State Management
const state = {
  currentTab: 'tab-dashboard',
  recordsView: 'daily', // 'daily' or 'punches'
  daily: {
    date: new Date().toISOString().split('T')[0],
    statusFilter: 'all',
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  },
  report: {
    type: 'daily', // 'daily' | 'weekly' | 'monthly'
    scope: 'all',  // 'all' | 'single'
    userId: '',
    date: new Date().toISOString().split('T')[0],
    weekDate: new Date().toISOString().split('T')[0],
    month: new Date().toISOString().slice(0, 7),
    search: '',
    activeOnly: true,
    data: null,
    columns: {}
  },
  employeesFilter: 'all',
  records: {
    page: 1,
    limit: 50,
    totalPages: 1,
    total: 0,
    search: '',
    startDate: '',
    endDate: '',
    verifyMode: 'all',
    punchState: 'all',
    quickDate: 'all'
  },
  shifts: [],
  holidays: [],
  device: {
    ip: '192.168.10.15',
    port: 4370,
    online: false
  },
  org: {
    org_name: 'National Institute of Fisheries and Nautical Engineering',
    org_subtitle: 'Head Office - Human Resources & Attendance Division',
    org_address: 'Crow Island, Mattakkuliya, Colombo 15, Sri Lanka',
    org_phone: '+94 11 252 0451 / 071 813 4698',
    org_email: 'info@nifne.ac.lk',
    org_website: 'www.nifne.ac.lk',
    org_footer: 'SpeedFace-V5L Automated Biometric Attendance & Payroll System'
  },
  reportPageSize: 'a4-landscape',
  printOptions: { ...DEFAULT_PRINT_OPTIONS },
  ws: null
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initPrintOptions();
  initNavigation();
  initDashboard();
  initRecordsTable();
  initReports();
  initEmployees();
  initShiftsAndHolidays();
  initDeviceControl();
  initGuide();
  initWebSocket();
  loadDeviceControlData();
});

// Toast Notifications
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 1. Navigation & Tabs
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  document.getElementById('btnViewAllLogs')?.addEventListener('click', () => {
    switchTab('tab-records');
  });

  document.getElementById('btnSyncHeader')?.addEventListener('click', triggerManualSync);
  document.getElementById('quickSyncBtn')?.addEventListener('click', triggerManualSync);
}

function switchTab(tabId) {
  state.currentTab = tabId;

  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');

  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
  const activeContent = document.getElementById(tabId);
  if (activeContent) activeContent.classList.add('active');

  // Title update
  const titleMap = {
    'tab-dashboard': ['Attendance Dashboard', 'Real-time attendance monitoring for SpeedFace-V5L'],
    'tab-records': ['Attendance Records Explorer', 'Search, filter, and export biometric attendance logs'],
    'tab-reports': ['Attendance & Timesheet Reports', 'Daily, Weekly, and Monthly reports for all enrolled users or individual employee timesheets'],
    'tab-employees': ['Employee Registry', 'Assign names, departments, and working shifts to User IDs'],
    'tab-shifts': ['Working Shifts & Holidays Schedule', 'Define shifts, work schedules, grace periods, and official company holidays'],
    'tab-device': ['SpeedFace Device Control', 'Hardware status, clock sync, and background scheduler'],
    'tab-guide': ['SpeedFace Setup Assistant', 'Step-by-step terminal network and ADMS push setup'],
    'tab-api': ['API Service & Integration Gateway', 'REST API endpoints for third-party ERP, Payroll, and HR software integration']
  };

  if (titleMap[tabId]) {
    document.getElementById('headerTitle').textContent = titleMap[tabId][0];
    document.getElementById('headerSubtitle').textContent = titleMap[tabId][1];
  }

  // Load relevant data when opening tab
  if (tabId === 'tab-dashboard') loadDashboardStats();
  if (tabId === 'tab-records') loadRecords();
  if (tabId === 'tab-reports') loadReportData();
  if (tabId === 'tab-employees') loadEmployees();
  if (tabId === 'tab-shifts') loadShiftsAndHolidays();
  if (tabId === 'tab-device') loadDeviceControlData();
  if (tabId === 'tab-guide') loadGuideIps();
  if (tabId === 'tab-api') initApiServiceTab();
}

// 2. Dashboard
async function initDashboard() {
  await loadDashboardStats();
  await loadLiveFeed();
  // Poll stats every 15s
  setInterval(loadDashboardStats, 15000);
}

async function loadDashboardStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (!data.success) return;

    const stats = data.stats;
    document.getElementById('statTodayUsers').textContent = stats.todayUniqueUsers || 0;
    document.getElementById('statTodayPunches').textContent = stats.todayRecords || 0;
    document.getElementById('statTotalRecords').textContent = Number(stats.totalRecords || 0).toLocaleString();

    // Device online indicator
    const isOnline = Boolean(stats.deviceOnline || stats.syncStatus?.deviceOnline || stats.admsConnected);
    state.device.online = isOnline;
    const devStatusEl = document.getElementById('statDeviceStatus');
    const miniDot = document.getElementById('miniDeviceStatusDot');
    const devSub = document.getElementById('statDeviceSub');
    const devOnlineBadge = document.getElementById('devOnlineBadge');

    if (devStatusEl) {
      devStatusEl.textContent = isOnline ? 'Online' : 'Offline / Standby';
      devStatusEl.className = `stat-value ${isOnline ? 'text-success' : 'text-danger'}`;
    }
    if (miniDot) {
      miniDot.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
    }
    if (devSub) {
      devSub.textContent = isOnline 
        ? `${stats.deviceIp || '192.168.10.15'}:4370 (Connected)` 
        : `${stats.deviceIp || '192.168.10.15'}:4370 (Disconnected)`;
    }
    if (devOnlineBadge) {
      devOnlineBadge.className = `badge ${isOnline ? 'badge-in' : 'badge-out'}`;
      devOnlineBadge.textContent = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
    }

    if (stats.deviceInfo) {
      const info = stats.deviceInfo;
      if (document.getElementById('devTimeVal') && info.deviceTime) {
        document.getElementById('devTimeVal').textContent = info.deviceTime;
      }
      if (document.getElementById('devUserCountVal') && info.userCounts !== undefined) {
        document.getElementById('devUserCountVal').textContent = `${info.userCounts} users`;
      }
      if (document.getElementById('devLogCountVal') && info.logCounts !== undefined) {
        document.getElementById('devLogCountVal').textContent = `${Number(info.logCounts).toLocaleString()} records`;
      }
      if (document.getElementById('devCapVal') && info.logCapacity !== undefined) {
        document.getElementById('devCapVal').textContent = `${Number(info.logCapacity).toLocaleString()} capacity`;
      }
    }

    // Load today's recent logs
    loadTodayPreview();
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadTodayPreview() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/records?startDate=${today}&endDate=${today}&limit=10`);
    const data = await res.json();

    const tbody = document.getElementById('todayLogsTableBody');
    document.getElementById('todayActivityBadge').textContent = `${data.pagination.total} records today`;

    if (!data.records || data.records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No attendance punches recorded today yet</td></tr>`;
      return;
    }

    tbody.innerHTML = data.records.map((r) => {
      const avatarHtml = r.employee_photo
        ? `<img src="${r.employee_photo}" class="table-avatar-img" alt="Photo" onerror="this.outerHTML='<span class=\\'table-avatar-initial\\'>${String(r.user_id).slice(-2)}</span>'">`
        : `<span class="table-avatar-initial">${String(r.user_id).slice(-2)}</span>`;

      return `
        <tr>
          <td class="font-mono">${formatTimeOnly(r.punch_time)}</td>
          <td><strong>${r.user_id}</strong></td>
          <td>
            <div class="table-user-cell">
              ${avatarHtml}
              <span>${escapeHtml(r.employee_name || 'Unassigned')}</span>
            </div>
          </td>
          <td>${renderVerifyBadge(r.verify_mode, r.verify_name)}</td>
          <td>${renderPunchBadge(r.punch_state, r.punch_state_name)}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load today preview:', err);
  }
}

async function loadLiveFeed() {
  try {
    const res = await fetch('/api/records?limit=15');
    const data = await res.json();
    const list = document.getElementById('liveFeedList');
    if (!list) return;

    if (data.records && data.records.length > 0) {
      list.innerHTML = '';
      data.records.forEach((p) => {
        const item = createFeedElement(p);
        list.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Failed to load initial live feed:', err);
  }
}

// 3. Attendance Records Explorer
function initRecordsTable() {
  // Search input debounce
  let searchTimeout = null;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.records.search = e.target.value;
      state.records.page = 1;
      loadRecords();
    }, 400);
  });

  // Quick date chips
  document.querySelectorAll('.quick-dates .btn-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.quick-dates .btn-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const dateType = chip.getAttribute('data-date');
      state.records.quickDate = dateType;
      setDatesByQuickType(dateType);
      state.records.page = 1;
      loadRecords();
    });
  });

  // Date inputs
  document.getElementById('dateStart').addEventListener('change', (e) => {
    state.records.startDate = e.target.value;
    clearQuickDateActive();
  });
  document.getElementById('dateEnd').addEventListener('change', (e) => {
    state.records.endDate = e.target.value;
    clearQuickDateActive();
  });

  // Dropdown filters
  document.getElementById('filterVerifyMode').addEventListener('change', (e) => {
    state.records.verifyMode = e.target.value;
  });
  document.getElementById('filterPunchState').addEventListener('change', (e) => {
    state.records.punchState = e.target.value;
  });

  // Action buttons
  document.getElementById('btnFilterApply').addEventListener('click', () => {
    state.records.page = 1;
    loadRecords();
  });

  document.getElementById('btnFilterReset').addEventListener('click', () => {
    state.records.search = '';
    state.records.startDate = '';
    state.records.endDate = '';
    state.records.verifyMode = 'all';
    state.records.punchState = 'all';
    state.records.quickDate = 'all';

    document.getElementById('searchInput').value = '';
    document.getElementById('dateStart').value = '';
    document.getElementById('dateEnd').value = '';
    document.getElementById('filterVerifyMode').value = 'all';
    document.getElementById('filterPunchState').value = 'all';

    document.querySelectorAll('.quick-dates .btn-chip').forEach((c) => c.classList.remove('active'));
    document.querySelector('.quick-dates [data-date="all"]').classList.add('active');

    state.records.page = 1;
    loadRecords();
  });

  // View mode switcher
  document.getElementById('btnModeDaily')?.addEventListener('click', () => {
    state.recordsView = 'daily';
    document.getElementById('btnModeDaily').className = 'btn btn-sm btn-primary';
    document.getElementById('btnModePunches').className = 'btn btn-sm btn-outline';
    document.getElementById('dailyTableWrap').style.display = 'block';
    document.getElementById('recordsTableWrap').style.display = 'none';
    const statsBanner = document.getElementById('dailyStatsBanner');
    if (statsBanner) statsBanner.style.display = 'flex';
    document.getElementById('viewModeHint').innerHTML = '<strong>Daily Attendance:</strong> First punch calculated as Check-In, last punch as Check-Out per day across all employees.';
    const expText = document.getElementById('exportExcelBtnText');
    if (expText) expText.textContent = 'Export Daily (.xlsx)';
    state.daily.page = 1;
    loadRecords();
  });

  document.getElementById('btnModePunches')?.addEventListener('click', () => {
    state.recordsView = 'punches';
    document.getElementById('btnModeDaily').className = 'btn btn-sm btn-outline';
    document.getElementById('btnModePunches').className = 'btn btn-sm btn-primary';
    document.getElementById('dailyTableWrap').style.display = 'none';
    document.getElementById('recordsTableWrap').style.display = 'block';
    const statsBanner = document.getElementById('dailyStatsBanner');
    if (statsBanner) statsBanner.style.display = 'none';
    document.getElementById('viewModeHint').innerHTML = '<strong>Detailed Punch Logs:</strong> Every individual biometric transaction with First In and Last Out designated.';
    const expText = document.getElementById('exportExcelBtnText');
    if (expText) expText.textContent = 'Export Punches (.xlsx)';
    state.records.page = 1;
    loadRecords();
  });

  // Daily Date Picker & Quick Navigator
  const dailyDateInput = document.getElementById('dailyDateInput');
  if (dailyDateInput) {
    dailyDateInput.value = state.daily.date;
    dailyDateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        state.daily.date = e.target.value;
        state.daily.page = 1;
        loadRecords();
      }
    });
  }

  document.getElementById('btnDailyPrevDay')?.addEventListener('click', () => {
    const cur = new Date(state.daily.date + 'T00:00:00');
    cur.setDate(cur.getDate() - 1);
    const prevStr = cur.toISOString().split('T')[0];
    state.daily.date = prevStr;
    if (dailyDateInput) dailyDateInput.value = prevStr;
    state.daily.page = 1;
    loadRecords();
  });

  document.getElementById('btnDailyNextDay')?.addEventListener('click', () => {
    const cur = new Date(state.daily.date + 'T00:00:00');
    cur.setDate(cur.getDate() + 1);
    const nextStr = cur.toISOString().split('T')[0];
    state.daily.date = nextStr;
    if (dailyDateInput) dailyDateInput.value = nextStr;
    state.daily.page = 1;
    loadRecords();
  });

  document.getElementById('btnDailyToday')?.addEventListener('click', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    state.daily.date = todayStr;
    if (dailyDateInput) dailyDateInput.value = todayStr;
    state.daily.page = 1;
    loadRecords();
  });

  // Status Filter Chips
  document.querySelectorAll('[data-daily-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-daily-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.daily.statusFilter = chip.getAttribute('data-daily-filter');
      state.daily.page = 1;
      loadRecords();
    });
  });

  // Pagination buttons
  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (state.recordsView === 'daily') {
      if (state.daily.page > 1) {
        state.daily.page--;
        loadRecords();
      }
    } else {
      if (state.records.page > 1) {
        state.records.page--;
        loadRecords();
      }
    }
  });

  document.getElementById('btnNextPage').addEventListener('click', () => {
    if (state.recordsView === 'daily') {
      if (state.daily.page < state.daily.totalPages) {
        state.daily.page++;
        loadRecords();
      }
    } else {
      if (state.records.page < state.records.totalPages) {
        state.records.page++;
        loadRecords();
      }
    }
  });

  // Exports
  document.getElementById('btnExportExcel').addEventListener('click', () => triggerExport('xlsx'));
  document.getElementById('btnExportCsv').addEventListener('click', () => triggerExport('csv'));
}

function clearQuickDateActive() {
  document.querySelectorAll('.quick-dates .btn-chip').forEach((c) => c.classList.remove('active'));
}

function setDatesByQuickType(type) {
  const startEl = document.getElementById('dateStart');
  const endEl = document.getElementById('dateEnd');
  const now = new Date();

  function toYmd(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (type === 'all') {
    startEl.value = '';
    endEl.value = '';
    state.records.startDate = '';
    state.records.endDate = '';
  } else if (type === 'today') {
    const todayStr = toYmd(now);
    startEl.value = todayStr;
    endEl.value = todayStr;
    state.records.startDate = todayStr;
    state.records.endDate = todayStr;
  } else if (type === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = toYmd(yest);
    startEl.value = yestStr;
    endEl.value = yestStr;
    state.records.startDate = yestStr;
    state.records.endDate = yestStr;
  } else if (type === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    startEl.value = toYmd(weekAgo);
    endEl.value = toYmd(now);
    state.records.startDate = toYmd(weekAgo);
    state.records.endDate = toYmd(now);
  } else if (type === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    startEl.value = toYmd(firstDay);
    endEl.value = toYmd(now);
    state.records.startDate = toYmd(firstDay);
    state.records.endDate = toYmd(now);
  }
}

function buildQueryString() {
  const q = new URLSearchParams();
  q.set('page', state.records.page);
  q.set('limit', state.records.limit);
  if (state.records.search) q.set('search', state.records.search);
  if (state.records.startDate) q.set('startDate', state.records.startDate);
  if (state.records.endDate) q.set('endDate', state.records.endDate);
  if (state.records.verifyMode !== 'all') q.set('verifyMode', state.records.verifyMode);
  if (state.records.punchState !== 'all') q.set('punchState', state.records.punchState);
  return q.toString();
}

async function loadRecords() {
  if (state.recordsView === 'daily') {
    await loadDailyRecords();
  } else {
    await loadPunchRecords();
  }
}

async function loadDailyRecords() {
  const tbody = document.getElementById('dailyTableBody');
  tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4">Loading daily attendance records for all users...</td></tr>`;

  try {
    const q = new URLSearchParams();
    q.set('page', state.daily.page);
    q.set('limit', state.daily.limit);
    if (state.records.search) q.set('search', state.records.search);
    if (state.daily.date) q.set('date', state.daily.date);
    if (state.daily.statusFilter && state.daily.statusFilter !== 'all') {
      q.set('statusFilter', state.daily.statusFilter);
    }

    const res = await fetch(`/api/records/daily?${q.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    state.daily.total = data.pagination.total;
    state.daily.totalPages = data.pagination.totalPages || 1;

    // Update live counts banner
    if (data.stats) {
      if (document.getElementById('countTotal')) document.getElementById('countTotal').textContent = data.stats.totalEnrolled || 0;
      if (document.getElementById('countPresent')) document.getElementById('countPresent').textContent = data.stats.present || 0;
      if (document.getElementById('countAbsent')) document.getElementById('countAbsent').textContent = data.stats.absent || 0;
      if (document.getElementById('countLate')) document.getElementById('countLate').textContent = data.stats.lateOrGrace || 0;
    }

    renderDailyTable(data.records);
    updatePaginationUI();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-danger">Error loading daily attendance: ${err.message}</td></tr>`;
  }
}

function renderDailyTable(records) {
  const tbody = document.getElementById('dailyTableBody');
  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">No daily attendance records found matching criteria</td></tr>`;
    return;
  }

  const startIdx = (state.daily.page - 1) * state.daily.limit;
  tbody.innerHTML = records.map((r, i) => {
    const isAbsent = (r.punch_count === 0 || r.check_in_status === 'ABSENT');

    let checkInPill = '';
    if (isAbsent) {
      checkInPill = `<span class="badge-absent">🔴 Absent (No Punch)</span>`;
    } else if (r.check_in_time && r.check_in_time !== '-') {
      checkInPill = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span class="font-mono font-bold" style="color:var(--text-main); font-size:0.9rem;">${r.check_in_time}</span>
          <span class="${r.check_in_badge || 'badge-on-time'}" style="width:fit-content; font-size:0.75rem;">${escapeHtml(r.check_in_label || 'On Time')}</span>
        </div>
      `;
    } else {
      checkInPill = `<span class="text-muted">-</span>`;
    }

    let checkOutPill = '';
    if (isAbsent) {
      checkOutPill = `<span class="text-muted">-</span>`;
    } else if (r.check_out_time && r.check_out_time !== '-') {
      checkOutPill = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span class="font-mono font-bold" style="color:var(--text-main); font-size:0.9rem;">${r.check_out_time}</span>
          <span class="${r.check_out_badge || 'badge-on-time'}" style="width:fit-content; font-size:0.75rem;">${escapeHtml(r.check_out_label || 'Full Day')}</span>
        </div>
      `;
    } else {
      checkOutPill = `<span class="badge-tag" style="background:#f1f5f9;color:#64748b;font-size:0.75rem;" title="Only 1 punch recorded">Pending / Missing</span>`;
    }

    const dayBadgeClass = r.day_type === 'WEEKEND' ? 'badge-weekend' : (r.day_type === 'HOLIDAY' ? 'badge-holiday' : 'badge-weekday');
    const statusBadgeClass = isAbsent ? 'badge-absent' : (r.daily_badge || 'badge-on-time');

    return `
      <tr>
        <td class="text-muted font-mono">${startIdx + i + 1}</td>
        <td class="font-mono"><strong>${r.date}</strong></td>
        <td><span class="${dayBadgeClass}">${escapeHtml(r.day_name || '')}</span></td>
        <td class="font-mono"><strong>${r.user_id}</strong></td>
        <td>
          <div class="table-user-cell">
            <span class="table-avatar-initial">${String(r.user_id).slice(-2)}</span>
            <span>${escapeHtml(r.employee_name || 'Unassigned')}</span>
          </div>
        </td>
        <td>${escapeHtml(r.department || 'General')}</td>
        <td>
          <span class="badge-shift-pill" title="Assigned Shift">
            <span class="badge-shift-dot" style="background:#2563eb;"></span>
            ${escapeHtml(r.shift_name || 'General')}
          </span>
        </td>
        <td>${checkInPill}</td>
        <td>${checkOutPill}</td>
        <td class="font-mono">${r.worked_formatted !== '-' ? `<strong>${r.worked_formatted}</strong>` : '-'}</td>
        <td>
          ${r.ot_hours > 0 ? `
            <span class="badge-tag" style="background:#f3e8ff;color:#7e22ce;font-weight:700;">
              ⚡ +${r.ot_hours}H OT
            </span>
          ` : '<span class="text-muted">0 H</span>'}
        </td>
        <td>
          <span class="${statusBadgeClass}">
            ${escapeHtml(r.daily_status || (isAbsent ? 'Absent' : 'Present'))}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadPunchRecords() {
  const tbody = document.getElementById('recordsTableBody');
  tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">Loading punch records...</td></tr>`;

  try {
    const res = await fetch(`/api/records?${buildQueryString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    state.records.total = data.pagination.total;
    state.records.totalPages = data.pagination.totalPages || 1;

    renderRecordsTable(data.records);
    updatePaginationUI();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-danger">Error loading records: ${err.message}</td></tr>`;
  }
}

function renderRecordsTable(records) {
  const tbody = document.getElementById('recordsTableBody');
  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No attendance records found matching the criteria</td></tr>`;
    return;
  }

  const startIdx = (state.records.page - 1) * state.records.limit;
  tbody.innerHTML = records.map((r, i) => {
    const avatarHtml = r.employee_photo
      ? `<img src="${r.employee_photo}" class="table-avatar-img" alt="Photo" onerror="this.outerHTML='<span class=\\'table-avatar-initial\\'>${String(r.user_id).slice(-2)}</span>'">`
      : `<span class="table-avatar-initial">${String(r.user_id).slice(-2)}</span>`;

    const dayBadgeClass = r.day_badge || (r.day_type === 'WEEKEND' ? 'badge-weekend' : (r.day_type === 'HOLIDAY' ? 'badge-holiday' : 'badge-weekday'));
    const dayIcon = r.day_icon || (r.day_type === 'WEEKEND' ? '🏖️' : (r.day_type === 'HOLIDAY' ? '🎉' : '💼'));
    const dayLabel = r.day_name || (r.day_type === 'WEEKEND' ? 'Weekend' : (r.day_type === 'HOLIDAY' ? 'Holiday' : 'Weekday'));

    return `
      <tr>
        <td class="text-muted font-mono">${startIdx + i + 1}</td>
        <td class="font-mono"><strong>${formatDateTime(r.punch_time)}</strong></td>
        <td>
          <span class="${dayBadgeClass}" title="${r.day_type_label || ''}">
            ${dayIcon} ${escapeHtml(dayLabel)}
          </span>
        </td>
        <td class="font-mono"><strong>${r.user_id}</strong></td>
        <td>
          <div class="table-user-cell">
            ${avatarHtml}
            <span>${escapeHtml(r.employee_name || 'Unassigned')}</span>
          </div>
        </td>
        <td>${escapeHtml(r.department || 'General')}</td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span class="badge-shift-pill" title="Assigned Shift">
              <span class="badge-shift-dot" style="background: ${r.shift_color || '#2563eb'};"></span>
              ${escapeHtml(r.shift_name || 'General')}
            </span>
            <span class="${r.punctuality_badge || 'badge-on-time'}">
              ${r.punctuality_icon || '✓'} ${escapeHtml(r.punctuality_label || 'Present')}
            </span>
            ${r.ot_hours > 0 ? `
              <span class="badge-tag" style="background:#f3e8ff;color:#7e22ce;font-weight:700;display:inline-flex;align-items:center;gap:4px;width:fit-content;" title="Overtime Approved">
                ⚡ +${r.ot_hours}H OT
              </span>
            ` : ''}
          </div>
        </td>
        <td>${renderVerifyBadge(r.verify_mode, r.verify_name)}</td>
        <td>${renderPunchRoleBadge(r)}</td>
        <td class="font-mono text-muted">${r.device_ip || '192.168.10.15'}</td>
      </tr>
    `;
  }).join('');
}

function updatePaginationUI() {
  const isDaily = state.recordsView === 'daily';
  const page = isDaily ? state.daily.page : state.records.page;
  const limit = isDaily ? state.daily.limit : state.records.limit;
  const total = isDaily ? state.daily.total : state.records.total;
  const totalPages = isDaily ? state.daily.totalPages : state.records.totalPages;

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  const unit = isDaily ? 'employees' : 'records';
  document.getElementById('paginationInfo').textContent = `Showing ${start} to ${end} of ${Number(total).toLocaleString()} ${unit}`;
  document.getElementById('pageIndicator').textContent = `Page ${page} of ${totalPages}`;

  document.getElementById('btnPrevPage').disabled = page <= 1;
  document.getElementById('btnNextPage').disabled = page >= totalPages;
}

function triggerExport(format) {
  if (state.recordsView === 'daily') {
    const q = new URLSearchParams();
    if (state.records.search) q.set('search', state.records.search);
    if (state.daily.date) q.set('date', state.daily.date);
    if (state.daily.statusFilter && state.daily.statusFilter !== 'all') {
      q.set('statusFilter', state.daily.statusFilter);
    }
    q.set('format', format);

    showToast(`Generating Daily Attendance ${format.toUpperCase()} export for ${state.daily.date}...`, 'info');
    window.location.href = `/api/records/daily/export?${q.toString()}`;
  } else {
    const q = new URLSearchParams();
    if (state.records.search) q.set('search', state.records.search);
    if (state.records.startDate) q.set('startDate', state.records.startDate);
    if (state.records.endDate) q.set('endDate', state.records.endDate);
    if (state.records.verifyMode !== 'all') q.set('verifyMode', state.records.verifyMode);
    if (state.records.punchState !== 'all') q.set('punchState', state.records.punchState);
    q.set('format', format);

    showToast(`Generating Punch Logs ${format.toUpperCase()} export...`, 'info');
    window.location.href = `/api/records/export?${q.toString()}`;
  }
}

// ==========================================
// 3B. Attendance & Timesheet Reports (Daily, Weekly, Monthly)
// ==========================================

// ==========================================
// 3B. Print & PDF Output Configuration Suite
// ==========================================

// Print options defaults are defined at top of file
function loadSavedPrintOptions() {
  try {
    const raw = localStorage.getItem('speedface_print_options');
    if (raw) {
      const parsed = JSON.parse(raw);
      state.printOptions = { ...DEFAULT_PRINT_OPTIONS, ...parsed };
      if (state.printOptions.pageSize) {
        state.reportPageSize = state.printOptions.pageSize;
      }
      return;
    }
  } catch (e) {
    console.warn('Could not load saved print options:', e);
  }
  state.printOptions = { ...DEFAULT_PRINT_OPTIONS };
}

function savePrintOptions() {
  try {
    localStorage.setItem('speedface_print_options', JSON.stringify(state.printOptions));
  } catch (e) {
    console.warn('Could not save print options:', e);
  }
}

function applyAllPrintOptions() {
  if (!state.printOptions) loadSavedPrintOptions();
  const opts = state.printOptions;

  // 1. Page Size & Orientation
  let sizeVal = 'A4 landscape';
  switch (opts.pageSize) {
    case 'a4-portrait': sizeVal = 'A4 portrait'; break;
    case 'letter-landscape': sizeVal = 'letter landscape'; break;
    case 'letter-portrait': sizeVal = 'letter portrait'; break;
    case 'legal-landscape': sizeVal = 'legal landscape'; break;
    case 'legal-portrait': sizeVal = 'legal portrait'; break;
    case 'a3-landscape': sizeVal = 'A3 landscape'; break;
    case 'a4-landscape':
    default: sizeVal = 'A4 landscape'; break;
  }

  // 2. Margins
  let marginVal = '8mm 8mm';
  switch (opts.margin) {
    case 'compact': marginVal = '4mm 5mm'; break;
    case 'wide': marginVal = '14mm 12mm'; break;
    case 'zero': marginVal = '0mm'; break;
    case 'normal':
    default: marginVal = '8mm 8mm'; break;
  }

  const pageRule = `@page { size: ${sizeVal}; margin: ${marginVal}; }`;

  // 3. Font Scale & Table Row Density
  let fontScaleCss = '';
  if (opts.fontScale === 'compact') {
    fontScaleCss = `
      body { font-size: 7pt !important; }
      .data-table th, .matrix-table th { font-size: 6.5pt !important; padding: 2px 3px !important; }
      .data-table td, .matrix-table td { font-size: 6.8pt !important; padding: 2px 3px !important; }
      .emp-book-table th { font-size: 5.8pt !important; padding: 1px 2px !important; }
      .emp-book-table td { font-size: 6pt !important; padding: 1px 2px !important; }
    `;
  } else if (opts.fontScale === 'large') {
    fontScaleCss = `
      body { font-size: 9.5pt !important; }
      .data-table th, .matrix-table th { font-size: 8.5pt !important; padding: 6px 8px !important; }
      .data-table td, .matrix-table td { font-size: 9pt !important; padding: 5px 8px !important; }
      .emp-book-table th { font-size: 7pt !important; padding: 2px 4px !important; }
      .emp-book-table td { font-size: 7.2pt !important; padding: 2px 4px !important; }
    `;
  }

  // 4. Letterhead & Metadata
  let letterheadCss = '';
  if (!opts.showLetterhead) {
    letterheadCss += `
      .print-org-info, .emp-page-org { display: none !important; }
      .print-only-header { border-bottom: none !important; margin-bottom: 4px !important; padding-top: 0 !important; }
      .emp-page-header { border-bottom: none !important; margin-bottom: 2px !important; }
    `;
  }
  if (!opts.showHeaderMeta) {
    letterheadCss += `
      .print-meta-box, .emp-page-meta { display: none !important; }
    `;
  }

  // 5. Signatures
  let signaturesCss = '';
  if (!opts.showSignatures) {
    signaturesCss = `
      .print-only-footer, .emp-page-footer, .print-signatures { display: none !important; }
    `;
  } else {
    const s1 = opts.sig1Title || 'Prepared By';
    const s1Sub = opts.sig1Sub || 'HR / Attendance Officer';
    const s2 = opts.sig2Title || 'Checked & Verified By';
    const s2Sub = opts.sig2Sub || 'Head of Department';
    const s3 = opts.sig3Title || 'Authorized Approval';
    const s3Sub = opts.sig3Sub || 'Director / General Manager';

    const elS1T = document.getElementById('printSig1Title');
    const elS1S = document.getElementById('printSig1Sub');
    const elS2T = document.getElementById('printSig2Title');
    const elS2S = document.getElementById('printSig2Sub');
    const elS3T = document.getElementById('printSig3Title');
    const elS3S = document.getElementById('printSig3Sub');
    if (elS1T) elS1T.textContent = s1;
    if (elS1S) elS1S.textContent = s1Sub;
    if (elS2T) elS2T.textContent = s2;
    if (elS2S) elS2S.textContent = s2Sub;
    if (elS3T) elS3T.textContent = s3;
    if (elS3S) elS3S.textContent = s3Sub;

    document.querySelectorAll('.records-sig1-title').forEach(el => el.textContent = s1);
    document.querySelectorAll('.records-sig1-sub').forEach(el => el.textContent = s1Sub);
    document.querySelectorAll('.records-sig2-title').forEach(el => el.textContent = s2);
    document.querySelectorAll('.records-sig2-sub').forEach(el => el.textContent = s2Sub);
    document.querySelectorAll('.records-sig3-title').forEach(el => el.textContent = s3);
    document.querySelectorAll('.records-sig3-sub').forEach(el => el.textContent = s3Sub);
  }

  // 6. Ink Saver / Monochrome Mode
  let colorModeCss = '';
  if (opts.colorMode === 'ink-saver') {
    colorModeCss = `
      body { filter: grayscale(100%) !important; }
      .badge-on-time, .badge-late, .badge-absent, .badge-half-day, .badge-short-leave, .badge-tag, .btn-toggle-active {
        background: transparent !important;
        color: #000000 !important;
        border: 1px solid #000000 !important;
        font-weight: 700 !important;
      }
      .data-table th, .matrix-table th {
        background: #f4f4f4 !important;
        color: #000000 !important;
        border-color: #333333 !important;
      }
      .data-table td, .matrix-table td {
        color: #000000 !important;
        border-color: #666666 !important;
      }
      .print-meta-badge {
        background: transparent !important;
        color: #000000 !important;
        border: 1.5px solid #000000 !important;
      }
      .matrix-cell-present, .matrix-cell-late, .matrix-cell-absent, .matrix-cell-halfday, .matrix-cell-shortleave, .matrix-cell-rest {
        color: #000000 !important;
        font-weight: 800 !important;
      }
    `;
  }

  // 7. Repeat Headers
  let repeatHeadersCss = '';
  if (opts.repeatHeaders === false) {
    repeatHeadersCss = `
      .data-table thead, .matrix-table thead, .emp-book-table thead { display: table-row-group !important; }
    `;
  } else {
    repeatHeadersCss = `
      .data-table thead, .matrix-table thead, .emp-book-table thead { display: table-header-group !important; }
    `;
  }

  // Inject into dynamicPrintPageStyle
  let styleEl = document.getElementById('dynamicPrintPageStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamicPrintPageStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@media print {
    ${pageRule}
    ${fontScaleCss}
    ${letterheadCss}
    ${signaturesCss}
    ${colorModeCss}
    ${repeatHeadersCss}
  }`;

  // Sync toolbar select
  const pSize = document.getElementById('selectReportPageSize');
  if (pSize && pSize.value !== opts.pageSize) {
    pSize.value = opts.pageSize;
  }
}

function applyPrintPageSize(sizeKey) {
  if (!state.printOptions) loadSavedPrintOptions();
  state.printOptions.pageSize = sizeKey;
  state.reportPageSize = sizeKey;
  savePrintOptions();
  applyAllPrintOptions();
}

function prepareRecordsForPrint() {
  const org = state.org || {};
  const elName = document.getElementById('printRecordsOrgName');
  const elSub = document.getElementById('printRecordsOrgSub');
  const elAddr = document.getElementById('printRecordsOrgAddress');
  const elPhone = document.getElementById('printRecordsOrgPhone');
  const elPhoneWrap = document.getElementById('printRecordsOrgPhoneWrap');
  const elEmail = document.getElementById('printRecordsOrgEmail');
  const elEmailWrap = document.getElementById('printRecordsOrgEmailWrap');
  const elWeb = document.getElementById('printRecordsOrgWebsite');
  const elWebWrap = document.getElementById('printRecordsOrgWebsiteWrap');
  const elFooterText = document.getElementById('printRecordsFooterOrgText');

  if (elName) elName.textContent = org.org_name || 'Organization Attendance Report';
  if (elSub) elSub.textContent = org.org_subtitle || '';
  if (elAddr) elAddr.textContent = org.org_address || '';
  if (elPhone) elPhone.textContent = org.org_phone || '';
  if (elPhoneWrap) elPhoneWrap.style.display = org.org_phone ? 'inline' : 'none';
  if (elEmail) elEmail.textContent = org.org_email || '';
  if (elEmailWrap) elEmailWrap.style.display = org.org_email ? 'inline' : 'none';
  if (elWeb) elWeb.textContent = org.org_website || '';
  if (elWebWrap) elWebWrap.style.display = org.org_website ? 'inline' : 'none';
  if (elFooterText) elFooterText.textContent = org.org_footer || 'SpeedFace-V5L Automated Biometric Attendance & Payroll System';

  const elMainTitle = document.getElementById('printRecordsMainTitle');
  const elBadge = document.getElementById('printRecordsTypeBadge');
  const elPeriod = document.getElementById('printRecordsPeriodRange');
  const elTimestamp = document.getElementById('printRecordsTimestamp');
  const elSubtitle = document.getElementById('printRecordsSubtitle');

  const isDaily = state.recordsView === 'daily';
  if (elBadge) elBadge.textContent = isDaily ? 'Daily Summary' : 'Punch Logs';
  if (elPeriod) {
    if (isDaily) {
      elPeriod.textContent = state.daily.date || new Date().toISOString().split('T')[0];
    } else {
      elPeriod.textContent = (state.records.startDate && state.records.endDate)
        ? `${state.records.startDate} to ${state.records.endDate}`
        : (state.records.quickDate || 'All Records');
    }
  }
  if (elTimestamp) elTimestamp.textContent = new Date().toLocaleString();
  if (elMainTitle) {
    elMainTitle.textContent = isDaily
      ? 'DAILY ATTENDANCE REGISTER (FIRST IN / LAST OUT)'
      : 'DETAILED BIOMETRIC PUNCH AUDIT LOGS';
  }
  if (elSubtitle) {
    if (isDaily) {
      const statFilter = state.daily.statusFilter ? state.daily.statusFilter.toUpperCase() : 'ALL';
      elSubtitle.textContent = `Attendance Date: ${state.daily.date} • Filter: ${statFilter} • Loaded Records: ${state.daily.total || document.querySelectorAll('#dailyTableBody tr').length}`;
    } else {
      elSubtitle.textContent = `Punches Audit Trail • Filter: ${state.records.quickDate || 'All'} • Loaded Records: ${state.records.total || document.querySelectorAll('#recordsTableBody tr').length}`;
    }
  }
}

function triggerPrintDialog() {
  if (state.report.scope === 'monthly_book') {
    if (state.printOptions?.bookScope === 'selected') {
      const jumpSelect = document.getElementById('monthlyBookJumpSelect');
      const selectedUid = jumpSelect ? jumpSelect.value : 'all';
      if (selectedUid && selectedUid !== 'all') {
        document.querySelectorAll('.employee-monthly-page').forEach(p => {
          const match = p.id === `empPage_${selectedUid}` || p.dataset.userId === String(selectedUid);
          p.style.display = match ? '' : 'none';
        });
      } else {
        document.querySelectorAll('.employee-monthly-page').forEach(p => p.style.display = '');
      }
    } else {
      document.querySelectorAll('.employee-monthly-page').forEach(p => p.style.display = '');
      const jumpSelect = document.getElementById('monthlyBookJumpSelect');
      if (jumpSelect) jumpSelect.value = 'all';
    }
  }
  prepareReportForPrint();
  applyAllPrintOptions();
  window.print();
}
window.triggerPrintDialog = triggerPrintDialog;

function openPrintOptionsModal() {
  if (!state.printOptions) loadSavedPrintOptions();
  const opts = state.printOptions;

  const mPageSize = document.getElementById('modalPrintPageSize');
  const mMargin = document.getElementById('modalPrintMargin');
  const mFontScale = document.getElementById('modalPrintFontScale');
  const mColorMode = document.getElementById('modalPrintColorMode');
  const mRepeat = document.getElementById('modalPrintRepeatHeaders');
  const mLetterhead = document.getElementById('modalPrintShowLetterhead');
  const mMeta = document.getElementById('modalPrintShowMeta');
  const mSigs = document.getElementById('modalPrintShowSignatures');
  const mS1T = document.getElementById('modalPrintSig1Title');
  const mS1S = document.getElementById('modalPrintSig1Sub');
  const mS2T = document.getElementById('modalPrintSig2Title');
  const mS2S = document.getElementById('modalPrintSig2Sub');
  const mS3T = document.getElementById('modalPrintSig3Title');
  const mS3S = document.getElementById('modalPrintSig3Sub');
  const mBookScope = document.getElementById('modalPrintBookScope');

  if (mPageSize) mPageSize.value = opts.pageSize || 'a4-landscape';
  if (mMargin) mMargin.value = opts.margin || 'normal';
  if (mFontScale) mFontScale.value = opts.fontScale || 'standard';
  if (mColorMode) mColorMode.value = opts.colorMode || 'color';
  if (mRepeat) mRepeat.checked = opts.repeatHeaders !== false;
  if (mLetterhead) mLetterhead.checked = opts.showLetterhead !== false;
  if (mMeta) mMeta.checked = opts.showHeaderMeta !== false;
  if (mSigs) mSigs.checked = opts.showSignatures !== false;
  if (mS1T) mS1T.value = opts.sig1Title || 'Prepared By';
  if (mS1S) mS1S.value = opts.sig1Sub || 'HR / Attendance Officer';
  if (mS2T) mS2T.value = opts.sig2Title || 'Checked & Verified By';
  if (mS2S) mS2S.value = opts.sig2Sub || 'Head of Department';
  if (mS3T) mS3T.value = opts.sig3Title || 'Authorized Approval';
  if (mS3S) mS3S.value = opts.sig3Sub || 'Director / General Manager';
  if (mBookScope) mBookScope.value = opts.bookScope || 'all';

  const modal = document.getElementById('printOptionsModal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}
window.openPrintOptionsModal = openPrintOptionsModal;

function closePrintOptionsModal() {
  const modal = document.getElementById('printOptionsModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}
window.closePrintOptionsModal = closePrintOptionsModal;

function readPrintOptionsFromModal() {
  const mPageSize = document.getElementById('modalPrintPageSize');
  const mMargin = document.getElementById('modalPrintMargin');
  const mFontScale = document.getElementById('modalPrintFontScale');
  const mColorMode = document.getElementById('modalPrintColorMode');
  const mRepeat = document.getElementById('modalPrintRepeatHeaders');
  const mLetterhead = document.getElementById('modalPrintShowLetterhead');
  const mMeta = document.getElementById('modalPrintShowMeta');
  const mSigs = document.getElementById('modalPrintShowSignatures');
  const mS1T = document.getElementById('modalPrintSig1Title');
  const mS1S = document.getElementById('modalPrintSig1Sub');
  const mS2T = document.getElementById('modalPrintSig2Title');
  const mS2S = document.getElementById('modalPrintSig2Sub');
  const mS3T = document.getElementById('modalPrintSig3Title');
  const mS3S = document.getElementById('modalPrintSig3Sub');
  const mBookScope = document.getElementById('modalPrintBookScope');

  return {
    pageSize: mPageSize ? mPageSize.value : 'a4-landscape',
    margin: mMargin ? mMargin.value : 'normal',
    fontScale: mFontScale ? mFontScale.value : 'standard',
    colorMode: mColorMode ? mColorMode.value : 'color',
    repeatHeaders: mRepeat ? mRepeat.checked : true,
    showLetterhead: mLetterhead ? mLetterhead.checked : true,
    showHeaderMeta: mMeta ? mMeta.checked : true,
    showSignatures: mSigs ? mSigs.checked : true,
    sig1Title: (mS1T && mS1T.value.trim()) ? mS1T.value.trim() : 'Prepared By',
    sig1Sub: (mS1S && mS1S.value.trim()) ? mS1S.value.trim() : 'HR / Attendance Officer',
    sig2Title: (mS2T && mS2T.value.trim()) ? mS2T.value.trim() : 'Checked & Verified By',
    sig2Sub: (mS2S && mS2S.value.trim()) ? mS2S.value.trim() : 'Head of Department',
    sig3Title: (mS3T && mS3T.value.trim()) ? mS3T.value.trim() : 'Authorized Approval',
    sig3Sub: (mS3S && mS3S.value.trim()) ? mS3S.value.trim() : 'Director / General Manager',
    bookScope: mBookScope ? mBookScope.value : 'all'
  };
}

function savePrintOptionsFromModal() {
  state.printOptions = readPrintOptionsFromModal();
  state.reportPageSize = state.printOptions.pageSize;
  savePrintOptions();
  applyAllPrintOptions();
  closePrintOptionsModal();
  showToast('Print & PDF options saved successfully', 'success');
}
window.savePrintOptionsFromModal = savePrintOptionsFromModal;

function resetPrintOptionsToDefaults() {
  state.printOptions = { ...DEFAULT_PRINT_OPTIONS };
  state.reportPageSize = state.printOptions.pageSize;
  savePrintOptions();
  openPrintOptionsModal();
  applyAllPrintOptions();
  showToast('Print options reset to defaults', 'info');
}
window.resetPrintOptionsToDefaults = resetPrintOptionsToDefaults;

function executePrintFromModal() {
  savePrintOptionsFromModal();
  if (state.currentTab === 'tab-records') {
    prepareRecordsForPrint();
    applyAllPrintOptions();
    window.print();
  } else {
    triggerPrintDialog();
  }
}
window.executePrintFromModal = executePrintFromModal;

function initPrintOptions() {
  loadSavedPrintOptions();
  applyAllPrintOptions();

  // Toolbar Options Buttons
  document.getElementById('btnOpenPrintOptionsModal')?.addEventListener('click', openPrintOptionsModal);
  document.getElementById('btnMonthlyBookPrintOptions')?.addEventListener('click', openPrintOptionsModal);
  document.getElementById('btnMatrixPrintOptions')?.addEventListener('click', openPrintOptionsModal);

  // Modal Actions
  document.getElementById('btnPrintOptionsModalClose')?.addEventListener('click', closePrintOptionsModal);
  document.getElementById('btnModalPrintCancel')?.addEventListener('click', closePrintOptionsModal);
  document.getElementById('btnModalPrintSave')?.addEventListener('click', savePrintOptionsFromModal);
  document.getElementById('btnModalPrintReset')?.addEventListener('click', resetPrintOptionsToDefaults);
  document.getElementById('btnModalPrintExecute')?.addEventListener('click', executePrintFromModal);

  // Close modal when clicking backdrop
  const printModal = document.getElementById('printOptionsModal');
  if (printModal) {
    printModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        closePrintOptionsModal();
      }
    });
  }

  // Attendance Records Print button
  document.getElementById('btnPrintRecords')?.addEventListener('click', () => {
    prepareRecordsForPrint();
    applyAllPrintOptions();
    window.print();
  });

  // After print: restore any hidden elements in monthly book
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('.employee-monthly-page').forEach(p => p.style.display = '');
  });
}

function prepareReportForPrint() {
  const org = state.org || {};
  const elName = document.getElementById('printOrgName');
  const elSub = document.getElementById('printOrgSub');
  const elAddr = document.getElementById('printOrgAddress');
  const elPhone = document.getElementById('printOrgPhone');
  const elPhoneWrap = document.getElementById('printOrgPhoneWrap');
  const elEmail = document.getElementById('printOrgEmail');
  const elEmailWrap = document.getElementById('printOrgEmailWrap');
  const elWeb = document.getElementById('printOrgWebsite');
  const elWebWrap = document.getElementById('printOrgWebsiteWrap');
  const elFooterText = document.getElementById('printFooterOrgText');

  if (elName) elName.textContent = org.org_name || 'Organization Attendance Report';
  if (elSub) elSub.textContent = org.org_subtitle || '';
  if (elAddr) elAddr.textContent = org.org_address || '';
  if (elPhone) elPhone.textContent = org.org_phone || '';
  if (elPhoneWrap) elPhoneWrap.style.display = org.org_phone ? 'inline' : 'none';
  if (elEmail) elEmail.textContent = org.org_email || '';
  if (elEmailWrap) elEmailWrap.style.display = org.org_email ? 'inline' : 'none';
  if (elWeb) elWeb.textContent = org.org_website || '';
  if (elWebWrap) elWebWrap.style.display = org.org_website ? 'inline' : 'none';
  if (elFooterText) elFooterText.textContent = org.org_footer || 'SpeedFace-V5L Automated Biometric Attendance & Payroll System';

  // Metadata
  const repType = state.report.type; // 'daily' | 'weekly' | 'monthly'
  const repScope = state.report.scope; // 'all' | 'single'
  const repData = state.report.data || {};

  let mainTitle = 'COMPANY ATTENDANCE REPORT';
  let badgeLabel = 'Daily Report';
  let periodLabel = state.report.date;

  if (repType === 'daily') {
    periodLabel = state.report.date;
    badgeLabel = 'Daily Attendance';
    mainTitle = repScope === 'single' ? 'DAILY EMPLOYEE TIMESHEET' : 'DAILY ATTENDANCE ROLL-CALL AUDIT REPORT';
  } else if (repType === 'weekly') {
    periodLabel = repData.periodLabel || `${repData.startDate || state.report.weekDate} to ${repData.endDate || state.report.weekDate}`;
    badgeLabel = 'Weekly Summary';
    mainTitle = repScope === 'single' ? 'WEEKLY EMPLOYEE TIMESHEET' : 'WEEKLY COMPANY ATTENDANCE SUMMARY';
  } else if (repType === 'monthly') {
    periodLabel = repData.periodLabel || state.report.month;
    badgeLabel = 'Monthly Payroll';
    if (repScope === 'monthly_book') {
      badgeLabel = 'Monthly Book';
      mainTitle = 'MONTHLY EMPLOYEE ATTENDANCE BOOK (1 PAGE PER USER)';
    } else if (repScope === 'monthly_matrix') {
      badgeLabel = 'Monthly Matrix';
      mainTitle = 'MONTHLY ATTENDANCE REGISTER & MATRIX (ALL DAYS)';
    } else {
      mainTitle = repScope === 'single' ? 'MONTHLY EMPLOYEE TIMESHEET' : 'MONTHLY ATTENDANCE & PAYROLL SUMMARY';
    }
  }

  const elMainTitle = document.getElementById('printReportMainTitle');
  const elBadge = document.getElementById('printReportTypeBadge');
  const elPeriod = document.getElementById('printPeriodRange');
  const elTimestamp = document.getElementById('printReportTimestamp');
  const elSubtitle = document.getElementById('printReportSubtitle');

  if (elMainTitle) elMainTitle.textContent = mainTitle;
  if (elBadge) elBadge.textContent = badgeLabel;
  if (elPeriod) elPeriod.textContent = periodLabel;
  if (elTimestamp) elTimestamp.textContent = new Date().toLocaleString();

  if (elSubtitle) {
    if (repScope === 'single') {
      const emp = repData.employee || {};
      const empName = emp.employee_name || `User ID ${state.report.userId}`;
      const dept = emp.department ? ` (${emp.department})` : '';
      const shift = emp.shift_name ? ` • Shift: ${emp.shift_name}` : '';
      elSubtitle.textContent = `Timesheet for: ${empName}${dept}${shift} • Period: ${periodLabel}`;
    } else if (repScope === 'monthly_book') {
      const tot = repData.totalUsers || repData.users?.length || 0;
      elSubtitle.textContent = `Complete Monthly Timesheet Book • Total Staff: ${tot} • 1 Page Per Person • Period: ${periodLabel}`;
    } else if (repScope === 'monthly_matrix') {
      const tot = repData.totalEnrolled || repData.records?.length || 0;
      elSubtitle.textContent = `All Days Attendance Matrix Register • Total Active Staff: ${tot} • Period: ${periodLabel}`;
    } else {
      const tot = repData.stats?.totalEnrolled || repData.records?.length || 0;
      const actFilter = state.report.activeOnly ? 'Active Personnel Only' : 'All Personnel (Active & Inactive)';
      elSubtitle.textContent = `Roster Scope: ${actFilter} • Total Staff: ${tot} • Period: ${periodLabel}`;
    }
  }

  const tabReports = document.getElementById('tab-reports');
  if (tabReports) {
    tabReports.classList.toggle('monthly-matrix-active', repScope === 'monthly_matrix');
    tabReports.classList.toggle('monthly-book-active', repScope === 'monthly_book');
  }

  applyPrintPageSize(state.reportPageSize || 'a4-landscape');
}

async function initReports() {
  // Populate employee dropdown in background
  populateReportEmployeeDropdown();

  // Initialize Report Column Visibility Selector
  loadSavedReportColumns();
  applyReportColumnStyles();
  renderReportColumnSelector();

  const dateInput = document.getElementById('inputReportDate');
  if (dateInput) dateInput.value = state.report.date;

  const weekInput = document.getElementById('inputReportWeekDate');
  if (weekInput) weekInput.value = state.report.weekDate;

  const monthInput = document.getElementById('inputReportMonth');
  if (monthInput) monthInput.value = state.report.month;

  // Period Type Switchers
  const btnDaily = document.getElementById('btnReportTypeDaily');
  const btnWeekly = document.getElementById('btnReportTypeWeekly');
  const btnMonthly = document.getElementById('btnReportTypeMonthly');

  function updateTypeUI(activeType) {
    state.report.type = activeType;
    [btnDaily, btnWeekly, btnMonthly].forEach(b => {
      if (b) b.className = 'btn btn-sm btn-outline';
    });
    if (activeType === 'daily' && btnDaily) btnDaily.className = 'btn btn-sm btn-primary';
    if (activeType === 'weekly' && btnWeekly) btnWeekly.className = 'btn btn-sm btn-primary';
    if (activeType === 'monthly' && btnMonthly) btnMonthly.className = 'btn btn-sm btn-primary';

    const pDaily = document.getElementById('ctrlPeriodDaily');
    const pWeekly = document.getElementById('ctrlPeriodWeekly');
    const pMonthly = document.getElementById('ctrlPeriodMonthly');
    if (pDaily) pDaily.style.display = activeType === 'daily' ? 'flex' : 'none';
    if (pWeekly) pWeekly.style.display = activeType === 'weekly' ? 'flex' : 'none';
    if (pMonthly) pMonthly.style.display = activeType === 'monthly' ? 'flex' : 'none';

    applyReportColumnStyles();
    renderReportColumnSelector();
  }

  btnDaily?.addEventListener('click', () => {
    updateTypeUI('daily');
    loadReportData();
  });
  btnWeekly?.addEventListener('click', () => {
    updateTypeUI('weekly');
    loadReportData();
  });
  btnMonthly?.addEventListener('click', () => {
    updateTypeUI('monthly');
    loadReportData();
  });

  // Scope Switchers (All Users vs Matrix vs Monthly Book vs Individual Employee)
  const btnScopeAll = document.getElementById('btnReportScopeAll');
  const btnScopeMatrix = document.getElementById('btnReportScopeMatrix');
  const btnScopeMonthlyBook = document.getElementById('btnReportScopeMonthlyBook');
  const btnScopeSingle = document.getElementById('btnReportScopeSingle');

  function updateScopeUI(scope) {
    state.report.scope = scope;
    const tabReports = document.getElementById('tab-reports');
    const tableWrap = document.getElementById('reportTableWrap');
    const matrixWrap = document.getElementById('reportMatrixWrap');
    const bookWrap = document.getElementById('reportMonthlyBookWrap');
    const empSel = document.getElementById('ctrlEmployeeSelector');
    const searchCtrl = document.getElementById('ctrlReportSearch');
    const profCard = document.getElementById('reportEmployeeProfileCard');
    const banner = document.getElementById('reportSummaryCardsBanner');
    const pSize = document.getElementById('selectReportPageSize');

    // Toggle column visibility selector dropdown depending on whether reportTable or matrix is active
    const colDropdown = document.getElementById('btnReportColumnsToggle')?.closest('.dropdown');
    if (colDropdown) {
      colDropdown.style.display = (scope === 'monthly_book') ? 'none' : 'inline-block';
    }

    [btnScopeAll, btnScopeMatrix, btnScopeMonthlyBook, btnScopeSingle].forEach(b => {
      if (b) b.className = 'btn btn-sm btn-outline';
    });

    if (scope === 'monthly_matrix') {
      if (btnScopeMatrix) btnScopeMatrix.className = 'btn btn-sm btn-primary';
      if (tabReports) {
        tabReports.classList.add('monthly-matrix-active');
        tabReports.classList.remove('monthly-book-active');
      }
      if (tableWrap) tableWrap.style.display = 'none';
      if (bookWrap) bookWrap.style.display = 'none';
      if (matrixWrap) matrixWrap.style.display = 'block';
      if (banner) banner.style.display = 'flex';
      if (profCard) profCard.style.display = 'none';
      if (empSel) empSel.style.display = 'none';
      if (searchCtrl) searchCtrl.style.display = 'flex';

      if (pSize) {
        pSize.value = 'a4-landscape';
        state.reportPageSize = 'a4-landscape';
        applyPrintPageSize('a4-landscape');
      }
    } else if (scope === 'monthly_book') {
      if (btnScopeMonthlyBook) btnScopeMonthlyBook.className = 'btn btn-sm btn-primary';
      if (tabReports) {
        tabReports.classList.add('monthly-book-active');
        tabReports.classList.remove('monthly-matrix-active');
      }
      if (tableWrap) tableWrap.style.display = 'none';
      if (matrixWrap) matrixWrap.style.display = 'none';
      if (bookWrap) bookWrap.style.display = 'block';
      if (banner) banner.style.display = 'none';
      if (profCard) profCard.style.display = 'none';
      if (empSel) empSel.style.display = 'none';
      if (searchCtrl) searchCtrl.style.display = 'flex';

      if (pSize) {
        pSize.value = 'a4-landscape';
        state.reportPageSize = 'a4-landscape';
        applyPrintPageSize('a4-landscape');
      }
    } else if (scope === 'all') {
      if (btnScopeAll) btnScopeAll.className = 'btn btn-sm btn-primary';
      if (tabReports) {
        tabReports.classList.remove('monthly-book-active');
        tabReports.classList.remove('monthly-matrix-active');
      }
      if (tableWrap) tableWrap.style.display = 'block';
      if (matrixWrap) matrixWrap.style.display = 'none';
      if (bookWrap) bookWrap.style.display = 'none';
      if (banner) banner.style.display = 'flex';
      if (profCard) profCard.style.display = 'none';
      if (empSel) empSel.style.display = 'none';
      if (searchCtrl) searchCtrl.style.display = 'flex';

      if (pSize && !pSize.dataset.userChanged) {
        pSize.value = 'a4-landscape';
        state.reportPageSize = 'a4-landscape';
        applyPrintPageSize('a4-landscape');
      }
    } else {
      if (btnScopeSingle) btnScopeSingle.className = 'btn btn-sm btn-primary';
      if (tabReports) {
        tabReports.classList.remove('monthly-book-active');
        tabReports.classList.remove('monthly-matrix-active');
      }
      if (tableWrap) tableWrap.style.display = 'block';
      if (matrixWrap) matrixWrap.style.display = 'none';
      if (bookWrap) bookWrap.style.display = 'none';
      if (banner) banner.style.display = 'flex';
      if (empSel) empSel.style.display = 'flex';
      if (searchCtrl) searchCtrl.style.display = 'none';

      const sel = document.getElementById('selectReportEmployee');
      if (sel && sel.value && !state.report.userId) {
        state.report.userId = sel.value;
      }

      if (pSize && !pSize.dataset.userChanged) {
        pSize.value = 'a4-portrait';
        state.reportPageSize = 'a4-portrait';
        applyPrintPageSize('a4-portrait');
      }
    }

    if (scope === 'all' || scope === 'single' || scope === 'monthly_matrix') {
      applyReportColumnStyles();
      renderReportColumnSelector();
    }
  }

  btnScopeAll?.addEventListener('click', () => {
    updateScopeUI('all');
    loadReportData();
  });
  btnScopeMatrix?.addEventListener('click', () => {
    if (state.report.type !== 'monthly') {
      updateTypeUI('monthly');
    }
    const pSize = document.getElementById('selectReportPageSize');
    if (pSize) {
      pSize.value = 'a4-landscape';
      state.reportPageSize = 'a4-landscape';
      applyPrintPageSize('a4-landscape');
    }
    updateScopeUI('monthly_matrix');
    loadReportData();
  });
  btnScopeMonthlyBook?.addEventListener('click', () => {
    if (state.report.type !== 'monthly') {
      updateTypeUI('monthly');
    }
    const pSize = document.getElementById('selectReportPageSize');
    if (pSize) {
      pSize.value = 'a4-landscape';
      state.reportPageSize = 'a4-landscape';
      applyPrintPageSize('a4-landscape');
    }
    updateScopeUI('monthly_book');
    loadReportData();
  });
  btnScopeSingle?.addEventListener('click', () => {
    updateScopeUI('single');
    loadReportData();
  });

  // Daily Navigators
  dateInput?.addEventListener('change', (e) => {
    if (e.target.value) {
      state.report.date = e.target.value;
      loadReportData();
    }
  });
  document.getElementById('btnReportPrevDay')?.addEventListener('click', () => {
    const cur = new Date(state.report.date + 'T00:00:00');
    cur.setDate(cur.getDate() - 1);
    const ymd = cur.toISOString().split('T')[0];
    state.report.date = ymd;
    if (dateInput) dateInput.value = ymd;
    loadReportData();
  });
  document.getElementById('btnReportNextDay')?.addEventListener('click', () => {
    const cur = new Date(state.report.date + 'T00:00:00');
    cur.setDate(cur.getDate() + 1);
    const ymd = cur.toISOString().split('T')[0];
    state.report.date = ymd;
    if (dateInput) dateInput.value = ymd;
    loadReportData();
  });
  document.getElementById('btnReportToday')?.addEventListener('click', () => {
    const ymd = new Date().toISOString().split('T')[0];
    state.report.date = ymd;
    if (dateInput) dateInput.value = ymd;
    loadReportData();
  });

  // Weekly Navigators
  weekInput?.addEventListener('change', (e) => {
    if (e.target.value) {
      state.report.weekDate = e.target.value;
      loadReportData();
    }
  });
  document.getElementById('btnReportPrevWeek')?.addEventListener('click', () => {
    const cur = new Date(state.report.weekDate + 'T00:00:00');
    cur.setDate(cur.getDate() - 7);
    const ymd = cur.toISOString().split('T')[0];
    state.report.weekDate = ymd;
    if (weekInput) weekInput.value = ymd;
    loadReportData();
  });
  document.getElementById('btnReportNextWeek')?.addEventListener('click', () => {
    const cur = new Date(state.report.weekDate + 'T00:00:00');
    cur.setDate(cur.getDate() + 7);
    const ymd = cur.toISOString().split('T')[0];
    state.report.weekDate = ymd;
    if (weekInput) weekInput.value = ymd;
    loadReportData();
  });
  document.getElementById('btnReportCurrentWeek')?.addEventListener('click', () => {
    const ymd = new Date().toISOString().split('T')[0];
    state.report.weekDate = ymd;
    if (weekInput) weekInput.value = ymd;
    loadReportData();
  });

  // Monthly Navigators
  monthInput?.addEventListener('change', (e) => {
    if (e.target.value) {
      state.report.month = e.target.value;
      loadReportData();
    }
  });
  document.getElementById('btnReportPrevMonth')?.addEventListener('click', () => {
    const [y, m] = state.report.month.split('-').map(n => parseInt(n, 10));
    const prev = new Date(y, m - 2, 1);
    const ym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    state.report.month = ym;
    if (monthInput) monthInput.value = ym;
    loadReportData();
  });
  document.getElementById('btnReportNextMonth')?.addEventListener('click', () => {
    const [y, m] = state.report.month.split('-').map(n => parseInt(n, 10));
    const next = new Date(y, m, 1);
    const ym = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    state.report.month = ym;
    if (monthInput) monthInput.value = ym;
    loadReportData();
  });
  document.getElementById('btnReportCurrentMonth')?.addEventListener('click', () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    state.report.month = ym;
    if (monthInput) monthInput.value = ym;
    loadReportData();
  });

  // Employee Dropdown
  document.getElementById('selectReportEmployee')?.addEventListener('change', (e) => {
    state.report.userId = e.target.value;
    loadReportData();
  });

  // Search
  document.getElementById('btnReportSearchApply')?.addEventListener('click', () => {
    state.report.search = document.getElementById('inputReportSearch')?.value || '';
    loadReportData();
  });
  document.getElementById('inputReportSearch')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      state.report.search = e.target.value;
      loadReportData();
    }
  });

  // Page Size & Orientation Setup
  const pSize = document.getElementById('selectReportPageSize');
  if (pSize) {
    pSize.value = state.reportPageSize || 'a4-landscape';
    applyPrintPageSize(pSize.value);
    pSize.addEventListener('change', (e) => {
      pSize.dataset.userChanged = 'true';
      state.reportPageSize = e.target.value;
      applyPrintPageSize(e.target.value);
    });
  }



  // Ensure print layout and classes are active even if user hits Ctrl+P natively
  window.addEventListener('beforeprint', () => {
    if (state.report.scope === 'monthly_book') {
      if (state.printOptions?.bookScope === 'selected') {
        const jumpSelect = document.getElementById('monthlyBookJumpSelect');
        const selectedUid = jumpSelect ? jumpSelect.value : 'all';
        if (selectedUid && selectedUid !== 'all') {
          document.querySelectorAll('.employee-monthly-page').forEach(p => {
            const match = p.id === `empPage_${selectedUid}` || p.dataset.userId === String(selectedUid);
            p.style.display = match ? '' : 'none';
          });
        }
      } else {
        document.querySelectorAll('.employee-monthly-page').forEach(p => p.style.display = '');
      }
    }
    if (state.currentTab === 'tab-records') {
      prepareRecordsForPrint();
    } else {
      prepareReportForPrint();
    }
    applyAllPrintOptions();
  });

  document.getElementById('btnPrintReport')?.addEventListener('click', triggerPrintDialog);
  document.getElementById('btnMonthlyBookPrintAll')?.addEventListener('click', triggerPrintDialog);
  document.getElementById('btnMatrixPrint')?.addEventListener('click', triggerPrintDialog);

  // Monthly Book toolbar Prev / Next month buttons
  document.getElementById('btnMonthlyBookPrevMonth')?.addEventListener('click', () => {
    document.getElementById('btnReportPrevMonth')?.click();
  });
  document.getElementById('btnMonthlyBookNextMonth')?.addEventListener('click', () => {
    document.getElementById('btnReportNextMonth')?.click();
  });

  // Active Staff Only Filter
  const chkActiveOnly = document.getElementById('checkReportActiveOnly');
  if (chkActiveOnly) {
    chkActiveOnly.checked = state.report.activeOnly !== false;
    chkActiveOnly.addEventListener('change', (e) => {
      state.report.activeOnly = e.target.checked;
      loadReportData();
    });
  }

  // Column Selector Dropdown Controls (Dismiss on Outside Click)
  const btnColToggle = document.getElementById('btnReportColumnsToggle');
  const menuCol = document.getElementById('reportColumnsMenu');
  menuCol?.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', (e) => {
    if (menuCol && menuCol.style.display === 'block') {
      if (!menuCol.contains(e.target) && e.target !== btnColToggle && !btnColToggle?.contains(e.target)) {
        menuCol.style.display = 'none';
      }
    }
  });

  // Export
  document.getElementById('btnExportReportExcel')?.addEventListener('click', () => triggerReportExport('xlsx'));
  document.getElementById('btnExportReportCsv')?.addEventListener('click', () => triggerReportExport('csv'));
}

async function populateReportEmployeeDropdown() {
  const select = document.getElementById('selectReportEmployee');
  if (!select) return;
  try {
    const res = await fetch('/api/employees');
    const data = await res.json();
    if (data.success && data.employees) {
      // Exclude all inactive employees from attendance reports dropdown
      const activeStaff = data.employees.filter(e => e.is_active !== 0);
      const sorted = [...activeStaff].sort((a, b) => {
        const idA = parseInt(a.user_id, 10);
        const idB = parseInt(b.user_id, 10);
        if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
        return a.user_id.localeCompare(b.user_id);
      });

      select.innerHTML = sorted.map(e => {
        return `<option value="${e.user_id}">ID ${e.user_id} - ${escapeHtml(e.name || 'Unassigned')} (${escapeHtml(e.department || 'General')})</option>`;
      }).join('');

      if (sorted.length > 0 && (!state.report.userId || !activeStaff.some(e => String(e.user_id) === String(state.report.userId)))) {
        state.report.userId = String(sorted[0].user_id);
      }
    }
  } catch (err) {
    console.error('Failed to populate report employees:', err);
  }
}

async function loadReportData() {
  const tbody = document.getElementById('reportTableBody');
  const matrixBody = document.getElementById('reportMatrixBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="14" class="text-center py-4">Generating ${state.report.type} report...</td></tr>`;
  if (matrixBody && state.report.scope === 'monthly_matrix') {
    matrixBody.innerHTML = `<tr><td colspan="45" class="text-center py-4">Generating full calendar month attendance matrix...</td></tr>`;
  }

  try {
    const q = new URLSearchParams();
    q.set('type', state.report.type);
    q.set('scope', state.report.scope);

    if (state.report.type === 'daily') {
      q.set('date', state.report.date);
    } else if (state.report.type === 'weekly') {
      q.set('startDate', state.report.weekDate);
    } else if (state.report.type === 'monthly') {
      q.set('month', state.report.month);
    }

    if (state.report.scope === 'single') {
      if (state.report.userId) q.set('userId', state.report.userId);
    } else {
      if (state.report.search) q.set('search', state.report.search);
      q.set('activeOnly', state.report.activeOnly !== false ? 'true' : 'false');
    }

    const res = await fetch(`/api/reports/data?${q.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    state.report.data = data;

    if (data.periodLabel) {
      const lbl = document.getElementById('reportWeekRangeLabel');
      if (lbl && state.report.type === 'weekly') lbl.textContent = `(${data.startDate} to ${data.endDate})`;
    }

    renderReportKPIBanner(data);
    renderReportProfileBanner(data);
    renderReportTable(data);
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="14" class="text-center py-4 text-danger">Error loading report: ${err.message}</td></tr>`;
    if (matrixBody && state.report.scope === 'monthly_matrix') {
      matrixBody.innerHTML = `<tr><td colspan="45" class="text-center py-4 text-danger">Error loading matrix: ${err.message}</td></tr>`;
    }
  }
}

function renderReportKPIBanner(data) {
  const banner = document.getElementById('reportSummaryCardsBanner');
  if (!banner) return;

  if (state.report.type === 'daily') {
    const stats = data.stats || {};
    banner.innerHTML = `
      <div class="report-kpi-card">
        <span class="report-kpi-label">Total Enrolled</span>
        <span class="report-kpi-val">${stats.totalEnrolled || 0}</span>
        <span class="report-kpi-sub">Employees in roster</span>
      </div>
      <div class="report-kpi-card" style="border-left: 4px solid #16a34a;">
        <span class="report-kpi-label" style="color: #16a34a;">🟢 Present</span>
        <span class="report-kpi-val" style="color: #16a34a;">${stats.present || 0}</span>
        <span class="report-kpi-sub">Punched in today</span>
      </div>
      <div class="report-kpi-card" style="border-left: 4px solid #dc2626;">
        <span class="report-kpi-label" style="color: #dc2626;">🔴 Absent</span>
        <span class="report-kpi-val" style="color: #dc2626;">${stats.absent || 0}</span>
        <span class="report-kpi-sub">No punches recorded</span>
      </div>
      <div class="report-kpi-card" style="border-left: 4px solid #ea580c;">
        <span class="report-kpi-label" style="color: #ea580c;">🟡 Late / Grace</span>
        <span class="report-kpi-val" style="color: #ea580c;">${stats.lateOrGrace || 0}</span>
        <span class="report-kpi-sub">Grace / Late arrivals</span>
      </div>
      <div class="report-kpi-card" style="border-left: 4px solid #9333ea;">
        <span class="report-kpi-label" style="color: #9333ea;">⚡ Overtime (OT)</span>
        <span class="report-kpi-val" style="color: #9333ea;">${stats.otCount || 0}</span>
        <span class="report-kpi-sub">Employees qualified</span>
      </div>
    `;
  } else if (state.report.type === 'weekly') {
    if (state.report.scope === 'single') {
      const tot = data.totals || {};
      banner.innerHTML = `
        <div class="report-kpi-card">
          <span class="report-kpi-label">Scheduled Workdays</span>
          <span class="report-kpi-val">${tot.scheduledWorkDays || 0} Days</span>
          <span class="report-kpi-sub">Monday - Friday</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #16a34a;">
          <span class="report-kpi-label" style="color: #16a34a;">Days Present</span>
          <span class="report-kpi-val" style="color: #16a34a;">${tot.daysPresent || 0} Days</span>
          <span class="report-kpi-sub">Worked this week</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #dc2626;">
          <span class="report-kpi-label" style="color: #dc2626;">Days Absent</span>
          <span class="report-kpi-val" style="color: #dc2626;">${tot.daysAbsent || 0} Days</span>
          <span class="report-kpi-sub">Unattended workdays</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #2563eb;">
          <span class="report-kpi-label" style="color: #2563eb;">Total Worked Time</span>
          <span class="report-kpi-val" style="color: #2563eb;">${tot.totalWorkedFormatted || '0h 0m'}</span>
          <span class="report-kpi-sub">Cumulative hours</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #9333ea;">
          <span class="report-kpi-label" style="color: #9333ea;">Approved OT</span>
          <span class="report-kpi-val" style="color: #9333ea;">+${tot.totalOtHours || 0} H</span>
          <span class="report-kpi-sub">Overtime earned</span>
        </div>
      `;
    } else {
      const recs = data.records || [];
      const totalPresentCount = recs.reduce((acc, r) => acc + (r.days_present || 0), 0);
      const totalOtCount = recs.reduce((acc, r) => acc + (r.total_ot_hours || 0), 0);
      banner.innerHTML = `
        <div class="report-kpi-card">
          <span class="report-kpi-label">Total Enrolled</span>
          <span class="report-kpi-val">${data.totalEnrolled || 0}</span>
          <span class="report-kpi-sub">Employees</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #2563eb;">
          <span class="report-kpi-label" style="color: #2563eb;">Period</span>
          <span class="report-kpi-val" style="font-size: 1rem; color: #2563eb;">${data.startDate} &rarr; ${data.endDate}</span>
          <span class="report-kpi-sub">7 calendar days</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #16a34a;">
          <span class="report-kpi-label" style="color: #16a34a;">Total Attendance</span>
          <span class="report-kpi-val" style="color: #16a34a;">${totalPresentCount}</span>
          <span class="report-kpi-sub">Person-days present</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #9333ea;">
          <span class="report-kpi-label" style="color: #9333ea;">Total Company OT</span>
          <span class="report-kpi-val" style="color: #9333ea;">+${totalOtCount.toFixed(1)} H</span>
          <span class="report-kpi-sub">All employee OT</span>
        </div>
      `;
    }
  } else if (state.report.type === 'monthly') {
    if (state.report.scope === 'single') {
      const tot = data.totals || {};
      banner.innerHTML = `
        <div class="report-kpi-card">
          <span class="report-kpi-label">Working Days</span>
          <span class="report-kpi-val">${tot.scheduledWorkDays || 0} Days</span>
          <span class="report-kpi-sub">${tot.monthDays} calendar days</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #16a34a;">
          <span class="report-kpi-label" style="color: #16a34a;">Days Present</span>
          <span class="report-kpi-val" style="color: #16a34a;">${tot.daysPresent || 0} Days</span>
          <span class="report-kpi-sub">Attendance: <strong>${tot.attendance_pct || '0%'}</strong></span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #dc2626;">
          <span class="report-kpi-label" style="color: #dc2626;">Days Absent</span>
          <span class="report-kpi-val" style="color: #dc2626;">${tot.daysAbsent || 0} Days</span>
          <span class="report-kpi-sub">Uncovered absences</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #ea580c;">
          <span class="report-kpi-label" style="color: #ea580c;">Grace / Short Leave</span>
          <span class="report-kpi-val" style="color: #ea580c;">${tot.graceUsed || 0}G / ${tot.shortLeaveUsed || 0}SL</span>
          <span class="report-kpi-sub">Monthly allowances</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #2563eb;">
          <span class="report-kpi-label" style="color: #2563eb;">Total Worked Time</span>
          <span class="report-kpi-val" style="color: #2563eb;">${tot.totalWorkedFormatted || '0h 0m'}</span>
          <span class="report-kpi-sub">Regular hours</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #9333ea;">
          <span class="report-kpi-label" style="color: #9333ea;">Approved OT</span>
          <span class="report-kpi-val" style="color: #9333ea;">+${tot.totalOtHours || 0} H</span>
          <span class="report-kpi-sub">Payroll overtime</span>
        </div>
      `;
    } else {
      const recs = data.records || [];
      const totalPresentCount = recs.reduce((acc, r) => acc + (r.days_present !== undefined ? r.days_present : (r.totals?.daysPresent || 0)), 0);
      const totalOtCount = recs.reduce((acc, r) => acc + (r.total_ot_hours !== undefined ? r.total_ot_hours : (r.totals?.totalOtHours || 0)), 0);
      banner.innerHTML = `
        <div class="report-kpi-card">
          <span class="report-kpi-label">Total Enrolled</span>
          <span class="report-kpi-val">${data.totalEnrolled || 0}</span>
          <span class="report-kpi-sub">Employees</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #2563eb;">
          <span class="report-kpi-label" style="color: #2563eb;">Reporting Month</span>
          <span class="report-kpi-val" style="color: #2563eb;">${data.periodLabel || data.month}</span>
          <span class="report-kpi-sub">Full calendar month</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #16a34a;">
          <span class="report-kpi-label" style="color: #16a34a;">Total Person-Days</span>
          <span class="report-kpi-val" style="color: #16a34a;">${totalPresentCount}</span>
          <span class="report-kpi-sub">Accumulated attendance</span>
        </div>
        <div class="report-kpi-card" style="border-left: 4px solid #9333ea;">
          <span class="report-kpi-label" style="color: #9333ea;">Company Overtime</span>
          <span class="report-kpi-val" style="color: #9333ea;">+${totalOtCount.toFixed(1)} H</span>
          <span class="report-kpi-sub">Total OT hours</span>
        </div>
      `;
    }
  }
}

function renderReportProfileBanner(data) {
  const card = document.getElementById('reportEmployeeProfileCard');
  if (!card) return;
  if (state.report.scope !== 'single' || !data.employee) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  const emp = data.employee;
  const avatarHtml = emp.employee_photo
    ? `<img src="${emp.employee_photo}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #2563eb;" alt="Photo">`
    : `<div style="width: 44px; height: 44px; border-radius: 50%; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem;">${String(emp.user_id).slice(-2)}</div>`;

    const fullName = [emp.title, emp.employee_name].filter(Boolean).join(' ') || 'Unassigned';
    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${avatarHtml}
          <div>
            <h4 style="margin: 0; font-size: 1.15rem; color: #0f172a; font-weight: 800;">
              ${escapeHtml(fullName)}
              <span style="font-size: 0.85rem; font-weight: 600; color: #64748b; margin-left: 6px;">(FingerPrint ID: ${emp.user_id}${emp.employee_service_id ? ` • <span style="color:#2563eb;">${escapeHtml(emp.employee_service_id)}</span>` : ''})</span>
            </h4>
            <div style="display: flex; gap: 14px; align-items: center; margin-top: 6px; font-size: 0.82rem; color: #475569; flex-wrap: wrap;">
              ${emp.nic ? `<span>🪪 <strong>NIC:</strong> <span class="font-mono">${escapeHtml(emp.nic)}</span></span>` : ''}
              ${emp.gender ? `<span>👤 <strong>Gender:</strong> ${escapeHtml(emp.gender)}</span>` : ''}
              ${emp.phone ? `<span>📞 <strong>Mobile:</strong> <span class="font-mono">${escapeHtml(emp.phone)}</span></span>` : ''}
              ${emp.employment_status ? `<span>📋 <strong>Status:</strong> ${escapeHtml(emp.employment_status)}</span>` : ''}
              <span>🏢 <strong>Dept:</strong> ${escapeHtml(emp.department || 'General')}</span>
              <span>💼 <strong>Role:</strong> ${escapeHtml(emp.role || 'Staff')}</span>
              <span>⏱️ <strong>Shift:</strong> ${escapeHtml(emp.shift_name || 'General Shift')}</span>
            </div>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.82rem; color: #64748b;">
          <span class="badge-tag" style="background:#dbeafe;color:#1d4ed8;font-weight:700;font-size:0.85rem;">
            ${escapeHtml(data.periodLabel || state.report.date)}
          </span>
        </div>
      </div>
    `;
  }

function renderMonthlyBookReport(data) {
  const container = document.getElementById('monthlyBookPagesContainer');
  const countBadge = document.getElementById('monthlyBookCountBadge');
  const periodBadge = document.getElementById('monthlyBookPeriodBadge');
  const jumpSelect = document.getElementById('monthlyBookJumpSelect');
  if (!container) return;

  const users = data.users || [];
  if (countBadge) countBadge.textContent = `${users.length} Staff Pages`;
  if (periodBadge) periodBadge.textContent = data.periodLabel || data.month || 'Month';

  if (jumpSelect) {
    jumpSelect.innerHTML = '<option value="all">View All Staff (All Pages)</option>' +
      users.map((u, i) => {
        const pres = u.totals?.daysPresent || 0;
        const worked = u.totals?.totalWorkedFormatted || '0h';
        const attInfo = pres > 0 ? `• ${pres}d present (${worked})` : '• 0 punches';
        return `
          <option value="emp-page-${u.employee.user_id}">
            [Page ${i + 1}] ID ${u.employee.user_id} - ${escapeHtml(u.employee.employee_name || 'Unassigned')} ${attInfo}
          </option>
        `;
      }).join('');
    jumpSelect.onchange = (e) => {
      const val = e.target.value;
      if (val === 'all') {
        document.querySelectorAll('.employee-monthly-page').forEach(p => p.style.display = '');
      } else {
        document.querySelectorAll('.employee-monthly-page').forEach(p => {
          p.style.display = (p.id === val) ? '' : 'none';
        });
        const target = document.getElementById(val);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  }

  if (users.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; background: #fff; border-radius: 8px; border: 1px dashed #cbd5e1; color: #64748b;">
        No active employees found matching the criteria for ${escapeHtml(data.periodLabel || data.month)}.
      </div>
    `;
    return;
  }

  const org = state.org || {};
  const monthTitle = data.periodLabel || data.month;
  const genTimestamp = new Date().toLocaleString();

  container.innerHTML = users.map((u, i) => {
    const emp = u.employee || {};
    const totals = u.totals || {};
    const timesheet = u.timesheet || [];
    const fullName = [emp.title, emp.employee_name].filter(Boolean).join(' ') || 'Unassigned';

    const todayStr = new Date().toISOString().split('T')[0];
    let totalPunches = 0;
    const tableRowsHtml = timesheet.map((r, rowIdx) => {
      totalPunches += (r.punch_count || 0);
      const isFuture = r.date > todayStr;
      const isAbsent = (r.punch_count === 0 || r.check_in_status === 'ABSENT');
      const isWorkingDay = (r.day_type === 'WEEKDAY');

      // 1. Set Shift Hours column (Shift Check-In & Check-Out target schedule)
      let shiftHoursHtml = '';
      if (isWorkingDay) {
        shiftHoursHtml = `<span class="font-mono" style="color: #0369a1; font-weight: 700; font-size: 0.76rem;">${r.shift_start || '08:30'} &ndash; ${r.shift_end || '16:15'}</span>`;
      } else if (r.day_type === 'WEEKEND') {
        shiftHoursHtml = `<span class="badge-weekend emp-book-badge">Weekend Off</span>`;
      } else {
        shiftHoursHtml = `<span class="badge-holiday emp-book-badge">${escapeHtml(r.day_name || 'Holiday')}</span>`;
      }

      // 2. Actual Punched Check-In column
      let inHtml = '<span class="text-muted" style="color: #94a3b8;">&mdash;</span>';
      if (r.punch_count > 0 && r.check_in_time && r.check_in_time !== '-') {
        inHtml = `<strong class="font-mono" style="color: #15803d; font-size: 0.8rem;">${r.check_in_time}</strong>`;
      }

      // 3. Actual Punched Check-Out column
      let outHtml = '<span class="text-muted" style="color: #94a3b8;">&mdash;</span>';
      if (r.punch_count > 1 && r.check_out_time && r.check_out_time !== '-') {
        outHtml = `<strong class="font-mono" style="color: #15803d; font-size: 0.8rem;">${r.check_out_time}</strong>`;
      } else if (r.punch_count === 1) {
        outHtml = `<span class="badge-tag emp-book-badge" style="background: #fef3c7; color: #92400e; font-size: 0.68rem; font-weight: 700;">Pending Out</span>`;
      }

      // 4. Worked Time
      let workedHtml = '<span class="text-muted" style="color: #94a3b8;">&mdash;</span>';
      if (r.worked_formatted && r.worked_formatted !== '-') {
        workedHtml = `<strong class="font-mono" style="color: #1e3a8a; font-size: 0.8rem;">${r.worked_formatted}</strong>`;
      }

      // 5. Overtime
      let otHtml = '<span class="text-muted" style="color: #94a3b8;">&mdash;</span>';
      if (r.ot_hours > 0) {
        otHtml = `<span class="font-mono" style="color: #7e22ce; font-weight: 700;">+${r.ot_hours}H</span>`;
      }

      // 6. Day badge
      const dayBadge = r.day_type === 'WEEKEND' ? 'badge-weekend' : (r.day_type === 'HOLIDAY' ? 'badge-holiday' : 'badge-weekday');

      // 7. Status & Remarks badge
      let statusBadge = isAbsent ? 'badge-absent' : (r.daily_badge || 'badge-on-time');
      let statusText = r.daily_status || (isAbsent ? 'Absent' : 'Present');
      if (isFuture) {
        statusBadge = 'badge-tag';
        statusText = 'Scheduled / Future';
      } else if (isAbsent && isWorkingDay) {
        statusBadge = 'badge-absent';
        statusText = '🔴 Absent (No Punch)';
      } else if (r.punch_count === 1) {
        statusBadge = 'badge-tag';
        statusText = `Single Punch (${r.check_in_label || 'Check-In'})`;
      } else if (r.punch_count > 1 && r.check_in_label && !statusText.includes(r.check_in_label)) {
        statusText = `${statusText} (${r.check_in_label})`;
      }

      return `
        <tr>
          <td class="text-muted font-mono" style="text-align: center;">${rowIdx + 1}</td>
          <td class="font-mono" style="text-align: center; font-weight: 700; white-space: nowrap;">${r.date}</td>
          <td style="text-align: center;"><span class="${dayBadge} emp-book-badge">${escapeHtml(r.day_name || '')}</span></td>
          <td style="text-align: center; white-space: nowrap;">${shiftHoursHtml}</td>
          <td style="text-align: center; white-space: nowrap;">${inHtml}</td>
          <td style="text-align: center; white-space: nowrap;">${outHtml}</td>
          <td class="font-mono" style="text-align: center;">${r.punch_count || 0}</td>
          <td style="text-align: center; white-space: nowrap;">${workedHtml}</td>
          <td style="text-align: center; white-space: nowrap;">${otHtml}</td>
          <td style="text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><span class="${statusBadge} emp-book-badge">${escapeHtml(statusText)}</span></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="employee-monthly-page" id="emp-page-${emp.user_id}">
        <!-- 1. Compact Organization Header -->
        <div class="emp-page-header">
          <div class="emp-page-org">
            <div class="emp-page-org-name">${escapeHtml(org.org_name || 'Organization Attendance Report')}</div>
            <div class="emp-page-org-sub">${escapeHtml(org.org_subtitle || 'Attendance & Human Resources Division')}</div>
            <div class="emp-page-org-contact">
              ${escapeHtml(org.org_address || '')} 
              ${org.org_phone ? `&bull; Tel: ${escapeHtml(org.org_phone)}` : ''} 
              ${org.org_email ? `&bull; Email: ${escapeHtml(org.org_email)}` : ''}
              ${org.org_website ? `&bull; ${escapeHtml(org.org_website)}` : ''}
            </div>
          </div>
          <div class="emp-page-meta">
            <div class="emp-page-badge">Monthly Timesheet</div>
            <div class="emp-page-month">${escapeHtml(monthTitle)}</div>
            <div class="emp-page-gen-time">Gen: ${genTimestamp}</div>
          </div>
        </div>

        <!-- 2. Employee Profile Strip & Mini Totals -->
        <div class="emp-page-profile-strip">
          <div class="emp-info-col">
            <div class="emp-name-title">
              <strong>${escapeHtml(fullName)}</strong>
              <span class="emp-name-id-meta">(FingerPrint ID: ${emp.user_id}${emp.employee_service_id ? ` &bull; ${escapeHtml(emp.employee_service_id)}` : ''})</span>
            </div>
            <div class="emp-meta-small">
              ${emp.nic ? `<span>NIC: <strong class="font-mono">${escapeHtml(emp.nic)}</strong> &bull; </span>` : ''}
              <span>Dept: <strong>${escapeHtml(emp.department || 'General')}</strong> &bull; </span>
              <span>Role: ${escapeHtml(emp.role || 'Staff')} &bull; </span>
              <span>Shift: <strong>${escapeHtml(emp.shift_name || 'General Shift')}</strong> &bull; </span>
              <span style="color: #0369a1;">Set Shift Hours: <strong class="font-mono">${escapeHtml(emp.shift_start || '08:30')} &ndash; ${escapeHtml(emp.shift_end || '16:15')}</strong> &bull; </span>
              <span style="color: #15803d;">Set In: <strong class="font-mono">${escapeHtml(emp.shift_start || '08:30')}</strong> &bull; </span>
              <span style="color: #b45309;">Set Out: <strong class="font-mono">${escapeHtml(emp.shift_end || '16:15')}</strong></span>
            </div>
          </div>
          <div class="emp-kpi-col">
            <div class="kpi-mini-item"><span class="kpi-label">Work Days</span><span class="kpi-val">${totals.scheduledWorkDays || 0}</span></div>
            <div class="kpi-mini-item"><span class="kpi-label">Present</span><span class="kpi-val" style="color: #15803d;">${totals.daysPresent || 0}</span></div>
            <div class="kpi-mini-item"><span class="kpi-label">Absent</span><span class="kpi-val" style="color: #b91c1c;">${totals.daysAbsent || 0}</span></div>
            <div class="kpi-mini-item"><span class="kpi-label">Half Day</span><span class="kpi-val" style="color: #c2410c;">${totals.halfDays || 0}</span></div>
            <div class="kpi-mini-item"><span class="kpi-label">Grace (X/2)</span><span class="kpi-val">${totals.graceUsed || 0}</span></div>
            <div class="kpi-mini-item"><span class="kpi-label">S-Leave</span><span class="kpi-val">${totals.shortLeaveUsed || 0}</span></div>
            <div class="kpi-mini-item"><span class="kpi-label">Worked</span><span class="kpi-val">${totals.totalWorkedFormatted || '0h 0m'}</span></div>
            <div class="kpi-mini-item"><span class="kpi-label">OT</span><span class="kpi-val" style="color: #7e22ce;">${totals.totalOtHours || 0}H</span></div>
            <div class="kpi-mini-item"><span class="kpi-label">Rate</span><span class="kpi-val" style="color: #1e40af;">${totals.attendance_pct || '0%'}</span></div>
          </div>
        </div>

        <!-- 3. Calendar Month Timesheet Table (Aligned to Landscape Page Area) -->
        <table class="data-table emp-book-table">
          <colgroup>
            <col style="width: 3.5%;">
            <col style="width: 8.5%;">
            <col style="width: 7.5%;">
            <col style="width: 12.0%;">
            <col style="width: 10.5%;">
            <col style="width: 10.5%;">
            <col style="width: 5.0%;">
            <col style="width: 9.0%;">
            <col style="width: 6.5%;">
            <col style="width: 27.0%;">
          </colgroup>
          <thead>
            <tr>
              <th style="text-align: center;">#</th>
              <th style="text-align: center;">Date</th>
              <th style="text-align: center;">Day</th>
              <th style="text-align: center;">Set Shift Hours</th>
              <th style="text-align: center;">Actual Check-In</th>
              <th style="text-align: center;">Actual Check-Out</th>
              <th style="text-align: center;">Punches</th>
              <th style="text-align: center;">Worked Time</th>
              <th style="text-align: center;">OT (Hours)</th>
              <th style="text-align: left;">Daily Status / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr class="emp-book-totals-row">
              <td colspan="6" style="text-align: right; font-weight: 800; padding-right: 8px;">CALENDAR MONTH TOTALS:</td>
              <td class="font-mono" style="text-align: center; font-weight: 800;">${totalPunches}</td>
              <td class="font-mono" style="text-align: center; font-weight: 800; color: #1e3a8a;">${totals.totalWorkedFormatted || '0h 0m'}</td>
              <td class="font-mono" style="text-align: center; font-weight: 800; color: #7e22ce;">${totals.totalOtHours > 0 ? `+${totals.totalOtHours}H` : '0H'}</td>
              <td style="font-weight: 700; text-align: left; padding-left: 6px;">
                Present: ${totals.daysPresent || 0}d &bull; Absent: ${totals.daysAbsent || 0}d &bull; Rate: ${totals.attendance_pct || '0%'}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- 4. Three Sign-off Signature Blocks -->
        <div class="emp-page-footer">
          <div class="print-signatures emp-book-signatures">
            <div class="print-sig-block">
              <div class="print-sig-line"></div>
              <div class="print-sig-title">${escapeHtml(state.printOptions?.sig1Title || 'Prepared By')}</div>
              <div class="print-sig-sub" style="font-size: 6.5pt; color: #64748b;">${escapeHtml(state.printOptions?.sig1Sub || 'HR / Attendance Officer')}</div>
            </div>
            <div class="print-sig-block">
              <div class="print-sig-line"></div>
              <div class="print-sig-title">${escapeHtml(state.printOptions?.sig2Title || 'Checked & Verified By')}</div>
              <div class="print-sig-sub" style="font-size: 6.5pt; color: #64748b;">${escapeHtml(state.printOptions?.sig2Sub || 'Head of Department')}</div>
            </div>
            <div class="print-sig-block">
              <div class="print-sig-line"></div>
              <div class="print-sig-title">${escapeHtml(state.printOptions?.sig3Title || 'Authorized Approval')}</div>
              <div class="print-sig-sub" style="font-size: 6.5pt; color: #64748b;">${escapeHtml(state.printOptions?.sig3Sub || 'Director / General Manager')}</div>
            </div>
          </div>
          <div class="emp-page-footer-note">
            <span>${escapeHtml(org.org_footer || 'SpeedFace-V5L Automated Biometric Attendance & Payroll System')}</span>
            <span>SpeedFace Terminal &bull; Staff Page ${i + 1} of ${users.length}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// State tracking for Matrix Layout (Standard 1-Row vs Proposed Max-Time 2-Row)
function getMatrixLayout() {
  return state.report.matrixLayout || localStorage.getItem('speedface_matrix_layout') || 'standard';
}

function setMatrixLayout(layout) {
  state.report.matrixLayout = layout;
  try {
    localStorage.setItem('speedface_matrix_layout', layout);
  } catch (e) {
    console.warn('Could not save matrix layout preference:', e);
  }

  // Update switcher buttons in UI
  const btnStd = document.getElementById('btnMatrixLayoutStandard');
  const btnProp = document.getElementById('btnMatrixLayoutProposed');
  if (btnStd && btnProp) {
    if (layout === 'proposed') {
      btnStd.className = 'btn btn-sm btn-outline';
      btnStd.style.background = 'transparent';
      btnStd.style.color = '#475569';
      btnProp.className = 'btn btn-sm btn-primary';
      btnProp.style.background = '#2563eb';
      btnProp.style.color = '#ffffff';
    } else {
      btnStd.className = 'btn btn-sm btn-primary';
      btnStd.style.background = '#2563eb';
      btnStd.style.color = '#ffffff';
      btnProp.className = 'btn btn-sm btn-outline';
      btnProp.style.background = 'transparent';
      btnProp.style.color = '#475569';
    }
  }

  const table = document.getElementById('reportMatrixTable');
  if (table) {
    table.classList.toggle('matrix-layout-proposed', layout === 'proposed');
  }

  // Re-render table if data is loaded
  if (window.lastMatrixReportData) {
    renderMonthlyMatrixTable(window.lastMatrixReportData);
  }
}
window.setMatrixLayout = setMatrixLayout;
window.executeSetMatrixLayout = setMatrixLayout;

function renderMonthlyMatrixTable(data) {
  window.lastMatrixReportData = data;
  const thead = document.getElementById('reportMatrixHead');
  const tbody = document.getElementById('reportMatrixBody');
  if (!thead || !tbody) return;

  const dateList = data.dateList || [];
  const records = data.records || [];
  const layout = getMatrixLayout();

  // Sync switcher buttons
  const btnStd = document.getElementById('btnMatrixLayoutStandard');
  const btnProp = document.getElementById('btnMatrixLayoutProposed');
  if (btnStd && btnProp) {
    if (layout === 'proposed') {
      btnStd.className = 'btn btn-sm btn-outline';
      btnStd.style.background = 'transparent';
      btnStd.style.color = '#475569';
      btnProp.className = 'btn btn-sm btn-primary';
      btnProp.style.background = '#2563eb';
      btnProp.style.color = '#ffffff';
    } else {
      btnStd.className = 'btn btn-sm btn-primary';
      btnStd.style.background = '#2563eb';
      btnStd.style.color = '#ffffff';
      btnProp.className = 'btn btn-sm btn-outline';
      btnProp.style.background = 'transparent';
      btnProp.style.color = '#475569';
    }
  }

  const table = document.getElementById('reportMatrixTable');
  if (table) {
    table.classList.toggle('matrix-layout-proposed', layout === 'proposed');
  }

  const countBadge = document.getElementById('matrixStaffCountBadge');
  if (countBadge) countBadge.textContent = `${records.length} Active Staff`;

  if (records.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="45" class="text-center py-4 text-muted">No attendance records found for this period.</td></tr>`;
    applyReportColumnStyles();
    renderReportColumnSelector();
    return;
  }

  // Build Day Column Headers
  const dayHeadersHtml = dateList.map(dStr => {
    const dObj = new Date(dStr + 'T00:00:00');
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dName = dayNames[dObj.getDay()] || '';
    const isWeekend = (dObj.getDay() === 0 || dObj.getDay() === 6);
    const dayNum = dStr.slice(8);

    return `
      <th class="matrix-day-th ${isWeekend ? 'matrix-day-weekend-th' : ''}" title="${dStr} (${dName})">
        <span class="matrix-day-num">${dayNum}</span>
        <span class="matrix-day-name">${dName}</span>
      </th>
    `;
  }).join('');

  if (layout === 'proposed') {
    // ==========================================
    // PROPOSED LAYOUT: Two Rows per Employee
    // Row 1: Employee Identity & Month Summary
    // Row 2: 31 Calendar Days with Maximum Size Times
    // ==========================================
    thead.innerHTML = `
      <tr>
        ${dayHeadersHtml}
      </tr>
    `;

    tbody.innerHTML = records.map((rec, i) => {
      const emp = rec.employee || {};
      const tot = rec.totals || {};
      const days = rec.days || {};

      // Row 1: Employee Header Banner
      const bannerHtml = `
        <tr class="matrix-row-emp-banner">
          <td colspan="${dateList.length}" class="matrix-cell-emp-banner">
            <div class="matrix-emp-banner-inner">
              <div class="matrix-emp-banner-left">
                <span class="matrix-banner-idx" data-col="col-idx">#${i + 1}</span>
                <span class="matrix-banner-uid" data-col="col-uid"><strong>User ID:</strong> <span class="font-mono font-bold" style="color:#0f172a; font-size:0.92rem;">${emp.user_id}</span></span>
                <span class="matrix-banner-name" data-col="col-emp"><strong>Name:</strong> ${escapeHtml(emp.employee_name || 'Unassigned')}</span>
                <span class="matrix-banner-dept" data-col="col-dept"><strong>Dept:</strong> ${escapeHtml(emp.department || 'General')}</span>
                <span class="matrix-banner-shift" data-col="col-shift"><strong>Shift:</strong> ${escapeHtml(emp.shift_name || 'General')}</span>
              </div>
              <div class="matrix-emp-banner-right" data-col="col-totals">
                <span class="matrix-banner-pill" style="background:#e0f2fe; color:#0369a1;" title="Scheduled Work Days">Work: <strong>${tot.scheduledWorkDays || 0}d</strong></span>
                <span class="matrix-banner-pill" style="background:#dcfce7; color:#15803d;" title="Days Present">Pres: <strong>${tot.daysPresent || 0}d</strong></span>
                <span class="matrix-banner-pill" style="background:#fee2e2; color:#b91c1c;" title="Days Absent">Abs: <strong>${tot.daysAbsent || 0}d</strong></span>
                <span class="matrix-banner-pill" style="background:#ffedd5; color:#c2410c;" title="Half Days">HD: <strong>${tot.halfDays || 0}</strong></span>
                <span class="matrix-banner-pill" style="background:#fef9c3; color:#854d0e;" title="Morning Grace Used">Grace: <strong>${tot.graceUsed || 0}</strong></span>
                <span class="matrix-banner-pill" style="background:#f0f9ff; color:#0284c7;" title="Short Leaves Used">SL: <strong>${tot.shortLeaveUsed || 0}</strong></span>
                <span class="matrix-banner-pill" style="background:#dbeafe; color:#1d4ed8;" title="Total Worked Hours">Worked: <strong>${tot.totalWorkedFormatted || '0h'}</strong></span>
                <span class="matrix-banner-pill" style="background:#f3e8ff; color:#7e22ce;" title="Total Overtime Hours">OT: <strong>${tot.totalOtHours > 0 ? `+${tot.totalOtHours}H` : '0H'}</strong></span>
                <span class="matrix-banner-pill" style="background:#ccfbf1; color:#0f766e;" title="Attendance Rate">Att: <strong>${tot.attendance_pct || '0%'}</strong></span>
              </div>
            </div>
          </td>
        </tr>
      `;

      // Row 2: 31 Calendar Days with Maximum Attendance Time Layout
      const daysCellsHtml = dateList.map(dStr => {
        const d = days[dStr];
        const dObj = new Date(dStr + 'T00:00:00');
        const isWeekend = (dObj.getDay() === 0 || dObj.getDay() === 6);
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const dName = dayNames[dObj.getDay()] || '';
        const dayNum = dStr.slice(8);
        const dayTagClass = isWeekend ? 'matrix-max-day-weekend' : (d && d.day_type === 'HOLIDAY' ? 'matrix-max-day-holiday' : '');

        if (!d) {
          return `
            <td class="matrix-cell-max ${isWeekend ? 'matrix-day-weekend' : ''}">
              <span class="matrix-max-day-tag ${dayTagClass}">${dayNum} ${dName}</span>
              <span class="text-muted" style="font-size:1.1rem; line-height:2.2;">-</span>
            </td>
          `;
        }

        if (d.punch_count > 0) {
          let badgeClass = 'matrix-badge-p';
          let badgeText = 'P';

          if (d.daily_status && d.daily_status.includes('Half Day')) {
            badgeClass = 'matrix-badge-hd';
            badgeText = 'HD';
          } else if (d.daily_status && d.daily_status.includes('Grace')) {
            badgeClass = 'matrix-badge-grace';
            badgeText = 'G';
          } else if (d.daily_status && d.daily_status.includes('Short Leave')) {
            badgeClass = 'matrix-badge-sl';
            badgeText = 'SL';
          } else if (d.daily_status && d.daily_status.includes('Late')) {
            badgeClass = 'matrix-badge-grace';
            badgeText = 'L';
          } else if (d.day_type === 'WEEKEND') {
            badgeClass = 'matrix-badge-p';
            badgeText = 'W-WRK';
          } else if (d.day_type === 'HOLIDAY') {
            badgeClass = 'matrix-badge-hol';
            badgeText = 'H-WRK';
          }

          const inTime = d.check_in_time !== '-' ? d.check_in_time.slice(0, 5) : '--:--';
          const outTime = d.check_out_time !== '-' ? d.check_out_time.slice(0, 5) : '--:--';
          const otDisplay = d.ot_hours > 0 ? `<span class="matrix-ot-badge" style="font-size:0.68rem; font-weight:800;">+${d.ot_hours}H</span>` : '';
          const durDisplay = d.worked_formatted && d.worked_formatted !== '-' ? d.worked_formatted : (d.punch_count > 1 ? '0h 0m' : '-');

          return `
            <td class="matrix-cell-max ${isWeekend ? 'matrix-day-weekend' : ''}" title="${dStr} (${dName}): In ${d.check_in_time}, Out ${d.check_out_time} • ${escapeHtml(d.daily_status)} • Worked: ${durDisplay}${d.ot_hours > 0 ? ` • OT: +${d.ot_hours}H` : ''}">
              <span class="matrix-max-day-tag ${dayTagClass}">${dayNum} ${dName}</span>
              <div class="matrix-max-time-box">
                <div class="matrix-time-in-max" title="Check-In Punch Time">
                  <small>IN</small> ${inTime}
                </div>
                <div class="matrix-time-out-max" title="Check-Out Punch Time">
                  <small>OUT</small> ${outTime}
                </div>
              </div>
              <div class="matrix-max-badge-row">
                <span class="matrix-badge ${badgeClass}">${badgeText}</span>
                <span class="matrix-max-dur" title="Worked Duration">${durDisplay}</span>
                ${otDisplay}
              </div>
            </td>
          `;
        } else if (d.day_type === 'WEEKEND') {
          return `
            <td class="matrix-cell-max matrix-day-weekend" title="${dStr} (${dName}): Weekend Off">
              <span class="matrix-max-day-tag ${dayTagClass}">${dayNum} ${dName}</span>
              <div class="matrix-time-off-max">
                <span class="matrix-badge matrix-badge-off" style="font-size:0.75rem; padding: 2px 6px;">OFF</span>
              </div>
              <div class="matrix-max-badge-row"><span class="text-muted">-</span></div>
            </td>
          `;
        } else if (d.day_type === 'HOLIDAY') {
          return `
            <td class="matrix-cell-max" style="background: #faf5ff;" title="${dStr} (${dName}): ${escapeHtml(d.day_name || 'Holiday')}">
              <span class="matrix-max-day-tag ${dayTagClass}">${dayNum} ${dName}</span>
              <div class="matrix-time-hol-max">
                <span class="matrix-badge matrix-badge-hol" style="font-size:0.75rem; padding: 2px 6px;">HOL</span>
              </div>
              <div class="matrix-max-badge-row"><span class="text-muted">-</span></div>
            </td>
          `;
        } else {
          return `
            <td class="matrix-cell-max" style="background: #fff5f5;" title="${dStr} (${dName}): Absent (No Punch)">
              <span class="matrix-max-day-tag ${dayTagClass}">${dayNum} ${dName}</span>
              <div class="matrix-time-absent-max">
                <span class="matrix-badge matrix-badge-a" style="font-size:0.75rem; padding: 2px 6px;">ABSENT</span>
              </div>
              <div class="matrix-max-badge-row"><span class="text-muted">-</span></div>
            </td>
          `;
        }
      }).join('');

      return bannerHtml + `<tr class="matrix-row-max-times">${daysCellsHtml}</tr>`;
    }).join('');

  } else {
    // ==========================================
    // STANDARD LAYOUT: Single Row per Employee
    // ==========================================
    thead.innerHTML = `
      <tr>
        <th class="matrix-col-idx" data-col="col-idx">#</th>
        <th class="matrix-col-uid" data-col="col-uid">User ID</th>
        <th class="matrix-col-name" data-col="col-emp">Employee Name</th>
        <th class="matrix-col-dept" data-col="col-dept" style="min-width: 90px; text-align: left;">Department</th>
        <th class="matrix-col-shift" data-col="col-shift" style="min-width: 100px; text-align: left;">Shift</th>
        ${dayHeadersHtml}
        <th class="matrix-tot-th matrix-tot-workdays" data-col="col-totals" title="Scheduled Work Days">Work</th>
        <th class="matrix-tot-th matrix-tot-pres" data-col="col-totals" style="color: #15803d;" title="Days Present">Pres</th>
        <th class="matrix-tot-th matrix-tot-abs" data-col="col-totals" style="color: #b91c1c;" title="Days Absent">Abs</th>
        <th class="matrix-tot-th matrix-tot-hd" data-col="col-totals" style="color: #c2410c;" title="Half Days">HD</th>
        <th class="matrix-tot-th matrix-tot-grace" data-col="col-totals" style="color: #a16207;" title="Morning Grace Days Used">Grace</th>
        <th class="matrix-tot-th matrix-tot-sl" data-col="col-totals" style="color: #0369a1;" title="Short Leaves Used">SL</th>
        <th class="matrix-tot-th matrix-tot-worked" data-col="col-totals" style="color: #1d4ed8; min-width: 72px;" title="Total Worked Hours">Worked</th>
        <th class="matrix-tot-th matrix-tot-ot" data-col="col-totals" style="color: #7e22ce; min-width: 48px;" title="Total Overtime Hours">OT</th>
        <th class="matrix-tot-th matrix-tot-att" data-col="col-totals" style="color: #0284c7; min-width: 48px;" title="Attendance Percentage">Att %</th>
      </tr>
    `;

    tbody.innerHTML = records.map((rec, i) => {
      const emp = rec.employee || {};
      const tot = rec.totals || {};
      const days = rec.days || {};

      const dayCellsHtml = dateList.map(dStr => {
        const d = days[dStr];
        const dObj = new Date(dStr + 'T00:00:00');
        const isWeekend = (dObj.getDay() === 0 || dObj.getDay() === 6);

        if (!d) {
          return `<td class="matrix-cell ${isWeekend ? 'matrix-day-weekend' : ''}"><span class="text-muted">-</span></td>`;
        }

        if (d.punch_count > 0) {
          let badgeClass = 'matrix-badge-p';
          let badgeText = 'P';

          if (d.daily_status && d.daily_status.includes('Half Day')) {
            badgeClass = 'matrix-badge-hd';
            badgeText = 'HD';
          } else if (d.daily_status && d.daily_status.includes('Grace')) {
            badgeClass = 'matrix-badge-grace';
            badgeText = 'G';
          } else if (d.daily_status && d.daily_status.includes('Short Leave')) {
            badgeClass = 'matrix-badge-sl';
            badgeText = 'SL';
          } else if (d.daily_status && d.daily_status.includes('Late')) {
            badgeClass = 'matrix-badge-grace';
            badgeText = 'L';
          } else if (d.day_type === 'WEEKEND') {
            badgeClass = 'matrix-badge-p';
            badgeText = 'W-WRK';
          } else if (d.day_type === 'HOLIDAY') {
            badgeClass = 'matrix-badge-hol';
            badgeText = 'H-WRK';
          }

          const inTime = d.check_in_time !== '-' ? d.check_in_time.slice(0, 5) : '--:--';
          const outTime = d.check_out_time !== '-' ? d.check_out_time.slice(0, 5) : '--:--';
          const timeDisplay = `<span class="matrix-time-in">${inTime}</span><span class="matrix-time-sep">-</span><span class="matrix-time-out">${outTime}</span>`;
          const otDisplay = d.ot_hours > 0 ? `<span class="matrix-ot-badge">+${d.ot_hours}H</span>` : '';
          const durDisplay = d.worked_formatted && d.worked_formatted !== '-' ? d.worked_formatted : (d.punch_count > 1 ? '0h 0m' : '-');

          return `
            <td class="matrix-cell ${isWeekend ? 'matrix-day-weekend' : ''}" title="${dStr}: In ${d.check_in_time}, Out ${d.check_out_time} • ${escapeHtml(d.daily_status)} • Worked: ${durDisplay}${d.ot_hours > 0 ? ` • OT: +${d.ot_hours}H` : ''}">
              <div class="matrix-cell-sub">
                <span class="matrix-badge ${badgeClass}">${badgeText}</span>
                ${otDisplay}
              </div>
              <div class="matrix-cell-times">${timeDisplay}</div>
              <div class="matrix-cell-dur" title="Worked: ${durDisplay}">${durDisplay}</div>
            </td>
          `;
        } else if (d.day_type === 'WEEKEND') {
          return `
            <td class="matrix-cell matrix-day-weekend" title="${dStr}: Weekend Off">
              <span class="matrix-badge matrix-badge-off">OFF</span>
              <div class="matrix-cell-empty-line">-</div>
            </td>
          `;
        } else if (d.day_type === 'HOLIDAY') {
          return `
            <td class="matrix-cell" style="background: #faf5ff;" title="${dStr}: ${escapeHtml(d.day_name || 'Holiday')}">
              <span class="matrix-badge matrix-badge-hol">HOL</span>
              <div class="matrix-cell-empty-line">-</div>
            </td>
          `;
        } else {
          return `
            <td class="matrix-cell" style="background: #fff5f5;" title="${dStr}: Absent (No Punch)">
              <span class="matrix-badge matrix-badge-a">A</span>
              <div class="matrix-cell-empty-line">-</div>
            </td>
          `;
        }
      }).join('');

      return `
        <tr>
          <td class="matrix-col-idx text-muted font-mono" data-col="col-idx">${i + 1}</td>
          <td class="matrix-col-uid font-mono" data-col="col-uid">${emp.user_id}</td>
          <td class="matrix-col-name" data-col="col-emp" title="${escapeHtml(emp.employee_name || 'Unassigned')}">
            ${escapeHtml(emp.employee_name || 'Unassigned')}
          </td>
          <td class="matrix-col-dept" data-col="col-dept" style="white-space: nowrap; font-size: 0.73rem;">${escapeHtml(emp.department || 'General')}</td>
          <td class="matrix-col-shift" data-col="col-shift" style="white-space: nowrap; font-size: 0.73rem;">${escapeHtml(emp.shift_name || 'General')}</td>
          ${dayCellsHtml}
          <td class="matrix-tot-td matrix-tot-workdays" data-col="col-totals">${tot.scheduledWorkDays || 0}</td>
          <td class="matrix-tot-td matrix-tot-pres" data-col="col-totals" style="color: #15803d;">${tot.daysPresent || 0}</td>
          <td class="matrix-tot-td matrix-tot-abs" data-col="col-totals" style="color: ${tot.daysAbsent > 0 ? '#b91c1c' : 'var(--text-muted)'};">${tot.daysAbsent || 0}</td>
          <td class="matrix-tot-td matrix-tot-hd" data-col="col-totals">${tot.halfDays || 0}</td>
          <td class="matrix-tot-td matrix-tot-grace" data-col="col-totals">${tot.graceUsed || 0}</td>
          <td class="matrix-tot-td matrix-tot-sl" data-col="col-totals">${tot.shortLeaveUsed || 0}</td>
          <td class="matrix-tot-td matrix-tot-worked" data-col="col-totals" style="color: #1d4ed8; font-weight: 800;">${tot.totalWorkedFormatted || '0h 0m'}</td>
          <td class="matrix-tot-td matrix-tot-ot" data-col="col-totals" style="color: ${tot.totalOtHours > 0 ? '#7e22ce' : 'var(--text-muted)'}; font-weight: 800;">
            ${tot.totalOtHours > 0 ? `+${tot.totalOtHours}H` : '0H'}
          </td>
          <td class="matrix-tot-td matrix-tot-att" data-col="col-totals" style="color: #0284c7; font-weight: 800;">${tot.attendance_pct || '0%'}</td>
        </tr>
      `;
    }).join('');
  }

  applyReportColumnStyles();
  renderReportColumnSelector();
}

// ==========================================
// Report Table Column Selector Registry & State
// ==========================================

// Column definitions are defined at top level of file

function getCurrentReportViewMode() {
  if (state.report.scope === 'monthly_matrix') return 'monthly_matrix';
  if (state.report.scope === 'single') return 'timesheet';
  if (state.report.type === 'daily') return 'daily';
  if (state.report.type === 'weekly') return 'weekly_all';
  if (state.report.type === 'monthly') return 'monthly_all';
  return 'daily';
}

function loadSavedReportColumns() {
  try {
    const raw = localStorage.getItem('speedface_report_columns');
    if (raw) {
      state.report.columns = JSON.parse(raw);
      return;
    }
  } catch (e) {
    console.warn('Could not load saved report columns:', e);
  }
  state.report.columns = {};
}

function saveReportColumns() {
  try {
    localStorage.setItem('speedface_report_columns', JSON.stringify(state.report.columns || {}));
  } catch (e) {
    console.warn('Could not save report columns:', e);
  }
}

function applyReportColumnStyles() {
  const viewMode = getCurrentReportViewMode();
  const colDefs = REPORT_COLUMNS_DEF[viewMode] || [];
  const colStates = state.report.columns?.[viewMode] || {};

  let hiddenCss = '';
  let visibleCount = 0;

  colDefs.forEach(col => {
    const isVisible = colStates[col.key] !== false;
    if (isVisible) {
      visibleCount++;
    } else {
      hiddenCss += `
        #reportTable th[data-col="${col.key}"],
        #reportTable td[data-col="${col.key}"],
        #reportMatrixTable th[data-col="${col.key}"],
        #reportMatrixTable td[data-col="${col.key}"],
        #reportMatrixTable [data-col="${col.key}"] {
          display: none !important;
        }
      `;
    }
  });

  // For monthly_matrix: dynamically adjust sticky column left offsets and borders
  if (viewMode === 'monthly_matrix') {
    const isIdxVis = colStates['col-idx'] !== false;
    const isUidVis = colStates['col-uid'] !== false;
    const isEmpVis = colStates['col-emp'] !== false;

    // Adjust left offset for User ID if # is hidden
    if (!isIdxVis) {
      hiddenCss += `
        #reportMatrixTable .matrix-col-uid {
          left: 0px !important;
        }
      `;
    }

    // Adjust left offset for Employee Name based on visible preceding sticky columns
    let nameLeft = 0;
    if (isIdxVis) nameLeft += 38;
    if (isUidVis) nameLeft += 70;
    hiddenCss += `
      #reportMatrixTable .matrix-col-name {
        left: ${nameLeft}px !important;
      }
    `;

    // Ensure border-right separator on the rightmost sticky column
    if (!isEmpVis) {
      if (isUidVis) {
        hiddenCss += `
          #reportMatrixTable .matrix-col-uid {
            border-right: 2px solid #94a3b8 !important;
          }
        `;
      } else if (isIdxVis) {
        hiddenCss += `
          #reportMatrixTable .matrix-col-idx {
            border-right: 2px solid #94a3b8 !important;
          }
        `;
      }
    }
  }

  let styleEl = document.getElementById('dynamicReportColumnsStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamicReportColumnsStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = hiddenCss;

  // Update badges on buttons (both report header button and matrix toolbar button)
  const badge1 = document.getElementById('reportColumnsBadge');
  const badge2 = document.getElementById('matrixColumnsBadge');
  [badge1, badge2].forEach(badge => {
    if (!badge) return;
    if (visibleCount === colDefs.length) {
      badge.textContent = 'All';
      badge.style.background = '#e2e8f0';
      badge.style.color = '#1e293b';
    } else {
      badge.textContent = `${visibleCount}/${colDefs.length}`;
      badge.style.background = '#dbeafe';
      badge.style.color = '#1e40af';
    }
  });

  // Update subtitle
  const subEl = document.getElementById('reportColumnsSubtitle');
  if (subEl) {
    let modeName = 'Daily Report';
    if (viewMode === 'weekly_all') modeName = 'Weekly Summary';
    else if (viewMode === 'monthly_all') modeName = 'Monthly Payroll Summary';
    else if (viewMode === 'timesheet') modeName = 'Employee Timesheet';
    else if (viewMode === 'monthly_matrix') modeName = 'All Days Matrix';
    subEl.textContent = `${modeName} (${visibleCount}/${colDefs.length} active)`;
  }
}

function renderReportColumnSelector() {
  const listEl = document.getElementById('reportColumnsList');
  if (!listEl) return;
  const viewMode = getCurrentReportViewMode();
  const colDefs = REPORT_COLUMNS_DEF[viewMode] || [];
  const colStates = state.report.columns?.[viewMode] || {};

  listEl.innerHTML = colDefs.map(col => {
    const checked = colStates[col.key] !== false;
    return `
      <label style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.82rem; color: #1e293b; padding: 4px 6px; border-radius: 4px; cursor: pointer; user-select: none; transition: background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
        <span style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" class="report-col-chk" data-col-key="${col.key}" ${checked ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px;">
          <span style="${checked ? 'font-weight: 600; color: #1e293b;' : 'color: #64748b;'}">${escapeHtml(col.label)}</span>
        </span>
      </label>
    `;
  }).join('');

  listEl.querySelectorAll('.report-col-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const key = e.target.dataset.colKey;
      if (!state.report.columns) state.report.columns = {};
      if (!state.report.columns[viewMode]) state.report.columns[viewMode] = {};
      state.report.columns[viewMode][key] = e.target.checked;
      saveReportColumns();
      applyReportColumnStyles();
      const labelText = e.target.nextElementSibling || e.target.parentElement?.querySelector('span:last-child');
      if (labelText) {
        labelText.style.fontWeight = e.target.checked ? '600' : 'normal';
        labelText.style.color = e.target.checked ? '#1e293b' : '#64748b';
      }
    });
  });

  applyReportColumnStyles();
}

function toggleReportColumnsMenu(e) {
  if (e) {
    if (e.stopPropagation) e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  const menuCol = document.getElementById('reportColumnsMenu');
  if (!menuCol) return;

  // Dynamically re-parent menu if opened from another dropdown container
  const triggerBtn = e?.currentTarget || (e?.target ? e.target.closest('button') : null);
  if (triggerBtn && triggerBtn.parentElement && triggerBtn.parentElement.classList.contains('dropdown')) {
    if (menuCol.parentElement !== triggerBtn.parentElement) {
      triggerBtn.parentElement.appendChild(menuCol);
    }
  }

  const isOpen = menuCol.style.display === 'block';
  if (isOpen) {
    menuCol.style.display = 'none';
  } else {
    menuCol.style.display = 'block';
    renderReportColumnSelector();
  }
}
window.toggleReportColumnsMenu = toggleReportColumnsMenu;

function closeReportColumnsMenu() {
  const menuCol = document.getElementById('reportColumnsMenu');
  if (menuCol) menuCol.style.display = 'none';
}
window.closeReportColumnsMenu = closeReportColumnsMenu;

function selectAllReportColumns() {
  const viewMode = getCurrentReportViewMode();
  const colDefs = REPORT_COLUMNS_DEF[viewMode] || [];
  if (!state.report.columns) state.report.columns = {};
  if (!state.report.columns[viewMode]) state.report.columns[viewMode] = {};
  colDefs.forEach(c => state.report.columns[viewMode][c.key] = true);
  saveReportColumns();
  applyReportColumnStyles();
  renderReportColumnSelector();
}
window.selectAllReportColumns = selectAllReportColumns;
window.executeSelectAllReportColumns = selectAllReportColumns;

function resetReportColumns() {
  const viewMode = getCurrentReportViewMode();
  const colDefs = REPORT_COLUMNS_DEF[viewMode] || [];
  if (!state.report.columns) state.report.columns = {};
  if (!state.report.columns[viewMode]) state.report.columns[viewMode] = {};
  colDefs.forEach(c => state.report.columns[viewMode][c.key] = c.default !== false);
  saveReportColumns();
  applyReportColumnStyles();
  renderReportColumnSelector();
  showToast('Columns reset to default', 'info', 2000);
}
window.resetReportColumns = resetReportColumns;
window.executeResetReportColumns = resetReportColumns;

// Global window exposure for robust click handling
window.openPrintOptionsModal = openPrintOptionsModal;
window.closePrintOptionsModal = closePrintOptionsModal;
window.savePrintOptionsFromModal = savePrintOptionsFromModal;
window.resetPrintOptionsToDefaults = resetPrintOptionsToDefaults;
window.executePrintFromModal = executePrintFromModal;
window.triggerPrintDialog = triggerPrintDialog;
window.toggleReportColumnsMenu = toggleReportColumnsMenu;
window.closeReportColumnsMenu = closeReportColumnsMenu;
window.selectAllReportColumns = selectAllReportColumns;
window.resetReportColumns = resetReportColumns;

function renderReportTable(data) {
  const thead = document.getElementById('reportTableHead');
  const tbody = document.getElementById('reportTableBody');
  if (!thead || !tbody) return;

  if (state.report.scope === 'monthly_matrix' || data.scope === 'monthly_matrix') {
    renderMonthlyMatrixTable(data);
    return;
  }

  if (state.report.scope === 'monthly_book' || data.scope === 'monthly_book') {
    renderMonthlyBookReport(data);
    return;
  }

  if (state.report.type === 'daily') {
    thead.innerHTML = `
      <tr>
        <th data-col="col-idx">#</th>
        <th data-col="col-date">Date</th>
        <th data-col="col-day">Day</th>
        <th data-col="col-uid">User ID</th>
        <th data-col="col-emp">Employee Name</th>
        <th data-col="col-dept">Department</th>
        <th data-col="col-shift">Shift</th>
        <th data-col="col-checkin">Check-In (First Punch)</th>
        <th data-col="col-checkout">Check-Out (Last Punch)</th>
        <th data-col="col-worked">Worked Time</th>
        <th data-col="col-ot">OT (Hours)</th>
        <th data-col="col-status">Daily Status</th>
      </tr>
    `;

    const records = data.records || [];
    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">No attendance records found for this date.</td></tr>`;
      applyReportColumnStyles();
      renderReportColumnSelector();
      return;
    }

    tbody.innerHTML = records.map((r, i) => {
      const isAbsent = (r.punch_count === 0 || r.check_in_status === 'ABSENT');
      const checkInPill = isAbsent
        ? `<span class="badge-absent">🔴 Absent (No Punch)</span>`
        : (r.check_in_time && r.check_in_time !== '-')
          ? `<div style="display:flex; flex-direction:column; gap:2px;">
               <span class="font-mono font-bold" style="color:var(--text-main); font-size:0.88rem;">${r.check_in_time}</span>
               <span class="${r.check_in_badge || 'badge-on-time'}" style="width:fit-content; font-size:0.75rem;">${escapeHtml(r.check_in_label || 'On Time')}</span>
             </div>`
          : `<span class="text-muted">-</span>`;

      const checkOutPill = isAbsent
        ? `<span class="text-muted">-</span>`
        : (r.check_out_time && r.check_out_time !== '-')
          ? `<div style="display:flex; flex-direction:column; gap:2px;">
               <span class="font-mono font-bold" style="color:var(--text-main); font-size:0.88rem;">${r.check_out_time}</span>
               <span class="${r.check_out_badge || 'badge-on-time'}" style="width:fit-content; font-size:0.75rem;">${escapeHtml(r.check_out_label || 'Full Day')}</span>
             </div>`
          : `<span class="badge-tag" style="background:#f1f5f9;color:#64748b;font-size:0.75rem;">Pending / Missing</span>`;

      const dayBadgeClass = r.day_type === 'WEEKEND' ? 'badge-weekend' : (r.day_type === 'HOLIDAY' ? 'badge-holiday' : 'badge-weekday');
      const statusBadgeClass = isAbsent ? 'badge-absent' : (r.daily_badge || 'badge-on-time');

      return `
        <tr>
          <td data-col="col-idx" class="text-muted font-mono">${i + 1}</td>
          <td data-col="col-date" class="font-mono"><strong>${r.date}</strong></td>
          <td data-col="col-day"><span class="${dayBadgeClass}">${escapeHtml(r.day_name || '')}</span></td>
          <td data-col="col-uid" class="font-mono"><strong>${r.user_id}</strong></td>
          <td data-col="col-emp"><strong>${escapeHtml(r.employee_name || 'Unassigned')}</strong></td>
          <td data-col="col-dept">${escapeHtml(r.department || 'General')}</td>
          <td data-col="col-shift">${escapeHtml(r.shift_name || 'General')}</td>
          <td data-col="col-checkin">${checkInPill}</td>
          <td data-col="col-checkout">${checkOutPill}</td>
          <td data-col="col-worked" class="font-mono">${r.worked_formatted !== '-' ? `<strong>${r.worked_formatted}</strong>` : '-'}</td>
          <td data-col="col-ot">${r.ot_hours > 0 ? `<span class="badge-tag" style="background:#f3e8ff;color:#7e22ce;font-weight:700;">⚡ +${r.ot_hours}H OT</span>` : '<span class="text-muted">0 H</span>'}</td>
          <td data-col="col-status"><span class="${statusBadgeClass}">${escapeHtml(r.daily_status || (isAbsent ? 'Absent' : 'Present'))}</span></td>
        </tr>
      `;
    }).join('');
  } else if (state.report.type === 'weekly') {
    if (state.report.scope === 'single') {
      // 7-day single user timesheet
      thead.innerHTML = `
        <tr>
          <th data-col="col-idx">#</th>
          <th data-col="col-date">Date</th>
          <th data-col="col-day">Day</th>
          <th data-col="col-shift">Shift</th>
          <th data-col="col-checkin">Check-In (First Punch)</th>
          <th data-col="col-checkout">Check-Out (Last Punch)</th>
          <th data-col="col-punches">Punches</th>
          <th data-col="col-worked">Worked Duration</th>
          <th data-col="col-ot">OT (Hours)</th>
          <th data-col="col-status">Daily Status</th>
        </tr>
      `;

      const timesheet = data.timesheet || [];
      if (timesheet.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No timesheet records found for this week.</td></tr>`;
        applyReportColumnStyles();
        renderReportColumnSelector();
        return;
      }

      tbody.innerHTML = timesheet.map((r, i) => {
        const isAbsent = (r.punch_count === 0 || r.check_in_status === 'ABSENT');
        const checkInPill = isAbsent
          ? `<span class="badge-absent">🔴 Absent (No Punch)</span>`
          : (r.check_in_time && r.check_in_time !== '-')
            ? `<strong>${r.check_in_time}</strong> <span class="${r.check_in_badge || 'badge-on-time'}" style="font-size:0.75rem;">${escapeHtml(r.check_in_label || 'In')}</span>`
            : `<span class="text-muted">-</span>`;

        const checkOutPill = isAbsent
          ? `<span class="text-muted">-</span>`
          : (r.check_out_time && r.check_out_time !== '-')
            ? `<strong>${r.check_out_time}</strong> <span class="${r.check_out_badge || 'badge-on-time'}" style="font-size:0.75rem;">${escapeHtml(r.check_out_label || 'Out')}</span>`
            : `<span class="badge-tag" style="background:#f1f5f9;color:#64748b;font-size:0.75rem;">Pending / Missing</span>`;

        const dayBadgeClass = r.day_type === 'WEEKEND' ? 'badge-weekend' : (r.day_type === 'HOLIDAY' ? 'badge-holiday' : 'badge-weekday');
        const statusBadgeClass = isAbsent ? 'badge-absent' : (r.daily_badge || 'badge-on-time');

        return `
          <tr>
            <td data-col="col-idx" class="text-muted font-mono">${i + 1}</td>
            <td data-col="col-date" class="font-mono"><strong>${r.date}</strong></td>
            <td data-col="col-day"><span class="${dayBadgeClass}">${escapeHtml(r.day_name || '')}</span></td>
            <td data-col="col-shift">${escapeHtml(r.shift_name || 'General')}</td>
            <td data-col="col-checkin">${checkInPill}</td>
            <td data-col="col-checkout">${checkOutPill}</td>
            <td data-col="col-punches" class="font-mono text-center">${r.punch_count || 0}</td>
            <td data-col="col-worked" class="font-mono">${r.worked_formatted !== '-' ? `<strong>${r.worked_formatted}</strong>` : '-'}</td>
            <td data-col="col-ot">${r.ot_hours > 0 ? `<span class="badge-tag" style="background:#f3e8ff;color:#7e22ce;font-weight:700;">⚡ +${r.ot_hours}H OT</span>` : '<span class="text-muted">0 H</span>'}</td>
            <td data-col="col-status"><span class="${statusBadgeClass}">${escapeHtml(r.daily_status || (isAbsent ? 'Absent' : 'Present'))}</span></td>
          </tr>
        `;
      }).join('');
    } else {
      // Weekly All Users Summary
      thead.innerHTML = `
        <tr>
          <th data-col="col-idx">#</th>
          <th data-col="col-uid">User ID</th>
          <th data-col="col-emp">Employee Name</th>
          <th data-col="col-dept">Department</th>
          <th data-col="col-shift">Shift</th>
          <th data-col="col-sched">Scheduled Days</th>
          <th data-col="col-present">Days Present</th>
          <th data-col="col-absent">Days Absent</th>
          <th data-col="col-half">Half Days</th>
          <th data-col="col-late">Late / Grace</th>
          <th data-col="col-worked">Total Worked Time</th>
          <th data-col="col-ot">Total OT (Hours)</th>
          <th data-col="col-rate">Attendance %</th>
        </tr>
      `;

      const records = data.records || [];
      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="text-center py-4 text-muted">No employee summaries found.</td></tr>`;
        applyReportColumnStyles();
        renderReportColumnSelector();
        return;
      }

      tbody.innerHTML = records.map((r, i) => `
        <tr>
          <td data-col="col-idx" class="text-muted font-mono">${i + 1}</td>
          <td data-col="col-uid" class="font-mono"><strong>${r.user_id}</strong></td>
          <td data-col="col-emp"><strong>${escapeHtml(r.employee_name || 'Unassigned')}</strong></td>
          <td data-col="col-dept">${escapeHtml(r.department || 'General')}</td>
          <td data-col="col-shift">${escapeHtml(r.shift_name || 'General')}</td>
          <td data-col="col-sched" class="font-mono text-center">${r.scheduled_days}</td>
          <td data-col="col-present" class="font-mono text-center" style="color: #16a34a; font-weight: 700;">${r.days_present}</td>
          <td data-col="col-absent" class="font-mono text-center" style="color: ${r.days_absent > 0 ? '#dc2626' : 'var(--text-muted)'}; font-weight: 700;">${r.days_absent}</td>
          <td data-col="col-half" class="font-mono text-center">${r.half_days}</td>
          <td data-col="col-late" class="font-mono text-center">${r.late_or_grace}</td>
          <td data-col="col-worked" class="font-mono"><strong>${r.total_worked_formatted}</strong></td>
          <td data-col="col-ot">${r.total_ot_hours > 0 ? `<span class="badge-tag" style="background:#f3e8ff;color:#7e22ce;font-weight:700;">⚡ +${r.total_ot_hours}H OT</span>` : '<span class="text-muted">0 H</span>'}</td>
          <td data-col="col-rate"><span class="badge-tag" style="background:#e0f2fe;color:#0369a1;font-weight:700;">${r.attendance_pct}</span></td>
        </tr>
      `).join('');
    }
  } else if (state.report.type === 'monthly') {
    if (state.report.scope === 'single') {
      // Monthly Single User Full Timesheet
      thead.innerHTML = `
        <tr>
          <th data-col="col-idx">#</th>
          <th data-col="col-date">Date</th>
          <th data-col="col-day">Day</th>
          <th data-col="col-shift">Shift</th>
          <th data-col="col-checkin">Check-In (First Punch)</th>
          <th data-col="col-checkout">Check-Out (Last Punch)</th>
          <th data-col="col-punches">Punches</th>
          <th data-col="col-worked">Worked Duration</th>
          <th data-col="col-ot">OT (Hours)</th>
          <th data-col="col-status">Daily Status</th>
        </tr>
      `;

      const timesheet = data.timesheet || [];
      if (timesheet.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No timesheet records found for this month.</td></tr>`;
        applyReportColumnStyles();
        renderReportColumnSelector();
        return;
      }

      tbody.innerHTML = timesheet.map((r, i) => {
        const isAbsent = (r.punch_count === 0 || r.check_in_status === 'ABSENT');
        const checkInPill = isAbsent
          ? `<span class="badge-absent">🔴 Absent (No Punch)</span>`
          : (r.check_in_time && r.check_in_time !== '-')
            ? `<strong>${r.check_in_time}</strong> <span class="${r.check_in_badge || 'badge-on-time'}" style="font-size:0.75rem;">${escapeHtml(r.check_in_label || 'In')}</span>`
            : `<span class="text-muted">-</span>`;

        const checkOutPill = isAbsent
          ? `<span class="text-muted">-</span>`
          : (r.check_out_time && r.check_out_time !== '-')
            ? `<strong>${r.check_out_time}</strong> <span class="${r.check_out_badge || 'badge-on-time'}" style="font-size:0.75rem;">${escapeHtml(r.check_out_label || 'Out')}</span>`
            : `<span class="badge-tag" style="background:#f1f5f9;color:#64748b;font-size:0.75rem;">Pending / Missing</span>`;

        const dayBadgeClass = r.day_type === 'WEEKEND' ? 'badge-weekend' : (r.day_type === 'HOLIDAY' ? 'badge-holiday' : 'badge-weekday');
        const statusBadgeClass = isAbsent ? 'badge-absent' : (r.daily_badge || 'badge-on-time');

        return `
          <tr>
            <td data-col="col-idx" class="text-muted font-mono">${i + 1}</td>
            <td data-col="col-date" class="font-mono"><strong>${r.date}</strong></td>
            <td data-col="col-day"><span class="${dayBadgeClass}">${escapeHtml(r.day_name || '')}</span></td>
            <td data-col="col-shift">${escapeHtml(r.shift_name || 'General')}</td>
            <td data-col="col-checkin">${checkInPill}</td>
            <td data-col="col-checkout">${checkOutPill}</td>
            <td data-col="col-punches" class="font-mono text-center">${r.punch_count || 0}</td>
            <td data-col="col-worked" class="font-mono">${r.worked_formatted !== '-' ? `<strong>${r.worked_formatted}</strong>` : '-'}</td>
            <td data-col="col-ot">${r.ot_hours > 0 ? `<span class="badge-tag" style="background:#f3e8ff;color:#7e22ce;font-weight:700;">⚡ +${r.ot_hours}H OT</span>` : '<span class="text-muted">0 H</span>'}</td>
            <td data-col="col-status"><span class="${statusBadgeClass}">${escapeHtml(r.daily_status || (isAbsent ? 'Absent' : 'Present'))}</span></td>
          </tr>
        `;
      }).join('');
    } else {
      // Monthly All Users Payroll Summary
      thead.innerHTML = `
        <tr>
          <th data-col="col-idx">#</th>
          <th data-col="col-uid">User ID</th>
          <th data-col="col-emp">Employee Name</th>
          <th data-col="col-dept">Department</th>
          <th data-col="col-shift">Shift</th>
          <th data-col="col-workdays">Month Work Days</th>
          <th data-col="col-present">Days Present</th>
          <th data-col="col-absent">Days Absent</th>
          <th data-col="col-half">Half Days</th>
          <th data-col="col-grace">Grace (X/2)</th>
          <th data-col="col-shortleave">Short Leaves (Y/2)</th>
          <th data-col="col-worked">Total Worked Time</th>
          <th data-col="col-ot">Total OT (Hours)</th>
          <th data-col="col-rate">Attendance %</th>
        </tr>
      `;

      const records = data.records || [];
      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" class="text-center py-4 text-muted">No monthly summaries found.</td></tr>`;
        applyReportColumnStyles();
        renderReportColumnSelector();
        return;
      }

      tbody.innerHTML = records.map((r, i) => `
        <tr>
          <td data-col="col-idx" class="text-muted font-mono">${i + 1}</td>
          <td data-col="col-uid" class="font-mono"><strong>${r.user_id}</strong></td>
          <td data-col="col-emp"><strong>${escapeHtml(r.employee_name || 'Unassigned')}</strong></td>
          <td data-col="col-dept">${escapeHtml(r.department || 'General')}</td>
          <td data-col="col-shift">${escapeHtml(r.shift_name || 'General')}</td>
          <td data-col="col-workdays" class="font-mono text-center">${r.month_working_days}</td>
          <td data-col="col-present" class="font-mono text-center" style="color: #16a34a; font-weight: 700;">${r.days_present}</td>
          <td data-col="col-absent" class="font-mono text-center" style="color: ${r.days_absent > 0 ? '#dc2626' : 'var(--text-muted)'}; font-weight: 700;">${r.days_absent}</td>
          <td data-col="col-half" class="font-mono text-center">${r.half_days}</td>
          <td data-col="col-grace" class="font-mono text-center">${r.grace_used}</td>
          <td data-col="col-shortleave" class="font-mono text-center">${r.short_leave_used}</td>
          <td data-col="col-worked" class="font-mono"><strong>${r.total_worked_formatted}</strong></td>
          <td data-col="col-ot">${r.total_ot_hours > 0 ? `<span class="badge-tag" style="background:#f3e8ff;color:#7e22ce;font-weight:700;">⚡ +${r.total_ot_hours}H OT</span>` : '<span class="text-muted">0 H</span>'}</td>
          <td data-col="col-rate"><span class="badge-tag" style="background:#e0f2fe;color:#0369a1;font-weight:700;">${r.attendance_pct}</span></td>
        </tr>
      `).join('');
    }
  }

  applyReportColumnStyles();
  renderReportColumnSelector();
}

function triggerReportExport(format) {
  const q = new URLSearchParams();
  q.set('type', state.report.type);
  q.set('scope', state.report.scope);
  q.set('format', format);

  if (state.report.type === 'daily') {
    q.set('date', state.report.date);
  } else if (state.report.type === 'weekly') {
    q.set('startDate', state.report.weekDate);
  } else if (state.report.type === 'monthly') {
    q.set('month', state.report.month);
  }

  if (state.report.scope === 'single') {
    if (state.report.userId) q.set('userId', state.report.userId);
  } else {
    if (state.report.search) q.set('search', state.report.search);
    q.set('activeOnly', state.report.activeOnly !== false ? 'true' : 'false');
  }

  showToast(`Generating ${state.report.type.toUpperCase()} Report ${format.toUpperCase()} export...`, 'info');
  window.location.href = `/api/reports/export?${q.toString()}`;
}

// 4. Employees Management
async function initEmployees() {
  document.getElementById('btnSyncUsers')?.addEventListener('click', async () => {
    showToast('Refreshing users from SpeedFace device...', 'info');
    await triggerManualSync();
    await loadEmployees();
  });

  document.getElementById('btnExportEmployeesExcel')?.addEventListener('click', () => {
    showToast('Generating Employees Excel export...', 'info');
    window.location.href = '/api/employees/export?format=xlsx';
  });

  document.getElementById('btnExportEmployeesCsv')?.addEventListener('click', () => {
    showToast('Generating Employees CSV export...', 'info');
    window.location.href = '/api/employees/export?format=csv';
  });

  // Employee Upload / Import Handlers
  document.getElementById('btnUploadEmployees')?.addEventListener('click', () => openEmployeeUploadModal());
  document.getElementById('btnEmployeeUploadModalClose')?.addEventListener('click', closeEmployeeUploadModal);
  document.getElementById('btnEmployeeUploadCancel')?.addEventListener('click', closeEmployeeUploadModal);
  document.getElementById('employeeUploadModalBackdrop')?.addEventListener('click', closeEmployeeUploadModal);

  const empDropzone = document.getElementById('employeeUploadDropzone');
  const empFileInput = document.getElementById('inputEmployeeUpload');
  const empBrowseBtn = document.getElementById('btnBrowseEmployeeFile');

  empBrowseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    empFileInput?.click();
  });

  empDropzone?.addEventListener('click', () => {
    empFileInput?.click();
  });

  empFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleEmployeeFileSelected(file);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    empDropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      empDropzone.style.borderColor = 'var(--primary)';
      empDropzone.style.background = '#eff6ff';
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    empDropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      empDropzone.style.borderColor = '#cbd5e1';
      empDropzone.style.background = '#f8fafc';
    });
  });

  empDropzone?.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt?.files?.[0];
    if (file) handleEmployeeFileSelected(file);
  });

  document.getElementById('btnEmployeeUploadConfirm')?.addEventListener('click', async () => {
    await confirmEmployeesImport();
  });

  document.getElementById('btnPushAllToDevice')?.addEventListener('click', async () => {
    showToast('Syncing all employee names and roles to SpeedFace terminal...', 'info');
    try {
      const res = await fetch('/api/employees/sync-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Synced ${data.count} employees to terminal!`, 'success');
      } else {
        showToast(data.error || 'Sync failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Employee Status Filter Chips (All, Active, Inactive)
  const filterAll = document.getElementById('filterEmpStatusAll');
  const filterActive = document.getElementById('filterEmpStatusActive');
  const filterInactive = document.getElementById('filterEmpStatusInactive');

  function updateEmpFilterUI(filter) {
    state.employeesFilter = filter;
    [filterAll, filterActive, filterInactive].forEach(btn => btn?.classList.remove('active'));
    if (filter === 'all' && filterAll) filterAll.classList.add('active');
    if (filter === 'active' && filterActive) filterActive.classList.add('active');
    if (filter === 'inactive' && filterInactive) filterInactive.classList.add('active');
    loadEmployees();
  }

  filterAll?.addEventListener('click', () => updateEmpFilterUI('all'));
  filterActive?.addEventListener('click', () => updateEmpFilterUI('active'));
  filterInactive?.addEventListener('click', () => updateEmpFilterUI('inactive'));

  // Photo Upload Handlers
  const photoInput = document.getElementById('modalPhotoInput');
  const photoImg = document.getElementById('modalPhotoImg');
  const photoPlaceholder = document.getElementById('modalPhotoPlaceholder');
  const photoData = document.getElementById('modalPhotoData');
  const btnRemovePhoto = document.getElementById('btnRemovePhoto');

  photoInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        const maxDim = 480;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);

        photoImg.src = resizedBase64;
        photoImg.style.display = 'block';
        photoPlaceholder.style.display = 'none';
        photoData.value = resizedBase64;
        btnRemovePhoto.style.display = 'inline-block';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  btnRemovePhoto?.addEventListener('click', () => {
    photoImg.src = '';
    photoImg.style.display = 'none';
    photoPlaceholder.style.display = 'block';
    photoData.value = '';
    if (photoInput) photoInput.value = '';
    btnRemovePhoto.style.display = 'none';
  });

  // Modal handlers
  document.getElementById('btnModalClose')?.addEventListener('click', closeEmployeeModal);
  document.getElementById('btnModalCancel')?.addEventListener('click', closeEmployeeModal);
  document.querySelector('.modal-backdrop')?.addEventListener('click', closeEmployeeModal);

  document.getElementById('employeeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const syncToDevice = document.getElementById('modalSyncDevice')?.checked ?? true;
    const payload = {
      user_id: document.getElementById('modalUserId').value,
      employee_service_id: document.getElementById('modalServiceId').value,
      nic: document.getElementById('modalNic').value,
      title: document.getElementById('modalTitleSelect').value,
      name: document.getElementById('modalName').value,
      gender: document.getElementById('modalGender').value,
      birthday: document.getElementById('modalBirthday').value,
      appointment_date: document.getElementById('modalAppointmentDate').value,
      employment_status: document.getElementById('modalStatus').value,
      department: document.getElementById('modalDept').value,
      role: document.getElementById('modalRole').value,
      shift_id: parseInt(document.getElementById('modalShiftId')?.value, 10) || 1,
      email: document.getElementById('modalEmail').value,
      phone: document.getElementById('modalPhone').value,
      photo: document.getElementById('modalPhotoData').value,
      is_active: document.getElementById('modalIsActive')?.checked ? 1 : 0,
      syncToDevice
    };

    try {
      showToast(syncToDevice ? 'Updating & syncing with SpeedFace device...' : 'Saving employee...', 'info');
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Employee updated successfully!', 'success');
        closeEmployeeModal();
        loadEmployees();
        loadDashboardStats();
        populateReportEmployeeDropdown();
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadEmployees() {
  const tbody = document.getElementById('employeesTableBody');
  tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4">Loading employees...</td></tr>`;

  try {
    const res = await fetch(`/api/employees?status=${state.employeesFilter || 'all'}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    // Update status count chips
    if (data.counts) {
      const elAll = document.getElementById('empCountAll');
      const elAct = document.getElementById('empCountActive');
      const elInact = document.getElementById('empCountInactive');
      if (elAll) elAll.textContent = data.counts.total ?? 0;
      if (elAct) elAct.textContent = data.counts.active ?? 0;
      if (elInact) elInact.textContent = data.counts.inactive ?? 0;
    }

    if (!data.employees || data.employees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted">No employees found.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.employees.map((emp) => {
      const avatarHtml = emp.photo
        ? `<img src="${emp.photo}" class="table-avatar-img" alt="Photo" onerror="this.outerHTML='<span class=\\'table-avatar-initial\\'>${String(emp.user_id).slice(-2)}</span>'">`
        : `<span class="table-avatar-initial">${String(emp.user_id).slice(-2)}</span>`;

      const genderBadge = emp.gender === 'Male'
        ? `<span class="badge-tag" style="background:#eff6ff;color:#2563eb;font-weight:600;">Male ♂</span>`
        : (emp.gender === 'Female' ? `<span class="badge-tag" style="background:#fdf2f8;color:#db2777;font-weight:600;">Female ♀</span>` : '<span class="text-muted">-</span>');

      const statusBadge = emp.employment_status === 'Permanent'
        ? `<span class="badge-on-time" style="font-size:0.75rem;">Permanent</span>`
        : (emp.employment_status ? `<span class="badge-tag" style="font-size:0.75rem;">${escapeHtml(emp.employment_status)}</span>` : '<span class="text-muted">-</span>');

      const isActive = emp.is_active !== 0;
      const activeBadge = isActive
        ? `<button class="btn-toggle-active" data-userid="${emp.user_id}" data-name="${escapeHtml(emp.name || '')}" data-newstatus="0" style="border:1px solid #bbf7d0; background:#f0fdf4; color:#16a34a; font-weight:700; font-size:0.75rem; padding:3px 8px; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s;" title="Click to mark Inactive">
            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#22c55e;"></span> Active
          </button>`
        : `<button class="btn-toggle-active" data-userid="${emp.user_id}" data-name="${escapeHtml(emp.name || '')}" data-newstatus="1" style="border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-weight:700; font-size:0.75rem; padding:3px 8px; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s;" title="Click to mark Active">
            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#94a3b8;"></span> Inactive
          </button>`;

      const displayName = [emp.title, emp.name].filter(Boolean).join(' ') || 'Unassigned';

      return `
        <tr style="${!isActive ? 'opacity: 0.65; background: #fafafa;' : ''}">
          <td class="font-mono"><strong>${emp.user_id}</strong></td>
          <td class="font-mono" style="font-weight:600; color:#2563eb;">${escapeHtml(emp.employee_service_id || '-')}</td>
          <td class="font-mono text-muted" style="font-size:0.85rem;">${escapeHtml(emp.nic || '-')}</td>
          <td>
            <div class="table-user-cell">
              ${avatarHtml}
              <div>
                <strong>${escapeHtml(displayName)}</strong>
                ${emp.department ? `<div class="text-xs text-muted">${escapeHtml(emp.department)} • ${escapeHtml(emp.role || 'Staff')}</div>` : ''}
              </div>
            </div>
          </td>
          <td>${genderBadge}</td>
          <td>${statusBadge}</td>
          <td>${activeBadge}</td>
          <td class="font-mono">${escapeHtml(emp.phone || '-')}</td>
          <td>
            <span class="badge-shift-pill" title="${emp.shift_start || ''} - ${emp.shift_end || ''}">
              <span class="badge-shift-dot" style="background: ${emp.shift_color || '#2563eb'};"></span>
              ${escapeHtml(emp.shift_name || 'General Shift')}
            </span>
          </td>
          <td><span class="badge-tag">${emp.total_punches || 0} punches</span></td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-sm btn-outline btn-edit-emp" data-emp='${JSON.stringify(emp).replace(/'/g, "&apos;")}'>
                Edit Details
              </button>
              <button class="btn btn-sm btn-outline btn-sync-single" data-userid="${emp.user_id}" data-name="${escapeHtml(emp.name || '')}" data-role="${escapeHtml(emp.role || 'Staff')}" title="Sync this user to SpeedFace device">
                Sync
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach edit button listeners
    document.querySelectorAll('.btn-edit-emp').forEach((btn) => {
      btn.addEventListener('click', () => {
        const emp = JSON.parse(btn.getAttribute('data-emp'));
        openEmployeeModal(emp);
      });
    });

    // Attach active toggle button listeners
    document.querySelectorAll('.btn-toggle-active').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const userId = btn.getAttribute('data-userid');
        const name = btn.getAttribute('data-name');
        const newStatus = btn.getAttribute('data-newstatus');
        const statusLabel = newStatus === '1' ? 'Active' : 'Inactive';
        btn.disabled = true;
        btn.style.opacity = '0.5';

        try {
          const res = await fetch(`/api/employees/${userId}/toggle-active`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            showToast(`User ${userId} (${name || 'Employee'}) marked as ${statusLabel}`, 'success');
            await loadEmployees();
            await populateReportEmployeeDropdown();
          } else {
            showToast(data.error || 'Failed to update status', 'error');
            btn.disabled = false;
            btn.style.opacity = '1';
          }
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      });
    });

    // Attach single sync button listeners
    document.querySelectorAll('.btn-sync-single').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-userid');
        const name = btn.getAttribute('data-name');
        const role = btn.getAttribute('data-role');

        showToast(`Syncing User ${userId} (${name || 'Employee'}) to SpeedFace...`, 'info');
        try {
          const res = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, name, role, syncToDevice: true })
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message, 'success');
          } else {
            showToast(data.error || 'Sync failed', 'error');
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-danger">Error: ${err.message}</td></tr>`;
  }
}

async function openEmployeeModal(emp) {
  document.getElementById('modalUserId').value = emp.user_id;
  document.getElementById('modalServiceId').value = emp.employee_service_id || '';
  document.getElementById('modalNic').value = emp.nic || '';
  document.getElementById('modalTitleSelect').value = emp.title || '';
  document.getElementById('modalName').value = emp.name || '';
  document.getElementById('modalGender').value = emp.gender || '';
  document.getElementById('modalBirthday').value = emp.birthday || '';
  document.getElementById('modalAppointmentDate').value = emp.appointment_date || '';
  document.getElementById('modalStatus').value = emp.employment_status || 'Permanent';
  document.getElementById('modalDept').value = emp.department || '';
  document.getElementById('modalRole').value = emp.role || '';
  document.getElementById('modalEmail').value = emp.email || '';
  document.getElementById('modalPhone').value = emp.phone || '';

  const chkActive = document.getElementById('modalIsActive');
  if (chkActive) {
    chkActive.checked = (emp.is_active !== 0);
  }

  // Populate shift select
  if (!state.shifts || state.shifts.length === 0) {
    await loadShifts();
  }
  const shiftSelect = document.getElementById('modalShiftId');
  if (shiftSelect && state.shifts.length > 0) {
    shiftSelect.innerHTML = state.shifts.map((s) => `
      <option value="${s.id}" ${s.id === (emp.shift_id || 1) ? 'selected' : ''}>
        ${escapeHtml(s.name)} (${s.start_time} - ${s.end_time})
      </option>
    `).join('');
  }

  const photoImg = document.getElementById('modalPhotoImg');
  const photoPlaceholder = document.getElementById('modalPhotoPlaceholder');
  const photoData = document.getElementById('modalPhotoData');
  const btnRemovePhoto = document.getElementById('btnRemovePhoto');

  if (emp.photo) {
    photoImg.src = emp.photo;
    photoImg.style.display = 'block';
    photoPlaceholder.style.display = 'none';
    photoData.value = emp.photo;
    if (btnRemovePhoto) btnRemovePhoto.style.display = 'inline-block';
  } else {
    photoImg.src = '';
    photoImg.style.display = 'none';
    photoPlaceholder.style.display = 'block';
    photoPlaceholder.textContent = String(emp.user_id).slice(-2);
    photoData.value = '';
    if (btnRemovePhoto) btnRemovePhoto.style.display = 'none';
  }

  document.getElementById('modalTitle').textContent = `Edit User ${emp.user_id} (${emp.name || 'Unassigned'})`;
  document.getElementById('employeeModal').classList.add('active');
}

function closeEmployeeModal() {
  document.getElementById('employeeModal').classList.remove('active');
}

// 5. Device Control & Diagnostics
async function initDeviceControl() {
  document.getElementById('btnTestConn')?.addEventListener('click', testDeviceConnection);
  document.getElementById('btnActionSync')?.addEventListener('click', triggerManualSync);
  document.getElementById('btnActionSyncTime')?.addEventListener('click', syncDeviceTime);
  document.getElementById('btnActionReboot')?.addEventListener('click', rebootDevice);

  // Network Interface change & refresh handlers
  document.getElementById('settingNetworkInterface')?.addEventListener('change', () => {
    updateInterfaceSubnetBadge();
  });

  document.getElementById('btnRefreshInterfaces')?.addEventListener('click', async () => {
    showToast('Scanning network adapters...', 'info');
    await loadNetworkInterfaces();
    showToast('Network adapters updated!', 'success');
  });

  // Device Connection Settings Form
  document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ifaceSelect = document.getElementById('settingNetworkInterface');
    const selectedIfaceName = ifaceSelect ? ifaceSelect.value : '';
    const selectedIfaceIp = document.getElementById('settingNetworkInterfaceIp')?.value || '';

    const payload = {
      device_ip: document.getElementById('settingIp').value,
      device_port: document.getElementById('settingPort').value,
      network_interface: selectedIfaceName,
      network_interface_ip: selectedIfaceIp,
      auto_sync_interval: document.getElementById('settingInterval').value,
      auto_sync_enabled: document.getElementById('settingAutoSyncEnabled').checked
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Device connection & network settings saved successfully!', 'success');
        loadDeviceControlData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Organization & Report Letterhead Settings Form
  document.getElementById('orgSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      org_name: document.getElementById('settingOrgName')?.value || '',
      org_subtitle: document.getElementById('settingOrgSubtitle')?.value || '',
      org_website: document.getElementById('settingOrgWebsite')?.value || '',
      org_address: document.getElementById('settingOrgAddress')?.value || '',
      org_phone: document.getElementById('settingOrgPhone')?.value || '',
      org_email: document.getElementById('settingOrgEmail')?.value || '',
      org_footer: document.getElementById('settingOrgFooter')?.value || ''
    };

    try {
      showToast('Saving organization details...', 'info');
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Organization details saved successfully!', 'success');
        state.org = { ...state.org, ...payload };
        prepareReportForPrint();
      } else {
        showToast(data.error || 'Failed to save organization settings', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Data Backup & Reset Handlers
  document.getElementById('btnDownloadBackup')?.addEventListener('click', () => {
    window.location.href = '/api/device/backup-download';
    showToast('Preparing full database backup JSON download...', 'info');
  });

  const resetModal = document.getElementById('resetDataModal');
  const confirmInput = document.getElementById('inputResetConfirmText');
  const confirmBtn = document.getElementById('btnConfirmResetData');
  const hintEl = document.getElementById('resetConfirmHint');
  const chkAtt = document.getElementById('chkResetAttendance');
  const chkEmp = document.getElementById('chkResetEmployees');
  const chkLog = document.getElementById('chkResetSyncLogs');
  const chkTerm = document.getElementById('chkClearTerminalLogs');

  function updateResetModalValidation() {
    if (!confirmBtn || !confirmInput) return;
    const hasCheckedItem = Boolean((chkAtt && chkAtt.checked) || (chkEmp && chkEmp.checked) || (chkLog && chkLog.checked) || (chkTerm && chkTerm.checked));
    const isTextMatch = (confirmInput.value.trim().toUpperCase() === 'RESET');

    if (!hasCheckedItem) {
      confirmBtn.disabled = true;
      if (hintEl) {
        hintEl.textContent = '⚠️ Please select at least one item above to reset.';
        hintEl.style.color = '#dc2626';
      }
      return;
    }

    if (!isTextMatch) {
      confirmBtn.disabled = true;
      if (hintEl) {
        hintEl.textContent = 'Type RESET in capital letters to enable data wipe.';
        hintEl.style.color = '#64748b';
      }
      return;
    }

    // Both conditions valid
    confirmBtn.disabled = false;
    if (hintEl) {
      hintEl.textContent = '✅ Confirmation verified. Click the button to permanently wipe selected data.';
      hintEl.style.color = '#16a34a';
    }
  }

  document.getElementById('btnOpenResetModal')?.addEventListener('click', async () => {
    if (!resetModal) return;
    // Reset inputs
    if (confirmInput) confirmInput.value = '';
    if (chkAtt) chkAtt.checked = true;
    if (chkEmp) chkEmp.checked = true;
    if (chkLog) chkLog.checked = false;
    if (chkTerm) chkTerm.checked = false;

    // Set device IP in modal terminal prompt
    const devIp = document.getElementById('settingIp')?.value || '192.168.10.15';
    const modalDevIpEl = document.getElementById('modalDevIp');
    if (modalDevIpEl) modalDevIpEl.textContent = devIp;

    // Refresh summary counts
    await loadDataResetSummary();

    updateResetModalValidation();
    resetModal.classList.add('active');
    setTimeout(() => confirmInput?.focus(), 100);
  });

  function closeResetModal() {
    resetModal?.classList.remove('active');
  }

  document.getElementById('btnResetDataModalClose')?.addEventListener('click', closeResetModal);
  document.getElementById('btnResetDataModalCancel')?.addEventListener('click', closeResetModal);
  document.getElementById('resetDataModalBackdrop')?.addEventListener('click', closeResetModal);

  confirmInput?.addEventListener('input', updateResetModalValidation);
  chkAtt?.addEventListener('change', updateResetModalValidation);
  chkEmp?.addEventListener('change', updateResetModalValidation);
  chkLog?.addEventListener('change', updateResetModalValidation);
  chkTerm?.addEventListener('change', updateResetModalValidation);

  confirmBtn?.addEventListener('click', async () => {
    const isTextMatch = (confirmInput?.value.trim().toUpperCase() === 'RESET');
    if (!isTextMatch) {
      showToast('Please type RESET to confirm data deletion.', 'error');
      return;
    }

    const payload = {
      resetAttendance: Boolean(chkAtt?.checked),
      resetEmployees: Boolean(chkEmp?.checked),
      resetSyncLogs: Boolean(chkLog?.checked),
      clearTerminalLogs: Boolean(chkTerm?.checked),
      confirmText: confirmInput.value.trim()
    };

    if (!payload.resetAttendance && !payload.resetEmployees && !payload.resetSyncLogs && !payload.clearTerminalLogs) {
      showToast('No reset options selected.', 'error');
      return;
    }

    // Hardware wipe confirmation
    if (payload.clearTerminalLogs) {
      const hwConfirm = confirm('WARNING: You have chosen to WIPE attendance logs from the PHYSICAL SpeedFace-V5L hardware terminal as well. Are you absolutely certain?');
      if (!hwConfirm) return;
    }

    const originalBtnText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
      <span class="spin" style="display:inline-block;width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;margin-right:6px;"></span>
      Purging Data...
    `;

    try {
      const res = await fetch('/api/device/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset data');
      }

      closeResetModal();
      showToast(data.message || 'System data reset completed successfully!', 'success', 6000);

      if (data.terminalResult && data.terminalResult.success === false) {
        showToast(`Note: Hardware wipe warning: ${data.terminalResult.error || 'Terminal unreachable'}`, 'warning', 7000);
      }

      // Reload relevant parts of the app
      await Promise.allSettled([
        loadDashboardStats(),
        loadRecords(),
        loadEmployees(),
        loadDeviceControlData()
      ]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalBtnText;
      updateResetModalValidation();
    }
  });

  // Production Diagnostics & System Health Listeners
  document.getElementById('btnRefreshHealth')?.addEventListener('click', async () => {
    showToast('Refreshing system diagnostics...', 'info');
    await loadSystemHealth();
    showToast('Diagnostics updated!', 'success');
  });

  document.getElementById('btnCreateSnapshotNow')?.addEventListener('click', () => {
    createDatabaseSnapshot();
  });

  document.getElementById('btnRefreshServerLogs')?.addEventListener('click', async () => {
    await loadSystemLogs();
    showToast('Logs refreshed!', 'info');
  });

  document.getElementById('btnClearLogView')?.addEventListener('click', () => {
    const consoleEl = document.getElementById('serverLogsConsole');
    if (consoleEl) consoleEl.textContent = 'Log view cleared. Click "Refresh Log" to reload latest entries.';
  });
}

async function loadNetworkInterfaces() {
  const select = document.getElementById('settingNetworkInterface');
  const ipHidden = document.getElementById('settingNetworkInterfaceIp');
  const devInterfaceVal = document.getElementById('devInterfaceVal');
  const guidePcIp = document.getElementById('guidePcIp');
  if (!select) return;

  try {
    const res = await fetch('/api/network-interfaces');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const interfaces = data.interfaces || [];
    const savedIface = data.selectedInterface;
    const savedIp = data.selectedInterfaceIp;

    select.innerHTML = '<option value="">-- Auto-Detect (System Default Route) --</option>' +
      interfaces.map((iface) => {
        const isMatch = iface.inSameSubnet ? ' [Recommended: Same Subnet 🎯]' : '';
        return `<option value="${escapeHtml(iface.name)}" data-ip="${escapeHtml(iface.ip)}" data-netmask="${escapeHtml(iface.netmask)}" data-in-subnet="${iface.inSameSubnet ? '1' : '0'}">
          ${escapeHtml(iface.name)} - ${escapeHtml(iface.ip)} (${escapeHtml(iface.netmask)})${isMatch}
        </option>`;
      }).join('');

    // Restore saved or auto-select matching interface
    let matchedOption = null;
    if (savedIface) {
      matchedOption = Array.from(select.options).find(o => o.value === savedIface);
    }
    if (!matchedOption && savedIp) {
      matchedOption = Array.from(select.options).find(o => o.getAttribute('data-ip') === savedIp);
    }
    // If not saved, auto-pick first interface that is in same subnet as device
    if (!matchedOption) {
      matchedOption = Array.from(select.options).find(o => o.getAttribute('data-in-subnet') === '1');
    }

    if (matchedOption) {
      select.value = matchedOption.value;
      const curIp = matchedOption.getAttribute('data-ip') || '';
      if (ipHidden) ipHidden.value = curIp;
      if (devInterfaceVal) devInterfaceVal.textContent = `${matchedOption.value} (${curIp})`;
      if (guidePcIp && curIp) guidePcIp.textContent = curIp;
    } else {
      if (devInterfaceVal) devInterfaceVal.textContent = 'Auto-Detect';
    }

    updateInterfaceSubnetBadge();
  } catch (err) {
    console.warn('Failed to load network interfaces:', err.message);
  }
}

function updateInterfaceSubnetBadge() {
  const select = document.getElementById('settingNetworkInterface');
  const ipHidden = document.getElementById('settingNetworkInterfaceIp');
  const badge = document.getElementById('interfaceSubnetBadge');
  const devInterfaceVal = document.getElementById('devInterfaceVal');
  const guidePcIp = document.getElementById('guidePcIp');
  const devIpInput = document.getElementById('settingIp');
  if (!select || !badge) return;

  const selectedOpt = select.selectedOptions[0];
  if (!selectedOpt || !selectedOpt.value) {
    if (ipHidden) ipHidden.value = '';
    if (devInterfaceVal) devInterfaceVal.textContent = 'Auto-Detect (Default)';
    badge.innerHTML = '<span class="badge-tag" style="background:#f1f5f9;color:#475569;">Using OS default gateway routing to communicate with device</span>';
    return;
  }

  const ifaceName = selectedOpt.value;
  const ifaceIp = selectedOpt.getAttribute('data-ip') || '';
  const inSubnet = selectedOpt.getAttribute('data-in-subnet') === '1';
  if (ipHidden) ipHidden.value = ifaceIp;
  if (devInterfaceVal) devInterfaceVal.textContent = `${ifaceName} (${ifaceIp})`;
  if (guidePcIp && ifaceIp) guidePcIp.textContent = ifaceIp;

  if (inSubnet) {
    badge.innerHTML = `<span class="badge-tag" style="background:#ecfdf5;color:#065f46;font-weight:600;">
      ✅ Optimal: Adapter ${escapeHtml(ifaceIp)} is on the same subnet as terminal (${escapeHtml(devIpInput?.value || '192.168.10.x')})
    </span>`;
  } else {
    badge.innerHTML = `<span class="badge-tag" style="background:#fffbeb;color:#b45309;">
      ⚠️ Note: Adapter IP (${escapeHtml(ifaceIp)}) is on a different subnet than terminal (${escapeHtml(devIpInput?.value || '')}). Ensure router routing exists.
    </span>`;
  }
}

async function loadDeviceControlData() {
  // 1. Load available network interfaces
  await loadNetworkInterfaces();

  // 2. Load settings
  try {
    const sRes = await fetch('/api/settings');
    const sData = await sRes.json();
    if (sData.success && sData.settings) {
      const s = sData.settings;
      if (s.device_ip) {
        document.getElementById('settingIp').value = s.device_ip;
        document.getElementById('devIpVal').textContent = s.device_ip;
        document.getElementById('miniDeviceIp').textContent = s.device_ip;
      }
      if (s.device_port) document.getElementById('settingPort').value = s.device_port;
      if (s.network_interface) {
        const ifaceSelect = document.getElementById('settingNetworkInterface');
        if (ifaceSelect) {
          const opt = Array.from(ifaceSelect.options).find(o => o.value === s.network_interface);
          if (opt) ifaceSelect.value = s.network_interface;
        }
      }
      if (s.network_interface_ip) {
        const ifaceIpInput = document.getElementById('settingNetworkInterfaceIp');
        if (ifaceIpInput) ifaceIpInput.value = s.network_interface_ip;
      }
      updateInterfaceSubnetBadge();

      if (s.auto_sync_interval) document.getElementById('settingInterval').value = s.auto_sync_interval;
      if (s.auto_sync_enabled !== undefined) {
        document.getElementById('settingAutoSyncEnabled').checked = s.auto_sync_enabled === 'true';
      }

      // Organization Details
      if (s.org_name) {
        const el = document.getElementById('settingOrgName');
        if (el) el.value = s.org_name;
        state.org.org_name = s.org_name;
      }
      if (s.org_subtitle) {
        const el = document.getElementById('settingOrgSubtitle');
        if (el) el.value = s.org_subtitle;
        state.org.org_subtitle = s.org_subtitle;
      }
      if (s.org_website) {
        const el = document.getElementById('settingOrgWebsite');
        if (el) el.value = s.org_website;
        state.org.org_website = s.org_website;
      }
      if (s.org_address) {
        const el = document.getElementById('settingOrgAddress');
        if (el) el.value = s.org_address;
        state.org.org_address = s.org_address;
      }
      if (s.org_phone) {
        const el = document.getElementById('settingOrgPhone');
        if (el) el.value = s.org_phone;
        state.org.org_phone = s.org_phone;
      }
      if (s.org_email) {
        const el = document.getElementById('settingOrgEmail');
        if (el) el.value = s.org_email;
        state.org.org_email = s.org_email;
      }
      if (s.org_footer) {
        const el = document.getElementById('settingOrgFooter');
        if (el) el.value = s.org_footer;
        state.org.org_footer = s.org_footer;
      }

      prepareReportForPrint();
    }
  } catch (err) {}

  // Run connection test to populate live device metrics
  testDeviceConnection();
  loadSyncLogs();
  loadDataResetSummary();
  loadSystemHealth();
  loadSystemLogs();
}

async function loadDataResetSummary() {
  try {
    const res = await fetch('/api/device/data-summary');
    const data = await res.json();
    if (!data.success) return;

    const attCount = Number(data.attendanceCount || 0).toLocaleString();
    const empCount = Number(data.employeeCount || 0).toLocaleString();
    const logCount = Number(data.syncLogCount || 0).toLocaleString();

    // Card stats
    const elAtt = document.getElementById('resetStatAttCount');
    const elEmp = document.getElementById('resetStatEmpCount');
    const elLog = document.getElementById('resetStatLogCount');
    if (elAtt) elAtt.textContent = attCount;
    if (elEmp) elEmp.textContent = empCount;
    if (elLog) elLog.textContent = logCount;

    // Modal stats
    const mAtt = document.getElementById('modalCountAttendance');
    const mEmp = document.getElementById('modalCountEmployees');
    const mLog = document.getElementById('modalCountSyncLogs');
    if (mAtt) mAtt.textContent = attCount;
    if (mEmp) mEmp.textContent = empCount;
    if (mLog) mLog.textContent = logCount;
  } catch (err) {
    console.error('Failed to load data reset summary:', err);
  }
}

async function testDeviceConnection() {
  const ip = document.getElementById('settingIp')?.value || '192.168.10.15';
  const port = document.getElementById('settingPort')?.value || 4370;
  const interfaceIp = document.getElementById('settingNetworkInterfaceIp')?.value || null;

  try {
    const res = await fetch('/api/device/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, interfaceIp })
    });
    const data = await res.json();

    const devOnlineBadge = document.getElementById('devOnlineBadge');
    const devStatusEl = document.getElementById('statDeviceStatus');
    const miniDot = document.getElementById('miniDeviceStatusDot');
    const isOnline = Boolean(data.success && data.online !== false);

    if (isOnline) {
      if (devOnlineBadge) {
        devOnlineBadge.className = 'badge badge-in';
        devOnlineBadge.textContent = '🟢 ONLINE';
      }
      if (devStatusEl) {
        devStatusEl.textContent = 'Online';
        devStatusEl.className = 'stat-value text-success';
      }
      if (miniDot) {
        miniDot.className = 'status-indicator online';
      }

      if (document.getElementById('devTimeVal')) document.getElementById('devTimeVal').textContent = data.deviceTime || 'Synced';
      if (document.getElementById('devUserCountVal')) document.getElementById('devUserCountVal').textContent = `${data.userCounts || 0} users`;
      if (document.getElementById('devLogCountVal')) document.getElementById('devLogCountVal').textContent = `${Number(data.logCounts || 0).toLocaleString()} records`;
      if (document.getElementById('devCapVal')) document.getElementById('devCapVal').textContent = `${Number(data.logCapacity || 0).toLocaleString()} capacity`;
      const ifaceMsg = interfaceIp ? ` (via ${interfaceIp})` : '';
      showToast(`Connected to SpeedFace at ${ip}:${port}${ifaceMsg}!`, 'success');
    } else {
      if (devOnlineBadge) {
        devOnlineBadge.className = 'badge badge-out';
        devOnlineBadge.textContent = '🔴 OFFLINE';
      }
      if (devStatusEl) {
        devStatusEl.textContent = 'Offline / Standby';
        devStatusEl.className = 'stat-value text-danger';
      }
      if (miniDot) {
        miniDot.className = 'status-indicator offline';
      }
      if (document.getElementById('devTimeVal')) document.getElementById('devTimeVal').textContent = 'Unreachable';
      showToast(`Could not reach device: ${data.error || 'Connection timed out'}`, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function syncDeviceTime() {
  const interfaceIp = document.getElementById('settingNetworkInterfaceIp')?.value || null;
  showToast('Synchronizing device clock with computer time...', 'info');
  try {
    const res = await fetch('/api/device/sync-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interfaceIp })
    });
    const data = await res.json();
    if (data.success) {
      showToast('SpeedFace clock successfully synchronized!', 'success');
      testDeviceConnection();
    } else {
      showToast(data.error || 'Failed to sync clock', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function rebootDevice() {
  if (!confirm('Are you sure you want to reboot the SpeedFace terminal?')) return;
  const interfaceIp = document.getElementById('settingNetworkInterfaceIp')?.value || null;

  showToast('Sending reboot command to SpeedFace...', 'info');
  try {
    const res = await fetch('/api/device/reboot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interfaceIp })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Device is restarting...', 'success');
    } else {
      showToast(data.error || 'Failed to reboot', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadSyncLogs() {
  try {
    const res = await fetch('/api/sync-logs');
    const data = await res.json();
    const tbody = document.getElementById('syncLogsTableBody');

    if (!data.logs || data.logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No sync logs found</td></tr>`;
      return;
    }

    tbody.innerHTML = data.logs.map((l) => `
      <tr>
        <td class="font-mono text-muted">${formatDateTime(l.created_at)}</td>
        <td><span class="badge-tag">${l.sync_type}</span></td>
        <td><span class="badge-tag ${l.status === 'SUCCESS' ? 'badge-in' : 'badge-out'}">${l.status}</span></td>
        <td><strong>+${l.records_synced || 0}</strong></td>
        <td>${Number(l.total_records || 0).toLocaleString()}</td>
        <td class="text-muted">${escapeHtml(l.message || '')}</td>
      </tr>
    `).join('');
  } catch (err) {}
}

// 6. Manual Sync Trigger
async function triggerManualSync() {
  const quickIcon = document.getElementById('quickSyncIcon');
  if (quickIcon) quickIcon.classList.add('spin');
  const ip = document.getElementById('settingIp')?.value || '192.168.10.15';
  const interfaceIp = document.getElementById('settingNetworkInterfaceIp')?.value || null;
  showToast(`Pulling attendance records from SpeedFace (${ip})...`, 'info');

  try {
    const res = await fetch('/api/device/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, interfaceIp })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Sync complete! ${data.newRecords} new records added (Device has ${data.totalDeviceLogs} total logs).`, 'success');
      loadDashboardStats();
      if (state.currentTab === 'tab-records') loadRecords();
      if (state.currentTab === 'tab-employees') loadEmployees();
    } else {
      showToast(data.error || 'Sync encountered an issue', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (quickIcon) quickIcon.classList.remove('spin');
  }
}

// 7. SpeedFace Setup Guide
async function initGuide() {
  await loadGuideIps();
}

async function loadGuideIps() {
  try {
    const res = await fetch('/api/network-ips');
    const data = await res.json();
    const container = document.getElementById('localIpChips');
    const guidePcIp = document.getElementById('guidePcIp');

    if (data.ips && data.ips.length > 0) {
      container.innerHTML = data.ips.map((item) => `
        <span class="ip-chip font-mono" title="${item.interface}">${item.ip}</span>
      `).join('');

      // Pick first IP as default for guide
      guidePcIp.textContent = data.ips[0].ip;
    }
  } catch (err) {}
}

// 8. Real-Time WebSockets
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  let reconnectTimer = null;
  let reconnectDelay = 2000;
  const maxDelay = 15000;
  const banner = document.getElementById('connectionAlertBanner');
  const alertMsg = document.getElementById('connectionAlertMessage');
  const btnRetry = document.getElementById('btnManualReconnect');

  function showDisconnectedBanner(msg) {
    if (banner) {
      banner.style.display = 'flex';
      if (alertMsg) alertMsg.textContent = msg || 'Connection to Attendance Server lost. Attempting to reconnect automatically...';
    }
  }

  function hideDisconnectedBanner() {
    if (banner) {
      banner.style.display = 'none';
    }
  }

  if (btnRetry) {
    btnRetry.onclick = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectDelay = 2000;
      connect();
    };
  }

  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    try {
      state.ws = new WebSocket(wsUrl);
    } catch (e) {
      showDisconnectedBanner('Unable to connect to Attendance Server. Retrying...');
      scheduleReconnect();
      return;
    }

    state.ws.onopen = () => {
      console.log('[WS] Connected to real-time attendance monitor');
      hideDisconnectedBanner();
      reconnectDelay = 2000;
    };

    state.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWebSocketMessage(msg);
      } catch (err) {}
    };

    state.ws.onclose = () => {
      showDisconnectedBanner(`Connection to Attendance Server lost. Reconnecting in ${Math.round(reconnectDelay / 1000)}s...`);
      scheduleReconnect();
    };

    state.ws.onerror = () => {
      try { state.ws.close(); } catch (_) {}
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 1.5, maxDelay);
      connect();
    }, reconnectDelay);
  }

  connect();
}

let debouncedStatsTimer = null;
function debouncedLoadDashboardStats() {
  if (debouncedStatsTimer) clearTimeout(debouncedStatsTimer);
  debouncedStatsTimer = setTimeout(() => {
    loadDashboardStats();
    debouncedStatsTimer = null;
  }, 400);
}

function handleWebSocketMessage(msg) {
  if (msg.type === 'LIVE_PUNCH') {
    const punch = msg.data;
    addLivePunchItem(punch);
    debouncedLoadDashboardStats();
    showToast(`Punch detected: User ${punch.user_id} (${punch.verify_name || 'Face Recognition'})`, 'success');
  } else if (msg.type === 'NEW_RECORDS_SYNCED') {
    showToast(`${msg.data.newCount} new attendance record(s) synced from machine!`, 'info');
    debouncedLoadDashboardStats();
    loadLiveFeed();
    loadTodayPreview();
    if (state.currentTab === 'tab-records') loadRecords();
  } else if (msg.type === 'DEVICE_STATUS') {
    const dev = msg.data;
    const isOnline = Boolean(dev.online);
    state.device.online = isOnline;

    const devStatusEl = document.getElementById('statDeviceStatus');
    const miniDot = document.getElementById('miniDeviceStatusDot');
    const devSub = document.getElementById('statDeviceSub');
    const devOnlineBadge = document.getElementById('devOnlineBadge');

    if (devStatusEl) {
      devStatusEl.textContent = isOnline ? 'Online' : 'Offline / Standby';
      devStatusEl.className = `stat-value ${isOnline ? 'text-success' : 'text-danger'}`;
    }
    if (miniDot) {
      miniDot.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
    }
    if (devSub) {
      devSub.textContent = isOnline 
        ? `${dev.ip || '192.168.10.15'}:4370 (Connected)` 
        : `${dev.ip || '192.168.10.15'}:4370 (Disconnected)`;
    }
    if (devOnlineBadge) {
      devOnlineBadge.className = `badge ${isOnline ? 'badge-in' : 'badge-out'}`;
      devOnlineBadge.textContent = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
    }

    if (dev.deviceInfo) {
      const info = dev.deviceInfo;
      if (document.getElementById('devTimeVal') && info.deviceTime) {
        document.getElementById('devTimeVal').textContent = info.deviceTime;
      }
      if (document.getElementById('devUserCountVal') && info.userCounts !== undefined) {
        document.getElementById('devUserCountVal').textContent = `${info.userCounts} users`;
      }
      if (document.getElementById('devLogCountVal') && info.logCounts !== undefined) {
        document.getElementById('devLogCountVal').textContent = `${Number(info.logCounts).toLocaleString()} records`;
      }
      if (document.getElementById('devCapVal') && info.logCapacity !== undefined) {
        document.getElementById('devCapVal').textContent = `${Number(info.logCapacity).toLocaleString()} capacity`;
      }
    }
  } else if (msg.type === 'SYNC_STATUS') {
    if (msg.data && msg.data.deviceOnline !== undefined) {
      const isOnline = Boolean(msg.data.deviceOnline);
      state.device.online = isOnline;
      const devStatusEl = document.getElementById('statDeviceStatus');
      const miniDot = document.getElementById('miniDeviceStatusDot');
      const devOnlineBadge = document.getElementById('devOnlineBadge');

      if (devStatusEl) {
        devStatusEl.textContent = isOnline ? 'Online' : 'Offline / Standby';
        devStatusEl.className = `stat-value ${isOnline ? 'text-success' : 'text-danger'}`;
      }
      if (miniDot) {
        miniDot.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
      }
      if (devOnlineBadge) {
        devOnlineBadge.className = `badge ${isOnline ? 'badge-in' : 'badge-out'}`;
        devOnlineBadge.textContent = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
      }
    }
  }
}

function createFeedElement(p, isNew = false) {
  const item = document.createElement('div');
  item.className = `feed-item ${isNew ? 'feed-item-new' : ''}`;
  const empName = (p.employee_name && p.employee_name !== 'Unassigned') ? p.employee_name : `User ID: ${p.user_id}`;
  const subInfo = (p.employee_name && p.employee_name !== 'Unassigned') ? `ID: ${p.user_id} • ` : '';

  const avatarContent = (p.employee_photo || p.photo)
    ? `<img src="${p.employee_photo || p.photo}" class="feed-avatar-img" alt="Photo" onerror="this.outerHTML='${String(p.user_id).slice(-2)}'">`
    : String(p.user_id).slice(-2);

  item.innerHTML = `
    <div class="feed-avatar">${avatarContent}</div>
    <div class="feed-details">
      <div class="feed-name">${escapeHtml(empName)}</div>
      <div class="feed-meta">
        <span>${subInfo}${formatTimeOnly(p.punch_time)}</span>
        <span>•</span>
        <span>${p.verify_name || 'Face Recognition'}</span>
        <span>•</span>
        <span>${p.punch_state_name || 'Check-In'}</span>
      </div>
    </div>
  `;
  return item;
}

function addLivePunchItem(p) {
  const list = document.getElementById('liveFeedList');
  if (!list) return;

  const emptyMsg = list.querySelector('.feed-empty');
  if (emptyMsg) emptyMsg.remove();

  const item = createFeedElement(p, true);
  list.prepend(item);

  // Play subtle audio alert
  playPunchChime();

  // Limit feed to top 20 items
  while (list.children.length > 20) {
    list.removeChild(list.lastChild);
  }
}

function playPunchChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

// 9. UI Rendering Helpers
function renderVerifyBadge(code, name) {
  const c = parseInt(code, 10);
  if (c === 15 || c === 49 || c === 51) return `<span class="badge-tag badge-face">👤 Face</span>`;
  if (c === 4) return `<span class="badge-tag badge-palm">✋ Palm</span>`;
  if (c === 1) return `<span class="badge-tag badge-finger">👆 Finger</span>`;
  if (c === 2) return `<span class="badge-tag badge-card">💳 Card</span>`;
  if (c === 0 || c === 3) return `<span class="badge-tag badge-pwd">🔑 PIN</span>`;
  return `<span class="badge-tag">${escapeHtml(name || `Mode ${code}`)}</span>`;
}

function renderPunchBadge(stateCode, stateName) {
  const s = parseInt(stateCode, 10);
  if (s === 0) return `<span class="badge-tag badge-in">Check-In</span>`;
  if (s === 1) return `<span class="badge-tag badge-out">Check-Out</span>`;
  if (s === 2) return `<span class="badge-tag badge-palm">Break-Out</span>`;
  if (s === 3) return `<span class="badge-tag badge-palm">Break-In</span>`;
  return `<span class="badge-tag">${escapeHtml(stateName || `State ${stateCode}`)}</span>`;
}

function renderPunchRoleBadge(r) {
  if (r.punch_role === 'CHECK_IN') {
    return `<span class="badge-tag badge-in" style="font-weight:700;" title="First punch of the day: Check-In">🟢 Check-In (First In)</span>`;
  }
  if (r.punch_role === 'CHECK_OUT') {
    return `<span class="badge-tag badge-out" style="font-weight:700;" title="Last punch of the day: Check-Out">🔵 Check-Out (Last Out)</span>`;
  }
  if (r.punch_role === 'INTERMEDIATE') {
    return `<span class="badge-tag" style="background:#f1f5f9;color:#64748b;font-weight:600;" title="Intermediate punch between first and last">⚪ Log / Break</span>`;
  }
  return renderPunchBadge(r.punch_state, r.punch_state_name);
}

function formatDateTime(str) {
  if (!str) return '-';
  return str.replace('T', ' ').slice(0, 19);
}

function formatTimeOnly(str) {
  if (!str) return '-';
  const parts = str.split(' ');
  return parts.length > 1 ? parts[1] : str;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =========================================================
// 10. Working Shifts & Holidays Module
// =========================================================

async function initShiftsAndHolidays() {
  // Add shift button
  document.getElementById('btnAddNewShift')?.addEventListener('click', () => openShiftModal());
  document.getElementById('btnShiftModalClose')?.addEventListener('click', closeShiftModal);
  document.getElementById('btnShiftModalCancel')?.addEventListener('click', closeShiftModal);

  // Color picker sync
  const shiftColorInput = document.getElementById('shiftModalColor');
  const shiftColorCode = document.getElementById('shiftModalColorCode');
  shiftColorInput?.addEventListener('input', (e) => {
    if (shiftColorCode) shiftColorCode.textContent = e.target.value;
  });

  // Hours input & start time live breakdown hints (e.g. 08:30 + 3.5h -> Leaves at 12:00)
  document.getElementById('shiftModalStart')?.addEventListener('input', updateShiftModalHoursHints);
  document.getElementById('shiftModalFullDay')?.addEventListener('input', updateShiftModalHoursHints);
  document.getElementById('shiftModalHalfDay')?.addEventListener('input', updateShiftModalHoursHints);
  document.getElementById('shiftModalLateHalfDay')?.addEventListener('input', updateShiftModalHoursHints);

  // Enable/Disable toggles for rule modules
  document.getElementById('shiftModalEnableGrace')?.addEventListener('change', syncShiftModalToggles);
  document.getElementById('shiftModalEnableShortLeave')?.addEventListener('change', syncShiftModalToggles);
  document.getElementById('shiftModalEnableHalfDay')?.addEventListener('change', syncShiftModalToggles);
  document.getElementById('shiftModalEnableOt')?.addEventListener('change', syncShiftModalToggles);

  // Shift form submit
  document.getElementById('shiftForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('shiftModalId').value;
    const workDays = Array.from(document.querySelectorAll('input[name="workDay"]:checked'))
      .map((cb) => cb.value)
      .join(',');

    if (!workDays) {
      return showToast('Please select at least one working day for this shift', 'error');
    }

    const payload = {
      name: document.getElementById('shiftModalName').value,
      color: document.getElementById('shiftModalColor').value,
      start_time: document.getElementById('shiftModalStart').value,
      end_time: document.getElementById('shiftModalEnd').value,
      grace_period_mins: parseInt(document.getElementById('shiftModalGrace').value, 10) || 30,
      monthly_grace_days: parseInt(document.getElementById('shiftModalMonthlyGrace').value, 10) || 2,
      late_cover_end: document.getElementById('shiftModalLateCover').checked ? 1 : 0,
      half_day_hours: parseFloat(document.getElementById('shiftModalHalfDay').value) || 3.5,
      late_half_day_hours: parseFloat(document.getElementById('shiftModalLateHalfDay').value) || 4.0,
      full_day_hours: parseFloat(document.getElementById('shiftModalFullDay').value) || 7.75,
      monthly_short_leaves: parseInt(document.getElementById('shiftModalMonthlyShortLeaves').value, 10) || 2,
      morning_short_leave_start: document.getElementById('shiftModalMShortStart').value || '09:00',
      morning_short_leave_end: document.getElementById('shiftModalMShortEnd').value || '10:00',
      evening_short_leave_start: document.getElementById('shiftModalEShortStart').value || '14:45',
      evening_short_leave_end: document.getElementById('shiftModalEShortEnd').value || '16:15',
      disallow_grace_and_short_leave_same_day: document.getElementById('shiftModalDisallowGraceAndShortLeave').checked ? 1 : 0,
      ot_min_mins: parseInt(document.getElementById('shiftModalOtMinMins')?.value, 10) || 60,
      ot_step_mins: parseInt(document.getElementById('shiftModalOtStepMins')?.value, 10) || 15,
      enable_morning_grace: document.getElementById('shiftModalEnableGrace').checked ? 1 : 0,
      enable_short_leave: document.getElementById('shiftModalEnableShortLeave').checked ? 1 : 0,
      enable_half_day_calc: document.getElementById('shiftModalEnableHalfDay').checked ? 1 : 0,
      enable_overtime: document.getElementById('shiftModalEnableOt').checked ? 1 : 0,
      work_days: workDays,
      is_default: document.getElementById('shiftModalIsDefault').checked ? 1 : 0
    };

    try {
      showToast(id ? 'Updating working shift...' : 'Creating new shift...', 'info');
      const url = id ? `/api/shifts/${id}` : '/api/shifts';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Shift saved successfully!', 'success');
        closeShiftModal();
        await loadShifts();
        loadEmployees();
      } else {
        showToast(data.error || 'Failed to save shift', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Add holiday buttons
  document.getElementById('btnAddHoliday')?.addEventListener('click', () => openHolidayModal());
  document.getElementById('btnHolidayModalClose')?.addEventListener('click', closeHolidayModal);
  document.getElementById('btnHolidayModalCancel')?.addEventListener('click', closeHolidayModal);

  // Upload holiday modal handlers
  document.getElementById('btnUploadHolidays')?.addEventListener('click', () => openHolidayUploadModal());
  document.getElementById('btnHolidayUploadModalClose')?.addEventListener('click', closeHolidayUploadModal);
  document.getElementById('btnHolidayUploadCancel')?.addEventListener('click', closeHolidayUploadModal);

  const dropzone = document.getElementById('holidayUploadDropzone');
  const fileInput = document.getElementById('inputHolidayUpload');
  const browseBtn = document.getElementById('btnBrowseHolidayFile');

  browseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  });

  dropzone?.addEventListener('click', () => {
    fileInput?.click();
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#2563eb';
    dropzone.style.background = '#eff6ff';
  });

  dropzone?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#cbd5e1';
    dropzone.style.background = '#f8fafc';
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#cbd5e1';
    dropzone.style.background = '#f8fafc';
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleHolidayFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleHolidayFileSelected(e.target.files[0]);
    }
  });

  document.getElementById('btnDownloadSampleHolidaysCsv')?.addEventListener('click', () => {
    downloadSampleHolidaysTemplate();
  });

  document.getElementById('btnHolidayUploadConfirm')?.addEventListener('click', async () => {
    await confirmHolidaysImport();
  });

  // Holiday form submit
  document.getElementById('holidayForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isPublic = document.getElementById('holidayModalPublic')?.checked ? 1 : 0;
    const isBank = document.getElementById('holidayModalBank')?.checked ? 1 : 0;
    const isMerc = document.getElementById('holidayModalMercantile')?.checked ? 1 : 0;
    let computedType = document.getElementById('holidayModalType')?.value || 'Public Holiday';
    if (isPublic && isBank && isMerc) computedType = 'Public, Bank & Mercantile';
    else if (isPublic && isBank) computedType = 'Public & Bank Holiday';
    else if (isPublic && isMerc) computedType = 'Public & Mercantile Holiday';
    else if (isMerc) computedType = 'Mercantile Holiday';
    else if (isBank) computedType = 'Bank Holiday';

    const payload = {
      name: document.getElementById('holidayModalName').value,
      holiday_date: document.getElementById('holidayModalDate').value,
      holiday_type: computedType,
      public_holiday: isPublic,
      bank_holiday: isBank,
      mercantile_holiday: isMerc,
      is_recurring: document.getElementById('holidayModalRecurring').checked ? 1 : 0
    };

    try {
      showToast('Saving holiday...', 'info');
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Holiday saved successfully!', 'success');
        closeHolidayModal();
        await loadHolidays();
      } else {
        showToast(data.error || 'Failed to save holiday', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Bulk shift assignment modal handlers
  document.getElementById('btnOpenBulkShiftModal')?.addEventListener('click', () => openBulkShiftModal());
  document.getElementById('btnBulkShiftModalClose')?.addEventListener('click', closeBulkShiftModal);
  document.getElementById('btnBulkShiftModalCancel')?.addEventListener('click', closeBulkShiftModal);

  document.getElementById('bulkShiftScope')?.addEventListener('change', (e) => {
    const deptWrap = document.getElementById('bulkShiftDeptWrap');
    if (deptWrap) {
      deptWrap.style.display = e.target.value === 'dept' ? 'block' : 'none';
    }
  });

  document.getElementById('bulkShiftForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const shift_id = document.getElementById('bulkShiftSelect').value;
    const scope = document.getElementById('bulkShiftScope').value;
    const department = scope === 'dept' ? document.getElementById('bulkShiftDeptSelect').value : '';

    try {
      showToast('Assigning working shift...', 'info');
      const res = await fetch('/api/employees/assign-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id, department })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Shift assigned!`, 'success');
        closeBulkShiftModal();
        loadEmployees();
        loadShifts();
      } else {
        showToast(data.error || 'Failed to assign shift', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Initial load
  await loadShifts();
  await loadHolidays();
}

async function loadShiftsAndHolidays() {
  await Promise.all([loadShifts(), loadHolidays()]);
}

async function loadShifts() {
  const container = document.getElementById('shiftsContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/shifts');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    state.shifts = data.shifts || [];

    if (state.shifts.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-muted">No working shifts defined. Click "+ New Shift" to create one.</div>`;
      return;
    }

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    container.innerHTML = state.shifts.map((s) => {
      const activeDays = (s.work_days || '1,2,3,4,5').split(',').map((d) => parseInt(d.trim(), 10));
      
      const daysPills = [1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
        const isWork = activeDays.includes(dayIdx);
        return `<span class="day-pill ${isWork ? 'workday' : 'offday'}" title="${isWork ? 'Working Day' : 'Weekend Off'}">${dayLabels[dayIdx]}</span>`;
      }).join('');

      return `
        <div class="shift-card" style="border-top-color: ${s.color || '#2563eb'};">
          <div>
            <div class="shift-card-header">
              <div class="shift-title-wrap">
                <span class="badge-shift-dot" style="background: ${s.color || '#2563eb'};"></span>
                <span class="shift-title">${escapeHtml(s.name)}</span>
              </div>
              <div>
                ${s.is_default ? '<span class="badge badge-v5l">DEFAULT</span>' : ''}
              </div>
            </div>

            <div class="shift-time-badge">
              <span>🕒 ${s.start_time} &mdash; ${s.end_time}</span>
            </div>

            <div class="shift-metrics-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px;">
              <div class="shift-metric-item">
                <span class="shift-metric-label">Morning Grace</span>
                <span class="shift-metric-val">
                  ${s.enable_morning_grace !== 0 
                    ? `+${s.grace_period_mins !== undefined ? s.grace_period_mins : 30}m <span style="font-size:0.72rem;font-weight:normal;color:var(--text-muted);">(${s.monthly_grace_days !== undefined ? s.monthly_grace_days : 2}d/mo)</span>` 
                    : '<span style="color:var(--text-muted);font-weight:normal;">Disabled ⛔</span>'}
                </span>
              </div>
              <div class="shift-metric-item">
                <span class="shift-metric-label">Short Leave</span>
                <span class="shift-metric-val">
                  ${s.enable_short_leave !== 0 
                    ? `${s.monthly_short_leaves !== undefined ? s.monthly_short_leaves : 2}d/mo <span style="font-size:0.72rem;font-weight:normal;color:var(--text-muted);">(M:09-10 | E:14:45-16:15)</span>` 
                    : '<span style="color:var(--text-muted);font-weight:normal;">Disabled ⛔</span>'}
                </span>
              </div>
              <div class="shift-metric-item">
                <span class="shift-metric-label">Half / Full</span>
                <span class="shift-metric-val">
                  ${s.enable_half_day_calc !== 0 
                    ? `${s.half_day_hours || 3.5}h / ${s.full_day_hours || 7.75}h` 
                    : '<span style="color:var(--text-muted);font-weight:normal;">Standard ⛔</span>'}
                </span>
              </div>
              <div class="shift-metric-item">
                <span class="shift-metric-label">Overtime (OT)</span>
                <span class="shift-metric-val">
                  ${s.enable_overtime !== 0 
                    ? `&ge;${s.ot_min_mins !== undefined ? s.ot_min_mins : 60}m <span style="font-size:0.72rem;font-weight:normal;color:var(--text-muted);">(+${s.ot_step_mins !== undefined ? s.ot_step_mins : 15}m step)</span>` 
                    : '<span style="color:var(--text-muted);font-weight:normal;">Disabled ⛔</span>'}
                </span>
              </div>
            </div>

            <div style="margin-bottom: 6px;">
              <span class="text-xs text-muted" style="display: block; margin-bottom: 4px; font-weight: 600;">SCHEDULE / WEEKDAYS</span>
              <div class="days-list">
                ${daysPills}
              </div>
            </div>
          </div>

          <div class="shift-card-footer">
            <span class="shift-emp-count">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
              <strong>${s.employee_count || 0}</strong> assigned
            </span>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-outline btn-edit-shift" data-shift='${JSON.stringify(s).replace(/'/g, "&apos;")}'>
                Edit
              </button>
              ${!s.is_default && s.id !== 1 ? `
                <button class="btn btn-sm btn-outline text-danger btn-delete-shift" data-id="${s.id}" data-name="${escapeHtml(s.name)}">
                  Delete
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach shift listeners
    document.querySelectorAll('.btn-edit-shift').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = JSON.parse(btn.getAttribute('data-shift'));
        openShiftModal(s);
      });
    });

    document.querySelectorAll('.btn-delete-shift').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (!confirm(`Are you sure you want to delete "${name}"? Assigned employees will be moved to the Default Shift.`)) return;

        try {
          const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            showToast(data.message || 'Shift deleted', 'success');
            await loadShifts();
            loadEmployees();
          } else {
            showToast(data.error || 'Failed to delete shift', 'error');
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    if (container) container.innerHTML = `<div class="text-center py-4 text-danger">Error loading shifts: ${err.message}</div>`;
  }
}

async function loadHolidays() {
  const tbody = document.getElementById('holidaysTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/holidays');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    state.holidays = data.holidays || [];

    if (state.holidays.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No holidays registered. Click "+ Add Holiday" to register official off-days.</td></tr>`;
      return;
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    tbody.innerHTML = state.holidays.map((h) => {
      const d = new Date(String(h.holiday_date).slice(0, 10) + 'T00:00:00');
      const dayName = dayNames[d.getDay()] || '-';

      const badges = [];
      if (h.public_holiday) {
        badges.push('<span class="badge-tag" style="background:#e0f2fe;color:#0369a1;font-weight:600;font-size:0.75rem;padding:2px 8px;border-radius:12px;">🏛️ Public</span>');
      }
      if (h.bank_holiday) {
        badges.push('<span class="badge-tag" style="background:#fef3c7;color:#b45309;font-weight:600;font-size:0.75rem;padding:2px 8px;border-radius:12px;">🏦 Bank</span>');
      }
      if (h.mercantile_holiday) {
        badges.push('<span class="badge-tag" style="background:#fce7f3;color:#be185d;font-weight:600;font-size:0.75rem;padding:2px 8px;border-radius:12px;">🏢 Mercantile</span>');
      }
      if (badges.length === 0) {
        badges.push(`<span class="badge-holiday">${escapeHtml(h.holiday_type || 'Public Holiday')}</span>`);
      }

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.1rem;">🎉</span>
              <strong>${escapeHtml(h.name)}</strong>
            </div>
          </td>
          <td class="font-mono"><strong>${String(h.holiday_date).slice(0, 10)}</strong></td>
          <td><span class="badge-weekday">${dayName}</span></td>
          <td><div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">${badges.join('')}</div></td>
          <td>
            ${h.is_recurring 
              ? '<span class="badge-tag" style="background:#ecfdf5;color:#065f46;">Annual Recurring 🔁</span>' 
              : '<span class="badge-tag">One-Time</span>'}
          </td>
          <td>
            <button class="btn btn-sm btn-outline text-danger btn-delete-holiday" data-id="${h.id}" data-name="${escapeHtml(h.name)}">
              Remove
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach holiday delete listeners
    document.querySelectorAll('.btn-delete-holiday').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (!confirm(`Are you sure you want to remove holiday "${name}"?`)) return;

        try {
          const res = await fetch(`/api/holidays/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            showToast(data.message || 'Holiday removed', 'success');
            await loadHolidays();
          } else {
            showToast(data.error || 'Failed to remove holiday', 'error');
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Error loading holidays: ${err.message}</td></tr>`;
  }
}

function formatHoursWithEndTime(hoursVal, startTimeStr) {
  const h = parseFloat(hoursVal);
  if (isNaN(h) || h <= 0) return '0 hrs (0h 0m)';
  const totalMins = Math.round(h * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (startTimeStr && startTimeStr.includes(':')) {
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const endTotalMins = (startH * 60 + startM + totalMins) % 1440;
    const endH = String(Math.floor(endTotalMins / 60)).padStart(2, '0');
    const endM = String(endTotalMins % 60).padStart(2, '0');
    return `${h} hrs (${hrs}h ${mins}m) ➔ Leaves at ${endH}:${endM}`;
  }

  return `${h} hrs (${hrs}h ${mins}m)`;
}

function updateShiftModalHoursHints() {
  const start = document.getElementById('shiftModalStart')?.value || '08:30';
  const full = document.getElementById('shiftModalFullDay')?.value;
  const half = document.getElementById('shiftModalHalfDay')?.value;
  const lateHalf = document.getElementById('shiftModalLateHalfDay')?.value;

  const fullHint = document.getElementById('fullDayHint');
  const halfHint = document.getElementById('halfDayHint');
  const lateHalfHint = document.getElementById('lateHalfDayHint');

  if (fullHint) fullHint.textContent = formatHoursWithEndTime(full, start);
  if (halfHint) halfHint.textContent = formatHoursWithEndTime(half, start);
  if (lateHalfHint) {
    if (start && start.includes(':') && lateHalf) {
      const [startH, startM] = start.split(':').map(Number);
      const totalMins = Math.round(parseFloat(lateHalf) * 60);
      const endTotalMins = (startH * 60 + startM + totalMins) % 1440;
      const endH = String(Math.floor(endTotalMins / 60)).padStart(2, '0');
      const endM = String(endTotalMins % 60).padStart(2, '0');
      lateHalfHint.textContent = `${lateHalf} hrs ➔ ${endH}:${endM} + Late Time`;
    } else {
      lateHalfHint.textContent = `${lateHalf || 4.0} hrs (Base + Late)`;
    }
  }
}

function syncShiftModalToggles() {
  const enableGrace = document.getElementById('shiftModalEnableGrace')?.checked ?? true;
  const enableShort = document.getElementById('shiftModalEnableShortLeave')?.checked ?? true;
  const enableHalf = document.getElementById('shiftModalEnableHalfDay')?.checked ?? true;
  const enableOt = document.getElementById('shiftModalEnableOt')?.checked ?? true;

  const graceBody = document.getElementById('shiftModalGraceBody');
  if (graceBody) {
    graceBody.style.opacity = enableGrace ? '1' : '0.4';
    graceBody.style.pointerEvents = enableGrace ? 'auto' : 'none';
  }

  const shortBody = document.getElementById('shiftModalShortLeaveBody');
  if (shortBody) {
    shortBody.style.opacity = enableShort ? '1' : '0.4';
    shortBody.style.pointerEvents = enableShort ? 'auto' : 'none';
  }

  const halfBody = document.getElementById('shiftModalHalfDayBody');
  if (halfBody) {
    halfBody.style.opacity = enableHalf ? '1' : '0.4';
    halfBody.style.pointerEvents = enableHalf ? 'auto' : 'none';
  }

  const otBody = document.getElementById('shiftModalOtBody');
  if (otBody) {
    otBody.style.opacity = enableOt ? '1' : '0.4';
    otBody.style.pointerEvents = enableOt ? 'auto' : 'none';
  }
}

function openShiftModal(shift = null) {
  const isEdit = !!shift;
  document.getElementById('shiftModalTitle').textContent = isEdit ? `Edit Working Shift: ${shift.name}` : 'New Working Shift';
  document.getElementById('shiftModalId').value = isEdit ? shift.id : '';
  document.getElementById('shiftModalName').value = isEdit ? shift.name : '';
  document.getElementById('shiftModalColor').value = isEdit ? (shift.color || '#2563eb') : '#2563eb';
  document.getElementById('shiftModalColorCode').textContent = isEdit ? (shift.color || '#2563eb') : '#2563eb';
  document.getElementById('shiftModalStart').value = isEdit ? shift.start_time : '08:30';
  document.getElementById('shiftModalEnd').value = isEdit ? shift.end_time : '16:15';
  document.getElementById('shiftModalGrace').value = isEdit ? (shift.grace_period_mins !== undefined ? shift.grace_period_mins : 30) : 30;
  document.getElementById('shiftModalMonthlyGrace').value = isEdit ? (shift.monthly_grace_days !== undefined ? shift.monthly_grace_days : 2) : 2;
  document.getElementById('shiftModalHalfDay').value = isEdit ? (shift.half_day_hours || 3.5) : 3.5;
  document.getElementById('shiftModalLateHalfDay').value = isEdit ? (shift.late_half_day_hours || 4.0) : 4.0;
  document.getElementById('shiftModalFullDay').value = isEdit ? (shift.full_day_hours || 7.75) : 7.75;
  document.getElementById('shiftModalMonthlyShortLeaves').value = isEdit ? (shift.monthly_short_leaves !== undefined ? shift.monthly_short_leaves : 2) : 2;
  document.getElementById('shiftModalMShortStart').value = isEdit ? (shift.morning_short_leave_start || '09:00') : '09:00';
  document.getElementById('shiftModalMShortEnd').value = isEdit ? (shift.morning_short_leave_end || '10:00') : '10:00';
  document.getElementById('shiftModalEShortStart').value = isEdit ? (shift.evening_short_leave_start || '14:45') : '14:45';
  document.getElementById('shiftModalEShortEnd').value = isEdit ? (shift.evening_short_leave_end || '16:15') : '16:15';
  document.getElementById('shiftModalDisallowGraceAndShortLeave').checked = isEdit ? (shift.disallow_grace_and_short_leave_same_day !== 0) : true;
  document.getElementById('shiftModalOtMinMins').value = isEdit ? (shift.ot_min_mins !== undefined ? shift.ot_min_mins : 60) : 60;
  document.getElementById('shiftModalOtStepMins').value = isEdit ? (shift.ot_step_mins !== undefined ? shift.ot_step_mins : 15) : 15;
  document.getElementById('shiftModalLateCover').checked = isEdit ? (shift.late_cover_end !== 0) : true;
  document.getElementById('shiftModalIsDefault').checked = isEdit ? (shift.is_default === 1) : false;

  document.getElementById('shiftModalEnableGrace').checked = isEdit ? (shift.enable_morning_grace !== 0) : true;
  document.getElementById('shiftModalEnableShortLeave').checked = isEdit ? (shift.enable_short_leave !== 0) : true;
  document.getElementById('shiftModalEnableHalfDay').checked = isEdit ? (shift.enable_half_day_calc !== 0) : true;
  document.getElementById('shiftModalEnableOt').checked = isEdit ? (shift.enable_overtime !== 0) : true;

  syncShiftModalToggles();
  updateShiftModalHoursHints();

  const activeDays = isEdit && shift.work_days
    ? String(shift.work_days).split(',').map((d) => d.trim())
    : ['1', '2', '3', '4', '5'];

  document.querySelectorAll('input[name="workDay"]').forEach((cb) => {
    cb.checked = activeDays.includes(cb.value);
  });

  document.getElementById('shiftModal').classList.add('active');
}

function closeShiftModal() {
  document.getElementById('shiftModal').classList.remove('active');
}

let uploadedHolidaysCache = [];

function openHolidayModal() {
  document.getElementById('holidayModalName').value = '';
  document.getElementById('holidayModalDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('holidayModalType').value = 'Public Holiday';
  const pubCb = document.getElementById('holidayModalPublic');
  const bankCb = document.getElementById('holidayModalBank');
  const mercCb = document.getElementById('holidayModalMercantile');
  if (pubCb) pubCb.checked = true;
  if (bankCb) bankCb.checked = true;
  if (mercCb) mercCb.checked = false;
  document.getElementById('holidayModalRecurring').checked = true;
  document.getElementById('holidayModal').classList.add('active');
}

function closeHolidayModal() {
  document.getElementById('holidayModal').classList.remove('active');
}

function openHolidayUploadModal() {
  uploadedHolidaysCache = [];
  const fileInput = document.getElementById('inputHolidayUpload');
  if (fileInput) fileInput.value = '';
  const previewArea = document.getElementById('holidayUploadPreviewArea');
  if (previewArea) previewArea.style.display = 'none';
  const confirmBtn = document.getElementById('btnHolidayUploadConfirm');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Import Holidays';
  }
  document.getElementById('holidayUploadModal')?.classList.add('active');
}

function closeHolidayUploadModal() {
  document.getElementById('holidayUploadModal')?.classList.remove('active');
}

function handleHolidayFileSelected(file) {
  if (!file) return;
  const fileName = file.name;
  const ext = fileName.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    showToast('Please select a valid CSV or Excel file (.csv, .xlsx, .xls)', 'warning');
    return;
  }

  showToast(`Reading and parsing ${fileName}...`, 'info');
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const fileData = e.target.result;
      const res = await fetch('/api/holidays/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to parse file');

      uploadedHolidaysCache = data.holidays || [];
      if (uploadedHolidaysCache.length === 0) {
        showToast('No valid holiday records found in the uploaded file', 'warning');
        return;
      }

      renderHolidayUploadPreview(fileName, uploadedHolidaysCache);
      showToast(`Detected ${uploadedHolidaysCache.length} holidays in ${fileName}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  reader.readAsDataURL(file);
}

function renderHolidayUploadPreview(fileName, holidays) {
  const infoEl = document.getElementById('holidayUploadFileInfo');
  const previewArea = document.getElementById('holidayUploadPreviewArea');
  const tbody = document.getElementById('holidayUploadPreviewTableBody');
  const confirmBtn = document.getElementById('btnHolidayUploadConfirm');

  if (infoEl) {
    infoEl.innerHTML = `📄 <strong>${escapeHtml(fileName)}</strong> &bull; <strong>${holidays.length}</strong> holidays detected`;
  }

  if (tbody) {
    tbody.innerHTML = holidays.map((h) => {
      const badges = [];
      if (h.public_holiday) badges.push('<span class="badge-tag" style="background:#e0f2fe;color:#0369a1;font-weight:600;font-size:0.75rem;padding:2px 6px;border-radius:10px;">🏛️ Public</span>');
      if (h.bank_holiday) badges.push('<span class="badge-tag" style="background:#fef3c7;color:#b45309;font-weight:600;font-size:0.75rem;padding:2px 6px;border-radius:10px;">🏦 Bank</span>');
      if (h.mercantile_holiday) badges.push('<span class="badge-tag" style="background:#fce7f3;color:#be185d;font-weight:600;font-size:0.75rem;padding:2px 6px;border-radius:10px;">🏢 Mercantile</span>');
      if (badges.length === 0) badges.push(`<span class="badge-holiday">${escapeHtml(h.holiday_type || 'Public')}</span>`);

      return `
        <tr>
          <td class="font-mono" style="white-space: nowrap;"><strong>${escapeHtml(h.holiday_date)}</strong></td>
          <td><strong>${escapeHtml(h.name)}</strong></td>
          <td><div style="display: flex; gap: 4px; flex-wrap: wrap;">${badges.join('')}</div></td>
        </tr>
      `;
    }).join('');
  }

  if (previewArea) previewArea.style.display = 'block';
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = `Import ${holidays.length} Holidays`;
  }
}

async function confirmHolidaysImport() {
  if (!uploadedHolidaysCache || uploadedHolidaysCache.length === 0) {
    showToast('No holidays to import', 'warning');
    return;
  }

  const isReplace = document.querySelector('input[name="holidayImportMode"]:checked')?.value === 'replace';
  const confirmBtn = document.getElementById('btnHolidayUploadConfirm');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing...';
  }

  try {
    const res = await fetch('/api/holidays/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holidays: uploadedHolidaysCache,
        replaceExisting: isReplace
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to import holidays');

    showToast(data.message || `Successfully saved ${data.count} holidays!`, 'success');
    closeHolidayUploadModal();
    await loadHolidays();
  } catch (err) {
    showToast(err.message, 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = `Import ${uploadedHolidaysCache.length} Holidays`;
    }
  }
}

function downloadSampleHolidaysTemplate() {
  const sampleCsv = `Date,Day,Holiday Description,Bank Holiday,Public Holiday,Mercantile Holiday
2026-01-03,Saturday,Duruthu Full Moon Poya Day,True,True,False
2026-01-15,Thursday,Tamil Thai Pongal Day,True,True,True
2026-02-01,Sunday,Navam Full Moon Poya Day,True,True,False
2026-02-04,Wednesday,Independence Day,True,True,True
2026-04-13,Monday,Day prior to Sinhala & Tamil New Year Day,True,True,True
2026-04-14,Tuesday,Sinhala & Tamil New Year Day,True,True,True
2026-05-01,Friday,Vesak Full Moon Poya Day,True,True,False
2026-05-01,Friday,May Day (International Workers' Day),True,True,True
2026-12-25,Friday,Christmas Day,True,True,True`;

  const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'holidays_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded sample holidays CSV template', 'info');
}

async function openBulkShiftModal() {
  if (!state.shifts || state.shifts.length === 0) {
    await loadShifts();
  }

  const shiftSelect = document.getElementById('bulkShiftSelect');
  shiftSelect.innerHTML = state.shifts.map((s) => `
    <option value="${s.id}">${escapeHtml(s.name)} (${s.start_time} - ${s.end_time})</option>
  `).join('');

  // Extract unique departments from employees
  const deptSelect = document.getElementById('bulkShiftDeptSelect');
  try {
    const res = await fetch('/api/employees');
    const data = await res.json();
    if (data.success && data.employees) {
      const depts = [...new Set(data.employees.map((e) => e.department || 'General'))].filter(Boolean);
      deptSelect.innerHTML = depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    }
  } catch (e) {}

  document.getElementById('bulkShiftScope').value = 'all';
  document.getElementById('bulkShiftDeptWrap').style.display = 'none';
  document.getElementById('bulkShiftModal').classList.add('active');
}

function closeBulkShiftModal() {
  document.getElementById('bulkShiftModal').classList.remove('active');
}

// Employee Upload & Import Handlers
let uploadedEmployeesCache = [];

function openEmployeeUploadModal() {
  uploadedEmployeesCache = [];
  const fileInput = document.getElementById('inputEmployeeUpload');
  if (fileInput) fileInput.value = '';
  const previewArea = document.getElementById('employeeUploadPreviewArea');
  if (previewArea) previewArea.style.display = 'none';
  const confirmBtn = document.getElementById('btnEmployeeUploadConfirm');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Import Employees';
  }
  document.getElementById('employeeUploadModal')?.classList.add('active');
}

function closeEmployeeUploadModal() {
  document.getElementById('employeeUploadModal')?.classList.remove('active');
}

function handleEmployeeFileSelected(file) {
  if (!file) return;
  const fileName = file.name;
  const ext = fileName.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls', 'txt'].includes(ext)) {
    showToast('Please select a valid CSV or Excel file (.csv, .xlsx, .xls)', 'warning');
    return;
  }

  showToast(`Reading and parsing ${fileName}...`, 'info');
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const fileData = e.target.result;
      const res = await fetch('/api/employees/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to parse file');

      uploadedEmployeesCache = data.employees || [];
      if (uploadedEmployeesCache.length === 0) {
        showToast('No valid employee records found in the uploaded file', 'warning');
        return;
      }

      renderEmployeeUploadPreview(fileName, uploadedEmployeesCache, data.errors);
      showToast(`Detected ${uploadedEmployeesCache.length} employees in ${fileName}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  reader.readAsDataURL(file);
}

function renderEmployeeUploadPreview(fileName, employees, errors = []) {
  const infoEl = document.getElementById('employeeUploadFileInfo');
  const previewArea = document.getElementById('employeeUploadPreviewArea');
  const tbody = document.getElementById('employeeUploadPreviewTableBody');
  const confirmBtn = document.getElementById('btnEmployeeUploadConfirm');

  if (infoEl) {
    infoEl.innerHTML = `📄 <strong>${escapeHtml(fileName)}</strong> &bull; <strong>${employees.length}</strong> employees ready to import`;
  }

  if (tbody) {
    const previewRows = employees.slice(0, 50);
    tbody.innerHTML = previewRows.map((emp) => {
      const statusBadge = emp.is_active === 1
        ? '<span class="badge badge-in" style="font-size:0.75rem;">Active</span>'
        : '<span class="badge badge-out" style="font-size:0.75rem;">Inactive</span>';

      return `
        <tr>
          <td class="font-mono font-bold" style="white-space:nowrap;">${escapeHtml(emp.user_id)}</td>
          <td class="font-mono">${escapeHtml(emp.employee_service_id || '-')}</td>
          <td><strong>${escapeHtml(emp.name)}</strong></td>
          <td class="font-mono">${escapeHtml(emp.nic || '-')}</td>
          <td>${escapeHtml(emp.department || 'General')}</td>
          <td>${escapeHtml(emp.role || 'Staff')}</td>
          <td><span class="badge-tag" style="background:#f1f5f9;color:#334155;font-weight:600;font-size:0.75rem;">${escapeHtml(emp.shift_name || 'General Shift')}</span></td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

    if (employees.length > 50) {
      tbody.innerHTML += `
        <tr>
          <td colspan="8" class="text-center text-muted py-2" style="font-style: italic; background: #f8fafc;">
            ... and ${employees.length - 50} more employee records
          </td>
        </tr>
      `;
    }
  }

  if (previewArea) previewArea.style.display = 'block';
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = `Import ${employees.length} Employees`;
  }
}

async function confirmEmployeesImport() {
  if (!uploadedEmployeesCache || uploadedEmployeesCache.length === 0) {
    showToast('No employee records to import', 'warning');
    return;
  }

  const isReplace = document.querySelector('input[name="employeeImportMode"]:checked')?.value === 'replace';
  const syncToDevice = Boolean(document.getElementById('chkSyncUploadedToDevice')?.checked);
  const confirmBtn = document.getElementById('btnEmployeeUploadConfirm');

  if (isReplace) {
    const ok = confirm(`Are you sure you want to REPLACE ALL existing employees with these ${uploadedEmployeesCache.length} records? Existing records will be deleted.`);
    if (!ok) return;
  }

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
      <span class="spin" style="display:inline-block;width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;margin-right:6px;"></span>
      Importing ${uploadedEmployeesCache.length} Employees...
    `;
  }

  try {
    const res = await fetch('/api/employees/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employees: uploadedEmployeesCache,
        replaceExisting: isReplace,
        syncToDevice: syncToDevice
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to import employees');

    showToast(data.message || `Successfully saved ${data.count} employees!`, 'success', 6000);

    if (data.deviceSyncError) {
      showToast(`Warning syncing to device: ${data.deviceSyncError}`, 'warning', 7000);
    } else if (data.deviceSyncCount > 0) {
      showToast(`Synced ${data.deviceSyncCount} employee names to SpeedFace terminal!`, 'success');
    }

    closeEmployeeUploadModal();
    await Promise.allSettled([
      loadEmployees(),
      loadDashboardStats(),
      loadDataResetSummary()
    ]);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = `Import ${uploadedEmployeesCache.length} Employees`;
    }
  }
}

// ----------------------------------------------------
// 12. Production System Diagnostics, Health & Rolling Backups
// ----------------------------------------------------
function formatUptime(seconds) {
  if (!seconds || seconds < 0) return '0s';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0 || s > 0) parts.push(`${s}s`);
  return parts.join(' ');
}

async function loadSystemHealth() {
  try {
    const res = await fetch('/health');
    if (!res.ok) return;
    const data = await res.json();

    const uptimeEl = document.getElementById('healthUptime');
    const memoryEl = document.getElementById('healthMemory');
    const heapEl = document.getElementById('healthHeap');
    const dbSizeEl = document.getElementById('healthDbSize');
    const wsClientsEl = document.getElementById('healthWsClients');

    if (uptimeEl) {
      uptimeEl.textContent = data.uptime || formatUptime(data.uptimeSeconds);
    }
    if (memoryEl && data.memory) {
      memoryEl.textContent = `${data.memory.rssMb} MB`;
    }
    if (heapEl && data.memory) {
      heapEl.textContent = `Heap: ${data.memory.heapUsedMb} / ${data.memory.heapTotalMb} MB`;
    }
    if (dbSizeEl && data.database) {
      dbSizeEl.textContent = `${data.database.sizeMb} MB`;
    }
    if (wsClientsEl && data.webSocket) {
      wsClientsEl.textContent = `${data.webSocket.activeClients} Active`;
    }

    await loadDatabaseSnapshotsList();
  } catch (err) {
    console.error('Failed to load system health:', err);
  }
}

async function loadDatabaseSnapshotsList() {
  const container = document.getElementById('backupSnapshotsList');
  if (!container) return;

  try {
    const res = await fetch('/api/system/backups');
    const data = await res.json();
    if (!data.success || !Array.isArray(data.backups) || data.backups.length === 0) {
      container.innerHTML = '<span class="text-muted" style="font-size:0.8rem;">No snapshots found in data/backups. Click "Create Snapshot Now" to create your first backup.</span>';
      return;
    }

    container.innerHTML = data.backups.map((snap) => {
      const dateStr = snap.createdAt ? new Date(snap.createdAt).toLocaleString() : '';
      return `
        <div style="display:inline-flex; align-items:center; gap:8px; background:#fff; border:1px solid #86efac; border-radius:6px; padding:6px 10px; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <span style="font-weight:600; color:#166534; font-size:0.8rem;" title="${escapeHtml(dateStr)}">📁 ${escapeHtml(snap.filename)}</span>
          <span class="badge font-mono" style="background:#dcfce7; color:#15803d; font-size:0.75rem;">${escapeHtml(snap.sizeFormatted)}</span>
          <a href="/api/system/backups/download/${encodeURIComponent(snap.filename)}" class="btn btn-sm btn-outline" style="padding:2px 8px; font-size:0.72rem; border-color:#86efac; color:#166534; text-decoration:none;" download>
            ⬇️ Download
          </a>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<span class="text-danger" style="font-size:0.8rem;">Failed to load database snapshots list.</span>';
  }
}

async function createDatabaseSnapshot() {
  const btn = document.getElementById('btnCreateSnapshotNow');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Creating snapshot...';
  }

  try {
    showToast('Creating SQLite database snapshot in data/backups...', 'info');
    const res = await fetch('/api/system/backups/create', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Snapshot failed');

    const backupInfo = data.backup || {};
    const bName = backupInfo.filename || data.filename || 'Database Snapshot';
    const bSize = backupInfo.sizeFormatted || data.sizeFormatted || '';
    showToast(`Snapshot created: ${bName} ${bSize ? '(' + bSize + ')' : ''}`, 'success', 6000);
    await loadDatabaseSnapshotsList();
    await loadSystemHealth();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

async function loadSystemLogs() {
  const consoleEl = document.getElementById('serverLogsConsole');
  if (!consoleEl) return;

  try {
    const res = await fetch('/api/system/logs?limit=80');
    const data = await res.json();
    if (!data.success || !Array.isArray(data.logs) || data.logs.length === 0) {
      consoleEl.textContent = 'No logs recorded in this session yet.';
      return;
    }

    const lines = data.logs.map(log => {
      const time = log.timestamp || '';
      const lvl = (log.level || 'INFO').padEnd(5, ' ');
      const msg = log.message || '';
      return `[${time}] [${lvl}] ${msg}`;
    });

    consoleEl.textContent = lines.join('\n');
    consoleEl.scrollTop = consoleEl.scrollHeight;
  } catch (err) {
    consoleEl.textContent = `Error loading server logs: ${err.message}`;
  }
}

// =========================================================================
// 8. API SERVICE TAB & INTERACTIVE REST EXPLORER
// =========================================================================

let apiServiceInitialized = false;
let apiSelectedSnippetLang = 'curl';

async function initApiServiceTab() {
  // Update Base URL display
  const baseHost = window.location.origin;
  const baseUrlEl = document.getElementById('apiBaseUrlDisplay');
  if (baseUrlEl) {
    baseUrlEl.textContent = `${baseHost}/api`;
  }

  // Load employees for user selector dropdown if not already loaded or empty
  const userSelect = document.getElementById('apiAttSelectUser');
  if (userSelect && (userSelect.options.length <= 1 || userSelect.options[0].value === '')) {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      const employees = data.employees || [];
      // Sort numerically by user_id
      employees.sort((a, b) => {
        const numA = parseInt(a.user_id, 10);
        const numB = parseInt(b.user_id, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a.user_id).localeCompare(String(b.user_id));
      });

      userSelect.innerHTML = employees.map(emp => {
        const name = emp.name || emp.employee_name || 'Unnamed';
        const dept = emp.department ? ` (${emp.department})` : '';
        return `<option value="${emp.user_id}">ID ${emp.user_id} - ${name}${dept}</option>`;
      }).join('');

      // If user 44 exists, select it as good default
      const has44 = employees.some(e => String(e.user_id) === '44');
      if (has44) {
        userSelect.value = '44';
      }
    } catch (err) {
      console.error('Failed to load employees for API tab:', err);
    }
  }

  // Initialize dates
  const monthInput = document.getElementById('apiAttMonthInput');
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (monthInput && !monthInput.value) {
    monthInput.value = currentYm;
  }

  const startInput = document.getElementById('apiAttStartDate');
  const endInput = document.getElementById('apiAttEndDate');
  const dateInput = document.getElementById('apiAttDateInput');
  const todayYmd = now.toISOString().split('T')[0];
  if (startInput && !startInput.value) startInput.value = `${currentYm}-01`;
  if (endInput && !endInput.value) endInput.value = todayYmd;
  if (dateInput && !dateInput.value) dateInput.value = todayYmd;

  // Setup event listeners only once
  if (!apiServiceInitialized) {
    setupApiServiceListeners();
    apiServiceInitialized = true;
  }

  // Update URL previews and code snippet
  updateApiUsersUrlPreview();
  updateApiAttUrlPreview();
  renderApiSnippet();
}

function setupApiServiceListeners() {
  // Base URL copy
  document.getElementById('btnCopyBaseApiUrl')?.addEventListener('click', () => {
    const url = document.getElementById('apiBaseUrlDisplay')?.textContent || '';
    copyTextToClipboard(url, 'Base API URL copied to clipboard!');
  });

  // Endpoint 1: Users Filter inputs change
  ['apiUsersFilterStatus', 'apiUsersFilterDept', 'apiUsersFilterSearch'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateApiUsersUrlPreview);
    document.getElementById(id)?.addEventListener('change', updateApiUsersUrlPreview);
  });

  // Endpoint 1: Copy URL
  document.getElementById('btnCopyUsersUrl')?.addEventListener('click', () => {
    const url = document.getElementById('apiUsersRequestUrlPreview')?.textContent || '';
    copyTextToClipboard(url, 'Users API endpoint URL copied!');
  });

  // Endpoint 1: Send Request
  document.getElementById('btnSendUsersRequest')?.addEventListener('click', executeApiUsersRequest);

  // Endpoint 1: Copy JSON
  document.getElementById('btnCopyUsersJson')?.addEventListener('click', () => {
    const text = document.getElementById('apiUsersJsonOutput')?.textContent || '';
    copyTextToClipboard(text, 'Users JSON copied to clipboard!');
  });

  // Endpoint 2: Attendance Period Mode change
  document.getElementById('apiAttPeriodMode')?.addEventListener('change', (e) => {
    const mode = e.target.value;
    const monthWrap = document.getElementById('apiAttMonthWrap');
    const rangeWrap = document.getElementById('apiAttRangeWrap');
    const dateWrap = document.getElementById('apiAttDateWrap');

    if (monthWrap) monthWrap.style.display = (mode === 'month') ? 'block' : 'none';
    if (rangeWrap) rangeWrap.style.display = (mode === 'range') ? 'block' : 'none';
    if (dateWrap) dateWrap.style.display = (mode === 'date') ? 'block' : 'none';

    updateApiAttUrlPreview();
    renderApiSnippet();
  });

  // Endpoint 2: Inputs change
  ['apiAttSelectUser', 'apiAttMonthInput', 'apiAttStartDate', 'apiAttEndDate', 'apiAttDateInput', 'apiAttIncludePunches'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      updateApiAttUrlPreview();
      renderApiSnippet();
    });
    document.getElementById(id)?.addEventListener('change', () => {
      updateApiAttUrlPreview();
      renderApiSnippet();
    });
  });

  // Endpoint 2: Copy URL
  document.getElementById('btnCopyAttUrl')?.addEventListener('click', () => {
    const url = document.getElementById('apiAttRequestUrlPreview')?.textContent || '';
    copyTextToClipboard(url, 'Attendance API endpoint URL copied!');
  });

  // Endpoint 2: Send Request
  document.getElementById('btnSendAttRequest')?.addEventListener('click', executeApiAttRequest);

  // Endpoint 2: Copy JSON
  document.getElementById('btnCopyAttJson')?.addEventListener('click', () => {
    const text = document.getElementById('apiAttJsonOutput')?.textContent || '';
    copyTextToClipboard(text, 'Attendance JSON copied to clipboard!');
  });

  // Code Snippet language tabs
  document.querySelectorAll('.api-snippet-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.api-snippet-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      apiSelectedSnippetLang = btn.dataset.lang || 'curl';
      renderApiSnippet();
    });
  });

  // Copy snippet button
  document.getElementById('btnCopySnippet')?.addEventListener('click', () => {
    const text = document.getElementById('apiSnippetContent')?.textContent || '';
    copyTextToClipboard(text, 'Code snippet copied to clipboard!');
  });
}

function getApiUsersUrl() {
  const base = `${window.location.origin}/api/v1/users`;
  const params = new URLSearchParams();
  const status = document.getElementById('apiUsersFilterStatus')?.value;
  if (status && status !== 'all') params.append('status', status);

  const dept = document.getElementById('apiUsersFilterDept')?.value?.trim();
  if (dept) params.append('department', dept);

  const search = document.getElementById('apiUsersFilterSearch')?.value?.trim();
  if (search) params.append('search', search);

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function updateApiUsersUrlPreview() {
  const el = document.getElementById('apiUsersRequestUrlPreview');
  if (el) el.textContent = getApiUsersUrl();
}

async function executeApiUsersRequest() {
  const btn = document.getElementById('btnSendUsersRequest');
  const wrap = document.getElementById('apiUsersResponseWrap');
  const output = document.getElementById('apiUsersJsonOutput');
  const statusBadge = document.getElementById('apiUsersStatusBadge');
  const timeBadge = document.getElementById('apiUsersTimeBadge');
  const countBadge = document.getElementById('apiUsersCountBadge');

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `⏳ Sending...`;

  const url = getApiUsersUrl();
  const startTime = performance.now();

  try {
    const res = await fetch(url);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    const data = await res.json();
    if (wrap) wrap.style.display = 'block';

    if (statusBadge) {
      statusBadge.textContent = `${res.status} ${res.statusText || 'OK'}`;
      statusBadge.style.background = res.ok ? '#10b981' : '#ef4444';
    }
    if (timeBadge) timeBadge.textContent = `${duration} ms`;
    if (countBadge) countBadge.textContent = `${data.count ?? data.total ?? data.users?.length ?? 0} users`;

    if (output) {
      output.textContent = JSON.stringify(data, null, 2);
    }
  } catch (err) {
    if (wrap) wrap.style.display = 'block';
    if (statusBadge) {
      statusBadge.textContent = 'Error';
      statusBadge.style.background = '#ef4444';
    }
    if (output) output.textContent = JSON.stringify({ error: err.message }, null, 2);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function getApiAttUrl() {
  const userId = document.getElementById('apiAttSelectUser')?.value || '44';
  const base = `${window.location.origin}/api/v1/users/${encodeURIComponent(userId)}/attendance`;
  const mode = document.getElementById('apiAttPeriodMode')?.value || 'month';
  const params = new URLSearchParams();

  if (mode === 'month') {
    const m = document.getElementById('apiAttMonthInput')?.value;
    if (m) params.append('month', m);
  } else if (mode === 'range') {
    const s = document.getElementById('apiAttStartDate')?.value;
    const e = document.getElementById('apiAttEndDate')?.value;
    if (s) params.append('startDate', s);
    if (e) params.append('endDate', e);
  } else if (mode === 'date') {
    const d = document.getElementById('apiAttDateInput')?.value;
    if (d) params.append('date', d);
  }

  const includePunches = document.getElementById('apiAttIncludePunches')?.checked;
  if (!includePunches) {
    params.append('includePunches', 'false');
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function updateApiAttUrlPreview() {
  const el = document.getElementById('apiAttRequestUrlPreview');
  if (el) el.textContent = getApiAttUrl();
}

async function executeApiAttRequest() {
  const btn = document.getElementById('btnSendAttRequest');
  const wrap = document.getElementById('apiAttResponseWrap');
  const output = document.getElementById('apiAttJsonOutput');
  const statusBadge = document.getElementById('apiAttStatusBadge');
  const timeBadge = document.getElementById('apiAttTimeBadge');
  const chipsWrap = document.getElementById('apiAttSummaryChips');

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `⏳ Sending...`;

  const url = getApiAttUrl();
  const startTime = performance.now();

  try {
    const res = await fetch(url);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    const data = await res.json();
    if (wrap) wrap.style.display = 'block';

    if (statusBadge) {
      statusBadge.textContent = `${res.status} ${res.statusText || 'OK'}`;
      statusBadge.style.background = res.ok ? '#10b981' : '#ef4444';
    }
    if (timeBadge) timeBadge.textContent = `${duration} ms`;

    // Render KPI Chips if totals exist
    if (chipsWrap && data.totals) {
      const t = data.totals;
      chipsWrap.innerHTML = `
        <span class="badge" style="background:#eff6ff;color:#1e40af;font-size:0.75rem;padding:4px 8px;">💼 Work Days: <strong>${t.scheduled_work_days}</strong></span>
        <span class="badge" style="background:#ecfdf5;color:#047857;font-size:0.75rem;padding:4px 8px;">✅ Present: <strong>${t.present_days}</strong></span>
        <span class="badge" style="background:#fef2f2;color:#b91c1c;font-size:0.75rem;padding:4px 8px;">❌ Absent: <strong>${t.absent_days}</strong></span>
        <span class="badge" style="background:#fffbeb;color:#b45309;font-size:0.75rem;padding:4px 8px;">⏰ Late: <strong>${t.late_days}</strong></span>
        <span class="badge" style="background:#f5f3ff;color:#6d28d9;font-size:0.75rem;padding:4px 8px;">🛡️ Grace Used: <strong>${t.grace_days_used}</strong></span>
        <span class="badge" style="background:#ecfeff;color:#0e7490;font-size:0.75rem;padding:4px 8px;">⚡ Overtime: <strong>${t.total_ot_hours}H</strong></span>
        <span class="badge" style="background:#f1f5f9;color:#334155;font-size:0.75rem;padding:4px 8px;">⏱️ Worked: <strong>${t.total_worked_formatted}</strong></span>
      `;
    } else if (chipsWrap) {
      chipsWrap.innerHTML = '';
    }

    if (output) {
      output.textContent = JSON.stringify(data, null, 2);
    }
  } catch (err) {
    if (wrap) wrap.style.display = 'block';
    if (statusBadge) {
      statusBadge.textContent = 'Error';
      statusBadge.style.background = '#ef4444';
    }
    if (output) output.textContent = JSON.stringify({ error: err.message }, null, 2);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function renderApiSnippet() {
  const pre = document.getElementById('apiSnippetContent');
  if (!pre) return;

  const attUrl = getApiAttUrl();
  const usersUrl = getApiUsersUrl();

  if (apiSelectedSnippetLang === 'curl') {
    pre.textContent = `# 1. Fetch all enrolled users\ncurl -X GET "${usersUrl}" \\\n  -H "Accept: application/json"\n\n# 2. Fetch calculated attendance records for employee\ncurl -X GET "${attUrl}" \\\n  -H "Accept: application/json"`;
  } else if (apiSelectedSnippetLang === 'js') {
    pre.textContent = `// Example: Fetch calculated attendance in JavaScript (Node.js or Browser)
async function getEmployeeAttendance() {
  const url = '${attUrl}';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(\`HTTP error! Status: \${response.status}\`);
  }
  const data = await response.json();
  console.log('Employee:', data.user.name, '| Period:', data.period.label);
  console.log('Attendance Totals:', data.totals);
  console.log('Daily Records Breakdown:', data.records);
  return data;
}

getEmployeeAttendance().catch(console.error);`;
  } else if (apiSelectedSnippetLang === 'python') {
    pre.textContent = `# Example: Fetch calculated attendance in Python
import requests

url = "${attUrl}"
response = requests.get(url, headers={"Accept": "application/json"})

if response.status_code == 200:
    data = response.json()
    user = data.get("user", {})
    totals = data.get("totals", {})
    print(f"Attendance for {user.get('name')} ({totals.get('attendance_percentage')}):")
    print(f"  Worked: {totals.get('total_worked_formatted')}, OT: {totals.get('total_ot_hours')}H")
    for record in data.get("records", []):
        print(f"  [{record['date']}] In: {record['check_in_time']} | Out: {record['check_out_time']} | Status: {record['daily_status']}")
else:
    print(f"Error {response.status_code}: {response.text}")`;
  }
}

function copyTextToClipboard(text, successMsg = 'Copied to clipboard!') {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'info', 2500);
    }).catch(() => {
      fallbackCopyText(text, successMsg);
    });
  } else {
    fallbackCopyText(text, successMsg);
  }
}

function fallbackCopyText(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, 'info', 2500);
  } catch (e) {
    showToast('Failed to copy text', 'error');
  }
  document.body.removeChild(ta);
}


