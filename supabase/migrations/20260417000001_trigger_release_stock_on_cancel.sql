-- ──────────────────────────────────────────────────────────────────────────
-- Trigger: release stock_units back to 'available' when a transaction
-- is cancelled or failed. This is the server-side safety net — stock
-- release no longer depends on the frontend detail page being opened.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.release_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status transitions INTO a terminal cancelled/failed state
  IF NEW.status IN ('cancelled', 'failed')
     AND OLD.status NOT IN ('cancelled', 'failed')
  THEN
    UPDATE public.stock_units
    SET stock_status    = 'available',
        sold_reference_id = NULL
    WHERE sold_reference_id = NEW.id
      AND stock_status   = 'reserved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_stock_on_cancel ON public.transactions;

CREATE TRIGGER trg_release_stock_on_cancel
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.release_stock_on_cancel();
