'use strict';

/**
 * socket.js  (updated for §1.8 Notifications)
 * ─────────────────────────────────────────────────────────────────────────────
 * New additions vs §1.7 version:
 *   ROOMS.CUSTOMER_PREFIX    — per-customer personal room `customer:${id}`
 *   join_customer            — client event: customer joins their personal room
 *   EVENTS.NEW_NOTIFICATION  — real-time notification push to customer
 *   emitCustomerNotification() — convenience emitter for §1.8
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Server } = require('socket.io');

/** @type {import('socket.io').Server | null} */
let _io = null;

// ── Room name constants ───────────────────────────────────────────────────────
const ROOMS = {
  MENU:          'menu',          // customer app: real-time menu_update events
  KITCHEN:       'kitchen',       // kitchen staff display
  STAFF_SUPPORT: 'staff_support', // §1.7 staff members monitoring support chats
  // Per-entity rooms built dynamically:
  //   order room    → `order:${orderId}`
  //   ESP32 room    → `esp32:${deviceId}`
  //   support room  → `support:${customerId}`
  //   customer room → `customer:${customerId}`  ← NEW §1.8
};

// ── Server-emitted event names ────────────────────────────────────────────────
const EVENTS = {
  // §1.3
  MENU_UPDATE:         'menu_update',
  // §1.6
  ORDER_STATUS_UPDATE: 'order_status_update',
  // §1.7
  SUPPORT_MESSAGE:     'support_message',      // new chat message (customer ↔ staff)
  SUPPORT_CHAT_STATUS: 'support_chat_status',  // chat locked / unlocked
  // §1.8
  NEW_NOTIFICATION:    'new_notification',     // ← NEW: in-app notification push
  // §2.2 / §3.1
  NEW_ORDER:           'new_order',
  // §3.2
  KITCHEN_ALERT:       'kitchen_alert',
  KITCHEN_ALERT_CLEAR: 'kitchen_alert_clear',
};

// ─────────────────────────────────────────────────────────────────────────────
function init(httpServer) {
  if (_io) {
    console.warn('[socket] init() called more than once — ignoring duplicate call');
    return _io;
  }

  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  _io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout:  20000,
  });

  _io.on('connection', (socket) => {
    // ── Customer: join the menu room ──────────────────────────────────────────
    socket.on('join_menu', () => {
      socket.join(ROOMS.MENU);
      socket.emit('joined_menu');
    });

    // ── Customer: join their personal notifications room ──────────────────────
    // §1.8: Flutter SocketService emits `join_customer` after login.
    // The server uses `customer:${customerId}` to push `new_notification` events
    // so the badge count and notification list update in real time.
    //
    // Add to socket_service.dart (after connect/login):
    //   _socket.emit('join_customer', {'customer_id': customerId});
    socket.on('join_customer', ({ customer_id }) => {
      if (typeof customer_id !== 'number' || customer_id <= 0) return;
      socket.join(`customer:${customer_id}`);
      socket.emit('joined_customer', { customer_id });
    });

    // ── Customer: join their personal support room ────────────────────────────
    socket.on('join_support', ({ customer_id }) => {
      if (typeof customer_id !== 'number' || customer_id <= 0) return;
      socket.join(`support:${customer_id}`);
      socket.emit('joined_support', { customer_id });
    });

    // ── Staff: join the kitchen room ──────────────────────────────────────────
    socket.on('join_kitchen', () => {
      socket.join(ROOMS.KITCHEN);
      socket.emit('joined_kitchen');
    });

    // ── Staff: join the support room (web dashboard) ──────────────────────────
    socket.on('join_staff_support', () => {
      socket.join(ROOMS.STAFF_SUPPORT);
      socket.emit('joined_staff_support');
    });

    // ── Customer: per-order tracking room ─────────────────────────────────────
    socket.on('join_order', ({ order_id }) => {
      if (typeof order_id === 'number' && order_id > 0) {
        socket.join(`order:${order_id}`);
        socket.emit('joined_order', { order_id });
      }
    });

    socket.on('leave_order', ({ order_id }) => {
      if (typeof order_id === 'number' && order_id > 0) {
        socket.leave(`order:${order_id}`);
      }
    });

    // ── ESP32 device registration ─────────────────────────────────────────────
    socket.on('esp32_register', async ({ device_code }) => {
      if (!device_code || typeof device_code !== 'string') return;
      try {
        const db = require('../config/db');
        const result = await db.query(
          `UPDATE esp32_devices
           SET    status = 'online', last_ping_at = NOW()
           WHERE  device_code = $1
           RETURNING id`,
          [device_code]
        );
        if (result.rows.length === 0) {
          socket.emit('esp32_rejected', { reason: 'Unknown device code.' });
          return;
        }
        const deviceId = result.rows[0].id;
        socket.join(`esp32:${deviceId}`);
        socket.emit('esp32_registered', { device_id: deviceId });
        console.log(`[socket] ESP32 registered: ${device_code} (id=${deviceId})`);
      } catch (err) {
        console.error('[socket] esp32_register error:', err.message);
      }
    });

    socket.on('esp32_ping', async ({ device_code }) => {
      if (!device_code) return;
      try {
        const db = require('../config/db');
        await db.query(
          `UPDATE esp32_devices SET last_ping_at = NOW() WHERE device_code = $1`,
          [device_code]
        );
      } catch (_) { /* silent */ }
    });

    socket.on('disconnecting', async () => {
      for (const room of socket.rooms) {
        if (room.startsWith('esp32:')) {
          const deviceId = parseInt(room.split(':')[1], 10);
          try {
            const db = require('../config/db');
            await db.query(
              `UPDATE esp32_devices SET status = 'offline' WHERE id = $1`,
              [deviceId]
            );
            console.log(`[socket] ESP32 id=${deviceId} went offline`);
          } catch (_) { /* non-critical */ }
        }
      }
    });
  });

  console.log('[socket] Socket.io initialised');
  return _io;
}

// ─────────────────────────────────────────────────────────────────────────────
function getIO() {
  if (!_io) throw new Error('[socket] Socket.io not initialised. Call init(httpServer) first.');
  return _io;
}

// ── Convenience emitters ──────────────────────────────────────────────────────

function emitMenuUpdate(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  try {
    getIO().to(ROOMS.MENU).emit(EVENTS.MENU_UPDATE, { items });
  } catch (err) {
    console.warn('[socket] emitMenuUpdate skipped:', err.message);
  }
}

function emitNewOrder(orderPayload) {
  try {
    getIO().to(ROOMS.KITCHEN).emit(EVENTS.NEW_ORDER, orderPayload);
  } catch (err) {
    console.warn('[socket] emitNewOrder skipped:', err.message);
  }
}

function emitOrderStatusUpdate(orderId, status, extraData = {}) {
  try {
    getIO().to(`order:${orderId}`).emit(EVENTS.ORDER_STATUS_UPDATE, {
      order_id: orderId,
      status,
      ...extraData,
    });
  } catch (err) {
    console.warn('[socket] emitOrderStatusUpdate skipped:', err.message);
  }
}

function emitKitchenAlert(deviceId, alertPayload) {
  try {
    getIO().to(`esp32:${deviceId}`).emit(EVENTS.KITCHEN_ALERT, alertPayload);
  } catch (err) {
    console.warn('[socket] emitKitchenAlert skipped:', err.message);
  }
}

function emitKitchenAlertClear(deviceId, alertId) {
  try {
    getIO().to(`esp32:${deviceId}`).emit(EVENTS.KITCHEN_ALERT_CLEAR, { alert_id: alertId });
  } catch (err) {
    console.warn('[socket] emitKitchenAlertClear skipped:', err.message);
  }
}

/**
 * emitSupportMessage(customerId, messagePayload)
 * §1.7 — Pushes a new support message to both the customer's personal room
 * and the shared staff_support room.
 */
function emitSupportMessage(customerId, messagePayload) {
  try {
    const io = getIO();
    io.to(`support:${customerId}`).emit(EVENTS.SUPPORT_MESSAGE, messagePayload);
    io.to(ROOMS.STAFF_SUPPORT).emit(EVENTS.SUPPORT_MESSAGE, {
      customer_id: customerId,
      ...messagePayload,
    });
  } catch (err) {
    console.warn('[socket] emitSupportMessage skipped:', err.message);
  }
}

/**
 * emitCustomerNotification(customerId, notificationPayload)
 * §1.8 — Pushes a new_notification event to the customer's personal room.
 * The Flutter NotificationsProvider listens for this to update the badge
 * count and prepend the new notification to the list.
 *
 * Payload shape (matches NotificationItem.fromJson in Flutter):
 *   { id, type, reference_id, message, is_read, created_at }
 */
function emitCustomerNotification(customerId, notificationPayload) {
  try {
    getIO()
      .to(`customer:${customerId}`)
      .emit(EVENTS.NEW_NOTIFICATION, notificationPayload);
  } catch (err) {
    console.warn('[socket] emitCustomerNotification skipped:', err.message);
  }
}

module.exports = {
  init,
  getIO,
  ROOMS,
  EVENTS,
  emitMenuUpdate,
  emitNewOrder,
  emitOrderStatusUpdate,
  emitKitchenAlert,
  emitKitchenAlertClear,
  emitSupportMessage,          // §1.7
  emitCustomerNotification,    // §1.8 NEW
};