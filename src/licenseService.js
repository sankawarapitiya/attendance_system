const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { dbGet, dbRun } = require('./db');

// Secret salt used for HMAC-SHA256 signature verification.
// Can be customized via environment variable LICENSE_SECRET
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'SPEEDFACE_V5L_ATTENDANCE_ENTERPRISE_HMAC_SECRET_SECURE_SALT_2026';

const LICENSE_HEADER = '-----BEGIN SPEEDFACE LICENSE-----';
const LICENSE_FOOTER = '-----END SPEEDFACE LICENSE-----';

/**
 * Calculates cryptographic HMAC-SHA256 signature for license payload
 */
function signPayload(payload) {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHmac('sha256', LICENSE_SECRET).update(normalized).digest('hex');
}

/**
 * Encodes payload and signature into an armored license string
 */
function encodeLicense(payload, signature) {
  const container = {
    version: '1.0',
    payload,
    signature
  };
  const b64 = Buffer.from(JSON.stringify(container), 'utf8').toString('base64');
  // Format into 64-character lines
  const formatted = b64.match(/.{1,64}/g).join('\n');
  return `${LICENSE_HEADER}\n${formatted}\n${LICENSE_FOOTER}`;
}

/**
 * Decodes an armored or raw license string/file content
 */
function decodeLicense(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('License content is empty or invalid');
  }

  let cleaned = rawContent.trim();
  // Strip armored header/footer if present
  if (cleaned.includes(LICENSE_HEADER)) {
    cleaned = cleaned
      .replace(LICENSE_HEADER, '')
      .replace(LICENSE_FOOTER, '')
      .replace(/\s+/g, '');
  }

  // Try JSON first (in case it was uploaded as raw JSON)
  try {
    const directJson = JSON.parse(rawContent);
    if (directJson.payload && directJson.signature) {
      return directJson;
    }
  } catch (e) {}

  // Decode from base64
  try {
    const jsonStr = Buffer.from(cleaned, 'base64').toString('utf8');
    const container = JSON.parse(jsonStr);
    if (!container.payload || !container.signature) {
      throw new Error('Malformed license structure: missing payload or signature');
    }
    return container;
  } catch (e) {
    throw new Error('Failed to decode license file: invalid format or encoding');
  }
}

/**
 * Generates a new cryptographically signed license
 */
function generateLicense(options = {}) {
  const now = new Date();
  const orgId = (options.orgId || 'DSOFFICE_LUNUGAMWEHERA').trim().toUpperCase();
  const orgName = options.orgName || 'Divisional Secretariat Office Lunugamwehera';
  const plan = options.plan || 'Enterprise Edition';
  const maxEmployees = parseInt(options.maxEmployees, 10) || 5000;
  const maxDevices = parseInt(options.maxDevices, 10) || 20;

  let validFrom = options.validFrom ? String(options.validFrom).slice(0, 10) : now.toISOString().slice(0, 10);
  let validUntil = '';
  let durationDays = parseInt(options.durationDays, 10) || 0;

  if (options.validUntil) {
    validUntil = String(options.validUntil).slice(0, 10);
    const startMs = new Date(validFrom + 'T00:00:00Z').getTime();
    const endMs = new Date(validUntil + 'T23:59:59Z').getTime();
    durationDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  } else {
    // Calculate validUntil based on durationDays or preset
    const daysToAdd = durationDays > 0 ? durationDays : 365;
    const endDate = new Date(new Date(validFrom + 'T00:00:00Z').getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    validUntil = endDate.toISOString().slice(0, 10);
    durationDays = daysToAdd;
  }

  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const licenseId = `LIC-${now.getFullYear()}-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}`;

  const payload = {
    licenseId,
    orgId,
    orgName,
    plan,
    issuedAt: now.toISOString(),
    validFrom,
    validUntil,
    durationDays,
    maxEmployees,
    maxDevices,
    features: [
      'multi_organization_partitioning',
      'cloud_firestore_sync',
      'biometric_direct_sync',
      'adms_cloud_push',
      'role_based_access_control',
      'timesheet_pdf_export',
      'shifts_holidays_schedule'
    ]
  };

  const signature = signPayload(payload);
  const licenseString = encodeLicense(payload, signature);

  return {
    licenseId,
    payload,
    signature,
    licenseString,
    filename: `license_${orgId.toLowerCase()}_${validUntil}.lic`
  };
}

/**
 * Validates a license container against current time and organization
 */
function verifyLicense(rawContent, targetOrgId = null) {
  try {
    const container = decodeLicense(rawContent);
    const { payload, signature } = container;

    // 1. Verify HMAC Signature integrity
    const expectedSig = signPayload(payload);
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return {
        valid: false,
        status: 'TAMPERED',
        error: 'Digital signature verification failed. License file has been modified or corrupted.',
        payload: null
      };
    }

    // 2. Validate Dates
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const validUntilDate = new Date(payload.validUntil + 'T23:59:59Z');
    const validFromDate = new Date(payload.validFrom + 'T00:00:00Z');

    if (now < validFromDate) {
      return {
        valid: false,
        status: 'NOT_YET_ACTIVE',
        error: `License is not active yet. Valid starting from ${payload.validFrom}.`,
        payload,
        remainingDays: Math.ceil((validUntilDate - now) / (1000 * 60 * 60 * 24))
      };
    }

    const diffMs = validUntilDate.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const totalDays = payload.durationDays || Math.max(1, Math.ceil((validUntilDate - validFromDate) / (1000 * 60 * 60 * 24)));
    const percentRemaining = Math.max(0, Math.min(100, Math.round((remainingDays / totalDays) * 100)));

    if (diffMs <= 0) {
      return {
        valid: false,
        status: 'EXPIRED',
        error: `License has expired on ${payload.validUntil}. Please renew your license to reactivate system.`,
        payload,
        remainingDays: 0,
        totalDays,
        percentRemaining: 0
      };
    }

    // 3. Check Organization Partition (if specified)
    if (targetOrgId) {
      const cleanTarget = String(targetOrgId).trim().toUpperCase();
      const licOrg = String(payload.orgId || '').trim().toUpperCase();
      if (licOrg !== '*' && licOrg !== 'ALL' && licOrg !== cleanTarget) {
        return {
          valid: false,
          status: 'ORG_MISMATCH',
          error: `License is issued for organization "${licOrg}", but current active partition is "${cleanTarget}".`,
          payload,
          remainingDays
        };
      }
    }

    const status = remainingDays <= 14 ? 'EXPIRING_SOON' : 'ACTIVE';

    return {
      valid: true,
      status,
      remainingDays,
      totalDays,
      percentRemaining,
      payload,
      message: `License is active. ${remainingDays} days remaining (Expires: ${payload.validUntil}).`
    };
  } catch (err) {
    return {
      valid: false,
      status: 'INVALID',
      error: err.message,
      payload: null
    };
  }
}

/**
 * Gets currently active system license from SQLite database
 */
async function getStoredLicenseStatus(targetOrgId = null) {
  try {
    const row = await dbGet(`SELECT value FROM settings WHERE key = 'system_license_data'`);
    if (!row || !row.value) {
      // Auto-generate an initial 30-day starter evaluation license if none exists
      const orgRow = await dbGet(`SELECT value FROM settings WHERE key = 'firestore_org_id'`);
      const defaultOrg = orgRow ? orgRow.value : 'DSOFFICE_LUNUGAMWEHERA';
      const initial = generateLicense({
        orgId: defaultOrg,
        orgName: 'DS Office Lunugamwehera',
        plan: 'Evaluation Starter License',
        durationDays: 30
      });

      await dbRun(`
        INSERT OR REPLACE INTO settings (key, value) VALUES ('system_license_data', ?)
      `, [initial.licenseString]);

      return verifyLicense(initial.licenseString, targetOrgId || defaultOrg);
    }

    return verifyLicense(row.value, targetOrgId);
  } catch (err) {
    return {
      valid: false,
      status: 'ERROR',
      error: err.message,
      remainingDays: 0
    };
  }
}

/**
 * Activates a license by validating it and storing it in SQLite
 */
async function activateLicense(licenseContent, targetOrgId = null) {
  const check = verifyLicense(licenseContent, targetOrgId);
  if (!check.valid) {
    return {
      success: false,
      error: check.error || 'License activation failed',
      details: check
    };
  }

  // Save into database
  await dbRun(`
    INSERT OR REPLACE INTO settings (key, value) VALUES ('system_license_data', ?)
  `, [licenseContent.trim()]);

  await dbRun(`
    INSERT OR REPLACE INTO settings (key, value) VALUES ('system_license_status', ?)
  `, [check.status]);

  return {
    success: true,
    message: `System activated successfully! ${check.remainingDays} days remaining (Valid until ${check.payload.validUntil}).`,
    license: check
  };
}

module.exports = {
  generateLicense,
  verifyLicense,
  getStoredLicenseStatus,
  activateLicense,
  encodeLicense,
  decodeLicense
};
