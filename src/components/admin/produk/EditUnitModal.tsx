import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, AlertCircle, Search, Plus, Check, X, Package, User, Pencil, Barcode } from "lucide-react";
import type { StockUnit, ConditionStatus, SoldChannel } from "@/lib/admin/produk/stock-units";
import { getTrackingType, ECOMMERCE_CHANNELS } from "@/lib/admin/produk/stock-units";
import { useStatusLabels } from "@/hooks/admin/use-status-labels";
import { MasterProduct, CATEGORY_LABELS, WARRANTY_LABELS } from "@/lib/admin/produk/master-products";
import { cn } from "@/lib/utils";
import { QuickEcommerceSaleModal } from "./QuickEcommerceSaleModal";

interface Branch { id: string; name: string; city: string | null }
interface Supplier { id: string; name: string; }

interface EditUnitModalProps {
  unit: StockUnit | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const getProductLabel = (p: MasterProduct) => {
  const parts = [p.series];
  if (p.storage_gb) parts.push(p.storage_gb >= 1024 ? `${p.storage_gb / 1024}TB` : `${p.storage_gb}GB`);
  if (p.color && p.color !== "—") parts.push(p.color);
  if (p.warranty_type) parts.push(`(${WARRANTY_LABELS[p.warranty_type as any] || p.warranty_type})`);
  return parts.join(" ");
};

export function EditUnitModal({ unit, open, onClose, onSuccess }: EditUnitModalProps) {
  const { toast } = useToast();
  const { statusLabels } = useStatusLabels();
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // SKU selection
  const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);

  // Supplier selection
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);

  // IMEI state
  const [imei, setImei] = useState("");
  const [imeiError, setImeiError] = useState<string | null>(null);
  const [imeiChecking, setImeiChecking] = useState(false);

  // Serial Number state
  const [serialNumber, setSerialNumber] = useState("");
  const [snError, setSnError] = useState<string | null>(null);
  const [snChecking, setSnChecking] = useState(false);

  // Qty state
  const [qtyAvailable, setQtyAvailable] = useState("");

  // Shared fields
  const [branchId, setBranchId] = useState<string>("");
  const [stockStatus, setStockStatus] = useState<string>("available");
  const [sellingPrice, setSellingPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus>("no_minus");
  const [minusDescription, setMinusDescription] = useState("");
  const [soldChannel, setSoldChannel] = useState<SoldChannel | "">("");
  const [soldReferenceId, setSoldReferenceId] = useState("");
  const [notes, setNotes] = useState("");

  // QuickEcommerceSaleModal state
  const [ecommerceModalOpen, setEcommerceModalOpen] = useState(false);
  const [pendingUnit, setPendingUnit] = useState<StockUnit | null>(null);

  const trackingType = selectedProduct ? getTrackingType(selectedProduct.category as any) : null;

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("branches").select("id, name, city").eq("is_active", true).order("name"),
      supabase.from("master_products").select("*").eq("is_active", true).is("deleted_at", null).order("series"),
      supabase.from("suppliers").select("*").order("name")
    ]).then(([bRes, pRes, sRes]) => {
      setBranches((bRes.data as Branch[]) ?? []);
      setProducts((pRes.data as MasterProduct[]) ?? []);
      setSuppliers((sRes.data as Supplier[]) ?? []);
    });
  }, [open]);

  useEffect(() => {
    if (unit && open && products.length > 0) {
      const currentProd = products.find(p => p.id === unit.product_id) || (unit.master_products as unknown as MasterProduct);
      if (currentProd) {
        setSelectedProduct(currentProd);
        setProductSearch(getProductLabel(currentProd));
      }
      
      const currentSup = unit.supplier_id ? suppliers.find(s => s.id === unit.supplier_id) : null;
      if (currentSup) {
        setSelectedSupplier(currentSup);
        setSupplierSearch(currentSup.name);
      } else {
        setSupplierSearch(unit.supplier || "");
      }

      setImei(unit.imei ?? "");
      setImeiError(null);
      setSerialNumber(unit.serial_number ?? "");
      setSnError(null);
      setQtyAvailable(unit.qty_available?.toString() ?? "");
      setBranchId((unit as any).branch_id ?? "");
      setStockStatus(unit.stock_status);
      setSellingPrice(unit.selling_price?.toString() ?? "");
      setCostPrice(unit.cost_price?.toString() ?? "");
      setConditionStatus(unit.condition_status ?? "no_minus");
      setMinusDescription(unit.minus_description ?? "");
      setSoldChannel(unit.sold_channel ?? "");
      setSoldReferenceId(unit.sold_reference_id ?? "");
      setNotes(unit.notes ?? "");
    }
  }, [unit, open, products, suppliers]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) setProductDropdownOpen(false);
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setSupplierDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // IMEI uniqueness check
  useEffect(() => {
    if (!unit || trackingType !== "imei" || !imei || imei.length < 14) { setImeiError(null); return; }
    if (imei === (unit.imei ?? "")) { setImeiError(null); return; }
    const t = setTimeout(async () => {
      setImeiChecking(true);
      const { data } = await supabase.from("stock_units").select("id").eq("imei", imei).neq("id", unit.id).maybeSingle();
      setImeiChecking(false);
      setImeiError(data ? "IMEI sudah digunakan oleh unit lain." : null);
    }, 500);
    return () => clearTimeout(t);
  }, [imei, unit, trackingType]);

  // Serial Number uniqueness check
  useEffect(() => {
    if (!unit || trackingType !== "serial_number" || !serialNumber.trim()) { setSnError(null); return; }
    if (serialNumber === (unit.serial_number ?? "")) { setSnError(null); return; }
    const t = setTimeout(async () => {
      setSnChecking(true);
      const { data } = await supabase.from("stock_units").select("id").eq("imei", serialNumber).neq("id", unit.id).maybeSingle();
      setSnChecking(false);
      setSnError(data ? "Serial Number sudah digunakan oleh unit lain." : null);
    }, 500);
    return () => clearTimeout(t);
  }, [serialNumber, unit, trackingType]);

  const filteredProducts = products.filter(p => getProductLabel(p).toLowerCase().includes(productSearch.toLowerCase()));
  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));

  const handleCreateSupplier = async () => {
    if (!supplierSearch.trim()) return;
    setCreatingSupplier(true);
    const { data, error } = await supabase.from("suppliers").insert({ name: supplierSearch.trim() } as never).select().single();
    setCreatingSupplier(false);
    if (error) { toast({ title: "Gagal membuat supplier", description: error.message, variant: "destructive" }); return; }
    const newSup = data as Supplier;
    setSuppliers(prev => [...prev, newSup].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedSupplier(newSup);
    setSupplierSearch(newSup.name);
    setSupplierDropdownOpen(false);
    toast({ title: "Supplier berhasil ditambahkan" });
  };

  async function handleSave() {
    if (!unit || !selectedProduct) return;

    if (trackingType === "imei") {
      if (!imei.trim()) { toast({ title: "IMEI wajib diisi", variant: "destructive" }); return; }
      if (imeiError) return;
    }
    if (trackingType === "serial_number") {
      if (!serialNumber.trim()) { toast({ title: "Serial Number wajib diisi", variant: "destructive" }); return; }
      if (snError) return;
    }

    setSaving(true);

    const updateData: Record<string, unknown> = {
      product_id: selectedProduct.id,
      branch_id: branchId || null,
      stock_status: stockStatus,
      selling_price: sellingPrice ? Number(sellingPrice) : null,
      cost_price: costPrice ? Number(costPrice) : null,
      supplier_id: selectedSupplier?.id || null,
      supplier: selectedSupplier ? selectedSupplier.name : (supplierSearch.trim() || null),
      notes: notes.trim() || null,
    };

    if (trackingType === "imei") {
      updateData.imei = imei.trim();
      updateData.condition_status = conditionStatus;
      updateData.minus_description = conditionStatus === "minus" ? (minusDescription.trim() || null) : null;
    } else if (trackingType === "serial_number") {
      updateData.imei = serialNumber.trim(); // We store SN in imei column as fallback
      updateData.condition_status = conditionStatus;
      updateData.minus_description = conditionStatus === "minus" ? (minusDescription.trim() || null) : null;
    } else if (trackingType === "qty") {
      updateData.qty_available = parseInt(qtyAvailable) || 0;
    }

    // Status berubah ke "sold" → simpan field lain dulu, lalu buka QuickEcommerceSaleModal
    // agar user bisa gabungkan unit lain dalam 1 transaksi
    if (stockStatus === "sold" && unit.stock_status !== "sold") {
      // Simpan perubahan metadata (harga, kondisi, dll) TANPA mengubah stock_status
      const nonStatusData = { ...updateData, stock_status: unit.stock_status };
      const { error: saveErr } = await supabase
        .from("stock_units")
        .update(nonStatusData as never)
        .eq("id", unit.id);

      setSaving(false);
      if (saveErr) {
        toast({ title: "Gagal menyimpan", description: saveErr.message, variant: "destructive" });
        return;
      }

      // Bangun unit ter-update untuk di-pass ke QuickEcommerceSaleModal
      const updated: StockUnit = {
        ...unit,
        product_id: selectedProduct.id,
        branch_id: branchId || null,
        selling_price: sellingPrice ? Number(sellingPrice) : null,
        cost_price: costPrice ? Number(costPrice) : null,
        condition_status: trackingType !== "qty" ? conditionStatus : unit.condition_status,
        minus_description: conditionStatus === "minus" ? (minusDescription.trim() || null) : null,
        notes: notes.trim() || null,
        master_products: unit.master_products,
      };
      setPendingUnit(updated);
      setEcommerceModalOpen(true);
      return;
    }

    // Status tidak berubah ke "sold" — preserve sold fields jika sudah sold, null jika bukan
    if (stockStatus === "sold") {
      // Sudah sold sebelumnya, preserve channel & reference yang ada
      updateData.sold_channel = soldChannel || null;
      updateData.sold_reference_id = soldReferenceId.trim() || null;
    } else {
      updateData.sold_channel = null;
      updateData.sold_reference_id = null;
    }

    const { error } = await supabase.from("stock_units").update(updateData as never).eq("id", unit.id);

    setSaving(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Unit berhasil diperbarui" });
    onSuccess();
    onClose();
  }

  if (!unit) return null;

  function handleEcommerceClose() {
    // Batal di SoldEcommerceModal → revert status ke semula
    setEcommerceModalOpen(false);
    setStockStatus(unit!.stock_status);
  }

  function handleEcommerceSuccess() {
    setEcommerceModalOpen(false);
    onSuccess();
    onClose();
  }

  return (
    <>
    <QuickEcommerceSaleModal
      unit={pendingUnit}
      open={ecommerceModalOpen}
      onClose={handleEcommerceClose}
      onSuccess={handleEcommerceSuccess}
    />
    <Dialog open={open && !ecommerceModalOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[95vh] overflow-y-auto p-0">
        <div className="p-6 space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Edit Data Unit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* SKU / Product Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground">Master Produk (SKU)</label>
              <div className="relative" ref={productRef}>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setProductDropdownOpen(true); }}
                    onFocus={() => setProductDropdownOpen(true)}
                    placeholder="Cari produk (contoh: iPhone 15 Pro)..."
                    className="pl-9 h-11 bg-muted/30 border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl"
                  />
                  {selectedProduct && (
                    <button onClick={() => { setSelectedProduct(null); setProductSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {productDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[280px] overflow-y-auto p-1.5 custom-scrollbar">
                      {filteredProducts.length > 0 ? filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedProduct(p); setProductSearch(getProductLabel(p)); setProductDropdownOpen(false); }}
                          className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between group",
                            selectedProduct?.id === p.id ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent")}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{getProductLabel(p)}</span>
                            <span className={cn("text-[10px] uppercase font-bold tracking-tighter opacity-60", selectedProduct?.id === p.id ? "text-white" : "text-muted-foreground")}>
                              {CATEGORY_LABELS[p.category as any]}
                            </span>
                          </div>
                          {selectedProduct?.id === p.id && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      )) : (
                        <div className="p-8 text-center space-y-2">
                          <Package className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                          <p className="text-sm text-muted-foreground">Produk tidak ditemukan</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cabang */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">Cabang</label>
                <Select value={branchId || "none"} onValueChange={(v) => setBranchId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-11 bg-muted/30 border-gray-300 dark:border-zinc-600 rounded-xl transition-all focus:bg-background"><SelectValue placeholder="Pilih cabang..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border shadow-xl">
                    <SelectItem value="none" className="text-muted-foreground italic">— Tidak ditentukan</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="rounded-lg">{b.name}{b.city ? ` (${b.city})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">Status Unit</label>
                <Select value={stockStatus} onValueChange={setStockStatus}>
                  <SelectTrigger className="h-11 bg-muted/30 border-gray-300 dark:border-zinc-600 rounded-xl transition-all focus:bg-background font-semibold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border shadow-xl">
                    {statusLabels.filter(s => s.is_active).map((s) => (
                      <SelectItem key={s.key} value={s.key} className="rounded-lg font-medium">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Info banner: status "sold" hanya via modal ecommerce */}
            {stockStatus === "sold" && unit.stock_status !== "sold" && (
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Detail Penjualan</p>
                <p className="text-sm text-muted-foreground">
                  Klik <span className="font-semibold text-foreground">Simpan Perubahan</span> untuk melanjutkan ke pencatatan penjualan via Ecommerce.
                </p>
              </div>
            )}

            {/* Identifikasi Unit (IMEI/SN/Qty) */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-gray-300 dark:border-zinc-600/50 space-y-4">
              {trackingType === "imei" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5" /> IMEI</label>
                  <div className="relative group">
                    <Input value={imei} onChange={e => setImei(e.target.value)} placeholder="Masukkan 15 digit IMEI" className="h-11 font-mono text-base border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl pr-10" />
                    {imeiChecking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    )}
                  </div>
                  {imeiError && (
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-destructive px-1 animate-in slide-in-from-left-1 duration-200">
                      <AlertCircle className="w-3.5 h-3.5" />{imeiError}
                    </p>
                  )}
                </div>
              )}

              {trackingType === "serial_number" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Serial Number</label>
                  <div className="relative group">
                    <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Masukkan nomor seri" className="h-11 font-mono text-base border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl pr-10" />
                    {snChecking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    )}
                  </div>
                  {snError && (
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-destructive px-1 animate-in slide-in-from-left-1 duration-200">
                      <AlertCircle className="w-3.5 h-3.5" />{snError}
                    </p>
                  )}
                </div>
              )}

              {trackingType === "qty" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground">Jumlah Stok Aksesoris</label>
                  <Input type="number" min="0" value={qtyAvailable} onChange={e => setQtyAvailable(e.target.value)} placeholder="0" className="h-11 text-base font-bold border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl" />
                </div>
              )}

              {/* Harga */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground">Harga Jual</label>
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">Rp</span>
                    <Input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0" className="h-11 pl-9 border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground">Harga Modal</label>
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">Rp</span>
                    <Input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0" className="h-11 pl-9 border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl font-bold" />
                  </div>
                </div>
              </div>
            </div>

            {/* Kondisi */}
            {trackingType !== "qty" && (
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground">Kondisi Unit</label>
                  <div className="flex gap-2">
                    {[
                      { v: "no_minus", label: "No Minus", color: "bg-emerald-500" },
                      { v: "minus", label: "Ada Minus", color: "bg-amber-500" }
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setConditionStatus(opt.v as any)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border-2 transition-all font-semibold text-sm",
                          conditionStatus === opt.v ? "border-primary bg-primary/5 text-primary" : "border-gray-300 dark:border-zinc-600 bg-muted/20 text-muted-foreground hover:border-gray-300 dark:border-zinc-600-foreground/30"
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full", conditionStatus === opt.v ? opt.color : "bg-muted-foreground/30")} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {conditionStatus === "minus" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground">Deskripsi Minus</label>
                    <Textarea value={minusDescription} onChange={e => setMinusDescription(e.target.value)}
                      placeholder="Jelaskan detail minus unit..." className="min-h-[100px] bg-muted/30 border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl resize-none" />
                  </div>
                )}
              </div>
            )}

            {/* Supplier Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Supplier</label>
              <div className="relative" ref={supplierRef}>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    value={supplierSearch}
                    onChange={(e) => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); }}
                    onFocus={() => setSupplierDropdownOpen(true)}
                    placeholder="Cari atau tambah supplier..."
                    className="pl-9 h-11 bg-muted/30 border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl"
                  />
                  {supplierSearch && (
                    <button onClick={() => { setSelectedSupplier(null); setSupplierSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent">
                      <X className="w-3.5 h-3.5" text-muted-foreground />
                    </button>
                  )}
                </div>
                {supplierDropdownOpen && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="max-h-[200px] overflow-y-auto p-1.5 custom-scrollbar">
                      {filteredSuppliers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedSupplier(s); setSupplierSearch(s.name); setSupplierDropdownOpen(false); }}
                          className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between",
                            selectedSupplier?.id === s.id ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent")}
                        >
                          <span>{s.name}</span>
                          {selectedSupplier?.id === s.id && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                      {supplierSearch.trim() && !suppliers.some(s => s.name.toLowerCase() === supplierSearch.trim().toLowerCase()) && (
                        <button
                          onClick={handleCreateSupplier}
                          disabled={creatingSupplier}
                          className="w-full text-left px-3 py-3 rounded-lg text-sm text-primary hover:bg-primary/5 flex items-center gap-2 border-t border-border mt-1 transition-colors"
                        >
                          {creatingSupplier ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          <span className="font-semibold">Tambah "{supplierSearch.trim()}"</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Catatan */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground">Catatan Internal</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tambahkan catatan khusus unit ini..." className="min-h-[80px] bg-muted/30 border-gray-300 dark:border-zinc-600 focus:bg-background transition-all rounded-xl resize-none" />
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t border-border bg-background sticky bottom-0 z-10">
          <Button variant="outline" onClick={onClose} className="h-11 px-6 rounded-xl font-semibold">Batal</Button>
          <Button onClick={handleSave} disabled={saving || !!imeiError || !!snError || !selectedProduct} className="h-11 px-8 rounded-xl font-bold gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
