-- Seeder: metode pembayaran manual untuk cabang pertama
-- Bank Mandiri  : BAYU LIANO HABIBULLAH — 1780006318634
-- SeaBank       : BAYU LIANO HABIBULLAH — 0812345678

DO $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE is_active = true
  ORDER BY name ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE NOTICE 'Tidak ada cabang aktif, seeder dilewati.';
    RETURN;
  END IF;

  -- Bank Mandiri
  INSERT INTO public.payment_methods (
    branch_id, name, type, bank_name, account_number, account_name, is_active, sort_order
  )
  SELECT
    v_branch_id,
    'Mandiri',
    'bank_transfer',
    'Bank Mandiri',
    '1780006318634',
    'BAYU LIANO HABIBULLAH',
    true,
    0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_methods
    WHERE branch_id = v_branch_id AND bank_name = 'Bank Mandiri' AND account_number = '1780006318634'
  );

  -- SeaBank
  INSERT INTO public.payment_methods (
    branch_id, name, type, bank_name, account_number, account_name, is_active, sort_order
  )
  SELECT
    v_branch_id,
    'SeaBank',
    'bank_transfer',
    'SeaBank',
    '0812345678',
    'BAYU LIANO HABIBULLAH',
    true,
    1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_methods
    WHERE branch_id = v_branch_id AND bank_name = 'SeaBank' AND account_number = '0812345678'
  );

  RAISE NOTICE 'Seeder payment_methods selesai untuk branch %', v_branch_id;
END;
$$;
