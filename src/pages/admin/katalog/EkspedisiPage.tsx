import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useToast } from "@/hooks/shared/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/shared/SectionCard";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Truck, Package, Search, Settings2, AlertCircle,
  CheckCircle2, XCircle, Loader2, Pencil, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─────────── Types ───────────
interface CourierInfo {
  code: string;
  name: string;
  services: string[];
}
interface ApiKey {
  id: string;
  label: string | null;
  api_key: string;
  is_active: boolean;
  priority: number;
}
interface ShippingSettings {
  id: string;
  packing_kayu_global: number;
  packing_kayu_jawa: number | null;
  packing_kayu_sumatra: number | null;
  packing_kayu_kalimantan: number | null;
  packing_kayu_sulawesi: number | null;
  packing_kayu_ntt: number | null;
  packing_kayu_maluku: number | null;
  packing_kayu_papua: number | null;
  enabled_couriers: string[];
}

// ─────────── Constants ───────────
const SUPPORTED_COURIERS: CourierInfo[] = [
  { code: "jne",      name: "JNE",           services: ["OKE", "REG", "YES", "JTR"] },
  { code: "pos",      name: "POS Indonesia",  services: ["Paket Kilat Khusus", "Express Next Day"] },
  { code: "tiki",     name: "TIKI",           services: ["ECO", "REG", "ONS", "SDS"] },
  { code: "sicepat",  name: "SiCepat",        services: ["REG", "BEST", "CARGO", "GOKIL"] },
  { code: "jnt",      name: "J&T Express",    services: ["EZ", "JSD"] },
  { code: "anteraja", name: "AnterAja",        services: ["Regular", "Next Day", "Same Day"] },
  { code: "ninja",    name: "Ninja Xpress",   services: ["Standard", "Next Day"] },
  { code: "lion",     name: "Lion Parcel",    services: ["REGPACK", "ONEPACK", "JAGOPACK"] },
  { code: "idx",      name: "ID Express",     services: ["STD", "REG"] },
  { code: "rpx",      name: "RPX",            services: ["REG", "MDP", "SDP", "NDP"] },
  { code: "wahana",   name: "Wahana",         services: ["Normal", "Express"] },
  { code: "jet",      name: "JET Express",    services: ["REG", "CRG"] },
];

const ISLANDS: { key: keyof ShippingSettings; label: string; provinces: string }[] = [
  { key: "packing_kayu_jawa",       label: "Jawa & Bali",        provinces: "DKI Jakarta, Jawa Barat, Jawa Tengah, DIY, Jawa Timur, Banten, Bali" },
  { key: "packing_kayu_sumatra",    label: "Sumatera",           provinces: "Aceh, Sumut, Sumbar, Riau, Kep. Riau, Jambi, Bengkulu, Sumsel, Babel, Lampung" },
  { key: "packing_kayu_kalimantan", label: "Kalimantan",         provinces: "Kalbar, Kalteng, Kalsel, Kaltim, Kaltara" },
  { key: "packing_kayu_sulawesi",   label: "Sulawesi",           provinces: "Sulut, Sulteng, Sulsel, Sultra, Gorontalo, Sulbar" },
  { key: "packing_kayu_ntt",        label: "Nusa Tenggara",      provinces: "NTB, NTT" },
  { key: "packing_kayu_maluku",     label: "Maluku",             provinces: "Maluku, Maluku Utara" },
  { key: "packing_kayu_papua",      label: "Papua",              provinces: "Papua, Papua Barat, Papua Tengah, Papua Pegunungan, Papua Selatan" },
];

const DEFAULT_SETTINGS: ShippingSettings = {
  id: "",
  packing_kayu_global: 50000,
  packing_kayu_jawa: null,
  packing_kayu_sumatra: null,
  packing_kayu_kalimantan: null,
  packing_kayu_sulawesi: null,
  packing_kayu_ntt: null,
  packing_kayu_maluku: null,
  packing_kayu_papua: null,
  enabled_couriers: ["jne", "pos", "tiki", "sicepat", "jnt"],
};

// ─────────── Helpers ───────────
function formatRupiah(n: number | null | undefined) {
  if (n == null) return "—";
  return "Rp" + n.toLocaleString("id-ID");
}

// ─────────── Packing Kayu Edit Modal ───────────
function PackingKayuModal({
  open,
  settings,
  onClose,
  onSaved,
}: {
  open: boolean;
  settings: ShippingSettings;
  onClose: () => void;
  onSaved: (updated: Partial<ShippingSettings>) => void;
}) {
  const [global, setGlobal] = useState(settings.packing_kayu_global.toString());
  const [islands, setIslands] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setGlobal(settings.packing_kayu_global.toString());
      const init: Record<string, string> = {};
      ISLANDS.forEach(({ key }) => {
        const val = settings[key] as number | null;
        init[key as string] = val != null ? val.toString() : "";
      });
      setIslands(init);
    }
  }, [open, settings]);

  function handleSave() {
    const updated: Partial<ShippingSettings> = {
      packing_kayu_global: parseInt(global) || 0,
    };
    ISLANDS.forEach(({ key }) => {
      const raw = islands[key as string];
      (updated as Record<string, number | null>)[key as string] = raw.trim() === "" ? null : (parseInt(raw) || 0);
    });
    onSaved(updated);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Ubah Biaya Packing Kayu</DialogTitle>
          <DialogDescription className="text-sm text-zinc-600">
            Kosongkan kolom per-pulau untuk menggunakan harga global.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Global */}
          <div className="space-y-1.5 p-4 rounded-xl border-2 border-zinc-900 bg-zinc-50">
            <label className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Harga Global (semua wilayah)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-500">Rp</span>
              <Input
                type="number"
                value={global}
                onChange={e => setGlobal(e.target.value)}
                className="h-9 text-sm font-semibold"
                min={0}
              />
            </div>
          </div>
          {/* Per-pulau */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Override Per Pulau <span className="font-normal normal-case">(opsional)</span></p>
            {ISLANDS.map(({ key, label, provinces }) => (
              <div key={key as string} className="grid grid-cols-[1fr_160px] gap-3 items-center p-3 rounded-lg border border-zinc-200">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{label}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">{provinces}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-400 font-medium">Rp</span>
                  <Input
                    type="number"
                    placeholder="(global)"
                    value={islands[key as string] ?? ""}
                    onChange={e => setIslands(prev => ({ ...prev, [key as string]: e.target.value }))}
                    className="h-8 text-sm"
                    min={0}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── Main Page ───────────
export default function EkspedisiPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = role === "super_admin";

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ShippingSettings>(DEFAULT_SETTINGS);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [saving, setSaving] = useState(false);

  // Courier search
  const [search, setSearch] = useState("");

  // Info section collapse (default minimized)
  const [infoOpen, setInfoOpen] = useState(false);

  // Packing kayu: false = global, true = per-pulau
  const [perPulauMode, setPerPulauMode] = useState(false);

  // Packing kayu modal
  const [packingModalOpen, setPackingModalOpen] = useState(false);

  // API Key form
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyLabel, setApiKeyLabel] = useState("");
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<"idle" | "valid" | "invalid">("idle");

  // ── Fetch all ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [settingsRes, keysRes] = await Promise.all([
      supabase.from("shipping_settings").select("*").limit(1).single(),
      supabase.from("rajaongkir_api_keys").select("id, label, api_key, is_active, priority").order("priority"),
    ]);
    if (settingsRes.data) setSettings(settingsRes.data as unknown as ShippingSettings);
    setApiKeys((keysRes.data as unknown as ApiKey[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Update shipping settings ──
  async function updateSettings(patch: Partial<ShippingSettings>) {
    if (!settings.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("shipping_settings")
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      return;
    }
    setSettings(prev => ({ ...prev, ...patch }));
    toast({ title: "Pengaturan disimpan" });
  }

  // ── Toggle courier ──
  async function toggleCourier(code: string) {
    const current = settings.enabled_couriers ?? [];
    const next = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];
    await updateSettings({ enabled_couriers: next });
  }

  // ── Validate API Key ──
  const validateApiKey = async (key: string) => {
    setValidatingKey(true);
    setKeyValidationStatus("idle");
    try {
      const res = await fetch("https://api.rajaongkir.com/starter/province?id=1", {
        headers: { key },
      });
      setKeyValidationStatus(res.ok ? "valid" : "invalid");
    } catch {
      setKeyValidationStatus("invalid");
    } finally {
      setValidatingKey(false);
    }
  };

  // ── Add API Key ──
  const addApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    const { error } = await supabase.from("rajaongkir_api_keys").insert({
      api_key: apiKeyInput.trim(),
      label: apiKeyLabel.trim() || "API Key",
      is_active: true,
      priority: apiKeys.length + 1,
    } as never);
    if (error) {
      toast({ title: "Gagal menambahkan API Key", variant: "destructive" });
    } else {
      toast({ title: "API Key berhasil ditambahkan" });
      setApiKeyInput("");
      setApiKeyLabel("");
      setKeyValidationStatus("idle");
      fetchAll();
    }
  };

  // ── Delete API Key ──
  const deleteApiKey = async (id: string) => {
    await supabase.from("rajaongkir_api_keys").delete().eq("id", id);
    toast({ title: "API Key dihapus" });
    fetchAll();
  };

  // ── Derived ──
  const enabledCouriers = new Set(settings.enabled_couriers ?? []);
  const filtered = SUPPORTED_COURIERS.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });
  const activeKeyCount = apiKeys.filter(k => k.is_active).length;

  if (loading) {
    return (
      <DashboardLayout pageTitle="Ekspedisi & Pengiriman">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle="Ekspedisi & Pengiriman">
      <div className="space-y-6 pb-10">

        {/* ── Header ── */}
        <PageHeader
          title="Ekspedisi & Pengiriman"
          subtitle="Kelola jasa pengiriman, API ongkir, dan biaya packing kayu"
        />

        {/* ── 1. Info Cara Kerja Ongkir (collapsible, default minimized) ── */}
        <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
          <button
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
            onClick={() => setInfoOpen(v => !v)}
          >
            <Info className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="flex-1 text-sm font-semibold text-orange-800">Cara Kerja Ongkir</span>
            {infoOpen
              ? <ChevronUp className="w-4 h-4 text-orange-400 shrink-0" />
              : <ChevronDown className="w-4 h-4 text-orange-400 shrink-0" />
            }
          </button>
          {infoOpen && (
            <div className="px-4 pb-4 space-y-1.5 border-t border-orange-200 pt-3">
              <p className="text-sm font-medium text-orange-800 leading-relaxed">
                <span className="font-bold">Origin pengiriman</span> ditentukan oleh dropdown cabang
                di setiap produk katalog — menentukan dari branch mana unit dikirim.
              </p>
              <p className="text-sm font-medium text-orange-800 leading-relaxed">
                Ongkir dihitung otomatis via <span className="font-bold">RajaOngkir</span> berdasarkan
                berat produk, origin cabang, dan alamat tujuan customer.
              </p>
            </div>
          )}
        </div>

        {/* ── 2. API Key RajaOngkir ── */}
        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-zinc-600" />
              <h2 className="text-sm font-bold text-zinc-900">API Key RajaOngkir</h2>
              <Badge
                variant={activeKeyCount > 0 ? "default" : "destructive"}
                className="text-[10px] ml-auto"
              >
                {activeKeyCount > 0 ? `${activeKeyCount} Aktif` : "Belum ada"}
              </Badge>
            </div>

            {/* Existing keys */}
            {apiKeys.length > 0 && (
              <div className="space-y-2">
                {apiKeys.map(k => (
                  <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">{k.label ?? "API Key"}</p>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">
                        {k.api_key.slice(0, 12)}...{k.api_key.slice(-4)}
                      </p>
                    </div>
                    <Badge variant={k.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {k.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                        onClick={() => deleteApiKey(k.id)}
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add new key — 1 baris */}
            {isSuperAdmin && (
              <div className="space-y-2 p-4 rounded-xl border border-dashed border-zinc-300">
                <p className="text-sm font-semibold text-zinc-800">Tambah API Key Baru</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Label (opsional)"
                    value={apiKeyLabel}
                    onChange={e => setApiKeyLabel(e.target.value)}
                    className="h-9 text-sm w-36 shrink-0"
                  />
                  <Input
                    placeholder="API Key RajaOngkir"
                    value={apiKeyInput}
                    onChange={e => { setApiKeyInput(e.target.value); setKeyValidationStatus("idle"); }}
                    className="h-9 text-sm font-mono flex-1 min-w-[160px]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5 shrink-0"
                    disabled={!apiKeyInput.trim() || validatingKey}
                    onClick={() => validateApiKey(apiKeyInput.trim())}
                  >
                    {validatingKey
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Validasi...</>
                      : "Validasi"
                    }
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 text-xs shrink-0"
                    disabled={!apiKeyInput.trim()}
                    onClick={addApiKey}
                  >
                    Tambahkan
                  </Button>
                </div>
                {keyValidationStatus === "valid" && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> API Key valid
                  </span>
                )}
                {keyValidationStatus === "invalid" && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                    <XCircle className="w-3.5 h-3.5" /> API Key tidak valid
                  </span>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 3. Biaya Packing Kayu ── */}
        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-zinc-600" />
                <h2 className="text-sm font-bold text-zinc-900">Biaya Packing Kayu</h2>
              </div>
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setPackingModalOpen(true)}
                  disabled={saving}
                >
                  <Pencil className="w-3 h-3" /> Ubah Harga
                </Button>
              )}
            </div>

            {/* Mode switch: Global vs Per Pulau */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-white">
              <div>
                <p className="text-sm font-bold text-zinc-900">
                  {perPulauMode ? "Harga berbeda per pulau" : "Harga sama semua wilayah"}
                </p>
                <p className="text-xs font-medium text-zinc-500 mt-0.5">
                  {perPulauMode
                    ? "Setiap pulau punya harga sendiri"
                    : `Semua wilayah kena biaya ${formatRupiah(settings.packing_kayu_global)}`
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-xs font-semibold", !perPulauMode ? "text-zinc-900" : "text-zinc-400")}>Global</span>
                <Switch
                  checked={perPulauMode}
                  onCheckedChange={setPerPulauMode}
                />
                <span className={cn("text-xs font-semibold", perPulauMode ? "text-zinc-900" : "text-zinc-400")}>Per Pulau</span>
              </div>
            </div>

            {/* Harga global display */}
            {!perPulauMode && (
              <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-white">
                <p className="text-sm font-semibold text-zinc-700">Harga packing kayu</p>
                <p className="text-xl font-bold text-zinc-900">{formatRupiah(settings.packing_kayu_global)}</p>
              </div>
            )}

            {/* Per-pulau grid — hanya tampil kalau mode per pulau */}
            {perPulauMode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ISLANDS.map(({ key, label, provinces }) => {
                  const val = settings[key] as number | null;
                  const hasOverride = val != null;
                  return (
                    <div key={key as string} className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      hasOverride ? "border-zinc-800 bg-zinc-50" : "border-zinc-200 bg-white"
                    )}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-800">{label}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{provinces}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-bold text-zinc-900">
                          {hasOverride ? formatRupiah(val) : formatRupiah(settings.packing_kayu_global)}
                        </p>
                        {!hasOverride && (
                          <span className="text-[10px] text-zinc-400 font-medium">pakai global</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs font-medium text-zinc-500 leading-relaxed">
              Biaya ini ditambahkan ke total jika customer memilih packing kayu saat checkout.
              RajaOngkir tidak menghitung biaya packing kayu — dikelola manual di sini.
            </p>
          </div>
        </SectionCard>

        {/* ── 4. Daftar Jasa Ekspedisi ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-zinc-600" />
              <h2 className="text-sm font-bold text-zinc-900">Daftar Jasa Ekspedisi</h2>
            </div>
            <span className="text-xs font-medium text-zinc-500">
              {enabledCouriers.size} aktif dari {SUPPORTED_COURIERS.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <Input
              placeholder="Cari ekspedisi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Grid 2 kolom mobile, 3 kolom desktop — compact cards */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {filtered.map(courier => {
                const isEnabled = enabledCouriers.has(courier.code);
                return (
                  <div
                    key={courier.code}
                    className={cn(
                      "bg-white border-2 rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-all",
                      isEnabled ? "border-zinc-800" : "border-zinc-200",
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      isEnabled ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400",
                    )}>
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-900 leading-tight truncate">{courier.name}</p>
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {courier.services.map(svc => (
                          <span
                            key={svc}
                            className="text-[9px] font-semibold px-1 py-0.5 rounded bg-zinc-100 text-zinc-500 uppercase"
                          >
                            {svc}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => isSuperAdmin && toggleCourier(courier.code)}
                      disabled={!isSuperAdmin || saving}
                      className="shrink-0 scale-75"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 gap-2">
              <AlertCircle className="w-8 h-8 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">
                Tidak ditemukan ekspedisi dengan kata kunci tersebut.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Packing Kayu Modal ── */}
      <PackingKayuModal
        open={packingModalOpen}
        settings={settings}
        onClose={() => setPackingModalOpen(false)}
        onSaved={updateSettings}
      />
    </DashboardLayout>
  );
}
