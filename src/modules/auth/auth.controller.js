'use strict';

const bcrypt = require('bcrypt');
const pool   = require('../../config/db');
const { createOtp, verifyOtp }    = require('../../utils/otp');
const { sendOtpEmail }            = require('../../utils/mailer');
const {
  signCustomerAccessToken,
  signCustomerRefreshToken,
} = require('../../utils/jwt');

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeCustomer(row) {
  return {
    id:               row.id,
    email:            row.email,
    email_verified:   row.email_verified,
    mobile_number:    row.mobile_number,
    profile_completed: row.profile_completed,
    status:           row.status,
    first_name:       row.first_name,
    last_name:        row.last_name,
  };
}

function issueTokens(customerId) {
  return {
    accessToken:  signCustomerAccessToken(customerId),
    refreshToken: signCustomerRefreshToken(customerId),
  };
}

// ─── 1.1a Register via Email ──────────────────────────────────────────────────

/**
 * POST /api/auth/customer/register
 * Body: { email, password }
 */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ message: 'Email and password are required.' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(422).json({ message: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(422).json({ message: 'Password must be at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Already fully registered?
    const existing = await pool.query(
      'SELECT id, email_verified FROM customers WHERE email = $1',
      [normalizedEmail]
    );
    if (existing.rows.length > 0 && existing.rows[0].email_verified) {
      return res.status(409).json({ message: 'Already registered. Sign in instead.' });
    }

    // Active OTP already pending?
    const existingOtp = await pool.query(
      `SELECT expires_at
       FROM otp_verifications
       WHERE contact = $1
         AND purpose = 'email_verification'
         AND verified_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await pool.query(
      `INSERT INTO pending_registrations (email, password_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
       ON CONFLICT (email) WHERE email IS NOT NULL
       DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             expires_at    = EXCLUDED.expires_at,
             created_at    = NOW()`,
      [normalizedEmail, passwordHash]
    );

    if (existingOtp.rows.length > 0) {
      return res.status(200).json({
        message: "OTP already sent. Please check your email. If you didn't receive it, wait a moment before requesting a new one.",
      });
    }

    const otp = await createOtp(normalizedEmail, 'email_verification');
    await sendOtpEmail(normalizedEmail, otp, 'email_verification');

    return res.status(200).json({ message: 'OTP sent. Please check your email.' });
  } catch (err) {
    next(err);
  }
}

// ─── 1.2 Verify OTP ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/customer/verify-otp
 * Body: { contact, otp, purpose }
 *
 * contact = email for purpose: email_verification | password_reset
 */
async function verifyOtpEndpoint(req, res, next) {
  try {
    // Accept both 'email' and 'contact' for backward compatibility
    const rawContact = req.body.contact || req.body.email;
    const { otp, purpose = 'email_verification' } = req.body;

    if (!rawContact || !otp || !purpose) {
      return res.status(422).json({ message: 'Contact, OTP, and purpose are required.' });
    }

    const contact = rawContact.trim().toLowerCase();
    if (!EMAIL_REGEX.test(contact)) {
      return res.status(422).json({ message: 'Please enter a valid email address.' });
    }

    // ── EMAIL VERIFICATION ────────────────────────────────────────────────────
    if (purpose === 'email_verification') {
      await verifyOtp(contact, otp, purpose);

      const pendingResult = await pool.query(
        `SELECT password_hash
         FROM pending_registrations
         WHERE email = $1 AND expires_at > NOW()`,
        [contact]
      );

      if (pendingResult.rows.length === 0) {
        return res.status(400).json({ message: 'Registration session expired. Please sign up again.' });
      }

      const { password_hash } = pendingResult.rows[0];

      const { rows } = await pool.query(
        `INSERT INTO customers (email, password_hash, email_verified, status)
         VALUES ($1, $2, TRUE, 'active')
         ON CONFLICT (email) WHERE email IS NOT NULL
         DO UPDATE
           SET email_verified = TRUE, status = 'active', updated_at = NOW()
         RETURNING *`,
        [contact, password_hash]
      );

      await pool.query(
        `DELETE FROM pending_registrations WHERE email = $1`,
        [contact]
      );

      const tokens = issueTokens(rows[0].id);
      return res.status(200).json({
        message: 'Email verified. Welcome to Bingnondo!',
        ...tokens,
        user: safeCustomer(rows[0]),
      });
    }

    // ── PASSWORD RESET OTP CHECK ──────────────────────────────────────────────
    if (purpose === 'password_reset') {
      // consume:false — OTP consumed only after password is saved
      await verifyOtp(contact, otp, purpose, { consume: false });

      return res.status(200).json({ message: 'OTP verified. You may now set a new password.' });
    }

    return res.status(422).json({ message: 'Invalid purpose.' });
  } catch (err) {
    next(err);
  }
}

// ─── Resend OTP ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/customer/resend-otp
 * Body: { contact, purpose }
 *
 * contact = email address
 */
async function resendOtp(req, res, next) {
  try {
    const rawContact = req.body.contact || req.body.email;
    const { purpose = 'email_verification' } = req.body;

    if (!rawContact) {
      return res.status(422).json({ message: 'Email address is required.' });
    }

    const contact = rawContact.trim().toLowerCase();
    if (!EMAIL_REGEX.test(contact)) {
      return res.status(422).json({ message: 'Please enter a valid email address.' });
    }

    // ── EMAIL VERIFICATION ────────────────────────────────────────────────────
    if (purpose === 'email_verification') {
      const { rows } = await pool.query(
        `SELECT email FROM pending_registrations WHERE email = $1 AND expires_at > NOW()`,
        [contact]
      );
      if (rows.length === 0) {
        return res.status(200).json({ message: 'If that email is pending verification, a new OTP was sent.' });
      }
      await pool.query(
        `UPDATE otp_verifications SET verified_at = NOW()
         WHERE contact = $1 AND purpose = 'email_verification' AND verified_at IS NULL`,
        [contact]
      );
      const otp = await createOtp(contact, 'email_verification');
      await sendOtpEmail(contact, otp, 'email_verification');
      return res.status(200).json({ message: 'New OTP sent. Check your email.' });
    }

    // ── PASSWORD RESET ────────────────────────────────────────────────────────
    if (purpose === 'password_reset') {
      const { rows } = await pool.query(
        `SELECT id FROM customers WHERE email = $1`,
        [contact]
      );
      if (rows.length === 0) {
        return res.status(200).json({ message: 'If that email is registered, a new OTP was sent.' });
      }
      await pool.query(
        `UPDATE otp_verifications SET verified_at = NOW()
         WHERE contact = $1 AND purpose = 'password_reset' AND verified_at IS NULL`,
        [contact]
      );
      const otp = await createOtp(contact, 'password_reset');
      await sendOtpEmail(contact, otp, 'password_reset');
      return res.status(200).json({ message: 'New OTP sent. Check your email.' });
    }

    return res.status(422).json({ message: 'Invalid purpose.' });
  } catch (err) {
    next(err);
  }
}

// ─── 1.3 Sign In ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/customer/login
 * Body: { email, password }
 *       Email address and password.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ message: 'Email and password are required.' });
    }

    const identifier = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(identifier)) {
      return res.status(422).json({ message: 'Please enter a valid email address.' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM customers WHERE email = $1`,
      [identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const customer = rows[0];

    if (customer.status === 'awaiting_verification') {
      return res.status(403).json({
        message: 'Please verify your account first.',
      });
    }

    if (customer.status === 'suspended') {
      return res.status(403).json({ message: 'Account suspended. Contact support.' });
    }

    const passwordMatch = await bcrypt.compare(password, customer.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const tokens = issueTokens(customer.id);
    return res.status(200).json({
      message: 'Signed in successfully.',
      ...tokens,
      user: safeCustomer(customer),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Forgot Password (Email) ──────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(422).json({ message: 'Email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(422).json({ message: 'Please enter a valid email address.' });
    }

    const { rows } = await pool.query(
      `SELECT id FROM customers WHERE email = $1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No account found with that email address.' });
    }

    const otp = await createOtp(normalizedEmail, 'password_reset');
    await sendOtpEmail(normalizedEmail, otp, 'password_reset');

    return res.status(200).json({ message: 'Reset code sent. Please check your email.' });
  } catch (error) {
    console.error('Forgot password (email) error:', error);
    return res.status(500).json({ message: 'Unable to process your request. Please try again.' });
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/reset-password
 * Body: { contact, otp, new_password }
 * contact = email address
 */
async function resetPassword(req, res, next) {
  try {
    // Accept both 'contact' and 'email' for backward compatibility
    const rawContact  = req.body.contact || req.body.email;
    const { otp, new_password } = req.body;

    if (!rawContact || !otp || !new_password) {
      return res.status(422).json({ message: 'Contact, OTP, and new password are required.' });
    }

    if (new_password.length < 8) {
      return res.status(422).json({ message: 'Password must be at least 8 characters.' });
    }

    const contact = rawContact.trim().toLowerCase();
    if (!EMAIL_REGEX.test(contact)) {
      return res.status(422).json({ message: 'Please enter a valid email address.' });
    }

    // Verify OTP (don't consume yet — consume after DB update succeeds)
    const verifiedOtp = await verifyOtp(contact, otp, 'password_reset', { consume: false });

    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);

    const { rows } = await pool.query(
      `UPDATE customers
       SET password_hash = $1, updated_at = NOW()
       WHERE email = $2
       RETURNING id`,
      [newHash, contact]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    // Now consume the OTP
    await pool.query(
      `UPDATE otp_verifications
       SET verified_at = NOW()
       WHERE id = $1 AND verified_at IS NULL`,
      [verifiedOtp.id]
    );

    return res.status(200).json({ message: 'Password reset successfully. You may now sign in.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  verifyOtpEndpoint,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
};
