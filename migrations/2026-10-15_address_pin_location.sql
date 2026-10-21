-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-15 — Pin-drop delivery address
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds latitude/longitude to customers (saved default pin) and a per-order
-- delivery snapshot (address + coordinates) to orders.
--
-- This mirrors src/config/ensureSchema.js, which the server also runs
-- automatically on boot. You only need to run this by hand if you prefer to
-- apply the change manually.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE customers ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,7);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address   TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude  NUMERIC(10,7);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10,7);
