/**
 * Automated SQLite Pruning & Cold Storage Export Frontend Module
 * 
 * Provides UI controls, metric charts, retention policy configuration,
 * archive generation, and archive downloads.
 */

(function (window) {
  'use strict';

  let currentMaintenanceStatus = null;
  let isPruning = false;

  const MaintenanceModule = {
    getStatus: function () {
      return currentMaintenanceStatus;
    },

    /**
     * Load maintenance storage status and metrics from server
     */
    loadStatus: async function () {
      try {
        const headers = window.RBAC ? window.RBAC.getAuthHeaders() : {};
        const orgId = window.PartitionManager ? window.PartitionManager.getActivePartition() : 'ALL';
        const res = await fetch(`/api/maintenance/status?orgId=${encodeURIComponent(orgId)}`, { headers });
        const data = await res.json();
        if (data && data.success) {
          currentMaintenanceStatus = data;
          this.renderStatus(data);
          return data;
        }
      } catch (err) {
        console.warn('[MAINTENANCE] Error loading status:', err.message);
      }
      return null;
    },

    /**
     * Render storage metrics onto DOM elements
     */
    renderStatus: function (status) {
      if (!status) return;

      const elTotalRecords = document.getElementById('maintStatTotalRecords');
      const elPrunableRecords = document.getElementById('maintStatPrunableRecords');
      const elDbSize = document.getElementById('maintStatDbSize');
      const elCutoffDate = document.getElementById('maintStatCutoffDate');
      const elTotalArchives = document.getElementById('maintStatTotalArchives');
      const elArchivedRecords = document.getElementById('maintStatArchivedRecords');

      if (elTotalRecords) elTotalRecords.textContent = Number(status.totalAttendanceRecords || 0).toLocaleString();
      if (elPrunableRecords) elPrunableRecords.textContent = Number(status.prunableRecords || 0).toLocaleString();
      if (elDbSize) elDbSize.textContent = status.databaseSize?.formatted || '0 MB';
      if (elCutoffDate) elCutoffDate.textContent = status.cutoffDate ? status.cutoffDate.split(' ')[0] : 'N/A';
      if (elTotalArchives) elTotalArchives.textContent = Number(status.totalArchivesCount || 0).toLocaleString();
      if (elArchivedRecords) elArchivedRecords.textContent = Number(status.totalArchivedRecords || 0).toLocaleString();

      // Populate Settings Inputs
      const selectRetention = document.getElementById('maintInputRetentionDays');
      const checkAutoPrune = document.getElementById('maintToggleAutoPrune');
      const checkRequireSynced = document.getElementById('maintCheckRequireSynced');
      const selectFormat = document.getElementById('maintSelectFormat');

      if (selectRetention) selectRetention.value = String(status.retentionDays || 90);
      if (checkAutoPrune) checkAutoPrune.checked = status.autoPruneEnabled === true;
      if (checkRequireSynced) checkRequireSynced.checked = status.requireSynced !== false;
      if (selectFormat) selectFormat.value = status.archiveFormat || 'JSON';

      // Update Prune Button state
      const btnPrune = document.getElementById('btnExecutePruneNow');
      if (btnPrune) {
        if (status.prunableRecords > 0) {
          btnPrune.classList.remove('opacity-50', 'cursor-not-allowed');
          btnPrune.disabled = false;
        } else {
          btnPrune.title = 'No records older than retention window to prune';
        }
      }
    },

    /**
     * Save maintenance settings
     */
    saveSettings: async function () {
      const selectRetention = document.getElementById('maintInputRetentionDays');
      const checkAutoPrune = document.getElementById('maintToggleAutoPrune');
      const checkRequireSynced = document.getElementById('maintCheckRequireSynced');
      const selectFormat = document.getElementById('maintSelectFormat');

      const payload = {
        retentionDays: selectRetention ? parseInt(selectRetention.value, 10) : 90,
        autoPruneEnabled: checkAutoPrune ? checkAutoPrune.checked : false,
        requireSynced: checkRequireSynced ? checkRequireSynced.checked : true,
        archiveFormat: selectFormat ? selectFormat.value : 'JSON'
      };

      try {
        const headers = window.RBAC ? window.RBAC.getAuthHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
        const res = await fetch('/api/maintenance/settings', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          if (window.showToast) {
            window.showToast('Maintenance retention settings saved successfully.', 'success');
          } else {
            alert('Maintenance retention settings saved successfully.');
          }
          await this.loadStatus();
        } else {
          throw new Error(data.error || 'Failed to save maintenance settings.');
        }
      } catch (err) {
        console.error('[MAINTENANCE] Error saving settings:', err.message);
        if (window.showToast) window.showToast('Error: ' + err.message, 'error');
        else alert('Error: ' + err.message);
      }
    },

    /**
     * Execute manual cold storage export & prune
     */
    executePrune: async function () {
      if (isPruning) return;

      const prunableCount = currentMaintenanceStatus?.prunableRecords || 0;
      const retentionDays = currentMaintenanceStatus?.retentionDays || 90;

      const confirmMsg = prunableCount > 0
        ? `Are you sure you want to export and prune ${prunableCount.toLocaleString()} attendance records older than ${retentionDays} days into Cold Storage?\n\nA verifiable cold storage archive file will be created before records are safely pruned from the active database.`
        : `Check and prune eligible records older than ${retentionDays} days into Cold Storage?`;

      if (!confirm(confirmMsg)) return;

      isPruning = true;
      const btnPrune = document.getElementById('btnExecutePruneNow');
      const origText = btnPrune ? btnPrune.innerHTML : '';
      if (btnPrune) {
        btnPrune.disabled = true;
        btnPrune.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Exporting & Pruning...';
      }

      if (window.showToast) {
        window.showToast('Executing Cold Storage Export & Database Prune...', 'info');
      }

      try {
        const headers = window.RBAC ? window.RBAC.getAuthHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
        const orgId = window.PartitionManager ? window.PartitionManager.getActivePartition() : 'ALL';
        const selectFormat = document.getElementById('maintSelectFormat');

        const res = await fetch('/api/maintenance/prune', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            orgId,
            format: selectFormat ? selectFormat.value : 'JSON'
          })
        });

        const data = await res.json();
        if (data.success) {
          const msg = data.prunedCount > 0
            ? `Successfully archived and pruned ${data.prunedCount.toLocaleString()} records into "${data.filename}" (${data.fileSizeFormatted})!`
            : (data.message || 'Pruning complete. No records met the cutoff date.');

          if (window.showToast) {
            window.showToast(msg, 'success');
          } else {
            alert(msg);
          }

          // Reload metrics and archive list
          await this.loadStatus();
          await this.loadArchives();
        } else {
          throw new Error(data.error || 'Prune operation failed on server.');
        }
      } catch (err) {
        console.error('[MAINTENANCE] Prune error:', err.message);
        if (window.showToast) window.showToast('Prune error: ' + err.message, 'error');
        else alert('Prune error: ' + err.message);
      } finally {
        isPruning = false;
        if (btnPrune) {
          btnPrune.disabled = false;
          btnPrune.innerHTML = origText;
        }
      }
    },

    /**
     * Load list of archives from server and populate table
     */
    loadArchives: async function () {
      try {
        const headers = window.RBAC ? window.RBAC.getAuthHeaders() : {};
        const orgId = window.PartitionManager ? window.PartitionManager.getActivePartition() : 'ALL';
        const res = await fetch(`/api/maintenance/archives?orgId=${encodeURIComponent(orgId)}`, { headers });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.archives)) {
          this.renderArchivesTable(data.archives);
          return data.archives;
        }
      } catch (err) {
        console.warn('[MAINTENANCE] Error loading archives list:', err.message);
      }
      return [];
    },

    /**
     * Render archives list table
     */
    renderArchivesTable: function (archives) {
      const tbody = document.getElementById('maintArchivesTableBody');
      const emptyState = document.getElementById('maintArchivesEmptyState');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (!archives || archives.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      archives.forEach((arch, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-700 hover:bg-slate-800/50 transition-colors text-xs text-slate-300';

        const formatBadgeColor = arch.format === 'CSV' ? 'bg-amber-900/60 text-amber-300 border-amber-700' : 'bg-blue-900/60 text-blue-300 border-blue-700';

        tr.innerHTML = `
          <td class="px-3 py-2.5 font-mono text-slate-400 font-semibold">${idx + 1}</td>
          <td class="px-3 py-2.5">
            <div class="font-medium text-slate-100">${escapeHtml(arch.filename)}</div>
            <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(arch.archive_id)}</div>
          </td>
          <td class="px-3 py-2.5">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${formatBadgeColor}">
              ${arch.format || 'JSON'}
            </span>
          </td>
          <td class="px-3 py-2.5 font-semibold text-slate-200">
            ${Number(arch.record_count || 0).toLocaleString()} records
          </td>
          <td class="px-3 py-2.5 text-slate-400">
            <div>${arch.start_date ? arch.start_date.split(' ')[0] : 'N/A'}</div>
            <div class="text-[10px] text-slate-500">to ${arch.end_date ? arch.end_date.split(' ')[0] : 'N/A'}</div>
          </td>
          <td class="px-3 py-2.5 font-mono text-slate-300 font-semibold">
            ${arch.fileSizeFormatted || '0 KB'}
          </td>
          <td class="px-3 py-2.5 text-slate-400">
            ${arch.created_at ? arch.created_at.split(' ')[0] : 'N/A'}
          </td>
          <td class="px-3 py-2.5 text-right space-x-2">
            <button class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-xs transition-colors inline-flex items-center gap-1 btn-download-archive" data-id="${arch.archive_id}">
              <span>📥</span> Download
            </button>
          </td>
        `;

        // Bind download button
        const btnDownload = tr.querySelector('.btn-download-archive');
        if (btnDownload) {
          btnDownload.addEventListener('click', () => {
            this.downloadArchive(arch.archive_id);
          });
        }

        tbody.appendChild(tr);
      });
    },

    /**
     * Download archive file directly
     */
    downloadArchive: function (archiveId) {
      if (!archiveId) return;
      const token = window.RBAC ? window.RBAC.getToken() : '';
      const url = `/api/maintenance/archives/${encodeURIComponent(archiveId)}/download?token=${encodeURIComponent(token)}`;

      // Create hidden link to trigger file download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    init: function () {
      // Bind save settings button
      const btnSave = document.getElementById('btnSaveMaintSettings');
      if (btnSave) {
        btnSave.addEventListener('click', () => this.saveSettings());
      }

      // Bind execute prune button
      const btnPrune = document.getElementById('btnExecutePruneNow');
      if (btnPrune) {
        btnPrune.addEventListener('click', () => this.executePrune());
      }

      // Bind refresh archives button
      const btnRefresh = document.getElementById('btnRefreshMaintArchives');
      if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
          await this.loadStatus();
          await this.loadArchives();
        });
      }

      // Initial load
      this.loadStatus();
      this.loadArchives();
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.MaintenanceModule = MaintenanceModule;

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MaintenanceModule.init());
  } else {
    setTimeout(() => MaintenanceModule.init(), 250);
  }
})(window);
