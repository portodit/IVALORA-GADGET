import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Star, ChevronRight, MapPin, Clock, Phone, MessageCircle,
  ArrowRight, ShoppingBag, Instagram, Zap, X, Tag, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/contexts/shared/LocaleContext";
import logoHorizontal from "@/assets/logo-horizontal.svg";
import iphone11Pro from "@/assets/iphone-11-pro.png";
import iphone13 from "@/assets/iphone-13.png";
import iphone13Pro from "@/assets/iphone-13-pro.png";
import iphone11 from "@/assets/iphone-11.png";
import logoShopee from "@/assets/logo-shopee.png";
import logoTokopedia from "@/assets/logo-tokopedia.png";
import uvpQuality from "@/assets/uvp-quality.png";
import uvpGaransi from "@/assets/uvp-garansi.png";
import uvpHarga from "@/assets/uvp-harga.png";
import uvpCicilan from "@/assets/uvp-cicilan.png";
import heroBg from "@/assets/hero-bg.jpg";

const USD_RATE = 15500;

function useFormatPrice() {
  const { currency } = useLocale();
  return (n: number | null | undefined) => {
    if (!n) return "—";
    if (currency === "USD") {
      const usd = n / USD_RATE;
      return "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return "Rp " + n.toLocaleString("id-ID");
  };
}

function useT() {
  const { lang } = useLocale();
  return (id: string, en: string) => lang === "en" ? en : id;
}

interface Product {
  id: string;
  display_name: string;
  slug: string | null;
  thumbnail_url: string | null;
  override_display_price: number | null;
  highlight_product: boolean;
  promo_badge: string | null;
  promo_label: string | null;
  rating_score: number | null;
  free_shipping: boolean;
  spec_warranty_duration: string | null;
  product_id: string | null;
  is_flash_sale?: boolean;
  catalog_series: string | null;
  catalog_warranty_type: string | null;
}

interface StockPriceInfo {
  product_id: string;
  min_price: number | null;
  max_price: number | null;
}

interface FeaturedVariant {
  id: string;
  series: string;
  color: string | null;
  storage_gb: number | null;
  warranty_type: string | null;
  category: string;
  price: number | null;
  stock: number;
  catalogSlug: string | null;
  catalogThumbnail: string | null;
  catalogSeries: string;
  catalogWarrantyType: string;
}

interface FlashSaleSettings {
  is_active: boolean;
  start_time: string;
  duration_hours: number;
  event_name?: string | null;
  gradient_start?: string | null;
  gradient_end?: string | null;
}

interface SaleCampaign {
  id: string;
  campaign_name: string;
  subtitle: string | null;
  description: string | null;
  banner_urls: string[];
  gradient_start: string;
  gradient_end: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  show_popup: boolean;
}

// ─── iPhone category cards ────────────────────────────────────────────────────
const IPHONE_CATEGORIES = [
  { name: "iPhone 11", img: iphone11, tag: "Hemat & Handal" },
  { name: "iPhone 11 Pro", img: iphone11Pro, tag: "Kamera Triple" },
  { name: "iPhone 13", img: iphone13, tag: "Baterai Tahan Lama" },
  { name: "iPhone 13 Pro", img: iphone13Pro, tag: "Layar ProMotion" },
];

// ─── UVP cards ────────────────────────────────────────────────────────────────
const UVP_CARDS = [
  {
    emoji: "✅",
    title: "Premium Quality",
    titleEn: "Premium Quality",
    short: "QC ketat di 30+ checkpoint",
    shortEn: "Strict QC at 30+ checkpoints",
    desc: "Setiap unit melewati pengecekan menyeluruh sebelum dijual. Fungsi utama dipastikan normal dan kondisi dijelaskan secara transparan — kamu tahu persis apa yang kamu beli.",
    descEn: "Every unit undergoes thorough inspection before sale. Core functions are verified and condition is transparently described.",
    img: uvpQuality,
  },
  {
    emoji: "🛡️",
    title: "Free Garansi Unit",
    titleEn: "Free Unit Warranty",
    short: "Garansi toko berlaku penuh",
    shortEn: "Full store warranty included",
    desc: "Setiap pembelian dilengkapi garansi sesuai ketentuan toko. Jika ada kendala selama masa garansi, unit bisa dikonsultasikan dan ditangani langsung oleh tim Ivalora.",
    descEn: "Every purchase includes warranty per store policy. Any issues during warranty period can be consulted and handled directly by the Ivalora team.",
    img: uvpGaransi,
  },
  {
    emoji: "💰",
    title: "Jaminan Harga Terbaik",
    titleEn: "Best Price Guarantee",
    short: "Harga pasar, transparan, no hidden fee",
    shortEn: "Market price, transparent, no hidden fees",
    desc: "Harga disesuaikan kondisi unit dan mengikuti harga pasar terkini. Tanpa biaya tersembunyi, plus tersedia opsi tukar tambah untuk memudahkan upgrade perangkat.",
    descEn: "Prices follow current market rates based on unit condition. No hidden fees, plus trade-in options available.",
    img: uvpHarga,
  },
  {
    emoji: "💳",
    title: "Cicilan Mudah & Aman",
    titleEn: "Easy & Safe Installments",
    short: "Tersedia via Shopee & Tokopedia",
    shortEn: "Available via Shopee & Tokopedia",
    desc: "Pembelian tersedia melalui marketplace resmi seperti Shopee dan Tokopedia dengan sistem pembayaran aman, termasuk opsi cicilan sesuai ketentuan platform.",
    descEn: "Available through official marketplaces like Shopee and Tokopedia with secure payment systems, including installment options.",
    img: uvpCicilan,
  },
];

// ─── Store branches — now fetched from database ──────────────────────────────
interface BranchInfo {
  id: string;
  name: string;
  full_address: string | null;
  phone: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Reviews are now loaded from the database

// ─── Countdown ───────────────────────────────────────────────────────────────
function useCountdown(endTime: Date | null) {
  const getRemaining = () => {
    if (!endTime) return { d: 0, h: 0, m: 0, s: 0, expired: true };
    const diff = endTime.getTime() - Date.now();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
      expired: false,
    };
  };
  const [time, setTime] = useState(getRemaining());
  useEffect(() => {
    const t = setInterval(() => setTime(getRemaining()), 1000);
    return () => clearInterval(t);
  }, [endTime]);
  return time;
}

function CountdownBlock({ val, label, accent }: { val: number; label: string; accent?: string }) {
  const accentColor = accent || "hsl(38 92% 50%)";
  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-lg w-11 h-11 sm:w-13 sm:h-13 flex items-center justify-center text-lg sm:text-xl font-bold tabular-nums"
        style={{ background: "hsl(0 0% 100% / 0.08)", color: accentColor, border: "1px solid hsl(0 0% 100% / 0.1)" }}
      >
        {String(val).padStart(2, "0")}
      </div>
      <span className="text-[9px] mt-1 uppercase tracking-widest text-white/60">
        {label}
      </span>
    </div>
  );
}

interface SaleCampaignItem {
  series: string;
  storage_gb: number;
  warranty_type: string;
  discount_type: string;
  discount_value: number;
}

// ─── Animated Particles for Sale Sections ─────────────────────────────────────
function SaleParticles({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes saleStar {
          0% { transform: translateY(-10%) rotate(0deg); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.4; }
          100% { transform: translateY(110%) rotate(360deg); opacity: 0; }
        }
        @keyframes saleDiag {
          0% { transform: translateX(-100%) translateY(-100%); opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.08; }
          100% { transform: translateX(100%) translateY(100%); opacity: 0; }
        }
      `}</style>
      {/* Falling accent stars */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={`star-${i}`}
          className="absolute text-[10px]"
          style={{
            left: `${8 + (i * 7.5) % 90}%`,
            top: "-5%",
            color: accent,
            animation: `saleStar ${4 + (i % 4) * 1.5}s linear infinite`,
            animationDelay: `${(i * 0.7) % 5}s`,
            opacity: 0,
          }}
        >
          ✦
        </div>
      ))}
      {/* Diagonal accent lines */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`line-${i}`}
          className="absolute"
          style={{
            left: `${15 + i * 22}%`,
            top: "0%",
            width: "1px",
            height: "60%",
            background: `linear-gradient(180deg, transparent, ${accent}30, transparent)`,
            transform: "rotate(25deg)",
            animation: `saleDiag ${6 + i * 2}s linear infinite`,
            animationDelay: `${i * 1.5}s`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
            else setCount(target);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  const formatted = target >= 1000
    ? count.toLocaleString("id-ID")
    : count % 1 !== 0
    ? count.toFixed(1)
    : String(count);

  return <div ref={ref}>{formatted}{suffix}</div>;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const t = useT();
  const formatPrice = useFormatPrice();
  const { lang } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [highlight, setHighlight] = useState<Product[]>([]);
  const [flashSaleProducts, setFlashSaleProducts] = useState<Product[]>([]);
  const [stockPrices, setStockPrices] = useState<StockPriceInfo[]>([]);
  const [flashSale, setFlashSale] = useState<FlashSaleSettings | null>(null);
  const [flashEndTime, setFlashEndTime] = useState<Date | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [featuredVariants, setFeaturedVariants] = useState<FeaturedVariant[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { d: flashD, h, m, s, expired: flashExpired } = useCountdown(flashEndTime);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [activeUvp, setActiveUvp] = useState(0);
  const [activeBranch, setActiveBranch] = useState(0);
  const uvpImgRef = useRef<HTMLDivElement>(null);
  const [saleCampaign, setSaleCampaign] = useState<SaleCampaign | null>(null);
  const [saleCampaignItems, setSaleCampaignItems] = useState<SaleCampaignItem[]>([]);
  const [showSalePopup, setShowSalePopup] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerFullView, setBannerFullView] = useState<string | null>(null);
  const [saleEndTime, setSaleEndTime] = useState<Date | null>(null);
  const saleCd = useCountdown(saleEndTime);
  const [reviews, setReviews] = useState<{ id: string; reviewer_name: string; reviewer_avatar_url: string | null; rating: number; review_text: string; photo_urls: string[]; categories: string[]; source: string; created_at: string }[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);

  // Auto-rotate UVP cards every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUvp(prev => (prev + 1) % UVP_CARDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-slide sale campaign banners
  useEffect(() => {
    if (!saleCampaign || saleCampaign.banner_urls.length <= 1) return;
    const t = setInterval(() => {
      setBannerIdx(prev => (prev + 1) % saleCampaign.banner_urls.length);
    }, 2000);
    return () => clearInterval(t);
  }, [saleCampaign]);

  const saleCampaignActive = saleCampaign?.is_active && saleCampaign &&
    new Date(saleCampaign.start_time).getTime() <= Date.now() &&
    new Date(saleCampaign.end_time).getTime() > Date.now();

  const flashSaleStarted = flashSale ? new Date(flashSale.start_time).getTime() <= Date.now() : false;
  const flashSaleActive = flashSale?.is_active && !flashExpired && flashSaleStarted;

  useEffect(() => {
    (async () => {
      // Fetch flash sale settings via RPC (bypasses RLS for public access)
      const { data: fsRows } = await supabase.rpc("get_active_flash_sale_info") as { data: any[] | null };

      if (fsRows && fsRows.length > 0) {
        const fs = fsRows[0];
        const fsSettings: FlashSaleSettings = {
          is_active: fs.is_active,
          start_time: fs.start_time,
          duration_hours: fs.duration_hours,
          event_name: fs.event_name ?? null,
          gradient_start: fs.gradient_start ?? null,
          gradient_end: fs.gradient_end ?? null,
        };
        setFlashSale(fsSettings);
        if (fs.is_active) {
          const start = new Date(fs.start_time);
          const end = new Date(start.getTime() + fs.duration_hours * 3600000);
          if (end.getTime() > Date.now()) {
            setFlashEndTime(end);
          }
        }
      }

      // Fetch active sale campaign (public read via RLS)
      const { data: scData } = await (supabase as any).from("sale_campaigns").select("*").eq("is_active", true).limit(1).single();
      if (scData) {
        const sc = scData as SaleCampaign;
        const now = Date.now();
        if (new Date(sc.start_time).getTime() <= now && new Date(sc.end_time).getTime() > now) {
          setSaleCampaign(sc);
          setSaleEndTime(new Date(sc.end_time));
          // Fetch sale campaign items
          const { data: sciData } = await (supabase as any).from("sale_campaign_items").select("series, storage_gb, warranty_type, discount_type, discount_value").eq("campaign_id", sc.id);
          if (sciData) setSaleCampaignItems(sciData as SaleCampaignItem[]);
          // Show popup every time landing page opens
          if (sc.show_popup) {
            setTimeout(() => setShowSalePopup(true), 2000);
          }
        }
      }

      // Fetch products
      const { data } = await supabase
        .from("catalog_products")
        .select("id, display_name, slug, thumbnail_url, override_display_price, highlight_product, promo_badge, promo_label, rating_score, free_shipping, spec_warranty_duration, product_id, is_flash_sale, catalog_series, catalog_warranty_type")
        .eq("catalog_status", "published")
        .eq("publish_to_web", true);
      if (data) {
        setHighlight(data.filter((p: Product) => p.highlight_product).slice(0, 4));
        setFlashSaleProducts(data.filter((p: Product) => p.is_flash_sale));
        setProducts(data);

        // Fetch all master products & stock to aggregate by catalog series+type
        const [masterRes, stockAllRes] = await Promise.all([
          supabase.from("master_products").select("id, series, warranty_type, color, storage_gb, category").eq("is_active", true).is("deleted_at", null),
          supabase.from("stock_units").select("product_id, selling_price").eq("stock_status", "available").not("selling_price", "is", null),
        ]);

        const masters: { id: string; series: string; warranty_type: string | null; color: string | null; storage_gb: number | null; category: string }[] = masterRes.data ?? [];
        const stockAll: { product_id: string; selling_price: number | null }[] = stockAllRes.data ?? [];

        // Build per-product price map
        const perProductPrice: Record<string, { min: number; max: number }> = {};
        for (const unit of stockAll) {
          if (!unit.selling_price) continue;
          if (!perProductPrice[unit.product_id]) {
            perProductPrice[unit.product_id] = { min: unit.selling_price, max: unit.selling_price };
          } else {
            perProductPrice[unit.product_id].min = Math.min(perProductPrice[unit.product_id].min, unit.selling_price);
            perProductPrice[unit.product_id].max = Math.max(perProductPrice[unit.product_id].max, unit.selling_price);
          }
        }

        // Aggregate by catalog item's series+type
        const catalogPrices: StockPriceInfo[] = [];
        for (const p of data) {
          const matchingMasters = masters.filter(m => m.series === p.catalog_series && m.warranty_type === p.catalog_warranty_type);
          let min: number | null = null;
          let max: number | null = null;
          for (const m of matchingMasters) {
            const pp = perProductPrice[m.id];
            if (pp) {
              min = min === null ? pp.min : Math.min(min, pp.min);
              max = max === null ? pp.max : Math.max(max, pp.max);
            }
          }
          if (min !== null) {
            catalogPrices.push({ product_id: p.id, min_price: min, max_price: max! });
          }
        }
        setStockPrices(catalogPrices);

        // Fetch category counts
        const counts: Record<string, number> = {};
        for (const cat of IPHONE_CATEGORIES) {
          const matchingProducts = data.filter((p: Product) =>
            p.display_name.toLowerCase().includes(cat.name.toLowerCase())
          );
          let count = 0;
          for (const mp of matchingProducts) {
            const matchingMasters2 = masters.filter(m => m.series === mp.catalog_series && m.warranty_type === mp.catalog_warranty_type);
            count += stockAll.filter(s => matchingMasters2.some(m => m.id === s.product_id)).length;
          }
          counts[cat.name] = count;
        }
        setCategoryCounts(counts);

        // Build featured variants: individual master products with stock > 0
        // Use highlight catalog items, fallback to all published catalogs
        const highlightCatalogs = data.filter((p: Product) => p.highlight_product);
        const sourceCatalogs = highlightCatalogs.length > 0 ? highlightCatalogs : data;
        const variants: FeaturedVariant[] = [];
        for (const cat of sourceCatalogs) {
          const matchingMs = masters.filter(m => m.series === cat.catalog_series && m.warranty_type === cat.catalog_warranty_type);
          for (const m of matchingMs) {
            const unitCount = stockAll.filter(s => s.product_id === m.id).length;
            if (unitCount === 0) continue; // skip out of stock
            const pp = perProductPrice[m.id];
            variants.push({
              id: m.id,
              series: m.series,
              color: m.color,
              storage_gb: m.storage_gb,
              warranty_type: m.warranty_type,
              category: m.category,
              price: pp?.min ?? null,
              stock: unitCount,
              catalogSlug: cat.slug,
              catalogThumbnail: cat.thumbnail_url,
              catalogSeries: cat.catalog_series ?? "",
              catalogWarrantyType: cat.catalog_warranty_type ?? "",
            });
          }
        }
        setFeaturedVariants(variants.slice(0, 4));
        setDataLoaded(true);
      }

      // Fetch branches from database
      const { data: branchData } = await supabase.from("branches").select("id, name, full_address, phone, google_maps_url, latitude, longitude").eq("is_active", true);
      if (branchData) setBranches(branchData as BranchInfo[]);

      // Fetch reviews
      const { data: reviewsData } = await (supabase as any).from("reviews").select("*").eq("is_approved", true).order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(12);
      if (reviewsData) setReviews(reviewsData);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      {/* ── Visitor Popup for Discount Sale — shows every visit ── */}
      {showSalePopup && saleCampaign && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setShowSalePopup(false)}>
          <div className="relative w-[90vw] max-w-sm rounded-2xl overflow-hidden shadow-2xl bg-card border border-border"
            onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowSalePopup(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
            >
              <X className="w-4 h-4" />
            </button>
            {/* Banner image — clickable to view full, object-top so top is always visible */}
            {saleCampaign.banner_urls.length > 0 && (
              <div className="relative cursor-pointer group" onClick={() => setBannerFullView(saleCampaign.banner_urls[0])}>
                <img src={saleCampaign.banner_urls[0]} alt="Sale Banner" className="w-full aspect-[3/4] object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <p className="text-xl font-black leading-tight drop-shadow-lg">{saleCampaign.campaign_name}</p>
                  {saleCampaign.subtitle && <p className="text-sm font-medium opacity-90 mt-1 drop-shadow">{saleCampaign.subtitle}</p>}
                </div>
              </div>
            )}
            <div className="p-4 space-y-3">
              {saleCampaign.description && <p className="text-xs text-muted-foreground">{saleCampaign.description}</p>}
              <button
                onClick={() => { setShowSalePopup(false); navigate("/katalog"); }}
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition bg-foreground text-background hover:opacity-90"
              >
                Lihat Katalog <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full image viewer overlay ── */}
      {bannerFullView && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setBannerFullView(null)}>
          <button onClick={() => setBannerFullView(null)} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
          <img src={bannerFullView} alt="Full Banner" className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg" />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          HERO — Full bleed photo background, dark left overlay
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden flex items-center min-h-[92vh]">
        <img
          src={heroBg}
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, hsl(0 0% 3% / 0.97) 0%, hsl(0 0% 5% / 0.88) 35%, hsl(0 0% 8% / 0.5) 65%, hsl(0 0% 0% / 0.05) 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-32"
          style={{ background: "linear-gradient(180deg, hsl(0 0% 3% / 0.7) 0%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-32"
          style={{ background: "linear-gradient(0deg, hsl(0 0% 3% / 0.8) 0%, transparent 100%)" }} />

        <div className="max-w-7xl mx-auto px-6 w-full py-28 relative z-10">
          <div className="max-w-3xl space-y-8">
            {/* Tag */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ background: "hsl(0 0% 100% / 0.07)", border: "1px solid hsl(0 0% 100% / 0.12)", color: "hsl(0 0% 70%)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "hsl(142 71% 45%)" }} />
              🔥 {t("Stok Selalu Tersedia", "Always In Stock")}
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl xl:text-[3.6rem] font-bold leading-[1.07] tracking-tight text-white">
                {t("Pusat Jual Beli", "Buy & Sell Center")}<br />
                <span
                  className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(90deg, hsl(0 0% 100%), hsl(0 0% 70%))" }}
                >
                  {t("iPhone Resmi Surabaya.", "Official iPhone Surabaya.")}
                </span>
              </h1>
              <p className="text-base md:text-lg leading-relaxed max-w-xl text-white">
                {t(
                  "Unit bergaransi, IMEI terdaftar, kondisi transparan. Ribuan pelanggan sudah mempercayakan pembelian iPhone mereka ke Ivalora.",
                  "Warranted units, registered IMEI, transparent condition. Thousands of customers have trusted Ivalora for their iPhone purchases."
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="font-semibold rounded-xl gap-2 px-7 h-12"
                style={{ background: "hsl(0 0% 100%)", color: "hsl(0 0% 8%)" }}
                onClick={() => navigate("/katalog")}
              >
                {t("Lihat Katalog", "View Catalog")} <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                className="rounded-xl gap-2 px-7 h-12 font-medium"
                style={{ background: "hsl(0 0% 100% / 0.08)", border: "1px solid hsl(0 0% 100% / 0.15)", color: "hsl(0 0% 85%)" }}
                onClick={() => window.open("https://wa.me/6285890024760", "_blank")}
              >
                <MessageCircle className="w-4 h-4" /> {t("Konsultasi Gratis", "Free Consultation")}
              </Button>
            </div>

            {/* Stats — Large, prominent with animated counter */}
            <div className="flex items-center gap-6 sm:gap-10 pt-4">
              {[
                { target: 500, suffix: "+", label: t("Pelanggan Puas", "Happy Customers") },
                { target: 300, suffix: "+", label: t("Unit Terjual", "Units Sold") },
                { target: 4.9, suffix: "", label: t("Rating Toko", "Store Rating"), isDecimal: true },
              ].map((stat) => (
                <div key={stat.label} className="text-center sm:text-left">
                  <p className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">
                    {stat.isDecimal ? (
                      <span><span className="text-2xl sm:text-3xl" style={{ color: "hsl(45 93% 50%)" }}>★</span>4.9</span>
                    ) : (
                      <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                    )}
                  </p>
                  <p className="text-xs sm:text-sm mt-1.5 font-medium text-white">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          KENAPA IVALORA — 2-column interactive cards (MOVED UP)
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6" style={{ background: "hsl(0 0% 97%)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">{t("Kenapa Ivalora?", "Why Ivalora?")}</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              {t("Beli iPhone dengan Tenang,", "Buy iPhone with Peace of Mind,")}<br />
              <span style={{ color: "hsl(0 0% 45%)" }}>{t("Tanpa Tanda Tanya.", "No Questions Asked.")}</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-[2fr_3fr] gap-6 items-start">
            <div className="space-y-3">
              {UVP_CARDS.map((card, i) => (
                <button
                  key={card.title}
                  onClick={() => setActiveUvp(i)}
                  className="w-full text-left rounded-2xl p-5 border transition-all duration-200"
                  style={{
                    background: activeUvp === i ? "hsl(0 0% 8%)" : "hsl(0 0% 100%)",
                    borderColor: activeUvp === i ? "hsl(0 0% 8%)" : "hsl(214 32% 91%)",
                    boxShadow: activeUvp === i ? "0 8px 24px hsl(0 0% 0% / 0.15)" : "none",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-2xl leading-none mt-0.5">{card.emoji}</span>
                    <div>
                      <p className="font-semibold text-sm"
                        style={{ color: activeUvp === i ? "hsl(0 0% 100%)" : "hsl(0 0% 10%)" }}>
                        {lang === "en" ? card.titleEn : card.title}
                      </p>
                      <p className="text-xs mt-1 leading-relaxed"
                        style={{ color: activeUvp === i ? "hsl(0 0% 60%)" : "hsl(215 16% 47%)" }}>
                        {lang === "en" ? card.shortEn : card.short}
                      </p>
                      {activeUvp === i && (
                        <p className="text-xs mt-3 leading-relaxed" style={{ color: "hsl(0 0% 65%)" }}>
                          {lang === "en" ? card.descEn : card.desc}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div
              ref={uvpImgRef}
              className="rounded-2xl overflow-hidden sticky top-24 relative"
              style={{ aspectRatio: "16/10", background: "hsl(214 32% 91%)" }}
            >
              {UVP_CARDS.map((card, i) => (
                <img
                  key={card.title}
                  src={card.img}
                  alt={card.title}
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
                  style={{ opacity: activeUvp === i ? 1 : 0 }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          DISCOUNT SALE — Dark gradient header + white product area with auto-scroll
      ══════════════════════════════════════════════════════════════ */}
      {saleCampaignActive && saleCampaign && (() => {
        const saleAccent = saleCampaign.gradient_start || "hsl(142 71% 45%)";
        // Filter sale products: must match campaign items exactly (series+storage+warranty_type) AND have stock
        const saleProducts = products.filter(p => {
          // Must have stock
          const hasStock = stockPrices.some(sp => sp.product_id === p.id && sp.min_price !== null);
          if (!hasStock) return false;
          // Must match a campaign item by series + warranty_type
          return saleCampaignItems.some(sci =>
            p.catalog_series === sci.series && p.catalog_warranty_type === sci.warranty_type
          );
        });
        const displayProducts = saleProducts.length > 0 ? saleProducts : products.filter(p => stockPrices.some(sp => sp.product_id === p.id && sp.min_price !== null)).slice(0, 6);
        return (
          <section className="py-0">
            {/* Dark card header with accent gradient */}
            <div className="max-w-7xl mx-auto px-6 pt-8 pb-0">
              <div
                className="relative rounded-2xl overflow-hidden p-6 sm:p-8"
                style={{
                  background: `linear-gradient(135deg, #0a0a0a 0%, #141414 50%, #0a0a0a 100%)`,
                  border: `1px solid rgba(255,255,255,0.08)`,
                }}
              >
                {/* Ornament overlays */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.07]" style={{ background: `radial-gradient(circle, ${saleAccent}, transparent 70%)` }} />
                  <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.05]" style={{ background: `radial-gradient(circle, ${saleAccent}, transparent 70%)` }} />
                  <div className="absolute top-1/2 left-1/3 w-1 h-12 rotate-[30deg] opacity-10" style={{ background: saleAccent }} />
                  <div className="absolute top-1/4 right-1/4 w-1 h-16 -rotate-[20deg] opacity-[0.06]" style={{ background: saleAccent }} />
                  <div className="absolute top-4 right-40 text-[8px] opacity-20" style={{ color: saleAccent }}>✦</div>
                  <div className="absolute bottom-6 left-60 text-[10px] opacity-15" style={{ color: saleAccent }}>✦</div>
                  <div className="absolute top-8 left-1/2 text-[6px] opacity-10" style={{ color: saleAccent }}>★</div>
                </div>
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, ${saleAccent}, transparent)` }} />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider"
                        style={{ background: saleAccent, color: "#fff" }}>
                        <Tag className="w-3 h-3" /> DISCOUNT SALE
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white/70"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {t("Promo Terbatas", "Limited Promo")}
                      </span>
                    </div>
                    <p className="text-3xl md:text-4xl font-black leading-tight"
                      style={{ background: `linear-gradient(90deg, #fff, ${saleAccent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      {saleCampaign.campaign_name}
                    </p>
                    {saleCampaign.subtitle && (
                      <h2 className="text-xl md:text-2xl font-bold text-white/90">
                        {saleCampaign.subtitle.split(" ").map((word, i, arr) => 
                          i === arr.length - 1 ? <span key={i} style={{ color: saleAccent }}>{word}</span> : <span key={i}>{word} </span>
                        )}
                      </h2>
                    )}
                    <p className="text-sm text-white/40">
                      {t("Harga spesial berlaku selama masa kampanye", "Special prices valid during campaign")}
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <p className="text-xs uppercase tracking-widest text-white/50">{t("Berakhir dalam", "Ends in")}:</p>
                    <div className="flex items-center gap-2">
                      <CountdownBlock val={saleCd.d} label={t("Hari", "Day")} accent={saleAccent} />
                      <span className="text-2xl font-bold pb-4" style={{ color: saleAccent }}>:</span>
                      <CountdownBlock val={saleCd.h} label={t("Jam", "Hr")} accent={saleAccent} />
                      <span className="text-2xl font-bold pb-4" style={{ color: saleAccent }}>:</span>
                      <CountdownBlock val={saleCd.m} label={t("Menit", "Min")} accent={saleAccent} />
                      <span className="text-2xl font-bold pb-4" style={{ color: saleAccent }}>:</span>
                      <CountdownBlock val={saleCd.s} label={t("Detik", "Sec")} accent={saleAccent} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
           {/* Banner left + Products right layout — with accent overlay */}
            <div className="relative py-6" style={{ background: "hsl(0 0% 97%)" }}>
           {/* Accent radial overlay + animated particles */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: `radial-gradient(ellipse at 50% 40%, ${saleAccent}15 0%, transparent 70%)`,
              }} />
              <SaleParticles accent={saleAccent} />
              <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="flex gap-6">
           {/* Banner left — fixed 1080x1350 ratio (4:5), object-top */}
                  {saleCampaign.banner_urls && saleCampaign.banner_urls.length > 0 && (
                    <div className="hidden lg:block shrink-0 w-[280px] xl:w-[320px] rounded-2xl overflow-hidden border border-border cursor-pointer hover:shadow-lg transition-shadow"
                      style={{ aspectRatio: "1080/1350" }}
                      onClick={() => setBannerFullView(saleCampaign.banner_urls[bannerIdx])}>
                      <img
                        src={saleCampaign.banner_urls[bannerIdx]}
                        alt="Sale Banner"
                        className="w-full h-full object-cover object-top transition-opacity duration-500"
                      />
                    </div>
                  )}
                  {/* Products right — auto-scroll */}
                  <div className="flex-1 min-w-0">
                    <AutoScrollRow>
                      {displayProducts.map(p => (
                        <div key={p.id} className="min-w-[220px] max-w-[260px] shrink-0">
                          <ProductCard product={p} badgeLabel="DISCOUNT SALE" stockPrices={stockPrices} formatPrice={formatPrice} accentColor={saleAccent} saleCampaignItems={saleCampaignItems} />
                        </div>
                      ))}
                    </AutoScrollRow>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════
          FLASH SALE — Dark gradient header + white product cards with auto-scroll
      ══════════════════════════════════════════════════════════════ */}
      {flashSaleActive && (() => {
        const flashAccent = flashSale?.gradient_start || "hsl(38 92% 50%)";
        // Only show flash sale products that have stock
        const fsWithStock = flashSaleProducts.filter(p => stockPrices.some(sp => sp.product_id === p.id && sp.min_price !== null));
        const fsProducts = fsWithStock.length ? fsWithStock : highlight.length ? highlight : products.slice(0, 6);
        return (
          <section className="py-0">
            {/* Dark card header with accent gradient */}
            <div className="max-w-7xl mx-auto px-6 pt-8 pb-0">
              <div
                className="relative rounded-2xl overflow-hidden p-6 sm:p-8"
                style={{
                  background: `linear-gradient(135deg, #0a0a0a 0%, #141414 50%, #0a0a0a 100%)`,
                  border: `1px solid rgba(255,255,255,0.08)`,
                }}
              >
                {/* Ornament overlays */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.07]" style={{ background: `radial-gradient(circle, ${flashAccent}, transparent 70%)` }} />
                  <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.05]" style={{ background: `radial-gradient(circle, ${flashAccent}, transparent 70%)` }} />
                  <div className="absolute top-1/2 left-1/4 w-1 h-14 rotate-[25deg] opacity-10" style={{ background: flashAccent }} />
                  <div className="absolute top-1/3 right-1/3 w-1 h-10 -rotate-[15deg] opacity-[0.06]" style={{ background: flashAccent }} />
                  <div className="absolute top-3 right-32 text-[8px] opacity-20" style={{ color: flashAccent }}>✦</div>
                  <div className="absolute bottom-4 left-48 text-[10px] opacity-15" style={{ color: flashAccent }}>✦</div>
                  <div className="absolute top-6 left-2/3 text-[6px] opacity-10" style={{ color: flashAccent }}>★</div>
                </div>
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, ${flashAccent}, transparent)` }} />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider"
                        style={{ background: flashAccent, color: "#fff" }}>
                        <Zap className="w-3 h-3" /> Flash Sale
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white/70"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {t("Hari Ini Saja", "Today Only")}
                      </span>
                    </div>
                    {flashSale?.event_name && (
                      <p className="text-3xl md:text-4xl font-black leading-tight"
                        style={{ background: `linear-gradient(90deg, #fff, ${flashAccent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        {flashSale.event_name}
                      </p>
                    )}
                    <h2 className="text-xl md:text-2xl font-bold text-white/90">
                      {t("Penawaran Terbatas, ", "Limited Offer, ")}<span style={{ color: flashAccent }}>{t("Stok Cepat Habis.", "Selling Fast.")}</span>
                    </h2>
                    <p className="text-sm text-white/40">
                      {t(`Harga spesial berlaku selama ${flashSale?.duration_hours ?? 6} jam`, `Special prices valid for ${flashSale?.duration_hours ?? 6} hours`)}
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <p className="text-xs uppercase tracking-widest text-white/50">{t("Berakhir dalam", "Ends in")}:</p>
                    <div className="flex items-center gap-2">
                      <CountdownBlock val={flashD} label={t("Hari", "Day")} accent={flashAccent} />
                      <span className="text-2xl font-bold pb-4" style={{ color: flashAccent }}>:</span>
                      <CountdownBlock val={h} label={t("Jam", "Hr")} accent={flashAccent} />
                      <span className="text-2xl font-bold pb-4" style={{ color: flashAccent }}>:</span>
                      <CountdownBlock val={m} label={t("Menit", "Min")} accent={flashAccent} />
                      <span className="text-2xl font-bold pb-4" style={{ color: flashAccent }}>:</span>
                      <CountdownBlock val={s} label={t("Detik", "Sec")} accent={flashAccent} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Light product area with auto-scroll + accent overlay + particles */}
            <div className="relative py-6" style={{ background: "hsl(0 0% 97%)" }}>
              <div className="absolute inset-0 pointer-events-none" style={{
                background: `radial-gradient(ellipse at 50% 40%, ${flashAccent}15 0%, transparent 70%)`,
              }} />
              <SaleParticles accent={flashAccent} />
              <div className="max-w-7xl mx-auto px-6 relative z-10">
                <AutoScrollRow>
                  {fsProducts.map(p => (
                    <div key={p.id} className="min-w-[220px] max-w-[260px] shrink-0">
                      <ProductCard product={p} isFlashSale stockPrices={stockPrices} formatPrice={formatPrice} accentColor={flashAccent} />
                    </div>
                  ))}
                  {fsProducts.length === 0 && Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="min-w-[220px] max-w-[260px] shrink-0"><SkeletonCard /></div>
                  ))}
                </AutoScrollRow>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════
          KOLEKSI PILIHAN — (MOVED DOWN — after Flash Sale)
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">{t("Koleksi Pilihan", "Curated Collection")}</p>
            <h2 className="text-2xl font-bold">{t("iPhone Tersedia", "Available iPhones")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("Unit terpilih, kualitas terjamin, harga terbaik", "Hand-picked units, guaranteed quality, best prices")}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-2">
            {IPHONE_CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                onClick={() => navigate(`/katalog?search=${encodeURIComponent(cat.name)}`)}
                className="rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 15%)" }}
              >
                <div
                  className="relative h-52 flex items-center justify-center overflow-hidden"
                  style={{ background: "hsl(0 0% 10%)" }}
                >
                  <img
                    src={cat.img}
                    alt={cat.name}
                    className="h-40 w-auto object-contain group-hover:scale-105 transition-transform duration-500"
                    style={{ filter: "drop-shadow(0 8px 24px hsl(0 0% 0% / 0.5))" }}
                  />
                </div>
                <div style={{ height: 1, background: "hsl(0 0% 15%)" }} />
                <div className="px-4 py-3.5 text-center">
                  <p className="font-bold text-sm" style={{ color: "hsl(0 0% 92%)" }}>{cat.name}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: "hsl(0 0% 100%)" }}>
                    {categoryCounts[cat.name] ? `${categoryCounts[cat.name]} ${t("unit tersedia", "units available")}` : t("Lihat unit", "View units")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PRODUK UNGGULAN — Individual variants, in-stock only
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-8 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold">{t("Produk Unggulan", "Featured Products")}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t("Unit terbaik yang paling banyak diminati", "Best units most in demand")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/katalog")} className="gap-1.5 rounded-xl">
              {t("Semua Produk", "All Products")} <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-2">
            {!dataLoaded
              ? Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              : featuredVariants.length > 0
              ? featuredVariants.map((v) => (
                  <FeaturedVariantCard key={v.id} variant={v} formatPrice={formatPrice} />
                ))
              : (
                <div className="col-span-full text-center py-10">
                  <p className="text-sm text-muted-foreground">Belum ada produk unggulan tersedia saat ini.</p>
                </div>
              )
            }
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          MARKETPLACE
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">{t("Tersedia di", "Available On")}</p>
          <h2 className="text-2xl font-bold">{t("Official Marketplace Store", "Official Marketplace Store")}</h2>
          <p className="text-sm text-muted-foreground mt-2">{t("Belanja online dengan proteksi penuh dari platform terpercaya", "Shop online with full protection from trusted platforms")}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="border border-border rounded-2xl p-7 flex flex-col items-center gap-4 hover:shadow-md transition-shadow bg-card">
            <img src={logoShopee} alt="Shopee" className="h-10 object-contain" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" style={{ color: "hsl(var(--star))" }} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Rating 5.0 · Official Store</p>
            </div>
            <Button className="w-full rounded-xl gap-2"
              onClick={() => window.open("https://shopee.co.id/ivalora_gadget", "_blank")}>
              {t("Kunjungi Toko Shopee", "Visit Shopee Store")} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="border border-border rounded-2xl p-7 flex flex-col items-center gap-4 hover:shadow-md transition-shadow bg-card">
            <img src={logoTokopedia} alt="Tokopedia" className="h-10 object-contain" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" style={{ color: "hsl(var(--star))" }} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Rating 5.0 · Power Merchant</p>
            </div>
            <Button variant="outline" className="w-full rounded-xl gap-2"
              style={{ color: "hsl(142 71% 38%)", borderColor: "hsl(142 71% 38%)" }}
              onClick={() => window.open("https://www.tokopedia.com/ivalora", "_blank")}>
              {t("Kunjungi Toko Tokopedia", "Visit Tokopedia Store")} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TOKO FISIK
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6" style={{ background: "hsl(0 0% 97%)" }} id="tentang">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">{t("Toko Fisik", "Physical Store")}</p>
            <h2 className="text-3xl font-bold leading-tight">
              {t("Temui Kami Langsung. ", "Meet Us In Person. ")}
              <span style={{ color: "hsl(0 0% 45%)" }}>{t("Lihat, Coba, Baru Beli.", "See, Try, Then Buy.")}</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mt-3">
              {t(
                "Ingin melihat kondisi unit secara langsung sebelum memutuskan? Datangi toko kami — tim kami siap membantu tanpa tekanan.",
                "Want to see the unit's condition in person? Visit our store — our team is ready to help without pressure."
              )}
            </p>
          </div>

          <div className="grid lg:grid-cols-[2fr_3fr] gap-5 items-stretch">
            <div className="space-y-3">
              {branches.length === 0 && (
                <div className="text-sm text-muted-foreground py-8 text-center">{t("Memuat data cabang…", "Loading branches…")}</div>
              )}
              {branches.map((br, i) => (
                <button
                  key={br.id}
                  onClick={() => setActiveBranch(i)}
                  className="w-full text-left rounded-2xl p-5 transition-all duration-200 group"
                  style={{
                    background: "hsl(0 0% 100%)",
                    border: `1.5px solid ${activeBranch === i ? "hsl(0 0% 20%)" : "hsl(214 32% 88%)"}`,
                    boxShadow: activeBranch === i
                      ? "0 4px 20px hsl(0 0% 0% / 0.08)"
                      : "0 1px 3px hsl(0 0% 0% / 0.04)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: activeBranch === i ? "hsl(0 0% 8%)" : "hsl(0 0% 95%)" }}
                    >
                      <MapPin className="w-5 h-5" style={{ color: activeBranch === i ? "hsl(0 0% 90%)" : "hsl(0 0% 35%)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{br.name}</p>
                      <p className="text-xs mt-1 leading-relaxed text-muted-foreground">{br.full_address || "—"}</p>
                      <div className="mt-3 space-y-1.5">
                        {br.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="w-3.5 h-3.5 shrink-0" /> {br.phone}
                          </div>
                        )}
                        {br.google_maps_url && (
                          <a
                            href={br.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold"
                            style={{ color: "hsl(210 100% 50%)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ArrowRight className="w-3 h-3" /> {t("Buka di Google Maps", "Open in Google Maps")}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-2xl overflow-hidden relative"
              style={{ minHeight: 320, border: "1.5px solid hsl(214 32% 88%)" }}>
              {branches.map((br, i) => {
                const mapSrc = br.latitude && br.longitude
                  ? `https://maps.google.com/maps?q=${br.latitude},${br.longitude}&z=16&output=embed`
                  : br.google_maps_url
                    ? `https://maps.google.com/maps?q=${encodeURIComponent(br.full_address || br.name)}&z=16&output=embed`
                    : null;
                if (!mapSrc) return null;
                return (
                  <iframe
                    key={br.id}
                    title={br.name}
                    className="w-full h-full absolute inset-0 transition-opacity duration-500"
                    style={{ border: 0, opacity: activeBranch === i ? 1 : 0 }}
                    loading="lazy"
                    allowFullScreen
                    src={mapSrc}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">{t("Ulasan Pelanggan ✦", "Customer Reviews ✦")}</p>
            <h2 className="text-2xl font-bold">{t("Ulasan Ivalora Gadget", "Ivalora Gadget Reviews")}</h2>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">
                  {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)} of 5.0
                </span>
                <span className="text-sm text-muted-foreground">• {reviews.length} Ulasan</span>
              </div>
            )}
          </div>
          <Link to="/ulasan" className="text-sm text-primary hover:underline font-medium whitespace-nowrap">
            {t("Lihat Selengkapnya", "View All")}
          </Link>
        </div>
        {reviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">{t("Belum ada ulasan.", "No reviews yet.")}</p>
        ) : (
          <div className="relative">
            <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory">
              {reviews.slice(0, 9).map((r) => (
                <div key={r.id} className="min-w-[320px] max-w-[360px] border border-border rounded-2xl p-5 bg-card hover:shadow-md transition-shadow snap-start flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold overflow-hidden">
                      {r.reviewer_avatar_url ? (
                        <img src={r.reviewer_avatar_url} className="w-10 h-10 object-cover" />
                      ) : r.reviewer_name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.reviewer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-4">"{r.review_text}"</p>
                  {r.photo_urls && r.photo_urls.length > 0 && (
                    <div className="flex gap-1.5 mt-3">
                      {r.photo_urls.slice(0, 3).map((url, i) => (
                        <img key={i} src={url} className="w-14 h-14 rounded-lg object-cover border" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CTA
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 text-white" id="kontak"
        style={{ background: "linear-gradient(135deg, hsl(0 0% 7%) 0%, hsl(220 20% 10%) 100%)" }}>
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "hsl(0 0% 40%)" }}>{t("Hubungi Kami", "Contact Us")}</p>
          <h2 className="text-3xl md:text-4xl font-bold">{t("Ada yang Ingin", "Have a")}<br />{t("Ditanyakan?", "Question?")}</h2>
          <p className="text-base leading-relaxed" style={{ color: "hsl(0 0% 55%)" }}>
            {t(
              "Tim kami aktif setiap hari dan siap membantu Anda menemukan iPhone yang paling sesuai — berdasarkan budget, kondisi, dan kebutuhan nyata Anda.",
              "Our team is active every day and ready to help you find the perfect iPhone — based on your budget, condition preference, and real needs."
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" className="rounded-xl gap-2 font-semibold"
              style={{ background: "hsl(142 71% 40%)", color: "hsl(0 0% 100%)" }}
              onClick={() => window.open("https://wa.me/6285890024760", "_blank")}>
              <MessageCircle className="w-4 h-4" /> Chat via WhatsApp
            </Button>
            <Button size="lg" className="rounded-xl gap-2"
              style={{ background: "hsl(0 0% 100% / 0.08)", border: "1px solid hsl(0 0% 100% / 0.12)", color: "hsl(0 0% 80%)" }}
              onClick={() => navigate("/katalog")}>
              <ShoppingBag className="w-4 h-4" /> {t("Lihat Katalog", "View Catalog")}
            </Button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer className="bg-background border-t border-border py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div className="md:col-span-1 space-y-4">
              <img src={logoHorizontal} alt="Ivalora Gadget" className="h-7" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(
                  "Pusat jual beli iPhone terpercaya di Surabaya. Unit bergaransi, IMEI bersih, harga kompetitif.",
                  "Trusted iPhone buy & sell center in Surabaya. Warranted units, clean IMEI, competitive prices."
                )}
              </p>
              <div className="flex items-center gap-3">
                <a href="https://instagram.com/ivalora_gadget" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-foreground/5 hover:bg-foreground hover:text-background flex items-center justify-center transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="https://www.tiktok.com/@ivalora_gadget" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-foreground/5 hover:bg-foreground hover:text-background flex items-center justify-center transition-colors"
                  title="TikTok">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.11v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.2 6.34 6.34 0 0 0 9.49 21.54a6.34 6.34 0 0 0 6.34-6.34V8.72a8.16 8.16 0 0 0 3.76.92V6.69Z"/></svg>
                </a>
                <a href="https://chat.whatsapp.com/FJrLaNwX2jZCMn4hGMWTUW" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-foreground/5 hover:bg-foreground hover:text-background flex items-center justify-center transition-colors"
                  title="WA Community">
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">{t("Navigasi", "Navigation")}</h4>
              {[
                { label: t("Beranda", "Home"), href: "/" },
                { label: t("Katalog Produk", "Product Catalog"), href: "/katalog" },
              ].map((l) => (
                <div key={l.label}>
                  <Link to={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Customer Service</h4>
              <p className="text-sm text-muted-foreground">0858-9002-4760</p>
              <p className="text-sm text-muted-foreground">{t("Senin – Sabtu, 09.00 – 20.00 WIB", "Mon – Sat, 09:00 – 20:00 WIB")}</p>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Marketplace</h4>
              <a href="https://shopee.co.id/ivalora_gadget" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <img src={logoShopee} alt="Shopee" className="h-5 w-auto" />
                Shopee
              </a>
              <a href="https://www.tokopedia.com/ivalora" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <img src={logoTokopedia} alt="Tokopedia" className="h-4 w-auto" />
                Tokopedia
              </a>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© 2026 Ivalora Gadget. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Surabaya, Jawa Timur, Indonesia</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Featured Variant Card (individual master product) ────────────────────────
const WARRANTY_SHORT_MAP: Record<string, string> = {
  resmi_bc: "Resmi BC",
  ibox: "Resmi iBox",
  inter: "Inter",
  whitelist: "Whitelist",
  digimap: "Digimap",
};

function FeaturedVariantCard({
  variant,
  formatPrice,
}: {
  variant: FeaturedVariant;
  formatPrice: (n: number | null | undefined) => string;
}) {
  const navigate = useNavigate();
  const href = variant.catalogSlug ? `/produk/${variant.catalogSlug}` : "#";
  const label = `${variant.series} ${variant.storage_gb}GB ${variant.color}`;

  return (
    <div
      onClick={() => navigate(href)}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all group flex flex-col cursor-pointer"
    >
      {/* Image — same aspect-square as ShopPage cards */}
      <div className="relative aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
        {variant.catalogThumbnail ? (
          <img
            src={variant.catalogThumbnail}
            alt={label}
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/30">
            <ShoppingBag className="w-8 h-8" />
            <span className="text-[10px]">Belum ada foto</span>
          </div>
        )}
      </div>
      <div className="p-4 space-y-1.5 flex-1 flex flex-col">
        <span className="inline-flex items-center self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
          {variant.warranty_type ? (WARRANTY_SHORT_MAP[variant.warranty_type] ?? variant.warranty_type) : ""}
        </span>
        <p className="text-[15px] font-semibold text-foreground line-clamp-2 leading-snug">{label}</p>
        <div className="mt-auto pt-1">
          <p className="text-lg font-bold text-foreground">{formatPrice(variant.price)}</p>
          <p className="text-sm text-foreground">{variant.stock} unit tersedia</p>
        </div>
        <Button
          size="sm"
          className="w-full rounded-xl text-xs mt-1"
          onClick={(e) => { e.stopPropagation(); navigate(href); }}
        >
          Lihat Detail
        </Button>
      </div>
    </div>
  );
}

// ─── Auto Scroll Row ──────────────────────────────────────────────────────────
function AutoScrollRow({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const interval = setInterval(() => {
      if (isPaused) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 2) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: 2, behavior: "auto" });
      }
    }, 30);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
    >
      {children}
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({
  product,
  isFlashSale,
  badgeLabel,
  stockPrices,
  formatPrice,
  accentColor,
  saleCampaignItems,
  darkMode,
}: {
  product: Product;
  isFlashSale?: boolean;
  badgeLabel?: string;
  stockPrices: StockPriceInfo[];
  formatPrice: (n: number | null | undefined) => string;
  accentColor?: string;
  saleCampaignItems?: SaleCampaignItem[];
  darkMode?: boolean;
}) {
  const navigate = useNavigate();
  const href = product.slug ? `/produk/${product.slug}` : "#";

  const stockInfo = stockPrices.find((s) => s.product_id === product.id);
  const displayPrice = product.override_display_price ?? stockInfo?.min_price ?? null;

  // Calculate discount from campaign items or flash sale
  let discountPct = 0;
  let discountedPrice = displayPrice;
  let originalPrice = displayPrice;
  
  if (saleCampaignItems && saleCampaignItems.length > 0 && displayPrice) {
    const matchItem = saleCampaignItems.find(sci => product.catalog_series === sci.series && product.catalog_warranty_type === sci.warranty_type);
    if (matchItem) {
      originalPrice = displayPrice;
      if (matchItem.discount_type === "percentage") {
        discountPct = matchItem.discount_value;
        discountedPrice = Math.round(displayPrice * (1 - matchItem.discount_value / 100));
      } else {
        discountedPrice = displayPrice - matchItem.discount_value;
        discountPct = Math.round((matchItem.discount_value / displayPrice) * 100);
      }
    }
  } else if (isFlashSale && displayPrice) {
    originalPrice = Math.round(displayPrice * 1.18);
    discountedPrice = displayPrice;
    discountPct = Math.round(((originalPrice - displayPrice) / originalPrice) * 100);
  }

  const showDiscount = discountPct > 0 && discountedPrice && originalPrice && discountedPrice !== originalPrice;

  const label = badgeLabel || (isFlashSale ? "FLASH SALE" : null);
  const labelIcon = isFlashSale && !badgeLabel ? <Zap className="w-3 h-3" /> : <Tag className="w-3 h-3" />;

  const cardBg = darkMode ? "hsl(0 0% 10%)" : undefined;
  const cardBorder = darkMode ? "hsl(0 0% 18%)" : undefined;
  const textColor = darkMode ? "hsl(0 0% 92%)" : undefined;
  const mutedColor = darkMode ? "hsl(0 0% 55%)" : undefined;

  return (
    <div
      onClick={() => navigate(href)}
      className={`rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group h-full flex flex-col ${!darkMode ? 'bg-card border border-border' : ''}`}
      style={darkMode ? { background: cardBg, border: `1px solid ${cardBorder}` } : undefined}
    >
      <div className="relative aspect-square flex items-center justify-center overflow-hidden"
        style={{ background: darkMode ? "hsl(0 0% 8%)" : "hsl(0 0% 95%)" }}>
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt={product.display_name}
            className="h-full w-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: darkMode ? "hsl(0 0% 15%)" : "hsl(0 0% 90%)" }}>
            <ShoppingBag className="w-7 h-7" style={{ color: mutedColor || "hsl(0 0% 60%)" }} />
          </div>
        )}
        {label && (
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg flex items-center gap-1"
            style={{ background: accentColor || "hsl(38 92% 50%)", color: "hsl(0 0% 100%)" }}>
            {labelIcon} {label}
          </span>
        )}
        {product.free_shipping && (
          <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: "hsl(142 71% 45%)", color: "hsl(0 0% 100%)" }}>
            FREE ONGKIR
          </span>
        )}
      </div>

      <div className="p-3.5 space-y-1.5 flex-1 flex flex-col">
        {product.catalog_warranty_type && (
          <span className="inline-flex items-center self-start px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
            style={darkMode 
              ? { background: `${accentColor || 'hsl(38 92% 50%)'}22`, color: accentColor || 'hsl(38 92% 50%)', border: `1px solid ${accentColor || 'hsl(38 92% 50%)'}33` }
              : { background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.2)' }
            }>
            {WARRANTY_SHORT_MAP[product.catalog_warranty_type as string] ?? product.catalog_warranty_type}
          </span>
        )}
        <p className="text-sm font-semibold line-clamp-2 leading-snug" style={{ color: textColor }}>
          {product.display_name}
        </p>
        {product.rating_score !== null && product.rating_score !== undefined && (
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" style={{ color: "hsl(45 93% 47%)" }} />
            <span className="text-xs" style={{ color: mutedColor }}>{product.rating_score.toFixed(1)}</span>
          </div>
        )}
        <div className="mt-auto pt-1.5">
          {displayPrice ? (
            showDiscount ? (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs line-through" style={{ color: mutedColor || "hsl(0 0% 55%)" }}>
                    {formatPrice(originalPrice)}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "hsl(0 72% 50% / 0.15)", color: "hsl(0 72% 50%)" }}>
                    -{discountPct}%
                  </span>
                </div>
                <p className="text-base font-bold" style={{ color: "hsl(0 72% 50%)" }}>
                  {formatPrice(discountedPrice)}
                </p>
              </>
            ) : (
              <p className="text-base font-bold" style={{ color: textColor }}>
                {formatPrice(displayPrice)}
              </p>
            )
          ) : (
            <p className="text-xs font-semibold italic" style={{ color: mutedColor }}>Cek Harga →</p>
          )}
        </div>
        <Button size="sm" className="w-full rounded-xl text-xs mt-1 h-8"
          style={darkMode 
            ? { background: "hsl(0 0% 100%)", color: "hsl(0 0% 8%)" }
            : { background: "hsl(0 0% 8%)", color: "hsl(0 0% 100%)" }
          }
          onClick={(e) => { e.stopPropagation(); navigate(href); }}>
          Lihat Detail
        </Button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card animate-pulse">
      <div className="bg-secondary/50 h-44" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-secondary rounded-lg w-1/2" />
        <div className="h-4 bg-secondary rounded-lg w-3/4" />
        <div className="h-5 bg-secondary rounded-lg w-1/2" />
        <div className="h-9 bg-secondary rounded-xl" />
      </div>
    </div>
  );
}
