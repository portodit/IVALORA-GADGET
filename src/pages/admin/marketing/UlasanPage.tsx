import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Star, Trash2, Eye, EyeOff, MapPin, Globe, ShoppingBag,
  Search, Store, ShoppingCart, MessageSquare, MoreHorizontal, DownloadCloud, Loader2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminFooter } from "@/components/shared";

const db = supabase as any;

/* ─── Constants ─────────────────────────────────────────── */

const REVIEW_CATEGORIES = [
  { key: "kualitas_produk",      label: "Kualitas Produk",     emoji: "📦" },
  { key: "pelayanan_toko",       label: "Pelayanan Toko",      emoji: "🏪" },
  { key: "aksesibilitas_website",label: "Website & Kemudahan", emoji: "🌐" },
  { key: "pengiriman",           label: "Pengiriman",          emoji: "🚚" },
  { key: "harga_kompetitif",     label: "Harga Kompetitif",    emoji: "💰" },
  { key: "after_sales",          label: "After Sales / Garansi",emoji: "🛡️" },
];

const SOURCES: Record<string, { label: string; icon: React.ReactNode; color: string; tipe: "toko" | "produk" | "manual" }> = {
  google_maps:       { label: "Google Maps",  icon: <MapPin className="w-3 h-3" />,        color: "bg-red-100 text-red-700 border-red-200",          tipe: "toko" },
  website_purchase:  { label: "Website",      icon: <Globe className="w-3 h-3" />,          color: "bg-blue-100 text-blue-700 border-blue-200",        tipe: "produk" },
  pos:               { label: "POS",          icon: <Store className="w-3 h-3" />,          color: "bg-emerald-100 text-emerald-700 border-emerald-200", tipe: "produk" },
  shopee:            { label: "Shopee",       icon: <ShoppingCart className="w-3 h-3" />,   color: "bg-orange-100 text-orange-700 border-orange-200",  tipe: "produk" },
  tokopedia:         { label: "Tokopedia",    icon: <ShoppingBag className="w-3 h-3" />,    color: "bg-green-100 text-green-700 border-green-200",     tipe: "produk" },
};

function getTipe(source: string): "toko" | "produk" {
  const s = SOURCES[source];
  if (!s || s.tipe === "manual") return "toko";
  return s.tipe;
}

/* ─── Types ──────────────────────────────────────────────── */

interface Review {
  id: string;
  reviewer_name: string;
  reviewer_avatar_url: string | null;
  rating: number;
  review_text: string;
  photo_urls: string[];
  categories: string[];
  source: string;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
  transaction_id: string | null;
}

/* ─── Star component ─────────────────────────────────────── */

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-zinc-200"}`} />
      ))}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function UlasanPage() {
  const [reviews, setReviews]       = useState<Review[]>([]);
  const [loading, setLoading]       = useState(true);
  
  // Import Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importSource, setImportSource] = useState("google_maps");
  const [submitting, setSubmitting] = useState(false);

  // Bulk Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters
  const [tab, setTab]                   = useState("all");
  const [search, setSearch]             = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterRating, setFilterRating] = useState("all");

  /* ─── Data ─── */

  const fetchReviews = async () => {
    setLoading(true);
    const { data } = await db.from("reviews").select("*").order("created_at", { ascending: false });
    setReviews((data as Review[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  /* ─── Stats ─── */

  const stats = useMemo(() => ({
    total:    reviews.length,
    avgRating: reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
      : 0,
    pending:  reviews.filter(r => !r.is_approved).length,
    featured: reviews.filter(r => r.is_featured).length,
    toko:     reviews.filter(r => getTipe(r.source) === "toko").length,
    produk:   reviews.filter(r => getTipe(r.source) === "produk").length,
  }), [reviews]);

  /* ─── Filtered list ─── */

  const filtered = useMemo(() => reviews.filter(r => {
    if (tab === "toko"    && getTipe(r.source) !== "toko")    return false;
    if (tab === "produk"  && getTipe(r.source) !== "produk")  return false;
    if (tab === "pending" && r.is_approved)                    return false;
    if (filterSource !== "all" && r.source !== filterSource)   return false;
    if (filterRating !== "all" && r.rating !== parseInt(filterRating)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.reviewer_name?.toLowerCase().includes(q) && !r.review_text?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [reviews, tab, filterSource, filterRating, search]);

  const [importUrl, setImportUrl] = useState("");

  /* ─── Actions ─── */

  const toggleApproval = async (id: string, current: boolean) => {
    await db.from("reviews").update({ is_approved: !current }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_approved: !current } : r));
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await db.from("reviews").update({ is_featured: !current }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_featured: !current } : r));
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Hapus ulasan ini?")) return;
    await db.from("reviews").delete().eq("id", id);
    toast.success("Ulasan dihapus");
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  /* ─── Import Logic (AI Powered) ─── */

  const handleImport = async () => {
    if (!importUrl) {
      toast.error("Masukkan URL Google Maps terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    
    try {
      toast.info("Sedang mengambil data dari Google Maps via AI...");
      
      // 1. Fetch content using Jina Reader
      const readerResponse = await fetch(`https://r.jina.ai/${importUrl}`, {
        headers: { 'X-Return-Format': 'text' }
      });
      const webText = await readerResponse.text();

      if (webText.length < 100) {
        throw new Error("Gagal mengambil konten halaman. Coba gunakan link Google Maps versi lengkap (buka di browser dulu baru copy URL-nya).");
      }

      toast.info("Menganalisis ulasan dengan AI (OpenRouter)...");

      // 2. Call OpenRouter AI to extract reviews
      const openRouterKey = "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";
      const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

      const aiResponse = await fetch(openRouterUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": "http://localhost:8080",
          "X-Title": "Ivalora Admin"
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: `Analisis teks halaman Google Maps berikut dan ekstrak SEMUA ulasan pelanggan yang ada. 
              PENTING: 
              - Ambil nama reviewer, rating (1-5), dan teks ulasan lengkap.
              - Abaikan ulasan yang tidak ada teksnya (hanya bintang).
              - Format harus JSON array of objects: [{"reviewer_name": "...", "rating": 5, "review_text": "...", "created_at": "ISO Date"}].
              - Jika tanggal tidak pasti, gunakan estimasi bulan ini.
              - Kembalikan HANYA JSON.
              
              Teks Halaman: \n\n ${webText.substring(0, 70000)}` 
          }]
        })
      });

      const aiData = await aiResponse.json();
      
      if (aiData.error) {
        throw new Error(`OpenRouter Error: ${aiData.error.message || JSON.stringify(aiData.error)}`);
      }

      const rawText = aiData.choices?.[0]?.message?.content || "";
      const rawJsonMatch = rawText.match(/\[[\s\S]*\]/);
      
      if (!rawJsonMatch) {
        throw new Error("AI gagal mengekstrak ulasan. Coba URL yang lebih spesifik ke tab ulasan.");
      }

      const extractedReviews = JSON.parse(rawJsonMatch[0]);
      let newCount = 0;
      
      for (const review of extractedReviews) {
        const existing = reviews.find(r => 
          r.reviewer_name === review.reviewer_name && 
          r.review_text === review.review_text
        );
        
        if (!existing) {
          const { error } = await db.from("reviews").insert({
            reviewer_name: review.reviewer_name,
            rating: review.rating || 5,
            review_text: review.review_text,
            source: "google_maps",
            categories: [],
            created_at: review.created_at || new Date().toISOString(),
            is_approved: true
          });
          if (!error) newCount++;
        }
      }
      
      if (newCount > 0) {
        toast.success(`${newCount} ulasan baru berhasil di-import!`);
        fetchReviews();
        setImportUrl("");
        setDialogOpen(false);
      } else {
        toast.info("Semua ulasan sudah tersinkronisasi.");
      }

    } catch (error: any) {
      console.error("Scraping Error:", error);
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Render ─── */

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-20">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Manajemen Ulasan</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Kelola ulasan toko & produk dari semua sumber.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setSubmitting(false); setImportUrl(""); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 shrink-0 shadow-sm">
                  <DownloadCloud className="w-4 h-4" /> Import Ulasan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <DownloadCloud className="w-5 h-5 text-blue-600" />
                    Sinkronisasi Ulasan
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <p className="text-sm text-muted-foreground">
                    Sistem akan mengambil ulasan secara otomatis menggunakan AI. Masukkan URL Google Maps Toko di bawah ini.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <Label>Sumber Platform</Label>
                      <Select value={importSource} onValueChange={setImportSource}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="google_maps">
                            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> Google Maps (AI Powered)</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>URL Google Maps</Label>
                      <Input 
                        placeholder="https://maps.app.goo.gl/... atau URL ulasan"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Tips: Gunakan URL dari browser (bukan aplikasi maps) untuk hasil lebih akurat.
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleImport} 
                    disabled={submitting || !importUrl} 
                    className="w-full mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menganalisis dengan AI...
                      </>
                    ) : (
                      "Mulai Sinkronisasi"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-1.5 shrink-0 shadow-sm bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                >
                  <Trash2 className="w-4 h-4" /> {selectedIds.length > 0 ? `Hapus Terpilih (${selectedIds.length})` : "Kosongkan Data"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <Trash2 className="w-5 h-5" /> Konfirmasi Penghapusan
                  </DialogTitle>
                </DialogHeader>
                <div className="py-3">
                  <p className="text-sm text-muted-foreground">
                    {selectedIds.length > 0 
                      ? `Apakah Anda yakin ingin menghapus ${selectedIds.length} ulasan yang dipilih? Tindakan ini tidak dapat dibatalkan.`
                      : "Apakah Anda yakin ingin menghapus SEMUA ulasan di sistem? Tindakan ini tidak dapat dibatalkan."}
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
                  <Button 
                    variant="destructive" 
                    onClick={async () => {
                      if (selectedIds.length > 0) {
                        await db.from("reviews").delete().in("id", selectedIds);
                        toast.success(`${selectedIds.length} data ulasan berhasil dihapus!`);
                        setSelectedIds([]);
                      } else {
                        await db.from("reviews").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                        toast.success("Semua data berhasil dihapus!");
                      }
                      setDeleteDialogOpen(false);
                      fetchReviews();
                    }}
                  >
                    Ya, Hapus Data
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Rating Rata-rata",
              value: <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {stats.avgRating.toFixed(2)}
              </span>,
              sub: `dari ${stats.total} ulasan`,
            },
            {
              label: "Ulasan Toko",
              value: stats.toko,
              sub: "Google Maps",
              icon: <Store className="w-4 h-4 text-muted-foreground" />,
            },
            {
              label: "Ulasan Produk",
              value: stats.produk,
              sub: "Website, POS, E-commerce",
              icon: <ShoppingBag className="w-4 h-4 text-muted-foreground" />,
            },
            {
              label: "Pending Approval",
              value: stats.pending,
              sub: `${stats.featured} featured`,
              highlight: stats.pending > 0,
            },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl border p-4 bg-card ${s.highlight ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-border"}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                {s.icon}
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs + Filter (Sticky) */}
        <div className="sticky top-16 z-20 bg-background/95 backdrop-blur py-2 flex flex-col md:flex-row md:items-center gap-3 border-b border-border/50 -mx-4 px-4 md:mx-0 md:px-0 md:border-none">
          <div className="flex items-center gap-1 shrink-0 border border-border rounded-lg p-0.5 bg-muted/40 overflow-x-auto">
            {[
              { id: "all", label: `Semua (${stats.total})` },
              { id: "toko", label: `Toko (${stats.toko})` },
              { id: "produk", label: `Produk (${stats.produk})` },
              { id: "pending", label: "Pending", badge: stats.pending > 0 ? stats.pending : undefined }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5",
                  tab === t.id
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {t.badge && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-px leading-none">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-1 flex-wrap md:justify-end">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama / teks..."
                className="pl-8 h-9 w-52 text-sm"
              />
            </div>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="Sumber" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sumber</SelectItem>
                {Object.entries(SOURCES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">{val.icon} {val.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="h-9 w-32 text-xs"><SelectValue placeholder="Semua Bintang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bintang</SelectItem>
                {[5, 4, 3, 2, 1].map(n => (
                  <SelectItem key={n} value={String(n)}>
                    <div className="flex items-center gap-1.5">
                      <span className="flex">{"★".repeat(n)}</span>
                      <span>{n}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {/* Table header (Sticky in desktop inside its own container if needed, but the main page filter is already sticky) */}
          <div className="hidden md:grid grid-cols-[2fr_90px_80px_110px_3fr_100px_90px_40px] gap-3 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide items-center">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={filtered.length > 0 && selectedIds.length === filtered.length} 
                onCheckedChange={(c) => {
                  if (c) setSelectedIds(filtered.map(r => r.id));
                  else setSelectedIds([]);
                }}
                className="border-muted-foreground/50 data-[state=checked]:bg-primary"
              />
              <span>Reviewer</span>
            </div>
            <span>Rating</span>
            <span>Tipe</span>
            <span>Sumber</span>
            <span>Ulasan</span>
            <span>Tanggal</span>
            <span>Status</span>
            <span></span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <MessageSquare className="w-8 h-8 opacity-30" />
              <p className="text-sm">Memuat ulasan...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <MessageSquare className="w-8 h-8 opacity-30" />
              <p className="text-sm">Tidak ada ulasan ditemukan.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(r => {
                const src    = SOURCES[r.source] ?? { label: r.source, icon: <MapPin className="w-3 h-3"/>, color: "bg-zinc-100 text-zinc-700 border-zinc-200" };
                const tipe   = getTipe(r.source);
                const initials = r.reviewer_name?.[0]?.toUpperCase() ?? "?";

                return (
                  <div
                    key={r.id}
                    className={`px-4 py-3 grid grid-cols-1 md:grid-cols-[2fr_90px_80px_110px_3fr_100px_90px_40px] gap-3 items-center transition-colors hover:bg-muted/30 ${!r.is_approved ? "opacity-60" : ""}`}
                  >
                    {/* Reviewer */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox 
                        checked={selectedIds.includes(r.id)} 
                        onCheckedChange={(c) => {
                          if (c) setSelectedIds(prev => [...prev, r.id]);
                          else setSelectedIds(prev => prev.filter(id => id !== r.id));
                        }}
                      />
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-xs font-bold overflow-hidden border border-border">
                          {r.reviewer_avatar_url
                            ? <img src={r.reviewer_avatar_url} className="w-8 h-8 object-cover" />
                            : initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{r.reviewer_name}</p>
                          {r.is_featured && (
                            <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400">⭐ Featured</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex flex-col gap-0.5">
                      <Stars rating={r.rating} size="xs" />
                      <span className="text-[11px] font-bold text-zinc-500">{r.rating}.0</span>
                    </div>

                    {/* Tipe */}
                    <div className="flex items-center gap-1.5 md:block">
                      <span className="md:hidden text-xs text-muted-foreground w-16">Tipe:</span>
                      {tipe === "toko" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
                          <Store className="w-2.5 h-2.5" /> Toko
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-sky-100 text-sky-700 border border-sky-200 rounded-full px-2 py-0.5">
                          <ShoppingBag className="w-2.5 h-2.5" /> Produk
                        </span>
                      )}
                    </div>

                    {/* Sumber */}
                    <div className="flex items-center gap-1.5 md:block">
                      <span className="md:hidden text-xs text-muted-foreground w-16">Sumber:</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 ${src.color}`}>
                        {src.icon} {src.label}
                      </span>
                    </div>

                    {/* Ulasan */}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{r.review_text}</p>
                      {r.categories?.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1.5">
                          {r.categories.slice(0, 2).map(cat => {
                            const c = REVIEW_CATEGORIES.find(rc => rc.key === cat);
                            return c ? (
                              <span key={cat} className="inline-flex items-center text-[10px] bg-muted text-muted-foreground border border-border rounded-full px-1.5 py-px">
                                {c.emoji} {c.label}
                              </span>
                            ) : null;
                          })}
                          {r.categories.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{r.categories.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tanggal */}
                    <div className="flex items-center gap-1.5 md:block">
                      <span className="md:hidden text-xs text-muted-foreground w-16">Tgl:</span>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5 md:block">
                      <span className="md:hidden text-xs text-muted-foreground w-16">Status:</span>
                      <button
                        onClick={() => toggleApproval(r.id, r.is_approved)}
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 border transition-colors ${
                          r.is_approved
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        {r.is_approved ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {r.is_approved ? "Tampil" : "Hidden"}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end absolute right-4 md:relative md:right-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => toggleFeatured(r.id, r.is_featured)} className="gap-2">
                            <Star className={`w-3.5 h-3.5 ${r.is_featured ? "fill-yellow-400 text-yellow-400" : ""}`} />
                            {r.is_featured ? "Unfeature" : "Jadikan Featured"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteReview(r.id)} className="gap-2 text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pb-2">
            Menampilkan {filtered.length} dari {reviews.length} ulasan
          </p>
        )}

      </div>
      <AdminFooter />
    </DashboardLayout>
  );
}
