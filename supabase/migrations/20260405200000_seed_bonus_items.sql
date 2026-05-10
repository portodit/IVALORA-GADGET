-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: bonus_items — data awal item bonus IVALORA GADGET
-- Foto sudah di-upload ke Supabase Storage (catalog-images/bonus/)
-- Gunakan ON CONFLICT DO UPDATE agar aman dijalankan ulang
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Master produk aksesoris untuk adaptor (track_stock items) ────────────
INSERT INTO master_products (id, series, category, is_active)
VALUES
  ('91275861-3f7f-4305-a550-c606cfe4d9d0', 'U1me Adaptor + Cable MFI',  'accessory', true),
  ('e8277867-6f70-4309-bbc8-07bed64d8752', 'UGREEN Adaptor MFI 20W',     'accessory', true),
  ('f3ea2f9a-bb65-42b3-b043-aabbdbb0a5d3', 'U1me Adaptor MFI 20W GaN',   'accessory', true)
ON CONFLICT (id) DO UPDATE SET
  series      = EXCLUDED.series,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active;

-- ── 2. Bonus items ───────────────────────────────────────────────────────────
INSERT INTO bonus_items (id, name, description, icon, sort_order, is_active, track_stock, master_product_id)
VALUES
  (
    '315838e2-7df9-4283-b21c-e8fe25522b03',
    'Sinyal Permanen',
    'Garansi jaringan internet iPhone aktif dan terdeteksi sinyal — tidak ada masalah signal drop setelah pembelian.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/garansi_jaringan.jpeg',
    1, true, false, null
  ),
  (
    'b509e485-3ab8-4ffe-aa33-abafc249beab',
    'Softcase',
    'Pelindung belakang iPhone dari bahan silikon premium, menjaga body dari goresan dan benturan ringan.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/softcase.jpeg',
    2, true, false, null
  ),
  (
    'd43fb693-d880-4446-ba0d-6b9acf44c26f',
    'Temperglass',
    'Pelindung layar kaca antigores 9H, menjaga layar iPhone tetap mulus dari goresan sehari-hari.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/temperglass.jpeg',
    3, true, false, null
  ),
  (
    '78e8b2d7-4179-4114-bb06-1287428412eb',
    'Asuransi Pengiriman',
    'Proteksi pengiriman dari kerusakan dan kehilangan. Barang aman sampai tujuan.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/asuransi_pengiriman.jpeg',
    4, true, false, null
  ),
  (
    '39e78f22-b805-4e4e-b3af-a9da9085b3a5',
    'Garansi Unit 30 Hari',
    'Garansi penuh 30 hari dari Ivalora Gadget. Jika ada masalah pada unit, langsung bisa klaim tanpa ribet.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/garansi_unit.jpeg',
    5, true, false, null
  ),
  (
    'fd945023-976e-4b79-bd84-85262e6cd295',
    'Extra Bubble Wrap',
    'Pembungkusan ekstra dengan bubble wrap tebal untuk perlindungan maksimal saat pengiriman.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/bubble_wrap.jpeg',
    6, true, false, null
  ),
  (
    'dd5b81d4-b8c5-4e10-9418-4e95261183cf',
    'U1me Adaptor + Cable MFI',
    'Adaptor charger U1me dengan kabel MFI original. Compatible resmi dengan iPhone, pengisian cepat dan aman.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/adaptor_ugreen.jpeg',
    7, true, true,
    '91275861-3f7f-4305-a550-c606cfe4d9d0'
  ),
  (
    '05780831-c853-4570-89d6-48a2c413b0d7',
    'UGREEN Adaptor MFI 20W',
    'Adaptor fast charging UGREEN 20W bersertifikasi MFI. Pengisian cepat dan efisien, cocok untuk iPhone terbaru.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/adaptor_ugreen.jpeg',
    8, true, true,
    'e8277867-6f70-4309-bbc8-07bed64d8752'
  ),
  (
    '1cc840bc-4bcb-44c6-b1b7-8d4ddbe5a7a4',
    'U1me Adaptor MFI 20W GaN',
    'Adaptor GaN U1me 20W ultra-compact bersertifikasi MFI. Ukuran kecil, tenaga besar, tidak panas berlebih.',
    'https://mreqldvlkkedcgyxcaon.supabase.co/storage/v1/object/public/catalog-images/bonus/adaptor_ugreen.jpeg',
    9, true, true,
    'f3ea2f9a-bb65-42b3-b043-aabbdbb0a5d3'
  )
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  description       = EXCLUDED.description,
  icon              = EXCLUDED.icon,
  sort_order        = EXCLUDED.sort_order,
  is_active         = EXCLUDED.is_active,
  track_stock       = EXCLUDED.track_stock,
  master_product_id = EXCLUDED.master_product_id;
