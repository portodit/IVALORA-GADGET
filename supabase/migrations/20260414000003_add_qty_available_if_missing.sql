-- Add qty_available column to stock_units if not exists
-- This column was in the initial migration but may be missing in some environments
ALTER TABLE public.stock_units
  ADD COLUMN IF NOT EXISTS qty_available INTEGER;
