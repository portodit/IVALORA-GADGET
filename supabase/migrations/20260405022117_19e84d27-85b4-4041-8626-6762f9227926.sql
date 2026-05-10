
-- 1. Drop old bonus_products table
DROP TABLE IF EXISTS public.bonus_products CASCADE;

-- 2. Create bonus_items
CREATE TABLE public.bonus_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  description       TEXT,
  icon              TEXT,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  track_stock       BOOLEAN     NOT NULL DEFAULT false,
  master_product_id UUID        REFERENCES public.master_products(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read bonus_items"
  ON public.bonus_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "SuperAdmin manage bonus_items"
  ON public.bonus_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 3. Create bonus_rules
CREATE TABLE public.bonus_rules (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_item_id     UUID    NOT NULL REFERENCES public.bonus_items(id) ON DELETE CASCADE,
  scope_type        TEXT    NOT NULL,
  category          TEXT,
  master_product_id UUID    REFERENCES public.master_products(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bonus_item_id, category),
  UNIQUE (bonus_item_id, master_product_id)
);

ALTER TABLE public.bonus_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read bonus_rules"
  ON public.bonus_rules FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "SuperAdmin manage bonus_rules"
  ON public.bonus_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. Create accessory_stock_ledger
CREATE TABLE public.accessory_stock_ledger (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  master_product_id UUID    NOT NULL REFERENCES public.master_products(id) ON DELETE RESTRICT,
  transaction_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
  qty               INTEGER NOT NULL,
  movement_type     TEXT    NOT NULL,
  reference_id      UUID,
  supplier_id       UUID    REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes             TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accessory_stock_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read accessory_stock_ledger"
  ON public.accessory_stock_ledger FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Auth insert accessory_stock_ledger"
  ON public.accessory_stock_ledger FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "SuperAdmin manage accessory_stock_ledger"
  ON public.accessory_stock_ledger FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. Create view accessory_stock_summary
CREATE OR REPLACE VIEW public.accessory_stock_summary AS
SELECT
  mp.id             AS master_product_id,
  mp.series         AS name,
  mp.category,
  COALESCE(SUM(asl.qty), 0) AS qty_remaining
FROM public.master_products mp
LEFT JOIN public.accessory_stock_ledger asl
  ON asl.master_product_id = mp.id
WHERE mp.category = 'accessory'
  AND mp.is_active = true
GROUP BY mp.id, mp.series, mp.category
HAVING COALESCE(SUM(asl.qty), 0) > 0;

-- 6. Seed master products (accessories)
INSERT INTO public.master_products (category, series, warranty_type, is_active)
VALUES
  ('accessory', 'U1me Adaptor + Cable MFI',  'resmi', true),
  ('accessory', 'UGREEN Adaptor MFI 20W',    'resmi', true),
  ('accessory', 'U1me Adaptor MFI 20W GaN',  'resmi', true)
ON CONFLICT DO NOTHING;

-- 7. Seed bonus items (non-tracked)
INSERT INTO public.bonus_items (name, sort_order, is_active, track_stock)
VALUES
  ('Sinyal Permanen',      1, true, false),
  ('Softcase',             2, true, false),
  ('Temperglass',          3, true, false),
  ('Asuransi Pengiriman',  4, true, false),
  ('Garansi Unit 30 Hari', 5, true, false),
  ('Extra Bubble Wrap',    6, true, false);

-- 8. Seed bonus items (tracked, linked to master products)
INSERT INTO public.bonus_items (name, sort_order, is_active, track_stock, master_product_id)
SELECT 'U1me Adaptor + Cable MFI', 7, true, true, id
FROM public.master_products WHERE series = 'U1me Adaptor + Cable MFI' LIMIT 1;

INSERT INTO public.bonus_items (name, sort_order, is_active, track_stock, master_product_id)
SELECT 'UGREEN Adaptor MFI 20W', 8, true, true, id
FROM public.master_products WHERE series = 'UGREEN Adaptor MFI 20W' LIMIT 1;

INSERT INTO public.bonus_items (name, sort_order, is_active, track_stock, master_product_id)
SELECT 'U1me Adaptor MFI 20W GaN', 9, true, true, id
FROM public.master_products WHERE series = 'U1me Adaptor MFI 20W GaN' LIMIT 1;
