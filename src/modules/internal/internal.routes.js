'use strict';

/**
 * internal.routes.js  —  Service-to-service bridge (web backend → app backend)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mounted at /api/internal in app.js.
 *
 * Auth: every request must carry the header `x-internal-key` matching the
 * `INTERNAL_API_KEY` env var. This is a shared secret between the two backend
 * processes — it is NOT a customer/staff JWT, and these routes are never
 * reachable from a browser (CORS aside, a browser has no reason to know it).
 *
 * Endpoints:
 *   POST /api/internal/order-status    → notify a customer their order changed
 *   POST /api/internal/payment-status  → notify a customer their GCash receipt
 *                                        was approved / rejected
 *
 * If INTERNAL_API_KEY is unset the bridge is disabled (503) rather than left
 * open, so a misconfigured deployment fails closed.
 */

const express = require('express');
const { postOrderStatus, postPaymentStatus } = require('./internal.controller');

const router = express.Router();

function requireInternalKey(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    return res.status(503).json({ message: 'Internal bridge is not configured.' });
  }
  if (req.get('x-internal-key') !== expected) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  next();
}

router.post('/order-status',   requireInternalKey, postOrderStatus);
router.post('/payment-status', requireInternalKey, postPaymentStatus);

module.exports = router;
