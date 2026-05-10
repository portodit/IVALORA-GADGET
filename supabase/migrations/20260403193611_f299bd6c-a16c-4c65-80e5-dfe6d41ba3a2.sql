
-- discount_codes
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS cover_packing_kayu BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_discount_cap BIGINT;

-- transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS customer_user_id UUID,
  ADD COLUMN IF NOT EXISTS payment_method_name TEXT;

-- transaction_items
ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS product_label TEXT,
  ADD COLUMN IF NOT EXISTS selling_price BIGINT;
