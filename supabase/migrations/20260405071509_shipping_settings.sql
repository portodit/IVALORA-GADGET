-- ─────────────────────────────────────────────────────────
-- Migration: shipping_settings + rajaongkir_api_keys.priority
-- Tanggal: 2026-04-05
-- ─────────────────────────────────────────────────────────

-- 1. Tambah kolom priority ke rajaongkir_api_keys (kalau belum ada)
ALTER TABLE public.rajaongkir_api_keys
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 1;

-- 2. Tabel shipping_settings (singleton config)
CREATE TABLE public.shipping_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Biaya packing kayu: global = default semua wilayah
  -- Per-pulau: NULL berarti pakai harga global
  packing_kayu_global     INTEGER NOT NULL DEFAULT 50000,
  packing_kayu_jawa       INTEGER,          -- Jawa + Bali
  packing_kayu_sumatra    INTEGER,          -- Sumatera
  packing_kayu_kalimantan INTEGER,          -- Kalimantan
  packing_kayu_sulawesi   INTEGER,          -- Sulawesi
  packing_kayu_ntt        INTEGER,          -- Nusa Tenggara (NTB + NTT)
  packing_kayu_maluku     INTEGER,          -- Maluku + Maluku Utara
  packing_kayu_papua      INTEGER,          -- Papua + Papua Barat

  -- Kurir yang diaktifkan (array kode kurir)
  enabled_couriers        TEXT[] NOT NULL DEFAULT '{jne,pos,tiki,sicepat,jnt}',

  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by              UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;

-- Semua admin bisa baca
CREATE POLICY "Admin read shipping_settings"
  ON public.shipping_settings FOR SELECT TO authenticated
  USING (true);

-- Hanya super_admin yang bisa ubah
CREATE POLICY "Super admin manage shipping_settings"
  ON public.shipping_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed: 1 row saja (singleton)
INSERT INTO public.shipping_settings (packing_kayu_global, enabled_couriers)
VALUES (50000, '{jne,pos,tiki,sicepat,jnt}');
