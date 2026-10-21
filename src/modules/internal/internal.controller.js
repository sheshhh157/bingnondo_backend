'use strict';

/**
 * internal.controller.js  —  Service-to-service bridge
 * ─────────────────────────────────────────────────────────────────────────────
 * The web dashboard (staff side) runs on its OWN Express + Socket.io process
 * (Bingnondo/backend, port 5000) while the customer app talks to THIS backend
 * (port 3000). Both share the same PostgreSQL database, but they do NOT share
 * a Socket.io instance — so a status change made on the web never reaches the
 * Flutter app's socket rooms on its own.
 *
 * These internal endpoints are called by the web backend after it commits an
 * order/payment change. They are the one place where the app backend turns a
 * staff action into a customer-facing notification:
 *   1. INSERT a row into `notifications` (so it shows in the app's list), and
 *   2. emit `order_status_update` + `new_notification` to the customer's rooms.
 *
 * Authentication: a shared secret header (`x-internal-key`) — see
 * internal.routes.js. These routes are NOT exposed to customers.
 */

const pool = require('../../config/db');
const { notifyOrderStatus } = require('../../utils/order_notifications');
const { notifyPaymentStatus } = require('../../utils/payment_notifications');

const STATUS_LABELS = {
  pending:          'Order Placed',
  confirmed:        'Order Confirmed',
  preparing:        'Being Prepared',
  ready:            'Ready for Pickup / Delivery',
  out_for_delivery: 'Out for Delivery',
  completed:        'Delivered',
  cancelled:        'Cancelled',
};

/**
 * Resolve the customer + human order number for an order.
 * Returns null when the order does not exist, or has no customer
 * (counter/walk-in orders are never delivered to the app).
 */
async function resolveOrderTarget(orderId) {
  const { rows } = await pool.query(
    `SELECT
       customer_id,
       COALESCE(order_number, 'BNG-' || LPAD(id::text, 4, '0')) AS order_number
     FROM orders
     WHERE id = $1`,
    [orderId]
  );
  if (!rows[0]) return null;
  return { customerId: rows[0].customer_id, orderNumber: rows[0].order_number };
}

// ─── POST /api/internal/order-status ──────────────────────────────────────────
// Body: { orderId, status, extra? }
// Inserts a customer notification row and pushes it in real time.
async function postOrderStatus(req, res, next) {
  try {
    const orderId = parseInt(req.body?.orderId, 10);
    const { status } = req.body || {};

    if (!orderId || orderId <= 0) {
      return res.status(422).json({ message: 'orderId is required.' });
    }
    if (!status || typeof status !== 'string') {
      return res.status(422).json({ message: 'status is required.' });
    }

    const target = await resolveOrderTarget(orderId);
    if (!target) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Counter / walk-in orders have no customer in the app — nothing to push.
    if (target.customerId == null) {
      return res.json({ ok: true, skipped: 'no_customer' });
    }

    await notifyOrderStatus(pool, orderId, target.customerId, status, {
      order_number: target.orderNumber,
      label:        STATUS_LABELS[status] ?? status,
      ...(req.body.extra && typeof req.body.extra === 'object' ? req.body.extra : {}),
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/internal/payment-status ────────────────────────────────────────
// Body: { orderId, event: 'approved' | 'rejected', reason? }
// Used when staff verify or reject a GCash receipt.
async function postPaymentStatus(req, res, next) {
  try {
    const orderId = parseInt(req.body?.orderId, 10);
    const { event, reason } = req.body || {};

    if (!orderId || orderId <= 0) {
      return res.status(422).json({ message: 'orderId is required.' });
    }
    if (!['approved', 'rejected'].includes(event)) {
      return res.status(422).json({ message: "event must be 'approved' or 'rejected'." });
    }

    const target = await resolveOrderTarget(orderId);
    if (!target) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    if (target.customerId == null) {
      return res.json({ ok: true, skipped: 'no_customer' });
    }

    await notifyPaymentStatus(pool, orderId, target.customerId, event, {
      order_number: target.orderNumber,
      reason:       reason ?? null,
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { postOrderStatus, postPaymentStatus };
