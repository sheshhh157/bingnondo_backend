const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

function getNextManilaMidnightEpoch(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('now must be a valid Date.');
  }

  const manilaTime = new Date(now.getTime() + MANILA_UTC_OFFSET_MS);
  const nextMidnightUtcMs = Date.UTC(
    manilaTime.getUTCFullYear(),
    manilaTime.getUTCMonth(),
    manilaTime.getUTCDate() + 1
  );

  return Math.floor((nextMidnightUtcMs - MANILA_UTC_OFFSET_MS) / 1000);
}

/**
 * Sign an access token for a customer.
 * Payload: { sub: customerId, type: 'customer', role: 'customer' }
 */
function signCustomerAccessToken(customerId, expiresAt = getNextManilaMidnightEpoch()) {
  return jwt.sign(
    { sub: customerId, type: 'customer', role: 'customer', exp: expiresAt },
    ACCESS_SECRET,
  );
}

/**
 * Sign a refresh token for a customer.
 */
function signCustomerRefreshToken(customerId, expiresAt = getNextManilaMidnightEpoch()) {
  return jwt.sign(
    { sub: customerId, type: 'customer', exp: expiresAt },
    REFRESH_SECRET,
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
  getNextManilaMidnightEpoch,
};
