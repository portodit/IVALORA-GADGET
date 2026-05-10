ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS accessory_id UUID REFERENCES public.master_products(id) ON DELETE SET NULL;
