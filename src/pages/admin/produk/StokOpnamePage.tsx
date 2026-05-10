import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import {
  Plus, RefreshCw, ClipboardList, CheckCircle2,
  Lock, ChevronRight, ChevronDown, AlertTriangle, Search, Trash2,
  ArrowLeft, ShieldCheck, X, Info, Layers, ScanLine,
  UserCheck, CalendarClock, Users, ShoppingCart, Store, Globe,
  Building2, Filter, Clock, Settings2, ToggleLeft, ToggleRight, Timer,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ModalTabs } from "@/components/ui/modal-tabs";
import illusSun from "@/assets/illus-sun.png";
import illusMoon from "@/assets/illus-moon.png";
import { useBarcodeScanner } from "@/hooks/admin/use-barcode-scanner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/admin/laporan/activity-log";
import { useAuth } from "@/contexts/admin/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableDropdown } from "@/components/shared/SearchableDropdown";
import { useToast } from "@/hooks/shared/use-toast";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  OpnameSession, OpnameSnapshotItem, OpnameScannedItem,
  SessionType, SessionStatus, SnapshotActionTaken, ScannedActionTaken,
  SESSION_TYPE_LABELS, SESSION_STATUS_LABELS, SESSION_STATUS_STYLES,
  SESSION_TYPE_STYLES, SNAPSHOT_ACTION_LABELS, SCANNED_ACTION_LABELS,
  formatDate, formatDateShort,
} from "@/lib/admin/produk/opname";
import { formatCurrency } from "@/lib/admin/produk/stock-units";
import { cn } from "@/lib/utils";

// ─── Badge components ─────────────────────────────────────────────────────────
function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const s = SESSION_STATUS_STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", s.bg, s.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {SESSION_STATUS_LABELS[status]}
    </span>
  );
}

function SessionTypeBadge({ type }: { type: SessionType }) {
  const s = SESSION_TYPE_STYLES[type];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", s.bg, s.text)}>
      {SESSION_TYPE_LABELS[type]}
    </span>
  );
}

// ─── View state ────────────────────────────────────────────────────────────────
type View =
  | { type: "list" }
  | { type: "scan"; sessionId: string }
  | { type: "detail"; sessionId: string }
  | { type: "schedule" };

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StokOpnamePage() {
  const { role, user, activeBranch } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = role === "super_admin";
  const isAdminBranch = role === "admin_branch";
  const isEmployee = role === "employee";
  const [view, setView] = useState<View>({ type: "list" });

  if (view.type === "scan") {
    return (
      <ScanView
        sessionId={view.sessionId}
        onBack={() => setView({ type: "list" })}
        onComplete={(sid) => setView({ type: "detail", sessionId: sid })}
      />
    );
  }
  if (view.type === "detail") {
    return (
      <DetailView
        sessionId={view.sessionId}
        isSuperAdmin={isSuperAdmin}
        onBack={() => setView({ type: "list" })}
      />
    );
  }
  if (view.type === "schedule") {
    return (
      <ScheduleView
        branchId={activeBranch?.id ?? ""}
        branchName={activeBranch?.name ?? ""}
        onBack={() => setView({ type: "list" })}
      />
    );
  }

  return (
    <SessionListView
      userId={user?.id}
      isSuperAdmin={isSuperAdmin}
      isAdminBranch={isAdminBranch}
      isEmployee={isEmployee}
      activeBranchId={activeBranch?.id ?? null}
      activeBranchName={activeBranch?.name ?? null}
      onStartScan={(sid) => setView({ type: "scan", sessionId: sid })}
      onViewDetail={(sid, status) =>
        status === "draft"
          ? setView({ type: "scan", sessionId: sid })
          : setView({ type: "detail", sessionId: sid })
      }
      onGoToSchedule={() => setView({ type: "schedule" })}
      toast={toast}
    />
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminProfile { id: string; full_name: string | null; email: string; branch_name?: string; role?: string }
interface SessionWithAssignees extends OpnameSession {
  assignees?: AdminProfile[];
  branch_name?: string;
}
interface BranchInfo { id: string; name: string; code: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function groupByDate(sessions: SessionWithAssignees[]): { dateKey: string; label: string; sessions: SessionWithAssignees[] }[] {
  const map = new Map<string, SessionWithAssignees[]>();
  for (const s of sessions) {
    const key = s.started_at.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).map(([dateKey, sessions]) => ({
    dateKey,
    label: new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(dateKey)),
    sessions,
  }));
}

function isTodayStr(dateStr: string) {
  const today = new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
  const d = new Date(dateStr).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
  return today === d;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─── SessionListView ──────────────────────────────────────────────────────────
function SessionListView({
  userId, isSuperAdmin, isAdminBranch, isEmployee, activeBranchId, activeBranchName,
  onStartScan, onViewDetail, onGoToSchedule, toast,
}: {
  userId?: string;
  isSuperAdmin: boolean;
  isAdminBranch: boolean;
  isEmployee: boolean;
  activeBranchId: string | null;
  activeBranchName: string | null;
  onStartScan: (id: string) => void;
  onViewDetail: (id: string, status: SessionStatus) => void;
  onGoToSchedule: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const canCreateSession = isSuperAdmin || isAdminBranch;
  const [activeTab, setActiveTab] = useState<"terkini" | "lampau">("terkini");
  const [sessions, setSessions] = useState<SessionWithAssignees[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [expectedCount, setExpectedCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<SessionType>("opening");
  const [newNotes, setNewNotes] = useState("");
  const [adminList, setAdminList] = useState<AdminProfile[]>([]);
  const [filteredAdminList, setFilteredAdminList] = useState<AdminProfile[]>([]);
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
  const [assignModalSession, setAssignModalSession] = useState<SessionWithAssignees | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modalTab, setModalTab] = useState<"info" | "petugas" | "catatan">("info");
  // Whether jenis sesi is pre-determined (clicked from Opening/Closing card)
  const [newTypeLocked, setNewTypeLocked] = useState(false);
  // Late threshold (hours + minutes after start time)
  const [lateHours, setLateHours] = useState<string>("1");
  const [lateMinutes, setLateMinutes] = useState<string>("0");

  // Super admin branch filter
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  // Super admin: selected branch when creating a new session
  const [newSessionBranchId, setNewSessionBranchId] = useState<string>("");
  // Time input for session start
  const [newSessionTime, setNewSessionTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  // Missing branches accordion — collapsed by default
  const [missingBranchesOpen, setMissingBranchesOpen] = useState(false);

  const fetchBranches = useCallback(async () => {
    if (!isSuperAdmin) return;
    const { data } = await supabase.from("branches").select("id, name, code").eq("is_active", true).order("name");
    setBranches((data ?? []) as BranchInfo[]);
  }, [isSuperAdmin]);

  const fetchAdmins = useCallback(async (branchIdForFilter?: string) => {
    // Only fetch users with role "employee" (bukan admin_branch agar admin cabang tdk pilih dirinya sendiri)
    if (isAdminBranch && activeBranchId) {
      const { data: branchUsers } = await supabase
        .from("user_branches")
        .select("user_id")
        .eq("branch_id", activeBranchId);
      if (!branchUsers || branchUsers.length === 0) { setAdminList([]); setFilteredAdminList([]); return; }
      const userIds = branchUsers.map((bu: any) => bu.user_id);
      // Only employees (bukan admin_branch)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "employee")
        .in("user_id", userIds);
      if (!roles || roles.length === 0) { setAdminList([]); setFilteredAdminList([]); return; }
      const ids = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", ids)
        .eq("status", "active");
      const list = (profiles ?? []).map((p: any) => ({ ...p, branch_name: activeBranchName ?? undefined, role: "employee" })) as (AdminProfile & { role: string })[];
      setAdminList(list as AdminProfile[]);
      setFilteredAdminList(list as AdminProfile[]);
    } else if (isSuperAdmin) {
      // Super admin: fetch only employees with their branch names
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("role", "employee");
      if (!roles || roles.length === 0) { setAdminList([]); setFilteredAdminList([]); return; }
      const ids = roles.map((r) => r.user_id);
      const roleByUser: Record<string, string> = {};
      for (const r of roles as { user_id: string; role: string }[]) roleByUser[r.user_id] = r.role;
      const { data: profiles } = await supabase.from("user_profiles").select("id, full_name, email").in("id", ids).eq("status", "active");
      // Fetch branch assignments for these users
      const { data: userBranches } = await supabase
        .from("user_branches")
        .select("user_id, branch_id, branches:branch_id(id, name)")
        .in("user_id", ids)
        .eq("is_default", true);
      const branchByUser: Record<string, string> = {};
      for (const ub of (userBranches ?? []) as any[]) {
        if (ub.branches?.name) branchByUser[ub.user_id] = ub.branches.name;
      }
      const list = ((profiles ?? []) as AdminProfile[]).map((p) => ({ ...p, branch_name: branchByUser[p.id], role: roleByUser[p.id] ?? "employee" }));
      setAdminList(list as AdminProfile[]);
      // Filter by selected branch if provided
      if (branchIdForFilter) {
        const { data: branchUsers } = await supabase
          .from("user_branches")
          .select("user_id")
          .eq("branch_id", branchIdForFilter);
        const branchUserIds = new Set((branchUsers ?? []).map((bu: any) => bu.user_id));
        setFilteredAdminList((list as AdminProfile[]).filter((p) => branchUserIds.has(p.id)));
      } else {
        setFilteredAdminList([]);
      }
    }
  }, [isSuperAdmin, isAdminBranch, activeBranchId, activeBranchName]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("opname_sessions").select("*").order("started_at", { ascending: false });

    // Branch scoping
    if (!isSuperAdmin && activeBranchId) {
      query = query.eq("branch_id", activeBranchId);
    }

    const { data: sessData } = await query;
    const list = (sessData as (OpnameSession & { branch_id?: string })[]) ?? [];

    // Get branch names for super admin
    let branchMap: Record<string, string> = {};
    if (isSuperAdmin) {
      const branchIds = [...new Set(list.map((s: any) => s.branch_id).filter(Boolean))];
      if (branchIds.length > 0) {
        const { data: branchData } = await supabase.from("branches").select("id, name").in("id", branchIds);
        for (const b of (branchData ?? []) as { id: string; name: string }[]) {
          branchMap[b.id] = b.name;
        }
      }
    }

    // Batch-fetch all assignments + profiles in 2 queries (avoid N+1)
    const sessionIds = list.map((s) => s.id);
    const [allAssignRes, ] = await Promise.all([
      sessionIds.length > 0
        ? supabase.from("opname_session_assignments" as never).select("session_id, admin_id").in("session_id" as never, sessionIds)
        : Promise.resolve({ data: [] }),
    ]);
    const allAssignments = (allAssignRes.data ?? []) as { session_id: string; admin_id: string }[];
    const allAdminIds = [...new Set(allAssignments.map((a) => a.admin_id))];
    const allProfilesRes = allAdminIds.length > 0
      ? await supabase.from("user_profiles").select("id, full_name, email").in("id", allAdminIds)
      : { data: [] };
    const profileMap = new Map(((allProfilesRes.data ?? []) as AdminProfile[]).map((p) => [p.id, p]));
    const assignmentsBySession = new Map<string, AdminProfile[]>();
    for (const a of allAssignments) {
      if (!assignmentsBySession.has(a.session_id)) assignmentsBySession.set(a.session_id, []);
      const profile = profileMap.get(a.admin_id);
      if (profile) assignmentsBySession.get(a.session_id)!.push(profile);
    }

    const withAssignees: SessionWithAssignees[] = list.map((s) => ({
      ...s,
      assignees: assignmentsBySession.get(s.id) ?? [],
      branch_name: branchMap[(s as any).branch_id] ?? undefined,
    }));
    setSessions(withAssignees);
    setLoading(false);
  }, [isSuperAdmin, activeBranchId]);

  const fetchExpected = useCallback(async () => {
    let query = supabase.from("stock_units").select("*", { count: "exact", head: true }).eq("stock_status", "available");
    if (!isSuperAdmin && activeBranchId) {
      query = query.eq("branch_id", activeBranchId);
    }
    const { count } = await query;
    setExpectedCount(count ?? 0);
  }, [isSuperAdmin, activeBranchId]);

  useEffect(() => {
    fetchSessions();
    fetchExpected();
    if (canCreateSession) fetchAdmins();
    if (isSuperAdmin) fetchBranches();
  }, [fetchSessions, fetchExpected, fetchAdmins, fetchBranches, canCreateSession, isSuperAdmin]);

  // Check daily session limit for current branch
  const todayKey = getTodayKey();
  const allTodaySessions = sessions.filter((s) => isTodayStr(s.started_at));

  // For admin_branch: their branch's sessions today
  const branchTodaySessions = isAdminBranch
    ? allTodaySessions.filter((s) => (s as any).branch_id === activeBranchId)
    : allTodaySessions;

  const todaySessionCount = branchTodaySessions.length;
  const canCreateMore = todaySessionCount < 2;
  const todayHasOpening = branchTodaySessions.some((s) => s.session_type === "opening");
  const todayHasClosing = branchTodaySessions.some((s) => s.session_type === "closing");

  // Super admin filtering
  const filteredSessions = isSuperAdmin
    ? sessions.filter((s) => {
        const branchMatch = !filterBranchId || (s as any).branch_id === filterBranchId;
        const searchMatch = !searchQuery || 
          s.session_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.branch_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.assignees?.some((a) => (a.full_name ?? a.email).toLowerCase().includes(searchQuery.toLowerCase()));
        return branchMatch && searchMatch;
      })
    : sessions;

  const todaySessions = filteredSessions.filter((s) => isTodayStr(s.started_at));
  const pastSessions = filteredSessions.filter((s) => !isTodayStr(s.started_at));
  const pastGroups = groupByDate(pastSessions);

  // Super admin: branches that haven't created sessions today
  const branchesWithSessionToday = isSuperAdmin
    ? [...new Set(allTodaySessions.map((s) => (s as any).branch_id).filter(Boolean))]
    : [];
  const branchesMissingToday = isSuperAdmin
    ? branches.filter((b) => !branchesWithSessionToday.includes(b.id))
    : [];

  const handleCreateSession = async () => {
    if (!userId) return;
    // For super admin, branch selection is required
    const effectiveBranchId = isSuperAdmin ? newSessionBranchId : activeBranchId;
    if (isSuperAdmin && !effectiveBranchId) {
      toast({ title: "Cabang wajib dipilih", description: "Pilih cabang untuk sesi stok opname ini.", variant: "destructive" });
      return;
    }
    if (selectedAdminIds.length === 0) {
      toast({ title: "Petugas wajib dipilih", description: "Pilih minimal 1 petugas sebelum membuat sesi.", variant: "destructive" });
      return;
    }
    if (!canCreateMore) {
      toast({ title: "Batas sesi tercapai", description: "Maksimal 2 sesi stok opname per hari per cabang.", variant: "destructive" });
      return;
    }

    setCreating(true);

    // Determine branch_id
    const branchId = effectiveBranchId;

    // Build started_at using today's local date + chosen time (avoid UTC shift)
    const now = new Date();
    const [hh, mm] = newSessionTime.split(":").map(Number);
    const startedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);

    const { data: sess, error: sessErr } = await supabase
      .from("opname_sessions")
      .insert({
        session_type: newType,
        notes: newNotes || null,
        created_by: userId,
        total_expected: expectedCount,
        branch_id: branchId,
        started_at: startedAt.toISOString(),
      } as never)
      .select().single();
    if (sessErr || !sess) {
      toast({ title: "Gagal membuat sesi", description: sessErr?.message, variant: "destructive" });
      setCreating(false);
      return;
    }
    const sessionId = (sess as { id: string }).id;

    const assignRows = selectedAdminIds.map((adminId) => ({ session_id: sessionId, admin_id: adminId, assigned_by: userId }));
    await supabase.from("opname_session_assignments" as never).insert(assignRows as never);

    // Snapshot only "available" units from this branch
    let unitQuery = supabase
      .from("stock_units")
      .select("id, imei, stock_status, selling_price, cost_price, master_products(series, storage_gb, color, warranty_type)")
      .eq("stock_status", "available");
    if (branchId) {
      unitQuery = unitQuery.eq("branch_id", branchId);
    }
    const { data: units } = await unitQuery;

    if (units && units.length > 0) {
      const snapshotRows = (units as never[]).map((u: never) => {
        const unit = u as { id: string; imei: string; stock_status: string; selling_price: number | null; cost_price: number | null; master_products?: { series?: string; storage_gb?: number; color?: string; warranty_type?: string } };
        const mp = unit.master_products;
        const label = mp ? `${mp.series} ${mp.storage_gb}GB — ${mp.color} (${(mp.warranty_type ?? "").replace(/_/g, " ")})` : unit.imei;
        return { session_id: sessionId, unit_id: unit.id, imei: unit.imei, product_label: label, selling_price: unit.selling_price, cost_price: unit.cost_price, stock_status: unit.stock_status, scan_result: "missing" };
      });
      await supabase.from("opname_snapshot_items").insert(snapshotRows as never);
    }
    toast({ title: "Sesi berhasil dimulai", description: `Snapshot ${expectedCount} unit tersedia berhasil dibuat.` });
    logActivity({ action: "create_opname_session", actor_id: userId, actor_role: isSuperAdmin ? "super_admin" : isAdminBranch ? "admin_branch" : "employee", metadata: { session_id: sessionId, type: newType, branch_id: branchId } });
    setCreating(false);
    setNewSessionOpen(false);
    setNewNotes("");
    setSelectedAdminIds([]);
    setNewSessionBranchId("");
    setNewTypeLocked(false);
    const now2 = new Date();
    setNewSessionTime(`${String(now2.getHours()).padStart(2, "0")}:${String(now2.getMinutes()).padStart(2, "0")}`);
    onStartScan(sessionId);
  };

  const handleSaveAssignees = async (sessionId: string, adminIds: string[]) => {
    if (!userId) return;
    await supabase.from("opname_session_assignments" as never).delete().eq("session_id" as never, sessionId);
    if (adminIds.length > 0) {
      const rows = adminIds.map((aid) => ({ session_id: sessionId, admin_id: aid, assigned_by: userId }));
      await supabase.from("opname_session_assignments" as never).insert(rows as never);
    }
    toast({ title: "Penugasan petugas berhasil disimpan." });
    setAssignModalSession(null);
    fetchSessions();
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeleting(true);
    await supabase.from("opname_session_assignments" as never).delete().eq("session_id" as never, sessionId);
    await supabase.from("opname_scanned_items" as never).delete().eq("session_id" as never, sessionId);
    await supabase.from("opname_snapshot_items").delete().eq("session_id", sessionId);
    const { error } = await supabase.from("opname_sessions").delete().eq("id", sessionId);
    if (error) toast({ title: "Gagal menghapus sesi", description: error.message, variant: "destructive" });
    else toast({ title: "Sesi berhasil dihapus." });
    setDeleteConfirmId(null);
    setDeleting(false);
    fetchSessions();
  };

  const toggleAdminSelect = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const renderSessionRow = (s: SessionWithAssignees) => {
    const selisih = s.total_missing + s.total_unregistered;
    const isAssignedToMe = s.assignees?.some((a) => a.id === userId);
    const canScan = isSuperAdmin || isAdminBranch || isAssignedToMe;
    // Admin branch can delete/edit only before start time (session not started = draft & now < started_at)
    const sessionStartTime = new Date(s.started_at);
    const isBeforeStartTime = new Date() < sessionStartTime;
    const canAdminBranchDelete = isAdminBranch && s.session_status === "draft" && isBeforeStartTime;
    const canDelete = isSuperAdmin || canAdminBranchDelete;
    return (
      <tr key={s.id} className="hover:bg-accent/30 transition-colors">
        <td className="px-4 py-3">
          <p className="text-sm text-foreground">{new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(s.started_at))}</p>
        </td>
        <td className="px-4 py-3"><SessionTypeBadge type={s.session_type} /></td>
        {isSuperAdmin && (
          <td className="px-4 py-3 hidden lg:table-cell">
            <span className="text-xs text-foreground font-medium">{s.branch_name ?? "—"}</span>
          </td>
        )}
        <td className="px-4 py-3 hidden md:table-cell">
          <div className="flex items-center gap-1.5">
            {s.assignees && s.assignees.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {s.assignees.slice(0, 2).map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-[8px] font-bold flex items-center justify-center shrink-0">
                      {(a.full_name ?? a.email).slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs text-foreground truncate max-w-[100px]">{a.full_name ?? a.email.split("@")[0]}</span>
                  </div>
                ))}
                {s.assignees.length > 2 && <span className="text-[10px] text-muted-foreground">+{s.assignees.length - 2} lainnya</span>}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">Belum ada</span>
            )}
            {(isSuperAdmin || isAdminBranch) && (
              <button onClick={() => setAssignModalSession(s)} title="Atur petugas" className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors ml-1">
                <UserCheck className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>

        <td className="px-4 py-3 text-sm text-[hsl(var(--status-available-fg))] font-medium hidden sm:table-cell">{s.total_match}</td>
        <td className="px-4 py-3">
          {selisih > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--status-minus-fg))]">
              <AlertTriangle className="w-3 h-3" /> {selisih}
            </span>
          ) : (
            <span className="text-xs text-[hsl(var(--status-available-fg))]">—</span>
          )}
        </td>
        <td className="px-4 py-3"><SessionStatusBadge status={s.session_status} /></td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {canScan ? (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => onViewDetail(s.id, s.session_status)}>
                {s.session_status === "draft" ? "Lanjut Scan" : "Lihat Detail"}
                <ChevronRight className="w-3 h-3" />
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">Tidak ada akses</span>
            )}
            {canDelete && (
              <button onClick={() => setDeleteConfirmId(s.id)} title="Hapus sesi" className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const sessionTableCols = (
    <tr className="border-b border-border bg-muted/40">
      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Jam</th>
      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Jenis</th>
      {isSuperAdmin && <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Cabang</th>}
      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Petugas</th>
      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Cocok</th>
      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Selisih</th>
      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground text-right">Aksi</th>
    </tr>
  );

  return (
    <DashboardLayout pageTitle="Stok Opname">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Stok Opname</h1>
            <p className="text-xs text-muted-foreground">
              Verifikasi stok fisik di etalase dengan data unit di sistem.
              {isAdminBranch && activeBranchName && (
                <span className="ml-1 font-medium text-foreground">— {activeBranchName}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => { fetchSessions(); fetchExpected(); }}>
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Segarkan</span>
            </Button>
            {isAdminBranch && (
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={onGoToSchedule}>
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Jadwal</span>
              </Button>
            )}
            {canCreateSession && (
              <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={() => { setNewTypeLocked(false); setNewSessionOpen(true); }} disabled={!canCreateMore}>
                <Plus className="w-3.5 h-3.5" /> Mulai Sesi Baru
              </Button>
            )}
          </div>
        </div>

        {/* Session limit warning */}
        {canCreateSession && !canCreateMore && (
          <div className="rounded-xl bg-[hsl(var(--status-reserved-bg))] border border-[hsl(var(--status-reserved))]/30 px-4 py-3 flex items-center gap-3">
            <Info className="w-4 h-4 text-[hsl(var(--status-reserved-fg))] shrink-0" />
            <p className="text-xs text-[hsl(var(--status-reserved-fg))]">
              Batas maksimal 2 sesi per hari telah tercapai. Sesi baru bisa dibuat besok.
            </p>
          </div>
        )}

        {/* Super Admin: Branch filter + search + tabs inline */}
        {isSuperAdmin && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              {/* Branch dropdown */}
              <SearchableDropdown
                compact
                showAllOption
                allLabel="Semua Cabang"
                options={branches}
                value={filterBranchId || "all"}
                onChange={(v) => setFilterBranchId(v === "all" ? "" : v)}
                placeholder="Pilih cabang…"
                searchPlaceholder="Cari cabang..."
                align="left"
                triggerClassName="w-44 shrink-0"
              />

              {/* Tab switcher — pill style, LEFT of search */}
              <div className="flex items-center gap-1 shrink-0 border border-border rounded-lg p-0.5 bg-muted/40">
                {(["terkini", "lampau"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all",
                      activeTab === tab
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab === "terkini" ? "Terkini" : "Lampau"}
                  </button>
                ))}
              </div>

              {/* Search bar — wider */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="h-9 text-xs pl-8 w-full"
                  placeholder="Cari petugas, jenis sesi…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Branches missing sessions today — orange accordion, collapsed by default */}
            {branchesMissingToday.length > 0 && (
              <div className="rounded-xl bg-[hsl(var(--status-reserved-bg))] border border-[hsl(var(--status-reserved))]/40 overflow-hidden">
                <button
                  onClick={() => setMissingBranchesOpen((v) => !v)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--status-reserved-fg))] shrink-0" />
                  <p className="text-xs font-semibold text-[hsl(var(--status-reserved-fg))] flex-1">
                    {branchesMissingToday.length} cabang belum membuat sesi opname hari ini
                  </p>
                  <ChevronDown className={cn(
                    "w-3.5 h-3.5 text-[hsl(var(--status-reserved-fg))] transition-transform duration-200 shrink-0",
                    missingBranchesOpen ? "rotate-180" : ""
                  )} />
                </button>
                {missingBranchesOpen && (
                  <div className="px-4 pb-3.5 space-y-2.5 border-t border-[hsl(var(--status-reserved))]/20 pt-3">
                    <p className="text-xs text-[hsl(var(--status-reserved-fg))]/80">
                      Klik nama cabang untuk melihat detail dan memulai sesi.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {branchesMissingToday.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setFilterBranchId(b.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                        >
                          <Building2 className="w-3 h-3" />
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab switcher + search for non-superadmin */}
        {!isSuperAdmin && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 shrink-0 border border-border rounded-lg p-0.5 bg-muted/40">
              {(["terkini", "lampau"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    activeTab === tab
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "terkini" ? "Terkini" : "Lampau"}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="h-9 text-xs pl-8 w-full"
                placeholder="Cari petugas, jenis sesi…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : activeTab === "terkini" ? (
          <div className="space-y-4">
            {/* Status cards — tampil hanya kalau KEDUA sesi belum ada hari ini */}
            {canCreateSession && !todayHasOpening && !todayHasClosing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* ── Opening card ── */}
                <div className="rounded-2xl border overflow-hidden relative" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                    {/* Decorative sun illustration */}
                    <div className="absolute top-3 right-3 w-24 h-24 pointer-events-none select-none">
                      <img src={illusSun} alt="" className="w-full h-full object-contain drop-shadow-sm opacity-80" />
                    </div>
                    <div className="relative p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#fef3c7' }}>
                          <CalendarClock className="w-5 h-5" style={{ color: '#d97706' }} />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xl font-semibold uppercase tracking-tight leading-none" style={{ color: '#111827' }}>Store Opening</p>
                          <p className="text-sm font-medium" style={{ color: '#b45309' }}>Belum ada sesi hari ini</p>
                          <p className="text-xs" style={{ color: '#6b7280' }}>Mulai sesi untuk verifikasi stok awal hari.</p>
                        </div>
                      </div>
                      {canCreateMore && (
                        <button
                          onClick={() => { setNewType("opening"); setNewTypeLocked(true); setNewSessionOpen(true); }}
                          className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors shadow-sm"
                          style={{ backgroundColor: '#ffffff', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', color: '#111827' }}
                        >
                          <Plus className="w-4 h-4" />
                          Buat Sesi Opening
                        </button>
                      )}
                    </div>
                </div>

                {/* ── Closing card ── */}
                <div className="rounded-2xl border overflow-hidden relative" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                    {/* Decorative moon illustration */}
                    <div className="absolute top-3 right-3 w-24 h-24 pointer-events-none select-none">
                      <img src={illusMoon} alt="" className="w-full h-full object-contain drop-shadow-sm opacity-70" />
                    </div>
                    <div className="relative p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5e7eb' }}>
                          <Lock className="w-5 h-5" style={{ color: '#6b7280' }} />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xl font-semibold uppercase tracking-tight leading-none" style={{ color: '#111827' }}>Store Closing</p>
                          <p className="text-sm font-medium" style={{ color: '#6b7280' }}>Belum ada sesi hari ini</p>
                          <p className="text-xs" style={{ color: '#9ca3af' }}>Lakukan sesi closing sebelum toko tutup.</p>
                        </div>
                      </div>
                      {canCreateMore && (
                        <button
                          onClick={() => { setNewType("closing"); setNewTypeLocked(true); setNewSessionOpen(true); }}
                          className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors shadow-sm"
                          style={{ backgroundColor: '#ffffff', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', color: '#111827' }}
                        >
                          <Plus className="w-4 h-4" />
                          Buat Sesi Closing
                        </button>
                      )}
                    </div>
                </div>

              </div>
            )}

            {todaySessions.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                  <ClipboardList className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Belum ada sesi hari ini.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {canCreateSession ? "Gunakan tombol di atas untuk membuat sesi baru." : "Belum ada sesi yang ditugaskan hari ini."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                  <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">
                    {new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(todayKey))}
                  </p>
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">Hari ini</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>{sessionTableCols}</thead>
                    <tbody className="divide-y divide-border">
                      {todaySessions.map(renderSessionRow)}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t border-border">
                  <p className="text-xs text-muted-foreground">{todaySessions.length} sesi hari ini</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {pastGroups.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                  <Layers className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Belum ada riwayat sesi.</p>
                  <p className="text-xs text-muted-foreground mt-1">Sesi dari hari-hari sebelumnya akan muncul di sini.</p>
                </div>
              </div>
            ) : (
              pastGroups.map((group) => (
                <div key={group.dateKey} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                    <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">{group.label}</p>
                    <span className="ml-auto text-[10px] text-muted-foreground">{group.sessions.length} sesi</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>{sessionTableCols}</thead>
                      <tbody className="divide-y divide-border">
                        {group.sessions.map(renderSessionRow)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── New session modal (tabbed) ── */}
      {newSessionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setNewSessionOpen(false)} />
          <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md flex flex-col" style={{ height: "min(600px, 92vh)" }}>
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">Mulai Sesi Baru</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Snapshot diambil dari unit berstatus "Tersedia"
                  {isAdminBranch && activeBranchName && ` di ${activeBranchName}`}.
                </p>
              </div>
              <button onClick={() => { setNewSessionOpen(false); setNewTypeLocked(false); }} className="p-1 rounded-lg hover:bg-accent shrink-0 ml-3">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {/* Tabs */}
            <div className="px-4 pt-3 pb-3 shrink-0 border-b border-border">
              <ModalTabs
                active={modalTab}
                onChange={(k) => setModalTab(k as typeof modalTab)}
                tabs={[
                  { key: "info", label: "Info & Waktu" },
                  {
                    key: "petugas",
                    label: (
                      <span className="flex items-center gap-1.5">
                        Petugas
                        {selectedAdminIds.length > 0 && (
                          <span className="bg-white/20 dark:bg-gray-900/20 rounded-full px-1.5 py-px text-[9px] font-bold leading-none">
                            {selectedAdminIds.length}
                          </span>
                        )}
                      </span>
                    ),
                  },
                  { key: "catatan", label: "Catatan" },
                ]}
              />
            </div>
            {/* Tab content - fixed height scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
              {modalTab === "info" && (<>
                {isSuperAdmin && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">Cabang <span className="text-destructive">*</span></label>
                    <SearchableDropdown
                      options={branches}
                      value={newSessionBranchId || null}
                      onChange={(v) => {
                        setNewSessionBranchId(v); setSelectedAdminIds([]);
                        supabase.from("stock_units").select("*", { count: "exact", head: true }).eq("stock_status", "available").eq("branch_id", v).then(({ count }) => setExpectedCount(count ?? 0));
                        fetchAdmins(v);
                      }}
                      placeholder="Pilih cabang untuk sesi ini..."
                      searchPlaceholder="Cari cabang..."
                      align="left"
                      triggerClassName="w-full min-w-0 max-w-full"
                    />
                    {!newSessionBranchId && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Cabang wajib dipilih sebelum membuat sesi.</p>}
                  </div>
                )}
                <div className="rounded-xl bg-[hsl(var(--status-available-bg))] border border-[hsl(var(--status-available))]/20 px-4 py-3 flex items-center gap-3">
                  <Info className="w-4 h-4 text-[hsl(var(--status-available-fg))] shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--status-available-fg))]">Unit Tersedia di Sistem</p>
                    <p className="text-xl font-bold text-foreground">{expectedCount} unit</p>
                    <p className="text-[10px] text-muted-foreground">Hanya unit berstatus "Tersedia" yang di-snapshot{isSuperAdmin && newSessionBranchId && <span> — {branches.find(b => b.id === newSessionBranchId)?.name}</span>}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div><p className="text-xs font-medium text-foreground">Sesi Hari Ini: {todaySessionCount}/2</p><p className="text-[10px] text-muted-foreground">Maksimal 2 sesi per hari per cabang</p></div>
                </div>
                {newTypeLocked ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-muted/40 flex-1">
                      {newType === "opening"
                        ? <img src={illusSun} alt="" className="w-6 h-6 object-contain" />
                        : <img src={illusMoon} alt="" className="w-6 h-6 object-contain" />
                      }
                      <span className="text-sm font-semibold text-foreground">
                        Sesi {newType === "opening" ? "Opening" : newType === "closing" ? "Closing" : "Ad-Hoc"}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">sudah dipilih</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">Jenis Sesi</label>
                    <Select value={newType} onValueChange={(v) => setNewType(v as SessionType)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opening" disabled={todayHasOpening}>Opening {todayHasOpening ? "(sudah ada)" : ""}</SelectItem>
                        <SelectItem value="closing" disabled={todayHasClosing}>Closing {todayHasClosing ? "(sudah ada)" : ""}</SelectItem>
                        <SelectItem value="adhoc">Ad-Hoc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">Jam Mulai</label>
                  <input type="time" value={newSessionTime} onChange={(e) => setNewSessionTime(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  <p className="text-[10px] text-muted-foreground mt-1">Tanggal otomatis: hari ini</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Toleransi Keterlambatan</p>
                      <p className="text-[10px] text-muted-foreground">Dianggap telat jika belum mulai scan setelah durasi ini</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">Jam</label>
                      <input type="number" min="0" max="23" value={lateHours} onChange={(e) => setLateHours(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                    <span className="text-sm text-muted-foreground pb-1">:</span>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">Menit</label>
                      <input type="number" min="0" max="59" value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                    <p className="text-xs text-muted-foreground pb-1 whitespace-nowrap">setelah mulai</p>
                  </div>
                </div>
              </>)}
              {modalTab === "petugas" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0"><Users className="w-3.5 h-3.5 text-muted-foreground" /></div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Penugasan Petugas <span className="text-destructive">*</span></p>
                      <p className="text-[10px] text-muted-foreground">
                        {isSuperAdmin && !newSessionBranchId
                          ? "Pilih cabang di tab Info & Waktu terlebih dahulu"
                          : "Pilih minimal 1 karyawan — hanya role Karyawan yang bisa dipilih"}
                      </p>
                    </div>
                    {selectedAdminIds.length > 0 && <span className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{selectedAdminIds.length} dipilih</span>}
                  </div>
                  {isSuperAdmin && !newSessionBranchId ? (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-[hsl(var(--status-reserved-bg))] border border-[hsl(var(--status-reserved))]/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--status-reserved-fg))] shrink-0" />
                      <p className="text-xs text-[hsl(var(--status-reserved-fg))]">Pilih cabang terlebih dahulu untuk melihat daftar petugas.</p>
                    </div>
                  ) : (isSuperAdmin ? filteredAdminList : adminList).length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border">
                      <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><p className="text-xs text-muted-foreground">Belum ada karyawan aktif di cabang ini.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(isSuperAdmin ? filteredAdminList : adminList).map((admin) => {
                        const checked = selectedAdminIds.includes(admin.id);
                        const roleLabel = (admin as any).role === "employee" ? "Karyawan" : "Admin Cabang";
                        return (
                          <button key={admin.id} type="button" onClick={() => toggleAdminSelect(admin.id, selectedAdminIds, setSelectedAdminIds)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all shadow-sm",
                              checked
                                ? "border-primary bg-primary/5"
                                : "border-border bg-white dark:bg-card hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-accent"
                            )}
                          >
                            {/* Checkbox */}
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              checked ? "bg-primary border-primary" : "border-gray-300 dark:border-muted-foreground/40"
                            )}>
                              {checked && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                            </div>

                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-gray-900 dark:bg-sidebar-accent text-white dark:text-sidebar-accent-foreground text-xs font-bold flex items-center justify-center shrink-0">
                              {(admin.full_name ?? admin.email).slice(0, 2).toUpperCase()}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                                {admin.full_name ?? admin.email}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground leading-none">
                                  {roleLabel}
                                </span>
                                {admin.branch_name && (
                                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 leading-none">
                                    <Building2 className="w-3 h-3 shrink-0" />
                                    {admin.branch_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {modalTab === "catatan" && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-muted/50 border border-border px-4 py-3">
                    <p className="text-xs font-medium text-foreground mb-1">Apa itu Catatan?</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Catatan akan ditampilkan di halaman detail sesi dan laporan stok opname. Gunakan untuk mencatat kondisi khusus, konteks, atau instruksi tambahan untuk petugas yang bertugas di sesi ini.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">Catatan <span className="text-muted-foreground font-normal">(opsional)</span></label>
                    <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Contoh: Periksa area etalase kanan, ada unit yang baru masuk dari Surabaya hari ini…" className="text-sm resize-none" rows={6} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-6 pb-5 pt-3 border-t border-border shrink-0">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setNewSessionOpen(false)}>Batal</Button>
              <Button className="flex-1 h-9 text-sm gap-1.5" onClick={handleCreateSession} disabled={creating || selectedAdminIds.length === 0 || (isSuperAdmin && !newSessionBranchId)}>
                {creating ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Mulai Sesi
              </Button>
            </div>
          </div>
        </div>
      )}



      {assignModalSession && (
        <AssignAdminModal
          session={assignModalSession}
          adminList={adminList}
          sessionBranchId={(assignModalSession as any).branch_id ?? null}
          onClose={() => setAssignModalSession(null)}
          onSave={(ids) => handleSaveAssignees(assignModalSession.id, ids)}
        />
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !deleting && setDeleteConfirmId(null)} />
          <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Hapus Sesi?</h2>
                <p className="text-xs text-muted-foreground mt-1">Semua data scan dan snapshot di sesi ini akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>Batal</Button>
              <Button variant="destructive" className="flex-1 h-9 text-sm gap-1.5" onClick={() => handleDeleteSession(deleteConfirmId)} disabled={deleting}>
                {deleting ? <div className="w-3.5 h-3.5 border border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Ya, Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── AssignAdminModal ─────────────────────────────────────────────────────────
function AssignAdminModal({
  session, adminList, sessionBranchId, onClose, onSave,
}: {
  session: SessionWithAssignees;
  adminList: AdminProfile[];
  sessionBranchId: string | null;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    (session.assignees ?? []).map((a) => a.id)
  );
  const [saving, setSaving] = useState(false);
  const [filteredList, setFilteredList] = useState<AdminProfile[]>([]);

  // Fetch employees only (not admin_branch) from the session branch
  useEffect(() => {
    if (!sessionBranchId) {
      // Fallback: filter adminList to employees only
      setFilteredList(adminList.filter((a) => !a.role || a.role === "employee"));
      return;
    }
    supabase
      .from("user_branches")
      .select("user_id")
      .eq("branch_id", sessionBranchId)
      .then(async ({ data: branchUsers }) => {
        const branchUserIds = new Set((branchUsers ?? []).map((bu: any) => bu.user_id));
        // Get only employees in this branch
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("role", "employee")
          .in("user_id", Array.from(branchUserIds));
        const employeeIds = new Set((roles ?? []).map((r: any) => r.user_id));
        const roleByUser: Record<string, string> = {};
        for (const r of (roles ?? []) as any[]) roleByUser[r.user_id] = r.role;
        // Merge with adminList, supplement with direct fetch if needed
        const fromList = adminList.filter((a) => employeeIds.has(a.id));
        if (fromList.length > 0) {
          setFilteredList(fromList.map((a) => ({ ...a, role: roleByUser[a.id] ?? "employee" })));
        } else if (employeeIds.size > 0) {
          // Fetch profiles directly
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", Array.from(employeeIds))
            .eq("status", "active");
          const { data: branchInfo } = await supabase.from("branches").select("id, name").eq("id", sessionBranchId).single();
          setFilteredList(((profiles ?? []) as AdminProfile[]).map((p) => ({ ...p, role: "employee", branch_name: (branchInfo as any)?.name })));
        } else {
          setFilteredList([]);
        }
      });
  }, [adminList, sessionBranchId]);

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Atur Petugas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Hanya karyawan (bukan admin cabang) yang bisa dipilih.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {filteredList.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">Belum ada karyawan aktif di cabang ini.</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {filteredList.map((admin) => {
              const checked = selected.includes(admin.id);
              const roleLabel = (admin as any).role === "employee" ? "Karyawan" : "Admin Cabang";
              return (
                <button
                  key={admin.id}
                  onClick={() => toggle(admin.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
                    checked ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-accent",
                  )}
                >
                  <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0", checked ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                    {checked && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-[9px] font-bold flex items-center justify-center shrink-0">
                    {(admin.full_name ?? admin.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs truncate">{admin.full_name ?? admin.email.split("@")[0]}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] px-1.5 py-px rounded-full bg-muted text-muted-foreground font-medium">{roleLabel}</span>
                      {admin.branch_name && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                          <Building2 className="w-2.5 h-2.5 shrink-0" />{admin.branch_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {checked && <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>Batal</Button>
          <Button className="flex-1 h-9 text-sm gap-1.5" disabled={saving} onClick={async () => { setSaving(true); await onSave(selected); setSaving(false); }}>
            {saving ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── ScheduleView ─────────────────────────────────────────────────────────────
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface OpnameSchedule {
  id: string;
  branch_id: string | null;
  schedule_type: string;
  cron_time: string;
  is_active: boolean;
  days_of_week: number[];
  notes: string | null;
}

function ScheduleView({ branchId, branchName, onBack }: { branchId: string; branchName: string; onBack: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<OpnameSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState<string>("opening");
  const [newTime, setNewTime] = useState("08:00");
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("opname_schedules")
      .select("*")
      .eq("branch_id", branchId)
      .order("schedule_type");
    setSchedules((data ?? []) as OpnameSchedule[]);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const handleAdd = async () => {
    if (schedules.length >= 2) {
      toast({ title: "Batas jadwal tercapai", description: "Maksimal 2 jadwal per cabang (opening & closing).", variant: "destructive" });
      return;
    }
    const existing = schedules.find((s) => s.schedule_type === newType);
    if (existing) {
      toast({ title: "Jadwal sudah ada", description: `Jadwal ${newType} sudah ada. Edit jadwal yang sudah ada.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("opname_schedules").insert({
      branch_id: branchId,
      schedule_type: newType,
      cron_time: newTime,
      days_of_week: newDays,
      is_active: true,
      created_by: user?.id,
    } as never);
    setSaving(false);
    if (error) {
      toast({ title: "Gagal menambahkan jadwal", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Jadwal berhasil ditambahkan." });
    setAddOpen(false);
    setNewDays([1, 2, 3, 4, 5, 6]);
    fetchSchedules();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("opname_schedules").update({ is_active: !isActive } as never).eq("id", id);
    fetchSchedules();
  };

  const handleUpdateDays = async (id: string, days: number[]) => {
    await supabase.from("opname_schedules").update({ days_of_week: days } as never).eq("id", id);
    fetchSchedules();
  };

  const handleUpdateTime = async (id: string, time: string) => {
    await supabase.from("opname_schedules").update({ cron_time: time } as never).eq("id", id);
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("opname_schedules").delete().eq("id", id);
    toast({ title: "Jadwal berhasil dihapus." });
    fetchSchedules();
  };

  const toggleDay = (day: number, currentDays: number[]) => {
    return currentDays.includes(day) ? currentDays.filter((d) => d !== day) : [...currentDays, day].sort();
  };

  return (
    <DashboardLayout pageTitle="Jadwal Stok Opname">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent transition-colors">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Jadwal Stok Opname</h1>
            <p className="text-xs font-medium text-muted-foreground">{branchName} — Atur jadwal otomatis pembuatan sesi harian</p>
          </div>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 flex items-center gap-3">
          <Info className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Jadwal hanya berfungsi sebagai pengingat. Maksimal 2 jadwal per cabang (satu opening, satu closing).
            Atur hari dan jam untuk setiap jenis sesi.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-3">
                    <SessionTypeBadge type={schedule.schedule_type as SessionType} />
                    <p className="text-sm font-medium text-foreground">{schedule.schedule_type === "opening" ? "Sesi Opening" : "Sesi Closing"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(schedule.id, schedule.is_active)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {schedule.is_active ? (
                        <><ToggleRight className="w-5 h-5 text-[hsl(var(--status-available-fg))]" /><span className="text-[hsl(var(--status-available-fg))] font-medium">Aktif</span></>
                      ) : (
                        <><ToggleLeft className="w-5 h-5" /><span>Nonaktif</span></>
                      )}
                    </button>
                    <button onClick={() => handleDelete(schedule.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {/* Time */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Waktu</label>
                    <Input
                      type="time"
                      value={schedule.cron_time}
                      onChange={(e) => handleUpdateTime(schedule.id, e.target.value)}
                      className="h-9 text-sm w-32"
                    />
                  </div>
                  {/* Days */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-2">Hari Aktif</label>
                    <div className="flex gap-1.5">
                      {DAY_LABELS.map((label, idx) => {
                        const active = schedule.days_of_week.includes(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => handleUpdateDays(schedule.id, toggleDay(idx, schedule.days_of_week))}
                            className={cn(
                              "w-9 h-9 rounded-lg text-xs font-medium transition-all",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-accent"
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {schedules.length < 2 && (
              <>
                {!addOpen ? (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:bg-accent/30 transition-colors"
                  >
                    <Plus className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-medium text-muted-foreground">Tambah Jadwal</p>
                  </button>
                ) : (
                  <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Tambah Jadwal Baru</p>
                      <button onClick={() => setAddOpen(false)} className="p-1 rounded-lg hover:bg-accent">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1.5">Jenis Sesi</label>
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="opening" disabled={schedules.some((s) => s.schedule_type === "opening")}>Opening</SelectItem>
                          <SelectItem value="closing" disabled={schedules.some((s) => s.schedule_type === "closing")}>Closing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1.5">Waktu</label>
                      <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-9 text-sm w-32" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-2">Hari Aktif</label>
                      <div className="flex gap-1.5">
                        {DAY_LABELS.map((label, idx) => {
                          const active = newDays.includes(idx);
                          return (
                            <button
                              key={idx}
                              onClick={() => setNewDays(toggleDay(idx, newDays))}
                              className={cn(
                                "w-9 h-9 rounded-lg text-xs font-medium transition-all",
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-accent"
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setAddOpen(false)}>Batal</Button>
                      <Button className="flex-1 h-9 text-sm gap-1.5" onClick={handleAdd} disabled={saving || newDays.length === 0}>
                        {saving ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Simpan
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── ScanView ─────────────────────────────────────────────────────────────────
interface ScannedItemWithScanner extends OpnameScannedItem {
  scanned_by?: string | null;
  scanner_name?: string | null;
}

interface SalesSummary {
  pos: number;
  website: number;
  ecommerce_tokopedia: number;
  ecommerce_shopee: number;
  total: number;
  details: { imei: string; channel: string; sold_at: string; product_label: string; admin_name?: string }[];
}

function ScanView({
  sessionId, onBack, onComplete,
}: {
  sessionId: string;
  onBack: () => void;
  onComplete: (id: string) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<OpnameSession | null>(null);
  const [snapshot, setSnapshot] = useState<OpnameSnapshotItem[]>([]);
  const [scanned, setScanned] = useState<ScannedItemWithScanner[]>([]);
  const [scannerNames, setScannerNames] = useState<Record<string, string>>({});
  const [imeiInput, setImeiInput] = useState("");
  const [bulkChips, setBulkChips] = useState<string[]>([]); // chip-style scanned IMEIs in bulk mode
  const [bulkPendingInput, setBulkPendingInput] = useState(""); // buffer for barcode scanner input
  const [scanMode, setScanMode] = useState<"single" | "bulk">("single");
  const [scanning, setScanning] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: "info" | "warn" | "ok" } | null>(null);
  const [bulkResults, setBulkResults] = useState<{ imei: string; result: "match" | "unregistered" | "duplicate" | "invalid" }[]>([]);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef<string>("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [salesSummary, setSalesSummary] = useState<SalesSummary>({ pos: 0, website: 0, ecommerce_tokopedia: 0, ecommerce_shopee: 0, total: 0, details: [] });
  const [salesOpen, setSalesOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    const [{ data: sess }, { data: snap }, { data: sc }] = await Promise.all([
      supabase.from("opname_sessions").select("*").eq("id", sessionId).single(),
      supabase.from("opname_snapshot_items").select("*").eq("session_id", sessionId),
      supabase.from("opname_scanned_items" as never).select("*").eq("session_id", sessionId).order("scanned_at", { ascending: false }),
    ]);
    setSession(sess as OpnameSession);
    setSnapshot((snap as OpnameSnapshotItem[]) ?? []);
    const scannedData = (sc as ScannedItemWithScanner[]) ?? [];
    setScanned(scannedData);

    const scannerIds = [...new Set(scannedData.map((s) => s.scanned_by).filter(Boolean))] as string[];
    if (scannerIds.length > 0) {
      const { data: profiles } = await supabase.from("user_profiles").select("id, full_name, email").in("id", scannerIds);
      if (profiles) {
        const nameMap: Record<string, string> = {};
        for (const p of profiles as { id: string; full_name: string | null; email: string }[]) {
          nameMap[p.id] = p.full_name ?? p.email;
        }
        setScannerNames(nameMap);
      }
    }

    if (sess) {
      const sessionStart = (sess as OpnameSession).started_at;
      const branchId = (sess as any).branch_id;
      let soldQuery = supabase
        .from("stock_units")
        .select("imei, sold_channel, sold_at, master_products(series, storage_gb, color)")
        .eq("stock_status", "sold")
        .gte("sold_at", sessionStart);
      if (branchId) soldQuery = soldQuery.eq("branch_id", branchId);
      const { data: soldUnits } = await soldQuery;

      const summary: SalesSummary = { pos: 0, website: 0, ecommerce_tokopedia: 0, ecommerce_shopee: 0, total: 0, details: [] };
      if (soldUnits) {
        for (const u of soldUnits as { imei: string; sold_channel: string | null; sold_at: string | null; master_products?: { series?: string; storage_gb?: number; color?: string } }[]) {
          const ch = u.sold_channel ?? "pos";
          if (ch === "pos") summary.pos++;
          else if (ch === "website") summary.website++;
          else if (ch === "ecommerce_tokopedia") summary.ecommerce_tokopedia++;
          else if (ch === "ecommerce_shopee") summary.ecommerce_shopee++;
          summary.total++;
          const mp = u.master_products;
          const label = mp ? `${mp.series} ${mp.storage_gb}GB ${mp.color}` : u.imei;
          summary.details.push({ imei: u.imei, channel: ch, sold_at: u.sold_at ?? "", product_label: label });
        }
      }
      setSalesSummary(summary);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [sessionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-focus barcode scanner for both modes
  useBarcodeScanner(inputRef, { enabled: scanMode === "single" });
  useBarcodeScanner(bulkInputRef, { enabled: scanMode === "bulk" });

  // Elapsed timer
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!session) return;
    const startTime = new Date(session.started_at).getTime();
    const tick = () => {
      const diff = Date.now() - startTime;
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  const refocusInput = useCallback(() => {
    setTimeout(() => {
      if (scanMode === "single") inputRef.current?.focus();
      else bulkInputRef.current?.focus();
    }, 50);
  }, [scanMode]);

  const match = scanned.filter((s) => s.scan_result === "match").length;
  const unregistered = scanned.filter((s) => s.scan_result === "unregistered").length;
  const missing = snapshot.length - match;
  const missingImeis = snapshot.filter((s) => s.scan_result !== "match");

  const handleScan = async () => {
    const imei = imeiInput.trim();
    if (!imei) return;
    if (imei.length < 15) { setAlertMsg({ text: "IMEI minimal 15 digit.", type: "warn" }); return; }
    if (scanned.some((s) => s.imei === imei)) { setAlertMsg({ text: "IMEI sudah discan dalam sesi ini.", type: "warn" }); setImeiInput(""); return; }

    setScanning(true);
    const isInSnapshot = snapshot.some((s) => s.imei === imei);
    const scanResult: "match" | "unregistered" = isInSnapshot ? "match" : "unregistered";
    const { error } = await supabase.from("opname_scanned_items" as never).insert({ session_id: sessionId, imei, scan_result: scanResult, scanned_by: user?.id ?? null } as never);
    if (error) { toast({ title: "Gagal menyimpan scan", description: error.message, variant: "destructive" }); setScanning(false); return; }
    if (isInSnapshot) { await supabase.from("opname_snapshot_items").update({ scan_result: "match" } as never).eq("session_id", sessionId).eq("imei", imei); }

    const newScannedCount = scanned.length + 1;
    const newMatch = match + (isInSnapshot ? 1 : 0);
    const newUnregistered = unregistered + (isInSnapshot ? 0 : 1);
    const newMissing = snapshot.length - newMatch;
    await supabase.from("opname_sessions").update({ total_scanned: newScannedCount, total_match: newMatch, total_missing: newMissing, total_unregistered: newUnregistered } as never).eq("id", sessionId);

    setAlertMsg({ text: isInSnapshot ? "✓ IMEI cocok — unit ditemukan di etalase." : "⚠ IMEI tidak ada di daftar stok tersedia.", type: isInSnapshot ? "ok" : "warn" });
    setImeiInput("");
    fetchAll();
    setScanning(false);
    refocusInput();
  };

  // Barcode scanner auto-detect: accumulates chars rapidly, commits on Enter/timeout
  const handleBulkKeyInput = useCallback((char: string) => {
    barcodeBufferRef.current += char;
    if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
    barcodeTimerRef.current = setTimeout(() => {
      const imei = barcodeBufferRef.current.trim();
      barcodeBufferRef.current = "";
      if (imei.length >= 15) {
        setBulkChips((prev) => prev.includes(imei) ? prev : [...prev, imei]);
      }
    }, 80);
  }, []);

  const handleBulkInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const imei = bulkPendingInput.trim();
      setBulkPendingInput("");
      if (imei.length >= 15 && !bulkChips.includes(imei)) {
        setBulkChips((prev) => [...prev, imei]);
      }
      e.preventDefault();
    }
  }, [bulkPendingInput, bulkChips]);

  const removeChip = useCallback((imei: string) => {
    setBulkChips((prev) => prev.filter((c) => c !== imei));
  }, []);

  const handleBulkScan = async () => {
    const lines = bulkChips.length > 0 ? bulkChips : [];
    if (lines.length === 0) return;
    setBulkProcessing(true);
    setBulkResults([]);
    setAlertMsg(null);

    const results: { imei: string; result: "match" | "unregistered" | "duplicate" | "invalid" }[] = [];
    let currentScanned = [...scanned];
    let currentMatch = match;
    let currentUnregistered = unregistered;

    for (const imei of lines) {
      if (imei.length < 15) { results.push({ imei, result: "invalid" }); continue; }
      if (currentScanned.some((s) => s.imei === imei)) { results.push({ imei, result: "duplicate" }); continue; }
      const isInSnapshot = snapshot.some((s) => s.imei === imei);
      const scanResult: "match" | "unregistered" = isInSnapshot ? "match" : "unregistered";
      const { error } = await supabase.from("opname_scanned_items" as never).insert({ session_id: sessionId, imei, scan_result: scanResult, scanned_by: user?.id ?? null } as never);
      if (error) continue;
      if (isInSnapshot) { await supabase.from("opname_snapshot_items").update({ scan_result: "match" } as never).eq("session_id", sessionId).eq("imei", imei); currentMatch++; } else { currentUnregistered++; }
      currentScanned = [...currentScanned, { id: "", session_id: sessionId, imei, scan_result: scanResult, action_taken: null, action_notes: null, scanned_at: new Date().toISOString() }];
      results.push({ imei, result: scanResult });
    }

    const newMissing = snapshot.length - currentMatch;
    await supabase.from("opname_sessions").update({ total_scanned: currentScanned.length, total_match: currentMatch, total_missing: newMissing, total_unregistered: currentUnregistered } as never).eq("id", sessionId);
    setBulkResults(results);
    setBulkChips([]);
    setBulkPendingInput("");
    fetchAll();
    setBulkProcessing(false);
    const successCount = results.filter((r) => r.result === "match" || r.result === "unregistered").length;
    toast({ title: `Bulk scan selesai: ${successCount} dari ${lines.length} IMEI diproses.`, description: results.filter((r) => r.result === "duplicate").length > 0 ? `${results.filter((r) => r.result === "duplicate").length} IMEI sudah ada (dilewati).` : undefined });
  };

  const handleDeleteScan = async (id: string) => {
    const item = scanned.find((s) => s.id === id);
    if (!item) return;
    await supabase.from("opname_scanned_items").delete().eq("id", id);
    if (item.scan_result === "match") { await supabase.from("opname_snapshot_items").update({ scan_result: "missing" } as never).eq("session_id", sessionId).eq("imei", item.imei); }
    fetchAll();
  };

  const handleComplete = async () => {
    setCompleting(true);
    const { error } = await supabase.from("opname_sessions").update({ session_status: "completed", completed_at: new Date().toISOString() } as never).eq("id", sessionId);
    setCompleting(false);
    if (error) { toast({ title: "Gagal menyelesaikan sesi", description: error.message, variant: "destructive" }); return; }
    try { await supabase.functions.invoke("opname-notify", { body: { sessionId, completedBy: user?.id } }); } catch (e) { console.warn("Email notification failed (non-critical):", e); }
    logActivity({ action: "complete_opname_session", actor_id: user?.id, metadata: { session_id: sessionId } });
    toast({ title: "Sesi berhasil diselesaikan.", description: "Laporan dikirim ke Super Admin via email." });
    onComplete(sessionId);
  };

  if (!session) {
    return <DashboardLayout pageTitle="Stok Opname – Scan"><div className="p-8 text-center"><div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin mx-auto" /></div></DashboardLayout>;
  }

  const CHANNEL_LABELS: Record<string, string> = { pos: "Offline Store (POS)", website: "Website", ecommerce_tokopedia: "Tokopedia", ecommerce_shopee: "Shopee" };

  return (
    <DashboardLayout pageTitle="Stok Opname – Scan">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">
                  Sesi Aktif – {SESSION_TYPE_LABELS[session.session_type]}
                </h1>
                {/* Status badge — lebih besar */}
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold",
                  SESSION_STATUS_STYLES[session.session_status]?.bg,
                  SESSION_STATUS_STYLES[session.session_status]?.text
                )}>
                  <span className={cn("w-2 h-2 rounded-full", SESSION_STATUS_STYLES[session.session_status]?.dot)} />
                  {SESSION_STATUS_LABELS[session.session_status]}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(session.started_at))}
                {" · "}
                {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(session.started_at))} WIB
              </p>
            </div>
          </div>
          {/* Elapsed — dark segmented pill, 1 row */}
          {session.session_status === "draft" && elapsed && (
            <div className="flex items-center gap-0 px-3 py-2.5 rounded-xl border border-border shrink-0 shadow-sm" style={{ background: "#f2f2f2" }}>
              {elapsed.split(":").map((seg, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span className="text-base font-bold text-gray-400 px-1 self-start mt-0.5">:</span>
                  )}
                  <div className="flex flex-col items-center px-0.5">
                    <span className="text-lg font-bold text-gray-900 leading-none tracking-wider">{seg}</span>
                    <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-widest leading-none mt-0.5">
                      {["Jam", "Mnt", "Dtk"][i]}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Stok Tersedia", val: snapshot.length, color: "text-foreground" },
            { label: "Cocok", val: match, color: "text-[hsl(var(--status-available-fg))]" },
            { label: "Belum Ditemukan", val: missing, color: missing > 0 ? "text-[hsl(var(--status-minus-fg))]" : "text-foreground" },
            { label: "Tidak Terdaftar", val: unregistered, color: unregistered > 0 ? "text-[hsl(var(--status-coming-soon-fg))]" : "text-foreground" },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-xl border border-border p-3 sm:p-4 text-center">
              <p className={cn("text-2xl font-bold", item.color)}>{item.val}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Sales summary */}
        {salesSummary.total > 0 && (
          <div className="bg-[hsl(var(--status-available-bg))] rounded-xl border border-[hsl(var(--status-available))]/20 overflow-hidden">
            <button onClick={() => setSalesOpen(!salesOpen)} className="w-full flex items-center justify-between p-4 text-left">
              <p className="text-xs font-semibold text-[hsl(var(--status-available-fg))] flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" />Penjualan Tercatat Sejak Sesi Dimulai ({salesSummary.total})</p>
              <ChevronDown className={cn("w-4 h-4 text-[hsl(var(--status-available-fg))] transition-transform", salesOpen && "rotate-180")} />
            </button>
            {salesOpen && (
              <div className="px-4 pb-4 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {salesSummary.pos > 0 && <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border"><Store className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs font-bold text-foreground">{salesSummary.pos}</p><p className="text-[9px] text-muted-foreground">Offline (POS)</p></div></div>}
                  {salesSummary.website > 0 && <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border"><Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs font-bold text-foreground">{salesSummary.website}</p><p className="text-[9px] text-muted-foreground">Website</p></div></div>}
                  {salesSummary.ecommerce_tokopedia > 0 && <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border"><ShoppingCart className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs font-bold text-foreground">{salesSummary.ecommerce_tokopedia}</p><p className="text-[9px] text-muted-foreground">Tokopedia</p></div></div>}
                  {salesSummary.ecommerce_shopee > 0 && <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border"><ShoppingCart className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs font-bold text-foreground">{salesSummary.ecommerce_shopee}</p><p className="text-[9px] text-muted-foreground">Shopee</p></div></div>}
                </div>
                {salesSummary.details.length > 0 && (
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {salesSummary.details.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground"><span className="text-foreground">{d.imei}</span><span>·</span><span>{d.product_label}</span><span>·</span><span className="font-medium">{CHANNEL_LABELS[d.channel] ?? d.channel}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Missing warning */}
        {missing > 0 && (
          <div className="rounded-xl bg-[hsl(var(--status-minus-bg))] border border-[hsl(var(--status-minus))]/20 overflow-hidden">
            <button onClick={() => setMissingOpen(!missingOpen)} className="w-full flex items-center justify-between p-4 text-left">
              <p className="text-sm font-medium text-[hsl(var(--status-minus-fg))] flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />{missing} unit belum ditemukan di etalase</p>
              <ChevronDown className={cn("w-4 h-4 text-[hsl(var(--status-minus-fg))] transition-transform", missingOpen && "rotate-180")} />
            </button>
            {missingOpen && (
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs font-medium text-foreground">Unit berikut tercatat "Tersedia" di sistem tapi belum dipindai. Kemungkinan besar terjual di marketplace dan belum diupdate oleh admin.</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {missingImeis.slice(0, 20).map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2 rounded-lg bg-card border border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--status-minus-fg))] shrink-0" />
                        <span className="text-xs text-muted-foreground shrink-0">IMEI</span>
                        <span className="text-sm font-semibold text-foreground truncate">{item.imei}</span>
                      </div>
                      <span className="text-xs font-bold text-foreground truncate sm:ml-auto pl-5 sm:pl-0">{item.product_label}</span>
                    </div>
                  ))}
                  {missingImeis.length > 20 && <p className="text-xs text-muted-foreground text-center py-1">...dan {missingImeis.length - 20} unit lainnya</p>}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Input IMEI</p>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border">
                  <button onClick={() => { setScanMode("single"); setBulkResults([]); setAlertMsg(null); setTimeout(() => inputRef.current?.focus(), 50); }} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all", scanMode === "single" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <ScanLine className="w-3 h-3" />Satu per Satu
                  </button>
                  <button onClick={() => { setScanMode("bulk"); setAlertMsg(null); setTimeout(() => bulkInputRef.current?.focus(), 50); }} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all", scanMode === "bulk" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <Layers className="w-3 h-3" />Bulk Scan
                  </button>
                </div>
              </div>

              {scanMode === "single" && (
                <>
                  <div className="flex gap-2">
                    <Input ref={inputRef} value={imeiInput} onChange={(e) => { setImeiInput(e.target.value); setAlertMsg(null); }} onKeyDown={(e) => e.key === "Enter" && handleScan()} placeholder="Arahkan scanner ke sini — IMEI masuk otomatis" className="h-12 text-base" disabled={scanning} autoFocus />
                    <Button className="h-12 px-5 text-sm" onClick={handleScan} disabled={scanning || !imeiInput.trim()}>
                      {scanning ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <><ScanLine className="w-4 h-4 mr-1" />Scan</>}
                    </Button>
                  </div>
                  {alertMsg && (
                    <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium", alertMsg.type === "ok" && "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]", alertMsg.type === "warn" && "bg-[hsl(var(--status-minus-bg))] text-[hsl(var(--status-minus-fg))]", alertMsg.type === "info" && "bg-muted text-muted-foreground")}>
                      {alertMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                      {alertMsg.text}
                    </div>
                  )}
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30">
                    <ScanLine className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Barcode scanner otomatis mengirim data ke kolom ini. Tekan Enter atau klik Scan.</p>
                  </div>
                </>
              )}

              {scanMode === "bulk" && (
                <>
                  {/* Hidden input that captures barcode scanner keystrokes */}
                  <input
                    ref={bulkInputRef}
                    value={bulkPendingInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBulkPendingInput(val);
                      // Detect rapid input from barcode scanner (multiple chars at once)
                      if (val.length > 3) {
                        handleBulkKeyInput(val.slice(-1));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const imei = bulkPendingInput.trim();
                        setBulkPendingInput("");
                        if (imei.length >= 15 && !bulkChips.includes(imei)) {
                          setBulkChips((prev) => [...prev, imei]);
                        }
                        e.preventDefault();
                      }
                    }}
                    onInput={(e) => {
                      // Detect barcode scanner paste-like behavior (rapid full IMEI input)
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val.length >= 15) {
                        setBulkPendingInput("");
                        setBulkChips((prev) => prev.includes(val) ? prev : [...prev, val]);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                    placeholder="Arahkan scanner ke sini — setiap scan otomatis menambah IMEI"
                    className="w-full h-12 px-3 rounded-lg border border-input bg-background text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    disabled={bulkProcessing}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ScanLine className="w-3.5 h-3.5" />Barcode scanner otomatis menambah chip IMEI. Klik × pada chip untuk hapus.</p>

                  {/* Chip list */}
                  {bulkChips.length > 0 && (
                    <div className="min-h-[60px] max-h-[180px] overflow-y-auto flex flex-wrap gap-1.5 p-3 rounded-lg border border-border bg-muted/30">
                      {bulkChips.map((imei, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm text-foreground hover:border-primary/40 transition-colors group">
                          <span className="text-[10px] text-muted-foreground font-sans">IMEI</span>
                          {imei}
                          <button
                            onClick={() => removeChip(imei)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Hapus"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] text-muted-foreground">{bulkChips.length} IMEI siap diproses</p>
                    <div className="flex gap-2">
                      {bulkChips.length > 0 && (
                        <Button variant="outline" className="h-9 px-3 text-sm" onClick={() => { setBulkChips([]); setBulkResults([]); }}>
                          Hapus Semua
                        </Button>
                      )}
                      <Button className="h-9 px-4 text-sm shrink-0 gap-1.5" onClick={handleBulkScan} disabled={bulkProcessing || bulkChips.length === 0}>
                        {bulkProcessing ? <><div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Memproses…</> : <><Layers className="w-3.5 h-3.5" />Proses Semua</>}
                      </Button>
                    </div>
                  </div>

                  {bulkResults.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Hasil Proses Terakhir</p>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {bulkResults.map((r, i) => (
                          <div key={i} className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs", r.result === "match" && "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]", r.result === "unregistered" && "bg-[hsl(var(--status-minus-bg))] text-[hsl(var(--status-minus-fg))]", r.result === "duplicate" && "bg-muted text-muted-foreground", r.result === "invalid" && "bg-muted text-muted-foreground")}>
                            <span className="shrink-0">{r.result === "match" && "✓"}{r.result === "unregistered" && "⚠"}{r.result === "duplicate" && "↩"}{r.result === "invalid" && "✗"}</span>
                            <span className="flex-1 truncate">{r.imei}</span>
                            <span className="text-[10px] font-sans shrink-0">{r.result === "match" && "Cocok"}{r.result === "unregistered" && "Tidak Terdaftar"}{r.result === "duplicate" && "Sudah ada"}{r.result === "invalid" && "IMEI tidak valid"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Selesaikan Sesi — placed below input, above scan results */}
            <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Selesaikan Sesi</p>
                {scanned.length === 0
                  ? <p className="text-[10px] text-muted-foreground mt-0.5">Scan minimal 1 IMEI untuk dapat menyelesaikan sesi.</p>
                  : <p className="text-[10px] text-muted-foreground mt-0.5">{scanned.length} IMEI telah discan · {match} cocok · {missing} belum ditemukan</p>
                }
              </div>
              <Button className="h-10 px-5 text-sm gap-2 shrink-0" onClick={handleComplete} disabled={completing || scanned.length === 0}>
                {completing ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Selesaikan Sesi
              </Button>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Hasil Scan ({scanned.length})</p>
              </div>
              {scanned.length === 0 ? (
                <div className="p-8 text-center"><Search className="w-6 h-6 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">Belum ada IMEI yang discan.</p></div>
              ) : (
                <div className="divide-y divide-border max-h-80 overflow-y-auto">
                  {scanned.map((s) => {
                    const scannerName = s.scanned_by ? (scannerNames[s.scanned_by] ?? "Admin") : null;
                    return (
                      <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={cn("w-2 h-2 rounded-full shrink-0", s.scan_result === "match" ? "bg-[hsl(var(--status-available))]" : "bg-[hsl(var(--status-minus))]")} />
                          <span className="text-xs text-muted-foreground shrink-0">IMEI</span>
                          <p className="text-sm font-medium text-foreground truncate">{s.imei}</p>
                        </div>
                        <div className="flex items-center gap-2 pl-4 sm:pl-0">
                          {scannerName && <p className="text-xs text-muted-foreground truncate hidden sm:block">oleh {scannerName}</p>}
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded shrink-0", s.scan_result === "match" ? "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available-fg))]" : "bg-[hsl(var(--status-minus-bg))] text-[hsl(var(--status-minus-fg))]")}>{s.scan_result === "match" ? "Cocok" : "Tidak Terdaftar"}</span>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">{new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(s.scanned_at))}</p>
                          <button onClick={() => handleDeleteScan(s.id)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      </div>
    </DashboardLayout>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold", color)}>{value}</p>
    </div>
  );
}

// ─── ResultsView ──────────────────────────────────────────────────────────────
function ResultsView({
  sessionId, isSuperAdmin, onBack, onLocked,
}: {
  sessionId: string;
  isSuperAdmin: boolean;
  onBack: () => void;
  onLocked: () => void;
}) {
  const { toast } = useToast();
  const [session, setSession] = useState<OpnameSession | null>(null);
  const [snapshot, setSnapshot] = useState<OpnameSnapshotItem[]>([]);
  const [scanned, setScanned] = useState<OpnameScannedItem[]>([]);
  const [tab, setTab] = useState<"cocok" | "belum_ditemukan" | "tidak_terdaftar">("cocok");
  const [actions, setActions] = useState<Record<string, { action: string; notes: string; ref: string }>>({});
  const [locking, setLocking] = useState(false);
  const { user } = useAuth();

  const fetchAll = useCallback(async () => {
    const [{ data: sess }, { data: snap }, { data: sc }] = await Promise.all([
      supabase.from("opname_sessions").select("*").eq("id", sessionId).single(),
      supabase.from("opname_snapshot_items").select("*").eq("session_id", sessionId),
      supabase.from("opname_scanned_items").select("*").eq("session_id", sessionId),
    ]);
    setSession(sess as OpnameSession);
    setSnapshot((snap as OpnameSnapshotItem[]) ?? []);
    setScanned((sc as OpnameScannedItem[]) ?? []);
  }, [sessionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const matchItems = snapshot.filter((s) => s.scan_result === "match");
  const missingItems = snapshot.filter((s) => s.scan_result === "missing");
  const unregisteredItems = scanned.filter((s) => s.scan_result === "unregistered");

  const allMissingActioned = missingItems.every((item) => actions[item.id]?.action || item.action_taken);
  const allUnregisteredActioned = unregisteredItems.every((item) => actions[item.id]?.action || item.action_taken);
  const canLock = isSuperAdmin && allMissingActioned && allUnregisteredActioned;

  const saveSnapshotAction = async (itemId: string, action: SnapshotActionTaken, notes: string, ref: string) => {
    await supabase.from("opname_snapshot_items").update({ action_taken: action, action_notes: notes || null, sold_reference_id: (action === "sold_ecommerce_tokopedia" || action === "sold_ecommerce_shopee") ? ref : null } as never).eq("id", itemId);
    fetchAll();
  };

  const saveScannedAction = async (itemId: string, action: ScannedActionTaken, notes: string) => {
    await supabase.from("opname_scanned_items").update({ action_taken: action, action_notes: notes || null } as never).eq("id", itemId);
    fetchAll();
  };

  const handleLock = async () => {
    setLocking(true);
    for (const [id, act] of Object.entries(actions)) {
      const snapItem = snapshot.find((s) => s.id === id);
      const scanItem = scanned.find((s) => s.id === id);
      if (snapItem) await saveSnapshotAction(id, act.action as SnapshotActionTaken, act.notes, act.ref);
      if (scanItem) await saveScannedAction(id, act.action as ScannedActionTaken, act.notes);
    }
    const { error } = await supabase.from("opname_sessions").update({ session_status: "locked", approved_by: user?.id, approved_at: new Date().toISOString(), locked_at: new Date().toISOString() } as never).eq("id", sessionId);
    setLocking(false);
    if (error) { toast({ title: "Gagal mengunci sesi", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sesi berhasil dikunci." });
    onLocked();
  };

  if (!session) return <DashboardLayout pageTitle="Stok Opname – Hasil"><div className="p-8 text-center"><div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin mx-auto" /></div></DashboardLayout>;

  const isLocked = session.session_status === "locked";

  return (
    <DashboardLayout pageTitle="Stok Opname – Hasil Sesi">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent transition-colors"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-foreground">Hasil Sesi – {SESSION_TYPE_LABELS[session.session_type]}</h1>
              <SessionStatusBadge status={session.session_status} />
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(session.started_at)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "Stok Tersedia", val: session.total_expected, color: "text-foreground" },
            { label: "Discan", val: session.total_scanned, color: "text-foreground" },
            { label: "Cocok", val: matchItems.length, color: "text-[hsl(var(--status-available-fg))]" },
            { label: "Belum Ditemukan", val: missingItems.length, color: missingItems.length > 0 ? "text-[hsl(var(--status-minus-fg))]" : "text-foreground" },
            { label: "Tidak Terdaftar", val: unregisteredItems.length, color: unregisteredItems.length > 0 ? "text-[hsl(var(--status-coming-soon-fg))]" : "text-foreground" },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-xl border border-border p-3 text-center">
              <p className={cn("text-2xl font-bold", item.color)}>{item.val}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex border-b border-border">
            {([
              { key: "cocok" as const, label: `Cocok (${matchItems.length})` },
              { key: "belum_ditemukan" as const, label: `Belum Ditemukan (${missingItems.length})` },
              { key: "tidak_terdaftar" as const, label: `Tidak Terdaftar (${unregisteredItems.length})` },
            ]).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex-1 px-4 py-3 text-xs font-medium transition-colors", tab === t.key ? "text-foreground border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground")}>{t.label}</button>
            ))}
          </div>

          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {tab === "cocok" && (
              matchItems.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-4">Tidak ada unit yang cocok.</p>
                : matchItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--status-available-bg))] border border-[hsl(var(--status-available))]/20">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-available-fg))] shrink-0" />
                    <div className="flex-1 min-w-0"><p className="text-xs text-foreground">{item.imei}</p><p className="text-[10px] text-muted-foreground truncate">{item.product_label}</p></div>
                  </div>
                ))
            )}

            {tab === "belum_ditemukan" && (
              missingItems.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-4">Semua unit ditemukan di etalase. 🎉</p>
                : <>
                  <div className="rounded-lg bg-[hsl(var(--status-minus-bg))] border border-[hsl(var(--status-minus))]/20 px-3 py-2 mb-2">
                    <p className="text-[10px] text-[hsl(var(--status-minus-fg))]">💡 Unit ini tercatat "Tersedia" di sistem tapi tidak ditemukan saat scan etalase. Silakan pilih tindakan yang sesuai untuk setiap unit.</p>
                  </div>
                  {missingItems.map((item) => {
                    const local = actions[item.id] ?? { action: item.action_taken ?? "", notes: item.action_notes ?? "", ref: item.sold_reference_id ?? "" };
                    const isSold = local.action === "sold_ecommerce_tokopedia" || local.action === "sold_ecommerce_shopee";
                    return (
                      <div key={item.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-minus-fg))] shrink-0" />
                          <div className="flex-1 min-w-0"><p className="text-xs text-foreground">{item.imei}</p><p className="text-[10px] text-muted-foreground truncate">{item.product_label}</p></div>
                          {item.selling_price && <p className="text-xs font-semibold text-foreground whitespace-nowrap">{formatCurrency(item.selling_price)}</p>}
                        </div>
                        {!isLocked && (
                          <div className="space-y-1.5">
                            <Select value={local.action} onValueChange={(v) => setActions((prev) => ({ ...prev, [item.id]: { ...local, action: v } }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih tindakan…" /></SelectTrigger>
                              <SelectContent>{Object.entries(SNAPSHOT_ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                            {isSold && <Input placeholder="No. Referensi transaksi…" className="h-8 text-xs" value={local.ref} onChange={(e) => setActions((prev) => ({ ...prev, [item.id]: { ...local, ref: e.target.value } }))} />}
                            <Input placeholder="Catatan tindakan (opsional)…" className="h-8 text-xs" value={local.notes} onChange={(e) => setActions((prev) => ({ ...prev, [item.id]: { ...local, notes: e.target.value } }))} />
                            {local.action && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveSnapshotAction(item.id, local.action as SnapshotActionTaken, local.notes, local.ref)}>Simpan Tindakan</Button>}
                          </div>
                        )}
                        {item.action_taken && <p className="text-[10px] font-medium text-[hsl(var(--status-available-fg))]">✓ {SNAPSHOT_ACTION_LABELS[item.action_taken]}</p>}
                      </div>
                    );
                  })}
                </>
            )}

            {tab === "tidak_terdaftar" && (
              unregisteredItems.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-4">Tidak ada IMEI yang tidak terdaftar di sistem.</p>
                : unregisteredItems.map((item) => {
                  const local = actions[item.id] ?? { action: item.action_taken ?? "", notes: item.action_notes ?? "", ref: "" };
                  return (
                    <div key={item.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-coming-soon-fg))] shrink-0" />
                        <p className="text-xs text-foreground">{item.imei}</p>
                        <span className="text-[10px] bg-[hsl(var(--status-coming-soon-bg))] text-[hsl(var(--status-coming-soon-fg))] px-1.5 py-0.5 rounded font-medium">Tidak Terdaftar</span>
                      </div>
                      {!isLocked && (
                        <div className="space-y-1.5">
                          <Select value={local.action} onValueChange={(v) => setActions((prev) => ({ ...prev, [item.id]: { ...local, action: v } }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih tindakan…" /></SelectTrigger>
                            <SelectContent>{Object.entries(SCANNED_ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input placeholder="Catatan (opsional)…" className="h-8 text-xs" value={local.notes} onChange={(e) => setActions((prev) => ({ ...prev, [item.id]: { ...local, notes: e.target.value } }))} />
                          {local.action && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveScannedAction(item.id, local.action as ScannedActionTaken, local.notes)}>Simpan Tindakan</Button>}
                        </div>
                      )}
                      {item.action_taken && <p className="text-[10px] font-medium text-[hsl(var(--status-available-fg))]">✓ {SCANNED_ACTION_LABELS[item.action_taken]}</p>}
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {isSuperAdmin && !isLocked && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Kunci Sesi (Super Admin)</p>
            {!canLock && (missingItems.length > 0 || unregisteredItems.length > 0) && (
              <div className="rounded-lg bg-[hsl(var(--status-minus-bg))] border border-[hsl(var(--status-minus))]/20 px-3 py-2">
                <p className="text-xs text-[hsl(var(--status-minus-fg))]">Tindakan wajib dipilih untuk setiap unit selisih sebelum sesi dapat dikunci.</p>
              </div>
            )}
            <Button className="w-full h-10 gap-2" onClick={handleLock} disabled={!canLock || locking}>
              {locking ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
              Kunci Sesi
            </Button>
            <p className="text-[10px] text-muted-foreground">Sesi yang telah dikunci tidak dapat diubah kecuali oleh Super Admin.</p>
          </div>
        )}

        {isLocked && (
          <div className="rounded-xl bg-muted border border-border px-4 py-3 flex items-center gap-3">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <div><p className="text-xs font-medium text-foreground">Sesi telah dikunci.</p><p className="text-[10px] text-muted-foreground">Data tidak dapat diubah. Terkunci {formatDate(session.locked_at)}.</p></div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── DetailView ───────────────────────────────────────────────────────────────
function DetailView({
  sessionId, isSuperAdmin, onBack,
}: {
  sessionId: string;
  isSuperAdmin: boolean;
  onBack: () => void;
  onGoToResults?: (id: string) => void;
}) {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const isAdminBranch = role === "admin_branch";
  const [session, setSession] = useState<OpnameSession | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<(AdminProfile & { role_label?: string })[]>([]);
  const [adminList, setAdminList] = useState<AdminProfile[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [detailTab, setDetailTab] = useState<"ringkasan" | "cocok" | "belum_ditemukan" | "tidak_terdaftar">("ringkasan");
  const [snapshot, setSnapshot] = useState<OpnameSnapshotItem[]>([]);
  const [scanned, setScanned] = useState<OpnameScannedItem[]>([]);
  const [actions, setActions] = useState<Record<string, { action: string; notes: string; ref: string }>>({});
  const [locking, setLocking] = useState(false);

  const fetchDetail = useCallback(async () => {
    const [{ data: sess }, { data: assignments }, { data: snap }, { data: sc }] = await Promise.all([
      supabase.from("opname_sessions").select("*").eq("id", sessionId).single(),
      supabase.from("opname_session_assignments" as never).select("admin_id").eq("session_id", sessionId),
      supabase.from("opname_snapshot_items").select("*").eq("session_id", sessionId),
      supabase.from("opname_scanned_items" as never).select("*").eq("session_id", sessionId).order("scanned_at", { ascending: false }),
    ]);
    setSession(sess as OpnameSession);
    setSnapshot((snap as OpnameSnapshotItem[]) ?? []);
    setScanned((sc as OpnameScannedItem[]) ?? []);

    // Fetch branch name
    const branchId = (sess as any)?.branch_id;
    if (branchId) {
      const { data: br } = await supabase.from("branches").select("name").eq("id", branchId).single();
      setBranchName((br as any)?.name ?? null);
    }

    // Fetch assignees with branch info
    const assigneeIds = ((assignments as { admin_id: string }[]) ?? []).map((a) => a.admin_id);
    if (assigneeIds.length > 0) {
      const [{ data: profiles }, { data: roleRows }, { data: ubRows }] = await Promise.all([
        supabase.from("user_profiles").select("id, full_name, email").in("id", assigneeIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", assigneeIds),
        supabase.from("user_branches").select("user_id, branch_id, branches:branch_id(name)").in("user_id", assigneeIds).eq("is_default", true),
      ]);
      const roleMap: Record<string, string> = {};
      for (const r of (roleRows ?? []) as { user_id: string; role: string }[]) {
        if (r.role === "employee") roleMap[r.user_id] = "Karyawan";
        else if (r.role === "admin_branch") roleMap[r.user_id] = "Admin Cabang";
      }
      const branchMap: Record<string, string> = {};
      for (const ub of (ubRows ?? []) as any[]) {
        if (ub.branches?.name) branchMap[ub.user_id] = ub.branches.name;
      }
      setAssignees(((profiles ?? []) as AdminProfile[]).map((p) => ({
        ...p,
        branch_name: branchMap[p.id],
        role_label: roleMap[p.id],
      })));
    } else { setAssignees([]); }
  }, [sessionId]);

  const fetchAdmins = useCallback(async () => {
    const sessData = await supabase.from("opname_sessions").select("branch_id").eq("id", sessionId).single();
    const branchId = (sessData.data as any)?.branch_id;
    const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["admin_branch", "employee"]);
    if (!roles || roles.length === 0) { setAdminList([]); return; }
    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.from("user_profiles").select("id, full_name, email").in("id", ids).eq("status", "active");
    if (branchId) {
      const { data: branchUsers } = await supabase.from("user_branches").select("user_id").eq("branch_id", branchId);
      const allowed = new Set((branchUsers ?? []).map((bu: any) => bu.user_id));
      setAdminList(((profiles ?? []) as AdminProfile[]).filter((p) => allowed.has(p.id)));
    } else {
      setAdminList((profiles ?? []) as AdminProfile[]);
    }
  }, [sessionId]);

  useEffect(() => { fetchDetail(); if (isSuperAdmin || isAdminBranch) fetchAdmins(); }, [fetchDetail, fetchAdmins, isSuperAdmin, isAdminBranch]);

  const handleSaveAssignees = async (ids: string[]) => {
    if (!user) return;
    await supabase.from("opname_session_assignments" as never).delete().eq("session_id" as never, sessionId);
    if (ids.length > 0) {
      const rows = ids.map((aid) => ({ session_id: sessionId, admin_id: aid, assigned_by: user.id }));
      await supabase.from("opname_session_assignments" as never).insert(rows as never);
    }
    toast({ title: "Penugasan petugas berhasil disimpan." });
    setShowAssignModal(false);
    fetchDetail();
  };

  const saveSnapshotAction = async (itemId: string, action: SnapshotActionTaken, notes: string, ref: string) => {
    await supabase.from("opname_snapshot_items").update({
      action_taken: action,
      action_notes: notes || null,
      sold_reference_id: (action === "sold_ecommerce_tokopedia" || action === "sold_ecommerce_shopee") ? ref : null,
    } as never).eq("id", itemId);
    // Apply to stock unit if action is a status change
    const item = snapshot.find((s) => s.id === itemId);
    if (item) {
      let newStatus: string | null = null;
      if (action === "sold_ecommerce_tokopedia") newStatus = "sold";
      else if (action === "sold_ecommerce_shopee") newStatus = "sold";
      else if (action === "lost") newStatus = "lost";
      else if (action === "service") newStatus = "service";
      else if (action === "available") newStatus = "available";
      if (newStatus === "sold") {
        const soldChannel = action === "sold_ecommerce_tokopedia" ? "ecommerce_tokopedia" : "ecommerce_shopee";
        await supabase.from("stock_units").update({ stock_status: newStatus, sold_channel: soldChannel } as never).eq("id", item.unit_id);
      } else if (newStatus) {
        await supabase.from("stock_units").update({ stock_status: newStatus } as never).eq("id", item.unit_id);
      }
    }
    fetchDetail();
  };

  const saveScannedAction = async (itemId: string, action: ScannedActionTaken, notes: string) => {
    await supabase.from("opname_scanned_items").update({ action_taken: action, action_notes: notes || null } as never).eq("id", itemId);
    fetchDetail();
  };

  const handleLock = async () => {
    setLocking(true);
    for (const [id, act] of Object.entries(actions)) {
      const snapItem = snapshot.find((s) => s.id === id);
      const scanItem = scanned.find((s) => s.id === id);
      if (snapItem) await saveSnapshotAction(id, act.action as SnapshotActionTaken, act.notes, act.ref);
      if (scanItem) await saveScannedAction(id, act.action as ScannedActionTaken, act.notes);
    }
    const { error } = await supabase.from("opname_sessions").update({ session_status: "locked", approved_by: user?.id, approved_at: new Date().toISOString(), locked_at: new Date().toISOString() } as never).eq("id", sessionId);
    setLocking(false);
    if (error) { toast({ title: "Gagal mengunci sesi", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sesi berhasil dikunci." });
    fetchDetail();
  };

  if (!session) return <DashboardLayout pageTitle="Stok Opname – Detail"><div className="p-8 text-center"><div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin mx-auto" /></div></DashboardLayout>;

  const matchItems = snapshot.filter((s) => s.scan_result === "match");
  const missingItems = snapshot.filter((s) => s.scan_result === "missing");
  const unregisteredItems = scanned.filter((s) => s.scan_result === "unregistered");
  const isLocked = session.session_status === "locked";
  const isCompleted = session.session_status === "completed" || isLocked;
  const allMissingActioned = missingItems.every((item) => actions[item.id]?.action || item.action_taken);
  const allUnregisteredActioned = unregisteredItems.every((item) => actions[item.id]?.action || item.action_taken);
  const canLock = isSuperAdmin && allMissingActioned && allUnregisteredActioned;

  // Status options for missing items — maps to actual stock_status values
  const MISSING_STATUS_OPTIONS: { value: SnapshotActionTaken; label: string }[] = [
    { value: "sold_ecommerce_tokopedia", label: "Terjual (Tokopedia)" },
    { value: "sold_ecommerce_shopee", label: "Terjual (Shopee)" },
    { value: "service", label: "Service" },
    { value: "lost", label: "Hilang" },
    { value: "available", label: "Tersedia (terlewat saat scan)" },
  ];

  const tabs = [
    { key: "ringkasan" as const, label: "Ringkasan" },
    { key: "cocok" as const, label: `Cocok (${matchItems.length})` },
    { key: "belum_ditemukan" as const, label: `Belum Ditemukan (${missingItems.length})` },
    { key: "tidak_terdaftar" as const, label: `Tidak Terdaftar (${unregisteredItems.length})` },
  ];

  return (
    <DashboardLayout pageTitle="Stok Opname – Detail">
      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent transition-colors mt-1 shrink-0"><ArrowLeft className="w-5 h-5 text-muted-foreground" /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-lg sm:text-xl font-bold text-foreground">
                Detail Sesi – {SESSION_TYPE_LABELS[session.session_type]}
              </h1>
              <SessionStatusBadge status={session.session_status} />
              <SessionTypeBadge type={session.session_type} />
            </div>
            {/* Audit trail info */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-x-4 sm:gap-y-1">
              {branchName && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium text-foreground">{branchName}</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                Dimulai: <span className="font-medium text-foreground ml-1">{formatDate(session.started_at)}</span>
              </span>
              {session.completed_at && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[hsl(var(--status-available-fg))]" />
                  Selesai: <span className="font-medium text-foreground ml-1">{formatDate(session.completed_at)}</span>
                </span>
              )}
              {session.locked_at && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  Dikunci: <span className="font-medium text-foreground ml-1">{formatDate(session.locked_at)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Stok Tersedia", val: session.total_expected, color: "text-foreground" },
            { label: "Cocok", val: session.total_match, color: "text-[hsl(var(--status-available-fg))]" },
            { label: "Belum Ditemukan", val: session.total_missing, color: session.total_missing > 0 ? "text-[hsl(var(--status-minus-fg))]" : "text-foreground" },
            { label: "Tidak Terdaftar", val: session.total_unregistered, color: session.total_unregistered > 0 ? "text-[hsl(var(--status-coming-soon-fg))]" : "text-foreground" },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-xl border border-border p-3 sm:p-4 text-center">
              <p className={cn("text-2xl sm:text-3xl font-bold", item.color)}>{item.val}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* ── Petugas section ── */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Petugas ({assignees.length})
            </p>
            {(isSuperAdmin || isAdminBranch) && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAssignModal(true)}>
                <UserCheck className="w-3 h-3" /> Atur
              </Button>
            )}
          </div>
          {assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Belum ada petugas ditugaskan.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignees.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted border border-border">
                  <div className="w-8 h-8 rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold flex items-center justify-center shrink-0">
                    {(a.full_name ?? a.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{a.full_name ?? a.email.split("@")[0]}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {a.role_label && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{a.role_label}</span>}
                      {a.branch_name && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Building2 className="w-2.5 h-2.5" />{a.branch_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tabs: Ringkasan / Cocok / Belum Ditemukan / Tidak Terdaftar ── */}
        {isCompleted && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setDetailTab(t.key)}
                  className={cn(
                    "flex-shrink-0 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                    detailTab === t.key
                      ? "text-foreground border-b-2 border-primary -mb-px bg-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
              {/* Tab: Ringkasan */}
              {detailTab === "ringkasan" && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Statistik Sesi</p>
                    {[
                      { label: "Total Snapshot (Stok Awal)", val: snapshot.length },
                      { label: "Total Discan", val: scanned.length },
                      { label: "Cocok", val: matchItems.length },
                      { label: "Belum Ditemukan", val: missingItems.length },
                      { label: "Tidak Terdaftar", val: unregisteredItems.length },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="font-semibold text-foreground">{r.val}</span>
                      </div>
                    ))}
                  </div>
                  {session.notes && (
                    <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Catatan</p>
                      <p className="text-sm text-foreground">{session.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Cocok */}
              {detailTab === "cocok" && (
                matchItems.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-6">Tidak ada unit yang cocok.</p>
                  : matchItems.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-3 rounded-lg bg-[hsl(var(--status-available-bg))] border border-[hsl(var(--status-available))]/20">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-available-fg))] shrink-0" />
                        <span className="text-xs text-muted-foreground shrink-0">IMEI</span>
                        <p className="text-sm font-medium text-foreground truncate">{item.imei}</p>
                      </div>
                      <div className="flex items-center gap-2 pl-6 sm:pl-0">
                        <p className="text-xs text-muted-foreground truncate flex-1">{item.product_label}</p>
                        {item.selling_price && <p className="text-xs font-semibold text-foreground whitespace-nowrap">{formatCurrency(item.selling_price)}</p>}
                      </div>
                    </div>
                  ))
              )}

              {/* Tab: Belum Ditemukan */}
              {detailTab === "belum_ditemukan" && (
                missingItems.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-6">Semua unit ditemukan saat scan. 🎉</p>
                  : <>
                    <div className="rounded-lg bg-[hsl(var(--status-minus-bg))] border border-[hsl(var(--status-minus))]/20 px-3 py-2 mb-1">
                      <p className="text-xs text-[hsl(var(--status-minus-fg))]">💡 Unit ini tercatat <strong>Tersedia</strong> di sistem tapi tidak ditemukan saat scan etalase. Pilih status aktual untuk setiap unit — perubahan akan langsung diterapkan ke Stok IMEI.</p>
                    </div>
                    {missingItems.map((item) => {
                      const local = actions[item.id] ?? { action: item.action_taken ?? "", notes: item.action_notes ?? "", ref: item.sold_reference_id ?? "" };
                      const isSold = local.action === "sold_ecommerce_tokopedia" || local.action === "sold_ecommerce_shopee";
                      const alreadySaved = !!item.action_taken;
                      return (
                        <div key={item.id} className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-minus-fg))] shrink-0" />
                              <span className="text-xs text-muted-foreground shrink-0">IMEI</span>
                              <p className="text-sm font-medium text-foreground truncate">{item.imei}</p>
                            </div>
                            <div className="flex items-center gap-2 pl-6 sm:pl-0">
                              <p className="text-xs text-muted-foreground truncate flex-1">{item.product_label}</p>
                              {item.selling_price && <p className="text-sm font-semibold text-foreground whitespace-nowrap">{formatCurrency(item.selling_price)}</p>}
                            </div>
                          </div>
                          {alreadySaved && (
                            <p className="text-xs font-medium text-[hsl(var(--status-available-fg))] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Sudah ditindaklanjuti: {SNAPSHOT_ACTION_LABELS[item.action_taken!]}
                            </p>
                          )}
                          {!isLocked && (
                            <div className="space-y-2">
                              <Select value={local.action} onValueChange={(v) => setActions((prev) => ({ ...prev, [item.id]: { ...local, action: v } }))}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih status aktual unit…" /></SelectTrigger>
                                <SelectContent>
                                  {MISSING_STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value as string} value={opt.value as string}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isSold && (
                                <Input placeholder="No. Referensi transaksi (opsional)…" className="h-9 text-sm" value={local.ref} onChange={(e) => setActions((prev) => ({ ...prev, [item.id]: { ...local, ref: e.target.value } }))} />
                              )}
                              <Input placeholder="Catatan tambahan (opsional)…" className="h-9 text-sm" value={local.notes} onChange={(e) => setActions((prev) => ({ ...prev, [item.id]: { ...local, notes: e.target.value } }))} />
                              {local.action && (
                                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => saveSnapshotAction(item.id, local.action as SnapshotActionTaken, local.notes, local.ref)}>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Simpan & Update Stok IMEI
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
              )}

              {/* Tab: Tidak Terdaftar */}
              {detailTab === "tidak_terdaftar" && (
                unregisteredItems.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-6">Tidak ada IMEI tidak terdaftar di sistem.</p>
                  : unregisteredItems.map((item) => {
                    const local = actions[item.id] ?? { action: item.action_taken ?? "", notes: item.action_notes ?? "", ref: "" };
                    return (
                      <div key={item.id} className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-coming-soon-fg))] shrink-0" />
                            <span className="text-xs text-muted-foreground shrink-0">IMEI</span>
                            <p className="text-sm font-medium text-foreground truncate">{item.imei}</p>
                          </div>
                          <span className="text-xs bg-[hsl(var(--status-coming-soon-bg))] text-[hsl(var(--status-coming-soon-fg))] px-2 py-0.5 rounded font-medium shrink-0 w-fit ml-6 sm:ml-0">Tidak Terdaftar</span>
                        </div>
                        {item.action_taken && (
                          <p className="text-xs font-medium text-[hsl(var(--status-available-fg))] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {item.action_taken && (SCANNED_ACTION_LABELS[item.action_taken] ?? "")}
                          </p>
                        )}
                        {!isLocked && (
                          <div className="space-y-2">
                            <Select value={local.action} onValueChange={(v) => setActions((prev) => ({ ...prev, [item.id]: { ...local, action: v } }))}>
                              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih tindakan…" /></SelectTrigger>
                              <SelectContent>{Object.entries(SCANNED_ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input placeholder="Catatan (opsional)…" className="h-9 text-sm" value={local.notes} onChange={(e) => setActions((prev) => ({ ...prev, [item.id]: { ...local, notes: e.target.value } }))} />
                            {local.action && (
                              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => saveScannedAction(item.id, local.action as ScannedActionTaken, local.notes)}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Simpan Tindakan
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* ── Lock section (Super Admin only) ── */}
        {isSuperAdmin && isCompleted && !isLocked && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Kunci Sesi (Super Admin)</p>
            {!canLock && (missingItems.length > 0 || unregisteredItems.length > 0) && (
              <div className="rounded-lg bg-[hsl(var(--status-minus-bg))] border border-[hsl(var(--status-minus))]/20 px-3 py-2">
                <p className="text-sm text-[hsl(var(--status-minus-fg))]">Semua unit selisih harus ditindaklanjuti sebelum sesi dapat dikunci.</p>
              </div>
            )}
            <Button className="w-full h-10 gap-2" onClick={handleLock} disabled={!canLock || locking}>
              {locking ? <div className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
              Kunci Sesi
            </Button>
            <p className="text-xs text-muted-foreground">Sesi yang telah dikunci tidak dapat diubah.</p>
          </div>
        )}

        {isLocked && (
          <div className="rounded-xl bg-muted border border-border px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted-foreground/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Sesi telah dikunci</p>
                <p className="text-xs text-muted-foreground">Data tidak dapat diubah. Terkunci {formatDate(session.locked_at)}.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAssignModal && (
        <AssignAdminModal
          session={{ ...session, assignees } as SessionWithAssignees}
          adminList={adminList}
          sessionBranchId={(session as any).branch_id ?? null}
          onClose={() => setShowAssignModal(false)}
          onSave={handleSaveAssignees}
        />
      )}
    </DashboardLayout>
  );
}
