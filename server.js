const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const cors = require('cors');
const compression = require('compression');

const config = require('./src/config');
const logger = require('./src/logger');
const { initDatabase, initBackupScheduler, closeDatabase, dbGet } = require('./src/db');
const { setupAdmsRoutes, setWebSocketBroadcast } = require('./src/admsServer');
const { syncFromDevice, startAutoSync, stopAutoSync, setSyncWsBroadcast } = require('./src/syncService');
const apiRoutes = require('./src/apiRoutes');

const app = express();
const server = http.createServer(app);

// 1. Security Headers & Server Identification
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 2. HTTP Response Compression (Gzip / Deflate)
app.use(compression({
  threshold: 1024, // Compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// 3. CORS Configuration
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 4. In-Memory API Rate Limiter
// Note: Hardware terminal ADMS push (/iclock/*) and health checks are strictly EXEMPT.
const rateLimitMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.startTime > config.rateLimitWindowMs) {
      rateLimitMap.delete(ip);
    }
  }
}, 300000); // Clean up every 5 minutes

function rateLimiter(req, res, next) {
  // 1. Terminal ADMS push (/iclock/*) and health checks are strictly exempt
  if (req.path.startsWith('/iclock') || req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

  // 2. Loopback / local host access is exempt from rate limiting to prevent self-lockout
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') {
    return next();
  }

  const now = Date.now();
  let record = rateLimitMap.get(ip);

  if (!record || (now - record.startTime) > config.rateLimitWindowMs) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    res.setHeader('X-RateLimit-Limit', config.rateLimitMax);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.rateLimitMax - 1));
  } else {
    record.count++;
    const remaining = Math.max(0, config.rateLimitMax - record.count);
    res.setHeader('X-RateLimit-Limit', config.rateLimitMax);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (record.count > config.rateLimitMax) {
      const retryAfterSec = Math.ceil((config.rateLimitWindowMs - (now - record.startTime)) / 1000);
      res.setHeader('Retry-After', Math.max(1, retryAfterSec));
      logger.warn('RATE_LIMIT', `Rate limit exceeded for IP: ${ip} on ${req.method} ${req.path}`);
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please slow down and try again shortly.'
      });
    }
  }
  next();
}

app.use('/api', rateLimiter);

// 5. Body Parsing Middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// 6. Structured Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/iclock')) {
      logger.debug('ADMS', `${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    } else if (req.path.startsWith('/api') || req.path === '/health') {
      logger.info('HTTP', `${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// 7. SpeedFace ADMS Push Endpoints
setupAdmsRoutes(app);

// 8. Application API Routes
app.use('/api', apiRoutes);

// 9. Health & System Metrics Endpoint
app.get(['/health', '/api/health'], async (req, res) => {
  try {
    const uptimeSec = Math.floor(process.uptime());
    const d = Math.floor(uptimeSec / 86400);
    const h = Math.floor((uptimeSec % 86400) / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const s = uptimeSec % 60;
    const uptimeFormatted = `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;

    const mem = process.memoryUsage();
    let attCount = 0;
    let empCount = 0;
    try {
      const attRow = await dbGet('SELECT COUNT(*) as count FROM attendance_records');
      const empRow = await dbGet('SELECT COUNT(*) as count FROM employees');
      attCount = attRow?.count || 0;
      empCount = empRow?.count || 0;
    } catch (dbE) {}

    let dbSizeBytes = 0;
    try {
      if (fs.existsSync(config.dbPath)) {
        dbSizeBytes = fs.statSync(config.dbPath).size;
      }
    } catch (sE) {}

    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: uptimeFormatted,
      uptimeSeconds: uptimeSec,
      environment: config.nodeEnv,
      nodeVersion: process.version,
      memory: {
        rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10
      },
      database: {
        status: 'CONNECTED',
        sizeMb: Math.round((dbSizeBytes / 1024 / 1024) * 100) / 100,
        attendanceCount: attCount,
        employeeCount: empCount
      },
      speedFace: {
        configuredIp: config.deviceIp,
        configuredPort: config.devicePort
      },
      webSocket: {
        activeClients: wss.clients.size
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// 10. Static Frontend Files with ETag & Revalidation (Prevent Stale Browser Caching)
const staticOptions = {
  maxAge: 0,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
};
app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// 11. SPA Routing Fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/iclock') || req.path.startsWith('/health')) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 12. WebSocket Server with Heartbeat / Ping-Pong
const wss = new WebSocket.Server({ server, path: '/ws' });

function broadcastToClients(messageObj) {
  const jsonStr = JSON.stringify(messageObj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  });
}

// Hook broadcast into ADMS and Sync Service
setWebSocketBroadcast(broadcastToClients);
setSyncWsBroadcast(broadcastToClients);

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  logger.info('WS', `Client connected from ${req.socket.remoteAddress}`);
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Live Attendance Monitor Connected' }));
});

// Terminate dead WebSocket connections every 30 seconds
const wsPingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// 13. Graceful Shutdown Management
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn('SYSTEM', `Received ${signal}. Initiating graceful application shutdown...`);

  // Stop background timers
  stopAutoSync();
  clearInterval(wsPingInterval);

  // Close WebSocket server
  wss.clients.forEach((client) => {
    try {
      client.close(1001, 'Server shutting down');
    } catch (e) {}
  });

  // Close HTTP server with 5-second timeout
  const forceExitTimeout = setTimeout(() => {
    logger.error('SYSTEM', 'Shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 5000);

  server.close(async () => {
    clearTimeout(forceExitTimeout);
    logger.info('SYSTEM', 'HTTP and WebSocket servers successfully closed.');

    // Checkpoint SQLite WAL and close database connection
    try {
      await closeDatabase();
    } catch (dbErr) {
      logger.error('SYSTEM', `Error closing database: ${dbErr.message}`);
    }

    logger.info('SYSTEM', 'Graceful shutdown complete. Exiting cleanly.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('CRASH', `Uncaught Exception: ${err.message}`, err.stack);
});

process.on('unhandledRejection', (reason) => {
  logger.error('CRASH', 'Unhandled Promise Rejection', reason);
});

// 14. Server Start Routine
async function start() {
  try {
    // 1. Initialize SQLite Database & WAL Mode
    await initDatabase();

    // 2. Initialize Automated Rolling Database Backup Scheduler
    initBackupScheduler();

    // 3. Initialize Firebase Firestore Cloud Service
    const { firebaseService } = require('./src/firebaseService');
    await firebaseService.init();

    // 4. Start HTTP Listener
    server.listen(config.port, config.host, () => {
      logger.info('SYSTEM', '================================================================');
      logger.info('SYSTEM', ` SpeedFace-V5L Attendance Management System (PRODUCTION)`);
      logger.info('SYSTEM', ` Web Dashboard:  http://localhost:${config.port}`);
      logger.info('SYSTEM', ` Health Metrics: http://localhost:${config.port}/health`);
      logger.info('SYSTEM', ` ADMS Server:    http://${config.host}:${config.port}/iclock/cdata`);
      logger.info('SYSTEM', ` Target Device:  ${config.deviceIp}:${config.devicePort}`);
      logger.info('SYSTEM', '================================================================');

      // Schedule background sync
      startAutoSync(config.autoSyncInterval, async () => {
        const ipRow = await dbGet(`SELECT value FROM settings WHERE key = 'device_ip'`);
        const portRow = await dbGet(`SELECT value FROM settings WHERE key = 'device_port'`);
        const enabledRow = await dbGet(`SELECT value FROM settings WHERE key = 'auto_sync_enabled'`);
        return {
          device_ip: ipRow ? ipRow.value : config.deviceIp,
          device_port: portRow ? portRow.value : String(config.devicePort),
          auto_sync_enabled: enabledRow ? enabledRow.value : 'true'
        };
      });

      // Initial device connectivity check
      setTimeout(async () => {
        logger.info('INIT', `Verifying initial connection with SpeedFace at ${config.deviceIp}:${config.devicePort}...`);
        try {
          await syncFromDevice(config.deviceIp, config.devicePort);
        } catch (err) {
          logger.warn('INIT', `Initial sync notice: ${err.message}`);
        }
      }, 1500);
    });
  } catch (err) {
    logger.error('CRASH', `Fatal initialization error: ${err.message}`, err.stack);
    process.exit(1);
  }
}

start();
