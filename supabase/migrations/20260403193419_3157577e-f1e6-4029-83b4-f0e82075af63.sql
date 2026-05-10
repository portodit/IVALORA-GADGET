
-- ══════════════════════════════════════════════════════════════
-- 1. ENUMS
-- ══════════════════════════════════════════════════════════════
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin_branch', 'employee', 'web_admin');
CREATE TYPE public.account_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE public.product_category AS ENUM ('iphone', 'ipad', 'accessory', 'macbook', 'watch', 'airpods');
CREATE TYPE public.warranty_type AS ENUM ('resmi_bc', 'ibox', 'inter', 'whitelist', 'digimap', 'resmi');
CREATE TYPE public.condition_status AS ENUM ('no_minus', 'minus');
CREATE TYPE public.minus_severity AS ENUM ('minor', 'mayor');
CREATE TYPE public.sold_channel AS ENUM ('pos', 'ecommerce_tokopedia', 'ecommerce_shopee', 'website', 'offline_non_pos');

-- ══════════════════════════════════════════════════════════════
-- 2. HELPER FUNCTION: updated_at trigger
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ══════════════════════════════════════════════════════════════
-- 3. CORE AUTH TABLES
-- ══════════════════════════════════════════════════════════════

-- user_profiles
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  status account_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- ══════════════════════════════════════════════════════════════
-- 4. BRANCHES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  city TEXT,
  district TEXT,
  province TEXT,
  village TEXT,
  full_address TEXT,
  phone TEXT,
  postal_code TEXT,
  google_maps_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public can view active branches" ON public.branches FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Super admins can manage branches" ON public.branches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- user_branches
CREATE TABLE public.user_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view user_branches" ON public.user_branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage user_branches" ON public.user_branches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- ══════════════════════════════════════════════════════════════
-- 5. SUPPLIERS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 6. MASTER PRODUCTS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.master_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category product_category NOT NULL,
  series TEXT NOT NULL,
  storage_gb INTEGER,
  color TEXT,
  size_mm INTEGER,
  warranty_type warranty_type,
  base_price BIGINT,
  weight_gram INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_master_products_updated_at BEFORE UPDATE ON public.master_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view products" ON public.master_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage products" ON public.master_products FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 7. STOCK UNITS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.stock_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.master_products(id) ON DELETE CASCADE,
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
  sold_reference_id TEXT,
  reserved_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  estimated_arrival_at DATE,
  supplier TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  batch_code TEXT,
  notes TEXT,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_units ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_stock_units_updated_at BEFORE UPDATE ON public.stock_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_stock_units_product_id ON public.stock_units(product_id);
CREATE INDEX idx_stock_units_imei ON public.stock_units(imei);
CREATE INDEX idx_stock_units_serial ON public.stock_units(serial_number);
CREATE INDEX idx_stock_units_status ON public.stock_units(stock_status);
CREATE INDEX idx_stock_units_branch ON public.stock_units(branch_id);

CREATE POLICY "Authenticated users can view stock" ON public.stock_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage stock" ON public.stock_units FOR ALL TO authenticated USING (true);

-- stock_unit_logs
CREATE TABLE public.stock_unit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.stock_units(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT
);
ALTER TABLE public.stock_unit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view logs" ON public.stock_unit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert logs" ON public.stock_unit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- stock_status_labels
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_status_labels ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_stock_status_labels_updated_at BEFORE UPDATE ON public.stock_status_labels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can view status labels" ON public.stock_status_labels FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage status labels" ON public.stock_status_labels FOR ALL TO authenticated USING (true);

-- warranty_labels
CREATE TABLE public.warranty_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.warranty_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view warranty labels" ON public.warranty_labels FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage warranty labels" ON public.warranty_labels FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 8. TRANSACTIONS & INVOICES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT UNIQUE,
  branch_id UUID REFERENCES public.branches(id),
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  total BIGINT NOT NULL DEFAULT 0,
  discount BIGINT NOT NULL DEFAULT 0,
  grand_total BIGINT NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  channel sold_channel,
  handled_by UUID,
  handled_by_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view transactions" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage transactions" ON public.transactions FOR ALL TO authenticated USING (true);

CREATE TABLE public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  stock_unit_id UUID REFERENCES public.stock_units(id),
  product_name TEXT NOT NULL,
  imei TEXT,
  serial_number TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price BIGINT NOT NULL DEFAULT 0,
  subtotal BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transaction items" ON public.transaction_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage transaction items" ON public.transaction_items FOR ALL TO authenticated USING (true);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  status TEXT NOT NULL DEFAULT 'draft',
  customer_name TEXT,
  total BIGINT NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_at TIMESTAMPTZ,
  channel TEXT,
  handled_by_name TEXT,
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage invoices" ON public.invoices FOR ALL TO authenticated USING (true);
CREATE POLICY "Public can view invoices by token" ON public.invoices FOR SELECT TO anon USING (public_token IS NOT NULL);

CREATE TABLE public.invoice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id),
  logo_url TEXT,
  company_name TEXT,
  company_address TEXT,
  company_phone TEXT,
  footer_note TEXT,
  show_logo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_invoice_settings_updated_at BEFORE UPDATE ON public.invoice_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view invoice settings" ON public.invoice_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage invoice settings" ON public.invoice_settings FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 9. WARRANTY CLAIMS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.stock_units(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issue_description TEXT,
  repair_branch_id UUID REFERENCES public.branches(id),
  status TEXT NOT NULL DEFAULT 'pending',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_warranty_claims_updated_at BEFORE UPDATE ON public.warranty_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view warranty claims" ON public.warranty_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage warranty claims" ON public.warranty_claims FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 10. CATALOG & MARKETING
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.master_products(id),
  display_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  thumbnail_url TEXT,
  override_display_price BIGINT,
  highlight_product BOOLEAN NOT NULL DEFAULT false,
  promo_badge TEXT,
  promo_label TEXT,
  rating_score NUMERIC(3,2) DEFAULT 0,
  free_shipping BOOLEAN NOT NULL DEFAULT false,
  spec_warranty_duration TEXT,
  catalog_status TEXT NOT NULL DEFAULT 'draft',
  publish_to_web BOOLEAN NOT NULL DEFAULT false,
  is_flash_sale BOOLEAN NOT NULL DEFAULT false,
  catalog_series TEXT,
  catalog_warranty_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_catalog_products_updated_at BEFORE UPDATE ON public.catalog_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Public can view published catalog" ON public.catalog_products FOR SELECT USING (catalog_status = 'published' AND publish_to_web = true);
CREATE POLICY "Authenticated users can view all catalog" ON public.catalog_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage catalog" ON public.catalog_products FOR ALL TO authenticated USING (true);

CREATE TABLE public.sale_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL,
  gradient_start TEXT,
  gradient_end TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_campaigns ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_sale_campaigns_updated_at BEFORE UPDATE ON public.sale_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can view active campaigns" ON public.sale_campaigns FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage campaigns" ON public.sale_campaigns FOR ALL TO authenticated USING (true);

CREATE TABLE public.sale_campaign_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.sale_campaigns(id) ON DELETE CASCADE,
  catalog_product_id UUID REFERENCES public.catalog_products(id),
  discount_percent INTEGER,
  discount_amount BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_campaign_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view campaign items" ON public.sale_campaign_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage campaign items" ON public.sale_campaign_items FOR ALL TO authenticated USING (true);

CREATE TABLE public.flash_sale_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flash_sale_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view flash sale settings" ON public.flash_sale_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage flash sale" ON public.flash_sale_settings FOR ALL TO authenticated USING (true);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT,
  product_name TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  customer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved reviews" ON public.reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Authenticated users can view all reviews" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage reviews" ON public.reviews FOR ALL TO authenticated USING (true);

CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value BIGINT NOT NULL DEFAULT 0,
  min_purchase BIGINT,
  max_discount BIGINT,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view discount codes" ON public.discount_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage discount codes" ON public.discount_codes FOR ALL TO authenticated USING (true);

CREATE TABLE public.bonus_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_product_id UUID REFERENCES public.catalog_products(id),
  bonus_name TEXT NOT NULL,
  bonus_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bonus_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active bonuses" ON public.bonus_products FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage bonuses" ON public.bonus_products FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 11. NOTIFICATIONS & ACTIVITY
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- 12. CUSTOMER
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province TEXT,
  city TEXT,
  district TEXT,
  village TEXT,
  postal_code TEXT,
  full_address TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users can view own addresses" ON public.customer_addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own addresses" ON public.customer_addresses FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
-- 13. PAYMENT METHODS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash',
  account_number TEXT,
  account_name TEXT,
  bank_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view payment methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage payment methods" ON public.payment_methods FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 14. RAJAONGKIR API KEYS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.rajaongkir_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT,
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rajaongkir_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rajaongkir keys" ON public.rajaongkir_api_keys FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage rajaongkir keys" ON public.rajaongkir_api_keys FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 15. STOK OPNAME
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.opname_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  session_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opname_sessions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_opname_sessions_updated_at BEFORE UPDATE ON public.opname_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view opname sessions" ON public.opname_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage opname sessions" ON public.opname_sessions FOR ALL TO authenticated USING (true);

CREATE TABLE public.opname_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opname_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view opname schedules" ON public.opname_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage opname schedules" ON public.opname_schedules FOR ALL TO authenticated USING (true);

CREATE TABLE public.opname_session_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.opname_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opname_session_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view opname assignments" ON public.opname_session_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage opname assignments" ON public.opname_session_assignments FOR ALL TO authenticated USING (true);

CREATE TABLE public.opname_scanned_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.opname_sessions(id) ON DELETE CASCADE,
  stock_unit_id UUID REFERENCES public.stock_units(id),
  scanned_value TEXT,
  scan_result TEXT NOT NULL DEFAULT 'matched',
  scanned_by UUID,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opname_scanned_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scanned items" ON public.opname_scanned_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage scanned items" ON public.opname_scanned_items FOR ALL TO authenticated USING (true);

CREATE TABLE public.opname_snapshot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.opname_sessions(id) ON DELETE CASCADE,
  stock_unit_id UUID REFERENCES public.stock_units(id),
  product_id UUID REFERENCES public.master_products(id),
  imei TEXT,
  serial_number TEXT,
  stock_status TEXT,
  branch_id UUID REFERENCES public.branches(id),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opname_snapshot_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view snapshot items" ON public.opname_snapshot_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage snapshot items" ON public.opname_snapshot_items FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 16. SERVICE VENDORS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.service_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_vendors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_service_vendors_updated_at BEFORE UPDATE ON public.service_vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view service vendors" ON public.service_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage service vendors" ON public.service_vendors FOR ALL TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 17. CHANGELOG
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'improvement',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view changelog" ON public.changelog_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage changelog" ON public.changelog_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- ══════════════════════════════════════════════════════════════
-- 18. RPC: get_active_flash_sale_info
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_active_flash_sale_info()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT row_to_json(t) FROM (
    SELECT is_active, start_time, end_time
    FROM public.flash_sale_settings
    WHERE is_active = true
    LIMIT 1
  ) t
$$;

-- ══════════════════════════════════════════════════════════════
-- 19. SEED: Default stock status labels
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.stock_status_labels (key, label, color_hue, color_saturation, color_lightness, sort_order, is_system) VALUES
  ('available', 'Tersedia', 142, 71, 45, 1, true),
  ('reserved', 'Dipesan', 38, 92, 50, 2, true),
  ('coming_soon', 'Coming Soon', 210, 60, 50, 3, true),
  ('service', 'Service', 280, 60, 50, 4, true),
  ('sold', 'Terjual', 217, 91, 60, 5, true),
  ('return', 'Retur', 0, 84, 60, 6, true),
  ('lost', 'Hilang', 0, 0, 45, 7, true);

-- Seed default warranty labels
INSERT INTO public.warranty_labels (key, label) VALUES
  ('resmi_bc', 'Resmi Bea Cukai (BC)'),
  ('ibox', 'Resmi Indonesia (iBox)'),
  ('inter', 'Internasional (Inter)'),
  ('whitelist', 'Whitelist Terdaftar'),
  ('digimap', 'Resmi Indonesia (Digimap)'),
  ('resmi', 'Resmi Apple Indonesia');
