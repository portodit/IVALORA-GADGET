-- Fix trigger: sold_reference_id column is TEXT, but NEW.id is UUID.
-- Previous version caused: operator does not exist: character varying = uuid (42883)
-- Fix: cast NEW.id to text for comparison.

CREATE OR REPLACE FUNCTION public.release_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'failed')
     AND OLD.status NOT IN ('cancelled', 'failed')
  THEN
    UPDATE public.stock_units
    SET stock_status      = 'available',
        sold_reference_id = NULL
    WHERE sold_reference_id = NEW.id::text
      AND stock_status      = 'reserved';
  END IF;
  RETURN NEW;
END;
$$;
