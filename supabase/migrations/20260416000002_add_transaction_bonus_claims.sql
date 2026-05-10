-- ════════════════════════════════════════════════════════════════
-- Tabel klaim bonus Google Maps review per transaksi
-- Customer upload bukti ulasan → sistem catat + kurangi stok adaptor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transaction_bonus_claims (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id   UUID        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  chosen_bonus_id  UUID        REFERENCES public.bonus_items(id) ON DELETE SET NULL,
  review_proof_url TEXT        NOT NULL,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by     UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transaction_id)
);

ALTER TABLE public.transaction_bonus_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read bonus_claims"
  ON public.transaction_bonus_claims FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insert bonus_claims"
  ON public.transaction_bonus_claims FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "SuperAdmin manage bonus_claims"
  ON public.transaction_bonus_claims FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
