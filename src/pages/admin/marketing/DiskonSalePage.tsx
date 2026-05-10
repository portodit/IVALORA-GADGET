import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Percent, Save, Tag, Trash2, Image as ImageIcon, Upload, X, Loader2, Check, Search, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/admin/AuthContext";
import { ColorHexInput } from "@/components/ui/color-hex-input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Campaign {
  id: string;
  campaign_name: string;
  subtitle: string | null;
  description: string | null;
  banner_urls: string[];
  gradient_start: string;
  gradient_end: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  show_popup: boolean;
}

interface CampaignItem {
  id: string;
  campaign_id: string;
  series: string;
  storage_gb: number;
  warranty_type: string;
  discount_type: string;
  discount_value: number;
}

interface ComboInfo {
  series: string;
  storage_gb: number;
  warranty_type: string;
  warrantyLabel: string;
  unitCount: number;
  colorCount: number;
}

const WARRANTY_SHORT: Record<string, string> = {
  resmi_bc: "Resmi BC",
  ibox: "iBox",
  inter: "Inter",
  whitelist: "Whitelist",
  digimap: "Digimap",
};

const PAGE_SIZE = 12;

export default function DiskonSalePage() {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comboInfos, setComboInfos] = useState<ComboInfo[]>([]);

  // Form
  const [campaignName, setCampaignName] = useState("Discount Sale Februari 2026");
  const [subtitle, setSubtitle] = useState("Pricelist Special Berkah Ramadhan");
  const [description, setDescription] = useState("");
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);
  const [accentColor, setAccentColor] = useState("#22c55e");
  const today = new Date().toISOString().split("T")[0];
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState(nextMonth);
  const [endTime, setEndTime] = useState("23:59");
  const [isActive, setIsActive] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Items
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Flash sale conflict check
  const [flashSaleActive, setFlashSaleActive] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [campRes, masterRes, stockRes, fsRes] = await Promise.all([
      db.from("sale_campaigns").select("*").limit(1).maybeSingle(),
      db.from("master_products").select("id, series, storage_gb, color, warranty_type").eq("is_active", true).is("deleted_at", null),
      db.from("stock_units").select("product_id").eq("stock_status", "available"),
      db.from("flash_sale_settings").select("is_active").limit(1).maybeSingle(),
    ]);

    if (fsRes.data) setFlashSaleActive(fsRes.data.is_active ?? false);

    // Build combo infos with unit and color count
    const masters: { id: string; series: string; storage_gb: number; color: string; warranty_type: string }[] = masterRes.data ?? [];
    const stockUnits: { product_id: string }[] = stockRes.data ?? [];
    const stockByMaster: Record<string, number> = {};
    for (const su of stockUnits) {
      stockByMaster[su.product_id] = (stockByMaster[su.product_id] ?? 0) + 1;
    }

    // Group by series + storage + warranty_type
    const cMap: Record<string, { units: number; colors: Set<string>; warranty_type: string }> = {};
    for (const m of masters) {
      const key = `${m.series}|${m.storage_gb}|${m.warranty_type}`;
      if (!cMap[key]) cMap[key] = { units: 0, colors: new Set(), warranty_type: m.warranty_type };
      const uCount = stockByMaster[m.id] ?? 0;
      cMap[key].units += uCount;
      if (uCount > 0) cMap[key].colors.add(m.color);
    }

    const infos: ComboInfo[] = [];
    for (const [key, val] of Object.entries(cMap)) {
      if (val.units === 0) continue;
      const [series, storageStr, wt] = key.split("|");
      infos.push({
        series,
        storage_gb: parseInt(storageStr),
        warranty_type: wt,
        warrantyLabel: WARRANTY_SHORT[wt] ?? wt,
        unitCount: val.units,
        colorCount: val.colors.size,
      });
    }
    setComboInfos(infos.sort((a, b) => a.series.localeCompare(b.series) || a.storage_gb - b.storage_gb || a.warranty_type.localeCompare(b.warranty_type)));

    if (campRes.data) {
      const c = campRes.data as Campaign;
      setCampaign(c);
      setCampaignName(c.campaign_name);
      setSubtitle(c.subtitle ?? "");
      setDescription(c.description ?? "");
      setBannerUrls(c.banner_urls ?? []);
      setAccentColor(c.gradient_start);
      setIsActive(c.is_active);
      setShowPopup(c.show_popup);

      if (c.start_time) {
        const d = new Date(c.start_time);
        setStartDate(d.toISOString().split("T")[0]);
        setStartTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      }
      if (c.end_time) {
        const d = new Date(c.end_time);
        setEndDate(d.toISOString().split("T")[0]);
        setEndTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      }

      const { data: itemData } = await db.from("sale_campaign_items").select("*").eq("campaign_id", c.id);
      if (itemData) setItems(itemData);
    }
    setLoading(false);
  }

  async function handleActivate(active: boolean) {
    if (active && flashSaleActive) {
      setShowConflictDialog(true);
      return;
    }
    setIsActive(active);
    if (campaign) {
      await db.from("sale_campaigns").update({ is_active: active }).eq("id", campaign.id);
      toast.success(`Discount Sale ${active ? "diaktifkan" : "dinonaktifkan"}`);
    }
  }

  async function saveCampaign() {
    setSaving(true);
    try {
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(`${endDate}T${endTime}`);

      const payload = {
        campaign_name: campaignName,
        subtitle,
        description,
        banner_urls: bannerUrls,
        gradient_start: accentColor,
        gradient_end: accentColor, // simplified to same color
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        show_popup: showPopup,
        updated_by: user?.id ?? null,
      };

      if (campaign) {
        const { error } = await db.from("sale_campaigns").update(payload).eq("id", campaign.id);
        if (error) toast.error("Gagal menyimpan: " + error.message);
        else toast.success("Pengaturan Discount Sale berhasil disimpan!");
      } else {
        const { data, error } = await db.from("sale_campaigns").insert({ ...payload, is_active: isActive, created_by: user?.id }).select().single();
        if (error) toast.error("Gagal membuat: " + error.message);
        else { setCampaign(data); toast.success("Campaign Discount Sale berhasil dibuat!"); }
      }
    } catch (err: any) {
      toast.error("Error: " + (err?.message ?? "Unknown error"));
    }
    setSaving(false);
  }

  async function handleUploadBanner(file: File) {
    setUploadingBanner(true);
    try {
      const { uploadFile } = await import("@/lib/upload");
      const result = await uploadFile(file, "products");
      setBannerUrls(prev => [...prev, result.url]);
    } catch (err: any) {
      toast.error("Gagal upload: " + err.message);
    } finally {
      setUploadingBanner(false);
    }
  }

  function removeBanner(idx: number) {
    setBannerUrls(prev => prev.filter((_, i) => i !== idx));
  }

  async function toggleItem(series: string, storage_gb: number, warranty_type: string) {
    if (!campaign) { toast.error("Simpan campaign terlebih dahulu"); return; }
    const existing = items.find(i => i.series === series && i.storage_gb === storage_gb && i.warranty_type === warranty_type);
    if (existing) {
      const { error } = await db.from("sale_campaign_items").delete().eq("id", existing.id);
      if (error) { toast.error("Gagal menghapus"); return; }
      setItems(prev => prev.filter(i => i.id !== existing.id));
    } else {
      const { data, error } = await db.from("sale_campaign_items").insert({
        campaign_id: campaign.id,
        series,
        storage_gb,
        warranty_type,
        discount_type: "fixed",
        discount_value: 500000,
      }).select().single();
      if (error) { toast.error("Gagal menambah: " + error.message); return; }
      setItems(prev => [...prev, data]);
    }
  }

  async function updateItemDiscount(id: string, discount_type: string, discount_value: number) {
    const { error } = await db.from("sale_campaign_items").update({ discount_type, discount_value }).eq("id", id);
    if (error) { toast.error("Gagal menyimpan"); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, discount_type, discount_value } : i));
  }

  async function selectAllCombos() {
    if (!campaign) { toast.error("Simpan campaign terlebih dahulu"); return; }
    const allSelected = filteredCombos.every(c => items.some(i => i.series === c.series && i.storage_gb === c.storage_gb && i.warranty_type === c.warranty_type));
    if (allSelected) {
      const toRemove = items.filter(i => filteredCombos.some(c => c.series === i.series && c.storage_gb === i.storage_gb && c.warranty_type === i.warranty_type));
      if (toRemove.length > 0) {
        const { error } = await db.from("sale_campaign_items").delete().in("id", toRemove.map(i => i.id));
        if (error) { toast.error("Gagal menghapus"); return; }
        setItems(prev => prev.filter(i => !toRemove.some(r => r.id === i.id)));
        toast.success(`${toRemove.length} item dihapus dari diskon`);
      }
    } else {
      const toInsert = filteredCombos
        .filter(c => !items.some(i => i.series === c.series && i.storage_gb === c.storage_gb && i.warranty_type === c.warranty_type))
        .map(c => ({
          campaign_id: campaign.id,
          series: c.series,
          storage_gb: c.storage_gb,
          warranty_type: c.warranty_type,
          discount_type: "fixed",
          discount_value: 500000,
        }));
      if (toInsert.length === 0) return;
      const { data, error } = await db.from("sale_campaign_items").insert(toInsert).select();
      if (error) { toast.error("Gagal menambah: " + error.message); return; }
      setItems(prev => [...prev, ...(data ?? [])]);
      toast.success(`${toInsert.length} item ditambahkan ke diskon`);
    }
  }

  // Global default discount for new items
  const [globalDiscountType, setGlobalDiscountType] = useState<string>("percentage");
  const [globalDiscountValue, setGlobalDiscountValue] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<"settings" | "items" | "banners">("settings");

  async function applyGlobalDiscount() {
    if (!campaign || items.length === 0) { toast.error("Tidak ada item diskon untuk diterapkan"); return; }
    const updates = items.map(i => i.id);
    const { error } = await db.from("sale_campaign_items").update({ discount_type: globalDiscountType, discount_value: globalDiscountValue }).in("id", updates);
    if (error) { toast.error("Gagal menerapkan diskon global"); return; }
    setItems(prev => prev.map(i => ({ ...i, discount_type: globalDiscountType, discount_value: globalDiscountValue })));
    toast.success(`Diskon ${globalDiscountType === "percentage" ? globalDiscountValue + "%" : "Rp " + globalDiscountValue.toLocaleString("id-ID")} diterapkan ke ${items.length} item`);
  }

  // Build flat list with combo info
  const allCombos = comboInfos;

  const filteredCombos = allCombos.filter(c =>
    !search || `${c.series} ${c.storage_gb}GB ${c.warrantyLabel}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredCombos.length / PAGE_SIZE));
  const paginatedCombos = filteredCombos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allVisibleSelected = filteredCombos.length > 0 && filteredCombos.every(c => items.some(i => i.series === c.series && i.storage_gb === c.storage_gb && i.warranty_type === c.warranty_type));
  const someVisibleSelected = filteredCombos.some(c => items.some(i => i.series === c.series && i.storage_gb === c.storage_gb && i.warranty_type === c.warranty_type)) && !allVisibleSelected;

  useEffect(() => { setPage(1); }, [search]);

  if (loading) {
    return (
      <DashboardLayout pageTitle="Discount Sale">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-40 bg-muted rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
      <DashboardLayout pageTitle="Discount Sale">
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Percent className="w-5 h-5" /> Discount Sale</h1>
          <p className="text-xs text-muted-foreground">Kelola campaign discount sale dengan durasi panjang, banner, dan potongan per seri + storage.</p>
        </div>

        {/* Tab switcher — pill style */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/40 w-fit">
          {(["settings", "items", "banners"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2",
                activeTab === tab
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "settings" && <><Percent className="w-3.5 h-3.5" /> Pengaturan</>}
              {tab === "items" && (
                <>
                  <Tag className="w-3.5 h-3.5" /> Item Diskon
                  {items.length > 0 && (
                    <span className={cn(
                      "ml-1 text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold",
                      activeTab === tab ? "bg-background text-foreground" : "bg-foreground text-background"
                    )}>
                      {items.length}
                    </span>
                  )}
                </>
              )}
              {tab === "banners" && (
                <>
                  <ImageIcon className="w-3.5 h-3.5" /> Banner
                  {bannerUrls.length > 0 && (
                    <span className={cn(
                      "ml-1 text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold",
                      activeTab === tab ? "bg-background text-foreground" : "bg-foreground text-background"
                    )}>
                      {bannerUrls.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* ── Settings Tab ─────────────────────── */}
        {activeTab === "settings" && (
          <div className="bg-card border border-border rounded-2xl p-6 pb-24 space-y-5 animate-in fade-in duration-300">
            {/* Active toggle */}
            <div className="flex items-center justify-between p-4 border border-border rounded-xl">
              <div>
                <p className="text-sm font-medium text-foreground">Aktifkan Discount Sale</p>
                <p className="text-xs text-muted-foreground">Campaign akan tampil di landing page & katalog. Menonaktifkan akan mereset semua item diskon.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={handleActivate} />
            </div>

            {/* Name & subtitle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nama Campaign</Label>
                <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Discount Sale Februari 2026" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Subtitle / Label</Label>
                <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Pricelist Special Berkah Ramadhan" className="h-10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Deskripsi (opsional)</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Penjelasan singkat campaign…" className="h-10" />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tanggal Mulai</Label>
                <div className="flex gap-2">
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 flex-1" />
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-10 w-28" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tanggal Berakhir</Label>
                <div className="flex gap-2">
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 flex-1" />
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-10 w-28" />
                </div>
              </div>
            </div>

            {/* Accent color — single */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Warna Aksen Section</p>
              <p className="text-xs text-muted-foreground">Warna aksen untuk badge, teks highlight, dan countdown di section discount sale (background tetap hitam)</p>
              <ColorHexInput value={accentColor} onChange={setAccentColor} />
              <div className="h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ background: `linear-gradient(135deg, hsl(0 0% 8%) 0%, hsl(0 0% 5%) 100%)` }}>
                <span style={{ color: accentColor }}>Preview Aksen Warna</span>
              </div>
            </div>

            {/* Popup */}
            <div className="flex items-center justify-between p-4 border border-border rounded-xl">
              <div>
                <p className="text-sm font-medium text-foreground">Tampilkan Popup Visitor</p>
                <p className="text-xs text-muted-foreground">Popup pemberitahuan diskon saat visitor mengunjungi website</p>
              </div>
              <Switch checked={showPopup} onCheckedChange={setShowPopup} />
            </div>

            {/* Save/Create Button */}
            <div className="pt-2">
              <Button 
                className="w-full h-10 font-bold gap-2" 
                onClick={saveCampaign} 
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : campaign ? (
                  <Save className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {campaign ? "Simpan Perubahan Campaign" : "Buat Campaign Baru"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Items Tab — Card-based with select all ───── */}
        {activeTab === "items" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {!campaign ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center text-sm text-muted-foreground">
                Simpan pengaturan campaign terlebih dahulu sebelum menambah item diskon.
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                  <div className="relative flex-1 w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9 h-10 text-sm"
                      placeholder="Cari seri, storage, garansi…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="h-10 text-xs flex-1 sm:flex-initial" onClick={selectAllCombos}>
                      {allVisibleSelected ? "Unselect Semua Halaman Ini" : "Select Semua Halaman Ini"}
                    </Button>
                  </div>
                </div>

                {/* Global Discount Bar */}
                {items.length > 0 && (
                  <div className="bg-zinc-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4 justify-between shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                        <Tag className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Atur Diskon Massal</p>
                        <p className="text-[10px] text-zinc-400">Terapkan nilai yang sama ke {items.length} item terpilih</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select value={globalDiscountType} onValueChange={setGlobalDiscountType}>
                        <SelectTrigger className="w-[110px] h-9 bg-white/5 border-white/10 text-xs text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Persentase (%)</SelectItem>
                          <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="w-24 h-9 bg-white/5 border-white/10 text-xs text-center text-white"
                        value={globalDiscountValue}
                        onChange={e => setGlobalDiscountValue(Number(e.target.value))}
                      />
                      <Button size="sm" variant="secondary" className="h-9 px-4 text-xs font-bold gap-1.5 bg-green-500 hover:bg-green-600 text-white border-0" onClick={applyGlobalDiscount}>
                        <Check className="w-3.5 h-3.5" /> Terapkan
                      </Button>
                    </div>
                  </div>
                )}

                {/* Card grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginatedCombos.map(combo => {
                    const item = items.find(i => i.series === combo.series && i.storage_gb === combo.storage_gb && i.warranty_type === combo.warranty_type);
                    const isSelected = !!item;

                    return (
                      <div
                        key={`${combo.series}-${combo.storage_gb}-${combo.warranty_type}`}
                        className={cn(
                          "p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3 cursor-pointer",
                          isSelected ? "border-green-500 bg-green-50/30" : "border-border bg-card hover:border-muted-foreground/30"
                        )}
                        onClick={() => toggleItem(combo.series, combo.storage_gb, combo.warranty_type)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-bold leading-tight">{combo.series}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-bold bg-zinc-100 px-1.5 py-0.5 rounded uppercase">{combo.storage_gb}GB</span>
                              <span className="text-[10px] font-bold bg-zinc-100 px-1.5 py-0.5 rounded uppercase">{combo.warrantyLabel}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" /> {combo.unitCount} Unit Tersedia ({combo.colorCount} Warna)
                            </p>
                          </div>
                          <div className={cn(
                            "w-6 h-6 rounded flex items-center justify-center border transition-colors",
                            isSelected ? "bg-green-500 border-green-500" : "border-border"
                          )}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="pt-3 border-t border-green-200/50 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300" onClick={e => e.stopPropagation()}>
                            <Select value={item.discount_type} onValueChange={val => updateItemDiscount(item.id, val, item.discount_value)}>
                              <SelectTrigger className="h-8 w-24 text-[10px] bg-white border-green-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">Persentase (%)</SelectItem>
                                <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="relative flex-1">
                              <Input
                                type="number"
                                className="h-8 text-[10px] pl-2 pr-6 border-green-200 focus-visible:ring-green-500 bg-white"
                                value={item.discount_value}
                                onChange={e => updateItemDiscount(item.id, item.discount_type, Number(e.target.value))}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none">
                                {item.discount_type === "percentage" ? "%" : "Rp"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {filteredCombos.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {search ? "Tidak ada produk yang sesuai dengan pencarian." : "Tidak ada data produk yang tersedia."}
                  </p>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                    <div className="text-[10px] font-bold px-3 py-1 bg-muted rounded-full">Halaman {page} dari {totalPages}</div>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Banners Tab ──────────────────────── */}
        {activeTab === "banners" && (
          <div className="bg-card border border-border rounded-2xl p-6 pb-24 space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground uppercase tracking-widest text-xs font-semibold text-muted-foreground">Banner Campaign (Maks 3)</p>
                <p className="text-xs text-muted-foreground">Rekomendasi ukuran: 1200x675 pixel (16:9). Auto-slider setiap 2 detik.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingBanner} className="gap-1.5 text-xs h-9">
                {uploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload Banner
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadBanner(f); }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bannerUrls.map((url, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-border group aspect-[16/9]">
                  <img src={url} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeBanner(idx)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-md">
                    Banner {idx + 1}
                  </span>
                </div>
              ))}

              {bannerUrls.length < 3 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingBanner}
                  className="aspect-[16/9] rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground"
                >
                  {uploadingBanner ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider">Upload Banner</span>
                </button>
              )}
            </div>

            {bannerUrls.length > 0 && (
              <div className="pt-4 border-t border-border">
                <Button 
                  className="w-full h-10 font-bold gap-2" 
                  onClick={saveCampaign} 
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Perubahan Banner
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flash Sale Conflict Dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flash Sale Sedang Aktif</AlertDialogTitle>
            <AlertDialogDescription>
              Discount Sale tidak dapat diaktifkan bersamaan dengan Flash Sale. Matikan Flash Sale terlebih dahulu, atau tunggu hingga Flash Sale berakhir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mengerti</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                // Auto-deactivate flash sale & reset its products
                await db.from("flash_sale_settings").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
                // Reset flash sale products
                const { data: fsProducts } = await db.from("catalog_products").select("id").eq("is_flash_sale", true);
                if (fsProducts && fsProducts.length > 0) {
                  await db.from("catalog_products").update({
                    is_flash_sale: false,
                    flash_sale_discount_value: null,
                    flash_sale_discount_type: "percentage",
                  }).in("id", fsProducts.map((p: any) => p.id));
                }
                setFlashSaleActive(false);
                setIsActive(true);
                if (campaign) {
                  await db.from("sale_campaigns").update({ is_active: true }).eq("id", campaign.id);
                }
                setShowConflictDialog(false);
                toast.success("Flash Sale dimatikan & direset, Discount Sale diaktifkan!");
              }}
            >
              Matikan Flash Sale & Aktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}