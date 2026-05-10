import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Search, X, Check, ShoppingBag, User, Phone, Mail,
  Hash, Package, Plus, Smartphone, Tablet, Laptop, Watch, Headphones,
  Layers, UserCheck, Receipt, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockUnit, SoldChannel } from "@/lib/admin/produk/stock-units";
import { getUnitIdentifier, formatCurrency } from "@/lib/admin/produk/stock-units";
import type { ProductCategory } from "@/lib/admin/produk/master-products";
import { useAuth } from "@/contexts/admin/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

const getFullProductName = (mp: StockUnit["master_products"]): string => {
  if (!mp) return "—";
  const parts: string[] = [mp.series];
  if (mp.storage_gb) parts.push(mp.storage_gb >= 1024 ? `${mp.storage_gb / 1024}TB` : `${mp.storage_gb}GB`);
  if (mp.color) parts.push(mp.color);
  return parts.join(" ");
};

const getCategoryIcon = (category: ProductCategory | string | undefined) => {
  switch (category) {
    case "iphone":    return <Smartphone className="w-3.5 h-3.5" />;
    case "ipad":      return <Tablet className="w-3.5 h-3.5" />;
    case "macbook":   return <Laptop className="w-3.5 h-3.5" />;
    case "watch":     return <Watch className="w-3.5 h-3.5" />;
    case "airpods":   return <Headphones className="w-3.5 h-3.5" />;
    case "accessory": return <Layers className="w-3.5 h-3.5" />;
    default:          return <Package className="w-3.5 h-3.5" />;
  }
};

type CustomerResult = {
  type: "registered" | "guest";
  id?: string;
  name: string;
  email: string | null;
  phone: string | null;
  count?: number;
};

// ── UnitRow ───────────────────────────────────────────────────────────────────

function UnitRow({ u, onAdd, isSelected }: { u: StockUnit; onAdd: () => void; isSelected?: boolean }) {
  const isSold = u.stock_status === "sold";
  return (
    <button
      onClick={onAdd}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all border text-left",
        isSelected
          ? "bg-primary/5 border-primary"
          : "bg-card border-border hover:border-primary/40 hover:bg-accent/30"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
        isSold ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary"
      )}>
        {getCategoryIcon(u.master_products?.category)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-foreground truncate">
            {getFullProductName(u.master_products)}
          </p>
          {isSold ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200 font-medium shrink-0">
              Terjual
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium shrink-0">
              Tersedia
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono">{getUnitIdentifier(u)}</span>
          {u.branch && (
            <>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>{u.branch.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {u.selling_price && (
          <span className="text-sm font-semibold text-foreground">{formatCurrency(u.selling_price)}</span>
        )}
        <div className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
          isSelected
            ? "bg-primary border-primary text-primary-foreground"
            : "border-border"
        )}>
          {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-muted-foreground" />}
        </div>
      </div>
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TambahEcommerceTransaksiModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TambahEcommerceTransaksiModal({
  open,
  onClose,
  onSuccess,
}: TambahEcommerceTransaksiModalProps) {
  const { toast } = useToast();
  const { activeBranch } = useAuth();

  type Step = "units" | "details";
  const [step, setStep] = useState<Step>("units");
  const [loading, setLoading] = useState(false);

  // ── Unit selection ──
  const [selectedUnits, setSelectedUnits] = useState<StockUnit[]>([]);
  const [initialUnits, setInitialUnits] = useState<StockUnit[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<StockUnit[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [filterStock, setFilterStock] = useState<"all" | "available" | "sold">("all");
  const INITIAL_PREVIEW = 8;
  const [showAllInitial, setShowAllInitial] = useState(false);

  // ── Form fields ──
  const [channel, setChannel] = useState<SoldChannel>("ecommerce_tokopedia");
  const [referenceId, setReferenceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  // ── Customer search ──
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [customerSelected, setCustomerSelected] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // ── Reset on open ──
  useEffect(() => {
    if (open) {
      setStep("units");
      setSelectedUnits([]);
      setAvailableUnits([]);
      setUnitSearch("");
      setFilterStock("all");
      setShowAllInitial(false);
      setChannel("ecommerce_tokopedia");
      setReferenceId("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setNotes("");
      setCustomerQuery("");
      setCustomerResults([]);
      setCustomerSelected(false);
    }
  }, [open]);

  // ── Load available units (initial) ──
  const loadInitialUnits = async () => {
    setLoadingInitial(true);
    try {
      let q = supabase
        .from("stock_units")
        .select("*, master_products(*), branch:branches(name)")
        .or("stock_status.eq.available,and(stock_status.eq.sold,sold_channel.in.(ecommerce_tokopedia,ecommerce_shopee,offline_non_pos))");
      if (activeBranch?.id) q = q.eq("branch_id", activeBranch.id) as typeof q;
      const { data, error } = await q.order("received_at", { ascending: false }).limit(50);
      if (error) throw error;
      setInitialUnits((data as StockUnit[]) ?? []);
    } catch (err) {
      console.error("Load units failed:", err);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    if (open) loadInitialUnits();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unit search ──
  const fetchUnitSearch = async (s: string) => {
    if (!s || s.length < 2) { setAvailableUnits([]); return; }
    setLoadingSearch(true);
    try {
      const { data: matchedProducts } = await supabase
        .from("master_products")
        .select("id")
        .or(`series.ilike.%${s}%,color.ilike.%${s}%`);
      const productIds = (matchedProducts ?? []).map((p: any) => p.id as string);

      let q = supabase
        .from("stock_units")
        .select("*, master_products(*), branch:branches(name)")
        .or("stock_status.eq.available,and(stock_status.eq.sold,sold_channel.in.(ecommerce_tokopedia,ecommerce_shopee,offline_non_pos))");
      if (activeBranch?.id) q = q.eq("branch_id", activeBranch.id) as typeof q;

      const orParts: string[] = [`imei.ilike.%${s}%`, `serial_number.ilike.%${s}%`];
      if (productIds.length > 0) orParts.push(`product_id.in.(${productIds.join(",")})`);

      const { data, error } = await q.and(orParts.join(",")).limit(20);
      if (error) throw error;
      setAvailableUnits(
        ((data as StockUnit[]) ?? []).filter(u => !selectedUnits.some(sel => sel.id === u.id))
      );
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchUnitSearch(unitSearch), 400);
    return () => clearTimeout(t);
  }, [unitSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleUnit = (u: StockUnit) => {
    setSelectedUnits(prev =>
      prev.some(s => s.id === u.id) ? prev.filter(s => s.id !== u.id) : [...prev, u]
    );
  };

  // ── Computed display list ──
  const baseList = unitSearch.length >= 2 ? availableUnits : initialUnits;
  const filteredList = baseList.filter(u => {
    if (filterStock === "available") return u.stock_status === "available";
    if (filterStock === "sold") return u.stock_status === "sold";
    return true;
  });
  const displayList = unitSearch.length >= 2 || showAllInitial
    ? filteredList
    : filteredList.slice(0, INITIAL_PREVIEW);

  // ── Customer search ──
  const searchCustomers = async (q: string) => {
    if (q.trim().length < 2) { setCustomerResults([]); return; }
    setCustomerSearchLoading(true);
    setCustomerResults([]);
    type RawEntry = CustomerResult & { count?: number };
    const raw: RawEntry[] = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "search_customers", keyword: q.trim().toLowerCase() }),
      });
      const json = await res.json();
      for (const c of json.customers ?? []) {
        raw.push({ type: "registered", id: c.id, name: c.name ?? "", email: c.email ?? null, phone: c.phone ?? null });
      }
    } catch {}

    try {
      const { data } = await (supabase as any)
        .from("transactions")
        .select("customer_name, customer_email, customer_phone")
        .or(`customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,customer_phone.ilike.%${q}%`)
        .is("customer_user_id", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data?.length > 0) {
        const seen = new Map<string, RawEntry>();
        for (const row of data) {
          const key = `${row.customer_phone || ""}_${(row.customer_name || "").toLowerCase()}`;
          if (seen.has(key)) { (seen.get(key)!.count as number)++; }
          else seen.set(key, { type: "guest", name: row.customer_name || "", email: row.customer_email, phone: row.customer_phone, count: 1 });
        }
        raw.push(...seen.values());
      }
    } catch {}

    const byPhone = new Map<string, RawEntry>();
    const noPhone: RawEntry[] = [];
    for (const r of raw) {
      const phone = r.phone?.trim();
      if (!phone) { noPhone.push(r); continue; }
      const existing = byPhone.get(phone);
      if (!existing) { byPhone.set(phone, { ...r }); }
      else {
        byPhone.set(phone, {
          ...existing,
          type: existing.type === "registered" || r.type === "registered" ? "registered" : "guest",
          id: existing.id ?? r.id,
          name: existing.name || r.name,
          email: existing.email || r.email,
          count: (existing.count ?? 0) + (r.count ?? 0) || undefined,
        });
      }
    }
    setCustomerResults([...byPhone.values(), ...noPhone]);
    setCustomerSearchLoading(false);
  };

  useEffect(() => {
    if (customerSelected) return;
    const t = setTimeout(() => searchCustomers(customerQuery), 400);
    return () => clearTimeout(t);
  }, [customerQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCustomer = (r: CustomerResult) => {
    setCustomerName(r.name);
    setCustomerEmail(r.email ?? "");
    setCustomerPhone(r.phone ?? "");
    setCustomerQuery(r.name);
    setCustomerResults([]);
    setCustomerSelected(true);
  };

  const clearCustomer = () => {
    setCustomerName(""); setCustomerEmail(""); setCustomerPhone("");
    setCustomerQuery(""); setCustomerResults([]); setCustomerSelected(false);
    setTimeout(() => customerInputRef.current?.focus(), 50);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (selectedUnits.length === 0) {
      toast({ title: "Pilih minimal 1 unit", variant: "destructive" }); return;
    }
    if (!customerName.trim()) {
      toast({ title: "Nama customer wajib diisi", variant: "destructive" }); return;
    }
    if (!referenceId.trim()) {
      toast({ title: "No. Invoice / ID Transaksi wajib diisi", variant: "destructive" }); return;
    }

    setLoading(true);
    try {
      const subtotal = selectedUnits.reduce((acc, u) => acc + (u.selling_price || 0), 0);
      const channelLabel = channel === "ecommerce_tokopedia" ? "Tokopedia"
        : channel === "ecommerce_shopee" ? "Shopee"
        : channel === "website" ? "Website"
        : "Offline Non-POS";
      const transactionCode = `TRX-EC-${Date.now()}`;

      const { data: trx, error: trxErr } = await supabase.from("transactions").insert({
        transaction_code: transactionCode,
        branch_id: activeBranch?.id ?? null,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        subtotal,
        discount_amount: 0,
        total: subtotal,
        status: "completed",
        payment_method_name: channelLabel,
        notes: [`Kanal: ${channelLabel}`, `Ref: ${referenceId.trim()}`, notes.trim()].filter(Boolean).join(". "),
      } as never).select().single();
      if (trxErr) throw trxErr;

      const items = selectedUnits.map(u => ({
        transaction_id: trx.id,
        stock_unit_id: u.id,
        product_name: u.master_products?.series || "Unknown Product",
        imei: u.imei,
        serial_number: u.serial_number,
        qty: 1,
        unit_price: u.selling_price || 0,
        subtotal: u.selling_price || 0,
      }));
      const { error: itemsErr } = await supabase.from("transaction_items").insert(items as never[]);
      if (itemsErr) throw itemsErr;

      const { error: stockErr } = await supabase
        .from("stock_units")
        .update({
          stock_status: "sold",
          sold_at: new Date().toISOString(),
          sold_channel: channel,
          sold_reference_id: referenceId.trim(),
        } as never)
        .in("id", selectedUnits.map(u => u.id));
      if (stockErr) throw stockErr;

      const invoiceNumber = `INV/${channelLabel.toUpperCase().replace(/\s/g, "-")}/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
      const { error: invErr } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        transaction_id: trx.id,
        branch_id: activeBranch?.id ?? null,
        status: "published",
        payment_status: "paid",
        customer_name: customerName.trim(),
        total: subtotal,
        channel,
        invoice_date: new Date().toISOString().split("T")[0],
        paid_at: new Date().toISOString(),
      } as never);
      if (invErr) throw invErr;

      toast({
        title: "Transaksi ecommerce berhasil dibuat",
        description: `${selectedUnits.length} unit · Faktur ${invoiceNumber}`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Gagal membuat transaksi", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = selectedUnits.reduce((acc, u) => acc + (u.selling_price || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-2xl overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-none shadow-2xl">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold leading-tight">Tambah Transaksi Ecommerce</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Catat penjualan via Tokopedia, Shopee, atau platform luar. Faktur dibuat otomatis.
            </DialogDescription>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[65vh] space-y-5 scrollbar-hide">

          {/* ── STEP: units ── */}
          {step === "units" && (
            <div className="space-y-4">

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari IMEI, nama produk, atau serial…"
                  className="pl-9 h-9 text-sm"
                  value={unitSearch}
                  onChange={e => setUnitSearch(e.target.value)}
                />
                {unitSearch && (
                  <button
                    onClick={() => { setUnitSearch(""); setAvailableUnits([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Selected cart preview */}
              {selectedUnits.length > 0 && (
                <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                      Dipilih ({selectedUnits.length} unit) · {formatCurrency(totalPrice)}
                    </p>
                    <button
                      onClick={() => setSelectedUnits([])}
                      className="text-[10px] font-medium text-destructive hover:underline"
                    >
                      Kosongkan
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {selectedUnits.map(u => (
                      <div
                        key={u.id}
                        className="flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5"
                      >
                        <span className="text-[11px] font-medium text-foreground whitespace-nowrap">
                          {getFullProductName(u.master_products)}
                        </span>
                        <button onClick={() => toggleUnit(u)}>
                          <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daftar Item header + filter */}
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-foreground">
                  {unitSearch.length >= 2 ? "Hasil Pencarian" : "Daftar Item"}
                </p>
                <div className="ml-auto flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/40">
                  {(["all", "available", "sold"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterStock(f)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        filterStock === f
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f === "all" ? "Semua" : f === "available" ? "Tersedia" : "Terjual"}
                    </button>
                  ))}
                </div>
              </div>

              {/* List */}
              <div className="space-y-2">
                {loadingSearch || loadingInitial ? (
                  <div className="py-14 flex flex-col items-center gap-3 border border-dashed border-border rounded-xl">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Memuat data stok…</p>
                  </div>
                ) : displayList.length > 0 ? (
                  <>
                    {displayList.map(u => (
                      <UnitRow
                        key={u.id}
                        u={u}
                        onAdd={() => toggleUnit(u)}
                        isSelected={selectedUnits.some(s => s.id === u.id)}
                      />
                    ))}
                    {!showAllInitial && unitSearch.length < 2 && filteredList.length > INITIAL_PREVIEW && (
                      <button
                        onClick={() => setShowAllInitial(true)}
                        className="w-full py-3 text-xs font-medium text-primary hover:bg-primary/5 rounded-xl border border-dashed border-primary/30 transition-all"
                      >
                        Lihat semua ({filteredList.length}) item
                      </button>
                    )}
                  </>
                ) : (
                  <div className="py-14 flex flex-col items-center gap-2 border border-dashed border-border rounded-xl">
                    <Package className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground">Tidak ada item ditemukan</p>
                    <p className="text-xs text-muted-foreground">Coba ubah filter atau kata kunci pencarian.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP: details ── */}
          {step === "details" && (
            <div className="space-y-5">

              {/* Summary strip */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/5 border border-primary/15">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Total Transaksi</p>
                  <p className="text-base font-semibold text-foreground">{formatCurrency(totalPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground font-medium">Item</p>
                  <p className="text-base font-semibold text-foreground">{selectedUnits.length} unit</p>
                </div>
              </div>

              {/* Platform & Ref */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Kanal Penjualan</Label>
                  <Select value={channel} onValueChange={v => setChannel(v as SoldChannel)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ecommerce_tokopedia">Tokopedia</SelectItem>
                      <SelectItem value="ecommerce_shopee">Shopee</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="offline_non_pos">Offline Non-POS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">No. Invoice Platform</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={referenceId}
                      onChange={e => setReferenceId(e.target.value)}
                      placeholder="Contoh: INV/2024…"
                      className="pl-9 h-9 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Card */}
              <div className="border border-border rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary" /> Data Pelanggan
                  </p>
                  {customerSelected && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                      Dari riwayat
                    </span>
                  )}
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    ref={customerInputRef}
                    value={customerQuery}
                    onChange={e => { setCustomerQuery(e.target.value); setCustomerSelected(false); }}
                    placeholder="Cari member atau ketik nama baru…"
                    className={cn("pl-9 h-9 text-sm", customerSelected && "border-primary/40 bg-primary/[0.02]")}
                  />
                  {customerSearchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                  {customerSelected && (
                    <button onClick={clearCustomer} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>

                {/* Dropdown results */}
                {!customerSelected && customerQuery.trim().length >= 2 && !customerSearchLoading && (
                  <div className="border border-border rounded-xl bg-card shadow-md overflow-hidden">
                    {customerResults.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto divide-y divide-border">
                        {customerResults.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => selectCustomer(r)}
                            className="w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-sm font-medium text-foreground">{r.name}</p>
                              <span className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-md border",
                                r.type === "registered"
                                  ? "bg-primary/5 text-primary border-primary/20"
                                  : "bg-muted text-muted-foreground border-border"
                              )}>
                                {r.type === "registered" ? "Member" : `x${r.count}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.phone}</span>}
                              {r.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {r.email}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-center">
                        <p className="text-xs text-muted-foreground">Customer baru — lanjutkan isi detail di bawah.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Detail fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-medium text-foreground">Nama Customer <span className="text-destructive">*</span></Label>
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Wajib diisi…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">No. WhatsApp</Label>
                    <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="08…" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Email</Label>
                    <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="opsional@mail.com" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Catatan Tambahan</Label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Tambahkan info tambahan (opsional)…"
                  className="w-full min-h-[72px] px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:ring-2 focus:ring-ring focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <div className="flex gap-3">
            {step === "units" ? (
              <>
                <Button variant="outline" onClick={onClose} className="h-9 text-sm flex-1" disabled={loading}>
                  Batal
                </Button>
                <Button
                  onClick={() => setStep("details")}
                  disabled={selectedUnits.length === 0}
                  className="h-9 text-sm flex-[2] gap-2"
                >
                  Lanjut ke Detail
                  {selectedUnits.length > 0 && (
                    <span className="text-[10px] bg-primary-foreground/20 px-1.5 py-0.5 rounded font-medium">
                      {selectedUnits.length} unit
                    </span>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep("units")} className="h-9 text-sm flex-1" disabled={loading}>
                  Kembali
                </Button>
                <Button onClick={handleSubmit} disabled={loading} className="h-9 text-sm flex-[2] gap-2">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Receipt className="w-3.5 h-3.5" />
                      Konfirmasi & Cetak Faktur
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
