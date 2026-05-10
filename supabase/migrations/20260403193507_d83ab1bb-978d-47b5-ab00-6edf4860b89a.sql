
-- opname_sessions: add missing columns
ALTER TABLE public.opname_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'adhoc',
  ADD COLUMN IF NOT EXISTS session_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS total_expected INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_scanned INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_match INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_missing INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_unregistered INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- opname_schedules: add missing columns
ALTER TABLE public.opname_schedules
  ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS cron_time TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS days_of_week INTEGER[];

-- opname_snapshot_items: add missing columns
ALTER TABLE public.opname_snapshot_items
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.stock_units(id),
  ADD COLUMN IF NOT EXISTS product_label TEXT,
  ADD COLUMN IF NOT EXISTS selling_price BIGINT,
  ADD COLUMN IF NOT EXISTS cost_price BIGINT,
  ADD COLUMN IF NOT EXISTS scan_result TEXT NOT NULL DEFAULT 'match',
  ADD COLUMN IF NOT EXISTS action_taken TEXT,
  ADD COLUMN IF NOT EXISTS action_notes TEXT,
  ADD COLUMN IF NOT EXISTS sold_reference_id TEXT;

-- opname_scanned_items: add missing columns
ALTER TABLE public.opname_scanned_items
  ADD COLUMN IF NOT EXISTS imei TEXT,
  ADD COLUMN IF NOT EXISTS action_taken TEXT,
  ADD COLUMN IF NOT EXISTS action_notes TEXT;

-- warranty_claims: add missing columns
ALTER TABLE public.warranty_claims
  ADD COLUMN IF NOT EXISTS claim_type TEXT NOT NULL DEFAULT 'unit_warranty',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS repair_cost BIGINT,
  ADD COLUMN IF NOT EXISTS resolution_type TEXT,
  ADD COLUMN IF NOT EXISTS replacement_unit_id UUID REFERENCES public.stock_units(id),
  ADD COLUMN IF NOT EXISTS service_vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS service_vendor_id UUID REFERENCES public.service_vendors(id),
  ADD COLUMN IF NOT EXISTS claimed_by UUID;

-- payment_methods: add branch_id
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- discount_codes: add missing columns
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS discount_percent INTEGER,
  ADD COLUMN IF NOT EXISTS min_purchase_amount BIGINT,
  ADD COLUMN IF NOT EXISTS applies_to_all BOOLEAN NOT NULL DEFAULT true;
