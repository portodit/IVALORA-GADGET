import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/shared/SectionCard";
import { cn } from "@/lib/utils";
import {
  RefreshCw, Settings2, ChevronDown, ChevronRight,
  Zap, Globe, Pencil, Save, X, CheckCircle2, AlertTriangle, ArrowUpRight, Sparkles,
} from "lucide-react";

interface DokuChannel {
  id: string;
  channel_key: string;
  doku_method: string;
  display_name: string;
  full_name: string;
  section: string;
  is_enabled: boolean;
  partner_service_id: string | null;
  snap_supported: boolean;
  fee_label: string | null;
  logo_url: string | null;
  sort_order: number;
  notes: string | null;
}

const SECTION_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  va:       { label: "Virtual Account", color: "bg-blue-100 text-blue-700",  icon: Globe },
  paylater: { label: "PayLater",        color: "bg-amber-100 text-amber-700", icon: Settings2 },
};

type SnapStatus = "active" | "no_psi" | "checkout";
function getSnapStatus(ch: DokuChannel): SnapStatus {
  if (!ch.snap_supported) return "checkout";
  if (!ch.partner_service_id?.trim()) return "no_psi";
  return "active";
}

export default function DokuChannelSettings() {
  const { toast } = useToast();
  const [channels, setChannels]       = useState<DokuChannel[]>([]);
  const [loading, setLoading]         = useState(true);
  const [enablingAll, setEnablingAll] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ va: true });
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editPsi, setEditPsi]         = useState("");
  const [toggling, setToggling]       = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("doku_payment_channels")
      .select("*")
      .order("sort_order");
    if (error) {
      toast({ title: "Gagal memuat kanal DOKU", description: error.message, variant: "destructive" });
    } else {
      setChannels((data as unknown as DokuChannel[]) ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const toggleEnabled = async (ch: DokuChannel) => {
    setToggling(ch.id);
    const { error } = await supabase
      .from("doku_payment_channels")
      .update({ is_enabled: !ch.is_enabled, updated_at: new Date().toISOString() } as never)
      .eq("id", ch.id);
    if (error) {
      toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
    } else {
      setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, is_enabled: !c.is_enabled } : c));
    }
    setToggling(null);
  };

  const setSnapMode = async (ch: DokuChannel, enableSnap: boolean) => {
    if (ch.snap_supported === enableSnap) return;
    const { error } = await supabase
      .from("doku_payment_channels")
      .update({ snap_supported: enableSnap, updated_at: new Date().toISOString() } as never)
      .eq("id", ch.id);
    if (error) {
      toast({ title: "Gagal mengubah mode", description: error.message, variant: "destructive" });
    } else {
      setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, snap_supported: enableSnap } : c));
    }
  };

  const enableAllSnap = async () => {
    const targets = channels.filter(c => c.section === "va" && !c.snap_supported);
    if (targets.length === 0) return;
    setEnablingAll(true);
    const { error } = await supabase
      .from("doku_payment_channels")
      .update({ snap_supported: true, updated_at: new Date().toISOString() } as never)
      .in("id", targets.map(c => c.id));
    if (error) {
      toast({ title: "Gagal mengaktifkan semua SNAP", description: error.message, variant: "destructive" });
    } else {
      setChannels(prev => prev.map(c => c.section === "va" ? { ...c, snap_supported: true } : c));
      toast({ title: "Semua kanal VA sudah mode SNAP BI" });
    }
    setEnablingAll(false);
  };

  const startEditPsi = (ch: DokuChannel) => { setEditingId(ch.id); setEditPsi(ch.partner_service_id ?? ""); };
  const cancelEditPsi = () => setEditingId(null);

  const savePsi = async (ch: DokuChannel) => {
    const val = editPsi.trim() || null;
    const { error } = await supabase
      .from("doku_payment_channels")
      .update({ partner_service_id: val, updated_at: new Date().toISOString() } as never)
      .eq("id", ch.id);
    if (error) {
      toast({ title: "Gagal simpan PSI", description: error.message, variant: "destructive" });
    } else {
      setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, partner_service_id: val } : c));
      toast({ title: `PSI ${ch.display_name} disimpan` });
    }
    setEditingId(null);
  };

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const sections = ["va", "paylater"];
  const grouped  = sections
    .map(s => ({ key: s, ...SECTION_META[s], items: channels.filter(c => c.section === s) }))
    .filter(g => g.items.length > 0);

  const enabledCount    = channels.filter(c => c.is_enabled).length;
  const vaChannels      = channels.filter(c => c.section === "va");
  const snapActiveCount = vaChannels.filter(c => getSnapStatus(c) === "active").length;
  const allVaSnap       = vaChannels.length > 0 && vaChannels.every(c => c.snap_supported);

  if (loading) {
    return (
      <SectionCard>
        <div className="space-y-3 p-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-zinc-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            DOKU Payment Gateway
          </h2>
          <p className="text-xs text-muted-foreground mt-1 ml-10">
            {enabledCount} dari {channels.length} kanal aktif
            {vaChannels.length > 0 && (
              <span className={cn("ml-2 font-semibold", snapActiveCount === vaChannels.length ? "text-emerald-600" : "text-zinc-500")}>
                · {snapActiveCount}/{vaChannels.length} VA pakai SNAP BI
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchChannels}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* ── Penjelasan cara kerja DOKU di POS ─────────────────────────────── */}
      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
        <p className="text-xs font-bold text-zinc-700">
          Virtual Account &amp; PayLater diproses otomatis via DOKU.
        </p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Ketika admin pilih VA di POS, nomor VA langsung tersedia (mode SNAP BI) tanpa customer perlu
          buka link. Pilih mode <span className="font-semibold text-zinc-700">SNAP BI</span> atau{" "}
          <span className="font-semibold text-zinc-700">Checkout</span> per kanal, dan pastikan{" "}
          <span className="font-semibold text-zinc-700">PSI</span> (Partner Service ID) sudah diisi
          agar SNAP aktif.
        </p>
      </div>

      {/* ── 3 info card: mode VA ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-xs font-bold text-emerald-800">SNAP BI aktif</p>
          </div>
          <p className="text-xs text-emerald-700 leading-relaxed">
            Nomor VA langsung tersedia begitu transaksi dibuat. Admin bisa langsung salin &amp; kirim
            ke customer via WhatsApp — tanpa perlu customer buka link apapun.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-xs font-bold text-amber-800">SNAP — PSI kosong</p>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            Mode SNAP dipilih tapi PSI belum diisi. Sistem otomatis fallback ke Checkout — customer
            tetap dapat link DOKU, nomor VA baru muncul setelah link dibuka.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-zinc-100 border border-zinc-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-zinc-500 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-xs font-bold text-zinc-700">Checkout</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Customer menerima link pembayaran DOKU. Nomor VA baru muncul setelah customer membuka
            link tersebut.
          </p>
        </div>
      </div>

      {/* ── Channel list ────────────────────────────────────────────────────── */}
      {grouped.map(group => {
        const SectionIcon = group.icon;
        const isExpanded  = expandedSections[group.key] ?? false;
        const activeCount = group.items.filter(i => i.is_enabled).length;
        const snapCount   = group.key === "va"
          ? group.items.filter(c => getSnapStatus(c) === "active").length
          : null;

        return (
          <SectionCard key={group.key}>
            {/* Section header */}
            <div className="flex items-center gap-2 p-3">
              <button
                onClick={() => toggleSection(group.key)}
                className="flex-1 flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
              >
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", group.color)}>
                  <SectionIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-900">{group.label}</p>
                  <p className="text-xs font-medium text-zinc-400">
                    {activeCount}/{group.items.length} aktif
                    {snapCount !== null && (
                      <span className={cn(
                        "ml-1.5 font-semibold",
                        snapCount === group.items.length ? "text-emerald-600" : "text-zinc-400"
                      )}>
                        · {snapCount}/{group.items.length} SNAP BI
                      </span>
                    )}
                  </p>
                </div>
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-zinc-400 ml-1" />
                  : <ChevronRight className="w-4 h-4 text-zinc-400 ml-1" />}
              </button>

              {/* Bulk SNAP button — VA only */}
              {group.key === "va" && !allVaSnap && (
                <button
                  onClick={enableAllSnap}
                  disabled={enablingAll}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  {enablingAll ? "Mengaktifkan..." : "Semua SNAP BI"}
                </button>
              )}
              {group.key === "va" && allVaSnap && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  Semua SNAP BI
                </span>
              )}
            </div>

            {/* Channel rows */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {group.items.map(ch => {
                  const status = ch.section === "va" ? getSnapStatus(ch) : null;
                  return (
                    <div
                      key={ch.id}
                      className={cn(
                        "rounded-xl border transition-all",
                        ch.is_enabled ? "bg-white border-zinc-200" : "bg-zinc-50/50 border-zinc-100 opacity-55",
                      )}
                    >
                      {/* Row utama: logo + nama + on/off toggle */}
                      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                        {ch.logo_url ? (
                          <img
                            src={ch.logo_url}
                            alt={ch.display_name}
                            className="w-9 h-9 rounded-lg object-contain bg-white border border-zinc-100 p-0.5 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                            {ch.display_name.slice(0, 2)}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{ch.full_name}</p>
                          {ch.fee_label && (
                            <p className="text-[11px] text-zinc-400">{ch.fee_label}</p>
                          )}
                        </div>

                        {/* On/off button */}
                        <button
                          onClick={() => toggleEnabled(ch)}
                          disabled={toggling === ch.id}
                          className={cn(
                            "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                            ch.is_enabled
                              ? "bg-emerald-500 text-white border-transparent shadow-sm"
                              : "bg-white text-zinc-400 border-zinc-200 hover:text-zinc-600 hover:border-zinc-300",
                            toggling === ch.id && "opacity-40 cursor-wait",
                          )}
                        >
                          {ch.is_enabled ? "Aktif" : "Nonaktif"}
                        </button>
                      </div>

                      {/* Sub-row VA: PSI + segmented mode control */}
                      {ch.section === "va" && (
                        <div className="flex items-center gap-3 px-3 pb-3 flex-wrap">
                          {/* PSI editor */}
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide shrink-0">PSI</span>
                            {editingId === ch.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editPsi}
                                  onChange={e => setEditPsi(e.target.value)}
                                  placeholder="Partner Service ID"
                                  className="h-6 text-xs w-28 px-1.5 font-mono"
                                  onKeyDown={e => {
                                    if (e.key === "Enter") savePsi(ch);
                                    if (e.key === "Escape") cancelEditPsi();
                                  }}
                                  autoFocus
                                />
                                <button onClick={() => savePsi(ch)} className="text-emerald-600 hover:text-emerald-700 p-0.5">
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={cancelEditPsi} className="text-zinc-400 hover:text-zinc-600 p-0.5">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditPsi(ch)}
                                className="flex items-center gap-1 text-xs group"
                              >
                                <span className={cn(
                                  "font-mono",
                                  ch.partner_service_id ? "text-zinc-600 hover:text-zinc-900" : "text-zinc-400 italic hover:text-zinc-600"
                                )}>
                                  {ch.partner_service_id ? ch.partner_service_id.trimStart() : "belum diset"}
                                </span>
                                <Pencil className="w-3 h-3 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                              </button>
                            )}
                            {/* Warning: SNAP on tapi PSI kosong */}
                            {ch.snap_supported && !ch.partner_service_id?.trim() && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0">
                                wajib diisi
                              </span>
                            )}
                          </div>

                          {/* Mode pill tabs */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setSnapMode(ch, true)}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                                ch.snap_supported
                                  ? "bg-emerald-500 text-white"
                                  : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                              )}
                            >
                              SNAP BI
                            </button>
                            <button
                              onClick={() => setSnapMode(ch, false)}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                                !ch.snap_supported
                                  ? "bg-zinc-700 text-white"
                                  : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                              )}
                            >
                              Checkout
                            </button>
                          </div>

                          {/* Status hint */}
                          {status === "active" && (
                            <span className="text-[10px] font-semibold text-emerald-600 shrink-0">
                              ✓ Nomor VA langsung tersedia
                            </span>
                          )}
                          {status === "no_psi" && (
                            <span className="text-[10px] font-semibold text-amber-600 shrink-0">
                              ⚠ Isi PSI agar SNAP aktif
                            </span>
                          )}
                          {status === "checkout" && (
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              Customer dapat link DOKU
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
