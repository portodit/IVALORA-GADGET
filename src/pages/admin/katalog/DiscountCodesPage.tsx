import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useToast } from "@/hooks/shared/use-toast";
import { logActivity } from "@/lib/admin/laporan/activity-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, Plus, Search, Edit3, Trash2, Ticket, Percent, DollarSign,
  ShoppingCart, Tag, AlertCircle, Loader2, Copy, Check, Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscountCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_percent: number | null;
  discount_amount: number | null;
  min_purchase_amount: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  max_uses: number | null;
  used_count: number;
  max_uses_per_user: number | null;
  valid_from: string;
  valid_until: string | null;
  applies_to_all: boolean;
  is_active: boolean;
  cover_packing_kayu: boolean;
}

const DISCOUNT_TYPES = [
  { value: "percentage", label: "Persentase", icon: Percent, hint: "Diskon dalam persen" },
  { value: "fixed_amount", label: "Potongan Tetap", icon: DollarSign, hint: "Diskon nominal Rupiah" },
  { value: "shipping_subsidy", label: "Subsidi Ongkir", icon: Truck, hint: "Potongan biaya ongkir" },
  { value: "buy_x_get_y", label: "Beli X Gratis Y", icon: ShoppingCart, hint: "Beli sejumlah, dapat gratis" },
  { value: "min_purchase", label: "Min. Pembelian", icon: Tag, hint: "Diskon jika melebihi nilai tertentu" },
];

function discountTypeLabel(type: string) {
  return DISCOUNT_TYPES.find(d => d.value === type)?.label ?? type;
}

function formatRupiah(n: number | null | undefined) {
  if (!n) return "—";
  return "Rp" + n.toLocaleString("id-ID");
}

export default function DiscountCodesPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = role === "super_admin";

  const [items, setItems] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<DiscountCode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discType, setDiscType] = useState("percentage");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [minPurchase, setMinPurchase] = useState("");
  const [buyQty, setBuyQty] = useState("");
  const [getQty, setGetQty] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [shippingSubsidyType, setShippingSubsidyType] = useState("percentage"); // percentage | fixed | unlimited
  const [shippingSubsidyAmount, setShippingSubsidyAmount] = useState("");
  const [shippingSubsidyPercent, setShippingSubsidyPercent] = useState("100");
  const [hasMaxCap, setHasMaxCap] = useState(false);
  const [maxDiscountCap, setMaxDiscountCap] = useState("");
  const [isStackable, setIsStackable] = useState(false);
  const [coverPackingKayu, setCoverPackingKayu] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from("discount_codes").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function resetForm() {
    setCode(""); setName(""); setDescription(""); setDiscType("percentage");
    setPercent(""); setAmount(""); setMinPurchase(""); setBuyQty(""); setGetQty("");
    setMaxUses(""); setValidUntil(""); setIsActive(true); setEditItem(null);
    setShippingSubsidyType("percentage"); setShippingSubsidyAmount(""); setShippingSubsidyPercent("100");
    setHasMaxCap(false); setMaxDiscountCap(""); setIsStackable(false); setCoverPackingKayu(false);
  }

  function openAdd() { resetForm(); setModalOpen(true); }
  function openEdit(dc: DiscountCode) {
    setEditItem(dc);
    setCode(dc.code);
    setName(dc.name);
    setDescription(dc.description ?? "");
    setDiscType(dc.discount_type);
    setPercent(dc.discount_percent?.toString() ?? "");
    setAmount(dc.discount_amount?.toString() ?? "");
    setMinPurchase(dc.min_purchase_amount?.toString() ?? "");
    setBuyQty(dc.buy_quantity?.toString() ?? "");
    setGetQty(dc.get_quantity?.toString() ?? "");
    setMaxUses(dc.max_uses?.toString() ?? "");
    setValidUntil(dc.valid_until ? dc.valid_until.slice(0, 16) : "");
    setIsActive(dc.is_active);
    // Shipping subsidy
    if (dc.discount_type === "shipping_subsidy") {
      if ((dc as any).shipping_subsidy_unlimited) {
        setShippingSubsidyType("percentage");
        setShippingSubsidyPercent("100");
      } else if ((dc as any).shipping_subsidy_amount) {
        setShippingSubsidyType("fixed");
        setShippingSubsidyAmount((dc as any).shipping_subsidy_amount?.toString() ?? "");
      } else {
        setShippingSubsidyType("percentage");
        setShippingSubsidyPercent(dc.discount_percent?.toString() ?? "100");
      }
    }
    // Max cap & stackable
    setHasMaxCap(!!(dc as any).max_discount_cap);
    setMaxDiscountCap((dc as any).max_discount_cap?.toString() ?? "");
    setIsStackable(!!(dc as any).is_stackable);
    setCoverPackingKayu(!!(dc as any).cover_packing_kayu);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!code.trim() || !name.trim()) {
      toast({ title: "Kode dan nama wajib diisi", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || null,
      discount_type: discType,
      discount_percent: discType === "percentage" ? Number(percent) || null
        : discType === "shipping_subsidy" && shippingSubsidyType === "percentage" ? Number(shippingSubsidyPercent) || 100
        : null,
      discount_amount: discType === "fixed_amount" ? Number(amount) || null : null,
      min_purchase_amount: minPurchase ? Number(minPurchase) : null,
      buy_quantity: discType === "buy_x_get_y" ? Number(buyQty) || null : null,
      get_quantity: discType === "buy_x_get_y" ? Number(getQty) || null : null,
      max_uses: maxUses ? Number(maxUses) : null,
      valid_until: validUntil || null,
      is_active: isActive,
      created_by: user?.id,
      // Shipping subsidy fields
      shipping_subsidy_amount: discType === "shipping_subsidy" && shippingSubsidyType === "fixed" ? Number(shippingSubsidyAmount) || 0 : 0,
      shipping_subsidy_unlimited: discType === "shipping_subsidy" && shippingSubsidyType === "percentage" && Number(shippingSubsidyPercent) >= 100,
      max_discount_cap: hasMaxCap && maxDiscountCap ? Number(maxDiscountCap) : null,
      is_stackable: isStackable,
      cover_packing_kayu: discType === "shipping_subsidy" ? coverPackingKayu : false,
    };
    let error;
    if (editItem) {
      ({ error } = await db.from("discount_codes").update(payload).eq("id", editItem.id));
    } else {
      ({ error } = await db.from("discount_codes").insert(payload));
    }
    setSaving(false);
    if (error) {
      const msg = error.code === "23505" ? "Kode ini sudah ada, gunakan kode lain." : error.message;
      toast({ title: "Gagal menyimpan", description: msg, variant: "destructive" }); return;
    }
    await logActivity({
      action: editItem ? "update_discount_code" : "create_discount_code",
      actor_id: user?.id, actor_email: user?.email, actor_role: role,
      metadata: { code: code.trim().toUpperCase(), name: name.trim(), type: discType },
    });
    toast({ title: editItem ? "Kode diskon diperbarui" : "Kode diskon berhasil dibuat" });
    setModalOpen(false);
    resetForm();
    fetchItems();
  }

  async function handleDelete(dc: DiscountCode) {
    if (!confirm(`Hapus kode diskon "${dc.code}"?`)) return;
    const { error } = await db.from("discount_codes").delete().eq("id", dc.id);
    if (error) { toast({ title: "Gagal menghapus", variant: "destructive" }); return; }
    toast({ title: "Kode diskon dihapus" });
    fetchItems();
  }

  async function handleDeleteAll() {
    if (!confirm(`Hapus SEMUA ${items.length} kode diskon? Tindakan ini tidak dapat dibatalkan.`)) return;
    const { error } = await db.from("discount_codes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { toast({ title: "Gagal menghapus semua", variant: "destructive" }); return; }
    toast({ title: "Semua kode diskon berhasil dihapus" });
    fetchItems();
  }

  function copyCode(dc: DiscountCode) {
    navigator.clipboard.writeText(dc.code);
    setCopiedId(dc.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const filtered = items.filter(i => {
    const matchSearch = i.code.toLowerCase().includes(search.toLowerCase()) ||
      i.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" ? true : statusFilter === "active" ? i.is_active : !i.is_active;
    return matchSearch && matchStatus;
  });

  function getRuleSummary(dc: DiscountCode) {
    const rules: string[] = [];
    switch (dc.discount_type) {
      case "percentage": rules.push(`Potongan ${dc.discount_percent ?? 0}% dari subtotal`); break;
      case "fixed_amount": rules.push(`Potongan ${formatRupiah(dc.discount_amount)}`); break;
      case "min_purchase": rules.push(`Min. pembelian ${formatRupiah(dc.min_purchase_amount)}, diskon ${dc.discount_percent ? dc.discount_percent + "%" : formatRupiah(dc.discount_amount)}`); break;
      case "shipping_subsidy":
        if ((dc as any).shipping_subsidy_unlimited) rules.push("Gratis ongkir 100%");
        else if ((dc as any).shipping_subsidy_amount) rules.push(`Subsidi ongkir ${formatRupiah((dc as any).shipping_subsidy_amount)}`);
        else if (dc.discount_percent) rules.push(`Diskon ongkir ${dc.discount_percent}%`);
        if (dc.cover_packing_kayu) rules.push("✅ Termasuk packing kayu (Rp25.000)");
        else rules.push("❌ Packing kayu tidak ditanggung");
        break;
      case "buy_x_get_y": rules.push(`Beli ${dc.buy_quantity ?? "?"} gratis ${dc.get_quantity ?? "?"}`); break;
    }
    if ((dc as any).max_discount_cap) rules.push(`Maks potongan ${formatRupiah((dc as any).max_discount_cap)}`);
    if (dc.min_purchase_amount && dc.discount_type !== "min_purchase") rules.push(`Min. belanja ${formatRupiah(dc.min_purchase_amount)}`);
    if ((dc as any).is_stackable) rules.push("🔗 Bisa digabung");
    else rules.push("🚫 Tidak bisa digabung dengan Flash Sale / Discount Sale");
    if (dc.valid_until && new Date(dc.valid_until) < new Date()) rules.push("⏰ KEDALUWARSA");
    return rules;
  }

  return (
    <DashboardLayout pageTitle="Kelola Kode Diskon">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/katalog")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground">Kelola Kode Diskon</h2>
            <p className="text-sm font-medium text-muted-foreground">Buat dan atur kode diskon untuk pelanggan.</p>
          </div>
          {isSuperAdmin && (
            <Button onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" /> Buat Diskon
            </Button>
          )}
        </div>

        {/* Counter + search + delete all */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{items.length} kode diskon</span>
          {isSuperAdmin && items.length > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleDeleteAll}>
              <Trash2 className="w-3 h-3" /> Hapus Semua
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent"
              )}>
              {f === "all" ? "Semua" : f === "active" ? "Aktif" : "Nonaktif"}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kode atau nama diskon…" className="pl-9" />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
            <Ticket className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Belum ada kode diskon</p>
            <p className="text-xs text-muted-foreground">Klik "Buat Diskon" untuk membuat kode diskon baru.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(dc => (
              <div key={dc.id} className={cn(
                "bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all hover:shadow-sm",
                !dc.is_active && "opacity-50"
              )}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Ticket className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => copyCode(dc)} className="font-mono font-bold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1">
                        {dc.code}
                        {copiedId === dc.id ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      </button>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        dc.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {dc.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{dc.name} · {discountTypeLabel(dc.discount_type)}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1 text-[10px] text-muted-foreground">
                      {dc.discount_percent && <span>{dc.discount_percent}%</span>}
                      {dc.discount_amount && <span>{formatRupiah(dc.discount_amount)}</span>}
                      <span>Terpakai: {dc.used_count}/{dc.max_uses ?? "∞"}</span>
                      {dc.valid_until && (
                        <span>Berlaku s/d {new Date(dc.valid_until).toLocaleDateString("id-ID")} {new Date(dc.valid_until).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                    </div>
                    {/* Rule Preview */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {getRuleSummary(dc).map((rule, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{rule}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(dc)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(dc)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">Menampilkan {filtered.length} dari {items.length} kode diskon</p>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={v => { if (!v) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Kode Diskon" : "Buat Kode Diskon Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kode Diskon</label>
                <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="DISKON10" className="font-mono" />
                <p className="text-[10px] text-muted-foreground">Harus unik, otomatis uppercase</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nama</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Diskon Lebaran" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deskripsi <span className="font-normal normal-case">(opsional)</span></label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Keterangan…" className="min-h-[50px] resize-none" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipe Diskon</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DISCOUNT_TYPES.map(dt => (
                  <button key={dt.value} type="button" onClick={() => setDiscType(dt.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all",
                      discType === dt.value ? "border-foreground bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                    )}>
                    <dt.icon className="w-3.5 h-3.5 shrink-0" />
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>

            {discType === "percentage" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Persentase (%)</label>
                <Input type="number" value={percent} onChange={e => setPercent(e.target.value)} placeholder="10" />
              </div>
            )}
            {discType === "fixed_amount" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Potongan (Rp)</label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50000" />
              </div>
            )}
            {discType === "buy_x_get_y" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Beli (X)</label>
                  <Input type="number" value={buyQty} onChange={e => setBuyQty(e.target.value)} placeholder="2" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gratis (Y)</label>
                  <Input type="number" value={getQty} onChange={e => setGetQty(e.target.value)} placeholder="1" />
                </div>
              </div>
            )}
            {discType === "shipping_subsidy" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipe Subsidi Ongkir</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "percentage", label: "Persentase (%)" },
                      { value: "fixed", label: "Nominal Tetap (Rp)" },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => setShippingSubsidyType(opt.value)}
                        className={cn("px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all",
                          shippingSubsidyType === opt.value ? "border-foreground bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                        )}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {shippingSubsidyType === "percentage" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Persentase Subsidi (%)</label>
                    <Input type="number" value={shippingSubsidyPercent} onChange={e => setShippingSubsidyPercent(e.target.value)} placeholder="100" min="1" max="100" />
                    <p className="text-[10px] text-muted-foreground">100 = gratis ongkir 100%</p>
                  </div>
                )}
                {shippingSubsidyType === "fixed" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Potongan Ongkir (Rp)</label>
                    <Input type="number" value={shippingSubsidyAmount} onChange={e => setShippingSubsidyAmount(e.target.value)} placeholder="20000" />
                    <p className="text-[10px] text-muted-foreground">Nilai yang dipotong dari biaya ongkir</p>
                  </div>
                )}
                {/* Cover packing kayu option */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                  <input type="checkbox" checked={coverPackingKayu} onChange={e => setCoverPackingKayu(e.target.checked)} className="w-4 h-4 rounded border-input accent-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Menanggung biaya packing kayu</p>
                    <p className="text-[10px] text-muted-foreground">Jika aktif, subsidi ongkir juga menanggung biaya packing kayu (Rp25.000). Jika tidak, packing kayu tetap dibebankan ke customer.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Max discount cap */}
            <div className="space-y-2 p-3 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={hasMaxCap} onChange={e => setHasMaxCap(e.target.checked)} className="w-4 h-4 rounded border-input accent-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Batasi maksimal potongan</p>
                  <p className="text-[10px] text-muted-foreground">Tentukan batas atas nilai potongan yang berlaku</p>
                </div>
              </div>
              {hasMaxCap && (
                <div className="space-y-1.5 pl-7">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Maks. Potongan (Rp)</label>
                  <Input type="number" value={maxDiscountCap} onChange={e => setMaxDiscountCap(e.target.value)} placeholder="500000" />
                  <p className="text-[10px] text-muted-foreground">Contoh: diskon 10% tapi maks Rp500.000</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Min. Pembelian (Rp) <span className="font-normal normal-case">(opsional)</span></label>
              <Input type="number" value={minPurchase} onChange={e => setMinPurchase(e.target.value)} placeholder="100000" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Maks. Penggunaan</label>
                <Input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Tidak terbatas" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Berlaku Hingga</label>
                <Input type="datetime-local" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>

            {/* Stackable setting */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Bisa digabung dengan diskon lain</p>
                <p className="text-xs text-muted-foreground">Jika aktif, diskon ini bisa disandingkan dengan kode diskon lain</p>
              </div>
              <Switch checked={isStackable} onCheckedChange={setIsStackable} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Status Aktif</p>
                <p className="text-xs text-muted-foreground">Kode aktif dapat digunakan pelanggan</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editItem ? "Simpan" : "Buat Kode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
