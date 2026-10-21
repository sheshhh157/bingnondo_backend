const crypto = require('crypto');
const pool = require('../config/db');

const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a cryptographically random 6-digit OTP.
 */
function generateOtpCode() {
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 900000;
  return String(100000 + num);
}

/**
 * Create and persist an OTP.
 *
 * PostgreSQL computes expires_at using NOW() to avoid
 * timezone differences between Node.js and PostgreSQL.
 */
async function createOtp(contact, purpose) {
  const code = generateOtpCode();

  await pool.query(
    `INSERT INTO otp_verifications (contact, otp_code, purpose, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes')`,
    [contact, code, purpose]
  );

  return code;
}

/**
 * Verify an OTP.
 *
 * options.consume:
 *   true  = verify and immediately consume OTP
 *   false = verify only; keep OTP available for the next step
 *
 * Password reset uses consume:false during the OTP verification screen,
 * then consumes the OTP only after the new password is successfully saved.
 */
async function verifyOtp(contact, code, purpose, options = {}) {
  const consume = options.consume !== false;

  const { rows } = await pool.query(
    `SELECT *,
            expires_at > NOW() AS is_valid
     FROM otp_verifications
     WHERE contact = $1
       AND purpose = $2
       AND verified_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [contact, purpose]
  );

  if (rows.length === 0) {
    const err = new Error('OTP not found. Request a new one.');
    err.statusCode = 400;
    throw err;
  }

  const otp = rows[0];

  if (!otp.is_valid) {
    const err = new Error('OTP expired. Request a new one.');
    err.statusCode = 400;
    throw err;
  }

  if (otp.otp_code !== code) {
    const err = new Error('Incorrect OTP.');
    err.statusCode = 400;
    throw err;
  }

  /*
   * Only consume the OTP when requested.
   *
   * Email verification:
   *   consume = true
   *
   * Password reset:
   *   OTP screen -> consume = false
   *   Reset password -> consume after password update
   */
  if (consume) {
    await pool.query(
      `UPDATE otp_verifications
       SET verified_at = NOW()
       WHERE id = $1`,
      [otp.id]
    );
  }

  return otp;
}

module.exports = {
  createOtp,
  verifyOtp,
};