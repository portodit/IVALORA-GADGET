// ── Shared constants & helpers for Master Data Produk ──────────────────────

export type ProductCategory = "iphone" | "ipad" | "accessory" | "macbook" | "watch" | "airpods";
export type WarrantyType = "resmi_bc" | "ibox" | "inter" | "whitelist" | "digimap" | "resmi";

/**
 * Warranty category for catalog grouping.
 * resmi_bc: Bea Cukai / Official Import
 * resmi_indonesia: iBox, Digimap, Blibli, dll
 * inter: International
 * whitelist: Whitelist Terdaftar
 */
export type WarrantyCategory = "resmi_bc" | "resmi_indonesia" | "inter" | "whitelist";

export const WARRANTY_CATEGORY_LABELS: Record<WarrantyCategory, string> = {
  resmi_bc: "Resmi BC (Bea Cukai)",
  resmi_indonesia: "Resmi Indonesia",
  inter: "Inter",
  whitelist: "Whitelist",
};

/** Map warranty_type ke warranty_category */
export const WARRANTY_TO_CATEGORY: Record<WarrantyType, WarrantyCategory> = {
  resmi_bc: "resmi_bc",
  ibox: "resmi_indonesia",
  digimap: "resmi_indonesia",
  resmi: "resmi_indonesia",
  inter: "inter",
  whitelist: "whitelist",
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  macbook: "MacBook",
  watch: "Apple Watch",
  airpods: "AirPods",
  accessory: "Aksesoris",
};

export const WARRANTY_LABELS: Record<WarrantyType, string> = {
  resmi_bc: "Resmi BC",
  ibox: "Resmi iBox",
  inter: "Inter",
  whitelist: "Whitelist",
  digimap: "Resmi Digimap",
  resmi: "Resmi",
};

export const WARRANTY_LABELS_LONG: Record<WarrantyType, string> = {
  resmi_bc: "Resmi Bea Cukai (BC)",
  ibox: "Resmi Indonesia (iBox)",
  inter: "Internasional (Inter)",
  whitelist: "Whitelist Terdaftar",
  digimap: "Resmi Indonesia (Digimap)",
  resmi: "Resmi Apple Indonesia",
};

export const STORAGE_OPTIONS = [16, 32, 64, 128, 256, 512, 1024, 2048];

export const WATCH_SIZE_OPTIONS = [38, 40, 41, 42, 44, 45, 46, 49];

/** Kategori yang warranty-nya selalu "Resmi" (tidak bisa diubah user) */
export const FIXED_RESMI_CATEGORIES: ProductCategory[] = ["ipad", "macbook", "watch", "airpods"];

/** Kategori yang memiliki atribut storage */
export const HAS_STORAGE_CATEGORIES: ProductCategory[] = ["iphone", "ipad", "macbook"];

/** Kategori yang memiliki atribut warna */
export const HAS_COLOR_CATEGORIES: ProductCategory[] = ["iphone", "ipad", "macbook", "watch"];

/** Kategori yang memiliki atribut ukuran (size_mm) */
export const HAS_SIZE_CATEGORIES: ProductCategory[] = ["watch"];

/** Kategori yang menggunakan IMEI (iPhone only — Ivalora tidak jual Android) */
export const IMEI_STOCK_CATEGORIES: ProductCategory[] = ["iphone"];

/** Kategori yang menggunakan Serial Number (iPad, MacBook, Watch, AirPods) */
export const SERIAL_STOCK_CATEGORIES: ProductCategory[] = ["ipad", "macbook", "watch", "airpods"];

/** Semua kategori unit-tracked (IMEI + Serial) — bukan aksesoris */
export const UNIT_TRACKED_CATEGORIES: ProductCategory[] = ["iphone", "ipad", "macbook", "watch", "airpods"];

export interface MasterProduct {
  id: string;
  category: ProductCategory;
  series: string;
  storage_gb: number | null;
  color: string | null;
  size_mm: number | null;
  warranty_type: WarrantyType | null;
  base_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  weight_gram: number | null;
}

/** Helper: format storage untuk tampilan */
export function formatStorage(gb: number | null): string {
  if (!gb) return "—";
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

/** Helper: format ukuran Watch */
export function formatSize(mm: number | null): string {
  if (!mm) return "—";
  return `${mm}mm`;
}
