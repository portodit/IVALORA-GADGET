import { useState, useEffect, useCallback, useRef } from "react";
import { useBarcodeScanner } from "@/hooks/admin/use-barcode-scanner";
import { useNavigate } from "react-router-dom";
import {
  Search, ShoppingCart, X, User, UserCheck, CreditCard, Tag,
  ChevronDown, CheckCircle2, Phone, Mail,
  Smartphone, AlertCircle, RefreshCw, ScanLine, Wallet,
  Building2, Banknote, Plus, ChevronRight, MapPin,
  Zap, Hand, ChevronUp, Filter, Truck, Package, Package2, Loader2,
  QrCode, BadgePercent, Handshake, BadgeCheck,
  Laptop, Watch, Tablet, Headphones,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/admin/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SearchableDropdown } from "@/components/shared/SearchableDropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/shared/use-toast";
import { toast as sonnerToast } from "sonner";
import { formatCurrency } from "@/lib/admin/produk/stock-units";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { useProvinces, useRegencies, useDistricts, useVillages } from "@/hooks/admin/use-wilayah";
import { POSCategoryCards } from "@/components/admin/transaksi/POSCategoryCards";
import { AutocompleteDropdown } from "@/components/admin/transaksi/AutocompleteDropdown";
import { FIXED_RESMI_CATEGORIES, CATEGORY_LABELS as CANONICAL_CATEGORY_LABELS } from "@/lib/admin/produk/master-products";
const CANONICAL_CATEGORIES = Object.keys(CANONICAL_CATEGORY_LABELS) as string[];

import { type TransactionType } from "@/types/trade-in";

type CartTab = "unit_masuk" | "keranjang" | "pelanggan" | "pembayaran" | "data_unit";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MasterProduct {
  series: string;
  storage_gb: number;
  color: string;
  warranty_type: string;
  category: string;
}

interface StockUnit {
  id: string;
  imei: string;
  selling_price: number | null;
  condition_status: string;
  minus_severity: string | null;
  minus_description: string | null;
  stock_status: string;
  branch_id: string | null;
  master_products: MasterProduct | MasterProduct[] | null;
}

function getMasterProduct(unit: StockUnit): MasterProduct | null {
  if (!unit.master_products) return null;
  if (Array.isArray(unit.master_products)) return unit.master_products[0] ?? null;
  return unit.master_products;
}

interface AccessoryProduct {
  id: string;           // master_product_id
  name: string;
  selling_price: number; // base_price
  qty_remaining: number;
}

interface CartItem {
  kind: 'unit' | 'accessory';
  unit: StockUnit | null;
  accessory: AccessoryProduct | null;
  label: string;
  expanded: boolean;
  is_negotiated: boolean;
  negotiated_price: number | null;
  final_price: number;
}

const cartItemId = (c: CartItem) => c.kind === 'unit' ? c.unit!.id : c.accessory!.id;

interface BonusItemSimple {
  id: string;
  name: string;
  icon: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
}

interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_percent: number | null;
  discount_amount: number | null;
  min_purchase_amount: number | null;
  applies_to_all: boolean;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  city?: string | null;
  district?: string | null;
}

interface ShippingOption {
  courier: string;
  courierName: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

type CustomerType = "guest" | "registered";
type WarrantyFilter = "all" | "ibox" | "resmi_bc" | "inter" | "whitelist" | "digimap";
type ConditionFilter = "all" | "no_minus" | "minus_minor" | "minus_mayor";
type PaymentMode = "manual" | "online";

const WARRANTY_LABELS: Record<string, string> = {
  all: "Semua Tipe",
  resmi_bc: "Resmi BC",
  ibox: "Resmi iBox",
  inter: "Inter",
  whitelist: "Whitelist",
  digimap: "Digimap",
};

const CONDITION_LABELS: Record<ConditionFilter, string> = {
  all: "Semua Kondisi",
  no_minus: "No Minus",
  minus_minor: "Minus Minor",
  minus_mayor: "Minus Mayor",
};

const PAYMENT_TYPE_ICON: Record<string, React.ElementType> = {
  cash: Banknote,
  bank_transfer: Building2,
  ewallet: Wallet,
  other: CreditCard,
};

// ── DOKU Payment Methods — lengkap sesuai docs.doku.com ──────────────────────
const DOKU_METHODS = [
  // ── Virtual Account ─────────────────────────────────────────────────────────
  { key: "va_bca",     label: "BCA",     fullName: "Bank Central Asia (BCA)",         section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BCA",                 logoUrl: "/kanal/va/bca.png" },
  { key: "va_bni",     label: "BNI",     fullName: "Bank Negara Indonesia (BNI)",      section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BNI",                 logoUrl: "/kanal/va/bni.png" },
  { key: "va_bri",     label: "BRI",     fullName: "Bank Rakyat Indonesia (BRI)",      section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BRI",                 logoUrl: "/kanal/va/bri.png" },
  { key: "va_mandiri", label: "Mandiri", fullName: "Bank Mandiri",                     section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BANK_MANDIRI",        logoUrl: "/kanal/va/mandiri.png" },
  { key: "va_bsi",     label: "BSI",     fullName: "Bank Syariah Indonesia (BSI)",     section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI",logoUrl: "/kanal/va/bsi.png" },
  { key: "va_permata", label: "Permata", fullName: "Bank Permata",                     section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BANK_PERMATA",        logoUrl: "/kanal/va/permata.png" },
  { key: "va_cimb",    label: "CIMB",    fullName: "CIMB Niaga",                       section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BANK_CIMB",           logoUrl: "/kanal/va/cimb.png" },
  { key: "va_danamon", label: "Danamon", fullName: "Bank Danamon",                     section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BANK_DANAMON",        logoUrl: "/kanal/va/danamon.png" },
  { key: "va_btn",     label: "BTN",     fullName: "Bank Tabungan Negara (BTN)",       section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BTN",                 logoUrl: "/kanal/va/btn.png" },
  { key: "va_maybank", label: "Maybank", fullName: "Maybank",                          section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_MAYBANK",             logoUrl: "/kanal/va/maybank.png" },
  { key: "va_bnc",     label: "BNC",     fullName: "Bank Neo Commerce (BNC)",          section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_BNC",                 logoUrl: "/kanal/va/bnc.png" },
  { key: "va_sinarmas",label: "Sinarmas",fullName: "Bank Sinarmas",                   section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_SINARMAS",            logoUrl: "/kanal/va/sinarmas.png" },
  { key: "va_doku",    label: "DOKU",    fullName: "DOKU (Antar Bank)",               section: "va", fee: "Tanpa biaya admin", dokuMethod: "VIRTUAL_ACCOUNT_DOKU",                logoUrl: "/kanal/va/doku.png" },
  // ── PayLater ─────────────────────────────────────────────────────────────────
  { key: "pl_kredivo",  label: "Kredivo",   fullName: "Kredivo",        section: "paylater", fee: "Cicilan 0-24 bulan", dokuMethod: "PEER_TO_PEER_KREDIVO",   logoUrl: "/kanal/paylater/kredivo.png" },
  { key: "pl_briceria", label: "BRI Ceria", fullName: "BRI Ceria",      section: "paylater", fee: "Cicilan tersedia",   dokuMethod: "PEER_TO_PEER_BRI_CERIA", logoUrl: "/kanal/paylater/briceria.png" },
  { key: "pl_akulaku",  label: "Akulaku",   fullName: "Akulaku",        section: "paylater", fee: "Cicilan 3-12 bulan", dokuMethod: "PEER_TO_PEER_AKULAKU",   logoUrl: "/kanal/paylater/akulaku.png" },
  { key: "pl_indodana", label: "Indodana",  fullName: "Indodana",       section: "paylater", fee: "Cicilan tersedia",   dokuMethod: "PEER_TO_PEER_INDODANA",  logoUrl: "/kanal/paylater/indodana.png" },
];

const DOKU_SECTIONS = [
  { key: "va",       label: "Virtual Account" },
  { key: "paylater", label: "PayLater" },
] as const;

function getManualPaymentLogoUrl(pm: { name: string; bank_name: string | null }): string | null {
  const n = (pm.bank_name ?? pm.name).toLowerCase();
  if (n.includes("bca"))      return "/kanal/va/bca.png";
  if (n.includes("bni"))      return "/kanal/va/bni.png";
  if (n.includes("bri") && !n.includes("briceria")) return "/kanal/va/bri.png";
  if (n.includes("mandiri"))  return "/kanal/va/mandiri.png";
  if (n.includes("bsi") || n.includes("syariah")) return "/kanal/va/bsi.png";
  if (n.includes("permata"))  return "/kanal/va/permata.png";
  if (n.includes("cimb"))     return "/kanal/va/cimb.png";
  if (n.includes("danamon"))  return "/kanal/va/danamon.png";
  if (n.includes("btn"))      return "/kanal/va/btn.png";
  if (n.includes("maybank"))  return "/kanal/va/maybank.png";
  if (n.includes("bnc"))      return "/kanal/va/bnc.png";
  if (n.includes("sinarmas")) return "/kanal/va/sinarmas.png";
  if (n.includes("seabank") || n.includes("sea bank")) return "/kanal/va/seabank.png";
  return null;
}

// ── Nego Modal ────────────────────────────────────────────────────────────────
function NegoModal({ unit, open, onClose, onConfirm, initialIsNego, initialPrice }: {
  unit: StockUnit | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (isNego: boolean, negoPrice: number | null) => void;
  initialIsNego?: boolean;
  initialPrice?: number | null;
}) {
  const stockPrice = unit?.selling_price ?? 0;
  const minPrice = Math.ceil(stockPrice * 0.5);
  const [mode, setMode] = useState<"none" | "tanpa_nego" | "nego">("none");
  const [negoPrice, setNegoPrice] = useState(stockPrice);
  const [inputRaw, setInputRaw] = useState(stockPrice.toString());

  useEffect(() => {
    if (open) {
      const initMode = initialIsNego ? "nego" : (initialIsNego === false ? "tanpa_nego" : "none");
      setMode(initMode);
      const initPrice = (initialIsNego && initialPrice != null) ? initialPrice : stockPrice;
      setNegoPrice(initPrice);
      setInputRaw(initPrice.toString());
    }
  }, [open, stockPrice, initialIsNego, initialPrice]);

  const pct = stockPrice > 0 ? Math.round((negoPrice / stockPrice) * 100) : 100;

  const handlePriceInput = (val: string) => {
    setInputRaw(val);
    const num = parseInt(val.replace(/\D/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(num, minPrice), stockPrice);
      setNegoPrice(clamped);
    }
  };

  const handleSlider = (vals: number[]) => {
    const price = Math.round((vals[0] / 100) * stockPrice);
    const clamped = Math.min(Math.max(price, minPrice), stockPrice);
    setNegoPrice(clamped);
    setInputRaw(clamped.toString());
  };

  const handleConfirm = () => {
    if (mode === "tanpa_nego") onConfirm(false, null);
    else if (mode === "nego") onConfirm(true, negoPrice);
  };

  if (!unit) return null;
  const p = getMasterProduct(unit);
  const productName = p ? `${p.series} ${p.storage_gb}GB ${p.color}` : `IMEI: ${unit.imei}`;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm font-bold text-foreground leading-snug">{productName}</DialogTitle>
          <p className="text-[11px] text-muted-foreground font-mono">{unit.imei}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Harga Stok: <span className="font-bold text-foreground">{formatCurrency(stockPrice)}</span></p>
        </DialogHeader>

        <div className="px-5 pb-2 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pilih mode harga:</p>
          <div className="grid grid-cols-2 gap-2">
            {/* Tanpa Nego */}
            <button
              onClick={() => setMode("tanpa_nego")}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-left",
                mode === "tanpa_nego"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-border hover:border-blue-300 bg-card"
              )}
            >
              <BadgeCheck className={cn("w-5 h-5", mode === "tanpa_nego" ? "text-blue-600" : "text-muted-foreground")} />
              <p className={cn("text-xs font-bold", mode === "tanpa_nego" ? "text-blue-700 dark:text-blue-400" : "text-foreground")}>Tanpa Nego</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{formatCurrency(stockPrice)}</p>
              <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full">+ Bonus</span>
            </button>

            {/* Nego */}
            <button
              onClick={() => setMode("nego")}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-left",
                mode === "nego"
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                  : "border-border hover:border-orange-300 bg-card"
              )}
            >
              <Handshake className={cn("w-5 h-5", mode === "nego" ? "text-orange-600" : "text-muted-foreground")} />
              <p className={cn("text-xs font-bold", mode === "nego" ? "text-orange-700 dark:text-orange-400" : "text-foreground")}>Nego</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Tentukan harga</p>
              <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Tanpa Bonus</span>
            </button>
          </div>

          {/* Nego price input */}
          {mode === "nego" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-foreground">Harga Nego</p>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  pct < 75 ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                )}>{pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground shrink-0">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputRaw}
                  onChange={e => handlePriceInput(e.target.value)}
                  onBlur={() => setInputRaw(negoPrice.toString())}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Slider
                min={50} max={100} step={1}
                value={[pct]}
                onValueChange={handleSlider}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>{formatCurrency(minPrice)} (50%)</span>
                <span>{formatCurrency(stockPrice)} (100%)</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-2">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={mode === "none"}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-bold transition-colors",
              mode === "tanpa_nego" ? "bg-blue-600 text-white hover:bg-blue-700" :
              mode === "nego" ? "bg-orange-500 text-white hover:bg-orange-600" :
              "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            Masukkan ke Keranjang
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BankLogo({ url, initials }: { url: string; initials: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-[9px] font-bold text-primary">{initials.slice(0, 3).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={initials}
      onError={() => setFailed(true)}
      className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-border/40 shrink-0"
    />
  );
}

function productLabel(unit: StockUnit): string {
  const p = getMasterProduct(unit);
  if (!p) return `IMEI: ${unit.imei}`;
  if ((p as any).category === 'accessory') return p.series;
  return `${p.series} ${p.storage_gb}GB ${p.color}`;
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ unit, onAdd, inCart, compact, thumbnailUrl, bonusItems, disableClick }: {
  unit: StockUnit;
  onAdd: (unit: StockUnit) => void;
  inCart: boolean;
  compact?: boolean;
  thumbnailUrl?: string | null;
  bonusItems?: BonusItemSimple[];
  disableClick?: boolean;
}) {
  const p = getMasterProduct(unit);
  const label = productLabel(unit);
  const warrantyLabel = WARRANTY_LABELS[p?.warranty_type ?? ""] ?? p?.warranty_type ?? "";
  const isNoMinus = unit.condition_status === "no_minus";
  const categoryLabel = p?.category ? (CANONICAL_CATEGORY_LABELS[p.category as keyof typeof CANONICAL_CATEGORY_LABELS] ?? p.category) : null;
  const [previewOpen, setPreviewOpen] = useState(false);

  if (compact) {
    return (
      <div
        className={cn(
          "bg-card border rounded-xl p-2 flex gap-2 transition-all duration-150",
          disableClick ? "pointer-events-none opacity-60" : "cursor-pointer hover:border-primary/30",
          inCart ? "border-primary/50 bg-primary/[0.04]" : "border-border"
        )}
        onClick={!disableClick ? () => onAdd(unit) : undefined}
      >
        <div
          className="w-12 shrink-0 aspect-[4/5] bg-muted/60 rounded-lg flex items-center justify-center relative overflow-hidden cursor-zoom-in"
          onClick={e => { if (thumbnailUrl) { e.stopPropagation(); setPreviewOpen(true); } }}
        >
          {thumbnailUrl
            ? <img src={thumbnailUrl} alt={label} className="w-full h-full object-cover object-center" />
            : <Smartphone className="w-4 h-4 text-neutral-400" />}
          {inCart && <div className="absolute inset-0 bg-primary/15 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /></div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
          <p className="text-[10px] font-semibold text-foreground leading-tight line-clamp-2">{label}</p>
          <div className="flex flex-wrap gap-0.5">
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20">{warrantyLabel}</span>
            <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border", isNoMinus ? "bg-green-500/10 text-green-700 border-green-500/20" : "bg-orange-500/10 text-orange-700 border-orange-500/20")}>
              {isNoMinus ? "No Minus" : "Minus"}
            </span>
          </div>
          <p className="text-[11px] font-bold text-foreground tabular-nums">{formatCurrency(unit.selling_price)}</p>
        </div>
        {previewOpen && thumbnailUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
            <img src={thumbnailUrl} alt={label} className="max-h-full max-w-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          </div>
        )}
      </div>
    );
  }

  // Non-compact: horizontal — foto 4:5 kiri, info kanan
  return (
    <>
      <div
        className={cn(
          "bg-card border rounded-xl overflow-hidden flex flex-row transition-all duration-150 group",
          disableClick ? "pointer-events-none opacity-60" : "cursor-pointer hover:shadow-sm hover:border-primary/30",
          inCart ? "border-primary/50 bg-primary/[0.04] shadow-sm" : "border-border"
        )}
        onClick={!disableClick ? () => onAdd(unit) : undefined}
      >
        {/* Kiri: foto portrait 4:5, 45% lebar card */}
        <div
          className="w-[45%] shrink-0 aspect-[4/5] bg-muted/60 flex items-center justify-center relative overflow-hidden cursor-zoom-in"
          onClick={e => { if (thumbnailUrl) { e.stopPropagation(); setPreviewOpen(true); } }}
        >
          {thumbnailUrl
            ? <img src={thumbnailUrl} alt={label} className="w-full h-full object-cover object-center" />
            : <Smartphone className="w-8 h-8 text-neutral-300" />}
          {inCart && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-primary drop-shadow" />
            </div>
          )}
        </div>

        {/* Kanan: info */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 p-2.5">
          <p className="text-[11px] font-semibold text-foreground leading-tight line-clamp-3">{label}</p>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20 leading-none self-start">
              {warrantyLabel}
            </span>
            <span className={cn(
              "text-[9px] font-medium px-1.5 py-0.5 rounded-full border leading-none self-start",
              isNoMinus ? "bg-green-500/10 text-green-700 border-green-500/20" : "bg-orange-500/10 text-orange-700 border-orange-500/20"
            )}>
              {isNoMinus ? "No Minus" : "Minus"}
            </span>
            {bonusItems && bonusItems.length > 0 && (
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 leading-none self-start">
                🎁 Ada Bonus
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-foreground tabular-nums mt-auto self-end">{formatCurrency(unit.selling_price)}</p>
        </div>
      </div>

      {/* Full image preview overlay */}
      {previewOpen && thumbnailUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
          <img src={thumbnailUrl} alt={label} className="max-h-full max-w-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// ── Accessory Card ───────────────────────────────────────────────────────────
function AccessoryCard({ acc, onAdd, inCart, compact, thumbnailUrl, disableClick }: {
  acc: AccessoryProduct;
  onAdd: (acc: AccessoryProduct) => void;
  inCart: boolean;
  compact?: boolean;
  thumbnailUrl?: string | null;
  disableClick?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (compact) {
    return (
      <div
        className={cn(
          "bg-card border rounded-xl p-2 flex gap-2 transition-all duration-150",
          disableClick ? "pointer-events-none opacity-60" : "cursor-pointer hover:border-primary/30",
          inCart ? "border-primary/50 bg-primary/[0.04]" : "border-border"
        )}
        onClick={!disableClick ? () => onAdd(acc) : undefined}
      >
        <div
          className="w-12 shrink-0 aspect-[4/5] bg-muted/60 rounded-lg flex items-center justify-center relative overflow-hidden cursor-zoom-in"
          onClick={e => { if (thumbnailUrl) { e.stopPropagation(); setPreviewOpen(true); } }}
        >
          {thumbnailUrl
            ? <img src={thumbnailUrl} alt={acc.name} className="w-full h-full object-cover object-center" />
            : <Package2 className="w-4 h-4 text-neutral-400" />}
          {inCart && <div className="absolute inset-0 bg-primary/15 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /></div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
          <p className="text-[10px] font-semibold text-foreground leading-tight line-clamp-2">{acc.name}</p>
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 border border-violet-500/20 self-start leading-none">Aksesoris</span>
          <p className="text-[11px] font-bold text-foreground tabular-nums">{formatCurrency(acc.selling_price)}</p>
        </div>
        {previewOpen && thumbnailUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
            <img src={thumbnailUrl} alt={acc.name} className="max-h-full max-w-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "bg-card border rounded-xl overflow-hidden flex flex-row transition-all duration-150 group",
          disableClick ? "pointer-events-none opacity-60" : "cursor-pointer hover:shadow-sm hover:border-primary/30",
          inCart ? "border-primary/50 bg-primary/[0.04] shadow-sm" : "border-border"
        )}
        onClick={!disableClick ? () => onAdd(acc) : undefined}
      >
        <div
          className="w-[45%] shrink-0 aspect-[4/5] bg-muted/60 flex items-center justify-center relative overflow-hidden cursor-zoom-in"
          onClick={e => { if (thumbnailUrl) { e.stopPropagation(); setPreviewOpen(true); } }}
        >
          {thumbnailUrl
            ? <img src={thumbnailUrl} alt={acc.name} className="w-full h-full object-cover object-center" />
            : <Package2 className="w-8 h-8 text-neutral-300" />}
          {inCart && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-primary drop-shadow" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 p-2.5">
          <p className="text-[11px] font-semibold text-foreground leading-tight line-clamp-3">{acc.name}</p>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 border border-violet-500/20 leading-none self-start">Aksesoris</span>
            <span className="text-[9px] text-muted-foreground leading-none self-start">Stok: {acc.qty_remaining}</span>
          </div>
          <p className="text-xs font-bold text-foreground tabular-nums mt-auto self-end">{formatCurrency(acc.selling_price)}</p>
        </div>
      </div>
      {previewOpen && thumbnailUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
          <img src={thumbnailUrl} alt={acc.name} className="max-h-full max-w-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// ── Cart Item Row (accordion) ─────────────────────────────────────────────────
function CartItemRow({ item, onRemove, onToggle, onNego, bonusItems }: {
  item: CartItem;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onNego?: (isNego: boolean, negoPrice: number | null) => void;
  bonusItems?: BonusItemSimple[];
}) {
  const isMinus = item.kind === 'unit' && item.unit!.condition_status === "minus";
  const showBonus = item.kind === 'unit' && !item.is_negotiated && bonusItems && bonusItems.length > 0;
  const stockPrice = item.kind === 'unit' ? (item.unit!.selling_price ?? 0) : (item.accessory!.selling_price ?? 0);
  const MAX_DISCOUNT = 100_000;

  const currentDiscount = item.is_negotiated && item.negotiated_price != null
    ? Math.max(0, stockPrice - item.negotiated_price)
    : 0;

  const [negoOpen, setNegoOpen] = useState(false);
  const [discount, setDiscount] = useState(currentDiscount);
  const [discountRaw, setDiscountRaw] = useState(currentDiscount.toString());

  const clampDiscount = (v: number) => Math.min(Math.max(0, v), Math.min(MAX_DISCOUNT, stockPrice));

  const handleDiscountInput = (val: string) => {
    setDiscountRaw(val);
    const num = parseInt(val.replace(/\D/g, ""), 10);
    if (!isNaN(num)) setDiscount(clampDiscount(num));
  };

  const handleOpenNego = () => {
    setDiscount(currentDiscount);
    setDiscountRaw(currentDiscount > 0 ? currentDiscount.toString() : "");
    setNegoOpen(true);
  };

  const handleApplyNego = () => {
    const finalDiscount = clampDiscount(discount);
    if (finalDiscount <= 0) {
      onNego?.(false, null);
    } else {
      onNego?.(true, stockPrice - finalDiscount);
    }
    setNegoOpen(false);
  };

  const handleRemoveNego = () => {
    onNego?.(false, null);
    setNegoOpen(false);
  };

  return (
    <div className={cn(
      "rounded-xl border bg-background overflow-hidden",
      item.is_negotiated ? "border-orange-300 dark:border-orange-700" : "border-border"
    )}>
      <div className="flex items-start gap-3 p-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          item.is_negotiated ? "bg-orange-100 dark:bg-orange-950/40" : "bg-muted"
        )}>
          {item.is_negotiated
            ? <Handshake className="w-4.5 h-4.5 text-orange-600" />
            : <Smartphone className="w-4.5 h-4.5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground leading-snug line-clamp-1" title={item.label}>{item.label}</p>
              {item.kind === 'unit' && item.unit!.imei && item.unit!.imei.trim() !== "" && (
                <div className="flex items-center gap-1.5 mt-1 rounded-md border border-border bg-muted/60 px-2 py-1 cursor-pointer group w-fit max-w-full"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.unit!.imei); }}
                  title="Klik untuk menyalin IMEI"
                >
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">IMEI</span>
                  <span className="font-mono text-xs font-medium text-foreground group-hover:text-primary transition-colors select-all tracking-wide truncate">{item.unit!.imei}</span>
                </div>
              )}
              {item.kind === 'accessory' && (
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">Aksesoris</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {item.kind === 'unit' && (item.is_negotiated ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">Nego</span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">Tanpa Nego</span>
              ))}
              <button
                onClick={() => onRemove(cartItemId(item))}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-sm font-bold text-foreground">{formatCurrency(item.final_price)}</p>
            {item.kind === 'unit' && item.is_negotiated && item.negotiated_price !== null && (
              <p className="text-xs text-muted-foreground line-through">{formatCurrency(item.unit!.selling_price)}</p>
            )}
            {isMinus && (
              <button
                onClick={() => onToggle(cartItemId(item))}
                className="ml-auto text-[10px] font-medium text-orange-600 hover:text-orange-700 flex items-center gap-0.5 transition-colors"
                title="Lihat deskripsi minus"
              >
                Detail <ChevronRight className={cn("w-3 h-3 transition-transform", item.expanded && "rotate-90")} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline nego CTA — shown only when negotiated (edit/remove), or when no bonus items */}
      {onNego && !negoOpen && (item.is_negotiated || !showBonus) && (
        <div className="px-3 pb-2.5 -mt-0.5 flex items-center gap-2.5">
          {item.is_negotiated ? (
            <>
              <button
                onClick={handleOpenNego}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
              >
                Edit Nego (−{formatCurrency(currentDiscount)})
              </button>
              <span className="text-muted-foreground/50 text-xs">·</span>
              <button
                onClick={handleRemoveNego}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Hapus Nego
              </button>
            </>
          ) : (
            <button
              onClick={handleOpenNego}
              className="text-xs font-semibold text-foreground hover:text-foreground/70 transition-colors flex items-center gap-1"
            >
              <Handshake className="w-3.5 h-3.5" /> Jadi Nego
            </button>
          )}
        </div>
      )}

      {/* Inline nego form */}
      {onNego && negoOpen && (
        <div className="px-2.5 pb-2.5 border-t border-border/60 mt-1 bg-orange-50/40 dark:bg-orange-950/10">
          <div className="pt-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground">Diskon Nego</p>
              <p className="text-[9px] text-muted-foreground">maks. Rp 100.000</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={discountRaw}
                onChange={e => handleDiscountInput(e.target.value)}
                onBlur={() => setDiscountRaw(clampDiscount(discount) > 0 ? clampDiscount(discount).toString() : "")}
                placeholder="0"
                autoFocus
                className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {/* Tombol preset diskon nego */}
            <div className="flex gap-1.5">
              {[50_000, 100_000].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { const v = clampDiscount(preset); setDiscount(v); setDiscountRaw(v.toString()); }}
                  className={cn(
                    "flex-1 h-7 rounded-md border text-[11px] font-bold transition-colors",
                    clampDiscount(discount) === preset
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  )}
                >
                  −{preset === 50_000 ? "50rb" : "100rb"}
                </button>
              ))}
            </div>
            {discount > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Harga setelah nego: <span className="font-bold text-foreground">{formatCurrency(stockPrice - clampDiscount(discount))}</span>
              </p>
            )}
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <span>⚠</span> Bonus gratis tidak berlaku saat nego
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setNegoOpen(false)}
                className="flex-1 h-7 rounded-md border border-border text-[10px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleApplyNego}
                className="flex-1 h-7 rounded-md bg-zinc-900 text-white text-[10px] font-bold hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
              >
                {discount > 0 ? "Terapkan Nego" : "Hapus Nego"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus section — horizontal scrollable tiles */}
      {showBonus && (
        <div className="pb-2.5 pt-0">
          <div className="px-3 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              🎁 Ada Bonus
            </span>
            {onNego && !negoOpen && (
              item.is_negotiated ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenNego}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                  >
                    Edit Nego (−{formatCurrency(currentDiscount)})
                  </button>
                  <span className="text-muted-foreground/50 text-xs">·</span>
                  <button
                    onClick={handleRemoveNego}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOpenNego}
                  className="text-xs font-semibold text-foreground hover:text-foreground/70 transition-colors flex items-center gap-1"
                >
                  <Handshake className="w-3.5 h-3.5" /> Jadi Nego
                </button>
              )
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto px-2.5 pb-0.5 scrollbar-hide">
            {bonusItems!.map(b => (
              <div key={b.id} className="flex flex-col items-center shrink-0 w-16 gap-1">
                <div className="w-16 h-16 rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center">
                  {b.icon
                    ? b.icon.startsWith("http")
                      ? <img src={b.icon} alt={b.name} className="w-full h-full object-cover" />
                      : <span className="text-2xl">{b.icon}</span>
                    : <span className="text-lg">🎁</span>}
                </div>
                <p className="text-[10px] font-semibold text-center text-foreground leading-tight line-clamp-2 w-full">{b.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nego-blocked bonus notice */}
      {item.is_negotiated && bonusItems && bonusItems.length > 0 && !negoOpen && (
        <div className="px-2.5 pb-2 pt-0">
          <span className="text-[9px] text-muted-foreground italic">Harga nego — bonus tidak tersedia</span>
        </div>
      )}

      {isMinus && item.expanded && item.kind === 'unit' && (
        <div className="px-2.5 pb-2.5">
          <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-2">
            <p className="text-[9px] font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wider mb-1">
              Kondisi Minus — {item.unit!.minus_severity === "mayor" ? "Mayor" : "Minor"}
            </p>
            <p className="text-[10px] text-orange-700 dark:text-orange-300 leading-relaxed">
              {item.unit!.minus_description ?? "Belum ada laporan minus."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dropdown Filter Component ─────────────────────────────────────────────────
function FilterDropdown<T extends string>({
  value,
  onChange,
  options,
  icon: Icon,
  disabled,
  disabledLabel,
}: {
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string }[];
  icon?: React.ElementType;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find(o => o.value === value);

  if (disabled) {
    return (
      <div className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg border border-border bg-muted/40 text-xs font-medium text-muted-foreground whitespace-nowrap opacity-60 cursor-not-allowed select-none">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {disabledLabel ?? "—"}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "h-8 flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap",
          value !== options[0]?.value
            ? "border-primary bg-primary/5 text-primary font-semibold"
            : "border-border bg-card text-foreground hover:border-primary/40"
        )}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {selected?.label ?? "—"}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-popover border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
          <div className="p-1">
            {options.map(opt => (
              <button
                key={opt.value}
                className={cn("w-full text-left px-3 py-2 text-xs rounded-lg transition-colors", value === opt.value ? "bg-accent font-medium" : "hover:bg-accent")}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PayLater Address Form (wilayah dropdown) ───────────────────────────────────
interface PayLaterAddressFormProps {
  provinces: Array<{ code: string; name: string }>;
  plProvince: string | null; setPlProvince: (v: string | null) => void; setPlProvinceName: (v: string) => void;
  plRegency: string | null; setPlRegency: (v: string | null) => void; setPlRegencyName: (v: string) => void;
  plDistrict: string | null; setPlDistrict: (v: string | null) => void; setPlDistrictName: (v: string) => void;
  plVillage: string | null; setPlVillage: (v: string | null) => void; setPlVillageName: (v: string) => void;
  plRegencies: Array<{ code: string; name: string }>;
  plDistricts: Array<{ code: string; name: string }>;
  plVillages: Array<{ code: string; name: string }>;
  guestAddress: string; setGuestAddress: (v: string) => void;
  guestPostcode: string; setGuestPostcode: (v: string) => void;
}
function PayLaterAddressForm({
  provinces, plProvince, setPlProvince, setPlProvinceName,
  plRegency, setPlRegency, setPlRegencyName,
  plDistrict, setPlDistrict, setPlDistrictName,
  plVillage, setPlVillage, setPlVillageName,
  plRegencies, plDistricts, plVillages,
  guestAddress, setGuestAddress, guestPostcode, setGuestPostcode,
}: PayLaterAddressFormProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Provinsi *</label>
        <SearchableDropdown
          compact
          options={provinces.map(p => ({ id: p.code, name: p.name }))}
          value={plProvince}
          onChange={id => {
            setPlProvince(id); setPlProvinceName(provinces.find(p => p.code === id)?.name || "");
            setPlRegency(null); setPlRegencyName(""); setPlDistrict(null); setPlDistrictName(""); setPlVillage(null); setPlVillageName("");
          }}
          placeholder="Pilih provinsi"
          searchPlaceholder="Cari provinsi..."
          align="left"
          className={cn("w-full", !plProvince ? "[&>button]:border-orange-400" : "")}
          triggerClassName="w-full justify-start"
        />
      </div>
      <div className="space-y-1">
        <label className={cn("text-xs font-medium", !plProvince ? "text-muted-foreground" : "text-foreground")}>Kota/Kabupaten *</label>
        <SearchableDropdown
          compact
          options={plRegencies.map(r => ({ id: r.code, name: r.name }))}
          value={plRegency}
          onChange={id => {
            setPlRegency(id); setPlRegencyName(plRegencies.find(r => r.code === id)?.name || "");
            setPlDistrict(null); setPlDistrictName(""); setPlVillage(null); setPlVillageName("");
          }}
          placeholder={plProvince ? "Pilih kota/kab" : "Pilih provinsi dulu"}
          searchPlaceholder="Cari kota/kab..."
          align="left"
          className={cn("w-full", !plRegency ? "[&>button]:border-orange-400" : "")}
          triggerClassName={cn("w-full justify-start", !plProvince && "opacity-50 pointer-events-none")}
        />
      </div>
      <div className="space-y-1">
        <label className={cn("text-xs font-medium", !plRegency ? "text-muted-foreground" : "text-foreground")}>Kecamatan</label>
        <SearchableDropdown
          compact
          options={plDistricts.map(d => ({ id: d.code, name: d.name }))}
          value={plDistrict}
          onChange={id => {
            setPlDistrict(id); setPlDistrictName(plDistricts.find(d => d.code === id)?.name || "");
            setPlVillage(null); setPlVillageName("");
          }}
          placeholder={plRegency ? "Pilih kecamatan" : "Pilih kota dulu"}
          searchPlaceholder="Cari kecamatan..."
          align="left"
          className="w-full"
          triggerClassName={cn("w-full justify-start", !plRegency && "opacity-50 pointer-events-none")}
        />
      </div>
      <div className="space-y-1">
        <label className={cn("text-xs font-medium", !plDistrict ? "text-muted-foreground" : "text-foreground")}>Kelurahan</label>
        <SearchableDropdown
          compact
          options={plVillages.map(v => ({ id: v.code, name: v.name }))}
          value={plVillage}
          onChange={id => { setPlVillage(id); setPlVillageName(plVillages.find(v => v.code === id)?.name || ""); }}
          placeholder={plDistrict ? "Pilih kelurahan" : "Pilih kecamatan dulu"}
          searchPlaceholder="Cari kelurahan..."
          align="left"
          className="w-full"
          triggerClassName={cn("w-full justify-start", !plDistrict && "opacity-50 pointer-events-none")}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Alamat Jalan *</label>
        <Input value={guestAddress} onChange={e => setGuestAddress(e.target.value)} placeholder="Jl. Contoh No. 123, RT/RW..." className={cn("h-9 text-sm", !guestAddress.trim() ? "border-orange-400" : "")} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Kode Pos</label>
        <Input value={guestPostcode} onChange={e => setGuestPostcode(e.target.value)} placeholder="60000" className="h-9 text-sm w-28" />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function POSPage() {
  const { role, user, activeBranch } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [cartTab, setCartTab] = useState<CartTab>("keranjang");

  // ── Transaction Type (Beli / Tukar Tambah / Jual Putus) ─────────────────
  const [transactionType, setTransactionType] = useState<TransactionType>("beli");

  // ── Unit Masuk Form (Tukar Tambah & Jual Putus) ────────────────────────
  interface UnitMasukForm {
    product_id: string;
    imei: string;
    serial_number: string;
    condition_status: "no_minus" | "minus";
    minus_severity: "minor" | "mayor" | null;
    minus_description: string;
    harga_sepakat: number;
    notes: string;
  }
  const [unitMasuk, setUnitMasuk] = useState<UnitMasukForm | null>(null);
  const [unitMasukProducts, setUnitMasukProducts] = useState<MasterProduct[]>([]);
  const [unitMasukProductSearch, setUnitMasukProductSearch] = useState("");
  const [unitMasukProductDropdownOpen, setUnitMasukProductDropdownOpen] = useState(false);
  const [selectedUnitMasukProduct, setSelectedUnitMasukProduct] = useState<MasterProduct | null>(null);
  const [unitMasukImeiChecking, setUnitMasukImeiChecking] = useState(false);
  const [unitMasukImeiError, setUnitMasukImeiError] = useState<string | null>(null);

  // Branch selection
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // Product list
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [rawUnits, setRawUnits] = useState<StockUnit[]>([]); // unfiltered, re-fetch only on branch change
  const [accessories, setAccessories] = useState<AccessoryProduct[]>();
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSeries, setFilterSeries] = useState("all");
  const [filterWarranty, setFilterWarranty] = useState<WarrantyFilter>("all");
  const [filterCondition, setFilterCondition] = useState<ConditionFilter>("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [seriesByCategory, setSeriesByCategory] = useState<Record<string, string[]>>({});
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categoryUnitCounts, setCategoryUnitCounts] = useState<Record<string, number>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  useBarcodeScanner(searchInputRef, { enabled: true });

  // Catalog thumbnails by series
  const [seriesThumbnails, setSeriesThumbnails] = useState<Record<string, string>>({});

  // Bonus data: category → list of bonus items
  const [categoryBonusMap, setCategoryBonusMap] = useState<Record<string, BonusItemSimple[]>>({});

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer
  const [customerType, setCustomerType] = useState<CustomerType>("guest");
  const [guestIsReturning, setGuestIsReturning] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [guestProvince, setGuestProvince] = useState("");
  const [guestPostcode, setGuestPostcode] = useState("");
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const [guestSearchResults, setGuestSearchResults] = useState<Array<{ customer_name: string; customer_email: string | null; customer_phone: string | null; count: number }>>([]);
  const [searchingGuest, setSearchingGuest] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regCustomer, setRegCustomer] = useState<{ id: string; name: string; email: string } | null>(null);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);

  // Shipping
  const [needsShipping, setNeedsShipping] = useState(false);
  const [province, setProvince] = useState<string | null>(null);
  const [provinceName, setProvinceName] = useState("");
  const [regency, setRegency] = useState<string | null>(null);
  const [regencyName, setRegencyName] = useState("");
  const [district, setDistrict] = useState<string | null>(null);
  const [districtName, setDistrictName] = useState("");
  const [village, setVillage] = useState<string | null>(null);
  const [villageName, setVillageName] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [packingKayu, setPackingKayu] = useState(false);

  // PayLater address wilayah state (terpisah dari shipping)
  const [plProvince, setPlProvince] = useState<string | null>(null);
  const [plProvinceName, setPlProvinceName] = useState("");
  const [plRegency, setPlRegency] = useState<string | null>(null);
  const [plRegencyName, setPlRegencyName] = useState("");
  const [plDistrict, setPlDistrict] = useState<string | null>(null);
  const [plDistrictName, setPlDistrictName] = useState("");
  const [plVillage, setPlVillage] = useState<string | null>(null);
  const [plVillageName, setPlVillageName] = useState("");

  // Shipping address mode: "paylater" = salin dari PayLater, "custom" = input terpisah
  const [shippingAddressMode, setShippingAddressMode] = useState<"paylater" | "custom">("custom");

  // PayLater address form visibility toggle
  const [showPlAddressForm, setShowPlAddressForm] = useState(false);

  // Resizable cart panel width (desktop only)
  const [cartPanelWidth, setCartPanelWidth] = useState(480);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(480);

  // Saved addresses dari customer_addresses (untuk registered customer)
  type SavedAddress = {
    id: string; label: string; full_address: string;
    province_name: string; regency_name: string; district_name: string; village_name: string;
    province_code: string; regency_code: string; district_code: string; village_code: string;
    postal_code: string;
  };
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  // Saved guest addresses (by email — no account needed)
  type GuestSavedAddress = {
    id: string; label: string | null; recipient_name: string; phone: string;
    full_address: string; province_name: string; regency_name: string;
    district_name: string; village_name: string; postal_code: string | null;
  };
  const [savedGuestAddresses, setSavedGuestAddresses] = useState<GuestSavedAddress[]>([]);

  // Wilayah hooks — shipping
  const { data: provinces, loading: provLoading } = useProvinces();
  const { data: regencies, loading: regLoading } = useRegencies(province);
  const { data: districts, loading: distLoading } = useDistricts(regency);
  const { data: villages, loading: vilLoading } = useVillages(district);

  // Wilayah hooks — PayLater
  const { data: plRegencies } = useRegencies(plProvince);
  const { data: plDistricts } = useDistricts(plRegency);
  const { data: plVillages } = useVillages(plDistrict);

  // Payment
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("online");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>("");
  const [selectedDokuCategory, setSelectedDokuCategory] = useState<string>("");
  const [openDokuSections, setOpenDokuSections] = useState<Set<string>>(new Set());
  const [dokuSearch, setDokuSearch] = useState("");
  const [enabledDokuKeys, setEnabledDokuKeys] = useState<Set<string> | null>(null);
  const [dokuChannelLimits, setDokuChannelLimits] = useState<Map<string, { min: number; max: number | null }>>(new Map());

  // Split payment
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitChannels, setSplitChannels] = useState<Array<{ mode: PaymentMode; dokuKey: string; manualId: string; search: string; amount: string; includeFee: boolean }>>([
    { mode: "online", dokuKey: "", manualId: "", search: "", amount: "", includeFee: true },
    { mode: "manual", dokuKey: "", manualId: "", search: "", amount: "", includeFee: true },
  ]);
  const updateSplitChannel = (idx: number, patch: Partial<{ mode: PaymentMode; dokuKey: string; manualId: string; search: string; amount: string; includeFee: boolean }>) =>
    setSplitChannels(prev => prev.map((ch, i) => i === idx ? { ...ch, ...patch } : ch));
  const [openSplitDropdown, setOpenSplitDropdown] = useState<number | null>(null);
  useEffect(() => {
    if (openSplitDropdown === null) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-split-dropdown]")) setOpenSplitDropdown(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openSplitDropdown]);

  // Fee admin
  const [waiveFeeAdmin, setWaiveFeeAdmin] = useState(false);

  // Discount
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  // Transaction
  const [processingTx, setProcessingTx] = useState(false);
  // Background VA wait — buka DOKU di tab baru, poll sampai VA muncul
  const [waitingForVa, setWaitingForVa] = useState(false);
  const [waitingTxId, setWaitingTxId] = useState<string | null>(null);
  const [waitingTxCode, setWaitingTxCode] = useState<string | null>(null);
  const [vaWaitSeconds, setVaWaitSeconds] = useState(0);
  const VA_WAIT_TIMEOUT = 45; // detik — setelah ini redirect tanpa VA

  // ── Poll DB untuk VA setelah link DOKU dibuka di background ────────────────
  useEffect(() => {
    if (!waitingForVa || !waitingTxId) return;

    let elapsed = 0;
    const ticker = setInterval(() => {
      elapsed += 2;
      setVaWaitSeconds(elapsed);
    }, 2000);

    const doNavigate = () => {
      clearInterval(poller);
      clearInterval(ticker);
      setWaitingForVa(false);
      setWaitingTxId(null);
      setWaitingTxCode(null);
      setVaWaitSeconds(0);
      navigate(`/admin/transaksi/${waitingTxId}`);
    };

    const poller = setInterval(async () => {
      // 1. Cek DB langsung
      const { data } = await supabase
        .from("transactions" as never)
        .select("doku_va_number, transaction_code")
        .eq("id", waitingTxId)
        .single() as { data: { doku_va_number: string | null; transaction_code: string | null } | null };

      if (data?.doku_va_number) { doNavigate(); return; }

      // 2. Setiap 8 detik, panggil doku-check-order supaya VA di-pull dari DOKU API
      if (elapsed > 0 && elapsed % 8 === 0 && data?.transaction_code) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doku-check-order`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ invoiceNumber: data.transaction_code, transactionId: waitingTxId }),
            }
          );
          // Poll DB lagi setelah check
          const { data: d2 } = await supabase
            .from("transactions" as never)
            .select("doku_va_number")
            .eq("id", waitingTxId)
            .single() as { data: { doku_va_number: string | null } | null };
          if (d2?.doku_va_number) { doNavigate(); return; }
        } catch { /* abaikan error check-order */ }
      }

      if (elapsed >= VA_WAIT_TIMEOUT) doNavigate();
    }, 2000);

    return () => { clearInterval(poller); clearInterval(ticker); };
  }, [waitingForVa, waitingTxId]);

  useEffect(() => {
    // Query is_enabled dulu — ini yang wajib, menentukan channel apa yang tampil
    supabase
      .from("doku_payment_channels")
      .select("channel_key, is_enabled")
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          type EnabledRow = { channel_key: string; is_enabled: boolean };
          const rows = data as EnabledRow[];
          const keys = new Set(rows.filter(r => r.is_enabled).map(r => r.channel_key));
          setEnabledDokuKeys(keys);
        } else {
          // Kalau gagal atau kosong, set empty set (tidak ada channel yang aktif)
          // bukan null — null berarti "belum load, tampilkan semua"
          setEnabledDokuKeys(new Set());
        }
      });
    // Query min/max amount terpisah — opsional, tidak block channel filter
    supabase
      .from("doku_payment_channels")
      .select("channel_key, min_amount, max_amount")
      .then(({ data }) => {
        if (data && data.length > 0) {
          type LimitRow = { channel_key: string; min_amount: number | null; max_amount: number | null };
          const rows = data as LimitRow[];
          setDokuChannelLimits(new Map(rows.map(r => [r.channel_key, { min: r.min_amount ?? 1, max: r.max_amount ?? null }])));
        }
      });
  }, []);

  const filteredDokuMethods = enabledDokuKeys !== null
    ? DOKU_METHODS.filter(m => m.key === "all" || enabledDokuKeys.has(m.key))
    : DOKU_METHODS;

  /** Cek apakah kanal DOKU tidak tersedia untuk amount tertentu berdasarkan min/max dari DB */
  const getDokuChannelStatus = useCallback((key: string, amount: number) => {
    const limits = dokuChannelLimits.get(key);
    if (!limits) return { belowMin: false, aboveMax: false, min: 1, max: null as number | null };
    return {
      belowMin: limits.min > 1 && amount < limits.min,
      aboveMax: limits.max !== null && amount > limits.max,
      min: limits.min,
      max: limits.max,
    };
  }, [dokuChannelLimits]);

  // Auto-expand the DOKU section that contains the selected method
  useEffect(() => {
    if (!selectedDokuCategory) return;
    const method = filteredDokuMethods.find(m => m.key === selectedDokuCategory);
    if (!method) return;
    setOpenDokuSections(prev => {
      if (prev.has(method.section)) return prev;
      return new Set([...prev, method.section]);
    });
  }, [selectedDokuCategory]);

  // ── Init branch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (role === "super_admin") {
      supabase
        .from("branches")
        .select("id, name, code, city, district")
        .eq("is_active", true)
        .order("name")
        .then(({ data }) => {
          const bs = (data as Branch[]) ?? [];
          setAllBranches(bs);
          if (!selectedBranch && bs.length > 0) {
            setSelectedBranch(activeBranch as Branch ?? bs[0]);
          }
        });
    } else {
      if (activeBranch && !selectedBranch) {
        // Set immediately so fetchUnits doesn't wait for DB round-trip
        setSelectedBranch(activeBranch as Branch);
        // Fetch city/district in background for shipping origin
        supabase.from("branches").select("id, name, code, city, district").eq("id", (activeBranch as Branch).id).single().then(({ data }) => {
          if (data) setSelectedBranch(data as Branch);
        });
      }
    }
  }, [role, activeBranch]);

  // ── Fetch payment methods ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedBranch?.id) return;
    supabase
      .from("payment_methods" as never)
      .select("id, name, type, bank_name, account_number, account_name")
      .eq("branch_id", selectedBranch.id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        setPaymentMethods((data as PaymentMethod[]) ?? []);
        setSelectedPaymentId("");
      });
  }, [selectedBranch]);

  // ── Fetch series & categories ─────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("master_products")
      .select("series, category")
      .is("deleted_at", null)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          // Group series by category
          const byCategory: Record<string, string[]> = {};
          data.forEach((d: { series: string; category: string }) => {
            const cat = d.category?.trim().toLowerCase();
            if (!cat) return;
            if (!byCategory[cat]) byCategory[cat] = [];
            if (!byCategory[cat].includes(d.series)) byCategory[cat].push(d.series);
          });
          Object.keys(byCategory).forEach(k => byCategory[k].sort());
          setSeriesByCategory(byCategory);

          // Merge DB categories with canonical list, preserve canonical order
          const dbCats = Array.from(new Set(data.map((d: { category?: string }) => d.category).filter(Boolean))) as string[];
          const merged = [
            ...CANONICAL_CATEGORIES.filter(c => dbCats.includes(c) || true), // always show canonical
            ...dbCats.filter(c => !CANONICAL_CATEGORIES.includes(c)),         // add any non-canonical extras
          ];
          setAllCategories(merged);
        }
      });
  }, []);

  // ── Fetch catalog thumbnails ──────────────────────────────────────────────
  useEffect(() => {
    (supabase as any)
      .from("catalog_products")
      .select("catalog_series, thumbnail_url")
      .not("thumbnail_url", "is", null)
      .then(({ data }: { data: any[] | null }) => {
        if (data) {
          const map: Record<string, string> = {};
          for (const d of data) {
            if (d.catalog_series && d.thumbnail_url && !map[d.catalog_series]) {
              map[d.catalog_series] = d.thumbnail_url;
            }
          }
          setSeriesThumbnails(map);
        }
      });
  }, []);


  // ── Fetch products for Unit Masuk form (iPhone default for tukar tambah) ──
  const fetchUnitMasukProducts = useCallback(async () => {
    const categoryFilter = transactionType === "jual_putus" ? "" : "iphone";
    let q = supabase
      .from("master_products")
      .select("series, storage_gb, color, warranty_type, category")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("series");
    if (categoryFilter) q = q.eq("category", categoryFilter);
    const { data } = await q;
    setUnitMasukProducts((data as MasterProduct[]) ?? []);
  }, [transactionType]);

  useEffect(() => { fetchUnitMasukProducts(); }, [fetchUnitMasukProducts]);

  // ── Unit Masuk IMEI uniqueness check (debounced) ───────────────────────
  useEffect(() => {
    const imei = unitMasuk?.imei;
    if (!imei || imei.length < 14) { setUnitMasukImeiError(null); return; }
    const t = setTimeout(async () => {
      setUnitMasukImeiChecking(true);
      const { data } = await supabase.from("stock_units").select("id").eq("imei", imei).maybeSingle();
      setUnitMasukImeiChecking(false);
      setUnitMasukImeiError(data ? "IMEI sudah terdaftar dalam sistem." : null);
    }, 500);
    return () => clearTimeout(t);
  }, [unitMasuk?.imei]);

  // ── Fetch units ───────────────────────────────────────────────────────────
  // Fetch from DB only when branch changes — filters applied in memory below
  const fetchUnits = useCallback(async () => {
    if (!selectedBranch?.id) return;
    setLoadingUnits(true);
    const { data } = await supabase
      .from("stock_units")
      .select("id, imei, selling_price, condition_status, minus_severity, minus_description, stock_status, branch_id, master_products(series, storage_gb, color, warranty_type, category, is_active)")
      .eq("stock_status", "available")
      .or(`branch_id.eq.${selectedBranch.id},branch_id.is.null`)
      .order("received_at", { ascending: false });

    const active = ((data as StockUnit[]) ?? []).filter(u => {
      const mp = getMasterProduct(u);
      return mp != null && (mp as any).is_active !== false && (mp as any).category !== 'accessory';
    });

    setRawUnits(active);
    setLoadingUnits(false);
  }, [selectedBranch?.id]);

  // ── Fetch accessories ─────────────────────────────────────────────────────
  const fetchAccessories = useCallback(async () => {
    const [summaryRes, priceRes] = await Promise.all([
      (supabase as any).from("accessory_stock_summary").select("master_product_id, name, qty_remaining").gt("qty_remaining", 0),
      (supabase as any).from("master_products").select("id, base_price").eq("category", "accessory").eq("is_active", true).is("deleted_at", null),
    ]);
    const priceMap = new Map((priceRes.data ?? []).map((p: any) => [p.id, p.base_price ?? 0]));
    setAccessories((summaryRes.data ?? []).map((d: any) => ({
      id: d.master_product_id,
      name: d.name,
      selling_price: priceMap.get(d.master_product_id) ?? 0,
      qty_remaining: d.qty_remaining,
    })));
  }, []);

  // Apply all UI filters in memory — no DB round-trip on every keystroke/filter change
  useEffect(() => {
    let filtered = [...rawUnits];

    // Compute per-category counts from unfiltered raw data
    const counts: Record<string, number> = {};
    rawUnits.forEach(u => {
      const cat = (getMasterProduct(u)?.category ?? "").trim().toLowerCase();
      if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
    });
    setCategoryUnitCounts(counts);

    if (filterCondition === "no_minus") {
      filtered = filtered.filter(u => u.condition_status === "no_minus");
    } else if (filterCondition === "minus_minor") {
      filtered = filtered.filter(u => u.condition_status === "minus" && u.minus_severity === "minor");
    } else if (filterCondition === "minus_mayor") {
      filtered = filtered.filter(u => u.condition_status === "minus" && u.minus_severity === "mayor");
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u => {
        const mp = getMasterProduct(u);
        return (
          u.imei?.toLowerCase().includes(q) ||
          mp?.series?.toLowerCase().includes(q) ||
          mp?.color?.toLowerCase().includes(q) ||
          mp?.storage_gb?.toString().includes(q)
        );
      });
    }

    if (filterSeries !== "all") {
      filtered = filtered.filter(u => getMasterProduct(u)?.series?.toLowerCase().includes(filterSeries.toLowerCase()));
    }

    if (filterWarranty !== "all") {
      filtered = filtered.filter(u => getMasterProduct(u)?.warranty_type === filterWarranty);
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter(u =>
        (getMasterProduct(u)?.category ?? "").trim().toLowerCase() === filterCategory.trim().toLowerCase()
      );
    }

    setUnits(filtered);
  }, [rawUnits, search, filterSeries, filterWarranty, filterCondition, filterCategory]);

  useEffect(() => { fetchUnits(); fetchAccessories(); }, [fetchUnits, fetchAccessories]);

  // ── Fetch bonus rules ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [{ data: rules }, { data: items }] = await Promise.all([
        supabase.from("bonus_rules" as never).select("*").eq("is_active", true),
        supabase.from("bonus_items" as never).select("id, name, icon").eq("is_active", true),
      ]) as [{ data: Array<{ bonus_item_id: string; scope_type: string; category: string | null; is_active: boolean }> | null }, { data: BonusItemSimple[] | null }];

      const itemMap = new Map((items ?? []).map(i => [i.id, i]));
      const map: Record<string, BonusItemSimple[]> = {};
      for (const rule of (rules ?? [])) {
        if (rule.scope_type === "category" && rule.category) {
          if (!map[rule.category]) map[rule.category] = [];
          const item = itemMap.get(rule.bonus_item_id);
          if (item && !map[rule.category].find(b => b.id === item.id)) {
            map[rule.category].push(item);
          }
        }
      }
      setCategoryBonusMap(map);
    })();
  }, []);

  // ── Nego modal state (edit mode only) ────────────────────────────────────

  // ── Cart actions ──────────────────────────────────────────────────────────
  const addToCart = (unit: StockUnit, fromScanner = false) => {
    if (cart.find(c => c.kind === 'unit' && c.unit!.id === unit.id)) {
      if (fromScanner) {
        sonnerToast.info("Unit sudah ada di keranjang", {
          description: productLabel(unit),
          position: "bottom-left",
          duration: 1500,
        });
        return;
      }
      // Toggle: klik lagi → hapus dari keranjang
      setCart(prev => prev.filter(c => !(c.kind === 'unit' && c.unit!.id === unit.id)));
      return;
    }
    // Langsung tambah sebagai Tanpa Nego
    setCart(prev => [...prev, {
      kind: 'unit', unit, accessory: null, label: productLabel(unit), expanded: false,
      is_negotiated: false, negotiated_price: null, final_price: unit.selling_price ?? 0,
    }]);
    if (!fromScanner) {
      const mp = getMasterProduct(unit);
      const thumb = seriesThumbnails[mp?.series ?? ""] ?? null;
      
      // Ambil icon berdasarkan kategori master product
      const CategoryIcon = () => {
        const cat = mp?.category?.toLowerCase() || "";
        if (cat.includes("iphone") || cat.includes("smartphone") || cat.includes("phone")) return <Smartphone className="w-8 h-8 text-primary drop-shadow-sm" />;
        if (cat.includes("watch")) return <Watch className="w-8 h-8 text-primary drop-shadow-sm" />;
        if (cat.includes("ipad") || cat.includes("tablet")) return <Tablet className="w-8 h-8 text-primary drop-shadow-sm" />;
        if (cat.includes("macbook") || cat.includes("laptop")) return <Laptop className="w-8 h-8 text-primary drop-shadow-sm" />;
        if (cat.includes("airpods") || cat.includes("audio") || cat.includes("headset")) return <Headphones className="w-8 h-8 text-primary drop-shadow-sm" />;
        return <Package className="w-8 h-8 text-primary drop-shadow-sm" />;
      };

      sonnerToast.custom((t) => (
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 px-3 py-2.5 rounded-xl shadow-xl border border-[#cacaca] w-[300px] animate-in fade-in slide-in-from-right-4">
           <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden relative bg-muted/50 border border-border/50">
             {thumb ? (
               <img src={thumb} alt="" className="w-full h-full object-cover opacity-80" />
             ) : (
               <div className="w-full h-full flex items-center justify-center bg-zinc-100">
                 <Package className="w-8 h-8 text-muted-foreground/20" />
               </div>
             )}
             <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
               <CategoryIcon />
             </div>
           </div>
           <div className="min-w-0 flex-1">
             <p className="text-[11px] font-bold text-foreground leading-tight line-clamp-2">{productLabel(unit)}</p>
             <p className="text-[10px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
               Berhasil ditambah
             </p>
           </div>
           <button onClick={() => sonnerToast.dismiss(t)} className="text-muted-foreground hover:text-foreground shrink-0 ml-1 p-1">
             <X className="w-4 h-4" />
           </button>
        </div>
      ), { position: "bottom-right", duration: 2500 });
    }
  };

  const applyNegoForItem = (unitId: string, isNego: boolean, negoPrice: number | null) => {
    setCart(prev => prev.map(c => {
      if (c.kind !== 'unit' || c.unit!.id !== unitId) return c;
      const finalPrice = isNego && negoPrice !== null ? negoPrice : (c.unit!.selling_price ?? 0);
      return { ...c, is_negotiated: isNego, negotiated_price: isNego ? negoPrice : null, final_price: finalPrice };
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => cartItemId(c) !== itemId));
  };

  const toggleCartItem = (itemId: string) => {
    setCart(prev => prev.map(c => cartItemId(c) === itemId ? { ...c, expanded: !c.expanded } : c));
  };

  const addAccessoryToCart = (acc: AccessoryProduct) => {
    if (cart.find(c => c.kind === 'accessory' && c.accessory!.id === acc.id)) {
      // Toggle: klik lagi → hapus dari keranjang
      setCart(prev => prev.filter(c => !(c.kind === 'accessory' && c.accessory!.id === acc.id)));
      return;
    }
    setCart(prev => [...prev, {
      kind: 'accessory',
      unit: null,
      accessory: acc,
      label: acc.name,
      expanded: false,
      is_negotiated: false,
      negotiated_price: null,
      final_price: acc.selling_price,
    }]);
    const thumb = seriesThumbnails[acc.name] ?? null;
    sonnerToast.custom((t) => (
      <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 px-3 py-2.5 rounded-xl shadow-xl border border-[#cacaca] w-[300px] animate-in fade-in slide-in-from-right-4">
        <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden relative bg-muted/50 border border-border/50">
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-full object-cover opacity-80" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-100">
              <Package className="w-8 h-8 text-muted-foreground/20" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
            <Package className="w-8 h-8 text-primary drop-shadow-sm" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-foreground leading-tight line-clamp-2">{acc.name}</p>
          <p className="text-[10px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Berhasil ditambah
          </p>
        </div>
        <button onClick={() => sonnerToast.dismiss(t)} className="text-muted-foreground hover:text-foreground shrink-0 ml-1 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    ), { position: "bottom-right", duration: 2500 });
  };

  // ── Customer lookup ──────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; email: string; phone: string | null }>>([]);
  const [showResults, setShowResults] = useState(false);

  // ── Unified customer search (new UI) ─────────────────────────────────────
  const [unifiedQuery, setUnifiedQuery] = useState("");
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [unifiedResults, setUnifiedResults] = useState<Array<{
    type: "registered" | "guest";
    id?: string;
    name: string;
    email: string | null;
    phone: string | null;
    count?: number;
  }>>([]);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerLockedFromSearch, setCustomerLockedFromSearch] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);

  // ── Duplicate phone/email check ───────────────────────────────────────────
  const [phoneConflict, setPhoneConflict] = useState<Array<{ name: string; phone: string | null; email: string | null; count: number }>>([]);
  const [emailConflict, setEmailConflict] = useState<Array<{ name: string; phone: string | null; email: string | null; count: number }>>([]);

  useEffect(() => {
    const phone = guestPhone.trim();
    if (phone.length < 8) { setPhoneConflict([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("transactions")
        .select("customer_name, customer_phone, customer_email")
        .eq("customer_phone", phone)
        .is("customer_user_id", null)
        .limit(20);
      if (!data || data.length === 0) { setPhoneConflict([]); return; }
      const seen = new Map<string, { name: string; phone: string | null; email: string | null; count: number }>();
      for (const row of data) {
        const key = `${(row.customer_name || "").toLowerCase()}|${row.customer_phone || ""}`;
        if (seen.has(key)) seen.get(key)!.count++;
        else seen.set(key, { name: row.customer_name || "", phone: row.customer_phone, email: row.customer_email, count: 1 });
      }
      setPhoneConflict(Array.from(seen.values()));
    }, 500);
    return () => clearTimeout(timer);
  }, [guestPhone]);

  useEffect(() => {
    const email = guestEmail.trim();
    if (!email || !email.includes("@")) { setEmailConflict([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("transactions")
        .select("customer_name, customer_phone, customer_email")
        .ilike("customer_email", email)
        .is("customer_user_id", null)
        .limit(20);
      if (!data || data.length === 0) { setEmailConflict([]); return; }
      const seen = new Map<string, { name: string; phone: string | null; email: string | null; count: number }>();
      for (const row of data) {
        const key = `${(row.customer_name || "").toLowerCase()}|${row.customer_email || ""}`;
        if (seen.has(key)) seen.get(key)!.count++;
        else seen.set(key, { name: row.customer_name || "", phone: row.customer_phone, email: row.customer_email, count: 1 });
      }
      setEmailConflict(Array.from(seen.values()));
    }, 500);
    return () => clearTimeout(timer);
  }, [guestEmail]);

  const lookupCustomer = async () => {
    if (!regEmail.trim() || regEmail.trim().length < 2) return;
    setLookingUpCustomer(true);
    setSearchResults([]);
    setShowResults(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "search_customers", keyword: regEmail.trim() }),
        }
      );
      const json = await res.json();
      if (json.customers && json.customers.length > 0) {
        setSearchResults(json.customers);
        setShowResults(true);
      } else {
        toast({ title: "Customer tidak ditemukan", description: "Tidak ada akun customer yang cocok.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal mencari customer", variant: "destructive" });
    } finally {
      setLookingUpCustomer(false);
    }
  };

  const selectCustomer = (c: { id: string; name: string; email: string }) => {
    setRegCustomer(c);
    setShowResults(false);
    setSearchResults([]);
  };

  // ── Guest returning customer lookup (search past transactions) ──────────
  const searchGuestCustomer = async () => {
    if (!guestSearchQuery.trim() || guestSearchQuery.trim().length < 3) return;
    setSearchingGuest(true);
    setGuestSearchResults([]);
    try {
      const q = guestSearchQuery.trim().toLowerCase();
      const { data } = await (supabase as any)
        .from("transactions")
        .select("customer_name, customer_email, customer_phone")
        .or(`customer_email.ilike.%${q}%,customer_phone.ilike.%${q}%,customer_name.ilike.%${q}%`)
        .is("customer_user_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const seen = new Map<string, { customer_name: string; customer_email: string | null; customer_phone: string | null; count: number }>();
        for (const row of data) {
          const key = `${(row.customer_name || "").toLowerCase()}|${(row.customer_email || "").toLowerCase()}|${(row.customer_phone || "")}`;
          if (seen.has(key)) {
            seen.get(key)!.count++;
          } else {
            seen.set(key, { customer_name: row.customer_name || "", customer_email: row.customer_email, customer_phone: row.customer_phone, count: 1 });
          }
        }
        setGuestSearchResults(Array.from(seen.values()));
      } else {
        toast({ title: "Tidak ditemukan", description: "Tidak ada riwayat pembelian dengan data tersebut.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal mencari", variant: "destructive" });
    } finally {
      setSearchingGuest(false);
    }
  };

  const selectGuestCustomer = (c: { customer_name: string; customer_email: string | null; customer_phone: string | null }) => {
    setGuestName(c.customer_name);
    setGuestEmail(c.customer_email || "");
    setGuestPhone(c.customer_phone || "");
    setGuestSearchResults([]);
    setGuestSearchQuery("");
  };

  // ── Unified customer search ───────────────────────────────────────────────
  const searchUnified = async () => {
    if (unifiedQuery.trim().length < 2) return;
    setUnifiedLoading(true);
    setUnifiedResults([]);
    const q = unifiedQuery.trim().toLowerCase();

    // Raw results before dedup
    type RawEntry = { type: "registered" | "guest"; id?: string; name: string; email: string | null; phone: string | null; count?: number };
    const raw: RawEntry[] = [];

    // Run edge function + transactions query in parallel
    const [registeredResult, guestResult] = await Promise.allSettled([
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customer`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: "search_customers", keyword: q }),
        });
        return res.json();
      })(),
      (supabase as any)
        .from("transactions")
        .select("customer_name, customer_email, customer_phone")
        .or(`customer_email.ilike.%${q}%,customer_phone.ilike.%${q}%,customer_name.ilike.%${q}%`)
        .is("customer_user_id", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (registeredResult.status === "fulfilled") {
      const json = registeredResult.value;
      if (json.customers?.length > 0) {
        for (const c of json.customers as { id: string; name: string; email: string; phone?: string | null }[]) {
          raw.push({ type: "registered", id: c.id, name: c.name ?? "", email: c.email ?? null, phone: c.phone ?? null });
        }
      }
    }

    if (guestResult.status === "fulfilled") {
      const { data } = guestResult.value;
      if (data?.length > 0) {
        const seen = new Map<string, RawEntry>();
        for (const row of data) {
          const key = `${(row.customer_phone || "")}_${(row.customer_name || "").toLowerCase()}`;
          if (seen.has(key)) { (seen.get(key)!.count as number)++; }
          else seen.set(key, { type: "guest", name: row.customer_name || "", email: row.customer_email, phone: row.customer_phone, count: 1 });
        }
        raw.push(...seen.values());
      }
    }

    // ── Merge + dedup by phone ──────────────────────────────────────────────
    // For each phone, merge all entries into the best single result:
    //   - prefer registered type
    //   - prefer non-empty name (take from any entry that has it)
    //   - prefer non-empty email
    const byPhone = new Map<string, RawEntry>();
    const noPhone: RawEntry[] = [];

    for (const r of raw) {
      const phone = r.phone?.trim();
      if (!phone) { noPhone.push(r); continue; }
      const existing = byPhone.get(phone);
      if (!existing) {
        byPhone.set(phone, { ...r });
      } else {
        // Merge: registered wins type, best name wins, best email wins
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

    setUnifiedResults([...byPhone.values(), ...noPhone]);
    setUnifiedLoading(false);
  };

  const isRealUuid = (id?: string) => !!id && !id.startsWith("guest_") && !id.startsWith("pos_guest_");
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const selectUnified = (r: typeof unifiedResults[0]) => {
    if (r.type === "registered" && isRealUuid(r.id)) {
      setCustomerType("registered");
      setRegCustomer({ id: r.id!, name: r.name, email: r.email ?? "" });
      // carry phone & email for DOKU payload and PayLater validation
      setGuestPhone(r.phone ?? "");
      setGuestEmail(r.email ?? "");
    } else {
      setCustomerType("guest");
      setGuestName(r.name);
      setGuestPhone(r.phone ?? "");
      setGuestEmail(r.email ?? "");
      setCustomerLockedFromSearch(true);
      setShowCustomerForm(true);
    }
    setUnifiedResults([]);
    setUnifiedQuery("");
  };

  const clearSelectedCustomer = () => {
    setCustomerType("guest");
    setRegCustomer(null);
    setGuestName(""); setGuestPhone(""); setGuestEmail("");
    setUnifiedQuery(""); setUnifiedResults([]);
    setShowCustomerForm(false);
    setCustomerLockedFromSearch(false);
    setEditingCustomer(false);
    setPhoneConflict([]); setEmailConflict([]);
    setSavedAddresses([]);
    setPlProvince(null); setPlProvinceName("");
    setPlRegency(null); setPlRegencyName("");
    setPlDistrict(null); setPlDistrictName("");
    setPlVillage(null); setPlVillageName("");
    setGuestAddress(""); setGuestPostcode("");
    setShippingAddressMode("custom");
  };

  // Fetch saved addresses when registered customer selected
  useEffect(() => {
    if (!regCustomer || !isRealUuid(regCustomer.id)) { setSavedAddresses([]); return; }
    supabase
      .from("customer_addresses" as never)
      .select("id, label, full_address, province_name, regency_name, district_name, village_name, province_code, regency_code, district_code, village_code, postal_code")
      .eq("user_id", regCustomer.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => { setSavedAddresses((data as SavedAddress[]) ?? []); });
  }, [regCustomer]);

  // Fetch guest addresses for registered customers too (from non-Akulaku transactions)
  // and for all guests — so registered customers can reuse addresses from POS transactions
  useEffect(() => {
    const email = guestEmail.trim();
    if (!email) { setSavedGuestAddresses([]); return; }
    supabase
      .from("guest_addresses" as never)
      .select("id, label, recipient_name, phone, full_address, province_name, regency_name, district_name, village_name, postal_code")
      .eq("email", email)
      .order("is_default", { ascending: false })
      .limit(20)
      .then(({ data }) => { setSavedGuestAddresses((data as GuestSavedAddress[]) ?? []); });
  }, [guestEmail]);

  // Helper: salin alamat PayLater ke shipping
  const applyPayLaterToShipping = () => {
    setProvince(plProvince); setProvinceName(plProvinceName);
    setRegency(plRegency); setRegencyName(plRegencyName);
    setDistrict(plDistrict); setDistrictName(plDistrictName);
    setVillage(plVillage); setVillageName(plVillageName);
    setFullAddress(guestAddress);
    setPostalCode(guestPostcode);
    setShippingOptions([]); setSelectedShipping(null);
  };

  // Helper: apply saved address to PayLater fields
  const applySavedToPayLater = (addr: SavedAddress) => {
    setPlProvince(addr.province_code); setPlProvinceName(addr.province_name);
    setPlRegency(addr.regency_code); setPlRegencyName(addr.regency_name);
    setPlDistrict(addr.district_code); setPlDistrictName(addr.district_name);
    setPlVillage(addr.village_code); setPlVillageName(addr.village_name);
    setGuestAddress(addr.full_address);
    setGuestPostcode(addr.postal_code || "");
  };

  // Helper: apply saved address to shipping fields
  const applySavedToShipping = (addr: SavedAddress) => {
    setProvince(addr.province_code); setProvinceName(addr.province_name);
    setRegency(addr.regency_code); setRegencyName(addr.regency_name);
    setDistrict(addr.district_code); setDistrictName(addr.district_name);
    setVillage(addr.village_code); setVillageName(addr.village_name);
    setFullAddress(addr.full_address);
    setPostalCode(addr.postal_code || "");
    setShippingOptions([]); setSelectedShipping(null);
  };

  // Helper: apply saved guest address to PayLater fields
  const applyGuestAddressToPayLater = (addr: GuestSavedAddress) => {
    // Find province_code by name
    const prov = provinces.find(p => p.name === addr.province_name);
    setPlProvince(prov?.code ?? null); setPlProvinceName(addr.province_name);
    const reg = plRegencies.find(r => r.name === addr.regency_name);
    setPlRegency(reg?.code ?? null); setPlRegencyName(addr.regency_name);
    const dist = plDistricts.find(d => d.name === addr.district_name);
    setPlDistrict(dist?.code ?? null); setPlDistrictName(addr.district_name);
    const vil = plVillages.find(v => v.name === addr.village_name);
    setPlVillage(vil?.code ?? null); setPlVillageName(addr.village_name);
    setGuestAddress(addr.full_address);
    setGuestPostcode(addr.postal_code || "");
  };

  // Helper: apply saved guest address to shipping fields
  const applyGuestAddressToShipping = (addr: GuestSavedAddress) => {
    const prov = provinces.find(p => p.name === addr.province_name);
    setProvince(prov?.code ?? null); setProvinceName(addr.province_name);
    const reg = regencies.find(r => r.name === addr.regency_name);
    setRegency(reg?.code ?? null); setRegencyName(addr.regency_name);
    const dist = districts.find(d => d.name === addr.district_name);
    setDistrict(dist?.code ?? null); setDistrictName(addr.district_name);
    const vil = villages.find(v => v.name === addr.village_name);
    setVillage(vil?.code ?? null); setVillageName(addr.village_name);
    setFullAddress(addr.full_address);
    setPostalCode(addr.postal_code || "");
    setShippingOptions([]); setSelectedShipping(null);
  };

  // Save address after transaction (Shopee model: up to 5 per customer/guest, first one = default)
  const saveAddressAfterTx = async () => {
    if (!guestAddress.trim()) return;
    const email = guestEmail.trim() || null;
    const isGuest = customerType !== "registered" || !regCustomer;
    const isNewCustomer = isGuest
      ? savedGuestAddresses.length === 0
      : savedAddresses.length === 0;
    const payload: Record<string, unknown> = {
      full_address: guestAddress,
      province_name: plProvinceName || provinceName || "",
      regency_name: plRegencyName || regencyName || "",
      district_name: plDistrictName || districtName || "",
      village_name: plVillageName || villageName || "",
      postal_code: guestPostcode || postalCode || "",
      label: `Alamat ${isGuest ? savedGuestAddresses.length + 1 : savedAddresses.length + 1}`,
      is_default: isNewCustomer,
    };

    if (isGuest) {
      if (email) {
        await supabase.from("guest_addresses" as never).insert({
          email,
          recipient_name: guestName || guestPhone || email,
          phone: guestPhone || "",
          ...payload,
        } as never);
      }
    } else {
      // registered customer — save to customer_addresses
      await (supabase as any).from("customer_addresses").insert({
        user_id: regCustomer!.id,
        recipient_name: guestName || guestPhone || "",
        phone: guestPhone || "",
        city: plRegencyName || regencyName || "",
        district: plDistrictName || districtName || "",
        village: plVillageName || villageName || "",
        province: plProvinceName || provinceName || "",
        ...payload,
      });
    }
  };
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = cartPanelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartXRef.current - ev.clientX;
      const newWidth = Math.max(300, Math.min(600, dragStartWidthRef.current + delta));
      setCartPanelWidth(newWidth);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [cartPanelWidth]);

  // Debounced auto-search — fires 400ms after user stops typing
  useEffect(() => {
    const q = unifiedQuery.trim();
    if (q.length < 2) { setUnifiedResults([]); return; }
    const t = setTimeout(() => { searchUnified(); }, 400);
    return () => clearTimeout(t);
  }, [unifiedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shipping ──────────────────────────────────────────────────────────────
  async function resolveRajaOngkirId(keyword: string): Promise<string | null> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const cleanKeyword = keyword.replace(/^(Kota|Kabupaten|Kab\.?)\s+/i, "").trim();
    const attempts = [cleanKeyword, keyword];
    for (const kw of attempts) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/rajaongkir-proxy?action=search-destination&keyword=${encodeURIComponent(kw)}`, {
          headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey },
        });
        const json = await res.json();
        if (json.data?.length > 0) return json.data[0]?.id?.toString() || null;
      } catch { /* ignore */ }
    }
    return null;
  }

  async function fetchShippingOptions() {
    if (!district || !regency) return;
    setShippingLoading(true);
    setShippingOptions([]);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Resolve origin from branch
      let originId: string | null = null;
      if (selectedBranch?.city) {
        originId = await resolveRajaOngkirId(selectedBranch.city);
      }
      if (!originId && selectedBranch?.district) {
        originId = await resolveRajaOngkirId(selectedBranch.district);
      }
      if (!originId) originId = "3578"; // fallback Surabaya

      // Resolve destination
      let destinationId: string | null = null;
      if (villageName && districtName) {
        destinationId = await resolveRajaOngkirId(`${villageName} ${districtName}`);
      }
      if (!destinationId && districtName && regencyName) {
        const cleanRegency = regencyName.replace(/^(Kota|Kabupaten|Kab\.?)\s+/i, "").trim();
        destinationId = await resolveRajaOngkirId(`${districtName} ${cleanRegency}`);
      }
      if (!destinationId && districtName) {
        destinationId = await resolveRajaOngkirId(districtName);
      }
      if (!destinationId && regencyName) {
        destinationId = await resolveRajaOngkirId(regencyName);
      }
      if (!destinationId) {
        toast({ title: "Gagal", description: "Tidak bisa menentukan tujuan pengiriman", variant: "destructive" });
        setShippingLoading(false);
        return;
      }

      const courierList = ["jne", "jnt", "sicepat", "ninja", "lion", "pos", "tiki", "anteraja", "ide", "sap"];
      const allOptions: ShippingOption[] = [];

      const fetchCourier = async (courier: string) => {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/rajaongkir-proxy?action=cost`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
            },
            body: JSON.stringify({ origin: originId, destination: destinationId, weight: 500, courier }),
          });
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            for (const item of json.data) {
              if (item.cost != null && item.cost > 0) {
                allOptions.push({
                  courier: item.code?.toUpperCase() || courier.toUpperCase(),
                  courierName: item.name || courier.toUpperCase(),
                  service: item.service || "",
                  description: item.description || "",
                  cost: item.cost,
                  etd: item.etd || "-",
                });
              }
            }
          }
        } catch { /* skip */ }
      };

      await Promise.all(courierList.map(fetchCourier));

      const MAX_COST = 500000;
      const filtered = allOptions.filter(o => o.cost <= MAX_COST).sort((a, b) => a.cost - b.cost);
      const seen = new Map<string, ShippingOption>();
      for (const opt of filtered) {
        if (!seen.has(opt.courier) || seen.get(opt.courier)!.cost > opt.cost) {
          seen.set(opt.courier, opt);
        }
      }
      const deduped = Array.from(seen.values()).sort((a, b) => a.cost - b.cost).slice(0, 5);
      setShippingOptions(deduped);
    } catch (err) {
      console.error("Shipping fetch error:", err);
    } finally {
      setShippingLoading(false);
    }
  }

  // Auto-fetch shipping when address changes
  useEffect(() => {
    if (needsShipping && district && regency) {
      fetchShippingOptions();
    } else {
      setShippingOptions([]);
      setSelectedShipping(null);
    }
  }, [needsShipping, district, regency]);

  // ── Discount ──────────────────────────────────────────────────────────────
  const applyDiscount = async () => {
    if (!discountCodeInput.trim()) return;
    setApplyingDiscount(true);
    const { data } = await supabase
      .from("discount_codes")
      .select("id, code, discount_type, discount_percent, discount_amount, min_purchase_amount, applies_to_all")
      .eq("code", discountCodeInput.trim().toUpperCase())
      .eq("is_active", true)
      .single();
    setApplyingDiscount(false);
    if (!data) { toast({ title: "Kode diskon tidak valid", variant: "destructive" }); return; }
    const disc = data as DiscountCode;
    if (disc.min_purchase_amount && subtotal < disc.min_purchase_amount) {
      toast({ title: "Minimum pembelian tidak terpenuhi", description: `Minimum ${formatCurrency(disc.min_purchase_amount)}`, variant: "destructive" });
      return;
    }
    setAppliedDiscount(disc);
    toast({ title: "Kode diskon berhasil diterapkan!" });
  };

  const removeDiscount = () => { setAppliedDiscount(null); setDiscountCodeInput(""); };

  // ── Pricing ───────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((sum, c) => sum + c.final_price, 0);
  const discountAmount = (() => {
    if (!appliedDiscount) return 0;
    if (appliedDiscount.discount_type === "percentage" && appliedDiscount.discount_percent)
      return Math.round((subtotal * appliedDiscount.discount_percent) / 100);
    if (appliedDiscount.discount_type === "fixed_amount" && appliedDiscount.discount_amount)
      return appliedDiscount.discount_amount;
    return 0;
  })();
  const shippingCost = needsShipping && selectedShipping ? selectedShipping.cost : 0;
  const packingKayuCost = needsShipping && packingKayu ? 25000 : 0;
  const total = Math.max(0, subtotal - discountAmount + shippingCost + packingKayuCost);
  const selectedPayment = paymentMethods.find(p => p.id === selectedPaymentId);

  // ── Per-channel fee helper ─────────────────────────────────────────────────
  const getChannelFee = (ch: { mode: PaymentMode; dokuKey: string; includeFee: boolean }, nominal: number): number => {
    if (!ch.includeFee) return 0;
    if (ch.mode === "manual") return 0; // manual channels: no configured admin fee
    const method = DOKU_METHODS.find(m => m.key === ch.dokuKey);
    if (!method) return 0;
    if (method.section === "va") return 4000;
    if (method.section === "paylater") return Math.round(nominal * 0.015);
    return 0;
  };
  const isCashChannel = (ch: { mode: PaymentMode; manualId: string }): boolean => {
    if (ch.mode !== "manual") return false;
    return paymentMethods.find(p => p.id === ch.manualId)?.type === "cash";
  };

  // Split totals
  const splitChannelNominals = splitChannels.map(ch => {
    const raw = ch.amount.replace(/\D/g, "");
    return raw ? parseInt(raw, 10) : 0;
  });
  const splitChannelFees = splitChannels.map((ch, i) => getChannelFee(ch, splitChannelNominals[i]));
  // Remaining nominal for each channel = product total minus previous nominals only.
  // Fee admin is always extra on top, never counted toward the nominal split.
  const splitChannelRemaining = splitChannels.map((_, idx) => {
    const prevNominalSum = splitChannelNominals.slice(0, idx).reduce((s, n) => s + n, 0);
    return total - prevNominalSum;
  });
  const splitTotalNominal = splitChannelNominals.reduce((a, b) => a + b, 0);
  const splitTotalFees = splitChannelFees.reduce((a, b) => a + b, 0);
  const splitGrandTotal = splitTotalNominal + splitTotalFees;

  // ── Validation ────────────────────────────────────────────────────────────
  const selectedDokuMethod = DOKU_METHODS.find(m => m.key === selectedDokuCategory);
  const isPayLater = selectedDokuMethod?.section === "paylater";

  // Admin fee (single-channel mode)
  const splitHasVA = isSplitPayment && splitChannels.some(ch =>
    ch.mode === "online" && DOKU_METHODS.find(m => m.key === ch.dokuKey)?.section === "va"
  );
  const splitHasPayLater = isSplitPayment && splitChannels.some(ch =>
    ch.mode === "online" && DOKU_METHODS.find(m => m.key === ch.dokuKey)?.section === "paylater"
  );
  const effectiveIsVA = !isSplitPayment
    ? (paymentMode === "online" && selectedDokuMethod?.section === "va")
    : splitHasVA;
  const effectiveIsPayLater = !isSplitPayment ? isPayLater : splitHasPayLater;
  const adminFee = waiveFeeAdmin ? 0 : (
    (effectiveIsVA ? 4000 : 0) + (effectiveIsPayLater ? Math.round(total * 0.02) : 0)
  );
  const grandTotal = isSplitPayment ? splitGrandTotal : total + adminFee;
  const hasPlAddress = !!(effectiveIsPayLater && plProvinceName && guestAddress);
  const hasSavedAddresses = savedAddresses.length > 0 || savedGuestAddresses.length > 0;
  const showShippingRadios = hasSavedAddresses || (effectiveIsPayLater && !hasPlAddress) || (hasPlAddress && hasSavedAddresses) || shippingAddressMode === "custom";

  useEffect(() => {
    // Only auto-apply PayLater to shipping when:
    // - PayLater is active AND address is filled AND shipping is needed
    // - User has NOT picked a saved guest address yet (only auto-apply from fresh PayLater fill)
    if (effectiveIsPayLater && plProvinceName && guestAddress && needsShipping && shippingAddressMode !== "custom") {
      const isFromSavedGuest = savedGuestAddresses.some(a =>
        plProvinceName === a.province_name && guestAddress === a.full_address
      );
      if (!isFromSavedGuest) {
        setShippingAddressMode("paylater");
        applyPayLaterToShipping();
      }
    }
  }, [effectiveIsPayLater, plProvinceName, guestAddress, needsShipping]);

  const canProceed = () => {
    if (cart.length === 0) return false;
    if (!isSplitPayment) {
      if (paymentMode === "manual" && !selectedPaymentId) return false;
      if (paymentMode === "online" && !selectedDokuCategory) return false;
    } else {
      if (splitChannels.some(ch => ch.mode === "manual" ? !ch.manualId : !ch.dokuKey)) return false;
      if (splitChannels.some(ch => splitChannelNominals[splitChannels.indexOf(ch)] === 0)) return false;
      if (splitTotalNominal !== total) return false;
    }
    if (customerType === "guest") {
      if (!guestName.trim()) return false;
      if (!guestPhone.trim()) return false;
    }
    if (customerType === "registered" && !regCustomer) return false;
    // Phone wajib untuk semua tipe customer (DOKU requirement)
    const hasOnlineChannel = !isSplitPayment ? paymentMode === "online" : splitChannels.some(ch => ch.mode === "online");
    if (hasOnlineChannel && !guestPhone.trim()) return false;
    // Email: jika diisi, format harus valid (DOKU requirement)
    if (guestEmail.trim() && !isValidEmail(guestEmail)) return false;
    // PayLater wajib: email + phone + alamat wilayah
    if (effectiveIsPayLater) {
      if (!guestEmail.trim()) return false;
      if (!guestAddress.trim() || !plRegencyName.trim() || !plProvinceName.trim()) return false;
    }
    if (needsShipping && (!fullAddress.trim() || !district || !selectedShipping)) return false;
    return true;
  };

  // Helper: list field PayLater yang belum lengkap
  const missingPayLaterFields = () => {
    const missing: string[] = [];
    if (!guestPhone.trim()) missing.push("No. WhatsApp");
    if (!guestEmail.trim()) missing.push("Email");
    else if (!isValidEmail(guestEmail)) missing.push("Email (format tidak valid)");
    if (!guestAddress.trim()) missing.push("Alamat Jalan");
    if (!plRegencyName.trim()) missing.push("Kota/Kab");
    if (!plProvinceName.trim()) missing.push("Provinsi");
    return missing;
  };

  // ── Create transaction ────────────────────────────────────────────────────
  const createTransaction = async () => {
    if (!selectedBranch?.id || !user?.id) return;
    setProcessingTx(true);

    // ── Guard: pastikan semua item di cart masih available (belum di-reserve oleh transaksi lain) ──
    const cartIds = cart.filter(c => c.kind === 'unit').map(c => c.unit!.id);
    const { data: latestUnits, error: stockCheckErr } = await supabase
      .from("stock_units")
      .select("id, stock_status")
      .in("id", cartIds);
    if (stockCheckErr || !latestUnits) {
      sonnerToast.error("Gagal memvalidasi stok. Coba lagi.");
      setProcessingTx(false);
      return;
    }
    const alreadyReserved = (latestUnits as { id: string; stock_status: string }[])
      .filter(u => u.stock_status !== "available");
    if (alreadyReserved.length > 0) {
      const reservedLabels = alreadyReserved
        .map(u => cart.find(c => c.kind === 'unit' && c.unit!.id === u.id)?.label ?? u.id)
        .join(", ");
      sonnerToast.error("Item sudah dipakai transaksi lain", {
        description: `Hapus dari keranjang lalu pilih unit lain: ${reservedLabels}`,
        duration: 6000,
      });
      // Hapus item yang sudah reserved dari cart
      setCart(prev => prev.filter(c => !alreadyReserved.some(r => c.kind === 'unit' && r.id === c.unit!.id)));
      setProcessingTx(false);
      return;
    }

    const code = `TRX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;

    // ── Split payment flow ─────────────────────────────────────────────────
    if (isSplitPayment) {
      const { data: { session: sess } } = await supabase.auth.getSession();
      // Build structured split_channels array
      const channelsData = splitChannels.map((ch, i) => {
        const nominal = splitChannelNominals[i];
        const fee = splitChannelFees[i];
        const dokuMethod = ch.mode === "online" ? DOKU_METHODS.find(d => d.key === ch.dokuKey) : null;
        const manualMethod = ch.mode === "manual" ? paymentMethods.find(p => p.id === ch.manualId) : null;
        return {
          idx: i,
          type: ch.mode === "online" ? "doku" : "manual",
          method_key: ch.mode === "online" ? ch.dokuKey : ch.manualId,
          method_name: ch.mode === "online"
            ? (dokuMethod?.fullName ?? "DOKU")
            : (manualMethod?.bank_name ?? manualMethod?.name ?? "Manual"),
          method_section: dokuMethod?.section ?? null,    // "va" | "paylater" | null
          doku_method_type: dokuMethod?.dokuMethod ?? null,
          nominal,
          fee,
          include_fee: ch.includeFee,
          status: "pending" as const,
          doku_payment_url: null as string | null,
          doku_va_number: null as string | null,
          doku_token_id: null as string | null,
          doku_expired_date: null as string | null,
          payment_proof_url: null as string | null,
          admin_notified: false,
          confirmed_at: null as string | null,
        };
      });

      const splitLabel = channelsData.map(c =>
        `${c.method_name} Rp${c.nominal.toLocaleString("id-ID")}`
      ).join(" | ");

      try {
        const { data: tx, error: txErr } = await supabase
          .from("transactions" as never)
          .insert({
            branch_id: selectedBranch.id,
            transaction_code: code,
            status: "pending",
            customer_user_id: customerType === "registered" && regCustomer && isRealUuid(regCustomer.id) ? regCustomer.id : null,
            customer_name: customerType === "registered" && regCustomer ? regCustomer.name : guestName,
            customer_email: customerType === "registered" && regCustomer ? regCustomer.email : (guestEmail || null),
            customer_phone: guestPhone || null,
            payment_method_id: null,
            payment_method_name: `Split: ${splitLabel}`,
            split_channels: channelsData,
            discount_code: appliedDiscount?.code ?? null,
            discount_amount: discountAmount,
            subtotal,
            total: grandTotal,
            created_by: user.id,
            ...(needsShipping ? {
              shipping_address: fullAddress,
              shipping_city: regencyName,
              shipping_province: provinceName,
              shipping_district: districtName,
              shipping_village: villageName,
              shipping_postal_code: postalCode,
              shipping_cost: shippingCost,
              shipping_courier: selectedShipping?.courier || null,
              shipping_service: selectedShipping?.service || null,
              shipping_etd: selectedShipping?.etd || null,
            } : {}),
          } as never)
          .select("id");
        const txData = tx as { id: string };

        for (const item of cart) {
          if (item.kind === 'unit') {
            const { error: tiErr } = await supabase.from("transaction_items" as never).insert({
              transaction_id: txData.id,
              stock_unit_id: item.unit!.id,
              imei: item.unit!.imei,
              product_label: item.label,
              selling_price: item.final_price,
            } as never);
            if (tiErr) throw tiErr;
            await supabase
              .from("stock_units")
              .update({ stock_status: "reserved", sold_reference_id: txData.id })
              .eq("id", item.unit!.id);
          } else {
            const { error: tiErr } = await (supabase as any).from("transaction_items").insert({
              transaction_id: txData.id,
              accessory_id: item.accessory!.id,
              product_label: item.label,
              selling_price: item.final_price,
            });
            if (tiErr) throw tiErr;
            await (supabase as any).from("accessory_stock_ledger").insert({
              master_product_id: item.accessory!.id,
              transaction_date: new Date().toISOString().split('T')[0],
              qty: -1,
              movement_type: 'direct_sale',
              reference_id: txData.id,
              unit_price: item.final_price,
            });
          }
        }

        // Langsung navigate ke detail — jangan tunggu DOKU edge function (cold start bisa 45s)
        // Fire-and-forget DOKU untuk channel pertama; detail page pick up via auto-poll
        resetForm();
        setProcessingTx(false);
        navigate(`/admin/transaksi/${txData.id}`);

        const firstDokuChannel = channelsData.find(c => c.type === "doku");
        if (firstDokuChannel && sess?.access_token) {
          const _sessToken = sess.access_token;
          const _txId = txData.id;
          const _channelsData = channelsData;
          const custId = customerType === "registered" && regCustomer && isRealUuid(regCustomer.id)
            ? regCustomer.id.substring(0, 50)
            : `G-${(guestPhone || code).replace(/\D/g, "").substring(0, 46)}`;
          const isPayLaterCh = firstDokuChannel.method_section === "paylater";
          const dokuPayload: Record<string, unknown> = {
            transactionCode: code,
            transactionId: txData.id,
            total: firstDokuChannel.nominal + (firstDokuChannel.include_fee ? firstDokuChannel.fee : 0),
            customerName: customerType === "registered" && regCustomer ? regCustomer.name : guestName,
            customerEmail: customerType === "registered" && regCustomer ? regCustomer.email : (guestEmail || undefined),
            customerPhone: guestPhone || undefined,
            customerId: custId,
            items: [
              ...cart.map(c => ({ label: c.label, price: c.final_price })),
              ...(firstDokuChannel.include_fee && firstDokuChannel.fee > 0
                ? [{ label: "Biaya Admin Pembayaran", price: firstDokuChannel.fee }]
                : []),
            ],
            splitChannelIdx: firstDokuChannel.idx,
          };
          if (firstDokuChannel.doku_method_type) {
            dokuPayload.paymentMethodTypes = [firstDokuChannel.doku_method_type];
          }
          if (isPayLaterCh) {
            dokuPayload.isPayLater = true;
            dokuPayload.customerAddress = guestAddress || undefined;
            dokuPayload.customerCity = plRegencyName || undefined;
            dokuPayload.customerState = plProvinceName || undefined;
            dokuPayload.customerPostcode = guestPostcode || undefined;
          }
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doku-create-checkout`,
            { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${_sessToken}` }, body: JSON.stringify(dokuPayload) }
          )
            .then(r => r.json())
            .then(json => {
              if (!json.success) return;
              // Update split_channels[0] di DB — komponen sudah unmount tapi fetch tetap jalan
              const updatedChannels = _channelsData.map((c, ci) => ci === 0 ? {
                ...c,
                doku_payment_url: json.data.payment_url ?? null,
                doku_va_number: json.data.va_number ?? null,
                doku_token_id: json.data.token_id ?? null,
                doku_expired_date: json.data.expired_date ?? null,
              } : c);
              supabase.from("transactions" as never).update({ split_channels: updatedChannels } as never).eq("id", _txId);
              if (json.data.payment_url && !json.data.va_number) {
                window.open(json.data.payment_url, "_blank", "noopener,noreferrer");
              }
            })
            .catch(() => { /* silent — detail page akan handle via handleCheckDokuStatus */ });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
        toast({ title: "Gagal membuat transaksi", description: msg, variant: "destructive" });
      } finally {
        setProcessingTx(false);
      }
      return;
    }

    // ── DOKU online mode ─────────────────────────────────────────────────
    if (paymentMode === "online") {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sesi login tidak ditemukan. Coba refresh halaman dan login ulang.");
        const selectedMethod = DOKU_METHODS.find(m => m.key === selectedDokuCategory);
        const catLabel = selectedMethod ? `DOKU – ${selectedMethod.fullName}` : "DOKU – Online";

        // Create transaction first
        const { data: tx, error: txErr } = await supabase
          .from("transactions" as never)
          .insert({
            branch_id: selectedBranch.id,
            transaction_code: code,
            status: "pending",
            customer_user_id: customerType === "registered" && regCustomer && isRealUuid(regCustomer.id) ? regCustomer.id : null,
            customer_name: customerType === "registered" && regCustomer ? regCustomer.name : guestName,
            customer_email: customerType === "registered" && regCustomer ? regCustomer.email : (guestEmail || null),
            customer_phone: guestPhone || null,
            payment_method_name: `DOKU - ${catLabel}`,
            discount_code: appliedDiscount?.code ?? null,
            discount_amount: discountAmount,
            subtotal,
            total: grandTotal,
            created_by: user.id,
            ...(needsShipping ? {
              shipping_address: fullAddress,
              shipping_city: regencyName,
              shipping_province: provinceName,
              shipping_district: districtName,
              shipping_village: villageName,
              shipping_postal_code: postalCode,
              shipping_cost: shippingCost,
              shipping_courier: selectedShipping?.courier || null,
              shipping_service: selectedShipping?.service || null,
              shipping_etd: selectedShipping?.etd || null,
            } : {}),
          } as never)
          .select("id")
          .single();

        if (txErr || !tx) {
          const errMsg = txErr?.message ?? "Gagal menyimpan transaksi";
          toast({ title: "Transaksi Error", description: errMsg, variant: "destructive" });
          setProcessingTx(false);
          return;
        }
        const txData = tx as { id: string };

        for (const item of cart) {
          if (item.kind === 'unit') {
            const { error: tiErr } = await supabase.from("transaction_items" as never).insert({
              transaction_id: txData.id,
              stock_unit_id: item.unit!.id,
              imei: item.unit!.imei,
              product_label: item.label,
              selling_price: item.final_price,
            } as never);
            if (tiErr) throw tiErr;
            await supabase
              .from("stock_units")
              .update({ stock_status: "reserved", sold_reference_id: txData.id })
              .eq("id", item.unit!.id);
          } else {
            const { error: tiErr } = await (supabase as any).from("transaction_items").insert({
              transaction_id: txData.id,
              accessory_id: item.accessory!.id,
              product_label: item.label,
              selling_price: item.final_price,
            });
            if (tiErr) throw tiErr;
            await (supabase as any).from("accessory_stock_ledger").insert({
              master_product_id: item.accessory!.id,
              transaction_date: new Date().toISOString().split('T')[0],
              qty: -1,
              movement_type: 'direct_sale',
              reference_id: txData.id,
              unit_price: item.final_price,
            });
          }
        }

        // Build DOKU checkout payload
        const custId = customerType === "registered" && regCustomer && isRealUuid(regCustomer.id)
          ? regCustomer.id.substring(0, 50)
          : `G-${(guestPhone || code).replace(/\D/g, "").substring(0, 46)}`;
        const dokuPayload: Record<string, unknown> = {
          transactionCode: code,
          transactionId: txData.id,
          total: grandTotal,  // kirim grandTotal (sudah include admin fee jika ada)
          customerName: customerType === "registered" && regCustomer ? regCustomer.name : guestName,
          customerEmail: customerType === "registered" && regCustomer ? regCustomer.email : (guestEmail || undefined),
          customerPhone: guestPhone || undefined,
          customerId: custId,
          items: [
            ...cart.map(c => ({ label: c.label, price: c.final_price })),
            ...(adminFee > 0 ? [{ label: "Biaya Admin Pembayaran", price: adminFee }] : []),
          ],
        };

        // Pass specific payment method type if not "all"
        if (selectedMethod && selectedMethod.dokuMethod) {
          dokuPayload.paymentMethodTypes = [selectedMethod.dokuMethod];
        }

        if (isPayLater) {
          dokuPayload.isPayLater = true;
          dokuPayload.customerAddress = guestAddress || undefined;
          dokuPayload.customerCity = plRegencyName || undefined;
          dokuPayload.customerState = plProvinceName || undefined;
          dokuPayload.customerPostcode = guestPostcode || undefined;
        }

        // Langsung navigate ke detail — jangan tunggu edge function (cold start bisa 45s)
        // Edge function dipanggil fire-and-forget; detail page punya auto-poll untuk pick up DOKU data
        if (needsShipping && guestAddress.trim()) saveAddressAfterTx();
        resetForm();
        setProcessingTx(false);
        navigate(`/admin/transaksi/${txData.id}`);

        const _accessToken = session?.access_token;
        const _txId = txData.id;
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doku-create-checkout`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${_accessToken}` },
            body: JSON.stringify(dokuPayload),
          }
        )
          .then(r => r.json())
          .then(json => {
            console.log("[DOKU] edge function response:", JSON.stringify(json));
            if (!json.success) return;
            // Update DB dengan DOKU data — komponen sudah unmount tapi fetch tetap jalan
            supabase.from("transactions" as never).update({
              doku_payment_url: json.data.payment_url ?? null,
              doku_token_id: json.data.token_id ?? null,
              doku_expired_date: json.data.expired_date ?? null,
              ...(json.data.va_number ? { doku_va_number: json.data.va_number } : {}),
            } as never).eq("id", _txId);
            // Buka link payment di tab baru jika Classic Checkout
            if (json.data.payment_url && !json.data.va_number) {
              window.open(json.data.payment_url, "_blank", "noopener,noreferrer");
            }
          })
          .catch(() => { /* silent — detail page akan handle via handleCheckDokuStatus */ });

        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal membuat checkout DOKU";
        toast({ title: "DOKU Error", description: msg, variant: "destructive" });
        setProcessingTx(false);
        return;
      }
    }

    // ── Manual payment flow → create as pending, redirect to detail ──────
    try {
      const { data: tx, error: txErr } = await supabase
        .from("transactions" as never)
        .insert({
          branch_id: selectedBranch.id,
          transaction_code: code,
          status: "pending",
          customer_user_id: customerType === "registered" && regCustomer && isRealUuid(regCustomer.id) ? regCustomer.id : null,
          customer_name: customerType === "registered" && regCustomer ? regCustomer.name : guestName,
          customer_email: customerType === "registered" && regCustomer ? regCustomer.email : (guestEmail || null),
          customer_phone: guestPhone || null,
          payment_method_id: selectedPaymentId || null,
          payment_method_name: selectedPayment?.name ?? null,
          discount_code: appliedDiscount?.code ?? null,
          discount_amount: discountAmount,
          subtotal,
          total: grandTotal,
          created_by: user.id,
          ...(needsShipping ? {
            shipping_address: fullAddress,
            shipping_city: regencyName,
            shipping_province: provinceName,
            shipping_district: districtName,
            shipping_village: villageName,
            shipping_postal_code: postalCode,
            shipping_cost: shippingCost,
            shipping_courier: selectedShipping?.courier || null,
            shipping_service: selectedShipping?.service || null,
            shipping_etd: selectedShipping?.etd || null,
          } : {}),
        } as never)
        .select("id")
        .single();

      if (txErr || !tx) throw txErr ?? new Error("Gagal membuat transaksi");
      const txData = tx as { id: string };

      for (const item of cart) {
        if (item.kind === 'unit') {
          const { error: tiErr } = await supabase.from("transaction_items" as never).insert({
            transaction_id: txData.id,
            stock_unit_id: item.unit!.id,
            imei: item.unit!.imei,
            product_label: item.label,
            selling_price: item.final_price,
          } as never);
          if (tiErr) throw tiErr;
          await supabase
            .from("stock_units")
            .update({ stock_status: "reserved", sold_reference_id: txData.id })
            .eq("id", item.unit!.id);
        } else {
          const { error: tiErr } = await (supabase as any).from("transaction_items").insert({
            transaction_id: txData.id,
            accessory_id: item.accessory!.id,
            product_label: item.label,
            selling_price: item.final_price,
          });
          if (tiErr) throw tiErr;
          await (supabase as any).from("accessory_stock_ledger").insert({
            master_product_id: item.accessory!.id,
            transaction_date: new Date().toISOString().split('T')[0],
            qty: -1,
            movement_type: 'direct_sale',
            reference_id: txData.id,
            unit_price: item.final_price,
          });
        }
      }

      if (needsShipping && guestAddress.trim()) saveAddressAfterTx();
      resetForm();
      navigate(`/admin/transaksi/${txData.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memproses transaksi";
      toast({ title: "Gagal", description: msg, variant: "destructive" });
    } finally {
      setProcessingTx(false);
    }
  };

  // ── canProceed for all transaction types ──────────────────────────────
  const canProceedForTradeIn = () => {
    if (transactionType === "beli") return canProceed();
    if (transactionType === "tukar_tambah") {
      if (!unitMasuk?.product_id) return false;
      if (!unitMasuk?.imei) return false;
      if (!unitMasuk?.harga_sepakat || unitMasuk.harga_sepakat <= 0) return false;
      if (!guestName.trim() || !guestPhone.trim()) return false;
      if (isUpgrade && paymentMode === "online" && !selectedDokuCategory) return false;
      if (isUpgrade && paymentMode === "manual" && !selectedPaymentId) return false;
      return true;
    }
    if (transactionType === "jual_putus") {
      if (!unitMasuk?.product_id) return false;
      if (!unitMasuk?.imei) return false;
      if (!unitMasuk?.harga_sepakat || unitMasuk.harga_sepakat <= 0) return false;
      if (!guestName.trim() || !guestPhone.trim()) return false;
      return true;
    }
    return false;
  };

  // ── Handle submit based on transaction type ─────────────────────────
  const handleSubmitTx = async () => {
    if (transactionType === "beli") { createTransaction(); return; }
    if (transactionType === "tukar_tambah") { await createTukarTambahTransaction(); return; }
    if (transactionType === "jual_putus") { await createJualPutusTransaction(); return; }
  };

  // ── Tukar Tambah ────────────────────────────────────────────────────
  async function createTukarTambahTransaction() {
    if (!selectedBranch?.id || !user?.id) return;
    setProcessingTx(true);
    const code = `TRX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
    try {
      // Insert incoming trade-in unit
      const { data: newUnit, error: unitErr } = await supabase.from("stock_units").insert({
        product_id: unitMasuk!.product_id,
        imei: unitMasuk!.imei || null,
        serial_number: unitMasuk!.serial_number || null,
        branch_id: selectedBranch.id,
        condition_status: unitMasuk!.condition_status,
        minus_severity: unitMasuk!.condition_status === "minus" ? unitMasuk!.minus_severity : null,
        minus_description: unitMasuk!.condition_status === "minus" ? unitMasuk!.minus_description : null,
        cost_price: unitMasuk!.harga_sepakat,
        selling_price: null,
        stock_status: "trade_in_pending",
        received_at: new Date().toISOString().split("T")[0],
        notes: unitMasuk!.notes || null,
      } as never).select("id").single();
      if (unitErr || !newUnit) throw unitErr ?? new Error("Gagal menyimpan unit masuk");
      const newUnitId = (newUnit as { id: string }).id;

      if (cart.length > 0) {
        // Create transaction with cart items
        const { data: tx, error: txErr } = await supabase.from("transactions" as never).insert({
          branch_id: selectedBranch.id,
          transaction_code: code,
          status: isCashOut ? "completed" : "pending",
          source_type: "tukar_tambah",
          customer_user_id: customerType === "registered" && regCustomer && isRealUuid(regCustomer.id) ? regCustomer.id : null,
          customer_name: customerType === "registered" && regCustomer ? regCustomer.name : guestName,
          customer_email: customerType === "registered" ? regCustomer.email : (guestEmail || null),
          customer_phone: guestPhone || null,
          payment_method_id: isUpgrade ? (paymentMode === "manual" ? selectedPaymentId : null) : null,
          payment_method_name: isUpgrade
            ? (paymentMode === "manual" ? selectedPayment?.name : `DOKU - ${selectedDokuMethod?.fullName}`)
            : (isCashOut ? "Cash-Out" : null),
          subtotal,
          total: isUpgrade ? netPayment : 0,
          created_by: user.id,
        } as never).select("id").single();
        if (txErr || !tx) throw txErr ?? new Error("Gagal membuat transaksi");
        const txId = (tx as { id: string }).id;

        for (const item of cart) {
          if (item.kind === "unit") {
            await supabase.from("transaction_items").insert({ transaction_id: txId, stock_unit_id: item.unit!.id, imei: item.unit!.imei, product_label: item.label, selling_price: item.final_price } as never);
            await supabase.from("stock_units").update({ stock_status: "reserved", sold_reference_id: txId }).eq("id", item.unit!.id);
          } else {
            await (supabase as any).from("transaction_items").insert({ transaction_id: txId, accessory_id: item.accessory!.id, product_label: item.label, selling_price: item.final_price });
            await (supabase as any).from("accessory_stock_ledger").insert({ master_product_id: item.accessory!.id, transaction_date: new Date().toISOString().split("T")[0], qty: -1, movement_type: "direct_sale", reference_id: txId, unit_price: item.final_price });
          }
        }

        if (isUpgrade && paymentMode === "online") {
          const dokuPayload = { transaction_code: code, amount: netPayment, customer_phone: guestPhone, customer_email: guestEmail || undefined, items: cart.map(c => ({ name: c.label, price: c.final_price, quantity: 1 })) };
          const dokuRes = await fetch("https://lhizerdgzshgmbygqugu.supabase.co/functions/v1/doku-create-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
            body: JSON.stringify(dokuPayload),
          });
          if (dokuRes.ok) {
            const dokuData = await dokuRes.json();
            if (dokuData.payment_url) {
              window.location.href = dokuData.payment_url;
              resetTradeInForm();
              return;
            }
          }
        }

        resetTradeInForm();
        navigate(`/admin/transaksi/${txId}`);
      } else {
        resetTradeInForm();
        sonnerToast.success("Unit masuk tercatat", { description: "Menunggu verifikasi di halaman Verifikasi Unit Masuk" });
        navigate("/admin/pos");
      }
    } catch (err: unknown) {
      toast({ title: "Gagal", description: err instanceof Error ? err.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setProcessingTx(false);
    }
  }

  // ── Jual Putus ───────────────────────────────────────────────────────
  async function createJualPutusTransaction() {
    if (!selectedBranch?.id || !user?.id) return;
    setProcessingTx(true);
    const code = `JP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
    try {
      const { data: newUnit, error: unitErr } = await supabase.from("stock_units").insert({
        product_id: unitMasuk!.product_id,
        imei: unitMasuk!.imei || null,
        serial_number: unitMasuk!.serial_number || null,
        branch_id: selectedBranch.id,
        condition_status: unitMasuk!.condition_status,
        minus_severity: unitMasuk!.condition_status === "minus" ? unitMasuk!.minus_severity : null,
        minus_description: unitMasuk!.condition_status === "minus" ? unitMasuk!.minus_description : null,
        cost_price: unitMasuk!.harga_sepakat,
        selling_price: null,
        stock_status: "trade_in_pending",
        received_at: new Date().toISOString().split("T")[0],
        notes: unitMasuk!.notes || null,
      } as never).select("id").single();
      if (unitErr || !newUnit) throw unitErr ?? new Error("Gagal menyimpan unit");
      const newUnitId = (newUnit as { id: string }).id;

      const { data: tx, error: txErr } = await supabase.from("transactions" as never).insert({
        branch_id: selectedBranch.id,
        transaction_code: code,
        status: "pending_verification",
        source_type: "jual_putus",
        customer_name: guestName,
        customer_email: guestEmail || null,
        customer_phone: guestPhone || null,
        subtotal: 0,
        total: 0,
        payment_method_name: "Jual Putus — Cash",
        created_by: user.id,
      } as never).select("id").single();
      if (txErr || !tx) throw txErr ?? new Error("Gagal membuat transaksi");

      sonnerToast.success("Jual Putus tercatat", { description: `Bayar ${formatCurrency(unitMasuk!.harga_sepakat)} ke customer` });
      resetTradeInForm();
      navigate(`/admin/transaksi/${(tx as { id: string }).id}`);
    } catch (err: unknown) {
      toast({ title: "Gagal", description: err instanceof Error ? err.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setProcessingTx(false);
    }
  }

  const resetForm = () => {
    setCart([]);
    setGuestName(""); setGuestEmail(""); setGuestPhone(""); setGuestIsReturning(false);
    setGuestSearchQuery(""); setGuestSearchResults([]);
    setRegEmail(""); setRegCustomer(null);
    setAppliedDiscount(null); setDiscountCodeInput(""); setSelectedPaymentId(""); setSelectedDokuCategory(""); setOpenDokuSections(new Set());
    setNeedsShipping(false); setProvince(null); setRegency(null); setDistrict(null); setVillage(null);
    setFullAddress(""); setPostalCode(""); setShippingOptions([]); setSelectedShipping(null);
    setPackingKayu(false);
  };

  const resetTradeInForm = () => {
    setTransactionType("beli");
    setUnitMasuk(null);
    setSelectedUnitMasukProduct(null);
    setUnitMasukProductSearch("");
    setUnitMasukImeiError(null);
    resetForm();
    setCartTab("keranjang");
  };

  const cartUnitIds = new Set(cart.filter(c => c.kind === 'unit').map(c => c.unit!.id));

  // ── Derived: net payment for Tukar Tambah ───────────────────────────────
  const unitMasukPrice = unitMasuk?.harga_sepakat ?? 0;
  const netPayment = subtotal - unitMasukPrice;
  const isCashOut = netPayment < 0;   // downgrade — kita bayar customer
  const isUpgrade = netPayment > 0;  // customer bayar kita

  // Card click blocked for Tukar Tambah (before unit filled) AND Jual Putus (kita beli dari customer, cart not used)
  const productCardDisabled = (transactionType === "tukar_tambah" || transactionType === "jual_putus")
    && (!unitMasuk?.product_id || !unitMasuk?.imei);

  // ── Helper: product label for Unit Masuk ─────────────────────────────
  const getProductLabelUM = (p: MasterProduct) => {
    const wLabel = p.warranty_type ? (WARRANTY_LABELS[p.warranty_type] ?? p.warranty_type) : "";
    const storageLabel = p.storage_gb ? (p.storage_gb >= 1024 ? `${p.storage_gb / 1024} TB` : `${p.storage_gb} GB`) : "";
    return `${p.series}${storageLabel ? " - " + storageLabel : ""}${p.color ? " " + p.color : ""}${wLabel ? " " + wLabel : ""}`;
  };

  // ── Handler: change transaction type ────────────────────────────────
  const handleTransactionTypeChange = (t: TransactionType) => {
    setTransactionType(t);
    if (t === "jual_putus") { setCartTab("data_unit"); }
    else if (t === "tukar_tambah") { setCartTab("unit_masuk"); }
    else { setCartTab("keranjang"); }
    setUnitMasuk(null);
    setSelectedUnitMasukProduct(null);
    setUnitMasukProductSearch("");
    setUnitMasukImeiError(null);
    if (t !== "beli") setCart([]);
  };

  // ── Handler: ganti kategori → reset series filter ─────────────────────────
  const handleSetFilterCategory = useCallback((cat: string) => {
    setFilterCategory(cat);
    setFilterSeries("all");
    // Untuk kategori fixed-resmi, reset warranty filter juga
    if (FIXED_RESMI_CATEGORIES.includes(cat as any)) {
      setFilterWarranty("all");
    }
  }, []);

  // ── Series options — dinamis berdasarkan kategori aktif ───────────────────
  const currentCategorySeries: string[] = filterCategory === "all"
    ? Array.from(new Set(Object.values(seriesByCategory).flat())).sort()
    : (seriesByCategory[filterCategory] ?? []);

  const seriesOptions = [
    { value: "all", label: filterCategory === "all" ? "Semua Seri" : `Semua ${CANONICAL_CATEGORY_LABELS[filterCategory as keyof typeof CANONICAL_CATEGORY_LABELS] ?? ""} Seri` },
    ...currentCategorySeries.map(s => ({ value: s, label: s })),
  ];

  // ── Tipe filter: auto-disable untuk kategori fixed-resmi ─────────────────
  const isTipeDisabled = filterCategory !== "all" && FIXED_RESMI_CATEGORIES.includes(filterCategory as any);

  const warrantyOptions: { value: WarrantyFilter; label: string }[] = [
    { value: "all", label: "Semua Tipe" },
    { value: "ibox", label: "Resmi iBox" },
    { value: "resmi_bc", label: "Resmi BC" },
    { value: "inter", label: "Inter" },
    { value: "whitelist", label: "Whitelist" },
    { value: "digimap", label: "Digimap" },
  ];

  const conditionOptions: { value: ConditionFilter; label: string }[] = [
    { value: "all", label: "Semua Kondisi" },
    { value: "no_minus", label: "No Minus" },
    { value: "minus_minor", label: "Minus Minor" },
    { value: "minus_mayor", label: "Minus Mayor" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout pageTitle="POS — Point of Sale">
      <div className={cn("flex gap-4 overflow-hidden", isMobile ? "flex-col h-[calc(100vh-80px)] -mt-2" : "h-[calc(100vh-80px)] -mt-2")}>

        {/* ══ LEFT PANEL: always visible (card click blocked per transactionType) ═════ */}
        {!isMobile && (
          <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
            <div className="shrink-0 mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground tracking-tight">Point of Sales Ivalora Gadget</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Klik unit untuk tambah ke keranjang. Barcode scanner siap digunakan.</p>
              </div>
              <div className="shrink-0 w-[180px]">
                {role === "super_admin" ? (
                  <SearchableDropdown
                    options={allBranches}
                    value={selectedBranch?.id ?? null}
                    onChange={(id) => { const b = allBranches.find(b => b.id === id); if (b) setSelectedBranch(b); }}
                    placeholder="Pilih Cabang"
                    searchPlaceholder="Cari cabang..."
                    align="right"
                    triggerClassName="w-full"
                  />
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">{selectedBranch?.name ?? "—"}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 relative mb-2 px-px">
              <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const q = search.trim();
                    if (q.length >= 10) {
                      const exactMatch = units.find(u => u.imei.toLowerCase() === q.toLowerCase());
                      if (exactMatch) {
                        addToCart(exactMatch, true);
                        setSearch("");
                        return;
                      }
                    }
                    fetchUnits();
                  }
                }}
                placeholder="Cari IMEI, seri, warna… atau scan barcode"
                className="pl-10 pr-9 h-10 text-sm"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category filter cards */}
            <div className="shrink-0 mb-2">
              <POSCategoryCards
                allCategories={allCategories}
                filterCategory={filterCategory}
                setFilterCategory={handleSetFilterCategory}
                categoryUnitCounts={categoryUnitCounts}
                loading={loadingUnits}
              />
            </div>

            <div className="shrink-0 mb-2 flex items-center gap-2 flex-wrap">
              <FilterDropdown value={filterSeries} onChange={setFilterSeries} options={seriesOptions} icon={Smartphone} />
              <FilterDropdown value={filterWarranty} onChange={(v: WarrantyFilter) => setFilterWarranty(v)} options={warrantyOptions} icon={Filter} disabled={isTipeDisabled} disabledLabel="Resmi" />
              <FilterDropdown value={filterCondition} onChange={(v: ConditionFilter) => setFilterCondition(v)} options={conditionOptions} icon={AlertCircle} />
              <button onClick={() => fetchUnits()} className="h-8 w-8 rounded-lg border border-border bg-card text-foreground hover:border-primary/40 transition-colors flex items-center justify-center shrink-0" title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="shrink-0 text-[11px] text-muted-foreground mb-2">
              {loadingUnits ? "Memuat..." : `${units.length} unit tersedia`}
            </p>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {loadingUnits ? (
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                  {[...Array(8)].map((_, i) => <div key={i} className="h-[180px] bg-muted rounded-xl animate-pulse" />)}
                </div>
              ) : units.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Tidak ada unit tersedia</p>
                    <p className="text-xs text-muted-foreground">Coba ubah filter atau scan IMEI lain</p>
                  </div>
                </div>
              ) : (
                <div className="pb-4">
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                    {units.map(unit => (
                      <ProductCard
                        key={unit.id}
                        unit={unit}
                        onAdd={addToCart}
                        inCart={cartUnitIds.has(unit.id)}
                        thumbnailUrl={seriesThumbnails[getMasterProduct(unit)?.series ?? ""] ?? null}
                        bonusItems={categoryBonusMap[getMasterProduct(unit)?.category ?? ""] ?? []}
                        disableClick={productCardDisabled}
                      />
                    ))}
                    {accessories?.map(acc => (
                      <AccessoryCard
                        key={acc.id}
                        acc={acc}
                        onAdd={addAccessoryToCart}
                        inCart={!!cart.find(c => c.kind === 'accessory' && c.accessory!.id === acc.id)}
                        thumbnailUrl={seriesThumbnails[acc.name] ?? null}
                        disableClick={productCardDisabled}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ DRAG HANDLE (desktop only) ═══════════════════════════════════ */}
        {!isMobile && (
          <div
            onMouseDown={handleDragStart}
            className="w-1.5 shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-full self-stretch my-2 group flex items-center justify-center"
            title="Seret untuk ubah lebar panel"
          >
            <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
          </div>
        )}

        {/* ══ RIGHT PANEL: Cart & Checkout ════════════════════════════════════ */}
        <div
          className={cn(
            "flex flex-col overflow-hidden bg-card border border-border rounded-2xl",
            isMobile ? "flex-1 w-full min-h-0" : "shrink-0"
          )}
          style={isMobile ? undefined : { width: `${cartPanelWidth}px` }}
        >

          {/* Branch selector — mobile only (desktop shows it in the top heading bar) */}
          {isMobile && (
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border">
              {role === "super_admin" ? (
                <SearchableDropdown
                  options={allBranches}
                  value={selectedBranch?.id ?? null}
                  onChange={(id) => { const b = allBranches.find(b => b.id === id); if (b) setSelectedBranch(b); }}
                  placeholder="Pilih Cabang"
                  searchPlaceholder="Cari cabang..."
                  align="left"
                  triggerClassName="w-full"
                />
              ) : (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">{selectedBranch?.name ?? "—"}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Transaction Type Selector ── */}
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border">
            <div className="flex gap-1.5 overflow-x-auto flex-nowrap py-0.5">
              {(["beli", "tukar_tambah", "jual_putus"] as TransactionType[]).map(t => (
                <button
                  key={t}
                  onClick={() => handleTransactionTypeChange(t)}
                  className={cn(
                    "flex-none w-auto px-3 h-8 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0",
                    transactionType === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {t === "beli" ? "Beli" : t === "tukar_tambah" ? "Tukar Tambah" : "Jual Putus"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab Bar ── */}
          {(() => {
            const visibleTabs: CartTab[] =
              transactionType === "jual_putus" ? ["data_unit", "pelanggan"] :
              transactionType === "tukar_tambah" ? ["unit_masuk", "keranjang", "pelanggan", "pembayaran"] :
              ["keranjang", "pembayaran", "pelanggan"];
            const tabLabels: Record<CartTab, string> = { unit_masuk: "Unit Masuk", data_unit: "Data Unit", keranjang: "Keranjang", pembayaran: "Pembayaran", pelanggan: "Pelanggan" };
            const tabIcons: Record<CartTab, React.ReactNode> = {
              unit_masuk: <Package className="w-3.5 h-3.5" />,
              data_unit: <Package2 className="w-3.5 h-3.5" />,
              keranjang: <ShoppingCart className="w-3.5 h-3.5" />,
              pembayaran: <CreditCard className="w-3.5 h-3.5" />,
              pelanggan: <User className="w-3.5 h-3.5" />,
            };
            return (
              <div className="shrink-0 flex border-b border-border overflow-x-auto flex-nowrap">
                {visibleTabs.map(tab => {
                  const hasError = tab === "pelanggan" && cart.length > 0 && customerType === "guest" && (!guestName.trim() || !guestPhone.trim());
                  const hasError2 = tab === "pelanggan" && cart.length > 0 && customerType === "registered" && !regCustomer;
                  const showDot = hasError || hasError2;
                  const isActive = cartTab === tab;
                  const tabWidth = visibleTabs.length >= 4 ? "min-w-[72px] flex-1 max-w-[90px]" : "flex-1";
                  return (
                    <button
                      key={tab}
                      onClick={() => setCartTab(tab)}
                      className={cn(
                        `${tabWidth} flex items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors relative shrink-0`,
                        isActive
                          ? "text-primary border-b-2 border-primary bg-primary/5"
                          : "text-foreground/60 hover:text-foreground hover:bg-muted/40"
                      )}
                    >
                      {tabIcons[tab]}
                      <span>{tabLabels[tab]}</span>
                      {tab === "keranjang" && cart.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                          {cart.length}
                        </span>
                      )}
                      {showDot && (
                        <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-destructive" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* ──── TAB: Unit Masuk (Tukar Tambah) ──── */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">

            {/* ──── TAB: Unit Masuk (Tukar Tambah) ──── */}
            {cartTab === "unit_masuk" && (
              <div className="px-4 py-4 space-y-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unit yang Diserahkan Customer</p>

                {/* Produk */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Produk (SKU)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={unitMasukProductSearch}
                      onChange={(e) => { setUnitMasukProductSearch(e.target.value); setUnitMasukProductDropdownOpen(true); if (!e.target.value) setSelectedUnitMasukProduct(null); }}
                      onFocus={() => setUnitMasukProductDropdownOpen(true)}
                      placeholder="Cari iPhone (default: iPhone)"
                      className="h-9 pl-9 pr-8 text-sm"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    {unitMasukProductDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto">
                        {unitMasukProducts.filter(p => getProductLabelUM(p).toLowerCase().includes(unitMasukProductSearch.toLowerCase())).map(p => (
                          <button key={p.id} type="button" onClick={() => {
                            setSelectedUnitMasukProduct(p);
                            setUnitMasuk(prev => prev ? { ...prev, product_id: p.id } : { product_id: p.id, imei: "", serial_number: "", condition_status: "no_minus", minus_severity: null, minus_description: "", harga_sepakat: 0, notes: "" });
                            setUnitMasukProductSearch(getProductLabelUM(p));
                            setUnitMasukProductDropdownOpen(false);
                          }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors">
                            <span className="font-medium">{p.series}</span>
                            <span className="text-muted-foreground"> — {p.storage_gb ? (p.storage_gb >= 1024 ? `${p.storage_gb / 1024} TB` : `${p.storage_gb} GB`) : ""} {p.color ?? ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* IMEI */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">IMEI</Label>
                  <div className="relative">
                    <Input value={unitMasuk?.imei ?? ""} onChange={(e) => setUnitMasuk(prev => prev ? { ...prev, imei: e.target.value } : { product_id: "", imei: e.target.value, serial_number: "", condition_status: "no_minus", minus_severity: null, minus_description: "", harga_sepakat: 0, notes: "" })} placeholder="Masukkan nomor IMEI (14–17 digit)" className="h-9 pr-8" maxLength={17} />
                    {unitMasukImeiChecking && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />}
                  </div>
                  {unitMasukImeiError && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3 h-3" />{unitMasukImeiError}</p>}
                </div>

                {/* Kondisi */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Kondisi</Label>
                  <div className="flex gap-2">
                    {(["no_minus", "minus"] as const).map(c => (
                      <button key={c} type="button" onClick={() => setUnitMasuk(prev => prev ? { ...prev, condition_status: c, minus_severity: c === "minus" ? (prev?.minus_severity ?? "minor") : null } : null)} className={cn("flex-1 h-9 rounded-lg border text-xs font-medium transition-colors",
                        (unitMasuk?.condition_status ?? "no_minus") === c
                          ? c === "no_minus" ? "border-[hsl(var(--status-available))] bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]" : "border-[hsl(var(--status-minus))] bg-[hsl(var(--status-minus-bg))] text-[hsl(var(--status-minus-fg))]"
                          : "border-border text-muted-foreground hover:bg-accent")}>
                        {c === "no_minus" ? "No Minus" : "Minus"}
                      </button>
                    ))}
                  </div>
                </div>

                {unitMasuk?.condition_status === "minus" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tingkat Minus</Label>
                      <div className="flex gap-2">
                        {(["minor", "mayor"] as const).map(s => (
                          <button key={s} type="button" onClick={() => setUnitMasuk(prev => prev ? { ...prev, minus_severity: s } : null)} className={cn("flex-1 h-8 rounded-lg border text-xs font-medium transition-colors capitalize",
                            (unitMasuk?.minus_severity ?? "minor") === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Deskripsi Minus</Label>
                      <Textarea value={unitMasuk?.minus_description ?? ""} onChange={(e) => setUnitMasuk(prev => prev ? { ...prev, minus_description: e.target.value } : null)} placeholder="Contoh: Lecet di body, shadow tipis LCD, baterai drop, dll." className="resize-none h-16 text-xs" />
                    </div>
                  </>
                )}

                {/* Harga Sepakat */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Harga Sepakat</Label>
                  <Input value={unitMasuk?.harga_sepakat ? formatCurrency(unitMasuk.harga_sepakat, false) : ""} onChange={(e) => {
                    const num = parseInt(e.target.value.replace(/\D/g, ""), 10);
                    setUnitMasuk(prev => prev ? { ...prev, harga_sepakat: isNaN(num) ? 0 : num } : { product_id: "", imei: "", serial_number: "", condition_status: "no_minus", minus_severity: null, minus_description: "", harga_sepakat: isNaN(num) ? 0 : num, notes: "" });
                  }} placeholder="Masukkan harga sepakat..." className="h-9 text-sm" />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Catatan</Label>
                  <Textarea value={unitMasuk?.notes ?? ""} onChange={(e) => setUnitMasuk(prev => prev ? { ...prev, notes: e.target.value } : null)} placeholder="Catatan tambahan (opsional)" className="resize-none h-14 text-xs" />
                </div>

                {unitMasuk && unitMasuk.product_id && unitMasuk.harga_sepakat > 0 && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ringkasan Unit Masuk</p>
                    {selectedUnitMasukProduct && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Produk</span><span className="font-semibold">{getProductLabelUM(selectedUnitMasukProduct)}</span></div>}
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Kondisi</span><span className="font-semibold">{unitMasuk.condition_status === "no_minus" ? "No Minus" : `Minus ${unitMasuk.minus_severity ?? ""}`}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between"><span className="text-xs font-bold text-foreground">Harga Sepakat</span><span className="text-sm font-bold text-foreground">{formatCurrency(unitMasuk.harga_sepakat)}</span></div>
                  </div>
                )}
              </div>
            )}

            {/* ──── TAB: Data Unit (Jual Putus) ──── */}
            {cartTab === "data_unit" && (
              <div className="px-4 py-4 space-y-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unit yang Dibeli dari Customer</p>

                {/* Produk */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Produk (SKU)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={unitMasukProductSearch} onChange={(e) => { setUnitMasukProductSearch(e.target.value); setUnitMasukProductDropdownOpen(true); if (!e.target.value) setSelectedUnitMasukProduct(null); }} onFocus={() => setUnitMasukProductDropdownOpen(true)} placeholder="Cari produk..." className="h-9 pl-9 pr-8 text-sm" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    {unitMasukProductDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto">
                        {unitMasukProducts.filter(p => getProductLabelUM(p).toLowerCase().includes(unitMasukProductSearch.toLowerCase())).map(p => (
                          <button key={p.id} type="button" onClick={() => {
                            setSelectedUnitMasukProduct(p);
                            setUnitMasuk(prev => prev ? { ...prev, product_id: p.id } : { product_id: p.id, imei: "", serial_number: "", condition_status: "no_minus", minus_severity: null, minus_description: "", harga_sepakat: 0, notes: "" });
                            setUnitMasukProductSearch(getProductLabelUM(p));
                            setUnitMasukProductDropdownOpen(false);
                          }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors">
                            <span className="font-medium">{p.series}</span>
                            <span className="text-muted-foreground"> — {p.storage_gb ? (p.storage_gb >= 1024 ? `${p.storage_gb / 1024} TB` : `${p.storage_gb} GB`) : ""} {p.color ?? ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* IMEI */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">IMEI</Label>
                  <div className="relative">
                    <Input value={unitMasuk?.imei ?? ""} onChange={(e) => setUnitMasuk(prev => prev ? { ...prev, imei: e.target.value } : { product_id: "", imei: e.target.value, serial_number: "", condition_status: "no_minus", minus_severity: null, minus_description: "", harga_sepakat: 0, notes: "" })} placeholder="Masukkan nomor IMEI (14–17 digit)" className="h-9 pr-8" maxLength={17} />
                    {unitMasukImeiChecking && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />}
                  </div>
                  {unitMasukImeiError && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3 h-3" />{unitMasukImeiError}</p>}
                </div>

                {/* Kondisi */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Kondisi</Label>
                  <div className="flex gap-2">
                    {(["no_minus", "minus"] as const).map(c => (
                      <button key={c} type="button" onClick={() => setUnitMasuk(prev => prev ? { ...prev, condition_status: c, minus_severity: c === "minus" ? (prev?.minus_severity ?? "minor") : null } : null)} className={cn("flex-1 h-9 rounded-lg border text-xs font-medium transition-colors",
                        (unitMasuk?.condition_status ?? "no_minus") === c
                          ? c === "no_minus" ? "border-[hsl(var(--status-available))] bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]" : "border-[hsl(var(--status-minus))] bg-[hsl(var(--status-minus-bg))] text-[hsl(var(--status-minus-fg))]"
                          : "border-border text-muted-foreground hover:bg-accent")}>
                        {c === "no_minus" ? "No Minus" : "Minus"}
                      </button>
                    ))}
                  </div>
                </div>

                {unitMasuk?.condition_status === "minus" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tingkat Minus</Label>
                      <div className="flex gap-2">{(["minor", "mayor"] as const).map(s => (
                        <button key={s} type="button" onClick={() => setUnitMasuk(prev => prev ? { ...prev, minus_severity: s } : null)} className={cn("flex-1 h-8 rounded-lg border text-xs font-medium transition-colors capitalize",
                          (unitMasuk?.minus_severity ?? "minor") === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
                          {s}
                        </button>
                      ))}</div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Deskripsi Minus</Label>
                      <Textarea value={unitMasuk?.minus_description ?? ""} onChange={(e) => setUnitMasuk(prev => prev ? { ...prev, minus_description: e.target.value } : null)} placeholder="Contoh: Lecet di body, shadow tipis LCD, baterai drop, dll." className="resize-none h-16 text-xs" />
                    </div>
                  </>
                )}

                {/* Harga Sepakat */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Harga yang Kami Bayar</Label>
                  <Input value={unitMasuk?.harga_sepakat ? formatCurrency(unitMasuk.harga_sepakat, false) : ""} onChange={(e) => {
                    const num = parseInt(e.target.value.replace(/\D/g, ""), 10);
                    setUnitMasuk(prev => prev ? { ...prev, harga_sepakat: isNaN(num) ? 0 : num } : { product_id: "", imei: "", serial_number: "", condition_status: "no_minus", minus_severity: null, minus_description: "", harga_sepakat: isNaN(num) ? 0 : num, notes: "" });
                  }} placeholder="Masukkan harga sepakat..." className="h-9 text-sm" />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Catatan</Label>
                  <Textarea value={unitMasuk?.notes ?? ""} onChange={(e) => setUnitMasuk(prev => prev ? { ...prev, notes: e.target.value } : null)} placeholder="Catatan tambahan (opsional)" className="resize-none h-14 text-xs" />
                </div>

                {unitMasuk && unitMasuk.product_id && unitMasuk.harga_sepakat > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                    <p className="text-xs font-bold text-amber-800">Unit akan dicatat sebagai:</p>
                    <div className="flex justify-between text-sm"><span className="text-amber-700">Harga Bayar (kami)</span><span className="text-sm font-bold text-amber-900">{formatCurrency(unitMasuk.harga_sepakat)}</span></div>
                    <p className="text-[10px] text-amber-600 italic">Status unit: "Pending Verifikasi" — menunggu persetujuan sebelum masuk stok.</p>
                  </div>
                )}
              </div>
            )}

            {/* ──── TAB: Keranjang ──── */}
            {cartTab === "keranjang" && (
              <div className="h-full flex flex-col">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-6 py-12">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Keranjang kosong</p>
                      <p className="text-xs text-muted-foreground">
                        {isMobile ? "Ketuk + untuk pilih produk" : "Pilih unit dari daftar sebelah kiri"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-muted-foreground">{cart.length} item dipilih</p>
                      <button onClick={() => setCart([])} className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors">
                        Kosongkan
                      </button>
                    </div>
                    {cart.map(item => (
                      <CartItemRow
                        key={cartItemId(item)}
                        item={item}
                        onRemove={removeFromCart}
                        onToggle={toggleCartItem}
                        onNego={item.kind === 'unit' ? (isNego, negoPrice) => applyNegoForItem(item.unit!.id, isNego, negoPrice) : undefined}
                        bonusItems={item.kind === 'unit' ? (categoryBonusMap[getMasterProduct(item.unit!)?.category ?? ""] ?? []) : []}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ──── TAB: Pelanggan ──── */}
            {cartTab === "pelanggan" && (
              <div className="px-4 py-4 space-y-4">

                {/* Section header: CUSTOMER */}
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer</p>

                {/* ── Selected customer card (registered) ── */}
                {regCustomer && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    {/* Header strip */}
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">Data Pelanggan</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20 leading-none">
                          Terdaftar
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {editingCustomer ? (
                          <button type="button" onClick={() => setEditingCustomer(false)}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors">
                            <CheckCircle2 className="w-3 h-3" /> Simpan
                          </button>
                        ) : (
                          <button type="button" onClick={() => setEditingCustomer(true)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/8">
                            <Handshake className="w-3 h-3" /> Edit
                          </button>
                        )}
                        <span className="text-border/80 select-none">·</span>
                        <button type="button" onClick={clearSelectedCustomer}
                          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded hover:bg-destructive/8">
                          <X className="w-3 h-3" /> Ganti
                        </button>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-3 flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-sm font-black text-primary">
                          {(regCustomer.name || guestName || "?")[0].toUpperCase()}
                        </span>
                      </div>

                      {/* Info — view or edit */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {editingCustomer ? (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                <User className="w-2.5 h-2.5" /> Nama
                              </label>
                              <Input
                                value={regCustomer.name}
                                onChange={e => setRegCustomer(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                placeholder="Nama pelanggan"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" /> No. WhatsApp
                              </label>
                              <Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                <Mail className="w-2.5 h-2.5" /> Email
                              </label>
                              <Input
                                value={regCustomer.email}
                                onChange={e => setRegCustomer(prev => prev ? { ...prev, email: e.target.value } : prev)}
                                placeholder="Email pelanggan"
                                type="email"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div>
                              {(regCustomer.name || guestName)
                                ? <p className="text-sm font-bold text-foreground leading-tight">{regCustomer.name || guestName}</p>
                                : <p className="text-sm font-semibold text-foreground/30 italic leading-tight">(Nama belum ada)</p>}
                              <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wide">Akun Terdaftar</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-foreground/30 shrink-0" />
                                {guestPhone
                                  ? <span className="text-xs font-medium text-foreground">{guestPhone}</span>
                                  : <span className="text-xs text-amber-600 font-semibold">Belum diisi</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-foreground/30 shrink-0" />
                                {regCustomer.email
                                  ? <span className="text-xs font-medium text-foreground">{regCustomer.email}</span>
                                  : <span className="text-xs text-foreground/40 italic">—</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-foreground/30 shrink-0" />
                                <span className={cn("text-xs font-medium",
                                  needsShipping && !province ? "text-destructive" : "text-foreground/50"
                                )}>
                                  {savedAddresses.length > 0
                                    ? `${savedAddresses.length} alamat tersimpan`
                                    : needsShipping ? "Alamat wajib diisi" : "Belum ada alamat"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}


                {/* ── PayLater Address Form for registered customer ── */}
                {regCustomer && effectiveIsPayLater && (
                  <div className="space-y-2">
                    {!showPlAddressForm && !plProvinceName ? (
                      <button
                        type="button"
                        onClick={() => setShowPlAddressForm(true)}
                        className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-orange-400 bg-orange-50 text-xs font-semibold text-orange-800 hover:bg-orange-100 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Isi Alamat Akulaku
                      </button>
                    ) : (
                      <div className="rounded-xl border border-orange-400 bg-orange-50 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            Alamat Akulaku
                          </p>
                          {missingPayLaterFields().length === 0 ? (
                            <span className="text-[10px] font-semibold text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Lengkap
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-orange-700">
                              Belum: {missingPayLaterFields().join(", ")}
                            </span>
                          )}
                        </div>

                        {savedGuestAddresses.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Pilih Alamat Tersimpan</p>
                            <div className="space-y-1.5">
                              {savedGuestAddresses.map(addr => (
                                <button key={addr.id} type="button" onClick={() => applyGuestAddressToPayLater(addr)}
                                  className={cn("w-full text-left rounded-lg border px-3 py-2 transition-colors text-xs",
                                    plProvinceName === addr.province_name && guestAddress === addr.full_address
                                      ? "border-orange-500 bg-orange-100"
                                      : "border-border bg-white hover:bg-muted/50"
                                  )}>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-foreground">{addr.label || addr.recipient_name || "Alamat"}</span>
                                    {plProvinceName === addr.province_name && guestAddress === addr.full_address && (
                                      <CheckCircle2 className="w-3 h-3 text-orange-600" />
                                    )}
                                  </div>
                                  <p className="text-neutral-500 leading-relaxed">{addr.full_address}, {addr.district_name}, {addr.regency_name}, {addr.province_name} {addr.postal_code}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {savedAddresses.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Pilih Alamat Tersimpan</p>
                            <div className="space-y-1.5">
                              {savedAddresses.map(addr => (
                                <button key={addr.id} type="button" onClick={() => applySavedToPayLater(addr)}
                                  className={cn("w-full text-left rounded-lg border px-3 py-2 transition-colors text-xs",
                                    plProvince === addr.province_code && guestAddress === addr.full_address
                                      ? "border-orange-500 bg-orange-100"
                                      : "border-border bg-white hover:bg-muted/50"
                                  )}>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-foreground">{addr.label || "Alamat"}</span>
                                    {plProvince === addr.province_code && guestAddress === addr.full_address && (
                                      <CheckCircle2 className="w-3 h-3 text-orange-600" />
                                    )}
                                  </div>
                                  <p className="text-neutral-500 leading-relaxed">{addr.full_address}, {addr.district_name}, {addr.regency_name}, {addr.province_name} {addr.postal_code}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-xs font-bold text-orange-900">
                            {savedAddresses.length > 0 || savedGuestAddresses.length > 0 ? "Atau Isi Manual" : "Alamat Domisili *"}
                          </p>
                          <PayLaterAddressForm
                            provinces={provinces}
                            plProvince={plProvince} setPlProvince={setPlProvince} setPlProvinceName={setPlProvinceName}
                            plRegency={plRegency} setPlRegency={setPlRegency} setPlRegencyName={setPlRegencyName}
                            plDistrict={plDistrict} setPlDistrict={setPlDistrict} setPlDistrictName={setPlDistrictName}
                            plVillage={plVillage} setPlVillage={setPlVillage} setPlVillageName={setPlVillageName}
                            plRegencies={plRegencies} plDistricts={plDistricts} plVillages={plVillages}
                            guestAddress={guestAddress} setGuestAddress={setGuestAddress}
                            guestPostcode={guestPostcode} setGuestPostcode={setGuestPostcode}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Unified search ── */}
                {!regCustomer && !showCustomerForm && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Temukan Data Customer</p>
                    <div className="relative">
                      <Input
                        value={unifiedQuery}
                        onChange={e => setUnifiedQuery(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && unifiedQuery.trim().length >= 2 && !unifiedLoading) {
                            setGuestName(unifiedQuery.trim());
                            setCustomerType("guest");
                            setShowCustomerForm(true);
                            setUnifiedResults([]);
                          }
                        }}
                        placeholder="Ketik nama, no. WA, atau email..."
                        className="h-9 text-sm pr-8"
                      />
                      {unifiedLoading && (
                        <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
                      )}
                    </div>

                    {/* Dropdown results */}
                    {unifiedQuery.trim().length >= 2 && !unifiedLoading && (
                      <>
                        {unifiedResults.length > 0 ? (
                          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border max-h-56 overflow-y-auto">
                            {unifiedResults.map((r, i) => (
                              <button key={i} onClick={() => selectUnified(r)} className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className={cn("text-sm font-bold leading-tight", r.name ? "text-foreground" : "text-foreground/30 italic")}>
                                    {r.name || "(Nama belum ada)"}
                                  </p>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className={cn(
                                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none",
                                      r.type === "registered"
                                        ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                        : "bg-neutral-500/10 text-neutral-600 border-neutral-500/20"
                                    )}>
                                      {r.type === "registered" ? "Terdaftar" : "Tanpa Akun"}
                                    </span>
                                    {r.type !== "registered" && r.count ? (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-700 border-amber-500/20 leading-none">
                                        {r.count}× trx
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  <span className="text-xs text-neutral-500 flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5 shrink-0" />
                                    {r.phone
                                      ? <span className="font-medium text-foreground">{r.phone}</span>
                                      : <span className="italic text-neutral-400">—</span>}
                                  </span>
                                  <span className="text-xs text-neutral-500 flex items-center gap-1">
                                    <Mail className="w-2.5 h-2.5 shrink-0" />
                                    {r.email
                                      ? <span className="font-medium text-foreground">{r.email}</span>
                                      : <span className="italic text-neutral-400">—</span>}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-border px-3 py-3 space-y-2">
                            <p className="text-xs text-neutral-500">Data customer tidak ditemukan.</p>
                            <Button
                              size="sm"
                              className="h-8 text-xs w-full gap-1.5"
                              onClick={() => { setGuestName(unifiedQuery.trim()); setCustomerType("guest"); setShowCustomerForm(true); }}
                            >
                              <Plus className="w-3 h-3" />
                              Buat Data Customer Baru
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {/* CTA buat baru — muncul sebelum user search */}
                    {unifiedQuery.trim().length < 2 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs w-full gap-1.5"
                        onClick={() => { setCustomerType("guest"); setShowCustomerForm(true); }}
                      >
                        <Plus className="w-3 h-3" />
                        Buat Data Customer Baru
                      </Button>
                    )}
                  </div>
                )}

                {/* ── Form pembeli baru ── */}
                {!regCustomer && showCustomerForm && (
                  <div className="space-y-3">
                    {customerLockedFromSearch ? (
                      /* ── Selected customer card (guest) ── */
                      <div className="rounded-xl border border-border overflow-hidden">
                        {/* Header strip */}
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">Data Pelanggan</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {editingCustomer ? (
                              <button type="button" onClick={() => setEditingCustomer(false)}
                                className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors">
                                <CheckCircle2 className="w-3 h-3" /> Simpan
                              </button>
                            ) : (
                              <button type="button" onClick={() => setEditingCustomer(true)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/8">
                                <Handshake className="w-3 h-3" /> Edit
                              </button>
                            )}
                            <span className="text-border/80 select-none">·</span>
                            <button type="button" onClick={clearSelectedCustomer}
                              className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded hover:bg-destructive/8">
                              <X className="w-3 h-3" /> Ganti
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-3 flex items-start gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-sm font-black text-primary">
                              {(guestName || "?")[0].toUpperCase()}
                            </span>
                          </div>

                          {/* Info — view or edit */}
                          <div className="flex-1 min-w-0 space-y-2">
                            {editingCustomer ? (
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                    <User className="w-2.5 h-2.5" /> Nama
                                  </label>
                                  <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Nama pelanggan" className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5" /> No. WhatsApp
                                  </label>
                                  <Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                    <Mail className="w-2.5 h-2.5" /> Email
                                    {effectiveIsPayLater && <span className="text-destructive">*</span>}
                                  </label>
                                  <Input
                                    value={guestEmail}
                                    onChange={e => setGuestEmail(e.target.value)}
                                    placeholder="Email pelanggan"
                                    type="email"
                                    className={cn("h-8 text-sm", guestEmail.trim() && !isValidEmail(guestEmail) ? "border-destructive" : "")}
                                  />
                                  {guestEmail.trim() && !isValidEmail(guestEmail) && (
                                    <p className="text-[10px] text-destructive flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> Format email tidak valid
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div>
                                  {guestName
                                    ? <p className="text-sm font-bold text-foreground leading-tight">{guestName}</p>
                                    : <p className="text-sm font-semibold text-foreground/30 italic leading-tight">(Nama belum ada)</p>}
                                  <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wide">Tanpa Akun</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-3 h-3 text-foreground/30 shrink-0" />
                                    {guestPhone
                                      ? <span className="text-xs font-medium text-foreground">{guestPhone}</span>
                                      : <span className="text-xs font-semibold text-amber-600">Belum diisi</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-3 h-3 text-foreground/30 shrink-0" />
                                    {guestEmail
                                      ? <span className="text-xs font-medium text-foreground">{guestEmail}</span>
                                      : <span className={cn("text-xs font-semibold", effectiveIsPayLater ? "text-red-500" : "text-foreground/40")}>
                                          {effectiveIsPayLater ? "Wajib untuk PayLater" : "Belum diisi"}
                                        </span>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ── Full form ── */
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5 w-full"
                          onClick={clearSelectedCustomer}
                        >
                          <Search className="w-3 h-3" />
                          Cari Data Customer yang Ada
                        </Button>

                        <div className="space-y-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Nama Pembeli *</label>
                            <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Nama pembeli" className="h-9 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">No. WhatsApp *</label>
                            <Input
                              value={guestPhone}
                              onChange={e => { setGuestPhone(e.target.value); setPhoneConflict([]); }}
                              placeholder="08xxxxxxxxxx"
                              type="tel"
                              className={cn("h-9 text-sm", phoneConflict.length > 0 ? "border-amber-500" : "")}
                            />
                            {phoneConflict.length > 0 && (
                              <div className="rounded-lg border border-amber-400 bg-amber-50 p-2.5 space-y-2">
                                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  Nomor ini sudah pernah digunakan
                                </p>
                                <p className="text-xs text-amber-700">Customer dengan nomor ini sudah tercatat. Pilih untuk menggunakan data yang ada:</p>
                                <div className="space-y-1">
                                  {phoneConflict.map((c, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => { setGuestName(c.name); setGuestEmail(c.email || ""); setPhoneConflict([]); setEmailConflict([]); setCustomerLockedFromSearch(true); }}
                                      className="w-full text-left rounded-md bg-white border border-amber-300 px-2.5 py-2 hover:bg-emerald-50 hover:border-emerald-400 transition-colors group"
                                    >
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-foreground">{c.name}</p>
                                        <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">Gunakan Akun →</span>
                                      </div>
                                      <p className="text-[11px] text-neutral-500">{c.phone}{c.email ? ` · ${c.email}` : ""} <span className="text-amber-600 font-medium">· {c.count}× trx</span></p>
                                    </button>
                                  ))}
                                </div>
                                <p className="text-[11px] text-amber-600">Klik nama di atas untuk gunakan data tersebut, atau lanjut isi jika memang berbeda.</p>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">
                              Email {effectiveIsPayLater ? <span className="text-destructive">*</span> : <span className="text-neutral-400 font-normal">(opsional)</span>}
                            </label>
                            <Input
                              value={guestEmail}
                              onChange={e => { setGuestEmail(e.target.value); setEmailConflict([]); }}
                              placeholder="Email pembeli"
                              type="email"
                              className={cn("h-9 text-sm",
                                emailConflict.length > 0 ? "border-amber-500" :
                                guestEmail.trim() && !isValidEmail(guestEmail) ? "border-destructive" :
                                effectiveIsPayLater && !guestEmail.trim() ? "border-destructive" : ""
                              )}
                            />
                            {guestEmail.trim() && !isValidEmail(guestEmail) && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Format email tidak valid
                              </p>
                            )}
                            {emailConflict.length > 0 && (
                              <div className="rounded-lg border border-amber-400 bg-amber-50 p-2.5 space-y-2">
                                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  Email ini sudah pernah digunakan
                                </p>
                                <div className="space-y-1">
                                  {emailConflict.map((c, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => { setGuestName(c.name); setGuestPhone(c.phone || ""); setEmailConflict([]); setPhoneConflict([]); setCustomerLockedFromSearch(true); }}
                                      className="w-full text-left rounded-md bg-white border border-amber-300 px-2.5 py-2 hover:bg-emerald-50 hover:border-emerald-400 transition-colors group"
                                    >
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-foreground">{c.name}</p>
                                        <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">Gunakan Akun →</span>
                                      </div>
                                      <p className="text-[11px] text-neutral-500">{c.email}{c.phone ? ` · ${c.phone}` : ""} <span className="text-amber-600 font-medium">· {c.count}× trx</span></p>
                                    </button>
                                  ))}
                                </div>
                                <p className="text-[11px] text-amber-600">Klik nama di atas untuk gunakan data tersebut, atau lanjut isi jika memang berbeda.</p>
                              </div>
                            )}
                            {effectiveIsPayLater && !guestEmail.trim() && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Email wajib untuk PayLater
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── PayLater Address Form — tampil di kedua mode ── */}
                    {effectiveIsPayLater && (
                      <div className="space-y-2 pt-1">
                        {!showPlAddressForm && !plProvinceName ? (
                          <button
                            type="button"
                            onClick={() => setShowPlAddressForm(true)}
                            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-orange-400 bg-orange-50 text-xs font-semibold text-orange-800 hover:bg-orange-100 transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Isi Alamat Akulaku
                          </button>
                        ) : (
                          <div className="rounded-xl border border-orange-400 bg-orange-50 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                Alamat Akulaku
                              </p>
                              {missingPayLaterFields().length === 0 ? (
                                <span className="text-[10px] font-semibold text-green-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Lengkap
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-orange-700">
                                  Belum: {missingPayLaterFields().join(", ")}
                                </span>
                              )}
                            </div>

                            {savedAddresses.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Pilih Alamat Tersimpan</p>
                                <div className="space-y-1.5">
                                  {savedAddresses.map(addr => (
                                    <button key={addr.id} type="button" onClick={() => applySavedToPayLater(addr)}
                                      className={cn("w-full text-left rounded-lg border px-3 py-2 transition-colors text-xs",
                                        plProvince === addr.province_code && guestAddress === addr.full_address
                                          ? "border-orange-500 bg-orange-100"
                                          : "border-border bg-white hover:bg-muted/50"
                                      )}>
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-semibold text-foreground">{addr.label || "Alamat"}</span>
                                        {plProvince === addr.province_code && guestAddress === addr.full_address && (
                                          <CheckCircle2 className="w-3 h-3 text-orange-600" />
                                        )}
                                      </div>
                                      <p className="text-neutral-500 leading-relaxed">{addr.full_address}, {addr.district_name}, {addr.regency_name}, {addr.province_name} {addr.postal_code}</p>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <p className="text-xs font-bold text-orange-900">
                                {savedAddresses.length > 0 ? "Atau Isi Manual" : "Alamat Domisili *"}
                              </p>
                              <PayLaterAddressForm
                                provinces={provinces}
                                plProvince={plProvince} setPlProvince={setPlProvince} setPlProvinceName={setPlProvinceName}
                                plRegency={plRegency} setPlRegency={setPlRegency} setPlRegencyName={setPlRegencyName}
                                plDistrict={plDistrict} setPlDistrict={setPlDistrict} setPlDistrictName={setPlDistrictName}
                                plVillage={plVillage} setPlVillage={setPlVillage} setPlVillageName={setPlVillageName}
                                plRegencies={plRegencies} plDistricts={plDistricts} plVillages={plVillages}
                                guestAddress={guestAddress} setGuestAddress={setGuestAddress}
                                guestPostcode={guestPostcode} setGuestPostcode={setGuestPostcode}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Shipping Section ── */}
                <div className="border-t border-border pt-4 space-y-3">
                  {/* Section header: KONFIGURASI PENGIRIMAN */}
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Konfigurasi Pengiriman</p>
                  <div className="flex items-center justify-between">
                    <label htmlFor="needs-shipping" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                      <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                      Aktifkan Pengiriman
                    </label>
                    <Switch
                      id="needs-shipping"
                      checked={needsShipping}
                      onCheckedChange={(checked) => {
                        setNeedsShipping(checked);
                        if (!checked) {
                          setSelectedShipping(null);
                          setShippingOptions([]);
                        }
                      }}
                    />
                  </div>

                  {needsShipping && (
                    <div className="space-y-3 pl-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Alamat Pengiriman</p>

                      {hasPlAddress && !hasSavedAddresses && shippingAddressMode !== "custom" && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs space-y-1">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-semibold text-foreground">Menggunakan alamat Akulaku</span>
                          </div>
                          <p className="text-neutral-500 pl-5">{guestAddress}, {plDistrictName && `${plDistrictName}, `}{plRegencyName}, {plProvinceName}</p>
                          <button type="button" onClick={() => setShippingAddressMode("custom")} className="text-[11px] text-primary hover:underline pl-5 font-medium">
                            Gunakan alamat lain
                          </button>
                        </div>
                      )}

                      {showShippingRadios && (
                      <div className="space-y-2">
                        {effectiveIsPayLater && (
                          <button
                            type="button"
                            onClick={() => {
                              if (plProvinceName && guestAddress) {
                                setShippingAddressMode("paylater");
                                applyPayLaterToShipping();
                              } else {
                                setShippingAddressMode("paylater");
                                setShowPlAddressForm(true);
                                setCartTab("pelanggan");
                              }
                            }}
                            className={cn(
                              "w-full text-left rounded-lg border px-3 py-2.5 transition-colors text-xs space-y-0.5",
                              shippingAddressMode === "paylater" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                                shippingAddressMode === "paylater" ? "border-primary" : "border-muted-foreground"
                              )}>
                                {shippingAddressMode === "paylater" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                              </div>
                              <span className="font-semibold text-foreground">Gunakan alamat Akulaku</span>
                            </div>
                            {plProvinceName && guestAddress ? (
                              <p className="text-neutral-500 pl-5">{guestAddress}, {plDistrictName && `${plDistrictName}, `}{plRegencyName}, {plProvinceName}</p>
                            ) : (
                              <p className="text-orange-600 pl-5 text-[11px]">Isi alamat Akulaku terlebih dahulu di tab Pelanggan</p>
                            )}
                          </button>
                        )}

                        {savedGuestAddresses.map(addr => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => { setShippingAddressMode("custom"); applyGuestAddressToShipping(addr); }}
                            className={cn(
                              "w-full text-left rounded-lg border px-3 py-2.5 transition-colors text-xs space-y-0.5",
                              shippingAddressMode === "custom" && provinceName === addr.province_name && fullAddress === addr.full_address
                                ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                                shippingAddressMode === "custom" && provinceName === addr.province_name && fullAddress === addr.full_address
                                  ? "border-primary" : "border-muted-foreground"
                              )}>
                                {shippingAddressMode === "custom" && provinceName === addr.province_name && fullAddress === addr.full_address && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                              </div>
                              <span className="font-semibold text-foreground">{addr.label || addr.recipient_name || "Alamat Tersimpan"}</span>
                            </div>
                            <p className="text-neutral-500 pl-5">{addr.full_address}, {addr.district_name}, {addr.regency_name}, {addr.province_name}</p>
                          </button>
                        ))}

                        {savedAddresses.map(addr => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => { setShippingAddressMode("custom"); applySavedToShipping(addr); }}
                            className={cn(
                              "w-full text-left rounded-lg border px-3 py-2.5 transition-colors text-xs space-y-0.5",
                              shippingAddressMode === "custom" && province === addr.province_code && fullAddress === addr.full_address
                                ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                                shippingAddressMode === "custom" && province === addr.province_code && fullAddress === addr.full_address
                                  ? "border-primary" : "border-muted-foreground"
                              )}>
                                {shippingAddressMode === "custom" && province === addr.province_code && fullAddress === addr.full_address && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                              </div>
                              <span className="font-semibold text-foreground">{addr.label || "Alamat Tersimpan"}</span>
                            </div>
                            <p className="text-neutral-500 pl-5">{addr.full_address}, {addr.district_name}, {addr.regency_name}, {addr.province_name}</p>
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => { setShippingAddressMode("custom"); }}
                          className={cn(
                            "w-full text-left rounded-lg border px-3 py-2.5 transition-colors text-xs",
                            shippingAddressMode === "custom" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                              shippingAddressMode === "custom" ? "border-primary" : "border-muted-foreground"
                            )}>
                              {shippingAddressMode === "custom" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </div>
                            <span className="font-semibold text-foreground">Input alamat lain / berbeda</span>
                          </div>
                        </button>
                      </div>
                      )}

                      {/* Form wilayah shipping (hanya tampil jika mode custom) */}
                      {shippingAddressMode === "custom" && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-foreground">Provinsi *</label>
                            <AutocompleteDropdown compact options={provinces.map(p => ({ id: p.code, name: p.name }))} value={province}
                              onChange={id => { setProvince(id); setProvinceName(provinces.find(p => p.code === id)?.name || ""); setRegency(null); setRegencyName(""); setDistrict(null); setDistrictName(""); setVillage(null); setVillageName(""); }}
                              placeholder="Pilih provinsi" searchPlaceholder="Cari provinsi..." align="left" className="w-full" triggerClassName="w-full justify-start" />
                          </div>
                          <div className="space-y-1">
                            <label className={cn("text-[10px] font-semibold", !province ? "text-muted-foreground" : "text-foreground")}>Kota/Kabupaten *</label>
                            <AutocompleteDropdown compact options={regencies.map(r => ({ id: r.code, name: r.name }))} value={regency}
                              onChange={id => { setRegency(id); setRegencyName(regencies.find(r => r.code === id)?.name || ""); setDistrict(null); setDistrictName(""); setVillage(null); setVillageName(""); }}
                              placeholder={province ? "Pilih kota/kab" : "Pilih provinsi dulu"} searchPlaceholder="Cari kota/kab..." align="left" className="w-full" triggerClassName={cn("w-full justify-start", !province && "opacity-50 pointer-events-none")} />
                          </div>
                          <div className="space-y-1">
                            <label className={cn("text-[10px] font-semibold", !regency ? "text-muted-foreground" : "text-foreground")}>Kecamatan *</label>
                            <AutocompleteDropdown compact options={districts.map(d => ({ id: d.code, name: d.name }))} value={district}
                              onChange={id => { setDistrict(id); setDistrictName(districts.find(d => d.code === id)?.name || ""); setVillage(null); setVillageName(""); }}
                              placeholder={regency ? "Pilih kecamatan" : "Pilih kota dulu"} searchPlaceholder="Cari kecamatan..." align="left" className="w-full" triggerClassName={cn("w-full justify-start", !regency && "opacity-50 pointer-events-none")} />
                          </div>
                          <div className="space-y-1">
                            <label className={cn("text-[10px] font-semibold", !district ? "text-muted-foreground" : "text-foreground")}>Kelurahan</label>
                            <AutocompleteDropdown compact options={villages.map(v => ({ id: v.code, name: v.name }))} value={village}
                              onChange={id => { setVillage(id); setVillageName(villages.find(v => v.code === id)?.name || ""); }}
                              placeholder={district ? "Pilih kelurahan" : "Pilih kecamatan dulu"} searchPlaceholder="Cari kelurahan..." align="left" className="w-full" triggerClassName={cn("w-full justify-start", !district && "opacity-50 pointer-events-none")} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-foreground">Alamat Lengkap *</label>
                            <Input value={fullAddress} onChange={e => setFullAddress(e.target.value)} placeholder="Jl. Contoh No. 123, RT/RW..." className="h-9 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-foreground">Kode Pos</label>
                            <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="60xxx" className="h-9 text-xs w-24" />
                          </div>
                        </div>
                      )}

                      {/* Shipping options */}
                      {district && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Package className="w-3 h-3" /> Opsi Pengiriman
                            </p>
                            <button onClick={fetchShippingOptions} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" /> Refresh
                            </button>
                          </div>

                          {shippingLoading ? (
                            <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-[11px]">Memuat ongkir...</span>
                            </div>
                          ) : shippingOptions.length === 0 ? (
                            <div className="p-3 rounded-xl border border-border bg-muted/50 text-center">
                              <p className="text-[11px] text-muted-foreground">Tidak ada opsi pengiriman tersedia.</p>
                              <button onClick={fetchShippingOptions} className="text-[10px] text-primary hover:underline mt-1">Coba Lagi</button>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {shippingOptions.map((opt, i) => (
                                <button
                                  key={`${opt.courier}-${opt.service}-${i}`}
                                  onClick={() => setSelectedShipping(opt)}
                                  className={cn(
                                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                                    selectedShipping === opt
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:border-primary/40"
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium text-foreground">{opt.courierName} — {opt.service}</p>
                                    <p className="text-[10px] text-muted-foreground">Est. {opt.etd} hari</p>
                                  </div>
                                  <p className="text-xs font-bold text-foreground shrink-0">{formatCurrency(opt.cost)}</p>
                                  {selectedShipping === opt && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Packing Kayu */}
                  {needsShipping && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Checkbox
                        id="packing-kayu"
                        checked={packingKayu}
                        onCheckedChange={(checked) => setPackingKayu(!!checked)}
                      />
                      <label htmlFor="packing-kayu" className="text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer">
                        <Package className="w-3.5 h-3.5" />
                        Packing Kayu (+Rp 25.000)
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ──── TAB: Pembayaran ──── */}
            {cartTab === "pembayaran" && (
              <div className="px-4 py-4 space-y-4">

                {/* Kode Diskon */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Kode Diskon</p>
                  {!appliedDiscount ? (
                    <div className="flex gap-2">
                      <Input
                        value={discountCodeInput}
                        onChange={e => setDiscountCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && applyDiscount()}
                        placeholder="Kode promo"
                        className="h-9 text-sm font-mono flex-1"
                      />
                      <Button size="sm" variant="outline" className="h-9 px-3 shrink-0" onClick={applyDiscount} disabled={applyingDiscount || !discountCodeInput}>
                        {applyingDiscount ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <Tag className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 font-mono">{appliedDiscount.code}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">Hemat {formatCurrency(discountAmount)}</p>
                      </div>
                      <button onClick={removeDiscount}><X className="w-3 h-3 text-blue-700 dark:text-blue-300" /></button>
                    </div>
                  )}
                </div>

                {/* Split Pembayaran */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Split Pembayaran</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Bayar dengan hingga 3 kanal berbeda</p>
                  </div>
                  <Switch
                    checked={isSplitPayment}
                    onCheckedChange={(v) => {
                      setIsSplitPayment(v);
                      if (!v) setSplitChannels([
                        { mode: "online", dokuKey: "", manualId: "", search: "", amount: "", includeFee: true },
                        { mode: "manual", dokuKey: "", manualId: "", search: "", amount: "", includeFee: true },
                      ]);
                    }}
                  />
                </div>

                {!isSplitPayment && (<>
                {/* Mode Pembayaran */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mode Pembayaran</p>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => { setPaymentMode("online"); setSelectedPaymentId(""); }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors",
                        paymentMode === "online"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Zap className="w-3 h-3" />
                      DOKU
                    </button>
                    <button
                      onClick={() => { setPaymentMode("manual"); setSelectedDokuCategory(""); setOpenDokuSections(new Set()); setDokuSearch(""); }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors",
                        paymentMode === "manual"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Hand className="w-3 h-3" />
                      Manual
                    </button>
                  </div>
                </div>

                {/* Metode (manual) — grouped by type */}
                {paymentMode === "manual" && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Metode Pembayaran</p>
                    {paymentMethods.length === 0 ? (
                      <div className="p-3 rounded-xl border border-border bg-muted/50 text-center">
                        <p className="text-[11px] text-muted-foreground">Belum ada metode.</p>
                        <p className="text-[10px] text-muted-foreground">Tambahkan di Kanal Pembayaran.</p>
                      </div>
                    ) : (
                      (() => {
                        const typeOrder = ["cash", "bank_transfer", "ewallet", "other"];
                        const typeLabel: Record<string, string> = {
                          cash: "Tunai",
                          bank_transfer: "Transfer Bank",
                          ewallet: "E-Wallet",
                          other: "Lainnya",
                        };
                        const groups = typeOrder
                          .map(t => ({ type: t, label: typeLabel[t], items: paymentMethods.filter(p => p.type === t) }))
                          .filter(g => g.items.length > 0);

                        return (
                          <div className="space-y-3">
                            {groups.map(group => {
                              const GroupIcon = PAYMENT_TYPE_ICON[group.type] ?? CreditCard;
                              return (
                                <div key={group.type}>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <GroupIcon className="w-3 h-3 text-muted-foreground" />
                                    <p className="text-[10px] font-semibold text-muted-foreground">{group.label}</p>
                                  </div>
                                  <div className="space-y-1.5 pl-0">
                                    {group.items.map(pm => {
                                      const pmLogoUrl = getManualPaymentLogoUrl(pm);
                                      return (
                                      <button
                                        key={pm.id}
                                        onClick={() => setSelectedPaymentId(pm.id)}
                                        className={cn(
                                          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                                          selectedPaymentId === pm.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/40 hover:bg-muted/40"
                                        )}
                                      >
                                        {pmLogoUrl && (
                                          <img src={pmLogoUrl} alt={pm.bank_name ?? pm.name} className="w-8 h-8 object-contain rounded shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-foreground truncate">
                                            {pm.bank_name ?? pm.name}
                                          </p>
                                          {pm.account_number && (
                                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                                              {pm.account_number}{pm.account_name ? ` · ${pm.account_name}` : ""}
                                            </p>
                                          )}
                                        </div>
                                        {selectedPaymentId === pm.id && (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                        )}
                                      </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* DOKU Method Selection — accordion per section */}
                {paymentMode === "online" && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pilih Metode Pembayaran DOKU</p>
                    {/* Search bar */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        value={dokuSearch}
                        onChange={e => setDokuSearch(e.target.value)}
                        placeholder="Cari kanal pembayaran..."
                        className="h-8 text-xs pl-8 pr-8"
                      />
                      {dokuSearch && (
                        <button
                          onClick={() => setDokuSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Flat search results */}
                    {dokuSearch.trim().length > 0 ? (
                      (() => {
                        const q = dokuSearch.trim().toLowerCase();
                        const filtered = filteredDokuMethods.filter(m =>
                          m.fullName.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)
                        );
                        return filtered.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">Tidak ada kanal yang cocok.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {filtered.map(m => {
                              const isSelected = selectedDokuCategory === m.key;
                              const isComing = (m as { comingSoon?: boolean }).comingSoon;
                              const { belowMin, aboveMax, min } = getDokuChannelStatus(m.key, grandTotal);
                              const isDisabled = isComing || belowMin || aboveMax;
                              return (
                                <button
                                  key={m.key}
                                  onClick={() => !isDisabled && setSelectedDokuCategory(m.key)}
                                  disabled={isDisabled}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                                    isDisabled
                                      ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                                      : isSelected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/20"
                                  )}
                                >
                                  <BankLogo url={m.logoUrl} initials={m.label} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground leading-tight truncate">{m.fullName}</p>
                                    {isComing ? (
                                      <span className="mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block bg-neutral-500/10 text-neutral-600 border border-neutral-500/20">
                                        Segera Hadir
                                      </span>
                                    ) : belowMin ? (
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block bg-red-500/10 text-red-700 border border-red-500/20">
                                          Min. {formatCurrency(min)}
                                        </span>
                                      </div>
                                    ) : aboveMax ? (
                                      <span className="mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block bg-orange-500/10 text-orange-700 border border-orange-500/20">
                                        Melebihi batas maks
                                      </span>
                                    ) : (
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        <span className={cn(
                                          "text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block border",
                                          m.fee === "Tanpa biaya admin"
                                            ? "bg-green-500/10 text-green-700 border-green-500/20"
                                            : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                        )}>
                                          {m.fee}
                                        </span>
                                        {(m.section === "paylater" || m.section === "va") && (
                                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block border bg-blue-500/10 text-blue-700 border-blue-500/20">
                                            Min. {formatCurrency(min)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {isSelected && !isDisabled && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : null}

                    {/* Normal accordion — hidden when searching */}
                    {!dokuSearch.trim() && DOKU_SECTIONS.map(sec => {
                      const methods = filteredDokuMethods.filter(m => m.section === sec.key);
                      const isOpen = openDokuSections.has(sec.key);
                      const SectionIcon = sec.key === "va" ? Building2 : sec.key === "ewallet" ? Wallet : sec.key === "paylater" ? BadgePercent : CreditCard;
                      const hasSelected = methods.some(m => m.key === selectedDokuCategory);
                      return (
                        <div key={sec.key} className={cn(
                          "border rounded-xl overflow-hidden transition-colors",
                          hasSelected ? "border-primary/50" : "border-border"
                        )}>
                          {/* Section header — toggle */}
                          <button
                            onClick={() => setOpenDokuSections(prev => {
                              const next = new Set(prev);
                              if (next.has(sec.key)) next.delete(sec.key);
                              else next.add(sec.key);
                              return next;
                            })}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                          >
                            <SectionIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-xs font-semibold text-foreground text-left">{sec.label}</span>
                            {hasSelected && (
                              <span className="text-[9px] text-primary font-medium">✓ dipilih</span>
                            )}
                            <span className="text-sm font-bold text-foreground">{methods.length}</span>
                            {isOpen
                              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          </button>
                          {/* Method cards grid */}
                          {isOpen && (
                            <div className="p-2.5 pt-2 grid grid-cols-1 gap-2">
                              {methods.map(m => {
                                const isSelected = selectedDokuCategory === m.key;
                                const isComing = (m as { comingSoon?: boolean }).comingSoon;
                                const { belowMin, aboveMax, min } = getDokuChannelStatus(m.key, grandTotal);
                                const isDisabled = isComing || belowMin || aboveMax;
                                return (
                                  <button
                                    key={m.key}
                                    onClick={() => !isDisabled && setSelectedDokuCategory(m.key)}
                                    disabled={isDisabled}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                                      isDisabled
                                        ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                                        : isSelected
                                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/20"
                                    )}
                                  >
                                    <BankLogo url={m.logoUrl} initials={m.label} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-foreground leading-tight truncate">{m.fullName}</p>
                                      {isComing ? (
                                        <span className="mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block bg-neutral-500/10 text-neutral-600 border border-neutral-500/20">
                                          Segera Hadir
                                        </span>
                                      ) : belowMin ? (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block bg-red-500/10 text-red-700 border border-red-500/20">
                                            Min. {formatCurrency(min)}
                                          </span>
                                        </div>
                                      ) : aboveMax ? (
                                        <span className="mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block bg-orange-500/10 text-orange-700 border border-orange-500/20">
                                          Melebihi batas maks
                                        </span>
                                      ) : (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          <span className={cn(
                                            "text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block border",
                                            m.fee === "Tanpa biaya admin"
                                              ? "bg-green-500/10 text-green-700 border-green-500/20"
                                              : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                          )}>
                                            {m.fee}
                                          </span>
                                          {m.section === "paylater" && (
                                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none inline-block border bg-blue-500/10 text-blue-700 border-blue-500/20">
                                              Min. {formatCurrency(min)}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {isSelected && !isDisabled && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                </>)}

                {/* Split Channels */}
                {isSplitPayment && (
                  <div className="space-y-3">
                    {splitChannels.map((ch, idx) => {
                      const usedDokuKeys = splitChannels.filter((_, i) => i !== idx).map(c => c.dokuKey).filter(Boolean);
                      const usedManualIds = splitChannels.filter((_, i) => i !== idx).map(c => c.manualId).filter(Boolean);
                      const channelMethods = enabledDokuKeys !== null
                        ? DOKU_METHODS.filter(m => enabledDokuKeys.has(m.key))
                        : DOKU_METHODS;
                      const filtered = ch.search.trim()
                        ? channelMethods.filter(m => m.fullName.toLowerCase().includes(ch.search.toLowerCase()) || m.label.toLowerCase().includes(ch.search.toLowerCase()))
                        : channelMethods;
                      return (
                        <div key={idx} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Kanal Pembayaran {idx + 1}
                            </p>
                            <div className="flex items-center gap-2">
                              {idx > 0 && (() => {
                                const rem = splitChannelRemaining[idx];
                                const exceedsRem = splitChannelNominals[idx] > rem;
                                return rem < total ? (
                                  <span className={cn(
                                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                    exceedsRem
                                      ? "text-destructive border-destructive/30 bg-destructive/5"
                                      : rem === 0
                                      ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30"
                                      : "text-primary border-primary/30 bg-primary/5"
                                  )}>
                                    {exceedsRem ? `Melebihi sisa` : rem === 0 ? "Lunas ✓" : `Sisa ${formatCurrency(rem)}`}
                                  </span>
                                ) : null;
                              })()}
                              {idx >= 2 && (
                                <button
                                  onClick={() => setSplitChannels(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex rounded-lg border border-border overflow-hidden">
                            <button
                              onClick={() => updateSplitChannel(idx, { mode: "online", manualId: "" })}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                                ch.mode === "online" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <Zap className="w-3 h-3" /> DOKU
                            </button>
                            <button
                              onClick={() => updateSplitChannel(idx, { mode: "manual", dokuKey: "" })}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                                ch.mode === "manual" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <Hand className="w-3 h-3" /> Manual
                            </button>
                          </div>
                          {ch.mode === "online" && (
                            <div data-split-dropdown className="relative">
                              {/* Trigger */}
                              <button
                                type="button"
                                onClick={() => setOpenSplitDropdown(openSplitDropdown === idx ? null : idx)}
                                className={cn(
                                  "w-full flex items-center gap-2 h-9 px-2.5 rounded-lg border text-left transition-colors",
                                  ch.dokuKey ? "border-primary/40 bg-card hover:border-primary/60" : "border-border bg-muted/20 hover:border-border/80"
                                )}
                              >
                                {ch.dokuKey ? (() => {
                                  const m = DOKU_METHODS.find(d => d.key === ch.dokuKey)!;
                                  return (
                                    <>
                                      <BankLogo url={m.logoUrl} initials={m.label} />
                                      <span className="flex-1 text-xs font-semibold text-foreground truncate">{m.fullName}</span>
                                      <span className="text-[9px] text-muted-foreground shrink-0 pr-1">{m.section === "va" ? "VA" : "PayLater"}</span>
                                    </>
                                  );
                                })() : (
                                  <>
                                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="flex-1 text-xs text-muted-foreground">Pilih kanal DOKU...</span>
                                  </>
                                )}
                                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", openSplitDropdown === idx && "rotate-180")} />
                              </button>

                              {/* Dropdown panel */}
                              {openSplitDropdown === idx && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <input
                                      autoFocus
                                      type="text"
                                      value={ch.search}
                                      onChange={e => updateSplitChannel(idx, { search: e.target.value })}
                                      placeholder="Cari kanal DOKU..."
                                      className="flex-1 text-xs outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
                                    />
                                    {ch.search && (
                                      <button type="button" onClick={() => updateSplitChannel(idx, { search: "" })} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="max-h-52 overflow-y-auto p-1">
                                    {filtered.map(m => {
                                      const isSelected = ch.dokuKey === m.key;
                                      return (
                                        <button
                                          key={m.key}
                                          type="button"
                                          onClick={() => {
                                            updateSplitChannel(idx, { dokuKey: m.key, search: "" });
                                            setOpenSplitDropdown(null);
                                          }}
                                          className={cn(
                                            "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors",
                                            isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-foreground"
                                          )}
                                        >
                                          <BankLogo url={m.logoUrl} initials={m.label} />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold leading-tight truncate">{m.fullName}</p>
                                            <p className={cn("text-[9px]", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                              {m.section === "va" ? "Virtual Account" : "PayLater"}
                                            </p>
                                          </div>
                                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                                        </button>
                                      );
                                    })}
                                    {filtered.length === 0 && (
                                      <p className="text-xs text-muted-foreground text-center py-4">Tidak ada kanal yang cocok.</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {ch.mode === "manual" && (
                            <div className="space-y-1">
                              {paymentMethods.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground text-center py-2">Belum ada metode manual.</p>
                              ) : paymentMethods.map(pm => {
                                const isSelected = ch.manualId === pm.id;
                                const isDuplicate = usedManualIds.includes(pm.id);
                                const splitLogoUrl = getManualPaymentLogoUrl(pm);
                                return (
                                  <button
                                    key={pm.id}
                                    onClick={() => {
                                      if (isDuplicate) return;
                                      // cash: auto-set includeFee = false
                                      updateSplitChannel(idx, { manualId: pm.id, includeFee: pm.type !== "cash" });
                                    }}
                                    disabled={isDuplicate}
                                    className={cn(
                                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-all",
                                      isDuplicate ? "border-border opacity-40 cursor-not-allowed"
                                        : isSelected ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                                    )}
                                  >
                                    {splitLogoUrl && (
                                      <img src={splitLogoUrl} alt={pm.bank_name ?? pm.name} className="w-7 h-7 object-contain rounded shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-foreground truncate">{pm.bank_name ?? pm.name}</p>
                                      {pm.account_number && (
                                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                                          {pm.account_number}{pm.account_name ? ` · ${pm.account_name}` : ""}
                                        </p>
                                      )}
                                    </div>
                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                                    {isDuplicate && <span className="text-[9px] text-muted-foreground shrink-0">Sudah dipilih</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* ── Nominal + fee section (shown after method is chosen) ── */}
                          {(ch.mode === "online" ? !!ch.dokuKey : !!ch.manualId) && (
                            <div className="pt-2.5 border-t border-border/50 space-y-2">
                              {/* Nominal input */}
                              {(() => {
                                const remaining = splitChannelRemaining[idx];
                                const exceedsRemaining = idx > 0 && splitChannelNominals[idx] > remaining;
                                return (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Nominal</p>
                                  {idx > 0 && (
                                    <span className={cn(
                                      "text-[9px] font-semibold",
                                      exceedsRemaining ? "text-destructive" : "text-muted-foreground"
                                    )}>
                                      {exceedsRemaining
                                        ? `Melebihi sisa (${formatCurrency(remaining)})`
                                        : `Sisa: ${formatCurrency(remaining)}`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="relative flex-1">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">Rp</span>
                                    <Input
                                      value={ch.amount}
                                      onChange={e => {
                                        const raw = e.target.value.replace(/\D/g, "");
                                        const formatted = raw ? parseInt(raw, 10).toLocaleString("id-ID") : "";
                                        updateSplitChannel(idx, { amount: formatted });
                                      }}
                                      placeholder="0"
                                      className={cn("h-8 text-xs pl-8 font-mono", exceedsRemaining && "border-destructive focus-visible:ring-destructive")}
                                      inputMode="numeric"
                                    />
                                  </div>
                                  {/* Isi sisa — semua kanal kecuali kanal pertama */}
                                  {idx > 0 && (
                                    <button
                                      onClick={() => {
                                        const rem = Math.max(0, remaining);
                                        updateSplitChannel(idx, { amount: rem > 0 ? rem.toLocaleString("id-ID") : "" });
                                      }}
                                      className="shrink-0 text-[10px] font-semibold text-primary hover:text-primary/80 whitespace-nowrap px-2 py-1.5 rounded-lg border border-primary/30 hover:bg-primary/5 transition-colors"
                                    >
                                      Isi sisa
                                    </button>
                                  )}
                                </div>
                              </div>
                                );
                              })()}

                              {/* Fee toggle — DOKU channels only, cash excluded */}
                              {ch.mode === "online" && !!ch.dokuKey && (() => {
                                const method = DOKU_METHODS.find(m => m.key === ch.dokuKey);
                                if (!method) return null;
                                const chNom = splitChannelNominals[idx];
                                const feeAmt = method.section === "va" ? 4000 : Math.round(chNom * 0.015);
                                const feeLabel = method.section === "va"
                                  ? "Rp 4.000"
                                  : `2% (${feeAmt > 0 ? formatCurrency(feeAmt) : "0"})`;
                                return (
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`fee-ch-${idx}`}
                                      checked={ch.includeFee}
                                      onCheckedChange={v => updateSplitChannel(idx, { includeFee: !!v })}
                                    />
                                    <label htmlFor={`fee-ch-${idx}`} className="text-[10px] text-muted-foreground cursor-pointer leading-snug">
                                      Include fee admin{" "}
                                      <span className="font-semibold text-foreground">{feeLabel}</span>
                                    </label>
                                  </div>
                                );
                              })()}

                              {/* Channel total */}
                              {splitChannelNominals[idx] > 0 && (
                                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5">
                                  <span className="text-[10px] text-muted-foreground">Total kanal {idx + 1}</span>
                                  <span className="text-xs font-bold text-foreground tabular-nums">
                                    {formatCurrency(splitChannelNominals[idx] + splitChannelFees[idx])}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Split summary card */}
                    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Nilai transaksi</span>
                        <span className="font-semibold text-foreground tabular-nums">{formatCurrency(total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Terbagi ke kanal</span>
                        <span className={cn(
                          "font-semibold tabular-nums",
                          splitTotalNominal > total ? "text-destructive" : splitTotalNominal === total ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {formatCurrency(splitTotalNominal)}{splitTotalNominal < total && ` (sisa ${formatCurrency(total - splitTotalNominal)})`}
                          {splitTotalNominal === total && " ✓"}
                          {splitTotalNominal > total && " (melebihi!)"}
                        </span>
                      </div>
                      {splitTotalFees > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Fee admin kanal</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">+{formatCurrency(splitTotalFees)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-border/50 pt-1.5 text-xs">
                        <span className="font-semibold text-foreground">Total tagihan</span>
                        <span className="font-bold tabular-nums text-foreground">{formatCurrency(splitGrandTotal)}</span>
                      </div>
                    </div>

                    {splitChannels.length < 3 && (
                      <button
                        onClick={() => setSplitChannels(prev => [...prev, { mode: "manual", dokuKey: "", manualId: "", search: "", amount: "", includeFee: true }])}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah Kanal Ke-3
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer: price summary + CTA ── */}
          {(transactionType === 'beli' ? cart.length > 0 : transactionType === 'tukar_tambah' ? !!unitMasuk : !!unitMasuk) && (
            <div className="shrink-0 border-t border-border px-4 py-3.5 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                  <span className="font-semibold">Subtotal ({cart.length} item)</span>
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Diskon ({appliedDiscount?.code})</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {needsShipping && selectedShipping && (
                  <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">Ongkir ({selectedShipping.courier})</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatCurrency(shippingCost)}</span>
                  </div>
                )}
                {packingKayuCost > 0 && (
                  <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">Packing Kayu</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatCurrency(packingKayuCost)}</span>
                  </div>
                )}
                {!isSplitPayment && adminFee > 0 && (
                  <div className="flex items-center justify-between text-sm text-amber-600 dark:text-amber-400">
                    <span className="font-medium">
                      {effectiveIsVA && !effectiveIsPayLater ? "Fee Admin (VA)" : effectiveIsPayLater && !effectiveIsVA ? "Fee Admin (PayLater 2%)" : "Fee Admin"}
                    </span>
                    <span className="font-semibold tabular-nums">+{formatCurrency(adminFee)}</span>
                  </div>
                )}
                {isSplitPayment && splitTotalFees > 0 && (
                  <div className="flex items-center justify-between text-sm text-amber-600 dark:text-amber-400">
                    <span className="font-medium">Fee Admin (Split)</span>
                    <span className="font-semibold tabular-nums">+{formatCurrency(splitTotalFees)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-base font-bold text-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <Button
                className="w-full h-11 text-sm font-semibold gap-2"
                disabled={!canProceed() || processingTx}
                onClick={createTransaction}
              >
                {processingTx ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Memproses…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Buat Transaksi</>
                )}
              </Button>

              {!isSplitPayment && (effectiveIsVA || effectiveIsPayLater) && (
                <div className="flex items-center gap-2.5 py-1">
                  <Checkbox
                    id="waive-fee"
                    checked={waiveFeeAdmin}
                    onCheckedChange={(v) => setWaiveFeeAdmin(!!v)}
                  />
                  <label htmlFor="waive-fee" className="text-xs text-muted-foreground cursor-pointer leading-snug">
                    Bebaskan fee admin pembayaran
                    <span className="ml-1 font-semibold text-foreground">
                      ({effectiveIsVA && !effectiveIsPayLater ? "Rp 4.000" : effectiveIsPayLater && !effectiveIsVA ? "2%" : `Rp 4.000 + 2%`})
                    </span>
                  </label>
                </div>
              )}

              {!canProceed() && (
                <p className="text-xs font-medium text-muted-foreground text-center">
                  {cart.length === 0
                    ? "Tambahkan unit ke keranjang"
                    : isSplitPayment && splitChannels.some(ch => ch.mode === "manual" ? !ch.manualId : !ch.dokuKey)
                      ? "Lengkapi semua kanal pembayaran"
                      : isSplitPayment && splitChannels.some(ch => splitChannelNominals[splitChannels.indexOf(ch)] === 0)
                        ? "Isi nominal untuk setiap kanal"
                        : isSplitPayment && splitTotalNominal !== total
                          ? `Nominal split (${formatCurrency(splitTotalNominal)}) harus sama dengan total (${formatCurrency(total)})`
                          : paymentMode === "manual" && !selectedPaymentId
                        ? "Pilih metode pembayaran"
                        : paymentMode === "online" && !selectedDokuCategory
                          ? "Pilih kategori pembayaran DOKU"
                          : needsShipping && !selectedShipping
                            ? "Pilih opsi pengiriman di tab Pelanggan"
                            : needsShipping && !fullAddress.trim()
                              ? "Lengkapi alamat di tab Pelanggan"
                              : customerType === "guest" && !guestName
                                ? "Isi nama pembeli di tab Pelanggan"
                                : "Verifikasi data customer di tab Pelanggan"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ Mobile FAB ═══════════════════════════════════════════════════════ */}
      {isMobile && (
        <button
          onClick={() => setMobileProductsOpen(true)}
          className="fixed right-6 top-[65%] -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Pilih Produk"
        >
          <Plus className="w-5 h-5" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      )}

      {/* ══ Mobile Product Picker Overlay ════════════════════════════════════ */}
      {isMobile && mobileProductsOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMobileProductsOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div>
                <p className="text-sm font-semibold text-foreground">Pilih Produk</p>
                <p className="text-[11px] text-muted-foreground">{units.length} unit tersedia</p>
              </div>
              <button onClick={() => setMobileProductsOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="px-3 pt-3 space-y-2 shrink-0">
              <div className="relative">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari IMEI, seri, warna…" className="pl-9 h-9 text-sm" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <POSCategoryCards
                allCategories={allCategories}
                filterCategory={filterCategory}
                setFilterCategory={handleSetFilterCategory}
                categoryUnitCounts={categoryUnitCounts}
                loading={loadingUnits}
              />
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                <FilterDropdown value={filterSeries} onChange={setFilterSeries} options={seriesOptions} icon={Smartphone} />
                <FilterDropdown value={filterWarranty} onChange={(v: WarrantyFilter) => setFilterWarranty(v)} options={warrantyOptions} icon={Filter} disabled={isTipeDisabled} disabledLabel="Resmi" />
                <FilterDropdown value={filterCondition} onChange={(v: ConditionFilter) => setFilterCondition(v)} options={conditionOptions} icon={AlertCircle} />
                <button onClick={() => fetchUnits()} className="h-8 w-8 rounded-lg border border-border bg-card text-foreground flex items-center justify-center shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
              {loadingUnits ? (
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
                </div>
              ) : units.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Smartphone className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Tidak ada unit tersedia</p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 gap-2">
                    {units.map(unit => (
                      <ProductCard key={unit.id} unit={unit} onAdd={addToCart} inCart={cartUnitIds.has(unit.id)} compact thumbnailUrl={seriesThumbnails[getMasterProduct(unit)?.series ?? ""] ?? null} bonusItems={categoryBonusMap[getMasterProduct(unit)?.category ?? ""] ?? []} disableClick={productCardDisabled} />
                    ))}
                    {accessories?.map(acc => (
                      <AccessoryCard key={acc.id} acc={acc} onAdd={addAccessoryToCart} inCart={!!cart.find(c => c.kind === 'accessory' && c.accessory!.id === acc.id)} compact thumbnailUrl={seriesThumbnails[acc.name] ?? null} disableClick={productCardDisabled} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 pb-6 pt-2 border-t border-border shrink-0">
              <Button className="w-full gap-2" onClick={() => setMobileProductsOpen(false)}>
                <CheckCircle2 className="w-4 h-4" />
                Selesai Pilih ({cart.length} item)
              </Button>
            </div>
          </div>
        </>
      )}
      {/* ── Overlay: menunggu nomor VA dari DOKU ── */}
      {waitingForVa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 p-8 rounded-2xl bg-card border border-border shadow-2xl max-w-xs w-full mx-4 text-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-bold text-foreground">Menunggu Nomor VA…</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Halaman DOKU sudah terbuka di tab lain (di belakang).<br />
                <strong className="text-foreground">Jangan berpindah tab.</strong> Nomor VA akan muncul otomatis di sini.
              </p>
              {waitingTxCode && (
                <p className="text-xs font-mono text-muted-foreground/70">{waitingTxCode}</p>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${Math.min((vaWaitSeconds / VA_WAIT_TIMEOUT) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {vaWaitSeconds < VA_WAIT_TIMEOUT
                ? `Polling ${vaWaitSeconds}s / ${VA_WAIT_TIMEOUT}s…`
                : "Batas waktu — mengalihkan ke detail…"}
            </p>
            <button
              type="button"
              onClick={() => {
                setWaitingForVa(false);
                if (waitingTxId) navigate(`/admin/transaksi/${waitingTxId}`);
              }}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Lanjut ke detail sekarang
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
