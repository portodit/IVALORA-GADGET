import { useState, useEffect, useCallback } from "react";
import {
  Users, UserCheck, Search, RefreshCw,
  CheckCircle2, XCircle, Clock, Ban, Shield, X, Mail,
  AlertTriangle, KeyRound, Eye, UserPlus, MapPin, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/admin/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/shared/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
type AccountStatus = "pending" | "active" | "suspended" | "rejected";
type AppRole = "super_admin" | "admin_branch" | "employee" | null;

interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
  status: AccountStatus;
  created_at: string;
  role: AppRole;
  branches: { id: string; name: string; code: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Aktif",
  pending: "Menunggu Persetujuan",
  suspended: "Dinonaktifkan",
  rejected: "Ditolak",
};

const STATUS_STYLES: Record<AccountStatus, { bg: string; text: string; dot: string; icon: React.ElementType }> = {
  active: { bg: "bg-[hsl(var(--status-available-bg))]", text: "text-[hsl(var(--status-available-fg))]", dot: "bg-[hsl(var(--status-available))]", icon: CheckCircle2 },
  pending: { bg: "bg-[hsl(var(--status-reserved-bg))]", text: "text-[hsl(var(--status-reserved-fg))]", dot: "bg-[hsl(var(--status-reserved))]", icon: Clock },
  suspended: { bg: "bg-[hsl(var(--status-minus-bg))]", text: "text-[hsl(var(--status-minus-fg))]", dot: "bg-[hsl(var(--status-minus))]", icon: Ban },
  rejected: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", icon: XCircle },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_branch: "Admin Cabang",
  employee: "Employee",
};

function StatusBadge({ status }: { status: AccountStatus }) {
  const s = STATUS_STYLES[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", s.bg, s.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  if (!role) return <span className="text-xs text-muted-foreground italic">—</span>;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
      role === "super_admin"
        ? "bg-primary/10 text-primary border-primary/20"
        : "bg-muted text-muted-foreground border-border"
    )}>
      {role === "super_admin" && <Shield className="w-2.5 h-2.5" />}
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function BranchBadge({ user }: { user: AdminUser }) {
  if (user.role === "super_admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
        <Globe className="w-2.5 h-2.5" />
        Global
      </span>
    );
  }
  if (user.branches.length === 0) return <span className="text-xs text-muted-foreground italic">—</span>;
  if (user.branches.length === 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
        <MapPin className="w-2.5 h-2.5 shrink-0" />
        {user.branches[0].name}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {user.branches.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
          <MapPin className="w-2.5 h-2.5 shrink-0" />
          {b.name}
        </span>
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(dateStr));
}

// ─── Main Page (tabs) ─────────────────────────────────────────────────────────
export default function ManajemenAdminPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // Redirect /manajemen-admin → /manajemen-admin/daftar
  useEffect(() => {
    if (!tab) navigate("/admin/manajemen-admin/daftar", { replace: true });
  }, [tab, navigate]);

  const activeTab = tab === "approval" ? "approval" : "daftar";

  return (
    <DashboardLayout pageTitle="Manajemen Admin">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Manajemen Admin</h1>
          <p className="text-xs text-muted-foreground">Kelola akun admin dan kontrol akses sistem.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/40 w-fit">
          {[
            { id: "daftar", label: "Daftar Admin", icon: Users },
            { id: "approval", label: "Approval Admin", icon: UserCheck },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(`/admin/manajemen-admin/${id}`)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === id
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "daftar" ? <DaftarAdminTab /> : <ApprovalAdminTab />}
      </div>
    </DashboardLayout>
  );
}

// ─── Tab 1: Daftar Admin ──────────────────────────────────────────────────────
function DaftarAdminTab() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [allBranches, setAllBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: "suspend" | "activate" | "role" | "reset_password";
    user: AdminUser;
  } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes, userBranchesRes] = await Promise.all([
      supabase.from("user_profiles").select("id, full_name, email, status, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_branches").select("user_id, branch_id, branches(id, name, code)"),
    ]);

    const profiles = profilesRes.data ?? [];

    const roleMap: Record<string, AppRole> = {};
    for (const r of rolesRes.data ?? []) roleMap[r.user_id] = r.role as AppRole;

    const branchMap: Record<string, { id: string; name: string; code: string }[]> = {};
    for (const ub of userBranchesRes.data ?? []) {
      if (!branchMap[ub.user_id]) branchMap[ub.user_id] = [];
      const b = ub.branches as { id: string; name: string; code: string } | null;
      if (b) branchMap[ub.user_id].push(b);
    }

    const merged: AdminUser[] = (profiles as { id: string; full_name: string | null; email: string; status: AccountStatus; created_at: string }[]).map((p) => ({
      ...p,
      role: roleMap[p.id] ?? null,
      branches: branchMap[p.id] ?? [],
    }));

    setUsers(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    supabase.from("branches").select("id, name, code").eq("is_active", true).order("name")
      .then(({ data }) => setAllBranches(data ?? []));
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (u.full_name ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = filterRole === "all" || u.role === filterRole || (filterRole === "none" && !u.role);
    const matchStatus = filterStatus === "all" || u.status === filterStatus;
    const matchBranch =
      filterBranch === "all" ||
      (filterBranch === "global" && u.role === "super_admin") ||
      u.branches.some((b) => b.id === filterBranch);
    return matchSearch && matchRole && matchStatus && matchBranch;
  });

  const logActivity = async (action: string, targetUser: AdminUser, metadata?: Record<string, unknown>) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("activity_logs").insert({
        actor_id: user?.id ?? null,
        actor_email: user?.email ?? null,
        actor_role: role ?? null,
        action,
        target_id: targetUser.id,
        target_email: targetUser.email,
        metadata: metadata ?? null,
      });
    } catch { /* silent */ }
  };

  const handleAction = async (type: string, targetUser: AdminUser, extra?: string) => {
    if (type === "suspend") {
      const { error } = await supabase.from("user_profiles").update({ status: "suspended" }).eq("id", targetUser.id);
      if (error) { toast({ title: "Gagal menonaktifkan akun", variant: "destructive" }); return; }
      toast({ title: "Akun telah dinonaktifkan." });
      await logActivity("suspend_admin", targetUser);
    } else if (type === "activate") {
      const { error } = await supabase.from("user_profiles").update({ status: "active" }).eq("id", targetUser.id);
      if (error) { toast({ title: "Gagal mengaktifkan akun", variant: "destructive" }); return; }
      toast({ title: "Akun berhasil diaktifkan kembali." });
      await logActivity("activate_admin", targetUser);
    } else if (type === "role" && extra) {
      // Check: must keep at least 1 active super_admin
      if (targetUser.role === "super_admin" && extra !== "super_admin") {
        const activeSuperAdmins = users.filter((u) => u.role === "super_admin" && u.status === "active" && u.id !== targetUser.id);
        if (activeSuperAdmins.length === 0) {
          toast({ title: "Tidak dapat mengubah role", description: "Minimal harus ada 1 Super Admin aktif.", variant: "destructive" });
          return;
        }
      }
      if (extra === "none") {
        await supabase.from("user_roles").delete().eq("user_id", targetUser.id);
      } else {
        // upsert by user_id uniqueness — delete then insert to avoid conflict issues
        await supabase.from("user_roles").delete().eq("user_id", targetUser.id);
        await supabase.from("user_roles").insert({ user_id: targetUser.id, role: extra as "super_admin" | "admin_branch" | "employee" });
      }
      toast({ title: "Perubahan role berhasil disimpan." });
      await logActivity("role_change", targetUser, { old_role: targetUser.role ?? "none", new_role: extra });
    } else if (type === "reset_password") {
      const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { toast({ title: "Gagal mengirim email reset", variant: "destructive" }); return; }
      toast({ title: "Tautan reset dikirim ke email pengguna." });
      await logActivity("reset_password", targetUser);
    }
    setActionModal(null);
    setDetailUser(null);
    fetchUsers();
  };

  const counts = {
    active: users.filter((u) => u.status === "active").length,
    pending: users.filter((u) => u.status === "pending").length,
    suspended: users.filter((u) => u.status === "suspended").length,
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Aktif", count: counts.active, color: "text-[hsl(var(--status-available-fg))]", bg: "bg-[hsl(var(--status-available-bg))]" },
          { label: "Menunggu", count: counts.pending, color: "text-[hsl(var(--status-reserved-fg))]", bg: "bg-[hsl(var(--status-reserved-bg))]" },
          { label: "Dinonaktifkan", count: counts.suspended, color: "text-[hsl(var(--status-minus-fg))]", bg: "bg-[hsl(var(--status-minus-bg))]" },
        ].map((k) => (
          <div key={k.label} className={cn("rounded-xl border border-border p-3 sm:p-4", k.bg)}>
            <p className={cn("text-xl sm:text-2xl font-bold", k.color)}>{k.count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Semua Role</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin_branch">Admin Cabang</option>
            <option value="employee">Employee</option>
            <option value="none">Tanpa Role</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="pending">Menunggu</option>
            <option value="suspended">Dinonaktifkan</option>
            <option value="rejected">Ditolak</option>
          </select>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Semua Cabang</option>
            <option value="global">Global (Super Admin)</option>
            {allBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={fetchUsers}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Segarkan</span>
          </Button>
          <Button size="sm" className="h-9 gap-1.5 shrink-0" onClick={() => setShowCreateModal(true)}>
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tambah Akun</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Tidak ada akun yang ditemukan.</p>
          <p className="text-xs text-muted-foreground mt-1">Coba ubah filter atau kata kunci pencarian.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground">Nama</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground hidden xl:table-cell">Cabang</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground hidden lg:table-cell">Terdaftar</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold flex items-center justify-center shrink-0">
                          {(u.full_name ?? u.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground md:hidden truncate">{u.email}</p>
                          {/* Show status on mobile */}
                          <div className="sm:hidden mt-0.5">
                            <StatusBadge status={u.status} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground hidden md:table-cell">
                      <span className="truncate max-w-[200px] block">{u.email}</span>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 hidden xl:table-cell"><BranchBadge user={u} /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3 text-xs text-foreground hidden lg:table-cell">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailUser(u)}
                          title="Lihat detail"
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActionModal({ type: "role", user: u })}
                          title="Ubah role"
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActionModal({ type: "reset_password", user: u })}
                          title="Reset password"
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {u.status === "suspended" ? (
                          <button
                            onClick={() => setActionModal({ type: "activate", user: u })}
                            title="Aktifkan kembali"
                            className="p-1.5 rounded-lg hover:bg-[hsl(var(--status-available-bg))] text-muted-foreground hover:text-[hsl(var(--status-available-fg))] transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        ) : u.status === "active" ? (
                          <button
                            onClick={() => setActionModal({ type: "suspend", user: u })}
                            title="Nonaktifkan"
                            disabled={u.role === "super_admin" && users.filter((x) => x.role === "super_admin" && x.status === "active").length <= 1}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-border">
            <p className="text-xs text-foreground">{filtered.length} dari {users.length} akun</p>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detailUser && (
        <DetailDrawer
          user={detailUser}
          allUsers={users}
          onClose={() => setDetailUser(null)}
          onSuspend={() => setActionModal({ type: "suspend", user: detailUser })}
          onActivate={() => setActionModal({ type: "activate", user: detailUser })}
          onChangeRole={() => setActionModal({ type: "role", user: detailUser })}
          onResetPassword={() => setActionModal({ type: "reset_password", user: detailUser })}
        />
      )}

      {/* Action modals */}
      {actionModal?.type === "suspend" && (
        <ConfirmModal
          title="Nonaktifkan Akun?"
          description={`Akun ${actionModal.user.full_name ?? actionModal.user.email} tidak dapat mengakses sistem hingga diaktifkan kembali.`}
          confirmLabel="Nonaktifkan"
          variant="destructive"
          onConfirm={() => handleAction("suspend", actionModal.user)}
          onClose={() => setActionModal(null)}
        />
      )}
      {actionModal?.type === "activate" && (
        <ConfirmModal
          title="Aktifkan Kembali Akun?"
          description={`Akun ${actionModal.user.full_name ?? actionModal.user.email} akan dapat mengakses sistem sesuai role yang ditetapkan.`}
          confirmLabel="Aktifkan"
          variant="default"
          onConfirm={() => handleAction("activate", actionModal.user)}
          onClose={() => setActionModal(null)}
        />
      )}
      {actionModal?.type === "role" && (
        <ChangeRoleModal
          user={actionModal.user}
          onClose={() => setActionModal(null)}
          onSave={(role) => handleAction("role", actionModal.user, role)}
        />
      )}
      {actionModal?.type === "reset_password" && (
        <ConfirmModal
          title="Reset Password?"
          description={`Tautan reset password akan dikirim ke ${actionModal.user.email}. Pengguna perlu mengklik tautan tersebut untuk menetapkan password baru.`}
          confirmLabel="Kirim Email Reset"
          variant="default"
          icon={<Mail className="w-5 h-5 text-primary" />}
          onConfirm={() => handleAction("reset_password", actionModal.user)}
          onClose={() => setActionModal(null)}
        />
      )}

      {/* Create account modal */}
      {showCreateModal && (
        <CreateAccountModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); fetchUsers(); }}
        />
      )}
    </div>
  );
}

// ─── CreateAccountModal ────────────────────────────────────────────────────────
function CreateAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { role: callerRole, activeBranch, userBranches } = useAuth();
  const isSuperAdmin = callerRole === "super_admin";
  const isAdminBranch = callerRole === "admin_branch";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin_branch" | "employee" | "super_admin">("admin_branch");
  const [branchId, setBranchId] = useState<string>(activeBranch?.id ?? "");
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [creating, setCreating] = useState(false);

  // Available roles based on caller role
  const availableRoles: ("admin_branch" | "employee" | "super_admin")[] = isSuperAdmin
    ? ["admin_branch", "employee", "super_admin"]
    : ["employee"]; // admin_branch can only create employees for their branch

  // Fetch branches for super_admin
  useEffect(() => {
    if (!isSuperAdmin) {
      // Admin branch uses their own branches
      setBranches(userBranches.map(b => ({ id: b.id, name: b.name, code: b.code })));
      if (activeBranch) setBranchId(activeBranch.id);
      return;
    }
    setLoadingBranches(true);
    supabase.from("branches").select("id, name, code").eq("is_active", true).order("name")
      .then(({ data }) => {
        setBranches(data ?? []);
        setLoadingBranches(false);
      });
  }, [isSuperAdmin, userBranches, activeBranch]);

  // Reset role for admin_branch callers
  useEffect(() => {
    if (isAdminBranch && !availableRoles.includes(role)) {
      setRole("employee");
    }
  }, [isAdminBranch, role]);

  // Whether branch selection is needed
  const needsBranch = role === "admin_branch" || role === "employee";

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: "Email dan password wajib diisi.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password minimal 8 karakter.", variant: "destructive" });
      return;
    }
    if (needsBranch && !branchId) {
      toast({ title: "Pilih cabang terlebih dahulu.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-admin-account", {
      body: {
        full_name: fullName.trim() || undefined,
        email: email.trim(),
        password,
        role,
        branch_id: needsBranch ? branchId : undefined,
      },
    });
    setCreating(false);
    if (error || data?.error) {
      toast({ title: "Gagal membuat akun", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "Akun berhasil dibuat.", description: `${email} sudah bisa login sebagai ${ROLE_LABELS[role] ?? role}.` });
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Tambah Akun Baru</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Akun langsung aktif tanpa verifikasi email.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent ml-3 shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Role selector */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-2">Role</label>
            <div className={cn("grid gap-2", availableRoles.length === 1 ? "grid-cols-1" : availableRoles.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
              {availableRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    role === r
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-accent"
                  )}
                >
                  <Shield className={cn("w-3.5 h-3.5 shrink-0", role === r ? "text-primary" : "text-muted-foreground")} />
                  {ROLE_LABELS[r] ?? r}
                </button>
              ))}
            </div>
          </div>

          {/* Branch selector - shown for admin_branch and employee roles */}
          {needsBranch && (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Cabang <span className="text-destructive">*</span></label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={loadingBranches || (isAdminBranch && branches.length <= 1)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Pilih cabang…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
              {isAdminBranch && (
                <p className="text-[10px] text-muted-foreground mt-1">Anda hanya dapat menambahkan akun di cabang Anda sendiri.</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Nama Lengkap <span className="text-muted-foreground font-normal">(opsional)</span></label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama lengkap…"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Email <span className="text-destructive">*</span></label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Masukkan alamat email…"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Password <span className="text-destructive">*</span></label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 karakter…"
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Minimal 8 karakter. Sampaikan password ini ke pengguna secara aman.</p>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>Batal</Button>
          <Button className="flex-1 h-9 text-sm gap-1.5" onClick={handleCreate} disabled={creating}>
            {creating ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Buat Akun
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Approval Admin ────────────────────────────────────────────────────
function ApprovalAdminTab() {
  const { user, role: myRole, activeBranch } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = myRole === "super_admin";
  const isAdminBranch = myRole === "admin_branch";
  const [pending, setPending] = useState<(AdminUser & { requested_role?: string; requested_branch_id?: string; email_confirmed?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveModal, setApproveModal] = useState<AdminUser | null>(null);
  const [rejectModal, setRejectModal] = useState<AdminUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("user_profiles")
      .select("id, full_name, email, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const { data } = await query;
    let pendingUsers = (data ?? []) as AdminUser[];

    // Admin branch: filter only employees requested for their branch
    if (isAdminBranch && activeBranch) {
      // We can only show employees who requested this branch
      // Filter by checking user_branches (already assigned) or metadata-based
      // For now show all pending — approval edge function will handle branch assignment
    }

    setPending(pendingUsers);
    setLoading(false);
  }, [isAdminBranch, activeBranch]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (target: AdminUser) => {
    setProcessing(true);
    // Update status → active and assign admin role via edge function
    const { error } = await supabase.functions.invoke("approve-admin", {
      body: { 
        target_user_id: target.id, 
        action: "approve",
        approver_id: user?.id,
        approver_role: myRole,
      },
    });
    if (error) {
      toast({ title: "Gagal menyetujui akun", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Akun berhasil disetujui.", description: `${target.full_name ?? target.email} kini dapat mengakses sistem setelah memverifikasi email.` });
    }
    setApproveModal(null);
    setProcessing(false);
    fetchPending();
  };

  const handleReject = async (target: AdminUser) => {
    if (!rejectReason.trim()) {
      toast({ title: "Alasan penolakan wajib diisi.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    const { error } = await supabase.functions.invoke("approve-admin", {
      body: { target_user_id: target.id, action: "reject", approver_id: user?.id },
    });
    if (error) {
      toast({ title: "Gagal menolak akun", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Akun telah ditolak." });
    }
    setRejectModal(null);
    setRejectReason("");
    setProcessing(false);
    fetchPending();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Persetujuan Akun Admin</p>
          <p className="text-xs text-muted-foreground">
            {isAdminBranch
              ? "Setujui permintaan akses karyawan cabang Anda. Email verifikasi tetap diperlukan sebelum akun aktif."
              : "Tinjau dan setujui permintaan akses sistem. Anda bisa menyetujui sebelum pengguna verifikasi email."}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchPending}>
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Segarkan</span>
        </Button>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-16 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--status-available-bg))] flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-[hsl(var(--status-available-fg))]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Tidak ada permintaan persetujuan.</p>
            <p className="text-xs text-muted-foreground mt-1">Semua akun telah ditinjau.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Count badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[hsl(var(--status-reserved-bg))] text-[hsl(var(--status-reserved-fg))]">
              <Clock className="w-3 h-3" />
              {pending.length} menunggu persetujuan
            </span>
          </div>

          {/* Cards */}
          {pending.map((u) => (
            <div key={u.id} className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-sm font-bold flex items-center justify-center shrink-0">
                  {(u.full_name ?? u.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{u.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Daftar: {formatDate(u.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <RoleBadge role="admin_branch" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 text-[hsl(var(--status-minus-fg))] hover:text-[hsl(var(--status-minus-fg))] border-[hsl(var(--status-minus))]/30 hover:bg-[hsl(var(--status-minus-bg))]"
                  onClick={() => { setRejectModal(u); setRejectReason(""); }}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Tolak
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setApproveModal(u)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Setujui
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve modal */}
      {approveModal && (
        <ConfirmModal
          title="Setujui Akun?"
          description={`Setelah disetujui, ${approveModal.full_name ?? approveModal.email} dapat mengakses sistem sesuai role Admin yang ditetapkan.`}
          confirmLabel="Setujui"
          variant="default"
          loading={processing}
          icon={<CheckCircle2 className="w-5 h-5 text-[hsl(var(--status-available-fg))]" />}
          onConfirm={() => handleApprove(approveModal)}
          onClose={() => setApproveModal(null)}
        />
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !processing && setRejectModal(null)} />
          <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--status-minus-bg))] flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5 text-[hsl(var(--status-minus-fg))]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Tolak Permintaan?</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rejectModal.full_name ?? rejectModal.email} tidak akan dapat mengakses sistem.
                  </p>
                </div>
              </div>
              <button onClick={() => setRejectModal(null)} className="p-1 rounded-lg hover:bg-accent">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Alasan Penolakan <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Tuliskan alasan penolakan permintaan akses ini…"
                className="text-sm resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setRejectModal(null)} disabled={processing}>Batal</Button>
              <Button
                variant="destructive"
                className="flex-1 h-9 text-sm gap-1.5"
                onClick={() => handleReject(rejectModal)}
                disabled={processing || !rejectReason.trim()}
              >
                {processing ? <div className="w-3.5 h-3.5 border border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Tolak Permintaan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({
  user, allUsers, onClose, onSuspend, onActivate, onChangeRole, onResetPassword,
}: {
  user: AdminUser;
  allUsers: AdminUser[];
  onClose: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onChangeRole: () => void;
  onResetPassword: () => void;
}) {
  const isSoleActiveSuperAdmin =
    user.role === "super_admin" &&
    allUsers.filter((u) => u.role === "super_admin" && u.status === "active").length <= 1;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-card border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Detail Akun</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Avatar & name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-lg font-bold flex items-center justify-center shrink-0">
              {(user.full_name ?? user.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">{user.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground break-all">{user.email}</p>
            </div>
          </div>

          {/* Info grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">Status Akun</span>
              <span className="text-sm"><StatusBadge status={user.status} /></span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">Role</span>
              <span className="text-sm"><RoleBadge role={user.role} /></span>
            </div>
            <div className="flex items-start justify-between py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground mt-0.5">Cabang</span>
              <div className="flex-1 flex justify-end ml-4"><BranchBadge user={user} /></div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">Tanggal Registrasi</span>
              <span className="text-sm text-foreground">{formatDate(user.created_at)}</span>
            </div>
          </div>

          {/* Warning jika sole super admin */}
          {isSoleActiveSuperAdmin && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-[hsl(var(--status-reserved-bg))] border border-[hsl(var(--status-reserved))]/20">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-reserved-fg))] shrink-0 mt-0.5" />
              <p className="text-xs text-[hsl(var(--status-reserved-fg))]">
                Ini adalah satu-satunya Super Admin aktif. Role tidak dapat diubah dan akun tidak dapat dinonaktifkan.
              </p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground italic">
            Perubahan akses akan memengaruhi hak operasional pengguna.
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-border space-y-2 shrink-0">
          <Button variant="outline" className="w-full h-9 text-sm gap-2 justify-start" onClick={onChangeRole}>
            <Shield className="w-4 h-4" /> Ubah Role
          </Button>
          <Button variant="outline" className="w-full h-9 text-sm gap-2 justify-start" onClick={onResetPassword}>
            <KeyRound className="w-4 h-4" /> Reset Password
          </Button>
          {user.status === "active" ? (
            <Button
              variant="outline"
              className="w-full h-9 text-sm gap-2 justify-start text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={onSuspend}
              disabled={isSoleActiveSuperAdmin}
            >
              <Ban className="w-4 h-4" /> Nonaktifkan Akun
            </Button>
          ) : user.status === "suspended" ? (
            <Button variant="outline" className="w-full h-9 text-sm gap-2 justify-start" onClick={onActivate}>
              <CheckCircle2 className="w-4 h-4" /> Aktifkan Kembali
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ─── Change Role Modal ─────────────────────────────────────────────────────────
function ChangeRoleModal({
  user, onClose, onSave,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: (role: string) => void;
}) {
  const [selected, setSelected] = useState<string>(user.role ?? "admin_branch");
  const [saving, setSaving] = useState(false);

  const options = [
    { value: "super_admin", label: "Super Admin", desc: "Akses penuh ke seluruh modul sistem." },
    { value: "admin_branch", label: "Admin Cabang", desc: "Akses operasional—stok, opname, katalog per cabang." },
    { value: "employee", label: "Employee", desc: "Akses terbatas untuk operasional harian di cabang." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Ubah Role</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{user.full_name ?? user.email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                selected === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:bg-accent",
              )}
            >
              <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0", selected === opt.value ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                {selected === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {selected === "super_admin" && user.role !== "super_admin" && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[hsl(var(--status-reserved-bg))] border border-[hsl(var(--status-reserved))]/20">
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-reserved-fg))] shrink-0 mt-0.5" />
            <p className="text-xs text-[hsl(var(--status-reserved-fg))]">
              Pastikan pengguna memiliki otorisasi penuh untuk mengelola sistem sebelum menjadikannya Super Admin.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>Batal</Button>
          <Button
            className="flex-1 h-9 text-sm gap-1.5"
            disabled={saving || selected === user.role}
            onClick={async () => { setSaving(true); await onSave(selected); setSaving(false); }}
          >
            {saving ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Generic Confirm Modal ─────────────────────────────────────────────────────
function ConfirmModal({
  title, description, confirmLabel, variant, icon, loading = false, onConfirm, onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  variant: "default" | "destructive";
  icon?: React.ReactNode;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose} disabled={loading}>Batal</Button>
          <Button
            variant={variant}
            className="flex-1 h-9 text-sm gap-1.5"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <div className="w-3.5 h-3.5 border border-current/30 border-t-current rounded-full animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
