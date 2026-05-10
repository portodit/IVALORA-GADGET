-- Add admin_notes column to transactions for internal flagging (e.g. orphan DOKU payments)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_notes TEXT;
