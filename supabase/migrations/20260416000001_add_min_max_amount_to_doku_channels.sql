-- Tambah kolom min_amount dan max_amount ke doku_payment_channels
-- Digunakan untuk validasi di FE (disable card jika total di luar range)

ALTER TABLE public.doku_payment_channels
  ADD COLUMN IF NOT EXISTS min_amount integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_amount integer DEFAULT NULL;

-- ── Virtual Account (semua bank) → min Rp 10.000 ────────────────────────────
UPDATE public.doku_payment_channels
SET min_amount = 10000
WHERE section = 'va';

-- ── PayLater ─────────────────────────────────────────────────────────────────
UPDATE public.doku_payment_channels SET min_amount = 300000 WHERE channel_key = 'pl_akulaku';
UPDATE public.doku_payment_channels SET min_amount = 300000 WHERE channel_key = 'pl_kredivo';
UPDATE public.doku_payment_channels SET min_amount = 300000 WHERE channel_key = 'pl_briceria';
UPDATE public.doku_payment_channels SET min_amount = 300000 WHERE channel_key = 'pl_indodana';

-- ── E-wallet → min Rp 1.000 ──────────────────────────────────────────────────
UPDATE public.doku_payment_channels SET min_amount = 1000 WHERE section = 'ewallet';

-- ── QRIS → min Rp 1 (sesuai regulasi BI) ────────────────────────────────────
UPDATE public.doku_payment_channels SET min_amount = 1 WHERE channel_key = 'qris';

-- ── QRIS max Rp 10.000.000 (batas QRIS per transaksi) ───────────────────────
UPDATE public.doku_payment_channels SET max_amount = 10000000 WHERE channel_key = 'qris';

-- ── Kartu Kredit → min Rp 10.000 ─────────────────────────────────────────────
UPDATE public.doku_payment_channels SET min_amount = 10000 WHERE channel_key = 'cc';

-- ── Over-the-counter (Alfamart, Indomaret) → min Rp 10.000 ──────────────────
UPDATE public.doku_payment_channels SET min_amount = 10000 WHERE section = 'other' AND channel_key LIKE 'otc_%';
