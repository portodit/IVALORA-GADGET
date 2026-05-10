-- Allow accessory items in transaction_items (no stock_unit, no imei)
ALTER TABLE public.transaction_items
  ALTER COLUMN stock_unit_id DROP NOT NULL;

ALTER TABLE public.transaction_items
  ALTER COLUMN imei DROP NOT NULL;

-- Ensure at least stock_unit_id OR accessory_id is always provided
ALTER TABLE public.transaction_items
  ADD CONSTRAINT chk_transaction_items_ref
    CHECK (stock_unit_id IS NOT NULL OR accessory_id IS NOT NULL);
