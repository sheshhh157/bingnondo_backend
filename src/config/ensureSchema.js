'use strict';

/**
 * ensureSchema.js  —  Idempotent schema top-ups
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs on every boot. Every statement uses IF NOT EXISTS or DO$$ guards.
 *
 * Covers address pin and checkout columns. Auth schema changes are managed
 * through explicit migrations rather than on every application boot.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const pool = require('./db');

// ─── 1. Address pin location (original) ──────────────────────────────────────

const ADDRESS_PIN_STATEMENTS = [
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,7)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`,
  `ALTER TABLE orders    ADD COLUMN IF NOT EXISTS delivery_address   TEXT`,
  `ALTER TABLE orders    ADD COLUMN IF NOT EXISTS delivery_latitude  NUMERIC(10,7)`,
  `ALTER TABLE orders    ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10,7)`,
];

const ORDER_CHECKOUT_STATEMENTS = [
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0`,
  `ALTER TABLE orders
     ADD COLUMN IF NOT EXISTS delivery_preference VARCHAR(20) NOT NULL DEFAULT 'own_delivery'`,
  `UPDATE orders o
      SET delivery_preference = d.delivery_preference
     FROM deliveries d
    WHERE d.order_id = o.id
      AND o.delivery_preference = 'own_delivery'
      AND d.delivery_preference IN ('own_delivery', 'lalamove')`,
];

async function ensureSchema() {
  // 1. Address pin columns
  for (const sql of ADDRESS_PIN_STATEMENTS) {
    await pool.query(sql);
  }
  console.log('[schema] Address pin location columns: OK');

  for (const sql of ORDER_CHECKOUT_STATEMENTS) {
    await pool.query(sql);
  }
  console.log('[schema] Order checkout columns: OK');

}

module.exports = ensureSchema;
