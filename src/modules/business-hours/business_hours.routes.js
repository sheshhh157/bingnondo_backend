'use strict';

/**
 * business_hours.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Business hours / order acceptance window.
 *
 *   GET /api/business-hours — public. Returns the weekly schedule plus the
 *                             current open/closed state in Asia/Manila time.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { getBusinessHours } = require('./business_hours.controller');

const router = express.Router();

const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

router.get('/', statusLimiter, getBusinessHours);

module.exports = router;
