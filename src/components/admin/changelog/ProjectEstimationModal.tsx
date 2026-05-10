import { useState, useMemo } from "react";
import {
  FEATURES,
  FEATURE_CATEGORIES,
  COMPLEXITY_CONFIG,
  type FeatureDoc,
  type ComplexityLevel,
} from "@/data/admin/feature-docs";
import {
  X,
  Download,
  Calculator,
  ChevronDown,
  ChevronRight,
  FileText,
  TrendingUp,
  Clock,
  DollarSign,
  Layers,
  Sparkles,
  Loader2,
  AlertTriangle,
  Users,
  Shield,
} from "lucide-react";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Rate card per complexity ──────────────────────────────── */
const EFFORT_MAP: Record<ComplexityLevel, { minHours: number; maxHours: number; label: string }> = {
  rendah: { minHours: 8, maxHours: 16, label: "1–2 hari" },
  sedang: { minHours: 24, maxHours: 48, label: "3–6 hari" },
  tinggi: { minHours: 56, maxHours: 96, label: "7–12 hari" },
  sangat_tinggi: { minHours: 120, maxHours: 200, label: "15–25 hari" },
};

const HOURLY_RATE_IDR = 150_000; // Rp 150.000 / jam — tarif developer mid-senior Indonesia

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

interface FeatureEstimate {
  feature: FeatureDoc;
  minHours: number;
  maxHours: number;
  minCost: number;
  maxCost: number;
  subFeatureCount: number;
  useCaseCount: number;
  sourceFileCount: number;
}

function calculateEstimates(hourlyRate: number): {
  features: FeatureEstimate[];
  totalMinHours: number;
  totalMaxHours: number;
  totalMinCost: number;
  totalMaxCost: number;
  categoryBreakdown: { category: string; minCost: number; maxCost: number; count: number }[];
} {
  const features: FeatureEstimate[] = FEATURES.map((f) => {
    const effort = EFFORT_MAP[f.complexity];
    // Adjust by sub-feature count (more sub-features = more effort)
    const subMult = f.subFeatures ? 1 + f.subFeatures.length * 0.1 : 1;
    const minH = Math.round(effort.minHours * subMult);
    const maxH = Math.round(effort.maxHours * subMult);
    return {
      feature: f,
      minHours: minH,
      maxHours: maxH,
      minCost: minH * hourlyRate,
      maxCost: maxH * hourlyRate,
      subFeatureCount: f.subFeatures?.length || 0,
      useCaseCount: f.useCases?.length || 0,
      sourceFileCount: f.sourceFiles?.length || 0,
    };
  });

  const totalMinHours = features.reduce((s, f) => s + f.minHours, 0);
  const totalMaxHours = features.reduce((s, f) => s + f.maxHours, 0);

  const categoryBreakdown = FEATURE_CATEGORIES.map((cat) => {
    const catFeatures = features.filter((f) => f.feature.category === cat);
    return {
      category: cat,
      minCost: catFeatures.reduce((s, f) => s + f.minCost, 0),
      maxCost: catFeatures.reduce((s, f) => s + f.maxCost, 0),
      count: catFeatures.length,
    };
  }).filter((c) => c.count > 0);

  return {
    features,
    totalMinHours,
    totalMaxHours,
    totalMinCost: totalMinHours * hourlyRate,
    totalMaxCost: totalMaxHours * hourlyRate,
    categoryBreakdown,
  };
}

/* ── PDF Generation ───────────────────────────────────────── */
function generatePDF(hourlyRate: number) {
  const est = calculateEstimates(hourlyRate);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 20;

  const addPageIfNeeded = (need: number) => {
    if (y + need > 270) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Estimasi Nilai Proyek Pengembangan", margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("IVALORA Retail Management System", margin, y);
  y += 5;
  doc.text(`Tanggal: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, margin, y);
  y += 5;
  doc.text(`Tarif Developer: ${formatRp(hourlyRate)}/jam`, margin, y);
  y += 10;

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Executive Summary
  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Ringkasan Eksekutif", margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const summaryItems = [
    `Total Fitur: ${est.features.length} modul`,
    `Total Sub-Fitur: ${est.features.reduce((s, f) => s + f.subFeatureCount, 0)} komponen`,
    `Total Use Cases: ${est.features.reduce((s, f) => s + f.useCaseCount, 0)} alur`,
    `Total Source Files: ${est.features.reduce((s, f) => s + f.sourceFileCount, 0)} file`,
    `Estimasi Jam Kerja: ${est.totalMinHours.toLocaleString("id-ID")} – ${est.totalMaxHours.toLocaleString("id-ID")} jam`,
    `Estimasi Durasi: ${Math.ceil(est.totalMinHours / 8)} – ${Math.ceil(est.totalMaxHours / 8)} hari kerja`,
    `Estimasi Biaya: ${formatRp(est.totalMinCost)} – ${formatRp(est.totalMaxCost)}`,
  ];
  summaryItems.forEach((item) => {
    doc.text(`• ${item}`, margin + 2, y);
    y += 5.5;
  });
  y += 6;

  // Category breakdown
  addPageIfNeeded(20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Breakdown per Kategori", margin, y);
  y += 8;

  // Table header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, pw - margin * 2, 7, "F");
  doc.text("Kategori", margin + 2, y);
  doc.text("Fitur", margin + 80, y);
  doc.text("Estimasi Biaya (Min)", margin + 95, y);
  doc.text("Estimasi Biaya (Maks)", margin + 135, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  est.categoryBreakdown.forEach((cat) => {
    addPageIfNeeded(7);
    doc.text(cat.category, margin + 2, y);
    doc.text(String(cat.count), margin + 83, y);
    doc.text(formatRp(cat.minCost), margin + 95, y);
    doc.text(formatRp(cat.maxCost), margin + 135, y);
    y += 5.5;
  });

  // Total row
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFillColor(235, 235, 235);
  doc.rect(margin, y - 4, pw - margin * 2, 7, "F");
  doc.text("TOTAL", margin + 2, y);
  doc.text(String(est.features.length), margin + 83, y);
  doc.text(formatRp(est.totalMinCost), margin + 95, y);
  doc.text(formatRp(est.totalMaxCost), margin + 135, y);
  y += 12;

  // Per-feature detail
  addPageIfNeeded(20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Detail per Fitur", margin, y);
  y += 8;

  est.features.forEach((fe, idx) => {
    addPageIfNeeded(22);
    const complex = COMPLEXITY_CONFIG[fe.feature.complexity];
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${idx + 1}. ${fe.feature.name}`, margin + 2, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Kategori: ${fe.feature.category} | Kompleksitas: ${complex.label} | ${fe.minHours}–${fe.maxHours} jam`, margin + 4, y);
    y += 4.5;
    doc.text(`Sub-fitur: ${fe.subFeatureCount} | Use Cases: ${fe.useCaseCount} | File: ${fe.sourceFileCount}`, margin + 4, y);
    y += 4.5;
    doc.text(`Estimasi: ${formatRp(fe.minCost)} – ${formatRp(fe.maxCost)}`, margin + 4, y);
    doc.setTextColor(0);
    y += 7;
  });

  // Footer
  addPageIfNeeded(20);
  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y, pw - margin, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text("Dokumen ini dibuat secara otomatis oleh IVALORA RMS Documentation System.", margin, y);
  y += 4;
  doc.text("Estimasi bersifat indikatif berdasarkan kompleksitas fitur dan tarif developer yang ditetapkan.", margin, y);
  y += 4;
  doc.text("Biaya aktual dapat bervariasi tergantung kebutuhan spesifik, revisi, dan faktor teknis lainnya.", margin, y);

  doc.save(`Estimasi-Proyek-IVALORA-RMS-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/* ── Modal Component ──────────────────────────────────────── */

export default function ProjectEstimationModal({ onClose }: { onClose: () => void }) {
  const [hourlyRate, setHourlyRate] = useState(HOURLY_RATE_IDR);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const est = useMemo(() => calculateEstimates(hourlyRate), [hourlyRate]);

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  };

  const handleAiEstimate = async () => {
    setAiLoading(true);
    try {
      const featuresPayload = FEATURES.map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        complexity: f.complexity,
        subFeatureCount: f.subFeatures?.length || 0,
        useCaseCount: f.useCases?.length || 0,
        sourceFileCount: f.sourceFiles?.length || 0,
      }));
      const { data, error } = await supabase.functions.invoke("estimate-project", {
        body: { features: featuresPayload, hourlyRate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.estimation) {
        setAiResult(data.estimation);
        toast.success("Estimasi AI berhasil dibuat!");
      }
    } catch (e: any) {
      toast.error(e.message || "Gagal generate estimasi AI");
    } finally {
      setAiLoading(false);
    }
  };

  // Use AI results if available, otherwise use static calculation
  const displayEst = aiResult
    ? {
        totalMinCost: aiResult.totalMinCost || est.totalMinCost,
        totalMaxCost: aiResult.totalMaxCost || est.totalMaxCost,
        totalMinHours: aiResult.totalMinHours || est.totalMinHours,
        totalMaxHours: aiResult.totalMaxHours || est.totalMaxHours,
      }
    : est;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calculator className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Estimasi Nilai Proyek</h2>
              <p className="text-xs text-muted-foreground">IVALORA Retail Management System</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Rate input */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 p-4 rounded-xl border border-border bg-accent/20">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Tarif Developer / Jam
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Math.max(0, Number(e.target.value)))}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Tarif standar developer mid-senior di Indonesia. Sesuaikan dengan rate aktual tim Anda.
            </div>
          </div>

          {/* AI Estimate button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Estimasi dengan AI
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Analisis mendalam oleh AI berdasarkan kompleksitas nyata setiap fitur.
              </p>
            </div>
            <button
              onClick={handleAiEstimate}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            >
              {aiLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menganalisis...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {aiResult ? "Analisis Ulang" : "Analisis AI"}</>
              )}
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Layers className="w-4 h-4" />}
              label="Total Fitur"
              value={`${est.features.length} modul`}
              gradient="from-blue-500 to-cyan-400"
            />
            <SummaryCard
              icon={<Clock className="w-4 h-4" />}
              label="Estimasi Durasi"
              value={`${Math.ceil(displayEst.totalMinHours / 8)}–${Math.ceil(displayEst.totalMaxHours / 8)} hari`}
              gradient="from-amber-500 to-orange-400"
            />
            <SummaryCard
              icon={<DollarSign className="w-4 h-4" />}
              label="Biaya Minimum"
              value={formatRp(displayEst.totalMinCost)}
              gradient="from-emerald-500 to-teal-400"
            />
            <SummaryCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Biaya Maksimum"
              value={formatRp(displayEst.totalMaxCost)}
              gradient="from-red-500 to-rose-400"
            />
          </div>

          {/* Category breakdown */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Breakdown per Kategori
            </h3>
            <div className="space-y-1.5">
              {est.categoryBreakdown.map((cat) => {
                const isOpen = expandedCats.has(cat.category);
                const catFeatures = est.features.filter((f) => f.feature.category === cat.category);
                return (
                  <div key={cat.category} className="rounded-lg border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleCat(cat.category)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-foreground flex-1">{cat.category}</span>
                      <span className="text-xs text-muted-foreground">{cat.count} fitur</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {formatRp(cat.minCost)} – {formatRp(cat.maxCost)}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {catFeatures.map((fe) => {
                          const cplx = COMPLEXITY_CONFIG[fe.feature.complexity];
                          return (
                            <div key={fe.feature.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                              <span className="flex-1 text-foreground/80">{fe.feature.name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${cplx.gradient}`}>
                                {cplx.label}
                              </span>
                              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                {fe.minHours}–{fe.maxHours}h
                              </span>
                              <span className="text-xs font-medium text-foreground tabular-nums whitespace-nowrap hidden sm:inline">
                                {formatRp(fe.minCost)} – {formatRp(fe.maxCost)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Analysis Results */}
          {aiResult && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Hasil Analisis AI
              </h3>

              {/* AI Recommendations */}
              {aiResult.teamRecommendation && (
                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Rekomendasi Tim</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{aiResult.teamRecommendation}</p>
                    </div>
                  </div>
                </div>
              )}

              {aiResult.projectDurationWeeks && (
                <div className="p-3 rounded-lg border border-border bg-accent/20">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Estimasi Durasi Proyek</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {aiResult.projectDurationWeeks.min} – {aiResult.projectDurationWeeks.max} minggu
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Factors */}
              {aiResult.riskFactors?.length > 0 && (
                <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                    Faktor Risiko
                  </p>
                  <ul className="space-y-1">
                    {aiResult.riskFactors.map((r: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-destructive mt-0.5">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Additional Costs */}
              {aiResult.additionalCosts?.length > 0 && (
                <div className="p-3 rounded-lg border border-border bg-accent/20">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    Biaya Tambahan
                  </p>
                  <div className="space-y-1.5">
                    {aiResult.additionalCosts.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{c.item}</span>
                        <span className="font-medium text-foreground">{c.estimate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Notes */}
              {aiResult.notes && (
                <div className="p-3 rounded-lg border border-border bg-accent/10">
                  <p className="text-xs font-semibold text-foreground mb-1">Catatan AI</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{aiResult.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Total bar */}
          <div className={`p-4 rounded-xl border border-border ${aiResult ? "bg-primary/5 border-primary/20" : "bg-foreground/5"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  Total Estimasi Proyek
                  {aiResult && <span className="text-primary text-[10px]">(AI)</span>}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {displayEst.totalMinHours.toLocaleString("id-ID")} – {displayEst.totalMaxHours.toLocaleString("id-ID")} jam kerja
                  ({Math.ceil(displayEst.totalMinHours / 8)} – {Math.ceil(displayEst.totalMaxHours / 8)} hari)
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  {formatRp(displayEst.totalMinCost)}
                </p>
                <p className="text-sm text-muted-foreground">
                  s/d {formatRp(displayEst.totalMaxCost)}
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            * Estimasi dihitung berdasarkan tingkat kompleksitas fitur, jumlah sub-fitur, dan tarif developer yang ditetapkan.
            Biaya aktual dapat bervariasi tergantung kebutuhan spesifik, jumlah revisi, testing, deployment, dan faktor teknis lainnya.
            Perhitungan ini tidak termasuk biaya infrastruktur, lisensi, dan maintenance pasca-pengembangan.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-accent/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={() => generatePDF(hourlyRate)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  gradient: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} text-white mb-2`}>
        {icon}
      </div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}
