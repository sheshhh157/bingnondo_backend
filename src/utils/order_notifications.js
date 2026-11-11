'use strict';

/**
 * order_notifications.js  —  §1.6 Order Tracking / §1.8 Notifications
 * ─────────────────────────────────────────────────────────────────────
 * Centralised helper for inserting a customer notification row AND
 * pushing a real-time Socket.io event whenever an order status changes.
 *
 * Called from:
 *   - orders.controller.js  (cancel by customer, status transition)
 *   - Staff-side controllers (kitchen, cashier, rider) when they update
 *     order status — §3.1 (kitchen), §4.1 (rider)
 *
 * Socket events emitted:
 *   server → `order:${orderId}` (per-order tracking room):
 *     'order_status_update' { order_id, status, label, can_cancel, message }
 *
 *   server → `customer:${customerId}` (customer's personal room):
 *     'new_notification' { id, type, reference_id, message, is_read, created_at }
 *
 * DB row inserted into notifications:
 *   { customer_id, type: 'order_status', reference_id: orderId, message }
 *
 * CHANGE vs §1.7 version:
 *   - INSERT now writes customer_id (new column from migration 008).
 *   - After insert, emitCustomerNotification() is called so the
 *     Notifications screen badge updates in real time.
 *
 * Usage:
 *   const { notifyOrderStatus } = require('../../../utils/order_notifications');
 *   await notifyOrderStatus(pool, orderId, customerId, newStatus);
 *   await notifyOrderStatus(pool, orderId, customerId, 'out_for_delivery', { rider_name: 'Juan' });
 */

const { emitOrderStatusUpdate, emitCustomerNotification } = require('../sockets/socket');
const { sendCustomerPush } = require('./firebase_push');

/**
 * Human-readable messages per status transition.
 * Keep in sync with STATUS_LABELS in orders.controller.js.
 */
const STATUS_MESSAGES = {
  pending:          'Your order has been placed! Waiting for confirmation.',
  confirmed:        'Your order has been confirmed by Bingnondo Cafe.',
  preparing:        'The kitchen is now preparing your order.',
  ready:            'Your order is ready! A rider will pick it up shortly.',
  out_for_delivery: 'Your order is on its way! Rider is heading to you.',
  completed:        'Your order has been delivered. Salamat!',
  cancelled:        'Your order has been cancelled.',
};

/**
 * notifyOrderStatus
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db  — pool or in-transaction client
 * @param {number}  orderId
 * @param {number}  customerId
 * @param {string}  newStatus   — one of the canonical order statuses
 * @param {object}  [extra={}]  — merged into the order_status_update socket payload (e.g. { rider_name })
 * @returns {Promise<void>}
 */
async function notifyOrderStatus(db, orderId, customerId, newStatus, extra = {}) {
  const message = STATUS_MESSAGES[newStatus] ?? `Order status updated to: ${newStatus}.`;

  // Customer can cancel only while still in pending delivery status.
  const canCancel = newStatus === 'pending';

  // Store a status-specific type (e.g. 'order_preparing') so the app can pick
  // the right title/icon and deep-link straight to the order tracker. Falls
  // back to the generic 'order_status' if we ever see an unknown status.
  const notificationType = STATUS_MESSAGES[newStatus]
    ? `order_${newStatus}`
    : 'order_status';

  // ── 1. Persist in-app notification row (now includes customer_id) ────────────
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
    // Non-fatal — log but don't block the caller
    console.error('[order_notifications] Failed to insert notification row:', err.message);
  }

  // ── 2. Real-time: order tracking room ────────────────────────────────────────
  // The customer's Flutter app joins `order:${orderId}` after placing an order.
  // emitOrderStatusUpdate is safe to call even when the socket isn't connected.
  try {
    emitOrderStatusUpdate(orderId, newStatus, {
      order_id:   orderId,
      status:     newStatus,
      label:      STATUS_MESSAGES[newStatus] ?? newStatus,
      can_cancel: canCancel,
      message,
      ...extra,
    });
  } catch (err) {
    console.error('[order_notifications] Order status socket emit failed:', err.message);
  }

  // ── 3. Real-time: customer notifications room (§1.8 badge + list) ────────────
  // Pushes a 'new_notification' event to the customer's personal room so the
  // Notifications screen refreshes its badge count without polling.
  if (insertedRow) {
    void sendCustomerPush(customerId, insertedRow);
    try {
      emitCustomerNotification(customerId, {
        id:                  insertedRow.id,
        type:                insertedRow.type,
        reference_id:        insertedRow.reference_id,
        related_order_id:    orderId,
        related_order_number: extra.order_number ?? null,
        order_id:            orderId,
        order_number:        extra.order_number ?? null,
        status:              newStatus,
        message:             insertedRow.message,
        is_read:             insertedRow.is_read,
        created_at:          insertedRow.created_at,
      });
    } catch (err) {
      console.error('[order_notifications] Customer notification socket emit failed:', err.message);
    }
  }
}

module.exports = { notifyOrderStatus, STATUS_MESSAGES };