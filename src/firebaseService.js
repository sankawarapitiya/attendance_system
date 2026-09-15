const fs = require('fs');
const path = require('path');
const https = require('https');
const { GoogleAuth } = require('google-auth-library');
const { initializeApp, cert, getApps, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  dbGet,
  dbRun,
  dbAll,
  getUnsyncedAttendance,
  markAttendanceCloudSynced,
  getUnsyncedEmployees,
  markEmployeesCloudSynced,
  getCloudSyncStats
} = require('./db');

const CREDENTIALS_DIR = path.join(process.cwd(), 'data', 'credentials');
const DEFAULT_KEY_PATH = path.join(CREDENTIALS_DIR, 'firebase-service-account.json');

/**
 * Converts a native JavaScript value to the Firestore REST API Value format.
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(val)) {
      return { timestampValue: val };
    }
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Converts a JavaScript object into a Firestore document fields map.
 */
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

class FirebaseService {
  constructor() {
    this.app = null;
    this.firestore = null;
    this.keyData = null;
    this.authClient = null;
    this.httpsAgent = new https.Agent({ keepAlive: true, timeout: 30000 });
    this.isOnline = false;
    this.isSyncing = false;
    this.quotaExceeded = false;
    this.quotaExceededUntil = null;
    this.lastError = null;
    this.lastSyncTime = null;
    this.initPromise = null;
    this.wsBroadcast = null;
    this.syncProgress = {
      isSyncing: false,
      state: 'IDLE', // 'IDLE', 'STARTING', 'SYNCING', 'COMPLETED', 'OFFLINE', 'QUOTA_EXHAUSTED', 'ERROR'
      uploadedCount: 0,
      totalPending: 0,
      percent: 0,
      message: 'Cloud sync engine idle',
      currentBatch: 0,
      totalBatches: 0,
      updatedAt: new Date().toISOString()
    };
  }

  setWsBroadcast(fn) {
    this.wsBroadcast = fn;
  }

  notify(type, payload) {
    if (this.wsBroadcast) {
      try {
        this.wsBroadcast({ type, data: payload });
      } catch (e) {}
    }
  }

  /**
   * Initializes the Firebase credentials and clients.
   */
  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (!fs.existsSync(CREDENTIALS_DIR)) {
          fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
        }

        if (fs.existsSync(DEFAULT_KEY_PATH)) {
          const raw = fs.readFileSync(DEFAULT_KEY_PATH, 'utf8');
          const parsed = JSON.parse(raw);
          await this._setupApp(parsed);
          console.log(`[FIREBASE] Initialized with project: ${parsed.project_id} (${parsed.client_email})`);
        } else {
          console.log('[FIREBASE] No service account key found at:', DEFAULT_KEY_PATH);
        }
      } catch (err) {
        console.warn('[FIREBASE] Initialization notice:', err.message);
        this.lastError = err.message;
        this.isOnline = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Internal helper to construct and initialize Firebase Admin & REST Auth clients.
   */
  async _setupApp(serviceAccount) {
    if (!serviceAccount || !serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error('Invalid service account key: missing project_id or private_key');
    }

    // Clean up any existing app instances
    const apps = getApps();
    for (const a of apps) {
      try { await deleteApp(a); } catch (e) {}
    }

    this.app = initializeApp({
      credential: cert(serviceAccount)
    }, 'speedface-firebase-app-' + Date.now());

    this.firestore = getFirestore(this.app);
    this.firestore.settings({ ignoreUndefinedProperties: true });

    this.authClient = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
        project_id: serviceAccount.project_id
      },
      scopes: ['https://www.googleapis.com/auth/datastore']
    });

    this.keyData = {
      project_id: serviceAccount.project_id,
      client_email: serviceAccount.client_email,
      private_key_id: serviceAccount.private_key_id
    };

    // Non-blocking ping test
    this.testConnection().catch(() => {});
  }

  /**
   * Retrieves a cached or fresh OAuth2 access token for the Firestore REST API.
   */
  async _getAccessToken() {
    if (!this.authClient) {
      if (fs.existsSync(DEFAULT_KEY_PATH)) {
        const raw = fs.readFileSync(DEFAULT_KEY_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        this.authClient = new GoogleAuth({
          credentials: {
            client_email: parsed.client_email,
            private_key: parsed.private_key,
            project_id: parsed.project_id
          },
          scopes: ['https://www.googleapis.com/auth/datastore']
        });
      } else {
        throw new Error('No Firebase service account credentials found');
      }
    }
    const client = await this.authClient.getClient();
    const tokenRes = await client.getAccessToken();
    return tokenRes.token;
  }

  /**
   * Performs an atomic multi-document commit using the official Firestore REST API.
   * This eliminates gRPC stream stalls on Windows and returns instant HTTP status codes.
   */
  async _commitRestWrites(writes) {
    if (!writes || writes.length === 0) return { success: true, count: 0 };
    const token = await this._getAccessToken();
    const projectId = this.keyData?.project_id;
    if (!projectId) throw new Error('Project ID missing');

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
    const bodyStr = JSON.stringify({ writes });

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        agent: this.httpsAgent,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        },
        timeout: 15000
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.quotaExceeded = false;
            this.quotaExceededUntil = null;
            return resolve({ success: true, statusCode: res.statusCode, raw });
          }

          let parsed = null;
          try { parsed = JSON.parse(raw); } catch (e) {}

          // Check for Quota Exceeded (RESOURCE_EXHAUSTED)
          if (res.statusCode === 429 || parsed?.error?.status === 'RESOURCE_EXHAUSTED') {
            this.quotaExceeded = true;
            // Set 15-minute quiet backoff window
            this.quotaExceededUntil = Date.now() + 15 * 60 * 1000;
            const quotaErr = new Error('Google Cloud Firestore daily write quota reached (Spark Free Plan limit: 20,000 writes/day). Local punches remain 100% safe in SQLite.');
            quotaErr.code = 'QUOTA_EXHAUSTED';
            quotaErr.statusCode = 429;
            return reject(quotaErr);
          }

          const err = new Error(parsed?.error?.message || `Firestore REST commit returned HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          return reject(err);
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('Firestore REST request timed out (15s)'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(bodyStr);
      req.end();
    });
  }

  /**
   * Tests connection to Firestore with a fast REST read ping.
   */
  async testConnection() {
    await this.init();
    if (!this.keyData) {
      throw new Error('Firebase is not initialized. Please upload a service account key.');
    }

    try {
      const start = Date.now();
      const token = await this._getAccessToken();
      const projectId = this.keyData.project_id;
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/_system_health/ping`;

      await new Promise((resolve, reject) => {
        const req = https.get(url, {
          agent: this.httpsAgent,
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 6000
        }, (res) => {
          let raw = '';
          res.on('data', chunk => raw += chunk);
          res.on('end', () => resolve({ statusCode: res.statusCode, raw }));
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('Connection timeout (6s)')));
      });

      const latencyMs = Date.now() - start;
      this.isOnline = true;
      this.lastError = null;

      this.notify('FIREBASE_STATUS_UPDATE', {
        online: true,
        latencyMs,
        projectId: this.keyData.project_id,
        quotaExceeded: this.quotaExceeded
      });

      return {
        success: true,
        online: true,
        latencyMs,
        projectId: this.keyData.project_id,
        clientEmail: this.keyData.client_email,
        quotaExceeded: this.quotaExceeded
      };
    } catch (err) {
      this.isOnline = false;
      this.lastError = err.message;
      this.notify('FIREBASE_STATUS_UPDATE', { online: false, error: err.message });
      throw new Error(`Firestore connection test failed: ${err.message}`);
    }
  }

  /**
   * Saves a new service account JSON file and activates it.
   */
  async saveServiceAccountKey(keyInput) {
    let parsed;
    if (typeof keyInput === 'string') {
      try {
        parsed = JSON.parse(keyInput.trim());
      } catch (e) {
        throw new Error('Provided key is not valid JSON: ' + e.message);
      }
    } else if (typeof keyInput === 'object' && keyInput !== null) {
      parsed = keyInput;
    } else {
      throw new Error('Invalid key format. Expected JSON string or object.');
    }

    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error('Incomplete Service Account key. Must include project_id, private_key, and client_email.');
    }

    if (!fs.existsSync(CREDENTIALS_DIR)) {
      fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
    }

    // Write file securely
    fs.writeFileSync(DEFAULT_KEY_PATH, JSON.stringify(parsed, null, 2), 'utf8');

    // Update settings
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES ('firestore_service_account_path', ?)`, [DEFAULT_KEY_PATH]);
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES ('firestore_project_id', ?)`, [parsed.project_id]);
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES ('firestore_client_email', ?)`, [parsed.client_email]);

    // Reset quota flag on new credentials
    this.quotaExceeded = false;
    this.quotaExceededUntil = null;

    // Re-initialize
    await this._setupApp(parsed);

    return {
      success: true,
      projectId: parsed.project_id,
      clientEmail: parsed.client_email
    };
  }

  /**
   * Resolves configured Organization details from settings.
   */
  async getOrganizationConfig() {
    const orgIdRow = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_org_id'`);
    const orgNameRow = await dbGet(`SELECT value FROM settings WHERE key = 'org_name'`);
    const firestoreOrgNameRow = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_org_name'`);
    const enabledRow = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_enabled'`);
    const autoSyncRow = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_auto_sync'`);
    const intervalRow = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_sync_interval'`);

    let orgId = (orgIdRow && orgIdRow.value ? orgIdRow.value.trim() : '').toUpperCase();
    if (!orgId) {
      orgId = 'ORG_DEFAULT';
    }

    const orgName = (firestoreOrgNameRow && firestoreOrgNameRow.value) ||
                    (orgNameRow && orgNameRow.value) ||
                    'General Organization';

    const enabled = !enabledRow || enabledRow.value !== '0';
    const autoSync = !autoSyncRow || autoSyncRow.value !== '0';
    const intervalSeconds = intervalRow ? parseInt(intervalRow.value, 10) : 60;

    return {
      orgId,
      orgName,
      enabled,
      autoSync,
      intervalSeconds: isNaN(intervalSeconds) ? 60 : Math.max(15, intervalSeconds)
    };
  }

  /**
   * Returns complete real-time status of Firebase Firestore connection & sync stats.
   */
  async getStatus() {
    if (this.isSyncing && this.syncStartTime && (Date.now() - this.syncStartTime > 120000)) {
      this.isSyncing = false;
      this.syncProgress.isSyncing = false;
      this.syncProgress.state = 'IDLE';
    }
    const orgConfig = await this.getOrganizationConfig();
    const stats = await getCloudSyncStats();
    const isConfigured = fs.existsSync(DEFAULT_KEY_PATH) && !!this.keyData;

    return {
      configured: isConfigured,
      online: this.isOnline,
      quotaExceeded: this.quotaExceeded,
      quotaExceededUntil: this.quotaExceededUntil,
      isSyncing: this.isSyncing,
      syncProgress: this.syncProgress,
      projectId: this.keyData?.project_id || null,
      clientEmail: this.keyData?.client_email || null,
      orgId: orgConfig.orgId,
      orgName: orgConfig.orgName,
      enabled: orgConfig.enabled,
      autoSync: orgConfig.autoSync,
      intervalSeconds: orgConfig.intervalSeconds,
      stats: {
        totalAttendance: stats.total_attendance || 0,
        syncedAttendance: stats.synced_attendance || 0,
        pendingAttendance: stats.pending_attendance || 0,
        lastCloudSyncedAt: stats.last_cloud_synced_at || this.lastSyncTime || null,
        totalEmployees: stats.total_employees || 0,
        syncedEmployees: stats.synced_employees || 0
      },
      lastError: this.lastError
    };
  }

  /**
   * Helper to format punch times for safe deterministic document IDs.
   * e.g. "2026-09-15 08:30:00" -> "20260915_083000"
   */
  _formatPunchKey(punchTimeStr) {
    if (!punchTimeStr) return '0';
    return String(punchTimeStr).replace(/[^0-9]/g, '_');
  }

  /**
   * Uploads un-synced attendance punch records from local SQLite to Firestore via REST API.
   * OFFLINE-FIRST: If connection fails or quota is full, records remain untouched in SQLite with synced_to_cloud = 0.
   */
  async syncPendingAttendance(options = {}) {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress', syncProgress: this.syncProgress };
    }

    await this.init();

    if (!this.keyData) {
      return { success: false, offline: true, error: 'Firebase is not configured' };
    }

    const orgConfig = await this.getOrganizationConfig();
    if (!orgConfig.enabled && !options.force) {
      return { success: false, message: 'Cloud sync is disabled in settings' };
    }

    // Check if within quota cooldown (unless force is requested)
    if (this.quotaExceeded && this.quotaExceededUntil && Date.now() < this.quotaExceededUntil && !options.force) {
      const waitMins = Math.ceil((this.quotaExceededUntil - Date.now()) / 60000);
      return {
        success: false,
        quotaExceeded: true,
        message: `Cloud sync paused (Daily Firestore quota reached: 20,000 writes/day). Will retry automatically in ${waitMins}m or click "Upload Pending Data Now". Local punches are 100% safe.`,
        syncProgress: this.syncProgress
      };
    }

    const orgId = (options.orgId || orgConfig.orgId || 'ORG_DEFAULT').trim().toUpperCase();
    const orgName = options.orgName || orgConfig.orgName || 'General Organization';
    // 50 records per batch provides rapid ~400ms REST commits and smooth UI updates
    const batchSize = Math.min(100, Math.max(20, options.limit || 50));

    this.isSyncing = true;
    this.syncStartTime = Date.now();
    let totalUploaded = 0;
    let batchesProcessed = 0;

    const initialStats = await getCloudSyncStats();
    const totalPendingCount = initialStats.pending_attendance || 0;
    const totalToUpload = options.limit ? Math.min(options.limit, totalPendingCount) : totalPendingCount;

    this.syncProgress = {
      isSyncing: true,
      state: 'SYNCING',
      uploadedCount: 0,
      totalPending: totalPendingCount,
      percent: 0,
      message: `Starting cloud upload to ${orgId}...`,
      currentBatch: 0,
      totalBatches: Math.ceil(totalToUpload / batchSize) || 1,
      updatedAt: new Date().toISOString()
    };
    this.notify('CLOUD_SYNC_STATUS', this.syncProgress);

    try {
      const projectId = this.keyData.project_id;

      while (true) {
        // 1. Fetch pending records from local SQLite
        const pending = await getUnsyncedAttendance(batchSize);
        if (!pending || pending.length === 0) {
          break; // All pending records have been uploaded
        }

        // 2. Prepare Firestore REST writes
        const writes = [];
        const syncedIds = [];
        const nowIso = new Date().toISOString();

        for (const rec of pending) {
          const rawUserId = String(rec.user_id || '').trim();
          const cleanUserId = rawUserId.replace(/[\x00-\x1F\x7F-\x9F\/]/g, '_').trim() || 'USER';
          const punchKey = this._formatPunchKey(rec.punch_time);
          const docId = `${orgId}_${cleanUserId}_${punchKey}`;

          const punchEpoch = Date.parse(rec.punch_time) || Date.now();
          const punchIso = new Date(punchEpoch).toISOString();
          const punchDate = rec.punch_time ? String(rec.punch_time).slice(0, 10) : punchIso.slice(0, 10);

          const payload = {
            id: docId,
            organizationId: orgId,
            organizationName: orgName,
            userId: cleanUserId,
            rawUserId: rawUserId,
            employeeName: rec.employee_name || '',
            department: rec.department || 'General',
            role: rec.role || 'Staff',
            serviceId: rec.employee_service_id || '',
            cardNo: rec.card_no || '',
            punchTime: rec.punch_time,
            punchIso,
            punchEpoch,
            punchDate,
            verifyMode: rec.verify_mode !== undefined ? rec.verify_mode : 15,
            verifyName: rec.verify_name || 'Biometric',
            punchState: rec.punch_state !== undefined ? rec.punch_state : 0,
            punchStateName: rec.punch_state_name || 'Punch',
            workCode: rec.work_code || 0,
            temperature: rec.temperature !== null ? rec.temperature : null,
            maskStatus: rec.mask_status !== null ? rec.mask_status : null,
            deviceIp: rec.device_ip || '192.168.10.15',
            deviceSn: rec.device_sn || '',
            source: rec.source || 'DIRECT_SYNC',
            syncedAt: nowIso
          };

          writes.push({
            update: {
              name: `projects/${projectId}/databases/(default)/documents/organizations/${orgId}/attendance/${docId}`,
              fields: toFirestoreFields(payload)
            }
          });
          syncedIds.push(rec.id);
        }

        // 3. Commit batch via direct Firestore REST API
        await this._commitRestWrites(writes);

        // 4. Mark local SQLite records as synced (only after cloud commit confirms)
        await markAttendanceCloudSynced(syncedIds);

        totalUploaded += syncedIds.length;
        batchesProcessed++;

        const percent = totalToUpload > 0 ? Math.min(100, Math.round((totalUploaded / totalToUpload) * 100)) : 100;
        this.syncProgress = {
          isSyncing: true,
          state: 'SYNCING',
          uploadedCount: totalUploaded,
          totalPending: Math.max(0, totalPendingCount - totalUploaded),
          percent,
          message: `Uploaded ${totalUploaded} of ${totalToUpload} punches (${percent}%)...`,
          currentBatch: batchesProcessed,
          totalBatches: Math.ceil(totalToUpload / batchSize) || 1,
          updatedAt: new Date().toISOString()
        };
        this.notify('CLOUD_SYNC_STATUS', this.syncProgress);

        // If batch was smaller than requested or per-call limit reached, break
        if (pending.length < batchSize || (options.limit && totalUploaded >= options.limit)) {
          break;
        }
      }

      // 5. Update Organization Document metadata once at end of sync run
      const nowIso = new Date().toISOString();
      try {
        const orgMetaWrite = [{
          update: {
            name: `projects/${projectId}/databases/(default)/documents/organizations/${orgId}`,
            fields: toFirestoreFields({
              organizationId: orgId,
              organizationName: orgName,
              lastSyncAt: nowIso,
              updatedAt: nowIso
            })
          }
        }];
        await this._commitRestWrites(orgMetaWrite).catch(() => {});
      } catch (e) {}

      this.isOnline = true;
      this.quotaExceeded = false;
      this.quotaExceededUntil = null;
      this.lastError = null;
      this.lastSyncTime = nowIso;

      this.syncProgress = {
        isSyncing: false,
        state: 'COMPLETED',
        uploadedCount: totalUploaded,
        totalPending: Math.max(0, totalPendingCount - totalUploaded),
        percent: 100,
        message: `Cloud sync complete: ${totalUploaded} punches uploaded to Firestore!`,
        currentBatch: batchesProcessed,
        totalBatches: batchesProcessed,
        updatedAt: new Date().toISOString()
      };
      this.notify('CLOUD_SYNC_STATUS', this.syncProgress);

      // Log success in sync_logs
      if (totalUploaded > 0) {
        await dbRun(`
          INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message)
          VALUES ('CLOUD_SYNC', 'SUCCESS', ?, ?, ?)
        `, [totalUploaded, totalUploaded, `Uploaded ${totalUploaded} attendance punches to Firestore for ${orgId}`]);
      }

      const remainingStats = await getCloudSyncStats();

      return {
        success: true,
        uploadedCount: totalUploaded,
        batchesProcessed,
        remainingPending: remainingStats.pending_attendance || 0,
        orgId,
        syncProgress: this.syncProgress
      };
    } catch (err) {
      // Intelligently handle Google Cloud Firestore Daily Quota Exceeded (429 RESOURCE_EXHAUSTED)
      if (err.code === 'QUOTA_EXHAUSTED' || err.statusCode === 429) {
        this.quotaExceeded = true;
        this.quotaExceededUntil = Date.now() + 15 * 60 * 1000;
        this.isOnline = true;
        this.lastError = 'Google Cloud Firestore daily write quota reached (Spark Free Plan limit: 20,000 writes/day). Local punches remain 100% safe in SQLite.';

        console.warn(`[FIREBASE] ${this.lastError}`);

        this.syncProgress = {
          isSyncing: false,
          state: 'QUOTA_EXHAUSTED',
          uploadedCount: totalUploaded,
          totalPending: totalPendingCount - totalUploaded,
          percent: 0,
          message: this.lastError,
          currentBatch: batchesProcessed,
          totalBatches: 0,
          updatedAt: new Date().toISOString()
        };
        this.notify('CLOUD_SYNC_STATUS', this.syncProgress);

        await dbRun(`
          INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message)
          VALUES ('CLOUD_SYNC', 'QUOTA_EXHAUSTED', 0, 0, ?)
        `, [this.lastError]);

        return {
          success: false,
          quotaExceeded: true,
          uploadedCount: totalUploaded,
          error: this.lastError,
          syncProgress: this.syncProgress
        };
      }

      // OFFLINE RESILIENCE: Catch error, leave records with synced_to_cloud = 0 in SQLite
      this.isOnline = false;
      this.lastError = err.message;
      console.warn(`[FIREBASE] Offline / Sync notice: ${err.message}. Local punches safely queued.`);

      this.syncProgress = {
        isSyncing: false,
        state: 'OFFLINE',
        uploadedCount: totalUploaded,
        totalPending: totalPendingCount - totalUploaded,
        percent: 0,
        message: `Cloud sync paused (${err.message}). Local punches safe.`,
        currentBatch: batchesProcessed,
        totalBatches: 0,
        updatedAt: new Date().toISOString()
      };
      this.notify('CLOUD_SYNC_STATUS', this.syncProgress);

      await dbRun(`
        INSERT INTO sync_logs (sync_type, status, records_synced, total_records, message)
        VALUES ('CLOUD_SYNC', 'OFFLINE', 0, 0, ?)
      `, [`Cloud sync paused (system offline or connection error: ${err.message})`]);

      return {
        success: false,
        offline: true,
        uploadedCount: totalUploaded,
        error: err.message,
        syncProgress: this.syncProgress
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Syncs employee registry to Firestore: organizations/{orgId}/employees/{userId} via REST API.
   * Supports forceAll option to push all local employees to newly configured organization partitions.
   */
  async syncEmployees(options = {}) {
    await this.init();

    if (!this.keyData) {
      return { success: false, offline: true, error: 'Firebase is not configured' };
    }

    const orgConfig = await this.getOrganizationConfig();
    const orgId = (options.orgId || orgConfig.orgId || 'ORG_DEFAULT').trim().toUpperCase();
    const orgName = options.orgName || orgConfig.orgName || 'General Organization';
    const forceAll = options.forceAll === true;

    try {
      const employees = forceAll
        ? await dbAll(`SELECT * FROM employees ORDER BY user_id ASC`)
        : await getUnsyncedEmployees(400);

      if (!employees || employees.length === 0) {
        return { success: true, count: 0, message: 'No pending employees to sync' };
      }

      const batchSize = 100;
      let totalSynced = 0;
      const projectId = this.keyData.project_id;
      const nowIso = new Date().toISOString();

      for (let i = 0; i < employees.length; i += batchSize) {
        const slice = employees.slice(i, i + batchSize);
        const writes = [];
        const syncedUserIds = [];

        for (const emp of slice) {
          const rawUserId = String(emp.user_id || '').trim();
          const cleanUserId = rawUserId.replace(/[\x00-\x1F\x7F\/]/g, '_').trim() || 'USER';

          const payload = {
            userId: cleanUserId,
            rawUserId: rawUserId,
            organizationId: orgId,
            organizationName: orgName,
            name: emp.name || '',
            department: emp.department || 'General',
            role: emp.role || 'Staff',
            employeeServiceId: emp.employee_service_id || '',
            cardNo: emp.card_no || '',
            email: emp.email || '',
            phone: emp.phone || '',
            nic: emp.nic || '',
            gender: emp.gender || '',
            birthday: emp.birthday || '',
            appointmentDate: emp.appointment_date || '',
            employmentStatus: emp.employment_status || 'Active',
            isActive: emp.is_active === 1,
            photoUrl: emp.photo || null,
            syncedAt: nowIso
          };

          writes.push({
            update: {
              name: `projects/${projectId}/databases/(default)/documents/organizations/${orgId}/employees/${cleanUserId}`,
              fields: toFirestoreFields(payload)
            }
          });
          syncedUserIds.push(emp.user_id);
        }

        await this._commitRestWrites(writes);
        await markEmployeesCloudSynced(syncedUserIds);
        totalSynced += syncedUserIds.length;
      }

      return {
        success: true,
        count: totalSynced,
        orgId
      };
    } catch (err) {
      console.warn(`[FIREBASE] Employee sync notice: ${err.message}`);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Resets cloud sync flags in local SQLite database so all records can be re-synced.
   * Useful when switching organization partitions or re-populating Firestore.
   */
  async resetCloudSync(scope = 'all') {
    if (scope === 'attendance' || scope === 'all') {
      await dbRun(`UPDATE attendance_records SET synced_to_cloud = 0, cloud_synced_at = NULL`);
    }
    if (scope === 'employees' || scope === 'all') {
      await dbRun(`UPDATE employees SET synced_to_cloud = 0, cloud_synced_at = NULL`);
    }
    // Also clear quota flag so a fresh attempt is permitted
    this.quotaExceeded = false;
    this.quotaExceededUntil = null;
    const stats = await getCloudSyncStats();
    return {
      success: true,
      message: `Reset cloud sync status for ${scope}. Records queued for cloud upload.`,
      stats
    };
  }
}

const firebaseService = new FirebaseService();

module.exports = {
  firebaseService,
  FirebaseService
};
