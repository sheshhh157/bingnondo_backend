'use strict';

/**
 * payments.routes.js
 *
 * POST /api/payments/extract-receipt
 *   — upload GCash receipt screenshot → OCR → return extracted ref number
 *   — requires customer JWT
 *   — multipart/form-data, field name: 'receipt'
 */

const express             = require('express');
const { requireCustomer } = require('../../middleware/auth');
const { uploadReceipt }   = require('../../config/cloudinary');
const { extractReceipt }  = require('./payments.controller');

const router = express.Router();

router.post(
  '/extract-receipt',
  requireCustomer,
  uploadReceipt.single('receipt'),
  extractReceipt
);

module.exports = router;