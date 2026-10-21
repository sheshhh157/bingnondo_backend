const { verifyAccessToken } = require('../utils/jwt');

/**
 * requireCustomer — protect routes that require a logged-in customer.
 * Attaches req.customerId (integer) on success.
 */
function requireCustomer(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);

    if (payload.type !== 'customer') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    req.customerId = payload.sub;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
}

module.exports = { requireCustomer };
