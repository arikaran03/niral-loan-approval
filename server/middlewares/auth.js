// src/middlewares/auth.js
import { expressjwt } from 'express-jwt';
import { JWT_SECRET } from '../config.js';

/**
 * 1. authMiddleware:
 *    - Checks for JWT in Authorization header or ?token query.
 *    - Verifies with HS256 and the shared secret.
 *    - Populates req.auth with the token payload on success.
 */
export const authMiddleware = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
  getToken: (req) => {
    if (
      req.headers.authorization &&
      req.headers.authorization.split(' ')[0] === 'Bearer'
    ) {
      return req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      return req.query.token;
    }
    return null;
  },
  credentialsRequired: true, // reject requests without any token
});

/**
 * 2. attachUser:
 *    - Moves req.auth (the raw JWT payload) into req.user for consistency.
 *    - You can extend this to load fresh user data from the DB if desired.
 */
export const attachUser = (req, res, next) => {
  if (req.auth) {
    req.user = req.auth;
  }
  next();
};

/**
 * 3. requireRole:
 *    - Higher-order middleware that only allows users whose req.user.type
 *      is included in the allowedRoles array.
 */
export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.type)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

/**
 * 4. errorHandler:
 *    - Catches any UnauthorizedError thrown by express-jwt and
 *      returns a 401 JSON response.
 */
export const errorHandler = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next(err);
};
