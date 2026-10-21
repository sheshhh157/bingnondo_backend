'use strict';

/**
 * customer.controller.js  —  §1.1b + §1.5 Customer Profile
 * ──────────────────────────────────────────────────────────
 * Routes (all require requireCustomer middleware):
 *   GET  /api/customer/profile          → fetch profile + restriction_level
 *   PUT  /api/customer/profile          → complete / update profile
 *
 * Used by:
 *   - Cart gate check (CartProvider.checkProfileGate)
 *   - Complete Profile screen (§1.1b)
 *   - Account Settings screen (§1.9)
 */

const pool = require('../../config/db');

// ─── GET /api/customer/profile ────────────────────────────────────────────────
//
// Returns the customer row + restriction_level from customer_restrictions.
// This is the shape CartProvider.CustomerProfile.fromJson() expects.

async function getProfile(req, res, next) {
  try {
    const customerId = req.customerId; // set by requireCustomer middleware

    const result = await pool.query(
      `SELECT
         c.id,
         c.email,
         c.first_name,
         c.last_name,
         c.mobile_number,
         c.mobile_verified,
         c.address,
         c.latitude,
         c.longitude,
         c.profile_completed,
         c.status,
         COALESCE(cr.restriction_level, 'none') AS restriction_level
       FROM customers c
       LEFT JOIN customer_restrictions cr ON cr.customer_id = c.id
       WHERE c.id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const row = result.rows[0];

    return res.json({
      id:                row.id,
      email:             row.email,
      first_name:        row.first_name,
      last_name:         row.last_name,
      mobile_number:     row.mobile_number,
      mobile_verified:   row.mobile_verified,
      address:           row.address,
      latitude:          row.latitude,
      longitude:         row.longitude,
      profile_completed: row.profile_completed,
      status:            row.status,
      restriction_level: row.restriction_level,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/customer/profile ────────────────────────────────────────────────
//
// Used for §1.1b (first-time profile completion) and §1.9 (settings update).
//
// Accepted fields:
//   first_name, last_name, mobile_number, address, latitude, longitude
//
// Rules:
//   - Once all four text fields are provided, profile_completed is set to TRUE.
//   - latitude/longitude are the saved default delivery pin (optional).
//   - mobile_number change does NOT re-trigger OTP here (OTP is a separate
//     flow). The mobile_number is stored and mobile_verified reset to FALSE
//     if the number changed — staff / a separate verify endpoint handles OTP.
//   - Blank strings are treated as missing (not stored).

async function updateProfile(req, res, next) {
  try {
    const customerId = req.customerId;
    const { first_name, last_name, mobile_number, address, latitude, longitude } = req.body;

    // Fetch current row first
    const current = await pool.query(
      'SELECT first_name, last_name, mobile_number, address, latitude, longitude, mobile_verified FROM customers WHERE id = $1',
      [customerId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const cur = current.rows[0];

    // Merge: use incoming value if non-empty, else keep existing
    const newFirstName    = (first_name    || '').trim() || cur.first_name;
    const newLastName     = (last_name     || '').trim() || cur.last_name;
    const newAddress      = (address       || '').trim() || cur.address;
    const newMobileNumber = (mobile_number || '').trim() || cur.mobile_number;

    // Coordinates: only overwrite when a finite number is supplied.
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    const newLatitude  = Number.isFinite(latNum) && latNum >= -90  && latNum <= 90
      ? latNum
      : cur.latitude;
    const newLongitude = Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180
      ? lngNum
      : cur.longitude;

    // If mobile_number changed, reset mobile_verified
    const mobileChanged    = newMobileNumber !== cur.mobile_number;
    const newMobileVerified = mobileChanged ? false : cur.mobile_verified;

    // If mobile changed, check uniqueness
    if (mobileChanged && newMobileNumber) {
      const conflict = await pool.query(
        'SELECT id FROM customers WHERE mobile_number = $1 AND id <> $2',
        [newMobileNumber, customerId]
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({
          message: 'This mobile number is already linked to another account.',
        });
      }
    }

    // profile_completed = TRUE when all four required fields are present
    const profileCompleted =
      !!(newFirstName && newLastName && newMobileNumber && newAddress);

    const updated = await pool.query(
      `UPDATE customers
       SET first_name        = $1,
           last_name         = $2,
           mobile_number     = $3,
           address           = $4,
           latitude          = $5,
           longitude         = $6,
           mobile_verified   = $7,
           profile_completed = $8,
           updated_at        = NOW()
       WHERE id = $9
       RETURNING id, email, first_name, last_name, mobile_number,
                 mobile_verified, address, latitude, longitude,
                 profile_completed, status`,
      [
        newFirstName,
        newLastName,
        newMobileNumber || null,
        newAddress      || null,
        newLatitude,
        newLongitude,
        newMobileVerified,
        profileCompleted,
        customerId,
      ]
    );

    const row = updated.rows[0];

    // Fetch restriction_level to include in response
    const restriction = await pool.query(
      `SELECT COALESCE(restriction_level, 'none') AS restriction_level
       FROM customer_restrictions WHERE customer_id = $1`,
      [customerId]
    );
    const restrictionLevel =
      restriction.rows.length > 0
        ? restriction.rows[0].restriction_level
        : 'none';

    return res.json({
      id:                row.id,
      email:             row.email,
      first_name:        row.first_name,
      last_name:         row.last_name,
      mobile_number:     row.mobile_number,
      mobile_verified:   row.mobile_verified,
      address:           row.address,
      latitude:          row.latitude,
      longitude:         row.longitude,
      profile_completed: row.profile_completed,
      status:            row.status,
      restriction_level: restrictionLevel,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile };