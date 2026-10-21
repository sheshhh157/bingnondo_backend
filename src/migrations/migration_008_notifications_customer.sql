-- ============================================================
-- Migration 008 — Extend notifications table for §1.8
-- ============================================================
-- The original notifications table was designed for staff-side alerts.
-- This migration adds customer_id + message so the customer mobile app
-- can fetch its own in-app notifications.
--
-- Existing staff-side rows are NOT affected — they will have
-- customer_id = NULL and message = NULL (nullable columns).
-- ============================================================

-- 1. Add customer_id FK (nullable — staff notifs keep NULL here)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE;

-- 2. Add human-readable message column
--    order_notifications.js already inserts a message string — this
--    column stores it so the Flutter app can display it directly.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS message TEXT;

-- 3. Index for the customer-facing GET /api/customer/notifications query
CREATE INDEX IF NOT EXISTS idx_notifications_customer
  ON notifications(customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- 4. (Optional) Backfill: ensure all existing rows inserted by
--    order_notifications.js land cleanly. No data migration needed
--    because order_notifications.js already uses the new INSERT shape
--    after this migration is applied.

-- ============================================================
-- END OF MIGRATION 008
-- ============================================================
