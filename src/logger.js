const fs = require('fs');
const path = require('path');
const config = require('./config');

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevelWeight = LOG_LEVELS[config.logLevel.toLowerCase()] ?? 1;

// In-memory ring buffer of recent logs for admin dashboard
const RING_BUFFER_CAPACITY = 150;
const ringBuffer = [];

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function getLogDateStr() {
  return new Date().toISOString().slice(0, 10);
}

// Log writer helper with safety
function writeToFile(filename, line) {
  try {
    const fullPath = path.join(config.logDir, filename);
    fs.appendFile(fullPath, line + '\n', (err) => {
      if (err) console.error('[LOGGER ERROR] Failed writing to log:', err.message);
    });
  } catch (err) {
    console.error('[LOGGER ERROR] Exception writing to log:', err.message);
  }
}

function log(level, tag, message, meta = null) {
  const levelWeight = LOG_LEVELS[level] ?? 1;
  if (levelWeight < currentLevelWeight) return;

  const timestamp = getTimestamp();
  const metaStr = meta ? (typeof meta === 'object' ? ' ' + JSON.stringify(meta) : ' ' + meta) : '';
  const logLine = `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}${metaStr}`;

  // Write to console with clean formatting
  if (level === 'error') {
    console.error(logLine);
  } else if (level === 'warn') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }

  // Push to in-memory buffer
  ringBuffer.push({
    timestamp,
    level,
    tag,
    message: message + metaStr
  });
  if (ringBuffer.length > RING_BUFFER_CAPACITY) {
    ringBuffer.shift();
  }

  // Write to daily logs
  const dateStr = getLogDateStr();
  writeToFile(`app_${dateStr}.log`, logLine);
  if (level === 'error' || level === 'warn') {
    writeToFile(`error_${dateStr}.log`, logLine);
  }
}

const logger = {
  debug: (tag, msg, meta) => log('debug', tag, msg, meta),
  info: (tag, msg, meta) => log('info', tag, msg, meta),
  warn: (tag, msg, meta) => log('warn', tag, msg, meta),
  error: (tag, msg, meta) => log('error', tag, msg, meta),
  getRecentLogs: (limit = 100) => {
    return ringBuffer.slice(-Math.min(limit, RING_BUFFER_CAPACITY));
  }
};

module.exports = logger;
