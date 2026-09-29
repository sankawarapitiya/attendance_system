const { getLicenseStatus } = require('./licenseService');

/**
 * Express middleware to enforce license activation across API routes.
 * Exempts license activation endpoints, health probes, and physical terminal pushes.
 */
function requireValidLicense(req, res, next) {
  // Routes permanently exempt from licensing lockouts
  const exemptPaths = [
    '/license/status',
    '/license/upload',
    '/license/activate',
    '/health',
    '/api/health'
  ];

  // In express router mounted on /api, req.path is relative to /api (e.g. /license/status)
  // Check both req.path and req.originalUrl
  const path = req.path || '';
  const originalUrl = req.originalUrl || '';

  if (
    exemptPaths.some(p => path === p || path.startsWith(p + '/')) ||
    originalUrl.startsWith('/iclock') ||
    originalUrl.startsWith('/api/license') ||
    originalUrl === '/health' ||
    originalUrl === '/api/health'
  ) {
    return next();
  }

  const status = getLicenseStatus();

  if (status.valid) {
    return next();
  }

  // Intercept unauthorized requests with 403 Forbidden
  return res.status(403).json({
    success: false,
    licenseRequired: true,
    code: status.status === 'EXPIRED' ? 'LICENSE_EXPIRED' : 'LICENSE_REQUIRED',
    status: status.status,
    message: status.message || 'Valid application license key required to perform this action.',
    organization: status.organization,
    expiresAt: status.expiresAt
  });
}

module.exports = {
  requireValidLicense
};
