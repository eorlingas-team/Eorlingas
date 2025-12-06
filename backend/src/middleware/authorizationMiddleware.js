/**
 * Authorization middleware - checks if user has required role
 * @param {...string} allowedRoles - Roles that are allowed to access
 * @returns {Function} Express middleware function
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
};

const requireStudent = requireRole('Student');

const requireSpaceManager = requireRole('Space_Manager');

const requireAdmin = requireRole('Administrator');

const requireSpaceManagerOrAdmin = requireRole('Space_Manager', 'Administrator');

module.exports = {
  requireRole,
  requireStudent,
  requireSpaceManager,
  requireAdmin,
  requireSpaceManagerOrAdmin,
};

