
-- Add missing columns

-- transactions: customer_user_id
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_user_id UUID;

-- transaction_items: product_label, selling_price
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS product_label TEXT;
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS selling_price BIGINT;

-- warranty_claims: replacement_unit_id, is_imei_warranty_claimed, service_vendor_name, completed_at
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS replacement_unit_id UUID;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS is_imei_warranty_claimed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS service_vendor_name TEXT;
ALTER TABLE public.warranty_claims ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
