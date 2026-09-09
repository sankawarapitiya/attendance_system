const path = require('path');
const fs = require('fs');

// Load environment variables if .env exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    } else {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[CONFIG] Notice loading .env file:', err.message);
  }
}

const config = {
  port: parseInt(process.env.PORT || '8088', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'production',
  isProduction: (process.env.NODE_ENV === 'production'),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // SpeedFace Terminal defaults
  deviceIp: process.env.DEVICE_IP || '192.168.10.15',
  devicePort: parseInt(process.env.DEVICE_PORT || '4370', 10),
  autoSyncInterval: parseInt(process.env.AUTO_SYNC_INTERVAL || '60', 10),

  // Database and Backups
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || 'data/attendance.db'),
  backupDir: path.resolve(__dirname, '..', process.env.BACKUP_DIR || 'data/backups'),
  backupIntervalHours: parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10),
  maxBackups: parseInt(process.env.MAX_BACKUPS || '14', 10),

  // Logging
  logDir: path.resolve(__dirname, '..', process.env.LOG_DIR || 'logs'),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Rate Limiting
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10)
};

// Ensure critical directories exist
[
  path.dirname(config.dbPath),
  config.backupDir,
  config.logDir
].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

module.exports = config;
