-- Remove mobile-number OTP authentication while preserving customer accounts
-- and customers.mobile_number profile/contact data.
BEGIN;

-- Invalidate mobile-verification OTPs and outstanding SMS password-reset OTPs.
DELETE FROM otp_verifications
WHERE purpose = 'mobile_verification'
   OR (
     purpose = 'password_reset'
     AND contact IN (
       SELECT mobile_number
       FROM customers
       WHERE mobile_number IS NOT NULL
     )
   );

ALTER TABLE otp_verifications
  DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;

ALTER TABLE otp_verifications
  ADD CONSTRAINT otp_verifications_purpose_check
  CHECK (purpose IN ('email_verification', 'password_reset'));

-- Mobile verification was an SMS-authentication flag, not contact data.
ALTER TABLE customers
  DROP COLUMN IF EXISTS mobile_verified;

-- Unverified mobile-only registrations have no customer account and cannot
-- continue after mobile OTP authentication is removed.
DELETE FROM pending_registrations WHERE email IS NULL;

DROP INDEX IF EXISTS pending_registrations_email_key;
DROP INDEX IF EXISTS pending_registrations_mobile_key;

DO $$
DECLARE
  primary_key_name TEXT;
BEGIN
  SELECT constraint_name
    INTO primary_key_name
    FROM information_schema.table_constraints
   WHERE table_schema = current_schema()
     AND table_name = 'pending_registrations'
     AND constraint_type = 'PRIMARY KEY'
   LIMIT 1;

  IF primary_key_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE pending_registrations DROP CONSTRAINT %I',
      primary_key_name
    );
  END IF;
END
$$;

ALTER TABLE pending_registrations
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE pending_registrations
  DROP COLUMN IF EXISTS mobile_number,
  DROP COLUMN IF EXISTS id;

ALTER TABLE pending_registrations
  ADD PRIMARY KEY (email);

COMMIT;
