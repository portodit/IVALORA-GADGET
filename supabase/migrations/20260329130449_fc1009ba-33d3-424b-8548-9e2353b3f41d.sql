
-- Seed: Branch Eastern Park only
INSERT INTO public.branches (
  id, name, code, province, city, district, village, postal_code,
  full_address, phone, is_active, created_at, updated_at,
  latitude, longitude, google_maps_url
) VALUES (
  'f9c66fcb-841f-4966-9afb-5fdbb1513d27',
  'Eastern Park', 'EP', 'Jawa Timur', 'Kota Surabaya',
  'Sukolilo', 'Keputih', '60111',
  'Jl. Keputih, Kelurahan Keputih, Kecamatan Sukolilo, Kota Surabaya, Jawa Timur',
  '083192925747', true,
  '2026-02-20T22:54:23.093039+00:00',
  '2026-02-21T01:10:39.714324+00:00',
  -7.281121, 112.789351, null
) ON CONFLICT (id) DO NOTHING;
