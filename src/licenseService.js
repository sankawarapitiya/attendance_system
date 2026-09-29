const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LICENSE_PUBLIC_KEY } = require('./licenseKeys');
const { dbGet, dbRun } = require('./db');
const logger = require('./logger');

const LICENSE_FILE_PATH = path.join(__dirname, '..', 'data', 'license.lic');

let cachedLicense = null;
let cachedRawContent = null;

/**
 * Normalizes payload keys in sorted alphabetical order (excluding signature)
 * to ensure deterministic signature verification across platforms.
 */
function canonicalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const { signature, ...rest } = payload;
  const sortedKeys = Object.keys(rest).sort();
  const canonicalObj = {};
  for (const k of sortedKeys) {
    canonicalObj[k] = rest[k];
  }
  return JSON.stringify(canonicalObj);
}

/**
 * Parses and verifies a license object or raw string against the embedded public key.
 */
function verifyLicensePayload(input) {
  let parsed = null;
  let rawStr = '';

  if (typeof input === 'string') {
    rawStr = input.trim();
    // Support base64 wrapped json or raw json
    try {
      if (rawStr.startsWith('{')) {
        parsed = JSON.parse(rawStr);
      } else {
        const decoded = Buffer.from(rawStr, 'base64').toString('utf8');
        parsed = JSON.parse(decoded);
      }
    } catch (parseErr) {
      return {
        valid: false,
        status: 'INVALID',
        error: 'PARSE_ERROR',
        message: 'License file format is unreadable or malformed.'
      };
    }
  } else if (typeof input === 'object' && input !== null) {
    parsed = input;
    rawStr = JSON.stringify(input, null, 2);
  } else {
    return {
      valid: false,
      status: 'INVALID',
      error: 'EMPTY_INPUT',
      message: 'No license content provided.'
    };
  }

  // Check required fields
  const required = ['licenseVersion', 'licenseId', 'organization', 'expiresAt', 'signature'];
  for (const req of required) {
    if (!parsed[req]) {
      return {
        valid: false,
        status: 'INVALID',
        error: 'MISSING_FIELDS',
        message: `License is missing required field: ${req}`
      };
    }
  }

  // 1. Verify Ed25519 Cryptographic Signature
  try {
    const canonicalStr = canonicalizePayload(parsed);
    const signatureBuffer = Buffer.from(parsed.signature, 'base64');
    const isSignatureValid = crypto.verify(
      null,
      Buffer.from(canonicalStr, 'utf8'),
      LICENSE_PUBLIC_KEY,
      signatureBuffer
    );

    if (!isSignatureValid) {
      return {
        valid: false,
        status: 'INVALID',
        error: 'SIGNATURE_INVALID',
        message: 'Cryptographic signature is invalid. The license file has been altered or tampered with.'
      };
    }
  } catch (sigErr) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'VERIFICATION_ERROR',
      message: `Signature verification failed: ${sigErr.message}`
    };
  }

  // 2. Validate Expiration & Date logic
  const expiryDate = new Date(parsed.expiresAt);
  if (isNaN(expiryDate.getTime())) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'INVALID_EXPIRY',
      message: 'License contains an invalid expiration date.'
    };
  }

  const now = new Date();
  const issuedDate = parsed.issuedAt ? new Date(parsed.issuedAt) : null;

  // Clock rollback detection: current time significantly before issuance
  if (issuedDate && !isNaN(issuedDate.getTime())) {
    if (now.getTime() < issuedDate.getTime() - (24 * 60 * 60 * 1000)) {
      return {
        valid: false,
        status: 'INVALID',
        error: 'CLOCK_TAMPER',
        message: 'System clock is set prior to license issue date. Please synchronize the system clock.'
      };
    }
  }

  const diffMs = expiryDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return {
      valid: false,
      status: 'EXPIRED',
      error: 'LICENSE_EXPIRED',
      message: `Application license expired on ${expiryDate.toLocaleDateString()}. Renewal required.`,
      organization: parsed.organization,
      issuedTo: parsed.issuedTo || 'Head Office',
      licenseId: parsed.licenseId,
      licenseType: parsed.licenseType || 'Commercial',
      expiresAt: parsed.expiresAt,
      daysRemaining: 0,
      raw: parsed
    };
  }

  const isExpiringSoon = daysRemaining <= 14;

  return {
    valid: true,
    status: isExpiringSoon ? 'EXPIRING_SOON' : 'ACTIVE',
    organization: parsed.organization,
    issuedTo: parsed.issuedTo || 'Head Office',
    licenseId: parsed.licenseId,
    licenseType: parsed.licenseType || 'Commercial',
    issuedAt: parsed.issuedAt,
    expiresAt: parsed.expiresAt,
    daysRemaining,
    features: parsed.features || ['ALL_MODULES'],
    raw: parsed
  };
}

/**
 * Initializes and loads the installed license from disk or SQLite settings.
 */
async function initLicense() {
  try {
    // 1. Try reading from data/license.lic
    if (fs.existsSync(LICENSE_FILE_PATH)) {
      const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf8');
      const verified = verifyLicensePayload(content);
      if (verified.status !== 'INVALID') {
        cachedLicense = verified.raw;
        cachedRawContent = content;
        logger.info('LICENSE', `Loaded license: ${verified.organization} (${verified.status}, ${verified.daysRemaining || 0} days remaining)`);
        return getLicenseStatus();
      } else {
        logger.warn('LICENSE', `Installed license file is invalid: ${verified.message}`);
      }
    }

    // 2. Fallback to DB settings table
    const dbRow = await dbGet(`SELECT value FROM settings WHERE key = 'app_license'`);
    if (dbRow && dbRow.value) {
      const verified = verifyLicensePayload(dbRow.value);
      if (verified.status !== 'INVALID') {
        cachedLicense = verified.raw;
        cachedRawContent = dbRow.value;
        // Save to data/license.lic for consistency
        try {
          const dir = path.dirname(LICENSE_FILE_PATH);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(LICENSE_FILE_PATH, dbRow.value, 'utf8');
        } catch (fErr) {}
        logger.info('LICENSE', `Restored license from database: ${verified.organization} (${verified.status})`);
        return getLicenseStatus();
      }
    }

    logger.warn('LICENSE', 'No valid application license installed. Activation required.');
  } catch (err) {
    logger.error('LICENSE', `Error initializing license: ${err.message}`);
  }

  return getLicenseStatus();
}

/**
 * Returns current license status evaluated dynamically against current time.
 */
function getLicenseStatus() {
  if (!cachedLicense) {
    return {
      valid: false,
      status: 'MISSING',
      error: 'LICENSE_MISSING',
      message: 'No license key installed. Please upload a valid license file to activate the system.',
      organization: null,
      expiresAt: null,
      daysRemaining: 0
    };
  }

  const result = verifyLicensePayload(cachedLicense);
  return {
    valid: result.valid,
    status: result.status,
    error: result.error || null,
    message: result.message || 'License is valid and active.',
    organization: result.organization || cachedLicense.organization,
    issuedTo: result.issuedTo || cachedLicense.issuedTo,
    licenseId: result.licenseId || cachedLicense.licenseId,
    licenseType: result.licenseType || cachedLicense.licenseType,
    issuedAt: result.issuedAt || cachedLicense.issuedAt,
    expiresAt: result.expiresAt || cachedLicense.expiresAt,
    daysRemaining: result.daysRemaining !== undefined ? result.daysRemaining : 0,
    features: result.features || cachedLicense.features || ['ALL_MODULES']
  };
}

/**
 * Installs and persists a newly uploaded license key.
 */
async function installLicense(inputContent) {
  const verified = verifyLicensePayload(inputContent);

  if (verified.status === 'INVALID') {
    return {
      success: false,
      error: verified.error,
      message: verified.message || 'The uploaded file is not a valid signed license.'
    };
  }

  if (verified.status === 'EXPIRED') {
    return {
      success: false,
      error: 'LICENSE_EXPIRED',
      message: `The uploaded license has already expired (${new Date(verified.expiresAt).toLocaleDateString()}). Please provide an active license.`
    };
  }

  const rawJson = typeof inputContent === 'string' && inputContent.trim().startsWith('{')
    ? inputContent.trim()
    : JSON.stringify(verified.raw, null, 2);

  // Persist to file
  try {
    const dir = path.dirname(LICENSE_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LICENSE_FILE_PATH, rawJson, 'utf8');
  } catch (fErr) {
    logger.error('LICENSE', `Failed to write license file: ${fErr.message}`);
    return {
      success: false,
      error: 'FILE_WRITE_ERROR',
      message: `Failed to save license file: ${fErr.message}`
    };
  }

  // Persist to SQLite settings
  try {
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES ('app_license', ?)`, [rawJson]);
  } catch (dbErr) {
    logger.warn('LICENSE', `Failed to store license in settings table: ${dbErr.message}`);
  }

  cachedLicense = verified.raw;
  cachedRawContent = rawJson;

  logger.info('LICENSE', `Successfully activated license for ${verified.organization} (Expires: ${verified.expiresAt})`);

  return {
    success: true,
    message: `License successfully activated for ${verified.organization}.`,
    license: getLicenseStatus()
  };
}

/**
 * Resets/removes the installed license (diagnostic/testing).
 */
async function removeLicense() {
  try {
    if (fs.existsSync(LICENSE_FILE_PATH)) {
      fs.unlinkSync(LICENSE_FILE_PATH);
    }
  } catch (e) {}

  try {
    await dbRun(`DELETE FROM settings WHERE key = 'app_license'`);
  } catch (e) {}

  cachedLicense = null;
  cachedRawContent = null;
  logger.warn('LICENSE', 'Application license was removed.');

  return {
    success: true,
    message: 'License removed. Application is now locked pending activation.',
    license: getLicenseStatus()
  };
}

module.exports = {
  LICENSE_FILE_PATH,
  verifyLicensePayload,
  initLicense,
  getLicenseStatus,
  installLicense,
  removeLicense
};
