/**
 * Express middleware: 403 unless `req.userRole === 'admin'`.
 * Relies on upstream `authentication` middleware to populate `req.userRole`.
 */
export function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({success: false, error: 'Admin access required'});
  }
  next();
}
