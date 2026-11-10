'use strict';

/**
 * payments.routes.js
 *
 * GET  /api/payments/qr-code        — active GCash QR (public, no auth)
 * GET  /api/payments/delivery-fee   — current delivery fee (public, no auth)
 * POST /api/payments/extract-receipt — upload GCash receipt → OCR (requires customer JWT)
 */

const express             = require('express');
const { requireCustomer } = require('../../middleware/auth');
const { uploadReceipt }   = require('../../config/cloudinary');
const {
  extractReceipt,
  getActiveQrCode,
  getDeliveryFee,
} = require('./payments.controller');

const router = express.Router();

// Public — no auth required; called at checkout screen load
router.get('/qr-code',      getActiveQrCode);
router.get('/delivery-fee', getDeliveryFee);

// Requires customer JWT
router.post(
  '/extract-receipt',
  requireCustomer,
  uploadReceipt.single('receipt'),
  extractReceipt
);

module.exports = router;