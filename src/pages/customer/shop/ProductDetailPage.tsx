import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import {
  ChevronRight, Shield, CheckCircle2, Truck, MessageCircle,
  Share2, Package, Star, ExternalLink,
  ImageOff, BadgeCheck, Zap, Clock, ShoppingCart, AlertCircle, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/shared/LocaleContext";
import { addToCart, type CartItem } from "@/pages/customer/shop/CartPage";
import { useToast } from "@/hooks/shared/use-toast";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MasterProduct {
  id: string;
  series: string;
  storage_gb: number;
  color: string;
  category: string;
  warranty_type: string;
}

interface CatalogProduct {
  id: string;
  product_id: string;
  slug: string | null;
  display_name: string;
  short_description: string | null;
  full_description: string | null;
  thumbnail_url: string | null;
  gallery_urls: string[];
  catalog_status: string;
  publish_to_pos: boolean;
  publish_to_web: boolean;
  publish_to_marketplace: boolean;
  tokopedia_url: string | null;
  shopee_url: string | null;
  highlight_product: boolean;
  show_condition_breakdown: boolean;
  promo_label: string | null;
  promo_badge: string | null;
  free_shipping: boolean;
  is_flash_sale: boolean;
  flash_sale_discount_type: string | null;
  flash_sale_discount_value: number | null;
  discount_active: boolean;
  discount_type: string | null;
  discount_value: number | null;
  discount_start_at: string | null;
  discount_end_at: string | null;
  bonus_items: BonusItem[];
  master_products: MasterProduct;
  spec_condition: string | null;
  spec_brand: string | null;
  spec_warranty_duration: string | null;
  spec_screen_protector_type: string | null;
  spec_case_type: string | null;
  spec_custom_product: string | null;
  spec_built_in_battery: string | null;
  spec_condition_detail: string | null;
  spec_cable_type: string | null;
  spec_phone_model: string | null;
  spec_postel_cert: string | null;
  spec_shipped_from: string | null;
  rating_score: number;
  rating_count: number;
  branch_id: string | null;
}

interface DistPhoto {
  distribution: string;
  color: string | null;
  photo_type: "cover" | "color";
  photo_url: string;
  sort_order: number;
}

interface StockUnit {
  id: string;
  imei: string;
  condition_status: "no_minus" | "minus";
  minus_severity: string | null;
  minus_description: string | null;
  selling_price: number | null;
  stock_status: string;
  product_id: string;
  unit_photo_url: string | null;
  unit_photo_urls: string[];
  master_products: { series: string; storage_gb: number; color: string; warranty_type: string } | null;
}

interface BonusItem {
  name: string;
  description: string;
}

const WARRANTY_LABELS: Record<string, string> = {
  resmi_bc: "Resmi BC (Bea Cukai)",
  ibox: "Resmi iBox Indonesia",
  inter: "Inter (Internasional)",
  whitelist: "Whitelist Terdaftar",
  digimap: "Resmi Digimap Indonesia",
};

const WARRANTY_BADGE_COLORS: Record<string, string> = {
  resmi_bc: "#007AFF",
  ibox: "#34C759",
  inter: "#FF9500",
  whitelist: "#5856D6",
  digimap: "#FF2D55",
};

const WARRANTY_SHORT: Record<string, string> = {
  resmi_bc: "Resmi BC",
  ibox: "Resmi iBox",
  inter: "Inter",
  whitelist: "Whitelist",
  digimap: "Digimap",
};

const WARRANTY_FRIENDLY: Record<string, string> = {
  resmi_bc: "Tipe Resmi Bea Cukai",
  ibox: "Tipe Resmi iBox Indonesia",
  inter: "Tipe Internasional",
  whitelist: "Tipe Whitelist Terdaftar",
  digimap: "Tipe Resmi Digimap",
};

const USD_RATE = 15500;

function useFormatPrice() {
  const { currency } = useLocale();
  return (n: number | null | undefined) => {
    if (!n) return "\u2014";
    if (currency === "USD") {
      const usd = n / USD_RATE;
      return "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return "Rp" + n.toLocaleString("id-ID");
  };
}

function storageLabel(gb: number) {
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

function SpecRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2.5 pr-4 text-sm text-muted-foreground w-[45%] align-top">{label}</td>
      <td className="py-2.5 text-sm font-medium text-foreground align-top">{value}</td>
    </tr>
  );
}

function StarRating({ score, count }: { score: number; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={cn("w-4 h-4", i <= Math.round(score) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
        ))}
      </div>
      <span className="text-sm font-bold text-foreground">{score.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">dari 5 ({count} ulasan)</span>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap text-center",
        active
          ? "border-foreground text-foreground font-semibold"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function censorImei(imei: string): string {
  if (imei.length <= 6) return imei;
  return imei.slice(0, 3) + "****" + imei.slice(-3);
}

// ── Sale Campaign Item type ───────────────────────────────────────────────────
interface SaleCampaignItemInfo {
  series: string;
  storage_gb: number;
  warranty_type: string;
  discount_type: string;
  discount_value: number;
}

// ── Discount helpers ──────────────────────────────────────────────────────────
function calcSaleCampaignDiscount(
  originalPrice: number,
  unit: { series: string; storage_gb: number; warranty_type: string },
  saleCampaignItems: SaleCampaignItemInfo[],
): { finalPrice: number; discountLabel: string; hasDiscount: boolean; saleType: "sale_campaign" | null } {
  const match = saleCampaignItems.find(sci =>
    sci.series.toLowerCase() === unit.series.toLowerCase() &&
    sci.storage_gb === unit.storage_gb &&
    sci.warranty_type === unit.warranty_type
  );
  if (match && match.discount_value > 0) {
    const finalPrice = match.discount_type === "percentage"
      ? Math.round(originalPrice * (1 - match.discount_value / 100))
      : Math.max(0, originalPrice - match.discount_value);
    const discountLabel = match.discount_type === "percentage"
      ? `-${match.discount_value}%`
      : `-Rp${match.discount_value.toLocaleString("id-ID")}`;
    return { finalPrice, discountLabel, hasDiscount: finalPrice < originalPrice, saleType: "sale_campaign" };
  }
  return { finalPrice: originalPrice, discountLabel: "", hasDiscount: false, saleType: null };
}

function calcDiscountedPrice(
  originalPrice: number,
  catalog: CatalogProduct,
  flashSaleSettings: { is_active: boolean; start_time: string; duration_hours: number } | null,
  saleCampaignItems?: SaleCampaignItemInfo[],
  unitMaster?: { series: string; storage_gb: number; warranty_type: string },
): { finalPrice: number; discountLabel: string; hasDiscount: boolean; saleType: "flash_sale" | "catalog_discount" | "sale_campaign" | null } {
  const now = Date.now();
  // 1. Flash sale (highest priority)
  if (catalog.is_flash_sale && flashSaleSettings?.is_active) {
    const start = new Date(flashSaleSettings.start_time);
    const end = new Date(start.getTime() + flashSaleSettings.duration_hours * 3600000);
    if (start.getTime() <= now && end.getTime() > now) {
      const fsType = catalog.flash_sale_discount_type || catalog.discount_type || "percentage";
      const fsValue = catalog.flash_sale_discount_value ?? catalog.discount_value ?? 0;
      if (fsValue > 0) {
        const finalPrice = fsType === "percentage"
          ? Math.round(originalPrice * (1 - fsValue / 100))
          : Math.max(0, originalPrice - fsValue);
        const discountLabel = fsType === "percentage" ? `-${fsValue}%` : `-Rp${fsValue.toLocaleString("id-ID")}`;
        return { finalPrice, discountLabel, hasDiscount: finalPrice < originalPrice, saleType: "flash_sale" };
      }
    }
  }
  // 2. Sale campaign discount (check unit-level match)
  if (saleCampaignItems && saleCampaignItems.length > 0 && unitMaster) {
    const saleDisc = calcSaleCampaignDiscount(originalPrice, unitMaster, saleCampaignItems);
    if (saleDisc.hasDiscount) return { ...saleDisc, saleType: "sale_campaign" };
  }
  // 3. Catalog-level discount
  const hasDiscount = catalog.discount_active && catalog.discount_value != null && catalog.discount_value > 0
    && (!catalog.discount_start_at || new Date(catalog.discount_start_at).getTime() <= now)
    && (!catalog.discount_end_at || new Date(catalog.discount_end_at).getTime() > now);
  if (hasDiscount) {
    const finalPrice = catalog.discount_type === "percentage"
      ? Math.round(originalPrice * (1 - catalog.discount_value! / 100))
      : Math.max(0, originalPrice - catalog.discount_value!);
    const discountLabel = catalog.discount_type === "percentage"
      ? `-${catalog.discount_value}%`
      : `-Rp${catalog.discount_value!.toLocaleString("id-ID")}`;
    return { finalPrice, discountLabel, hasDiscount: finalPrice < originalPrice, saleType: "catalog_discount" };
  }
  return { finalPrice: originalPrice, discountLabel: "", hasDiscount: false, saleType: null };
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const formatRupiah = useFormatPrice();
  const { toast } = useToast();

  const [catalog, setCatalog] = useState<CatalogProduct | null>(null);
  // All sibling catalogs with same series + warranty_type
  const [siblingCatalogs, setSiblingCatalogs] = useState<CatalogProduct[]>([]);
  // Units for ALL sibling product_ids
  const [allUnits, setAllUnits] = useState<StockUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"detail" | "kondisi" | "rating" | "garansi" | "pengiriman">("detail");
  const [flashSaleSettings, setFlashSaleSettings] = useState<{ is_active: boolean; start_time: string; duration_hours: number } | null>(null);
  const [showFlashSalePopup, setShowFlashSalePopup] = useState(false);
  const [showPricePickerPopup, setShowPricePickerPopup] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [countdownStr, setCountdownStr] = useState("");

  // User-selected filters (state-based, no navigation)
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedStorage, setSelectedStorage] = useState<number>(0);
  const [selectedWarrantyType, setSelectedWarrantyType] = useState<string>("");

  // All warranty siblings for warranty dropdown (different warranty_type)
  const [otherWarrantySlugs, setOtherWarrantySlugs] = useState<{ warrantyType: string; slug: string }[]>([]);
  // Sale campaign items for discount calculation
  const [saleCampaignItems, setSaleCampaignItems] = useState<SaleCampaignItemInfo[]>([]);
  const [saleCampaignName, setSaleCampaignName] = useState<string | null>(null);
  // All catalogs cache for warranty switching without navigation
  const [allCatalogsCache, setAllCatalogsCache] = useState<CatalogProduct[]>([]);
  // All master products for series (to derive all color/storage options)
  const [allMasterProducts, setAllMasterProducts] = useState<MasterProduct[]>([]);
  // Distribution photos (per distribusi × warna)
  const [distPhotos, setDistPhotos] = useState<DistPhoto[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // 1. Load the clicked catalog product
      const { data } = await db.from("catalog_products")
        .select("*, master_products(*)")
        .eq("slug", slug)
        .eq("catalog_status", "published")
        .single();

      if (!data) { setNotFound(true); setLoading(false); return; }

      // Fetch distribution photos for this catalog product
      const { data: dpData } = await db.from("catalog_distribution_photos")
        .select("*")
        .eq("catalog_product_id", data.id)
        .order("sort_order");
      setDistPhotos(dpData ?? []);

      const rawBonus = data.bonus_items;
      const bonusItems: BonusItem[] = Array.isArray(rawBonus) ? rawBonus : [];
      const mainCatalog: CatalogProduct = { ...data, bonus_items: bonusItems };
      setCatalog(mainCatalog);
      setActiveImg(data.thumbnail_url);
      // Initial selections will be overridden after stock loads to prefer in-stock variant
      const initialColor = data.master_products.color;
      const initialStorage = data.master_products.storage_gb;
      const initialWt = data.master_products.warranty_type;
      setSelectedColor(initialColor);
      setSelectedStorage(initialStorage);
      setSelectedWarrantyType(initialWt);

      // 2. Load ALL published catalogs for same series
      const { data: allCatalogs } = await db.from("catalog_products")
        .select("*, master_products(*)")
        .eq("catalog_status", "published");

      const series = data.master_products.series;
      const wt = data.master_products.warranty_type;
      const allForSeries = (allCatalogs ?? []).filter((c: CatalogProduct) =>
        c.master_products?.series === series
      ).map((c: CatalogProduct) => ({
        ...c,
        bonus_items: Array.isArray(c.bonus_items) ? c.bonus_items : [],
      }));
      setAllCatalogsCache(allForSeries);
      
      const siblings = allForSeries.filter((c: CatalogProduct) =>
        c.master_products?.warranty_type === wt
      );
      setSiblingCatalogs(siblings);

      // Other warranty type slugs for warranty dropdown
      const otherWt = allForSeries.filter((c: CatalogProduct) =>
        c.master_products?.warranty_type !== wt
      );
      const wtMap = new Map<string, string>();
      for (const c of otherWt) {
        if (!wtMap.has(c.master_products.warranty_type) && c.slug) {
          wtMap.set(c.master_products.warranty_type, c.slug);
        }
      }
      setOtherWarrantySlugs(Array.from(wtMap.entries()).map(([warrantyType, slug]) => ({ warrantyType, slug })));

      // 2b. Load ALL master_products for this series (regardless of catalog entry)
      const { data: allMasters } = await db.from("master_products")
        .select("id, series, storage_gb, color, category, warranty_type")
        .eq("series", series)
        .eq("is_active", true)
        .is("deleted_at", null);
      setAllMasterProducts(allMasters ?? []);

      // 3. Load units for ALL master product_ids of this series (not just catalog ones)
      const allMasterIds = (allMasters ?? []).map((m: MasterProduct) => m.id);
      const allCatalogIds = allForSeries.map((s: CatalogProduct) => s.product_id);
      const allProductIds = Array.from(new Set([...allMasterIds, ...allCatalogIds]));
      const { data: stockData } = await db.from("stock_units")
        .select("id, imei, condition_status, minus_severity, minus_description, selling_price, stock_status, product_id, unit_photo_url, unit_photo_urls, master_products(series, storage_gb, color, warranty_type)")
        .in("product_id", allProductIds)
        .eq("stock_status", "available")
        .order("selling_price", { ascending: true });
      setAllUnits(stockData ?? []);
      const units: StockUnit[] = stockData ?? [];

      // Auto-select an in-stock variant if the initial one has no stock
      const initialMaster = (allMasters ?? []).find((m: MasterProduct) => m.warranty_type === initialWt && m.color === initialColor && m.storage_gb === initialStorage);
      const initialHasStock = initialMaster ? units.some(u => u.product_id === initialMaster.id) : false;
      if (!initialHasStock && units.length > 0) {
        // Find first unit with stock and pick its variant
        const firstUnit = units[0];
        const firstMaster = (allMasters ?? []).find((m: MasterProduct) => m.id === firstUnit.product_id);
        if (firstMaster) {
          setSelectedColor(firstMaster.color);
          setSelectedStorage(firstMaster.storage_gb);
          setSelectedWarrantyType(firstMaster.warranty_type);
          // Update image
          const matchCat = allForSeries.find((c: CatalogProduct) => c.product_id === firstMaster.id);
          if (matchCat?.thumbnail_url) setActiveImg(matchCat.thumbnail_url);
        }
      }

      // 4. Flash sale settings via RPC (bypasses RLS for public access)
      const hasAnyFlashSale = siblings.some((s: CatalogProduct) => s.is_flash_sale) || allForSeries.some((s: CatalogProduct) => s.is_flash_sale);
      if (hasAnyFlashSale) {
        const { data: fsRows } = await supabase.rpc("get_active_flash_sale_info") as { data: any[] | null };
        if (fsRows && fsRows.length > 0) {
          const fs = fsRows[0];
          setFlashSaleSettings({ is_active: fs.is_active, start_time: fs.start_time, duration_hours: fs.duration_hours });
        }
      }

      // 5. Fetch active sale campaign items
      const { data: scData } = await db.from("sale_campaigns").select("id, campaign_name, is_active, start_time, end_time").eq("is_active", true).limit(1).single();
      if (scData) {
        const scNow = Date.now();
        if (new Date(scData.start_time).getTime() <= scNow && new Date(scData.end_time).getTime() > scNow) {
          setSaleCampaignName(scData.campaign_name);
          const { data: sciData } = await db.from("sale_campaign_items").select("series, storage_gb, warranty_type, discount_type, discount_value").eq("campaign_id", scData.id);
          if (sciData) setSaleCampaignItems(sciData as SaleCampaignItemInfo[]);
        }
      }

      setLoading(false);
    }
    if (slug) fetchData();
  }, [slug]);

  // Countdown timer
  useEffect(() => {
    if (!catalog) return;
    let endAt: string | null = null;
    if (catalog.is_flash_sale && flashSaleSettings?.is_active) {
      const start = new Date(flashSaleSettings.start_time);
      const end = new Date(start.getTime() + flashSaleSettings.duration_hours * 3600000);
      if (end.getTime() > Date.now()) endAt = end.toISOString();
    }
    if (!endAt && catalog.discount_end_at && catalog.discount_active) {
      endAt = catalog.discount_end_at;
    }
    if (!endAt) { setCountdownStr(""); return; }
    const endAtFinal = endAt;
    function tick() {
      const diff = new Date(endAtFinal).getTime() - Date.now();
      if (diff <= 0) { setCountdownStr("Berakhir"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdownStr(`${h}j ${m}m ${s}d`);
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [catalog, flashSaleSettings]);

  // Derive siblings from selected warranty type (instant switch, no navigation)
  const currentSiblings = useMemo(() => {
    if (!selectedWarrantyType || allCatalogsCache.length === 0) return siblingCatalogs;
    return allCatalogsCache.filter(c => c.master_products.warranty_type === selectedWarrantyType);
  }, [allCatalogsCache, selectedWarrantyType, siblingCatalogs]);

  // Derive all available colors and storages from master_products for this warranty type
  const allColors = useMemo(() => {
    const mastersForWt = allMasterProducts.filter(m => m.warranty_type === selectedWarrantyType);
    if (mastersForWt.length === 0) return Array.from(new Set(currentSiblings.map(s => s.master_products.color)));
    return Array.from(new Set(mastersForWt.map(m => m.color)));
  }, [allMasterProducts, selectedWarrantyType, currentSiblings]);

  const allStorages = useMemo(() => {
    const mastersForWt = allMasterProducts.filter(m => m.warranty_type === selectedWarrantyType);
    if (mastersForWt.length === 0) return Array.from(new Set(currentSiblings.map(s => s.master_products.storage_gb))).sort((a, b) => a - b);
    return Array.from(new Set(mastersForWt.map(m => m.storage_gb))).sort((a, b) => a - b);
  }, [allMasterProducts, selectedWarrantyType, currentSiblings]);

  // Find the catalog matching current selected color + storage
  const activeCatalog = useMemo(() => {
    return currentSiblings.find(s =>
      s.master_products.color === selectedColor && s.master_products.storage_gb === selectedStorage
    ) ?? currentSiblings[0] ?? catalog;
  }, [currentSiblings, selectedColor, selectedStorage, catalog]);

  // Units for the currently selected variant (for pricing) — filtered by color+storage
  const activeUnits = useMemo(() => {
    const masterMatch = allMasterProducts.find(m =>
      m.warranty_type === selectedWarrantyType && m.color === selectedColor && m.storage_gb === selectedStorage
    );
    if (masterMatch) {
      return allUnits.filter(u => u.product_id === masterMatch.id);
    }
    if (!activeCatalog) return [];
    return allUnits.filter(u => u.product_id === activeCatalog.product_id);
  }, [allUnits, activeCatalog, allMasterProducts, selectedWarrantyType, selectedColor, selectedStorage]);

  // ALL units for this series+warranty (shown in Daftar Unit tab, unaffected by color/storage filter)
  const allWarrantyUnits = useMemo(() => {
    const masterIds = allMasterProducts
      .filter(m => m.warranty_type === selectedWarrantyType)
      .map(m => m.id);
    return allUnits.filter(u => masterIds.includes(u.product_id));
  }, [allUnits, allMasterProducts, selectedWarrantyType]);

  // Units filtered by selected color + storage (for Daftar Unit tab)
  const filteredUnits = useMemo(() => {
    return allWarrantyUnits.filter(u => {
      if (selectedColor && u.master_products?.color !== selectedColor) return false;
      if (selectedStorage && u.master_products?.storage_gb !== selectedStorage) return false;
      return true;
    });
  }, [allWarrantyUnits, selectedColor, selectedStorage]);

  // Check if a specific color+storage combination has stock
  const hasStockFor = (color: string, storage: number) => {
    const masterMatch = allMasterProducts.find(m =>
      m.warranty_type === selectedWarrantyType && m.color === color && m.storage_gb === storage
    );
    if (masterMatch) return allUnits.some(u => u.product_id === masterMatch.id);
    const cat = currentSiblings.find(s => s.master_products.color === color && s.master_products.storage_gb === storage);
    if (!cat) return false;
    return allUnits.some(u => u.product_id === cat.product_id);
  };

  // Check if a specific color+storage combination exists (master or catalog)
  const hasCatalogFor = (color: string, storage: number) => {
    const hasMaster = allMasterProducts.some(m =>
      m.warranty_type === selectedWarrantyType && m.color === color && m.storage_gb === storage
    );
    if (hasMaster) return true;
    return currentSiblings.some(s => s.master_products.color === color && s.master_products.storage_gb === storage);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavbar />
        <div className="pt-8">
          <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse space-y-6">
            <div className="h-4 bg-muted rounded w-64" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] gap-8">
              <div className="aspect-square bg-muted rounded-2xl" />
              <div className="space-y-4">
                <div className="h-6 bg-muted rounded w-48" />
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-10 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !catalog || !activeCatalog) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavbar />
        <div className="pt-8 flex flex-col items-center justify-center min-h-[80vh] gap-4 text-center px-4">
          <Package className="w-16 h-16 text-muted-foreground/30" />
          <h1 className="text-2xl font-bold text-foreground">Produk tidak ditemukan</h1>
          <p className="text-muted-foreground max-w-sm">Produk ini mungkin sudah tidak tersedia atau URL tidak valid.</p>
          <button onClick={() => navigate(-1)} className="text-sm font-medium text-foreground underline underline-offset-4">&larr; Kembali</button>
        </div>
      </div>
    );
  }

  const master = activeCatalog.master_products;
  // Build gallery: unit photos → distribusi warna → distribusi cover → thumbnail/gallery_urls
  const unitPhotos = (() => {
    const masterMatch = allMasterProducts.find(m =>
      m.warranty_type === selectedWarrantyType && m.color === selectedColor && m.storage_gb === selectedStorage
    );
    if (!masterMatch) return [];
    const units = allUnits.filter(u => u.product_id === masterMatch.id);
    return units.flatMap(u =>
      u.unit_photo_urls?.length > 0 ? u.unit_photo_urls : (u.unit_photo_url ? [u.unit_photo_url] : [])
    );
  })();
  const distCovers = distPhotos.filter(p => p.distribution === selectedWarrantyType && p.photo_type === "cover").map(p => p.photo_url);
  const distColorPhotos = distPhotos.filter(p => p.distribution === selectedWarrantyType && p.photo_type === "color" && p.color === selectedColor).map(p => p.photo_url);
  const fallbackImages = [activeCatalog.thumbnail_url, ...(activeCatalog.gallery_urls ?? [])].filter(Boolean) as string[];
  const allImages = unitPhotos.length > 0
    ? unitPhotos
    : (distCovers.length > 0 || distColorPhotos.length > 0
        ? [...distCovers, ...distColorPhotos]
        : fallbackImages);
  // (condition counters removed)
  const minPrice = activeUnits.length > 0 ? Math.min(...activeUnits.filter(u => u.selling_price).map(u => u.selling_price!)) : null;
  const maxPrice = activeUnits.length > 0 ? Math.max(...activeUnits.filter(u => u.selling_price).map(u => u.selling_price!)) : null;
  const outOfStock = activeUnits.length === 0;

  const heroDiscount = minPrice ? calcDiscountedPrice(minPrice, activeCatalog, flashSaleSettings, saleCampaignItems, { series: master.series, storage_gb: master.storage_gb, warranty_type: selectedWarrantyType || master.warranty_type }) : null;

  // Warranty groups for dropdown (all warranty types for this series)
  const warrantyOptions = Array.from(new Set(allCatalogsCache.map(c => c.master_products.warranty_type)));

  // Flash sale info — check if all siblings have flash sale or just specific ones
  const flashSaleCatalogs = currentSiblings.filter(s => s.is_flash_sale);
  const allHaveFlashSale = flashSaleCatalogs.length === currentSiblings.length;
  const someHaveFlashSale = flashSaleCatalogs.length > 0 && !allHaveFlashSale;


  function handleAddToCart() {
    if (outOfStock) return;
    if (activeCatalog?.is_flash_sale && flashSaleSettings?.is_active && new Date(flashSaleSettings.start_time).getTime() > Date.now()) {
      setShowFlashSalePopup(true);
      return;
    }
    // Check if there are multiple distinct prices
    const uniquePrices = Array.from(new Set(activeUnits.filter(u => u.selling_price).map(u => u.selling_price!)));
    if (uniquePrices.length > 1 && !selectedUnitId) {
      setShowPricePickerPopup(true);
      return;
    }
    doAddToCart(selectedUnitId);
  }

  function doAddToCart(unitId: string | null) {
    const targetUnit = unitId ? activeUnits.find(u => u.id === unitId) : activeUnits[0];
    if (!targetUnit) return;
    const originalSellingPrice = targetUnit.selling_price ?? 0;
    const unitM = targetUnit.master_products ?? master;
    const unitMasterInfo = { series: unitM.series, storage_gb: unitM.storage_gb, warranty_type: unitM.warranty_type };
    const disc = calcDiscountedPrice(originalSellingPrice, activeCatalog, flashSaleSettings, saleCampaignItems, unitMasterInfo);
    
    const saleLabel = disc.saleType === "flash_sale" ? "Flash Sale"
      : disc.saleType === "sale_campaign" ? (saleCampaignName || "Discount Sale")
      : disc.saleType === "catalog_discount" ? "Diskon"
      : null;

    const item: CartItem = {
      unitId: targetUnit.id,
      productName: activeCatalog.display_name,
      color: selectedColor || master.color,
      storageGb: selectedStorage || master.storage_gb,
      warrantyType: selectedWarrantyType || master.warranty_type,
      conditionStatus: targetUnit.condition_status,
      minusDescription: targetUnit.minus_description,
      sellingPrice: disc.hasDiscount ? disc.finalPrice : originalSellingPrice,
      originalPrice: disc.hasDiscount ? originalSellingPrice : undefined,
      saleLabel: saleLabel,
      saleDiscountLabel: disc.hasDiscount ? disc.discountLabel : null,
      imeiCensored: censorImei(targetUnit.imei),
      thumbnailUrl: activeCatalog.thumbnail_url,
      slug: activeCatalog.slug,
      branchId: activeCatalog.branch_id ?? null,
      weightGram: (master as any).weight_gram ?? 200,
      shippingDiscountType: (activeCatalog as any).shipping_discount_type ?? "none",
      shippingDiscountValue: (activeCatalog as any).shipping_discount_value ?? 0,
      freeShipping: activeCatalog.free_shipping || false,
      bonusItems: activeCatalog.bonus_items && activeCatalog.bonus_items.length > 0 ? activeCatalog.bonus_items : undefined,
    };
    const added = addToCart(item);
    if (added) {
      toast({ title: "Ditambahkan ke keranjang", description: activeCatalog.display_name });
    } else {
      toast({ title: "Unit sudah ada di keranjang", variant: "destructive" });
    }
    setShowPricePickerPopup(false);
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: activeCatalog.display_name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast({ title: "Link disalin", description: "Link produk berhasil disalin ke clipboard" });
      }).catch(() => {});
    }
  }

  function handleColorChange(color: string) {
    setSelectedColor(color);
    setSelectedUnitId(null);
    // 1. Unit photo for this color
    const masterMatch = allMasterProducts.find(m =>
      m.warranty_type === selectedWarrantyType && m.color === color && m.storage_gb === selectedStorage
    );
    if (masterMatch) {
      const unitWithPhoto = allUnits.find(u =>
        u.product_id === masterMatch.id &&
        ((u.unit_photo_urls && u.unit_photo_urls.length > 0) || u.unit_photo_url)
      );
      if (unitWithPhoto) {
        const photos = unitWithPhoto.unit_photo_urls?.length > 0
          ? unitWithPhoto.unit_photo_urls
          : [unitWithPhoto.unit_photo_url].filter(Boolean);
        setActiveImg(photos[0]); return;
      }
    }
    // 2. Distribution color photo
    const distColor = distPhotos.find(p => p.distribution === selectedWarrantyType && p.photo_type === "color" && p.color === color);
    if (distColor) { setActiveImg(distColor.photo_url); return; }
    // 3. Distribution cover
    const distCover = distPhotos.find(p => p.distribution === selectedWarrantyType && p.photo_type === "cover");
    if (distCover) { setActiveImg(distCover.photo_url); return; }
    // 4. Fallback thumbnail
    setActiveImg(activeCatalog.thumbnail_url);
  }

  function handleStorageChange(gb: number) {
    setSelectedStorage(gb);
    setSelectedUnitId(null);
    // 1. Unit photo for this storage
    const masterMatch = allMasterProducts.find(m =>
      m.warranty_type === selectedWarrantyType && m.color === selectedColor && m.storage_gb === gb
    );
    if (masterMatch) {
      const unitWithPhoto = allUnits.find(u =>
        u.product_id === masterMatch.id &&
        ((u.unit_photo_urls && u.unit_photo_urls.length > 0) || u.unit_photo_url)
      );
      if (unitWithPhoto) {
        const photos = unitWithPhoto.unit_photo_urls?.length > 0
          ? unitWithPhoto.unit_photo_urls
          : [unitWithPhoto.unit_photo_url].filter(Boolean);
        setActiveImg(photos[0]); return;
      }
    }
    // 2. Distribution color photo
    const distColor = distPhotos.find(p => p.distribution === selectedWarrantyType && p.photo_type === "color" && p.color === selectedColor);
    if (distColor) { setActiveImg(distColor.photo_url); return; }
    // 3. Distribution cover
    const distCover = distPhotos.find(p => p.distribution === selectedWarrantyType && p.photo_type === "cover");
    if (distCover) { setActiveImg(distCover.photo_url); return; }
    // 4. Fallback thumbnail
    setActiveImg(activeCatalog.thumbnail_url);
  }

  // Page title = series name
  const seriesName = catalog.master_products.series;
  const pageTitle = `${seriesName} ${WARRANTY_SHORT[selectedWarrantyType || catalog.master_products.warranty_type] ?? (selectedWarrantyType || catalog.master_products.warranty_type)}`;

  // Specs
  const specsRows: { label: string; value: string | null | undefined }[] = [
    { label: "Stok", value: outOfStock ? "Habis" : String(activeUnits.length) },
    { label: "Kondisi", value: activeCatalog.spec_condition || "Bekas" },
    { label: "Merek", value: activeCatalog.spec_brand || "iPhone Apple" },
    { label: "Kapasitas Penyimpanan", value: storageLabel(master.storage_gb) },
    { label: "Jenis Garansi", value: WARRANTY_LABELS[master.warranty_type] || master.warranty_type },
    { label: "Produk Custom", value: activeCatalog.spec_custom_product || "Tidak" },
    { label: "Build-in Battery", value: activeCatalog.spec_built_in_battery || "Ya" },
    { label: "Model Handphone", value: activeCatalog.spec_phone_model || master.series },
    { label: "No.Sertifikat (POSTEL)", value: activeCatalog.spec_postel_cert || "-" },
    { label: "Dikirim Dari", value: activeCatalog.spec_shipped_from || "Kota Surabaya" },
  ];
  if (activeCatalog.spec_warranty_duration) specsRows.splice(5, 0, { label: "Masa Garansi", value: activeCatalog.spec_warranty_duration });

  const tabs = [
    { key: "detail", label: "Detail Produk" },
    { key: "kondisi", label: `Daftar Unit (${filteredUnits.length})` },
    { key: "rating", label: `Penilaian (${activeCatalog.rating_count ?? 0})` },
    { key: "garansi", label: "Informasi Garansi" },
    { key: "pengiriman", label: "Pengiriman" },
  ] as const;

  // Check if current variant has sale campaign discount
  const currentVariantHasSale = saleCampaignItems.some(sci =>
    sci.series.toLowerCase() === master.series.toLowerCase() &&
    sci.storage_gb === (selectedStorage || master.storage_gb) &&
    sci.warranty_type === (selectedWarrantyType || master.warranty_type)
  );

  // Badges — mutually exclusive between Flash Sale and Discount Sale
  const badges = [];
  const isFlashSaleActiveNow = activeCatalog.is_flash_sale && flashSaleSettings?.is_active &&
    new Date(flashSaleSettings.start_time).getTime() <= Date.now() &&
    new Date(new Date(flashSaleSettings.start_time).getTime() + flashSaleSettings.duration_hours * 3600000).getTime() > Date.now();

  if (isFlashSaleActiveNow) {
    badges.push(
      <span key="flash" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground shadow-sm whitespace-nowrap">
        <Zap className="w-3.5 h-3.5 shrink-0" /> Flash Sale
      </span>
    );
  } else if (currentVariantHasSale && saleCampaignName) {
    badges.push(
      <span key="sale" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap"
        style={{ background: "hsl(160 60% 45%)", color: "#fff" }}>
        <Tag className="w-3.5 h-3.5 shrink-0" /> Discount Sale
      </span>
    );
  }
  if (activeCatalog.discount_active && activeCatalog.discount_value && !activeCatalog.is_flash_sale) {
    badges.push(
      <span key="disc" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground shadow-sm whitespace-nowrap">
        <Tag className="w-3.5 h-3.5 shrink-0" /> Diskon
      </span>
    );
  }
  if (activeCatalog.free_shipping) {
    badges.push(
      <span key="ship" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-green-500 text-white shadow-sm whitespace-nowrap">
        <Truck className="w-3.5 h-3.5 shrink-0" /> Gratis Ongkir
      </span>
    );
  }
  if (activeCatalog.highlight_product) {
    badges.push(
      <span key="high" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white shadow-sm whitespace-nowrap">
        <Star className="w-3.5 h-3.5 fill-current shrink-0" /> Unggulan
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-8">
        <div className="max-w-6xl mx-auto px-4">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground py-3">
            <Link to="/" className="hover:text-foreground transition-colors">Beranda</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/katalog" className="hover:text-foreground transition-colors">Katalog</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium truncate max-w-xs">{pageTitle}</span>
          </nav>

          {/* Hero */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] gap-6 pb-8">

            {/* LEFT — Media */}
            <div className="space-y-3">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border">
                {activeImg ? (
                  <img src={activeImg} alt={activeCatalog.display_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/40">
                    <ImageOff className="w-16 h-16" />
                    <span className="text-sm">Belum ada foto</span>
                  </div>
                )}
                {outOfStock && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-white text-lg font-bold">Stok Habis</p>
                      <p className="text-white/70 text-sm">Produk sedang tidak tersedia</p>
                    </div>
                  </div>
                )}
              </div>
              {allImages.length > 1 && (
                <div className="space-y-1.5">
                  {(distCovers.length > 0 || distColorPhotos.length > 0) && (
                    <p className="text-[11px] text-muted-foreground">
                      Foto: {WARRANTY_SHORT[selectedWarrantyType] ?? selectedWarrantyType} {selectedColor ? `— ${selectedColor}` : ""}
                    </p>
                  )}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {allImages.map((url, i) => (
                      <button key={i} onClick={() => setActiveImg(url)}
                        className={cn("w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all",
                          activeImg === url ? "border-foreground scale-105" : "border-border hover:border-foreground/40")}>
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* MIDDLE — Info */}
            <div className="space-y-4">
              {/* Badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-2">{badges}</div>
              )}

              {/* Product name — shows current variant */}
              <h1 className="text-xl font-bold text-foreground leading-tight">
                {activeCatalog.display_name}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-3 pb-1 border-b border-border">
                <StarRating score={activeCatalog.rating_score ?? 0} count={activeCatalog.rating_count ?? 0} />
              </div>

              {/* Price */}
              {(() => {
                if (outOfStock) {
                  const restockMsg = (() => {
                    const hour = new Date().getHours();
                    const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
                    return `${greeting} Admin Ivalora Gadget\n\nSaya ingin bertanya kapan restock untuk:\n\n*${activeCatalog.display_name}*\nWarna: ${master.color}\nKapasitas: ${storageLabel(master.storage_gb)}\n\nMohon info jadwal restocknya. Terima kasih!`;
                  })();
                  return (
                    <div className="space-y-3">
                      <div className="text-2xl font-bold text-muted-foreground">Stok Habis</div>
                      <p className="text-sm text-destructive">Maaf stok sedang habis, hubungi admin untuk tanya kapan restoknya.</p>
                      {countdownStr && countdownStr !== "Berakhir" && activeCatalog.is_flash_sale && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Flash Sale berakhir dalam {countdownStr}</span>
                        </div>
                      )}
                      <a
                        href={`https://api.whatsapp.com/send?phone=6285890024760&text=${encodeURIComponent(restockMsg)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                        style={{ backgroundColor: "#25D366" }}
                      >
                        <MessageCircle className="w-4 h-4" /> Tanya Restock Kapan
                      </a>
                    </div>
                  );
                }
                if (heroDiscount?.hasDiscount) {
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base text-muted-foreground line-through">{formatRupiah(minPrice)}</p>
                        <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md">{heroDiscount.discountLabel}</span>
                      </div>
                      <div className="text-3xl font-bold text-destructive">{formatRupiah(heroDiscount.finalPrice)}</div>
                      {countdownStr && countdownStr !== "Berakhir" && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Berakhir dalam {countdownStr}</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-foreground">{formatRupiah(minPrice)}</div>
                    {maxPrice && maxPrice !== minPrice && (
                      <p className="text-sm text-muted-foreground">s/d {formatRupiah(maxPrice)} tergantung kondisi unit</p>
                    )}
                  </div>
                );
              })()}

              {/* Flash sale specific units info */}
              {someHaveFlashSale && flashSaleSettings?.is_active && (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-sm font-semibold text-amber-800">Flash Sale untuk unit tertentu:</span>
                  </div>
                  <ul className="space-y-0.5 ml-6">
                    {flashSaleCatalogs.map(fc => (
                      <li key={fc.id} className="text-xs text-amber-700 flex items-center gap-1.5">
                        <Zap className="w-3 h-3 shrink-0" />
                        {fc.master_products.series} {storageLabel(fc.master_products.storage_gb)} {fc.master_products.color}
                      </li>
                    ))}
                  </ul>
                  {countdownStr && countdownStr !== "Berakhir" && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 ml-6">
                      <Clock className="w-3 h-3" /> Berakhir dalam {countdownStr}
                    </p>
                  )}
                </div>
              )}

              {/* ① Pilih Tipe — state-based, no navigation */}
              {warrantyOptions.length > 1 ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Tipe</p>
                  <div className="flex flex-wrap gap-2">
                    {warrantyOptions.map((wt) => {
                      const isCurrent = wt === selectedWarrantyType;
                      // Count all units for this warranty type across all colors/storages
                      const wtMasterIds = allMasterProducts.filter(m => m.warranty_type === wt).map(m => m.id);
                      const wtUnitCount = allUnits.filter(u => wtMasterIds.includes(u.product_id)).length;
                      return (
                        <button key={wt}
                          onClick={() => {
                            setSelectedWarrantyType(wt);
                            setSelectedUnitId(null);
                            // Prefer distribution photo for new warranty type
                            const distCover = distPhotos.find(p => p.distribution === wt && p.photo_type === "cover");
                            const distColor = distPhotos.find(p => p.distribution === wt && p.photo_type === "color");
                            const newSiblings = allCatalogsCache.filter(c => c.master_products.warranty_type === wt);
                            if (distCover) {
                              setActiveImg(distCover.photo_url);
                            } else if (distColor) {
                              setActiveImg(distColor.photo_url);
                            } else if (newSiblings.length > 0) {
                              const wtMasters = allMasterProducts.filter(m => m.warranty_type === wt);
                              const inStockMaster = wtMasters.find(m => allUnits.some(u => u.product_id === m.id));
                              if (inStockMaster) {
                                setSelectedColor(inStockMaster.color);
                                setSelectedStorage(inStockMaster.storage_gb);
                                const matchCat = newSiblings.find(s => s.product_id === inStockMaster.id);
                                if (matchCat?.thumbnail_url) setActiveImg(matchCat.thumbnail_url);
                              } else {
                                const first = newSiblings[0];
                                setSelectedColor(first.master_products.color);
                                setSelectedStorage(first.master_products.storage_gb);
                                if (first.thumbnail_url) setActiveImg(first.thumbnail_url);
                              }
                            }
                          }}
                          className={cn("px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                            isCurrent ? "border-foreground bg-foreground text-background"
                              : "border-border text-foreground hover:border-foreground/60 bg-background")}>
                          {WARRANTY_SHORT[wt] ?? wt}
                          {wtUnitCount > 0 && <span className="ml-1 text-xs opacity-60">({wtUnitCount})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-full text-white"
                    style={{ backgroundColor: WARRANTY_BADGE_COLORS[master.warranty_type] ?? "#666" }}
                  >
                    <BadgeCheck className="w-4 h-4" />
                    {WARRANTY_SHORT[master.warranty_type] ?? master.warranty_type}
                  </span>
                  <span className="text-sm text-muted-foreground">{WARRANTY_LABELS[master.warranty_type]}</span>
                </div>
              )}

              {/* ② Pilih Warna — state-based, no navigation */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Pilih warna: <span className="text-muted-foreground font-normal">{selectedColor}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {allColors.map(color => {
                    const isCurrent = color === selectedColor;
                    const exists = hasCatalogFor(color, selectedStorage);
                    // Count units for this color across all storages of current warranty type
                    const colorMasterIds = allMasterProducts.filter(m => m.warranty_type === selectedWarrantyType && m.color === color).map(m => m.id);
                    const colorUnitCount = allUnits.filter(u => colorMasterIds.includes(u.product_id)).length;
                    return (
                      <button key={color}
                        onClick={() => handleColorChange(color)}
                        className={cn("px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                          isCurrent ? "border-foreground bg-foreground text-background"
                            : exists ? "border-border text-foreground hover:border-foreground/60 bg-background"
                            : "border-border text-muted-foreground/50 bg-background")}>
                        {color}
                        {colorUnitCount > 0 && <span className="ml-1 text-xs opacity-60">({colorUnitCount})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ③ Pilih Kapasitas — state-based */}
              {allStorages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Pilih kapasitas: <span className="text-muted-foreground font-normal">{storageLabel(selectedStorage)}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allStorages.map(gb => {
                      const isCurrent = gb === selectedStorage;
                      // Count units for this storage for current color + warranty type
                      const storageMaster = allMasterProducts.find(m => m.warranty_type === selectedWarrantyType && m.color === selectedColor && m.storage_gb === gb);
                      const storageUnitCount = storageMaster ? allUnits.filter(u => u.product_id === storageMaster.id).length : 0;
                      return (
                        <button key={gb}
                          onClick={() => handleStorageChange(gb)}
                          className={cn("px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                            isCurrent ? "border-foreground bg-foreground text-background"
                              : "border-border text-foreground hover:border-foreground/60 bg-background")}>
                          {storageLabel(gb)}
                          {storageUnitCount > 0 && <span className="ml-1 text-xs opacity-60">({storageUnitCount})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Marketplace links */}
              {(activeCatalog.tokopedia_url || activeCatalog.shopee_url) && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Tersedia juga di marketplace resmi:</p>
                  <div className="flex gap-2 flex-wrap">
                    {activeCatalog.tokopedia_url && (
                      <a href={activeCatalog.tokopedia_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors"
                        style={{ color: "#03AC0E" }}>
                        <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: "#03AC0E" }}>T</span>
                        Tokopedia <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {activeCatalog.shopee_url && (
                      <a href={activeCatalog.shopee_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors"
                        style={{ color: "#EE4D2D" }}>
                        <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: "#EE4D2D" }}>S</span>
                        Shopee <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — Purchase box */}
            <div className="lg:self-start">
              <div className="border border-border rounded-xl p-4 space-y-4 sticky top-20">
                <p className="text-sm font-semibold text-foreground">Atur pembelian</p>
                <p className="text-xs text-muted-foreground">{selectedColor} · {storageLabel(selectedStorage)}</p>
                {!outOfStock && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-foreground font-medium">
                      Stok: <span className="text-amber-500 font-bold">
                        {selectedUnitId ? "Tersedia 1" : `Tersedia ${activeUnits.length}`}
                      </span>
                    </span>
                  </div>
                )}
                {outOfStock && (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive font-medium">Stok habis untuk varian ini</p>
                    {countdownStr && countdownStr !== "Berakhir" && activeCatalog?.is_flash_sale && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Flash Sale berakhir dalam {countdownStr}</span>
                      </div>
                    )}
                    <a
                      href={`https://api.whatsapp.com/send?phone=6285890024760&text=${encodeURIComponent((() => {
                        const hour = new Date().getHours();
                        const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
                        const saleContext = activeCatalog?.is_flash_sale ? "\n(Produk ini termasuk Flash Sale)" : currentVariantHasSale ? `\n(Produk ini termasuk Discount Sale${saleCampaignName ? ` "${saleCampaignName}"` : ""})` : "";
                        return `${greeting} Admin Ivalora Gadget\n\nSaya ingin bertanya kapan restock untuk:\n\n*${activeCatalog?.display_name}*\nWarna: ${selectedColor}\nKapasitas: ${storageLabel(selectedStorage)}${saleContext}\n\nMohon info jadwal restocknya. Terima kasih!`;
                      })())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors w-full justify-center"
                      style={{ backgroundColor: "#25D366" }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Tanya Restock Kapan
                    </a>
                  </div>
                )}
                {/* Price variant info - if multiple different prices exist */}
                {!outOfStock && (() => {
                  const uniquePrices = Array.from(new Set(activeUnits.filter(u => u.selling_price).map(u => u.selling_price!)));
                  if (uniquePrices.length > 1) {
                    return (
                      <p className="text-xs text-muted-foreground">
                        Tersedia {uniquePrices.length} harga berbeda — akan ditanyakan saat checkout
                      </p>
                    );
                  }
                  return null;
                })()}
                {/* Purchase price */}
                {!outOfStock && (() => {
                  const selUnit = selectedUnitId ? activeUnits.find(u => u.id === selectedUnitId) : activeUnits[0];
                  const selPrice = selUnit?.selling_price ?? minPrice;
                  if (!selPrice) return <div className="text-xl font-bold text-foreground">\u2014</div>;
                  const disc = calcDiscountedPrice(selPrice, activeCatalog, flashSaleSettings, saleCampaignItems, { series: master.series, storage_gb: master.storage_gb, warranty_type: selectedWarrantyType || master.warranty_type });
                  if (disc.hasDiscount) {
                    return (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground line-through">{formatRupiah(selPrice)}</span>
                          <span className="text-xs font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">{disc.discountLabel}</span>
                        </div>
                        <div className="text-xl font-bold text-destructive">{formatRupiah(disc.finalPrice)}</div>
                      </div>
                    );
                  }
                  return <div className="text-xl font-bold text-foreground">{formatRupiah(selPrice)}</div>;
                })()}
                <div className="space-y-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={outOfStock}
                    className={cn(
                      "w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
                      outOfStock
                        ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                        : "bg-foreground text-background hover:opacity-90"
                    )}
                  >
                    <ShoppingCart className="w-4 h-4" /> Keranjang
                  </button>
                  <button
                    onClick={() => {
                      handleAddToCart();
                      if (!outOfStock) navigate("/keranjang");
                    }}
                    disabled={outOfStock}
                    className={cn(
                      "w-full py-3 rounded-xl border-2 text-sm font-semibold transition-colors",
                      outOfStock
                        ? "border-border text-muted-foreground cursor-not-allowed opacity-50"
                        : "border-foreground text-foreground hover:bg-accent"
                    )}
                  >
                    Beli Langsung
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <button
                    onClick={() => {
                      const hour = new Date().getHours();
                      const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
                      
                      // Contextual WA message
                      const selUnit = selectedUnitId ? activeUnits.find(u => u.id === selectedUnitId) : activeUnits[0];
                      const selPrice = selUnit?.selling_price ?? minPrice;
                      const unitM = selUnit?.master_products ?? master;
                      const unitMasterInfo = { series: unitM.series, storage_gb: unitM.storage_gb, warranty_type: unitM.warranty_type };
                      const disc = selPrice ? calcDiscountedPrice(selPrice, activeCatalog, flashSaleSettings, saleCampaignItems, unitMasterInfo) : null;
                      
                      let msg: string;
                      if (disc?.saleType === "flash_sale") {
                        msg = `${greeting} Admin Ivalora Gadget.\n\nSaya tertarik dengan promo Flash Sale pada unit:\n\n*${activeCatalog.display_name}*\nWarna: ${selectedColor}\nKapasitas: ${storageLabel(selectedStorage)}\nHarga: ${formatRupiah(disc.finalPrice)}\n\nApakah unit ini dengan harga Flash Sale masih tersedia? Terima kasih!`;
                      } else if (disc?.saleType === "sale_campaign") {
                        msg = `${greeting} Admin Ivalora Gadget.\n\nSaya tertarik dengan promo Discount Sale${saleCampaignName ? ` "${saleCampaignName}"` : ""} pada unit:\n\n*${activeCatalog.display_name}*\nWarna: ${selectedColor}\nKapasitas: ${storageLabel(selectedStorage)}\nHarga: ${formatRupiah(disc.finalPrice)}\n\nApakah unit ini dengan harga Discount Sale masih tersedia? Terima kasih!`;
                      } else {
                        msg = `${greeting} Admin Ivalora Gadget\n\nSaya tertarik dengan unit:\n\n*${activeCatalog.display_name}*\nWarna: ${selectedColor}\nKapasitas: ${storageLabel(selectedStorage)}\nHarga: ${selPrice ? formatRupiah(selPrice) : "-"}\n\nApakah unit ini masih tersedia? Terima kasih!`;
                      }
                      
                      const encoded = encodeURIComponent(msg);
                      window.open(`https://api.whatsapp.com/send?phone=6285890024760&text=${encoded}`, "_blank");
                    }}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> Chat Admin
                  </button>
                  <button onClick={handleShare} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Share2 className="w-4 h-4" /> Bagikan
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Why Ivalora */}
          <div className="py-6 border-t border-border">
            <h2 className="text-base font-bold text-foreground mb-3">Kenapa Memilih Ivalora?</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { icon: Shield, label: "IMEI Aman & Terdaftar" },
                { icon: CheckCircle2, label: "QC 30+ Checkpoint" },
                { icon: Zap, label: "Battery Health \u2265 81%" },
                { icon: BadgeCheck, label: "Tidak iCloud Lock" },
                { icon: Truck, label: "Packing Aman" },
                { icon: MessageCircle, label: "After Sales 30 Hari" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border">
                  <item.icon className="w-4 h-4 text-foreground shrink-0" />
                  <p className="text-xs font-semibold text-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* TABS */}
          <div className="border-t border-border">
            <div className="flex overflow-x-auto border-b border-border -mb-px scrollbar-hide w-full">
              {tabs.map(t => (
                <Tab key={t.key} label={t.label} active={activeTab === t.key} onClick={() => setActiveTab(t.key as typeof activeTab)} />
              ))}
            </div>

            <div className="py-6 w-full">
              {/* TAB: Detail */}
              {activeTab === "detail" && (
                <div className="space-y-6">
                  {activeCatalog.full_description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{activeCatalog.full_description}</p>
                  )}
                  <table className="w-full">
                    <tbody>
                      {specsRows.map(r => <SpecRow key={r.label} label={r.label} value={r.value} />)}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB: Daftar Unit */}
              {activeTab === "kondisi" && (
                <div className="space-y-4">
                  {/* Discount banner */}
                  {heroDiscount?.hasDiscount && (
                    <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm">
                      <Tag className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-amber-800 font-medium">
                        {activeCatalog.is_flash_sale ? "Flash Sale aktif" : "Diskon aktif"} — harga di bawah sudah termasuk potongan ({heroDiscount.discountLabel}).
                      </span>
                      {countdownStr && countdownStr !== "Berakhir" && (
                        <span className="ml-auto text-xs text-amber-600 font-semibold whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {countdownStr}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Unit cards — show only units matching selected color/storage */}
                  {filteredUnits.length > 0 ? filteredUnits.map((unit) => {
                    const originalPrice = unit.selling_price ?? 0;
                    const m = unit.master_products ?? master;
                    const unitMasterInfo = { series: m.series, storage_gb: m.storage_gb, warranty_type: m.warranty_type };
                    const disc = calcDiscountedPrice(originalPrice, activeCatalog, flashSaleSettings, saleCampaignItems, unitMasterInfo);
                    const unitPhotos = unit.unit_photo_urls?.length > 0 ? unit.unit_photo_urls : (unit.unit_photo_url ? [unit.unit_photo_url] : []);
                    const unitName = `${m.series} ${m.color} ${storageLabel(m.storage_gb)} ${WARRANTY_SHORT[m.warranty_type] ?? m.warranty_type}`;

                    return (
                      <UnitAccordionCard
                        key={unit.id}
                        unit={unit}
                        unitName={unitName}
                        unitPhotos={unitPhotos}
                        disc={disc}
                        originalPrice={originalPrice}
                        formatRupiah={formatRupiah}
                        censorImei={censorImei}
                        onPhotoClick={(url) => setActiveImg(url)}
                        catalogDisplayName={activeCatalog.display_name}
                        flashSaleName={flashSaleSettings?.is_active ? (catalog as any)?.flash_sale_event_name || null : null}
                        saleCampaignName={saleCampaignName}
                        onUnitClick={(u) => {
                          const m = u.master_products;
                          if (m) {
                            setSelectedColor(m.color);
                            setSelectedStorage(m.storage_gb);
                            setSelectedWarrantyType(m.warranty_type);
                            setSelectedUnitId(u.id);
                            // Update image
                            const matchCat = allCatalogsCache.find(c => c.product_id === u.product_id);
                            if (matchCat?.thumbnail_url) setActiveImg(matchCat.thumbnail_url);
                            // Scroll to top to see the updated filters
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                      />
                    );
                  }) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">Tidak ada unit untuk filter ini</p>
                      {(selectedColor || selectedStorage) && (
                        <p className="text-xs mt-1 text-muted-foreground">Coba ubah pilihan warna/kapasitas</p>
                      )}
                    </div>
                  )}

                  {/* All units (unfiltered) shown when no color/storage filter applied */}
                  {!selectedColor && !selectedStorage && allWarrantyUnits.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">Belum ada unit tersedia</p>
                      <p className="text-xs mt-1">Hubungi admin untuk info restock.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Penilaian */}
              {activeTab === "rating" && (
                <div>
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex flex-col items-center justify-center bg-muted/30 border border-border rounded-2xl p-6 min-w-[160px] gap-2">
                      <span className="text-5xl font-black text-foreground">{(activeCatalog.rating_score ?? 0).toFixed(1)}</span>
                      <StarRating score={activeCatalog.rating_score ?? 0} count={activeCatalog.rating_count ?? 0} />
                      <span className="text-xs text-muted-foreground mt-1">dari 5</span>
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      {[5, 4, 3, 2, 1].map(star => (
                        <div key={star} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-4 text-right">{star}</span>
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: "0%" }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-4">0</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(activeCatalog.rating_count ?? 0) === 0 && (
                    <div className="mt-6 text-center py-10 rounded-xl border border-border bg-muted/10">
                      <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-foreground">Belum ada ulasan</p>
                      <p className="text-xs text-muted-foreground mt-1">Jadilah yang pertama memberikan ulasan.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Garansi */}
              {activeTab === "garansi" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border">
                    <p className="text-sm font-semibold text-foreground mb-2">Termasuk dalam Garansi</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>Garansi toko 30 hari mesin</li>
                      <li>IMEI lifetime aktif terdaftar</li>
                      <li>{WARRANTY_LABELS[master.warranty_type] ?? master.warranty_type}</li>
                      {activeCatalog.spec_warranty_duration && <li>Masa garansi: {activeCatalog.spec_warranty_duration}</li>}
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl border border-border">
                    <p className="text-sm font-semibold text-foreground mb-2">Tidak Termasuk</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>Kerusakan akibat jatuh/benturan</li>
                      <li>Kerusakan akibat air/cairan</li>
                      <li>Human error</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB: Pengiriman */}
              {activeTab === "pengiriman" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-border">
                    <Truck className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Dikirim dari</p>
                      <p className="text-sm text-muted-foreground">{activeCatalog.spec_shipped_from || "Kota Surabaya, Jawa Timur"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-border">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Pengemasan</p>
                      <p className="text-sm text-muted-foreground">Bubble wrap + kardus tebal + asuransi pengiriman</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-border">
                    <Shield className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Pemeriksaan sebelum kirim</p>
                      <p className="text-sm text-muted-foreground">Semua unit dicek ulang dan dipacking oleh tim kami</p>
                    </div>
                  </div>
                  {activeCatalog.free_shipping && (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
                      <Truck className="w-5 h-5 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">Gratis Ongkos Kirim</p>
                        <p className="text-sm text-green-700">Produk ini gratis ongkir ke seluruh Indonesia</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pb-16" />
        </div>
      </div>

      {/* Flash Sale Popup */}
      <AlertDialog open={showFlashSalePopup} onOpenChange={setShowFlashSalePopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Flash Sale Belum Dimulai
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {flashSaleSettings && (() => {
                const startAt = new Date(flashSaleSettings.start_time);
                const diffMs = startAt.getTime() - Date.now();
                const hours = Math.floor(diffMs / 3600000);
                const minutes = Math.ceil((diffMs % 3600000) / 60000);
                return (
                  <>
                    <p>Flash sale untuk produk ini belum dimulai. Harga spesial akan tersedia pada:</p>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-sm font-semibold text-foreground">
                        {startAt.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        Pukul {startAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hours > 0 ? `${hours} jam ${minutes} menit lagi` : `${minutes} menit lagi`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Kembali lagi nanti untuk mendapatkan harga flash sale!</p>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Mengerti</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Price Picker Popup — shown when multiple distinct prices exist */}
      <AlertDialog open={showPricePickerPopup} onOpenChange={setShowPricePickerPopup}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Pilih Harga Unit
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Produk <span className="font-semibold text-foreground">{activeCatalog?.display_name}</span> tersedia dengan beberapa harga berbeda. Silakan pilih:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(() => {
                    // Group units by price
                    const priceGroups = new Map<number, typeof activeUnits>();
                    for (const u of activeUnits) {
                      if (!u.selling_price) continue;
                      const existing = priceGroups.get(u.selling_price) || [];
                      existing.push(u);
                      priceGroups.set(u.selling_price, existing);
                    }
                    return Array.from(priceGroups.entries())
                      .sort(([a], [b]) => a - b)
                      .map(([price, units]) => (
                        <button
                          key={price}
                          onClick={() => doAddToCart(units[0].id)}
                          className="w-full p-3 rounded-xl border-2 border-border hover:border-foreground/60 text-left transition-all flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-bold text-foreground">{formatRupiah(price)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {units.length} unit tersedia
                            </p>
                          </div>
                          <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                      ));
                  })()}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Kenapa beda harga? Hubungi admin untuk penjelasan lebih lanjut.
                </p>
                <a
                  href={`https://api.whatsapp.com/send?phone=6285890024760&text=${encodeURIComponent(`Halo Admin Ivalora, saya ingin bertanya kenapa harga ${activeCatalog?.display_name ?? ""} ada beberapa pilihan? Terima kasih.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Chat Admin via WhatsApp
                </a>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowPricePickerPopup(false)}>Batal</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Unit Card (Accordion only if has photos) ─────────────────────────────────
function UnitAccordionCard({ unit, unitName, unitPhotos, disc, originalPrice, formatRupiah, censorImei, onPhotoClick, catalogDisplayName, onUnitClick, flashSaleName, saleCampaignName }: {
  unit: StockUnit;
  unitName: string;
  unitPhotos: string[];
  disc: { finalPrice: number; discountLabel: string; hasDiscount: boolean; saleType?: string | null };
  originalPrice: number;
  formatRupiah: (n: number | null | undefined) => string;
  censorImei: (imei: string) => string;
  onPhotoClick: (url: string) => void;
  catalogDisplayName: string;
  onUnitClick?: (unit: StockUnit) => void;
  flashSaleName?: string | null;
  saleCampaignName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const hasPhotos = unitPhotos.length > 0;

  const waMessage = () => {
    const hour = new Date().getHours();
    const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
    
    let msg: string;
    if (disc.saleType === "flash_sale") {
      msg = `${greeting} Admin Ivalora Gadget.\n\nSaya tertarik dengan promo Flash Sale${flashSaleName ? ` "${flashSaleName}"` : ""} pada unit:\n\n*${unitName}*\nHarga: ${formatRupiah(disc.finalPrice)}\n\nApakah unit ini dengan harga Flash Sale masih tersedia? Terima kasih!`;
    } else if (disc.saleType === "sale_campaign") {
      msg = `${greeting} Admin Ivalora Gadget.\n\nSaya tertarik dengan promo Discount Sale${saleCampaignName ? ` "${saleCampaignName}"` : ""} pada unit:\n\n*${unitName}*\nHarga: ${formatRupiah(disc.finalPrice)}\n\nApakah unit ini dengan harga Discount Sale masih tersedia? Terima kasih!`;
    } else {
      msg = `${greeting} Admin Ivalora Gadget\n\nSaya tertarik dengan unit:\n\n*${unitName}*\nHarga: ${formatRupiah(disc.hasDiscount ? disc.finalPrice : unit.selling_price)}\n\nApakah unit ini masih tersedia? Terima kasih!`;
    }
    return `https://api.whatsapp.com/send?phone=6285890024760&text=${encodeURIComponent(msg)}`;
  };

  // Discount percentage label
  const discountPctLabel = disc.hasDiscount && disc.discountLabel ? disc.discountLabel : "";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Main card content */}
      <div
        className={cn("p-4 flex gap-3", hasPhotos && "cursor-pointer hover:bg-accent/30 transition-colors")}
        onClick={() => {
          if (onUnitClick) onUnitClick(unit);
          if (hasPhotos) setOpen(!open);
        }}
        role="button"
      >
        {/* Thumbnail */}
        {unitPhotos[0] && (
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-border">
            <img src={unitPhotos[0]} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{unitName}</p>
            {disc.saleType === "sale_campaign" && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0" style={{ background: "hsl(160 60% 45%)" }}>Sale</span>
            )}
            {disc.saleType === "flash_sale" && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white bg-destructive shrink-0">⚡ Flash</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">IMEI: {censorImei(unit.imei)}</p>
          {/* Tanya Unit — below IMEI */}
          <a
            href={waMessage()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            Tanya Unit
          </a>
        </div>

        {/* Price + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            {disc.hasDiscount ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xs text-muted-foreground line-through">{formatRupiah(originalPrice)}</span>
                  <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">{discountPctLabel}</span>
                </div>
                <span className="text-sm font-bold text-destructive block">{formatRupiah(disc.finalPrice)}</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-foreground">{formatRupiah(unit.selling_price)}</span>
            )}
          </div>
          {hasPhotos && (
            <svg className={cn("w-4 h-4 shrink-0 transition-transform text-muted-foreground", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          )}
        </div>
      </div>

      {/* QC text — always visible */}
      <div className="px-4 pb-3 -mt-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Barang telah melewati quality control 30+ checkpoint
          </p>
        </div>
      </div>

      {/* Photo gallery — accordion only if has photos */}
      {hasPhotos && open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <div className="flex gap-2 pt-3 overflow-x-auto">
            {unitPhotos.map((url, i) => (
              <button key={i} type="button" onClick={() => onPhotoClick(url)}
                className="w-20 h-20 rounded-lg overflow-hidden border border-border shrink-0 hover:opacity-80 transition-opacity">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          {unit.condition_status === "minus" && unit.minus_description && (
            <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200">
              <p className="text-xs text-orange-700">
                <span className="font-semibold">Catatan minus:</span> {unit.minus_description}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}