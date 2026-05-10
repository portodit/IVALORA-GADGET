import { useState, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, PowerOff, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { CATEGORY_LABELS, type ProductCategory } from "@/lib/admin/produk/master-products";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "selected" | "category";
type Action = "deactivate" | "activate";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: Mode;
  selectedIds: Set<string>;
}

interface CategoryCount {
  category: ProductCategory;
  count: number;
}

export function BulkDeactivateModal({ open, onClose, onSuccess, mode, selectedIds }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingImpact, setCheckingImpact] = useState(false);
  const [action, setAction] = useState<Action>("deactivate");

  // For category mode
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Impact info
  const [impactInfo, setImpactInfo] = useState<{
    skuCount: number;
    catalogCount: number;
  } | null>(null);

  // Fetch category counts for "category" mode
  useEffect(() => {
    if (!open || mode !== "category") return;
    setCheckingImpact(true);
    const isActive = action === "deactivate";
    supabase
      .from("master_products")
      .select("category")
      .eq("is_active", isActive)
      .is("deleted_at", null)
      .then(({ data }) => {
        const counts = new Map<string, number>();
        (data ?? []).forEach((r: any) => {
          counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
        });
        setCategoryCounts(
          Array.from(counts.entries())
            .map(([category, count]) => ({ category: category as ProductCategory, count }))
            .sort((a, b) => a.category.localeCompare(b.category))
        );
        setCheckingImpact(false);
      });
  }, [open, mode, action]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedCategories(new Set());
      setImpactInfo(null);
      setAction("deactivate");
    }
  }, [open]);

  // Check impact when selection changes
  const checkImpact = useCallback(async () => {
    setCheckingImpact(true);
    try {
      let productIds: string[] = [];
      const isActive = action === "deactivate";

      if (mode === "selected") {
        productIds = Array.from(selectedIds);
      } else {
        if (selectedCategories.size === 0) {
          setImpactInfo(null);
          setCheckingImpact(false);
          return;
        }
        const cats = Array.from(selectedCategories) as ProductCategory[];
        const { data } = await supabase
          .from("master_products")
          .select("id")
          .eq("is_active", isActive)
          .is("deleted_at", null)
          .in("category", cats);
        productIds = (data ?? []).map((r: any) => r.id);
      }

      if (productIds.length === 0) {
        setImpactInfo({ skuCount: 0, catalogCount: 0 });
        setCheckingImpact(false);
        return;
      }

      if (action === "deactivate") {
        const { count: catalogCount } = await supabase
          .from("catalog_products")
          .select("id", { count: "exact", head: true })
          .in("product_id", productIds)
          .eq("catalog_status", "published");

        setImpactInfo({
          skuCount: productIds.length,
          catalogCount: catalogCount ?? 0,
        });
      } else {
        setImpactInfo({
          skuCount: productIds.length,
          catalogCount: 0,
        });
      }
    } catch {
      setImpactInfo(null);
    } finally {
      setCheckingImpact(false);
    }
  }, [mode, selectedIds, selectedCategories, action]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(checkImpact, 300);
    return () => clearTimeout(timer);
  }, [open, checkImpact]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      let productIds: string[] = [];
      const isActive = action === "deactivate";

      if (mode === "selected") {
        productIds = Array.from(selectedIds);
      } else {
        const cats = Array.from(selectedCategories) as ProductCategory[];
        const { data } = await supabase
          .from("master_products")
          .select("id")
          .eq("is_active", isActive)
          .is("deleted_at", null)
          .in("category", cats);
        productIds = (data ?? []).map((r: any) => r.id);
      }

      if (productIds.length === 0) {
        toast({ title: `Tidak ada SKU yang perlu di${action === "deactivate" ? "nonaktifkan" : "aktifkan"}`, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (action === "deactivate") {
        // Deactivate master products
        const { error: mpError } = await supabase
          .from("master_products")
          .update({ is_active: false })
          .in("id", productIds);
        if (mpError) throw mpError;

        // Auto-archive related catalog products
        const { error: catError } = await supabase
          .from("catalog_products")
          .update({ catalog_status: "archived" as any })
          .in("product_id", productIds);
        if (catError) throw catError;

        toast({
          title: `${productIds.length} SKU berhasil dinonaktifkan`,
          description: impactInfo?.catalogCount
            ? `${impactInfo.catalogCount} katalog terkait juga dinonaktifkan`
            : undefined,
        });
      } else {
        // Activate master products
        const { error: mpError } = await supabase
          .from("master_products")
          .update({ is_active: true })
          .in("id", productIds);
        if (mpError) throw mpError;

        toast({
          title: `${productIds.length} SKU berhasil diaktifkan kembali`,
        });
      }

      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast({
        title: `Gagal ${action === "deactivate" ? "menonaktifkan" : "mengaktifkan"}`,
        description: e instanceof Error ? e.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canConfirm = mode === "selected"
    ? selectedIds.size > 0
    : selectedCategories.size > 0;

  const isDeactivate = action === "deactivate";

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isDeactivate ? (
              <PowerOff className="w-5 h-5 text-amber-600" />
            ) : (
              <Power className="w-5 h-5 text-emerald-600" />
            )}
            {mode === "selected"
              ? `${isDeactivate ? "Nonaktifkan" : "Aktifkan"} ${selectedIds.size} SKU Terpilih?`
              : "Kelola Status SKU per Kategori"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {mode === "category" && (
                <Tabs value={action} onValueChange={(v) => { setAction(v as Action); setSelectedCategories(new Set()); }}>
                  <TabsList className="w-full">
                    <TabsTrigger value="deactivate" className="flex-1 gap-1.5">
                      <PowerOff className="w-3.5 h-3.5" />
                      Nonaktifkan
                    </TabsTrigger>
                    <TabsTrigger value="activate" className="flex-1 gap-1.5">
                      <Power className="w-3.5 h-3.5" />
                      Aktifkan
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              <p className="text-sm">
                {isDeactivate ? (
                  <>
                    SKU yang dinonaktifkan tidak akan muncul saat menambah stok IMEI baru, POS, atau pencarian produk.
                    Data stok IMEI yang sudah ada <span className="font-semibold text-foreground">tetap dipertahankan</span>.
                  </>
                ) : (
                  <>
                    SKU yang diaktifkan akan kembali muncul di form tambah stok, POS, dan pencarian produk.
                  </>
                )}
              </p>

              {mode === "category" && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pilih kategori yang akan {isDeactivate ? "dinonaktifkan" : "diaktifkan"}:
                  </p>
                  {categoryCounts.length === 0 && !checkingImpact ? (
                    <p className="text-sm text-muted-foreground">
                      {isDeactivate ? "Semua SKU sudah nonaktif" : "Tidak ada SKU nonaktif untuk diaktifkan"}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {categoryCounts.map((cc) => (
                        <label
                          key={cc.category}
                          className="flex items-center gap-3 cursor-pointer py-1"
                        >
                          <Checkbox
                            checked={selectedCategories.has(cc.category)}
                            onCheckedChange={() => toggleCategory(cc.category)}
                          />
                          <span className="text-sm font-medium flex-1">
                            {CATEGORY_LABELS[cc.category]}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {cc.count} SKU {isDeactivate ? "aktif" : "nonaktif"}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Impact info */}
              {checkingImpact ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Memeriksa dampak...</span>
                </div>
              ) : impactInfo && impactInfo.skuCount > 0 ? (
                <div className={`rounded-lg border p-3 space-y-1.5 ${
                  isDeactivate 
                    ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30" 
                    : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"
                }`}>
                  <p className={`text-sm font-medium flex items-center gap-1.5 ${
                    isDeactivate 
                      ? "text-amber-800 dark:text-amber-300" 
                      : "text-emerald-800 dark:text-emerald-300"
                  }`}>
                    {isDeactivate ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Power className="w-4 h-4 shrink-0" />}
                    {isDeactivate ? "Dampak penonaktifan:" : "Dampak pengaktifan:"}
                  </p>
                  <ul className={`text-xs space-y-0.5 ml-5 ${
                    isDeactivate 
                      ? "text-amber-700 dark:text-amber-400" 
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}>
                    <li>• <span className="font-semibold">{impactInfo.skuCount}</span> SKU akan {isDeactivate ? "dinonaktifkan" : "diaktifkan"}</li>
                    {isDeactivate && impactInfo.catalogCount > 0 && (
                      <li>• <span className="font-semibold">{impactInfo.catalogCount}</span> katalog produk akan otomatis diarsipkan</li>
                    )}
                    {isDeactivate && (
                      <>
                        <li>• Stok IMEI yang sudah ada tetap dipertahankan</li>
                        <li>• Tidak muncul di POS & form tambah stok</li>
                      </>
                    )}
                    {!isDeactivate && (
                      <li>• Akan kembali muncul di POS & form tambah stok</li>
                    )}
                  </ul>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                {isDeactivate 
                  ? "SKU bisa diaktifkan kembali kapan saja melalui tab \"Aktifkan\" di modal ini."
                  : "SKU yang diaktifkan bisa dinonaktifkan kembali kapan saja."}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || !canConfirm || checkingImpact}
            onClick={handleConfirm}
            className={isDeactivate 
              ? "bg-amber-600 hover:bg-amber-700 text-white" 
              : "bg-emerald-600 hover:bg-emerald-700 text-white"}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : isDeactivate ? (
              <PowerOff className="w-4 h-4 mr-2" />
            ) : (
              <Power className="w-4 h-4 mr-2" />
            )}
            {isDeactivate ? "Nonaktifkan" : "Aktifkan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
