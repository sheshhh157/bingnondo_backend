'use strict';

/**
 * orders.routes.js  —  §1.5 Cart & Checkout + §1.6 Order Tracking
 *
 * All routes require a valid customer JWT (requireCustomer).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireCustomer } = require('../../middleware/auth');
const { uploadReceipt } = require('../../config/cloudinary');
const {
  placeOrder,
  listOrders,
  getOrder,
  getOrderStatus,
  getOrderTimeline,
  cancelOrder,
  reuploadReceipt,
} = require('./orders.controller');

const router = express.Router();

// Rate limiter for order placement — prevent spam
const orderPlaceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many orders placed. Please wait a moment.' },
});

/**
 * POST /api/orders
 * §1.5 Place a new online order.
 * Body: { items, delivery_preference, payment_method, notes? }
 */
router.post('/', requireCustomer, orderPlaceLimiter, placeOrder);

/**
 * GET /api/orders
 * §1.6 List this customer's orders (newest first).
 * Returns: { orders: [ {id, order_number, status, total_amount, item_count, payment_method, created_at} ] }
 */
router.get('/', requireCustomer, listOrders);

/**
 * GET /api/orders/:id
 * §1.6 Full order detail: items, delivery info, payment status.
 * Used by OrderTrackingScreen on initial load.
 */
router.get('/:id', requireCustomer, getOrder);

/**
 * GET /api/orders/:id/status
 * §1.6 Lightweight status poll — used as Socket.io fallback.
 * Flutter polls this every ~15 s when the socket is disconnected.
 * Returns: { id, order_number, status, can_cancel, payment_status, delivery }
 *
 * IMPORTANT: This route MUST be declared before /:id/cancel to avoid
 * Express matching "status" as a route parameter of /:id.
 */
router.get('/:id/status', requireCustomer, getOrderStatus);

/**
 * GET /api/orders/:id/timeline
 * §1.6 Full status-history timeline for the stepper UI.
 * Returns all canonical statuses with is_completed, is_current, changed_at.
 */
router.get('/:id/timeline', requireCustomer, getOrderTimeline);

/**
 * POST /api/orders/:id/cancel
 * §1.6 Cancel an order (only while deliveries.status = 'pending_assignment').
 */
router.post('/:id/cancel', requireCustomer, cancelOrder);

/**
 * POST /api/orders/:id/reupload-receipt
 * Re-upload a GCash receipt after staff rejection.
 * multipart/form-data, field name: 'receipt'
 * Only allowed when payment status is 'rejected'.
 */
router.post(
  '/:id/reupload-receipt',
  requireCustomer,
  uploadReceipt.single('receipt'),
  reuploadReceipt,
);

module.exports = router;