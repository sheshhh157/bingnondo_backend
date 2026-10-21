'use strict';

/**
 * support_chat.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * §1.7  Support Chat  —  Customer ↔ Staff real-time messaging
 *
 * Business rules (from flow_v3.md §1.7 + §8.3):
 *   • ONE thread per customer (support_chats.customer_id is UNIQUE)
 *   • Unlock condition : customer has ≥ 1 order NOT IN (completed, cancelled)
 *   • Lock condition   : ALL customer orders are in (completed, cancelled)
 *   • Thread is auto-created on first message / GET if it does not exist yet
 *   • Messages carry an optional related_order_id for staff context
 *   • Real-time delivery via Socket.io  `support_message`  event
 *
 * Endpoints implemented here:
 *   GET  /api/support-chat           → fetchChat()
 *   POST /api/support-chat/message   → sendMessage()
 *   PUT  /api/support-chat/read      → markRead()
 *
 * Called by orders controller (NOT in this file):
 *   syncChatLockState(customerId)    → exported helper, call after every
 *                                     order status change for that customer
 * ─────────────────────────────────────────────────────────────────────────────
 */

const db     = require('../../config/db');
const socket = require('../../sockets/socket');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine whether the customer currently has at least one active order
 * (i.e. an order NOT in the completed / cancelled terminal states).
 * Returns { hasActiveOrder: bool, activeOrderId: int|null }
 */
async function _getActiveOrderStatus(customerId) {
  const result = await db.query(
    `SELECT id
     FROM   orders
     WHERE  customer_id = $1
       AND  status NOT IN ('completed', 'cancelled')
     ORDER  BY created_at DESC
     LIMIT  1`,
    [customerId]
  );
  const row = result.rows[0] || null;
  return {
    hasActiveOrder: !!row,
    activeOrderId:  row ? row.id : null,
  };
}

/**
 * Upsert the support_chats row for this customer and return it.
 * Also updates the lock / unlock state based on current orders.
 */
async function _upsertChat(customerId) {
  const { hasActiveOrder, activeOrderId } = await _getActiveOrderStatus(customerId);
  const newStatus = hasActiveOrder ? 'unlocked' : 'locked';

  // Insert if missing, then update status to match current order state
  await db.query(
    `INSERT INTO support_chats (customer_id, status, opened_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (customer_id) DO UPDATE
       SET status    = $2,
           opened_at = CASE
                         WHEN support_chats.opened_at IS NULL AND $2 = 'unlocked'
                         THEN NOW()
                         ELSE support_chats.opened_at
                       END,
           locked_at = CASE
                         WHEN $2 = 'locked' THEN NOW()
                         ELSE support_chats.locked_at
                       END`,
    [customerId, newStatus]
  );

  const chatResult = await db.query(
    `SELECT id, status FROM support_chats WHERE customer_id = $1`,
    [customerId]
  );
  return { ...chatResult.rows[0], activeOrderId };
}

/**
 * Format a support_chat_messages row into the shape Flutter expects.
 * Matches SupportMessage.fromJson in tracking_models.dart:
 *   { id, content, sender_type, related_order_id, sent_at, is_read }
 */
function _formatMessage(row) {
  return {
    id:               row.id,
    content:          row.content,
    sender_type:      row.sender_type,         // 'customer' | 'staff'
    related_order_id: row.related_order_id,
    sent_at:          row.sent_at,
    is_read:          row.is_read ?? false,
  };
}

// ─── Exported helper for orders controller ────────────────────────────────────

/**
 * syncChatLockState(customerId)
 * Call this after any order status change that could affect the lock state.
 * It upserts the support_chats row and emits a Socket.io event so the
 * Flutter app can react without a full reload.
 */
async function syncChatLockState(customerId) {
  try {
    const chat = await _upsertChat(customerId);

    // Emit lock state change so Flutter SupportChatProvider can react
    try {
      socket.getIO()
        .to(`support:${customerId}`)
        .emit('support_chat_status', {
          status:    chat.status,
          chat_id:   chat.id,
        });
    } catch (_) { /* socket not ready yet — non-critical */ }
  } catch (err) {
    console.error('[support-chat] syncChatLockState error:', err.message);
  }
}

// ─── GET /api/support-chat ────────────────────────────────────────────────────

/**
 * Returns the customer's support chat thread + messages.
 * Returns 404 when the customer has never placed any order
 * (Flutter SupportChatProvider maps 404 → noActiveOrder state).
 */
async function fetchChat(req, res, next) {
  const customerId = req.customerId;

  try {
    const { hasActiveOrder, activeOrderId } = await _getActiveOrderStatus(customerId);

    // If customer has never had any orders at all, return 404 → Flutter shows
    // "no active order" state without creating a ghost chat row.
    const anyOrderResult = await db.query(
      `SELECT 1 FROM orders WHERE customer_id = $1 LIMIT 1`,
      [customerId]
    );
    if (anyOrderResult.rows.length === 0) {
      return res.status(404).json({ message: 'No order history found.' });
    }

    // Upsert the chat row (syncs lock state with current orders)
    const chat = await _upsertChat(customerId);

    // Fetch messages
    const msgResult = await db.query(
      `SELECT id, sender_type, sender_id, related_order_id, content, sent_at,
              FALSE AS is_read
       FROM   support_chat_messages
       WHERE  chat_id = $1
       ORDER  BY sent_at ASC`,
      [chat.id]
    );

    // Auto-join the customer to their personal Socket.io room so real-time
    // delivery works. The room name is `support:<customerId>`.
    // (The Flutter socket_service doesn't emit join_support — the server
    //  pushes to this room by customer ID, so no client-side join is needed.)

    return res.json({
      id:              chat.id,
      status:          chat.status,
      active_order_id: activeOrderId,
      messages:        msgResult.rows.map(_formatMessage),
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/support-chat/message ──────────────────────────────────────────

/**
 * Customer sends a message to staff.
 * Validates chat is unlocked, saves the message, emits Socket.io events:
 *   • `support_message`  → customer's own room (echo for multi-device)
 *   • `support_message`  → staff room so they see it in real time
 */
async function sendMessage(req, res, next) {
  const customerId = req.customerId;
  const { content, related_order_id } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ message: 'Message content is required.' });
  }

  const trimmedContent = content.trim();

  try {
    // Ensure chat row exists and is unlocked
    const chat = await _upsertChat(customerId);

    if (chat.status === 'locked') {
      return res.status(403).json({
        message: 'Chat is locked. You need an active order to message staff.',
      });
    }

    // Validate related_order_id belongs to this customer (if provided)
    if (related_order_id) {
      const orderCheck = await db.query(
        `SELECT 1 FROM orders WHERE id = $1 AND customer_id = $2`,
        [related_order_id, customerId]
      );
      if (orderCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid related_order_id.' });
      }
    }

    // Insert the message
    const msgResult = await db.query(
      `INSERT INTO support_chat_messages
         (chat_id, sender_type, sender_id, related_order_id, content)
       VALUES ($1, 'customer', $2, $3, $4)
       RETURNING id, sender_type, sender_id, related_order_id, content, sent_at`,
      [chat.id, customerId, related_order_id || null, trimmedContent]
    );

    const message = _formatMessage(msgResult.rows[0]);

    // ── Socket.io: real-time delivery ─────────────────────────────────────────
    const io = socket.getIO();

    // Notify staff room (web dashboard — §4.0 Support Chat for Staff)
    io.to('staff_support').emit('support_message', {
      chat_id:     chat.id,
      customer_id: customerId,
      ...message,
    });

    // Echo to the customer's own room (covers multi-device / reconnect edge cases)
    io.to(`support:${customerId}`).emit('support_message', message);

    return res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/support-chat/read ───────────────────────────────────────────────

/**
 * Mark all unread messages in the customer's chat as read.
 * Called by Flutter when the chat screen is opened (non-critical, fire-and-forget).
 * Note: support_chat_messages has no is_read column in the DB schema —
 * the "read" state is tracked via the notifications table instead.
 * This endpoint simply marks related support_message notifications as read.
 */
async function markRead(req, res, next) {
  const customerId = req.customerId;

  try {
    await db.query(
      `UPDATE notifications
       SET    is_read = TRUE
       WHERE  staff_id IS NULL
         AND  type = 'support_message'
         AND  is_read = FALSE
         AND  reference_id IN (
           SELECT id
           FROM   support_chat_messages scm
           JOIN   support_chats sc ON sc.id = scm.chat_id
           WHERE  sc.customer_id = $1
             AND  scm.sender_type = 'staff'
         )`,
      [customerId]
    );

    return res.json({ success: true });
  } catch (err) {
    // Non-critical — don't surface errors to the client
    console.warn('[support-chat] markRead error (non-critical):', err.message);
    return res.json({ success: true });
  }
}

module.exports = {
  fetchChat,
  sendMessage,
  markRead,
  syncChatLockState,   // consumed by orders.controller.js
};