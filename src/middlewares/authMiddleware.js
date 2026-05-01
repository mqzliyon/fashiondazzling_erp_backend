const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const { ROLES, ROLE_PERMISSIONS } = require("../config/rbac");

// Mobile / React Native: send `Authorization: Bearer <token>`.
// Web clients may still use the httpOnly cookie set at login.
function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }

  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

// Middleware to protect routes and attach authenticated user to request
const protect = asyncHandler(async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    const error = new Error("Not authorized, no token provided");
    error.statusCode = 401;
    throw error;
  }

  try {
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.sub);
    if (!user) {
      const error = new Error("User associated with token not found");
      error.statusCode = 401;
      throw error;
    }
    if (user.isActive === false) {
      const error = new Error("User is disabled");
      error.statusCode = 403;
      throw error;
    }

    // Attach user to request object for downstream middlewares/controllers
    req.user = user.toJSON();
    req.auth = {
      userId: decoded.sub,
      role: decoded.role,
      organizationId: decoded.organizationId,
    };

    next();
  } catch (err) {
    const error = new Error("Not authorized, token failed");
    error.statusCode = 401;
    throw error;
  }
});

// Middleware factory for role-based authorization
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      const error = new Error("Not authorized, user role missing");
      error.statusCode = 403;
      throw error;
    }

    if (!allowedRoles.includes(req.user.role)) {
      const error = new Error("Not authorized, insufficient permissions");
      error.statusCode = 403;
      throw error;
    }

    next();
  };
}

// Middleware factory for permission-based authorization
// Example: authorizePermissions("manage_orders")
function authorizePermissions(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      const error = new Error("Not authorized, user role missing");
      error.statusCode = 403;
      throw error;
    }

    const rolePermissions = ROLE_PERMISSIONS[req.user.role] || [];
    const customPermissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : [];
    const mergedPermissions = Array.from(
      new Set([...rolePermissions, ...customPermissions])
    );

    const hasAllPermissions = requiredPermissions.every((permission) =>
      mergedPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      const error = new Error("Not authorized, missing required permissions");
      error.statusCode = 403;
      throw error;
    }

    next();
  };
}

// Convenience middleware for admin-only routes
const adminOnly = authorizeRoles(ROLES.ADMIN);

module.exports = {
  protect,
  authorizeRoles,
  authorizePermissions,
  adminOnly,
};

