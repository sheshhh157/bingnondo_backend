'use strict';

/**
 * notifications.controller.js  —  §1.8 Notifications (Customer)
 * ──────────────────────────────────────────────────────────────
 * Endpoints (all require requireCustomer middleware):
 *   GET  /api/customer/notifications           → paginated list, grouped by date on the client
 *   PUT  /api/notifications/:id/read           → mark one notification as read
 *   PUT  /api/notifications/read-all           → mark all unread as read (batch)
 *
 * Notification types stored in notifications.type:
 *   'order_status'    — order confirmed / preparing / ready / out_for_delivery / completed / cancelled
 *   'payment_status'  — payment verified (approved) or rejected
 *   'support_message' — new staff reply in support chat
 *
 * Flutter shapes expected by notifications_screen.dart (NotificationItem.fromJson):
 *   {
 *     id:           number,
 *     type:         string,
 *     reference_id: number | null,   ← order_id or payment_id or chat message_id
 *     message:      string,
 *     is_read:      boolean,
 *     created_at:   ISO-8601 string,
 *   }
 *
 * The Flutter screen groups rows by date (Today / Yesterday / Earlier) client-side,
 * so the backend just returns a flat array newest-first.
 *
 * Unread badge count:
 *   Included in the list response as `unread_count` (top-level).
 *   Flutter NotificationsProvider also calls GET /api/customer/notifications?unread_only=true&limit=1
 *   just to get the badge number cheaply — the count is always returned.
 *
 * Real-time push:
 *   When a new notification is inserted (by order_notifications.js,
 *   payment_notifications.js, or support_chat.controller.js), the server
 *   emits a `new_notification` event to the customer's socket room
 *   (`customer:${customerId}`). The Flutter app listens for this event
 *   and increments the badge count or refreshes the list.
 *
 *   Socket room: customer room is `customer:${customerId}` — see socket.js.
 *   The customer joins this room with the `join_customer` socket event
 *   after login (add to socket_service.dart if not already done).
 */

const pool = require('../../config/db');

// ── Pagination defaults ────────────────────────────────────────────────────────
const DEFAULT_LIMIT  = 30;
const MAX_LIMIT      = 100;

// ─── GET /api/customer/notifications ─────────────────────────────────────────
//
// Query params:
//   ?limit=30          — number of rows to return (max 100)
//   ?before_id=<n>     — cursor: return rows with id < before_id (keyset pagination)
//   ?unread_only=true  — return only unread rows (used for badge count refresh)
//
// Response:
//   {
//     notifications: [ ...NotificationItem ],
//     unread_count:  number,
//     has_more:      boolean,   ← true if there are older rows beyond this page
//   }

async function listNotifications(req, res, next) {
  try {
    const customerId = req.customerId; // set by requireCustomer

    // Parse query params
    const limit = Math.min(
      parseInt(req.query.limit, 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const beforeId    = parseInt(req.query.before_id, 10) || null;
    const unreadOnly  = req.query.unread_only === 'true';

    // ── Build WHERE clauses ──────────────────────────────────────────────────
    const conditions = ['customer_id = $1'];
    const values     = [customerId];
    let   paramIdx   = 2;

    if (beforeId) {
      conditions.push(`id < $${paramIdx}`);
      values.push(beforeId);
      paramIdx++;
    }

    if (unreadOnly) {
      conditions.push('is_read = FALSE');
    }

    const where = conditions.join(' AND ');

    // ── Fetch one extra row to determine has_more ────────────────────────────
    const rows = await pool.query(
      `SELECT
         id,
         type,
         reference_id,
         message,
         is_read,
         created_at
       FROM notifications
       WHERE ${where}
       ORDER BY id DESC
       LIMIT $${paramIdx}`,
      [...values, limit + 1]
    );

    const hasMore       = rows.rows.length > limit;
    const notifications = hasMore ? rows.rows.slice(0, limit) : rows.rows;

    // ── Unread count (always returned regardless of unread_only flag) ─────────
    const unreadResult = await pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM notifications
       WHERE customer_id = $1 AND is_read = FALSE`,
      [customerId]
    );
    const unreadCount = unreadResult.rows[0]?.cnt ?? 0;

    return res.json({
      notifications: notifications.map(formatNotification),
      unread_count:  unreadCount,
      has_more:      hasMore,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/notifications/:id/read ──────────────────────────────────────────
//
// Marks a single notification as read.
// Only the owning customer can mark their own notification.
// Returns 404 if the notification doesn't belong to the customer.
//
// Response: { id, is_read: true }

async function markOneRead(req, res, next) {
  try {
    const customerId     = req.customerId;
    const notificationId = parseInt(req.params.id, 10);

    if (!notificationId || notificationId <= 0) {
      return res.status(400).json({ message: 'Invalid notification ID.' });
    }

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND customer_id = $2
       RETURNING id, is_read`,
      [notificationId, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    return res.json({ id: result.rows[0].id, is_read: true });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/notifications/read-all ─────────────────────────────────────────
//
// Marks all unread notifications for the authenticated customer as read.
// Called when the customer opens the Notifications screen (clears badge).
//
// Response: { updated_count: number }

async function markAllRead(req, res, next) {
  try {
    const customerId = req.customerId;

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE customer_id = $1 AND is_read = FALSE`,
      [customerId]
    );

    return res.json({ updated_count: result.rowCount ?? 0 });
  } catch (err) {
    next(err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * formatNotification — shapes a DB row to the Flutter-expected JSON.
 * @param {object} row
 * @returns {object}
 */
function formatNotification(row) {
  // Order/payment notifications use reference_id as the order id, so surface it
  // as related_order_id too — the app deep-links to the order tracker from it.
  // Support messages use reference_id for the chat thread, so leave them alone.
  const isOrderLike =
    typeof row.type === 'string' &&
    (row.type.startsWith('order_') || row.type.startsWith('payment_'));

  return {
    id:               row.id,
    type:             row.type,
    reference_id:     row.reference_id ?? null,
    related_order_id: isOrderLike ? (row.reference_id ?? null) : null,
    message:          row.message ?? '',
    is_read:          row.is_read,
    created_at:       row.created_at,
  };
}

module.exports = { listNotifications, markOneRead, markAllRead };