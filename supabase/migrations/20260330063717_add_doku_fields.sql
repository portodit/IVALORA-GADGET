ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS doku_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS doku_token_id TEXT,
  ADD COLUMN IF NOT EXISTS doku_expired_date TEXT;
