import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useBarcodeScanner } from "@/hooks/admin/use-barcode-scanner";
import { Plus, Search, LayoutGrid, List, X, RefreshCw, Download, AlertCircle, Trash2, CalendarIcon, ArrowUpDown, ChevronLeft, ChevronRight, Settings2, Filter, Clock, ShieldCheck, ShieldOff, Upload, Package, ChevronDown, Check, Lock, Package2, TrendingDown, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays, differenceInHours } from "date-fns";
import type { DateRange } from "react-day-picker";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/admin/laporan/activity-log";
import { useAuth } from "@/contexts/admin/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableDropdown } from "@/components/shared/SearchableDropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { StockStatusBadge, ConditionBadge } from "@/components/admin/produk/StockBadges";
import { UnitDetailDrawer } from "@/components/admin/produk/UnitDetailDrawer";
import { StatusLabelManager } from "@/components/admin/produk/StatusLabelManager";
import { ImportStockModal } from "@/components/admin/produk/ImportStockModal";
import { QuickEcommerceSaleModal } from "@/components/admin/produk/QuickEcommerceSaleModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/shared/use-toast";
import { useStatusLabels } from "@/hooks/admin/use-status-labels";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { cn } from "@/lib/utils";
import { PageHeader, EmptyState, AdminDataTable, AdminTabGroup } from "@/components/shared";
import {
  StockUnit,
  SoldChannel,
  SOLD_CHANNEL_SHORT,
  formatCurrency,
  formatDate,
  getStatusStyles,
  getStatusLabel,
  getUnitIdentifier,
  isUnitTracked,
  getAdaptiveIdentifierLabel,
  type StatusLabel,
} from "@/lib/admin/produk/stock-units";
import {
  WARRANTY_LABELS,
  CATEGORY_LABELS,
  IMEI_STOCK_CATEGORIES,
  UNIT_TRACKED_CATEGORIES,
  FIXED_RESMI_CATEGORIES,
  type WarrantyType,
  type ProductCategory,
} from "@/lib/admin/produk/master-products";
import { useNavigate, useSearchParams } from "react-router-dom";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface SummaryCard { status: string; unitCount: number; qtyCount: number; }
interface Branch { id: string; name: string; }
interface Supplier { id: string; name: string; }

const getWarrantyLabel = (key: string | undefined | null): string => {
  if (!key) return "—";
  return WARRANTY_LABELS[key as WarrantyType] ?? key.replace(/_/g, " ");
};

function formatDuration(days: number, hours: number): string {
  if (days === 0) return `${hours} jam`;
  if (hours === 0) return `${days} hari`;
  return `${days} hari ${hours} jam`;
}

function getUnitDuration(unit: StockUnit): { label: string; tooltip: string; color: string } {
  const now = new Date();
  const received = new Date(unit.received_at);

  if (unit.stock_status === "sold") {
    if (!unit.sold_at) return { label: "Tanggal belum diset", tooltip: "Cycle Time belum tersedia — atur tanggal terjual", color: "text-muted-foreground" };
    if (!unit.sold_channel) return { label: "Kanal belum diset", tooltip: "Cycle Time belum tersedia — atur kanal penjualan", color: "text-muted-foreground" };
    const sold = new Date(unit.sold_at);
    const days = differenceInDays(sold, received);
    const hours = differenceInHours(sold, received) % 24;
    return { label: formatDuration(days, hours), tooltip: "Cycle Time: Waktu dari barang masuk hingga terjual", color: days <= 7 ? "text-primary" : days <= 30 ? "text-foreground" : "text-destructive" };
  }
  if (unit.stock_status === "service") {
    const statusChanged = new Date(unit.status_changed_at);
    const days = differenceInDays(now, statusChanged);
    const hours = differenceInHours(now, statusChanged) % 24;
    return { label: formatDuration(days, hours), tooltip: "Durasi Service: Sudah menunggu perbaikan", color: days > 14 ? "text-destructive" : days > 7 ? "text-amber-600" : "text-foreground" };
  }
  if (unit.stock_status === "reserved") {
    const statusChanged = new Date(unit.status_changed_at);
    const days = differenceInDays(now, statusChanged);
    const hours = differenceInHours(now, statusChanged) % 24;
    return { label: formatDuration(days, hours), tooltip: "Durasi Dipesan: Sudah dalam status dipesan", color: days > 3 ? "text-destructive" : "text-foreground" };
  }
  const days = differenceInDays(now, received);
  const hours = differenceInHours(now, received) % 24;
  return { label: formatDuration(days, hours), tooltip: "Lama di Etalase: Sudah berada di stok sejak barang masuk", color: days > 60 ? "text-destructive" : days > 30 ? "text-amber-600" : "text-foreground" };
}

type StockUnitWithBranch = StockUnit & { branches?: { name: string } | null };

function StockBadgeQty({ qty }: { qty: number | null }) {
  const q = qty ?? 0;
  const cls = q === 0
    ? "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25"
    : q <= 10
    ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25"
    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border", cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
      Stok {q}
    </span>
  );
}

export default function StockProductsPage() {
  const { role, activeBranch, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { statusLabels, refetch: refetchLabels } = useStatusLabels();
  const isSuperAdmin = role === "super_admin";
  const isAdminBranch = role === "admin_branch";
  const isEmployee = role === "employee";
  const canEditStatus = isSuperAdmin || isAdminBranch;

  const [units, setUnits] = useState<StockUnitWithBranch[]>([]);
  const [summary, setSummary] = useState<SummaryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "compact">("table");

  const [warrantyClaimsMap, setWarrantyClaimsMap] = useState<Record<string, { claim_type: string; claim_status: string }[]>>({});

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Branch filter
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranch, setFilterBranch] = useState("all");

  // Supplier filter
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterSupplier, setFilterSupplier] = useState("all");

  // Filters
  const searchInputRef = useRef<HTMLInputElement>(null);
  useBarcodeScanner(searchInputRef, { enabled: true });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set(["available"]));
  const [showAll, setShowAll] = useState(false);
  const [showOverview, setShowOverview] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const isMobile = useIsMobile();

  // Series multi-select filter
  const [filterSeries, setFilterSeries] = useState<Set<string>>(new Set());
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  const [seriesOpen, setSeriesOpen] = useState(false);

  // Warranty type filter
  const [filterWarranty, setFilterWarranty] = useState("all");

  // Date filter
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Modals
  const [selectedUnit, setSelectedUnit] = useState<StockUnit | null>(null);
  const [exportEmptyOpen, setExportEmptyOpen] = useState(false);
  const [statusManagerOpen, setStatusManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const [quickSaleUnit, setQuickSaleUnit] = useState<StockUnit | null>(null);

  // Inline status change
  const [inlineStatusUnit, setInlineStatusUnit] = useState<string | null>(null);
  const [inlineNewStatus, setInlineNewStatus] = useState<string>("");
  const [inlineSoldChannel, setInlineSoldChannel] = useState<SoldChannel | "">("");
  const [inlineUpdating, setInlineUpdating] = useState(false);

  // Bulk delete (unit-tracked only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // ── Tab: Stok Unit | Aksesoris ──
  const [activeTab, setActiveTab] = useState<"unit" | "accessory">("unit");

  // Acc + unit product IDs — fetched once in parallel, stored in refs
  const accProductIdsRef = useRef<string[]>([]);
  const unitProductIdsRef = useRef<string[]>([]);
  const [productIdsReady, setProductIdsReady] = useState(false);
  useEffect(() => {
    Promise.all([
      supabase.from("master_products").select("id").eq("category", "accessory" as any).is("deleted_at", null),
      supabase.from("master_products").select("id").in("category", UNIT_TRACKED_CATEGORIES as any).is("deleted_at", null),
    ]).then(([accRes, unitRes]) => {
      accProductIdsRef.current = accRes.data?.map((d: any) => d.id) ?? [];
      unitProductIdsRef.current = unitRes.data?.map((d: any) => d.id) ?? [];
      setProductIdsReady(true);
    });
  }, []);

  // Accessory stock state
  type AccItem = {
    master_product_id: string; name: string; category: string; qty_remaining: number;
    latest_in_date: string | null; base_price: number | null;
    price_min: number | null; price_max: number | null;
  };
  const [accItems, setAccItems] = useState<AccItem[]>([]);
  const [accSearch, setAccSearch] = useState("");
  const [accLoading, setAccLoading] = useState(false);
  const [accPage, setAccPage] = useState(1);
  const [accPageSize, setAccPageSize] = useState(15);

  // Add stock modal (purchase only)
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addStockTarget, setAddStockTarget] = useState<{ id: string; name: string } | null>(null);
  const [addStockQty, setAddStockQty] = useState("");
  const [addStockPrice, setAddStockPrice] = useState("");
  const [addStockDate, setAddStockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [addStockNotes, setAddStockNotes] = useState("");
  const [addStockSubmitting, setAddStockSubmitting] = useState(false);

  // Sticky filter bar height measurement for AdminDataTable
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [filterBarHeight, setFilterBarHeight] = useState(0);
  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFilterBarHeight(el.offsetHeight));
    ro.observe(el);
    setFilterBarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const activeStatusKeys = useMemo(() => statusLabels.filter(s => s.is_active).map(s => s.key), [statusLabels]);

  // Determine active category for adaptive columns
  const activeCategory = filterCategory !== "all" ? filterCategory as ProductCategory : null;
  const showAccessoryOnly = activeCategory === "accessory";
  const showUnitTrackedOnly = activeCategory !== null && activeCategory !== "accessory";
  const identifierLabel = getAdaptiveIdentifierLabel(activeCategory ? [activeCategory] : null);
  const showIdentifierCol = !showAccessoryOnly;

  // Warranty lock: iPad, MacBook, Watch, AirPods always "Resmi"
  const warrantyLocked = activeCategory !== null && FIXED_RESMI_CATEGORIES.includes(activeCategory);
  // Only apply warranty filter for non-locked categories
  const effectiveWarranty = warrantyLocked ? "all" : filterWarranty;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatuses, showAll, filterCategory, filterCondition, dateRange, sortOrder, filterBranch, filterSupplier, pageSize, filterSeries, effectiveWarranty]);

  // (Auto-focus removed — search only triggers from USB scanner via useBarcodeScanner hook)

  // Fetch branches (super admin)
  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from("branches").select("id, name").eq("is_active", true).order("name")
        .then(({ data }) => setBranches(data ?? []));
    }
  }, [isSuperAdmin]);

  // Fetch suppliers
  useEffect(() => {
    supabase.from("suppliers").select("id, name").order("name")
      .then(({ data }) => setSuppliers(data ?? []));
  }, []);

  // Build base query with filters
  const applyFilters = useCallback((query: any) => {
    if (!showAll) {
      query = query.in("stock_status", Array.from(filterStatuses));
    }
    if (isSuperAdmin && filterBranch !== "all") {
      query = query.eq("branch_id", filterBranch);
    }
    if (filterCondition === "no_minus") query = query.eq("condition_status", "no_minus");
    else if (filterCondition === "minus") query = query.eq("condition_status", "minus");
    if (filterSupplier !== "all") query = query.eq("supplier_id", filterSupplier);
    if (dateRange?.from) query = query.gte("received_at", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) {
      const toDate = new Date(dateRange.to);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt("received_at", format(toDate, "yyyy-MM-dd"));
    }
    return query;
  }, [showAll, filterStatuses, filterCondition, dateRange, isSuperAdmin, filterBranch, filterSupplier]);

  // Fetch series options when category changes
  useEffect(() => {
    if (filterCategory === "all") { setSeriesOptions([]); setFilterSeries(new Set()); return; }
    supabase.from("master_products")
      .select("series")
      .is("deleted_at", null)
      .eq("category", filterCategory as any)
      .order("series")
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((d: any) => d.series).filter(Boolean))];
        setSeriesOptions(unique);
      });
    setFilterSeries(new Set());
    setFilterWarranty("all");
  }, [filterCategory]);


  const fetchUnits = useCallback(async () => {
    if (!productIdsReady) return;

    setLoading(true);
    setError(null);

    const hasProductFilter = filterCategory !== "all" || filterSeries.size > 0 || effectiveWarranty !== "all";
    const hasSearch = Boolean(debouncedSearch.trim());

    // Resolve product IDs + search in parallel — no external state needed
    const [effectiveProductIds, searchRes] = await Promise.all([
      hasProductFilter
        ? (async (): Promise<string[]> => {
            let q = supabase.from("master_products").select("id").is("deleted_at", null) as any;
            if (filterCategory !== "all") q = q.eq("category", filterCategory);
            if (filterSeries.size > 0) q = q.in("series", Array.from(filterSeries));
            if (effectiveWarranty !== "all") q = q.eq("warranty_type", effectiveWarranty);
            const { data } = await q;
            return data?.map((d: any) => d.id) ?? [];
          })()
        : Promise.resolve(null as string[] | null),

      hasSearch
        ? (async () => {
            const term = debouncedSearch.trim();
            const [prodRes, branchRes] = await Promise.all([
              supabase.from("master_products").select("id").is("deleted_at", null).or(`series.ilike.%${term}%,color.ilike.%${term}%`),
              supabase.from("branches").select("id").ilike("name", `%${term}%`),
            ]);
            return {
              productIds: prodRes.data?.map((d: any) => d.id) ?? [] as string[],
              branchIds: branchRes.data?.map((d: any) => d.id) ?? [] as string[],
            };
          })()
        : Promise.resolve(null as { productIds: string[]; branchIds: string[] } | null),
    ]);

    if (effectiveProductIds !== null && effectiveProductIds.length === 0) {
      setUnits([]); setTotalCount(0); setLoading(false); return;
    }

    const buildSearchFilter = (query: any, includeSerial = true) => {
      if (!hasSearch || !searchRes) return query;
      const term = debouncedSearch.trim();
      const orParts: string[] = [`imei.ilike.%${term}%`];
      if (includeSerial) orParts.push(`serial_number.ilike.%${term}%`);
      orParts.push(`supplier.ilike.%${term}%`);
      if (searchRes.productIds.length > 0) orParts.push(`product_id.in.(${searchRes.productIds.join(",")})`);
      if (searchRes.branchIds.length > 0) orParts.push(`branch_id.in.(${searchRes.branchIds.join(",")})`);
      return query.or(orParts.join(","));
    };

    const runQueries = async (includeSerial: boolean) => {
      const accIds = accProductIdsRef.current;

      let countQuery = supabase.from("stock_units").select("id", { count: "exact", head: true });
      countQuery = applyFilters(countQuery);
      if (effectiveProductIds) countQuery = countQuery.in("product_id", effectiveProductIds);
      if (accIds.length > 0) countQuery = countQuery.not("product_id", "in", `(${accIds.join(",")})`);
      countQuery = buildSearchFilter(countQuery, includeSerial);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let dataQuery = supabase
        .from("stock_units")
        .select(`*, master_products(series, storage_gb, color, warranty_type, category), branches(name)`)
        .order("received_at", { ascending: sortOrder === "asc" })
        .range(from, to);
      dataQuery = applyFilters(dataQuery);
      if (effectiveProductIds) dataQuery = dataQuery.in("product_id", effectiveProductIds);
      if (accIds.length > 0) dataQuery = dataQuery.not("product_id", "in", `(${accIds.join(",")})`);
      dataQuery = buildSearchFilter(dataQuery, includeSerial);

      return Promise.all([countQuery, dataQuery]);
    };

    let [countResult, dataResult] = await runQueries(true);

    if (dataResult.error) {
      const msg = dataResult.error.message ?? "";
      const isColumnError = msg.includes("serial_number") || msg.includes("column") || msg.includes("42703");
      // Fall back: disable serial_number column filter, or remove accessor-specific columns
      if (isColumnError && hasSearch) {
        [countResult, dataResult] = await runQueries(false);
      }
      // If still failing (e.g. qty_available column missing), show error but don't crash
      if (dataResult.error) {
        setError(dataResult.error.message);
        setLoading(false);
        return;
      }
    }

    if (dataResult.error) { setError(dataResult.error.message); setLoading(false); return; }
    setTotalCount(countResult.count ?? 0);
    setUnits((dataResult.data as unknown as StockUnitWithBranch[]) ?? []);
    setLoading(false);
  }, [
    productIdsReady, debouncedSearch, filterStatuses, showAll, filterCondition,
    dateRange, sortOrder, isSuperAdmin, filterBranch, filterSupplier, page, pageSize,
    applyFilters, filterCategory, filterSeries, effectiveWarranty,
  ]);

  // Fetch summary cards — batch product_ids to avoid URL length limits (>~100 chars in "in" clause)
  const fetchSummary = useCallback(async () => {
    if (!productIdsReady) return;
    const branchFilter = isSuperAdmin && filterBranch !== "all" ? filterBranch : null;
    const unitProdIds = unitProductIdsRef.current;
    const accProdIds  = accProductIdsRef.current;

    // Split array into chunks of ≤5 to keep URL length manageable for PostgREST
    const chunk = <Item,>(arr: Item[], size: number): Item[][] => {
      const result: Item[][] = [];
      for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
      return result;
    };

    // Unit products: count by stock_status
    const unitBatches = chunk(unitProdIds, 5);
    const unitQs = unitBatches.map(ids => {
      let q = supabase.from("stock_units").select("stock_status");
      if (branchFilter) q = q.eq("branch_id", branchFilter);
      return ids.length > 0 ? q.in("product_id", ids) : Promise.resolve({ data: [], error: null });
    });

    // Accessory products: try qty_available first, fall back to row count
    // (qty_available column may not exist in older DB schemas)
    const accBatches = chunk(accProdIds, 5);
    const accQs = accBatches.map(ids => {
      if (ids.length === 0) return Promise.resolve({ data: [], error: null });
      let q = supabase.from("stock_units").select("stock_status, qty_available");
      if (branchFilter) q = q.eq("branch_id", branchFilter);
      return q.in("product_id", ids)
        .then(r => ({ ...r, error: r.error?.code === "42703" ? null : r.error }));
    });
    const accQsFallback = accBatches.map(ids => {
      if (ids.length === 0) return Promise.resolve({ data: [], error: null });
      let q = supabase.from("stock_units").select("stock_status");
      if (branchFilter) q = q.eq("branch_id", branchFilter);
      return q.in("product_id", ids);
    });

    const [uResArr, aResArr, aResFallbackArr] = await Promise.all([
      Promise.all(unitQs),
      Promise.all(accQs),
      Promise.all(accQsFallback),
    ]);

    const unitRows = uResArr.flatMap(r => (r.error ? [] : r.data as any[]));
    // If any batch hit the "42703 undefined column" error, use row count fallback
    const hasColError = aResArr.some(r => r.error?.code === "42703");
    const accRows = hasColError
      ? aResFallbackArr.flatMap(r => (r.error ? [] : r.data as any[]))
      : aResArr.flatMap(r => (r.error ? [] : r.data as any[]));

    // Aggregate in JS
    const unitCountMap: Record<string, number> = {};
    unitRows.forEach((r: any) => { unitCountMap[r.stock_status] = (unitCountMap[r.stock_status] ?? 0) + 1; });

    const accQtyMap: Record<string, number> = {};
    accRows.forEach((r: any) => { accQtyMap[r.stock_status] = (accQtyMap[r.stock_status] ?? 0) + (r.qty_available ?? 0); });

    const cards: SummaryCard[] = [];
    let totalUnit = 0;
    let totalQty = 0;
    activeStatusKeys.forEach(s => {
      const unitCount = unitCountMap[s] ?? 0;
      const qtyCount  = accQtyMap[s] ?? 0;
      cards.push({ status: s, unitCount, qtyCount });
      totalUnit += unitCount;
      totalQty  += qtyCount;
    });
    cards.unshift({ status: "all", unitCount: totalUnit, qtyCount: totalQty });
    setSummary(cards);
  }, [productIdsReady, isSuperAdmin, filterBranch, activeStatusKeys]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Fetch warranty claims for sold units
  useEffect(() => {
    const soldUnitIds = units.filter(u => u.stock_status === "sold").map(u => u.id);
    if (soldUnitIds.length === 0) { setWarrantyClaimsMap({}); return; }
    supabase.from("warranty_claims").select("unit_id, claim_type, claim_status")
      .in("unit_id", soldUnitIds)
      .then(({ data }) => {
        const map: Record<string, { claim_type: string; claim_status: string }[]> = {};
        (data ?? []).forEach((c: any) => {
          if (!map[c.unit_id]) map[c.unit_id] = [];
          map[c.unit_id].push({ claim_type: c.claim_type, claim_status: c.claim_status });
        });
        setWarrantyClaimsMap(map);
      });
  }, [units]);

  const handleRefresh = () => { fetchUnits(); fetchSummary(); setSelectedIds(new Set()); setConfirmBulkDelete(false); };
  const isDefaultFilter = !showAll && filterStatuses.size === 1 && filterStatuses.has("available");
  const resetFilters = () => {
    setSearch(""); setDebouncedSearch(""); setFilterStatuses(new Set(["available"])); setShowAll(false);
    setFilterCategory("all"); setFilterCondition("all"); setDateRange(undefined);
    setSortOrder("desc"); setFilterBranch("all"); setFilterSupplier("all");
    setFilterSeries(new Set()); setFilterWarranty("all");
  };
  const hasActiveFilters = search || !isDefaultFilter || filterCategory !== "all" || filterCondition !== "all" || dateRange?.from || showAll || filterSupplier !== "all" || filterBranch !== "all" || filterSeries.size > 0 || filterWarranty !== "all";
  const activeFilterCount = [filterCategory !== "all", filterCondition !== "all", filterSeries.size > 0, filterWarranty !== "all", dateRange?.from, filterBranch !== "all", filterSupplier !== "all"].filter(Boolean).length;

  // Bulk delete (unit-tracked only)
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const unitTrackedIds = units.filter(u => isUnitTracked(u)).map(u => u.id);
  const toggleSelectAll = () => {
    if (selectedIds.size === unitTrackedIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(unitTrackedIds));
  };
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const { error } = await supabase.from("stock_units").delete().in("id", Array.from(selectedIds));
    setBulkDeleting(false);
    if (error) { toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" }); return; }
    logActivity({ action: "delete_stock_units", actor_id: user?.id, actor_email: user?.email, actor_role: role, metadata: { count: selectedIds.size } });
    toast({ title: `${selectedIds.size} unit berhasil dihapus` });
    handleRefresh();
  };

  // Inline status change
  const getValidTransitions = (currentStatus: string): string[] => {
    if (isSuperAdmin) return activeStatusKeys.filter(s => s !== currentStatus);
    if (isAdminBranch) return activeStatusKeys.filter(s => s !== currentStatus && s !== "lost");
    if (isEmployee) {
      if (currentStatus === "available") return ["reserved", "coming_soon", "service"].filter(s => activeStatusKeys.includes(s));
      return [];
    }
    return [];
  };

  const canEditSoldChannel = isSuperAdmin || isAdminBranch;

  const handleSoldChannelUpdate = async (unitId: string, channel: SoldChannel) => {
    setInlineUpdating(true);
    const { error } = await supabase.from("stock_units").update({ sold_channel: channel } as never).eq("id", unitId);
    setInlineUpdating(false);
    if (error) { toast({ title: "Gagal mengubah channel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Channel penjualan berhasil diperbarui" });
    handleRefresh();
  };

  const handleInlineStatusChange = async (unitId: string, currentStatus: string, newStatus: string) => {
    if (newStatus === currentStatus) return;
    if (newStatus === "sold") {
      const unitObj = units.find(u => u.id === unitId);
      if (unitObj) {
        setQuickSaleUnit(unitObj);
        setQuickSaleOpen(true);
      }
      return;
    }
    setInlineUpdating(true);
    const { error } = await supabase.from("stock_units").update({ stock_status: newStatus } as never).eq("id", unitId);
    setInlineUpdating(false);
    if (error) { toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" }); return; }
    logActivity({ action: "change_stock_status", actor_id: user?.id, actor_email: user?.email, actor_role: role, metadata: { unit_id: unitId, from: currentStatus, to: newStatus } });
    toast({ title: "Status berhasil diperbarui" });
    handleRefresh();
  };

  const handleSoldChannelConfirm = async () => {
    if (!inlineStatusUnit || !inlineSoldChannel) return;
    setInlineUpdating(true);
    const { error } = await supabase.from("stock_units").update({ stock_status: "sold", sold_channel: inlineSoldChannel } as never).eq("id", inlineStatusUnit);
    setInlineUpdating(false);
    if (error) { toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" }); return; }
    logActivity({ action: "change_stock_status", actor_id: user?.id, actor_email: user?.email, actor_role: role, metadata: { unit_id: inlineStatusUnit, to: "sold", channel: inlineSoldChannel } });
    toast({ title: "Status berhasil diperbarui" });
    setInlineStatusUnit(null); setInlineNewStatus(""); setInlineSoldChannel("");
    handleRefresh();
  };

  const dateLabel = () => {
    if (dateRange?.from && dateRange?.to) return `${format(dateRange.from, "dd MMM", { locale: localeId })} — ${format(dateRange.to, "dd MMM yy", { locale: localeId })}`;
    if (dateRange?.from) return format(dateRange.from, "dd MMM yy", { locale: localeId });
    return "Tanggal";
  };

  const getSoldChannelOptions = () => {
    if (isSuperAdmin || isAdminBranch) return [
      { value: "pos", label: "Terjual Offline Store (POS)" },
      { value: "ecommerce_tokopedia", label: "Terjual E-Commerce (Tokopedia)" },
      { value: "ecommerce_shopee", label: "Terjual E-Commerce (Shopee)" },
      { value: "website", label: "Terjual Online (Website)" },
    ];
    return [
      { value: "ecommerce_tokopedia", label: "Terjual E-Commerce (Tokopedia)" },
      { value: "ecommerce_shopee", label: "Terjual E-Commerce (Shopee)" },
    ];
  };

  // ── Accessory: handle ?tambah=1&pid=... from BonusPage CTA ──
  useEffect(() => {
    const tambah = searchParams.get("tambah");
    const pid = searchParams.get("pid");
    if (tambah === "1") {
      setActiveTab("accessory");
      if (pid) {
        const pname = decodeURIComponent(searchParams.get("pname") ?? "Produk");
        setAddStockTarget({ id: pid, name: pname });
        setAddStockOpen(true);
      }
    }
  }, [searchParams]);

  // ── Accessory: fetch summary ──
  const fetchAccItems = useCallback(async () => {
    setAccLoading(true);
    const [summaryRes, ledgerRes, masterRes] = await Promise.all([
      supabase.from("accessory_stock_summary").select("master_product_id, name, category, qty_remaining").order("name"),
      supabase.from("accessory_stock_ledger").select("master_product_id, transaction_date, unit_price").eq("movement_type", "purchase").order("transaction_date", { ascending: false }),
      supabase.from("master_products").select("id, base_price").is("deleted_at", null).eq("category", "accessory" as any),
    ]);
    const summary = (summaryRes.data as any) ?? [];
    const ledger = (ledgerRes.data as any) ?? [];
    const masters = (masterRes.data as any) ?? [];

    // Latest purchase date per product
    const latestInMap: Record<string, string> = {};
    ledger.forEach((e: any) => { if (!latestInMap[e.master_product_id]) latestInMap[e.master_product_id] = e.transaction_date; });

    // Price range from purchase ledger entries
    const priceRangeMap: Record<string, { min: number; max: number }> = {};
    ledger.forEach((e: any) => {
      if (e.unit_price == null) return;
      const p = priceRangeMap[e.master_product_id];
      if (!p) { priceRangeMap[e.master_product_id] = { min: e.unit_price, max: e.unit_price }; }
      else { priceRangeMap[e.master_product_id] = { min: Math.min(p.min, e.unit_price), max: Math.max(p.max, e.unit_price) }; }
    });

    // Fallback: base_price from master_products
    const priceMap: Record<string, number | null> = {};
    masters.forEach((m: any) => { priceMap[m.id] = m.base_price; });

    setAccItems(summary.map((item: any) => {
      const pr = priceRangeMap[item.master_product_id];
      return {
        ...item,
        latest_in_date: latestInMap[item.master_product_id] ?? null,
        base_price: priceMap[item.master_product_id] ?? null,
        price_min: pr?.min ?? priceMap[item.master_product_id] ?? null,
        price_max: pr?.max ?? priceMap[item.master_product_id] ?? null,
      };
    }));
    setAccLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "accessory") fetchAccItems();
  }, [activeTab, fetchAccItems]);


  // ── Accessory: submit add stock ──
  const handleAddStock = async () => {
    if (!addStockTarget || !addStockQty || Number(addStockQty) <= 0) return;
    setAddStockSubmitting(true);
    const { error } = await supabase.from("accessory_stock_ledger").insert({
      master_product_id: addStockTarget.id,
      qty: Number(addStockQty),
      movement_type: "purchase",
      transaction_date: addStockDate,
      notes: addStockNotes.trim() || null,
      unit_price: addStockPrice && Number(addStockPrice) > 0 ? Number(addStockPrice) : null,
    });
    setAddStockSubmitting(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Stok berhasil ditambahkan", description: `+${addStockQty} unit ${addStockTarget.name}` });
      setAddStockOpen(false);
      setAddStockQty("");
      setAddStockPrice("");
      setAddStockNotes("");
      setAddStockDate(format(new Date(), "yyyy-MM-dd"));
      fetchAccItems();
    }
  };

  // Pagination range
  const paginationRange = useMemo(() => {
    const delta = 1;
    const range: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) range.push(i);
      else if (range[range.length - 1] !== "...") range.push("...");
    }
    return range;
  }, [page, totalPages]);

  // CSV Export adaptive
  const handleExport = () => {
    if (units.length === 0) { setExportEmptyOpen(true); return; }
    const csvRows = units.map((u) => {
      const category = u.master_products?.category ?? "";
      const isAcc = category === "accessory";
      const prod = [u.master_products?.series, u.master_products?.storage_gb ? u.master_products.storage_gb + "GB" : "", u.master_products?.color, getWarrantyLabel(u.master_products?.warranty_type)].filter(Boolean).join(" ");
      const identifier = getUnitIdentifier(u) ?? "";
      const identifierHeader = IMEI_STOCK_CATEGORIES.includes(category as ProductCategory) ? "IMEI" : "Serial Number";
      if (isAcc) {
        const row = [
          CATEGORY_LABELS["accessory"],
          u.master_products?.series ?? "",
          u.qty_available?.toString() ?? "0",
          isSuperAdmin ? (u.cost_price_per_unit?.toString() ?? "") : undefined,
          u.selling_price?.toString() ?? "",
          u.supplier ?? "",
          (u.branches as any)?.name ?? "",
          u.received_at ? new Date(u.received_at).toLocaleDateString("id-ID") : "",
        ].filter((v): v is string => v !== undefined);
        return row.join(",");
      }
      const kondisi = u.condition_status === "no_minus" ? "No Minus" : "Ada Minus";
      const status = u.stock_status === "sold" && u.sold_channel ? `Terjual ${SOLD_CHANNEL_SHORT[u.sold_channel as SoldChannel]}` : u.stock_status;
      if (isSuperAdmin) {
        return [CATEGORY_LABELS[category as ProductCategory] ?? category, prod, identifier, kondisi, u.selling_price?.toString() ?? "", u.cost_price?.toString() ?? "", status, u.supplier ?? "", u.received_at ? new Date(u.received_at).toLocaleDateString("id-ID") : ""].join(",");
      }
      return [CATEGORY_LABELS[category as ProductCategory] ?? category, prod, identifier, kondisi, u.selling_price?.toString() ?? "", status, u.received_at ? new Date(u.received_at).toLocaleDateString("id-ID") : ""].join(",");
    });
    const isSingleCategory = filterCategory !== "all" && filterCategory === "accessory";
    const csvHeaders = isSingleCategory
      ? (isSuperAdmin ? ["Kategori", "Nama Produk", "Jumlah Stok", "Harga Modal/Pcs", "Harga Jual", "Supplier", "Cabang", "Tgl Masuk"] : ["Kategori", "Nama Produk", "Jumlah Stok", "Harga Jual", "Supplier", "Cabang", "Tgl Masuk"])
      : (isSuperAdmin ? ["Kategori", "Produk", "IMEI / Serial", "Kondisi", "Harga Jual", "Harga Modal", "Status", "Supplier", "Tgl Masuk"] : ["Kategori", "Produk", "IMEI / Serial", "Kondisi", "Harga Jual", "Status", "Tgl Masuk"]);
    const csv = [csvHeaders.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stok-produk-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout pageTitle="Manajemen Stok Produk">
      <div className="pb-20">

        {/* ── Page header — not sticky ── */}
        <div className="pt-3 pb-2">
          <PageHeader
            title="Manajemen Stok Produk"
            subtitle="Pemantauan stok unit dan aksesoris di seluruh cabang."
            actions={
              <>
                {/* Tab switcher — dipindah ke header agar selalu terlihat */}
                <div className="flex rounded-lg border border-border overflow-hidden shrink-0 h-8 sm:h-9">
                  <button
                    onClick={() => setActiveTab("unit")}
                    className={cn("px-2.5 sm:px-3 text-xs font-medium flex items-center gap-1.5 transition-colors",
                      activeTab === "unit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60")}
                  >
                    <Package className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Stok Unit</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab("accessory"); setAccPage(1); }}
                    className={cn("px-2.5 sm:px-3 text-xs font-medium flex items-center gap-1.5 transition-colors border-l border-border",
                      activeTab === "accessory" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60")}
                  >
                    <Package2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Aksesoris</span>
                  </button>
                </div>
                <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1.5 text-xs" onClick={handleRefresh}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Segarkan</span>
                </Button>
                {isSuperAdmin && (
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1.5 text-xs" onClick={() => setStatusManagerOpen(true)}>
                    <Settings2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Kelola Status</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1.5 text-xs" onClick={handleExport}>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ekspor</span>
                </Button>
                {(isSuperAdmin || isAdminBranch) && (
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1.5 text-xs" onClick={() => setImportOpen(true)}>
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Import CSV</span>
                  </Button>
                )}
                {(isSuperAdmin || isAdminBranch) && (
                  <Button size="sm" className="h-8 sm:h-9 gap-1.5 text-xs" onClick={() => navigate("/admin/stok-produk/tambah")}>
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Tambah Stok</span>
                    <span className="xs:hidden">Tambah</span>
                  </Button>
                )}
              </>
            }
          />
        </div>

        {/* ── Summary cards — not sticky (unit tab only) ── */}
        {activeTab === "unit" && (
        <div className="pb-3">

        {/* ── Summary cards ── */}
        <div>
          {/* Toggle row */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Overview</span>
            <button
              onClick={() => setShowOverview(v => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showOverview ? "Sembunyikan" : "Tampilkan"}
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", showOverview ? "rotate-180" : "rotate-0")} />
            </button>
          </div>

          {/* Cards — collapsible */}
          <div className={cn(
            "overflow-hidden transition-all duration-300",
            showOverview ? "max-h-[120px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          )}>
            <div className="flex overflow-x-auto gap-2 sm:gap-2.5 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
              {(() => {
                const card = summary.find(c => c.status === "all");
                const total = (card?.unitCount ?? 0) + (card?.qtyCount ?? 0);
                return (
                  <button
                    onClick={() => { setShowAll(true); setFilterStatuses(new Set(activeStatusKeys)); }}
                    className={cn("min-w-[80px] sm:min-w-0 sm:flex-1 flex-shrink-0 rounded-xl border border-border bg-card px-3 py-3 sm:px-4 sm:py-3.5 text-left transition-all duration-150 hover:shadow-sm", showAll && "bg-muted/60 border-border shadow-sm")}
                  >
                    <p className="text-xl sm:text-2xl font-bold leading-none text-foreground">{total}</p>
                    <p className="text-[10px] mt-1.5 font-semibold uppercase tracking-wider text-muted-foreground truncate">Semua</p>
                  </button>
                );
              })()}
              {statusLabels.filter(s => s.is_active).map((sl) => {
                const card = summary.find(c => c.status === sl.key);
                const count = (card?.unitCount ?? 0) + (card?.qtyCount ?? 0);
                const styles = getStatusStyles(sl);
                const isActive = !showAll && filterStatuses.size === 1 && filterStatuses.has(sl.key);
                return (
                  <button
                    key={sl.key}
                    onClick={() => { setShowAll(false); setFilterStatuses(new Set([sl.key])); }}
                    className={cn("min-w-[80px] sm:min-w-0 sm:flex-1 flex-shrink-0 rounded-xl border border-border bg-card px-3 py-3 sm:px-4 sm:py-3.5 text-left transition-all duration-150 hover:shadow-sm", isActive && "shadow-sm")}
                    style={isActive ? { backgroundColor: styles.bg } : undefined}
                  >
                    <p className="text-xl sm:text-2xl font-bold leading-none" style={isActive ? { color: styles.text } : undefined}>{count}</p>
                    <p className="text-[10px] mt-1.5 font-semibold uppercase tracking-wider truncate" style={{ color: styles.text }}>{sl.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        </div>)} {/* end summary cards */}

        {/* ── Sticky filter bar ── */}
        <div ref={filterBarRef} className="sticky top-16 z-20 bg-background -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-border">
        {activeTab === "unit" && (
        <div className="py-3 space-y-2.5">
          {/* Row 1: Search + mobile filter button + view toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama produk, IMEI, serial number, supplier…" className="pl-9 h-9 text-sm" />
              {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
            {/* Mobile: filter sheet trigger */}
            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs md:hidden relative shrink-0">
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">{activeFilterCount}</span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
                <SheetHeader><SheetTitle>Filter Stok</SheetTitle></SheetHeader>
                <div className="space-y-4 pt-4">
                  {isSuperAdmin && branches.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Cabang</label>
                      <SearchableDropdown
                        compact
                        showAllOption
                        allLabel="Semua Cabang"
                        options={branches}
                        value={filterBranch}
                        onChange={setFilterBranch}
                        placeholder="Semua Cabang"
                        searchPlaceholder="Cari cabang..."
                        align="left"
                        triggerClassName="w-full"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Kategori</label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" className="max-h-[200px]">
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).filter(([k]) => k !== "accessory").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mobile: Filter Seri */}
                  {filterCategory !== "all" && seriesOptions.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Seri Produk</label>
                      <div className="border border-border rounded-lg p-2 space-y-1 max-h-[160px] overflow-y-auto">
                        <button
                          className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors", filterSeries.size === 0 && "bg-accent/60")}
                          onClick={() => setFilterSeries(new Set())}
                        >
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", filterSeries.size === 0 ? "bg-primary border-primary" : "border-input")}>
                            {filterSeries.size === 0 && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </div>
                          <span className="font-medium text-sm">Semua Seri</span>
                        </button>
                        {seriesOptions.map(s => {
                          const selected = filterSeries.has(s);
                          return (
                            <button key={s} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm"
                              onClick={() => setFilterSeries(prev => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; })}
                            >
                              <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", selected ? "bg-primary border-primary" : "border-input")}>
                                {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </div>
                              <span className="truncate text-left">{s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mobile: Filter Tipe (warranty) */}
                  {!showAccessoryOnly && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Tipe Garansi</label>
                      {warrantyLocked ? (
                        <div className="h-10 flex items-center gap-2 border border-input rounded-lg bg-muted/40 px-3 text-sm text-muted-foreground">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Resmi (otomatis)</span>
                        </div>
                      ) : (
                        <Select value={filterWarranty} onValueChange={setFilterWarranty}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Semua Tipe" /></SelectTrigger>
                          <SelectContent position="popper" side="bottom" className="max-h-[200px]">
                            <SelectItem value="all">Semua Tipe</SelectItem>
                            {(Object.entries(WARRANTY_LABELS) as [WarrantyType, string][]).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {!showAccessoryOnly && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Kondisi</label>
                      <div className="flex gap-2">
                        {[{ v: "all", label: "Semua" }, { v: "no_minus", label: "No Minus" }, { v: "minus", label: "Minus" }].map(({ v, label }) => (
                          <button key={v} onClick={() => setFilterCondition(v)}
                            className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center", filterCondition === v ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border")}>{label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Supplier</label>
                    <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Semua Supplier" /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" className="max-h-[200px]">
                        <SelectItem value="all">Semua Supplier</SelectItem>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Tanggal Masuk</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full h-10 justify-start text-sm", dateRange?.from && "border-primary text-primary")}>
                          <CalendarIcon className="w-4 h-4 mr-2" />{dateRange?.from ? dateLabel() : "Pilih tanggal"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3 space-y-2">
                          <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} className={cn("p-0 pointer-events-auto")} locale={localeId} />
                          {dateRange?.from && <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateRange(undefined)}>Reset</Button>}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => { resetFilters(); setMobileFilterOpen(false); }}>Reset Semua</Button>
                    <Button className="flex-1" onClick={() => setMobileFilterOpen(false)}>Terapkan</Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs hidden md:flex" onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}>
              <ArrowUpDown className="w-3.5 h-3.5" />{sortOrder === "desc" ? "Terbaru" : "Terlama"}
            </Button>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 h-9">
              <button onClick={() => setViewMode("table")} className={cn("px-2.5 py-1 rounded-md transition-colors", viewMode === "table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><List className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode("compact")} className={cn("px-2.5 py-1 rounded-md transition-colors", viewMode === "compact" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><LayoutGrid className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {/* Row 2: Desktop filters — full width */}
          <div className="hidden md:flex flex-wrap gap-2 w-full">
            {isSuperAdmin && branches.length > 0 && (
              <SearchableDropdown
                compact
                showAllOption
                allLabel="Semua Cabang"
                options={branches}
                value={filterBranch}
                onChange={setFilterBranch}
                placeholder="Cabang"
                searchPlaceholder="Cari cabang..."
                align="right"
                triggerClassName="w-44"
              />
            )}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className={cn("h-9 flex-1 min-w-[130px] text-sm", filterCategory !== "all" && "border-primary text-primary")}><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).filter(([k]) => k !== "accessory").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Filter Seri — selalu tampil, disabled jika belum pilih kategori */}
            <Popover open={filterCategory !== "all" && seriesOptions.length > 0 ? seriesOpen : false} onOpenChange={filterCategory !== "all" && seriesOptions.length > 0 ? setSeriesOpen : undefined}>
              <PopoverTrigger asChild>
                <button
                  disabled={filterCategory === "all" || seriesOptions.length === 0}
                  className={cn(
                    "h-9 flex-1 min-w-[140px] flex items-center gap-1.5 border rounded-md bg-background px-3 text-sm transition-colors",
                    filterSeries.size > 0 ? "border-primary text-primary" : "border-input",
                    filterCategory === "all" ? "text-muted-foreground/50 cursor-not-allowed bg-muted/30" : "text-muted-foreground hover:border-input/80"
                  )}
                >
                  <span className="flex-1 truncate text-left text-sm">
                    {filterCategory === "all"
                      ? "Pilih kategori dahulu"
                      : seriesOptions.length === 0
                        ? "Memuat seri…"
                        : filterSeries.size === 0
                          ? "Semua Seri"
                          : filterSeries.size === 1
                            ? Array.from(filterSeries)[0]
                            : `${filterSeries.size} Seri dipilih`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-2" align="start">
                <div className="space-y-0.5 max-h-[240px] overflow-y-auto">
                  <button
                    className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-accent", filterSeries.size === 0 && "bg-accent/60")}
                    onClick={() => setFilterSeries(new Set())}
                  >
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center", filterSeries.size === 0 ? "bg-primary border-primary" : "border-input")}>
                      {filterSeries.size === 0 && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <span className="font-medium">Semua Seri</span>
                  </button>
                  {seriesOptions.map(s => {
                    const selected = filterSeries.has(s);
                    return (
                      <button key={s} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-accent"
                        onClick={() => setFilterSeries(prev => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; })}
                      >
                        <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", selected ? "bg-primary border-primary" : "border-input")}>
                          {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <span className="truncate text-left">{s}</span>
                      </button>
                    );
                  })}
                </div>
                {filterSeries.size > 0 && (
                  <div className="border-t border-border mt-2 pt-2">
                    <button className="w-full text-xs text-muted-foreground hover:text-foreground py-1" onClick={() => setFilterSeries(new Set())}>Reset seri</button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Filter Tipe (warranty) */}
            {warrantyLocked ? (
              <div className="h-9 flex-1 min-w-[110px] flex items-center gap-1.5 border border-input rounded-md bg-muted/40 px-3 text-sm text-muted-foreground cursor-not-allowed select-none">
                <Lock className="w-3 h-3 shrink-0" /><span>Resmi</span>
              </div>
            ) : (
              <Select value={filterWarranty} onValueChange={setFilterWarranty}>
                <SelectTrigger className={cn("h-9 flex-1 min-w-[120px] text-sm", filterWarranty !== "all" && "border-primary text-primary")}>
                  <SelectValue placeholder="Semua Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  {(Object.entries(WARRANTY_LABELS) as [WarrantyType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!showAccessoryOnly && (
              <Select value={filterCondition} onValueChange={setFilterCondition}>
                <SelectTrigger className={cn("h-9 flex-1 min-w-[120px] text-sm", filterCondition !== "all" && "border-primary text-primary")}><SelectValue placeholder="Kondisi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kondisi</SelectItem>
                  <SelectItem value="no_minus">No Minus</SelectItem>
                  <SelectItem value="minus">Minus</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className={cn("h-9 w-[150px] text-sm", filterSupplier !== "all" && "border-primary text-primary")}><SelectValue placeholder="Supplier" /></SelectTrigger>
              <SelectContent className="max-h-[240px]">
                <SelectItem value="all">Semua Supplier</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 text-xs shrink-0", dateRange?.from && "border-primary text-primary")}>
                  <CalendarIcon className="w-3.5 h-3.5" />{dateLabel()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Pilih tanggal atau rentang tanggal</p>
                  <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} className={cn("p-0 pointer-events-auto")} locale={localeId} />
                  {dateRange?.from && <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateRange(undefined)}>Reset Tanggal</Button>}
                </div>
              </PopoverContent>
            </Popover>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-muted-foreground shrink-0" onClick={resetFilters}>
                <X className="w-3 h-3" /> Reset
              </Button>
            )}
          </div>

          {/* Mobile: sort + active filter pills */}
          <div className="flex md:hidden items-center gap-2 overflow-x-auto scrollbar-hide">
            <Button variant="outline" size="sm" className="shrink-0 h-7 gap-1 text-[11px] rounded-full px-2.5"
              onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}>
              <ArrowUpDown className="w-3 h-3" />{sortOrder === "desc" ? "Terbaru" : "Terlama"}
            </Button>
            {filterCategory !== "all" && (
              <Badge variant="soft-default" size="sm" className="shrink-0 cursor-pointer rounded-full"
                onClick={() => setFilterCategory("all")}>
                {CATEGORY_LABELS[filterCategory as ProductCategory]}
                <X className="w-2.5 h-2.5 ml-0.5 opacity-60" />
              </Badge>
            )}
            {filterSupplier !== "all" && (
              <Badge variant="soft-default" size="sm" className="shrink-0 cursor-pointer rounded-full"
                onClick={() => setFilterSupplier("all")}>
                {suppliers.find(s => s.id === filterSupplier)?.name ?? "Supplier"}
                <X className="w-2.5 h-2.5 ml-0.5 opacity-60" />
              </Badge>
            )}
          </div>
        </div>
        )} {/* end unit tab filter */}
        </div>{/* end sticky filter bar */}

        {/* ── Aksesoris Tab Content ── */}
        {activeTab === "accessory" && (() => {
          const filteredAcc = accSearch.trim()
            ? accItems.filter(i => i.name.toLowerCase().includes(accSearch.toLowerCase()))
            : accItems;
          const totalSku = accItems.length;
          const tersedia = accItems.filter(i => i.qty_remaining > 5).length;
          const sisaSedikit = accItems.filter(i => i.qty_remaining > 0 && i.qty_remaining <= 5).length;
          const habis = accItems.filter(i => i.qty_remaining === 0).length;
          const accTotalPages = Math.ceil(filteredAcc.length / accPageSize);
          const pagedAcc = filteredAcc.slice((accPage - 1) * accPageSize, accPage * accPageSize);
          return (
            <div className="mt-5 space-y-4">

              {/* ── Summary Cards ── */}
              {!accLoading && accItems.length > 0 && (
                <div className="flex gap-2 sm:gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                  {[
                    { label: "Total SKU", count: totalSku, color: "text-foreground" },
                    { label: "Tersedia", count: tersedia, color: "text-emerald-600" },
                    { label: "Sisa Sedikit", count: sisaSedikit, color: "text-amber-600" },
                    { label: "Habis", count: habis, color: "text-red-600" },
                  ].map(card => (
                    <div key={card.label} className="min-w-[80px] sm:flex-1 shrink-0 rounded-xl border border-border bg-card px-3 py-3 sm:px-4 sm:py-3.5">
                      <p className={cn("text-xl sm:text-2xl font-bold leading-none", card.color)}>{card.count}</p>
                      <p className="text-[10px] mt-1.5 font-semibold uppercase tracking-wider text-muted-foreground truncate">{card.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Search + Tambah Stok ── */}
              <div className="bg-card rounded-xl border border-border p-3 sm:p-4 shadow-sm">
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={accSearch}
                      onChange={e => setAccSearch(e.target.value)}
                      placeholder="Cari nama aksesoris…"
                      className="pl-9 h-9 text-sm"
                    />
                    {accSearch && (
                      <button onClick={() => setAccSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {isSuperAdmin && (
                    <Button size="sm" className="h-9 gap-1.5 text-xs shrink-0" onClick={() => { setAddStockTarget(null); setAddStockOpen(true); }}>
                      <Plus className="w-3.5 h-3.5" /> Tambah Stok
                    </Button>
                  )}
                </div>
                {!accLoading && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {accSearch.trim() ? `${filteredAcc.length} dari ${totalSku} SKU cocok` : `${totalSku} SKU aksesoris terdaftar`}
                  </p>
                )}
              </div>

              {/* ── Table ── */}
              {accLoading ? (
                <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : filteredAcc.length === 0 ? (
                <div className="bg-card rounded-xl border border-border">
                  <EmptyState
                    icon={accSearch.trim() ? Search : Package2}
                    title={accSearch.trim() ? "Tidak Ditemukan" : "Belum Ada Stok Aksesoris"}
                    description={accSearch.trim() ? `Tidak ada aksesoris yang cocok dengan "${accSearch}".` : "Stok aksesoris akan muncul di sini setelah ada pencatatan masuk pertama."}
                    action={accSearch.trim() ? <Button variant="outline" size="sm" onClick={() => setAccSearch("")}>Reset Pencarian</Button> : undefined}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-3 sm:px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-foreground/60">Produk</th>
                        <th className="px-3 sm:px-4 py-3 text-center font-bold text-[11px] uppercase tracking-wider text-foreground/60 w-20">Stok</th>
                        <th className="px-3 sm:px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-foreground/60 hidden md:table-cell">Masuk Terkini</th>
                        <th className="px-3 sm:px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-foreground/60 hidden sm:table-cell">Harga</th>
                        <th className="px-3 sm:px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-foreground/60">Status</th>
                        <th className="px-3 sm:px-4 py-3 text-right font-bold text-[11px] uppercase tracking-wider text-foreground/60 hidden sm:table-cell">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedAcc.map((item) => {
                        const qty = item.qty_remaining;
                        const statusLabel = qty === 0 ? "Habis" : qty <= 5 ? "Sisa Sedikit" : "Tersedia";
                        const statusCls = qty === 0
                          ? "bg-red-100 text-red-700 border-red-200"
                          : qty <= 5 ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200";
                        const qtyCls = qty === 0 ? "text-red-600" : qty <= 5 ? "text-amber-600" : "text-emerald-600";

                        // Price label
                        let priceLabel: React.ReactNode = <span className="text-muted-foreground">—</span>;
                        if (item.price_min != null && item.price_max != null) {
                          if (item.price_min === item.price_max) {
                            priceLabel = <span className="font-semibold text-foreground">{formatCurrency(item.price_min)}</span>;
                          } else {
                            priceLabel = (
                              <span>
                                <span className="text-[10px] text-muted-foreground">Mulai dari </span>
                                <span className="font-semibold text-foreground">{formatCurrency(item.price_min)}</span>
                              </span>
                            );
                          }
                        }

                        return (
                          <tr
                            key={item.master_product_id}
                            className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => navigate(`/admin/stok-produk/aksesoris/${item.master_product_id}`)}
                          >
                            {/* Produk */}
                            <td className="px-3 sm:px-4 py-3.5">
                              <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{item.name}</p>
                            </td>

                            {/* Stok */}
                            <td className="px-3 sm:px-4 py-3.5 text-center">
                              <span className={cn("text-xl font-bold leading-none", qtyCls)}>{qty}</span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">unit</p>
                            </td>

                            {/* Masuk Terkini */}
                            <td className="px-3 sm:px-4 py-3.5 hidden md:table-cell">
                              {item.latest_in_date
                                ? <p className="text-sm text-foreground">{format(new Date(item.latest_in_date), "d MMM yyyy", { locale: localeId })}</p>
                                : <span className="text-muted-foreground text-sm">—</span>}
                            </td>

                            {/* Harga */}
                            <td className="px-3 sm:px-4 py-3.5 hidden sm:table-cell">
                              <p className="text-sm">{priceLabel}</p>
                            </td>

                            {/* Status */}
                            <td className="px-3 sm:px-4 py-3.5">
                              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap", statusCls)}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                {statusLabel}
                              </span>
                              {/* Mobile: show price below status */}
                              <p className="sm:hidden text-xs mt-1">{priceLabel}</p>
                            </td>

                            {/* Aksi */}
                            <td className="px-3 sm:px-4 py-3.5 text-right hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                              {isSuperAdmin && (
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs gap-1"
                                  onClick={() => { setAddStockTarget({ id: item.master_product_id, name: item.name }); setAddStockOpen(true); }}
                                >
                                  <TrendingUp className="w-3 h-3" /> Tambah Stok
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Unit Tab Content ── */}
        <div className={activeTab !== "unit" ? "hidden" : "mt-5"}>
        {/* ── Content ── */}
        {error ? (
          <div className="bg-card rounded-xl border border-border">
            <EmptyState
              icon={AlertCircle}
              title="Gagal Memuat Data"
              description="Terjadi gangguan saat mengambil data stok. Ini bukan salahmu — coba muat ulang halaman ini."
              action={
                <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
                </Button>
              }
            />
          </div>
        ) : loading ? (
          <div className="bg-card rounded-xl border border-border">
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </div>
        ) : units.length === 0 ? (
          (() => {
            const term = debouncedSearch.trim();
            const isImei = /^\d{14,16}$/.test(term);
            const isSerial = term.length >= 8 && /^[A-Za-z0-9]+$/.test(term) && !isImei;
            const hasSearch = !!term;
            const hasOnlyFilter = !hasSearch && hasActiveFilters;

            if (hasSearch) {
              return (
                <div className="bg-card rounded-xl border border-border">
                  <EmptyState
                    icon={Search}
                    title="Produk Tidak Ditemukan"
                    description={
                      isImei
                        ? `IMEI ${term} belum terdaftar di stok manapun. Mungkin belum ditambahkan, atau ada typo?`
                        : isSerial
                        ? `Serial number "${term}" tidak ditemukan. Mungkin belum ditambahkan, atau ada typo?`
                        : `Tidak ada produk yang cocok dengan pencarian "${term}". Coba kata kunci lain atau cek ejaannya.`
                    }
                    action={
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        {(isImei || isSerial) && (
                          <Button size="sm" className="gap-1.5" onClick={() => navigate("/admin/stok-produk/tambah")}>
                            <Plus className="w-3.5 h-3.5" />
                            {isImei ? "Tambah Produk dengan IMEI Ini" : "Tambah Produk dengan Serial Ini"}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { setSearch(""); searchInputRef.current?.focus(); }}>
                          {isImei || isSerial ? "atau Reset Pencarian" : "Reset Pencarian"}
                        </Button>
                      </div>
                    }
                  />
                </div>
              );
            }

            if (hasOnlyFilter) {
              return (
                <div className="bg-card rounded-xl border border-border">
                  <EmptyState
                    icon={Filter}
                    title="Tidak Ada yang Cocok"
                    description="Tidak ada produk yang sesuai dengan filter aktif. Coba ubah atau hapus beberapa filter."
                    action={
                      <Button variant="outline" size="sm" onClick={() => {
                        setFilterCategory("all"); setFilterSeries(new Set()); setFilterCondition("all");
                        setFilterBranch("all"); setFilterSupplier("all"); setFilterStatuses(new Set());
                        setDateRange(undefined); setFilterWarranty("all"); setShowAll(false);
                      }}>
                        Hapus Semua Filter
                      </Button>
                    }
                  />
                </div>
              );
            }

            return (
              <div className="bg-card rounded-xl border border-border">
                <EmptyState
                  icon={Package}
                  title="Belum Ada Produk di Sini"
                  description="Mulai tambahkan produk pertama kamu. Setiap unit yang masuk bisa langsung dipantau dari sini."
                  action={
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <Button size="sm" className="gap-1.5" onClick={() => navigate("/admin/stok-produk/tambah")}>
                        <Plus className="w-3.5 h-3.5" /> Tambah Produk Pertama
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                        atau Import dari CSV
                      </Button>
                    </div>
                  }
                />
              </div>
            );
          })()
        ) : viewMode === "table" ? (
          <AdminDataTable
            filterBarHeight={filterBarHeight}
            infoBar={
              (isSuperAdmin || isAdminBranch) && selectedIds.size > 0 ? (
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs font-medium text-destructive">{selectedIds.size} unit dipilih</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setSelectedIds(new Set()); setConfirmBulkDelete(false); }}>Batal</Button>
                    {!confirmBulkDelete ? (
                      <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setConfirmBulkDelete(true)}>
                        <Trash2 className="w-3 h-3" /> Hapus
                      </Button>
                    ) : (
                      <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5" disabled={bulkDeleting} onClick={handleBulkDelete}>
                        {bulkDeleting ? <div className="w-3 h-3 border border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" /> : "Konfirmasi Hapus"}
                      </Button>
                    )}
                  </div>
                </div>
              ) : isDefaultFilter ? (
                <>
                  <span>Menampilkan</span>
                  <span className="font-semibold text-foreground">produk aktif</span>
                  <span>· tampilan default</span>
                </>
              ) : showAll ? (
                <>
                  <span>Menampilkan</span>
                  <span className="font-semibold text-foreground">semua status</span>
                  <span>·</span>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs font-medium" onClick={() => { setShowAll(false); setFilterStatuses(new Set(["available"])); }}>
                    tampilkan default
                  </Button>
                </>
              ) : (
                <>
                  <span>Menampilkan</span>
                  <span className="font-semibold text-foreground">
                    {Array.from(filterStatuses).map(s => getStatusLabel(s, statusLabels)).join(", ")}
                  </span>
                  <span>·</span>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs font-medium" onClick={() => { setFilterStatuses(new Set(["available"])); setShowAll(false); }}>
                    tampilkan default
                  </Button>
                </>
              )
            }
            headerRow={<>
              {(isSuperAdmin || isAdminBranch) && !showAccessoryOnly && (
                <TableHead className="w-10 px-2 sm:px-3 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">
                  <Checkbox
                    checked={unitTrackedIds.length > 0 && selectedIds.size === unitTrackedIds.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="px-2 sm:px-4 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Produk</TableHead>
              <TableHead className="px-2 sm:px-4 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 hidden md:table-cell">Masuk</TableHead>
              {showIdentifierCol && <TableHead className="px-2 sm:px-4 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 hidden sm:table-cell">{identifierLabel}</TableHead>}
              {!showAccessoryOnly && <TableHead className="px-2 sm:px-4 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 hidden sm:table-cell">Kondisi</TableHead>}
              <TableHead className="px-2 sm:px-4 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Harga</TableHead>
              <TableHead className="px-2 sm:px-4 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Status</TableHead>
              <TableHead className="px-2 sm:px-4 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 hidden md:table-cell">Supplier</TableHead>
              {isSuperAdmin && filterBranch === "all" && <TableHead className="px-2 sm:px-4 bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 hidden lg:table-cell">Cabang</TableHead>}
            </>}
          >
            {units.map((unit) => {
              const unitWithBranch = unit as StockUnitWithBranch;
              const category = unit.master_products?.category ?? "iphone";
              const isAccessory = category === "accessory";
              const unitIsTracked = isUnitTracked(unit);
              const validTransitions = getValidTransitions(unit.stock_status);
              const canChangeStatus = (isSuperAdmin || isAdminBranch || (isEmployee && validTransitions.length > 0)) && validTransitions.length > 0 && !isAccessory;
              const identifier = getUnitIdentifier(unit);
              const identLabelForUnit = IMEI_STOCK_CATEGORIES.includes(category) ? "IMEI" : "Serial Number";
              const prod = unit.master_products;
              const prodName = prod ? [prod.series, prod.storage_gb ? prod.storage_gb + "GB" : null, prod.color].filter(Boolean).join(" ") : "—";

              return (
                <TableRow
                  key={unit.id}
                  className={cn("hover:bg-accent/40 cursor-pointer transition-colors", selectedIds.has(unit.id) && "bg-accent/20")}
                  onDoubleClick={() => setSelectedUnit(unit)}
                >
                  {(isSuperAdmin || isAdminBranch) && !showAccessoryOnly && (
                    <TableCell className="w-10 px-2 sm:px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      {unitIsTracked && <Checkbox checked={selectedIds.has(unit.id)} onCheckedChange={() => toggleSelect(unit.id)} />}
                    </TableCell>
                  )}
                  {/* Product name column */}
                  <TableCell className="px-2 sm:px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm leading-tight truncate max-w-[200px] sm:max-w-none">
                        {prodName}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {category !== "iphone" && (
                          <Badge variant="soft-neutral" size="sm">
                            {CATEGORY_LABELS[category] ?? category}
                          </Badge>
                        )}
                        {prod?.warranty_type && !isAccessory && (
                          <Badge variant="outline" size="sm">
                            {getWarrantyLabel(prod.warranty_type)}
                          </Badge>
                        )}
                        {isAccessory && unit.qty_available !== null && (
                          <StockBadgeQty qty={unit.qty_available} />
                        )}
                        {/* Durasi inline (unit-tracked only) */}
                        {!isAccessory && (() => {
                          const dur = getUnitDuration(unit);
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold cursor-default border border-border/40 bg-muted/30", dur.color)}>
                                  <Clock className="w-2.5 h-2.5" />{dur.label}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] text-xs">{dur.tooltip}</TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </div>
                      {/* Show identifier inline on small screens */}
                      {!isAccessory && identifier && (
                        <div className="sm:hidden inline-flex items-center gap-1.5 mt-2 rounded-md border border-border bg-muted/60 px-2 py-1 cursor-pointer group"
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(identifier); toast({ title: `${identLabelForUnit} disalin`, description: identifier }); }}
                        >
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">{identLabelForUnit}</span>
                          <span className="font-mono text-xs font-bold text-foreground group-hover:text-primary transition-colors select-all tracking-wide">{identifier}</span>
                        </div>
                      )}
                      {!isAccessory && !identifier && (
                        <p className="sm:hidden text-[11px] text-muted-foreground mt-1.5 italic font-medium">Tanpa {identLabelForUnit}</p>
                      )}
                      {!isAccessory && <div className="sm:hidden mt-1.5"><ConditionBadge condition={unit.condition_status ?? "no_minus"} /></div>}
                    </div>
                  </TableCell>
                  {/* Tgl Masuk */}
                  <TableCell className="px-2 sm:px-4 py-3.5 text-xs font-semibold text-foreground whitespace-nowrap hidden md:table-cell">{formatDate(unit.received_at)}</TableCell>
                  {/* Identifier column (desktop) */}
                  {showIdentifierCol && (
                    <TableCell className="px-2 sm:px-4 py-3.5 hidden sm:table-cell">
                      {isAccessory ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : identifier ? (
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 cursor-pointer group hover:border-primary/40 transition-colors"
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(identifier); toast({ title: `${identLabelForUnit} disalin`, description: identifier }); }}
                        >
                          <span className="font-mono text-xs font-bold text-foreground group-hover:text-primary transition-colors select-all tracking-wide">{identifier}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Tanpa {identLabelForUnit}</p>
                      )}
                    </TableCell>
                  )}
                  {/* Kondisi column (unit-tracked only) */}
                  {!showAccessoryOnly && (
                    <TableCell className="px-2 sm:px-4 py-3 hidden sm:table-cell">
                      {isAccessory ? <span className="text-xs text-muted-foreground">—</span> : <ConditionBadge condition={unit.condition_status ?? "no_minus"} />}
                    </TableCell>
                  )}
                  {/* Harga */}
                  <TableCell className="px-2 sm:px-4 py-3.5">
                    <span className="font-semibold text-foreground text-sm">
                      {isAccessory ? (unit.selling_price ? `${formatCurrency(unit.selling_price)}/pcs` : "—") : formatCurrency(unit.selling_price)}
                    </span>
                  </TableCell>
                  {/* Status */}
                  <TableCell className="px-2 sm:px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {canChangeStatus ? (
                      <div className="space-y-1">
                        <Select value={unit.stock_status} onValueChange={(val) => handleInlineStatusChange(unit.id, unit.stock_status, val)}>
                          <SelectTrigger className="h-7 w-[110px] sm:w-[130px] text-[10px] sm:text-xs border-dashed p-1 sm:p-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={unit.stock_status}>{getStatusLabel(unit.stock_status, statusLabels)}</SelectItem>
                            {validTransitions.map(s => <SelectItem key={s} value={s}>{getStatusLabel(s, statusLabels)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {unit.stock_status === "sold" && canEditSoldChannel && !unit.sold_channel ? (
                          /* Hanya ecommerce yang bisa di-set manual; POS & website hanya otomatis by system */
                          <Select value="none" onValueChange={(val) => {
                            if (val === "ecommerce_tokopedia" || val === "ecommerce_shopee") {
                              setQuickSaleUnit(unit);
                              setQuickSaleOpen(true);
                            }
                          }}>
                            <SelectTrigger className={cn("h-6 w-[130px] sm:w-[150px] text-[9px] sm:text-[10px] border-dashed p-1 text-destructive border-destructive/30")}>
                              <SelectValue placeholder="Belum ditentukan" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" disabled>Belum ditentukan</SelectItem>
                              <SelectItem value="ecommerce_tokopedia">Online (Tokopedia)</SelectItem>
                              <SelectItem value="ecommerce_shopee">Online (Shopee)</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : unit.stock_status === "sold" && unit.sold_channel ? (
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground">{SOLD_CHANNEL_SHORT[unit.sold_channel as SoldChannel]}</p>
                        ) : unit.stock_status === "sold" && !unit.sold_channel ? (
                          <p className="text-[9px] sm:text-[10px] text-destructive">Belum ditentukan</p>
                        ) : null}
                        {unit.stock_status === "sold" && (() => {
                          const claims = warrantyClaimsMap[unit.id];
                          if (!claims || claims.length === 0) return <span className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50"><ShieldOff className="w-3.5 h-3.5 shrink-0" /> Belum Klaim Garansi</span>;
                          const total = claims.length;
                          const latest = claims.reduce((a, b) => { const o: Record<string, number> = { in_progress: 2, pending: 1, completed: 0 }; return (o[a.claim_status] ?? 0) >= (o[b.claim_status] ?? 0) ? a : b; });
                          const statusLabel = latest.claim_status === "pending" ? "Menunggu Diproses" : latest.claim_status === "in_progress" ? "Sedang Diperbaiki" : "Selesai";
                          const bgColor = latest.claim_status === "completed" ? "bg-primary/10 text-primary border-primary/20" : latest.claim_status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-orange-50 text-orange-700 border-orange-200";
                          return <span className={cn("inline-flex items-center gap-1 sm:gap-1.5 mt-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium border", bgColor)}><ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /><span>{total}x Klaim · {statusLabel}</span></span>;
                        })()}
                      </div>
                    ) : (
                      <div>
                        <StockStatusBadge status={unit.stock_status} statusLabels={statusLabels} />
                        {unit.stock_status === "sold" && unit.sold_channel && <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{SOLD_CHANNEL_SHORT[unit.sold_channel as SoldChannel]}</p>}
                      </div>
                    )}
                  </TableCell>
                  {/* Supplier */}
                  <TableCell className="px-2 sm:px-4 py-3.5 text-xs font-medium text-foreground/70 whitespace-nowrap hidden md:table-cell truncate max-w-[130px]">{unit.supplier ?? "—"}</TableCell>
                  {/* Cabang — sembunyikan saat filter cabang aktif */}
                  {isSuperAdmin && filterBranch === "all" && (
                    <TableCell className="px-2 sm:px-4 py-3 text-xs font-semibold text-foreground hidden lg:table-cell">{unitWithBranch.branches?.name ?? "—"}</TableCell>
                  )}
                </TableRow>
              );
            })}
          </AdminDataTable>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Tampilan ringkas untuk pengecekan cepat di etalase.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {units.map((unit) => {
                const category = unit.master_products?.category ?? "iphone";
                const isAccessory = category === "accessory";
                const prod = unit.master_products;
                const prodName = prod ? [prod.series, prod.storage_gb ? prod.storage_gb + "GB" : null, prod.color].filter(Boolean).join(" ") : "—";
                return (
                  <button key={unit.id} onClick={() => setSelectedUnit(unit)}
                    className="bg-card rounded-xl border border-border p-3 sm:p-4 text-left hover:shadow-md hover:border-border/70 transition-all duration-150 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{prodName}</p>
                        <Badge variant="soft-neutral" size="sm" className="mt-0.5">
                          {CATEGORY_LABELS[category] ?? category}
                        </Badge>
                      </div>
                      <StockStatusBadge status={unit.stock_status} statusLabels={statusLabels} className="shrink-0" />
                    </div>
                    {isAccessory ? (
                      <div className="flex items-center justify-between">
                        <StockBadgeQty qty={unit.qty_available} />
                        <p className="text-sm font-bold text-foreground">{unit.selling_price ? `${formatCurrency(unit.selling_price)}/pcs` : "—"}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <ConditionBadge condition={unit.condition_status ?? "no_minus"} />
                        <p className="text-sm font-bold text-foreground">{formatCurrency(unit.selling_price)}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 truncate">
                      {isAccessory ? `Supplier: ${unit.supplier ?? "—"}` : `${getWarrantyLabel(prod?.warranty_type)} · `}
                      Masuk {formatDate(unit.received_at)}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div> {/* end unit tab content */}
      </div>

      {/* ── Fixed Pagination Bar — Stok Unit ── */}
      {activeTab === "unit" && !loading && totalCount > 0 && (
        <div className="fixed bottom-0 left-0 md:left-[72px] right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
          <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">{totalCount} item</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">Tampilkan</span>
              <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground hidden sm:inline">per halaman</span>
            </div>
            <span className="text-xs text-muted-foreground sm:hidden">{page}/{totalPages}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <div className="hidden sm:flex items-center gap-1">
                {paginationRange.map((item, idx) =>
                  item === "..." ? <span key={`dots-${idx}`} className="w-8 text-center text-xs text-muted-foreground">…</span>
                  : <Button key={item} variant={page === item ? "default" : "outline"} size="sm"
                      className={cn("h-8 w-8 p-0 text-xs", page === item && "pointer-events-none")}
                      onClick={() => setPage(item as number)}>{item}</Button>
                )}
              </div>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed Pagination Bar — Aksesoris ── */}
      {activeTab === "accessory" && !accLoading && accItems.length > accPageSize && (() => {
        const filteredAcc = accSearch.trim() ? accItems.filter(i => i.name.toLowerCase().includes(accSearch.toLowerCase())) : accItems;
        const accTotalPages = Math.ceil(filteredAcc.length / accPageSize);
        const accPageRange: (number | "...")[] = [];
        const delta = 1;
        for (let i = 1; i <= accTotalPages; i++) {
          if (i === 1 || i === accTotalPages || (i >= accPage - delta && i <= accPage + delta)) accPageRange.push(i);
          else if (accPageRange[accPageRange.length - 1] !== "...") accPageRange.push("...");
        }
        return (
          <div className="fixed bottom-0 left-0 md:left-[72px] right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
            <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{filteredAcc.length} SKU</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">Tampilkan</span>
                <Select value={accPageSize.toString()} onValueChange={(v) => { setAccPageSize(Number(v)); setAccPage(1); }}>
                  <SelectTrigger className="h-8 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground hidden sm:inline">per halaman</span>
              </div>
              <span className="text-xs text-muted-foreground sm:hidden">{accPage}/{accTotalPages}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={accPage <= 1} onClick={() => setAccPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <div className="hidden sm:flex items-center gap-1">
                  {accPageRange.map((item, idx) =>
                    item === "..." ? <span key={`dots-${idx}`} className="w-8 text-center text-xs text-muted-foreground">…</span>
                    : <Button key={item} variant={accPage === item ? "default" : "outline"} size="sm"
                        className={cn("h-8 w-8 p-0 text-xs", accPage === item && "pointer-events-none")}
                        onClick={() => setAccPage(item as number)}>{item}</Button>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={accPage >= accTotalPages} onClick={() => setAccPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modals */}
      <UnitDetailDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} onUpdate={handleRefresh} />
      <StatusLabelManager open={statusManagerOpen} onClose={() => setStatusManagerOpen(false)} statusLabels={statusLabels} onRefresh={() => { refetchLabels(); fetchSummary(); }} />
      <ImportStockModal open={importOpen} onOpenChange={setImportOpen} onSuccess={() => { handleRefresh(); refetchLabels(); }} />

      {/* Sold channel picker modal */}
      {inlineStatusUnit && inlineNewStatus === "sold" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setInlineStatusUnit(null); setInlineNewStatus(""); setInlineSoldChannel(""); }} />
          <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Pilih Channel Penjualan</h3>
            <p className="text-xs text-muted-foreground">Unit akan ditandai sebagai terjual. Pilih channel penjualan.</p>
            <Select value={inlineSoldChannel} onValueChange={(v) => setInlineSoldChannel(v as SoldChannel)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pilih channel..." /></SelectTrigger>
              <SelectContent>
                {getSoldChannelOptions().map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setInlineStatusUnit(null); setInlineNewStatus(""); setInlineSoldChannel(""); }}>Batal</Button>
              <Button className="flex-1" disabled={!inlineSoldChannel || inlineUpdating} onClick={handleSoldChannelConfirm}>
                {inlineUpdating ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Konfirmasi"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export empty dialog */}
      {exportEmptyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setExportEmptyOpen(false)} />
          <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-foreground">Tidak ada data untuk diekspor</p>
            <p className="text-xs text-muted-foreground">Ubah filter terlebih dahulu atau pastikan ada stok produk.</p>
            <Button variant="outline" className="w-full" onClick={() => setExportEmptyOpen(false)}>Tutup</Button>
          </div>
        </div>
      )}
      {/* ── Modal: Tambah Stok Aksesoris ── */}
      {addStockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setAddStockOpen(false)} />
          <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-foreground">Tambah Stok Aksesoris</h3>
              {addStockTarget && (
                <p className="text-xs text-muted-foreground">{addStockTarget.name}</p>
              )}
            </div>

            {/* Pilih produk jika belum ada target */}
            {!addStockTarget && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Pilih Produk</label>
                <Select
                  value=""
                  onValueChange={(v) => {
                    const item = accItems.find(i => i.master_product_id === v);
                    if (item) setAddStockTarget({ id: item.master_product_id, name: item.name });
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Pilih aksesoris..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {accItems.map(i => (
                      <SelectItem key={i.master_product_id} value={i.master_product_id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Jumlah Unit Masuk</label>
                <Input
                  type="number" min="1" placeholder="Contoh: 10"
                  value={addStockQty} onChange={e => setAddStockQty(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Harga Beli/Unit (opsional)</label>
                <Input
                  type="number" min="0" placeholder="Rp 0"
                  value={addStockPrice} onChange={e => setAddStockPrice(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {addStockQty && addStockPrice && Number(addStockQty) > 0 && Number(addStockPrice) > 0 && (
              <p className="text-xs text-emerald-700 font-medium -mt-1">
                Total nilai masuk: {formatCurrency(Number(addStockQty) * Number(addStockPrice))}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tanggal Masuk</label>
              <Input
                type="date" value={addStockDate} onChange={e => setAddStockDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Catatan (opsional)</label>
              <Input
                placeholder="Contoh: Restok dari supplier ABC"
                value={addStockNotes} onChange={e => setAddStockNotes(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setAddStockOpen(false); setAddStockTarget(null); setAddStockQty(""); setAddStockPrice(""); setAddStockNotes(""); }}>
                Batal
              </Button>
              <Button
                className="flex-1"
                disabled={!addStockTarget || !addStockQty || Number(addStockQty) <= 0 || addStockSubmitting}
                onClick={handleAddStock}
              >
                {addStockSubmitting ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <QuickEcommerceSaleModal
        unit={quickSaleUnit}
        open={quickSaleOpen}
        onClose={() => { setQuickSaleOpen(false); setQuickSaleUnit(null); }}
        onSuccess={handleRefresh}
      />
    </DashboardLayout>
  );
}
