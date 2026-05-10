import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Loader2, Search, X, Check, ShoppingCart, User, Phone, Mail, Hash, Package, Plus,
  Smartphone, Tablet, Laptop, Watch, Headphones, Layers, UserCheck, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockUnit, SoldChannel } from "@/lib/admin/produk/stock-units";
import { getUnitIdentifier, formatCurrency } from "@/lib/admin/produk/stock-units";
import type { ProductCategory } from "@/lib/admin/produk/master-products";
import { useAuth } from "@/contexts/admin/AuthContext";

const getFullProductName = (mp: StockUnit["master_products"]): string => {
  if (!mp) return "—";
  const parts: string[] = [mp.series];
  if (mp.storage_gb) parts.push(mp.storage_gb >= 1024 ? `${mp.storage_gb / 1024}TB` : `${mp.storage_gb}GB`);
  if (mp.color) parts.push(mp.color);
  return parts.join(" ");
};

interface QuickEcommerceSaleModalProps {
  unit: StockUnit | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type CustomerResult = {
  type: "registered" | "guest";
  id?: string;
  name: string;
  email: string | null;
  phone: string | null;
  count?: number;
};

const getCategoryIcon = (category: ProductCategory | string | undefined) => {
  switch (category) {
    case "iphone": return <Smartphone className="w-4 h-4" />;
    case "ipad": return <Tablet className="w-4 h-4" />;
    case "macbook": return <Laptop className="w-4 h-4" />;
    case "watch": return <Watch className="w-4 h-4" />;
    case "airpods": return <Headphones className="w-4 h-4" />;
    case "accessory": return <Layers className="w-4 h-4" />;
    default: return <Package className="w-4 h-4" />;
  }
};

function UnitRow({ u, onAdd }: { u: StockUnit; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 transition-all border border-border/50 hover:border-primary/30 text-left group"
    >
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0 text-muted-foreground group-hover:text-primary">
        {getCategoryIcon(u.master_products?.category)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate leading-tight">{getFullProductName(u.master_products)}</p>
        <p className="text-[11px] font-mono text-muted-foreground mt-0.5 leading-none">{getUnitIdentifier(u)}</p>
      </div>
      {u.selling_price && (
        <span className="text-xs font-semibold text-foreground shrink-0">{formatCurrency(u.selling_price)}</span>
      )}
      <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center group-hover:border-primary group-hover:bg-primary/10 transition-all shrink-0">
        <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
      </div>
    </button>
  );
}

export function QuickEcommerceSaleModal({ unit, open, onClose, onSuccess }: QuickEcommerceSaleModalProps) {
  const { toast } = useToast();
  const { activeBranch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"choice" | "selection" | "customer">("choice");

  // Selection state
  const [selectedUnits, setSelectedUnits] = useState<StockUnit[]>([]);
  const [availableUnits, setAvailableUnits] = useState<StockUnit[]>([]);
  const [unitSearch, setUnitSearch] = useState("");
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [initialUnits, setInitialUnits] = useState<StockUnit[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [showAllInitial, setShowAllInitial] = useState(false);
  const INITIAL_PREVIEW = 5;

  // Form state
  const [channel, setChannel] = useState<SoldChannel>("ecommerce_tokopedia");
  const [referenceId, setReferenceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Customer search state
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [customerSelected, setCustomerSelected] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && unit) {
      setStep("choice");
      setSelectedUnits([unit]);
      setChannel("ecommerce_tokopedia");
      setReferenceId("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setNotes("");
      setUnitSearch("");
      setAvailableUnits([]);
      setInitialUnits([]);
      setShowAllInitial(false);
      setCustomerQuery("");
      setCustomerResults([]);
      setCustomerSelected(false);
    }
  }, [open, unit]);

  // ── Unit search (two-step: product name → product IDs, then filter stock_units) ──
  const fetchAvailableUnits = async (search: string) => {
    const s = search.trim();
    if (!s || s.length < 2) {
      setAvailableUnits([]);
      return;
    }
    setLoadingUnits(true);

    try {
      // Step 1: get product IDs matching the search term (series / color)
      const { data: matchedProducts } = await supabase
        .from("master_products")
        .select("id")
        .or(`series.ilike.%${s}%,color.ilike.%${s}%`);

      const productIds = (matchedProducts ?? []).map((p: any) => p.id as string);

      // Build and run stock_units query — with serial_number fallback
      const runQuery = async (includeSerial: boolean) => {
        let q = supabase
          .from("stock_units")
          .select("*, master_products(*)")
          .eq("stock_status", "available");

        if (unit?.branch_id) q = q.eq("branch_id", unit.branch_id) as typeof q;

        const orParts: string[] = [`imei.ilike.%${s}%`];
        if (includeSerial) orParts.push(`serial_number.ilike.%${s}%`);
        if (productIds.length > 0) orParts.push(`product_id.in.(${productIds.join(",")})`);

        return q.or(orParts.join(",")).limit(20);
      };

      let { data, error } = await runQuery(true);

      // Fallback: serial_number column might not exist in dev DB
      if (error) {
        const isColErr = error.message?.includes("serial_number") || error.message?.includes("column") || error.message?.includes("42703");
        if (isColErr) {
          const retry = await runQuery(false);
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) throw error;

      const filtered = (data as StockUnit[] || []).filter(u => !selectedUnits.some(sel => sel.id === u.id));
      setAvailableUnits(filtered);
    } catch (err) {
      console.error("Search failed:", err);
      toast({ title: "Pencarian gagal", description: "Terjadi kesalahan saat mencari unit.", variant: "destructive" });
    } finally {
      setLoadingUnits(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchAvailableUnits(unitSearch), 500);
    return () => clearTimeout(t);
  }, [unitSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load initial units when entering selection step ──
  const loadInitialUnits = async () => {
    if (!unit) return;
    setLoadingInitial(true);
    try {
      const runQ = async (includeSerial: boolean) => {
        let q = supabase
          .from("stock_units")
          .select("*, master_products(*)")
          .eq("stock_status", "available");
        if (unit.branch_id) q = q.eq("branch_id", unit.branch_id) as typeof q;
        if (includeSerial) q = q.neq("imei", unit.imei ?? "") as typeof q;
        return q.order("received_at", { ascending: false }).limit(30);
      };
      let { data, error } = await runQ(true);
      if (error?.message?.includes("serial_number") || error?.message?.includes("42703")) {
        const retry = await runQ(false);
        data = retry.data; error = retry.error;
      }
      if (error) throw error;
      const filtered = (data as StockUnit[] || []).filter(u => u.id !== unit.id);
      setInitialUnits(filtered);
    } catch (err) {
      console.error("Load initial units failed:", err);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    if (step === "selection") loadInitialUnits();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Customer search (unified: registered + guest history) ──
  const searchCustomers = async (q: string) => {
    if (q.trim().length < 2) { setCustomerResults([]); return; }
    setCustomerSearchLoading(true);
    setCustomerResults([]);

    const qLow = q.trim().toLowerCase();
    type RawEntry = CustomerResult & { count?: number };
    const raw: RawEntry[] = [];

    // Search registered customers via edge function
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "search_customers", keyword: qLow }),
      });
      const json = await res.json();
      for (const c of json.customers ?? []) {
        raw.push({ type: "registered", id: c.id, name: c.name ?? "", email: c.email ?? null, phone: c.phone ?? null });
      }
    } catch {}

    // Search guest customers from past transactions
    try {
      const { data } = await (supabase as any)
        .from("transactions")
        .select("customer_name, customer_email, customer_phone")
        .or(`customer_name.ilike.%${qLow}%,customer_email.ilike.%${qLow}%,customer_phone.ilike.%${qLow}%`)
        .is("customer_user_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data?.length > 0) {
        const seen = new Map<string, RawEntry>();
        for (const row of data) {
          const key = `${(row.customer_phone || "")}_${(row.customer_name || "").toLowerCase()}`;
          if (seen.has(key)) { (seen.get(key)!.count as number)++; }
          else seen.set(key, { type: "guest", name: row.customer_name || "", email: row.customer_email, phone: row.customer_phone, count: 1 });
        }
        raw.push(...seen.values());
      }
    } catch {}

    // Dedup by phone
    const byPhone = new Map<string, RawEntry>();
    const noPhone: RawEntry[] = [];
    for (const r of raw) {
      const phone = r.phone?.trim();
      if (!phone) { noPhone.push(r); continue; }
      const existing = byPhone.get(phone);
      if (!existing) {
        byPhone.set(phone, { ...r });
      } else {
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
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerQuery("");
    setCustomerResults([]);
    setCustomerSelected(false);
    setTimeout(() => customerInputRef.current?.focus(), 50);
  };

  const toggleUnit = (u: StockUnit) => {
    if (selectedUnits.some(s => s.id === u.id)) {
      if (u.id === unit?.id) return;
      setSelectedUnits(prev => prev.filter(s => s.id !== u.id));
    } else {
      setSelectedUnits(prev => [...prev, u]);
    }
    // Re-trigger search to update filtered results
    setAvailableUnits(prev => prev.filter(a => a.id !== u.id));
  };

  const handleProcessSale = async () => {
    if (!customerName.trim()) {
      toast({ title: "Nama customer wajib diisi", variant: "destructive" });
      return;
    }
    if (!referenceId.trim()) {
      toast({ title: "ID Transaksi wajib diisi", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const subtotal = selectedUnits.reduce((acc, u) => acc + (u.selling_price || 0), 0);
      const transactionCode = `TRX-EC-${Date.now()}`;

      // 1. Create Transaction (no grand_total — not present in all DB versions)
      const { data: trx, error: trxErr } = await supabase.from("transactions").insert({
        transaction_code: transactionCode,
        branch_id: unit?.branch_id ?? activeBranch?.id ?? null,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        total: subtotal,
        status: "completed",
        notes: `Kanal: ${channel}. Ref: ${referenceId}. ${notes}`.trim()
      } as never).select().single();

      if (trxErr) throw trxErr;

      // 2. Create Transaction Items
      const items = selectedUnits.map(u => ({
        transaction_id: trx.id,
        stock_unit_id: u.id,
        product_name: u.master_products?.series || "Unknown Product",
        imei: u.imei,
        serial_number: u.serial_number,
        qty: 1,
        unit_price: u.selling_price || 0,
        subtotal: u.selling_price || 0
      }));

      const { error: itemsErr } = await supabase.from("transaction_items").insert(items as never[]);
      if (itemsErr) throw itemsErr;

      // 3. Update stock_units status
      const { error: stockErr } = await supabase
        .from("stock_units")
        .update({
          stock_status: "sold",
          sold_at: new Date().toISOString(),
          sold_channel: channel,
          sold_reference_id: referenceId.trim()
        } as never)
        .in("id", selectedUnits.map(u => u.id));
      if (stockErr) throw stockErr;

      // 4. Create Invoice
      const invoiceNumber = `INV/${channel.toUpperCase()}/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
      const { error: invErr } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        transaction_id: trx.id,
        branch_id: unit?.branch_id ?? activeBranch?.id ?? null,
        status: "published",
        payment_status: "paid",
        customer_name: customerName.trim(),
        total: subtotal,
        channel: channel,
        invoice_date: new Date().toISOString().split('T')[0],
        paid_at: new Date().toISOString()
      } as never);
      if (invErr) throw invErr;

      toast({ title: "Transaksi berhasil dibuat", description: `${selectedUnits.length} unit telah ditandai terjual.` });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Gagal memproses transaksi", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!unit && !open) return null;

  const totalPrice = selectedUnits.reduce((acc, u) => acc + (u.selling_price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-lg overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Terjual via Ecommerce
          </DialogTitle>
          <DialogDescription>
            Proses cepat untuk menandai unit terjual di platform luar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 max-h-[65vh]">
          {/* ── STEP: choice ── */}
          {step === "choice" && (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {getCategoryIcon(unit?.master_products?.category)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{getFullProductName(unit?.master_products)}</p>
                  <p className="text-xs text-muted-foreground font-mono">{getUnitIdentifier(unit)}</p>
                  {unit?.selling_price && (
                    <p className="text-xs font-semibold text-primary mt-0.5">{formatCurrency(unit.selling_price)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <p className="text-sm font-semibold text-center text-muted-foreground mb-2">Berapa banyak unit yang terjual dalam 1 transaksi ini?</p>
                <Button variant="outline" className="h-16 justify-start px-6 rounded-2xl gap-4 group hover:border-primary transition-all" onClick={() => setStep("customer")}>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <span className="text-sm font-bold group-hover:text-primary">1</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Hanya Unit Ini Saja</p>
                    <p className="text-[11px] text-muted-foreground">Transaksi tunggal untuk 1 item.</p>
                  </div>
                </Button>
                <Button variant="outline" className="h-16 justify-start px-6 rounded-2xl gap-4 group hover:border-primary transition-all" onClick={() => setStep("selection")}>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Plus className="w-4 h-4 group-hover:text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Beberapa Unit Sekaligus</p>
                    <p className="text-[11px] text-muted-foreground">Pilih unit lain yang masuk dalam 1 Nomor Invoice.</p>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP: selection ── */}
          {step === "selection" && (
            <div className="space-y-4 pb-2 animate-in fade-in slide-in-from-right-2 duration-300">
              {/* Search input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider">Cari Unit Tambahan</Label>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Status: Tersedia</span>
                </div>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Ketik Nama Produk, IMEI, atau SN..."
                    className="pl-9 h-11 rounded-xl border-border hover:border-primary/50 focus-visible:ring-primary/20 transition-all"
                    value={unitSearch}
                    onChange={e => setUnitSearch(e.target.value)}
                  />
                  {unitSearch && (
                    <button onClick={() => { setUnitSearch(""); setAvailableUnits([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent transition-colors">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Selected units */}
              {selectedUnits.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      Unit Terpilih
                      <Badge variant="default" className="h-4 px-1.5 text-[9px] bg-primary/20 text-primary border-none">
                        {selectedUnits.length}
                      </Badge>
                    </p>
                    {totalPrice > 0 && (
                      <span className="text-xs font-bold text-primary">{formatCurrency(totalPrice)}</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {selectedUnits.map(u => {
                      const isPrimary = u.id === unit?.id;
                      return (
                        <div
                          key={u.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                            isPrimary
                              ? "bg-primary/5 border-primary/20"
                              : "bg-muted/40 border-border hover:border-destructive/30 hover:bg-destructive/5"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            isPrimary ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground"
                          )}>
                            {getCategoryIcon(u.master_products?.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate leading-tight">{getFullProductName(u.master_products)}</p>
                            <p className="text-[11px] font-mono text-muted-foreground leading-tight mt-0.5">{getUnitIdentifier(u)}</p>
                          </div>
                          {u.selling_price && (
                            <span className="text-xs font-semibold text-foreground shrink-0">{formatCurrency(u.selling_price)}</span>
                          )}
                          {isPrimary ? (
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">utama</span>
                          ) : (
                            <button
                              onClick={() => toggleUnit(u)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors shrink-0"
                              title="Hapus dari daftar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unit list / search results */}
              <div className="space-y-2 border-t pt-4">
                {unitSearch.length >= 2 ? (
                  // ── Mode pencarian ──
                  <>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Hasil Pencarian</p>
                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                      {loadingUnits ? (
                        <div className="flex items-center justify-center py-8 gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
                          <p className="text-xs text-muted-foreground">Mencari...</p>
                        </div>
                      ) : availableUnits.length > 0 ? availableUnits.map(u => (
                        <UnitRow key={u.id} u={u} onAdd={() => toggleUnit(u)} />
                      )) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                          <Search className="w-8 h-8 text-muted-foreground/40 mb-2" />
                          <p className="text-sm font-medium text-foreground">Unit tidak ditemukan</p>
                          <p className="text-xs text-muted-foreground mt-1">Coba kata kunci lain.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // ── Mode default: tampil semua stok tersedia ──
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Stok Tersedia</p>
                      {initialUnits.length > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{initialUnits.length} unit</span>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                      {loadingInitial ? (
                        <div className="flex items-center justify-center py-8 gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
                          <p className="text-xs text-muted-foreground">Memuat stok tersedia...</p>
                        </div>
                      ) : initialUnits.length > 0 ? (
                        <>
                          {(showAllInitial ? initialUnits : initialUnits.slice(0, INITIAL_PREVIEW))
                            .filter(u => !selectedUnits.some(s => s.id === u.id))
                            .map(u => <UnitRow key={u.id} u={u} onAdd={() => toggleUnit(u)} />)
                          }
                          {!showAllInitial && initialUnits.length > INITIAL_PREVIEW && (
                            <button
                              onClick={() => setShowAllInitial(true)}
                              className="w-full py-2.5 text-xs font-semibold text-primary hover:text-primary/80 hover:bg-primary/5 rounded-xl border border-dashed border-primary/30 transition-all"
                            >
                              Lihat semua ({initialUnits.length} unit tersedia)
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="py-8 text-center text-xs text-muted-foreground border-2 border-dashed border-muted rounded-2xl">
                          Tidak ada stok lain yang tersedia di cabang ini.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── STEP: customer ── */}
          {step === "customer" && (
            <div className="space-y-5 py-2 animate-in fade-in slide-in-from-right-2 duration-300">
              {/* Summary bar */}
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">{selectedUnits.length} unit</span>
                </div>
                {totalPrice > 0 && (
                  <span className="text-sm font-bold text-primary">{formatCurrency(totalPrice)}</span>
                )}
              </div>

              {/* Platform + No. Invoice */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><ShoppingCart className="w-3 h-3" /> Platform</Label>
                  <Select value={channel} onValueChange={v => setChannel(v as SoldChannel)}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ecommerce_tokopedia">Tokopedia</SelectItem>
                      <SelectItem value="ecommerce_shopee">Shopee</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="offline_non_pos">Offline Non-POS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Hash className="w-3 h-3" /> No. Invoice</Label>
                  <Input value={referenceId} onChange={e => setReferenceId(e.target.value)} placeholder="ID Transaksi Platform..." className="h-10 rounded-xl font-mono text-xs" />
                </div>
              </div>

              {/* Customer section */}
              <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
                <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Data Customer
                </Label>

                {/* Customer search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={customerInputRef}
                    value={customerQuery}
                    onChange={e => { setCustomerQuery(e.target.value); setCustomerSelected(false); }}
                    placeholder="Ketik nama, no. WA, atau email..."
                    className={cn(
                      "pl-9 h-10 rounded-xl pr-8 transition-all",
                      customerSelected && "border-primary/50 bg-primary/5"
                    )}
                  />
                  {(customerSearchLoading) && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary/60" />
                  )}
                  {customerSelected && !customerSearchLoading && (
                    <button onClick={clearCustomer} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-accent transition-colors" title="Ganti customer">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Dropdown results */}
                {!customerSelected && customerQuery.trim().length >= 2 && !customerSearchLoading && (
                  <div className={cn("border border-border rounded-xl overflow-hidden divide-y divide-border", customerResults.length > 0 ? "max-h-48 overflow-y-auto" : "")}>
                    {customerResults.length > 0 ? customerResults.map((r, i) => (
                      <button key={i} onClick={() => selectCustomer(r)} className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-bold leading-tight text-foreground truncate">{r.name || "(Tanpa nama)"}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {r.type === "registered" ? (
                              <Badge variant="outline" className="h-4 px-1.5 text-[9px] gap-0.5 border-primary/30 text-primary">
                                <UserCheck className="w-2.5 h-2.5" /> Terdaftar
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="h-4 px-1.5 text-[9px] gap-0.5 border-muted-foreground/30 text-muted-foreground">
                                <Clock className="w-2.5 h-2.5" /> {r.count}× beli
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {r.phone && <span className="text-[11px] text-muted-foreground font-mono">{r.phone}</span>}
                          {r.email && <span className="text-[11px] text-muted-foreground truncate">{r.email}</span>}
                        </div>
                      </button>
                    )) : (
                      <div className="px-4 py-3 text-center">
                        <p className="text-xs text-muted-foreground">Customer tidak ditemukan — isi manual di bawah.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual fields — always visible for editing */}
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-foreground font-semibold flex items-center gap-1"><User className="w-3 h-3" /> Nama Lengkap <span className="text-destructive">*</span></Label>
                    <Input
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Nama lengkap pembeli..."
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-foreground font-semibold flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</Label>
                      <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="08..." className="h-9 rounded-lg text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-foreground font-semibold flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                      <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="user@mail.com" className="h-9 rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Catatan Tambahan</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Keterangan opsional..." className="h-10 rounded-xl" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t border-border bg-background">
          {step === "choice" ? (
            <Button variant="ghost" onClick={onClose} className="w-full h-11 rounded-xl">Batal</Button>
          ) : step === "selection" ? (
            <>
              <Button variant="outline" onClick={() => setStep("choice")} className="flex-1 h-11 rounded-xl">Kembali</Button>
              <Button onClick={() => setStep("customer")} disabled={selectedUnits.length === 0} className="flex-1 h-11 rounded-xl font-bold">
                Lanjut ({selectedUnits.length} unit)
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(selectedUnits.length > 1 ? "selection" : "choice")} className="flex-1 h-11 rounded-xl" disabled={loading}>Kembali</Button>
              <Button onClick={handleProcessSale} disabled={loading} className="flex-1 h-11 rounded-xl font-bold gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Selesaikan
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
