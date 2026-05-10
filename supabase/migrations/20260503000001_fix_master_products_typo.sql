-- Migration: 20260503000001_fix_master_products_typo
-- Fix "Iphone" → "iPhone" typos in master_products
-- Delete zero-stock duplicate entries

CREATE OR REPLACE FUNCTION public.fix_iphone_typos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Step 1: Delete zero-stock Iphone typo entries (these are duplicates)
  -- These entries have no stock_units and would violate unique constraint if renamed
  DELETE FROM master_products
  WHERE id IN (
    '181b9769-7b5a-498e-8e63-b8d8883360ac',
    '2b7bff56-92b5-4818-a555-300b7c824e02',
    'da93ceaa-eb60-4223-9c84-58526e217403',
    '22589d58-f764-4aa2-b670-151af6201bbf',
    '68d43f1a-b10d-4a39-a16d-117f7a467c7c',
    'ba347ea5-8cb0-417f-b767-96db46351ad8',
    'a40ceb4c-4221-4291-9e81-fac53ac47a7f',
    '54e8e67c-533d-4f98-81ac-9f94080a6d3c',
    '1aa9ea36-9a6f-467a-91f1-857048c0f5ec',
    '8d696390-ca0b-45ec-8a51-154d2e479875',
    'b0949dc6-9bb4-4d82-91f2-0628b7071182',
    'f8e20689-ff22-4cc7-a043-473395ea3e8e',
    'fc58463c-0a22-4fcc-ac9d-ad5078a8d599',
    'f5c705d3-6078-4a10-aa14-a77059eb6f8f',
    '72a6b770-924d-4ea6-af63-fb32f7e729a7',
    '06e48840-f1c8-448b-b951-d52d6083c819',
    '7b75110a-86ec-4b33-99c8-6d45554ffc31',
    '6dbc46ea-d12a-4fa4-bb55-4ccef44c8ba8',
    'e0d7f81f-c3a5-445c-8634-9108184822cd',
    '5a389678-2723-47ec-bdf7-d8c749d6ef2c',
    '07166e7e-40ff-4872-a77e-fb82f27bf817',
    'd89e0dab-0393-4153-be05-58cdef2367db',
    '4988497e-dad7-4619-900c-96313f1fe3a2',
    '54ede2fd-2c0b-4595-be16-ac601baea856',
    'd65bcf6d-dfa1-4d8d-96c0-d5fb75eb548a',
    '2be180fb-c9f5-417e-b816-1b8d39369d95',
    '566a9221-2459-46ff-95b0-fe4875a53f12',
    '626587bf-a2de-4fe4-b2d6-353805e5d5d1',
    'db2b3720-634f-4eff-9352-a84232527bbc',
    '86490ff6-4300-4db0-b518-3c93c77b966b'
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % zero-stock Iphone typo entries', deleted_count;

  -- Step 2: Rename remaining Iphone → iPhone (these have no conflict)
  UPDATE master_products SET series = 'iPhone 11'
  WHERE series = 'Iphone 11';
  UPDATE master_products SET series = 'iPhone 12'
  WHERE series = 'Iphone 12';
  UPDATE master_products SET series = 'iPhone 12 Mini'
  WHERE series = 'Iphone 12 Mini';
  UPDATE master_products SET series = 'iPhone 12 Pro Max'
  WHERE series = 'Iphone 12 Pro Max';
  UPDATE master_products SET series = 'iPhone 13 Mini'
  WHERE series = 'Iphone 13 Mini';
  UPDATE master_products SET series = 'iPhone 13 Pro Max'
  WHERE series = 'Iphone 13 Pro Max';
  UPDATE master_products SET series = 'iPhone 14 Pro'
  WHERE series = 'Iphone 14 Pro';
  UPDATE master_products SET series = 'iPhone 15 Pro'
  WHERE series = 'Iphone 15 Pro';
  UPDATE master_products SET series = 'iPhone 15 Pro Max'
  WHERE series = 'Iphone 15 Pro Max';
  UPDATE master_products SET series = 'iPhone 16'
  WHERE series = 'Iphone 16';
  UPDATE master_products SET series = 'iPhone 16 Pro Max'
  WHERE series = 'Iphone 16 Pro Max';
  UPDATE master_products SET series = 'iPhone 17 Pro'
  WHERE series = 'Iphone 17 Pro';
  UPDATE master_products SET series = 'iPhone Xr'
  WHERE series = 'Iphone Xr';

  -- Step 3: Fix color case (purple lowercase → Purple)
  UPDATE master_products SET color = 'Purple'
  WHERE series = 'iPhone 11' AND color = 'purple';
  UPDATE master_products SET color = 'White'
  WHERE series = 'iPhone 13' AND color = 'white';
  UPDATE master_products SET color = 'Purple'
  WHERE series = 'iPhone 14 Pro' AND color = 'purple';
  UPDATE master_products SET color = 'White'
  WHERE series = 'iPhone 13' AND color = 'white';

  -- Step 4: Fix iPhone 12 mini & 13 mini catalog_products product_id = NULL
  UPDATE catalog_products cp SET product_id = (
    SELECT id FROM master_products mp
    WHERE mp.series = 'iPhone 12 Mini'
    AND mp.storage_gb = 128 AND mp.warranty_type = 'resmi_bc'
    LIMIT 1
  )
  WHERE cp.catalog_series ILIKE '%iPhone 12 mini%';

  UPDATE catalog_products cp SET product_id = (
    SELECT id FROM master_products mp
    WHERE mp.series = 'iPhone 13 Mini'
    AND mp.storage_gb = 128 AND mp.warranty_type = 'resmi_bc'
    LIMIT 1
  )
  WHERE cp.catalog_series ILIKE '%iPhone 13 mini%';

  RAISE NOTICE 'Done fixing Iphone typos and mini product_id';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.fix_iphone_typos() TO anon;
