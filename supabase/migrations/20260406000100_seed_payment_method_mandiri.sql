-- Seeder: 1 metode pembayaran Bank Mandiri untuk cabang pertama (aktif)
-- Nama pemilik: BAYU LIANO LEADER HA
-- Rekening  : 1780006318634

DO $$
DECLARE
  v_branch_id UUID;
BEGIN
  -- Ambil branch pertama yang aktif (urut by name)
  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE is_active = true
  ORDER BY name ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE NOTICE 'Tidak ada cabang aktif ditemukan, seeder dilewati.';
    RETURN;
  END IF;

  -- Insert hanya jika belum ada (idempotent)
  INSERT INTO public.payment_methods (
    branch_id,
    name,
    type,
    bank_name,
    account_number,
    account_name,
    is_active,
    sort_order
  )
  SELECT
    v_branch_id,
    'Mandiri',
    'bank_transfer',
    'Bank Mandiri',
    '1780006318634',
    'BAYU LIANO LEADER HA',
    true,
    0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_methods
    WHERE branch_id   = v_branch_id
      AND bank_name   = 'Bank Mandiri'
      AND account_number = '1780006318634'
  );

  RAISE NOTICE 'Seeder payment_methods: Bank Mandiri 1780006318634 selesai untuk branch %', v_branch_id;
END;
$$;
