
-- Add missing columns to existing tables

-- catalog_products: rating_score, spec_warranty_duration
ALTER TABLE public.catalog_products ADD COLUMN IF NOT EXISTS rating_score NUMERIC DEFAULT 0;
ALTER TABLE public.catalog_products ADD COLUMN IF NOT EXISTS spec_warranty_duration TEXT;

-- branches: google_maps_url
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- invoices: paid_at
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- discount_codes: shipping_subsidy_unlimited, shipping_subsidy_amount, max_discount_cap
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS shipping_subsidy_unlimited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS shipping_subsidy_amount NUMERIC;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS max_discount_cap NUMERIC;

-- opname_schedules: cron_time, days_of_week, notes
ALTER TABLE public.opname_schedules ADD COLUMN IF NOT EXISTS cron_time TEXT;
ALTER TABLE public.opname_schedules ADD COLUMN IF NOT EXISTS days_of_week INTEGER[] DEFAULT '{1,2,3,4,5,6}';
ALTER TABLE public.opname_schedules ADD COLUMN IF NOT EXISTS notes TEXT;

-- warranty_claims: repair_branch_id, repair_cost, claim_date, resolution_type, etc.
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS repair_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS repair_cost BIGINT;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS claim_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS resolution_type TEXT;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS imei TEXT;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS product_label TEXT;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS customer_name TEXT;
