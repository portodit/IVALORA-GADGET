import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useToast } from "@/hooks/shared/use-toast";
import { logActivity } from "@/lib/admin/laporan/activity-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, Star, Eye, Store, Globe, ShoppingCart, Camera,
  X, Package, Loader2, Trash2, Plus, GripVertical, ExternalLink,
  Tag, Truck, FileText, Image as ImageIcon,
  Barcode, MapPin,
  LayoutGrid,
  ImagePlus,
  BadgeCheck,
} from "lucide-react";
import { CATEGORY_LABELS, WARRANTY_LABELS, WARRANTY_CATEGORY_LABELS, WARRANTY_TO_CATEGORY, WarrantyCategory, ProductCategory } from "@/lib/admin/produk/master-products";
import { cn } from "@/lib/utils";

// ── Image upload helper ───────────────────────────────────────────────────────
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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

// ── Slug generator ────────────────────────────────────────────────────────────
function generateSlug(text: string, suffix = "") {
  const base = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return suffix ? `${base}-${suffix}` : base;
}

// ── ImageUploadBox ────────────────────────────────────────────────────────────
function ImageUploadBox({
  label, hint, value, onChange, aspect = "aspect-[4/3]",
}: {
  label?: string; hint?: string; value: string | null;
  onChange: (url: string | null) => void; aspect?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const path = `catalog/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const url = await uploadImage(file, path);
    setUploading(false);
    if (url) onChange(url);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors",
          aspect,
          dragOver ? "border-foreground bg-accent/50" : "border-border"
        )}
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null); }}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50 p-4 text-center">
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Camera className="w-6 h-6" />
                <span className="text-[11px]">{dragOver ? "Lepas untuk upload" : "Klik atau seret gambar"}</span>
              </>
            )}
          </div>
        )}
      </div>
      <input
        ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}

// ── Bonus Item ────────────────────────────────────────────────────────────────
interface BonusItem {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  quantity?: number;
}

interface BonusProductRecord {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MasterProduct {
  id: string;
  series: string;
  storage_gb: number;
  color: string;
  category: string;
  warranty_type: string;
  is_active: boolean;
}

interface StockAggregate {
  product_id: string;
  total: number;
  no_minus: number;
  minus: number;
  min_price: number | null;
}

function formatRupiah(n: number | null | undefined) {
  if (!n) return "—";
  return "Rp" + n.toLocaleString("id-ID");
}

// Warranty labels fetched from DB at runtime
type WarrantyLabelRecord = { key: string; label: string };

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════
export default function KatalogFormPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const branchFromQuery = searchParams.get("branch");
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = role === "super_admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Branch data
  const [branches, setBranches] = useState<{ id: string; name: string; code: string; city: string | null }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(branchFromQuery);

  // Master data
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [stockAgg, setStockAgg] = useState<StockAggregate[]>([]);
  const [warrantyLabelsMap, setWarrantyLabelsMap] = useState<Record<string, string>>({});

  // Bonus products from DB
  const [bonusProductRecords, setBonusProductRecords] = useState<BonusProductRecord[]>([]);
  const [bonusSearch, setBonusSearch] = useState("");

  // Form state
  const [selectedId, setSelectedId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [shortDesc, setShortDesc] = useState("");
  const [fullDesc, setFullDesc] = useState("");
  const [promoLabel, setPromoLabel] = useState("");
  const [promoLabel2, setPromoLabel2] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [gallery, setGallery] = useState<(string | null)[]>([null, null, null, null, null, null, null, null]);
  const [publishPos, setPublishPos] = useState(false);
  const [publishWeb, setPublishWeb] = useState(false);
  const [publishMarket, setPublishMarket] = useState(false);
  const [tokopediaUrl, setTokopediaUrl] = useState("");
  const [shopeeUrl, setShopeeUrl] = useState("");
  const [highlight, setHighlight] = useState(false);
  const [showCondition, setShowCondition] = useState(true);
  const [freeShipping, setFreeShipping] = useState(false);
  const [shippingDiscountType, setShippingDiscountType] = useState("none");
  const [shippingDiscountValue, setShippingDiscountValue] = useState("");
  const [bonusItems, setBonusItems] = useState<BonusItem[]>([]);

  // Discount state
  const [discountActive, setDiscountActive] = useState(false);
  const [discountTypeVal, setDiscountTypeVal] = useState("percentage");
  const [discountValueStr, setDiscountValueStr] = useState("");
  const [discountStartAt, setDiscountStartAt] = useState("");
  const [discountEndAt, setDiscountEndAt] = useState("");

  // Spec fields
  const [specCondition, setSpecCondition] = useState("Bekas");
  const [specBrand, setSpecBrand] = useState("iPhone Apple");
  const [specWarrantyDuration, setSpecWarrantyDuration] = useState("");
  const [specScreenProtector, setSpecScreenProtector] = useState("Lainnya");
  const [specCaseType, setSpecCaseType] = useState("Lainnya");
  const [specCustomProduct, setSpecCustomProduct] = useState("Tidak");
  const [specBuiltInBattery, setSpecBuiltInBattery] = useState("Ya");
  const [specConditionDetail, setSpecConditionDetail] = useState("");
  const [specCableType, setSpecCableType] = useState("");
  const [specPhoneModel, setSpecPhoneModel] = useState("");
  const [specPostelCert, setSpecPostelCert] = useState("-");
  const [specShippedFrom, setSpecShippedFrom] = useState("Kota Surabaya");

  // Helper: get warranty group label
  function getWarrantyGroup(wt: string | null): string {
    if (wt === "resmi_bc") return "RESMI BEACUKAI";
    if (wt === "digimap" || wt === "ibox" || wt === "resmi") return "RESMI INDONESIA";
    if (wt === "inter") return "INTER";
    if (wt === "whitelist") return "WHITELIST";
    return "LAINNYA";
  }

  // Helper: get warranty category from group label
  function getWarrantyCategoryFromGroup(group: string | null): WarrantyCategory | null {
    if (group === "RESMI BEACUKAI") return "resmi_bc";
    if (group === "RESMI INDONESIA") return "resmi_indonesia";
    if (group === "INTER") return "inter";
    if (group === "WHITELIST") return "whitelist";
    return null;
  }

  // Series+warranty group type
  type SeriesWarrantyGroup = {
    key: string; // "series||warrantyGroup"
    series: string;
    warrantyGroup: string;
    category: string;
    productIds: string[];
    totalStock: number;
  };

  // Series+type groups for selection (both add & edit mode)
  const [seriesGroups, setSeriesGroups] = useState<SeriesWarrantyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Tab switcher state (pill style like stok-opname)
  const [activeTab, setActiveTab] = useState<"info" | "distribution" | "units">("info");

  // Included warranty types for this catalog article
  const [warrantyCategory, setWarrantyCategory] = useState<WarrantyCategory | null>(null);

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [masterRes, stockRes, bonusRes, warrantyRes, branchRes] = await Promise.all([
          db.from("master_products").select("*").eq("is_active", true).is("deleted_at", null),
          db.from("stock_units").select("product_id, selling_price, condition_status").eq("stock_status", "available"),
          db.from("bonus_items").select("id, name, description, icon").eq("is_active", true).order("sort_order"),
          db.from("warranty_labels").select("key, label").eq("is_active", true).order("sort_order"),
          db.from("branches").select("id, name, code, city").eq("is_active", true),
        ]);

        setBranches((branchRes.data ?? []) as { id: string; name: string; code: string; city: string | null }[]);

        const wMap: Record<string, string> = {};
        for (const w of (warrantyRes.data ?? [])) wMap[w.key] = w.label;
        setWarrantyLabelsMap(wMap);

        const masters: MasterProduct[] = masterRes.data ?? [];
        const rawStock = stockRes.data ?? [];
        setBonusProductRecords(bonusRes.data ?? []);
        setMasterProducts(masters);

        const aggMap: Record<string, StockAggregate> = {};
        for (const unit of rawStock) {
          if (!aggMap[unit.product_id]) {
            aggMap[unit.product_id] = { product_id: unit.product_id, total: 0, no_minus: 0, minus: 0, min_price: null };
          }
          const a = aggMap[unit.product_id];
          a.total++;
          if (unit.condition_status === "no_minus") a.no_minus++; else a.minus++;
          const p = Number(unit.selling_price);
          if (p > 0) a.min_price = a.min_price === null ? p : Math.min(a.min_price, p);
        }

        setStockAgg(Object.values(aggMap));

        // Build series+warranty groups from master products (for both add & edit)
        const { data: existingCats } = await db.from("catalog_products").select("id, catalog_series, catalog_warranty_type");
        const existingCatsList: { id: string; catalog_series: string | null; catalog_warranty_type: string | null }[] = existingCats ?? [];

        // Group masters by series + warranty_group (1 item per series + warranty type)
        const groupMap: Record<string, {
          series: string;
          warrantyGroup: string;
          category: string;
          productIds: string[];
        }> = {};
        for (const m of masters) {
          const wg = getWarrantyGroup(m.warranty_type);
          const key = `${m.series}||${wg}`;
          if (!groupMap[key]) {
            groupMap[key] = { series: m.series, warrantyGroup: wg, category: m.category, productIds: [] };
          }
          groupMap[key].productIds.push(m.id);
        }

        if (isEdit && id) {
          const { data: catData } = await db.from("catalog_products").select("*").eq("id", id).single();
          if (catData) {
            setSelectedId(catData.product_id);
            setDisplayName(catData.display_name);
            setSlug(catData.slug ?? "");
            setSlugEdited(!!catData.slug);
            setShortDesc(catData.short_description ?? "");
            setFullDesc(catData.full_description ?? "");
            setPromoLabel(catData.promo_label ?? "");
            setPromoLabel2(catData.promo_badge ?? "");
            setThumbnail(catData.thumbnail_url);
            const g = [...(catData.gallery_urls ?? [])];
            while (g.length < 8) g.push(null);
            setGallery(g.slice(0, 8) as (string | null)[]);
            setPublishPos(catData.publish_to_pos);
            setPublishWeb(catData.publish_to_web);
            setPublishMarket(catData.publish_to_marketplace);
            setTokopediaUrl(catData.tokopedia_url ?? "");
            setShopeeUrl(catData.shopee_url ?? "");
            setHighlight(catData.highlight_product);
            setShowCondition(catData.show_condition_breakdown);
            setSelectedBranchId(catData.branch_id ?? null);
            setFreeShipping(catData.free_shipping ?? false);
            setShippingDiscountType(catData.shipping_discount_type ?? "none");
            setShippingDiscountValue(catData.shipping_discount_value?.toString() ?? "");
            const raw = catData.bonus_items;
            if (Array.isArray(raw)) {
              setBonusItems(raw.map((b: Record<string, string>) => ({
                id: generateId(), name: b.name ?? "", description: b.description ?? "", icon: b.icon ?? null,
              })));
            }
            setSpecCondition(catData.spec_condition ?? "Bekas");
            setSpecBrand(catData.spec_brand ?? "iPhone Apple");
            setSpecWarrantyDuration(catData.spec_warranty_duration ?? "");
            setSpecScreenProtector(catData.spec_screen_protector_type ?? "Lainnya");
            setSpecCaseType(catData.spec_case_type ?? "Lainnya");
            setSpecCustomProduct(catData.spec_custom_product ?? "Tidak");
            setSpecBuiltInBattery(catData.spec_built_in_battery ?? "Ya");
            setSpecConditionDetail(catData.spec_condition_detail ?? "");
            setSpecCableType(catData.spec_cable_type ?? "");
            setSpecPhoneModel(catData.spec_phone_model ?? "");
            setSpecPostelCert(catData.spec_postel_cert ?? "-");
            setSpecShippedFrom(catData.spec_shipped_from ?? "Kota Surabaya");
            setDiscountActive(catData.discount_active ?? false);
            setDiscountTypeVal(catData.discount_type ?? "percentage");
            setDiscountValueStr(catData.discount_value != null ? String(catData.discount_value) : "");
            setDiscountStartAt(catData.discount_start_at ? catData.discount_start_at.slice(0, 16) : "");
            setDiscountEndAt(catData.discount_end_at ? catData.discount_end_at.slice(0, 16) : "");

            // Load warranty category for this catalog article
            setWarrantyCategory(catData.warranty_category ?? null);

            // Set current group selection for edit mode
            if (catData.catalog_series && catData.catalog_warranty_type) {
              setSelectedGroup(`${catData.catalog_series}||${catData.catalog_warranty_type}`);
            }

            // Build groups: exclude series+warranty used by OTHER catalog items (not this one)
            const existingKeysExcludingSelf = new Set(
              existingCatsList
                .filter((c) => c.catalog_series && c.id !== id)
                .map((c) => `${c.catalog_series}||${c.catalog_warranty_type ?? ""}`)
            );

            const groups = Object.entries(groupMap)
              .filter(([key]) => {
                // Always include this item's own key
                if (key === `${catData.catalog_series}||${catData.catalog_warranty_type ?? ""}`) return true;
                // Exclude keys used by other catalog items
                return !existingKeysExcludingSelf.has(key);
              })
              .map(([key, g]) => {
                const totalStock = g.productIds.reduce((sum, pid) => sum + (aggMap[pid]?.total ?? 0), 0);
                return { ...g, key, totalStock };
              })
              .sort((a, b) => a.series.localeCompare(b.series));

            setSeriesGroups(groups);
          }
        } else {
          // Add mode: exclude series+warranty already in catalog
          const existingKeys = new Set(
            existingCatsList
              .filter((c) => c.catalog_series)
              .map((c) => `${c.catalog_series}||${c.catalog_warranty_type ?? ""}`)
          );

          const groups = Object.entries(groupMap)
            .filter(([key]) => !existingKeys.has(key))
            .map(([key, g]) => {
              const totalStock = g.productIds.reduce((sum, pid) => sum + (aggMap[pid]?.total ?? 0), 0);
              return { ...g, key, totalStock };
            })
            .sort((a, b) => a.series.localeCompare(b.series));

          setSeriesGroups(groups);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, isEdit]);

  const selectedMaster = masterProducts.find(m => m.id === selectedId);
  const selectedAgg = stockAgg.find(a => a.product_id === selectedId);
  const selectedGroupData = seriesGroups.find(g => g.key === selectedGroup);

  // Get unique categories from available groups
  const availableCategories = useMemo(() => {
    const cats = new Set(seriesGroups.map(g => g.category));
    return Array.from(cats).sort();
  }, [seriesGroups]);

  // Filter series groups by selected category
  const filteredSeriesGroups = useMemo(() => {
    if (selectedCategory === "all") return seriesGroups;
    return seriesGroups.filter(g => g.category === selectedCategory);
  }, [seriesGroups, selectedCategory]);

  // Reset selected group when category changes and current group doesn't match
  useEffect(() => {
    if (selectedCategory !== "all" && selectedGroup) {
      const current = seriesGroups.find(g => g.key === selectedGroup);
      if (current && current.category !== selectedCategory) {
        setSelectedGroup("");
        setSelectedId("");
        setDisplayName("");
        setSlug("");
        setSlugEdited(false);
      }
    }
  }, [selectedCategory]);

  // Auto-fill display name when group is selected (both add & edit)
  useEffect(() => {
    if (selectedGroupData && Object.keys(warrantyLabelsMap).length > 0 && masterProducts.length > 0) {
      // Get all unique storages from all products in this group
      const groupProducts = masterProducts.filter(m => selectedGroupData.productIds.includes(m.id));
      const storages = [...new Set(groupProducts.map(m => m.storage_gb).filter(s => s != null))] as number[];
      const sortedStorages = storages.sort((a, b) => a - b);
      const storageText = sortedStorages.map(s => `${s}GB`).join("/");

      // Build display name: "iPhone 11 Basic 64/128/256GB RESMI BEACUKAI FULLSET"
      const displayName = `${selectedGroupData.series} ${storageText} ${selectedGroupData.warrantyGroup} FULLSET`;
      setDisplayName(displayName);

      // Pick first product id from group as representative
      setSelectedId(selectedGroupData.productIds[0] ?? "");
      if (!slugEdited) {
        setSlug(generateSlug(displayName));
      }
    }
  }, [selectedGroup, selectedGroupData, warrantyLabelsMap, masterProducts, slugEdited]);

  // Bonus item handlers
  function addBonus() {
    setBonusItems(prev => [...prev, { id: generateId(), name: "", description: "", icon: null }]);
  }
  function addExistingBonus(record: BonusProductRecord) {
    // Don't add duplicate
    if (bonusItems.some(b => b.name === record.name)) {
      toast({ title: "Bonus sudah ditambahkan", variant: "destructive" });
      return;
    }
    setBonusItems(prev => [...prev, {
      id: generateId(),
      name: record.name,
      description: record.description ?? "",
      icon: record.icon ?? null,
    }]);
    setBonusSearch("");
  }
  function updateBonus(id: string, field: keyof BonusItem, val: string | null) {
    setBonusItems(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));
  }
  function removeBonus(id: string) {
    setBonusItems(prev => prev.filter(b => b.id !== id));
  }

  // Upload bonus icon
  async function handleBonusIconUpload(bonusId: string, file: File) {
    const path = `bonus/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const url = await uploadImage(file, path);
    if (url) updateBonus(bonusId, "icon", url);
  }

  async function handleSave() {
    if (!selectedGroup) {
      toast({ title: "Pilih seri produk terlebih dahulu", variant: "destructive" }); return;
    }
    if (!displayName.trim()) {
      toast({ title: "Nama tampilan wajib diisi", variant: "destructive" }); return;
    }
    // Auto-determine warranty category from selected group
    const determinedWarrantyCategory = getWarrantyCategoryFromGroup(selectedGroupData?.warrantyGroup ?? null);
    setSaving(true);

    const galleryUrls = gallery.filter(Boolean) as string[];
    const bonusJson = bonusItems
      .filter(b => b.name.trim())
      .map(b => ({ name: b.name.trim(), description: b.description.trim(), icon: b.icon ?? null }));

    const payload: Record<string, unknown> = {
      display_name: displayName.trim(),
      slug: slug.trim() || null,
      short_description: shortDesc.trim() || null,
      full_description: fullDesc.trim() || null,
      thumbnail_url: thumbnail,
      gallery_urls: galleryUrls,
      publish_to_pos: publishPos,
      publish_to_web: publishWeb,
      publish_to_marketplace: publishMarket,
      tokopedia_url: publishMarket && tokopediaUrl.trim() ? tokopediaUrl.trim() : null,
      shopee_url: publishMarket && shopeeUrl.trim() ? shopeeUrl.trim() : null,
      highlight_product: highlight,
      promo_label: promoLabel.trim() || null,
      promo_badge: promoLabel2.trim() || null,
      show_condition_breakdown: showCondition,
      free_shipping: shippingDiscountType !== "none",
      shipping_discount_type: shippingDiscountType,
      shipping_discount_value: shippingDiscountType !== "none" && shippingDiscountValue ? Number(shippingDiscountValue) : 0,
      bonus_items: bonusJson,
      updated_by: user?.id,
      spec_condition: specCondition.trim() || null,
      spec_brand: specBrand.trim() || null,
      spec_warranty_duration: specWarrantyDuration.trim() || null,
      spec_screen_protector_type: specScreenProtector.trim() || null,
      spec_case_type: specCaseType.trim() || null,
      spec_custom_product: specCustomProduct.trim() || null,
      spec_built_in_battery: specBuiltInBattery.trim() || null,
      spec_condition_detail: specConditionDetail.trim() || null,
      spec_cable_type: specCableType.trim() || null,
      spec_phone_model: specPhoneModel.trim() || null,
      spec_postel_cert: specPostelCert.trim() || null,
      spec_shipped_from: specShippedFrom.trim() || null,
      // Discount
      discount_active: discountActive,
      discount_type: discountActive ? discountTypeVal : null,
      discount_value: discountActive && discountValueStr ? Number(discountValueStr) : null,
      discount_start_at: discountActive && discountStartAt ? new Date(discountStartAt).toISOString() : null,
      discount_end_at: discountActive && discountEndAt ? new Date(discountEndAt).toISOString() : null,
      branch_id: selectedBranchId || null,
      warranty_category: determinedWarrantyCategory,
    };

    // Always update series/type info from the selected group
    payload.product_id = selectedId || null;
    payload.catalog_series = selectedGroupData?.series ?? null;
    payload.catalog_warranty_type = selectedGroupData?.warrantyGroup ?? null;

    if (!isEdit) {
      payload.catalog_status = "draft";
      payload.price_strategy = "min_price";
      payload.created_by = user?.id;
    }

    const { error } = isEdit
      ? await db.from("catalog_products").update(payload).eq("id", id)
      : await db.from("catalog_products").insert(payload);

    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast({ title: isEdit ? "Slug sudah digunakan produk lain" : "Produk ini sudah ada di katalog", variant: "destructive" });
      } else {
        toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      }
      return;
    }

    await logActivity({
      action: isEdit ? "update_catalog" : "create_catalog",
      actor_id: user?.id, actor_email: user?.email, actor_role: role,
      target_id: isEdit ? id : selectedId,
      metadata: { display_name: displayName.trim() },
    });

    toast({ title: isEdit ? "Perubahan disimpan" : "Produk berhasil ditambahkan ke katalog" });
    navigate("/admin/katalog");
  }

  async function handleDelete() {
    if (!id || !confirm(`Hapus "${displayName}" dari katalog?`)) return;
    await db.from("catalog_products").delete().eq("id", id);
    await logActivity({
      action: "delete_catalog",
      actor_id: user?.id, actor_email: user?.email, actor_role: role,
      target_id: id, metadata: { display_name: displayName },
    });
    toast({ title: "Produk dihapus dari katalog" });
    navigate("/admin/katalog");
  }

  if (loading) {
    return (
      <DashboardLayout pageTitle={isEdit ? "Edit Katalog" : "Tambah Katalog"}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Filtered bonus search results
  const filteredBonusRecords = bonusSearch.trim()
    ? bonusProductRecords.filter(b =>
        b.name.toLowerCase().includes(bonusSearch.toLowerCase()) &&
        !bonusItems.some(bi => bi.name === b.name)
      )
    : [];

  return (
    <DashboardLayout pageTitle={isEdit ? "Edit Katalog" : "Tambah Katalog"}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/katalog")}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              {isEdit ? "Edit Produk Katalog" : "Tambah Produk ke Katalog"}
            </h2>
            <p className="text-base text-muted-foreground mt-0.5">
              {(() => {
                const branch = branches.find(b => b.id === selectedBranchId);
                if (isEdit) return "Perbarui informasi produk yang tampil di katalog.";
                if (branch) return `Tambah produk ke katalog untuk cabang ${branch.name} (${branch.city ?? branch.code})`;
                return "Harga ditarik otomatis dari stok unit tersedia.";
              })()}
            </p>
          </div>
        </div>

        {/* Section: Pilih Kategori & Seri Produk */}
        <Section title="Pilih Produk">
          {isEdit ? (
            <div className="rounded-xl bg-muted/50 border border-border p-4 flex items-center gap-3">
              <Package className="w-5 h-5 shrink-0 text-blue-600" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">{selectedGroupData?.series ?? "Memuat..."}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                    {selectedGroupData?.warrantyGroup ?? "—"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedGroupData?.productIds.length ?? 0} varian · {selectedGroupData?.totalStock ?? 0} unit tersedia
                </p>
              </div>
            </div>
          ) : seriesGroups.length === 0 ? (
            <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm text-muted-foreground flex items-center gap-3">
              <Package className="w-5 h-5 shrink-0" />
              <span className="text-base">Semua seri produk sudah masuk katalog.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kategori</label>
                  <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedGroup(""); }}>
                    <SelectTrigger className="h-11 text-sm">
                      <SelectValue placeholder="Semua Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kategori</SelectItem>
                      {availableCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat as ProductCategory] ?? cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Series + Type selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seri & Tipe</label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger className="h-11 text-sm">
                      <SelectValue placeholder="Pilih seri & tipe…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSeriesGroups.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada seri tersedia</div>
                      ) : (
                        filteredSeriesGroups.map(g => (
                          <SelectItem key={g.key} value={g.key}>
                            {g.series} · {g.warrantyGroup} · {g.totalStock} unit
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedGroupData && (
                <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  {selectedGroupData.productIds.length} varian (warna/kapasitas) · Total {selectedGroupData.totalStock} unit tersedia
                  <span className="ml-2 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                    {selectedGroupData.warrantyGroup}
                  </span>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Tab switcher — pill style */}
        <div className="flex items-center gap-1 shrink-0 border border-border rounded-lg p-0.5 bg-muted/40">
          {[
            { key: "info", label: "Info & Media", icon: FileText },
            { key: "distribution", label: "Distribusi", icon: ShoppingCart },
            { key: "units", label: "Daftar Unit", icon: Package },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  activeTab === tab.key
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content area */}
        {activeTab === "info" && (
          <div className="mt-6 space-y-4">
            {/* Nama & URL */}
            <Section title="Nama & URL Artikel">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nama Artikel" hint="Nama artikel yang tampil di storefront." required>
                  <Input value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Contoh: iPhone 11 Basic 64/128/256GB RESMI BEACUKAI FULLSET" />
                </Field>
                <Field label="Slug URL" hint="URL halaman detail produk.">
                  <div className="flex items-center">
                    <span className="text-xs text-muted-foreground bg-muted border border-border border-r-0 rounded-l-md px-3 h-10 flex items-center shrink-0">/produk/</span>
                    <Input value={slug}
                      onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugEdited(true); }}
                      placeholder="iphone-11-basic-64gb-resmi-bc" className="rounded-l-none" />
                  </div>
                </Field>
              </div>
            </Section>

            {/* Full width: Foto & Media - Left = Cover, Right = Gallery stacked */}
            <Section title="Foto & Media">
              <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
                {/* Left: Cover Photo */}
                <div>
                  <ImageUploadBox label="Foto Cover Utama" hint="Seret atau klik untuk upload."
                    value={thumbnail} onChange={setThumbnail} aspect="aspect-[4/3]" />
                </div>
                {/* Right: Gallery stacked 4x2 */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Galeri Foto <span className="normal-case font-normal">(maks. 8)</span>
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {gallery.map((url, i) => (
                      <ImageUploadBox key={i} value={url}
                        onChange={newUrl => { const g = [...gallery]; g[i] = newUrl; setGallery(g); }}
                        aspect="aspect-square" />
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          </div>
        )}

        {activeTab === "distribution" && (
          <div className="space-y-6 mt-6">
            {/* Branch supply info (read-only, set from katalog page) */}
            {selectedBranchId && (
              <div className="rounded-xl bg-muted/30 border border-border p-4 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Cabang Supply: {branches.find(b => b.id === selectedBranchId)?.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Origin pengiriman: {branches.find(b => b.id === selectedBranchId)?.city ?? "—"} · Sudah ditentukan dari halaman katalog
                  </p>
                </div>
              </div>
            )}

            <Section title="Kanal Distribusi">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "pos", label: "POS / Kasir", icon: Store, value: publishPos, set: setPublishPos },
                    { key: "web", label: "Website", icon: Globe, value: publishWeb, set: setPublishWeb },
                    { key: "market", label: "Marketplace", icon: ShoppingCart, value: publishMarket, set: setPublishMarket },
                  ].map(ch => (
                    <button key={ch.key} type="button" onClick={() => ch.set(!ch.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all text-sm font-medium",
                        ch.value ? "border-foreground bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                      )}>
                      <ch.icon className="w-5 h-5" />
                      {ch.label}
                    </button>
                  ))}
                </div>
                {publishMarket && (
                  <div className="space-y-3 p-4 rounded-xl bg-muted/40 border border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link Marketplace</p>
                    <Field label="Tokopedia" hint="">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#03AC0E" }}>
                          <span className="text-white text-[10px] font-bold">TKP</span>
                        </div>
                        <Input value={tokopediaUrl} onChange={e => setTokopediaUrl(e.target.value)}
                          placeholder="https://tokopedia.com/ivalora/..." />
                      </div>
                    </Field>
                    <Field label="Shopee" hint="">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#EE4D2D" }}>
                          <span className="text-white text-[10px] font-bold">SHP</span>
                        </div>
                        <Input value={shopeeUrl} onChange={e => setShopeeUrl(e.target.value)}
                          placeholder="https://shopee.co.id/ivalora/..." />
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            </Section>

            {isSuperAdmin && (
              <Section title="Pengaturan Tampilan">
                <div className="grid grid-cols-2 gap-3">
                  <ToggleButton active={highlight} onClick={() => setHighlight(!highlight)} icon={Star} label="Produk Unggulan" />
                  <ToggleButton active={showCondition} onClick={() => setShowCondition(!showCondition)} icon={Eye} label="Tampilkan Kondisi" />
                </div>
              </Section>
            )}
          </div>
        )}

        {activeTab === "units" && (
          <div className="mt-6">
            <UnitListTab
              selectedGroup={selectedGroup}
              selectedGroupData={selectedGroupData}
              masterProducts={masterProducts}
              warrantyLabelsMap={warrantyLabelsMap}
              warrantyCategory={warrantyCategory}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pb-8">
          {isEdit && isSuperAdmin && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              <Trash2 className="w-4 h-4 mr-1.5" /> Hapus dari Katalog
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/admin/katalog")} className="ml-auto">
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedGroup}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isEdit ? "Simpan Perubahan" : "Tambah ke Katalog"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ── Unit List Tab ─────────────────────────────────────────────────────────────
interface UnitListTabProps {
  selectedGroup: string;
  selectedGroupData?: { key: string; series: string; productIds: string[]; totalStock: number };
  masterProducts: MasterProduct[];
  warrantyLabelsMap: Record<string, string>;
  warrantyCategory: WarrantyCategory | null;
}

function UnitListTab({ selectedGroup, selectedGroupData, masterProducts, warrantyLabelsMap, warrantyCategory }: UnitListTabProps) {
  const [units, setUnits] = useState<{ id: string; imei: string; product_id: string; received_at: string; stock_status: string; unit_photo_url: string | null; unit_photo_urls: string[]; master_products: { series: string; storage_gb: number; color: string; warranty_type: string } | null }[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGroupData) { setUnits([]); return; }
    setLoadingUnits(true);
    const ids = selectedGroupData.productIds;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("stock_units")
      .select("id, imei, product_id, received_at, stock_status, unit_photo_url, unit_photo_urls, master_products(series, storage_gb, color, warranty_type)")
      .in("product_id", ids)
      .eq("stock_status", "available")
      .order("received_at", { ascending: false })
      .then(({ data }: { data: unknown[] | null }) => {
        const allUnits = (data as typeof units) ?? [];
        // Filter by warranty category if specified
        const filtered = warrantyCategory
          ? allUnits.filter(u => {
              const wt = u.master_products?.warranty_type as keyof typeof WARRANTY_TO_CATEGORY;
              return u.master_products && WARRANTY_TO_CATEGORY[wt] === warrantyCategory;
            })
          : allUnits;
        setUnits(filtered);
        setLoadingUnits(false);
      });
  }, [selectedGroupData, warrantyCategory]);

  async function handlePhotoUpload(unitId: string, file: File, index: number) {
    setUploadingId(unitId);
    const path = `unit-photos/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const url = await uploadImage(file, path);
    if (url) {
      const unit = units.find(u => u.id === unitId);
      const currentUrls = [...(unit?.unit_photo_urls ?? [])];
      currentUrls[index] = url;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("stock_units").update({ 
        unit_photo_urls: currentUrls.filter(Boolean),
        unit_photo_url: currentUrls[0] ?? null, // backward compat
      }).eq("id", unitId);
      setUnits(prev => prev.map(u => u.id === unitId ? { ...u, unit_photo_urls: currentUrls.filter(Boolean) as string[], unit_photo_url: currentUrls[0] ?? null } : u));
    }
    setUploadingId(null);
  }

  async function handleRemovePhoto(unitId: string, index: number) {
    const unit = units.find(u => u.id === unitId);
    const currentUrls = [...(unit?.unit_photo_urls ?? [])];
    currentUrls.splice(index, 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("stock_units").update({ 
      unit_photo_urls: currentUrls,
      unit_photo_url: currentUrls[0] ?? null,
    }).eq("id", unitId);
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, unit_photo_urls: currentUrls, unit_photo_url: currentUrls[0] ?? null } : u));
  }

  if (!selectedGroup) {
    return (
      <Section title="Daftar Unit Terkait">
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Pilih seri produk terlebih dahulu</p>
        </div>
      </Section>
    );
  }

  const storageLabel = (gb: number) => gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;

  return (
    <Section title={`Daftar Unit Tersedia (${units.length})`}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Unit dengan status "Tersedia" yang terkait artikel ini. Hanya foto unit yang bisa diedit di sini.
        </p>
        {loadingUnits ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : units.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Barcode className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Tidak ada unit tersedia untuk artikel ini</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {units.map(u => {
              const m = u.master_products;
              const label = m ? `${m.series} ${storageLabel(m.storage_gb)} ${m.color} ${WARRANTY_LABELS[m.warranty_type as keyof typeof WARRANTY_LABELS] ?? m.warranty_type}` : "—";
              const photos = u.unit_photo_urls?.length > 0 ? u.unit_photo_urls : (u.unit_photo_url ? [u.unit_photo_url] : []);
              return (
                <div key={u.id} className="flex gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors">
                  {/* Unit Photos (up to 3) */}
                  <div className="flex gap-1 shrink-0">
                    {[0, 1, 2].map(i => (
                      <UnitPhotoSlot
                        key={i}
                        unitId={u.id}
                        index={i}
                        photoUrl={photos[i] ?? null}
                        uploading={uploadingId === u.id}
                        onUpload={(id, file) => handlePhotoUpload(id, file, i)}
                        onRemove={(id) => handleRemovePhoto(id, i)}
                      />
                    ))}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{label}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-mono">IMEI: {u.imei}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Masuk: {new Date(u.received_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}

// ── Unit Photo Slot (single slot in 3-photo gallery) ──────────────────────────
function UnitPhotoSlot({ unitId, index, photoUrl, uploading, onUpload, onRemove }: {
  unitId: string; index: number; photoUrl: string | null; uploading: boolean;
  onUpload: (id: string, file: File) => void; onRemove: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden relative"
      onClick={() => fileRef.current?.click()}>
      {uploading ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      ) : photoUrl ? (
        <>
          <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <button type="button" onClick={e => { e.stopPropagation(); onRemove(unitId); }}
            className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 z-10">
            <X className="w-2.5 h-2.5" />
          </button>
        </>
      ) : (
        <Camera className="w-3 h-3 text-muted-foreground/40" />
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(unitId, f); }} />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function ToggleButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        "flex items-center gap-2 text-sm py-2.5 px-3 rounded-lg border transition-colors w-full",
        active ? "border-foreground bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
      )}
    >
      <Icon className={cn("w-4 h-4", active && label === "Produk Unggulan" && "fill-current")} />
      {label}
    </button>
  );
}

// ── Distribution Photos Tab ───────────────────────────────────────────────────
interface DistPhoto {
  id: string;
  catalog_product_id: string;
  distribution: string;
  color: string | null;
  photo_type: "cover" | "color";
  photo_url: string;
  sort_order: number;
}

interface DistPhotosTabProps {
  catalogProductId: string | null;
  selectedSeries: string;
}

const DISTRIBUTIONS = [
  { value: "resmi_bc", label: "Resmi (BC / Beacukai)" },
  { value: "ibox", label: "iBox" },
  { value: "digimap", label: "Digimap" },
  { value: "whitelist", label: "Whitelist" },
  { value: "inter", label: "Inter" },
  { value: "resmi", label: "Resmi" },
];

const COLORS_POHON = [
  "Black", "Blue", "Gold", "Green", "Grey", "Hitam",
  "Midnight", "Natural", "Natural Titanium", "Orange", "Pink",
  "Purple", "Red", "Silver", "Starlight", "White", "Yellow",
];

function DistributionPhotosTab({ catalogProductId, selectedSeries }: DistPhotosTabProps) {
  const { toast } = useToast();
  const [selectedDist, setSelectedDist] = useState("resmi_bc");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coverUrls, setCoverUrls] = useState<(string | null)[]>([null, null, null, null]);
  const [colorUrls, setColorUrls] = useState<Record<string, (string | null)[]>>({});
  const [distPhotos, setDistPhotos] = useState<DistPhoto[]>([]);

  useEffect(() => {
    if (!catalogProductId) return;
    setLoading(true);
    db.from("catalog_distribution_photos")
      .select("*")
      .eq("catalog_product_id", catalogProductId)
      .order("sort_order")
      .then(({ data }: { data: DistPhoto[] | null }) => {
        const list = data ?? [];
        setDistPhotos(list);
        const covers: (string | null)[] = [null, null, null, null];
        const colors: Record<string, (string | null)[]> = {};
        for (const p of list) {
          if (p.photo_type === "cover" && p.color === null) {
            const idx = covers.indexOf(null);
            if (idx !== -1) covers[idx] = p.photo_url;
          } else if (p.photo_type === "color" && p.color) {
            if (!colors[p.color]) colors[p.color] = [null, null, null, null];
            const idx = colors[p.color]!.indexOf(null);
            if (idx !== -1) colors[p.color]![idx] = p.photo_url;
          }
        }
        setCoverUrls(covers);
        setColorUrls(colors);
        setLoading(false);
      });
  }, [catalogProductId]);

  async function savePhotos() {
    if (!catalogProductId) {
      toast({ title: "Simpan produk katalog terlebih dahulu", variant: "destructive" }); return;
    }
    setSaving(true);
    // Delete old for this dist
    await db.from("catalog_distribution_photos").delete()
      .eq("catalog_product_id", catalogProductId).eq("distribution", selectedDist);

    const inserts: Omit<DistPhoto, "id">[] = [];
    coverUrls.forEach((url, i) => {
      if (url) inserts.push({ catalog_product_id: catalogProductId, distribution: selectedDist, color: null, photo_type: "cover", photo_url: url, sort_order: i });
    });
    for (const [color, urls] of Object.entries(colorUrls)) {
      urls.forEach((url, i) => {
        if (url) inserts.push({ catalog_product_id: catalogProductId, distribution: selectedDist, color, photo_type: "color", photo_url: url, sort_order: i });
      });
    }
    if (inserts.length > 0) {
      const { error } = await db.from("catalog_distribution_photos").insert(inserts);
      if (error) { toast({ title: "Gagal menyimpan foto", description: error.message, variant: "destructive" }); setSaving(false); return; }
    }
    const { data } = await db.from("catalog_distribution_photos").select("*")
      .eq("catalog_product_id", catalogProductId).order("sort_order");
    setDistPhotos(data ?? []);
    toast({ title: "Foto distribusi disimpan" });
    setSaving(false);
  }

  if (!catalogProductId) {
    return (
      <Section title="Foto per Distribusi">
        <div className="text-center py-10 text-muted-foreground">
          <ImagePlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Simpan produk katalog terlebih dahulu</p>
          <p className="text-xs mt-1">Tab ini aktif setelah produk ditambahkan.</p>
        </div>
      </Section>
    );
  }

  if (loading) {
    return (
      <Section title="Foto per Distribusi">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </Section>
    );
  }

  return (
    <Section title={`Foto per Distribusi — ${selectedSeries}`}>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Distribusi</label>
          <Select value={selectedDist} onValueChange={setSelectedDist}>
            <SelectTrigger className="h-11 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISTRIBUTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cover */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Foto Cover</p>
                <p className="text-xs text-muted-foreground">Box utama distribusi. Maks. 4 foto.</p>
              </div>
              <span className="text-[11px] text-muted-foreground">{coverUrls.filter(Boolean).length}/4</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {coverUrls.map((url, i) => (
                <ImageUploadBoxDist key={`cover-${i}`} value={url} onChange={newUrl => { const u = [...coverUrls]; u[i] = newUrl; setCoverUrls(u); }} aspect="aspect-square" />
              ))}
            </div>
          </div>

          {/* Warna */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-foreground">Foto per Warna</p>
              <p className="text-xs text-muted-foreground">Box tiap warna. Maks. 4 foto per warna.</p>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {COLORS_POHON.map(color => {
                const urls = colorUrls[color] ?? [null, null, null, null];
                return (
                  <div key={color} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground w-28 truncate">{color}</span>
                      <span className="text-[10px] text-muted-foreground">{urls.filter(Boolean).length}/4</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {urls.map((url, i) => (
                        <div key={i} className="w-16 h-16 shrink-0">
                          <ImageUploadBoxDist
                            value={url}
                            onChange={newUrl => setColorUrls(prev => {
                              const arr = [...(prev[color] ?? [null, null, null, null])];
                              arr[i] = newUrl;
                              return { ...prev, [color]: arr };
                            })}
                            aspect="aspect-square"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button onClick={savePhotos} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Simpan Foto Distribusi
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── ImageUploadBoxDist ─────────────────────────────────────────────────────────
function ImageUploadBoxDist({ value, onChange, aspect = "aspect-square" }: {
  value: string | null; onChange: (url: string | null) => void; aspect?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { uploadFile } = await import("@/lib/upload");
      const path = `catalog/dist/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const result = await uploadFile(file, "products");
      if (result.url) onChange(result.url);
    } finally { setUploading(false); }
  }

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-xl overflow-hidden bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors",
        aspect, dragOver ? "border-foreground bg-accent/50" : "border-border"
      )}
      onClick={() => fileRef.current?.click()}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) handleFile(f); }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      {value ? (
        <>
          <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <button type="button" onClick={e => { e.stopPropagation(); onChange(null); }}
            className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition">
            <X className="w-3 h-3" />
          </button>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}
