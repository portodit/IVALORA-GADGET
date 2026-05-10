import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Filter, ChevronRight, RefreshCw,
  ShoppingCart, Globe, ShoppingBag, Store, Package,
  CheckCircle2, Clock, XCircle, AlertCircle, Trash2,
  CreditCard, Zap, User, Download, ChevronLeft,
  LayoutGrid, List, CalendarDays, Info, X,
  Check, ChevronDown, Plus,
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableDropdown } from "@/components/shared/SearchableDropdown";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { AdminDataTable } from "@/components/shared/AdminDataTable";
import { useToast } from "@/hooks/shared/use-toast";
import { formatCurrency } from "@/lib/admin/produk/stock-units";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/admin/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TambahEcommerceTransaksiModal } from "@/components/admin/transaksi/TambahEcommerceTransaksiModal";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Branch { id: string; name: string; code: string }

interface TxItem {
  id: string;
  stock_units: { master_products: { series: string; storage_gb: number | null } | null } | null;
}

interface Transaction {
  id: string;
  transaction_code: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  discount_code: string | null;
  created_at: string;
  confirmed_at: string | null;
  notes: string | null;
  branch_id: string;
  created_by: string | null;
  branches: { name: string; code: string } | null;
  transaction_items: TxItem[];
}

interface HandlerOption { id: string; name: string; role: string }

const INVOICE_DURATION_SECONDS = 10800; // 3 hours
const INVOICE_DURATION_MS = INVOICE_DURATION_SECONDS * 1000;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

// ── Channel config ─────────────────────────────────────────────────────────────
type ChannelFilter = "all" | "pos" | "website" | "shopee" | "tokopedia";

const CHANNEL_CONFIG: Record<ChannelFilter, {
  label: string; icon: React.ElementType; color: string;
  badgeCls: string; activeCls: string; cardCls: string;
}> = {
  all:       { label: "Semua",          icon: Package,      color: "text-foreground",                        badgeCls: "bg-muted text-foreground border-border",                              activeCls: "bg-foreground text-background border-foreground",      cardCls: "border-border" },
  pos:       { label: "Point of Sales", icon: Store,        color: "text-blue-600 dark:text-blue-400",       badgeCls: "bg-blue-500/10 text-blue-700 border-blue-500/20",                     activeCls: "bg-blue-600 text-white border-blue-600",                cardCls: "border-blue-500/30" },
  website:   { label: "Website",        icon: Globe,        color: "text-violet-600 dark:text-violet-400",   badgeCls: "bg-violet-500/10 text-violet-700 border-violet-500/20",               activeCls: "bg-violet-600 text-white border-violet-600",            cardCls: "border-violet-500/30" },
  shopee:    { label: "Shopee",         icon: ShoppingBag,  color: "text-orange-600 dark:text-orange-400",  badgeCls: "bg-orange-500/10 text-orange-700 border-orange-500/20",               activeCls: "bg-orange-500 text-white border-orange-500",            cardCls: "border-orange-500/30" },
  tokopedia: { label: "Tokopedia",      icon: ShoppingCart, color: "text-green-600 dark:text-green-400",    badgeCls: "bg-green-500/10 text-green-700 border-green-500/20",                  activeCls: "bg-green-600 text-white border-green-600",              cardCls: "border-green-500/30" },
};

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; icon: React.ElementType; color: string; dot: string; bg: string; info: string;
}> = {
  pending:   { label: "Menunggu Pembayaran", icon: Clock,         color: "text-amber-700 dark:text-amber-300",       dot: "bg-amber-500",           bg: "bg-amber-500/10 border-amber-500/20",      info: "Transaksi sudah dibuat, pembeli belum melakukan pembayaran. Invoice akan kedaluwarsa dalam 3 jam sejak transaksi dibuat." },
  paid:      { label: "Lunas",               icon: CheckCircle2,  color: "text-emerald-700 dark:text-emerald-300",   dot: "bg-emerald-500",         bg: "bg-emerald-500/10 border-emerald-500/20",  info: "Pembayaran sudah diterima. Menunggu konfirmasi selesai oleh admin." },
  expired:   { label: "Kedaluwarsa",         icon: XCircle,       color: "text-red-600 dark:text-red-400",           dot: "bg-red-500",             bg: "bg-red-500/10 border-red-500/20",          info: "Batas waktu pembayaran telah habis (3 jam). Transaksi dibatalkan otomatis dan stok dikembalikan ke tersedia." },
  completed: { label: "Selesai",             icon: CheckCircle2,  color: "text-emerald-700 dark:text-emerald-300",   dot: "bg-emerald-500",         bg: "bg-emerald-500/10 border-emerald-500/20",  info: "Pembayaran telah dikonfirmasi dan transaksi berhasil diselesaikan." },
  cancelled: { label: "Dibatalkan",          icon: XCircle,       color: "text-red-600 dark:text-red-400",           dot: "bg-red-500",             bg: "bg-red-500/10 border-red-500/20",          info: "Transaksi dibatalkan secara manual oleh admin atau sistem. Stok unit dikembalikan ke tersedia." },
  failed:    { label: "Gagal",               icon: XCircle,       color: "text-red-600 dark:text-red-400",           dot: "bg-red-500",             bg: "bg-red-500/10 border-red-500/20",          info: "Terjadi kegagalan saat proses pembayaran. Biasanya karena masalah gateway atau koneksi." },
  refunded:  { label: "Refund",              icon: RefreshCw,     color: "text-muted-foreground",                    dot: "bg-muted-foreground",    bg: "bg-muted/40 border-muted",                 info: "Dana sudah dikembalikan ke pembeli setelah transaksi sebelumnya berhasil." },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin_branch: "Admin Cabang", employee: "Pegawai", web_admin: "Web Admin",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function getDisplayStatus(tx: { status: string; created_at: string }): string {
  if (tx.status === "pending" && Date.now() > new Date(tx.created_at).getTime() + INVOICE_DURATION_MS) return "expired";
  return tx.status;
}

function getChannelFromTransaction(tx: Transaction): ChannelFilter {
  const pmName = (tx.payment_method_name ?? "").toLowerCase();
  if (pmName.includes("shopee")) return "shopee";
  if (pmName.includes("tokopedia")) return "tokopedia";
  if (pmName.includes("xendit") || pmName.includes("online") || pmName.includes("website")) return "website";
  return "pos";
}

function getPaymentLabel(tx: Transaction): string {
  const pmName = tx.payment_method_name ?? "";
  if (!pmName) return "—";
  if (pmName.startsWith("Split:")) return pmName; // handled by SplitPaymentDisplay
  if (pmName.toLowerCase().includes("xendit")) return pmName.replace(/^xendit\s*[-–—]\s*/i, "").trim() || "Online";
  if (pmName.toLowerCase().includes("doku"))   return pmName.replace(/^doku\s*[-–—]\s*/i, "").trim() || "DOKU";
  return pmName;
}

// Short display name for a payment channel
const DOKU_SHORT_NAME: Record<string, string> = {
  "Bank Central Asia (BCA)": "Transfer BCA",
  "Bank Negara Indonesia (BNI)": "Transfer BNI",
  "Bank Rakyat Indonesia (BRI)": "Transfer BRI",
  "Bank Mandiri": "Transfer Mandiri",
  "Bank Syariah Indonesia (BSI)": "Transfer BSI",
  "Bank Permata": "Transfer Permata",
  "CIMB Niaga": "Transfer CIMB",
  "Bank Danamon": "Transfer Danamon",
  "Bank Tabungan Negara (BTN)": "Transfer BTN",
  "Maybank": "Transfer Maybank",
  "Bank Neo Commerce (BNC)": "Transfer BNC",
  "Bank Sinarmas": "Transfer Sinarmas",
  "DOKU (Antar Bank)": "Transfer DOKU",
  "Kredivo": "Kredivo",
  "BRI Ceria": "BRI Ceria",
  "Akulaku": "Akulaku",
  "Indodana": "Indodana",
};

function shortChannelName(name: string): string {
  if (!name) return "—";
  const clean = name.replace(/^doku\s*[-–—]\s*/i, "").trim();
  if (DOKU_SHORT_NAME[clean]) return DOKU_SHORT_NAME[clean];
  // Fallback: extract acronym from parens "(XXX)" → "Transfer XXX"
  const acronym = clean.match(/\(([A-Z]{2,})\)\s*$/);
  if (acronym) return `Transfer ${acronym[1]}`;
  // Strip "Bank " prefix for VA banks without acronym
  if (/bank|niaga|maybank/i.test(clean)) return `Transfer ${clean.replace(/^Bank\s+/i, "").trim()}`;
  return clean;
}

// Parse individual channels from "Split: CH1 RpX | CH2 RpY" format
function parseSplitChannels(pmName: string): Array<{ name: string; nominal: number | null }> {
  const raw = pmName.replace(/^Split:\s*/i, "");
  return raw.split(/\s*\|\s*/).filter(Boolean).map(part => {
    const nominalMatch = part.match(/Rp([\d.,]+)/);
    const nomStr = nominalMatch ? nominalMatch[1].replace(/\./g, "").replace(",", "") : null;
    const nominal = nomStr ? parseInt(nomStr, 10) : null;
    const rawName = part.replace(/\s*Rp[\d.,]+.*/, "").replace(/\s*\+fee.*/, "").trim();
    // Strip "DOKU -", "DOKU-", "DOKU – " etc from the front
    const cleanName = rawName.replace(/^doku\s*[-–—]\s*/i, "").trim();
    return { name: cleanName || rawName, nominal };
  });
}

// Map payment method name → local logo asset path
function getPaymentLogoUrl(pmName: string): string | null {
  const n = pmName.toLowerCase();
  // Virtual Account
  if (n.includes("bca"))     return "/kanal/va/bca.png";
  if (n.includes("bni"))     return "/kanal/va/bni.png";
  if (n.includes("bri"))     return "/kanal/va/bri.png";
  if (n.includes("mandiri")) return "/kanal/va/mandiri.png";
  if (n.includes("bsi") || n.includes("syariah")) return "/kanal/va/bsi.png";
  if (n.includes("permata")) return "/kanal/va/permata.png";
  if (n.includes("cimb"))    return "/kanal/va/cimb.png";
  if (n.includes("danamon")) return "/kanal/va/danamon.png";
  if (n.includes("btn"))     return "/kanal/va/btn.png";
  if (n.includes("maybank")) return "/kanal/va/maybank.png";
  if (n.includes("bnc"))     return "/kanal/va/bnc.png";
  if (n.includes("sinarmas")) return "/kanal/va/sinarmas.png";
  // E-Wallet
  if (n.includes("ovo"))      return "/kanal/ewallet/ovo.png";
  if (n.includes("dana"))     return "/kanal/ewallet/dana.png";
  if (n.includes("shopee"))   return "/kanal/ewallet/shopeepay.png";
  if (n.includes("linkaja"))  return "/kanal/ewallet/linkaja.png";
  // PayLater
  if (n.includes("kredivo"))  return "/kanal/paylater/kredivo.png";
  if (n.includes("akulaku"))  return "/kanal/paylater/akulaku.png";
  if (n.includes("indodana")) return "/kanal/paylater/indodana.png";
  if (n.includes("bri ceria") || n.includes("briceria")) return "/kanal/paylater/briceria.png";
  // Other
  if (n.includes("alfamart")) return "/kanal/other/alfamart.png";
  if (n.includes("indomaret")) return "/kanal/other/indomaret.png";
  if (n.includes("doku"))    return "/kanal/va/doku.png";
  return null;
}

// Single-channel payment logo + name
function PaymentLogo({ pmName }: { pmName: string }) {
  const [failed, setFailed] = useState(false);

  // Split payment — render per-channel rows
  if (pmName.startsWith("Split:")) {
    const channels = parseSplitChannels(pmName);
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {channels.map((ch, idx) => (
          <SplitChannelBadge key={idx} idx={idx} name={ch.name} nominal={ch.nominal} />
        ))}
      </div>
    );
  }

  const url = getPaymentLogoUrl(pmName);
  const label = getPaymentLabel({ payment_method_name: pmName } as Transaction);
  if (!url || failed) {
    return (
      <span className="inline-flex items-center gap-1.5 shrink-0">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-muted border border-border/40 shrink-0">
          <CreditCard className="w-5 h-5 text-foreground/60" />
        </span>
        <span className="text-xs font-bold text-foreground leading-tight">{label || pmName || "—"}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-white border border-border/40 shrink-0">
        <img src={url} alt={label} onError={() => setFailed(true)} className="w-8 h-8 object-contain" />
      </span>
      <span className="text-xs font-bold text-foreground leading-tight">{label}</span>
    </span>
  );
}

// One row for a split channel: "K1" badge + logo + name + amount
function SplitChannelBadge({ idx, name, nominal }: { idx: number; name: string; nominal: number | null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = getPaymentLogoUrl(name);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0 leading-none">
        K{idx + 1}
      </span>
      {url && !imgFailed ? (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-sm bg-white border border-border/40 shrink-0">
          <img src={url} alt={name} onError={() => setImgFailed(true)} className="w-5 h-5 object-contain" />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-sm bg-muted border border-border/40 shrink-0">
          <CreditCard className="w-3.5 h-3.5 text-foreground/60" />
        </span>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-bold text-foreground leading-tight whitespace-nowrap">{shortChannelName(name)}</span>
        {nominal !== null && nominal > 0 && (
          <span className="text-[9px] font-semibold text-foreground/70 tabular-nums leading-none mt-0.5">{formatJuta(nominal)}</span>
        )}
      </div>
    </div>
  );
}

function formatDatetime(iso: string) {
  return format(new Date(iso), "d MMMM yyyy HH.mm 'WIB'", { locale: localeId });
}

// ── Sub-components ─────────────────────────────────────────────────────────────
// ChannelBadge — tag style: left-border accent + bg tint, no outline box
function ChannelBadge({ channel }: { channel: ChannelFilter }) {
  const cfg = CHANNEL_CONFIG[channel];
  const Icon = cfg.icon;
  // left-border color per channel
  const borderColor: Record<ChannelFilter, string> = {
    all:       "border-l-foreground/40",
    pos:       "border-l-blue-500",
    website:   "border-l-violet-500",
    shopee:    "border-l-orange-500",
    tokopedia: "border-l-green-500",
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-semibold pl-1.5 pr-2 py-0.5 rounded-sm border-l-2 whitespace-nowrap shrink-0",
      borderColor[channel],
      cfg.badgeCls.replace(/border[^ ]*/g, ""),   // strip outline border class
    )}>
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {cfg.label}
    </span>
  );
}

// StatusBadge — dot indicator style: colored dot + text, no border box
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold cursor-help shrink-0", cfg.color)}>
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
          {cfg.label}
          <Info className="w-2.5 h-2.5 shrink-0 opacity-50" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {cfg.info}
      </TooltipContent>
    </Tooltip>
  );
}

function TransactionCountdown({ createdAt }: { createdAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const deadline = new Date(createdAt).getTime() + INVOICE_DURATION_SECONDS * 1000;
  const diff = deadline - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 border border-amber-500/20 animate-pulse shrink-0 w-fit">
      <Clock className="w-2.5 h-2.5" />
      Bayar dalam {`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
    </span>
  );
}

// ── Date Range Picker ─────────────────────────────────────────────────────────
function DateRangePicker({ value, onChange }: { value: DateRange | undefined; onChange: (r: DateRange | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const hasFrom = !!value?.from;
  const label = hasFrom
    ? value!.to
      ? `${format(value!.from!, "d MMM")} – ${format(value!.to, "d MMM yy", { locale: localeId })}`
      : format(value!.from!, "d MMM yyyy", { locale: localeId })
    : "Periode";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"
          className={cn("h-9 gap-1.5 text-sm font-normal pr-2", hasFrom ? "border-primary/60 text-foreground" : "text-muted-foreground")}>
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
          {hasFrom && (
            <span onClick={e => { e.stopPropagation(); onChange(undefined); }}
              className="ml-0.5 rounded p-0.5 hover:bg-muted transition-colors">
              <X className="w-3 h-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0" align="start" sideOffset={4}>
        <Calendar mode="range" selected={value} onSelect={onChange} locale={localeId} initialFocus numberOfMonths={1} />
        <div className="flex gap-2 px-3 pb-3 border-t border-border pt-2">
          <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => setOpen(false)} disabled={!hasFrom}>Terapkan</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { onChange(undefined); setOpen(false); }}>Reset</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── SKU Multi-Select ───────────────────────────────────────────────────────────
function SkuMultiSelect({ options, value, onChange }: {
  options: string[];
  value: Set<string>;
  onChange: (v: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()));
  const label = value.size === 0 ? "Semua Produk" : value.size === 1 ? Array.from(value)[0] : `${value.size} Produk`;
  const toggle = (s: string) => {
    const next = new Set(value);
    next.has(s) ? next.delete(s) : next.add(s);
    onChange(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 gap-2 text-sm font-normal justify-between min-w-[150px]", value.size > 0 && "text-foreground border-primary/50")}>
          <span className="truncate flex-1 text-left">{label}</span>
          <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari produk..." className="h-8 text-xs" autoFocus />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Tidak ada hasil</p>
          ) : (
            filtered.map(s => (
              <button key={s} onClick={() => toggle(s)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-left transition-colors">
                <div className={cn("w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                  value.has(s) ? "bg-primary border-primary" : "border-border"
                )}>
                  {value.has(s) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <span className="text-xs text-foreground truncate">{s}</span>
              </button>
            ))
          )}
        </div>
        {value.size > 0 && (
          <div className="p-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground" onClick={() => onChange(new Set())}>
              Reset pilihan
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Format compact (juta) ─────────────────────────────────────────────────────
function formatJuta(amount: number): string {
  if (amount === 0) return "Rp 0";
  if (amount < 1_000_000) return formatCurrency(amount);
  const juta = amount / 1_000_000;
  const rounded = Math.round(juta * 10) / 10;
  return `${rounded.toLocaleString("id-ID")} juta`;
}

// ── Item chips helper (max 2 labels, rest → lainnya) ──────────────────────────
function getItemChips(items: TxItem[]): { shown: string[]; rest: number } {
  if (!items || items.length === 0) return { shown: [], rest: 0 };
  const names = items
    .map(i => {
      const mp = i.stock_units?.master_products;
      if (!mp) return null;
      const storage = mp.storage_gb ? (mp.storage_gb >= 1024 ? `${mp.storage_gb / 1024}TB` : `${mp.storage_gb}GB`) : null;
      return storage ? `${mp.series} ${storage}` : mp.series;
    })
    .filter(Boolean) as string[];
  if (names.length === 0) return { shown: [`${items.length} item`], rest: 0 };
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  return { shown, rest };
}

// ── Item summary helper (kept for table view) ─────────────────────────────────
function getItemSummary(items: TxItem[]): string {
  const { shown, rest } = getItemChips(items);
  if (shown.length === 0) return "—";
  if (rest === 0) return shown.join(" & ");
  return `${shown.join(", ")} +${rest} lainnya`;
}

// ── Transaction Card (4-column layout) ────────────────────────────────────────
function TxCard({ tx, handlerNames, handlerRoles, bulkDeleteMode, selected, onToggle, onDelete, onClick }: {
  tx: Transaction;
  handlerNames: Record<string, string>;
  handlerRoles: Record<string, string>;
  bulkDeleteMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const channel = getChannelFromTransaction(tx);
  const displayStatus = getDisplayStatus(tx);
  const isDeletable = tx.status !== "completed";
  const handlerName = tx.created_by ? (handlerNames[tx.created_by] ?? null) : null;
  const handlerRole = tx.created_by ? (handlerRoles[tx.created_by] ?? null) : null;
  const paymentLabel = getPaymentLabel(tx);
  const isSplitTx = !!tx.payment_method_name?.startsWith("Split:");
  const itemCount = tx.transaction_items?.length ?? 0;
  const itemSummary = getItemSummary(tx.transaction_items ?? []);

  return (
    <div className="relative group flex items-stretch gap-2">
      {bulkDeleteMode && (
        <div className="flex items-center pl-1 shrink-0">
          <Checkbox checked={selected} disabled={!isDeletable} onCheckedChange={onToggle} />
        </div>
      )}
      <button
        onClick={() => !bulkDeleteMode && onClick()}
        className="flex-1 w-full text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all"
      >
        {/* ── 4-column grid, dividers dipendekin ── */}
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-stretch">

          {/* COL 1 — TRX code + badges */}
          <div className="flex flex-col justify-center gap-1.5 px-4 py-3 min-w-0">
            <p className="text-[13px] font-bold text-foreground leading-tight tracking-tight truncate">
              {tx.transaction_code ?? tx.id.slice(0, 8).toUpperCase()}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <ChannelBadge channel={channel} />
              <StatusBadge status={displayStatus} />
            </div>
            {displayStatus === "pending" && <TransactionCountdown createdAt={tx.created_at} />}
          </div>

          {/* COL 2 — Tanggal + Sales — divider dipendekin */}
          <div className="flex flex-col justify-center gap-1 px-3 py-3 min-w-0 relative">
            <div className="absolute left-0 top-3 bottom-3 w-px bg-border" aria-hidden />
            <p className="text-[11px] font-bold text-foreground leading-tight truncate">
              {format(new Date(tx.created_at), "d MMM, HH.mm", { locale: localeId })} WIB
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-foreground truncate">
              <User className="w-2.5 h-2.5 shrink-0" />
              {handlerName
                ? <>{handlerName}{handlerRole && <span className="font-semibold text-foreground/60"> · {handlerRole}</span>}</>
                : <span className="font-normal text-foreground/50">—</span>}
            </span>
          </div>

          {/* COL 3 — Customer + Branch + Items — divider dipendekin */}
          <div className="flex flex-col justify-center gap-1 px-3 py-3 min-w-0 relative">
            <div className="absolute left-0 top-3 bottom-3 w-px bg-border" aria-hidden />
            <p className="text-[11px] font-bold text-foreground truncate">
              <span className="text-foreground/50 font-semibold">Customer: </span>
              {tx.customer_name ?? tx.customer_phone ?? <em className="font-normal text-foreground/40">Tanpa nama</em>}
            </p>
            {tx.branches && (
              <p className="text-[10px] font-bold text-foreground truncate">
                <span className="text-foreground/50 font-semibold">Cabang: </span>{tx.branches.name}
              </p>
            )}
            {/* Item chips — max 2, rest → lainnya */}
            {(() => {
              const { shown, rest } = getItemChips(tx.transaction_items ?? []);
              return (
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  <span className="text-[9px] font-bold text-foreground/70 shrink-0">{itemCount} item:</span>
                  {shown.map((name, i) => (
                    <span key={i} className="text-[9px] font-semibold text-foreground bg-muted border border-border px-1.5 py-0.5 rounded-md shrink-0 max-w-[100px] truncate">{name}</span>
                  ))}
                  {rest > 0 && (
                    <span className="text-[9px] font-semibold text-foreground/60 bg-muted border border-border px-1.5 py-0.5 rounded-md shrink-0">+{rest} lainnya</span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* COL 4 — Total + Payment — divider dipendekin */}
          <div className={cn(
            "flex flex-col justify-center gap-1.5 px-3 py-3 min-w-0 pr-8 relative",
            isSplitTx ? "items-start" : "items-end text-right"
          )}>
            <div className="absolute left-0 top-3 bottom-3 w-px bg-border" aria-hidden />
            <p className="text-[15px] font-bold text-foreground tabular-nums leading-tight">
              {formatCurrency(tx.total)}
            </p>
            <PaymentLogo pmName={tx.payment_method_name ?? ""} />
          </div>

        </div>
      </button>

      {/* Delete button — always visible, bottom-right */}
      {!bulkDeleteMode && isDeletable && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Hapus transaksi"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function TxTableRow({ tx, handlerNames, selected, onToggle, onDelete, onClick }: {
  tx: Transaction;
  handlerNames: Record<string, string>;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const channel = getChannelFromTransaction(tx);
  const displayStatus = getDisplayStatus(tx);
  const isDeletable = tx.status !== "completed";
  const handlerName = tx.created_by ? (handlerNames[tx.created_by] ?? "—") : "—";
  const itemSummary = getItemSummary(tx.transaction_items ?? []);
  const itemCount = tx.transaction_items?.length ?? 0;
  return (
    <TableRow
      onClick={onClick}
      className="cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <TableCell className="w-10 px-2" onClick={e => e.stopPropagation()}>
        <Checkbox checked={selected} disabled={!isDeletable} onCheckedChange={onToggle} />
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <p className="text-xs font-bold text-foreground">{tx.transaction_code ?? tx.id.slice(0, 8).toUpperCase()}</p>
        <p className="text-[10px] font-semibold text-foreground/70">{tx.customer_name ?? tx.customer_phone ?? "—"}</p>
        <div className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-muted border border-border max-w-[180px] overflow-hidden">
          <span className="text-[9px] font-bold text-foreground/70 shrink-0">{itemCount}×</span>
          <span className="text-[9px] text-foreground/60 truncate">{itemSummary}</span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-2.5"><ChannelBadge channel={channel} /></TableCell>
      <TableCell className="px-3 py-2.5"><StatusBadge status={displayStatus} /></TableCell>
      <TableCell className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-xs font-bold text-foreground">{format(new Date(tx.created_at), "d MMM, HH.mm", { locale: localeId })} WIB</span>
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <span className="text-xs font-semibold text-foreground/80">{handlerName}</span>
      </TableCell>
      <TableCell className="px-3 py-2.5 text-right">
        <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(tx.total)}</p>
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <PaymentLogo pmName={tx.payment_method_name ?? ""} />
      </TableCell>
      <TableCell className="px-2 py-2.5 w-8" onClick={e => e.stopPropagation()}>
        {isDeletable && (
          <button onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function RiwayatTransaksiPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, activeBranch } = useAuth();
  const isSuperAdmin = role === "super_admin";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [handlerNames, setHandlerNames] = useState<Record<string, string>>({});
  const [handlerRoles, setHandlerRoles] = useState<Record<string, string>>({});
  const [handlerOptions, setHandlerOptions] = useState<HandlerOption[]>([]);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Filters
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [handlerFilter, setHandlerFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [skuFilter, setSkuFilter] = useState<Set<string>>(new Set());

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Tambah Transaksi Ecommerce modal
  const [showTambahEcommerce, setShowTambahEcommerce] = useState(false);

  // Fetch branches (super_admin only)
  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from("branches" as never).select("id, name, code").then(({ data }) => {
      if (data) setBranches(data as Branch[]);
    });
  }, [isSuperAdmin]);

  // Fetch handler options (users relevant to active branch or all)
  useEffect(() => {
    const branchId = isSuperAdmin ? (branchFilter !== "all" ? branchFilter : null) : (activeBranch as Branch | null)?.id ?? null;
    let q = (supabase as any).from("user_profiles").select("id, full_name, email");
    // If we have a branch filter, join through user_branches
    // For simplicity fetch all & filter by role
    q.then(({ data }: { data: Array<{ id: string; full_name: string | null; email: string }> | null }) => {
      if (!data) return;
      const opts: HandlerOption[] = data.map(p => ({
        id: p.id,
        name: p.full_name || p.email,
        role: "",
      }));
      setHandlerOptions(opts);
    });
  }, [isSuperAdmin, branchFilter, activeBranch]);

  // Fetch transactions
  const fetchTransactions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      let query = (supabase as any)
        .from("transactions")
        .select("id, transaction_code, status, subtotal, discount_amount, total, customer_name, customer_email, customer_phone, payment_method_id, payment_method_name, discount_code, created_at, confirmed_at, notes, branch_id, created_by, branches(name, code), transaction_items(id, stock_units(master_products(series, storage_gb)))")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (branchFilter !== "all") query = query.eq("branch_id", branchFilter);
      else if (!isSuperAdmin && (activeBranch as Branch | null)?.id) query = query.eq("branch_id", (activeBranch as Branch).id);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (handlerFilter !== "all") query = query.eq("created_by", handlerFilter);
      if (dateRange?.from) query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      if (dateRange?.to)   query = query.lte("created_at", endOfDay(dateRange.to).toISOString());

      const { data, error } = await query;
      if (error) throw error;
      const txs = (data as Transaction[]) ?? [];
      setTransactions(txs);

      // Fetch handler names + roles
      const userIds = Array.from(new Set(txs.map((t: Transaction) => t.created_by).filter(Boolean))) as string[];
      if (userIds.length > 0) {
        const [{ data: profiles }, { data: roles }] = await Promise.all([
          supabase.from("user_profiles" as never).select("id, full_name, email").in("id", userIds as never),
          supabase.from("user_roles" as never).select("user_id, role").in("user_id", userIds as never),
        ]);
        const nameMap: Record<string, string> = {};
        for (const p of (profiles as Array<{ id: string; full_name: string | null; email: string }>) ?? []) {
          nameMap[p.id] = p.full_name || p.email;
        }
        setHandlerNames(nameMap);
        const roleMap: Record<string, string> = {};
        for (const r of (roles as Array<{ user_id: string; role: string }>) ?? []) {
          roleMap[r.user_id] = ROLE_LABELS[r.role] || r.role;
        }
        setHandlerRoles(roleMap);
        // Enrich handler options with names from this set
        setHandlerOptions(prev => prev.map(o => ({
          ...o,
          name: nameMap[o.id] ?? o.name,
          role: roleMap[o.id] ?? o.role,
        })));
      }
    } catch {
      toast({ title: "Gagal memuat transaksi", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branchFilter, statusFilter, handlerFilter, dateRange, toast, isSuperAdmin, activeBranch]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Auto-sweep: cancel expired pending transactions + release reserved stock
  // Runs once on mount (and whenever branch scope changes) — catches all cases
  // regardless of whether detail page was ever opened
  useEffect(() => {
    const sweep = async () => {
      const cutoff = new Date(Date.now() - INVOICE_DURATION_MS).toISOString();
      let q = (supabase as any)
        .from("transactions")
        .select("id")
        .eq("status", "pending")
        .lt("created_at", cutoff);
      if (!isSuperAdmin && (activeBranch as { id: string } | null)?.id) {
        q = q.eq("branch_id", (activeBranch as { id: string }).id);
      }
      const { data: expired } = await q;
      if (!expired || (expired as { id: string }[]).length === 0) return;

      const ids = (expired as { id: string }[]).map(t => t.id);
      await Promise.all([
        supabase.from("transactions" as never)
          .update({ status: "cancelled", cancellation_reason: "Batas waktu pembayaran habis. Transaksi dibatalkan otomatis oleh sistem." } as never)
          .in("id", ids as never)
          .eq("status", "pending" as never),
        supabase.from("stock_units" as never)
          .update({ stock_status: "available", sold_reference_id: null } as never)
          .in("sold_reference_id", ids as never)
          .eq("stock_status", "reserved" as never),
      ]);
      // Refresh list to reflect updated statuses
      fetchTransactions(true);
    };
    sweep();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, (activeBranch as { id: string } | null)?.id]);

  // Delete single
  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const { data: txItems } = await supabase.from("transaction_items" as never).select("imei").eq("transaction_id", deleteTargetId as never);
      if (txItems && (txItems as { imei: string }[]).length > 0) {
        const imeis = (txItems as { imei: string }[]).map(i => i.imei);
        await supabase.from("stock_units" as never).update({ stock_status: "available", sold_reference_id: null } as never).in("imei", imeis as never).eq("stock_status", "reserved" as never);
      }
      await supabase.from("transaction_items" as never).delete().eq("transaction_id", deleteTargetId as never);
      const { error } = await supabase.from("transactions" as never).delete().eq("id", deleteTargetId as never);
      if (error) throw error;
      toast({ title: "Transaksi dihapus" });
      setDeleteTargetId(null);
      fetchTransactions(true);
    } catch {
      toast({ title: "Gagal menghapus transaksi", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        const { data: txItems } = await supabase.from("transaction_items" as never).select("imei").eq("transaction_id", id as never);
        if (txItems && (txItems as { imei: string }[]).length > 0) {
          const imeis = (txItems as { imei: string }[]).map((i: { imei: string }) => i.imei);
          await supabase.from("stock_units" as never).update({ stock_status: "available", sold_reference_id: null } as never).in("imei", imeis as never).eq("stock_status", "reserved" as never);
        }
        await supabase.from("transaction_items" as never).delete().eq("transaction_id", id as never);
        await supabase.from("transactions" as never).delete().eq("id", id as never);
      }
      toast({ title: `${ids.length} transaksi dihapus` });
      setSelectedIds(new Set());
      setBulkDeleteMode(false);
      setShowBulkDeleteConfirm(false);
      fetchTransactions(true);
    } catch {
      toast({ title: "Gagal menghapus transaksi", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Export CSV
  function handleExport() {
    if (filtered.length === 0) return;
    const headers = ["Kode", "Status", "Channel", "Customer", "Email", "Telepon", "Subtotal", "Diskon", "Total", "Cabang", "Sales", "Metode Bayar", "Tanggal"];
    const rows = filtered.map(tx => [
      tx.transaction_code ?? tx.id.slice(0, 8),
      STATUS_CONFIG[tx.status]?.label ?? tx.status,
      CHANNEL_CONFIG[getChannelFromTransaction(tx)].label,
      tx.customer_name ?? "",
      tx.customer_email ?? "",
      tx.customer_phone ?? "",
      tx.subtotal, tx.discount_amount, tx.total,
      tx.branches?.name ?? "",
      tx.created_by ? (handlerNames[tx.created_by] ?? "") : "",
      tx.payment_method_name ?? "",
      format(new Date(tx.created_at), "d MMM yyyy HH:mm", { locale: localeId }),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transaksi_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Client-side filter (channel + search + sku)
  const filtered = useMemo(() => transactions.filter(tx => {
    const txChannel = getChannelFromTransaction(tx);
    if (channelFilter !== "all" && txChannel !== channelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = tx.transaction_code?.toLowerCase().includes(q)
        || tx.customer_name?.toLowerCase().includes(q)
        || tx.customer_phone?.toLowerCase().includes(q)
        || tx.customer_email?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  }), [transactions, channelFilter, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const paginationRange = useMemo(() => {
    const delta = 1;
    const range: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) range.push(i);
      else if (range[range.length - 1] !== "...") range.push("...");
    }
    return range;
  }, [page, totalPages]);

  useEffect(() => { setPage(1); }, [search, channelFilter, statusFilter, branchFilter, handlerFilter, dateRange, pageSize]);

  // Channel counts
  const counts = useMemo(() => ({
    all: transactions.length,
    pos: transactions.filter(t => getChannelFromTransaction(t) === "pos").length,
    website: transactions.filter(t => getChannelFromTransaction(t) === "website").length,
    shopee: transactions.filter(t => getChannelFromTransaction(t) === "shopee").length,
    tokopedia: transactions.filter(t => getChannelFromTransaction(t) === "tokopedia").length,
  } as Record<ChannelFilter, number>), [transactions]);

  const completedTx   = useMemo(() => filtered.filter(t => t.status === "completed"), [filtered]);
  const pendingTx     = useMemo(() => filtered.filter(t => getDisplayStatus(t) === "pending"), [filtered]);
  const cancelledTx   = useMemo(() => filtered.filter(t => ["cancelled", "failed", "expired"].includes(getDisplayStatus(t))), [filtered]);
  const totalRevenue   = useMemo(() => completedTx.reduce((a, t) => a + t.total, 0), [completedTx]);
  const pendingRevenue = useMemo(() => pendingTx.reduce((a, t) => a + t.total, 0), [pendingTx]);
  const cancelledRevenue = useMemo(() => cancelledTx.reduce((a, t) => a + t.total, 0), [cancelledTx]);
  const deleteTarget = transactions.find(t => t.id === deleteTargetId);
  const deletableFiltered = filtered.filter(t => t.status !== "completed");

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    const dels = paginated.filter(t => t.status !== "completed");
    const allSel = dels.every(t => selectedIds.has(t.id));
    setSelectedIds(prev => {
      const n = new Set(prev);
      allSel ? dels.forEach(t => n.delete(t.id)) : dels.forEach(t => n.add(t.id));
      return n;
    });
  }

  const hasActiveFilters = statusFilter !== "all" || branchFilter !== "all" || handlerFilter !== "all" || !!dateRange?.from || skuFilter.size > 0;

  return (
    <DashboardLayout pageTitle="Riwayat Transaksi">
      <div className="space-y-4 pb-16">

        {/* ── Header Row 1: Title + Buttons ──────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-foreground">Riwayat Transaksi</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => { setViewMode("card"); setSelectedIds(new Set()); }}
                className={cn("px-2.5 py-1.5 transition-colors", viewMode === "card" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
              ><LayoutGrid className="w-4 h-4" /></button>
              <button
                onClick={() => { setViewMode("table"); setBulkDeleteMode(false); setSelectedIds(new Set()); }}
                className={cn("px-2.5 py-1.5 transition-colors", viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
              ><List className="w-4 h-4" /></button>
            </div>

            {/* Tombol Tambah Transaksi Ecommerce — selalu tampil */}
            <Button
              size="sm"
              className="gap-1.5 font-semibold"
              onClick={() => setShowTambahEcommerce(true)}
            >
              <Plus className="w-4 h-4" />
              Transaksi Ecommerce
            </Button>

            {viewMode === "card" ? (
              bulkDeleteMode ? (
                <>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => { setBulkDeleteMode(false); setSelectedIds(new Set()); }}>Batal</Button>
                  <Button variant="destructive" size="sm" className="text-xs gap-1.5" disabled={selectedIds.size === 0} onClick={() => setShowBulkDeleteConfirm(true)}>
                    <Trash2 className="w-3.5 h-3.5" /> Hapus ({selectedIds.size})
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setBulkDeleteMode(true)}>
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Massal
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport} disabled={filtered.length === 0}>
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchTransactions(true)} disabled={refreshing}>
                    <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                  </Button>
                </>
              )
            ) : (
              <>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport} disabled={filtered.length === 0}>
                  <Download className="w-3.5 h-3.5" /> Export
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchTransactions(true)} disabled={refreshing}>
                  <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Header Row 2: Stat Cards — full width, 3 cols ─────── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Selesai */}
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col leading-none gap-1 min-w-0">
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(totalRevenue)}</span>
              <span className="text-[11px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wide">{completedTx.length} Selesai</span>
            </div>
          </div>

          {/* Menunggu */}
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex flex-col leading-none gap-1 min-w-0">
              <span className="text-base font-bold text-amber-700 dark:text-amber-300 tabular-nums">{formatCurrency(pendingRevenue)}</span>
              <span className="text-[11px] font-semibold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wide">{pendingTx.length} Menunggu</span>
            </div>
          </div>

          {/* Batal & gagal */}
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <XCircle className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex flex-col leading-none gap-1 min-w-0">
              <span className="text-base font-bold text-red-700 dark:text-red-300 tabular-nums">{formatCurrency(cancelledRevenue)}</span>
              <span className="text-[11px] font-semibold text-red-600/70 dark:text-red-400/70 uppercase tracking-wide">{cancelledTx.length} Batal</span>
            </div>
          </div>
        </div>

        {/* ── Channel Cards (design system) ────────────────────── */}
        <div
          className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide lg:grid lg:overflow-visible"
          style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
        >
          {(Object.entries(CHANNEL_CONFIG) as [ChannelFilter, typeof CHANNEL_CONFIG[ChannelFilter]][]).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const isActive = channelFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setChannelFilter(key)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 h-[68px] rounded-xl border transition-all shrink-0 min-w-[100px] lg:min-w-0 px-3 lg:px-2 lg:w-full",
                  isActive
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-xl font-bold leading-none tabular-nums", isActive ? "text-primary" : "text-foreground")}>
                    {counts[key]}
                  </span>
                </div>
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider text-center leading-tight", isActive ? "text-primary/80" : "text-muted-foreground")}>
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Filter Row ────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search + Periode */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Kode, nama, telepon, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm w-auto min-w-[150px]">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Branch (super admin only) */}
          {isSuperAdmin && (
            <SearchableDropdown
              compact
              showAllOption
              allLabel="Semua Cabang"
              options={branches}
              value={branchFilter}
              onChange={setBranchFilter}
              placeholder="Cabang"
              searchPlaceholder="Cari cabang..."
              align="right"
              triggerClassName="w-44"
            />
          )}

          {/* Sales Handler */}
          <Select value={handlerFilter} onValueChange={setHandlerFilter}>
            <SelectTrigger className="h-9 text-sm w-auto min-w-[140px]">
              <User className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Sales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sales</SelectItem>
              {handlerOptions.filter(o => o.name).map(o => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}{o.role ? ` (${o.role})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset all filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground gap-1.5"
              onClick={() => { setStatusFilter("all"); setBranchFilter("all"); setHandlerFilter("all"); setDateRange(undefined); setSkuFilter(new Set()); }}>
              <X className="w-3.5 h-3.5" /> Reset Filter
            </Button>
          )}
        </div>

        {/* ── Filter Description ────────────────────────────────── */}
        <p className="text-sm text-foreground">
          <span className="font-semibold">{filtered.length}</span>
          <span className="font-normal text-foreground"> Data transaksi</span>
          <span className="font-normal text-muted-foreground"> · </span>
          <span className="font-semibold text-foreground">
            {dateRange?.from
              ? `${format(dateRange.from, "d MMM yyyy", { locale: localeId })}${dateRange.to ? ` – ${format(dateRange.to, "d MMM yyyy", { locale: localeId })}` : ""}`
              : "Semua periode"}
          </span>
          <span className="font-normal text-muted-foreground"> · </span>
          <span className="font-semibold text-foreground">
            {branchFilter !== "all"
              ? (branches.find(b => b.id === branchFilter)?.name ?? "Pilihan cabang")
              : "Semua cabang"}
          </span>
          <span className="font-normal text-muted-foreground"> · </span>
          <span className="font-semibold text-foreground">
            {handlerFilter !== "all"
              ? (handlerNames[handlerFilter] ?? "Sales terpilih")
              : "Semua sales"}
          </span>
        </p>

        {/* ── List / Table ──────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">Tidak ada transaksi{channelFilter !== "all" ? ` untuk channel ${CHANNEL_CONFIG[channelFilter].label}` : ""}.</p>
          </div>
        ) : viewMode === "card" ? (
          <div className="space-y-2">
            {bulkDeleteMode && (
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 border border-border rounded-lg">
                <Checkbox checked={paginated.filter(t => t.status !== "completed").length > 0 && paginated.filter(t => t.status !== "completed").every(t => selectedIds.has(t.id))} onCheckedChange={toggleSelectAll} />
                <span className="text-xs text-muted-foreground">Pilih semua di halaman ini (kecuali selesai)</span>
              </div>
            )}
            {paginated.map(tx => (
              <TxCard
                key={tx.id} tx={tx}
                handlerNames={handlerNames} handlerRoles={handlerRoles}
                bulkDeleteMode={bulkDeleteMode} selected={selectedIds.has(tx.id)}
                onToggle={() => toggleSelect(tx.id)}
                onDelete={() => setDeleteTargetId(tx.id)}
                onClick={() => navigate(`/admin/transaksi/${tx.id}`)}
              />
            ))}
          </div>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-xs text-muted-foreground">{selectedIds.size} transaksi dipilih</p>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus {selectedIds.size} Transaksi
                </Button>
              </div>
            )}
            <AdminDataTable
              filterBarHeight={0}
              headerRow={
                <>
                  <TableHead className="w-10 px-2 bg-muted">
                    <Checkbox
                      checked={paginated.filter(t => t.status !== "completed").length > 0 && paginated.filter(t => t.status !== "completed").every(t => selectedIds.has(t.id))}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Pilih semua"
                    />
                  </TableHead>
                  <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Transaksi</TableHead>
                  <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Channel</TableHead>
                  <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Status</TableHead>
                  <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Tanggal</TableHead>
                  <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Sales</TableHead>
                  <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70 text-right">Total</TableHead>
                  <TableHead className="bg-muted font-bold text-sm uppercase tracking-wider text-foreground/70">Pembayaran</TableHead>
                  <TableHead className="bg-muted w-8" />
                </>
              }
            >
              {paginated.map(tx => (
                <TxTableRow
                  key={tx.id} tx={tx}
                  handlerNames={handlerNames}
                  selected={selectedIds.has(tx.id)}
                  onToggle={() => toggleSelect(tx.id)}
                  onDelete={() => setDeleteTargetId(tx.id)}
                  onClick={() => navigate(`/admin/transaksi/${tx.id}`)}
                />
              ))}
            </AdminDataTable>
          </>
        )}

      </div>

      {/* ── Tambah Transaksi Ecommerce Modal ── */}
      <TambahEcommerceTransaksiModal
        open={showTambahEcommerce}
        onClose={() => setShowTambahEcommerce(false)}
        onSuccess={() => { setShowTambahEcommerce(false); fetchTransactions(true); }}
      />

      {/* ── Delete Confirmation Dialogs ── */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi <span className="font-semibold">{deleteTarget?.transaction_code ?? deleteTargetId?.slice(0, 8).toUpperCase()}</span> akan dihapus secara permanen.
              {deleteTarget?.status === "pending" && " Stok unit yang dicadangkan akan dikembalikan ke tersedia."}
              {" "}Tindakan ini tidak dapat diurungkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} transaksi akan dihapus secara permanen. Stok yang dicadangkan dikembalikan ke tersedia. Tindakan ini tidak dapat diurungkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : `Ya, Hapus ${selectedIds.size} Transaksi`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Fixed Bottom Pagination ── */}
      {!loading && filtered.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-[72px] right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
          <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Tampilkan</span>
              <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground hidden sm:inline">per halaman · {filtered.length} total</span>
            </div>
            <span className="text-xs text-muted-foreground sm:hidden">{page}/{totalPages}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="hidden sm:flex items-center gap-1">
                {paginationRange.map((item, idx) =>
                  item === "..." ? (
                    <span key={`dots-${idx}`} className="w-8 text-center text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button key={item} variant={page === item ? "default" : "outline"} size="sm"
                      className={cn("h-8 w-8 p-0 text-xs", page === item && "pointer-events-none")}
                      onClick={() => setPage(item as number)}>
                      {item}
                    </Button>
                  )
                )}
              </div>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
