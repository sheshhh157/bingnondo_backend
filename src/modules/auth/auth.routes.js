'use strict';

const express   = require('express');
const rateLimit = require('express-rate-limit');

const {
  register,
  verifyOtpEndpoint,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
} = require('./auth.controller');

const router = express.Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

/** 5 login attempts per 15 min per IP */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

/** 3 OTP sends per 10 min per IP */
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait before requesting another.' },
});

/** General auth limiter — 20 per 15 min per IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/customer/register
 * Email registration — sends email OTP
 */
router.post('/customer/register', otpSendLimiter, register);

/**
 * POST /api/auth/customer/verify-otp
 * Verify OTP for email_verification | password_reset
 * Body: { contact, otp, purpose }
 *   (also accepts 'email' instead of 'contact' for backward compatibility)
 */
router.post('/customer/verify-otp', authLimiter, verifyOtpEndpoint);

/**
 * POST /api/auth/customer/resend-otp
 * Resend email OTP
 * Body: { contact, purpose }
 */
router.post('/customer/resend-otp', otpSendLimiter, resendOtp);

/**
 * POST /api/auth/customer/login
 * Sign in with email and password
 * Body: { email, password }
 */
router.post('/customer/login', loginLimiter, login);

/**
 * POST /api/auth/forgot-password
 * Forgot password via email — sends email OTP
 * Body: { email }
 */
router.post('/forgot-password', otpSendLimiter, forgotPassword);

/**
 * POST /api/auth/reset-password
 * Reset password using an email OTP
 * Body: { contact, otp, new_password }
 *   (also accepts 'email' instead of 'contact' for backward compatibility)
 */
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;
