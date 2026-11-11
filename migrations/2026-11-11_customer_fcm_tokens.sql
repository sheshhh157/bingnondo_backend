CREATE TABLE IF NOT EXISTS customer_fcm_tokens (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL UNIQUE,
  platform VARCHAR(10) NOT NULL DEFAULT 'unknown'
    CHECK (platform IN ('android', 'ios', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_fcm_tokens_customer
  ON customer_fcm_tokens(customer_id);
