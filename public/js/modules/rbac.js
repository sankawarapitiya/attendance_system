/**
 * Tenant-Level Role-Based Access Control (RBAC) Frontend Module
 * 
 * Roles:
 * - super_admin: Master administrator across all tenant partitions.
 * - admin: Tenant Administrator bound to assigned organization partition.
 * - manager: HR & Attendance Manager (records, reports, leave approvals).
 * - staff: Employee self-service (timesheets, leave submission).
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_TOKEN = 'speedface_auth_token';
  const STORAGE_KEY_USER = 'speedface_auth_user';
  const STORAGE_KEY_ORG = 'speedface_cloud_org_id';

  let currentUser = null;
  let currentToken = null;

  // Initialize from LocalStorage
  try {
    currentToken = localStorage.getItem(STORAGE_KEY_TOKEN) || null;
    const userStr = localStorage.getItem(STORAGE_KEY_USER);
    if (userStr) {
      currentUser = JSON.parse(userStr);
    }
  } catch (e) {
    currentUser = null;
  }

  const RBAC = {
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_USER,
    STORAGE_KEY_ORG,

    getToken: function () {
      return currentToken || localStorage.getItem(STORAGE_KEY_TOKEN) || '';
    },

    getUser: function () {
      if (!currentUser) {
        try {
          const u = localStorage.getItem(STORAGE_KEY_USER);
          if (u) currentUser = JSON.parse(u);
        } catch (e) {}
      }
      return currentUser;
    },

    getRole: function () {
      const u = this.getUser();
      return (u?.role || 'staff').toLowerCase();
    },

    getPartitionId: function () {
      const u = this.getUser();
      if (u?.role === 'super_admin') {
        return localStorage.getItem(STORAGE_KEY_ORG) || u.orgId || 'DSOFFICE_LUNUGAMWEHERA';
      }
      return u?.orgId || localStorage.getItem(STORAGE_KEY_ORG) || 'DSOFFICE_LUNUGAMWEHERA';
    },

    setSession: function (token, user) {
      currentToken = token;
      currentUser = user;
      try {
        if (token) localStorage.setItem(STORAGE_KEY_TOKEN, token);
        if (user) {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
          if (user.orgId && user.role !== 'super_admin') {
            localStorage.setItem(STORAGE_KEY_ORG, user.orgId);
          }
        }
      } catch (e) {}
      this.applyUIPermissions();
    },

    clearSession: function () {
      currentToken = null;
      currentUser = null;
      try {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USER);
      } catch (e) {}
    },

    isSuperAdmin: function () {
      return this.getRole() === 'super_admin';
    },

    isTenantAdmin: function () {
      const r = this.getRole();
      return r === 'admin' || r === 'super_admin';
    },

    isManagerOrAbove: function () {
      const r = this.getRole();
      return r === 'manager' || r === 'admin' || r === 'super_admin';
    },

    hasRole: function (roles) {
      if (this.isSuperAdmin()) return true;
      if (!Array.isArray(roles)) roles = [roles];
      const myRole = this.getRole();
      return roles.map(r => String(r).toLowerCase()).includes(myRole);
    },

    /**
     * Inject Authorization Bearer token & tenant partition ID into request headers
     */
    getAuthHeaders: function (existingHeaders = {}) {
      const headers = Object.assign({}, existingHeaders);
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      const partition = this.getPartitionId();
      if (partition) {
        headers['x-organization-id'] = partition;
      }
      return headers;
    },

    /**
     * Dynamically updates the DOM to hide/disable actions and navigation based on user permissions
     */
    applyUIPermissions: function () {
      const role = this.getRole();
      const isSuper = this.isSuperAdmin();
      const isAdmin = this.isTenantAdmin();
      const isManager = this.isManagerOrAbove();
      const user = this.getUser();

      console.log(`[RBAC] Applying UI permissions for role: "${role}" (Partition: ${user?.orgId || 'N/A'})`);

      // 1. Topbar Partition Switcher
      const headerPartitionSelect = document.getElementById('headerOrgPartitionSelect');
      const partitionPill = document.getElementById('headerPartitionPill');
      if (headerPartitionSelect) {
        if (!isSuper) {
          // Lock partition switcher to the user's tenant partition
          headerPartitionSelect.disabled = true;
          headerPartitionSelect.title = `Partition locked to your organization (${user?.orgId})`;
          headerPartitionSelect.classList.add('opacity-80', 'cursor-not-allowed');
        } else {
          headerPartitionSelect.disabled = false;
          headerPartitionSelect.title = 'Switch organization partition';
          headerPartitionSelect.classList.remove('opacity-80', 'cursor-not-allowed');
        }
      }

      // 2. Navigation Tabs Visibility
      // Elements with data-rbac-roles attribute
      document.querySelectorAll('[data-rbac-roles]').forEach(el => {
        const allowedRoles = el.getAttribute('data-rbac-roles').split(',').map(r => r.trim().toLowerCase());
        if (isSuper || allowedRoles.includes(role)) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      });

      // 3. System Settings Tab
      const settingsTabBtn = document.querySelector('[data-tab="settings"]');
      if (settingsTabBtn) {
        if (!isAdmin) {
          settingsTabBtn.style.display = 'none';
        } else {
          settingsTabBtn.style.display = '';
        }
      }

      // 4. Employee Management Actions (Add/Edit/Delete)
      const btnAddEmp = document.getElementById('btnAddEmployee') || document.getElementById('btnOpenAddEmployeeModal');
      if (btnAddEmp) {
        btnAddEmp.style.display = isAdmin ? '' : 'none';
      }

      // 5. Leave Approval Actions
      document.querySelectorAll('.btn-leave-approve, .btn-leave-reject').forEach(btn => {
        btn.style.display = isManager ? '' : 'none';
      });

      // 6. User Management Section in Settings
      const userMgmtSection = document.getElementById('sectionSystemUsersManagement');
      if (userMgmtSection) {
        userMgmtSection.style.display = isAdmin ? '' : 'none';
      }

      // 7. Database Maintenance & Cold Storage Card
      const maintenanceCard = document.getElementById('cardDbMaintenancePrune');
      if (maintenanceCard) {
        maintenanceCard.style.display = isAdmin ? '' : 'none';
      }

      // 8. User Display Badge in Header
      const userNameBadge = document.getElementById('headerLoggedInUserName');
      const userRoleBadge = document.getElementById('headerLoggedInUserRole');
      if (userNameBadge && user) {
        userNameBadge.textContent = user.displayName || user.username || user.email;
      }
      if (userRoleBadge && user) {
        let roleLabel = 'Staff';
        let roleBg = 'bg-slate-700';
        if (role === 'super_admin') {
          roleLabel = 'SUPER ADMIN';
          roleBg = 'bg-purple-600';
        } else if (role === 'admin') {
          roleLabel = 'TENANT ADMIN';
          roleBg = 'bg-blue-600';
        } else if (role === 'manager') {
          roleLabel = 'HR MANAGER';
          roleBg = 'bg-emerald-600';
        }
        userRoleBadge.textContent = roleLabel;
        userRoleBadge.className = `px-2 py-0.5 rounded text-xs font-semibold text-white ${roleBg}`;
      }
    }
  };

  window.RBAC = RBAC;

  // Auto-apply on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RBAC.applyUIPermissions());
  } else {
    setTimeout(() => RBAC.applyUIPermissions(), 100);
  }
})(window);
