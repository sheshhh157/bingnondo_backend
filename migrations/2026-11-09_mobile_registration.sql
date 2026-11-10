-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Mobile Number Registration Support
-- Date: 2026-11-09
-- Description:
--   Adds mobile_number to pending_registrations so that the mobile-first
--   registration flow can store a pending record before OTP verification.
--
--   Also widens the otp_verifications.purpose CHECK constraint to allow
--   'mobile_verification' (already present in the DB dump, confirmed safe).
--
-- Safe to run multiple times (all statements use IF NOT EXISTS / OR REPLACE).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add mobile_number column to pending_registrations
--    NULL = email-registered pending record (old flow, unchanged)
--    value = mobile-registered pending record (new flow)
ALTER TABLE pending_registrations
  ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);

-- 2. Relax the unique constraint on pending_registrations so a mobile
--    registration doesn't collide with the email PK.
--    The table currently has: PRIMARY KEY (email)
--    We need a row for mobile-only registrations where email is NULL.
--    Solution: change the PK to a surrogate id, make email nullable.
--
--    NOTE: Only run steps 3-6 if you want to allow mobile-only accounts
--    with no email at all. If email will always be collected, skip them.

-- 3. Make email nullable in pending_registrations (email-only flow still works)
ALTER TABLE pending_registrations
  ALTER COLUMN email DROP NOT NULL;

-- 4. Add a surrogate PK id column (pending_registrations had email as PK)
ALTER TABLE pending_registrations
  ADD COLUMN IF NOT EXISTS id SERIAL;

-- 5. Drop old PK on email
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'pending_registrations'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'pending_registrations_pkey'
  ) THEN
    ALTER TABLE pending_registrations DROP CONSTRAINT pending_registrations_pkey;
  END IF;
END$$;

-- 6. Add new PK on id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'pending_registrations'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE pending_registrations ADD PRIMARY KEY (id);
  END IF;
END$$;

-- 7. Add unique index on email (partial — only for non-null emails)
CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_email_key
  ON pending_registrations (email)
  WHERE email IS NOT NULL;

-- 8. Add unique index on mobile_number (partial — only for non-null mobiles)
CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_mobile_key
  ON pending_registrations (mobile_number)
  WHERE mobile_number IS NOT NULL;

-- 9. Ensure otp_verifications allows 'mobile_verification' purpose
--    (already in the DB dump CHECK constraint — this is a safety net)
DO $$
BEGIN
  -- Drop old constraint if it doesn't include mobile_verification
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'otp_verifications_purpose_check'
  ) THEN
    ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
  END IF;

  ALTER TABLE otp_verifications
    ADD CONSTRAINT otp_verifications_purpose_check
    CHECK (purpose IN ('email_verification', 'mobile_verification', 'password_reset'));
END$$;

-- Done.
