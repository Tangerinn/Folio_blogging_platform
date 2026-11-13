const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim();
}

/**
 * Verifies Bearer access token, loads the user, and rejects missing/invalid/expired/suspended accounts.
 */
async function requireAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    }
    if (user.status === 'suspended') {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Attaches `req.user` when a valid active Bearer token is present, otherwise sets `req.user = null`.
 */
async function optionalAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.sub);
    req.user = user && user.status === 'active' ? user : null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Requires an authenticated user with the `admin` role.
 */
function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError(403, 'FORBIDDEN', 'Administrator access required.'));
  }
  return next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };

