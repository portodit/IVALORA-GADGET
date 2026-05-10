// ── Shared constants & helpers for Manajemen Stok Produk ──────────────────────

import type { ProductCategory } from "@/lib/admin/produk/master-products";
import { IMEI_STOCK_CATEGORIES, SERIAL_STOCK_CATEGORIES } from "@/lib/admin/produk/master-products";

export type ConditionStatus = "no_minus" | "minus";
export type MinusSeverity = "minor" | "mayor";
export type SoldChannel = "pos" | "ecommerce_tokopedia" | "ecommerce_shopee" | "website" | "offline_non_pos";

// Channels allowed for manual entry via Tambah Stok form (NOT pos, NOT website)
export const TAMBAH_STOK_CHANNELS: SoldChannel[] = ["ecommerce_tokopedia", "ecommerce_shopee", "offline_non_pos"];
export const ECOMMERCE_CHANNELS: SoldChannel[] = ["ecommerce_tokopedia", "ecommerce_shopee"];

// ─── Tipe Tracking ────────────────────────────────────────────
export type StockTrackingType = "imei" | "serial_number" | "qty";

// Dynamic status label from DB
export interface StatusLabel {
  id: string;
  key: string;
  label: string;
  color_hue: number;
  color_saturation: number;
  color_lightness: number;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

// Legacy fallback labels (used if DB labels not yet loaded)
export const FALLBACK_STATUS_LABELS: Record<string, string> = {
  available: "Tersedia",
  reserved: "Dipesan",
  coming_soon: "Coming Soon",
  service: "Service",
  sold: "Terjual",
  return: "Retur",
  lost: "Hilang",
};

export const CONDITION_LABELS: Record<ConditionStatus, string> = {
  no_minus: "No Minus",
  minus: "Minus",
};

export const MINUS_SEVERITY_LABELS: Record<MinusSeverity, string> = {
  minor: "Minor",
  mayor: "Mayor",
};

export const SOLD_CHANNEL_LABELS: Record<SoldChannel, string> = {
  pos: "Terjual Offline Store (POS)",
  ecommerce_tokopedia: "Terjual Online (Tokopedia)",
  ecommerce_shopee: "Terjual Online (Shopee)",
  website: "Terjual Online (Website)",
  offline_non_pos: "Terjual Offline (Tanpa POS)",
};

export const SOLD_CHANNEL_SHORT: Record<SoldChannel, string> = {
  pos: "Offline Store (POS)",
  ecommerce_tokopedia: "Online (Tokopedia)",
  ecommerce_shopee: "Online (Shopee)",
  website: "Online (Website)",
  offline_non_pos: "Offline (Tanpa POS)",
};

// Generate dynamic styles from status label colors
export function getStatusStyles(label: StatusLabel) {
  const h = label.color_hue;
  const s = label.color_saturation;
  const l = label.color_lightness;
  return {
    bg: `hsl(${h} ${s}% 95%)`,
    text: `hsl(${h} ${s}% 28%)`,
    dot: `hsl(${h} ${s}% ${l}%)`,
    border: `hsl(${h} ${s}% ${l}%)`,
  };
}

// Get label text from status labels array
export function getStatusLabel(key: string, statusLabels: StatusLabel[]): string {
  const found = statusLabels.find(s => s.key === key);
  return found?.label ?? FALLBACK_STATUS_LABELS[key] ?? key;
}

export const CONDITION_STYLES: Record<ConditionStatus, { bg: string; text: string }> = {
  no_minus: {
    bg: "bg-[hsl(var(--status-no-minus-bg))]",
    text: "text-[hsl(var(--status-no-minus-fg))]",
  },
  minus: {
    bg: "bg-[hsl(var(--status-minus-bg))]",
    text: "text-[hsl(var(--status-minus-fg))]",
  },
};

// ─── Interface Utama — diperbarui ─────────────────────────────
export interface StockUnit {
  id: string;
  product_id: string;

  // IMEI-tracked (iPhone): imei terisi, serial_number null
  // Serial-tracked (iPad, MacBook, Watch, AirPods): serial_number terisi, imei null
  // Qty-tracked (Aksesoris): keduanya null
  imei: string | null;
  serial_number: string | null;

  // Untuk Qty-tracked (aksesoris): jumlah stok agregat
  qty_available: number | null;
  // Harga modal per pcs untuk aksesoris
  cost_price_per_unit: number | null;

  condition_status: ConditionStatus | null;
  minus_severity: MinusSeverity | null;
  minus_description: string | null;
  selling_price: number | null;
  cost_price: number | null;
  stock_status: string;
  sold_channel: SoldChannel | null;
  sold_reference_id: string | null;
  reserved_at: string | null;
  sold_at: string | null;
  status_changed_at: string;
  received_at: string;
  estimated_arrival_at: string | null;
  supplier: string | null;
  supplier_id: string | null;
  // batch_code tetap ada di DB (data lama), tidak diisi di form baru
  batch_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  branch_id?: string | null;

  // Join fields
  master_products?: {
    series: string;
    storage_gb: number | null;
    color: string | null;
    warranty_type: string;
    category: ProductCategory;
    weight_gram?: number | null;
  } | null;
}

export interface StockUnitLog {
  id: string;
  unit_id: string;
  changed_at: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
}

// ─── Helper Functions (Single Source of Truth) ────────────────

/**
 * Menentukan tipe tracking stok berdasarkan kategori produk.
 * Fungsi ini adalah sumber kebenaran tunggal untuk logika kategori.
 */
export function getTrackingType(category: ProductCategory): StockTrackingType {
  if (IMEI_STOCK_CATEGORIES.includes(category)) return "imei";
  if (category === "accessory") return "qty";
  // ipad, macbook, watch, airpods → serial_number
  return "serial_number";
}

/**
 * Mendapatkan label identifier yang tepat berdasarkan kategori.
 */
export function getIdentifierLabel(category: ProductCategory): string {
  const type = getTrackingType(category);
  if (type === "imei") return "IMEI";
  if (type === "serial_number") return "Serial Number";
  return "—";
}

/**
 * Mendapatkan nilai identifier dari unit stok (IMEI atau Serial Number).
 */
export function getUnitIdentifier(unit: StockUnit | null | undefined): string | null {
  if (!unit) return null;
  if (unit.imei) return unit.imei;
  if (unit.serial_number) return unit.serial_number;
  return null;
}

/**
 * Menentukan apakah unit ini adalah unit individual (bukan qty-tracked).
 */
export function isUnitTracked(unit: StockUnit): boolean {
  return unit.imei !== null || unit.serial_number !== null;
}

/**
 * Mendapatkan label identifier adaptif berdasarkan filter kategori aktif.
 * Digunakan untuk header kolom tabel.
 */
export function getAdaptiveIdentifierLabel(activeCategories: ProductCategory[] | null): string {
  if (!activeCategories || activeCategories.length === 0) return "IMEI / Serial";
  const hasImei = activeCategories.some(c => IMEI_STOCK_CATEGORIES.includes(c));
  const hasSerial = activeCategories.some(c => SERIAL_STOCK_CATEGORIES.includes(c));
  if (hasImei && !hasSerial) return "IMEI";
  if (hasSerial && !hasImei) return "Serial Number";
  return "IMEI / Serial";
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr));
}
