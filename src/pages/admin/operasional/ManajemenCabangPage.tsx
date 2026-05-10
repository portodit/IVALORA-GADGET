import { useState, useEffect, useCallback } from "react";
import { Plus, Search, MapPin, Phone, Mail, Building2, Users, RefreshCw, X, ChevronRight, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/shared/use-toast";
import { BranchFormModal } from "@/components/admin/operasional/BranchFormModal";
import { BranchDetailDrawer } from "@/components/admin/operasional/BranchDetailDrawer";

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string | null;
  district: string | null;
  province: string | null;
  full_address: string | null;
  phone: string | null;
  email?: string | null;
  google_maps_url?: string | null;
  postal_code: string | null;
  village: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface BranchWithStaff extends Branch {
  staffCount?: number;
}

export default function ManajemenCabangPage() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<BranchWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProvince, setFilterProvince] = useState("all");
  const [provinces, setProvinces] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("name");

    if (error) {
      toast({ title: "Gagal memuat data cabang", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const branchList = data as Branch[];

    // Fetch staff counts
    const withStaff = await Promise.all(
      branchList.map(async (b) => {
        const { count } = await supabase
          .from("user_branches")
          .select("*", { count: "exact", head: true })
          .eq("branch_id", b.id);
        return { ...b, staffCount: count ?? 0 };
      })
    );

    setBranches(withStaff);

    // Extract unique provinces
    const uniqueProvinces = Array.from(
      new Set(branchList.map((b) => b.province).filter(Boolean) as string[])
    ).sort();
    setProvinces(uniqueProvinces);

    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const filtered = branches.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      b.city?.toLowerCase().includes(q) ||
      b.province?.toLowerCase().includes(q);
    const matchProvince = filterProvince === "all" || b.province === filterProvince;
    return matchSearch && matchProvince;
  });

  const activeCount = branches.filter((b) => b.is_active).length;
  const inactiveCount = branches.filter((b) => !b.is_active).length;

  return (
    <DashboardLayout pageTitle="Manajemen Cabang">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Manajemen Cabang</h1>
            <p className="text-xs text-muted-foreground">Kelola seluruh cabang, lokasi, dan tim di setiap cabang.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchBranches}>
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Segarkan</span>
            </Button>
            <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Tambah Cabang
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
            <p className="text-2xl font-bold text-foreground">{branches.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Cabang</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
            <p className="text-2xl font-bold text-foreground">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Aktif</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
            <p className="text-2xl font-bold text-foreground">{inactiveCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Nonaktif</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama cabang, kode, atau kota…"
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          {provinces.length > 0 && (
            <select
              value={filterProvince}
              onChange={(e) => setFilterProvince(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Semua Provinsi</option>
              {provinces.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>

        {/* Branch list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Tidak ada cabang ditemukan</p>
            <p className="text-xs text-muted-foreground">Coba ubah filter atau tambahkan cabang baru.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">{filtered.length} cabang ditampilkan</p>
            {filtered.map((branch) => (
              <button
                key={branch.id}
                onClick={() => setSelectedBranch(branch)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:shadow-sm hover:border-border/70 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">{branch.name}</span>
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{branch.code}</span>
                      <Badge variant={branch.is_active ? "default" : "secondary"} className="text-[10px] h-4">
                        {branch.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      {(branch.city || branch.province) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {[branch.city, branch.province].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {branch.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{branch.phone}</span>
                        </div>
                      )}
                      {branch.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span>{branch.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3 shrink-0" />
                        <span>{branch.staffCount ?? 0} admin/karyawan</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BranchFormModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={fetchBranches} />
      <BranchDetailDrawer branch={selectedBranch} onClose={() => setSelectedBranch(null)} onUpdate={fetchBranches} />
    </DashboardLayout>
  );
}
