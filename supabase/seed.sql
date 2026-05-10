-- ============================================================
-- IVALORA GADGET — Seed Data
-- Generated from production Supabase: mreqldvlkkedcgyxcaon
-- Generated at: 2026-03-29
-- ============================================================
-- CARA PAKAI DI SUPABASE:
--   1. Buka Supabase SQL Editor di project kamu
--   2. Paste seluruh isi file ini
--   3. Klik "Run"
--   4. Untuk auth users, ikuti instruksi di bagian bawah file
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. BRANCHES
-- ────────────────────────────────────────────────────────────
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
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  is_active = EXCLUDED.is_active,
  full_address = EXCLUDED.full_address,
  phone = EXCLUDED.phone;

-- ────────────────────────────────────────────────────────────
-- 2. USER PROFILES
-- (Butuh auth.users dibuat dulu — lihat instruksi di bawah)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.user_profiles (
  id, email, full_name, status, created_at, updated_at, last_resend_at, avatar_url
) VALUES
  (
    '952fef0d-a077-4afc-847c-4ffdede62d9d',
    'bliaditdev@gmail.com', 'Admin Ivalora', 'active',
    '2026-03-28T15:31:28.864953+00:00', '2026-03-28T15:34:36.313602+00:00', null, null
  ),
  (
    'd37f8cf4-5fdc-4ff4-8c33-e56421947ffb',
    'portodit@gmail.com', 'Karyawan Eastern Park', 'active',
    '2026-03-29T12:03:57.012696+00:00', '2026-03-29T12:11:51.682392+00:00', null, null
  )
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  status = EXCLUDED.status,
  email = EXCLUDED.email;

-- ────────────────────────────────────────────────────────────
-- 3. USER ROLES
-- ────────────────────────────────────────────────────────────
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES
  (
    'c2f4aca2-c9ca-4cb2-8322-789d0e2c077a',
    '952fef0d-a077-4afc-847c-4ffdede62d9d',
    'super_admin',
    '2026-03-28T15:34:41.970063+00:00'
  ),
  (
    'b711ff94-9e1f-430b-9f55-8eb4e3e62a9d',
    'd37f8cf4-5fdc-4ff4-8c33-e56421947ffb',
    'employee',
    '2026-03-29T12:03:57.905706+00:00'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. USER BRANCHES
-- ────────────────────────────────────────────────────────────
INSERT INTO public.user_branches (id, user_id, branch_id, is_default, assigned_at, assigned_by) VALUES
  (
    '663e53a0-e71c-4c6e-9213-2237cf99752c',
    '952fef0d-a077-4afc-847c-4ffdede62d9d',
    'f9c66fcb-841f-4966-9afb-5fdbb1513d27',
    true,
    '2026-03-28T15:34:44.770123+00:00',
    '952fef0d-a077-4afc-847c-4ffdede62d9d'
  ),
  (
    '33fa1058-aca0-4616-9132-9ee3f978df6c',
    'd37f8cf4-5fdc-4ff4-8c33-e56421947ffb',
    'f9c66fcb-841f-4966-9afb-5fdbb1513d27',
    true,
    '2026-03-29T12:03:58.206637+00:00',
    null
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ⚠️  AUTH USERS — HARUS BUAT MANUAL DI SUPABASE AUTH
-- ============================================================
-- Karena auth.users tidak bisa di-seed via SQL biasa,
-- buat 2 user berikut via Supabase Dashboard → Authentication → Add User:
--
-- User 1 (Super Admin):
--   Email    : bliaditdev@gmail.com
--   Password : admin123
--   User ID  : 952fef0d-a077-4afc-847c-4ffdede62d9d  ← harus sama!
--
-- User 2 (Karyawan Eastern Park):
--   Email    : portodit@gmail.com
--   Password : 123456
--   User ID  : d37f8cf4-5fdc-4ff4-8c33-e56421947ffb  ← harus sama!
--
-- CATATAN: Supabase biasanya generate UUID baru saat Add User.
-- Kalau UUID berbeda, update user_profiles & user_roles & user_branches
-- dengan UUID yang baru setelah dibuat.
--
-- Alternatif lebih mudah — pakai SQL ini di SQL Editor Supabase
-- (butuh extensions pgcrypto):
--
-- INSERT INTO auth.users (
--   id, instance_id, email, encrypted_password, email_confirmed_at,
--   role, aud, created_at, updated_at,
--   raw_app_meta_data, raw_user_meta_data, is_super_admin,
--   confirmation_token, recovery_token, email_change_token_new, email_change
-- ) VALUES
-- (
--   '952fef0d-a077-4afc-847c-4ffdede62d9d',
--   '00000000-0000-0000-0000-000000000000',
--   'bliaditdev@gmail.com',
--   crypt('admin123', gen_salt('bf')),
--   now(), 'authenticated', 'authenticated', now(), now(),
--   '{"provider":"email","providers":["email"]}', '{}',
--   false, '', '', '', ''
-- ),
-- (
--   'd37f8cf4-5fdc-4ff4-8c33-e56421947ffb',
--   '00000000-0000-0000-0000-000000000000',
--   'portodit@gmail.com',
--   crypt('123456', gen_salt('bf')),
--   now(), 'authenticated', 'authenticated', now(), now(),
--   '{"provider":"email","providers":["email"]}', '{}',
--   false, '', '', '', ''
-- )
-- ON CONFLICT (email) DO NOTHING;
-- ============================================================
