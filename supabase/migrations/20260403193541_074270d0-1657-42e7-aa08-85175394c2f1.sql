
-- warranty_claims: more missing columns
ALTER TABLE public.warranty_claims
  ADD COLUMN IF NOT EXISTS is_imei_warranty_claimed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claim_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- opname_snapshot_items: add created_at
ALTER TABLE public.opname_snapshot_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- user_profiles: add last_resend_at
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_resend_at TIMESTAMPTZ;

-- discount_codes: add more missing columns
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS discount_amount BIGINT,
  ADD COLUMN IF NOT EXISTS max_uses INTEGER,
  ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_subsidy_unlimited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_subsidy_amount BIGINT;
