const bcrypt = require('bcrypt');
const pool = require('../../config/db');
const { createOtp, verifyOtp } = require('../../utils/otp');
const { sendOtpEmail } = require('../../utils/mailer');
const {
  signCustomerAccessToken,
  signCustomerRefreshToken,
} = require('../../utils/jwt');

const BCRYPT_ROUNDS = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeCustomer(row) {
  return {
    id: row.id,
    email: row.email,
    email_verified: row.email_verified,
    profile_completed: row.profile_completed,
    status: row.status,
    first_name: row.first_name,
    last_name: row.last_name,
    mobile_number: row.mobile_number,
  };
}

function issueTokens(customerId) {
  return {
    accessToken: signCustomerAccessToken(customerId),
    refreshToken: signCustomerRefreshToken(customerId),
  };
}

// ─── 1.1 Register ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/customer/register
 * Body: { email, password }
 *
 * Registration flow:
 *   register → OTP is sent
 *   verify-otp → customer account is created after OTP verification
 */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({
        message: 'Email and password are required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(422).json({
        message: 'Please enter a valid email address.',
      });
    }

    if (password.length < 8) {
      return res.status(422).json({
        message: 'Password must be at least 8 characters.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already fully registered
    const existing = await pool.query(
      'SELECT id, email_verified FROM customers WHERE email = $1',
      [normalizedEmail]
    );

    if (
      existing.rows.length > 0 &&
      existing.rows[0].email_verified
    ) {
      return res.status(409).json({
        message: 'Already registered. Sign in instead.',
      });
    }

    // Check if an active OTP already exists
    const existingOtp = await pool.query(
      `SELECT expires_at
       FROM otp_verifications
       WHERE contact = $1
         AND purpose = 'email_verification'
         AND verified_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    if (existingOtp.rows.length > 0) {
      const passwordHash = await bcrypt.hash(
        password,
        BCRYPT_ROUNDS
      );

      await pool.query(
        `INSERT INTO pending_registrations
         (email, password_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               expires_at = EXCLUDED.expires_at,
               created_at = NOW()`,
        [normalizedEmail, passwordHash]
      );

      return res.status(200).json({
        message:
          'OTP already sent. Please check your email. If you didn\'t receive it, wait a moment before requesting a new one.',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      password,
      BCRYPT_ROUNDS
    );

    // Store pending registration
    await pool.query(
      `INSERT INTO pending_registrations
       (email, password_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             expires_at = EXCLUDED.expires_at,
             created_at = NOW()`,
      [normalizedEmail, passwordHash]
    );

    // Send OTP
    const otp = await createOtp(
      normalizedEmail,
      'email_verification'
    );

    await sendOtpEmail(
      normalizedEmail,
      otp,
      'email_verification'
    );

    return res.status(200).json({
      message: 'OTP sent. Please check your email.',
    });
  } catch (err) {
    next(err);
  }
}

// ─── 1.1 Verify OTP ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/customer/verify-otp
 * Body: { email, otp, purpose }
 */
async function verifyOtpEndpoint(req, res, next) {
  try {
    const {
      email,
      otp,
      purpose = 'email_verification',
    } = req.body;

    if (!email || !otp || !purpose) {
      return res.status(422).json({
        message: 'Email, OTP, and purpose are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ────────────────────────────────────────────────────────────────────────
    // EMAIL VERIFICATION
    // ────────────────────────────────────────────────────────────────────────

    if (purpose === 'email_verification') {
      /*
       * Email verification OTP is consumed immediately because
       * verification and account activation happen in the same step.
       */
      await verifyOtp(
        normalizedEmail,
        otp,
        purpose
      );

      const pendingResult = await pool.query(
        `SELECT password_hash
         FROM pending_registrations
         WHERE email = $1
           AND expires_at > NOW()`,
        [normalizedEmail]
      );

      if (pendingResult.rows.length === 0) {
        return res.status(400).json({
          message:
            'Registration session expired. Please sign up again.',
        });
      }

      const {
        password_hash,
      } = pendingResult.rows[0];

      const { rows } = await pool.query(
        `INSERT INTO customers
         (email, password_hash, email_verified, status)
         VALUES ($1, $2, TRUE, 'active')
         ON CONFLICT (email) DO UPDATE
           SET email_verified = TRUE,
               status = 'active',
               updated_at = NOW()
         RETURNING *`,
        [
          normalizedEmail,
          password_hash,
        ]
      );

      // Delete pending registration
      await pool.query(
        `DELETE FROM pending_registrations
         WHERE email = $1`,
        [normalizedEmail]
      );

      const customer = rows[0];

      const tokens = issueTokens(
        customer.id
      );

      return res.status(200).json({
        message:
          'Email verified. Welcome to Bingnondo!',
        ...tokens,
        user: safeCustomer(customer),
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASSWORD RESET OTP
    // ────────────────────────────────────────────────────────────────────────

    if (purpose === 'password_reset') {
      /*
       * IMPORTANT:
       *
       * Do NOT consume the OTP here.
       *
       * The OTP screen only verifies that the code is valid.
       * The OTP will be consumed later, after the new password
       * has successfully been saved.
       */
      await verifyOtp(
        normalizedEmail,
        otp,
        purpose,
        {
          consume: false,
        }
      );

      return res.status(200).json({
        message:
          'OTP verified. You may now set a new password.',
      });
    }

    return res.status(422).json({
      message: 'Invalid purpose.',
    });
  } catch (err) {
    next(err);
  }
}

// ─── Resend OTP ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/customer/resend-otp
 * Body: { email, purpose }
 */
async function resendOtp(req, res, next) {
  try {
    const {
      email,
      purpose = 'email_verification',
    } = req.body;

    if (!email) {
      return res.status(422).json({
        message: 'Email is required.',
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // ────────────────────────────────────────────────────────────────────────
    // EMAIL VERIFICATION
    // ────────────────────────────────────────────────────────────────────────

    if (purpose === 'email_verification') {
      const { rows } = await pool.query(
        `SELECT email
         FROM pending_registrations
         WHERE email = $1
           AND expires_at > NOW()`,
        [normalizedEmail]
      );

      if (rows.length === 0) {
        return res.status(200).json({
          message:
            'If that email is pending verification, a new OTP was sent.',
        });
      }

      // Invalidate old OTPs
      await pool.query(
        `UPDATE otp_verifications
         SET verified_at = NOW()
         WHERE contact = $1
           AND purpose = 'email_verification'
           AND verified_at IS NULL`,
        [normalizedEmail]
      );

      const otp = await createOtp(
        normalizedEmail,
        'email_verification'
      );

      await sendOtpEmail(
        normalizedEmail,
        otp,
        'email_verification'
      );

      return res.status(200).json({
        message:
          'New OTP sent. Check your email.',
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASSWORD RESET
    // ────────────────────────────────────────────────────────────────────────

    if (purpose === 'password_reset') {
      const { rows } = await pool.query(
        `SELECT id
         FROM customers
         WHERE email = $1`,
        [normalizedEmail]
      );

      if (rows.length === 0) {
        return res.status(200).json({
          message:
            'If that email is registered, a new OTP was sent.',
        });
      }

      // Invalidate old password reset OTPs
      await pool.query(
        `UPDATE otp_verifications
         SET verified_at = NOW()
         WHERE contact = $1
           AND purpose = 'password_reset'
           AND verified_at IS NULL`,
        [normalizedEmail]
      );

      const otp = await createOtp(
        normalizedEmail,
        'password_reset'
      );

      await sendOtpEmail(
        normalizedEmail,
        otp,
        'password_reset'
      );

      return res.status(200).json({
        message:
          'New OTP sent. Check your email.',
      });
    }

    return res.status(422).json({
      message: 'Invalid purpose.',
    });
  } catch (err) {
    next(err);
  }
}

// ─── 1.2 Sign In ─────────────────────────────────────────────────────────────

async function login(req, res, next) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(422).json({
        message:
          'Email/mobile and password are required.',
      });
    }

    const identifier =
      email.trim().toLowerCase();

    const { rows } = await pool.query(
      `SELECT *
       FROM customers
       WHERE email = $1
          OR mobile_number = $1`,
      [identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message:
          'Incorrect email or password.',
      });
    }

    const customer = rows[0];

    if (
      customer.status ===
      'awaiting_verification'
    ) {
      return res.status(403).json({
        message:
          'Please verify your account first. Check your email for the OTP.',
      });
    }

    if (
      customer.status ===
      'suspended'
    ) {
      return res.status(403).json({
        message:
          'Account suspended. Contact support.',
      });
    }

    const passwordMatch =
      await bcrypt.compare(
        password,
        customer.password_hash
      );

    if (!passwordMatch) {
      return res.status(401).json({
        message:
          'Incorrect email or password.',
      });
    }

    const tokens =
      issueTokens(customer.id);

    return res.status(200).json({
      message:
        'Signed in successfully.',
      ...tokens,
      user: safeCustomer(customer),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(422).json({
        message:
          'Email address is required.',
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const { rows } = await pool.query(
      `SELECT id
       FROM customers
       WHERE email = $1`,
      [normalizedEmail]
    );

    // Account does not exist
    if (rows.length === 0) {
      return res.status(404).json({
        message:
          'No account found with that email address.',
      });
    }

    // Account exists
    const otp = await createOtp(
      normalizedEmail,
      'password_reset'
    );

    await sendOtpEmail(
      normalizedEmail,
      otp,
      'password_reset'
    );

    return res.status(200).json({
      message:
        'Reset code sent. Please check your email.',
    });
  } catch (error) {
    console.error(
      'Forgot password error:',
      error
    );

    return res.status(500).json({
      message:
        'Unable to process your request. Please try again.',
    });
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────

async function resetPassword(req, res, next) {
  try {
    const {
      email,
      otp,
      new_password,
    } = req.body;

    if (
      !email ||
      !otp ||
      !new_password
    ) {
      return res.status(422).json({
        message:
          'Email, OTP, and new password are required.',
      });
    }

    if (new_password.length < 8) {
      return res.status(422).json({
        message:
          'Password must be at least 8 characters.',
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    /*
     * Verify the OTP again before changing the password.
     *
     * consume:false is important here because we only want to
     * consume it after the database successfully changes the password.
     */
    const verifiedOtp =
      await verifyOtp(
        normalizedEmail,
        otp,
        'password_reset',
        {
          consume: false,
        }
      );

    const newHash =
      await bcrypt.hash(
        new_password,
        BCRYPT_ROUNDS
      );

    const { rows } =
      await pool.query(
        `UPDATE customers
         SET password_hash = $1,
             updated_at = NOW()
         WHERE email = $2
         RETURNING id`,
        [
          newHash,
          normalizedEmail,
        ]
      );

    if (rows.length === 0) {
      return res.status(404).json({
        message:
          'Account not found.',
      });
    }

    /*
     * IMPORTANT:
     *
     * Consume the OTP only after the password update succeeds.
     */
    await pool.query(
      `UPDATE otp_verifications
       SET verified_at = NOW()
       WHERE id = $1
         AND verified_at IS NULL`,
      [verifiedOtp.id]
    );

    return res.status(200).json({
      message:
        'Password reset successfully. You may now sign in.',
    });
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