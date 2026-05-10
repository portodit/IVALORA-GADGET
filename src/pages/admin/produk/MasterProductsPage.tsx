import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/admin/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableDropdown } from "@/components/shared/SearchableDropdown";
import {
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/shared/use-toast";
import {
  Plus,
  Search,
  PackageOpen,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
  Tag,
  SlidersHorizontal,
  X,
  Loader2,
  AlertTriangle,
  Package,
  BookOpen,
  PowerOff,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  MasterProduct,
  CATEGORY_LABELS,
  ProductCategory,
  WarrantyType,
  WARRANTY_LABELS,
  HAS_SIZE_CATEGORIES,
  HAS_STORAGE_CATEGORIES,
  HAS_COLOR_CATEGORIES,
  formatStorage,
  formatSize,
} from "@/lib/admin/produk/master-products";
import { ProductFormModal } from "@/components/admin/produk/ProductFormModal";
import { ProductDetailDrawer } from "@/components/admin/produk/ProductDetailDrawer";
import { DeactivateModal } from "@/components/admin/produk/DeactivateModal";
import { BulkDeactivateModal } from "@/components/admin/produk/BulkDeactivateModal";
import { WarrantyLabelModal, WarrantyLabel } from "@/components/admin/produk/WarrantyLabelModal";
import { CategoryStatsCards } from "@/components/admin/produk/CategoryStatsCards";
import { TablePagination } from "@/components/ui/table-pagination";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminDataTable } from "@/components/shared/AdminDataTable";

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 15;

// ── Category badge dengan warna per tipe ─────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category as ProductCategory] ?? category;
  const colorCls =
    category === "iphone"    ? "bg-blue-100 text-blue-700 border-blue-200" :
    category === "ipad"      ? "bg-violet-100 text-violet-700 border-violet-200" :
    category === "macbook"   ? "bg-slate-100 text-slate-700 border-slate-200" :
    category === "watch"     ? "bg-rose-100 text-rose-700 border-rose-200" :
    category === "airpods"   ? "bg-cyan-100 text-cyan-700 border-cyan-200" :
    category === "accessory" ? "bg-amber-100 text-amber-700 border-amber-200" :
                               "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap", colorCls)}>
      {label}
    </span>
  );
}

// ── Module-level stale-while-revalidate cache ─────────────────────────────────
// Persists across page navigations so data shows instantly on revisit
let _mpCache: {
  products: MasterProduct[];
  count: number;
  stockCounts: Map<string, number>;
  catalogSet: Set<string>;
} | null = null;

export default function MasterProductsPage() {
  const { toast } = useToast();
  const { role } = useAuth();
  const canEditDelete = role === "super_admin";

  // ─── Data ────────────────────────────────────────────────
  const [products, setProducts] = useState<MasterProduct[]>(_mpCache?.products ?? []);
  const [loading, setLoading] = useState(!_mpCache);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(_mpCache?.count ?? 0);

  // ─── Warranty labels (dynamic) ───────────────────────────
  const [warrantyLabels, setWarrantyLabels] = useState<WarrantyLabel[]>([]);
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);

  // ─── Filters ─────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterWarranty, setFilterWarranty] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [filterCatalog, setFilterCatalog] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // ─── Branches ───────────────────────────────────────────────
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // ─── Modals ──────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<MasterProduct | null>(null);
  const [isUsedInStock, setIsUsedInStock] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailProduct, setDetailProduct] = useState<MasterProduct | null>(null);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateProduct, setDeactivateProduct] = useState<MasterProduct | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // ─── Bulk selection (super_admin only) ────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkSkuDetails, setBulkSkuDetails] = useState<{
    safe: MasterProduct[];
    unsafe: { product: MasterProduct; stockCount: number; catalogCount: number }[];
  } | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"safe_only" | "all">("safe_only");

  // ─── Sticky: filter bar height (passed to AdminDataTable) ───
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [thTop, setThTop] = useState(0);
  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setThTop(el.offsetHeight));
    ro.observe(el);
    setThTop(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // ─── Mobile filter sheet ──────────────────────────────────
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // ─── Bulk deactivate ─────────────────────────────────────
  const [showBulkDeactivate, setShowBulkDeactivate] = useState(false);
  const [bulkDeactivateMode, setBulkDeactivateMode] = useState<"selected" | "category">("selected");

  // ─── Enrichment: stock counts & catalog status per product ──
  const [stockCounts, setStockCounts] = useState<Map<string, number>>(_mpCache?.stockCounts ?? new Map());
  const [catalogSet, setCatalogSet] = useState<Set<string>>(_mpCache?.catalogSet ?? new Set());

  // ─── Debounce search ─────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategory, filterWarranty, filterStatus, filterBranch, filterUnit, filterCatalog, pageSize]);

  // ─── Fetch branches ──────────────────────────────────────
  useEffect(() => {
    supabase
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  // ─── Fetch warranty labels ────────────────────────────────
  const fetchWarrantyLabels = useCallback(async () => {
    const { data } = await supabase
      .from("warranty_labels")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setWarrantyLabels(data as WarrantyLabel[]);
  }, []);

  useEffect(() => { fetchWarrantyLabels(); }, [fetchWarrantyLabels]);

  // Build label map for display - use DB labels or fallback to static
  const warrantyOptionsForFilter = warrantyLabels.length > 0
    ? warrantyLabels
    : Object.entries(WARRANTY_LABELS).map(([key, label]) => ({ key, label }));
  
  const warrantyLabelMap = Object.fromEntries(
    warrantyLabels.length > 0
      ? warrantyLabels.map((w) => [w.key, w.label])
      : Object.entries(WARRANTY_LABELS)
  );
  const getWarrantyLabel = (key: string | null) => key ? (warrantyLabelMap[key] ?? WARRANTY_LABELS[key as WarrantyType] ?? key) : "—";

  // ─── Fetch products ───────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pre-fetch product IDs for unit/catalog filters
      let unitProductIds: string[] | null = null;
      let catalogProductIds: string[] | null = null;

      if (filterUnit !== "all") {
        let uq = supabase.from("stock_units").select("product_id");
        if (filterBranch !== "all") uq = uq.eq("branch_id", filterBranch);
        const { data: unitData } = await uq;
        const allUnitIds = new Set<string>();
        (unitData ?? []).forEach((r: any) => allUnitIds.add(r.product_id));
        unitProductIds = [...allUnitIds];
      }

      // Fetch catalog series for filtering (new logic: check by series, not product_id)
      let catalogSeriesSet = new Set<string>();
      if (filterCatalog !== "all") {
        const WARRANTY_MAP: Record<string, string> = {
          resmi_bc: 'RESMI BEACUKAI',
          ibox: 'RESMI INDONESIA',
          digimap: 'RESMI INDONESIA',
          resmi: 'RESMI INDONESIA',
          inter: 'INTER',
          whitelist: 'WHITELIST'
        };
        function getWarrantyGroup(wt: string | null): string {
          if (!wt) return 'RESMI INDONESIA';
          return WARRANTY_MAP[wt] || wt;
        }
        const { data: catData } = await supabase.from("catalog_products").select("catalog_series,catalog_warranty_type").limit(5000);
        (catData ?? []).forEach((r: any) => {
          const wg = getWarrantyGroup(r.catalog_warranty_type);
          catalogSeriesSet.add(`${r.catalog_series}|||${wg}`);
        });
      }

      // If filtering for "has" but no IDs found, return empty
      if (filterUnit === "has_unit" && unitProductIds && unitProductIds.length === 0) {
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      if (filterCatalog === "has_catalog" && catalogSeriesSet.size === 0) {
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("master_products")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("series", { ascending: true })
        .order("storage_gb", { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (debouncedSearch.trim()) {
        query = query.or(
          `series.ilike.%${debouncedSearch}%,color.ilike.%${debouncedSearch}%`
        );
      }
      if (filterCategory !== "all") query = query.eq("category", filterCategory as ProductCategory);
      if (filterWarranty !== "all") query = query.eq("warranty_type", filterWarranty as WarrantyType);
      if (filterStatus === "active") query = query.eq("is_active", true);
      if (filterStatus === "inactive") query = query.eq("is_active", false);

      // Apply unit filter
      if (filterUnit === "has_unit" && unitProductIds) {
        query = query.in("id", unitProductIds);
      } else if (filterUnit === "no_unit" && unitProductIds) {
        if (unitProductIds.length > 0) {
          query = query.not("id", "in", `(${unitProductIds.join(",")})`);
        }
      }

      // Apply catalog filter using series+warranty_group
      if (filterCatalog !== "all") {
        const { data: allMasters } = await supabase
          .from("master_products")
          .select("id,series,warranty_type")
          .is("deleted_at", null)
          .eq("is_active", true);

        const WARRANTY_MAP: Record<string, string> = {
          resmi_bc: 'RESMI BEACUKAI',
          ibox: 'RESMI INDONESIA',
          digimap: 'RESMI INDONESIA',
          resmi: 'RESMI INDONESIA',
          inter: 'INTER',
          whitelist: 'WHITELIST'
        };
        function getWarrantyGroup(wt: string | null): string {
          if (!wt) return 'RESMI INDONESIA';
          return WARRANTY_MAP[wt] || wt;
        }

        const hasCatalog = new Set<string>();
        const noCatalog = new Set<string>();

        (allMasters ?? []).forEach((m: any) => {
          const wg = getWarrantyGroup(m.warranty_type);
          const key = `${m.series}|||${wg}`;
          if (catalogSeriesSet.has(key)) {
            hasCatalog.add(m.id);
          } else {
            noCatalog.add(m.id);
          }
        });

        if (filterCatalog === "has_catalog") {
          query = query.in("id", [...hasCatalog]);
        } else if (filterCatalog === "no_catalog") {
          query = query.in("id", [...noCatalog]);
        }
      }

      const { data, error: err, count } = await query;
      if (err) throw err;
      const pageProducts = (data as MasterProduct[]) ?? [];

      // ── Enrichment: fetch stock counts + catalog in parallel (no waterfall) ──
      let sc = new Map<string, number>();
      let cs = new Set<string>();
      if (pageProducts.length > 0) {
        const ids = pageProducts.map((p) => p.id);
        let unitQ = supabase.from("stock_units").select("product_id").in("product_id", ids).limit(2000);
        if (filterBranch !== "all") unitQ = unitQ.eq("branch_id", filterBranch);

        // Fetch catalog by series instead of product_id
        const catalogRes = await supabase.from("catalog_products").select("catalog_series,catalog_warranty_type");

        const WAR_MAP: Record<string, string> = {
          resmi_bc: 'RESMI BEACUKAI',
          ibox: 'RESMI INDONESIA',
          digimap: 'RESMI INDONESIA',
          resmi: 'RESMI INDONESIA',
          inter: 'INTER',
          whitelist: 'WHITELIST'
        };
        const getWG = (wt: string | null) => wt ? (WAR_MAP[wt] || wt) : 'RESMI INDONESIA';

        const catKeys = new Set<string>();
        (catalogRes.data ?? []).forEach((r: any) => {
          catKeys.add(`${r.catalog_series}|||${getWG(r.catalog_warranty_type)}`);
        });

        pageProducts.forEach(p => {
          const key = `${p.series}|||${getWG(p.warranty_type)}`;
          if (catKeys.has(key)) cs.add(p.id);
        });

        const [unitRes] = await Promise.all([unitQ]);
        for (const row of (unitRes.data ?? []) as { product_id: string }[]) {
          sc.set(row.product_id, (sc.get(row.product_id) ?? 0) + 1);
        }
      }

      // Simpan ke module-level cache (stale-while-revalidate)
      _mpCache = { products: pageProducts, count: count ?? 0, stockCounts: sc, catalogSet: cs };
      // Satu setState sekaligus — tidak ada render waterfall
      setProducts(pageProducts);
      setTotalCount(count ?? 0);
      setStockCounts(sc);
      setCatalogSet(cs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, filterCategory, filterWarranty, filterStatus, filterUnit, filterCatalog, filterBranch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ─── Handlers ────────────────────────────────────────────
  const handleEdit = (product: MasterProduct) => {
    setEditProduct(product);
    setIsUsedInStock(false);
    setShowForm(true);
  };

  const handleDetail = (product: MasterProduct) => {
    setDetailProduct(product);
    setShowDetail(true);
  };

  const handleDeleteProduct = (product: MasterProduct) => {
    setDeactivateProduct(product);
    setDeleteCheckLoading(true);
    setCannotDeleteReason(null);
    setShowDeactivate(true);
    // Check dependencies
    checkDeleteDependencies(product.id).then(reason => {
      setCannotDeleteReason(reason);
      setDeleteCheckLoading(false);
    });
  };

  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);
  const [cannotDeleteReason, setCannotDeleteReason] = useState<string | null>(null);

  async function checkDeleteDependencies(product: MasterProduct): Promise<string | null> {
    const productId = product.id;
    // Check stock_units
    const { count: stockCount } = await supabase
      .from("stock_units")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if (stockCount && stockCount > 0) {
      return `SKU ini memiliki ${stockCount} unit stok terkait. Hapus semua unit stok terlebih dahulu.`;
    }
    // Check catalog_products by series+warranty
    const WAR_MAP: Record<string, string> = {
      resmi_bc: 'RESMI BEACUKAI',
      ibox: 'RESMI INDONESIA',
      digimap: 'RESMI INDONESIA',
      resmi: 'RESMI INDONESIA',
      inter: 'INTER',
      whitelist: 'WHITELIST'
    };
    const getWG = (wt: string | null) => wt ? (WAR_MAP[wt] || wt) : 'RESMI INDONESIA';
    const wg = getWG(product.warranty_type);

    const { count: catalogCount } = await supabase
      .from("catalog_products")
      .select("id", { count: "exact", head: true })
      .eq("catalog_series", product.series)
      .eq("catalog_warranty_type", wg);
    if (catalogCount && catalogCount > 0) {
      return `SKU ini digunakan di ${catalogCount} katalog produk. Hapus katalog terkait terlebih dahulu.`;
    }
    return null;
  }

  const handleConfirmDelete = async () => {
    if (!deactivateProduct || cannotDeleteReason) return;
    setDeactivateLoading(true);
    try {
      // Soft delete
      const { error } = await supabase
        .from("master_products")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", deactivateProduct.id);
      if (error) throw error;
      toast({ title: "Master produk berhasil dihapus" });
      setShowDeactivate(false);
      setDeactivateProduct(null);
      fetchProducts();
    } catch (e: unknown) {
      toast({
        title: "Gagal menghapus",
        description: e instanceof Error ? e.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setDeactivateLoading(false);
    }
  };

  // ─── Bulk delete handlers ─────────────────────────────────
  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDeleteClick = async () => {
    if (selectedIds.size === 0) return;
    
    setBulkDeleteLoading(true);
    setBulkSkuDetails(null);
    setBulkDeleteMode("safe_only");
    setShowBulkDeleteDialog(true);

    const ids = Array.from(selectedIds);
    const selectedProducts = products.filter((p) => ids.includes(p.id));
    
    // Check dependencies per SKU
    const [stockRes, catalogRes] = await Promise.all([
      supabase
        .from("stock_units")
        .select("product_id")
        .in("product_id", ids),
      supabase
        .from("catalog_products")
        .select("product_id")
        .in("product_id", ids),
    ]);

    const stockByProduct = new Map<string, number>();
    const catalogByProduct = new Map<string, number>();
    
    (stockRes.data ?? []).forEach((r: any) => {
      stockByProduct.set(r.product_id, (stockByProduct.get(r.product_id) ?? 0) + 1);
    });
    (catalogRes.data ?? []).forEach((r: any) => {
      catalogByProduct.set(r.product_id, (catalogByProduct.get(r.product_id) ?? 0) + 1);
    });

    const safe: MasterProduct[] = [];
    const unsafe: { product: MasterProduct; stockCount: number; catalogCount: number }[] = [];

    for (const p of selectedProducts) {
      const sc = stockByProduct.get(p.id) ?? 0;
      const cc = catalogByProduct.get(p.id) ?? 0;
      if (sc === 0 && cc === 0) {
        safe.push(p);
      } else {
        unsafe.push({ product: p, stockCount: sc, catalogCount: cc });
      }
    }

    setBulkSkuDetails({ safe, unsafe });
    setBulkDeleteLoading(false);
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkSkuDetails) return;
    
    setBulkDeleteLoading(true);
    const safeIds = bulkSkuDetails.safe.map((p) => p.id);
    const unsafeIds = bulkSkuDetails.unsafe.map((u) => u.product.id);
    const idsToDelete = bulkDeleteMode === "all" ? [...safeIds, ...unsafeIds] : safeIds;

    if (idsToDelete.length === 0) {
      toast({ title: "Tidak ada SKU yang bisa dihapus", variant: "destructive" });
      setBulkDeleteLoading(false);
      return;
    }

    try {
      // If deleting all including unsafe, cascade delete relations
      if (bulkDeleteMode === "all" && unsafeIds.length > 0) {
        const [stockDel, catalogDel] = await Promise.all([
          supabase.from("stock_units").delete().in("product_id", unsafeIds),
          supabase.from("catalog_products").delete().in("product_id", unsafeIds),
        ]);
        if (stockDel.error) throw stockDel.error;
        if (catalogDel.error) throw catalogDel.error;
      }

      // Soft delete master products
      const { error } = await supabase
        .from("master_products")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .in("id", idsToDelete);
      if (error) throw error;

      toast({ title: `${idsToDelete.length} SKU berhasil dihapus` });
      setShowBulkDeleteDialog(false);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (e: unknown) {
      toast({
        title: "Gagal menghapus",
        description: e instanceof Error ? e.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // ─── Dynamic column visibility based on active category filter ─────────
  const activeCategory = filterCategory !== "all" ? filterCategory as ProductCategory : null;

  const hasColorInResults = products.some((p) => !!p.color);

  const colVisible = {
    category: !activeCategory,
    storage: !activeCategory || HAS_STORAGE_CATEGORIES.includes(activeCategory),
    size: !activeCategory || HAS_SIZE_CATEGORIES.includes(activeCategory),
    color: !activeCategory
      ? true
      : activeCategory === "airpods"
        ? false
        : activeCategory === "accessory"
          ? hasColorInResults
          : true,
    warranty: !activeCategory || activeCategory !== "accessory",
  };

  // Total column count for colSpan
  const visibleColCount =
    (canEditDelete ? 1 : 0) +
    Object.values(colVisible).filter(Boolean).length +
    3 + // Seri + Status + Aksi always visible
    2;  // Unit + Katalog columns

  // ─── Render helpers ───────────────────────────────────────

  const renderSkeleton = () =>
    Array.from({ length: 6 }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: visibleColCount }).map((_, j) => (
          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
        ))}
      </TableRow>
    ));

  return (
    <DashboardLayout pageTitle="Master Data Produk">
      <div className="pb-20">
      {/* ── Sticky block: headline + desktop filter ── */}
      <div ref={filterBarRef} className="sticky top-16 z-20 bg-background -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-border">

      {/* ── Page Header ── */}
      <div className="pt-3 pb-2">
        <PageHeader
          title="Master Data Produk"
          subtitle="Kelola varian produk berdasarkan kombinasi kategori, seri, storage, warna, dan tipe"
          actions={
            <>
              {canEditDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-warning text-warning-foreground hover:bg-warning-bg"
                  onClick={() => {
                    setBulkDeactivateMode("category");
                    setShowBulkDeactivate(true);
                  }}
                >
                  <PowerOff className="w-4 h-4" />
                  <span className="hidden sm:inline">Kelola Status Kategori</span>
                  <span className="sm:hidden">Status</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowWarrantyModal(true)}
              >
                <Tag className="w-4 h-4" />
                <span className="hidden sm:inline">Kelola Tipe</span>
                <span className="sm:hidden">Tipe</span>
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => { setEditProduct(null); setShowForm(true); }}
              >
                <Plus className="w-4 h-4" />
                Tambah Produk
              </Button>
            </>
          }
        />
      </div>

      {/* ── Filters ── */}
      {/* Desktop: inline filters + category cards (lg+) */}
      <div className="hidden lg:flex flex-wrap gap-3 pb-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari seri atau warna produk..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterWarranty} onValueChange={setFilterWarranty}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {warrantyOptionsForFilter.map((w) => (
                <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Nonaktif</SelectItem>
              <SelectItem value="all">Semua Status</SelectItem>
            </SelectContent>
          </Select>
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
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Unit Stok" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kondisi</SelectItem>
              <SelectItem value="has_unit">Ada Unit</SelectItem>
              <SelectItem value="no_unit">Belum Ada Unit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCatalog} onValueChange={setFilterCatalog}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Katalog" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kondisi</SelectItem>
              <SelectItem value="has_catalog">Sudah Ada Katalog</SelectItem>
              <SelectItem value="no_catalog">Belum Ada Katalog</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Desktop: Category Stats Cards inside sticky */}
      <div className="hidden lg:block pb-3">
        <CategoryStatsCards
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
        />
      </div>

      </div>{/* end sticky block */}

      {/* Mobile + Tablet: search + filter button */}
      <div className="flex lg:hidden gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari seri atau warna..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 gap-2 shrink-0 relative"
          onClick={() => setShowFilterSheet(true)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filter
          {(filterCategory !== "all" || filterWarranty !== "all" || filterStatus !== "active" || filterBranch !== "all" || filterUnit !== "all" || filterCatalog !== "all") && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {[filterCategory !== "all", filterWarranty !== "all", filterStatus !== "active", filterBranch !== "all", filterUnit !== "all", filterCatalog !== "all"].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile: Category Stats Cards (scrollable, non-sticky) */}
      <div className="lg:hidden">
        <CategoryStatsCards
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
        />
      </div>

      {/* ── Bulk Actions ── */}
      {!loading && !error && canEditDelete && selectedIds.size > 0 && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            {selectedIds.size} SKU dipilih
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-warning text-warning-foreground hover:bg-warning-bg"
              onClick={() => {
                setBulkDeactivateMode("selected");
                setShowBulkDeactivate(true);
              }}
            >
              <PowerOff className="w-3.5 h-3.5" />
              Nonaktifkan {selectedIds.size} SKU
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5"
              onClick={handleBulkDeleteClick}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus {selectedIds.size} SKU
            </Button>
          </div>
        </div>
      )}


      {/* ── Table ── */}
      {(() => {
        const isDefault = filterCategory === "all" && filterWarranty === "all" && filterStatus === "active" && filterBranch === "all" && filterUnit === "all" && filterCatalog === "all" && !debouncedSearch;
        const activeFilters: string[] = [];
        if (debouncedSearch) activeFilters.push(`"${debouncedSearch}"`);
        if (filterCategory !== "all") activeFilters.push(CATEGORY_LABELS[filterCategory as ProductCategory] ?? filterCategory);
        if (filterWarranty !== "all") activeFilters.push(getWarrantyLabel(filterWarranty));
        if (filterStatus !== "active") activeFilters.push(filterStatus === "inactive" ? "Nonaktif" : "Semua Status");
        if (filterBranch !== "all") activeFilters.push(branches.find(b => b.id === filterBranch)?.name ?? "Cabang");
        if (filterUnit !== "all") activeFilters.push(filterUnit === "has_unit" ? "Ada Unit" : "Belum Ada Unit");
        if (filterCatalog !== "all") activeFilters.push(filterCatalog === "has_catalog" ? "Sudah Ada Katalog" : "Belum Ada Katalog");
        const resetAll = () => {
          setSearch("");
          setFilterCategory("all");
          setFilterWarranty("all");
          setFilterStatus("active");
          setFilterBranch("all");
          setFilterUnit("all");
          setFilterCatalog("all");
        };
        const infoBar = (
          <>
            <span>Menampilkan</span>
            {isDefault ? (
              <>
                <span className="font-semibold text-foreground">produk aktif</span>
                <span>· tampilan default</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-foreground">{activeFilters.join(", ")}</span>
                <span>·</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs font-medium" onClick={resetAll}>
                  tampilkan default
                </Button>
              </>
            )}
          </>
        );
        const headerRow = (
          <>
            {canEditDelete && (
              <TableHead className="w-10 px-2 bg-muted">
                <Checkbox
                  checked={products.length > 0 && selectedIds.size === products.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Pilih semua"
                />
              </TableHead>
            )}
            {colVisible.category && <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 w-24">Kategori</TableHead>}
            <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Seri</TableHead>
            {colVisible.storage && <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 w-24 text-center">Storage</TableHead>}
            {colVisible.size && <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 w-24 text-center">Ukuran</TableHead>}
            {colVisible.color && <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Warna</TableHead>}
            {colVisible.warranty && <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Tipe</TableHead>}
            <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 w-20 text-center">Unit</TableHead>
            <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 w-24 text-center">Katalog</TableHead>
            <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 w-20 text-center">Status</TableHead>
            <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 w-32 text-center">Aksi</TableHead>
          </>
        );
        return (
          <AdminDataTable filterBarHeight={thTop} infoBar={infoBar} headerRow={headerRow}>
              {loading ? renderSkeleton() : error ? (
                <TableRow>
                  <TableCell colSpan={visibleColCount}>
                    <EmptyState
                      icon={AlertCircle}
                      title="Gagal memuat data"
                      description={error ?? undefined}
                      action={<Button size="sm" variant="outline" onClick={fetchProducts}>Coba Lagi</Button>}
                    />
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColCount}>
                    <EmptyState
                      icon={PackageOpen}
                      title={
                        debouncedSearch || filterCategory !== "all" || filterWarranty !== "all" || filterStatus !== "active"
                          ? "Tidak ada SKU yang cocok"
                          : "Belum ada master produk"
                      }
                      description={
                        debouncedSearch || filterCategory !== "all" || filterWarranty !== "all" || filterStatus !== "active"
                          ? "Coba ubah filter atau kata kunci pencarian"
                          : "Mulai dengan menambahkan produk pertama Anda"
                      }
                      action={
                        !debouncedSearch && filterCategory === "all" && filterWarranty === "all" && filterStatus === "active"
                          ? (
                            <Button size="sm" className="gap-1.5" onClick={() => { setEditProduct(null); setShowForm(true); }}>
                              <Plus className="w-3.5 h-3.5" />
                              Tambah Produk Pertama
                            </Button>
                          ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id} className={`border-b border-border hover:bg-muted/30 transition-colors ${selectedIds.has(p.id) ? "bg-muted/50" : ""}`}>
                    {canEditDelete && (
                      <TableCell className="px-2">
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                          aria-label={`Pilih ${p.series}`}
                        />
                      </TableCell>
                    )}
                    {colVisible.category && (
                      <TableCell>
                        <CategoryBadge category={p.category} />
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-sm">{p.series}</TableCell>
                    {colVisible.storage && <TableCell className="text-center text-sm">{formatStorage(p.storage_gb)}</TableCell>}
                    {colVisible.size && <TableCell className="text-center text-sm text-muted-foreground">{HAS_SIZE_CATEGORIES.includes(p.category) ? formatSize(p.size_mm) : "—"}</TableCell>}
                    {colVisible.color && <TableCell className="text-sm">{p.color || "—"}</TableCell>}
                    {colVisible.warranty && <TableCell className="text-sm font-medium text-foreground">{getWarrantyLabel(p.warranty_type)}</TableCell>}
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        (stockCounts.get(p.id) ?? 0) > 0
                          ? "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {stockCounts.get(p.id) ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {catalogSet.has(p.id) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700">
                          <CheckCircle className="w-3 h-3" />
                          Ya
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700">
                          <XCircle className="w-3 h-3" />
                          Tidak
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.is_active
                          ? "bg-[hsl(var(--status-active-bg))] text-[hsl(var(--status-active-fg))]"
                          : "bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))]"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? "bg-[hsl(var(--status-active))]" : "bg-[hsl(var(--status-inactive))]"}`} />
                        {p.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8"
                          title="Detail"
                          onClick={() => handleDetail(p)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {canEditDelete && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-8 h-8"
                              title="Edit"
                              onClick={() => handleEdit(p)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-8 h-8 text-destructive hover:text-destructive"
                              title="Hapus"
                              onClick={() => handleDeleteProduct(p)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
          </AdminDataTable>
        );
      })()}
      </div>

      {/* ── Pagination ── */}
      {!loading && totalCount > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="SKU"
        />
      )}

      {/* ── Modals ── */}
      <ProductFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null); }}
        onSuccess={fetchProducts}
        editProduct={editProduct}
        isUsedInStock={isUsedInStock}
        warrantyLabels={warrantyLabels}
      />

      <ProductDetailDrawer
        open={showDetail}
        onClose={() => { setShowDetail(false); setDetailProduct(null); }}
        product={detailProduct}
        warrantyLabelMap={warrantyLabelMap}
        filterBranch={filterBranch}
        branchName={branches.find(b => b.id === filterBranch)?.name}
      />

      <DeactivateModal
        open={showDeactivate}
        onClose={() => { setShowDeactivate(false); setDeactivateProduct(null); setCannotDeleteReason(null); }}
        onConfirm={handleConfirmDelete}
        product={deactivateProduct}
        loading={deactivateLoading || deleteCheckLoading}
        cannotDeleteReason={cannotDeleteReason}
      />

      <WarrantyLabelModal
        open={showWarrantyModal}
        onClose={() => {
          setShowWarrantyModal(false);
          fetchWarrantyLabels();
        }}
      />

      <BulkDeactivateModal
        open={showBulkDeactivate}
        onClose={() => setShowBulkDeactivate(false)}
        onSuccess={() => {
          setSelectedIds(new Set());
          fetchProducts();
        }}
        mode={bulkDeactivateMode}
        selectedIds={selectedIds}
      />

      {/* ── Bulk Delete Confirmation Dialog ── */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Hapus {selectedIds.size} SKU?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {bulkDeleteLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Memeriksa data terkait...</span>
                  </div>
                ) : bulkSkuDetails ? (
                  <>
                    {/* Safe SKUs */}
                    {bulkSkuDetails.safe.length > 0 && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {bulkSkuDetails.safe.length} SKU aman dihapus
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-0.5 max-h-28 overflow-y-auto">
                          {bulkSkuDetails.safe.map((p) => (
                            <li key={p.id}>• {CATEGORY_LABELS[p.category]} – {p.series} {formatStorage(p.storage_gb)} {p.color}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Unsafe SKUs */}
                    {bulkSkuDetails.unsafe.length > 0 && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                        <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {bulkSkuDetails.unsafe.length} SKU memiliki data terkait
                        </p>
                        <ul className="text-xs space-y-2 max-h-40 overflow-y-auto">
                          {bulkSkuDetails.unsafe.map((u) => (
                            <li key={u.product.id} className="border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                              <span className="font-medium text-foreground">
                                {CATEGORY_LABELS[u.product.category]} – {u.product.series} {formatStorage(u.product.storage_gb)} {u.product.color}
                              </span>
                              <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                                {u.stockCount > 0 && <span>📦 {u.stockCount} unit stok</span>}
                                {u.catalogCount > 0 && <span>📋 {u.catalogCount} katalog</span>}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-destructive font-medium pt-1">
                          Menghapus SKU ini akan menghapus semua data relasi (stok IMEI & katalog).
                        </p>
                      </div>
                    )}

                    {/* Mode selection if there are both safe and unsafe */}
                    {bulkSkuDetails.safe.length > 0 && bulkSkuDetails.unsafe.length > 0 && (
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pilih aksi:</p>
                        <div className="space-y-2">
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="bulk-mode"
                              checked={bulkDeleteMode === "safe_only"}
                              onChange={() => setBulkDeleteMode("safe_only")}
                              className="mt-0.5 accent-primary"
                            />
                            <div>
                              <p className="text-sm font-medium text-foreground">Hapus {bulkSkuDetails.safe.length} SKU yang aman saja</p>
                              <p className="text-xs text-muted-foreground">SKU yang memiliki data terkait akan dilewati</p>
                            </div>
                          </label>
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="bulk-mode"
                              checked={bulkDeleteMode === "all"}
                              onChange={() => setBulkDeleteMode("all")}
                              className="mt-0.5 accent-destructive"
                            />
                            <div>
                              <p className="text-sm font-medium text-destructive">Hapus semua {selectedIds.size} SKU beserta data relasi</p>
                              <p className="text-xs text-muted-foreground">Data stok IMEI & katalog terkait akan ikut terhapus</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Tindakan ini tidak dapat dibatalkan.
                    </p>
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeleteLoading || !bulkSkuDetails || (bulkDeleteMode === "safe_only" && bulkSkuDetails.safe.length === 0)}
              onClick={handleConfirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {bulkSkuDetails && bulkSkuDetails.unsafe.length > 0 && bulkDeleteMode === "safe_only"
                ? `Hapus ${bulkSkuDetails.safe.length} SKU Aman`
                : `Hapus ${selectedIds.size} SKU`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Mobile Filter Bottom Sheet ── */}
      <Sheet open={showFilterSheet} onOpenChange={setShowFilterSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-8 pt-4">
          <SheetHeader className="mb-5">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold">Filter Produk</SheetTitle>
              {/* Active filter count + reset */}
              {(filterCategory !== "all" || filterWarranty !== "all" || filterStatus !== "active" || filterBranch !== "all" || filterUnit !== "all" || filterCatalog !== "all") && (
                <button
                  className="flex items-center gap-1 text-xs text-destructive font-medium hover:opacity-70 transition-opacity"
                  onClick={() => {
                    setFilterCategory("all");
                    setFilterWarranty("all");
                    setFilterStatus("active");
                    setFilterBranch("all");
                    setFilterUnit("all");
                    setFilterCatalog("all");
                  }}
                >
                  <X className="w-3 h-3" />
                  Reset filter
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="space-y-4">
            {/* Tipe (Kategori removed - card overview handles it) */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tipe</p>
              <div className="flex flex-wrap gap-2">
                {[{ key: "all", label: "Semua" }, ...warrantyOptionsForFilter].map((w) => (
                  <button
                    key={w.key}
                    onClick={() => setFilterWarranty(w.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      filterWarranty === w.key
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</p>
              <div className="flex gap-2">
                {[
                  { value: "active", label: "Aktif" },
                  { value: "inactive", label: "Nonaktif" },
                  { value: "all", label: "Semua" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilterStatus(value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      filterStatus === value
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cabang */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cabang (Stok)</p>
              <div className="flex flex-wrap gap-2">
                {[{ id: "all", name: "Semua" }, ...branches].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setFilterBranch(b.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      filterBranch === b.id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Unit Stok */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Unit Stok</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Semua Kondisi" },
                  { value: "has_unit", label: "Ada Unit" },
                  { value: "no_unit", label: "Belum Ada Unit" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilterUnit(value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      filterUnit === value
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Katalog */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Katalog</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Semua Kondisi" },
                  { value: "has_catalog", label: "Sudah Ada Katalog" },
                  { value: "no_catalog", label: "Belum Ada Katalog" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilterCatalog(value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      filterCatalog === value
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full mt-2"
              onClick={() => setShowFilterSheet(false)}
            >
              Terapkan Filter
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
