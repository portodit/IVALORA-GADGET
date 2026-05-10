import { useState, useEffect, useCallback } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Save, Tag, Check, Search, Percent, DollarSign, ChevronLeft, ChevronRight, Truck, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ColorHexInput } from "@/components/ui/color-hex-input";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface FlashSaleSettings {
  id: string;
  is_active: boolean;
  start_time: string;
  duration_hours: number;
  default_discount_type: string;
  default_discount_value: number;
  default_shipping_type: string;
  default_shipping_value: number;
  event_name: string | null;
  gradient_start: string;
  gradient_end: string;
}

interface CatalogProduct {
  id: string;
  display_name: string;
  is_flash_sale: boolean;
  thumbnail_url: string | null;
  flash_sale_discount_type: string | null;
  flash_sale_discount_value: number | null;
  shipping_discount_type: string;
  shipping_discount_value: number | null;
  catalog_series: string | null;
  catalog_warranty_type: string | null;
  stock_count: number;
}

// Series+Storage combo for the new product tab
interface SeriesStorageCombo {
  series: string;
  storage_gb: number;
  warranty_type: string;
  warrantyLabel: string;
  unitCount: number;
  colorCount: number;
  // associated catalog product IDs
  catalogIds: string[];
  // aggregate flash sale state from catalog products
  is_flash_sale: boolean;
  flash_sale_discount_type: string;
  flash_sale_discount_value: number | null;
}

const PAGE_SIZE = 12;

const SHIPPING_OPTIONS = [
  { value: "none", label: "Tidak Ada", desc: "Tanpa subsidi ongkir" },
  { value: "percentage", label: "Persentase", desc: "Subsidi % dari ongkir" },
  { value: "fixed", label: "Potongan Rp", desc: "Potongan nominal tetap" },
  { value: "free", label: "Gratis Ongkir", desc: "100% ditanggung toko" },
] as const;

const WARRANTY_SHORT: Record<string, string> = {
  resmi_bc: "Resmi BC",
  ibox: "iBox",
  inter: "Inter",
  whitelist: "Whitelist",
  digimap: "Digimap",
};

export default function FlashSalePage() {
  const [settings, setSettings] = useState<FlashSaleSettings | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [combos, setCombos] = useState<SeriesStorageCombo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings form
  const [isActive, setIsActive] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState(6);
  const [defaultDiscountType, setDefaultDiscountType] = useState("percentage");
  const [defaultDiscountValue, setDefaultDiscountValue] = useState(0);
  const [defaultShippingType, setDefaultShippingType] = useState("none");
  const [defaultShippingValue, setDefaultShippingValue] = useState(0);
  const [eventName, setEventName] = useState("");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [diskonSaleActive, setDiskonSaleActive] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // Products tab
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [settingsRes, productsRes, masterRes, stockRes, campRes] = await Promise.all([
      db.from("flash_sale_settings").select("*").limit(1).maybeSingle(),
      db.from("catalog_products")
        .select("id, display_name, is_flash_sale, thumbnail_url, flash_sale_discount_type, flash_sale_discount_value, shipping_discount_type, shipping_discount_value, catalog_series, catalog_warranty_type")
        .eq("catalog_status", "published"),
      db.from("master_products").select("id, series, storage_gb, color, warranty_type").eq("is_active", true).is("deleted_at", null),
      db.from("stock_units").select("product_id").eq("stock_status", "available"),
      db.from("sale_campaigns").select("is_active").eq("is_active", true).limit(1),
    ]);

    if (campRes.data && (campRes.data as any[]).length > 0) setDiskonSaleActive(true);

    let s = settingsRes.data as FlashSaleSettings | null;

    // Auto-create default settings row if none exists
    if (!s) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const { data: newRow } = await db.from("flash_sale_settings").insert({
        is_active: false,
        start_time: tomorrow.toISOString(),
        duration_hours: 6,
        default_discount_type: "percentage",
        default_discount_value: 10,
        default_shipping_type: "none",
        default_shipping_value: 0,
        event_name: null,
        gradient_start: "hsl(15 90% 50%)",
        gradient_end: "#f59e0b",
      }).select("*").single();
      s = newRow as FlashSaleSettings | null;
    }

    if (s) {
      setSettings(s);
      setIsActive(s.is_active);
      const d = new Date(s.start_time);
      setStartDate(d.toISOString().split("T")[0]);
      setStartTime(d.toTimeString().slice(0, 5));
      setDurationHours(s.duration_hours);
      setDefaultDiscountType(s.default_discount_type ?? "percentage");
      setDefaultDiscountValue(s.default_discount_value ?? 0);
      setDefaultShippingType(s.default_shipping_type ?? "none");
      setDefaultShippingValue(s.default_shipping_value ?? 0);
      setEventName(s.event_name ?? "");
      setAccentColor(s.gradient_end ?? "#f59e0b");
    }

    const masters: { id: string; series: string; storage_gb: number; color: string; warranty_type: string }[] = masterRes.data ?? [];
    const stockUnits: { product_id: string }[] = stockRes.data ?? [];
    const stockByMaster: Record<string, number> = {};
    for (const su of stockUnits) {
      stockByMaster[su.product_id] = (stockByMaster[su.product_id] ?? 0) + 1;
    }

    const catalogProducts: CatalogProduct[] = ((productsRes.data ?? []) as Omit<CatalogProduct, "stock_count">[]).map(cp => {
      const matchingMasters = masters.filter(m => m.series === cp.catalog_series && (m.warranty_type as string) === cp.catalog_warranty_type);
      let stockCount = 0;
      for (const m of matchingMasters) {
        stockCount += stockByMaster[m.id] ?? 0;
      }
      return { ...cp, stock_count: stockCount };
    });

    setProducts(catalogProducts);

    // Build series+storage combos
    // Group by series+storage+warranty_type
    const comboMap: Record<string, SeriesStorageCombo> = {};
    for (const cp of catalogProducts) {
      if (!cp.catalog_series) continue;
      // Find matching masters for this catalog product
      const matchingMasters = masters.filter(m => m.series === cp.catalog_series && (m.warranty_type as string) === cp.catalog_warranty_type);
      // Group masters by storage
      const storageMap: Record<number, { colors: Set<string>; units: number }> = {};
      for (const m of matchingMasters) {
        if (!storageMap[m.storage_gb]) storageMap[m.storage_gb] = { colors: new Set(), units: 0 };
        storageMap[m.storage_gb].colors.add(m.color);
        storageMap[m.storage_gb].units += stockByMaster[m.id] ?? 0;
      }

      for (const [storageStr, info] of Object.entries(storageMap)) {
        const storage = parseInt(storageStr);
        if (info.units === 0) continue;
        const key = `${cp.catalog_series}-${storage}-${cp.catalog_warranty_type}`;
        if (!comboMap[key]) {
          comboMap[key] = {
            series: cp.catalog_series,
            storage_gb: storage,
            warranty_type: cp.catalog_warranty_type ?? "",
            warrantyLabel: WARRANTY_SHORT[cp.catalog_warranty_type ?? ""] ?? cp.catalog_warranty_type ?? "",
            unitCount: info.units,
            colorCount: info.colors.size,
            catalogIds: [cp.id],
            is_flash_sale: cp.is_flash_sale,
            flash_sale_discount_type: cp.flash_sale_discount_type ?? "percentage",
            flash_sale_discount_value: cp.flash_sale_discount_value ?? null,
          };
        } else {
          comboMap[key].unitCount += info.units;
          comboMap[key].colorCount = Math.max(comboMap[key].colorCount, info.colors.size);
          if (!comboMap[key].catalogIds.includes(cp.id)) comboMap[key].catalogIds.push(cp.id);
          if (cp.is_flash_sale) comboMap[key].is_flash_sale = true;
          if (cp.flash_sale_discount_value && !comboMap[key].flash_sale_discount_value) {
            comboMap[key].flash_sale_discount_type = cp.flash_sale_discount_type ?? "percentage";
            comboMap[key].flash_sale_discount_value = cp.flash_sale_discount_value;
          }
        }
      }
    }

    setCombos(Object.values(comboMap).sort((a, b) => a.series.localeCompare(b.series) || a.storage_gb - b.storage_gb));
    setLoading(false);
  }

  async function handleSaveSettings() {
    if (!settings) {
      toast.error("Data pengaturan belum dimuat. Silakan muat ulang halaman.");
      return;
    }

    // ── Validasi pengisian ──
    if (!startDate) {
      toast.error("Tanggal mulai wajib diisi.");
      return;
    }
    if (!startTime) {
      toast.error("Jam mulai wajib diisi.");
      return;
    }
    if (!durationHours || durationHours < 1) {
      toast.error("Durasi minimal 1 jam.");
      return;
    }
    if (durationHours > 72) {
      toast.error("Durasi maksimal 72 jam.");
      return;
    }

    // ── Validasi tanggal & jam tidak boleh di masa lalu ──
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    if (isNaN(startDateTime.getTime())) {
      toast.error("Format tanggal atau jam tidak valid.");
      return;
    }
    const now = new Date();
    if (startDateTime < now) {
      toast.error(`Tanggal & jam mulai tidak boleh di masa lalu. Sekarang: ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} — pilih waktu setelahnya.`);
      return;
    }

    // ── Validasi diskon/ongkir ──
    if (defaultDiscountType === "percentage" && defaultDiscountValue > 100) {
      toast.error("Diskon persentase maksimal 100%.");
      return;
    }
    if (defaultDiscountValue < 0) {
      toast.error("Nilai diskon tidak boleh negatif.");
      return;
    }
    if (defaultShippingType === "percentage" && defaultShippingValue > 100) {
      toast.error("Subsidi ongkir persentase maksimal 100%.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await db.from("flash_sale_settings").update({
        is_active: isActive,
        start_time: startDateTime.toISOString(),
        duration_hours: durationHours,
        default_discount_type: defaultDiscountType,
        default_discount_value: defaultDiscountValue,
        default_shipping_type: defaultShippingType,
        default_shipping_value: defaultShippingType === "free" ? 100 : defaultShippingValue,
        event_name: eventName || null,
        gradient_start: "hsl(15 90% 50%)",
        gradient_end: accentColor,
      }).eq("id", settings.id);

      if (error) {
        toast.error("Gagal menyimpan: " + error.message);
      } else {
        toast.success("Pengaturan flash sale berhasil disimpan!");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat menyimpan pengaturan.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleComboFlashSale(combo: SeriesStorageCombo) {
    const newVal = !combo.is_flash_sale;
    const update: Record<string, unknown> = { is_flash_sale: newVal };
    if (newVal && defaultDiscountValue > 0) {
      update.flash_sale_discount_type = defaultDiscountType;
      update.flash_sale_discount_value = defaultDiscountValue;
    }
    if (newVal && defaultShippingType !== "none") {
      update.shipping_discount_type = defaultShippingType === "free" ? "percentage" : defaultShippingType;
      update.shipping_discount_value = defaultShippingType === "free" ? 100 : defaultShippingValue;
    }
    if (!newVal) {
      update.flash_sale_discount_value = null;
      update.flash_sale_discount_type = "percentage";
    }

    const { error } = await db.from("catalog_products").update(update).in("id", combo.catalogIds);
    if (error) { toast.error("Gagal mengubah: " + error.message); return; }

    setCombos(prev => prev.map(c =>
      c.series === combo.series && c.storage_gb === combo.storage_gb && c.warranty_type === combo.warranty_type
        ? {
          ...c,
          is_flash_sale: newVal,
          ...(newVal && update.flash_sale_discount_type ? {
            flash_sale_discount_type: update.flash_sale_discount_type as string,
            flash_sale_discount_value: update.flash_sale_discount_value as number,
          } : {}),
          ...((!newVal) ? { flash_sale_discount_value: null, flash_sale_discount_type: "percentage" } : {}),
        }
        : c
    ));
    setProducts(prev => prev.map(p =>
      combo.catalogIds.includes(p.id) ? { ...p, is_flash_sale: newVal, ...(update.flash_sale_discount_type ? { flash_sale_discount_type: update.flash_sale_discount_type as string, flash_sale_discount_value: update.flash_sale_discount_value as number | null } : {}) } : p
    ));
  }

  async function toggleSelectAll() {
    const allSelected = filtered.every(c => c.is_flash_sale);
    const newVal = !allSelected;
    const allCatalogIds = filtered.flatMap(c => c.catalogIds);

    const update: Record<string, unknown> = { is_flash_sale: newVal };
    if (newVal && defaultDiscountValue > 0) {
      update.flash_sale_discount_type = defaultDiscountType;
      update.flash_sale_discount_value = defaultDiscountValue;
    }
    if (newVal && defaultShippingType !== "none") {
      update.shipping_discount_type = defaultShippingType === "free" ? "percentage" : defaultShippingType;
      update.shipping_discount_value = defaultShippingType === "free" ? 100 : defaultShippingValue;
    }
    if (!newVal) {
      update.flash_sale_discount_value = null;
      update.flash_sale_discount_type = "percentage";
    }

    const { error } = await db.from("catalog_products").update(update).in("id", allCatalogIds);
    if (error) { toast.error("Gagal mengubah: " + error.message); return; }

    setCombos(prev => prev.map(c => {
      const isFiltered = filtered.some(f => f.series === c.series && f.storage_gb === c.storage_gb && f.warranty_type === c.warranty_type);
      if (!isFiltered) return c;
      return {
        ...c,
        is_flash_sale: newVal,
        ...(newVal && update.flash_sale_discount_type ? {
          flash_sale_discount_type: update.flash_sale_discount_type as string,
          flash_sale_discount_value: update.flash_sale_discount_value as number,
        } : {}),
        ...((!newVal) ? { flash_sale_discount_value: null, flash_sale_discount_type: "percentage" } : {}),
      };
    }));

    toast.success(newVal
      ? `${filtered.length} produk ditandai sebagai flash sale`
      : `${filtered.length} produk dihapus dari flash sale`
    );
  }

  async function updateComboDiscount(combo: SeriesStorageCombo, type: string, value: number) {
    const { error } = await db.from("catalog_products").update({
      flash_sale_discount_type: type,
      flash_sale_discount_value: value,
    }).in("id", combo.catalogIds);
    if (error) { toast.error("Gagal menyimpan diskon"); return; }
    setCombos(prev => prev.map(c =>
      c.series === combo.series && c.storage_gb === combo.storage_gb && c.warranty_type === combo.warranty_type
        ? { ...c, flash_sale_discount_type: type, flash_sale_discount_value: value }
        : c
    ));
  }

  async function applyBulkDiscount() {
    const flashCombos = combos.filter(c => c.is_flash_sale);
    if (flashCombos.length === 0) { toast.error("Tidak ada produk flash sale"); return; }
    const allIds = flashCombos.flatMap(c => c.catalogIds);
    const update: Record<string, unknown> = {
      flash_sale_discount_type: defaultDiscountType,
      flash_sale_discount_value: defaultDiscountValue,
    };
    if (defaultShippingType !== "none") {
      update.shipping_discount_type = defaultShippingType === "free" ? "percentage" : defaultShippingType;
      update.shipping_discount_value = defaultShippingType === "free" ? 100 : defaultShippingValue;
    }
    const { error } = await db.from("catalog_products").update(update).in("id", allIds);
    if (error) { toast.error("Gagal menerapkan diskon massal"); return; }
    setCombos(prev => prev.map(c => c.is_flash_sale ? {
      ...c,
      flash_sale_discount_type: defaultDiscountType,
      flash_sale_discount_value: defaultDiscountValue,
    } : c));
    toast.success(`Diskon diterapkan ke ${flashCombos.length} produk`);
  }

  async function applyBulkShipping() {
    const flashCombos = combos.filter(c => c.is_flash_sale);
    if (flashCombos.length === 0) { toast.error("Tidak ada produk flash sale"); return; }
    const allIds = flashCombos.flatMap(c => c.catalogIds);
    const shType = defaultShippingType === "free" ? "percentage" : defaultShippingType;
    const shVal = defaultShippingType === "free" ? 100 : defaultShippingValue;
    const { error } = await db.from("catalog_products").update({
      shipping_discount_type: shType,
      shipping_discount_value: shVal,
    }).in("id", allIds);
    if (error) { toast.error("Gagal menerapkan ongkir massal"); return; }
    toast.success(`Subsidi ongkir diterapkan ke ${flashCombos.length} produk`);
  }

  const filtered = combos.filter(c =>
    !search || `${c.series} ${c.storage_gb}GB ${c.warrantyLabel}`.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const flashSaleCount = combos.filter(c => c.is_flash_sale).length;
  const allVisibleSelected = filtered.length > 0 && filtered.every(c => c.is_flash_sale);
  const someVisibleSelected = filtered.some(c => c.is_flash_sale) && !allVisibleSelected;

  useEffect(() => { setPage(1); }, [search]);

  const endTime = startDate && startTime
    ? new Date(new Date(`${startDate}T${startTime}:00`).getTime() + durationHours * 3600000)
    : null;

  if (loading) {
    return (
      <DashboardLayout pageTitle="Flash Sale">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-40 bg-muted rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle="Flash Sale">
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Zap className="w-5 h-5" /> Flash Sale</h1>
          <p className="text-xs text-muted-foreground">Kelola event flash sale, diskon produk, dan subsidi ongkir.</p>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="settings" className="flex-1 gap-2">
              <Zap className="w-4 h-4" /> Pengaturan
            </TabsTrigger>
            <TabsTrigger value="products" className="flex-1 gap-2">
              <Tag className="w-4 h-4" /> Produk
              {flashSaleCount > 0 && (
                <span className="ml-1 text-[10px] bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {flashSaleCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Settings Tab ─────────────────────────────────── */}
          <TabsContent value="settings">
            <div className="bg-card border border-border rounded-2xl p-6 pb-24 space-y-5">
              {/* Active toggle — saves immediately */}
              <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                <div>
                  <p className="text-sm font-medium text-foreground">Aktifkan Flash Sale</p>
                  <p className="text-xs text-muted-foreground">Section flash sale akan tampil di halaman beranda & katalog</p>
                </div>
                <Switch checked={isActive} onCheckedChange={async (val) => {
                  if (val) {
                    // Step 1: Validate product settings
                    const flashCount = combos.filter(c => c.is_flash_sale).length;
                    if (flashCount === 0) {
                      toast.error("Tambahkan minimal 1 produk di tab 'Produk' sebelum mengaktifkan Flash Sale.");
                      return;
                    }
                    if (defaultDiscountValue <= 0 && defaultShippingType === "none") {
                      toast.error("Atur diskon produk atau subsidi ongkir terlebih dahulu di pengaturan.");
                      return;
                    }
                    if (!startDate || !startTime) {
                      toast.error("Atur tanggal & jam mulai terlebih dahulu.");
                      return;
                    }
                    // Step 2: Check Discount Sale conflict
                    if (diskonSaleActive) {
                      setShowConflictDialog(true);
                      return;
                    }
                  }
                  setIsActive(val);
                  if (settings) {
                    const { error } = await db.from("flash_sale_settings").update({ is_active: val }).eq("id", settings.id);
                    if (error) { toast.error("Gagal mengubah status: " + error.message); return; }
                    if (!val) {
                      // Reset: unchecklist all flash sale products
                      const flashIds = products.filter(p => p.is_flash_sale).map(p => p.id);
                      if (flashIds.length > 0) {
                        await db.from("catalog_products").update({
                          is_flash_sale: false,
                          flash_sale_discount_value: null,
                          flash_sale_discount_type: "percentage",
                        }).in("id", flashIds);
                        setProducts(prev => prev.map(p => ({ ...p, is_flash_sale: false, flash_sale_discount_value: null, flash_sale_discount_type: "percentage" })));
                        setCombos(prev => prev.map(c => ({ ...c, is_flash_sale: false, flash_sale_discount_value: null, flash_sale_discount_type: "percentage" })));
                      }
                      toast.success("Flash sale dinonaktifkan & semua produk direset");
                    } else {
                      toast.success("Flash sale diaktifkan!");
                    }
                  }
                }} />
              </div>

              {/* Event name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nama Event Flash Sale</Label>
                <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Flash Sale Special Februari 2026" className="h-10" />
                <p className="text-[10px] text-muted-foreground">Akan ditampilkan sebagai judul di section flash sale landing page</p>
              </div>

              {/* Accent Color — single color */}
              <div className="border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Warna Aksen Section</p>
                <p className="text-xs text-muted-foreground">Warna aksen untuk teks highlight, countdown, dan badge di section flash sale (background tetap hitam)</p>
                <ColorHexInput label="Warna Aksen" value={accentColor} onChange={setAccentColor} />
                <div className="h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, hsl(0 0% 8%) 0%, hsl(0 0% 5%) 100%)` }}>
                  <span style={{ color: accentColor }}>Preview Aksen Warna</span>
                </div>
              </div>

              {/* Start date & time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tanggal Mulai</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Jam Mulai</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-10" />
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Durasi (Jam)</Label>
                <Input type="number" min={1} max={72} value={durationHours}
                  onChange={e => setDurationHours(Number(e.target.value))} className="h-10 max-w-[120px]" />
              </div>

              {/* Preview */}
              {endTime && (
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  <strong>Berakhir:</strong> {endTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} pukul {endTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                </div>
              )}

              {/* Default discount */}
              <div className="border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2"><Tag className="w-4 h-4" /> Diskon Produk Default</p>
                  <p className="text-xs text-muted-foreground">Diskon otomatis diterapkan saat menandai produk sebagai flash sale</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
                    <button onClick={() => setDefaultDiscountType("percentage")}
                      className={cn("px-3 py-2 text-xs font-medium flex items-center gap-1 transition-colors",
                        defaultDiscountType === "percentage" ? "bg-foreground text-background" : "hover:bg-accent text-muted-foreground")}>
                      <Percent className="w-3.5 h-3.5" /> Persen
                    </button>
                    <button onClick={() => setDefaultDiscountType("fixed")}
                      className={cn("px-3 py-2 text-xs font-medium flex items-center gap-1 transition-colors",
                        defaultDiscountType === "fixed" ? "bg-foreground text-background" : "hover:bg-accent text-muted-foreground")}>
                      <DollarSign className="w-3.5 h-3.5" /> Rupiah
                    </button>
                  </div>
                  <Input type="number" min={0} value={defaultDiscountValue}
                    onChange={e => setDefaultDiscountValue(Number(e.target.value))}
                    className="h-10 max-w-[140px]"
                    placeholder={defaultDiscountType === "percentage" ? "10" : "50000"} />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {defaultDiscountType === "percentage" ? "%" : "Rp"}
                  </span>
                </div>
              </div>

              {/* Default shipping discount */}
              <div className="border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2"><Truck className="w-4 h-4" /> Subsidi Ongkir Default</p>
                  <p className="text-xs text-muted-foreground">Subsidi ongkir otomatis diterapkan ke produk flash sale</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SHIPPING_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setDefaultShippingType(opt.value);
                        if (opt.value === "free") setDefaultShippingValue(100);
                        else if (opt.value === "none") setDefaultShippingValue(0);
                      }}
                      className={cn(
                        "rounded-xl border-2 p-3 text-left transition-all",
                        defaultShippingType === opt.value
                          ? "border-foreground bg-foreground/5 ring-1 ring-ring"
                          : "border-border hover:border-foreground/30"
                      )}
                    >
                      <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {(defaultShippingType === "percentage" || defaultShippingType === "fixed") && (
                  <div className="flex items-center gap-3 pt-1">
                    <Input type="number" min={0}
                      max={defaultShippingType === "percentage" ? 100 : undefined}
                      value={defaultShippingValue}
                      onChange={e => setDefaultShippingValue(Number(e.target.value))}
                      className="h-10 max-w-[140px]"
                      placeholder={defaultShippingType === "percentage" ? "50" : "15000"} />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {defaultShippingType === "percentage" ? "% dari total ongkir" : "Rp potongan ongkir"}
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* Fixed footer buttons */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-6 py-3 md:pl-[var(--sidebar-width,280px)]">
              <div className="max-w-4xl mx-auto flex items-center gap-3 flex-wrap">
                <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Pengaturan
                </Button>
                <Button variant="outline" onClick={applyBulkDiscount} className="gap-2">
                  <Tag className="w-4 h-4" /> Terapkan Diskon Default ke Semua
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Products Tab — Card-based series+storage ─────────────────── */}
          <TabsContent value="products">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              {/* Search */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Cari seri, storage…" className="pl-9" />
                </div>
              </div>

              {/* Select all bar + bulk actions */}
              <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/30 flex-wrap gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-80 transition-opacity"
                >
                  <div className={cn(
                    "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                    allVisibleSelected ? "bg-foreground border-foreground" :
                    someVisibleSelected ? "bg-foreground/50 border-foreground" : "border-border"
                  )}>
                    {(allVisibleSelected || someVisibleSelected) && <Check className="w-3 h-3 text-background" />}
                  </div>
                  {allVisibleSelected ? "Batal Pilih Semua" : "Pilih Semua"}
                  <span className="text-xs text-muted-foreground">
                    ({filtered.filter(c => c.is_flash_sale).length}/{filtered.length})
                  </span>
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  {defaultDiscountValue > 0 && (
                    <Button variant="outline" size="sm" onClick={applyBulkDiscount} className="shrink-0 text-xs gap-1">
                      <Tag className="w-3 h-3" /> Terapkan Diskon Massal
                    </Button>
                  )}
                  {defaultShippingType !== "none" && (
                    <Button variant="outline" size="sm" onClick={applyBulkShipping} className="shrink-0 text-xs gap-1">
                      <Truck className="w-3 h-3" /> Terapkan Ongkir Massal
                    </Button>
                  )}
                </div>
              </div>

              {/* Card grid — series+storage combos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {paginated.map(combo => {
                  const isChecked = combo.is_flash_sale;
                  return (
                    <div
                      key={`${combo.series}-${combo.storage_gb}-${combo.warranty_type}`}
                      className={cn(
                        "border rounded-xl p-3 space-y-2 transition-all cursor-pointer",
                        isChecked ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-foreground/30"
                      )}
                      onClick={() => toggleComboFlashSale(combo)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{combo.series} {combo.storage_gb}GB</p>
                          <p className="text-xs text-muted-foreground">{combo.warrantyLabel} · {combo.colorCount} warna · {combo.unitCount} unit</p>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors",
                          isChecked ? "bg-foreground text-background" : "border border-border"
                        )}>
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      {/* Per-combo discount (only when tagged) */}
                      {isChecked && (
                        <div className="pt-1" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Select
                              value={combo.flash_sale_discount_type}
                              onValueChange={v => updateComboDiscount(combo, v, combo.flash_sale_discount_value ?? 0)}
                            >
                              <SelectTrigger className="h-7 text-[10px] w-16"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">%</SelectItem>
                                <SelectItem value="fixed">Rp</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              value={combo.flash_sale_discount_value ?? ""}
                              onChange={e => updateComboDiscount(combo, combo.flash_sale_discount_type, Number(e.target.value))}
                              className="h-7 text-xs flex-1"
                              onClick={e => e.stopPropagation()}
                              placeholder="Nilai"
                            />
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {combo.flash_sale_discount_type === "fixed" ? "potongan" : "% off"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {search ? "Tidak ada produk yang sesuai." : "Belum ada produk katalog yang dipublish."}
                </p>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} produk · Hal {page}/{totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8"
                      disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8"
                      disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Discount Sale Conflict Dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discount Sale Sedang Aktif</AlertDialogTitle>
            <AlertDialogDescription>
              Flash Sale tidak dapat diaktifkan bersamaan dengan Discount Sale. Apakah Anda ingin mematikan Discount Sale dan mengaktifkan Flash Sale?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                // Deactivate discount sale & reset its items
                const { data: campData } = await db.from("sale_campaigns").select("id").eq("is_active", true).limit(1).maybeSingle();
                if (campData) {
                  await db.from("sale_campaigns").update({ is_active: false }).eq("id", campData.id);
                  await db.from("sale_campaign_items").delete().eq("campaign_id", campData.id);
                }
                setDiskonSaleActive(false);
                // Activate flash sale
                setIsActive(true);
                if (settings) {
                  await db.from("flash_sale_settings").update({ is_active: true }).eq("id", settings.id);
                }
                setShowConflictDialog(false);
                toast.success("Discount Sale dimatikan & direset, Flash Sale diaktifkan!");
              }}
            >
              Matikan Discount Sale & Aktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
