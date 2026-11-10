const { getSystemUserByUid } = require('../db');
const logger = require('../logger');

/**
 * Tenant-Level Role-Based Access Control (RBAC) Middleware Suite
 * 
 * Roles:
 * - super_admin: Master administrator across all tenant partitions.
 * - admin: Tenant Administrator strictly bound to their own partition.
 * - manager: Tenant Attendance / HR Manager (reports, roll call, leave approvals).
 * - staff: Self-service employee (own timesheets, leave submissions).
 */

/**
 * Parses Bearer token or session and attaches authenticated user
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No Authorization header provided.'
      });
    }

    const tokenStr = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!tokenStr) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Authorization header format. Expected "Bearer <token>".'
      });
    }

    let payload = null;
    try {
      payload = JSON.parse(Buffer.from(tokenStr, 'base64').toString('utf8'));
    } catch (e) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication session token.'
      });
    }

    if (!payload || !payload.uid) {
      return res.status(401).json({
        success: false,
        error: 'Malformed session token payload.'
      });
    }

    // Resolve user from SQLite database to ensure active status and latest role
    const user = await getSystemUserByUid(payload.uid, payload.orgId);
    if (!user || user.is_active === 0) {
      return res.status(401).json({
        success: false,
        error: 'User account disabled or not found.'
      });
    }

    req.user = {
      id: user.id,
      uid: user.uid,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      orgId: user.org_id
    };
    req.userRole = user.role;
    req.userOrgId = user.org_id;

    next();
  } catch (err) {
    logger.error('RBAC', 'Authentication error:', err.message);
    res.status(500).json({ success: false, error: 'Internal authentication error: ' + err.message });
  }
}

/**
 * Optional authentication: attaches req.user if token is present, continues otherwise
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  try {
    const tokenStr = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (tokenStr) {
      const payload = JSON.parse(Buffer.from(tokenStr, 'base64').toString('utf8'));
      if (payload && payload.uid) {
        const user = await getSystemUserByUid(payload.uid, payload.orgId);
        if (user && user.is_active !== 0) {
          req.user = {
            id: user.id,
            uid: user.uid,
            username: user.username,
            email: user.email,
            displayName: user.display_name,
            role: user.role,
            orgId: user.org_id
          };
          req.userRole = user.role;
          req.userOrgId = user.org_id;
        }
      }
    }
  } catch (e) {}
  next();
}

/**
 * Enforces Tenant Partition Isolation Boundary:
 * - super_admin can query or modify any target partition.
 * - Non-super_admin users are strictly locked to their assigned partition (req.user.orgId).
 * - Cross-tenant access attempts return 403 Forbidden.
 */
function enforceTenantBoundary(req, res, next) {
  if (!req.user) {
    // If route isn't strictly authenticated, continue
    return next();
  }

  // Super administrators are permitted across all partitions
  if (req.user.role === 'super_admin') {
    return next();
  }

  const userOrg = String(req.user.orgId || '').trim().toUpperCase();
  const requestedOrg = (
    req.headers['x-organization-id'] ||
    req.query.orgId ||
    (req.body && req.body.orgId) ||
    ''
  ).toString().trim().toUpperCase();

  // If a specific organization was requested and doesn't match the user's partition
  if (requestedOrg && requestedOrg !== 'ALL' && requestedOrg !== userOrg) {
    logger.warn('RBAC', `Blocked cross-tenant access attempt by user "${req.user.username}" (${userOrg}) to target partition "${requestedOrg}".`);
    return res.status(403).json({
      success: false,
      error: `Access Denied: Tenant boundary violation. User "${req.user.username}" is bound to partition "${userOrg}" and cannot access or modify partition "${requestedOrg}".`
    });
  }

  // Enforce caller partition on headers and queries to prevent unintended data leakage
  req.headers['x-organization-id'] = userOrg;
  req.query.orgId = userOrg;
  if (req.body && typeof req.body === 'object' && req.body.orgId) {
    req.body.orgId = userOrg;
  }

  next();
}

/**
 * Checks if authenticated user has one of the allowed roles
 * super_admin always passes role checks.
 */
function requireRoles(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const currentRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin = currentRole === 'super_admin';
    const isAllowed = allowedRoles.map(r => r.toLowerCase()).includes(currentRole);

    if (!isSuperAdmin && !isAllowed) {
      logger.warn('RBAC', `Forbidden action: User "${req.user.username}" with role "${currentRole}" attempted access requiring [${allowedRoles.join(', ')}] on ${req.method} ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        error: `Forbidden: Insufficient privileges. Required role: [${allowedRoles.join(', ')}]. Current role: "${req.user.role}".`
      });
    }

    next();
  };
}

const requireSuperAdmin = requireRoles(['super_admin']);
const requireTenantAdmin = requireRoles(['super_admin', 'admin']);
const requireManagerOrAbove = requireRoles(['super_admin', 'admin', 'manager']);

module.exports = {
  authenticateToken,
  optionalAuth,
  enforceTenantBoundary,
  requireRoles,
  requireSuperAdmin,
  requireTenantAdmin,
  requireManagerOrAbove
};
