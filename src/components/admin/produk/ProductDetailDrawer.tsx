import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  MasterProduct,
  CATEGORY_LABELS,
  HAS_SIZE_CATEGORIES,
  formatStorage,
  formatSize,
} from "@/lib/admin/produk/master-products";
import { Package, ShoppingCart, CalendarDays, Cpu, Palette, HardDrive, ShieldCheck, Layers, Ruler } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  product: MasterProduct | null;
  warrantyLabelMap?: Record<string, string>;
  filterBranch?: string;
  branchName?: string;
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, icon: Icon, color }: { label: string; value: number; loading?: boolean; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${color} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <Skeleton className="h-6 w-10 mb-0.5" />
        ) : (
          <div className="text-xl font-bold text-foreground leading-none">{value}</div>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function ProductDetailDrawer({ open, onClose, product, warrantyLabelMap, filterBranch, branchName }: Props) {
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [available, setAvailable] = useState(0);
  const [sold, setSold] = useState(0);

  useEffect(() => {
    if (!open || !product) return;
    setLoadingSummary(true);
    setAvailable(0);
    setSold(0);

    const buildQuery = (status: string) => {
      let q = supabase
        .from("stock_units")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id)
        .eq("stock_status", status);
      if (filterBranch && filterBranch !== "all") {
        q = q.eq("branch_id", filterBranch);
      }
      return q;
    };

    Promise.all([buildQuery("available"), buildQuery("sold")]).then(([availRes, soldRes]) => {
      setAvailable(availRes.count ?? 0);
      setSold(soldRes.count ?? 0);
      setLoadingSummary(false);
    });
  }, [open, product, filterBranch]);

  if (!product) return null;

  const storageLabel = formatStorage(product.storage_gb);
  const sizeLabel = formatSize(product.size_mm);
  const colorLabel = product.color || "—";
  const branchLabel = !filterBranch || filterBranch === "all" ? "Semua Cabang" : (branchName || "Cabang Terpilih");
  const showSize = HAS_SIZE_CATEGORIES.includes(product.category);

  const warrantyLabel = product.warranty_type
    ? (warrantyLabelMap?.[product.warranty_type] ?? product.warranty_type)
    : "—";

  const subtitleParts: string[] = [];
  if (product.storage_gb) subtitleParts.push(storageLabel);
  if (showSize && product.size_mm) subtitleParts.push(sizeLabel);
  if (product.color) subtitleParts.push(colorLabel);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[420px] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-muted/30">
          <SheetHeader className="mb-0">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-bold leading-tight truncate">{product.series}</SheetTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {subtitleParts.length > 0 ? subtitleParts.join(" · ") : CATEGORY_LABELS[product.category]}
                </p>
              </div>
              <Badge
                variant={product.is_active ? "default" : "secondary"}
                className="shrink-0 mt-0.5"
              >
                {product.is_active ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
          </SheetHeader>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Info SKU */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Informasi SKU</h3>
            <div className="rounded-xl border border-border bg-card p-3 divide-y divide-border">
              <InfoItem icon={Layers} label="Kategori" value={CATEGORY_LABELS[product.category]} />
              <InfoItem icon={Cpu} label="Seri" value={product.series} />
              {product.storage_gb && (
                <InfoItem icon={HardDrive} label="Storage" value={storageLabel} />
              )}
              {showSize && (
                <InfoItem icon={Ruler} label="Ukuran Case" value={sizeLabel} />
              )}
              {product.color && (
                <InfoItem icon={Palette} label="Warna" value={colorLabel} />
              )}
              {product.warranty_type && (
                <InfoItem icon={ShieldCheck} label="Tipe Garansi" value={warrantyLabel} />
              )}
              <InfoItem
                icon={CalendarDays}
                label="Tanggal Dibuat"
                value={new Date(product.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              />
            </div>
          </div>

          {/* Ringkasan Stok */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ringkasan Stok</h3>
              <Badge variant="outline" className="text-xs font-medium w-fit">{branchLabel}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Tersedia"
                value={available}
                loading={loadingSummary}
                icon={Package}
                color="bg-emerald-500/10 text-emerald-600"
              />
              <StatCard
                label="Terjual"
                value={sold}
                loading={loadingSummary}
                icon={ShoppingCart}
                color="bg-blue-500/10 text-blue-600"
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
