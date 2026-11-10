'use strict';

/**
 * rider_location_route.js  —  §1.9 Rider Live Location
 * ─────────────────────────────────────────────────────────────────────────────
 * File path: src/modules/rider/rider_location_route.js
 *
 * PUT /api/rider/location
 *   Body: { rider_id, latitude, longitude, accuracy? }
 *
 * Called by the rider app / admin dashboard to push a fresh GPS position.
 * Does two things:
 *   1. Upserts rider_locations (one row per rider, updated in place)
 *   2. Emits `rider_location_update` via Socket.io to every order room where
 *      this rider has an active out_for_delivery order — so the customer's
 *      tracking screen moves the map marker in real time without polling.
 *
 * Authentication:
 *   Accepts a Bearer token that matches INTERNAL_API_KEY in .env.
 *   In development (NODE_ENV != 'production') any non-empty Bearer token works.
 *   Swap for proper rider JWT once the rider app has its own auth flow.
 *
 * Response:
 *   200  { ok: true, updated_orders: <number of active orders notified> }
 *   400  missing / invalid body
 *   401  missing / wrong auth token
 *   422  coordinates out of valid range
 */

const express = require('express');
const db      = require('../../config/db');
const { emitRiderLocation } = require('../../sockets/socket');

const router = express.Router();

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireRiderAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.replace(/^Bearer\s+/i, '').trim();
  const internalKey = (process.env.INTERNAL_API_KEY || '').trim();

  // Accept internal API key (staff portal / admin dashboard)
  if (internalKey && token === internalKey) return next();

  // Dev: accept any non-empty token so you can test without a key
  if (process.env.NODE_ENV !== 'production' && token.length > 0) return next();

  return res.status(401).json({ message: 'Unauthorized.' });
}

// ── PUT /api/rider/location ───────────────────────────────────────────────────
router.put('/location', requireRiderAuth, async (req, res, next) => {
  try {
    const { rider_id, latitude, longitude, accuracy } = req.body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (rider_id == null || latitude == null || longitude == null) {
      return res.status(400).json({
        message: 'rider_id, latitude, and longitude are required.',
      });
    }

    const riderId = parseInt(rider_id, 10);
    const lat     = parseFloat(latitude);
    const lng     = parseFloat(longitude);
    const acc     = accuracy != null ? parseFloat(accuracy) : null;

    if (isNaN(riderId) || riderId <= 0) {
      return res.status(422).json({ message: 'Invalid rider_id.' });
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(422).json({ message: 'latitude must be between -90 and 90.' });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(422).json({ message: 'longitude must be between -180 and 180.' });
    }

    // ── Upsert rider_locations ────────────────────────────────────────────────
    // One row per rider — INSERT on first fix, UPDATE on every subsequent ping.
    await db.query(
      `INSERT INTO rider_locations (rider_id, latitude, longitude, accuracy, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (rider_id) DO UPDATE
         SET latitude   = EXCLUDED.latitude,
             longitude  = EXCLUDED.longitude,
             accuracy   = EXCLUDED.accuracy,
             updated_at = NOW()`,
      [riderId, lat, lng, acc]
    );

    // ── Find all active orders assigned to this rider ─────────────────────────
    // We only push to orders that are currently `out_for_delivery` so we don't
    // leak location to orders that haven't been dispatched yet.
    const activeOrders = await db.query(
      `SELECT o.id AS order_id
         FROM deliveries d
         JOIN orders o ON o.id = d.order_id
        WHERE d.rider_id = $1
          AND o.status   = 'out_for_delivery'`,
      [riderId]
    );

    // ── Emit rider_location_update to each order's Socket.io room ────────────
    const now     = new Date().toISOString();
    const payload = {
      rider_id:   riderId,
      latitude:   lat,
      longitude:  lng,
      accuracy:   acc,
      updated_at: now,
    };

    for (const row of activeOrders.rows) {
      emitRiderLocation(row.order_id, {
        order_id: row.order_id,
        ...payload,
      });
    }

    return res.json({
      ok:             true,
      updated_orders: activeOrders.rows.length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;