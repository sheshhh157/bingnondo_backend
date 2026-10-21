/**
 * Global error handler.
 * Must be the last middleware registered in app.js.
 */
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.path}:`, err.message);

  // Custom errors thrown with a .statusCode property
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Postgres unique violation (e.g. duplicate email)
  if (err.code === '23505') {
    return res.status(409).json({ message: 'Already registered. Sign in instead.' });
  }

  // Default 500
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

module.exports = errorHandler;
