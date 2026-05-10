
DROP FUNCTION IF EXISTS public.get_active_flash_sale_info();

-- flash_sale_settings: add missing columns first
ALTER TABLE public.flash_sale_settings
  ADD COLUMN IF NOT EXISTS duration_hours INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS event_name TEXT;

-- Recreate with SETOF return type
CREATE FUNCTION public.get_active_flash_sale_info()
RETURNS SETOF JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT row_to_json(t) FROM (
    SELECT is_active, start_time, end_time, duration_hours, event_name
    FROM public.flash_sale_settings
    WHERE is_active = true
    LIMIT 1
  ) t
$$;

-- transactions: add shipping_courier
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS shipping_courier TEXT;
