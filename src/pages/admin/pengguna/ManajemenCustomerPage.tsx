import { useState, useEffect, useCallback } from "react";
import {
  Users, Search, RefreshCw, CheckCircle2, Clock, Ban, X, Mail,
  Eye, KeyRound, AlertTriangle, ShieldCheck, Trash2,
  UserCheck, UserX, Store, Globe, Phone, MapPin, Calendar,
  UserPlus, Download, ShoppingBag, DollarSign, ChevronRight,
  Loader2, Building2, ChevronLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/admin/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/shared/use-toast";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/admin/laporan/activity-log";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CustomerUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  email_confirmed: boolean;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  profile_status: string;
  has_account: boolean;
  source: "website" | "pos";
  tx_count?: number;
  tx_total_value?: number;
  tx_last_at?: string | null;
}

interface CustomerAddress {
  id: string;
  label: string | null;
  full_name: string;
  phone: string;
  full_address: string;
  province_name: string | null;
  regency_name: string | null;
  district_name: string | null;
  village_name: string | null;
  postal_code: string | null;
  is_default: boolean;
}

interface GuestAddress {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  full_address: string;
  province_name: string | null;
  regency_name: string | null;
  district_name: string | null;
  village_name: string | null;
  postal_code: string | null;
  is_default: boolean;
}

interface CustomerTransaction {
  id: string;
  transaction_code: string | null;
  total: number;
  status: string;
  created_at: string;
  shipping_courier: string | null;
  shipping_service: string | null;
}

type FilterType = "all" | "with_account" | "no_account";
type SourceFilter = "all" | "website" | "pos";
type StatusFilter = "all" | "active" | "unverified" | "suspended";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(dateStr));
}
function formatDateShort(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(dateStr));
}
function formatPrice(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}
function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.round(diff / 86400000);
  if (days <= 0) return "Hari ini";
  if (days === 1) return "1 hari lalu";
  return `${days} hari lalu`;
}
function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "Hari ini";
  if (days === 1) return "1 hari";
  return `${days} hari`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-[hsl(var(--status-reserved-bg))] text-[hsl(var(--status-reserved-fg))]",
  confirmed: "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]",
  paid: "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]",
  shipped: "bg-primary/10 text-primary",
  completed: "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]",
  cancelled: "bg-destructive/10 text-destructive",
};

function StatusBadge({ user }: { user: CustomerUser }) {
  if (user.profile_status === "none" || (!user.has_account && user.source === "pos")) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
        <UserX className="w-3 h-3" /> Belum Login
      </span>
    );
  }
  if (!user.has_account) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        <UserX className="w-3 h-3" /> Tanpa Akun
      </span>
    );
  }
  if (user.profile_status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
        <Ban className="w-3 h-3" /> Dinonaktifkan
      </span>
    );
  }
  if (!user.email_confirmed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--status-reserved-bg))] text-[hsl(var(--status-reserved-fg))]">
        <Clock className="w-3 h-3" /> Belum Verifikasi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]">
      <CheckCircle2 className="w-3 h-3" /> Aktif
    </span>
  );
}

function SourceBadge({ source }: { source: "website" | "pos" }) {
  if (source === "pos") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground border border-border">
        <Store className="w-3 h-3" /> POS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      <Globe className="w-3 h-3" /> Website
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ManajemenCustomerPage() {
  const { toast } = useToast();
  const { role, user: authUser, activeBranch, userBranches } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = role === "super_admin";
  const isAdminBranch = role === "admin_branch";
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterSource, setFilterSource] = useState<SourceFilter>("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerUser | null>(null);
  const [modal, setModal] = useState<{ type: string; user: CustomerUser } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteModal, setInviteModal] = useState<{ type: "invite"; email: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Create customer form
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { action: "list_customers" };
      if (filterBranch !== "all") body.branch_id = filterBranch;
      const { data, error } = await supabase.functions.invoke("manage-customer", { body });
      if (error || data?.error) {
        toast({ title: "Gagal memuat data customer", description: error?.message || data?.error, variant: "destructive" });
        setLoading(false);
        return;
      }
      setCustomers(data?.customers ?? []);
    } catch (e: unknown) {
      toast({ title: "Gagal memuat data", description: (e as Error).message, variant: "destructive" });
    }
    setLoading(false);
  }, [toast, filterBranch]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Fetch branches for filter
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("branches").select("id, name, code").eq("is_active", true).order("name");
      setBranches(data ?? []);
    })();
  }, []);

  const invokeAction = async (action: string, userId: string, extra?: Record<string, string>) => {
    setProcessing(true);
    const { data, error } = await supabase.functions.invoke("manage-customer", {
      body: { action, user_id: userId, ...extra },
    });
    setProcessing(false);
    if (error || data?.error) {
      toast({ title: "Gagal", description: error?.message || data?.error, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleVerifyEmail = async (user: CustomerUser) => {
    const ok = await invokeAction("verify_email", user.id);
    if (ok) {
      logActivity({ action: "verify_customer_email", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role, target_id: user.id, target_email: user.email });
      toast({ title: "Email berhasil diverifikasi." }); setModal(null); fetchCustomers();
    }
  };
  const handleUpdateEmail = async (user: CustomerUser) => {
    if (!newEmail.trim() || !newEmail.includes("@")) { toast({ title: "Email tidak valid.", variant: "destructive" }); return; }
    const ok = await invokeAction("update_email", user.id, { email: newEmail.trim() });
    if (ok) {
      logActivity({ action: "update_customer_email", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role, target_id: user.id, target_email: user.email, metadata: { new_email: newEmail.trim() } });
      toast({ title: "Email berhasil diubah." }); setModal(null); setNewEmail(""); fetchCustomers();
    }
  };
  const handleUpdatePassword = async (user: CustomerUser) => {
    if (newPassword.length < 8) { toast({ title: "Password minimal 8 karakter.", variant: "destructive" }); return; }
    const ok = await invokeAction("update_password", user.id, { password: newPassword });
    if (ok) {
      logActivity({ action: "update_customer_password", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role, target_id: user.id, target_email: user.email });
      toast({ title: "Password berhasil diubah." }); setModal(null); setNewPassword(""); fetchCustomers();
    }
  };
  const handleSuspend = async (user: CustomerUser) => {
    const ok = await invokeAction("suspend", user.id);
    if (ok) {
      logActivity({ action: "suspend_customer", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role, target_id: user.id, target_email: user.email });
      toast({ title: "Akun customer dinonaktifkan." }); setModal(null); fetchCustomers();
    }
  };
  const handleActivate = async (user: CustomerUser) => {
    const ok = await invokeAction("activate", user.id);
    if (ok) {
      logActivity({ action: "activate_customer", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role, target_id: user.id, target_email: user.email });
      toast({ title: "Akun customer diaktifkan kembali." }); setModal(null); fetchCustomers();
    }
  };
  const handleDelete = async (user: CustomerUser) => {
    const ok = await invokeAction("delete", user.id);
    if (ok) {
      logActivity({ action: "delete_customer", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role, target_id: user.id, target_email: user.email });
      toast({ title: "Akun customer dihapus permanen." }); setModal(null); setSelectedCustomer(null); fetchCustomers();
    }
  };
  const handleInviteLogin = async () => {
    const email = inviteModal?.email?.trim();
    if (!email || !email.includes("@")) { toast({ title: "Email tidak valid.", variant: "destructive" }); return; }
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("manage-customer", {
      body: { action: "invite_customer_login", email, redirect_url: "/login" },
    });
    setInviting(false);
    if (error || data?.error) {
      toast({ title: "Gagal kirim undangan", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    logActivity({ action: "invite_customer_login", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role, target_email: email });
    toast({ title: "Email verifikasi terkirim!", description: `Customer akan menerima link untuk membuat password di ${email}.` });
    setInviteModal(null);

    // Migrate guest_addresses → customer_addresses if emails match
    const newUserId = data?.user?.id ?? data?.id;
    if (newUserId && email) {
      const { data: guestAddrs } = await supabase.from("guest_addresses" as never)
        .select("recipient_name, phone, full_address, province_name, regency_name, district_name, village_name, postal_code, label, is_default")
        .eq("email", email)
        .limit(20);
      if (guestAddrs && guestAddrs.length > 0) {
        const existing = (await supabase.from("customer_addresses" as never)
          .select("id").eq("user_id", newUserId).limit(1)).data ?? [];
        if (existing.length === 0) {
          // First address: migrate is_default from guest_addresses
          const toMigrate = guestAddrs.map((a: GuestAddress) => ({
            user_id: newUserId,
            recipient_name: a.recipient_name,
            phone: a.phone,
            full_address: a.full_address,
            province_name: a.province_name,
            regency_name: a.regency_name,
            district_name: a.district_name,
            village_name: a.village_name,
            postal_code: a.postal_code,
            label: a.label,
            city: a.regency_name,
            is_default: a.is_default,
          }));
          await supabase.from("customer_addresses" as never).insert(toMigrate as never);
        }
      }
    }
  };
  const handleCreateCustomer = async () => {
    if (!createEmail.trim() || !createPassword) { toast({ title: "Email dan password wajib.", variant: "destructive" }); return; }
    setProcessing(true);
    const { data, error } = await supabase.functions.invoke("manage-customer", {
      body: { action: "create_customer", email: createEmail.trim(), full_name: createName.trim(), phone: createPhone.trim(), password: createPassword },
    });
    setProcessing(false);
    if (error || data?.error) {
      toast({ title: "Gagal membuat akun", description: error?.message || data?.error, variant: "destructive" }); return;
    }
    logActivity({ action: "create_customer", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role, target_email: createEmail.trim() });
    toast({ title: "Akun customer berhasil dibuat." });
    setShowCreateModal(false);
    setCreateEmail(""); setCreateName(""); setCreatePhone(""); setCreatePassword("");
    fetchCustomers();
  };
  const handleExport = async () => {
    const { data, error } = await supabase.functions.invoke("manage-customer", {
      body: { action: "export_customers" },
    });
    if (error || data?.error) { toast({ title: "Gagal export", variant: "destructive" }); return; }
    const customers = data?.customers ?? [];
    const csv = ["Email,Nama,Telepon,Terdaftar,Login Terakhir,Email Terverifikasi"];
    for (const c of customers) {
      csv.push(`"${c.email}","${c.full_name}","${c.phone}","${c.created_at}","${c.last_sign_in_at}","${c.email_confirmed}"`);
    }
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `customers_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    logActivity({ action: "export_customers", actor_id: authUser?.id, actor_email: authUser?.email, actor_role: role });
  };

  // Filters
  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.full_name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
    let matchFilter = true;
    if (filterType === "with_account") matchFilter = c.has_account;
    else if (filterType === "no_account") matchFilter = !c.has_account;
    let matchSource = true;
    if (filterSource === "website") matchSource = c.source === "website";
    else if (filterSource === "pos") matchSource = c.source === "pos";
    let matchStatus = true;
    if (filterStatus === "active") matchStatus = c.has_account && c.email_confirmed && c.profile_status !== "suspended";
    else if (filterStatus === "unverified") matchStatus = c.has_account && !c.email_confirmed;
    else if (filterStatus === "suspended") matchStatus = c.has_account && c.profile_status === "suspended";
    return matchSearch && matchFilter && matchSource && matchStatus;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterType, filterSource, filterStatus, filterBranch, pageSize]);

  const counts = {
    total: customers.length,
    withAccount: customers.filter((c) => c.has_account).length,
    noAccount: customers.filter((c) => !c.has_account).length,
  };

  const pageTitle = isAdminBranch ? "Customer Cabang" : "Manajemen Customer";
  const pageDesc = isAdminBranch
    ? "Daftar customer dari transaksi POS cabang Anda."
    : "Kelola semua akun customer dari website dan POS.";

  return (
    <DashboardLayout pageTitle={pageTitle}>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">{pageTitle}</h1>
            <p className="text-xs text-muted-foreground">{pageDesc}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            {(isSuperAdmin || isAdminBranch) && (
              <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowCreateModal(true)}>
                <UserPlus className="w-3.5 h-3.5" /> Tambah Customer
              </Button>
            )}
          </div>
        </div>

        {/* KPI cards - clickable filters */}
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: "all" as FilterType, label: "Total Customer", count: counts.total, icon: Users, colors: "border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/50" },
            { key: "with_account" as FilterType, label: "Punya Akun", count: counts.withAccount, icon: UserCheck, colors: "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50" },
            { key: "no_account" as FilterType, label: "Tanpa Akun", count: counts.noAccount, icon: UserX, colors: "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50" },
          ]).map((k) => (
            <button
              key={k.key}
              onClick={() => setFilterType(filterType === k.key ? "all" : k.key)}
              className={cn(
                "rounded-xl border-2 p-3 sm:p-4 text-left transition-all",
                filterType === k.key ? cn(k.colors, "ring-2 ring-zinc-400 dark:ring-zinc-500") : "border-border bg-card hover:border-zinc-400 dark:hover:border-zinc-600"
              )}
            >
              <div className="flex items-center justify-between">
                <k.icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                {filterType === k.key && <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />}
              </div>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{k.count}</p>
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mt-0.5">{k.label}</p>
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Cari nama, email, atau telepon…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          {(isSuperAdmin || isAdminBranch) && (
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="h-9 w-full sm:w-[180px] text-sm shrink-0">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Semua Cabang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Cabang</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterSource} onValueChange={(v) => setFilterSource(v as SourceFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-[150px] text-sm shrink-0">
              <SelectValue placeholder="Semua Sumber" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sumber</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="pos">POS</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-[170px] text-sm shrink-0">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="unverified">Belum Verifikasi</SelectItem>
              <SelectItem value="suspended">Dinonaktifkan</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={fetchCustomers}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Segarkan</span>
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-16 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Tidak ada customer ditemukan.</p>
            <p className="text-xs text-muted-foreground mt-1">Coba ubah filter atau kata kunci.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-900/40">
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Customer</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hidden md:table-cell">Status</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hidden lg:table-cell">Transaksi</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hidden lg:table-cell">Total Nilai</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hidden xl:table-cell">Terdaftar</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((c) => (
                    <tr key={c.id} className={cn("hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors cursor-pointer", selectedCustomer?.id === c.id && "bg-zinc-100 dark:bg-zinc-800/50")} onClick={() => setSelectedCustomer(c)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-bold flex items-center justify-center shrink-0">
                            {(c.full_name ?? c.email).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{c.full_name ?? "—"}</p>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge user={c} />
                          <SourceBadge source={c.source} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-sm font-semibold text-foreground">{c.tx_count ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-sm font-semibold text-foreground">{formatPrice(c.tx_total_value ?? 0)}</span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <p className="text-xs font-medium text-foreground">{formatDateShort(c.created_at)}</p>
                        <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">{daysAgo(c.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Tampilkan</span>
                <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filtered.length} customer</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{page}/{totalPages}</span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Drawer - Customer Detail */}
      {selectedCustomer && (
        <CustomerDetailDrawer
          customer={selectedCustomer}
          isSuperAdmin={isSuperAdmin}
          isAdminBranch={isAdminBranch}
          onClose={() => setSelectedCustomer(null)}
          onVerify={() => setModal({ type: "verify", user: selectedCustomer })}
          onChangeEmail={() => { setModal({ type: "email", user: selectedCustomer }); setNewEmail(selectedCustomer.email); }}
          onChangePassword={() => { setModal({ type: "password", user: selectedCustomer }); setNewPassword(""); }}
          onSuspend={() => setModal({ type: "suspend", user: selectedCustomer })}
          onActivate={() => setModal({ type: "activate", user: selectedCustomer })}
          onDelete={() => setModal({ type: "delete", user: selectedCustomer })}
          onNavigateTransaction={(txId) => navigate(`/admin/transaksi/${txId}`)}
          onInviteLogin={() => { setInviteModal({ type: "invite", email: selectedCustomer.email }); }}
        />
      )}

      {/* Action Modals */}
      {modal?.type === "verify" && (
        <ConfirmModal title="Verifikasi Email?" description={`Email ${modal.user.email} akan diverifikasi manual.`} confirmLabel="Verifikasi" variant="default" icon={<ShieldCheck className="w-5 h-5 text-[hsl(var(--status-available-fg))]" />} loading={processing} onConfirm={() => handleVerifyEmail(modal.user)} onClose={() => setModal(null)} />
      )}
      {modal?.type === "email" && (
        <FormModal title="Ubah Email" subtitle={modal.user.full_name ?? modal.user.email} onClose={() => setModal(null)} processing={processing}>
          <div><label className="text-xs font-medium text-foreground block mb-1.5">Email Baru</label>
          <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" /></div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setModal(null)} disabled={processing}>Batal</Button>
            <Button className="flex-1 h-9 text-sm gap-1.5" onClick={() => handleUpdateEmail(modal.user)} disabled={processing || !newEmail.trim()}>
              {processing ? <Spinner /> : <Mail className="w-3.5 h-3.5" />} Simpan
            </Button>
          </div>
        </FormModal>
      )}
      {modal?.type === "password" && (
        <FormModal title="Ganti Password" subtitle={modal.user.full_name ?? modal.user.email} onClose={() => setModal(null)} processing={processing}>
          <div><label className="text-xs font-medium text-foreground block mb-1.5">Password Baru</label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 8 karakter" className="h-9 text-sm" /></div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setModal(null)} disabled={processing}>Batal</Button>
            <Button className="flex-1 h-9 text-sm gap-1.5" onClick={() => handleUpdatePassword(modal.user)} disabled={processing || newPassword.length < 8}>
              {processing ? <Spinner /> : <KeyRound className="w-3.5 h-3.5" />} Simpan
            </Button>
          </div>
        </FormModal>
      )}
      {modal?.type === "suspend" && <ConfirmModal title="Nonaktifkan Akun?" description={`${modal.user.full_name ?? modal.user.email} tidak bisa login.`} confirmLabel="Nonaktifkan" variant="destructive" icon={<Ban className="w-5 h-5 text-destructive" />} loading={processing} onConfirm={() => handleSuspend(modal.user)} onClose={() => setModal(null)} />}
      {modal?.type === "activate" && <ConfirmModal title="Aktifkan Kembali?" description={`${modal.user.full_name ?? modal.user.email} dapat login kembali.`} confirmLabel="Aktifkan" variant="default" icon={<CheckCircle2 className="w-5 h-5 text-[hsl(var(--status-available-fg))]" />} loading={processing} onConfirm={() => handleActivate(modal.user)} onClose={() => setModal(null)} />}
      {modal?.type === "delete" && <ConfirmModal title="Hapus Permanen?" description={`PERINGATAN: ${modal.user.email} dihapus permanen.`} confirmLabel="Hapus" variant="destructive" icon={<Trash2 className="w-5 h-5 text-destructive" />} loading={processing} onConfirm={() => handleDelete(modal.user)} onClose={() => setModal(null)} />}

      {/* Create Customer Modal */}
      {showCreateModal && (
        <FormModal title="Tambah Customer Baru" subtitle="Buat akun customer tanpa verifikasi email" onClose={() => setShowCreateModal(false)} processing={processing}>
          <div className="space-y-3">
            <div><Label className="text-xs">Email *</Label>
            <Input value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Nama Lengkap</Label>
            <Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Nama customer" className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Telepon</Label>
            <Input value={createPhone} onChange={e => setCreatePhone(e.target.value)} placeholder="08xxxxxxxxxx" className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Password *</Label>
            <Input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="Minimal 8 karakter" className="h-9 text-sm" /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setShowCreateModal(false)} disabled={processing}>Batal</Button>
            <Button className="flex-1 h-9 text-sm gap-1.5" onClick={handleCreateCustomer} disabled={processing || !createEmail.trim() || createPassword.length < 8}>
              {processing ? <Spinner /> : <UserPlus className="w-3.5 h-3.5" />} Buat Akun
            </Button>
          </div>
        </FormModal>
      )}

      {/* Invite Login Modal — for POS guests */}
      {inviteModal && (
        <FormModal
          title="Undang Customer Login"
          subtitle="Customer akan menerima email untuk membuat password akunnya sendiri."
          onClose={() => setInviteModal(null)}
          processing={inviting}
        >
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-foreground mb-1.5 block">Email Customer</Label>
              <Input
                value={inviteModal.email}
                onChange={e => setInviteModal({ type: "invite", email: e.target.value })}
                placeholder="email@contoh.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Cara kerja:</p>
              <ol className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5 list-decimal list-inside">
                <li>Email verifikasi dikirim ke alamat di atas</li>
                <li>Customer klik link di email</li>
                <li>Customer membuat password sendiri</li>
                <li>Akun langsung aktif — tidak perlu approval</li>
              </ol>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setInviteModal(null)} disabled={inviting}>Batal</Button>
              <Button className="flex-1 h-9 text-sm gap-1.5" onClick={handleInviteLogin} disabled={inviting || !inviteModal.email.includes("@")}>
                {inviting ? <Spinner /> : <Mail className="w-3.5 h-3.5" />} Kirim Undangan
              </Button>
            </div>
          </div>
        </FormModal>
      )}
    </DashboardLayout>
  );
}

// ─── Customer Detail Drawer (Right side full-height) ─────────────────────────
function CustomerDetailDrawer({
  customer, isSuperAdmin, isAdminBranch, onClose, onVerify, onChangeEmail, onChangePassword, onSuspend, onActivate, onDelete, onNavigateTransaction, onInviteLogin,
}: {
  customer: CustomerUser;
  isSuperAdmin: boolean;
  isAdminBranch: boolean;
  onClose: () => void;
  onVerify: () => void;
  onChangeEmail: () => void;
  onChangePassword: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onNavigateTransaction: (id: string) => void;
  onInviteLogin: () => void;
}) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [guestAddresses, setGuestAddresses] = useState<GuestAddress[]>([]);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [tab, setTab] = useState<"info" | "address" | "transactions">("info");
  const isPosGuest = customer.id.startsWith("pos_guest_");

  useEffect(() => {
    if (!customer.has_account || customer.id.startsWith("pos_")) return;
    setLoadingDetail(true);
    supabase.functions.invoke("manage-customer", {
      body: { action: "get_customer_detail", user_id: customer.id },
    }).then(({ data }) => {
      setAddresses(data?.addresses ?? []);
      setTransactions(data?.transactions ?? []);
      setLoadingDetail(false);
    }).catch(() => setLoadingDetail(false));
  }, [customer]);

  // Fetch transactions for POS guests by email
  useEffect(() => {
    if (!isPosGuest) return;
    setLoadingDetail(true);
    supabase.from("transactions" as never)
      .select("id,transaction_code,total,status,created_at,shipping_courier,shipping_service")
      .eq("customer_email", customer.email)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setTransactions(data ?? []);
        setLoadingDetail(false);
      });
  }, [customer, isPosGuest]);

  // Fetch guest addresses for POS guests
  useEffect(() => {
    if (!isPosGuest) return;
    supabase.from("guest_addresses" as never)
      .select("id, label, recipient_name, phone, full_address, province_name, regency_name, district_name, village_name, postal_code, is_default")
      .eq("email", customer.email)
      .order("is_default", { ascending: false })
      .limit(20)
      .then(({ data }) => { setGuestAddresses((data as GuestAddress[]) ?? []); });
  }, [customer, isPosGuest]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 pb-4 border-b border-border shrink-0 bg-zinc-50 dark:bg-zinc-900/30">
          <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-base font-bold flex items-center justify-center shrink-0">
            {(customer.full_name ?? customer.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground truncate">{customer.full_name ?? "—"}</p>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 break-all">{customer.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge user={customer} />
              <SourceBadge source={customer.source} />
            </div>
            {isPosGuest && (isSuperAdmin || isAdminBranch) && (
              <button
                onClick={onInviteLogin}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" /> Undang Login
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 shrink-0">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 p-4 border-b border-border shrink-0">
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{daysSince(customer.created_at)}</p>
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{isPosGuest ? "Usia Transaksi Pertama" : "Usia Akun"}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{customer.tx_count ?? 0}</p>
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">Total Transaksi</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">{formatPrice(customer.tx_total_value ?? 0)}</p>
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">Total Belanja</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {([
            { key: "info", label: "Info" },
            { key: "address", label: "Alamat" },
            { key: "transactions", label: "Transaksi" },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2",
                tab === t.key ? "border-foreground text-foreground" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-foreground"
              )}
            >{t.label}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "info" && (
            <div className="space-y-3">
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={customer.email} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Telepon" value={customer.phone ?? "—"} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Terdaftar" value={`${formatDate(customer.created_at)} (${daysAgo(customer.created_at)})`} />
              {customer.has_account && (
                <>
                  <InfoRow icon={<ShieldCheck className="w-4 h-4" />} label="Email Verifikasi" value={customer.email_confirmed ? formatDate(customer.email_confirmed_at) : "Belum diverifikasi"} />
                  <InfoRow icon={<Calendar className="w-4 h-4" />} label="Login Terakhir" value={formatDate(customer.last_sign_in_at)} />
                </>
              )}
              <InfoRow icon={<ShoppingBag className="w-4 h-4" />} label="Transaksi Terakhir" value={customer.tx_last_at ? `${formatDate(customer.tx_last_at)} (${daysAgo(customer.tx_last_at)})` : "Belum ada"} />
              <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Total Nilai Transaksi" value={formatPrice(customer.tx_total_value ?? 0)} />
            </div>
          )}

          {tab === "address" && (
            <div className="space-y-3">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-2">
                  {!isPosGuest && addresses.map(addr => (
                    <div key={addr.id} className="p-3 border border-border rounded-xl space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{addr.label ?? "Alamat"}</span>
                        {addr.is_default && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Default</span>}
                      </div>
                      <p className="text-xs text-foreground font-medium">{addr.full_name} · {addr.phone}</p>
                      <p className="text-xs text-muted-foreground">{addr.full_address}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[addr.village_name, addr.district_name, addr.regency_name, addr.province_name].filter(Boolean).join(", ")}
                        {addr.postal_code ? ` ${addr.postal_code}` : ""}
                      </p>
                    </div>
                  ))}
                  {guestAddresses.map(addr => (
                    <div key={addr.id} className="p-3 border border-dashed border-border rounded-xl space-y-1 opacity-80">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{addr.label ?? addr.recipient_name ?? "Alamat"}</span>
                        {addr.is_default && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Default</span>}
                      </div>
                      <p className="text-xs text-foreground font-medium">{addr.recipient_name} · {addr.phone}</p>
                      <p className="text-xs text-muted-foreground">{addr.full_address}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[addr.village_name, addr.district_name, addr.regency_name, addr.province_name].filter(Boolean).join(", ")}
                        {addr.postal_code ? ` ${addr.postal_code}` : ""}
                      </p>
                    </div>
                  ))}
                  {!loadingDetail && addresses.length === 0 && guestAddresses.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Belum ada alamat tersimpan.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "transactions" && (
            <div className="space-y-2">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada transaksi.</p>
              ) : (
                transactions.map(tx => (
                  <button
                    key={tx.id}
                    onClick={() => onNavigateTransaction(tx.id)}
                    className="w-full p-3 border border-border rounded-xl text-left hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-medium text-foreground">{tx.transaction_code ?? tx.id.slice(0, 8)}</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[tx.status] ?? "bg-muted text-muted-foreground")}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{formatDateShort(tx.created_at)}</span>
                      <span className="text-sm font-bold text-foreground">{formatPrice(tx.total)}</span>
                    </div>
                    {tx.shipping_courier && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{tx.shipping_courier} {tx.shipping_service}</p>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Actions footer */}
        {customer.has_account && !customer.id.startsWith("pos_") && (
          <div className="p-4 pt-3 border-t border-border space-y-2 shrink-0">
            {!customer.email_confirmed && customer.profile_status !== "suspended" && (isSuperAdmin || isAdminBranch) && (
              <Button variant="outline" className="w-full h-8 text-xs gap-2 justify-start" onClick={onVerify}>
                <ShieldCheck className="w-3.5 h-3.5" /> Verifikasi Email
              </Button>
            )}
            {isSuperAdmin && (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-8 text-xs gap-1.5" onClick={onChangeEmail}><Mail className="w-3.5 h-3.5" /> Email</Button>
                  <Button variant="outline" className="flex-1 h-8 text-xs gap-1.5" onClick={onChangePassword}><KeyRound className="w-3.5 h-3.5" /> Password</Button>
                </div>
                {customer.profile_status === "suspended" ? (
                  <Button variant="outline" className="w-full h-8 text-xs gap-2 justify-start" onClick={onActivate}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aktifkan
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full h-8 text-xs gap-2 justify-start text-destructive hover:text-destructive" onClick={onSuspend}>
                    <Ban className="w-3.5 h-3.5" /> Nonaktifkan
                  </Button>
                )}
                <Button variant="outline" className="w-full h-8 text-xs gap-2 justify-start text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Permanen
                </Button>
              </>
            )}
          </div>
        )}

        </div>
    </>
  );
}

function InfoRow({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
        <p className={cn("text-sm font-medium break-all mt-0.5", muted ? "text-zinc-400 dark:text-zinc-500 italic" : "text-foreground")}>{value}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="w-3.5 h-3.5 border border-current/30 border-t-current rounded-full animate-spin" />;
}

function FormModal({ title, subtitle, onClose, processing, children }: {
  title: string; subtitle: string; onClose: () => void; processing: boolean; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !processing && onClose()} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p></div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ title, description, confirmLabel, variant, icon, loading = false, onConfirm, onClose }: {
  title: string; description: string; confirmLabel: string; variant: "default" | "destructive"; icon?: React.ReactNode; loading?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          {icon && <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">{icon}</div>}
          <div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="text-xs text-muted-foreground mt-1">{description}</p></div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant={variant} className="flex-1 h-9 text-sm gap-1.5" onClick={onConfirm} disabled={loading}>
            {loading && <Spinner />} {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
