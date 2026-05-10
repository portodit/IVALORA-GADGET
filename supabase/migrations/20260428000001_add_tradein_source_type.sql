-- Add source_type column to transactions for tracking transaction type (beli/tukar_tambah/jual_putus)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_type TEXT;

-- Add trade_in_pending status label
INSERT INTO stock_status_labels (key, label, hue, sat, light, is_active)
VALUES ('trade_in_pending', 'Pending Verifikasi', 35, 70, 50, true)
ON CONFLICT (key) DO NOTHING;