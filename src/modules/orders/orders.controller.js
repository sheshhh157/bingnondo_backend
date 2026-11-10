'use strict';

/**
 * orders.controller.js  —  §1.5 Cart & Checkout + §1.6 Order Tracking
 * ─────────────────────────────────────────────────────────────────────
 * Routes:
 *   POST  /api/orders                  → place order (customer)
 *   GET   /api/orders                  → list customer's orders (customer)
 *   GET   /api/orders/:id              → order detail + delivery info (customer)
 *   GET   /api/orders/:id/status       → lightweight status poll (customer)     ← NEW §1.6
 *   GET   /api/orders/:id/timeline     → full status history timeline (customer) ← NEW §1.6
 *   POST  /api/orders/:id/cancel       → cancel order while pending_assignment (customer)
 *
 * Flow on POST /api/orders:
 *   1. Gate check  — profile_completed + restriction_level
 *   2. Validate items  — must exist, is_available, quantity > 0
 *   3. Insert orders row
 *   4. Insert order_items rows
 *   5. Insert payments row (method = gcash|cash_on_delivery)
 *   6. Insert deliveries row unless the customer selected pickup
 *   7. Insert order_status_history row (status = 'pending')
 *   8. Emit Socket.io `new_order` if status auto-advances (COD → confirmed)
 *   9. Return {id, order_number, status, total_amount}
 *
 * Payment method mapping (Flutter → DB):
 *   'gcash' → payments.method = 'gcash'     (stays 'pending' until staff verifies)
 *   'cod'   → payments.method = 'cash_on_delivery'  (stays 'pending' until confirmed by staff)
 */

const pool = require('../../config/db');
const { getIO, emitNewOrder, emitOrderStatusUpdate } = require('../../sockets/socket');
const { syncChatLockState } = require('../support-chat/support_chat.controller');
const { notifyOrderStatus } = require('../../utils/order_notifications');
const { computeBusinessHoursStatus } = require('../business-hours/business_hours.controller');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a human-readable order number: BNG-YYYYMMDD-NNNN
 * NNNN = zero-padded daily sequence derived from today's order count.
 */
async function generateOrderNumber(client) {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, ''); // e.g. '20261004'

  const { rows } = await client.query(
    `SELECT COUNT(*) AS cnt
     FROM orders
     WHERE DATE(created_at) = CURRENT_DATE`,
  );
  const seq = parseInt(rows[0].cnt, 10) + 1;
  return `BNG-${ymd}-${String(seq).padStart(4, '0')}`;
}

/**
 * Map Flutter payment_method string → DB payments.method value.
 */
function mapPaymentMethod(method) {
  if (method === 'gcash') return 'gcash';
  if (method === 'cod')   return 'cash_on_delivery';
  return null;
}

/**
 * Human-readable label per order status (used in timeline + notifications).
 * Matches the labels shown in order_tracking_screen.dart.
 */
const STATUS_LABELS = {
  pending:            'Order Placed',
  confirmed:          'Order Confirmed',
  preparing:          'Being Prepared',
  ready:              'Ready for Pickup / Delivery',
  out_for_delivery:   'Out for Delivery',
  completed:          'Delivered',
  cancelled:          'Cancelled',
};

const PICKUP_STATUS_ORDER = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
];

const PICKUP_STATUS_LABELS = {
  ...STATUS_LABELS,
  ready:     'Ready for Pickup',
  completed: 'Picked Up',
};

// ─── POST /api/orders ─────────────────────────────────────────────────────────

async function placeOrder(req, res, next) {
  const customerId = req.customerId;

  const {
    items,                  // [{ menu_item_id, quantity, unit_price?, note?, variant_id?, variant_name? }]
    delivery_preference,    // 'own_delivery' | 'lalamove' | 'pickup'
    payment_method,         // 'gcash' | 'cod'
    notes,                  // optional overall order note
    gcash_receipt_temp_url, // Cloudinary temp URL (GCash only) — from extract-receipt
    gcash_ref_number,       // extracted by OCR — may be null (staff reviews manually)
    gcash_amount_sent,      // amount extracted by OCR — may be null (staff reviews manually)
    delivery_address,       // pin-drop address for THIS order (optional)
    delivery_latitude,      // pin latitude (optional)
    delivery_longitude,     // pin longitude (optional)
    // delivery_fee from client is ignored — always read from system_settings
  } = req.body;

  const deliveryPreference =
    delivery_preference === 'lalamove'
      ? 'lalamove'
      : delivery_preference === 'pickup'
        ? 'pickup'
        : 'own_delivery';

  // ── Validate input ──────────────────────────────────────────────────────────
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(422).json({ message: 'Order must have at least one item.' });
  }

  const dbPaymentMethod = mapPaymentMethod(payment_method);
  if (!dbPaymentMethod) {
    return res.status(422).json({ message: 'Invalid payment method.' });
  }

  for (const item of items) {
    if (!item.menu_item_id || !item.quantity || item.quantity < 1) {
      return res.status(422).json({ message: 'Each item must have a valid menu_item_id and quantity.' });
    }
  }

  // GCash orders must have a receipt uploaded before placing
  if (dbPaymentMethod === 'gcash' && !gcash_receipt_temp_url) {
    return res.status(422).json({
      message: 'Please upload your GCash receipt before placing the order.',
      code:    'receipt_required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Business hours: only accept orders while the cafe is open ────────────
    const businessHours = await computeBusinessHoursStatus(client);
    if (!businessHours.is_open) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: `Bingnondo is not accepting orders right now. ${businessHours.message}`,
        code: 'restaurant_closed',
        business_hours: businessHours,
      });
    }

    // ── Gate check: profile_completed ─────────────────────────────────────────
    const profileResult = await client.query(
      `SELECT profile_completed,
              c.address,
              c.latitude,
              c.longitude,
              COALESCE(cr.restriction_level, 'none') AS restriction_level
       FROM customers c
       LEFT JOIN customer_restrictions cr ON cr.customer_id = c.id
       WHERE c.id = $1`,
      [customerId]
    );

    if (profileResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const { profile_completed, restriction_level, address: savedAddress } =
      profileResult.rows[0];
    const savedLat = profileResult.rows[0].latitude;
    const savedLng = profileResult.rows[0].longitude;

    if (!profile_completed) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: 'Please complete your profile before placing an order.',
        code: 'profile_incomplete',
      });
    }

    if (restriction_level === 'suspended') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: 'Your account is restricted. Please contact Bingnondo Cafe.',
        code: 'suspended',
      });
    }

    if (restriction_level === 'cod_restricted' && payment_method === 'cod') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: 'Cash on Delivery is not available for your account. Please pay via GCash.',
        code: 'cod_restricted',
      });
    }

    // ── Validate menu items & compute total ───────────────────────────────────
    const menuItemIds = items.map((i) => i.menu_item_id);

    // Fetch all at once, only available + not deleted items
    const menuResult = await client.query(
      `SELECT id, price, name, is_available
       FROM menu_items
       WHERE id = ANY($1::int[])
         AND is_deleted = FALSE`,
      [menuItemIds]
    );

    const menuMap = new Map(menuResult.rows.map((r) => [r.id, r]));

    const unavailableItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);
      if (!menuItem) {
        await client.query('ROLLBACK');
        return res.status(422).json({
          message: `Menu item #${item.menu_item_id} does not exist.`,
        });
      }
      if (!menuItem.is_available) {
        unavailableItems.push(menuItem.name);
      }
      // Always use the live price from DB — don't trust the client-sent unit_price
      totalAmount += parseFloat(menuItem.price) * item.quantity;
    }

    if (unavailableItems.length > 0) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        message: `Some items are no longer available: ${unavailableItems.join(', ')}. Please remove them and try again.`,
        code: 'items_unavailable',
        unavailable_items: unavailableItems,
      });
    }

    totalAmount = Math.round(totalAmount * 100) / 100; // round to 2dp — this is the subtotal

    // ── Fetch delivery fee for delivery orders ────────────────────────────────
    let deliveryFee = 0;
    if (deliveryPreference !== 'pickup') {
      try {
        const feeResult = await client.query(
          `SELECT value FROM system_settings WHERE key = 'delivery_fee'`
        );
        if (feeResult.rows.length > 0) {
          const feeSetting = feeResult.rows[0].value;
          if (feeSetting.enabled === true && typeof feeSetting.amount === 'number') {
            deliveryFee = feeSetting.amount;
          }
        }
      } catch (_) {
        // If system_settings fails, default to 0 — non-fatal
      }
    }
    deliveryFee = Math.round(deliveryFee * 100) / 100;

    const subtotal    = totalAmount;
    totalAmount       = Math.round((subtotal + deliveryFee) * 100) / 100;

    let orderAddress = null;
    let orderLatitude = null;
    let orderLongitude = null;

    if (deliveryPreference !== 'pickup') {
      // Prefer the checkout pin; fall back to the customer's saved location.
      orderAddress =
        (typeof delivery_address === 'string' ? delivery_address.trim() : '') ||
        savedAddress ||
        null;

      const latNum = Number(delivery_latitude);
      const lngNum = Number(delivery_longitude);
      orderLatitude = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90
        ? latNum
        : (savedLat ?? null);
      orderLongitude = Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180
        ? lngNum
        : (savedLng ?? null);
    }

    // ── Generate order number ─────────────────────────────────────────────────
    const orderNumber = await generateOrderNumber(client);

    // ── Insert orders ─────────────────────────────────────────────────────────
    // Add delivery_fee column to orders if it doesn't exist yet (safe migration)
    await client.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0`
    ).catch(() => {});
    await client.query(
      `ALTER TABLE orders
         ADD COLUMN IF NOT EXISTS delivery_preference VARCHAR(20) NOT NULL DEFAULT 'own_delivery'`
    );

    const orderResult = await client.query(
      `INSERT INTO orders
         (order_type, customer_id, status, order_channel, total_amount, delivery_fee, special_request,
          delivery_address, delivery_latitude, delivery_longitude, delivery_preference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, status`,
      [
        'online',
        customerId,
        'pending',
        'mobile_app',
        totalAmount,
        deliveryFee,
        notes || null,
        orderAddress,
        orderLatitude,
        orderLongitude,
        deliveryPreference,
      ]
    );

    const orderId     = orderResult.rows[0].id;
    const orderStatus = orderResult.rows[0].status;

    // Store order_number in a separate update (or add order_number column migration)
    // For now, we store it as a comment field since the original schema has no order_number column.
    // We'll add order_number via a simple approach: encode it in special_request if no column,
    // OR better: check schema and add if needed.
    // Per the flow doc the column exists as implied (BNG-... format) — we'll add it safely:
    await client.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(30) UNIQUE`
    ).catch(() => { /* column may already exist */ });

    await client.query(
      `UPDATE orders SET order_number = $1 WHERE id = $2`,
      [orderNumber, orderId]
    );

    // ── Insert order_items ────────────────────────────────────────────────────
    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);

      // If the client sent a variant_id, verify it belongs to this item and
      // use the variant's price; otherwise fall back to the base item price.
      let unitPrice = menuItem.price;
      let variantId   = item.variant_id   ?? null;
      let variantName = item.variant_name ?? null;

      if (variantId) {
        const varResult = await client.query(
          `SELECT id, name, price FROM menu_item_variants
           WHERE id = $1 AND menu_item_id = $2 AND is_available = TRUE`,
          [variantId, item.menu_item_id]
        );
        if (varResult.rows.length === 0) {
          // Unknown or unavailable variant — clear it and use base price
          variantId   = null;
          variantName = null;
        } else {
          unitPrice   = parseFloat(varResult.rows[0].price);
          variantName = varResult.rows[0].name; // use DB name as source of truth
        }
      }

      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes, variant_id, variant_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          item.menu_item_id,
          item.quantity,
          unitPrice,
          item.note || null,
          variantId,
          variantName,
        ]
      );
    }

    // ── Insert payments ───────────────────────────────────────────────────────
    // GCash: save receipt_image_url + gcash_ref_number from the extract-receipt step.
    // Status = 'awaiting_verification' for GCash (staff must approve receipt).
    // Status = 'pending' for COD (confirmed when rider collects cash).
    const isGcash           = dbPaymentMethod === 'gcash';
    const paymentStatus     = isGcash ? 'awaiting_verification' : 'pending';
    const receiptUrl        = isGcash ? (gcash_receipt_temp_url ?? null) : null;
    const receiptRef        = isGcash ? (gcash_ref_number        ?? null) : null;
    const receiptAmountSent = isGcash ? (gcash_amount_sent       ?? null) : null;
    const receiptUploadedAt = isGcash ? 'NOW()' : 'NULL';

    await client.query(
      `INSERT INTO payments
         (order_id, method, amount, status,
          receipt_image_url, gcash_ref_number, gcash_amount_sent, receipt_uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ${receiptUploadedAt})`,
      [
        orderId,
        dbPaymentMethod,
        totalAmount,
        paymentStatus,
        receiptUrl,
        receiptRef,
        receiptAmountSent,
      ]
    );

    // ── Insert deliveries unless this is a pickup order ────────────────────────
    if (deliveryPreference !== 'pickup') {
      let hasAvailableRider = true;
      try {
        const { rows } = await client.query(
          `SELECT 1 FROM riders
            WHERE work_status = 'working'
               OR admin_work_override = 'working'
            LIMIT 1`
        );
        hasAvailableRider = rows.length > 0;
      } catch (err) {
        console.error('[placeOrder] rider availability check failed:', err.message);
      }

      if (!hasAvailableRider) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          message:
            'Delivery is not available right now — no riders are online. ' +
            'Please choose Pickup instead.',
          code: 'no_riders_available',
        });
      }

      await client.query(
        `INSERT INTO deliveries (order_id, delivery_preference, status)
         VALUES ($1, $2, 'pending_assignment')`,
        [orderId, deliveryPreference]
      );
    }

    // ── Insert initial status history ─────────────────────────────────────────
    await client.query(
      `INSERT INTO order_status_history (order_id, status)
       VALUES ($1, 'pending')`,
      [orderId]
    );

    await client.query('COMMIT');

    // Unlock support chat for this customer (non-blocking)
    syncChatLockState(customerId);

    // ── Emit Socket.io new_order event ────────────────────────────────────────
    // Kitchen Display + ESP32 listen for this event.
    // We only emit after COMMIT so the kitchen can safely query the order.
    try {
      const io = getIO();
      if (io) {
        io.to('kitchen').emit('new_order', {
          orderId,
          orderNumber,
          orderType: 'online',
          totalAmount,
          itemCount: items.length,
        });
      }
    } catch (_) {
      // Socket emit failure is non-fatal — order is already placed
    }

    // ── Notify the customer that the order was placed ─────────────────────────
    // Inserts the in-app notification row AND pushes `new_notification` to the
    // customer's room. Runs after COMMIT so the row is visible to the app.
    try {
      await notifyOrderStatus(pool, orderId, customerId, 'pending', {
        order_number: orderNumber,
      });
    } catch (_) {
      // Notification failure is non-fatal — the order is already placed.
    }

    return res.status(201).json({
      id:           orderId,
      order_number: orderNumber,
      status:       orderStatus,
      subtotal:     subtotal,
      delivery_fee: deliveryFee,
      total_amount: totalAmount,
      payment_url:  null, // GCash is manual receipt upload, not PayMongo redirect
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// ─── GET /api/orders ──────────────────────────────────────────────────────────
// List the customer's own orders (newest first).
// Matches OrdersService.fetchOrders() shape: { orders: [...] }

async function listOrders(req, res, next) {
  try {
    const customerId = req.customerId;

    const result = await pool.query(
      `SELECT
         o.id,
         COALESCE(o.order_number, 'BNG-' || o.id::text) AS order_number,
         o.status,
         o.total_amount,
         o.created_at,
         o.delivery_preference,
         p.method AS payment_method,
         COUNT(oi.id)::int AS item_count
       FROM orders o
       LEFT JOIN payments   p  ON p.order_id  = o.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.customer_id = $1
         AND o.order_type  = 'online'
       GROUP BY o.id, p.method
       ORDER BY o.created_at DESC`,
      [customerId]
    );

    return res.json({ orders: result.rows });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
// Full order detail including items and delivery info.
// Matches OrderTrackingService / tracking_models shape.

async function getOrder(req, res, next) {
  try {
    const customerId = req.customerId;
    const orderId    = parseInt(req.params.id, 10);

    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    // Order header
    const orderResult = await pool.query(
      `SELECT
         o.id,
         COALESCE(o.order_number, 'BNG-' || o.id::text) AS order_number,
         o.status,
         o.total_amount,
         o.delivery_preference,
         o.special_request AS notes,
         o.delivery_address,
         o.delivery_latitude,
         o.delivery_longitude,
         o.created_at,
         o.updated_at,
         p.method      AS payment_method,
         p.status      AS payment_status,
         p.gcash_ref_number,
         p.receipt_image_url,
         p.rejection_reason
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = $1
         AND o.customer_id = $2
         AND o.order_type  = 'online'`,
      [orderId, customerId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const order = orderResult.rows[0];

    // Items
    const itemsResult = await pool.query(
      `SELECT
         oi.menu_item_id,
         mi.name,
         oi.quantity,
         oi.unit_price,
         oi.notes AS note
       FROM order_items oi
       JOIN menu_items  mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    // Delivery
    const deliveryResult = await pool.query(
      `SELECT
         d.status         AS delivery_status,
         d.rider_id,
         d.rider_name,
         d.rider_contact,
         d.assigned_at,
         r.mobile_number  AS rider_mobile,
         r.vehicle_type   AS rider_vehicle
       FROM deliveries d
       LEFT JOIN riders r ON r.id = d.rider_id
       WHERE d.order_id = $1`,
      [orderId]
    );

    const delivery = deliveryResult.rows[0] ?? null;

    return res.json({
      id:              order.id,
      order_number:    order.order_number,
      status:          order.status,
      total_amount:    parseFloat(order.total_amount),
      delivery_preference: order.delivery_preference,
      notes:           order.notes,
      delivery_address:   order.delivery_address,
      delivery_latitude:  order.delivery_latitude,
      delivery_longitude: order.delivery_longitude,
      created_at:      order.created_at,
      updated_at:      order.updated_at,
      payment_method:  order.payment_method,
      payment_status:  order.payment_status,
      gcash_ref_number: order.gcash_ref_number,
      receipt_image_url: order.receipt_image_url,
      rejection_reason: order.rejection_reason,
      items: itemsResult.rows.map((r) => ({
        menu_item_id: r.menu_item_id,
        name:         r.name,
        quantity:     r.quantity,
        unit_price:   parseFloat(r.unit_price),
        note:         r.note,
      })),
      delivery: delivery
        ? {
            status:         delivery.delivery_status,
            rider_name:     delivery.rider_name,
            rider_contact:  delivery.rider_contact ?? delivery.rider_mobile,
            rider_vehicle:  delivery.rider_vehicle,
            assigned_at:    delivery.assigned_at,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/orders/:id/status ───────────────────────────────────────────────
// NEW §1.6 — Lightweight polling endpoint.
// Returns just the order status + delivery status + can_cancel flag.
// Flutter OrderTrackingProvider polls this as a fallback when Socket.io
// is disconnected (every 15 s in the background).
//
// Response shape matches OrderStatusPoll.fromJson() in tracking_models.dart:
//   {
//     id, order_number, status, can_cancel,
//     payment_status,
//     delivery: { status, rider_name, rider_contact, rider_vehicle, assigned_at } | null
//   }

async function getOrderStatus(req, res, next) {
  try {
    const customerId = req.customerId;
    const orderId    = parseInt(req.params.id, 10);

    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    const result = await pool.query(
      `SELECT
         o.id,
         COALESCE(o.order_number, 'BNG-' || o.id::text) AS order_number,
         o.status,
         p.status        AS payment_status,
         o.delivery_preference,
         d.status        AS delivery_status,
         d.rider_name,
         d.rider_contact,
         d.assigned_at,
         r.mobile_number AS rider_mobile,
         r.vehicle_type  AS rider_vehicle
       FROM orders o
       LEFT JOIN payments  p ON p.order_id = o.id
       LEFT JOIN deliveries d ON d.order_id = o.id
       LEFT JOIN riders    r ON r.id = d.rider_id
       WHERE o.id = $1
         AND o.customer_id = $2
         AND o.order_type  = 'online'`,
      [orderId, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const row = result.rows[0];

    // Customer can cancel only while delivery is still pending_assignment
    // and order is not already done/cancelled.
    const canCancel =
      row.delivery_status === 'pending_assignment' &&
      !['cancelled', 'completed'].includes(row.status);

    return res.json({
      id:             row.id,
      order_number:   row.order_number,
      status:         row.status,
      delivery_preference: row.delivery_preference,
      can_cancel:     canCancel,
      payment_status: row.payment_status,
      delivery: row.delivery_status
        ? {
            status:        row.delivery_status,
            rider_name:    row.rider_name    ?? null,
            rider_contact: row.rider_contact ?? row.rider_mobile ?? null,
            rider_vehicle: row.rider_vehicle ?? null,
            assigned_at:   row.assigned_at   ?? null,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/orders/:id/timeline ────────────────────────────────────────────
// NEW §1.6 — Full order status history for the timeline UI.
// Returns ordered list of all status changes with timestamps and human labels.
// Flutter order_tracking_screen.dart renders this as a vertical stepper.
//
// Response shape matches OrderTimeline.fromJson() in tracking_models.dart:
//   {
//     order_id, order_number, current_status,
//     timeline: [
//       { status, label, changed_at, is_completed, is_current } ...
//     ]
//   }
//
// The timeline always includes all canonical statuses in the correct order.
// Statuses the order has already passed through are marked is_completed=true.
// The current status is marked is_current=true.
// Future statuses have is_completed=false, is_current=false, changed_at=null.
// Cancelled orders show only statuses up to (and including) cancelled.

const DELIVERY_STATUS_ORDER = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
];

async function getOrderTimeline(req, res, next) {
  try {
    const customerId = req.customerId;
    const orderId    = parseInt(req.params.id, 10);

    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    // Verify ownership and get current status
    const orderResult = await pool.query(
      `SELECT
         o.id,
         COALESCE(o.order_number, 'BNG-' || o.id::text) AS order_number,
         o.status AS current_status,
         o.delivery_preference
       FROM orders o
       WHERE o.id = $1
         AND o.customer_id = $2
         AND o.order_type  = 'online'`,
      [orderId, customerId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const { order_number, current_status, delivery_preference } = orderResult.rows[0];
    const isPickup = delivery_preference === 'pickup';
    const statusOrder = isPickup ? PICKUP_STATUS_ORDER : DELIVERY_STATUS_ORDER;
    const statusLabels = isPickup ? PICKUP_STATUS_LABELS : STATUS_LABELS;

    // Get the actual history rows (each status change with timestamp)
    const historyResult = await pool.query(
      `SELECT status, changed_at
       FROM order_status_history
       WHERE order_id = $1
       ORDER BY changed_at ASC`,
      [orderId]
    );

    // Build a map: status → first time it was recorded
    const historyMap = new Map();
    for (const row of historyResult.rows) {
      if (!historyMap.has(row.status)) {
        historyMap.set(row.status, row.changed_at);
      }
    }

    // Build the timeline array
    const isCancelled = current_status === 'cancelled';
    let timeline;

    if (isCancelled) {
      // For cancelled orders: show all statuses up to the last completed one,
      // then append the cancelled entry.
      const completedStatuses = statusOrder.filter((s) => historyMap.has(s));
      const cancelledAt = historyMap.get('cancelled') ?? null;

      timeline = completedStatuses.map((status) => ({
        status,
        label:        statusLabels[status] ?? status,
        changed_at:   historyMap.get(status),
        is_completed: true,
        is_current:   false,
      }));

      timeline.push({
        status:       'cancelled',
        label:        statusLabels['cancelled'],
        changed_at:   cancelledAt,
        is_completed: true,
        is_current:   true,
      });
    } else {
      // Normal flow: show all canonical statuses; mark past ones completed.
      const currentIndex = statusOrder.indexOf(current_status);

      timeline = statusOrder.map((status, idx) => {
        const isCompleted = idx < currentIndex || status === current_status;
        const isCurrent   = status === current_status;

        return {
          status,
          label:        statusLabels[status] ?? status,
          changed_at:   historyMap.get(status) ?? null,
          is_completed: isCompleted,
          is_current:   isCurrent,
        };
      });
    }

    return res.json({
      order_id:       orderId,
      order_number,
      current_status,
      delivery_preference,
      timeline,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/orders/:id/cancel ─────────────────────────────────────────────
// Customer can cancel only while deliveries.status = 'pending_assignment'.
// Logs a customer_order_violations entry (violation_type = 'cancelled_before_prep').

async function cancelOrder(req, res, next) {
  const customerId = req.customerId;
  const orderId    = parseInt(req.params.id, 10);

  if (isNaN(orderId)) {
    return res.status(400).json({ message: 'Invalid order ID.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch order + delivery status
    const orderResult = await client.query(
      `SELECT o.status, o.order_number, d.status AS delivery_status
       FROM orders o
       LEFT JOIN deliveries d ON d.order_id = o.id
       WHERE o.id = $1 AND o.customer_id = $2`,
      [orderId, customerId]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found.' });
    }

    const { status, delivery_status, order_number } = orderResult.rows[0];

    // Already cancelled or completed
    if (status === 'cancelled' || status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: `Order is already ${status} and cannot be cancelled.`,
      });
    }

    // Can only cancel while delivery is still pending_assignment
    if (delivery_status && delivery_status !== 'pending_assignment') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: 'Your order is already being prepared and can no longer be cancelled. Please contact the cafe.',
        code: 'cannot_cancel',
      });
    }

    // Cancel order
    await client.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );

    // Update delivery row if present
    if (delivery_status) {
      await client.query(
        `UPDATE deliveries SET status = 'cancelled' WHERE order_id = $1`,
        [orderId]
      );
    }

    // Log status history
    await client.query(
      `INSERT INTO order_status_history (order_id, status) VALUES ($1, 'cancelled')`,
      [orderId]
    );

    // Log violation — cancelled_before_prep (or after if kitchen had started)
    const violationType =
      status === 'preparing' ? 'cancelled_after_prep' : 'cancelled_before_prep';

    await client.query(
      `INSERT INTO customer_order_violations
         (customer_id, order_id, violation_type)
       VALUES ($1, $2, $3)`,
      [customerId, orderId, violationType]
    );

    await client.query('COMMIT');

    // Re-evaluate support chat lock state (non-blocking)
    syncChatLockState(customerId);

    // Notify the customer (in-app row + real-time push to the order tracking
    // room AND the personal notification room) that it was cancelled.
    try {
      await notifyOrderStatus(pool, orderId, customerId, 'cancelled', {
        order_number: order_number ?? null,
      });
    } catch (_) {
      // Notification failure is non-fatal — the order is already cancelled.
    }

    return res.json({ message: 'Order cancelled successfully.', status: 'cancelled' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// ─── POST /api/orders/:id/reupload-receipt ────────────────────────────────────
// Called when staff rejects the GCash receipt and asks the customer to re-upload.
// Accepts: multipart/form-data with field 'receipt' (image file)
// Returns: same shape as /api/payments/extract-receipt
//   { temp_url, gcash_ref_number, gcash_amount, ocr_confidence, ref_found, amount_found }
async function reuploadReceipt(req, res, next) {
  const Tesseract = require('tesseract.js');
  const customerId = req.customerId;
  const orderId    = parseInt(req.params.id, 10);

  if (!req.file) {
    return res.status(422).json({ message: 'No receipt image uploaded.' });
  }

  const client = await pool.connect();
  try {
    // ── Verify order belongs to this customer and payment is 'rejected' ──
    const { rows } = await client.query(
      `SELECT o.id, p.id AS payment_id, p.status AS payment_status
         FROM orders o
         JOIN payments p ON p.order_id = o.id
        WHERE o.id = $1 AND o.customer_id = $2
        LIMIT 1`,
      [orderId, customerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const payment = rows[0];
    if (payment.payment_status !== 'rejected') {
      return res.status(409).json({
        message: 'Receipt can only be re-uploaded when payment is rejected.',
      });
    }

    const tempUrl = req.file.path; // new Cloudinary URL

    // ── OCR ──────────────────────────────────────────────────────────────
    let gcashRef      = null;
    let gcashAmount   = null;
    let ocrConfidence = 0;

    try {
      const { data } = await Tesseract.recognize(tempUrl, 'eng', { logger: () => {} });
      const ocrText  = data.text ?? '';
      ocrConfidence  = Math.round(data.confidence ?? 0);

      // Reuse same extractors from payments.controller
      const { extractGcashRef, extractGcashAmount } = require('../payments/payments.controller');
      gcashRef    = extractGcashRef(ocrText);
      gcashAmount = extractGcashAmount(ocrText);
    } catch (ocrErr) {
      console.error('[OCR] reupload-receipt failed:', ocrErr.message);
    }

    // ── Update payments row — keep old receipt for cashier comparison ─────
    await client.query(
      `UPDATE payments
          SET previous_receipt_image_url = receipt_image_url,
              receipt_image_url          = $1,
              gcash_ref_number           = $2,
              gcash_amount_sent          = $3,
              status                     = 'awaiting_verification',
              rejection_reason           = NULL,
              receipt_uploaded_at        = NOW(),
              verified_by                = NULL,
              verified_at                = NULL
        WHERE id = $4`,
      [tempUrl, gcashRef, gcashAmount, payment.payment_id]
    );

    // ── Notify staff via socket (non-fatal) ───────────────────────────────
    try {
      const { notifyOrderStatus } = require('../../utils/payment_notifications');
      await notifyOrderStatus(pool, orderId, customerId, 'receipt_resubmitted', {});
    } catch (_) {}

    return res.json({
      temp_url:         tempUrl,
      gcash_ref_number: gcashRef,
      gcash_amount:     gcashAmount,
      ocr_confidence:   ocrConfidence,
      ref_found:        gcashRef    !== null,
      amount_found:     gcashAmount !== null,
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

// ─── GET /api/orders/:id/rider-location ───────────────────────────────────────
// §1.9 Rider Live Location
//
// Returns the latest GPS coordinates of the rider assigned to this order.
// Only available when order status = 'out_for_delivery' and the delivery
// has an assigned rider with a row in rider_locations.
//
// Responses:
//   200  { order_id, rider_id, latitude, longitude, accuracy, updated_at }
//   204  (no content) — not yet out_for_delivery, or no rider GPS fix yet
//   404  — order not found / doesn't belong to this customer
//
// The Flutter app polls this every 10 s as a fallback.
// The backend also pushes `rider_location_update` via Socket.io in real time
// whenever a rider submits a new position (PUT /api/rider/location).

async function getRiderLocation(req, res, next) {
  try {
    const customerId = req.customerId;
    const orderId    = parseInt(req.params.id, 10);

    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    const result = await pool.query(
      `SELECT
         o.id            AS order_id,
         o.status        AS order_status,
         d.rider_id,
         rl.latitude,
         rl.longitude,
         rl.accuracy,
         rl.updated_at
       FROM orders o
       LEFT JOIN deliveries      d  ON d.order_id  = o.id
       LEFT JOIN rider_locations rl ON rl.rider_id = d.rider_id
       WHERE o.id          = $1
         AND o.customer_id = $2
         AND o.order_type  = 'online'
       LIMIT 1`,
      [orderId, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const row = result.rows[0];

    // Only expose location when rider is actively delivering
    if (row.order_status !== 'out_for_delivery') {
      return res.status(204).end();
    }

    // Rider assigned but no GPS fix yet
    if (row.rider_id == null || row.latitude == null) {
      return res.status(204).end();
    }

    return res.json({
      order_id:   row.order_id,
      rider_id:   row.rider_id,
      latitude:   parseFloat(row.latitude),
      longitude:  parseFloat(row.longitude),
      accuracy:   row.accuracy   ? parseFloat(row.accuracy)  : null,
      updated_at: row.updated_at ? row.updated_at.toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
}

async function getCheckoutConfig(req, res, next) {
  try {
    let deliveryFee = { enabled: false, amount: 0 };
    try {
      const { rows } = await pool.query(
        `SELECT value FROM system_settings WHERE key = 'delivery_fee'`
      );
      if (rows.length > 0) {
        const setting = rows[0].value;
        if (setting?.enabled === true) {
          deliveryFee = { enabled: true, amount: setting.amount ?? 0 };
        }
      }
    } catch (err) {
      console.error('[getCheckoutConfig] delivery fee lookup failed:', err.message);
    }

    let qrCodes = [];
    try {
      const { rows } = await pool.query(
        `SELECT id, name, number, image_url
           FROM payment_qr_codes
          WHERE is_active = TRUE
          ORDER BY display_order ASC, id ASC`
      );
      qrCodes = rows;
    } catch (err) {
      console.error('[getCheckoutConfig] QR codes unavailable:', err.message);
    }

    let ridersAvailable = true;
    try {
      const { rows } = await pool.query(
        `SELECT 1
           FROM riders
          WHERE work_status = 'working'
             OR admin_work_override = 'working'
          LIMIT 1`
      );
      ridersAvailable = rows.length > 0;
    } catch (err) {
      console.error('[getCheckoutConfig] rider availability check failed:', err.message);
    }

    return res.status(200).json({
      delivery_fee: deliveryFee,
      payment_qr_codes: qrCodes,
      riders_available: ridersAvailable,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  placeOrder,
  getCheckoutConfig,
  listOrders,
  getOrder,
  getOrderStatus,    // ← §1.6
  getOrderTimeline,  // ← §1.6
  cancelOrder,
  reuploadReceipt,
  getRiderLocation,  // ← §1.9 NEW
  STATUS_LABELS,     // ← exported for use in notification helpers
};