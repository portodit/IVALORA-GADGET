import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, CheckCircle2, XCircle, RefreshCw, Package,
  ChevronRight, ShoppingBag, Loader2, ChevronLeft,
} from "lucide-react";
import { supabaseCustomer } from "@/integrations/supabase/customer-client";
import { useCustomerAuth } from "@/contexts/customer/CustomerAuthContext";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/shared/LocaleContext";

const USD_RATE = 15500;
const INVOICE_DURATION_SECONDS = 10800; // 3 hours
const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface Transaction {
  id: string;
  transaction_code: string | null;
  status: string;
  total: number;
  created_at: string;
  customer_name: string | null;
  payment_method_name: string | null;
  shipping_courier: string | null;
  shipping_service: string | null;
}

function getPaymentDeadline(createdAt: string): Date {
  return new Date(new Date(createdAt).getTime() + INVOICE_DURATION_SECONDS * 1000);
}

function useCountdowns(transactions: Transaction[]) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (tx: Transaction) => {
    if (tx.status !== "pending") return null;
    const deadline = getPaymentDeadline(tx.created_at);
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) return "Kedaluwarsa";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  pending: { label: "Menunggu Pembayaran", color: "text-amber-600", icon: Clock, bg: "bg-amber-50 border-amber-200" },
  expired: { label: "Kedaluwarsa", color: "text-destructive", icon: XCircle, bg: "bg-destructive/5 border-destructive/20" },
  completed: { label: "Selesai", color: "text-green-600", icon: CheckCircle2, bg: "bg-green-50 border-green-200" },
  cancelled: { label: "Dibatalkan", color: "text-destructive", icon: XCircle, bg: "bg-destructive/5 border-destructive/20" },
  failed: { label: "Gagal", color: "text-destructive", icon: XCircle, bg: "bg-destructive/5 border-destructive/20" },
  refunded: { label: "Dikembalikan", color: "text-muted-foreground", icon: RefreshCw, bg: "bg-muted/40 border-muted" },
};

const INVOICE_DURATION_MS = 10800 * 1000;
function getDisplayStatus(tx: { status: string; created_at: string }): string {
  if (tx.status === "pending" && Date.now() > new Date(tx.created_at).getTime() + INVOICE_DURATION_MS) return "expired";
  return tx.status;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default function CustomerTransaksiPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useCustomerAuth();
  const { currency } = useLocale();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const getCountdown = useCountdowns(transactions);

  const formatPrice = (n: number) => {
    if (currency === "USD") return "$" + (n / USD_RATE).toLocaleString("en-US", { maximumFractionDigits: 0 });
    return "Rp" + n.toLocaleString("id-ID");
  };

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabaseCustomer
        .from("transactions")
        .select("id, transaction_code, status, total, created_at, customer_name, payment_method_name, shipping_courier, shipping_service")
        .eq("customer_user_id", user.id)
        .order("created_at", { ascending: false });

      if (filter !== "all") query = query.eq("status", filter);

      const { data } = await query;
      setTransactions((data as Transaction[]) ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?redirect=/riwayat", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => { setPage(1); }, [filter, pageSize]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavbar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const filters = [
    { key: "all", label: "Semua" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Selesai" },
    { key: "cancelled", label: "Dibatalkan" },
  ];

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const paginated = transactions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-foreground mb-1">Riwayat Transaksi</h1>
        <p className="text-sm text-muted-foreground mb-6">{transactions.length} transaksi</p>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
                filter === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/40"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/katalog")}>
              Mulai Belanja
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginated.map(tx => {
                const statusCfg = STATUS_CONFIG[getDisplayStatus(tx)] ?? STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const countdown = getCountdown(tx);
                return (
                  <button
                    key={tx.id}
                    onClick={() => navigate(`/riwayat/${tx.id}`)}
                    className="w-full p-4 rounded-xl border border-border bg-card hover:border-foreground/30 transition-all text-left flex items-center gap-4"
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 border", statusCfg.bg)}>
                      <StatusIcon className={cn("w-4 h-4", statusCfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{tx.transaction_code || "—"}</p>
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", statusCfg.bg, statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(tx.created_at)} · {formatTime(tx.created_at)}
                        {tx.shipping_courier && ` · ${tx.shipping_courier} ${tx.shipping_service || ""}`}
                      </p>
                      {/* Payment countdown for pending transactions */}
                      {tx.status === "pending" && countdown && (
                        <div className={cn(
                          "mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold animate-pulse",
                          countdown === "Kedaluwarsa"
                            ? "bg-destructive/10 text-destructive border border-destructive/20"
                            : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700"
                        )}>
                          <Clock className="w-3.5 h-3.5" />
                          {countdown === "Kedaluwarsa" ? "Waktu habis" : `Sisa ${countdown}`}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatPrice(tx.total)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  Hal {page}/{totalPages}
                </p>
                <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(s => (
                      <SelectItem key={s} value={String(s)}>{s} / hal</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
          </>
        )}
      </div>
    </div>
  );
}
