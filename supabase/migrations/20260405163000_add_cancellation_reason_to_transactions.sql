-- Add cancellation_reason column for tracking why transactions were cancelled
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
