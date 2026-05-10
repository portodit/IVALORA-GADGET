import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Clock, XCircle, RefreshCw,
  Smartphone, CreditCard, Zap, ExternalLink, Building2,
  Copy, Package, Loader2, MapPin, Truck, ShoppingBag,
  AlertTriangle, ShoppingCart, Tag, MessageCircle,
  CircleDot, ChevronRight,
} from "lucide-react";
import { supabaseCustomer } from "@/integrations/supabase/customer-client";
import { useCustomerAuth } from "@/contexts/customer/CustomerAuthContext";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/shared/use-toast";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/shared/LocaleContext";

const USD_RATE = 15500;

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
  payment_method_name: string | null;
  discount_code: string | null;
  created_at: string;
  shipping_cost: number | null;
  shipping_courier: string | null;
  shipping_service: string | null;
  shipping_etd: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_district: string | null;
  shipping_postal_code: string | null;
  shipping_discount: number | null;
  packing_kayu_cost: number;
  tracking_number: string | null;
  confirmed_at: string | null;
}

interface TransactionItem {
  id: string;
  imei: string;
  product_label: string;
  selling_price: number;
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  pending: { label: "Menunggu Pembayaran", color: "text-amber-600", icon: Clock, bg: "bg-amber-50 border-amber-200" },
  expired: { label: "Kedaluwarsa", color: "text-destructive", icon: XCircle, bg: "bg-destructive/5 border-destructive/20" },
  completed: { label: "Selesai", color: "text-green-600", icon: CheckCircle2, bg: "bg-green-50 border-green-200" },
  cancelled: { label: "Dibatalkan", color: "text-destructive", icon: XCircle, bg: "bg-destructive/5 border-destructive/20" },
  failed: { label: "Gagal", color: "text-destructive", icon: XCircle, bg: "bg-destructive/5 border-destructive/20" },
  refunded: { label: "Dikembalikan", color: "text-muted-foreground", icon: RefreshCw, bg: "bg-muted/40 border-muted" },
  paid: { label: "Pembayaran Diterima", color: "text-blue-600", icon: CheckCircle2, bg: "bg-blue-50 border-blue-200" },
  shipped: { label: "Dikirim", color: "text-indigo-600", icon: Truck, bg: "bg-indigo-50 border-indigo-200" },
  delivered: { label: "Diterima", color: "text-green-600", icon: Package, bg: "bg-green-50 border-green-200" },
};

const XENDIT_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Menunggu Pembayaran", color: "text-amber-600" },
  PAID: { label: "Sudah Dibayar", color: "text-green-600" },
  SETTLED: { label: "Sudah Dibayar", color: "text-green-600" },
  EXPIRED: { label: "Kadaluarsa", color: "text-destructive" },
};

// Tracking URLs per courier
const TRACKING_URLS: Record<string, string> = {
  JNE: "https://www.jne.co.id/id/tracking/trace",
  "J&T": "https://www.jet.co.id/track",
  JNT: "https://www.jet.co.id/track",
  SICEPAT: "https://www.sicepat.com/checkAwb",
  NINJA: "https://www.ninjavan.co/id-id/tracking",
  LION: "https://www.lionparcel.com/tracking",
  POS: "https://www.posindonesia.co.id/id/tracking",
  TIKI: "https://www.tiki.id/id/tracking",
  ANTERAJA: "https://anteraja.id/tracking",
  IDE: "https://www.idexpress.com/id/tracking",
  SAP: "https://www.sap-express.id/tracking",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatExpiry(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
  }) + " WIB";
}

export default function CustomerTransaksiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useCustomerAuth();
  const { currency } = useLocale();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [xenditInvoices, setXenditInvoices] = useState<XenditInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flashSaleActive, setFlashSaleActive] = useState(false);
  const [activeDiscounts, setActiveDiscounts] = useState<{ code: string; name: string; discount_percent: number | null }[]>([]);

  const formatPrice = (n: number) => {
    if (currency === "USD") return "$" + (n / USD_RATE).toLocaleString("en-US", { maximumFractionDigits: 0 });
    return "Rp" + n.toLocaleString("id-ID");
  };

  const fetchTransaction = useCallback(async () => {
    if (!id || !user) return;
    const { data: tx } = await supabaseCustomer
      .from("transactions")
      .select("*")
      .eq("id", id)
      .eq("customer_user_id", user.id)
      .single();

    if (!tx) { setLoading(false); return; }
    setTransaction(tx as unknown as Transaction);

    const { data: txItems } = await supabaseCustomer
      .from("transaction_items")
      .select("id, imei, product_label, selling_price")
      .eq("transaction_id", id);
    setItems((txItems as TransactionItem[]) ?? []);

    setLoading(false);
  }, [id, user]);

  const fetchXenditStatus = useCallback(async (code: string) => {
    setRefreshing(true);
    try {
      const session = (await supabaseCustomer.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xendit-check-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ transactionCode: code, transactionId: id }),
        }
      );
      const json = await res.json();
      if (json.success && json.data) {
        setXenditInvoices(json.data);
        const isPaid = json.data.some((inv: XenditInvoice) => inv.status === "PAID" || inv.status === "SETTLED");
        if (isPaid && transaction?.status === "pending") {
          fetchTransaction();
        }
      }
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [fetchTransaction, transaction?.status, id]);

  useEffect(() => { fetchTransaction(); }, [fetchTransaction]);

  useEffect(() => {
    if (transaction?.transaction_code && transaction.status === "pending") {
      fetchXenditStatus(transaction.transaction_code);
    }
  }, [transaction?.transaction_code, transaction?.status]);

  useEffect(() => {
    (async () => {
      const { data: fsRows } = await supabaseCustomer.rpc("get_active_flash_sale_info" as never);
      if (fsRows && (fsRows as any[]).length > 0) {
        const fs = (fsRows as any[])[0];
        const end = new Date(new Date(fs.start_time).getTime() + fs.duration_hours * 3600000);
        if (fs.is_active && end.getTime() > Date.now()) setFlashSaleActive(true);
      }
      const { data: discounts } = await supabaseCustomer
        .from("discount_codes")
        .select("code, name, discount_percent")
        .eq("is_active", true)
        .gte("valid_until", new Date().toISOString())
        .limit(3);
      if (discounts) setActiveDiscounts(discounts as any[]);
    })();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?redirect=/riwayat", { replace: true });
  }, [user, authLoading, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavbar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavbar />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Transaksi tidak ditemukan</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/riwayat")}>
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  // Check if payment has expired
  const INVOICE_DURATION_SECONDS = 10800;
  const paymentDeadline = new Date(transaction.created_at).getTime() + INVOICE_DURATION_SECONDS * 1000;
  const isTimeExpired = Date.now() > paymentDeadline;
  const isXenditExpired = xenditInvoices.some(inv => inv.status === "EXPIRED");
  const isExpiredTransaction = transaction.status === "pending" && (isTimeExpired || isXenditExpired);
  const isPaid = ["completed", "paid", "shipped", "delivered"].includes(transaction.status) ||
    xenditInvoices.some(inv => inv.status === "PAID" || inv.status === "SETTLED");

  const statusKey = isExpiredTransaction ? "expired" : transaction.status;
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const shippingCost = transaction.shipping_cost ?? 0;
  const shippingDiscount = transaction.shipping_discount ?? 0;
  const packingKayuCost = transaction.packing_kayu_cost ?? 0;

  // Order progress steps
  const orderSteps = [
    {
      key: "paid",
      label: "Pembayaran Diterima",
      description: "Pembayaran sudah diterima. Pesanan sedang dipersiapkan oleh admin untuk dipacking dan diserahkan ke kurir.",
      done: isPaid,
      active: isPaid && !transaction.tracking_number,
    },
    {
      key: "shipped",
      label: "Dikirim",
      description: transaction.tracking_number
        ? `Pesanan telah dikirim via ${transaction.shipping_courier || "kurir"}.`
        : "Menunggu admin mengirim pesanan.",
      done: !!transaction.tracking_number,
      active: !!transaction.tracking_number && transaction.status !== "completed" && transaction.status !== "delivered",
    },
    {
      key: "delivered",
      label: "Pesanan Diterima",
      description: transaction.status === "completed" || transaction.status === "delivered"
        ? "Pesanan telah diterima. Terima kasih telah berbelanja!"
        : "Menunggu konfirmasi penerimaan pesanan.",
      done: transaction.status === "completed" || transaction.status === "delivered",
      active: false,
    },
  ];

  const courierKey = (transaction.shipping_courier || "").toUpperCase();
  const trackingUrl = TRACKING_URLS[courierKey];

  // Contact admin WhatsApp draft
  function handleContactAdmin() {
    const itemList = items.map(i => `- ${i.product_label}`).join("\n");
    const msg = `Halo admin, saya ingin bertanya mengenai pesanan saya:\n\nNo. Pesanan: ${transaction!.transaction_code}\nTanggal: ${formatDateTime(transaction!.created_at)}\nItem:\n${itemList}\nTotal: ${formatPrice(transaction!.total)}\n\nPertanyaan: `;
    // Open WhatsApp with pre-filled message (fallback to generic)
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/riwayat")} className="p-2 rounded-lg hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{transaction.transaction_code || "Detail Transaksi"}</h1>
            <p className="text-xs text-muted-foreground">{formatDateTime(transaction.created_at)}</p>
          </div>
          <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold", statusCfg.bg, statusCfg.color)}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusCfg.label}
          </div>
        </div>

        <div className="space-y-4">
          {/* Xendit Payment */}
          {xenditInvoices.length > 0 && transaction.status === "pending" && (
            <div className="space-y-3">
              {xenditInvoices.map((inv) => {
                const invPaid = inv.status === "PAID" || inv.status === "SETTLED";
                const invExpired = inv.status === "EXPIRED";
                const xenditStatus = XENDIT_STATUS[inv.status] ?? XENDIT_STATUS.PENDING;
                return (
                  <div key={inv.id} className={cn(
                    "rounded-xl border p-4 space-y-3",
                    invPaid ? "border-green-200 bg-green-50/50" : invExpired ? "border-destructive/20 bg-destructive/5" : "border-primary/20 bg-primary/5"
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {inv.payment_method ? `${inv.payment_method} - ${inv.payment_channel || ""}` : "Xendit Payment"}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{inv.id}</p>
                      </div>
                      <span className={cn("text-[11px] font-semibold", xenditStatus.color)}>{xenditStatus.label}</span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-y border-border/50">
                      <span className="text-xs text-muted-foreground">Jumlah Tagihan</span>
                      <span className="text-sm font-bold text-foreground">{formatPrice(inv.amount)}</span>
                    </div>

                    {inv.invoice_url && !invPaid && !invExpired && (
                      <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Buka Halaman Pembayaran
                      </a>
                    )}

                    {!invPaid && !invExpired && inv.expiry_date && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>Bayar sebelum: <span className="font-semibold">{formatExpiry(inv.expiry_date)}</span></span>
                      </div>
                    )}

                    {invPaid && inv.paid_at && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <p className="text-xs">Dibayar {formatDateTime(inv.paid_at)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fetchXenditStatus(transaction.transaction_code!)} disabled={refreshing}>
                <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                Cek Status Pembayaran
              </Button>
            </div>
          )}

          {/* Expired Transaction Info Section */}
          {isExpiredTransaction && (
            <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Waktu Pembayaran Habis</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Batas waktu pembayaran untuk transaksi ini telah berakhir. Transaksi otomatis dianggap <span className="font-semibold text-destructive">kedaluwarsa</span> dan unit yang dipesan akan dikembalikan ke stok.
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground mb-3">💡 Langkah Selanjutnya</p>
                <div className="space-y-2">
                  <button onClick={() => navigate("/katalog")} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left">
                    <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">Cari Unit Lain di Katalog</p>
                      <p className="text-[10px] text-muted-foreground">Telusuri katalog untuk menemukan unit lain yang tersedia</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </button>
                  {flashSaleActive && (
                    <button onClick={() => navigate("/katalog?filter=flash_sale")} className="w-full flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100/50 transition-colors text-left">
                      <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">⚡ Flash Sale Sedang Berlangsung!</p>
                        <p className="text-[10px] text-muted-foreground">Dapatkan harga spesial flash sale sebelum waktu habis</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    </button>
                  )}
                  {activeDiscounts.length > 0 && (
                    <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        <p className="text-xs font-semibold text-foreground">Kode Diskon Aktif</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeDiscounts.map(d => (
                          <span key={d.code} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-[10px] font-bold text-foreground border border-border">
                            🎟️ {d.code}
                            {d.discount_percent && <span className="text-muted-foreground">({d.discount_percent}%)</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Order Progress (shown after payment) ── */}
          {isPaid && !isExpiredTransaction && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4" /> Progress Pesanan
              </p>
              <div className="space-y-0">
                {orderSteps.map((s, i) => (
                  <div key={s.key} className="flex gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2",
                        s.done ? "bg-green-100 border-green-500" :
                        s.active ? "bg-blue-100 border-blue-500 animate-pulse" :
                        "bg-muted border-border"
                      )}>
                        {s.done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        ) : s.active ? (
                          <CircleDot className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <CircleDot className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      {i < orderSteps.length - 1 && (
                        <div className={cn("w-0.5 h-full min-h-[32px]", s.done ? "bg-green-300" : "bg-border")} />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-4 flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", s.done ? "text-green-700" : s.active ? "text-blue-700" : "text-muted-foreground")}>
                        {s.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>

                      {/* Tracking number for shipped step */}
                      {s.key === "shipped" && transaction.tracking_number && (
                        <div className="mt-2 p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nomor Resi</p>
                              <p className="text-sm font-mono font-bold text-foreground">{transaction.tracking_number}</p>
                            </div>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => {
                              navigator.clipboard.writeText(transaction.tracking_number!);
                              toast({ title: "Resi disalin", description: transaction.tracking_number! });
                            }}>
                              <Copy className="w-3 h-3" /> Salin
                            </Button>
                          </div>
                          {transaction.shipping_courier && (
                            <p className="text-xs text-muted-foreground">
                              Ekspedisi: <span className="font-medium text-foreground">{transaction.shipping_courier} {transaction.shipping_service}</span>
                              {transaction.shipping_etd && <span> · Est. {transaction.shipping_etd} hari</span>}
                            </p>
                          )}
                          {trackingUrl && (
                            <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                              <ExternalLink className="w-3 h-3" /> Cek resi di {courierKey}
                            </a>
                          )}
                          <p className="text-[10px] text-muted-foreground italic">Cek status resi secara berkala untuk memantau posisi paket Anda.</p>
                        </div>
                      )}

                      {/* Confirmation buttons for delivered step */}
                      {s.key === "delivered" && !s.done && transaction.tracking_number && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8 text-xs gap-1" onClick={async () => {
                              const session = (await supabaseCustomer.auth.getSession()).data.session;
                              if (!session) return;
                              await supabaseCustomer.from("transactions").update({ status: "completed", confirmed_at: new Date().toISOString() } as any).eq("id", transaction.id);
                              toast({ title: "Pesanan dikonfirmasi", description: "Terima kasih telah berbelanja!" });
                              fetchTransaction();
                            }}>
                              <CheckCircle2 className="w-3 h-3" /> Sudah menerima pesanan
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Belum menerima pesanan? <button onClick={handleContactAdmin} className="text-blue-600 hover:underline font-medium">Hubungi Admin</button>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Item Pesanan
            </p>
            <div className="divide-y divide-border">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.product_label}</p>
                    <p className="text-xs text-muted-foreground font-mono">IMEI: {item.imei}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground shrink-0 ml-3">{formatPrice(item.selling_price)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Info */}
          {transaction.shipping_address && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Truck className="w-4 h-4" /> Informasi Pengiriman
              </p>
              {transaction.shipping_courier && (
                <p className="text-xs text-muted-foreground">
                  {transaction.shipping_courier} {transaction.shipping_service} · Est. {transaction.shipping_etd || "-"} hari
                </p>
              )}
              <div className="flex items-start gap-2 pt-1">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {transaction.shipping_address}
                  {transaction.shipping_district && `, ${transaction.shipping_district}`}
                  {transaction.shipping_city && `, ${transaction.shipping_city}`}
                  {transaction.shipping_province && `, ${transaction.shipping_province}`}
                  {transaction.shipping_postal_code && ` ${transaction.shipping_postal_code}`}
                </p>
              </div>
            </div>
          )}

          {/* Payment Breakdown */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Rincian Pembayaran
            </p>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({items.length} item)</span>
                <span className="text-foreground">{formatPrice(transaction.subtotal)}</span>
              </div>
              {transaction.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">
                    Diskon{transaction.discount_code && ` (${transaction.discount_code})`}
                  </span>
                  <span className="text-green-600">-{formatPrice(transaction.discount_amount)}</span>
                </div>
              )}
              {shippingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ongkir{transaction.shipping_courier && ` (${transaction.shipping_courier})`}</span>
                  <span className="text-foreground">{formatPrice(shippingCost)}</span>
                </div>
              )}
              {shippingDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Subsidi Ongkir</span>
                  <span className="text-green-600">-{formatPrice(shippingDiscount)}</span>
                </div>
              )}
              {packingKayuCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Packing Kayu</span>
                  <span className="text-foreground">{formatPrice(packingKayuCost)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{formatPrice(transaction.total)}</span>
              </div>
            </div>
            {transaction.payment_method_name && (
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Metode Pembayaran</p>
                <p className="text-xs font-medium text-foreground">{transaction.payment_method_name}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Status Pembayaran</p>
              <Badge variant={isPaid ? "default" : "secondary"} className={cn("text-[10px]", isPaid && "bg-green-100 text-green-700 border-green-200")}>
                {isPaid ? "Lunas" : isExpiredTransaction ? "Kedaluwarsa" : "Belum Dibayar"}
              </Badge>
            </div>
          </div>

          {/* Contact Admin Button */}
          <Button variant="outline" className="w-full gap-2" onClick={handleContactAdmin}>
            <MessageCircle className="w-4 h-4" /> Hubungi Admin
          </Button>
        </div>
      </div>
    </div>
  );
}
