#!/usr/bin/env node
/**
 * SpeedFace Attendance System - License Key Generator CLI
 * 
 * Usage:
 *   node scripts/generate_license.js --org "National Institute of Fisheries and Nautical Engineering" --days 365 --out data/license.lic
 *   node scripts/generate_license.js --org "Test Client" --expiry "2026-10-05" --out test_expiring.lic
 *   node scripts/generate_license.js --org "Expired Client" --expiry "2026-01-01" --out test_expired.lic
 *   node scripts/generate_license.js --new-keys
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Master private key matching the public key in src/licenseKeys.js
const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIAda0lqXlysdRdUVs0ibKeHlAyQqFqeqPSfwqi4lA5ru
-----END PRIVATE KEY-----`;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    org: 'National Institute of Fisheries and Nautical Engineering',
    issuedTo: 'Head Office',
    days: 365,
    expiry: null,
    licenseId: null,
    licenseType: 'Commercial',
    features: ['ALL_MODULES', 'SPEEDFACE_ADMS', 'EXPORTS', 'DEVICE_AUDIT', 'CLOUD_SYNC'],
    output: null,
    privKey: null,
    newKeys: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--org' || arg === '-o') {
      options.org = args[++i];
    } else if (arg === '--to') {
      options.issuedTo = args[++i];
    } else if (arg === '--days' || arg === '-d') {
      options.days = parseInt(args[++i], 10);
    } else if (arg === '--expiry' || arg === '-e') {
      options.expiry = args[++i];
    } else if (arg === '--id') {
      options.licenseId = args[++i];
    } else if (arg === '--type') {
      options.licenseType = args[++i];
    } else if (arg === '--out') {
      options.output = args[++i];
    } else if (arg === '--key') {
      options.privKey = args[++i];
    } else if (arg === '--new-keys') {
      options.newKeys = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
SpeedFace License Generator CLI
================================
Options:
  --org, -o <name>      Organization name (default: "National Institute of Fisheries and Nautical Engineering")
  --to <name>           Recipient / branch (default: "Head Office")
  --days, -d <number>   Validity in days from now (default: 365)
  --expiry, -e <date>   Specific expiration date (YYYY-MM-DD or ISO string)
  --id <licenseId>      Unique license identifier (default: auto-generated)
  --type <type>         License type: Commercial, Trial, Enterprise (default: Commercial)
  --out <filepath>      Destination file path (e.g. data/license.lic)
  --key <filepath>      Path to custom Ed25519 private key PEM file
  --new-keys            Generate a brand new Ed25519 keypair for rotation
  --help, -h            Show this help message
`);
}

function canonicalize(payload) {
  const { signature, ...rest } = payload;
  const sortedKeys = Object.keys(rest).sort();
  const canonicalObj = {};
  for (const k of sortedKeys) {
    canonicalObj[k] = rest[k];
  }
  return JSON.stringify(canonicalObj);
}

function main() {
  const options = parseArgs();

  if (options.newKeys) {
    console.log('Generating new Ed25519 Keypair...\n');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    console.log('--- PUBLIC KEY (Place in src/licenseKeys.js) ---');
    console.log(pubPem);
    console.log('--- PRIVATE KEY (Keep secret for generating licenses) ---');
    console.log(privPem);
    return;
  }

  let privateKeyPem = DEFAULT_PRIVATE_KEY;
  if (options.privKey) {
    privateKeyPem = fs.readFileSync(path.resolve(options.privKey), 'utf8');
  }

  const now = new Date();
  let expiryDate;
  if (options.expiry) {
    // If date string like '2026-12-31', set to 23:59:59 UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(options.expiry)) {
      expiryDate = new Date(`${options.expiry}T23:59:59.999Z`);
    } else {
      expiryDate = new Date(options.expiry);
    }
  } else {
    expiryDate = new Date(now.getTime() + options.days * 24 * 60 * 60 * 1000);
  }

  if (isNaN(expiryDate.getTime())) {
    console.error('Error: Invalid expiration date provided.');
    process.exit(1);
  }

  const licenseId = options.licenseId || `LIC-${now.getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const payload = {
    licenseVersion: '1.0',
    licenseId: licenseId,
    organization: options.org,
    issuedTo: options.issuedTo,
    licenseType: options.licenseType,
    features: options.features,
    issuedAt: now.toISOString(),
    expiresAt: expiryDate.toISOString()
  };

  const canonicalStr = canonicalize(payload);
  const signature = crypto.sign(null, Buffer.from(canonicalStr, 'utf8'), privateKeyPem).toString('base64');

  const fullLicense = {
    ...payload,
    signature
  };

  const licenseContent = JSON.stringify(fullLicense, null, 2);

  if (options.output) {
    const outPath = path.resolve(options.output);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outPath, licenseContent, 'utf8');
    console.log(`\x1b[32m✔ License successfully generated and saved to:\x1b[0m ${outPath}`);
  } else {
    console.log(licenseContent);
  }

  console.log('\n--- License Summary ---');
  console.log(`License ID:   ${fullLicense.licenseId}`);
  console.log(`Organization: ${fullLicense.organization}`);
  console.log(`Type:         ${fullLicense.licenseType}`);
  console.log(`Issued At:    ${fullLicense.issuedAt}`);
  console.log(`Expires At:   ${fullLicense.expiresAt}`);
  const remainingDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`Remaining:    ${remainingDays} days`);
  console.log('-----------------------\n');
}

main();
