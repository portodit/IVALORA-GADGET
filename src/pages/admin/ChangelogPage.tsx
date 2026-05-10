import { useNavigate, useSearchParams } from "react-router-dom";
import ProjectEstimationModal from "@/components/admin/changelog/ProjectEstimationModal";
import {
  RELEASES,
  CURRENT_VERSION,
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_COLORS,
  type Release,
  type ChangeSection,
} from "@/data/admin/changelog";
import {
  FEATURES,
  FEATURE_CATEGORIES,
  COMPLEXITY_CONFIG,
  FEATURE_STATUS_CONFIG,
  ACCESS_COLORS,
  ACCESS_LABELS,
  ROLE_LABELS,
  type FeatureDoc,
  type UseCase,
  type SourceFile,
  type FeatureStatus,
  type ComplexityLevel,
} from "@/data/admin/feature-docs";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Wrench,
  Trash2,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Wand2,
  Loader2,
  Copy,
  Check,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  FolderCode,
  Monitor,
  Server,
  Database,
  FileCode2,
  Calculator,
  Menu,
  Link2,
  GitMerge,
  History,
  ExternalLink,
  Plug,
  CalendarDays,
  BadgeCheck,
  FlaskConical,
  CircleSlash,
  Construction,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/admin/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import logoHorizontal from "@/assets/logo-horizontal.svg";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  added: <Plus className="w-3.5 h-3.5" />,
  changed: <RefreshCw className="w-3.5 h-3.5" />,
  fixed: <Wrench className="w-3.5 h-3.5" />,
  removed: <Trash2 className="w-3.5 h-3.5" />,
  improved: <Sparkles className="w-3.5 h-3.5" />,
  security: <ShieldCheck className="w-3.5 h-3.5" />,
};

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  frontend: <Monitor className="w-3.5 h-3.5" />,
  backend: <Server className="w-3.5 h-3.5" />,
  config: <Database className="w-3.5 h-3.5" />,
  data: <FileCode2 className="w-3.5 h-3.5" />,
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  config: "Config",
  data: "Data",
};

type TabKey = "changelog" | "features";

export default function ChangelogPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("changelog");
  const [showEstimation, setShowEstimation] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="flex-none z-30 bg-card border-b border-border">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm font-bold text-foreground tracking-tight">IVALORA RMS</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">Dokumentasi</span>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "features" && (
              <button
                onClick={() => setShowEstimation(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Estimasi Proyek</span>
              </button>
            )}
            <div className="flex items-center bg-accent rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab("changelog")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "changelog"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Release Notes
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "features"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Dokumentasi
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === "changelog" ? (
          <div className="flex-1 overflow-y-auto">
            <ChangelogTab isSuperAdmin={role === "super_admin"} />
          </div>
        ) : (
          <FeatureDocsTab />
        )}
      </div>

      {showEstimation && (
        <ProjectEstimationModal onClose={() => setShowEstimation(false)} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CHANGELOG TAB
   ══════════════════════════════════════════════════════════════ */

function ChangelogTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set([CURRENT_VERSION])
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [dbReleases, setDbReleases] = useState<(Release & { isDb?: boolean })[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Load persisted changelog entries from DB on mount
  useEffect(() => {
    const loadDbEntries = async () => {
      setDbLoading(true);
      try {
        const { data, error } = await supabase
          .from("changelog_entries")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (data) {
          const releases: (Release & { isDb?: boolean })[] = data.map((entry: any) => ({
            version: entry.version,
            date: entry.release_date,
            title: entry.title,
            summary: entry.summary,
            sections: entry.sections || [],
            breaking: entry.breaking || undefined,
            isDb: true,
          }));
          setDbReleases(releases);
          // Auto-expand latest DB entry
          if (releases.length > 0) {
            setExpandedVersions((prev) => new Set([...prev, releases[0].version]));
          }
        }
      } catch (e) {
        console.error("Failed to load changelog entries:", e);
      } finally {
        setDbLoading(false);
      }
    };
    loadDbEntries();
  }, []);

  const allReleases = useMemo(() => [...dbReleases, ...RELEASES], [dbReleases]);

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  const handleGenerate = async () => {
    setAiLoading(true);
    try {
      const latestVersion = dbReleases.length > 0 ? dbReleases[0].version : CURRENT_VERSION;
      const { data, error } = await supabase.functions.invoke("generate-changelog", {
        body: { summary: "", currentVersion: latestVersion },
      });
      if (error) throw error;
      if (data?.noChanges) {
        toast.info(data.error || "Tidak ada perubahan sistem yang perlu didokumentasikan.");
        return;
      }
      if (data?.error) throw new Error(data.error);
      if (data?.release) {
        // Support single or multiple releases
        const releases: Release[] = Array.isArray(data.release) ? data.release : [data.release];

        // Persist each release to the database
        let savedCount = 0;
        for (const rel of releases) {
          const { error: insertError } = await supabase.from("changelog_entries").insert([{
            version: rel.version,
            release_date: rel.date,
            title: rel.title,
            summary: rel.summary,
            sections: rel.sections as any,
            breaking: (rel.breaking || null) as any,
            is_ai_generated: true,
          }]);
          if (insertError) {
            console.error("Failed to save release:", insertError);
          } else {
            savedCount++;
          }
        }

        // Add to local state with DB flag
        const newDbReleases = releases.map((r) => ({ ...r, isDb: true }));
        setDbReleases((prev) => [...newDbReleases, ...prev]);
        const newVersions = releases.map((r) => r.version);
        setExpandedVersions((prev) => new Set([...prev, ...newVersions]));
        toast.success(`${savedCount} versi berhasil di-generate dan disimpan ke database!`);
      }
    } catch (e: any) {
      toast.error(e.message || "Gagal generate changelog");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Release Notes</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Riwayat perubahan IVALORA Retail Management System.
        </p>
      </div>

      {/* AI Generate */}
      {isSuperAdmin && (
        <div className="mb-8 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={aiLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {aiLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating & Saving...</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Generate dengan AI</>
            )}
          </button>
          {dbReleases.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              {dbReleases.length} entry tersimpan di database
            </span>
          )}
        </div>
      )}

      {dbLoading ? (
        <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Memuat changelog...</span>
        </div>
      ) : (
        <>
          {/* Releases */}
          <div className="space-y-0">
            {allReleases.map((release, idx) => {
              const isFromDb = "isDb" in release && release.isDb;
              return (
                <ReleaseEntry
                  key={release.version}
                  release={release}
                  isLatest={idx === 0}
                  isAiGenerated={!!isFromDb}
                  isExpanded={expandedVersions.has(release.version)}
                  onToggle={() => toggleVersion(release.version)}
                />
              );
            })}
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}

function ReleaseEntry({
  release,
  isLatest,
  isAiGenerated,
  isExpanded,
  onToggle,
}: {
  release: Release;
  isLatest: boolean;
  isAiGenerated?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`border-b border-border last:border-0 ${isAiGenerated ? "bg-accent/20" : ""}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 py-5 text-left group hover:bg-accent/30 -mx-3 px-3 rounded-lg transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <code className="text-sm font-bold text-foreground bg-accent px-2 py-0.5 rounded">
              v{release.version}
            </code>
            {isLatest && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                Terbaru
              </span>
            )}
            {isAiGenerated && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                AI Generated
              </span>
            )}
            <span className="text-xs text-muted-foreground">{formatDate(release.date)}</span>
          </div>
          <p className="text-base font-semibold text-foreground mt-1">{release.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{release.summary}</p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {isExpanded && (
        <div className="pb-6 space-y-5 ml-0">
          {release.breaking && release.breaking.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-xs font-semibold text-destructive mb-1">⚠️ Breaking Changes</p>
              <ul className="space-y-1">
                {release.breaking.map((b, i) => (
                  <li key={i} className="text-xs text-destructive/90">• {b}</li>
                ))}
              </ul>
            </div>
          )}
          {release.sections.map((section, sIdx) => (
            <SectionBlock key={sIdx} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionBlock({ section }: { section: ChangeSection }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
            CHANGE_TYPE_COLORS[section.type]
          }`}
        >
          {TYPE_ICONS[section.type]}
          {CHANGE_TYPE_LABELS[section.type]}
        </span>
      </div>
      <div className="space-y-3 ml-1">
        {section.items.map((item, i) => (
          <div key={i}>
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-foreground leading-relaxed">{item.description}</p>
                {item.scope && (
                  <span className="inline-block mt-1 text-[10px] text-muted-foreground bg-accent px-2 py-0.5 rounded">
                    {item.scope}
                  </span>
                )}
                {(item.before || item.after) && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {item.before && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-100">
                        <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">Sebelum</p>
                        <p className="text-xs text-red-700">{item.before}</p>
                      </div>
                    )}
                    {item.after && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Sesudah</p>
                        <p className="text-xs text-emerald-800">{item.after}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FEATURE DOCS TAB
   ══════════════════════════════════════════════════════════════ */

function FeatureDocsTab() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [complexityFilter, setComplexityFilter] = useState<ComplexityLevel | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(FEATURE_CATEGORIES)
  );
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const contentRef = useRef<HTMLDivElement>(null);

  const selectedFeatureId = searchParams.get("feature") || FEATURES[0]?.id || "";

  const setSelectedFeatureId = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("feature", id);
      return next;
    }, { replace: true });
  };

  const selectedFeature = FEATURES.find((f) => f.id === selectedFeatureId) || FEATURES[0];

  const filteredFeatures = FEATURES.filter((f) => {
    const matchSearch = !searchQuery ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchComplexity = complexityFilter === "all" || f.complexity === complexityFilter;
    return matchSearch && matchComplexity;
  });

  const groupedFeatures = FEATURE_CATEGORIES
    .map((cat) => ({
      category: cat,
      features: filteredFeatures.filter((f) => f.category === cat),
      totalInCat: FEATURES.filter((f) => f.category === cat).length,
    }))
    .filter((g) => g.features.length > 0);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSelectFeature = (id: string) => {
    setSelectedFeatureId(id);
    setShowMobileSidebar(false);
    setActiveSection("overview");
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const feat = FEATURES.find((f) => f.id === selectedFeatureId);
    if (feat) {
      setExpandedCategories((prev) => new Set([...prev, feat.category]));
    }
  }, [selectedFeatureId]);

  const tocSections = useMemo(() => {
    if (!selectedFeature) return [];
    const sections: { id: string; label: string }[] = [
      { id: "overview", label: "Overview" },
    ];
    if (selectedFeature.subFeatures?.length) sections.push({ id: "sub-fitur", label: "Sub-Fitur" });
    sections.push({ id: "cakupan", label: "Cakupan Fitur" });
    if (selectedFeature.useCases?.length) sections.push({ id: "use-cases", label: "Use Cases" });
    sections.push({ id: "rbac", label: "Hak Akses (RBAC)" });
    if (selectedFeature.sourceFiles?.length) sections.push({ id: "source-files", label: "Struktur File" });
    if (selectedFeature.externalIntegrations?.length) sections.push({ id: "integrasi", label: "Integrasi Eksternal" });
    if (selectedFeature.relatedFeatures?.length) sections.push({ id: "terkait", label: "Fitur Terkait" });
    if (selectedFeature.notes) sections.push({ id: "catatan", label: "Catatan" });
    if (selectedFeature.revisionHistory?.length) sections.push({ id: "riwayat", label: "Riwayat Revisi" });
    return sections;
  }, [selectedFeature]);

  useEffect(() => {
    const main = contentRef.current;
    if (!main) return;
    const sectionIds = tocSections.map((s) => s.id);
    const handler = () => {
      let current = "overview";
      for (const id of sectionIds) {
        const el = main.querySelector(`#${id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top - 120 <= 0) {
          current = id;
        }
      }
      setActiveSection(current);
    };
    main.addEventListener("scroll", handler, { passive: true });
    return () => main.removeEventListener("scroll", handler);
  }, [selectedFeature, tocSections]);

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      {isMobile ? (
        <>
          <div className="fixed bottom-4 left-4 z-40">
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="p-3 rounded-full bg-foreground text-background shadow-lg hover:bg-foreground/90 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          {showMobileSidebar && (
            <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm" onClick={() => setShowMobileSidebar(false)}>
              <aside
                className="w-72 h-full bg-card border-r border-border overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <SidebarContent
                  groups={groupedFeatures}
                  expandedCategories={expandedCategories}
                  toggleCategory={toggleCategory}
                  selectedId={selectedFeatureId}
                  onSelect={handleSelectFeature}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  filteredCount={filteredFeatures.length}
                  complexityFilter={complexityFilter}
                  setComplexityFilter={setComplexityFilter}
                />
              </aside>
            </div>
          )}
        </>
      ) : (
        <aside className={`flex-none border-r border-border flex flex-col h-full overflow-hidden transition-all duration-200 ${sidebarCollapsed ? "w-12" : "w-64"}`}>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
                title="Tampilkan sidebar"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-none flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold tracking-[0.15em] text-gray-900 dark:text-white select-none leading-none uppercase">Dokumentasi Fitur</span>
                  <img src={logoHorizontal} alt="Ivalora Gadget" className="h-6 w-auto object-contain object-left" />
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors border border-border"
                  title="Sembunyikan sidebar"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-foreground/60" />
                </button>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
              <SidebarContent
                groups={groupedFeatures}
                expandedCategories={expandedCategories}
                toggleCategory={toggleCategory}
                selectedId={selectedFeatureId}
                onSelect={handleSelectFeature}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filteredCount={filteredFeatures.length}
                complexityFilter={complexityFilter}
                setComplexityFilter={setComplexityFilter}
              />
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Main Content */}
      {selectedFeature && (
        <main ref={contentRef} className="flex-1 min-w-0 overflow-y-auto h-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10">
          <FeatureDetail feature={selectedFeature} allFeatures={FEATURES} />
          <Footer />
        </main>
      )}

      {/* Right TOC — Desktop only */}
      {!isMobile && selectedFeature && (
        <aside className="w-52 flex-none hidden xl:flex flex-col border-l border-border h-full overflow-hidden">
          <div className="flex-none px-4 pt-6 pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 select-none">Di Halaman Ini</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            <nav className="space-y-0.5">
              {tocSections.map((s, idx) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = contentRef.current?.querySelector(`#${s.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                      setActiveSection(s.id);
                    }
                  }}
                  className={`flex items-start gap-2 py-1.5 pl-3 pr-1 rounded-md text-[13px] transition-colors border-l-2 ${
                    activeSection === s.id
                      ? "border-foreground text-gray-900 dark:text-white font-semibold bg-accent/40"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-accent/20"
                  }`}
                >
                  <span className={`text-[10px] font-bold shrink-0 mt-0.5 tabular-nums w-4 text-right ${activeSection === s.id ? "text-foreground" : "text-muted-foreground/40"}`}>
                    {idx + 1}.
                  </span>
                  <span className="leading-snug">{s.label}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>
      )}
    </div>
  );
}

/* ── Sidebar Content ──────────────────────────────────────── */

function SidebarContent({
  groups,
  expandedCategories,
  toggleCategory,
  selectedId,
  onSelect,
  searchQuery,
  setSearchQuery,
  filteredCount,
  complexityFilter,
  setComplexityFilter,
}: {
  groups: { category: string; features: FeatureDoc[]; totalInCat: number }[];
  expandedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredCount: number;
  complexityFilter: ComplexityLevel | "all";
  setComplexityFilter: (f: ComplexityLevel | "all") => void;
}) {
  const complexityOptions: { value: ComplexityLevel | "all"; label: string; dots: number }[] = [
    { value: "all", label: "Semua", dots: 0 },
    { value: "rendah", label: "Rendah", dots: 1 },
    { value: "sedang", label: "Sedang", dots: 2 },
    { value: "tinggi", label: "Tinggi", dots: 3 },
    { value: "sangat_tinggi", label: "Sangat Tinggi", dots: 4 },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-none p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari fitur..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {complexityOptions.map((opt) => {
            const isActive = complexityFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setComplexityFilter(opt.value)}
                className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded text-[10px] font-semibold transition-colors border whitespace-nowrap ${
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-none px-4 pt-4 pb-2">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-800 dark:text-gray-200 select-none">Daftar Fitur</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-1 min-h-0">
        {groups.map((group) => (
          <div key={group.category} className="mb-2">
            <button
              onClick={() => toggleCategory(group.category)}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-accent/40 transition-colors rounded-md mx-1"
            >
              <ChevronRight
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 shrink-0 ${
                  expandedCategories.has(group.category) ? "rotate-90" : ""
                }`}
              />
              <span className="text-[11px] font-extrabold text-gray-900 dark:text-white uppercase tracking-widest truncate flex-1">
                {group.category}
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-medium shrink-0">
                {group.features.length}
              </span>
            </button>
            {expandedCategories.has(group.category) && (
              <div className="space-y-0.5 mt-1">
                {group.features.map((f) => {
                  const isActive = f.id === selectedId;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onSelect(f.id)}
                      className={`w-full text-left px-4 py-1.5 text-[13px] font-semibold transition-colors border-l-2 ml-4 ${
                        isActive
                          ? "border-primary text-gray-900 dark:text-white bg-primary/5"
                          : "border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-primary/40 hover:bg-accent/30"
                      }`}
                    >
                      <span className="block truncate leading-snug">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {filteredCount === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Tidak ditemukan.</p>
        )}
      </nav>
    </div>
  );
}

/* ── Feature Detail ───────────────────────────────────────── */

function FeatureDetail({ feature, allFeatures }: { feature: FeatureDoc; allFeatures: FeatureDoc[] }) {
  const complexity = COMPLEXITY_CONFIG[feature.complexity];
  const [copied, setCopied] = useState(false);

  const statusConfig = feature.status ? FEATURE_STATUS_CONFIG[feature.status] : null;
  const lastRevision = feature.revisionHistory?.[feature.revisionHistory.length - 1];

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("feature", feature.id);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const INTEGRATION_TYPE_ICONS: Record<string, React.ReactNode> = {
    payment_gateway: <BadgeCheck className="w-4 h-4 text-emerald-600" />,
    shipping_api: <Plug className="w-4 h-4 text-blue-600" />,
    ai_service: <Sparkles className="w-4 h-4 text-violet-600" />,
    email: <Plug className="w-4 h-4 text-amber-600" />,
    storage: <Database className="w-4 h-4 text-foreground/60" />,
    database: <Database className="w-4 h-4 text-foreground/60" />,
    other: <Plug className="w-4 h-4 text-foreground/60" />,
  };

  const INTEGRATION_TYPE_LABELS: Record<string, string> = {
    payment_gateway: "Payment Gateway",
    shipping_api: "Shipping API",
    ai_service: "AI Service",
    email: "Email",
    storage: "Storage",
    database: "Database",
    other: "Integrasi",
  };

  return (
    <article className="max-w-[820px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
        <span>Dokumentasi</span>
        <ChevronRight className="w-3 h-3" />
        <span>{feature.category}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{feature.name}</span>
      </div>

      {/* Title — significantly larger than sidebar items */}
      <div id="overview">
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
          {feature.name}
        </h1>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {feature.category}
          </span>
          {/* Modern gradient complexity badge */}
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full text-white bg-gradient-to-r ${complexity.gradient} shadow-sm`}>
            <span className="flex gap-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i < complexity.dots ? "bg-white" : "bg-white/30"}`}
                />
              ))}
            </span>
            {complexity.label}
          </span>
          {statusConfig && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusConfig.badge}`}>
              {feature.status === "stable" && <BadgeCheck className="w-3 h-3" />}
              {feature.status === "beta" && <FlaskConical className="w-3 h-3" />}
              {feature.status === "deprecated" && <CircleSlash className="w-3 h-3" />}
              {feature.status === "wip" && <Construction className="w-3 h-3" />}
              {statusConfig.label}
            </span>
          )}
        </div>

        {/* Metadata bar */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {feature.introducedIn && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GitMerge className="w-3.5 h-3.5" />
              <span>Diperkenalkan di <code className="font-mono font-semibold text-foreground">v{feature.introducedIn}</code></span>
            </div>
          )}
          {lastRevision && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Diperbarui {formatDate(lastRevision.date)}</span>
            </div>
          )}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
            <span>{copied ? "Link disalin!" : "Salin link"}</span>
          </button>
        </div>

        <p className="text-base sm:text-lg text-foreground/85 leading-relaxed mt-6">
          {feature.description}
        </p>
      </div>

      <hr className="my-8 border-border" />

      {/* Sub-features */}
      {feature.subFeatures && feature.subFeatures.length > 0 && (
        <>
          <section id="sub-fitur">
            <SectionHeading>Sub-Fitur</SectionHeading>
            <div className="mt-4 space-y-2">
              {feature.subFeatures.map((sf, i) => (
                <SubFeatureItem key={i} sf={sf} />
              ))}
            </div>
          </section>
          <hr className="my-8 border-border" />
        </>
      )}

      {/* Scope */}
      <section id="cakupan">
        <SectionHeading>Cakupan Fitur</SectionHeading>
        <ul className="mt-4 space-y-2.5">
          {feature.scope.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] text-foreground/85 leading-relaxed">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 mt-2.5 shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      </section>

      <hr className="my-8 border-border" />

      {/* Use Cases */}
      {feature.useCases && feature.useCases.length > 0 && (
        <>
          <section id="use-cases">
            <SectionHeading>Alur Penggunaan (Use Cases)</SectionHeading>
            <div className="mt-4 space-y-2">
              {feature.useCases.map((uc, index) => (
                <UseCaseAccordion key={uc.id} uc={uc} isFirst={index === 0} />
              ))}
            </div>
          </section>
          <hr className="my-8 border-border" />
        </>
      )}

      {/* RBAC Table */}
      <section id="rbac">
        <SectionHeading>Hak Akses per Role (RBAC)</SectionHeading>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-accent/50 border-b border-border">
                <th className="text-left px-4 py-2.5 font-semibold text-foreground text-xs uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-2.5 font-semibold text-foreground text-xs uppercase tracking-wider">Akses</th>
                <th className="text-left px-4 py-2.5 font-semibold text-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {feature.roleAccess.map((ra, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground text-sm whitespace-nowrap">
                    {ROLE_LABELS[ra.role]}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ACCESS_COLORS[ra.access]}`}>
                      {ACCESS_LABELS[ra.access]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground hidden sm:table-cell">{ra.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Source Files */}
      {feature.sourceFiles && feature.sourceFiles.length > 0 && (
        <>
          <hr className="my-8 border-border" />
          <section id="source-files">
            <SectionHeading icon={<FolderCode className="w-5 h-5" />}>Struktur File Proyek</SectionHeading>
            <div className="mt-4 space-y-1">
              {(() => {
                const grouped: Record<string, SourceFile[]> = {};
                feature.sourceFiles!.forEach((sf) => {
                  if (!grouped[sf.type]) grouped[sf.type] = [];
                  grouped[sf.type].push(sf);
                });
                return Object.entries(grouped).map(([type, files]) => (
                  <SourceFileGroup key={type} type={type} files={files} />
                ));
              })()}
            </div>
          </section>
        </>
      )}

      {/* Notes */}
      {feature.notes && (
        <>
          <hr className="my-8 border-border" />
          <section id="catatan">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800 mb-1">Catatan</p>
                  <p className="text-sm text-blue-700 leading-relaxed">{feature.notes}</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* External Integrations */}
      {feature.externalIntegrations && feature.externalIntegrations.length > 0 && (
        <>
          <hr className="my-8 border-border" />
          <section id="integrasi">
            <SectionHeading icon={<Plug className="w-5 h-5" />}>Integrasi Eksternal</SectionHeading>
            <div className="mt-4 space-y-3">
              {feature.externalIntegrations.map((intg, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent/20 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    {INTEGRATION_TYPE_ICONS[intg.type] || <Plug className="w-4 h-4 text-foreground/60" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{intg.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-muted-foreground uppercase tracking-wide">
                        {INTEGRATION_TYPE_LABELS[intg.type] || intg.type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{intg.description}</p>
                    {intg.docsUrl && (
                      <a
                        href={intg.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Dokumentasi
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Related Features */}
      {feature.relatedFeatures && feature.relatedFeatures.length > 0 && (
        <>
          <hr className="my-8 border-border" />
          <section id="terkait">
            <SectionHeading icon={<GitMerge className="w-5 h-5" />}>Fitur Terkait</SectionHeading>
            <div className="mt-4 flex flex-wrap gap-2">
              {feature.relatedFeatures.map((relId) => {
                const rel = allFeatures.find((f) => f.id === relId);
                if (!rel) return null;
                return (
                  <div
                    key={relId}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors cursor-default"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{rel.name}</span>
                    <span className="text-xs text-muted-foreground">— {rel.category}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Revision History */}
      {feature.revisionHistory && feature.revisionHistory.length > 0 && (
        <>
          <hr className="my-8 border-border" />
          <section id="riwayat">
            <SectionHeading icon={<History className="w-5 h-5" />}>Riwayat Revisi</SectionHeading>
            <div className="mt-4 space-y-0 border border-border rounded-lg overflow-hidden">
              {[...feature.revisionHistory].reverse().map((rev, i) => (
                <div key={i} className="flex items-start gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    <code className="text-xs font-mono font-bold text-foreground bg-accent px-2 py-0.5 rounded">
                      v{rev.version}
                    </code>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">{rev.description}</p>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(rev.date)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </article>
  );
}

/* ── Source File Group ────────────────────────────────────── */

function SourceFileGroup({ type, files }: { type: string; files: SourceFile[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent/30 transition-colors"
      >
        <span className="text-muted-foreground">{SOURCE_TYPE_ICONS[type]}</span>
        <span className="text-sm font-semibold text-foreground flex-1">
          {SOURCE_TYPE_LABELS[type] || type}
        </span>
        <span className="text-[11px] text-muted-foreground">{files.length} file</span>
        <ChevronRight
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {files.map((f, i) => (
            <div key={i} className="px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <code className="text-xs font-mono text-foreground/80 bg-accent/50 px-1.5 py-0.5 rounded break-all">
                {f.path}
              </code>
              <span className="text-xs text-muted-foreground">{f.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sub-Feature Accordion Item ──────────────────────────── */

function SubFeatureItem({ sf }: { sf: { name: string; description?: string } }) {
  const [open, setOpen] = useState(false);

  if (!sf.description) {
    return (
      <div className="px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground">
        {sf.name}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-accent/30 transition-colors"
      >
        <span className="text-sm font-medium text-foreground">{sf.name}</span>
        <ChevronRight
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-border pt-2">
          <p className="text-sm text-muted-foreground leading-relaxed">{sf.description}</p>
        </div>
      )}
    </div>
  );
}

/* ── Use Case Accordion ───────────────────────────────────── */

function UseCaseAccordion({ uc, isFirst }: { uc: UseCase; isFirst?: boolean }) {
  const [open, setOpen] = useState(isFirst ?? false);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        <code className="text-[11px] font-bold text-foreground bg-accent px-2 py-0.5 rounded shrink-0">
          {uc.id}
        </code>
        <span className="text-sm font-medium text-foreground flex-1">{uc.title}</span>
        <ChevronRight
          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Aktor" value={uc.actor} />
            <InfoRow icon={<AlertCircle className="w-3.5 h-3.5" />} label="Prasyarat" value={uc.prerequisite} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deskripsi</p>
            <p className="text-sm text-foreground/85 leading-relaxed">{uc.description}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Hasil Akhir</p>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/85 leading-relaxed">{uc.result}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground/85">{value}</p>
      </div>
    </div>
  );
}

/* ── Shared ────────────────────────────────────────────────── */

function SectionHeading({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
      {icon}
      {children}
    </h2>
  );
}

function Footer() {
  return (
    <div className="mt-14 pt-6 border-t border-border">
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} IVALORA Retail Management System. Seluruh perubahan didokumentasikan secara kronologis.
      </p>
    </div>
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
