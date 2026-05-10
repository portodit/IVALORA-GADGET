import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, ChevronLeft, Gift, Package, Info } from "lucide-react";
import { useToast } from "@/hooks/shared/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/admin/AuthContext";

interface BonusItem {
  id: string; name: string; description: string | null; icon: string | null;
  sort_order: number; is_active: boolean; track_stock: boolean; master_product_id: string | null;
}
interface BonusRule {
  id: string; bonus_item_id: string; scope_type: string; category: string | null;
  master_product_id: string | null; sort_order: number; is_active: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  iphone: "iPhone", ipad: "iPad", macbook: "MacBook", watch: "Apple Watch", airpods: "AirPods",
};

function IconDisplay({ icon }: { icon: string | null }) {
  return (
    <div className="w-9 h-9 text-lg rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
      {icon ? (
        icon.startsWith("http")
          ? <img src={icon} alt="" className="w-full h-full object-cover" />
          : <span>{icon}</span>
      ) : (
        <Gift className="w-4 h-4 text-zinc-400" />
      )}
    </div>
  );
}

export default function EditPengaturanBonusPage() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";

  const [bonusItems, setBonusItems] = useState<BonusItem[]>([]);
  const [existingRules, setExistingRules] = useState<BonusRule[]>([]);
  const [selectedBonus, setSelectedBonus] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : "-";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, rulesRes] = await Promise.all([
      db.from("bonus_items").select("*").eq("is_active", true).order("sort_order"),
      db.from("bonus_rules").select("*").eq("scope_type", "category").eq("category", category),
    ]);
    const items: BonusItem[] = itemsRes.data ?? [];
    const rules: BonusRule[] = rulesRes.data ?? [];
    setBonusItems(items);
    setExistingRules(rules);
    setSelectedBonus(rules.map((r: BonusRule) => r.bonus_item_id));
    setLoading(false);
  }, [category]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allSelected = bonusItems.length > 0 && selectedBonus.length === bonusItems.length;
  function toggleAll() { setSelectedBonus(allSelected ? [] : bonusItems.map(b => b.id)); }
  function toggleBonus(id: string) {
    setSelectedBonus(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (selectedBonus.length === 0) {
      toast({ title: "Pilih minimal 1 bonus", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      for (const rule of existingRules) await db.from("bonus_rules").delete().eq("id", rule.id);
      await db.from("bonus_rules").insert(
        selectedBonus.map((bonus_item_id, i) => ({
          bonus_item_id, scope_type: "category", category, sort_order: i, is_active: true,
        }))
      );
      toast({ title: "Pengaturan diperbarui" });
      navigate("/admin/katalog/bonus?tab=rules");
    } catch {
      toast({ title: "Gagal menyimpan", variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <DashboardLayout pageTitle={`Edit — ${categoryLabel}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/katalog/bonus?tab=rules")} className="mt-0.5">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">Edit Pengaturan — {categoryLabel}</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Mode: Semua SKU Sama · Pilih bonus yang diberikan untuk semua {categoryLabel}.</p>
          </div>
          {isSuperAdmin && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => navigate("/admin/katalog/bonus?tab=rules")}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || selectedBonus.length === 0}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Simpan Perubahan
              </Button>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-700 flex items-center justify-between">
          <span>
            <strong>{selectedBonus.length}</strong> dari <strong>{bonusItems.length}</strong> bonus dipilih untuk semua {categoryLabel}.
          </span>
          {selectedBonus.length > 0 && (
            <button onClick={() => setSelectedBonus([])} className="text-blue-500 hover:text-blue-700 text-xs font-semibold underline underline-offset-2">
              Hapus semua
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : bonusItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-300 rounded-xl gap-2">
            <Gift className="w-10 h-10 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">Belum ada item bonus aktif</p>
          </div>
        ) : (
          <TooltipProvider>
          <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 border-b border-zinc-200 hover:bg-zinc-50">
                  <TableHead className="w-12 py-3">
                    <button
                      onClick={toggleAll}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto",
                        allSelected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300 hover:border-zinc-500"
                      )}
                    >
                      {allSelected && <span className="text-white text-xs font-bold leading-none">✓</span>}
                    </button>
                  </TableHead>
                  <TableHead className="font-bold text-xs text-foreground/70 uppercase tracking-wide py-3 min-w-[8rem]">Nama Bonus</TableHead>
                  <TableHead className="font-bold text-xs text-foreground/70 uppercase tracking-wide py-3 hidden sm:table-cell max-w-[12rem]">Deskripsi</TableHead>
                  <TableHead className="font-bold text-xs text-foreground/70 uppercase tracking-wide py-3 w-40 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      Tipe
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-zinc-400 cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-xs leading-snug">
                          <p><strong>Bebas</strong> — bonus diberikan tanpa batasan stok (misal: garansi, layanan).</p>
                          <p className="mt-1"><strong>Track Stok</strong> — bonus berupa item fisik; stok dipantau dan berkurang saat terjual.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonusItems.map(b => {
                  const checked = selectedBonus.includes(b.id);
                  return (
                    <TableRow
                      key={b.id}
                      onClick={() => toggleBonus(b.id)}
                      className={cn(
                        "cursor-pointer border-b border-zinc-100 transition-colors",
                        checked ? "bg-emerald-50/40" : "hover:bg-zinc-50"
                      )}
                    >
                      <TableCell className="py-4">
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all mx-auto",
                          checked ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"
                        )}>
                          {checked && <span className="text-white text-xs font-bold leading-none">✓</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <IconDisplay icon={b.icon} />
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-zinc-900 block">{b.name}</span>
                            <span className="text-xs text-zinc-400 line-clamp-1 sm:hidden mt-0.5">{b.description ?? ""}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 hidden sm:table-cell">
                        <span className="text-sm text-zinc-500 line-clamp-2 max-w-[12rem] block">
                          {b.description ?? <em className="text-zinc-300 not-italic">—</em>}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        {b.track_stock ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap cursor-default">
                                <Package className="w-3 h-3 shrink-0" /> Track Stok
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px] text-xs leading-snug">
                              Item fisik — stok dipantau otomatis dan berkurang setiap kali terjual.
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 whitespace-nowrap cursor-default">
                                Bebas
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px] text-xs leading-snug">
                              Bonus non-fisik (garansi, layanan, dll) — tidak ada batasan stok.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </TooltipProvider>
        )}

        {/* Bottom save bar */}
        {!loading && bonusItems.length > 0 && isSuperAdmin && (
          <div className="flex justify-end gap-3 pt-2 pb-6">
            <Button variant="outline" onClick={() => navigate("/admin/katalog/bonus?tab=rules")}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving || selectedBonus.length === 0}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
