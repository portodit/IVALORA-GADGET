import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ArrowLeft, TrendingUp, Package2, CalendarDays, Banknote, History, Plus, Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useToast } from "@/hooks/shared/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/admin/produk/stock-units";

const MOVEMENT_LABELS: Record<string, {
  label: string;
  badgeCls: string;
  dotCls: string;
  isOut: boolean;
}> = {
  purchase:    { label: "Masuk Stok",       badgeCls: "bg-emerald-100 border-emerald-300 text-emerald-700", dotCls: "bg-emerald-500", isOut: false },
  bonus_sale:  { label: "Bonus",            badgeCls: "bg-violet-100 border-violet-300 text-violet-700",   dotCls: "bg-violet-500",  isOut: true  },
  direct_sale: { label: "Penjualan Satuan", badgeCls: "bg-orange-100 border-orange-300 text-orange-700",   dotCls: "bg-orange-500",  isOut: true  },
  adjustment:  { label: "Penyesuaian",      badgeCls: "bg-blue-100 border-blue-300 text-blue-700",         dotCls: "bg-blue-500",    isOut: false },
};

interface LedgerEntry {
  id: string;
  qty: number;
  movement_type: string;
  transaction_date: string;
  notes: string | null;
  created_at: string;
  unit_price: number | null;
  runningBalance: number;
}

interface ProductInfo {
  name: string;
  base_price: number | null;
  qty_remaining: number;
}

export default function AksesorisDetailPage() {
  const { id: masterId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = role === "super_admin";

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Add stock modal
  const [addOpen, setAddOpen] = useState(false);
  const [addQty, setAddQty] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addDate, setAddDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [addNotes, setAddNotes] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!masterId) return;
    setLoading(true);
    const [masterRes, summaryRes, ledgerRes] = await Promise.all([
      supabase.from("master_products").select("series, base_price").eq("id", masterId).single(),
      supabase.from("accessory_stock_summary").select("qty_remaining").eq("master_product_id", masterId).single(),
      supabase.from("accessory_stock_ledger")
        .select("id, qty, movement_type, transaction_date, notes, created_at, unit_price")
        .eq("master_product_id", masterId)
        .order("transaction_date", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const rawLedger = (ledgerRes.data as any[]) ?? [];

    // Compute running balance (oldest → newest)
    let running = 0;
    const withBalance = rawLedger.map((e: any) => {
      running += e.qty;
      return { ...e, runningBalance: running };
    });

    // Display: newest first
    withBalance.reverse();

    setProduct({
      name: (masterRes.data as any)?.series ?? "Produk",
      base_price: (masterRes.data as any)?.base_price ?? null,
      qty_remaining: (summaryRes.data as any)?.qty_remaining ?? 0,
    });
    setLedger(withBalance);
    setLoading(false);
  }, [masterId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddStock = async () => {
    if (!masterId || !addQty || Number(addQty) <= 0) return;
    setAddSubmitting(true);
    const { error } = await supabase.from("accessory_stock_ledger").insert({
      master_product_id: masterId,
      qty: Number(addQty),
      movement_type: "purchase",
      transaction_date: addDate,
      notes: addNotes.trim() || null,
      unit_price: addPrice && Number(addPrice) > 0 ? Number(addPrice) : null,
    });
    setAddSubmitting(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Stok berhasil ditambahkan" });
    setAddOpen(false);
    setAddQty("");
    setAddPrice("");
    setAddNotes("");
    setAddDate(format(new Date(), "yyyy-MM-dd"));
    fetchData();
  };

  const latestPurchase = [...ledger].reverse().find(e => e.movement_type === "purchase");
  const basePrice = product?.base_price ?? null;

  // Per-entry value: harga & total nilai transaksi
  const getEntryValue = (entry: LedgerEntry): {
    harga: number | null;
    total: number | null;
    hargaLabel: string;
    totalLabel: string;
    cls: string;
    isFree?: boolean;
  } => {
    const absQty = Math.abs(entry.qty);
    if (entry.movement_type === "bonus_sale") {
      return { harga: 0, total: 0, hargaLabel: "—", totalLabel: "Rp 0", cls: "text-violet-600", isFree: true };
    }
    if (entry.movement_type === "purchase") {
      const px = entry.unit_price ?? basePrice;
      if (!px) return { harga: null, total: null, hargaLabel: "—", totalLabel: "—", cls: "text-muted-foreground" };
      return {
        harga: px, total: absQty * px,
        hargaLabel: formatCurrency(px),
        totalLabel: formatCurrency(absQty * px),
        cls: "text-emerald-700",
      };
    }
    if (entry.movement_type === "direct_sale") {
      const px = basePrice;
      if (!px) return { harga: null, total: null, hargaLabel: "—", totalLabel: "—", cls: "text-muted-foreground" };
      return {
        harga: px, total: absQty * px,
        hargaLabel: formatCurrency(px),
        totalLabel: formatCurrency(absQty * px),
        cls: "text-orange-700",
      };
    }
    return { harga: null, total: null, hargaLabel: "—", totalLabel: "—", cls: "text-muted-foreground" };
  };

  // Daftar Harga: group purchase entries by unit_price
  const priceBreakdown = useMemo(() => {
    const purchaseEntries = [...ledger].filter(e => e.movement_type === "purchase" && e.unit_price != null);
    const map: Record<number, number> = {};
    purchaseEntries.forEach(e => {
      const px = e.unit_price!;
      map[px] = (map[px] ?? 0) + e.qty;
    });
    return Object.entries(map)
      .map(([px, qty]) => ({ price: Number(px), qty, total: Number(px) * qty }))
      .sort((a, b) => a.price - b.price);
  }, [ledger]);

  const qtyStatus = product
    ? product.qty_remaining === 0 ? "habis"
    : product.qty_remaining <= 5 ? "sedikit"
    : "ok"
    : "ok";

  return (
    <DashboardLayout pageTitle="Detail Aksesoris">
      <div className="space-y-4 pb-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => navigate("/admin/stok-produk?tab=accessory")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              {loading ? (
                <>
                  <Skeleton className="h-6 w-44 mb-1.5" />
                  <Skeleton className="h-3.5 w-32" />
                </>
              ) : (
                <>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight">{product?.name ?? "—"}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Detail stok &amp; riwayat pergerakan aksesoris</p>
                </>
              )}
            </div>
          </div>
          {isSuperAdmin && !loading && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Tambah Stok
            </Button>
          )}
        </div>

        {/* ── Stat Cards ── */}
        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[86px] rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Stok Sisa */}
            <div className={cn(
              "rounded-xl border bg-card px-3 sm:px-4 py-3.5 flex flex-col gap-1",
              qtyStatus === "habis" ? "border-red-200" : qtyStatus === "sedikit" ? "border-amber-200" : "border-border"
            )}>
              <div className="flex items-center gap-1.5">
                <Package2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Stok Sisa</span>
              </div>
              <p className={cn("text-2xl sm:text-3xl font-bold leading-none mt-1",
                qtyStatus === "habis" ? "text-red-600" : qtyStatus === "sedikit" ? "text-amber-600" : "text-emerald-600"
              )}>{product!.qty_remaining}</p>
              <p className="text-[11px] text-muted-foreground">unit tersisa</p>
            </div>

            {/* Harga */}
            <div className="rounded-xl border border-border bg-card px-3 sm:px-4 py-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Harga</span>
              </div>
              {product!.base_price ? (
                <>
                  <p className="text-sm sm:text-base font-bold text-foreground leading-tight mt-1 break-words">
                    {formatCurrency(product!.base_price)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">per unit</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Belum diset</p>
              )}
            </div>

            {/* Masuk Terkini */}
            <div className="rounded-xl border border-border bg-card px-3 sm:px-4 py-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Masuk Terkini</span>
              </div>
              {latestPurchase?.transaction_date ? (
                <>
                  <p className="text-sm sm:text-base font-bold text-foreground leading-tight mt-1">
                    {format(new Date(latestPurchase.transaction_date), "d MMM yyyy", { locale: localeId })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">terakhir restok</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Belum ada</p>
              )}
            </div>
          </div>
        )}

        {/* ── Daftar Harga Beli (price breakdown) ── */}
        {!loading && priceBreakdown.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">Daftar Harga Beli</span>
              <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {priceBreakdown.length} tier harga
              </span>
            </div>
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px_100px] gap-3 px-4 py-2 bg-muted/20 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Harga Beli/Unit</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Total Nilai</span>
              <span className="text-right hidden sm:block">% dari Total</span>
            </div>
            {(() => {
              const grandTotal = priceBreakdown.reduce((s, r) => s + r.total, 0);
              const grandQty   = priceBreakdown.reduce((s, r) => s + r.qty, 0);
              return (
                <>
                  {priceBreakdown.map((row) => (
                    <div key={row.price} className="grid grid-cols-[1fr_80px_80px_100px] gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 items-center hover:bg-muted/10">
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(row.price)}</span>
                      <span className="text-sm font-bold text-center text-foreground">{row.qty} unit</span>
                      <span className="text-sm font-medium text-right text-emerald-700">{formatCurrency(row.total)}</span>
                      <span className="text-xs font-medium text-right text-muted-foreground hidden sm:block">
                        {grandQty > 0 ? Math.round((row.qty / grandQty) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                  {priceBreakdown.length > 1 && (
                    <div className="grid grid-cols-[1fr_80px_80px_100px] gap-3 px-4 py-2.5 bg-muted/30 items-center">
                      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total</span>
                      <span className="text-sm font-bold text-center">{grandQty} unit</span>
                      <span className="text-sm font-bold text-right text-emerald-700">{formatCurrency(grandTotal)}</span>
                      <span className="hidden sm:block" />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── Ledger Table ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">Riwayat Pergerakan Stok</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{ledger.length} catatan</span>
          </div>

          {loading ? (
            <div className="divide-y divide-border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-4 py-4 flex items-start gap-4">
                  <Skeleton className="h-4 w-20 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3.5 w-48" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : ledger.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <Package2 className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Belum ada catatan pergerakan stok</p>
              <p className="text-xs text-muted-foreground mt-1">Mulai dengan menambahkan stok pertama</p>
              {isSuperAdmin && (
                <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setAddOpen(true)}>
                  <TrendingUp className="w-3.5 h-3.5" /> Tambah Stok Pertama
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Column headers — desktop only */}
              <div className="hidden sm:grid grid-cols-[110px_1fr_140px_140px_56px_56px] gap-3 px-4 py-2 bg-muted/20 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Tanggal</span>
                <span>Keterangan</span>
                <span className="text-right">Harga/Unit</span>
                <span className="text-right">Nilai Transaksi</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Saldo</span>
              </div>

              <div className="divide-y divide-border">
                {ledger.map((entry) => {
                  const info = MOVEMENT_LABELS[entry.movement_type] ?? {
                    label: entry.movement_type, badgeCls: "bg-muted border-border text-foreground", dotCls: "bg-muted-foreground", isOut: false,
                  };
                  const isIn = entry.qty > 0;
                  const ev = getEntryValue(entry);

                  return (
                    <div key={entry.id} className="hover:bg-muted/20 transition-colors">

                      {/* ── Desktop row ── */}
                      <div className="hidden sm:grid grid-cols-[110px_1fr_140px_140px_56px_56px] gap-3 px-4 py-3 items-start">
                        {/* Date */}
                        <div className="pt-0.5">
                          <p className="text-xs font-semibold text-foreground">
                            {entry.transaction_date
                              ? format(new Date(entry.transaction_date), "d MMM yyyy", { locale: localeId })
                              : "—"}
                          </p>
                        </div>

                        {/* Label + notes */}
                        <div className="min-w-0 space-y-1">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border",
                            info.badgeCls
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", info.dotCls)} />
                            {info.label}
                          </span>
                          {entry.notes && (
                            <p className="text-[11px] text-muted-foreground leading-snug">{entry.notes}</p>
                          )}
                        </div>

                        {/* Harga/Unit */}
                        <div className="text-right pt-0.5">
                          <span className={cn("text-xs font-semibold", ev.cls)}>
                            {ev.hargaLabel}
                          </span>
                          {entry.movement_type === "purchase" && entry.unit_price == null && basePrice != null && (
                            <p className="text-[10px] text-muted-foreground">dari base price</p>
                          )}
                        </div>

                        {/* Nilai Transaksi */}
                        <div className="text-right pt-0.5">
                          <span className={cn("text-xs font-semibold", ev.cls)}>
                            {ev.totalLabel}
                          </span>
                          {ev.isFree && (
                            <p className="text-[10px] text-violet-500">gratis/bonus</p>
                          )}
                        </div>

                        {/* Qty */}
                        <div className="text-center pt-0.5">
                          <span className={cn("text-sm font-bold", isIn ? "text-emerald-600" : "text-red-600")}>
                            {isIn ? "+" : ""}{entry.qty}
                          </span>
                        </div>

                        {/* Saldo */}
                        <div className="text-right pt-0.5">
                          <span className="text-sm font-bold text-foreground">{entry.runningBalance}</span>
                          <p className="text-[10px] text-muted-foreground">unit</p>
                        </div>
                      </div>

                      {/* ── Mobile card ── */}
                      <div className="sm:hidden px-4 py-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border",
                              info.badgeCls
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", info.dotCls)} />
                              {info.label}
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              {entry.transaction_date
                                ? format(new Date(entry.transaction_date), "d MMM yyyy", { locale: localeId })
                                : "—"}
                            </p>
                          </div>
                          {/* Qty + Saldo on right */}
                          <div className="text-right shrink-0">
                            <p className={cn("text-base font-bold", isIn ? "text-emerald-600" : "text-red-600")}>
                              {isIn ? "+" : ""}{entry.qty}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">saldo</span>
                              <span className="text-xs font-bold text-foreground">{entry.runningBalance}</span>
                            </div>
                          </div>
                        </div>
                        {/* Harga + Nilai */}
                        {(ev.harga != null || ev.isFree) && (
                          <div className="flex items-center gap-3 text-[11px]">
                            {!ev.isFree && (
                              <span className={cn("font-medium", ev.cls)}>
                                {ev.hargaLabel}/unit
                              </span>
                            )}
                            <span className={cn("font-semibold", ev.cls)}>
                              Total: {ev.totalLabel}
                            </span>
                            {ev.isFree && <span className="text-violet-500">gratis/bonus</span>}
                          </div>
                        )}
                        {entry.notes && (
                          <p className="text-[11px] text-muted-foreground leading-snug">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Add Stock Modal ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Stok Masuk</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <p className="text-xs text-muted-foreground">
              Produk: <span className="font-semibold text-foreground">{product?.name}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Jumlah Unit</label>
                <Input
                  type="number" min="1" placeholder="0"
                  value={addQty} onChange={e => setAddQty(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Harga Beli/Unit</label>
                <Input
                  type="number" min="0" placeholder="Rp 0"
                  value={addPrice} onChange={e => setAddPrice(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {addQty && addPrice && Number(addQty) > 0 && Number(addPrice) > 0 && (
              <p className="text-xs text-emerald-700 font-medium">
                Total nilai masuk: {formatCurrency(Number(addQty) * Number(addPrice))}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tanggal Masuk</label>
              <Input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Catatan (opsional)</label>
              <Input placeholder="Supplier, batch, dll." value={addNotes} onChange={e => setAddNotes(e.target.value)} className="h-9" />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
            <Button
              onClick={handleAddStock}
              disabled={!addQty || Number(addQty) <= 0 || addSubmitting}
              className="gap-1.5"
            >
              {addSubmitting
                ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <TrendingUp className="w-3.5 h-3.5" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
