/**
 * Organization Partition & Multi-Tenant Frontend Module
 * 
 * Manages partition context, topbar switching, and dynamic domain hydration
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_ORG = 'speedface_cloud_org_id';
  let cachedPartitions = [];
  let isSwitching = false;

  const PartitionManager = {
    getActivePartition: function () {
      if (window.RBAC && !window.RBAC.isSuperAdmin()) {
        const u = window.RBAC.getUser();
        if (u && u.orgId) return u.orgId;
      }
      return localStorage.getItem(STORAGE_KEY_ORG) || 'DSOFFICE_LUNUGAMWEHERA';
    },

    setActivePartition: function (orgId) {
      if (!orgId) return;
      const cleanId = String(orgId).trim().toUpperCase();
      localStorage.setItem(STORAGE_KEY_ORG, cleanId);
      if (window.state) {
        window.state.activePartition = cleanId;
      }
    },

    fetchPartitions: async function () {
      try {
        const headers = window.RBAC ? window.RBAC.getAuthHeaders() : {};
        const res = await fetch('/api/partition/list', { headers });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.partitions)) {
          cachedPartitions = data.partitions;
          return cachedPartitions;
        }
      } catch (err) {
        console.warn('[PARTITION] Error fetching partitions list:', err.message);
      }
      return cachedPartitions;
    },

    getCachedPartitions: function () {
      return cachedPartitions;
    },

    /**
     * Populate partition selector dropdowns across the application
     */
    populateDropdowns: function (partitionsList = null) {
      const parts = partitionsList || cachedPartitions;
      if (!parts || parts.length === 0) return;

      const currentOrg = this.getActivePartition();

      // 1. Topbar Partition Switcher Select
      const headerSelect = document.getElementById('headerOrgPartitionSelect');
      if (headerSelect) {
        headerSelect.innerHTML = '';
        parts.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.org_id;
          opt.textContent = `${p.org_name} (${p.org_id})`;
          if (p.org_id.toUpperCase() === currentOrg.toUpperCase()) {
            opt.selected = true;
          }
          headerSelect.appendChild(opt);
        });
      }

      // 2. System Login Partition Select
      const loginSelect = document.getElementById('selectLoginOrgId');
      if (loginSelect) {
        loginSelect.innerHTML = '';
        parts.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.org_id;
          opt.textContent = `${p.org_name} (${p.org_id})`;
          if (p.org_id.toUpperCase() === currentOrg.toUpperCase()) {
            opt.selected = true;
          }
          loginSelect.appendChild(opt);
        });
      }

      // 3. Header Badge Text
      const headerOrgBadge = document.getElementById('headerOrgBadge') || document.getElementById('headerActivePartitionName');
      if (headerOrgBadge) {
        const matched = parts.find(p => p.org_id.toUpperCase() === currentOrg.toUpperCase());
        headerOrgBadge.textContent = matched ? matched.org_name : currentOrg;
      }

      // Re-apply RBAC to lock dropdown if user is tenant admin
      if (window.RBAC) {
        window.RBAC.applyUIPermissions();
      }
    },

    /**
     * Switch the active organization partition
     */
    switchPartition: async function (targetOrgId, onComplete = null) {
      if (isSwitching) return;
      if (!targetOrgId) return;

      const cleanOrgId = String(targetOrgId).trim().toUpperCase();
      const currentOrg = this.getActivePartition();

      // Tenant permission check
      if (window.RBAC && !window.RBAC.isSuperAdmin()) {
        const userOrg = (window.RBAC.getUser()?.orgId || '').toUpperCase();
        if (cleanOrgId !== userOrg) {
          if (window.showToast) {
            window.showToast(`Access Denied: You are restricted to partition "${userOrg}".`, 'error');
          } else {
            alert(`Access Denied: Tenant users cannot switch to partition "${cleanOrgId}".`);
          }
          this.populateDropdowns();
          return;
        }
      }

      if (cleanOrgId === currentOrg.toUpperCase() && !onComplete) {
        return; // Already on this partition
      }

      isSwitching = true;
      console.log(`[PARTITION] Switching active partition from "${currentOrg}" to "${cleanOrgId}"...`);

      if (window.showToast) {
        window.showToast(`Switching partition to "${cleanOrgId}"...`, 'info');
      }

      try {
        const headers = window.RBAC ? window.RBAC.getAuthHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
        const res = await fetch('/api/partition/switch', {
          method: 'POST',
          headers,
          body: JSON.stringify({ orgId: cleanOrgId })
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to switch partition on server.');
        }

        // Update local state and storage
        this.setActivePartition(cleanOrgId);
        this.populateDropdowns();

        if (window.showToast) {
          window.showToast(`Partition successfully switched to "${data.orgName || cleanOrgId}"`, 'success');
        }

        // Trigger dynamic domain reloads
        if (typeof window.triggerPartitionReload === 'function') {
          window.triggerPartitionReload(cleanOrgId);
        } else if (typeof window.switchOrganizationPartitionUI === 'function') {
          window.switchOrganizationPartitionUI(cleanOrgId);
        }

        if (typeof onComplete === 'function') {
          onComplete(cleanOrgId);
        }
      } catch (err) {
        console.error('[PARTITION] Error switching partition:', err.message);
        if (window.showToast) {
          window.showToast(`Error switching partition: ${err.message}`, 'error');
        } else {
          alert('Error switching partition: ' + err.message);
        }
        this.populateDropdowns();
      } finally {
        isSwitching = false;
      }
    },

    init: async function () {
      await this.fetchPartitions();
      this.populateDropdowns();

      // Bind header partition select
      const headerSelect = document.getElementById('headerOrgPartitionSelect');
      if (headerSelect) {
        headerSelect.addEventListener('change', (e) => {
          this.switchPartition(e.target.value);
        });
      }
    }
  };

  window.PartitionManager = PartitionManager;

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PartitionManager.init());
  } else {
    setTimeout(() => PartitionManager.init(), 150);
  }
})(window);
