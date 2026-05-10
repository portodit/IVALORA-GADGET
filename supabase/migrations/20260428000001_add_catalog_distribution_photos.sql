-- Migration: Add catalog_distribution_photos table
-- Purpose: Store per-distribution × per-color photos for catalog products
-- Photo structure: 1 cover per distribusi + up to 4 photos per warna × distribusi

CREATE TABLE IF NOT EXISTS public.catalog_distribution_photos (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_product_id   UUID    REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  distribution        VARCHAR(50) NOT NULL,
  color               VARCHAR(100),
  photo_type          VARCHAR(20) NOT NULL DEFAULT 'color',
  photo_url           TEXT    NOT NULL,
  sort_order          INT     DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_photo_type CHECK (photo_type IN ('cover', 'color')),
  CONSTRAINT chk_cover_no_color CHECK (photo_type != 'cover' OR (photo_type = 'cover' AND color IS NULL)),
  CONSTRAINT chk_color_has_color CHECK (photo_type != 'color' OR color IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cdp_catalog ON public.catalog_distribution_photos(catalog_product_id, distribution);
