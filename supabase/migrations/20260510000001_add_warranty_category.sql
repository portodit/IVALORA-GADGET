-- Add warranty_category column to catalog_products
-- This replaces included_warranty_types with a single category choice per article
ALTER TABLE catalog_products
ADD COLUMN IF NOT EXISTS warranty_category TEXT DEFAULT NULL;

-- Update existing records based on warranty type
UPDATE catalog_products
SET warranty_category = 'resmi_bc'
WHERE warranty_category IS NULL
  AND EXISTS (
    SELECT 1 FROM master_products mp
    WHERE mp.id = catalog_products.product_id
    AND mp.warranty_type = 'resmi_bc'
  );

UPDATE catalog_products
SET warranty_category = 'resmi_indonesia'
WHERE warranty_category IS NULL
  AND EXISTS (
    SELECT 1 FROM master_products mp
    WHERE mp.id = catalog_products.product_id
    AND mp.warranty_type IN ('ibox', 'digimap', 'resmi')
  );

UPDATE catalog_products
SET warranty_category = 'inter'
WHERE warranty_category IS NULL
  AND EXISTS (
    SELECT 1 FROM master_products mp
    WHERE mp.id = catalog_products.product_id
    AND mp.warranty_type = 'inter'
  );

UPDATE catalog_products
SET warranty_category = 'whitelist'
WHERE warranty_category IS NULL
  AND EXISTS (
    SELECT 1 FROM master_products mp
    WHERE mp.id = catalog_products.product_id
    AND mp.warranty_type = 'whitelist'
  );

-- Drop the old included_warranty_types column if it exists
ALTER TABLE catalog_products
DROP COLUMN IF EXISTS included_warranty_types;
