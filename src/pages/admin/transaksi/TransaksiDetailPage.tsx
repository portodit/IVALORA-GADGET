import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Clock, XCircle, AlertCircle,
  Zap, RefreshCw, Copy, ExternalLink, FileText, Ban,
  QrCode, Wallet, Banknote, Upload, CreditCard,
  PartyPopper, MapPin, MessageCircle, Info, RotateCcw, ChevronDown, Package,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/shared/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/admin/produk/stock-units";
import { resolveUploadUrl } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/admin/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { ImageCropModal } from "@/components/shared/ImageCropModal";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  transaction_code: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  discount_code: string | null;
  total: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_user_id: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  created_at: string;
  confirmed_at: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  payment_proof_url: string | null;
  admin_notified: boolean | null;
  branch_id: string;
  doku_payment_url: string | null;
  doku_token_id: string | null;
  doku_expired_date: string | null;
  doku_va_number: string | null;
  shipping_cost: number | null;
  shipping_discount: number | null;
  shipping_courier: string | null;
  shipping_service: string | null;
  shipping_etd: string | null;
  shipping_address: string | null;
  packing_kayu_cost: number;
  split_channels?: SplitChannel[] | null;
  branches?: { name: string; code: string; google_maps_url: string | null } | null;
}

interface PaymentMethodDetail {
  id: string;
  name: string;
  type: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  qris_image_url: string | null;
}

interface TransactionItem {
  id: string;
  imei: string;
  product_label: string;
  selling_price: number;
  warranty_label?: string;
  stock_unit_id?: string;
  accessory_id?: string | null;
  product_photo?: string | null;
}

interface BonusItem {
  id: string;
  name: string;
  icon: string | null;
  track_stock: boolean;
  master_product_id: string | null;
}

interface BonusClaim {
  id: string;
  transaction_id: string;
  chosen_bonus_id: string | null;
  review_proof_url: string;
  submitted_at: string;
}

interface XenditInvoice {
  id: string;
  external_id: string;
  status: string;
  amount: number;
  paid_amount: number | null;
  invoice_url: string | null;
  expiry_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_channel: string | null;
}

interface SplitChannel {
  idx: number;
  type: "doku" | "manual";
  method_key: string | null;
  method_name: string | null;
  method_section: string | null;
  doku_method_type: string | null;
  nominal: number;
  fee: number;
  include_fee: boolean;
  status: "pending" | "paid";
  doku_payment_url: string | null;
  doku_va_number: string | null;
  doku_token_id: string | null;
  doku_expired_date: string | null;
  payment_proof_url: string | null;
  admin_notified: boolean;
  confirmed_at: string | null;
  confirmed_by: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const INVOICE_DURATION_MS = 10800 * 1000;
const DOKU_EXPIRED_REASON = "Batas waktu pembayaran habis. Transaksi dibatalkan otomatis oleh sistem.";

const STATUS_CONFIG: Record<string, {
  label: string; icon: React.ElementType; color: string; dot: string; bg: string; info: string;
}> = {
  pending:   { label: "Menunggu Pembayaran", icon: Clock,        color: "text-amber-700 dark:text-amber-300",     dot: "bg-amber-500",        bg: "bg-amber-500/10 border-amber-500/20",     info: "Transaksi sudah dibuat, pembeli belum melakukan pembayaran. Invoice akan kedaluwarsa dalam 3 jam sejak transaksi dibuat." },
  paid:      { label: "Lunas",               icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500",      bg: "bg-emerald-500/10 border-emerald-500/20", info: "Pembayaran sudah diterima. Menunggu konfirmasi selesai oleh admin." },
  expired:   { label: "Kedaluwarsa",         icon: XCircle,      color: "text-red-600 dark:text-red-400",         dot: "bg-red-500",          bg: "bg-red-500/10 border-red-500/20",         info: "Batas waktu pembayaran telah habis (3 jam). Transaksi dibatalkan otomatis dan stok dikembalikan ke tersedia." },
  completed: { label: "Selesai",             icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500",      bg: "bg-emerald-500/10 border-emerald-500/20", info: "Pembayaran telah dikonfirmasi dan transaksi berhasil diselesaikan." },
  cancelled: { label: "Dibatalkan",          icon: XCircle,      color: "text-red-600 dark:text-red-400",         dot: "bg-red-500",          bg: "bg-red-500/10 border-red-500/20",         info: "Transaksi dibatalkan secara manual oleh admin atau sistem. Stok unit dikembalikan ke tersedia." },
  failed:    { label: "Gagal",               icon: XCircle,      color: "text-red-600 dark:text-red-400",         dot: "bg-red-500",          bg: "bg-red-500/10 border-red-500/20",         info: "Terjadi kegagalan saat proses pembayaran. Biasanya karena masalah gateway atau koneksi." },
  refunded:  { label: "Refund",              icon: RefreshCw,    color: "text-muted-foreground",                  dot: "bg-muted-foreground", bg: "bg-muted/40 border-muted",               info: "Dana sudah dikembalikan ke pembeli setelah transaksi sebelumnya berhasil." },
};

const XENDIT_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:  { label: "Menunggu Pembayaran", color: "text-amber-600 dark:text-amber-400", icon: Clock },
  PAID:     { label: "Sudah Dibayar",       color: "text-green-600 dark:text-green-400", icon: CheckCircle2 },
  SETTLED:  { label: "Sudah Dibayar",       color: "text-green-600 dark:text-green-400", icon: CheckCircle2 },
  EXPIRED:  { label: "Kadaluarsa",          color: "text-destructive",                   icon: XCircle },
};

// Payment guides per channel (DOKU) — multi-method accordion
type DokuMethod = { name: string; steps: string[] };
type DokuBankGuide = { label: string; methods: DokuMethod[] };

const DOKU_GUIDES: Record<string, DokuBankGuide> = {
  bca: {
    label: "BCA Virtual Account",
    methods: [
      {
        name: "BCA ATM",
        steps: [
          "Masukkan kartu ATM dan PIN BCA",
          "Pilih Transaksi Lainnya → Transfer → ke Rekening BCA Virtual Account",
          "Masukkan nomor Virtual Account BCA yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Ikuti instruksi untuk menyelesaikan transaksi",
          "Simpan bukti pembayaran dan tunjukkan ke sales",
        ],
      },
      {
        name: "m-BCA (BCA Mobile)",
        steps: [
          "Login aplikasi BCA Mobile",
          "Pilih m-Transfer → BCA Virtual Account",
          "Masukkan nomor Virtual Account BCA yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Masukkan PIN m-BCA dan konfirmasi pembayaran",
        ],
      },
      {
        name: "BCA Internet Banking (KlikBCA)",
        steps: [
          "Login KlikBCA Individual",
          "Pilih Transfer Dana → Transfer ke BCA Virtual Account",
          "Masukkan nomor Virtual Account BCA yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Masukkan KeyBCA / mToken BCA dan konfirmasi",
        ],
      },
    ],
  },
  bni: {
    label: "BNI Virtual Account",
    methods: [
      {
        name: "ATM BNI",
        steps: [
          "Masukkan kartu ATM dan PIN BNI",
          "Pilih Menu Lain → Transfer → Antar Rekening → ke Rek. BNI Virtual Account",
          "Masukkan nomor Virtual Account BNI yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Konfirmasi dan simpan bukti pembayaran",
        ],
      },
      {
        name: "BNI Mobile Banking",
        steps: [
          "Login aplikasi BNI Mobile Banking",
          "Pilih Transfer → Virtual Account Billing",
          "Masukkan nomor Virtual Account BNI yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Masukkan password transaksi dan konfirmasi",
        ],
      },
      {
        name: "BNI Internet Banking",
        steps: [
          "Login BNI Internet Banking",
          "Pilih Transfer → Virtual Account Billing",
          "Masukkan nomor Virtual Account BNI yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Masukkan token BNI dan konfirmasi",
        ],
      },
    ],
  },
  bri: {
    label: "BRI Virtual Account",
    methods: [
      {
        name: "ATM BRI",
        steps: [
          "Masukkan kartu ATM dan PIN BRI",
          "Pilih Transaksi Lain → Pembayaran → Lainnya → BRIVA",
          "Masukkan nomor Virtual Account BRI yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Konfirmasi dan simpan bukti pembayaran",
        ],
      },
      {
        name: "BRImo (BRI Mobile)",
        steps: [
          "Login aplikasi BRImo",
          "Pilih BRIVA",
          "Masukkan nomor Virtual Account BRI yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Masukkan PIN BRImo dan konfirmasi pembayaran",
        ],
      },
      {
        name: "BRI Internet Banking",
        steps: [
          "Login Internet Banking BRI",
          "Pilih Pembayaran → BRIVA",
          "Masukkan nomor Virtual Account BRI yang tertera di atas",
          "Nominal muncul otomatis — pastikan sudah sesuai",
          "Masukkan mToken BRI dan konfirmasi",
        ],
      },
    ],
  },
  mandiri: {
    label: "Mandiri Virtual Account",
    methods: [
      {
        name: "ATM Mandiri",
        steps: [
          "Masukkan kartu ATM dan PIN Mandiri",
          "Pilih Bayar/Beli → Multipayment",
          "Pilih penyedia jasa: DOKU",
          "Masukkan nomor Virtual Account Mandiri yang tertera di atas",
          "Nominal muncul otomatis — konfirmasi dan simpan bukti",
        ],
      },
      {
        name: "Livin' by Mandiri",
        steps: [
          "Login aplikasi Livin' by Mandiri",
          "Pilih Pembayaran → Buat Pembayaran Baru",
          "Pilih Multipayment dan cari DOKU",
          "Masukkan nomor Virtual Account Mandiri yang tertera di atas",
          "Konfirmasi nominal dan selesaikan pembayaran",
        ],
      },
    ],
  },
  bsi: {
    label: "BSI Virtual Account",
    methods: [
      {
        name: "ATM BSI",
        steps: [
          "Masukkan kartu ATM dan PIN BSI",
          "Pilih Pembayaran → Virtual Account",
          "Masukkan nomor Virtual Account BSI yang tertera di atas",
          "Konfirmasi nominal dan selesaikan pembayaran",
        ],
      },
      {
        name: "BSI Mobile",
        steps: [
          "Login aplikasi BSI Mobile",
          "Pilih Pembayaran → Virtual Account",
          "Masukkan nomor Virtual Account BSI yang tertera di atas",
          "Konfirmasi nominal dan selesaikan pembayaran",
        ],
      },
    ],
  },
  permata: {
    label: "Permata Virtual Account",
    methods: [
      {
        name: "ATM Permata",
        steps: [
          "Masukkan kartu ATM dan PIN Permata",
          "Pilih Transaksi → Pembayaran → Virtual Account",
          "Masukkan nomor Virtual Account Permata yang tertera di atas",
          "Konfirmasi nominal dan selesaikan pembayaran",
          "Simpan bukti pembayaran",
        ],
      },
      {
        name: "PermataMobile X",
        steps: [
          "Login aplikasi PermataMobile X",
          "Pilih Bayar → Virtual Account",
          "Masukkan nomor Virtual Account Permata yang tertera di atas",
          "Konfirmasi nominal dan selesaikan pembayaran",
        ],
      },
    ],
  },
  cimb: {
    label: "CIMB Virtual Account",
    methods: [
      {
        name: "ATM CIMB",
        steps: [
          "Masukkan kartu ATM dan PIN CIMB",
          "Pilih Transaksi Lain → Pembayaran → Virtual Account",
          "Masukkan nomor Virtual Account CIMB yang tertera di atas",
          "Konfirmasi nominal dan selesaikan pembayaran",
          "Simpan bukti pembayaran",
        ],
      },
      {
        name: "OCTO Mobile",
        steps: [
          "Login aplikasi OCTO Mobile",
          "Pilih Transfer → Virtual Account",
          "Masukkan nomor Virtual Account CIMB yang tertera di atas",
          "Konfirmasi nominal dan selesaikan pembayaran",
        ],
      },
      {
        name: "OCTO Clicks (Internet Banking)",
        steps: [
          "Login OCTO Clicks",
          "Pilih Transfer → ke Virtual Account",
          "Masukkan nomor Virtual Account CIMB yang tertera di atas",
          "Konfirmasi nominal dan selesaikan pembayaran",
        ],
      },
    ],
  },
  default: {
    label: "Virtual Account",
    methods: [
      {
        name: "ATM",
        steps: [
          "Masukkan kartu ATM dan PIN",
          "Pilih menu Transfer / Pembayaran → Virtual Account",
          "Masukkan nomor Virtual Account yang tertera di atas",
          "Nominal muncul otomatis — konfirmasi transaksi",
          "Simpan bukti pembayaran dan tunjukkan ke sales",
        ],
      },
      {
        name: "Mobile Banking",
        steps: [
          "Login aplikasi mobile banking bank kamu",
          "Pilih menu Transfer / Pembayaran → Virtual Account",
          "Masukkan nomor Virtual Account yang tertera di atas",
          "Nominal muncul otomatis — konfirmasi transaksi",
          "Simpan bukti pembayaran dan tunjukkan ke sales",
        ],
      },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(iso: string) {
  try {
    return format(new Date(iso), "d MMM yyyy, HH.mm 'WIB'", { locale: localeId });
  } catch {
    return iso;
  }
}

function parseDokuExpiry(str: string | null): Date | null {
  if (!str) return null;
  // ISO format (e.g. "2026-04-05T17:23:27+07:00")
  if (str.includes("T") || (str.includes("-") && str.length > 8)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  // DOKU compact format "YYYYMMDDHHMMSS"
  if (str.length < 12) return null;
  const y = +str.slice(0, 4), mo = +str.slice(4, 6) - 1, d = +str.slice(6, 8);
  const h = +str.slice(8, 10), mi = +str.slice(10, 12);
  return new Date(Date.UTC(y, mo, d, h - 7, mi));
}

function formatDokuExpiryDisplay(str: string | null): string {
  if (!str) return "—";
  // ISO format
  if (str.includes("T") || (str.includes("-") && str.length > 8)) {
    const d = new Date(str);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
    }) + " WIB";
  }
  // DOKU compact format
  if (str.length < 12) return "—";
  return `${str.slice(6, 8)}/${str.slice(4, 6)}/${str.slice(0, 4)} ${str.slice(8, 10)}:${str.slice(10, 12)} WIB`;
}

function formatExpiry(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

function getGreetingWIB(): string {
  const wibHour = (new Date().getUTCHours() + 7) % 24;
  if (wibHour >= 5 && wibHour < 11) return "pagi";
  if (wibHour >= 11 && wibHour < 15) return "siang";
  if (wibHour >= 15 && wibHour < 19) return "sore";
  return "malam";
}

function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) cleaned = "62" + cleaned.slice(1);
  else if (!cleaned.startsWith("62")) cleaned = "62" + cleaned;
  return cleaned;
}

function buildWaMessage({
  customerName, salesName, branchName, items, total, discountAmount, discountCode,
  channelName, paymentUrl, vaNumber, expiryDisplay,
}: {
  customerName: string; salesName: string; branchName: string;
  items: TransactionItem[]; total: number; discountAmount: number;
  discountCode: string | null; channelName: string; paymentUrl: string;
  vaNumber?: string | null; expiryDisplay: string;
}): string {
  const greeting = getGreetingWIB();
  const itemList = items.map(i => `• ${i.product_label}`).join("\n");
  const totalStr = formatCurrency(total);
  const discountInfo = discountAmount > 0
    ? `, dengan diskon${discountCode ? ` kode "${discountCode}"` : ""} sebesar ${formatCurrency(discountAmount)}`
    : "";

  const paymentDetail = vaNumber
    ? `Adapun pembayaran yang kakak pilih melalui *${channelName}* bisa diselesaikan dengan transfer ke nomor Virtual Account berikut:\n*${vaNumber}*`
    : `Adapun pembayaran yang kakak pilih melalui *${channelName}* bisa diselesaikan pada link berikut:\n${paymentUrl}`;

  return (
    `Selamat ${greeting}, kak ${customerName} 👋\n\n` +
    `Perkenalkan saya ${salesName}, selaku Sales Ivalora Gadget Cabang ${branchName}. ` +
    `Mohon izin untuk mengirimkan informasi pembayaran untuk transaksi pembelian:\n${itemList}\n` +
    `dengan total pembayaran *${totalStr}*${discountInfo}.\n\n` +
    `${paymentDetail}\n\n` +
    `Mohon diperhatikan bahwa pembayaran aktif hingga *${expiryDisplay}*, ` +
    `jadi jangan sampai telat membayar ya kak 🙏 ` +
    `Jika sudah membayar, mohon tunjukkan bukti transfer ke sales kami untuk pendataan toko.\n\n` +
    `Terima kasih dan selamat berbelanja kak 😊`
  );
}

function getDokuGuide(pmName: string): DokuBankGuide {
  const n = pmName.toLowerCase();
  if (n.includes("bca"))                            return DOKU_GUIDES.bca;
  if (n.includes("bri") && !n.includes("briceria")) return DOKU_GUIDES.bri;
  if (n.includes("bni"))                            return DOKU_GUIDES.bni;
  if (n.includes("mandiri"))                        return DOKU_GUIDES.mandiri;
  if (n.includes("bsi") || n.includes("syariah"))   return DOKU_GUIDES.bsi;
  if (n.includes("permata"))                        return DOKU_GUIDES.permata;
  if (n.includes("cimb"))                           return DOKU_GUIDES.cimb;
  return DOKU_GUIDES.default;
}

function HowToPaySection({ guide }: { guide: DokuBankGuide }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-bold text-foreground">Cara Bayar — {guide.label}</p>
      <div className="space-y-2">
        {guide.methods.map((method, idx) => (
          <div key={idx} className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(open === idx ? null : idx)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-semibold text-foreground">{method.name}</span>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", open === idx && "rotate-180")} />
            </button>
            {open === idx && (
              <div className="px-3 pb-3 bg-muted/20 border-t border-border">
                <ol className="space-y-2 mt-2.5">
                  {method.steps.map((step, si) => (
                    <li key={si} className="flex gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-primary/10 text-primary mt-0.5">{si + 1}</span>
                      <span className="text-sm text-foreground leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border">
        <p className="text-xs font-bold text-foreground leading-relaxed">
          Kirim bukti pembayaran ke sales setelah selesai melakukan transfer.
        </p>
      </div>
    </div>
  );
}

// Map payment method name → local logo asset path
function getPaymentLogoUrl(pmName: string): string | null {
  const n = pmName.toLowerCase();
  if (n.includes("bca"))     return "/kanal/va/bca.png";
  if (n.includes("bni"))     return "/kanal/va/bni.png";
  if (n.includes("bri") && !n.includes("briceria")) return "/kanal/va/bri.png";
  if (n.includes("mandiri")) return "/kanal/va/mandiri.png";
  if (n.includes("bsi") || n.includes("syariah")) return "/kanal/va/bsi.png";
  if (n.includes("permata")) return "/kanal/va/permata.png";
  if (n.includes("cimb"))    return "/kanal/va/cimb.png";
  if (n.includes("danamon")) return "/kanal/va/danamon.png";
  if (n.includes("btn"))     return "/kanal/va/btn.png";
  if (n.includes("maybank")) return "/kanal/va/maybank.png";
  if (n.includes("bnc"))     return "/kanal/va/bnc.png";
  if (n.includes("sinarmas")) return "/kanal/va/sinarmas.png";
  if (n.includes("seabank") || n.includes("sea bank")) return "/kanal/va/seabank.png";
  if (n.includes("ovo"))     return "/kanal/ewallet/ovo.png";
  if (n.includes("dana"))    return "/kanal/ewallet/dana.png";
  if (n.includes("shopee"))  return "/kanal/ewallet/shopeepay.png";
  if (n.includes("linkaja")) return "/kanal/ewallet/linkaja.png";
  if (n.includes("kredivo")) return "/kanal/paylater/kredivo.png";
  if (n.includes("akulaku")) return "/kanal/paylater/akulaku.png";
  if (n.includes("indodana")) return "/kanal/paylater/indodana.png";
  if (n.includes("briceria")) return "/kanal/paylater/briceria.png";
  if (n.includes("alfamart")) return "/kanal/other/alfamart.png";
  if (n.includes("indomaret")) return "/kanal/other/indomaret.png";
  if (n.includes("doku"))    return "/kanal/va/doku.png";
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Disalin!" }); }}
      className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
      title="Salin"
    >
      <Copy className="w-3 h-3" />
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border",
      cfg.bg, cfg.color,
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

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
  const acronym = clean.match(/\(([A-Z]{2,})\)\s*$/);
  if (acronym) return `Transfer ${acronym[1]}`;
  if (/bank|niaga|maybank/i.test(clean)) return `Transfer ${clean.replace(/^Bank\s+/i, "").trim()}`;
  return clean;
}

function cleanBankName(pmName: string): string {
  let name = pmName;
  // Hapus prefix "DOKU – DOKU – " atau "DOKU - DOKU - " (berbagai variasi)
  name = name.replace(/^doku\s*[-–—]\s*doku\s*[-–—]\s*/i, "");
  // Hapus suffix "(BNI)", "(BCA)" dll
  name = name.replace(/\s*\([^)]*\)\s*$/, "");
  // Hapus "- Virtual Account" atau "Virtual Account" suffix
  name = name.replace(/\s*[-–—]?\s*virtual\s*account\s*/i, "").trim();
  return name.toUpperCase() || pmName.toUpperCase();
}

function splitPaymentLabel(pmName: string): string {
  const raw = pmName.replace(/^Split:\s*/i, "");
  const parts = raw.split(/\s*\|\s*/).filter(Boolean);
  const names = parts.map(part => {
    const methodName = part
      .replace(/\s*Rp[\d.,]+.*/, "")
      .replace(/\s*\+fee.*/i, "")
      .trim()
      .replace(/^doku\s*[-–—]\s*/i, "")
      .trim();
    // Prefer acronym from parens "(BNI)" → "BNI"
    const acronym = methodName.match(/\(([A-Z]{2,})\)\s*$/);
    if (acronym) return acronym[1];
    // Use short name map, stripping "Transfer " prefix
    const short = DOKU_SHORT_NAME[methodName];
    if (short) return short.replace(/^Transfer\s+/i, "");
    return methodName.replace(/^Bank\s+/i, "").trim();
  });
  return `Split Payment (${names.join(" & ")})`;
}

function PaymentMethodBadge({ pmName }: { pmName: string }) {
  const [failed, setFailed] = useState(false);
  const isSplitPm = pmName.toLowerCase().startsWith("split:");
  const label = isSplitPm ? splitPaymentLabel(pmName) : cleanBankName(pmName || "—");
  const url = isSplitPm ? null : getPaymentLogoUrl(pmName);
  return (
    <span className="inline-flex items-center gap-1">
      {!isSplitPm && url && !failed ? (
        <img src={url} alt={label} onError={() => setFailed(true)} className="w-4 h-4 object-contain" />
      ) : (
        <CreditCard className="w-3.5 h-3.5 text-foreground/60" />
      )}
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </span>
  );
}

function PaymentChannelLogo({ pmName }: { pmName: string }) {
  const [failed, setFailed] = useState(false);
  const url = getPaymentLogoUrl(pmName);
  const label = shortChannelName(pmName || "DOKU");
  const isVA = /virtual.account|VIRTUAL_ACCOUNT|bank/i.test(pmName);
  const subLabel = isVA ? "Virtual Account" : /emoney|ovo|dana|shopee|linkaja/i.test(pmName) ? "E-Wallet" : null;
  if (!url || failed) {
    return (
      <span className="inline-flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted border border-border/40 shrink-0">
          <CreditCard className="w-9 h-9 text-foreground/60" />
        </span>
        <span>
          <p className="text-base font-bold text-foreground">{label}</p>
          {subLabel && <p className="text-sm font-semibold text-muted-foreground mt-0.5">{subLabel}</p>}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white border border-border/40 shrink-0">
        <img src={url} alt={label} onError={() => setFailed(true)} className="w-9 h-9 object-contain" />
      </span>
      <span>
        <p className="text-base font-bold text-foreground">{label}</p>
        {subLabel && <p className="text-sm font-semibold text-muted-foreground mt-0.5">{subLabel}</p>}
      </span>
    </span>
  );
}

function DokuCountdown({ expiryDate, inline = false }: { expiryDate: string | null; inline?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const deadline = parseDokuExpiry(expiryDate);
  if (!deadline) return null;
  const diff = deadline.getTime() - now;

  if (diff <= 0) {
    const expiredContent = (
      <>
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-sm font-bold text-red-600 dark:text-red-400">Tidak aktif</span>
      </>
    );
    if (inline) return <div className="flex items-center gap-1.5">{expiredContent}</div>;
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
        {expiredContent}
      </div>
    );
  }

  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  const isUrgent = diff < 30 * 60_000;

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        "rounded-xl flex items-center justify-center font-bold tabular-nums transition-colors shadow-sm",
        inline ? "w-14 h-14 text-2xl" : "w-16 h-16 text-3xl",
        isUrgent ? "bg-red-500 text-white" : "bg-primary text-primary-foreground",
      )}>
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );

  const label = (
    <p className={cn(
      "text-xs font-bold uppercase tracking-wide",
      isUrgent ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
    )}>
      {isUrgent ? "⚠️ Segera bayar!" : "Selesaikan dalam"}
    </p>
  );

  const timer = (
    <div className={cn("flex items-center", inline ? "gap-1" : "gap-2")}>
      <TimeBlock value={h} label="Jam" />
      <span className={cn("font-bold pb-5", inline ? "text-2xl" : "text-3xl", isUrgent ? "text-red-500" : "text-primary")}>:</span>
      <TimeBlock value={m} label="Menit" />
      <span className={cn("font-bold pb-5", inline ? "text-2xl" : "text-3xl", isUrgent ? "text-red-500" : "text-primary")}>:</span>
      <TimeBlock value={s} label="Detik" />
    </div>
  );

  if (inline) {
    return (
      <div className="flex flex-col items-end gap-2">
        {label}
        {timer}
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col items-center gap-3",
      isUrgent ? "bg-red-500/5 border-red-500/20" : "bg-primary/5 border-primary/10",
    )}>
      {label}
      {timer}
    </div>
  );
}

function XenditPaymentCard({ inv }: { inv: XenditInvoice }) {
  const statusInfo = XENDIT_STATUS[inv.status] ?? { label: inv.status, color: "text-muted-foreground", icon: Clock };
  const StatusIcon = statusInfo.icon;
  const isPaid = inv.status === "PAID" || inv.status === "SETTLED";
  const isExpired = inv.status === "EXPIRED";

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      isPaid ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10"
        : isExpired ? "border-destructive/20 bg-destructive/5"
          : "border-primary/20 bg-primary/5"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted text-foreground">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {inv.payment_method ? `${inv.payment_method} - ${inv.payment_channel || ""}` : "Xendit Payment"}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{inv.id}</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1", statusInfo.color)}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{statusInfo.label}</span>
        </div>
      </div>

      <div className="flex items-center justify-between py-2 border-y border-border/50">
        <span className="text-xs text-muted-foreground">Jumlah Tagihan</span>
        <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(inv.amount)}</span>
      </div>

      {inv.invoice_url && !isPaid && !isExpired && (
        <a
          href={inv.invoice_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-primary text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Buka Halaman Pembayaran
        </a>
      )}

      {isPaid && inv.paid_at && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <p className="text-xs">Dibayar pada {formatDateTime(inv.paid_at)}</p>
        </div>
      )}

      {!isPaid && !isExpired && inv.expiry_date && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Batas Pembayaran: <span className="font-semibold">{formatExpiry(inv.expiry_date)}</span></span>
        </div>
      )}

      {isExpired && inv.expiry_date && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <XCircle className="w-3 h-3 shrink-0" />
          <span>Batas berlaku: <span className="font-medium">{formatExpiry(inv.expiry_date)}</span></span>
        </div>
      )}
    </div>
  );
}

// ── Section Wrapper ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground px-0.5">{title}</h2>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TransaksiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [bonusItemsMap, setBonusItemsMap] = useState<Record<string, BonusItem[]>>({});
  const [xenditInvoices, setXenditInvoices] = useState<XenditInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingXendit, setLoadingXendit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelReasonText, setCancelReasonText] = useState<string>("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [adminNotified, setAdminNotified] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [handlerName, setHandlerName] = useState<string | null>(null);
  const [regeneratingDoku, setRegeneratingDoku] = useState(false);
  const [waiveFeeAdminRegen, setWaiveFeeAdminRegen] = useState(false);
  const [checkingDokuStatus, setCheckingDokuStatus] = useState(false);
  const [lastDokuCheck, setLastDokuCheck] = useState<Date | null>(null);
  const [splitProofUploading, setSplitProofUploading] = useState<number | null>(null);
  const [splitAdminNotified, setSplitAdminNotified] = useState<Record<number, boolean>>({});
  const [cropImageSrc, setCropImageSrc] = useState<string>("");
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [splitConfirming, setSplitConfirming] = useState<number | null>(null);
  const [bonusPopupExpanded, setBonusPopupExpanded] = useState(false);
  const [expandedBonuses, setExpandedBonuses] = useState<Record<string, boolean>>({});
  const [proofExpanded, setProofExpanded] = useState(true);
  const [bonusSectionExpanded, setBonusSectionExpanded] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // ── Auto-hide proof if seen before ──
  useEffect(() => {
    if (!id) return;
    const seenProofs = JSON.parse(localStorage.getItem("ivalora_seen_proofs") || "[]");
    if (seenProofs.includes(id)) {
      setProofExpanded(false);
    } else {
      // First time seeing this proof, mark as seen for NEXT refresh
      const newSeen = [...seenProofs, id];
      localStorage.setItem("ivalora_seen_proofs", JSON.stringify(newSeen));
    }
  }, [id]);

  // ── Bonus claim (Google Maps review) ──────────────────────────────────────
  const [bonusClaim, setBonusClaim] = useState<BonusClaim | null>(null);
  const [bonusClaimUpdated, setBonusClaimUpdated] = useState(false);
  const [chosenAdaptorId, setChosenAdaptorId] = useState<string | null>(null);
  const [reviewProofFile, setReviewProofFile] = useState<File | null>(null);
  const [reviewProofPreview, setReviewProofPreview] = useState<string | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  // Flat list of all bonus items across all transaction items (deduplicated by id)
  const allBonusItems: BonusItem[] = Object.values(bonusItemsMap)
    .flat()
    .filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i);
  const adaptorBonuses = allBonusItems.filter(b => b.track_stock);

  const { user } = useAuth();

  // Warn when transaction is completed but bonus claim not yet submitted
  const [navWarningOpen, setNavWarningOpen] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);
  const shouldBlockNav = !!(
    transaction &&
    transaction.status === "completed" &&
    adaptorBonuses.length > 0 &&
    !bonusClaim
  );

  // Intercept browser back button
  useEffect(() => {
    if (!shouldBlockNav) return;
    window.history.pushState(null, "", window.location.href);
    const handlePop = () => {
      window.history.pushState(null, "", window.location.href);
      setPendingNavTarget("/admin/transaksi");
      setNavWarningOpen(true);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [shouldBlockNav]);

  // Warn on browser tab close / hard navigation
  useEffect(() => {
    if (!shouldBlockNav) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlockNav]);

  const safeNavigate = (target: string) => {
    if (shouldBlockNav) {
      setPendingNavTarget(target);
      setNavWarningOpen(true);
    } else {
      navigate(target);
    }
  };

  // Track which transaction ID has already triggered auto-faktur (prevent duplicates)
  const autoFakturAttempted = useRef<string | null>(null);

  const createFakturAuto = useCallback(async (txn: Transaction, txItems: TransactionItem[]) => {
    try {
      const { data: existing } = await supabase
        .from("invoices" as never)
        .select("id")
        .eq("transaction_id", txn.id)
        .maybeSingle();
      if (existing) return; // already exists

      const branchId = txn.branch_id;
      const { data: branch } = await supabase.from("branches").select("code").eq("id", branchId).single();
      const { data: settings } = await supabase.from("invoice_settings" as never).select("*").eq("branch_id", branchId).maybeSingle() as { data: any };
      const prefix = settings?.number_prefix || "INV";
      const resetMode = settings?.sequence_reset || "monthly";
      const dueDays = settings?.default_due_days ?? 0;
      const numFormat = settings?.number_format || "branch_code";
      const branchCode = numFormat === "custom" ? (settings?.custom_code || "") : (branch as any)?.code || "XX";
      const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number" as never, {
        _branch_id: branchId, _branch_code: branchCode, _prefix: prefix, _reset_mode: resetMode,
        _include_code: numFormat !== "none", _include_date: settings?.use_date_reset ?? true,
      } as never);
      const dueDate = dueDays > 0 ? new Date(Date.now() + dueDays * 86400000).toISOString() : null;
      let hName = null;
      if (txn.created_by) {
        const { data: profile } = await supabase.from("user_profiles" as never).select("full_name, email").eq("id", txn.created_by).single() as { data: any };
        hName = profile?.full_name || profile?.email || null;
      }
      const { error } = await supabase.from("invoices" as never).insert({
        invoice_number: invoiceNumber as unknown as string, transaction_id: txn.id, branch_id: branchId,
        status: "published", customer_name: txn.customer_name, customer_email: txn.customer_email,
        customer_phone: txn.customer_phone, subtotal: txn.subtotal, discount_amount: txn.discount_amount,
        discount_code: txn.discount_code, shipping_cost: txn.shipping_cost ?? 0,
        shipping_discount: txn.shipping_discount ?? 0, packing_kayu_cost: txn.packing_kayu_cost ?? 0,
        total: txn.total, amount_paid: txn.total, balance_due: 0,
        payment_method_name: txn.payment_method_name, payment_status: "paid",
        items_snapshot: txItems.map(i => ({ product_label: i.product_label, imei: i.imei, qty: 1, selling_price: i.selling_price })),
        invoice_date: new Date().toISOString(), due_date: dueDate, paid_at: txn.confirmed_at,
        handled_by_name: hName, channel: "pos", terms_snapshot: settings?.terms_json ?? null,
        created_by: (await supabase.auth.getSession()).data.session?.user.id ?? null,
      } as never).select("id").single() as { data: any; error: any };
      if (error) throw error;
      toast({ title: "Faktur berhasil dibuat otomatis" });
    } catch {
      // Silent fail — user can still create manually via tombol Lihat Faktur
    }
  }, [toast]);

  const fetchHandlerName = useCallback(async (userId: string | null) => {
    if (!userId) { setHandlerName(null); return; }
    const { data } = await supabase
      .from("user_profiles" as never)
      .select("full_name, email")
      .eq("id", userId)
      .single() as { data: { full_name: string | null; email: string } | null };
    setHandlerName(data?.full_name || data?.email || null);
  }, []);

  const fetchTransaction = useCallback(async () => {
    if (!id) return;
    const { data: tx } = await supabase
      .from("transactions" as never)
      .select("*, branches(name, code, google_maps_url)")
      .eq("id", id)
      .single() as { data: Transaction | null };

    if (!tx) { setLoading(false); return; }
    setTransaction(tx);
    fetchHandlerName(tx.created_by);

    const { data: txItems } = await supabase
      .from("transaction_items" as never)
      .select("id, imei, product_label, selling_price, stock_unit_id, accessory_id")
      .eq("transaction_id", id) as { data: Array<TransactionItem & { stock_unit_id: string }> | null };

    const rawItems = (txItems ?? []) as Array<TransactionItem & { stock_unit_id: string }>;
    if (rawItems.length > 0) {
      const unitIds = rawItems.map(i => i.stock_unit_id).filter(Boolean);
      const accIds = rawItems.map(i => (i as any).accessory_id).filter(Boolean);
      void accIds; // accessory items don't need stock_unit enrichment
      const { data: units } = await supabase
        .from("stock_units" as never)
        .select("id, product_id, master_products(id, warranty_type, series, storage_gb, color, category)")
        .in("id", unitIds as never) as { data: Array<{ id: string; product_id: string; master_products: { id: string; warranty_type: string; series: string; storage_gb: number; color: string; category: string } | null }> | null };

      const WARRANTY_LABELS: Record<string, string> = {
        resmi_bc: "Resmi BC", resmi_ibox: "Resmi iBox", resmi_tam: "Resmi TAM",
        inter: "Inter", refurbished: "Refurbished", non_garansi: "Non Garansi",
      };
      const unitMap = new Map((units ?? []).map(u => [u.id, u]));
      const enriched: TransactionItem[] = rawItems.map(item => {
        if ((item as any).accessory_id) {
          // Accessory item — no stock_unit enrichment needed
          return { ...item, product_photo: null };
        }
        const unit = unitMap.get(item.stock_unit_id);
        const mp = unit?.master_products;
        const wLabel = mp ? WARRANTY_LABELS[mp.warranty_type] || mp.warranty_type : "";
        const fullLabel = mp ? `${mp.series} ${mp.storage_gb}GB ${mp.color} ${wLabel}`.trim() : item.product_label;
        return { ...item, product_label: fullLabel, warranty_label: wLabel, product_photo: null };
      });
      setItems(enriched);

      // Fetch bonus items via bonus_rules (category-based, same as POS)
      const categories = [...new Set((units ?? []).map(u => (u.master_products as any)?.category).filter(Boolean) as string[])];
      if (categories.length > 0) {
        const [{ data: rules }, { data: allBonus }] = await Promise.all([
          supabase.from("bonus_rules" as never)
            .select("bonus_item_id, category")
            .eq("is_active", true as never)
            .in("category", categories as never) as Promise<{ data: Array<{ bonus_item_id: string; category: string }> | null }>,
          supabase.from("bonus_items" as never)
            .select("id, name, icon, track_stock, master_product_id")
            .eq("is_active", true as never) as Promise<{ data: BonusItem[] | null }>,
        ]);
        const bonusMap = new Map((allBonus ?? []).map(b => [b.id, b]));
        // categoryBonuses: category → [BonusItem]
        const catBonusMap: Record<string, BonusItem[]> = {};
        for (const rule of (rules ?? [])) {
          if (!catBonusMap[rule.category]) catBonusMap[rule.category] = [];
          const b = bonusMap.get(rule.bonus_item_id);
          if (b && !catBonusMap[rule.category].find(x => x.id === b.id)) {
            catBonusMap[rule.category].push(b);
          }
        }
        // Map by stock_unit_id
        const unitBonusMap: Record<string, BonusItem[]> = {};
        for (const unit of (units ?? [])) {
          const cat = (unit.master_products as any)?.category;
          if (cat && catBonusMap[cat]) {
            unitBonusMap[unit.id] = catBonusMap[cat];
          }
        }
        setBonusItemsMap(unitBonusMap);
      } else {
        setBonusItemsMap({});
      }

      // Fetch existing bonus claim for this transaction
      const { data: claim } = await supabase
        .from("transaction_bonus_claims" as never)
        .select("id, transaction_id, chosen_bonus_id, review_proof_url, submitted_at")
        .eq("transaction_id", id)
        .maybeSingle() as { data: BonusClaim | null };
      setBonusClaim(claim);
      setBonusClaimUpdated(false);
    } else {
      setItems([]);
      setBonusItemsMap({});
    }

    if (tx.payment_method_id) {
      const { data: pm } = await supabase
        .from("payment_methods" as never)
        .select("id, name, type, bank_name, account_name, account_number, qris_image_url")
        .eq("id", tx.payment_method_id)
        .single() as { data: PaymentMethodDetail | null };
      setPaymentMethod(pm ?? null);
    }

    setLoading(false);
  }, [id]);

  const fetchXenditStatus = useCallback(async (code: string, silent = false) => {
    if (!silent) setLoadingXendit(true);
    else setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xendit-check-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ transactionCode: code, transactionId: id }),
        }
      );
      const json = await res.json();
      if (json.success && json.data) {
        setXenditInvoices(json.data);
        const isPaid = json.data.some((inv: XenditInvoice) => inv.status === "PAID" || inv.status === "SETTLED");
        if (isPaid && transaction?.status === "pending") {
          fetchTransaction();
          setSuccessDialogOpen(true);
        }
      }
    } catch {
      if (!silent) toast({ title: "Gagal memuat status Xendit", variant: "destructive" });
    } finally {
      setLoadingXendit(false);
      setRefreshing(false);
    }
  }, [fetchTransaction, toast]);

  const handleCancel = async () => {
    if (!id) return;
    const finalReason = cancelReason === "Lainnya"
      ? (cancelReasonText.trim() || "Lainnya")
      : cancelReason;
    setCancelling(true);
    try {
      // Void DOKU VA if exists (fire and forget — don't block cancel on failure)
      if ((transaction?.doku_va_number || transaction?.doku_payment_url) && transaction?.transaction_code) {
        try {
          await supabase.functions.invoke("doku-void-checkout", {
            body: {
              invoice_number: transaction.transaction_code,
              transaction_id: id,
            },
          });
        } catch {
          // Intentionally ignored — DOKU void failure should not block cancellation
        }
      }

      const { error } = await supabase
        .from("transactions" as never)
        .update({ status: "cancelled", cancellation_reason: finalReason || null } as never)
        .eq("id", id)
        .in("status", ["pending"] as never);
      if (error) throw error;
      // Release stock by transaction ID (DB trigger handles this too, but run explicitly for immediacy)
      await supabase
        .from("stock_units" as never)
        .update({ stock_status: "available", sold_reference_id: null } as never)
        .eq("sold_reference_id", id as never)
        .eq("stock_status", "reserved" as never);
      // Restore accessory stock for cancelled transaction
      const accessoryItems = items.filter(i => !!(i as any).accessory_id);
      for (const ai of accessoryItems) {
        await (supabase as any).from("accessory_stock_ledger").insert({
          master_product_id: (ai as any).accessory_id,
          transaction_date: new Date().toISOString().split('T')[0],
          qty: 1,
          movement_type: 'adjustment',
          reference_id: id,
          notes: 'Stok dikembalikan karena transaksi dibatalkan',
        });
      }
      toast({ title: "Transaksi dibatalkan & stok dirilis" });
      setCancelReason("");
      setCancelReasonText("");
      fetchTransaction();
    } catch {
      toast({ title: "Gagal membatalkan transaksi", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;
    setConfirming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase
        .from("transactions" as never)
        .update({
          status: "completed",
          confirmed_by: session?.user?.id ?? null,
          confirmed_at: new Date().toISOString(),
        } as never)
        .eq("id", id)
        .eq("status", "pending" as never);
      if (error) throw error;
      if (items.length > 0) {
        const imeis = items.map(i => i.imei);
        await supabase
          .from("stock_units" as never)
          .update({ stock_status: "sold", sold_channel: "pos" } as never)
          .in("imei", imeis as never)
          .eq("stock_status", "reserved" as never);
      }
      setConfirmDialogOpen(false);
      fetchTransaction();
      setSuccessDialogOpen(true);
    } catch {
      toast({ title: "Gagal mengkonfirmasi pembayaran", variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setCropImageSrc(reader.result?.toString() || "");
      setCropModalOpen(true);
    });
    reader.readAsDataURL(file);
    e.target.value = ""; // Reset input
  };

  const executeUploadProof = async (file: File) => {
    if (!id) return;
    setUploadingProof(true);
    try {
      const { uploadFile } = await import("@/lib/upload");
      const uploaded = await uploadFile(file, "proofs");
      await supabase.from("transactions" as never).update({ payment_proof_url: uploaded.url } as never).eq("id", id);
      toast({ title: "Bukti pembayaran berhasil diunggah" });
      fetchTransaction();
    } catch {
      toast({ title: "Gagal mengunggah bukti pembayaran", variant: "destructive" });
    } finally {
      setUploadingProof(false);
    }
  };

  const handleAdminNotified = async (checked: boolean) => {
    if (!id) return;
    setAdminNotified(checked);
    await supabase.from("transactions" as never).update({ admin_notified: checked } as never).eq("id", id);
  };

  // ── Bonus claim submit / update ────────────────────────────────────────────
  const handleSubmitBonusClaim = async () => {
    if (!id || !reviewProofFile) return;
    if (adaptorBonuses.length > 1 && !chosenAdaptorId) {
      toast({ title: "Pilih adaptor dulu", description: "Pilih salah satu jenis adaptor yang diambil customer.", variant: "destructive" });
      return;
    }
    setSubmittingClaim(true);
    try {
      const { uploadFile } = await import("@/lib/upload");
      const uploaded = await uploadFile(reviewProofFile, "proofs");

      const finalBonusId = adaptorBonuses.length === 1
        ? adaptorBonuses[0].id
        : (chosenAdaptorId ?? null);

      if (bonusClaimUpdated && bonusClaim) {
        // UPDATE — ganti bukti / adaptor (1x diperbolehkan)
        const { error: updErr } = await supabase
          .from("transaction_bonus_claims" as never)
          .update({
            chosen_bonus_id: finalBonusId,
            review_proof_url: uploaded.url,
          } as never)
          .eq("id", bonusClaim.id);
        if (updErr) throw new Error(updErr.message);
        toast({ title: "Bukti klaim berhasil diperbarui!" });
      } else {
        // INSERT — klaim pertama kali
        const { error: claimErr } = await supabase
          .from("transaction_bonus_claims" as never)
          .insert({
            transaction_id: id,
            chosen_bonus_id: finalBonusId,
            review_proof_url: uploaded.url,
            submitted_by: user?.id ?? null,
          } as never);
        if (claimErr) throw new Error(claimErr.message);

        if (finalBonusId) {
          const chosenBonus = adaptorBonuses.find(b => b.id === finalBonusId);
          if (chosenBonus?.master_product_id) {
            const { error: ledgerErr } = await supabase.from("accessory_stock_ledger" as never).insert({
              master_product_id: chosenBonus.master_product_id,
              qty: -1,
              movement_type: "bonus_sale",
              reference_id: id,
              notes: `Bonus klaim ulasan Google Maps — transaksi ${transaction?.transaction_code ?? id}`,
              created_by: user?.id ?? null,
              transaction_date: new Date().toISOString().slice(0, 10),
            } as never);
            if (ledgerErr) throw new Error(ledgerErr.message);
          }
        }
        toast({ title: "Klaim bonus berhasil!", description: "Bukti ulasan sudah tersimpan." });
      }

      setReviewProofFile(null);
      setReviewProofPreview(null);
      setBonusClaimUpdated(false);
      await fetchTransaction();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan klaim";
      toast({ title: "Gagal klaim bonus", description: msg, variant: "destructive" });
    } finally {
      setSubmittingClaim(false);
    }
  };

  // ── Fee admin untuk regenerate (VA = Rp4.000, non-VA = 0) ───────────────────
  const regenAdminFee = (() => {
    const name = (transaction?.payment_method_name ?? "").toLowerCase();
    const isVa = ["bca","bni","bri","mandiri","bsi","permata","cimb","danamon","btn","maybank","bnc","sinarmas"].some(k => name.includes(k));
    return isVa ? 4000 : 0;
  })();

  const handleRegenerateDokuLink = async () => {
    if (!transaction || !id) return;
    setRegeneratingDoku(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Map payment_method_name → DOKU paymentMethodTypes
      const methodName = transaction.payment_method_name ?? "";
      const dokuMethodMap: [string, string][] = [
        ["BCA",       "VIRTUAL_ACCOUNT_BCA"],
        ["BNI",       "VIRTUAL_ACCOUNT_BNI"],
        ["BRI",       "VIRTUAL_ACCOUNT_BRI"],
        ["Mandiri",   "VIRTUAL_ACCOUNT_BANK_MANDIRI"],
        ["BSI",       "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI"],
        ["Permata",   "VIRTUAL_ACCOUNT_BANK_PERMATA"],
        ["CIMB",      "VIRTUAL_ACCOUNT_BANK_CIMB"],
        ["Danamon",   "VIRTUAL_ACCOUNT_BANK_DANAMON"],
        ["BTN",       "VIRTUAL_ACCOUNT_BTN"],
        ["Maybank",   "VIRTUAL_ACCOUNT_MAYBANK"],
        ["BNC",       "VIRTUAL_ACCOUNT_BNC"],
        ["Sinarmas",  "VIRTUAL_ACCOUNT_SINARMAS"],
        ["OVO",       "EMONEY_OVO"],
        ["DANA",      "EMONEY_DANA"],
        ["ShopeePay", "EMONEY_SHOPEE_PAY"],
        ["Shopee",    "EMONEY_SHOPEE_PAY"],
        ["LinkAja",   "EMONEY_LINKAJA"],
        ["QRIS",      "QRIS"],
        ["Alfamart",  "ONLINE_TO_OFFLINE_ALFA"],
        ["Indomaret", "ONLINE_TO_OFFLINE_INDOMARET"],
      ];
      const matchedType = dokuMethodMap.find(([key]) => methodName.includes(key))?.[1];
      const paymentMethodTypes = matchedType ? [matchedType] : undefined;

      // total ke DOKU: transaction.total (sudah include fee) atau kurangi fee jika waive
      const dokuTotal = waiveFeeAdminRegen
        ? Math.max(1, transaction.total - regenAdminFee)
        : transaction.total;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doku-create-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            transactionCode: transaction.transaction_code,
            transactionId: id,
            total: dokuTotal,
            customerName: transaction.customer_name || "Customer",
            customerEmail: transaction.customer_email || undefined,
            customerPhone: transaction.customer_phone || undefined,
            items: [
              ...items.map(i => ({ label: i.product_label, price: i.selling_price })),
              ...(!waiveFeeAdminRegen && regenAdminFee > 0
                ? [{ label: "Biaya Admin Pembayaran", price: regenAdminFee }]
                : []),
            ],
            ...(paymentMethodTypes ? { paymentMethodTypes } : {}),
          }),
        },
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal membuat ulang link DOKU");
      const { payment_url, token_id, expired_date, va_number } = json.data;
      await supabase.from("transactions" as never).update({
        doku_payment_url: payment_url ?? null,
        doku_token_id: token_id ?? null,
        doku_expired_date: expired_date ?? null,
        ...(va_number ? { doku_va_number: va_number } : {}),
      } as never).eq("id", id);
      toast({ title: va_number ? "Nomor VA berhasil dibuat ulang!" : "Link DOKU berhasil dibuat ulang!", description: "Aktif selama 3 jam ke depan." });
      fetchTransaction();
    } catch (err: any) {
      toast({ title: "Gagal buat ulang link DOKU", description: err.message, variant: "destructive" });
    } finally {
      setRegeneratingDoku(false);
    }
  };

  // Bank-bank yang mendukung SNAP Direct VA (VA langsung muncul tanpa buka link)
  const SNAP_VA_BANKS: [string, string][] = [
    ["BNI",       "VIRTUAL_ACCOUNT_BNI"],
    ["BSI",       "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI"],
    ["CIMB",      "VIRTUAL_ACCOUNT_BANK_CIMB"],
    ["BRI",       "VIRTUAL_ACCOUNT_BRI"],
    ["BTN",       "VIRTUAL_ACCOUNT_BTN"],
    ["BJB",       "VIRTUAL_ACCOUNT_BJB"],
    ["Sinarmas",  "VIRTUAL_ACCOUNT_SINARMAS"],
    ["Maybank",   "VIRTUAL_ACCOUNT_MAYBANK"],
    ["Danamon",   "VIRTUAL_ACCOUNT_BANK_DANAMON"],
  ];

  const handleCheckDokuStatus = async () => {
    if (!transaction?.transaction_code || !transaction?.id) return;
    setCheckingDokuStatus(true);
    try {
      // Jika transaksi VA tapi belum ada va_number → coba buat VA via SNAP dulu
      const methodName = transaction.payment_method_name ?? "";
      const snapMatch = SNAP_VA_BANKS.find(([key]) => methodName.includes(key));
      if (snapMatch && !transaction.doku_va_number) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doku-create-checkout`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({
              transactionCode: transaction.transaction_code,
              transactionId: transaction.id,
              total: transaction.total,
              customerName: transaction.customer_name || "Customer",
              customerEmail: transaction.customer_email || undefined,
              customerPhone: transaction.customer_phone || undefined,
              items: [{ label: transaction.payment_method_name ?? "Transaksi", price: transaction.total }],
              paymentMethodTypes: [snapMatch[1]],
            }),
          }
        );
        const json = await res.json();
        console.log("[SNAP Retry]", JSON.stringify(json));
        if (json.success && json.data?.va_number) {
          setTransaction(prev => prev ? { ...prev, doku_va_number: json.data.va_number, doku_payment_url: null } : prev);
          toast({ title: "Nomor VA berhasil dibuat!", description: json.data.va_number });
          await fetchTransaction();
          return;
        }
        // SNAP gagal → jatuh ke check-order biasa
        const debugMsg = json._snap_debug ?? json.error ?? "SNAP tidak berhasil";
        console.warn("[SNAP Retry] failed:", debugMsg);
      }

      // Default: cek status pembayaran via doku-check-order
      const { data: funcData, error: funcErr } = await supabase.functions.invoke("doku-check-order", {
        body: { invoiceNumber: transaction.transaction_code, transactionId: transaction.id },
      });
      if (funcErr) throw funcErr;
      setLastDokuCheck(new Date());
      if (funcData?.isPaid) {
        setTransaction(prev => prev ? { ...prev, status: "paid", confirmed_at: new Date().toISOString() } : prev);
        toast({ title: "Pembayaran dikonfirmasi!", description: "Status transaksi diperbarui ke Lunas." });
      } else {
        if (funcData?.va_number) {
          setTransaction(prev => prev ? { ...prev, doku_va_number: funcData.va_number } : prev);
          toast({ title: "Nomor VA berhasil didapatkan!", description: funcData.va_number });
        } else {
          const raw = funcData?.status ?? "PENDING";
          toast({ title: `Status DOKU: ${raw}`, description: "Belum ada pembayaran terkonfirmasi." });
        }
      }
      await fetchTransaction();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal cek status DOKU";
      toast({ title: "Gagal cek status", description: msg, variant: "destructive" });
    } finally {
      setCheckingDokuStatus(false);
    }
  };


  // ── Split Payment Handlers ────────────────────────────────────────────────────

  const handleUploadSplitProof = async (channelIdx: number, file: File) => {
    if (!id || !transaction) return;
    setSplitProofUploading(channelIdx);
    try {
      const { uploadFile } = await import("@/lib/upload");
      const uploaded = await uploadFile(file, "proofs");
      const current = [...(transaction.split_channels ?? [])];
      current[channelIdx] = { ...current[channelIdx], payment_proof_url: uploaded.url };
      await supabase.from("transactions" as never).update({ split_channels: current as never } as never).eq("id", id);
      toast({ title: `Bukti bayar kanal ${channelIdx + 1} berhasil diunggah` });
      fetchTransaction();
    } catch {
      toast({ title: "Gagal mengunggah bukti", variant: "destructive" });
    } finally {
      setSplitProofUploading(null);
    }
  };

  const handleSplitAdminNotified = async (channelIdx: number, checked: boolean) => {
    if (!id || !transaction) return;
    setSplitAdminNotified(prev => ({ ...prev, [channelIdx]: checked }));
    const current = [...(transaction.split_channels ?? [])];
    current[channelIdx] = { ...current[channelIdx], admin_notified: checked };
    await supabase.from("transactions" as never).update({ split_channels: current as never } as never).eq("id", id);
  };

  const handleConfirmSplitChannel = async (channelIdx: number) => {
    if (!id || !transaction) return;
    setSplitConfirming(channelIdx);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const current = [...(transaction.split_channels ?? [])];
      current[channelIdx] = {
        ...current[channelIdx],
        status: "paid",
        confirmed_at: new Date().toISOString(),
        confirmed_by: session?.user?.id ?? null,
      };
      await supabase.from("transactions" as never).update({ split_channels: current as never } as never).eq("id", id);

      const allPaid = current.every(ch => ch.status === "paid");
      if (allPaid) {
        await supabase.from("transactions" as never).update({
          status: "completed",
          confirmed_by: session?.user?.id ?? null,
          confirmed_at: new Date().toISOString(),
        } as never).eq("id", id);
        if (items.length > 0) {
          await supabase.from("stock_units" as never)
            .update({ stock_status: "sold", sold_channel: "pos" } as never)
            .in("imei", items.map(i => i.imei) as never)
            .eq("stock_status", "reserved" as never);
        }
        toast({ title: "Semua kanal sudah lunas! Transaksi selesai." });
        fetchTransaction();
        setSuccessDialogOpen(true);
      } else {
        toast({ title: `Kanal ${channelIdx + 1} dikonfirmasi. Menunggu kanal lainnya.` });
        fetchTransaction();
      }
    } catch {
      toast({ title: "Gagal konfirmasi kanal", variant: "destructive" });
    } finally {
      setSplitConfirming(null);
    }
  };

  const handleCheckSplitDokuStatus = async (channelIdx: number) => {
    if (!transaction?.transaction_code || !id || !transaction) return;
    setCheckingDokuStatus(true);
    try {
      const { data: funcData, error: funcErr } = await supabase.functions.invoke("doku-check-order", {
        body: { invoiceNumber: transaction.transaction_code, transactionId: id },
      });
      if (funcErr) throw funcErr;
      setLastDokuCheck(new Date());
      if (funcData?.isPaid) {
        const { data: { session } } = await supabase.auth.getSession();
        const current = [...(transaction.split_channels ?? [])];
        current[channelIdx] = {
          ...current[channelIdx],
          status: "paid",
          confirmed_at: new Date().toISOString(),
          confirmed_by: session?.user?.id ?? null,
        };
        await supabase.from("transactions" as never).update({ split_channels: current as never } as never).eq("id", id);
        const allPaid = current.every(ch => ch.status === "paid");
        if (allPaid) {
          await supabase.from("transactions" as never).update({
            status: "completed",
            confirmed_by: session?.user?.id ?? null,
            confirmed_at: new Date().toISOString(),
          } as never).eq("id", id);
          if (items.length > 0) {
            await supabase.from("stock_units" as never)
              .update({ stock_status: "sold", sold_channel: "pos" } as never)
              .in("imei", items.map(i => i.imei) as never)
              .eq("stock_status", "reserved" as never);
          }
          toast({ title: "Semua kanal sudah lunas! Transaksi selesai." });
          setSuccessDialogOpen(true);
        } else {
          toast({ title: "Pembayaran DOKU dikonfirmasi!", description: "Menunggu kanal lainnya." });
        }
        fetchTransaction();
      } else {
        if (funcData?.va_number) {
          const current = [...(transaction.split_channels ?? [])];
          current[channelIdx] = { ...current[channelIdx], doku_va_number: funcData.va_number };
          await supabase.from("transactions" as never).update({ split_channels: current as never } as never).eq("id", id);
          toast({ title: "Nomor VA berhasil didapatkan!", description: funcData.va_number });
          fetchTransaction();
        } else {
          toast({ title: `Status DOKU: ${funcData?.status ?? "PENDING"}`, description: "Belum ada pembayaran terkonfirmasi." });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal cek status DOKU";
      toast({ title: "Gagal cek status", description: msg, variant: "destructive" });
    } finally {
      setCheckingDokuStatus(false);
    }
  };

  useEffect(() => { fetchTransaction(); }, [fetchTransaction]);
  useEffect(() => { if (transaction) setAdminNotified(!!transaction.admin_notified); }, [transaction?.id]);

  // Auto-create faktur when transaction becomes paid/completed
  useEffect(() => {
    if (!transaction?.id) return;
    if (transaction.status !== "completed" && transaction.status !== "paid") return;
    if (items.length === 0) return;
    if (autoFakturAttempted.current === transaction.id) return;
    autoFakturAttempted.current = transaction.id;
    createFakturAuto(transaction, items);
  }, [transaction?.id, transaction?.status, items.length, createFakturAuto]);

  const isSplit  = !!transaction?.payment_method_name?.startsWith("Split:");
  const isXendit = !isSplit && !!transaction?.payment_method_name?.toLowerCase().includes("xendit");
  const isDoku   = !isSplit && !!transaction?.payment_method_name?.toLowerCase().includes("doku");

  useEffect(() => {
    if (transaction && isXendit && transaction.transaction_code) fetchXenditStatus(transaction.transaction_code);
  }, [transaction?.id]);

  useEffect(() => {
    if (!transaction?.transaction_code) return;
    if (transaction.status === "completed" || transaction.status === "cancelled") return;
    if (!isXendit) return;
    const interval = setInterval(() => fetchXenditStatus(transaction.transaction_code!, true), 15_000);
    return () => clearInterval(interval);
  }, [transaction?.id, transaction?.status]);

  // Auto-poll for DOKU pending transactions
  // Fast poll every 3s for the first 30s so VA number appears quickly, then slows to 10s
  useEffect(() => {
    if (!id) return;
    if (transaction?.status !== "pending") return;
    if (!isDoku) return;
    if (!transaction?.transaction_code) return;

    const silentPoll = async () => {
      try {
        const { data: funcData } = await supabase.functions.invoke("doku-check-order", {
          body: { invoiceNumber: transaction.transaction_code, transactionId: id },
        });
        if (funcData?.isPaid) {
          setTransaction(prev => prev ? { ...prev, status: "paid", confirmed_at: new Date().toISOString() } : prev);
          toast({ title: "Pembayaran dikonfirmasi!", description: "Status transaksi diperbarui ke Lunas." });
          await fetchTransaction();
          return;
        }
        if (funcData?.va_number && !transaction?.doku_va_number) {
          setTransaction(prev => prev ? { ...prev, doku_va_number: funcData.va_number } : prev);
          setLastDokuCheck(new Date());
          await fetchTransaction();
          return;
        }
      } catch {
        // silent — don't show errors to user for background polling
      }
      fetchTransaction();
    };

    // Immediate poll on mount so VA number shows up as fast as possible
    silentPoll();

    // Fast poll every 3s for first 30s (10 polls), then slow to 10s
    let fastCount = 0;
    const fastInterval = setInterval(() => {
      if (fastCount < 10) { fastCount++; silentPoll(); }
    }, 3_000);
    const slowInterval = setInterval(silentPoll, 10_000);
    return () => { clearInterval(fastInterval); clearInterval(slowInterval); };
  }, [id, transaction?.status, isDoku, transaction?.transaction_code, transaction?.doku_va_number]);

  // Auto-poll for split DOKU channel (channel 0 if type === "doku")
  useEffect(() => {
    if (!id || !isSplit) return;
    if (transaction?.status !== "pending") return;
    if (!transaction?.transaction_code) return;
    const firstCh = transaction.split_channels?.[0];
    if (!firstCh || firstCh.type !== "doku" || firstCh.status === "paid") return;

    const silentPoll = async () => {
      try {
        const { data: funcData } = await supabase.functions.invoke("doku-check-order", {
          body: { invoiceNumber: transaction.transaction_code, transactionId: id },
        });
        if (funcData?.isPaid) {
          const { data: { session } } = await supabase.auth.getSession();
          const current = [...(transaction.split_channels ?? [])];
          current[0] = { ...current[0], status: "paid", confirmed_at: new Date().toISOString(), confirmed_by: session?.user?.id ?? null };
          await supabase.from("transactions" as never).update({ split_channels: current as never } as never).eq("id", id);
          toast({ title: "Pembayaran DOKU dikonfirmasi!" });
          await fetchTransaction();
          return;
        }
        if (funcData?.va_number && !firstCh.doku_va_number) {
          const current = [...(transaction.split_channels ?? [])];
          current[0] = { ...current[0], doku_va_number: funcData.va_number };
          await supabase.from("transactions" as never).update({ split_channels: current as never } as never).eq("id", id);
          await fetchTransaction();
          return;
        }
      } catch { /* silent */ }
    };

    // Immediate poll, then fast every 3s for 30s, then slow 10s
    silentPoll();
    let fastCount = 0;
    const fastInterval = setInterval(() => {
      if (fastCount < 10) { fastCount++; silentPoll(); }
    }, 3_000);
    const slowInterval = setInterval(silentPoll, 10_000);
    return () => { clearInterval(fastInterval); clearInterval(slowInterval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSplit, transaction?.status, transaction?.split_channels?.[0]?.status, transaction?.transaction_code]);

  const isTimeExpired    = transaction ? Date.now() > new Date(transaction.created_at).getTime() + INVOICE_DURATION_MS : false;
  const isXenditExpired  = xenditInvoices.some(inv => inv.status === "EXPIRED");
  const isExpiredTransaction = transaction?.status === "pending" && (isTimeExpired || isXenditExpired);
  const displayStatus    = isExpiredTransaction ? "expired" : (transaction?.status ?? "");
  const isPending        = transaction?.status === "pending";
  const isPaid           = transaction?.status === "paid";
  const isCompleted      = transaction?.status === "completed" || isPaid;
  const isTerminal       = transaction?.status === "cancelled" || transaction?.status === "failed" || isExpiredTransaction;

  // DOKU helpers
  const dokuExpiry       = parseDokuExpiry(transaction?.doku_expired_date ?? null);
  const isDokuNotExpired = dokuExpiry ? dokuExpiry.getTime() > Date.now() : true;
  const isDirectVaTx     = !!transaction?.doku_va_number && !transaction?.doku_payment_url;
  // Active = not cancelled/failed/expired AND (has payment_url OR is a Direct VA with va_number)
  const isDokuLinkActive = !isTerminal && isDokuNotExpired && (
    !!transaction?.doku_payment_url || isDirectVaTx
  );
  const dokuChannelName  = (transaction?.payment_method_name ?? "DOKU").replace(/^doku\s*[-–—]\s*/i, "").trim() || "DOKU";
  const dokuGuide        = getDokuGuide(transaction?.payment_method_name ?? "");

  // Cancellation type detection
  const isCancelledByExpiry = isExpiredTransaction ||
    (transaction?.status === "cancelled" &&
      (transaction?.cancellation_reason?.includes("Batas waktu pembayaran habis") ?? false));
  const cancellationTypeLabel = isCancelledByExpiry ? "Otomatis · Waktu Habis" : "Oleh Admin";
  const cancellationReason = transaction?.cancellation_reason
    ?? (isExpiredTransaction ? DOKU_EXPIRED_REASON : null);

  // Auto-cancel DOKU transaction when link expires → release reserved stock back to available
  useEffect(() => {
    if (!isDoku || !id || transaction?.status !== "pending") return;
    if (!dokuExpiry || dokuExpiry.getTime() > Date.now()) return;

    const autoCancel = async () => {
      const { error: txErr } = await supabase
        .from("transactions" as never)
        .update({ status: "cancelled", cancellation_reason: DOKU_EXPIRED_REASON } as never)
        .eq("id", id as never)
        .eq("status", "pending" as never);
      if (!txErr) {
        await supabase
          .from("stock_units" as never)
          .update({ stock_status: "available", sold_reference_id: null } as never)
          .eq("sold_reference_id", id as never)
          .eq("stock_status", "reserved" as never);
        toast({
          title: "Transaksi dibatalkan otomatis",
          description: "Link pembayaran DOKU sudah kedaluwarsa. Stok unit dikembalikan ke tersedia.",
        });
        fetchTransaction();
      }
    };

    autoCancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDoku, id, transaction?.status, transaction?.doku_expired_date]);

  // Auto-cancel non-DOKU/non-Xendit expired pending transactions
  // (DOKU has its own expiry useEffect above; this covers manual/transfer/COD/split)
  useEffect(() => {
    if (!id || !transaction?.created_at) return;
    if (transaction.status !== "pending") return;
    if (isDoku) return; // handled by the DOKU useEffect above
    const isExpired = Date.now() > new Date(transaction.created_at).getTime() + INVOICE_DURATION_MS;
    if (!isExpired) return;

    const autoCancel = async () => {
      const { error: txErr } = await supabase
        .from("transactions" as never)
        .update({ status: "cancelled", cancellation_reason: DOKU_EXPIRED_REASON } as never)
        .eq("id", id as never)
        .eq("status", "pending" as never);
      if (!txErr) {
        await supabase
          .from("stock_units" as never)
          .update({ stock_status: "available", sold_reference_id: null } as never)
          .eq("sold_reference_id", id as never)
          .eq("stock_status", "reserved" as never);
        fetchTransaction();
      }
    };
    autoCancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, transaction?.status, isDoku, transaction?.created_at]);

  // WA button
  const waPhone = cleanPhone(transaction?.customer_phone ?? null);
  const canSendWa = !!waPhone && !isTerminal && (!!transaction?.doku_payment_url || !!transaction?.doku_va_number);
  const buildWaUrl = () => {
    if (!transaction || !waPhone) return "#";
    const msg = buildWaMessage({
      customerName: transaction.customer_name || "Kakak",
      salesName: handlerName || user?.email || "Sales",
      branchName: transaction.branches?.name || "Ivalora Gadget",
      items,
      total: transaction.total,
      discountAmount: transaction.discount_amount,
      discountCode: transaction.discount_code,
      channelName: dokuChannelName,
      paymentUrl: transaction.doku_payment_url || "",
      vaNumber: transaction.doku_va_number,
      expiryDisplay: formatDokuExpiryDisplay(transaction.doku_expired_date),
    });
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  };

  if (loading) {
    return (
      <DashboardLayout pageTitle="Detail Transaksi">
        <div className="max-w-6xl mx-auto space-y-4 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  if (!transaction) {
    return (
      <DashboardLayout pageTitle="Detail Transaksi">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Transaksi tidak ditemukan.</p>
          <Button variant="outline" onClick={() => navigate("/admin/transaksi")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Riwayat Transaksi
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <TooltipProvider>
      <DashboardLayout pageTitle="Detail Transaksi">
        <div className="max-w-6xl mx-auto space-y-5 pb-10">

          {/* ── Back Button Row ── */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => safeNavigate("/admin/transaksi")}
              className="h-8 w-8 p-0 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground font-medium">Riwayat Transaksi</span>
          </div>

          {/* ── Main Content Card ── */}
          <div className="bg-card border border-border rounded-2xl">

          {/* Card Header — TRX info + actions */}
          <div className="sticky top-16 z-20 bg-card rounded-t-2xl px-5 py-4 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-foreground leading-tight">
                    {transaction.transaction_code ?? "Detail Transaksi"}
                  </h1>
                  {items.length > 0 && (
                    <span className="text-sm font-medium text-muted-foreground">
                      ({items.length} item)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Dibuat: {formatDateTime(transaction.created_at)}
                  </span>
                  {transaction.confirmed_at && (
                    <span className="flex items-center gap-1.5 mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Pembayaran Berhasil · {formatDateTime(transaction.confirmed_at)}
                    </span>
                  )}
                  {transaction.branches?.name && (
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-muted-foreground">·</span>
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-bold text-foreground">{transaction.branches.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right-side action buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <StatusBadge status={displayStatus} />
              {isPending && !isXendit && !isDoku && !isSplit && !isExpiredTransaction && (
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  disabled={!transaction.payment_proof_url || !adminNotified}
                  onClick={() => setConfirmDialogOpen(true)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Konfirmasi
                </Button>
              )}
              {isPending && !isExpiredTransaction && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5"
                  disabled={cancelling}
                  onClick={() => setCancelDialogOpen(true)}
                >
                  {cancelling ? (
                    <div className="w-3.5 h-3.5 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                  ) : (
                    <Ban className="w-3.5 h-3.5" />
                  )}
                  Batalkan
                </Button>
              )}
              {isCompleted && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={async () => {
                    const { data: existing } = await supabase
                      .from("invoices" as never)
                      .select("id")
                      .eq("transaction_id", id as string)
                      .maybeSingle();
                    if (existing) {
                      navigate(`/admin/penjualan/faktur/${(existing as any).id}`);
                    } else {
                      try {
                        const branchId = transaction.branch_id;
                        const { data: branch } = await supabase.from("branches").select("code").eq("id", branchId).single();
                        const { data: settings } = await supabase.from("invoice_settings" as never).select("*").eq("branch_id", branchId).maybeSingle() as { data: any };
                        const prefix = settings?.number_prefix || "INV";
                        const resetMode = settings?.sequence_reset || "monthly";
                        const dueDays = settings?.default_due_days ?? 0;
                        const numFormat = settings?.number_format || "branch_code";
                        const branchCode = numFormat === "custom" ? (settings?.custom_code || "") : (branch as any)?.code || "XX";
                        const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number" as never, {
                          _branch_id: branchId, _branch_code: branchCode, _prefix: prefix, _reset_mode: resetMode,
                          _include_code: numFormat !== "none", _include_date: settings?.use_date_reset ?? true,
                        } as never);
                        const dueDate = dueDays > 0 ? new Date(Date.now() + dueDays * 86400000).toISOString() : null;
                        let hName = null;
                        if (transaction.created_by) {
                          const { data: profile } = await supabase.from("user_profiles" as never).select("full_name, email").eq("id", transaction.created_by).single() as { data: any };
                          hName = profile?.full_name || profile?.email || null;
                        }
                        const { data: newInv, error } = await supabase.from("invoices" as never).insert({
                          invoice_number: invoiceNumber as unknown as string, transaction_id: id, branch_id: branchId,
                          status: "published", customer_name: transaction.customer_name, customer_email: transaction.customer_email,
                          customer_phone: transaction.customer_phone, subtotal: transaction.subtotal, discount_amount: transaction.discount_amount,
                          discount_code: transaction.discount_code, shipping_cost: transaction.shipping_cost ?? 0,
                          shipping_discount: transaction.shipping_discount ?? 0, packing_kayu_cost: transaction.packing_kayu_cost ?? 0,
                          total: transaction.total, amount_paid: transaction.total, balance_due: 0,
                          payment_method_name: transaction.payment_method_name, payment_status: "paid",
                          items_snapshot: items.map(i => ({ product_label: i.product_label, imei: i.imei, qty: 1, selling_price: i.selling_price })),
                          invoice_date: new Date().toISOString(), due_date: dueDate, paid_at: transaction.confirmed_at,
                          handled_by_name: hName, channel: "pos", terms_snapshot: settings?.terms_json ?? null,
                          created_by: (await supabase.auth.getSession()).data.session?.user.id ?? null,
                        } as never).select("id").single() as { data: any; error: any };
                        if (error) throw error;
                        toast({ title: "Faktur berhasil dibuat" });
                        navigate(`/admin/penjualan/faktur/${newInv.id}`);
                      } catch (err: any) {
                        toast({ title: "Gagal membuat faktur: " + (err.message || ""), variant: "destructive" });
                      }
                    }
                  }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Lihat Faktur
                </Button>
              )}
              </div>
            </div>

            {/* Cancelled/failed/expired notice — di dalam card header */}
            {isTerminal && (
              <div className="mt-3 rounded-xl bg-destructive/5 border border-destructive/20 overflow-hidden">
                {/* Baris 1: status + badge tipe + logo + deskripsi */}
                <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <p className="text-sm font-bold text-destructive leading-tight">
                    Transaksi {STATUS_CONFIG[displayStatus]?.label ?? "Dibatalkan"}
                  </p>
                  {/* Payment channel logo/name */}
                  {transaction.payment_method_name && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background border border-destructive/20">
                      <PaymentMethodBadge pmName={transaction.payment_method_name} />
                    </span>
                  )}
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    isCancelledByExpiry
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                      : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                  )}>
                    {cancellationTypeLabel}
                  </span>
                  <p className="text-sm text-foreground font-medium leading-tight">
                    {isDoku
                      ? "Pembayaran dinonaktifkan · Stok dikembalikan ke tersedia"
                      : isXendit
                      ? `Invoice Xendit mungkin masih aktif${xenditInvoices[0]?.expiry_date ? ` · exp ${formatExpiry(xenditInvoices[0].expiry_date)}` : ""}`
                      : "Stok unit dikembalikan ke tersedia"}
                  </p>
                </div>

                {/* Baris 2: alasan — bg putih */}
                <div className="border-t border-destructive/15 bg-background px-3 py-2.5 flex items-baseline gap-2">
                  <p className="shrink-0 text-sm font-semibold text-foreground">Alasan Pembatalan:</p>
                  <p className="text-sm text-foreground">
                    {cancellationReason ?? "Tidak ada catatan alasan."}
                  </p>
                </div>
              </div>
            )}
          </div>{/* end card header */}

          <div className="p-5 space-y-6 rounded-b-2xl overflow-hidden">

          {/* ── Data Customer ── */}
          <Section title="Data Customer">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-3 text-foreground/70 font-semibold whitespace-nowrap w-[130px] sm:w-[150px]">Tipe Customer</td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {transaction.customer_user_id ? "Akun Terdaftar" : "Tanpa Akun"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground/70 font-semibold whitespace-nowrap">Nama</td>
                    <td className="px-4 py-3 font-bold text-foreground">{transaction.customer_name || "—"}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground/70 font-semibold whitespace-nowrap">Alamat Email</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{transaction.customer_email || "Tidak ada"}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground/70 font-semibold whitespace-nowrap">Nomor Telepon</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{transaction.customer_phone || "Tidak ada"}</td>
                  </tr>
                  {handlerName && (
                    <tr>
                      <td className="px-4 py-3 text-foreground/70 font-semibold whitespace-nowrap">Dihandle oleh</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{handlerName}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── Daftar Item Pesanan ── */}
          <Section title={`Daftar Item Pesanan (${items.length})`}>
            {items.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                Tidak ada item
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {items.map(item => {
                  const isAccessory = !!(item as any).accessory_id;
                  const bonuses = !isAccessory && item.stock_unit_id ? (bonusItemsMap[item.stock_unit_id] ?? []) : [];
                  return (
                    <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden w-full sm:w-[360px] flex flex-col">
                      {/* Main product row */}
                      <div className="flex gap-3 p-4">
                        {/* Product photo */}
                        <div className="shrink-0 w-20 h-24 rounded-lg overflow-hidden bg-muted border border-border/50 flex items-center justify-center">
                          {isAccessory ? (
                            <Package className="w-8 h-8 text-muted-foreground/50" />
                          ) : item.product_photo ? (
                            <img
                              src={item.product_photo}
                              alt={item.product_label}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground text-center px-1">No photo</span>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex flex-col justify-between min-w-0 flex-1">
                          <div>
                            <p className="text-base font-bold text-foreground leading-snug truncate" title={item.product_label}>
                              {item.product_label}
                            </p>

                            {!isAccessory && item.imei && (
                              <div
                                className="flex items-center gap-1.5 mt-1.5 rounded-md border border-border bg-muted/60 px-2 py-1 cursor-pointer group w-fit hover:bg-muted transition-colors"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.imei);
                                  toast({ title: "IMEI disalin!", description: item.imei });
                                }}
                                title="Klik untuk menyalin IMEI"
                              >
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">IMEI</span>
                                <span className="font-mono text-xs font-medium text-foreground group-hover:text-primary transition-colors select-all tracking-wide truncate">
                                  {item.imei}
                                </span>
                              </div>
                            )}

                            {isAccessory && (
                              <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200 dark:border-violet-800 uppercase tracking-tight">
                                Aksesoris
                              </span>
                            )}

                            {!isAccessory && item.warranty_label && (
                              <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-tight">
                                {item.warranty_label}
                              </span>
                            )}
                          </div>
                          <p className="text-lg font-bold text-foreground tabular-nums mt-2">{formatCurrency(item.selling_price)}</p>
                        </div>
                      </div>

                      {/* Bonus items — horizontal scroll scroll (like POS) */}
                      {bonuses.length > 0 && (
                        <div className="pb-3 pt-0 border-t border-border/40 bg-emerald-50/30 dark:bg-emerald-950/10">
                          <button
                            type="button"
                            onClick={() => setExpandedBonuses(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-emerald-100/50 transition-colors"
                          >
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                              🎁 Ada Bonus
                            </span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-emerald-600 transition-transform", expandedBonuses[item.id] && "rotate-180")} />
                          </button>
                          
                          {expandedBonuses[item.id] && (
                            <div className="flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide animate-in fade-in slide-in-from-top-1 duration-200">
                              {bonuses.map((bonus) => (
                                <div key={bonus.id} className="flex flex-col items-center shrink-0 w-16 gap-1">
                                  <div className="w-16 h-16 rounded-xl bg-background border border-border overflow-hidden flex items-center justify-center shadow-sm">
                                    {bonus.icon ? (
                                      <img src={bonus.icon} alt={bonus.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xl">🎁</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-semibold text-center text-foreground leading-tight line-clamp-2 w-full">
                                    {bonus.name}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── Klaim Bonus Google Maps Review ── */}
          {allBonusItems.length > 0 && isCompleted && (
            <Section title="Klaim Bonus — Ulasan Google Maps">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setBonusSectionExpanded(!bonusSectionExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors border-b border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <PartyPopper className={cn("w-4 h-4", bonusClaim ? "text-emerald-500" : "text-amber-500")} />
                    <span className="text-sm font-bold text-foreground">
                      {bonusClaim ? "Bonus Berhasil Diklaim" : "Klaim Bonus Tersedia"}
                    </span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", bonusSectionExpanded && "rotate-180")} />
                </button>

                {bonusSectionExpanded && (
                  <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    {bonusClaim ? (
                      /* ── Sudah diklaim — dengan opsi re-upload 1x ── */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                Bonus sudah diklaim
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(bonusClaim.submitted_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Selesai</span>
                        </div>

                        {bonusClaim.chosen_bonus_id && (() => {
                          const chosen = adaptorBonuses.find(b => b.id === bonusClaim.chosen_bonus_id);
                          return chosen ? (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                              {chosen.icon && <img src={chosen.icon} alt={chosen.name} className="w-9 h-9 object-contain rounded-md border border-border/40 bg-white shrink-0" />}
                              <div>
                                <p className="text-xs text-muted-foreground">Adaptor dipilih</p>
                                <p className="text-sm font-bold text-foreground">{chosen.name}</p>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Lihat bukti toggle */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setBonusPopupExpanded(!bonusPopupExpanded)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {bonusPopupExpanded ? "Sembunyikan Bukti" : "Lihat Bukti Ulasan"}
                          </button>

                          {bonusPopupExpanded && (
                            <div className="animate-in fade-in zoom-in-95 duration-200">
                              <img
                                src={resolveUploadUrl(bonusClaim.review_proof_url)}
                                alt="Bukti ulasan"
                                className="max-h-72 w-auto rounded-lg border border-border shadow-sm cursor-pointer hover:opacity-95"
                                onClick={() => setPreviewImageUrl(resolveUploadUrl(bonusClaim.review_proof_url))}
                              />
                              <p className="text-[10px] text-muted-foreground italic mt-1.5">Klik gambar untuk melihat preview di halaman ini.</p>
                            </div>
                          )}
                        </div>

                        {/* Re-upload 1x */}
                        {!bonusClaimUpdated && (
                          <button
                            type="button"
                            onClick={() => setBonusClaimUpdated(true)}
                            className="w-full py-2 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Ganti Bonus ( Salah Pilih )
                          </button>
                        )}
                        {bonusClaimUpdated && (
                          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Mode Edit — Ganti Bonus (salah pilih adaptor)</p>
                            </div>
                            {adaptorBonuses.length > 1 && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Pilih adaptor yang diambil customer</p>
                                <div className="flex flex-wrap gap-2">
                                  {adaptorBonuses.map(b => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => setChosenAdaptorId(b.id)}
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                                        chosenAdaptorId === b.id
                                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                                          : "border-border bg-white dark:bg-background text-foreground hover:bg-muted"
                                      )}
                                    >
                                      {b.icon && <img src={b.icon} alt={b.name} className="w-5 h-5 object-contain rounded bg-white border border-border/30" />}
                                      {b.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Upload ulang bukti ulasan</p>
                              {reviewProofPreview ? (
                                <div className="relative inline-block">
                                  <img src={reviewProofPreview} alt="Preview" className="max-h-40 rounded-lg border border-border object-contain" />
                                  <button
                                    type="button"
                                    onClick={() => { setReviewProofFile(null); setReviewProofPreview(null); }}
                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
                                  >×</button>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-dashed border-amber-300 dark:border-amber-700 bg-white dark:bg-background cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors">
                                  <Upload className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Klik untuk upload ulang bukti</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      setReviewProofFile(f);
                                      setReviewProofPreview(URL.createObjectURL(f));
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setBonusClaimUpdated(false); setReviewProofFile(null); setReviewProofPreview(null); }}>
                                Batal
                              </Button>
                              <Button size="sm" className="flex-1 text-xs gap-1.5" disabled={!reviewProofFile || (adaptorBonuses.length > 1 && !chosenAdaptorId) || submittingClaim} onClick={handleSubmitBonusClaim}>
                                {submittingClaim ? <><RefreshCw className="w-3 h-3 animate-spin" /> Menyimpan…</> : <><CheckCircle2 className="w-3 h-3" /> Simpan Perubahan</>}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── Form klaim ── */
                      <div className="space-y-4">
                        {/* Instruksi */}
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 space-y-1.5">
                          <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Cara klaim bonus</p>
                          <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-decimal list-inside">
                            <li>Beri ulasan bintang 5 di Google Maps toko kami</li>
                            <li>Screenshot bukti ulasan yang sudah dikirim</li>
                            <li>Upload foto bukti di sini &amp; pilih adaptor</li>
                          </ol>
                          <a
                            href="https://share.google/rAy2aPnEz0FW3Q8UP"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 underline underline-offset-2 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Buka halaman ulasan Google Maps
                          </a>
                        </div>

                        {/* Adaptor picker — hanya jika ada >1 pilihan */}
                        {adaptorBonuses.length > 1 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-foreground uppercase tracking-wide">Pilih adaptor yang diambil customer</p>
                            <div className="flex flex-wrap gap-2">
                              {adaptorBonuses.map(b => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => setChosenAdaptorId(b.id)}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all",
                                    chosenAdaptorId === b.id
                                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                                      : "border-border bg-muted/40 text-foreground hover:bg-muted"
                                  )}
                                >
                                  {b.icon && <img src={b.icon} alt={b.name} className="w-7 h-7 object-contain rounded bg-white border border-border/30" />}
                                  {b.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {adaptorBonuses.length === 1 && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border">
                            {adaptorBonuses[0].icon && <img src={adaptorBonuses[0].icon} alt={adaptorBonuses[0].name} className="w-9 h-9 object-contain rounded-md border border-border/40 bg-white shrink-0" />}
                            <div>
                              <p className="text-xs text-muted-foreground">Adaptor bonus</p>
                              <p className="text-sm font-bold text-foreground">{adaptorBonuses[0].name}</p>
                            </div>
                          </div>
                        )}

                        {/* Upload foto bukti */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Foto bukti ulasan</p>
                          {reviewProofPreview ? (
                            <div className="relative inline-block">
                              <img src={reviewProofPreview} alt="Preview" className="max-h-40 rounded-lg border border-border object-contain" />
                              <button
                                type="button"
                                onClick={() => { setReviewProofFile(null); setReviewProofPreview(null); }}
                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
                              >×</button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors">
                              <Upload className="w-6 h-6 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground font-medium">Klik untuk upload foto bukti ulasan</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  setReviewProofFile(f);
                                  setReviewProofPreview(URL.createObjectURL(f));
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Submit */}
                        <button
                          type="button"
                          disabled={!reviewProofFile || (adaptorBonuses.length > 1 && !chosenAdaptorId) || submittingClaim}
                          onClick={handleSubmitBonusClaim}
                          className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {submittingClaim ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan…</>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4" /> Klaim Bonus</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── Nilai Transaksi ── */}
          <Section title="Nilai Transaksi">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Subtotal ({items.length} item)</span>
                <span className="tabular-nums font-bold text-foreground">{formatCurrency(transaction.subtotal)}</span>
              </div>
              {transaction.discount_amount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    Diskon{transaction.discount_code ? ` (${transaction.discount_code})` : ""}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 tabular-nums font-bold">
                    -{formatCurrency(transaction.discount_amount)}
                  </span>
                </div>
              )}
              {(transaction.shipping_cost ?? 0) > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground/70">Ongkos Kirim{transaction.shipping_courier ? ` (${transaction.shipping_courier}${transaction.shipping_service ? ` - ${transaction.shipping_service}` : ""})` : ""}</span>
                  <span className="tabular-nums font-bold text-foreground">{formatCurrency(transaction.shipping_cost!)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                  Tidak ada pengiriman (ambil langsung di toko)
                </div>
              )}
              {(transaction.shipping_discount ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-green-600 dark:text-green-400">Diskon Ongkir</span>
                  <span className="text-green-600 dark:text-green-400 tabular-nums font-bold">-{formatCurrency(transaction.shipping_discount!)}</span>
                </div>
              )}
              {(transaction.packing_kayu_cost ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground/70">Packing Kayu</span>
                  <span className="tabular-nums font-bold text-foreground">{formatCurrency(transaction.packing_kayu_cost)}</span>
                </div>
              )}
              {(() => {
                // For split: sum fee per channel that is charged (include_fee=true)
                // For non-split: derive from total - subtotal accounting
                const adminFee = isSplit
                  ? (transaction.split_channels ?? []).reduce((sum, ch) => sum + (ch.include_fee ? (ch.fee ?? 0) : 0), 0)
                  : transaction.total
                    - (transaction.subtotal ?? 0)
                    + (transaction.discount_amount ?? 0)
                    - (transaction.shipping_cost ?? 0)
                    + (transaction.shipping_discount ?? 0)
                    - (transaction.packing_kayu_cost ?? 0);
                if (!adminFee || adminFee <= 0) return null;
                return (
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground/70">Biaya Admin Pembayaran</span>
                    <span className="tabular-nums font-bold text-foreground">+{formatCurrency(adminFee)}</span>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <span className="text-base font-bold text-foreground">Total Bayar</span>
                  {transaction.discount_amount > 0 ? (
                    <span className="ml-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      (setelah diskon)
                    </span>
                  ) : (
                    <span className="ml-1.5 text-xs font-semibold text-red-500 dark:text-red-400">
                      (tanpa diskon)
                    </span>
                  )}
                </div>
                <span className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(transaction.total)}</span>
              </div>
              {transaction.discount_amount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground/60">Harga asli (tanpa diskon)</span>
                  <span className="tabular-nums font-semibold text-foreground/60 line-through">
                    {formatCurrency(transaction.total + transaction.discount_amount)}
                  </span>
                </div>
              )}
            </div>
          </Section>

          {/* ── Split Payment Section ── */}
          {isSplit && (
            <Section title="Metode Pembayaran (Split)">
              <div className="space-y-4">

                {/* ── FALLBACK: split_channels not yet available (migration not run / old transaction) ── */}
                {(!transaction.split_channels || transaction.split_channels.length === 0) ? (
                  (() => {
                    // Parse channel names from "Split: CH1 | CH2 | CH3" format
                    const raw = (transaction.payment_method_name ?? "").replace(/^Split:\s*/i, "");
                    const parts = raw.split(/\s*\|\s*/).filter(Boolean);
                    return (
                      <div className="space-y-3">
                        {/* Channel names parsed from payment_method_name */}
                        {parts.map((part, idx) => {
                          const nominalMatch = part.match(/Rp([\d.,]+)/);
                          const nomStr = nominalMatch ? nominalMatch[1].replace(/\./g, "") : null;
                          const nominal = nomStr ? parseInt(nomStr, 10) : null;
                          const methodName = part.replace(/\s*Rp[\d.,]+.*/, "").replace(/\s*\+fee.*/i, "").replace(/^doku\s*[-–—]\s*/i, "").trim();
                          return (
                            <div key={idx} className="rounded-xl border border-border overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-b border-border">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    Kanal {idx + 1}
                                  </span>
                                  <PaymentChannelLogo pmName={methodName || part} />
                                </div>
                                {nominal !== null && nominal > 0 && (
                                  <span className="text-sm font-bold text-foreground tabular-nums shrink-0">{formatCurrency(nominal)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : (
                <>
                {/* Summary row */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Rincian Pembayaran</p>
                  {transaction.split_channels.map((ch, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">K{idx + 1}</span>
                        <span className="font-semibold text-foreground">{shortChannelName(ch.method_name ?? ch.method_key ?? "—")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-foreground">{formatCurrency(ch.nominal)}</span>
                        {ch.status === "paid"
                          ? <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />Lunas</span>
                          : <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Pending</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Each channel card */}
                {(transaction.split_channels ?? []).map((ch, idx) => {
                  const prevPaid = idx === 0 || (transaction.split_channels?.[idx - 1]?.status === "paid");
                  const isChPaid = ch.status === "paid";
                  const isDokuCh = ch.type === "doku";
                  const chDokuExpiry = parseDokuExpiry(ch.doku_expired_date ?? null);
                  const isChDokuNotExpired = chDokuExpiry ? chDokuExpiry.getTime() > Date.now() : true;
                  const isChDokuLinkActive = !isTerminal && !isChPaid && isChDokuNotExpired && (!!ch.doku_payment_url || !!ch.doku_va_number);
                  const chGuide = getDokuGuide(ch.method_name ?? "");
                  const chAdminNotified = splitAdminNotified[idx] ?? ch.admin_notified ?? false;

                  return (
                    <div key={idx} className={cn(
                      "rounded-xl border overflow-hidden",
                      isChPaid ? "border-emerald-500/30"
                        : !prevPaid ? "border-border/50 opacity-60"
                        : "border-border"
                    )}>
                      {/* Channel header */}
                      <div className={cn(
                        "flex items-center justify-between px-4 py-3 border-b",
                        isChPaid ? "bg-emerald-500/10 border-emerald-500/20"
                          : !prevPaid ? "bg-muted/40 border-border/50"
                          : "bg-muted/20 border-border"
                      )}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            Kanal {idx + 1}
                          </span>
                          <span className="text-sm font-bold text-foreground">{shortChannelName(ch.method_name ?? ch.method_key ?? "—")}</span>
                          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                            {formatCurrency(ch.nominal)}
                          </span>
                        </div>
                        {isChPaid ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Lunas
                          </span>
                        ) : !prevPaid ? (
                          <span className="text-xs font-semibold text-muted-foreground shrink-0">Terkunci</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            <Clock className="w-3.5 h-3.5" /> Menunggu
                          </span>
                        )}
                      </div>

                      {/* Channel body */}
                      <div className="p-4 space-y-3">

                        {/* Locked state */}
                        {!prevPaid && (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            Menunggu Kanal {idx} selesai dibayar terlebih dahulu
                          </div>
                        )}

                        {/* DOKU channel */}
                        {prevPaid && !isChPaid && isDokuCh && (
                          <>
                            {!ch.doku_va_number && !ch.doku_payment_url && !ch.doku_expired_date && (
                              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 space-y-1">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Data pembayaran belum tersedia</p>
                                <p className="text-xs text-amber-600/80 dark:text-amber-500/80">Link DOKU belum terbentuk.</p>
                              </div>
                            )}

                            <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                            <div className="flex items-stretch">
                              <div className="flex items-center gap-3 px-4 py-4 shrink-0">
                                <PaymentChannelLogo pmName={ch.method_name ?? "DOKU"} />
                              </div>
                              <div className="w-px self-stretch bg-primary/15 shrink-0" />
                              <div className="flex flex-col justify-center gap-1.5 px-4 py-4 flex-1 min-w-0">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Nomor Virtual Account</p>
                                {isTerminal ? (
                                  <p className="text-sm text-muted-foreground italic">Informasi pembayaran dinonaktifkan karena transaksi batal.</p>
                                ) : ch.doku_va_number ? (
                                  <>
                                    <p className="text-lg md:text-xl lg:text-2xl font-bold text-foreground tabular-nums tracking-wider leading-tight break-all">{ch.doku_va_number}</p>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(ch.doku_va_number!); toast({ title: "Nomor VA disalin!", description: ch.doku_va_number! }); }}
                                      className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                                    >
                                      <Copy className="w-3.5 h-3.5" /> Salin
                                    </button>
                                  </>
                                ) : ch.doku_payment_url ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1.5">
                                      <RefreshCw className="w-3 h-3 animate-spin text-primary shrink-0" />
                                      <p className="text-xs text-muted-foreground">Sedang menunggu VA… Minta pembeli buka link agar VA terbentuk.</p>
                                    </div>
                                    <button
                                      onClick={() => handleCheckSplitDokuStatus(idx)}
                                      disabled={checkingDokuStatus}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                                    >
                                      <RefreshCw className={cn("w-3 h-3", checkingDokuStatus && "animate-spin")} />
                                      {checkingDokuStatus ? "Mengecek..." : "Cek Nomor VA"}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">Menunggu…</p>
                                )}
                              </div>
                              <div className="hidden lg:block w-px self-stretch bg-primary/15 shrink-0" />
                              <div className="hidden lg:flex flex-col items-end justify-center px-4 py-4 shrink-0">
                                <DokuCountdown expiryDate={ch.doku_expired_date ?? null} inline />
                              </div>
                            </div>
                            {/* Countdown mobile/tablet */}
                            <div className="lg:hidden border-t border-primary/15 px-4 py-3 flex justify-center">
                              <DokuCountdown expiryDate={ch.doku_expired_date ?? null} inline />
                            </div>
                            </div>

                            {ch.doku_payment_url && (
                              <a
                                href={isChDokuLinkActive ? ch.doku_payment_url : "#"}
                                target={isChDokuLinkActive ? "_blank" : undefined}
                                rel="noopener noreferrer"
                                onClick={!isChDokuLinkActive ? e => e.preventDefault() : undefined}
                                className={cn(
                                  "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold border-2 transition-colors",
                                  isChDokuLinkActive
                                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50 pointer-events-none"
                                )}
                              >
                                <ExternalLink className="w-4 h-4" /> Buka Halaman Pembayaran
                              </a>
                            )}

                            <HowToPaySection guide={chGuide} />

                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button className="flex-1 gap-2" disabled={checkingDokuStatus} onClick={() => handleCheckSplitDokuStatus(idx)}>
                                <RefreshCw className={cn("w-4 h-4", checkingDokuStatus && "animate-spin")} />
                                {checkingDokuStatus ? "Memeriksa..." : "Cek Status Pembayaran"}
                              </Button>
                              {waPhone && (
                                <a
                                  href={`https://wa.me/${waPhone}?text=${encodeURIComponent(buildWaMessage({ customerName: transaction.customer_name || "Kakak", salesName: handlerName || user?.email || "Sales", branchName: transaction.branches?.name || "Ivalora Gadget", items, total: ch.nominal + ch.fee, discountAmount: 0, discountCode: null, channelName: ch.method_name ?? "DOKU", paymentUrl: ch.doku_payment_url || "", vaNumber: ch.doku_va_number, expiryDisplay: formatDokuExpiryDisplay(ch.doku_expired_date), }))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#25D366] hover:bg-[#1ebe5d] text-white transition-colors"
                                >
                                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                  Kirim Info ke WA
                                </a>
                              )}
                            </div>
                            <p className="text-xs font-bold text-orange-500 dark:text-orange-400 text-center">
                              {lastDokuCheck ? `⟳ Terakhir dicek: ${format(lastDokuCheck, "HH:mm:ss", { locale: localeId })} WIB` : "⟳ Status diperbarui otomatis setiap 10 detik"}
                            </p>
                          </>
                        )}

                        {/* Manual channel */}
                        {prevPaid && !isChPaid && !isDokuCh && (
                          <>
                            <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-primary/5 border border-primary/10">
                              <span className="text-sm font-semibold text-foreground/70">{ch.method_name ?? "Pembayaran Manual"}</span>
                              <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(ch.nominal + ch.fee)}</span>
                            </div>

                            {ch.payment_proof_url && (
                              <div className="space-y-1">
                                <img src={resolveUploadUrl(ch.payment_proof_url)} alt="Bukti bayar" className="w-full max-w-xs rounded-lg border border-border cursor-pointer"
                                  onClick={() => window.open(resolveUploadUrl(ch.payment_proof_url), "_blank")} />
                                <p className="text-[10px] text-muted-foreground">Klik gambar untuk melihat ukuran penuh</p>
                              </div>
                            )}

                            {isPending && (
                              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition-colors">
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadSplitProof(idx, f); }}
                                  disabled={splitProofUploading === idx} />
                                {splitProofUploading === idx
                                  ? <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                                  : <Upload className="w-4 h-4 text-muted-foreground" />}
                                <span className="text-xs text-muted-foreground">
                                  {ch.payment_proof_url ? "Ganti bukti pembayaran" : "Unggah bukti pembayaran kanal ini"}
                                </span>
                              </label>
                            )}

                            {isPending && (
                              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                                <Checkbox
                                  id={`split-notified-${idx}`}
                                  checked={chAdminNotified}
                                  onCheckedChange={checked => handleSplitAdminNotified(idx, !!checked)}
                                  className="mt-0.5"
                                />
                                <label htmlFor={`split-notified-${idx}`} className="text-xs text-foreground leading-relaxed cursor-pointer">
                                  Sudah memberitahu admin bahwa kanal {idx + 1} ({ch.method_name ?? "manual"}) telah dibayar
                                </label>
                              </div>
                            )}

                            {isPending && (
                              <Button
                                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                                disabled={!ch.payment_proof_url || !chAdminNotified || splitConfirming === idx}
                                onClick={() => handleConfirmSplitChannel(idx)}
                              >
                                {splitConfirming === idx
                                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                                  : <CheckCircle2 className="w-4 h-4" />}
                                Konfirmasi Pembayaran Kanal {idx + 1}
                              </Button>
                            )}
                          </>
                        )}

                        {/* Paid state */}
                        {isChPaid && (
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <p className="text-sm font-semibold">
                              Kanal {idx + 1} sudah lunas{ch.confirmed_at ? ` · ${formatDateTime(ch.confirmed_at)}` : ""}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </>
                )}
              </div>
            </Section>
          )}

          {/* ── DOKU Payment Section ── */}
          {isDoku && (
            <Section title="Metode Pembayaran">
              <div className="space-y-4">
                  {/* ── COMPLETED: success banner ── */}
                  {isCompleted && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Pembayaran Berhasil!</p>
                        <p className="text-xs font-medium text-foreground/70 mt-0.5">Transaksi telah dikonfirmasi dan diselesaikan.</p>
                      </div>
                      <span className="text-base font-bold text-foreground tabular-nums shrink-0">{formatCurrency(transaction.total)}</span>
                    </div>
                  )}

                  {/* ONE card — Logo | VA Number | Countdown (always shown, countdown hidden when completed/terminal) */}
                  <div className={cn(
                    "flex items-stretch rounded-xl border overflow-hidden",
                    isCompleted ? "border-emerald-500/30 bg-emerald-500/5"
                      : isTerminal ? "border-border bg-muted/30"
                      : "border-primary/20 bg-primary/5"
                  )}>
                    {/* Kolom 1: Logo + bank name */}
                    <div className="flex items-center gap-3 px-4 py-4 shrink-0">
                      <PaymentChannelLogo pmName={transaction.payment_method_name ?? "DOKU"} />
                    </div>

                    {/* Divider */}
                    <div className={cn("w-px self-stretch shrink-0", isTerminal ? "bg-border" : isCompleted ? "bg-emerald-500/20" : "bg-primary/15")} />

                    {/* Kolom 2: Nomor VA */}
                    <div className="flex flex-col justify-center gap-1.5 px-4 py-4 flex-1 min-w-0">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Nomor Virtual Account</p>
                      {isTerminal ? (
                        <p className="text-sm text-muted-foreground italic">Informasi pembayaran dinonaktifkan karena transaksi batal.</p>
                      ) : transaction.doku_va_number ? (
                        <>
                          <p className="text-lg md:text-xl lg:text-2xl font-bold text-foreground tabular-nums tracking-wider leading-tight break-all">{transaction.doku_va_number}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(transaction.doku_va_number!);
                              toast({ title: "Nomor VA disalin!", description: transaction.doku_va_number! });
                            }}
                            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Salin
                          </button>
                        </>
                      ) : transaction.doku_payment_url ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <RefreshCw className="w-3 h-3 animate-spin text-primary shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed">Sedang menunggu nomor VA… Minta pembeli buka link pembayaran agar VA langsung terbentuk.</p>
                          </div>
                          {!isTerminal && (
                            <button
                              onClick={handleCheckDokuStatus}
                              disabled={checkingDokuStatus}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={cn("w-3 h-3", checkingDokuStatus && "animate-spin")} />
                              {checkingDokuStatus ? "Mengecek..." : "Cek Nomor VA Sekarang"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Menunggu…</p>
                      )}
                    </div>

                    {/* Divider + Countdown — desktop only (lg+) */}
                    {!isCompleted && !isTerminal && (
                      <>
                        <div className="hidden lg:block w-px self-stretch bg-primary/15 shrink-0" />
                        <div className="hidden lg:flex flex-col items-end justify-center px-4 py-4 shrink-0">
                          <DokuCountdown expiryDate={transaction.doku_expired_date} inline />
                        </div>
                      </>
                    )}
                  </div>
                  {/* Countdown — mobile/tablet (< lg) */}
                  {!isCompleted && !isTerminal && (
                    <div className="lg:hidden border-t border-primary/15 px-4 py-3 flex justify-center">
                      <DokuCountdown expiryDate={transaction.doku_expired_date} inline />
                    </div>
                  )}

                  {/* Pending-only section: "data belum tersedia" warning + payment URL + tutorial + action buttons */}
                  {!isCompleted && (
                  <>
                  {!isTerminal && (
                  <>

                  {/* Jika data pembayaran belum terbentuk sama sekali */}
                  {!transaction.doku_va_number && !transaction.doku_payment_url && !transaction.doku_expired_date && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                        </svg>
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Sedang memproses link pembayaran...</p>
                      </div>
                      <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
                        Halaman akan diperbarui otomatis. Jika lebih dari 2 menit belum muncul, gunakan tombol "Cek Status DOKU" di bawah.
                      </p>
                    </div>
                  )}

                  {/* Tombol Buka Halaman Pembayaran */}
                  {transaction.doku_payment_url && (
                    <a
                      href={isDokuLinkActive ? transaction.doku_payment_url : "#"}
                      target={isDokuLinkActive ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      onClick={!isDokuLinkActive ? (e) => e.preventDefault() : undefined}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold border-2 transition-colors",
                        isDokuLinkActive
                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50 pointer-events-none"
                      )}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Buka Halaman Pembayaran
                    </a>
                  )}

                  {/* Tutorial cara bayar */}
                  <HowToPaySection guide={getDokuGuide(transaction.payment_method_name ?? "")} />

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Cek Status Pembayaran */}
                    <Button
                      className="flex-1 gap-2"
                      disabled={checkingDokuStatus}
                      onClick={handleCheckDokuStatus}
                    >
                      <RefreshCw className={cn("w-4 h-4", checkingDokuStatus && "animate-spin")} />
                      {checkingDokuStatus ? "Memeriksa..." : "Cek Status Pembayaran"}
                    </Button>

                    {/* Kirim ke WA */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={canSendWa ? buildWaUrl() : "#"}
                          target={canSendWa ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          onClick={!canSendWa ? (e) => e.preventDefault() : undefined}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors",
                            canSendWa
                              ? "bg-[#25D366] hover:bg-[#1ebe5d] text-white"
                              : "bg-muted text-muted-foreground cursor-not-allowed opacity-50 pointer-events-none",
                          )}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Kirim Info ke WA
                        </a>
                      </TooltipTrigger>
                      {!canSendWa && (
                        <TooltipContent side="top" className="text-xs max-w-xs">
                          {!waPhone
                            ? "Nomor WhatsApp customer tidak tersedia"
                            : isTerminal
                              ? "Transaksi sudah tidak aktif"
                              : "Link pembayaran tidak tersedia"}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>

                  {/* Auto-refresh indicator */}
                  <p className="text-xs font-bold text-orange-500 dark:text-orange-400 text-center">
                    {lastDokuCheck
                      ? `⟳ Terakhir dicek: ${format(lastDokuCheck, "HH:mm:ss", { locale: localeId })} WIB`
                      : "⟳ Status diperbarui otomatis setiap 10 detik"}
                  </p>

                  </>
                  )}

                  </>
                  )}

              </div>
            </Section>
          )}

          {/* ── Xendit Panel ── */}
          {isXendit && (
            <Section title="Metode Pembayaran">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    Xendit Payment Gateway
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 gap-1 text-xs"
                    disabled={refreshing || loadingXendit}
                    onClick={() => transaction.transaction_code && fetchXenditStatus(transaction.transaction_code, true)}
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                    Refresh
                  </Button>
                </div>


                {transaction.status !== "cancelled" && (
                  <>
                    {loadingXendit ? (
                      <div className="h-36 bg-muted rounded-xl animate-pulse" />
                    ) : xenditInvoices.length === 0 ? (
                      <div className="p-4 rounded-xl border border-border bg-muted/40 text-center">
                        <p className="text-xs text-muted-foreground">Data Xendit belum tersedia atau gagal dimuat.</p>
                        <Button variant="ghost" size="sm" className="mt-2 text-xs h-7"
                          onClick={() => transaction.transaction_code && fetchXenditStatus(transaction.transaction_code)}>
                          Coba Lagi
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {xenditInvoices.map((inv) => <XenditPaymentCard key={inv.id} inv={inv} />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Section>
          )}

          {/* ── Manual Payment ── */}
          {!isXendit && !isDoku && !isSplit && (
            <Section title="Metode Pembayaran">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/10">
                  <PaymentChannelLogo pmName={transaction.payment_method_name ?? "Pembayaran Manual"} />
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-muted/40 rounded-xl p-4 space-y-3 text-sm border border-border">
                    {paymentMethod?.bank_name && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground/70">Bank</span>
                        <span className="font-bold text-foreground text-base">{paymentMethod.bank_name}</span>
                      </div>
                    )}
                    {paymentMethod?.account_number && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground/70">No. Rekening</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground font-mono text-lg tracking-wider">{paymentMethod.account_number}</span>
                          <CopyButton text={paymentMethod.account_number} />
                        </div>
                      </div>
                    )}
                    {paymentMethod?.account_name && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground/70">Atas Nama</span>
                        <span className="font-bold text-foreground text-base">{paymentMethod.account_name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
                      <span className="font-medium text-foreground/70">Jumlah Transfer</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-primary text-lg tabular-nums">{formatCurrency(transaction.total)}</span>
                        <CopyButton text={transaction.total.toString()} />
                      </div>
                    </div>
                  </div>

                  {paymentMethod?.type === "bank_transfer" && (
                    <p className="text-xs font-medium text-foreground/60 text-center mt-2">Pastikan nominal transfer sesuai hingga digit terakhir agar pembayaran dapat diverifikasi.</p>
                  )}

                  {paymentMethod?.type === "other" && paymentMethod.qris_image_url && (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider text-center">Scan QR Code untuk Pembayaran</p>
                      <div className="flex justify-center p-4 bg-white rounded-xl border border-border">
                        <img src={paymentMethod.qris_image_url} alt="QRIS" className="max-w-[240px] w-full h-auto rounded" />
                      </div>
                    </div>
                  )}

                  {!paymentMethod && (
                    <p className="text-xs text-muted-foreground text-center">Detail metode pembayaran tidak tersedia.</p>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* ── Payment Proof (Manual only) ── */}
          {!isXendit && !isDoku && !isSplit && (
            <Section title="Bukti Pembayaran">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setProofExpanded(!proofExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors border-b border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">
                      {transaction.payment_proof_url ? "Bukti Pembayaran Tersedia" : "Belum Ada Bukti Pembayaran"}
                    </span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", proofExpanded && "rotate-180")} />
                </button>

                {proofExpanded && (
                  <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    {transaction.payment_proof_url ? (
                      <div className="space-y-3">
                        <div className="relative group max-w-xs">
                          <img
                            src={resolveUploadUrl(transaction.payment_proof_url)}
                            alt="Bukti pembayaran"
                            className="w-full rounded-xl border border-border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setPreviewImageUrl(resolveUploadUrl(transaction.payment_proof_url!))}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                              <ExternalLink className="w-3.5 h-3.5" />
                              Lihat Ukuran Penuh
                            </div>
                          </div>
                        </div>
                        
                        {isPending && (
                          <div className="flex flex-col gap-2">
                            <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 cursor-pointer transition-colors w-fit">
                              <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} disabled={uploadingProof} />
                              {uploadingProof ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                              Ganti Bukti Pembayaran
                            </label>
                            <p className="text-[10px] text-muted-foreground italic">Klik gambar untuk melihat ukuran penuh atau tombol di atas untuk mengganti bukti.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      isPending && (
                        <label
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-zinc-200/50"); }}
                          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-zinc-200/50"); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove("border-primary", "bg-zinc-200/50");
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                              handleUploadProof(mockEvent);
                            }
                          }}
                          className="flex flex-col items-center justify-center gap-3 w-full py-8 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 hover:border-primary/50 hover:bg-zinc-200/50 cursor-pointer transition-all"
                        >
                          <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} disabled={uploadingProof} />
                          {uploadingProof ? (
                            <RefreshCw className="w-8 h-8 animate-spin text-zinc-500" />
                          ) : (
                            <Upload className="w-8 h-8 text-zinc-500 mb-1" />
                          )}
                          <span className="text-sm font-bold text-zinc-800 text-center px-4">
                            Tarik & Lepas (Drag & Drop) gambar ke sini
                          </span>
                          <span className="text-xs text-zinc-500 font-medium">atau klik untuk menelusuri file</span>
                        </label>
                      )
                    )}

                    {!transaction.payment_proof_url && !isPending && (
                      <p className="text-xs text-muted-foreground italic">Tidak ada bukti pembayaran yang diunggah.</p>
                    )}

                    {isPending && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-100 border border-zinc-200 shadow-sm">
                        <Checkbox
                          id="admin-notified"
                          checked={adminNotified}
                          onCheckedChange={(checked) => handleAdminNotified(!!checked)}
                          className="mt-0.5 border-zinc-400 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                        <label htmlFor="admin-notified" className="text-sm font-bold text-zinc-800 leading-relaxed cursor-pointer select-none">
                          Sudah memberitahu admin bahwa ada transaksi pembayaran manual di store dan sudah dikabari masuk pembayarannya
                        </label>
                      </div>
                    )}

                    {!isPending && transaction.admin_notified && (
                      <div className="flex items-center gap-2 text-[11px] text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Admin sudah diberitahu tentang pembayaran ini</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── Notes ── */}
          {transaction.notes && (
            <div className="bg-muted/40 border border-border rounded-xl p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Catatan</p>
              <p className="text-xs text-foreground">{transaction.notes}</p>
            </div>
          )}

          </div>{/* end p-5 space-y-6 */}
          </div>{/* end main content card */}
        </div>

        {/* ── Bonus-not-claimed navigation warning ── */}
        <AlertDialog open={navWarningOpen} onOpenChange={setNavWarningOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bonus belum diklaim!</AlertDialogTitle>
              <AlertDialogDescription className="text-foreground">
                Customer belum mengambil bonus adaptor charger. Pastikan bonus sudah dipilih dan foto bukti ulasan sudah diunggah sebelum meninggalkan halaman ini.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setNavWarningOpen(false)}>Tetap di sini</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { setNavWarningOpen(false); navigate(pendingNavTarget ?? "/admin/transaksi"); }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Keluar tanpa klaim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Cancel Dialog ── */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) { setCancelReason(""); setCancelReasonText(""); }
        }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Batalkan Transaksi?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Transaksi <span className="font-semibold text-foreground">{transaction?.transaction_code}</span> akan dibatalkan dan stok unit dikembalikan ke tersedia.
                  </p>

                  {/* Reason selection */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Alasan pembatalan</p>
                    <div className="space-y-1.5">
                      {["Ganti unit lain", "Customer tidak jadi beli", "Stok rusak / cacat", "Salah input data", "Lainnya"].map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setCancelReason(reason)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-colors",
                            cancelReason === reason
                              ? "border-destructive bg-destructive/5 text-destructive font-medium"
                              : "border-border hover:bg-muted/50 text-foreground",
                          )}
                        >
                          <span className={cn(
                            "w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
                            cancelReason === reason ? "border-destructive" : "border-muted-foreground",
                          )}>
                            {cancelReason === reason && (
                              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                            )}
                          </span>
                          {reason}
                        </button>
                      ))}
                    </div>
                    {cancelReason === "Lainnya" && (
                      <Textarea
                        className="text-sm mt-1"
                        placeholder="Tuliskan alasan pembatalan..."
                        rows={3}
                        value={cancelReasonText}
                        onChange={(e) => setCancelReasonText(e.target.value)}
                      />
                    )}
                  </div>

                  {isDoku && isDokuLinkActive && (
                    <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
                      <span className="shrink-0">⚠️</span>
                      <div className="space-y-1">
                        <p className="font-semibold">
                          {isDirectVaTx ? `VA ${dokuChannelName} akan di-void di DOKU` : `Link Checkout DOKU masih aktif`}
                        </p>
                        <p>
                          {isDirectVaTx
                            ? `Nomor VA ${dokuChannelName} akan langsung dinonaktifkan di DOKU saat dibatalkan.`
                            : `Transaksi ini menggunakan Checkout DOKU — link pembayaran tidak bisa dibatalkan via API dan tetap aktif hingga kedaluwarsa${dokuExpiry ? ` (${formatDokuExpiryDisplay(transaction?.doku_expired_date ?? null)})` : " ~3 jam"}. Jika customer sempat bayar, refund manual dari dashboard DOKU.`
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Kembali</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => { setCancelDialogOpen(false); await handleCancel(); }}
                disabled={cancelling || !cancelReason}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {cancelling ? "Membatalkan..." : "Ya, Batalkan"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Confirm Dialog ── */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Pembayaran?</AlertDialogTitle>
              <AlertDialogDescription className="text-foreground">
                Pembayaran untuk transaksi <span className="font-semibold">{transaction?.transaction_code}</span> sebesar{" "}
                <span className="font-semibold">{formatCurrency(transaction.total)}</span> akan dikonfirmasi.
                Status transaksi akan berubah menjadi <span className="font-semibold">Selesai</span> dan stok unit akan ditandai sebagai terjual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={confirming}>Kembali</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={confirming} className="bg-green-600 text-white hover:bg-green-700">
                {confirming ? "Mengkonfirmasi..." : "Ya, Konfirmasi"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Success Dialog ── */}
        <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <PartyPopper className="w-5 h-5" />
                Transaksi Berhasil! 🎉
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs text-muted-foreground py-2 font-medium">ID Transaksi</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground py-2">{transaction?.transaction_code ?? "—"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs text-muted-foreground py-2 font-medium">Tanggal</TableCell>
                      <TableCell className="text-xs text-foreground py-2">{transaction ? formatDateTime(transaction.created_at) : "—"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs text-muted-foreground py-2 font-medium">Total</TableCell>
                      <TableCell className="text-xs font-bold text-foreground py-2">{formatCurrency(transaction?.total ?? 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs text-muted-foreground py-2 font-medium">Dihandle oleh</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground py-2">{handlerName ?? user?.email ?? "—"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs text-muted-foreground py-2 font-medium">Cabang</TableCell>
                      <TableCell className="text-xs text-foreground py-2">{transaction?.branches?.name ?? "—"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* ── Bonus section (collapsible) ── */}
              {allBonusItems.length > 0 && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBonusPopupExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">🎁 Bonus untuk Customer</span>
                    <ChevronDown className={cn("w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-transform", bonusPopupExpanded && "rotate-180")} />
                  </button>
                  {bonusPopupExpanded && (
                    <div className="p-3 space-y-3 bg-card">
                      {allBonusItems.filter(b => !b.track_stock).length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Customer dapat semua ini:</p>
                          <div className="flex flex-wrap gap-2">
                            {allBonusItems.filter(b => !b.track_stock).map(b => (
                              <div key={b.id} className="flex flex-col items-center gap-1 w-[52px]">
                                <div className="w-[52px] h-[52px] rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800 bg-muted flex items-center justify-center">
                                  {b.icon ? <img src={b.icon} alt={b.name} className="w-full h-full object-cover" /> : <span className="text-lg">🎁</span>}
                                </div>
                                <p className="text-[9px] font-semibold text-center leading-tight line-clamp-2 text-foreground">{b.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {adaptorBonuses.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">Pilih 1 dari pilihan berikut:</p>
                          <div className="flex flex-wrap gap-2">
                            {adaptorBonuses.map(b => (
                              <div key={b.id} className="flex flex-col items-center gap-1 w-[52px]">
                                <div className="w-[52px] h-[52px] rounded-xl overflow-hidden border-2 border-amber-400 dark:border-amber-500 bg-muted flex items-center justify-center relative">
                                  {b.icon ? <img src={b.icon} alt={b.name} className="w-full h-full object-cover" /> : <span className="text-lg">🎁</span>}
                                  <span className="absolute bottom-0 inset-x-0 text-center text-[8px] font-black bg-amber-400/90 text-white py-px leading-none">PILIH 1</span>
                                </div>
                                <p className="text-[9px] font-semibold text-center leading-tight line-clamp-2 text-foreground">{b.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Upload bukti pembayaran (manual payment only) ── */}
              {!isXendit && !isDoku && !isSplit && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-foreground">Bukti Pembayaran</p>
                  {transaction?.payment_proof_url ? (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30">
                      <img
                        src={resolveUploadUrl(transaction.payment_proof_url)}
                        alt="Bukti"
                        className="w-14 h-14 rounded-lg object-cover border border-border shrink-0 cursor-pointer"
                        onClick={() => window.open(resolveUploadUrl(transaction.payment_proof_url!), "_blank")}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">Bukti sudah diupload ✓</p>
                        <p className="text-[10px] text-muted-foreground">Klik gambar untuk lihat penuh</p>
                      </div>
                      <label className="shrink-0 cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} disabled={uploadingProof} />
                        <span className="text-xs text-primary font-semibold hover:underline">Ganti</span>
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors">
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} disabled={uploadingProof} />
                      {uploadingProof
                        ? <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                        : <Upload className="w-5 h-5 text-muted-foreground" />
                      }
                      <span className="text-xs text-muted-foreground font-medium">Upload bukti pembayaran</span>
                    </label>
                  )}
                </div>
              )}

              {/* ── Checklist & Google Maps CTA ── */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Checklist Setelah Transaksi</p>
                <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border overflow-hidden text-[11px]">
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="text-base">😊</span>
                    <span className="text-foreground font-medium">Ucapkan terima kasih &amp; tunjukkan senyum terbaik</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="text-base">🎁</span>
                    <span className="text-foreground font-medium">
                      {allBonusItems.length > 0 ? "Berikan bonus sesuai pilihan di atas" : "Berikan bonus: Tumbler/Glass, Tas, Casing gratis"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="text-base">📸</span>
                    <span className="text-foreground font-medium">Minta customer foto testimoni bersama produk</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="text-base">⭐</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground font-medium">Minta rating di Google Maps — </span>
                      <span className="text-foreground font-semibold">{transaction?.branches?.name ?? "ini"}</span>
                    </div>
                  </div>
                </div>

                {transaction?.branches?.google_maps_url && (
                  <a
                    href={transaction.branches.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-colors"
                  >
                    <img src="/images/google-maps.png" alt="Google Maps" className="w-4 h-4 object-contain" />
                    <span className="text-xs font-bold text-red-700 dark:text-red-300">Buka Google Maps — {transaction.branches.name}</span>
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" className="flex-1 gap-1.5"
                  onClick={() => { setSuccessDialogOpen(false); navigate(`/admin/transaksi/${id}/invoice`); }}
                >
                  <FileText className="w-3.5 h-3.5" /> Lihat Invoice
                </Button>
                <Button size="sm" className="flex-1 gap-1.5" onClick={() => setSuccessDialogOpen(false)}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ImageCropModal
          isOpen={cropModalOpen}
          onOpenChange={setCropModalOpen}
          imageSrc={cropImageSrc}
          onCropComplete={executeUploadProof}
          aspect={9 / 16}
        />

        {/* ── Image Preview Dialog (Lightbox) ── */}
        <Dialog open={!!previewImageUrl} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none">
            <DialogHeader className="hidden">
              <DialogTitle>Preview Gambar</DialogTitle>
            </DialogHeader>
            <div className="relative group">
              <img
                src={previewImageUrl || ""}
                alt="Preview"
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-black/60 text-white hover:bg-black/80 border-none backdrop-blur-md font-bold"
                  onClick={() => previewImageUrl && window.open(previewImageUrl, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" /> Buka Ukuran Penuh
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-md font-bold"
                  onClick={() => setPreviewImageUrl(null)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </TooltipProvider>
  );
}
