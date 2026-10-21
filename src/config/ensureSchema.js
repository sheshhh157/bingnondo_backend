'use strict';

/**
 * ensureSchema.js  —  Idempotent schema top-ups
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds the columns required by the pin-drop delivery address feature.
 * Safe to run on every boot: every statement uses IF NOT EXISTS.
 *
 *   customers.latitude / longitude          → last saved default pin
 *   orders.delivery_address / _latitude / _longitude
 *                                           → per-order snapshot of the pin
 *
 * A hand-runnable copy lives in  migrations/2026-10-15_address_pin_location.sql
 */

const pool = require('./db');

const STATEMENTS = [
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,7)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`,
  `ALTER TABLE orders    ADD COLUMN IF NOT EXISTS delivery_address   TEXT`,
  `ALTER TABLE orders    ADD COLUMN IF NOT EXISTS delivery_latitude  NUMERIC(10,7)`,
  `ALTER TABLE orders    ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10,7)`,
];

async function ensureSchema() {
  for (const sql of STATEMENTS) {
    await pool.query(sql);
  }
  console.log('Schema ensured: address pin location columns');
}

module.exports = ensureSchema;
