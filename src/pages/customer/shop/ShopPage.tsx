import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Input } from "@/components/ui/input";
import { Search, Star, Truck, ImageOff, ChevronLeft, ChevronRight, Tag, Filter, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/shared/LocaleContext";

interface CatalogItem {
  id: string;
  product_id: string | null;
  slug: string | null;
  display_name: string;
  short_description: string | null;
  thumbnail_url: string | null;
  highlight_product: boolean;
  free_shipping: boolean;
  promo_label: string | null;
  promo_badge: string | null;
  is_flash_sale: boolean;
  discount_active: boolean;
  discount_type: string | null;
  discount_value: number | null;
  discount_start_at: string | null;
  discount_end_at: string | null;
  catalog_series: string | null;
  catalog_warranty_type: string | null;
}

interface MasterProductRef {
  id: string;
  series: string;
  warranty_type: string;
  category: string;
}

interface StockPrice {
  product_id: string;
  min_price: number | null;
  total: number;
}

// Each catalog item IS a group (1 series + 1 warranty_type)
interface GroupedProduct {
  key: string;
  series: string;
  category: string;
  item: CatalogItem;
  minPrice: number | null;
  maxPrice: number | null;
  totalStock: number;
  hasFlashSale: boolean;
  hasDiscount: boolean;
  hasFreeShipping: boolean;
  hasHighlight: boolean;
  thumbnailUrl: string | null;
  hasSaleCampaignDiscount: boolean;
  saleCampaignDisc?: SaleCampaignItem;
}

const WARRANTY_SHORT: Record<string, string> = {
  resmi_bc: "Resmi BC",
  ibox: "Resmi iBox",
  inter: "Inter",
  whitelist: "Whitelist",
  digimap: "Digimap",
};

const USD_RATE = 15500;

function useFormatPrice() {
  const { currency } = useLocale();
  return (n: number | null | undefined) => {
    if (!n) return "—";
    if (currency === "USD") {
      const usd = n / USD_RATE;
      return "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return "Rp" + n.toLocaleString("id-ID");
  };
}

const PAGE_SIZE = 12;

interface FlashSaleSettings {
  is_active: boolean;
  start_time: string;
  duration_hours: number;
}

interface SaleCampaignItem {
  series: string;
  storage_gb: number;
  warranty_type: string;
  discount_type: string;
  discount_value: number;
}

interface SaleCampaignInfo {
  id: string;
  campaign_name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  gradient_start: string | null;
}

function useCountdown(endTime: Date | null) {
  const getRemaining = () => {
    if (!endTime) return { h: 0, m: 0, s: 0, expired: true };
    const diff = endTime.getTime() - Date.now();
    if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true };
    return { h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000), expired: false };
  };
  const [time, setTime] = useState(getRemaining());
  useEffect(() => { const t = setInterval(() => setTime(getRemaining()), 1000); return () => clearInterval(t); }, [endTime]);
  return time;
}

export default function ShopPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formatPrice = useFormatPrice();
  const { lang } = useLocale();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProductRef[]>([]);
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [filterCategory, setFilterCategory] = useState(searchParams.get("filter") === "flash_sale" ? "flash_sale" : "all");
  const [filterWarranty, setFilterWarranty] = useState("all");
  const [filterPrice, setFilterPrice] = useState("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [flashSale, setFlashSale] = useState<FlashSaleSettings | null>(null);
  const [flashEndTime, setFlashEndTime] = useState<Date | null>(null);
  const [saleCampaignItems, setSaleCampaignItems] = useState<SaleCampaignItem[]>([]);
  const [saleCampaign, setSaleCampaign] = useState<SaleCampaignInfo | null>(null);
  const [saleEndTime, setSaleEndTime] = useState<Date | null>(null);
  const { h, m, s, expired: flashExpired } = useCountdown(flashEndTime);
  const saleCd = useCountdown(saleEndTime);
  const flashActive = flashSale?.is_active && !flashExpired;
  const saleActive = saleCampaign?.is_active && !saleCd.expired;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catRes, masterRes, stockRes, fsRes] = await Promise.all([
      db.from("catalog_products")
        .select("id, product_id, slug, display_name, short_description, thumbnail_url, highlight_product, free_shipping, promo_label, promo_badge, is_flash_sale, discount_active, discount_type, discount_value, discount_start_at, discount_end_at, catalog_series, catalog_warranty_type")
        .eq("catalog_status", "published"),
      db.from("master_products")
        .select("id, series, warranty_type, category")
        .eq("is_active", true)
        .is("deleted_at", null),
      db.from("stock_units")
        .select("product_id, selling_price")
        .eq("stock_status", "available"),
      supabase.rpc("get_active_flash_sale_info"),
    ]);

    const masters: MasterProductRef[] = masterRes.data ?? [];
    const rawStock = stockRes.data ?? [];
    const priceMap: Record<string, StockPrice> = {};
    for (const unit of rawStock) {
      if (!priceMap[unit.product_id]) {
        priceMap[unit.product_id] = { product_id: unit.product_id, min_price: null, total: 0 };
      }
      priceMap[unit.product_id].total++;
      const p = Number(unit.selling_price);
      if (p > 0) {
        const cur = priceMap[unit.product_id].min_price;
        priceMap[unit.product_id].min_price = cur === null ? p : Math.min(cur, p);
      }
    }
    const fsRows = fsRes.data as { is_active: boolean; start_time: string; duration_hours: number }[] | null;
    if (fsRows && fsRows.length > 0) {
      const fs = fsRows[0];
      setFlashSale({ is_active: fs.is_active, start_time: fs.start_time, duration_hours: fs.duration_hours });
      if (fs.is_active) {
        const start = new Date(fs.start_time);
        const end = new Date(start.getTime() + fs.duration_hours * 3600000);
        if (end.getTime() > Date.now()) setFlashEndTime(end);
      }
    }

    // Fetch active sale campaign items
    const { data: scData } = await db.from("sale_campaigns").select("id, campaign_name, start_time, end_time, is_active, gradient_start").eq("is_active", true).limit(1).single();
    if (scData) {
      const sc = scData as SaleCampaignInfo;
      const now = Date.now();
      if (new Date(sc.start_time).getTime() <= now && new Date(sc.end_time).getTime() > now) {
        setSaleCampaign(sc);
        setSaleEndTime(new Date(sc.end_time));
      }
      const { data: sciData } = await db.from("sale_campaign_items").select("series, storage_gb, warranty_type, discount_type, discount_value").eq("campaign_id", sc.id);
      if (sciData) setSaleCampaignItems(sciData as SaleCampaignItem[]);
    }

    setPrices(priceMap);
    setMasterProducts(masters);
    setItems(catRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Each catalog item is 1 series (all warranty types combined)
  const grouped: GroupedProduct[] = useMemo(() => {
    return items.map(item => {
      const series = item.catalog_series ?? "";
      // Find all master products matching this series (all warranty types)
      const matchingMasters = masterProducts.filter(m => m.series === series);
      const category = matchingMasters[0]?.category ?? "iphone";
      
      let minPrice: number | null = null;
      let maxPrice: number | null = null;
      let totalStock = 0;
      for (const m of matchingMasters) {
        const sp = prices[m.id];
        if (sp) {
          totalStock += sp.total;
          if (sp.min_price != null) {
            minPrice = minPrice === null ? sp.min_price : Math.min(minPrice, sp.min_price);
            maxPrice = maxPrice === null ? sp.min_price : Math.max(maxPrice!, sp.min_price);
          }
        }
      }

      // Check if this series has a sale campaign discount (any warranty type)
      const hasSaleCampaignDiscount = saleCampaignItems.some(sci =>
        sci.series.toLowerCase() === series.toLowerCase()
      );
      const saleCampaignDisc = saleCampaignItems.find(sci =>
        sci.series.toLowerCase() === series.toLowerCase()
      );

      // Mutually exclusive: if Flash Sale is active globally, ignore sale campaign labels; vice versa
      const effectiveFlashSale = item.is_flash_sale && totalStock > 0 && flashActive;
      const effectiveSaleCampaign = hasSaleCampaignDiscount && saleActive && !effectiveFlashSale;

      return {
        key: series,
        series,
        category,
        item,
        minPrice,
        maxPrice,
        totalStock,
        hasFlashSale: effectiveFlashSale,
        hasDiscount: item.discount_active && !!item.discount_value,
        hasFreeShipping: item.free_shipping,
        hasHighlight: item.highlight_product,
        thumbnailUrl: item.thumbnail_url,
        hasSaleCampaignDiscount: effectiveSaleCampaign,
        saleCampaignDisc,
      };
    }).filter(g => g.series);
  }, [items, prices, masterProducts, saleCampaignItems, flashActive, saleActive]);

  // Filter grouped
  const filtered = grouped.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      g.series.toLowerCase().includes(q) ||
      g.item.display_name.toLowerCase().includes(q);
    const matchFlash = filterCategory === "flash_sale" ? g.hasFlashSale : true;
    const matchSale = filterCategory === "diskon_sale" ? g.hasSaleCampaignDiscount : true;
    const matchCat = filterCategory === "flash_sale" || filterCategory === "diskon_sale" || filterCategory === "all" || g.category === filterCategory;
    const matchWar = filterWarranty === "all" || g.item.catalog_warranty_type === filterWarranty;
    const minP = g.minPrice ?? 0;
    let matchPrice = true;
    if (filterPrice === "under5") matchPrice = minP < 5_000_000;
    else if (filterPrice === "5to10") matchPrice = minP >= 5_000_000 && minP <= 10_000_000;
    else if (filterPrice === "above10") matchPrice = minP > 10_000_000;
    return matchSearch && matchFlash && matchSale && matchCat && matchWar && matchPrice;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (a.hasHighlight && !b.hasHighlight) return -1;
    if (!a.hasHighlight && b.hasHighlight) return 1;
    return b.totalStock - a.totalStock;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleFilter(key: string, v: string) {
    if (key === "cat") setFilterCategory(v);
    if (key === "war") setFilterWarranty(v);
    if (key === "price") setFilterPrice(v);
    setPage(1);
  }

  const flashSaleCount = grouped.filter(g => g.hasFlashSale).length;
  const diskonSaleCount = grouped.filter(g => g.hasSaleCampaignDiscount).length;
  // Flash sale and diskon sale are mutually exclusive — only show active one
  const filterChips = [
    { label: "Semua", active: filterCategory === "all", onClick: () => handleFilter("cat", "all") },
    ...(flashSaleCount > 0 && flashActive && !saleActive ? [{
      label: "⚡ Flash Sale",
      active: filterCategory === "flash_sale",
      onClick: () => handleFilter("cat", "flash_sale"),
    }] : []),
    ...(diskonSaleCount > 0 && saleActive ? [{
      label: "🏷️ Discount Sale",
      active: filterCategory === "diskon_sale",
      onClick: () => handleFilter("cat", "diskon_sale"),
    }] : []),
    { label: "iPhone", active: filterCategory === "iphone", onClick: () => handleFilter("cat", "iphone") },
    { label: "iPad", active: filterCategory === "ipad", onClick: () => handleFilter("cat", "ipad") },
    { label: "Aksesori", active: filterCategory === "accessory", onClick: () => handleFilter("cat", "accessory") },
  ];

  // Build display name for a grouped product
  function groupDisplayName(g: GroupedProduct) {
    return g.item.display_name;
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-4">

        {/* Hero */}
        <div className="bg-muted/30 border-b border-border py-6 px-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Katalog Produk</h1>
            <p className="text-muted-foreground text-sm mb-5">iPhone, iPad, dan aksesori original berkualitas dengan harga terbaik.</p>
            <div className="relative max-w-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Cari produk, model, warna..."
                className="pl-10 h-11 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">

          {/* Category chips */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {filterChips.map(c => (
              <button
                key={c.label}
                onClick={c.onClick}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
                  c.active
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                showFilters ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/40"
              )}
            >
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
          </div>

          {/* Flash sale countdown banner */}
          {filterCategory === "flash_sale" && flashActive && !flashExpired && (
            <div className="mb-4 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: "linear-gradient(135deg, hsl(0 0% 6%) 0%, hsl(15 60% 8%) 50%, hsl(0 0% 5%) 100%)" }}>
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-sm font-bold text-white">Flash Sale Aktif</p>
                  <p className="text-xs text-white/60">Harga spesial terbatas waktu</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-white/60 uppercase tracking-wider">Sisa waktu:</span>
                <div className="flex items-center gap-1">
                  {[
                    { v: h, l: "j" }, { v: m, l: "m" }, { v: s, l: "d" },
                  ].map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5">
                      <span className="bg-white/10 text-amber-400 font-bold text-sm px-2 py-1 rounded-md tabular-nums">{String(t.v).padStart(2, "0")}</span>
                      <span className="text-[10px] text-white/50">{t.l}</span>
                      {i < 2 && <span className="text-amber-400 font-bold mx-0.5">:</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Diskon Sale countdown banner */}
          {filterCategory === "diskon_sale" && saleActive && saleCampaign && (() => {
            const accent = saleCampaign.gradient_start || "hsl(142 71% 45%)";
            return (
              <div className="mb-4 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
                style={{ background: `linear-gradient(135deg, hsl(0 0% 6%) 0%, ${accent}15 50%, hsl(0 0% 5%) 100%)` }}>
                <div className="flex items-center gap-2.5">
                  <Tag className="w-5 h-5" style={{ color: accent }} />
                  <div>
                    <p className="text-sm font-bold text-white">{saleCampaign.campaign_name}</p>
                    <p className="text-xs text-white/60">Harga spesial terbatas waktu</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: accent }} />
                  <span className="text-xs text-white/60 uppercase tracking-wider">Sisa waktu:</span>
                  <div className="flex items-center gap-1">
                    {[
                      { v: saleCd.h, l: "j" }, { v: saleCd.m, l: "m" }, { v: saleCd.s, l: "d" },
                    ].map((t, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5">
                        <span className="bg-white/10 font-bold text-sm px-2 py-1 rounded-md tabular-nums" style={{ color: accent }}>{String(t.v).padStart(2, "0")}</span>
                        <span className="text-[10px] text-white/50">{t.l}</span>
                        {i < 2 && <span className="font-bold mx-0.5" style={{ color: accent }}>:</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Expanded filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 p-4 bg-muted/20 border border-border rounded-xl">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Jenis Garansi</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { val: "all", label: "Semua" },
                    { val: "resmi_bc", label: "Resmi BC" },
                    { val: "ibox", label: "iBox" },
                    { val: "inter", label: "Inter" },
                    { val: "whitelist", label: "Whitelist" },
                    { val: "digimap", label: "Digimap" },
                  ].map(w => (
                    <button
                      key={w.val}
                      onClick={() => handleFilter("war", w.val)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                        filterWarranty === w.val ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                    >{w.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Rentang Harga</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { val: "all", label: "Semua" },
                    { val: "under5", label: "< Rp 5 jt" },
                    { val: "5to10", label: "Rp 5\u201310 jt" },
                    { val: "above10", label: "> Rp 10 jt" },
                  ].map(p => (
                    <button
                      key={p.val}
                      onClick={() => handleFilter("price", p.val)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                        filterPrice === p.val ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results count */}
          <p className="text-xs text-muted-foreground mb-4">{sorted.length} produk ditemukan</p>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Produk tidak ditemukan</p>
              <p className="text-xs text-muted-foreground mt-1">Coba ubah kata kunci atau filter pencarian.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginated.map(g => {
                const outOfStock = g.totalStock === 0;
                const displayName = groupDisplayName(g);
                const slug = g.item.slug;

                return (
                  <Link
                    key={g.key}
                    to={slug ? `/produk/${slug}` : "#"}
                    className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all group flex flex-col"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                      {g.thumbnailUrl ? (
                        <img
                          src={g.thumbnailUrl}
                          alt={displayName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground/30">
                          <ImageOff className="w-8 h-8" />
                          <span className="text-[10px]">Belum ada foto</span>
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                        {g.hasHighlight && (
                          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500 text-white whitespace-nowrap">
                            <Star className="w-3 h-3 fill-current shrink-0" /> Unggulan
                          </span>
                        )}
                        {g.hasFreeShipping && (
                          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-green-500 text-white whitespace-nowrap">
                            <Truck className="w-3 h-3 shrink-0" /> Gratis Ongkir
                          </span>
                        )}
                        {g.hasFlashSale && (
                          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground whitespace-nowrap">
                            <Zap className="w-3 h-3 shrink-0" /> Flash Sale
                          </span>
                        )}
                        {g.hasDiscount && !g.hasFlashSale && (
                          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground whitespace-nowrap">
                            <Tag className="w-3 h-3 shrink-0" /> Diskon
                          </span>
                        )}
                        {g.hasSaleCampaignDiscount && !g.hasFlashSale && !g.hasDiscount && (
                          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap"
                            style={{ background: "hsl(142 71% 45%)", color: "hsl(0 0% 100%)" }}>
                            <Tag className="w-3 h-3 shrink-0" /> Discount Sale
                          </span>
                        )}
                      </div>

                      {outOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-base font-extrabold bg-destructive/80 px-5 py-2.5 rounded-full tracking-wide">STOK HABIS</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 flex-1 flex flex-col gap-1.5">
                      <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{displayName}</p>
                      <div className="mt-auto pt-1">
                        {outOfStock ? (
                          <span className="text-sm text-destructive font-bold">STOK HABIS</span>
                        ) : (
                          <>
                            {(() => {
                              // Determine discount source: flash/catalog discount, or sale campaign
                              let discType = "";
                              let discValue = 0;
                              let isGreenDiscount = false;

                              if ((g.hasFlashSale || g.hasDiscount) && g.item.discount_value) {
                                discType = g.item.discount_type ?? "percentage";
                                discValue = g.item.discount_value ?? 0;
                              } else if (g.hasSaleCampaignDiscount && g.saleCampaignDisc) {
                                discType = g.saleCampaignDisc.discount_type;
                                discValue = g.saleCampaignDisc.discount_value;
                                isGreenDiscount = true;
                              }

                              if (discValue > 0 && g.minPrice) {
                                const discounted = discType === "percentage"
                                  ? Math.round(g.minPrice * (1 - discValue / 100))
                                  : Math.max(0, g.minPrice - discValue);
                                if (discounted < g.minPrice) {
                                  const pct = discType === "percentage" ? discValue : Math.round(((g.minPrice - discounted) / g.minPrice) * 100);
                                  return (
                                    <>
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <p className="text-[11px] text-muted-foreground line-through">{formatPrice(g.minPrice)}</p>
                                        <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: "hsl(0 72% 50% / 0.1)", color: "hsl(0 72% 50%)" }}>
                                          -{pct}%
                                        </span>
                                      </div>
                                      <p className="text-base font-bold" style={{ color: "hsl(0 72% 50%)" }}>
                                        {formatPrice(discounted)}
                                      </p>
                                    </>
                                  );
                                }
                              }

                              return (
                                <>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">{lang === "en" ? "From" : "Mulai"}</p>
                                  <p className="text-base font-bold text-foreground">{formatPrice(g.minPrice)}</p>
                                </>
                              );
                            })()}
                            {g.totalStock > 0 && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{g.totalStock} unit tersedia</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    "w-9 h-9 rounded-lg border text-sm font-medium transition-all",
                    page === i + 1
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4 mb-8">
            Menampilkan {paginated.length} dari {sorted.length} produk · Halaman {page} dari {Math.max(1, totalPages)}
          </p>
        </div>
      </div>
    </div>
  );
}
