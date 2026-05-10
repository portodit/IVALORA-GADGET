import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Star, ChevronLeft, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const db = supabase as any;

const REVIEW_CATEGORIES = [
  { key: "kualitas_produk", label: "Kualitas Produk", emoji: "📦" },
  { key: "pelayanan_toko", label: "Pelayanan Toko", emoji: "🏪" },
  { key: "aksesibilitas_website", label: "Website & Kemudahan", emoji: "🌐" },
  { key: "pengiriman", label: "Pengiriman", emoji: "🚚" },
  { key: "harga_kompetitif", label: "Harga Kompetitif", emoji: "💰" },
  { key: "after_sales", label: "After Sales / Garansi", emoji: "🛡️" },
];

const SOURCE_LABELS: Record<string, string> = {
  manual: "Pelanggan",
  google_maps: "Google Maps",
  website_purchase: "Pembelian Website",
};

interface Review {
  id: string;
  reviewer_name: string;
  reviewer_avatar_url: string | null;
  rating: number;
  review_text: string;
  photo_urls: string[];
  categories: string[];
  source: string;
  created_at: string;
}

export default function UlasanPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("reviews").select("*").eq("is_approved", true).order("is_featured", { ascending: false }).order("created_at", { ascending: false });
      setReviews((data as Review[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = reviews.filter(r => {
    if (filterRating !== "all" && r.rating !== parseInt(filterRating)) return false;
    if (filterCategory !== "all" && !r.categories.includes(filterCategory)) return false;
    return true;
  });

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;
  const ratingDist = [5, 4, 3, 2, 1].map(n => ({
    star: n,
    count: reviews.filter(r => r.rating === n).length,
    pct: reviews.length > 0 ? ((reviews.filter(r => r.rating === n).length / reviews.length) * 100).toFixed(2) : "0",
  }));

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-4">
          <ChevronLeft className="w-4 h-4" /> Kembali
        </Link>
        <h1 className="text-2xl font-bold">Ulasan Pelanggan</h1>
        <p className="text-sm text-muted-foreground mb-6">Ulasan dari pelanggan Ivalora Gadget.</p>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
          {/* Left: Stats */}
          <div className="border border-border rounded-xl p-5 bg-card h-fit sticky top-24">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              <span className="text-3xl font-bold">{avgRating.toFixed(2)}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{reviews.length} Ulasan</p>
            <div className="space-y-1.5">
              {ratingDist.map(r => (
                <div key={r.star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 font-medium">{r.star}</span>
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="w-12 text-right text-muted-foreground">{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Reviews List */}
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap items-center">
              <span className="text-sm font-medium">Filter</span>
              <Select value={filterRating} onValueChange={setFilterRating}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Semua bintang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua bintang</SelectItem>
                  {[5, 4, 3, 2, 1].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} Bintang</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua kategori</SelectItem>
                  {REVIEW_CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Memuat ulasan...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Tidak ada ulasan ditemukan.</div>
            ) : (
              filtered.map(r => (
                <div key={r.id} className="border border-border rounded-xl p-5 bg-card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold overflow-hidden">
                      {r.reviewer_avatar_url ? (
                        <img src={r.reviewer_avatar_url} className="w-10 h-10 object-cover" />
                      ) : r.reviewer_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{r.reviewer_name}</p>
                        <Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[r.source] || r.source}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <div className="flex items-center gap-0.5 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                      {r.categories.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {r.categories.map(cat => {
                            const c = REVIEW_CATEGORIES.find(rc => rc.key === cat);
                            return c ? <Badge key={cat} variant="secondary" className="text-[10px]">{c.emoji} {c.label}</Badge> : null;
                          })}
                        </div>
                      )}
                      <p className="text-sm text-foreground mt-3 leading-relaxed">{r.review_text}</p>
                      {r.photo_urls && r.photo_urls.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {r.photo_urls.map((url, i) => (
                            <img key={i} src={url} onClick={() => setPreviewImg(url)}
                              className="w-20 h-20 rounded-lg object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Image preview modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} className="max-w-full max-h-[90vh] rounded-xl" />
        </div>
      )}
    </div>
  );
}
