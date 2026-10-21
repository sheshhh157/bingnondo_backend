const express = require('express');
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

/** Strict limiter for login attempts — 5 per 15 min per IP */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

/** Limiter for OTP sends — 3 per 10 min per IP */
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many OTP requests. Please wait before requesting another.',
  },
});

/** General auth limiter — 20 per 15 min per IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please try again later.',
  },
});

// ─── Customer Auth Routes ─────────────────────────────────────────────────────

/**
 * POST /api/auth/customer/register
 * § 1.1 Sign Up — email + password, triggers OTP email
 */
router.post('/customer/register', otpSendLimiter, register);

/**
 * POST /api/auth/customer/verify-otp
 * § 1.1 Verify OTP after sign-up
 * Also used for § 1.2 password reset OTP verification (purpose param)
 */
router.post('/customer/verify-otp', authLimiter, verifyOtpEndpoint);

/**
 * POST /api/auth/customer/resend-otp
 * Resend OTP for email verification or password reset
 */
router.post('/customer/resend-otp', otpSendLimiter, resendOtp);

/**
 * POST /api/auth/customer/login
 * § 1.2 Sign In — email/mobile + password → tokens
 */
router.post('/customer/login', loginLimiter, login);

/**
 * POST /api/auth/forgot-password
 * § 1.2 Forgot Password — sends reset OTP
 */
router.post('/forgot-password', otpSendLimiter, forgotPassword);

/**
 * POST /api/auth/reset-password
 * § 1.2 Reset Password — OTP + new password
 */
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;
