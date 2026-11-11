'use strict';

/**
 * payment_notifications.js  —  §1.8 Notifications (Payment events)
 * ─────────────────────────────────────────────────────────────────
 * Centralised helper for inserting a customer notification row AND
 * pushing a real-time Socket.io event when a payment status changes.
 *
 * Called from:
 *   - payments.controller.js  (verifyReceipt → approved / rejected)
 *
 * Socket event emitted:
 *   server → `customer:${customerId}`:
 *     'new_notification' { id, type, reference_id, message, is_read, created_at }
 *
 * DB row inserted into notifications:
 *   { customer_id, type: 'payment_status', reference_id: orderId, message }
 *
 * Usage:
 *   const { notifyPaymentStatus } = require('../../../utils/payment_notifications');
 *   await notifyPaymentStatus(pool, orderId, customerId, 'approved');
 *   await notifyPaymentStatus(pool, orderId, customerId, 'rejected');
 */

const { emitCustomerNotification } = require('../sockets/socket');
const { sendCustomerPush } = require('./firebase_push');

const PAYMENT_MESSAGES = {
  approved: 'Your GCash payment has been verified! Your order is being processed.',
  rejected: 'Your GCash receipt was rejected. Please re-upload a clear screenshot.',
};

/**
 * notifyPaymentStatus
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} orderId
 * @param {number} customerId
 * @param {'approved'|'rejected'} paymentEvent
 * @returns {Promise<void>}
 */
async function notifyPaymentStatus(db, orderId, customerId, paymentEvent, extra = {}) {
  const message = PAYMENT_MESSAGES[paymentEvent]
    ?? `Payment status updated: ${paymentEvent}.`;

  // Map the staff-facing event to the app's notification type so the client
  // shows the right title/icon and deep-links to the order tracker.
  const notificationType =
    paymentEvent === 'approved' ? 'payment_received'
    : paymentEvent === 'rejected' ? 'payment_failed'
    : 'payment_status';

  // ── 1. Persist in-app notification row ──────────────────────────────────────
  let insertedRow = null;
  try {
    const result = await db.query(
      `INSERT INTO notifications
         (customer_id, type, reference_id, message, is_read)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, type, reference_id, message, is_read, created_at`,
      [customerId, notificationType, orderId, message]
    );
    insertedRow = result.rows[0];
  } catch (err) {
    console.error('[payment_notifications] Failed to insert notification row:', err.message);
  }

  // ── 2. Real-time push via Socket.io ─────────────────────────────────────────
  if (insertedRow) {
    void sendCustomerPush(customerId, insertedRow);
    try {
      emitCustomerNotification(customerId, {
        id:                   insertedRow.id,
        type:                 insertedRow.type,
        reference_id:         insertedRow.reference_id,
        related_order_id:     orderId,
        related_order_number: extra.order_number ?? null,
        order_id:             orderId,
        order_number:         extra.order_number ?? null,
        message:              insertedRow.message,
        is_read:              insertedRow.is_read,
        created_at:           insertedRow.created_at,
      });
    } catch (err) {
      console.error('[payment_notifications] Socket emit failed:', err.message);
    }
  }
}

module.exports = { notifyPaymentStatus, PAYMENT_MESSAGES };