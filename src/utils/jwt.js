const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '30m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Sign an access token for a customer.
 * Payload: { sub: customerId, type: 'customer', role: 'customer' }
 */
function signCustomerAccessToken(customerId) {
  return jwt.sign(
    { sub: customerId, type: 'customer', role: 'customer' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

/**
 * Sign a refresh token for a customer.
 */
function signCustomerRefreshToken(customerId) {
  return jwt.sign(
    { sub: customerId, type: 'customer' },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
}

/**
 * Verify and decode an access token.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verify and decode a refresh token.
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = {
  signCustomerAccessToken,
  signCustomerRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
