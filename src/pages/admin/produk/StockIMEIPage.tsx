import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useBarcodeScanner } from "@/hooks/admin/use-barcode-scanner";
import { Plus, Search, LayoutGrid, List, X, RefreshCw, Download, AlertCircle, Trash2, CalendarIcon, ArrowUpDown, ChevronLeft, ChevronRight, Settings2, Filter, Clock, ShieldCheck, ShieldOff, Upload } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StockStatusBadge, ConditionBadge } from "@/components/admin/produk/StockBadges";
import { AddUnitModal } from "@/components/admin/produk/AddUnitModal";
import { UnitDetailDrawer } from "@/components/admin/produk/UnitDetailDrawer";
import { StatusLabelManager } from "@/components/admin/produk/StatusLabelManager";
import { ImportStockModal } from "@/components/admin/produk/ImportStockModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/shared/use-toast";
import { useStatusLabels } from "@/hooks/admin/use-status-labels";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { cn } from "@/lib/utils";
import {
  StockUnit,
  SoldChannel,
  SOLD_CHANNEL_SHORT,
  formatCurrency,
  formatDate,
  getStatusStyles,
  getStatusLabel,
  type StatusLabel,
} from "@/lib/admin/produk/stock-units";
import { WARRANTY_LABELS, CATEGORY_LABELS, type WarrantyType, type ProductCategory } from "@/lib/admin/produk/master-products";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface SummaryCount { status: string; count: number; }
interface Branch { id: string; name: string; }

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
    // Cycle time requires: sold_at set AND sold_channel set
    if (!unit.sold_at) {
      return {
        label: "Tanggal belum diset",
        tooltip: "Cycle Time belum tersedia — atur tanggal terjual terlebih dahulu",
        color: "text-muted-foreground",
      };
    }
    if (!unit.sold_channel) {
      return {
        label: "Kanal belum diset",
        tooltip: "Cycle Time belum tersedia — atur kanal penjualan terlebih dahulu",
        color: "text-muted-foreground",
      };
    }
    const sold = new Date(unit.sold_at);
    const days = differenceInDays(sold, received);
    const hours = differenceInHours(sold, received) % 24;
    return {
      label: formatDuration(days, hours),
      tooltip: `Cycle Time: Waktu yang dibutuhkan dari barang masuk hingga terjual`,
      color: days <= 7 ? "text-primary" : days <= 30 ? "text-foreground" : "text-destructive",
    };
  }

  if (unit.stock_status === "service") {
    const statusChanged = new Date(unit.status_changed_at);
    const days = differenceInDays(now, statusChanged);
    const hours = differenceInHours(now, statusChanged) % 24;
    return {
      label: formatDuration(days, hours),
      tooltip: `Durasi Service: Sudah menunggu perbaikan`,
      color: days > 14 ? "text-destructive" : days > 7 ? "text-amber-600" : "text-foreground",
    };
  }

  if (unit.stock_status === "reserved") {
    const statusChanged = new Date(unit.status_changed_at);
    const days = differenceInDays(now, statusChanged);
    const hours = differenceInHours(now, statusChanged) % 24;
    return {
      label: formatDuration(days, hours),
      tooltip: `Durasi Dipesan: Sudah dalam status dipesan`,
      color: days > 3 ? "text-destructive" : "text-foreground",
    };
  }

  const days = differenceInDays(now, received);
  const hours = differenceInHours(now, received) % 24;
  return {
    label: formatDuration(days, hours),
    tooltip: `Lama di Etalase: Sudah berada di stok sejak barang masuk`,
    color: days > 60 ? "text-destructive" : days > 30 ? "text-amber-600" : "text-foreground",
  };
}

type StockUnitWithBranch = StockUnit & { branches?: { name: string } | null };

export default function StockIMEIPage() {
  const { role, activeBranch, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { statusLabels, refetch: refetchLabels } = useStatusLabels();
  const isSuperAdmin = role === "super_admin";
  const isAdminBranch = role === "admin_branch";
  const isEmployee = role === "employee";
  const canEditStatus = isSuperAdmin || isAdminBranch;

  const [units, setUnits] = useState<StockUnitWithBranch[]>([]);
  const [summary, setSummary] = useState<SummaryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "compact">("table");

  // Warranty claims lookup for sold items
  const [warrantyClaimsMap, setWarrantyClaimsMap] = useState<Record<string, { claim_type: string; claim_status: string }[]>>({});

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Branch filter (super admin only)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranch, setFilterBranch] = useState("all");

  // Filters
  const searchInputRef = useRef<HTMLInputElement>(null);
  useBarcodeScanner(searchInputRef, { enabled: true });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set(["available"]));
  const [showAll, setShowAll] = useState(false);
  const [filterSeries, setFilterSeries] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [filterColor, setFilterColor] = useState("all");
  const [filterWarranty, setFilterWarranty] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [allSeries, setAllSeries] = useState<string[]>([]);
  const [allColors, setAllColors] = useState<string[]>([]);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [seriesDropdownOpen, setSeriesDropdownOpen] = useState(false);
  const seriesRef = useRef<HTMLDivElement>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const isMobile = useIsMobile();

  // Date filter
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<StockUnit | null>(null);
  const [exportEmptyOpen, setExportEmptyOpen] = useState(false);
  const [statusManagerOpen, setStatusManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Inline status change
  const [inlineStatusUnit, setInlineStatusUnit] = useState<string | null>(null);
  const [inlineNewStatus, setInlineNewStatus] = useState<string>("");
  const [inlineSoldChannel, setInlineSoldChannel] = useState<SoldChannel | "">("");
  const [inlineUpdating, setInlineUpdating] = useState(false);

  // Bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Active status keys from labels
  const activeStatusKeys = useMemo(() => statusLabels.filter(s => s.is_active).map(s => s.key), [statusLabels]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatuses, showAll, filterSeries, filterCondition, filterColor, filterWarranty, filterCategory, dateRange, sortOrder, filterBranch, pageSize]);

  // Auto-focus search input for barcode scanner support
  // 1) Focus on mount with multiple retries (covers slow renders)
  // 2) Re-focus when focus leaves interactive elements (scanner sends keystrokes to focused input)
  useEffect(() => {
    // Multiple retries to ensure focus after render
    const timers = [100, 300, 600].map(ms =>
      setTimeout(() => {
        if (document.activeElement === document.body || document.activeElement === null) {
          searchInputRef.current?.focus();
        }
      }, ms)
    );

    const handleClick = (e: MouseEvent) => {
      // After clicking on non-interactive areas, re-focus search for scanner
      setTimeout(() => {
        const active = document.activeElement;
        if (
          !active ||
          active === document.body ||
          (active.tagName !== "INPUT" && active.tagName !== "SELECT" && active.tagName !== "TEXTAREA" &&
           !active.closest("[role='listbox']") && !active.closest("[role='dialog']") &&
           !active.closest("[role='menu']") && !active.closest("[data-radix-popper-content-wrapper]") &&
           !active.closest("button"))
        ) {
          searchInputRef.current?.focus();
        }
      }, 100);
    };

    // Also listen for keydown on document — if search isn't focused and key is alphanumeric, focus it
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active !== searchInputRef.current &&
        (active === document.body || active === null) &&
        e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
      ) {
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Close series dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (seriesRef.current && !seriesRef.current.contains(e.target as Node)) setSeriesDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch branches (super admin)
  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from("branches").select("id, name").eq("is_active", true).order("name")
        .then(({ data }) => setBranches(data ?? []));
    }
  }, [isSuperAdmin]);

  // Fetch all unique series
  const fetchAllSeries = useCallback(async () => {
    const { data } = await supabase.from("master_products").select("series, color").is("deleted_at", null).eq("is_active", true);
    if (data) {
      const uniqueSeries = Array.from(new Set(data.map((d: { series: string }) => d.series))).sort();
      const uniqueColors = Array.from(new Set(data.map((d: { color: string | null }) => d.color ?? ""))).filter(Boolean).sort();
      setAllSeries(uniqueSeries);
      setAllColors(uniqueColors);
    }
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

    if (dateRange?.from) {
      query = query.gte("received_at", format(dateRange.from, "yyyy-MM-dd"));
    }
    if (dateRange?.to) {
      const toDate = new Date(dateRange.to);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt("received_at", format(toDate, "yyyy-MM-dd"));
    }
    return query;
  }, [showAll, filterStatuses, filterCondition, dateRange, isSuperAdmin, filterBranch]);

  // Fetch product IDs for series/color/warranty filters
  const [filteredProductIds, setFilteredProductIds] = useState<string[] | null>(null);
  const hasProductFilter = filterSeries !== "all" || filterColor !== "all" || filterWarranty !== "all" || filterCategory !== "all";
  useEffect(() => {
    if (!hasProductFilter) { setFilteredProductIds(null); return; }
    let q = supabase.from("master_products").select("id").is("deleted_at", null);
    if (filterSeries !== "all") q = q.eq("series", filterSeries);
    if (filterColor !== "all") q = q.eq("color", filterColor);
    if (filterWarranty !== "all") q = q.eq("warranty_type", filterWarranty as WarrantyType);
    if (filterCategory !== "all") q = q.eq("category", filterCategory as ProductCategory);
    q.then(({ data }) => {
      setFilteredProductIds(data?.map(d => d.id) ?? []);
    });
  }, [filterSeries, filterColor, filterWarranty, filterCategory, hasProductFilter]);

  // Resolve search to product IDs (for color/series/warranty/branch text search)
  const [searchProductIds, setSearchProductIds] = useState<string[] | null>(null);
  const [searchBranchIds, setSearchBranchIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchProductIds(null);
      setSearchBranchIds(null);
      return;
    }
    const term = debouncedSearch.trim();
    // Search master_products for series, color, warranty_type matches
    const productSearch = supabase.from("master_products").select("id").is("deleted_at", null)
      .or(`series.ilike.%${term}%,color.ilike.%${term}%,warranty_type.ilike.%${term}%`);
    // Search branches for name matches
    const branchSearch = supabase.from("branches").select("id").ilike("name", `%${term}%`);

    Promise.all([productSearch, branchSearch]).then(([prodRes, branchRes]) => {
      setSearchProductIds(prodRes.data?.map(d => d.id) ?? []);
      setSearchBranchIds(branchRes.data?.map(d => d.id) ?? []);
    });
  }, [debouncedSearch]);

  const fetchUnits = useCallback(async () => {
    if (hasProductFilter && filteredProductIds === null) return;
    if (debouncedSearch.trim() && searchProductIds === null) return;

    setLoading(true);
    setError(null);

    // Build the combined product_id filter
    let effectiveProductIds: string[] | null = null;
    if (hasProductFilter && filteredProductIds) {
      effectiveProductIds = filteredProductIds;
      if (effectiveProductIds.length === 0) {
        setUnits([]); setTotalCount(0); setLoading(false); return;
      }
    }

    // Build search OR conditions
    const buildSearchFilter = (query: any) => {
      if (!debouncedSearch.trim()) return query;
      // Build OR: IMEI match OR product_id in searchProductIds OR branch_id in searchBranchIds
      const orParts: string[] = [`imei.ilike.%${debouncedSearch}%`];
      if (searchProductIds && searchProductIds.length > 0) {
        orParts.push(`product_id.in.(${searchProductIds.join(",")})`);
      }
      if (searchBranchIds && searchBranchIds.length > 0) {
        orParts.push(`branch_id.in.(${searchBranchIds.join(",")})`);
      }
      return query.or(orParts.join(","));
    };

    let countQuery = supabase.from("stock_units").select("*", { count: "exact", head: true });
    countQuery = applyFilters(countQuery);
    if (effectiveProductIds) countQuery = countQuery.in("product_id", effectiveProductIds);
    countQuery = buildSearchFilter(countQuery);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let dataQuery = supabase
      .from("stock_units")
      .select(`*, master_products(series, storage_gb, color, warranty_type, category), branches(name)`)
      .order("received_at", { ascending: sortOrder === "asc" })
      .range(from, to);
    dataQuery = applyFilters(dataQuery);
    if (effectiveProductIds) dataQuery = dataQuery.in("product_id", effectiveProductIds);
    dataQuery = buildSearchFilter(dataQuery);

    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

    if (dataResult.error) { setError(dataResult.error.message); setLoading(false); return; }

    setTotalCount(countResult.count ?? 0);
    setUnits((dataResult.data as StockUnitWithBranch[]) ?? []);
    setLoading(false);
  }, [debouncedSearch, searchProductIds, searchBranchIds, filterStatuses, showAll, filterCondition, dateRange, sortOrder, isSuperAdmin, filterBranch, page, pageSize, applyFilters, filteredProductIds, hasProductFilter]);

  const fetchSummary = useCallback(async () => {
    const counts: SummaryCount[] = [];
    let totalCount = 0;

    const branchFilter = isSuperAdmin && filterBranch !== "all" ? filterBranch : null;
    const queries = activeStatusKeys.map(s => {
      let q = supabase.from("stock_units").select("*", { count: "exact", head: true }).eq("stock_status", s);
      if (branchFilter) q = q.eq("branch_id", branchFilter);
      return q;
    });

    const results = await Promise.all(queries);

    activeStatusKeys.forEach((s, i) => {
      const c = results[i].count ?? 0;
      counts.push({ status: s, count: c });
      totalCount += c;
    });
    counts.unshift({ status: "all", count: totalCount });
    setSummary(counts);
  }, [isSuperAdmin, filterBranch, activeStatusKeys]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchAllSeries(); }, [fetchAllSeries]);

  // Fetch warranty claims for sold units in current view
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
  const resetFilters = () => { setSearch(""); setDebouncedSearch(""); setFilterStatuses(new Set(["available"])); setShowAll(false); setFilterSeries("all"); setFilterCondition("all"); setFilterColor("all"); setFilterWarranty("all"); setFilterCategory("all"); setDateRange(undefined); setSeriesSearch(""); setSortOrder("desc"); setFilterBranch("all"); };
  const hasActiveFilters = search || !isDefaultFilter || filterSeries !== "all" || filterCondition !== "all" || filterColor !== "all" || filterWarranty !== "all" || filterCategory !== "all" || dateRange?.from || showAll;
  const activeFilterCount = [filterSeries !== "all", filterCondition !== "all", filterColor !== "all", filterWarranty !== "all", filterCategory !== "all", dateRange?.from, filterBranch !== "all"].filter(Boolean).length;

  const filteredSeriesList = allSeries.filter(s => s.toLowerCase().includes(seriesSearch.toLowerCase()));

  // Bulk delete
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === units.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(units.map(u => u.id)));
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
      setInlineStatusUnit(unitId);
      setInlineNewStatus(newStatus);
      setInlineSoldChannel("");
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
    if (isSuperAdmin || isAdminBranch) {
      return [
        { value: "pos", label: "Terjual Offline Store (POS)" },
        { value: "ecommerce_tokopedia", label: "Terjual E-Commerce (Tokopedia)" },
        { value: "ecommerce_shopee", label: "Terjual E-Commerce (Shopee)" },
        { value: "website", label: "Terjual Online (Website)" },
      ];
    }
    return [
      { value: "ecommerce_tokopedia", label: "Terjual E-Commerce (Tokopedia)" },
      { value: "ecommerce_shopee", label: "Terjual E-Commerce (Shopee)" },
    ];
  };

  // Pagination controls
  const paginationRange = useMemo(() => {
    const delta = 1;
    const range: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
        range.push(i);
      } else if (range[range.length - 1] !== "...") {
        range.push("...");
      }
    }
    return range;
  }, [page, totalPages]);

  return (
    <DashboardLayout pageTitle="Stok IMEI">
      <div className="space-y-4 sm:space-y-5 pb-20">
        {/* ── Page header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Stok IMEI</h1>
            <p className="text-xs text-muted-foreground">Kelola dan pantau seluruh unit berbasis IMEI secara real-time.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
            <Button
              variant="outline"
              size="sm"
              className="h-8 sm:h-9 gap-1.5 text-xs"
              onClick={() => {
                if (units.length === 0) { setExportEmptyOpen(true); return; }
                const csvRows = units.map((u) => {
                  const prod = `${u.master_products?.series ?? ""} ${u.master_products?.storage_gb ? u.master_products.storage_gb + "GB" : ""}`.trim();
                  const color = u.master_products?.color ?? "";
                  const warranty = getWarrantyLabel(u.master_products?.warranty_type);
                  const kondisi = u.condition_status === "no_minus" ? "No Minus" : "Ada Minus";
                  const hargaJual = u.selling_price != null ? u.selling_price.toString() : "";
                  const status = u.stock_status === "sold" && u.sold_channel ? `Terjual ${SOLD_CHANNEL_SHORT[u.sold_channel]}` : u.stock_status;
                  const tanggal = u.received_at ? new Date(u.received_at).toLocaleDateString("id-ID") : "";
                  if (isSuperAdmin) {
                    return [u.imei, prod, color, warranty, kondisi, hargaJual, u.cost_price?.toString() ?? "", status, u.supplier ?? "", u.batch_code ?? "", tanggal].join(",");
                  }
                  return [prod, color, warranty, kondisi, hargaJual, status, tanggal].join(",");
                });
                const csvHeaders = isSuperAdmin
                  ? ["IMEI", "Produk", "Warna", "Tipe", "Kondisi", "Harga Jual", "Harga Beli", "Status", "Supplier", "Batch", "Tanggal Masuk"]
                  : ["Produk", "Warna", "Tipe", "Kondisi", "Harga Jual", "Status", "Tanggal Masuk"];
                const csv = [csvHeaders.join(","), ...csvRows].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `stok-imei-${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
              }}
            >
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
              <Button size="sm" className="h-8 sm:h-9 gap-1.5 text-xs" onClick={() => navigate("/admin/stok-imei/tambah")}>
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Tambah Unit</span>
                <span className="xs:hidden">Tambah</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── Summary bar ── */}
        <div className="flex overflow-x-auto gap-2 sm:gap-2.5 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {(() => {
            const totalCount = summary.find(c => c.status === "all")?.count ?? 0;
            return (
              <button
                onClick={() => { setShowAll(true); setFilterStatuses(new Set(activeStatusKeys)); }}
                className={cn(
                  "min-w-[80px] sm:min-w-0 sm:flex-1 flex-shrink-0 rounded-xl border border-border bg-card px-3 py-3 sm:px-4 sm:py-3.5 text-left transition-all duration-150 hover:shadow-sm",
                  showAll && "bg-muted/60 border-border shadow-sm"
                )}
              >
                <p className="text-xl sm:text-2xl font-bold leading-none text-foreground">{totalCount}</p>
                <p className="text-[10px] mt-1.5 font-semibold uppercase tracking-wider text-muted-foreground truncate">Semua</p>
              </button>
            );
          })()}
          {statusLabels.filter(s => s.is_active).map((sl) => {
            const count = summary.find((c) => c.status === sl.key)?.count ?? 0;
            const styles = getStatusStyles(sl);
            const isActive = !showAll && filterStatuses.size === 1 && filterStatuses.has(sl.key);
            return (
              <button
                key={sl.key}
                onClick={() => {
                  setShowAll(false);
                  // Single-click only: replace filter with just this status
                  setFilterStatuses(new Set([sl.key]));
                }}
                className={cn(
                  "min-w-[80px] sm:min-w-0 sm:flex-1 flex-shrink-0 rounded-xl border border-border bg-card px-3 py-3 sm:px-4 sm:py-3.5 text-left transition-all duration-150 hover:shadow-sm",
                  isActive && "shadow-sm"
                )}
                style={isActive ? { backgroundColor: styles.bg } : undefined}
              >
                <p className="text-xl sm:text-2xl font-bold leading-none" style={isActive ? { color: styles.text } : undefined}>{count}</p>
                <p className="text-[10px] mt-1.5 font-semibold uppercase tracking-wider truncate" style={{ color: styles.text }}>{sl.label}</p>
              </button>
            );
          })}
        </div>

        {/* ── Filter & Search panel ── */}
        <div className="bg-card rounded-xl border border-border p-3 md:p-4 space-y-3">
          {/* Row 1: Search + mobile filter button + view toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari unit dengan IMEI, seri, warna, tipe…" className="pl-9 h-9 text-sm" />
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
                <SheetHeader>
                  <SheetTitle>Filter Stok</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 pt-4">
                  {isSuperAdmin && branches.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Cabang</label>
                      <Select value={filterBranch} onValueChange={setFilterBranch}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Semua Cabang" /></SelectTrigger>
                        <SelectContent position="popper" side="bottom" className="max-h-[200px]">
                          <SelectItem value="all">Semua Cabang</SelectItem>
                          {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Kategori</label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" className="max-h-[200px]">
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Kondisi</label>
                    <div className="flex gap-2">
                      {[{ v: "all", label: "Semua" }, { v: "no_minus", label: "No Minus" }, { v: "minus", label: "Minus" }].map(({ v, label }) => (
                        <button key={v} onClick={() => setFilterCondition(v)}
                          className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center",
                            filterCondition === v ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border"
                          )}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Warna</label>
                      <Select value={filterColor} onValueChange={setFilterColor}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Semua Warna" /></SelectTrigger>
                        <SelectContent position="popper" side="bottom" className="max-h-[200px]">
                          <SelectItem value="all">Semua Warna</SelectItem>
                          {allColors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Tipe</label>
                      <Select value={filterWarranty} onValueChange={setFilterWarranty}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Semua Tipe" /></SelectTrigger>
                        <SelectContent position="popper" side="bottom" className="max-h-[200px]">
                          <SelectItem value="all">Semua Tipe</SelectItem>
                          {(Object.entries(WARRANTY_LABELS) as [WarrantyType, string][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Seri</label>
                    <Select value={filterSeries} onValueChange={setFilterSeries}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Semua Seri" /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" className="max-h-[200px]">
                        <SelectItem value="all">Semua Seri</SelectItem>
                        {allSeries.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
            {/* Desktop: sort + view toggle */}
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs hidden md:flex" onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}>
              <ArrowUpDown className="w-3.5 h-3.5" />{sortOrder === "desc" ? "Terbaru" : "Terlama"}
            </Button>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 h-9">
              <button onClick={() => setViewMode("table")} className={cn("px-2.5 py-1 rounded-md transition-colors", viewMode === "table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <List className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode("compact")} className={cn("px-2.5 py-1 rounded-md transition-colors", viewMode === "compact" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Row 2: Desktop filters */}
          <div className="hidden md:flex gap-2">
            {/* 1. Cabang */}
            {isSuperAdmin && branches.length > 0 && (
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className={cn("h-9 flex-1 min-w-0 text-sm", filterBranch !== "all" && "border-primary text-primary")}><SelectValue placeholder="Semua Cabang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cabang</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {/* 2. Kategori */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className={cn("h-9 flex-1 min-w-0 text-sm", filterCategory !== "all" && "border-primary text-primary")}><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 3. Seri (searchable) */}
            <div className="relative flex-1 min-w-0" ref={seriesRef}>
              <div
                className={cn("h-9 flex items-center border rounded-md bg-background px-3 cursor-pointer text-sm", filterSeries !== "all" ? "border-primary text-primary" : "border-input")}
                onClick={() => setSeriesDropdownOpen(!seriesDropdownOpen)}
              >
                <span className={cn("flex-1 truncate", filterSeries === "all" && "text-muted-foreground")}>
                  {filterSeries === "all" ? "Semua Seri" : filterSeries}
                </span>
                <Search className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
              </div>
              {seriesDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-hidden flex flex-col min-w-[200px]">
                  <div className="p-2 border-b border-border">
                    <Input value={seriesSearch} onChange={(e) => setSeriesSearch(e.target.value)} placeholder="Cari seri..." className="h-8 text-sm" autoFocus />
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    <button type="button" onClick={() => { setFilterSeries("all"); setSeriesDropdownOpen(false); setSeriesSearch(""); }}
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors", filterSeries === "all" && "bg-accent font-medium")}>
                      Semua Seri
                    </button>
                    {filteredSeriesList.map((s) => (
                      <button key={s} type="button" onClick={() => { setFilterSeries(s); setSeriesDropdownOpen(false); setSeriesSearch(""); }}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors", filterSeries === s && "bg-accent font-medium")}>
                        {s}
                      </button>
                    ))}
                    {filteredSeriesList.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ditemukan</p>}
                  </div>
                </div>
              )}
            </div>
            {/* 4. Tipe */}
            <Select value={filterWarranty} onValueChange={setFilterWarranty}>
              <SelectTrigger className={cn("h-9 flex-1 min-w-0 text-sm", filterWarranty !== "all" && "border-primary text-primary")}><SelectValue placeholder="Tipe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {(Object.entries(WARRANTY_LABELS) as [WarrantyType, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 5. Kondisi */}
            <Select value={filterCondition} onValueChange={setFilterCondition}>
              <SelectTrigger className={cn("h-9 flex-1 min-w-0 text-sm", filterCondition !== "all" && "border-primary text-primary")}><SelectValue placeholder="Kondisi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kondisi</SelectItem>
                <SelectItem value="no_minus">No Minus</SelectItem>
                <SelectItem value="minus">Minus</SelectItem>
              </SelectContent>
            </Select>
            {/* 6. Warna */}
            <Select value={filterColor} onValueChange={setFilterColor}>
              <SelectTrigger className={cn("h-9 flex-1 min-w-0 text-sm", filterColor !== "all" && "border-primary text-primary")}><SelectValue placeholder="Warna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Warna</SelectItem>
                {allColors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* 7. Tanggal */}
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
          {/* Mobile: sort + active filters pills */}
          <div className="flex md:hidden items-center gap-2 overflow-x-auto scrollbar-hide">
            <button onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
              className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border bg-background text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />{sortOrder === "desc" ? "Terbaru" : "Terlama"}
            </button>
            {filterCategory !== "all" && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                {CATEGORY_LABELS[filterCategory as ProductCategory]}
                <button className="ml-1" onClick={() => setFilterCategory("all")}>×</button>
              </span>
            )}
            {filterColor !== "all" && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                {filterColor}
                <button className="ml-1" onClick={() => setFilterColor("all")}>×</button>
              </span>
            )}
            {filterWarranty !== "all" && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                {WARRANTY_LABELS[filterWarranty as WarrantyType]}
                <button className="ml-1" onClick={() => setFilterWarranty("all")}>×</button>
              </span>
            )}
            {filterSeries !== "all" && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                {filterSeries}
                <button className="ml-1" onClick={() => setFilterSeries("all")}>×</button>
              </span>
            )}
          </div>
          {!isDefaultFilter && !showAll && (
            <p className="text-xs text-muted-foreground">
              Filter aktif: <span className="font-medium text-foreground">{Array.from(filterStatuses).map(s => getStatusLabel(s, statusLabels)).join(", ")}</span>
              {" · "}<button className="underline" onClick={() => { setFilterStatuses(new Set(["available"])); setShowAll(false); }}>tampilkan default</button>
            </p>
          )}
          {showAll && (
            <p className="text-xs text-muted-foreground">
              Menampilkan <span className="font-medium text-foreground">semua status</span>
              {" · "}<button className="underline" onClick={() => { setShowAll(false); setFilterStatuses(new Set(["available"])); }}>tampilkan default</button>
            </p>
          )}
        </div>

        {/* ── Content ── */}
        {error ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-3">
            <p className="text-sm text-destructive">Terjadi kesalahan saat memuat data. Silakan coba kembali.</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>Coba Lagi</Button>
          </div>
        ) : loading ? (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
            </div>
          </div>
        ) : units.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto"><Search className="w-5 h-5 text-muted-foreground" /></div>
            <p className="text-sm font-medium text-foreground">Belum ada unit dengan kriteria ini.</p>
            <p className="text-xs text-muted-foreground">Coba ubah filter atau tambahkan unit baru.</p>
          </div>
        ) : viewMode === "table" ? (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {(isSuperAdmin || isAdminBranch) && selectedIds.size > 0 && (
              <div className="px-3 sm:px-4 py-2.5 border-b border-border bg-destructive/5 flex items-center justify-between">
                <p className="text-xs font-medium text-destructive">{selectedIds.size} unit dipilih</p>
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
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {(isSuperAdmin || isAdminBranch) && (
                      <th className="w-10 px-2 sm:px-3 py-3">
                        <Checkbox checked={units.length > 0 && selectedIds.size === units.length} onCheckedChange={toggleSelectAll} />
                      </th>
                    )}
                    <th className="text-left px-2 sm:px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Produk</th>
                    <th className="text-left px-2 sm:px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Kondisi</th>
                    <th className="text-left px-2 sm:px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Harga</th>
                    <th className="text-left px-2 sm:px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                    <th className="text-left px-2 sm:px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Supplier</th>
                    <th className="text-left px-2 sm:px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Masuk</th>
                    <th className="text-left px-2 sm:px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Durasi</th>
                    {isSuperAdmin && (
                      <th className="text-left px-2 sm:px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Cabang</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {units.map((unit) => {
                    const unitWithBranch = unit as StockUnitWithBranch;
                    const validTransitions = getValidTransitions(unit.stock_status);
                    const canChangeStatus = (isSuperAdmin || isAdminBranch || (isEmployee && validTransitions.length > 0)) && validTransitions.length > 0;
                    return (
                      <tr key={unit.id} className={`hover:bg-accent/40 cursor-pointer transition-colors ${selectedIds.has(unit.id) ? "bg-accent/20" : ""}`} onDoubleClick={() => setSelectedUnit(unit)}>
                        {(isSuperAdmin || isAdminBranch) && (
                          <td className="w-10 px-2 sm:px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedIds.has(unit.id)} onCheckedChange={() => toggleSelect(unit.id)} />
                          </td>
                        )}
                        <td className="px-2 sm:px-4 py-3">
                          <p className="font-semibold text-foreground text-xs sm:text-sm leading-tight truncate max-w-[180px] sm:max-w-none">
                            {unit.master_products?.series} {unit.master_products?.storage_gb}GB
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="inline-flex items-center rounded-md bg-accent/60 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium text-accent-foreground">
                              {unit.master_products?.color}
                            </span>
                            <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium text-secondary-foreground">
                              {getWarrantyLabel(unit.master_products?.warranty_type)}
                            </span>
                          </div>
                          {unit.imei && unit.imei.trim() !== "" ? (
                            <div className="inline-flex items-center gap-1.5 mt-1.5 rounded-md border border-border bg-muted/60 px-2 py-1 cursor-pointer group w-fit"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(unit.imei); toast({ title: "IMEI disalin", description: unit.imei }); }}
                              title="Klik untuk menyalin IMEI"
                            >
                              <span className="text-[10px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">IMEI</span>
                              <span className="font-mono text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors select-all tracking-wide">{unit.imei}</span>
                            </div>
                          ) : (
                            <p className="text-[11px] sm:text-xs text-muted-foreground/40 mt-1.5 italic font-medium">TANPA IMEI</p>
                          )}
                          <div className="sm:hidden mt-1"><ConditionBadge condition={unit.condition_status} /></div>
                        </td>
                        <td className="px-2 sm:px-4 py-3 hidden sm:table-cell"><ConditionBadge condition={unit.condition_status} /></td>
                        <td className="px-2 sm:px-4 py-3">
                          <span className="font-medium text-foreground text-xs sm:text-sm">{formatCurrency(unit.selling_price)}</span>
                        </td>
                        <td className="px-2 sm:px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {canChangeStatus ? (
                            <div className="space-y-1">
                              <Select value={unit.stock_status} onValueChange={(val) => handleInlineStatusChange(unit.id, unit.stock_status, val)}>
                                <SelectTrigger className="h-7 w-[110px] sm:w-[130px] text-[10px] sm:text-xs border-dashed p-1 sm:p-2">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={unit.stock_status}>{getStatusLabel(unit.stock_status, statusLabels)}</SelectItem>
                                  {validTransitions.map((s) => <SelectItem key={s} value={s}>{getStatusLabel(s, statusLabels)}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {unit.stock_status === "sold" && canEditSoldChannel ? (
                                <Select value={unit.sold_channel ?? "none"} onValueChange={(val) => handleSoldChannelUpdate(unit.id, val as SoldChannel)}>
                                  <SelectTrigger className={`h-6 w-[130px] sm:w-[150px] text-[9px] sm:text-[10px] border-dashed p-1 ${!unit.sold_channel ? "text-destructive border-destructive/30" : ""}`}>
                                    <SelectValue placeholder="Pilih channel..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {!unit.sold_channel && <SelectItem value="none" disabled>Belum ditentukan</SelectItem>}
                                    <SelectItem value="pos">Offline Store (POS)</SelectItem>
                                    <SelectItem value="ecommerce_tokopedia">Online (Tokopedia)</SelectItem>
                                    <SelectItem value="ecommerce_shopee">Online (Shopee)</SelectItem>
                                    <SelectItem value="website">Online (Website)</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : unit.stock_status === "sold" && unit.sold_channel ? (
                                <p className="text-[9px] sm:text-[10px] text-muted-foreground">{SOLD_CHANNEL_SHORT[unit.sold_channel]}</p>
                              ) : unit.stock_status === "sold" && !unit.sold_channel ? (
                                <p className="text-[9px] sm:text-[10px] text-destructive">Belum ditentukan</p>
                              ) : null}
                              {unit.stock_status === "sold" && (() => {
                                const claims = warrantyClaimsMap[unit.id];
                                if (!claims || claims.length === 0) return (
                                  <span className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50">
                                    <ShieldOff className="w-3.5 h-3.5 shrink-0" /> Belum Klaim Garansi
                                  </span>
                                );
                                const total = claims.length;
                                const latest = claims.reduce((a, b) => {
                                  const order: Record<string, number> = { in_progress: 2, pending: 1, completed: 0 };
                                  return (order[a.claim_status] ?? 0) >= (order[b.claim_status] ?? 0) ? a : b;
                                });
                                const statusLabel = latest.claim_status === "pending" ? "Menunggu Diproses" : latest.claim_status === "in_progress" ? "Sedang Diperbaiki" : latest.claim_status === "completed" ? "Selesai" : latest.claim_status;
                                const bgColor = latest.claim_status === "completed" ? "bg-primary/10 text-primary border-primary/20" : latest.claim_status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800";
                                return (
                                  <span className={`inline-flex items-center gap-1 sm:gap-1.5 mt-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium border whitespace-normal leading-tight ${bgColor}`}>
                                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                    <span className="break-words">{total}x Klaim · {statusLabel}</span>
                                  </span>
                                );
                              })()}
                            </div>
                          ) : (
                            <div>
                              <StockStatusBadge status={unit.stock_status} statusLabels={statusLabels} />
                              {unit.stock_status === "sold" && unit.sold_channel ? (
                                <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{SOLD_CHANNEL_SHORT[unit.sold_channel]}</p>
                              ) : unit.stock_status === "sold" && !unit.sold_channel ? (
                                <p className="text-[9px] sm:text-[10px] text-destructive mt-0.5">Belum ditentukan</p>
                              ) : null}
                              {unit.stock_status === "sold" && (() => {
                                const claims = warrantyClaimsMap[unit.id];
                                if (!claims || claims.length === 0) return (
                                  <span className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50">
                                    <ShieldOff className="w-3.5 h-3.5 shrink-0" /> Belum Klaim Garansi
                                  </span>
                                );
                                const total = claims.length;
                                const latest = claims.reduce((a, b) => {
                                  const order: Record<string, number> = { in_progress: 2, pending: 1, completed: 0 };
                                  return (order[a.claim_status] ?? 0) >= (order[b.claim_status] ?? 0) ? a : b;
                                });
                                const statusLabel = latest.claim_status === "pending" ? "Menunggu Diproses" : latest.claim_status === "in_progress" ? "Sedang Diperbaiki" : latest.claim_status === "completed" ? "Selesai" : latest.claim_status;
                                const bgColor = latest.claim_status === "completed" ? "bg-primary/10 text-primary border-primary/20" : latest.claim_status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800";
                                return (
                                  <span className={`inline-flex items-center gap-1 sm:gap-1.5 mt-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium border whitespace-normal leading-tight ${bgColor}`}>
                                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                    <span className="break-words">{total}x Klaim · {statusLabel}</span>
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell truncate max-w-[120px]">{unit.supplier ?? "—"}</td>
                        <td className="px-2 sm:px-4 py-3 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">{formatDate(unit.received_at)}</td>
                        <td className="px-2 sm:px-4 py-3 hidden sm:table-cell">
                          {(() => {
                            const dur = getUnitDuration(unit);
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold cursor-default ${dur.color}`}>
                                    <Clock className="w-3 h-3" />
                                    {dur.label}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">
                                  {dur.tooltip}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        </td>
                        {isSuperAdmin && (
                          <td className="px-2 sm:px-4 py-3 text-[10px] sm:text-xs text-muted-foreground hidden lg:table-cell">{unitWithBranch.branches?.name ?? "—"}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 sm:px-4 py-2.5 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{totalCount} unit total · halaman {page}/{totalPages}</p>
              <p className="text-[10px] text-muted-foreground hidden sm:block">Klik 2x pada baris untuk melihat detail unit</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Tampilan ringkas untuk pengecekan cepat di etalase.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {units.map((unit) => (
                <button key={unit.id} onClick={() => setSelectedUnit(unit)}
                  className="bg-card rounded-xl border border-border p-3 sm:p-4 text-left hover:shadow-md hover:border-border/70 transition-all duration-150 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight truncate">{unit.master_products?.series} {unit.master_products?.storage_gb}GB</p>
                      <p className="text-xs text-muted-foreground truncate">{unit.master_products?.color}</p>
                    </div>
                    <StockStatusBadge status={unit.stock_status} statusLabels={statusLabels} className="shrink-0" />
                  </div>
                  <div className="flex items-center justify-between">
                    <ConditionBadge condition={unit.condition_status} />
                    <p className="text-sm font-bold text-foreground">{formatCurrency(unit.selling_price)}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{getWarrantyLabel(unit.master_products?.warranty_type)} · Masuk {formatDate(unit.received_at)}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Fixed Pagination Bar ── */}
      {!loading && totalCount > 0 && (
        <div className="fixed bottom-0 left-0 md:left-[72px] right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
          <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">{totalCount} unit</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">Tampilkan</span>
              <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground hidden sm:inline">per halaman</span>
            </div>
            <span className="text-xs text-muted-foreground sm:hidden">{page}/{totalPages}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="hidden sm:flex items-center gap-1">
                {paginationRange.map((item, idx) =>
                  item === "..." ? (
                    <span key={`dots-${idx}`} className="w-8 text-center text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button key={item} variant={page === item ? "default" : "outline"} size="sm"
                      className={cn("h-8 w-8 p-0 text-xs", page === item && "pointer-events-none")}
                      onClick={() => setPage(item as number)}>
                      {item}
                    </Button>
                  )
                )}
              </div>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddUnitModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleRefresh} />
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
                {getSoldChannelOptions().map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
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
            <p className="text-xs text-muted-foreground">Ubah filter terlebih dahulu atau pastikan ada unit stok.</p>
            <Button variant="outline" className="w-full" onClick={() => setExportEmptyOpen(false)}>Tutup</Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
