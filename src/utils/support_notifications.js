'use strict';

/**
 * support_notifications.js  —  §1.8 Notifications (Support Chat events)
 * ───────────────────────────────────────────────────────────────────────
 * Centralised helper for inserting a customer notification row AND
 * pushing a real-time Socket.io event when staff sends a support reply.
 *
 * Called from:
 *   - support_chat.controller.js  (postMessage — when sender_type = 'staff')
 *
 * Socket event emitted:
 *   server → `customer:${customerId}`:
 *     'new_notification' { id, type, reference_id, message, is_read, created_at }
 *
 * DB row inserted into notifications:
 *   { customer_id, type: 'support_message', reference_id: messageId, message }
 *
 * Usage:
 *   const { notifySupportReply } = require('../../../utils/support_notifications');
 *   await notifySupportReply(pool, messageId, customerId, staffName);
 */

const { emitCustomerNotification } = require('../sockets/socket');
const { sendCustomerPush } = require('./firebase_push');

/**
 * notifySupportReply
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} messageId     — support_chat_messages.id of the staff reply
 * @param {number} customerId
 * @param {string} [staffName]   — staff full_name, for a personalised message
 * @returns {Promise<void>}
 */
async function notifySupportReply(db, messageId, customerId, staffName = 'Support') {
  const message = `${staffName} replied to your support chat.`;

  // ── 1. Persist in-app notification row ──────────────────────────────────────
  let insertedRow = null;
  try {
    const result = await db.query(
      `INSERT INTO notifications
         (customer_id, type, reference_id, message, is_read)
       VALUES ($1, 'support_message', $2, $3, FALSE)
       RETURNING id, type, reference_id, message, is_read, created_at`,
      [customerId, messageId, message]
    );
    insertedRow = result.rows[0];
  } catch (err) {
    console.error('[support_notifications] Failed to insert notification row:', err.message);
  }

  // ── 2. Real-time push via Socket.io ─────────────────────────────────────────
  if (insertedRow) {
    void sendCustomerPush(customerId, insertedRow);
    try {
      emitCustomerNotification(customerId, {
        id:           insertedRow.id,
        type:         insertedRow.type,
        reference_id: insertedRow.reference_id,
        message:      insertedRow.message,
        is_read:      insertedRow.is_read,
        created_at:   insertedRow.created_at,
      });
    } catch (err) {
      console.error('[support_notifications] Socket emit failed:', err.message);
    }
  }
}

module.exports = { notifySupportReply };