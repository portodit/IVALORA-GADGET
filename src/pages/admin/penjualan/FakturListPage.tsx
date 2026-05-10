import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Search, Eye, Settings, Info,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Printer, Trash2, RefreshCw, Globe,
  Download, XCircle, CheckSquare, FileArchive, Hash,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SearchableDropdown } from "@/components/shared/SearchableDropdown";
import { AdminDataTable } from "@/components/shared/AdminDataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableHead, TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/shared/use-toast";
import { useAuth } from "@/contexts/admin/AuthContext";
import { formatCurrency } from "@/lib/admin/produk/stock-units";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Invoice {
  id: string;
  invoice_number: string;
  transaction_id: string;
  branch_id: string;
  status: string;
  customer_name: string | null;
  total: number;
  payment_status: string;
  invoice_date: string;
  channel: string | null;
  handled_by_name: string | null;
  branches?: { name: string; code: string } | null;
  transactions?: {
    transaction_code: string | null;
    payment_method_name?: string | null;
  } | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

const PAYMENT_DISPLAY: Record<string, { label: string; className: string }> = {
  paid: { label: "Full Payment", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  split: { label: "Split Payment", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  pending: { label: "Waiting", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function FakturListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, activeBranch, userBranches } = useAuth();

  // Sticky measurement
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [filterBarHeight, setFilterBarHeight] = useState(0);

  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFilterBarHeight(el.offsetHeight));
    ro.observe(el);
    setFilterBarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>(activeBranch?.id ?? "all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");

  const [branches, setBranches] = useState<Branch[]>([]);

  // Single delete
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  // Info box toggle
  const [infoOpen, setInfoOpen] = useState(false);

  // Sync domain
  const [syncing, setSyncing] = useState(false);

  // Renumber
  const [renumberOpen, setRenumberOpen] = useState(false);
  const [renumbering, setRenumbering] = useState(false);
  const [renumberPreview, setRenumberPreview] = useState<{ count: number; first: string; branchId: string } | null>(null);

  // Derived selection state
  const allCurrentSelected = invoices.length > 0 && invoices.every(inv => selectedIds.has(inv.id));
  const someSelected = selectedIds.size > 0;
  const indeterminate = someSelected && !allCurrentSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        invoices.forEach(inv => next.delete(inv.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        invoices.forEach(inv => next.add(inv.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Reset selection on page change
  useEffect(() => { clearSelection(); }, [page, pageSize]);

  const handleSyncDomain = async () => {
    setSyncing(true);
    try {
      const { data: settings } = await supabase
        .from("invoice_settings" as never)
        .select("document_link_base")
        .limit(1)
        .maybeSingle() as { data: { document_link_base: string } | null };

      const currentDomain = settings?.document_link_base || "https://ivaloragadget.com";
      toast({
        title: "Domain Disinkronkan",
        description: `Domain faktur diperbarui ke ${currentDomain}.`,
      });
    } catch (err: any) {
      toast({ title: "Gagal sinkronisasi", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  function getPeriodInfo(isoDate: string, resetMode: string, includeDate: boolean): { periodKey: string; datePart: string } {
    if (!includeDate) return { periodKey: "GLOBAL", datePart: "" };
    const d = new Date(isoDate);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    if (resetMode === "daily") return { periodKey: `${yyyy}-${mm}-${dd}`, datePart: `${yyyy}${mm}${dd}` };
    if (resetMode === "yearly") return { periodKey: `${yyyy}`, datePart: `${yyyy}` };
    return { periodKey: `${yyyy}-${mm}`, datePart: `${yyyy}${mm}` };
  }

  function buildNewNumber(prefix: string, includeCode: boolean, branchCode: string, includeDate: boolean, datePart: string, seq: number): string {
    let num = prefix;
    if (includeCode && branchCode) num += `-${branchCode.toUpperCase()}`;
    if (includeDate && datePart) num += `-${datePart}`;
    num += `-${String(seq).padStart(6, "0")}`;
    return num;
  }

  const handleOpenRenumber = async () => {
    const targetBranchId = branchFilter !== "all" ? branchFilter : activeBranch?.id;
    if (!targetBranchId) {
      toast({ title: "Pilih cabang dulu", description: "Filter berdasarkan cabang sebelum renumber.", variant: "destructive" });
      return;
    }
    const [{ data: settings }, { data: branch }, { count }] = await Promise.all([
      supabase.from("invoice_settings" as never).select("*").eq("branch_id", targetBranchId).maybeSingle() as Promise<{ data: any }>,
      supabase.from("branches").select("code").eq("id", targetBranchId).single() as Promise<{ data: any }>,
      supabase.from("invoices" as never).select("id", { count: "exact", head: true }).eq("branch_id", targetBranchId).neq("status", "void") as Promise<{ count: number | null }>,
    ]);
    const prefix = settings?.number_prefix || "INV";
    const numFormat = settings?.number_format || "branch_code";
    const includeCode = numFormat !== "none";
    const branchCode = numFormat === "custom" ? (settings?.custom_code || "") : branch?.code || "EP";
    const includeDate = settings?.use_date_reset ?? true;
    const startSeq = settings?.sequence_start || 1;
    const firstNumber = buildNewNumber(prefix, includeCode, branchCode, includeDate, includeDate ? (settings?.sequence_reset === "yearly" ? String(new Date().getFullYear()) : String(new Date().getFullYear()) + String(new Date().getMonth() + 1).padStart(2, "0")) : "", startSeq);
    setRenumberPreview({ count: count ?? 0, first: firstNumber, branchId: targetBranchId });
    setRenumberOpen(true);
  };

  const handleRenumberAll = async () => {
    if (!renumberPreview) return;
    setRenumbering(true);
    try {
      const targetBranchId = renumberPreview.branchId;
      const [{ data: settings }, { data: branch }] = await Promise.all([
        supabase.from("invoice_settings" as never).select("*").eq("branch_id", targetBranchId).maybeSingle() as Promise<{ data: any }>,
        supabase.from("branches").select("code").eq("id", targetBranchId).single() as Promise<{ data: any }>,
      ]);
      const { data: allInvoices } = await supabase
        .from("invoices" as never)
        .select("id, invoice_date")
        .eq("branch_id", targetBranchId)
        .neq("status", "void")
        .order("invoice_date", { ascending: true }) as { data: { id: string; invoice_date: string }[] | null };

      if (!allInvoices || allInvoices.length === 0) {
        toast({ title: "Tidak ada faktur untuk dinomori ulang" });
        setRenumberOpen(false);
        return;
      }

      const prefix = settings?.number_prefix || "INV";
      const numFormat = settings?.number_format || "branch_code";
      const includeCode = numFormat !== "none";
      const branchCode = numFormat === "custom" ? (settings?.custom_code || "") : branch?.code || "EP";
      const includeDate = settings?.use_date_reset ?? true;
      const resetMode = settings?.sequence_reset || "monthly";
      const startSeq = settings?.sequence_start || 1;

      const periodCounters: Record<string, number> = {};
      const updates: { id: string; invoice_number: string }[] = [];

      for (const inv of allInvoices) {
        const { periodKey, datePart } = getPeriodInfo(inv.invoice_date, resetMode, includeDate);
        if (!(periodKey in periodCounters)) periodCounters[periodKey] = startSeq;
        const seq = periodCounters[periodKey]++;
        updates.push({ id: inv.id, invoice_number: buildNewNumber(prefix, includeCode, branchCode, includeDate, datePart, seq) });
      }

      const sequences = Object.entries(periodCounters).map(([period_key, nextSeq]) => ({
        period_key,
        last_seq: nextSeq - 1,
      }));

      const { error } = await supabase.rpc("renumber_all_invoices" as never, {
        _branch_id: targetBranchId,
        _updates: updates,
        _sequences: sequences,
      } as never);

      if (error) throw error;

      // Also refresh template snapshot for all non-void invoices (same as "Update Sekarang" on each)
      const snapshotJson = JSON.stringify({
        additional_notes: settings?.additional_notes ?? null,
        terms_snapshot: settings?.terms_json ?? null,
        updated_at: new Date().toISOString(),
      });
      await (supabase.from("invoices" as never) as any)
        .update({ notes: snapshotJson })
        .eq("branch_id", targetBranchId)
        .neq("status", "void");

      toast({ title: `${allInvoices.length} faktur berhasil dinomori ulang & diperbarui` });
      setRenumberOpen(false);
      fetchInvoices();
    } catch (err: any) {
      toast({ title: "Gagal menomori ulang", description: err.message, variant: "destructive" });
    } finally {
      setRenumbering(false);
    }
  };

  useEffect(() => {
    if (role === "super_admin") {
      supabase.from("branches").select("id, name, code").eq("is_active", true).then(({ data }) => {
        setBranches((data as Branch[]) ?? []);
      });
    } else {
      setBranches(userBranches as Branch[]);
    }
  }, [role, userBranches]);

  useEffect(() => {
    if (role !== "super_admin" && activeBranch) {
      setBranchFilter(activeBranch.id);
    }
  }, [role, activeBranch]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("invoices" as never)
      .select("id, invoice_number, transaction_id, branch_id, status, customer_name, total, payment_status, invoice_date, channel, handled_by_name, branches(name, code), transactions(transaction_code, payment_method_name)", { count: "exact" })
      .order("invoice_date", { ascending: false })
      .range(from, to);

    if (branchFilter && branchFilter !== "all") query = query.eq("branch_id", branchFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (paymentStatusFilter !== "all") query = query.eq("payment_status", paymentStatusFilter);
    if (search.trim()) query = query.or(`invoice_number.ilike.%${search.trim()}%,customer_name.ilike.%${search.trim()}%`);

    const { data, count, error } = await query;
    if (error) toast({ title: "Gagal memuat faktur", variant: "destructive" });
    setInvoices((data as Invoice[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, pageSize, branchFilter, statusFilter, paymentStatusFilter, search, toast]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("invoices" as never).delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Gagal menghapus faktur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Faktur berhasil dihapus", description: "Transaksi terkait dapat generate faktur ulang." });
      fetchInvoices();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = [...selectedIds];
    const { error } = await supabase.from("invoices" as never).delete().in("id", ids as never);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${ids.length} faktur dihapus` });
      clearSelection();
      fetchInvoices();
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
  };

  const handleExportZip = async () => {
    setExportingZip(true);
    try {
      const zip = new JSZip();
      const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id));
      
      toast({ title: "Menyiapkan PDF...", description: `Memproses ${selectedInvoices.length} file.` });

      // In real scenario, we would need to generate PDF blobs.
      // For now, we'll simulate adding text files as placeholders for PDFs
      // unless we want to call the PDF generation logic for each.
      for (const inv of selectedInvoices) {
        zip.file(`${inv.invoice_number.replace(/\//g, "-")}.txt`, `Invoice: ${inv.invoice_number}\nCustomer: ${inv.customer_name}\nTotal: ${inv.total}`);
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `faktur-ivalora-${new Date().toISOString().slice(0, 10)}.zip`);
      
      toast({ title: "Export Berhasil", description: `${selectedInvoices.length} faktur telah di-zip.` });
    } catch (err: any) {
      toast({ title: "Export Gagal", description: err.message, variant: "destructive" });
    } finally {
      setExportingZip(false);
    }
  };

  const paginationRange = useMemo(() => {
    const delta = 1;
    const range: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
        range.push(i);
      } else if (range[range.length - 1] !== "...") {
        range.push("...");
      }
    }
    return range;
  }, [page, totalPages]);

  const headerRow = (
    <>
      <TableHead className="w-10 px-3 text-center bg-muted">
        <Checkbox
          checked={allCurrentSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={toggleSelectAll}
          aria-label="Pilih semua"
        />
      </TableHead>
      <TableHead className="text-left px-4 py-3 font-semibold text-muted-foreground bg-muted">Faktur</TableHead>
      <TableHead className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell bg-muted">Transaksi</TableHead>
      <TableHead className="text-left px-4 py-3 font-semibold text-muted-foreground bg-muted">Customer</TableHead>
      <TableHead className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell bg-muted">Tanggal</TableHead>
      <TableHead className="text-right px-4 py-3 font-semibold text-muted-foreground bg-muted">Total</TableHead>
      <TableHead className="text-center px-4 py-3 font-semibold text-muted-foreground bg-muted">Pembayaran</TableHead>
      <TableHead className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell bg-muted">Sales</TableHead>
      <TableHead className="text-right px-4 py-3 font-semibold text-muted-foreground bg-muted">Aksi</TableHead>
    </>
  );

  const infoBar = (
    <p className="font-medium text-foreground">
      {totalCount} faktur total · halaman {page}/{totalPages}
    </p>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faktur Penjualan</h1>
            <p className="text-sm text-muted-foreground mt-1">Hanya transaksi berhasil yang memiliki dokumen faktur</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSyncDomain} disabled={syncing} className="gap-1.5">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Sinkronisasi</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenRenumber} className="gap-1.5">
              <Hash className="w-4 h-4" />
              <span className="hidden sm:inline">Nomor Ulang</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/penjualan/faktur/pengaturan")} className="gap-1.5">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Pengaturan</span>
            </Button>
          </div>
        </div>

        {/* Info box (collapsible) */}
        <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
            onClick={() => setInfoOpen(v => !v)}
          >
            <Info className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="flex-1 text-sm font-semibold text-orange-800">Informasi Faktur</span>
            {infoOpen
              ? <ChevronUp className="w-4 h-4 text-orange-400 shrink-0" />
              : <ChevronDown className="w-4 h-4 text-orange-400 shrink-0" />
            }
          </button>
          {infoOpen && (
            <div className="px-4 pb-4 border-t border-orange-200 pt-3">
              <p className="text-sm font-medium text-orange-800 leading-relaxed">
                Semua dokumen di bawah ini adalah faktur dari <span className="font-bold">Transaksi Berhasil</span>. Gunakan fitur <span className="font-bold">ZIP</span> untuk mengunduh faktur secara massal.
              </p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div ref={filterBarRef} className="sticky top-16 z-20 bg-background/95 backdrop-blur py-3 -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-10 px-4 sm:px-5 md:px-6 lg:px-10 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari no. faktur / customer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9"
            />
          </div>

          <SearchableDropdown
            compact
            showAllOption={role === "super_admin"}
            allLabel="Semua Cabang"
            options={branches}
            value={branchFilter}
            onChange={(v) => { setBranchFilter(v); setPage(1); }}
            placeholder="Cabang"
            searchPlaceholder="Cari cabang..."
            align="right"
            triggerClassName="w-[160px]"
          />

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <SelectValue placeholder="Status Faktur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentStatusFilter} onValueChange={(v) => { setPaymentStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="Status Bayar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Bayar</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-border bg-primary/10 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-bold text-primary">{selectedIds.size} dipilih</span>
              <button onClick={clearSelection} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={exportingZip} className="h-8 gap-1.5 text-xs bg-background" onClick={handleExportZip}>
                <FileArchive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{exportingZip ? "Zipping..." : "Download ZIP"}</span>
              </Button>
              <Button size="sm" variant="destructive" disabled={bulkDeleting} className="h-8 gap-1.5 text-xs" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hapus</span>
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <AdminDataTable filterBarHeight={filterBarHeight} infoBar={infoBar} headerRow={headerRow}>
          {loading ? (
            [...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(9)].map((_, j) => (
                  <TableCell key={j} className="px-4 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-20 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                <p className="font-medium text-foreground">Tidak ada faktur</p>
                <p className="text-sm text-muted-foreground mt-1">Coba sesuaikan filter atau cari data lain.</p>
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((inv) => {
              // Logic for split payment display
              const isSplit = inv.transactions?.payment_method_name?.toLowerCase().includes("split") || inv.payment_status === "split";
              const display = isSplit ? PAYMENT_DISPLAY.split : PAYMENT_DISPLAY.paid;
              const isSelected = selectedIds.has(inv.id);

              return (
                <TableRow 
                  key={inv.id} 
                  onDoubleClick={() => navigate(`/admin/penjualan/faktur/${inv.id}`)}
                  className={cn("transition-colors cursor-pointer select-none", isSelected ? "bg-primary/5" : "hover:bg-muted/10")}
                >
                  <TableCell className="px-3 py-3 text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(inv.id)}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="font-mono text-xs font-bold text-foreground">{inv.invoice_number}</div>
                    <div className="text-[10px] text-muted-foreground md:hidden">{inv.branches?.name}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden md:table-cell text-xs font-medium text-muted-foreground">
                    {inv.transactions?.transaction_code ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-foreground">
                    {inv.customer_name ?? "Pelanggan Umum"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {formatDate(inv.invoice_date)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
                    {formatCurrency(inv.total)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    <span className={cn("inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", display.className)}>
                      {display.label}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 hidden lg:table-cell">
                    {inv.handled_by_name ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => navigate(`/admin/penjualan/faktur/${inv.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/penjualan/faktur/${inv.id}?print=1`)}>
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(inv)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </AdminDataTable>
      </div>

      {/* Pagination */}
      {!loading && totalCount > 0 && (
        <div className="fixed bottom-0 left-0 md:left-[72px] right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
          <div className="px-4 py-2.5 flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-2">
              <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground hidden sm:inline font-medium">per halaman</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="hidden sm:flex items-center gap-1">
                {paginationRange.map((item, idx) =>
                  item === "..." ? (
                    <span key={`dots-${idx}`} className="w-6 text-center text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button key={item} variant={page === item ? "default" : "outline"} size="sm"
                      className={cn("h-8 min-w-[32px] px-2 text-xs", page === item && "pointer-events-none")}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Faktur Permanent?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini hanya menghapus dokumen faktur <strong>{deleteTarget?.invoice_number}</strong>. 
              Data transaksi tetap ada dan Anda bisa membuat ulang faktur jika diperlukan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : "Ya, Hapus Faktur"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renumber Confirmation */}
      <AlertDialog open={renumberOpen} onOpenChange={(open) => { if (!open) setRenumberOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nomor Ulang Semua Faktur?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                <strong>{renumberPreview?.count ?? 0} faktur</strong> akan dinomori ulang dari yang terlama ke terbaru sesuai format pengaturan saat ini.
              </span>
              <span className="block font-mono text-xs bg-muted px-2 py-1.5 rounded">
                Mulai dari: <strong>{renumberPreview?.first}</strong>
              </span>
              <span className="block text-destructive font-medium text-xs">
                Nomor faktur lama akan diganti permanen. Faktur berstatus void tidak ikut diubah.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renumbering}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRenumberAll}
              disabled={renumbering}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {renumbering
                ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Memproses...</>
                : `Ya, Nomor Ulang ${renumberPreview?.count ?? 0} Faktur`
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) setBulkDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} Faktur?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua dokumen faktur yang dipilih akan dihapus. Ini tidak akan menghapus riwayat transaksi aslinya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? "Menghapus..." : `Hapus ${selectedIds.size} Faktur`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
