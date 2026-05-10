
-- =============================================
-- IVALORA GADGET — Full Database Schema
-- =============================================

-- ── ENUMS ────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin_branch', 'employee', 'web_admin');
CREATE TYPE public.account_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE public.product_category AS ENUM ('iphone', 'ipad', 'accessory', 'macbook', 'watch', 'airpods');
CREATE TYPE public.condition_status AS ENUM ('no_minus', 'minus');
CREATE TYPE public.minus_severity AS ENUM ('minor', 'mayor');
CREATE TYPE public.sold_channel AS ENUM ('pos', 'ecommerce_tokopedia', 'ecommerce_shopee', 'website');
CREATE TYPE public.catalog_status AS ENUM ('draft', 'published', 'unpublished');
CREATE TYPE public.price_strategy AS ENUM ('min_price', 'avg_price', 'fixed');
CREATE TYPE public.session_type AS ENUM ('opening', 'closing', 'adhoc');
CREATE TYPE public.session_status AS ENUM ('draft', 'completed', 'approved', 'locked');

-- ── 1. BRANCHES ──────────────────────────────────
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  city TEXT,
  district TEXT,
  province TEXT,
  village TEXT,
  full_address TEXT,
  phone TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION DEFAULT 0,
  longitude DOUBLE PRECISION DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. USER_PROFILES ─────────────────────────────
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  status account_status NOT NULL DEFAULT 'pending',
  last_resend_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. USER_ROLES ────────────────────────────────
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- ── 4. USER_BRANCHES ─────────────────────────────
CREATE TABLE public.user_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, branch_id)
);

-- ── 5. WARRANTY_LABELS ───────────────────────────
CREATE TABLE public.warranty_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. MASTER_PRODUCTS ───────────────────────────
CREATE TABLE public.master_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category product_category NOT NULL,
  series TEXT NOT NULL,
  storage_gb INTEGER,
  color TEXT,
  size_mm INTEGER,
  warranty_type TEXT,
  base_price BIGINT,
  weight_gram INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ── 7. STOCK_UNITS ───────────────────────────────
CREATE TABLE public.stock_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.master_products(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  imei TEXT,
  serial_number TEXT,
  qty_available INTEGER,
  cost_price_per_unit BIGINT,
  condition_status condition_status DEFAULT 'no_minus',
  minus_severity minus_severity,
  minus_description TEXT,
  selling_price BIGINT,
  cost_price BIGINT,
  stock_status TEXT NOT NULL DEFAULT 'available',
  sold_channel sold_channel,
  sold_reference_id UUID,
  reserved_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_arrival_at TIMESTAMPTZ,
  supplier TEXT,
  supplier_id UUID,
  batch_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. STOCK_UNIT_LOGS ───────────────────────────
CREATE TABLE public.stock_unit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.stock_units(id) ON DELETE CASCADE NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT
);

-- ── 9. STOCK_STATUS_LABELS ───────────────────────
CREATE TABLE public.stock_status_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color_hue INTEGER NOT NULL DEFAULT 0,
  color_saturation INTEGER NOT NULL DEFAULT 0,
  color_lightness INTEGER NOT NULL DEFAULT 50,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 10. CATALOG_PRODUCTS ─────────────────────────
CREATE TABLE public.catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.master_products(id) ON DELETE SET NULL,
  slug TEXT UNIQUE,
  display_name TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,
  thumbnail_url TEXT,
  gallery_urls JSONB DEFAULT '[]'::jsonb,
  catalog_status catalog_status NOT NULL DEFAULT 'draft',
  publish_to_pos BOOLEAN NOT NULL DEFAULT false,
  publish_to_web BOOLEAN NOT NULL DEFAULT false,
  publish_to_marketplace BOOLEAN NOT NULL DEFAULT false,
  price_strategy price_strategy NOT NULL DEFAULT 'min_price',
  override_display_price BIGINT,
  highlight_product BOOLEAN NOT NULL DEFAULT false,
  show_condition_breakdown BOOLEAN NOT NULL DEFAULT false,
  promo_label TEXT,
  promo_badge TEXT,
  free_shipping BOOLEAN NOT NULL DEFAULT false,
  is_flash_sale BOOLEAN NOT NULL DEFAULT false,
  flash_sale_discount_type TEXT,
  flash_sale_discount_value NUMERIC,
  shipping_discount_type TEXT NOT NULL DEFAULT 'none',
  shipping_discount_value NUMERIC,
  discount_active BOOLEAN NOT NULL DEFAULT false,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_start_at TIMESTAMPTZ,
  discount_end_at TIMESTAMPTZ,
  catalog_series TEXT,
  catalog_warranty_type TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 11. BONUS_PRODUCTS ───────────────────────────
CREATE TABLE public.bonus_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 12. DISCOUNT_CODES ───────────────────────────
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_percent NUMERIC,
  discount_amount NUMERIC,
  min_purchase_amount NUMERIC,
  buy_quantity INTEGER,
  get_quantity INTEGER,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  max_uses_per_user INTEGER,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  applies_to_all BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  cover_packing_kayu BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 13. FLASH_SALE_SETTINGS ──────────────────────
CREATE TABLE public.flash_sale_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_hours INTEGER NOT NULL DEFAULT 24,
  default_discount_type TEXT NOT NULL DEFAULT 'percentage',
  default_discount_value NUMERIC NOT NULL DEFAULT 10,
  default_shipping_type TEXT NOT NULL DEFAULT 'none',
  default_shipping_value NUMERIC NOT NULL DEFAULT 0,
  event_name TEXT,
  gradient_start TEXT NOT NULL DEFAULT '#ef4444',
  gradient_end TEXT NOT NULL DEFAULT '#f97316',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 14. SALE_CAMPAIGNS ───────────────────────────
CREATE TABLE public.sale_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  banner_urls JSONB DEFAULT '[]'::jsonb,
  gradient_start TEXT NOT NULL DEFAULT '#ef4444',
  gradient_end TEXT NOT NULL DEFAULT '#f97316',
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  show_popup BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 15. SALE_CAMPAIGN_ITEMS ──────────────────────
CREATE TABLE public.sale_campaign_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.sale_campaigns(id) ON DELETE CASCADE NOT NULL,
  series TEXT NOT NULL,
  storage_gb INTEGER NOT NULL DEFAULT 0,
  warranty_type TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 16. PAYMENT_METHODS ──────────────────────────
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash',
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  qris_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 17. TRANSACTIONS ─────────────────────────────
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal BIGINT NOT NULL DEFAULT 0,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  shipping_cost BIGINT NOT NULL DEFAULT 0,
  packing_kayu_cost BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_id UUID,
  payment_method_id UUID,
  payment_method_name TEXT,
  discount_code TEXT,
  discount_code_id UUID,
  notes TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by UUID,
  confirmed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  channel TEXT,
  sold_channel TEXT,
  shipping_courier TEXT,
  shipping_service TEXT,
  shipping_address TEXT,
  shipping_province TEXT,
  shipping_city TEXT,
  shipping_district TEXT,
  shipping_postal_code TEXT,
  shipping_tracking_number TEXT,
  shipping_weight_gram INTEGER,
  need_packing_kayu BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 18. TRANSACTION_ITEMS ────────────────────────
CREATE TABLE public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  stock_unit_id UUID REFERENCES public.stock_units(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  imei TEXT,
  serial_number TEXT,
  price BIGINT NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 19. INVOICES ─────────────────────────────────
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  customer_name TEXT,
  total BIGINT NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT,
  handled_by_name TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 20. WARRANTY_CLAIMS ──────────────────────────
CREATE TABLE public.warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.stock_units(id) ON DELETE SET NULL,
  claim_type TEXT NOT NULL DEFAULT 'warranty',
  claim_status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  resolution TEXT,
  vendor_id UUID,
  cost BIGINT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 21. SERVICE_VENDORS ──────────────────────────
CREATE TABLE public.service_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 22. SUPPLIERS ────────────────────────────────
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 23. ACTIVITY_LOGS ────────────────────────────
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  target_id UUID,
  target_email TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 24. NOTIFICATIONS ────────────────────────────
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 25. REVIEWS ──────────────────────────────────
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_name TEXT NOT NULL,
  reviewer_avatar_url TEXT,
  rating INTEGER NOT NULL DEFAULT 5,
  review_text TEXT NOT NULL DEFAULT '',
  photo_urls JSONB DEFAULT '[]'::jsonb,
  categories JSONB DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 26. CUSTOMER_ADDRESSES ───────────────────────
CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  full_address TEXT NOT NULL,
  province TEXT,
  province_name TEXT,
  regency TEXT,
  regency_name TEXT,
  district TEXT,
  district_name TEXT,
  village TEXT,
  village_name TEXT,
  postal_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 27. AVATARS ──────────────────────────────────
CREATE TABLE public.avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 28. RAJAONGKIR_API_KEYS ─────────────────────
CREATE TABLE public.rajaongkir_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 29. CHANGELOG_ENTRIES ────────────────────────
CREATE TABLE public.changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'feature',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 30. OPNAME_SESSIONS ──────────────────────────
CREATE TABLE public.opname_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  session_type session_type NOT NULL DEFAULT 'adhoc',
  session_status session_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  total_expected INTEGER NOT NULL DEFAULT 0,
  total_scanned INTEGER NOT NULL DEFAULT 0,
  total_match INTEGER NOT NULL DEFAULT 0,
  total_missing INTEGER NOT NULL DEFAULT 0,
  total_unregistered INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  approved_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 31. OPNAME_SNAPSHOT_ITEMS ────────────────────
CREATE TABLE public.opname_snapshot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.opname_sessions(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES public.stock_units(id) ON DELETE SET NULL,
  imei TEXT,
  product_label TEXT,
  selling_price BIGINT,
  cost_price BIGINT,
  stock_status TEXT,
  scan_result TEXT NOT NULL DEFAULT 'missing',
  action_taken TEXT,
  action_notes TEXT,
  sold_reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 32. OPNAME_SCANNED_ITEMS ─────────────────────
CREATE TABLE public.opname_scanned_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.opname_sessions(id) ON DELETE CASCADE NOT NULL,
  imei TEXT NOT NULL,
  scan_result TEXT NOT NULL DEFAULT 'match',
  action_taken TEXT,
  action_notes TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 33. OPNAME_SCHEDULES ─────────────────────────
CREATE TABLE public.opname_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  is_active BOOLEAN NOT NULL DEFAULT true,
  time_of_day TIME NOT NULL DEFAULT '08:00',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_unit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_status_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sale_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_campaign_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rajaongkir_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opname_snapshot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opname_scanned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opname_schedules ENABLE ROW LEVEL SECURITY;

-- ── Security definer function for role checks ────
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- ── Authenticated users can read most tables ─────
-- Branches: all authenticated can read
CREATE POLICY "Authenticated read branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage branches" ON public.branches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- User profiles: users can read/update their own
CREATE POLICY "Users read own profile" ON public.user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin read all profiles" ON public.user_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- User roles: authenticated can read (needed for role display)
CREATE POLICY "Authenticated read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- User branches: users read own, admin reads all
CREATE POLICY "Users read own branches" ON public.user_branches FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin manage user branches" ON public.user_branches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Products, stock, catalog: all authenticated can read
CREATE POLICY "Auth read master_products" ON public.master_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage master_products" ON public.master_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch')) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch'));

CREATE POLICY "Auth read stock_units" ON public.stock_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage stock_units" ON public.stock_units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch')) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch'));

CREATE POLICY "Auth read stock_unit_logs" ON public.stock_unit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert stock_unit_logs" ON public.stock_unit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth read stock_status_labels" ON public.stock_status_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage stock_status_labels" ON public.stock_status_labels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Auth read warranty_labels" ON public.warranty_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage warranty_labels" ON public.warranty_labels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Catalog: public read for storefront, admin manage
CREATE POLICY "Public read catalog" ON public.catalog_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage catalog" ON public.catalog_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch')) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch'));

CREATE POLICY "Auth read bonus_products" ON public.bonus_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage bonus_products" ON public.bonus_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Discount codes: auth read, admin manage
CREATE POLICY "Auth read discount_codes" ON public.discount_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage discount_codes" ON public.discount_codes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch')) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch'));

-- Flash sale: public read, admin manage
CREATE POLICY "Public read flash_sale" ON public.flash_sale_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage flash_sale" ON public.flash_sale_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Sale campaigns
CREATE POLICY "Public read campaigns" ON public.sale_campaigns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage campaigns" ON public.sale_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Public read campaign_items" ON public.sale_campaign_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage campaign_items" ON public.sale_campaign_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Payment methods: auth read, admin manage
CREATE POLICY "Auth read payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage payment_methods" ON public.payment_methods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch')) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_branch'));

-- Transactions: auth read, admin/employee manage
CREATE POLICY "Auth read transactions" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read transaction_items" ON public.transaction_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage transaction_items" ON public.transaction_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoices
CREATE POLICY "Auth read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Warranty claims
CREATE POLICY "Auth read warranty_claims" ON public.warranty_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage warranty_claims" ON public.warranty_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service vendors, suppliers
CREATE POLICY "Auth read service_vendors" ON public.service_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage service_vendors" ON public.service_vendors FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Auth read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Activity logs
CREATE POLICY "Auth read activity_logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert activity_logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Reviews: public read
CREATE POLICY "Public read reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage reviews" ON public.reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Customer addresses
CREATE POLICY "Users read own addresses" ON public.customer_addresses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own addresses" ON public.customer_addresses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Avatars: public read
CREATE POLICY "Public read avatars" ON public.avatars FOR SELECT TO anon, authenticated USING (true);

-- RajaOngkir keys: admin only
CREATE POLICY "Admin read rajaongkir_keys" ON public.rajaongkir_api_keys FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin manage rajaongkir_keys" ON public.rajaongkir_api_keys FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Changelog: public read
CREATE POLICY "Public read changelog" ON public.changelog_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage changelog" ON public.changelog_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Opname
CREATE POLICY "Auth read opname_sessions" ON public.opname_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage opname_sessions" ON public.opname_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read opname_snapshot_items" ON public.opname_snapshot_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage opname_snapshot_items" ON public.opname_snapshot_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read opname_scanned_items" ON public.opname_scanned_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage opname_scanned_items" ON public.opname_scanned_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read opname_schedules" ON public.opname_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage opname_schedules" ON public.opname_schedules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ── RPC: get_active_flash_sale_info (public) ─────
CREATE OR REPLACE FUNCTION public.get_active_flash_sale_info()
RETURNS TABLE (
  is_active BOOLEAN,
  start_time TIMESTAMPTZ,
  duration_hours INTEGER,
  event_name TEXT,
  gradient_start TEXT,
  gradient_end TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fs.is_active, fs.start_time, fs.duration_hours, fs.event_name, fs.gradient_start, fs.gradient_end
  FROM public.flash_sale_settings fs
  WHERE fs.is_active = true
  LIMIT 1
$$;

-- ── Trigger: auto-create profile on signup ───────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── Storage bucket for catalog images ────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO NOTHING;
