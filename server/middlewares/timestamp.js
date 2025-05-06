// src/middlewares/timestamp.js
/**
 * Middleware to automatically add created_at and updated_at timestamps to request bodies.
 * - On POST: sets created_at (if not provided) and updated_at
 * - On PUT/PATCH: sets updated_at only
 * - Other methods: no changes
 */
export default function addTimestamps(req, res, next) {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }

  const now = new Date();
  const method = req.method.toUpperCase();

  if (method === 'POST') {
    // Only set created_at if not provided by client
    if (!req.body.created_at) {
      req.body.created_at = now;
    }
    req.body.updated_at = now;
  } else if (method === 'PUT' || method === 'PATCH') {
    req.body.updated_at = now;
  }
  // For other methods (GET, DELETE), do nothing

  next();
}
