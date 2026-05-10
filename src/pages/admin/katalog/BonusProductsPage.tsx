import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useToast } from "@/hooks/shared/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus, Edit3, Trash2, Gift, Camera, X, Loader2,
  Package, AlertTriangle, CheckSquare, Square, LayoutGrid, Settings2,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTabGroup } from "@/components/shared/AdminTabGroup";

/* ─────────── Types ─────────── */
interface BonusItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  track_stock: boolean;
  master_product_id: string | null;
}
interface StockSummary {
  master_product_id: string;
  name: string;
  qty_remaining: number;
}
interface MasterProduct {
  id: string;
  series: string;
  category: string;
  is_active?: boolean;
}

// master_product_id → is_active  (false = produk dinonaktifkan)
type MasterStatusMap = Record<string, boolean>;

// Helper: apakah bonus item ini "terblokir" karena master produk-nya nonaktif/dihapus
function isMasterBlocked(item: BonusItem, msMap: MasterStatusMap): boolean {
  if (!item.track_stock || !item.master_product_id) return false;
  const active = msMap[item.master_product_id];
  return active === false; // true jika produk ada di map tapi is_active=false
}

// Helper untuk POS: bonus item layak ditampilkan jika aktif, master aktif, dan stok ada
export function isBonusAvailableForPOS(
  item: BonusItem,
  msMap: MasterStatusMap,
  stocks: StockSummary[]
): boolean {
  if (!item.is_active) return false;
  if (isMasterBlocked(item, msMap)) return false;
  if (item.track_stock && item.master_product_id) {
    const s = stocks.find(s => s.master_product_id === item.master_product_id);
    if (!s || s.qty_remaining <= 0) return false;
  }
  return true;
}

interface BonusRule {
  id: string;
  bonus_item_id: string;
  scope_type: string;
  category: string | null;
  master_product_id: string | null;
  sort_order: number;
  is_active: boolean;
}
interface PengaturanRow {
  category: string;
  categoryLabel: string;
  scope: "category" | "sku";
  bonusIds: string[];
  ruleIds: string[];
}

const PRODUCT_CATEGORIES = [
  { key: "iphone",  label: "iPhone" },
  { key: "ipad",    label: "iPad" },
  { key: "macbook", label: "MacBook" },
  { key: "watch",   label: "Apple Watch" },
  { key: "airpods", label: "AirPods" },
];

/* ─────────── Upload helper ─────────── */
async function uploadImage(file: File, _path: string): Promise<string | null> {
  try {
    const { uploadFile } = await import("@/lib/upload");
    const result = await uploadFile(file, "products");
    return result.url;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
}

/* ─────────── Icon display ─────────── */
function IconDisplay({ icon, size = "md" }: { icon: string | null; size?: "sm" | "md" | "lg" }) {
  const cls = {
    sm: "w-9 h-9 text-lg rounded-lg",
    md: "w-12 h-12 text-2xl rounded-xl",
    lg: "w-14 h-14 text-3xl rounded-xl",
  }[size];
  return (
    <div className={cn("bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden", cls)}>
      {icon ? (
        icon.startsWith("http")
          ? <img src={icon} alt="" className="w-full h-full object-cover" />
          : <span>{icon}</span>
      ) : (
        <Gift className={cn("text-zinc-400", size === "sm" ? "w-4 h-4" : "w-5 h-5")} />
      )}
    </div>
  );
}

/* ─────────── Stock Badge ─────────── */
function StockBadge({ masterId, stocks, productName, masterBlocked }: {
  masterId: string | null;
  stocks: StockSummary[];
  productName: string;
  masterBlocked?: boolean;
}) {
  const navigate = useNavigate();
  if (!masterId) return null;
  // Master product deactivated — stock irrelevant
  if (masterBlocked) return null;
  const s = stocks.find(s => s.master_product_id === masterId);
  if (!s || s.qty_remaining <= 0)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-500 text-white font-semibold">
          <AlertTriangle className="w-3 h-3" /> Stok Habis
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs font-semibold"
          onClick={e => {
            e.stopPropagation();
            navigate(`/admin/stok-produk?tambah=1&pid=${masterId}&pname=${encodeURIComponent(productName)}`);
          }}
        >
          Update Stok
        </Button>
      </div>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500 text-white font-semibold">
      <Package className="w-3 h-3" /> Sisa {s.qty_remaining}
    </span>
  );
}

/* ─────────── Kanban Card ─────────── */
function BonusCard({
  item, stocks, msMap, isSuperAdmin, onEdit, onDelete,
}: {
  item: BonusItem;
  stocks: StockSummary[];
  msMap: MasterStatusMap;
  isSuperAdmin: boolean;
  onEdit: (item: BonusItem) => void;
  onDelete: (item: BonusItem) => void;
}) {
  const masterBlocked = isMasterBlocked(item, msMap);
  const effectivelyInactive = !item.is_active || masterBlocked;
  return (
    <div className={cn(
      "bg-white border-2 border-zinc-300 rounded-xl p-4 flex gap-4 items-start group transition-all hover:border-zinc-500 hover:shadow-md",
      effectivelyInactive && "opacity-60",
      masterBlocked && "border-amber-300 bg-amber-50/40",
    )}>
      <IconDisplay icon={item.icon} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-zinc-900 leading-tight">{item.name}</p>
        {item.description && (
          <p className="text-sm text-zinc-600 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {item.track_stock && (
            <StockBadge masterId={item.master_product_id} stocks={stocks} productName={item.name} masterBlocked={masterBlocked} />
          )}
          {masterBlocked && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-semibold">
              <AlertTriangle className="w-3 h-3" /> Nonaktif Otomatis
            </span>
          )}
          {!item.is_active && !masterBlocked && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-700 text-white font-semibold">Nonaktif</span>
          )}
        </div>
        {masterBlocked && (
          <p className="text-[11px] text-amber-700 mt-1.5 font-medium">
            Produk terkait dinonaktifkan di katalog — bonus ini tidak akan muncul di POS.
          </p>
        )}
      </div>
      {isSuperAdmin && (
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(item)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(item)} className="p-2 rounded-lg hover:bg-red-50 text-zinc-500 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────── Kanban Column ─────────── */
function KanbanColumn({
  title, description, accentColor, items, stocks, msMap, isSuperAdmin, onEdit, onDelete,
}: {
  title: string;
  description: string;
  accentColor: "green" | "gray";
  items: BonusItem[];
  stocks: StockSummary[];
  msMap: MasterStatusMap;
  isSuperAdmin: boolean;
  onEdit: (item: BonusItem) => void;
  onDelete: (item: BonusItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isGreen = accentColor === "green";

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header — collapsible */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={cn(
          "w-full rounded-t-xl border-2 px-5 py-4 flex items-center justify-between text-left transition-colors",
          isGreen
            ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
            : "border-zinc-300 bg-zinc-100 hover:bg-zinc-200",
          !isOpen && "rounded-b-xl"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-base font-bold", isGreen ? "text-emerald-800" : "text-zinc-800")}>
              {title}
            </span>
            <span className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
              isGreen ? "bg-emerald-200 text-emerald-800" : "bg-zinc-200 text-zinc-600"
            )}>
              {items.length}
            </span>
          </div>
          {isOpen && (
            <p className={cn("text-sm mt-0.5", isGreen ? "text-emerald-600" : "text-zinc-500")}>
              {description}
            </p>
          )}
        </div>
        {isOpen
          ? <ChevronUp className={cn("w-4 h-4 shrink-0", isGreen ? "text-emerald-600" : "text-zinc-500")} />
          : <ChevronDown className={cn("w-4 h-4 shrink-0", isGreen ? "text-emerald-600" : "text-zinc-500")} />
        }
      </button>

      {/* Body */}
      {isOpen && (
        <div className={cn(
          "border-2 border-t-0 rounded-b-xl p-3 space-y-2.5 min-h-[200px]",
          isGreen ? "border-emerald-300" : "border-zinc-300"
        )}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Gift className="w-8 h-8 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-400">Belum ada item</p>
            </div>
          ) : items.map(item => (
            <BonusCard key={item.id} item={item} stocks={stocks} msMap={msMap}
              isSuperAdmin={isSuperAdmin} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── FAQ Accordion ─────────── */
function FaqSection({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion type="single" collapsible className="border-2 border-zinc-200 rounded-xl overflow-hidden bg-white">
      {items.map((item, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className={cn(i < items.length - 1 && "border-b-2 border-zinc-200")}>
          <AccordionTrigger className="px-5 py-3.5 text-sm font-bold text-zinc-900 hover:bg-zinc-50 hover:no-underline">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4 text-sm text-zinc-600 leading-relaxed border-t-2 border-zinc-100 pt-3">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/* ═══════════ TAB 2 — PENGATURAN PER PRODUK ═══════════ */
function buildPengaturanRows(rules: BonusRule[]): PengaturanRow[] {
  const map = new Map<string, PengaturanRow>();
  for (const rule of rules) {
    if (rule.scope_type === "category" && rule.category) {
      const cat = PRODUCT_CATEGORIES.find(c => c.key === rule.category);
      const key = `cat:${rule.category}`;
      if (!map.has(key)) {
        map.set(key, { category: rule.category, categoryLabel: cat?.label ?? rule.category, scope: "category", bonusIds: [], ruleIds: [] });
      }
      const row = map.get(key)!;
      row.bonusIds.push(rule.bonus_item_id);
      row.ruleIds.push(rule.id);
    }
  }
  return Array.from(map.values());
}

/* ─── Tambah Pengaturan Modal ─── */
function TambahPengaturanModal({
  open, onClose, onSaved, bonusItems, existingRows, msMap,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  bonusItems: BonusItem[]; existingRows: PengaturanRow[]; msMap: MasterStatusMap;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCat, setSelectedCat] = useState("");
  const [scope, setScope] = useState<"category" | "sku" | "">("");
  const [selectedBonus, setSelectedBonus] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function reset() { setStep(1); setSelectedCat(""); setScope(""); setSelectedBonus([]); }
  function handleClose() { reset(); onClose(); }

  const catWithAllSku = new Set(existingRows.filter(r => r.scope === "category").map(r => r.category));
  // Only show bonus items that are manually active AND not blocked by inactive master product
  const activeBonus = bonusItems.filter(b => b.is_active && !isMasterBlocked(b, msMap));
  const allSelected = selectedBonus.length === activeBonus.length;

  function toggleAll() { setSelectedBonus(allSelected ? [] : activeBonus.map(b => b.id)); }
  function toggleBonus(id: string) { setSelectedBonus(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }

  async function handleSave() {
    if (selectedBonus.length === 0) { toast({ title: "Pilih minimal 1 bonus", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await db.from("bonus_rules").insert(
        selectedBonus.map((bonus_item_id, i) => ({ bonus_item_id, scope_type: "category", category: selectedCat, sort_order: i, is_active: true }))
      );
      toast({ title: "Pengaturan bonus disimpan" });
      onSaved(); handleClose();
    } catch { toast({ title: "Gagal menyimpan", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  const catLabel = PRODUCT_CATEGORIES.find(c => c.key === selectedCat)?.label ?? selectedCat;

  const stepLabels = ["Pilih Kategori", "Pilih Mode", "Pilih Bonus"];
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Tambah Pengaturan Bonus</DialogTitle>
          <DialogDescription>Tentukan bonus yang diberikan untuk suatu kategori produk.</DialogDescription>
        </DialogHeader>
        {/* Step bar */}
        <div className="flex items-center gap-2 my-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                step === s ? "bg-zinc-900 text-white" : step > s ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"
              )}>{step > s ? "✓" : s}</div>
              {s < 3 && <div className={cn("h-0.5 w-10 rounded-full", step > s ? "bg-emerald-400" : "bg-zinc-200")} />}
            </div>
          ))}
          <span className="text-sm font-semibold text-zinc-600 ml-2">{stepLabels[step - 1]}</span>
        </div>

        <div className="space-y-4 py-1">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">Untuk kategori produk mana bonus ini akan diatur?</p>
              <div className="grid grid-cols-2 gap-2.5">
                {PRODUCT_CATEGORIES.map(cat => {
                  const hasRule = catWithAllSku.has(cat.key);
                  return (
                    <button key={cat.key} onClick={() => { if (!hasRule) setSelectedCat(cat.key); }} disabled={hasRule}
                      className={cn("flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all",
                        selectedCat === cat.key ? "border-zinc-900 bg-zinc-900 text-white"
                          : hasRule ? "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                          : "border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50 text-zinc-800"
                      )}>
                      <span>{cat.label}</span>
                      {hasRule && <span className="text-[11px] bg-zinc-300 text-zinc-600 px-1.5 py-0.5 rounded font-bold">Ada</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">Untuk <strong className="text-zinc-900">{catLabel}</strong>, bagaimana bonus diterapkan?</p>
              <div className="space-y-2.5">
                <button onClick={() => setScope("category")}
                  className={cn("w-full flex gap-3 items-start p-4 rounded-xl border-2 text-left transition-all",
                    scope === "category" ? "border-zinc-900 bg-zinc-900/5" : "border-zinc-300 hover:border-zinc-500"
                  )}>
                  <div className={cn("w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                    scope === "category" ? "border-zinc-900" : "border-zinc-400"
                  )}>
                    {scope === "category" && <div className="w-2.5 h-2.5 rounded-full bg-zinc-900" />}
                  </div>
                  <div>
                    <p className="text-base font-bold text-zinc-900">Semua SKU Sama</p>
                    <p className="text-sm text-zinc-600 mt-1 leading-relaxed">Satu konfigurasi bonus berlaku untuk seluruh produk dalam kategori {catLabel}.</p>
                  </div>
                </button>
                <button disabled
                  className="w-full flex gap-3 items-start p-4 rounded-xl border-2 border-zinc-200 bg-zinc-50 opacity-50 cursor-not-allowed text-left">
                  <div className="w-5 h-5 rounded-full border-2 border-zinc-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-base font-bold text-zinc-900">Per SKU
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-zinc-300 text-zinc-600 font-semibold">Segera Hadir</span>
                    </p>
                    <p className="text-sm text-zinc-500 mt-1 leading-relaxed">Tiap model dikonfigurasi bonus-nya sendiri-sendiri.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-800">Pilih bonus untuk semua <span className="text-zinc-900">{catLabel}</span>:</p>
                <button onClick={toggleAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800 hover:text-black border border-zinc-300 px-3 py-1.5 rounded-lg hover:border-zinc-600 transition-colors">
                  {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {allSelected ? "Hapus Semua" : "Pilih Semua"}
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {activeBonus.map(b => {
                  const checked = selectedBonus.includes(b.id);
                  return (
                    <div key={b.id} onClick={() => toggleBonus(b.id)}
                      className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all",
                        checked ? "border-zinc-900 bg-zinc-900/5" : "border-zinc-200 hover:border-zinc-400 bg-white"
                      )}>
                      <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                        checked ? "bg-zinc-900 border-zinc-900" : "border-zinc-400"
                      )}>
                        {checked && <span className="text-white text-xs font-bold leading-none">✓</span>}
                      </div>
                      <IconDisplay icon={b.icon} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900">{b.name}</p>
                        {b.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{b.description}</p>}
                      </div>
                      {b.track_stock && <Package className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
              <p className="text-sm font-medium text-zinc-600">{selectedBonus.length} dari {activeBonus.length} bonus dipilih.</p>
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="outline" onClick={step === 1 ? handleClose : () => setStep(s => (s - 1) as 1 | 2 | 3)}>
            {step === 1 ? "Batal" : "← Kembali"}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(s => (s + 1) as 2 | 3)} disabled={step === 1 ? !selectedCat : !scope}>
              Lanjut →
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || selectedBonus.length === 0}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Pengaturan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Pengaturan per Produk Tab ─── */
function PengaturanPerProdukTab({
  bonusItems, rules, msMap, stocks, onRulesChange,
}: { bonusItems: BonusItem[]; rules: BonusRule[]; msMap: MasterStatusMap; stocks: StockSummary[]; onRulesChange: () => void; }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tambahOpen, setTambahOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<PengaturanRow | null>(null);

  const rows = buildPengaturanRows(rules);

  async function handleDelete(row: PengaturanRow) {
    try {
      for (const id of row.ruleIds) await db.from("bonus_rules").delete().eq("id", id);
      toast({ title: `Pengaturan ${row.categoryLabel} dihapus` });
      onRulesChange();
    } catch { toast({ title: "Gagal menghapus", variant: "destructive" }); }
    finally { setDeletingRow(null); }
  }

  return (
    <div className="space-y-5">
      {/* FAQ Accordion */}
      <FaqSection items={[
        {
          q: "Apa bedanya Semua SKU Sama vs Per SKU?",
          a: "Semua SKU Sama berarti satu konfigurasi bonus berlaku untuk seluruh produk dalam kategori tersebut — misalnya semua iPhone dapat Softcase + Temperglass. Per SKU berarti setiap model dikonfigurasi sendiri-sendiri (fitur ini segera hadir).",
        },
        {
          q: "Bagaimana cara kerja pengaturan bonus di POS?",
          a: "Saat transaksi di POS, sistem akan cek apakah produk punya pengaturan Per SKU. Jika ada, bonus Per SKU yang digunakan. Jika tidak ada, sistem cek pengaturan kategori. Jika keduanya tidak ada, tidak ada bonus yang muncul.",
        },
        {
          q: "Bisakah satu kategori punya dua mode sekaligus?",
          a: "Tidak bisa. Satu kategori hanya boleh punya satu mode. Untuk ganti mode, hapus pengaturan yang ada terlebih dahulu, baru tambah pengaturan dengan mode baru.",
        },
      ]} />

      {/* Header + add */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Daftar Pengaturan</h3>
          <p className="text-sm text-zinc-500">{rows.length} kategori dikonfigurasi</p>
        </div>
        <Button onClick={() => setTambahOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Tambah Pengaturan
        </Button>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-300 rounded-xl gap-3">
          <Settings2 className="w-12 h-12 text-zinc-300" />
          <p className="text-base font-bold text-zinc-700">Belum ada pengaturan</p>
          <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed">Klik "Tambah Pengaturan" untuk mengatur bonus per kategori produk.</p>
        </div>
      ) : (
        <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 border-b border-zinc-200 hover:bg-zinc-50">
                <TableHead className="font-semibold text-xs text-zinc-500 uppercase tracking-wide py-3">Kategori</TableHead>
                <TableHead className="font-semibold text-xs text-zinc-500 uppercase tracking-wide py-3">Mode</TableHead>
                <TableHead className="font-semibold text-xs text-zinc-500 uppercase tracking-wide py-3">Bonus Diberikan</TableHead>
                <TableHead className="font-semibold text-xs text-zinc-500 uppercase tracking-wide py-3 w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const bonusNames = row.bonusIds.map(id => bonusItems.find(b => b.id === id)?.name).filter(Boolean);
                return (
                  <TableRow key={`${row.category}:${row.scope}`} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <TableCell className="font-bold text-sm text-zinc-900 py-4">{row.categoryLabel}</TableCell>
                    <TableCell className="py-4">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
                        row.scope === "category" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                      )}>
                        {row.scope === "category" ? "Semua SKU Sama" : "Per SKU"}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      {bonusNames.length === 0 ? (
                        <span className="text-sm text-zinc-400 italic">Tidak ada</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {row.bonusIds.slice(0, 4).map(bid => {
                            const b = bonusItems.find(bi => bi.id === bid);
                            if (!b) return null;
                            const blocked = isMasterBlocked(b, msMap);
                            const noStock = b.track_stock && b.master_product_id
                              ? (() => { const s = stocks.find(s => s.master_product_id === b.master_product_id); return !s || s.qty_remaining <= 0; })()
                              : false;
                            const warn = blocked || noStock;
                            return (
                              <span key={bid} className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border",
                                warn
                                  ? "bg-amber-50 text-amber-700 border-amber-300"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-200"
                              )}>
                                {warn && <AlertTriangle className="w-3 h-3 shrink-0" />}
                                {b.name}
                              </span>
                            );
                          })}
                          {row.bonusIds.length > 4 && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 border border-zinc-200">+{row.bonusIds.length - 4} lagi</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {row.scope === "category" && (
                          <button
                            onClick={() => navigate(`/admin/katalog/bonus/pengaturan/${row.category}`)}
                            className="p-2 rounded-lg hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors"
                            title="Edit pengaturan"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setDeletingRow(row)} className="p-2 rounded-lg hover:bg-red-50 text-zinc-500 hover:text-red-600 transition-colors" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TambahPengaturanModal open={tambahOpen} onClose={() => setTambahOpen(false)} onSaved={onRulesChange} bonusItems={bonusItems} existingRows={rows} msMap={msMap} />

      <Dialog open={!!deletingRow} onOpenChange={v => { if (!v) setDeletingRow(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Hapus Pengaturan</DialogTitle>
            <DialogDescription className="text-base">
              Seluruh pengaturan bonus untuk <strong>{deletingRow?.categoryLabel}</strong> akan dihapus. Tindakan ini tidak bisa diurungkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingRow(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => deletingRow && handleDelete(deletingRow)}>Ya, Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════ ADD BONUS MODAL ═══════════ */
function AddBonusModal({
  open, onClose, onSaved, allMasters,
}: { open: boolean; onClose: () => void; onSaved: () => void; allMasters: MasterProduct[]; }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null); const [trackStock, setTrackStock] = useState(false);
  const [masterSearch, setMasterSearch] = useState(""); const [selectedMaster, setSelectedMaster] = useState<MasterProduct | null>(null);
  const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  function reset() { setName(""); setDescription(""); setIcon(null); setTrackStock(false); setMasterSearch(""); setSelectedMaster(null); setUploadStatus(null); }
  function handleClose() { reset(); onClose(); }

  const accessoryMasters = allMasters.filter(m => m.category === "accessory");
  const filteredMasters = accessoryMasters.filter(m => m.series.toLowerCase().includes(masterSearch.toLowerCase()));

  async function handleIconUpload(file: File) {
    setUploading(true);
    setUploadStatus("Mengupload...");
    const path = `bonus/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const url = await uploadImage(file, path);
    setUploading(false);
    if (url) {
      setIcon(url);
      setUploadStatus("✓ Foto berhasil diupload");
    } else {
      setUploadStatus("✗ Upload gagal — cek bucket catalog-images");
    }
  }

  async function handleSave() {
    if (!name.trim()) { toast({ title: "Nama wajib diisi", variant: "destructive" }); return; }
    if (trackStock && !selectedMaster) {
      toast({ title: "Pilih master produk", description: "Wajib pilih produk dari manajemen stok saat Perhitungkan Stok aktif.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await db.from("bonus_items").insert({
      name: name.trim(),
      description: description.trim() || null,
      icon,
      track_stock: trackStock,
      master_product_id: trackStock && selectedMaster ? selectedMaster.id : null,
      is_active: true,
      sort_order: 99,
    });
    setSaving(false);
    if (error) { toast({ title: "Gagal", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Bonus ditambahkan" });
    onSaved(); handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Tambah Item Bonus</DialogTitle>
          <DialogDescription>Tambah item bonus baru ke master list.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Nama Bonus</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Softcase" className="text-base font-medium" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Deskripsi <span className="font-normal normal-case text-zinc-400">(opsional)</span></label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Keterangan singkat tentang bonus ini…" className="min-h-[72px] resize-none text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Foto / Ikon</label>
            <div className="flex items-start gap-3">
              <div
                className="w-16 h-16 rounded-xl border-2 border-dashed border-zinc-400 bg-zinc-50 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 hover:border-zinc-600 transition-colors overflow-hidden shrink-0"
                onClick={() => fileRef.current?.click()}
              >
                {uploading
                  ? <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                  : icon
                  ? (icon.startsWith("http")
                      ? <img src={icon} alt="" className="w-full h-full object-cover" />
                      : <span className="text-2xl">{icon}</span>)
                  : <>
                      <Camera className="w-5 h-5 text-zinc-400" />
                      <span className="text-[10px] text-zinc-400 mt-1 font-medium">Klik upload</span>
                    </>
                }
              </div>
              <div className="flex-1 space-y-2">
                <Input value={icon && !icon.startsWith("http") ? icon : ""} onChange={e => setIcon(e.target.value || null)} placeholder="Atau ketik emoji (🎁)" className="text-base" />
                {uploadStatus && (
                  <p className={cn("text-xs font-semibold", uploadStatus.startsWith("✓") ? "text-emerald-600" : uploadStatus.startsWith("✗") ? "text-red-600" : "text-zinc-500")}>
                    {uploadStatus}
                  </p>
                )}
                {icon && <Button variant="outline" size="sm" onClick={() => { setIcon(null); setUploadStatus(null); }} className="h-7 text-xs font-semibold"><X className="w-3 h-3 mr-1" />Hapus</Button>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleIconUpload(f); e.target.value = ""; }} />
          </div>

          {/* Toggle Perhitungkan Stok */}
          <div className="flex items-center justify-between p-4 rounded-xl border-2 border-zinc-300 bg-white">
            <div>
              <p className="text-sm font-bold text-zinc-900">Perhitungkan Stok</p>
              <p className="text-xs text-zinc-500 mt-0.5">Aktifkan untuk bonus aksesoris fisik dengan stok terbatas</p>
            </div>
            <button type="button" onClick={() => { setTrackStock(!trackStock); setSelectedMaster(null); setMasterSearch(""); }}
              className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
                trackStock ? "bg-emerald-500" : "bg-zinc-300")}>
              <span className={cn("inline-block rounded-full bg-white shadow-sm transition-transform",
                trackStock ? "translate-x-5" : "translate-x-1")} style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Master product selector — only when trackStock is ON */}
          {trackStock && (
            <div className="space-y-2 border-2 border-emerald-400 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-sm font-bold text-zinc-900">Koneksi ke Master Stok Produk</p>
                <span className="text-xs font-bold text-red-500">*Wajib</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pilih produk dari manajemen stok. Setiap kali bonus ini diberikan, stok produk tersebut akan otomatis berkurang 1.
              </p>
              {selectedMaster ? (
                <div className="flex items-center justify-between p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{selectedMaster.series}</p>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">Terhubung ✓</p>
                  </div>
                  <button onClick={() => { setSelectedMaster(null); setMasterSearch(""); }}
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 border border-zinc-300 px-2.5 py-1 rounded-lg">
                    Ganti
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Cari nama produk aksesoris…"
                    value={masterSearch}
                    onChange={e => setMasterSearch(e.target.value)}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="max-h-44 overflow-y-auto space-y-1.5">
                    {filteredMasters.length === 0 ? (
                      <p className="text-sm text-zinc-400 text-center py-4 font-medium">
                        {accessoryMasters.length === 0 ? "Tidak ada produk aksesoris di master data" : "Produk tidak ditemukan"}
                      </p>
                    ) : filteredMasters.map(m => (
                      <button key={m.id} onClick={() => setSelectedMaster(m)}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold border-2 border-zinc-200 hover:border-zinc-700 hover:bg-zinc-50 text-zinc-800 transition-all">
                        {m.series}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Batal</Button>
          <Button onClick={handleSave} disabled={saving || (trackStock && !selectedMaster)}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Tambahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Bonus Item Modal ─── */
function EditBonusModal({
  item, open, onClose, onSaved,
}: { item: BonusItem | null; open: boolean; onClose: () => void; onSaved: () => void; }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null); const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true); const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false); const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    if (item) { setName(item.name); setDescription(item.description ?? ""); setIcon(item.icon); setSortOrder(item.sort_order); setIsActive(item.is_active); setUploadStatus(null); }
  }, [item]);

  async function handleIconUpload(file: File) {
    setUploading(true); setUploadStatus("Mengupload...");
    const path = `bonus/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const url = await uploadImage(file, path);
    setUploading(false);
    if (url) { setIcon(url); setUploadStatus("✓ Foto berhasil diupload"); }
    else { setUploadStatus("✗ Upload gagal — cek bucket catalog-images"); }
  }

  async function handleSave() {
    if (!item || !name.trim()) return;
    setSaving(true);
    const { error } = await db.from("bonus_items").update({ name: name.trim(), description: description.trim() || null, icon, sort_order: sortOrder, is_active: isActive }).eq("id", item.id);
    setSaving(false);
    if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Bonus diperbarui" });
    onSaved(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-lg font-bold">Edit Item Bonus</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Nama Bonus</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="text-base font-medium" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Deskripsi <span className="font-normal normal-case text-zinc-400">(opsional)</span></label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-[72px] resize-none text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Foto / Ikon</label>
            <div className="flex items-start gap-3">
              <div
                className="w-16 h-16 rounded-xl border-2 border-dashed border-zinc-400 bg-zinc-50 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 hover:border-zinc-600 overflow-hidden shrink-0"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                  : icon ? (icon.startsWith("http") ? <img src={icon} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">{icon}</span>)
                  : <><Camera className="w-5 h-5 text-zinc-400" /><span className="text-[10px] text-zinc-400 mt-1 font-medium">Klik upload</span></>}
              </div>
              <div className="flex-1 space-y-2">
                <Input value={icon && !icon.startsWith("http") ? icon : ""} onChange={e => setIcon(e.target.value || null)} placeholder="Atau ketik emoji (🎁)" className="text-base" />
                {uploadStatus && (
                  <p className={cn("text-xs font-semibold", uploadStatus.startsWith("✓") ? "text-emerald-600" : uploadStatus.startsWith("✗") ? "text-red-600" : "text-zinc-500")}>{uploadStatus}</p>
                )}
                {icon && <Button variant="outline" size="sm" onClick={() => { setIcon(null); setUploadStatus(null); }} className="h-7 text-xs font-semibold"><X className="w-3 h-3 mr-1" />Hapus</Button>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleIconUpload(f); e.target.value = ""; }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Urutan</label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} className="text-base" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Status</label>
              <button type="button" onClick={() => setIsActive(!isActive)}
                className={cn("w-full h-10 rounded-lg border-2 text-sm font-bold transition-colors",
                  isActive ? "bg-emerald-500 border-emerald-500 text-white" : "bg-zinc-200 border-zinc-300 text-zinc-700"
                )}>{isActive ? "Aktif" : "Nonaktif"}</button>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════ MAIN PAGE ═══════════ */
export default function BonusProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = role === "super_admin";

  const [activeTab, setActiveTab] = useState<"items" | "rules">(() =>
    searchParams.get("tab") === "rules" ? "rules" : "items"
  );
  const [items, setItems] = useState<BonusItem[]>([]);
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [rules, setRules] = useState<BonusRule[]>([]);
  const [allMasters, setAllMasters] = useState<MasterProduct[]>([]);
  const [msMap, setMsMap] = useState<MasterStatusMap>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<BonusItem | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bonusRes, stockRes, mastersRes, rulesRes] = await Promise.all([
      db.from("bonus_items").select("*").order("sort_order"),
      db.from("accessory_stock_summary").select("*"),
      // Only fetch accessory master products — msMap only needed for track_stock bonuses
      db.from("master_products").select("id, series, category, is_active")
        .is("deleted_at", null).eq("category", "accessory"),
      db.from("bonus_rules").select("*").order("sort_order"),
    ]);
    const allM: MasterProduct[] = mastersRes.data ?? [];
    // Build status map: id → is_active
    const map: MasterStatusMap = {};
    allM.forEach(m => { map[m.id] = m.is_active ?? true; });
    setMsMap(map);
    // Only active masters for AddBonusModal dropdown
    setAllMasters(allM.filter(m => m.is_active !== false));
    setItems(bonusRes.data ?? []);
    setStocks(stockRes.data ?? []);
    setRules(rulesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleDelete(item: BonusItem) {
    if (!confirm(`Hapus bonus "${item.name}"?`)) return;
    const { error } = await db.from("bonus_items").delete().eq("id", item.id);
    if (error) { toast({ title: "Gagal menghapus", variant: "destructive" }); return; }
    toast({ title: "Bonus dihapus" });
    fetchAll();
  }

  const tracked = items.filter(i => i.track_stock).sort((a, b) => a.sort_order - b.sort_order);
  const nonTracked = items.filter(i => !i.track_stock).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <DashboardLayout pageTitle="Bonus Produk">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">Bonus Produk</h2>
            <p className="text-base text-zinc-500 mt-0.5">Kelola item bonus dan aturan pemberian per kategori produk.</p>
          </div>
          {isSuperAdmin && activeTab === "items" && (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Tambah Bonus
            </Button>
          )}
        </div>

        {/* ── Tabs ── */}
        <AdminTabGroup
          tabs={[
            { key: "items" as const, label: "Item Bonus", icon: LayoutGrid },
            { key: "rules" as const, label: "Pengaturan per Produk", icon: Settings2 },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {/* ── Tab: Item Bonus ── */}
        {activeTab === "items" && (
          <>
            <FaqSection items={[
              {
                q: "Apa itu kolom Diperhitungkan Stok?",
                a: "Item di kolom ini terhubung ke produk fisik (aksesoris) yang stoknya terbatas. Setiap bonus diberikan ke pelanggan, stok otomatis berkurang. Contoh: Adaptor — setiap transaksi, stok berkurang 1 unit.",
              },
              {
                q: "Apa itu kolom Tidak Perlu Perhatian Khusus?",
                a: "Item di kolom ini tidak punya stok fisik yang perlu dilacak. Bonus bisa diberikan bebas tanpa batas. Contoh: Sinyal Permanen, Garansi Unit — tidak ada barang fisik yang berkurang.",
              },
            ]} />

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[...Array(2)].map((_, ci) => (
                  <div key={ci} className="rounded-xl border-2 border-zinc-300 p-4 space-y-3 animate-pulse">
                    {[...Array(3)].map((_, i) => <div key={i} className="bg-zinc-200 rounded-lg h-16" />)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <KanbanColumn
                  title="Diperhitungkan Stok"
                  description="Aksesoris fisik dengan stok terlacak per transaksi"
                  accentColor="green"
                  items={tracked} stocks={stocks} msMap={msMap}
                  isSuperAdmin={isSuperAdmin} onEdit={setEditItem} onDelete={handleDelete}
                />
                <KanbanColumn
                  title="Tidak Perlu Perhatian Khusus"
                  description="Bonus tanpa batas, tidak butuh tracking stok"
                  accentColor="gray"
                  items={nonTracked} stocks={stocks} msMap={msMap}
                  isSuperAdmin={isSuperAdmin} onEdit={setEditItem} onDelete={handleDelete}
                />
              </div>
            )}
          </>
        )}

        {/* ── Tab: Pengaturan per Produk ── */}
        {activeTab === "rules" && (
          <PengaturanPerProdukTab bonusItems={items} rules={rules} msMap={msMap} stocks={stocks} onRulesChange={fetchAll} />
        )}
      </div>

      <AddBonusModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={fetchAll} allMasters={allMasters} />
      <EditBonusModal item={editItem} open={!!editItem} onClose={() => setEditItem(null)} onSaved={fetchAll} />
    </DashboardLayout>
  );
}
