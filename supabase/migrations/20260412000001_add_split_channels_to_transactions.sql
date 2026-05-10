-- Add split_channels JSONB column to transactions
-- Stores per-channel data for split payment transactions
-- Each element: { idx, type, method_key, method_name, nominal, fee, include_fee,
--                status, doku_payment_url, doku_va_number, doku_token_id,
--                doku_expired_date, payment_proof_url, admin_notified,
--                confirmed_at, confirmed_by }
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS split_channels JSONB;
