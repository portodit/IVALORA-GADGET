import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SearchableDropdown } from "@/components/shared/SearchableDropdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useToast } from "@/hooks/shared/use-toast";
import { formatCurrency } from "@/lib/admin/produk/stock-units";
import { type TradeInUnit } from "@/types/trade-in";
import {
  Package, RefreshCw, CheckCircle2, XCircle, Eye,
  Smartphone, AlertCircle, Filter,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
  city: string | null;
}

export function VerifikasiUnitMasukPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isSuperAdmin = role === "super_admin";

  const [units, setUnits] = useState<TradeInUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    const { data } = await supabase
      .from("branches")
      .select("id, name, city")
      .eq("is_active", true)
      .order("name");
    setAllBranches((data as Branch[]) ?? []);
  }, []);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("stock_units")
      .select("*, master_products(series, storage_gb, color, warranty_type, category), branches(name, city)")
      .eq("stock_status", "trade_in_pending")
      .order("received_at", { ascending: false });

    if (!isSuperAdmin && user?.id) {
      // For admin_branch, filter by their assigned branch
      // (We use selectedBranchId from user context via allBranches)
    }
    if (selectedBranchId) {
      q = q.eq("branch_id", selectedBranchId);
    }

    const { data } = await q;
    setUnits((data as TradeInUnit[]) ?? []);
    setLoading(false);
  }, [isSuperAdmin, selectedBranchId, user?.id]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const approveUnit = async (unitId: string) => {
    setProcessingId(unitId);
    try {
      const { error } = await supabase
        .from("stock_units")
        .update({ stock_status: "available", status_changed_at: new Date().toISOString() })
        .eq("id", unitId);
      if (error) throw error;
      toast({ title: "Unit disetujui", description: "Unit siap dijual di stok." });
      fetchUnits();
    } catch (err) {
      toast({ title: "Gagal", description: err instanceof Error ? err.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const rejectUnit = async (unitId: string) => {
    setProcessingId(unitId);
    try {
      const { error } = await supabase
        .from("stock_units")
        .update({ stock_status: "rejected", status_changed_at: new Date().toISOString() })
        .eq("id", unitId);
      if (error) throw error;
      toast({ title: "Unit ditolak" });
      fetchUnits();
    } catch (err) {
      toast({ title: "Gagal", description: err instanceof Error ? err.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const getProductLabel = (p: TradeInUnit["master_products"]) => {
    if (!p) return "—";
    const mp = Array.isArray(p) ? p[0] : p;
    const storage = mp.storage_gb ? (mp.storage_gb >= 1024 ? `${mp.storage_gb / 1024} TB` : `${mp.storage_gb} GB`) : "";
    return `${mp.series ?? ""} ${storage} ${mp.color ?? ""}`.trim();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Verifikasi Unit Masuk</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Memuat..." : `${units.length} unit menunggu verifikasi`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <div className="w-56">
                <SearchableDropdown
                  options={allBranches}
                  value={selectedBranchId}
                  onChange={setSelectedBranchId}
                  placeholder="Semua Cabang"
                  searchPlaceholder="Cari cabang..."
                  triggerClassName="h-9 text-xs"
                />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={fetchUnits} className="h-9 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {!loading && units.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
              <Package className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Tidak ada unit pending</p>
              <p className="text-xs text-muted-foreground">
                Unit dari Tukar Tambah & Jual Putus akan muncul di sini untuk diverifikasi.
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && units.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tanggal</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Produk</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">IMEI</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Kondisi</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Harga Sepakat</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cabang</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {units.map(unit => (
                    <tr key={unit.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {unit.received_at ? new Date(unit.received_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">{getProductLabel(unit.master_products)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{unit.imei ?? unit.serial_number ?? "—"}</td>
                      <td className="px-4 py-3">
                        {unit.condition_status === "minus" ? (
                          <Badge variant="outline" className="text-[10px] border-[hsl(var(--status-minus))] text-[hsl(var(--status-minus-fg))] bg-[hsl(var(--status-minus-bg))]">
                            Minus {unit.minus_severity ?? ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-[hsl(var(--status-available))] text-[hsl(var(--status-available-fg))] bg-[hsl(var(--status-available-bg))]">
                            No Minus
                          </Badge>
                        )}
                        {unit.minus_description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{unit.minus_description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-foreground tabular-nums">
                        {formatCurrency(unit.cost_price)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {unit.branches ? `${unit.branches.name ?? ""}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/admin/produk/stok?unit_id=${unit.id}`)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            disabled={processingId === unit.id}
                            onClick={() => approveUnit(unit.id)}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={processingId === unit.id}
                            onClick={() => rejectUnit(unit.id)}
                          >
                            <XCircle className="w-3 h-3" /> Tolak
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
