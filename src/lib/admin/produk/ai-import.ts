/**
 * AI Import — client-side implementation
 * Menggunakan Gemini API (Google AI Studio) untuk normalisasi nama produk
 * dan Supabase client langsung untuk DB operations.
 */

import { supabase } from "@/integrations/supabase/client";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${GEMINI_API_KEY}`;

// ── Tipe ──────────────────────────────────────────────────────────────────────
export type ImportType = "imei" | "serial_number" | "qty";

export interface ImportResult {
  total_rows: number;
  imported: number;
  new_products_created: number;
  duplicates_merged: number;
  errors: string[];
  ai_warnings: string[];
  new_labels_created?: string[];
  duplicate_imeis_db?: { imei: string; csv_status: string; db_status: string; product_label: string }[];
  duplicate_imeis_csv?: { imei: string; status: string; count: number }[];
}

export interface NewLabelInfo {
  key: string;
  count: number;
}

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.every((v) => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { if (h) row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// ── Flexible column finder ────────────────────────────────────────────────────
function col(row: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    const key = Object.keys(row).find((k) => k.toLowerCase().trim() === a.toLowerCase());
    if (key !== undefined) return row[key]?.trim() ?? "";
  }
  return "";
}

// ── Normalizers ───────────────────────────────────────────────────────────────
export function parsePrice(v: string): number | null {
  if (!v) return null;
  const num = v.replace(/[^0-9]/g, "");
  return num ? parseInt(num) : null;
}

function parseStorage(v: string): number | null {
  if (!v) return null;
  const tb = v.match(/(\d+)\s*tb/i);
  if (tb) return parseInt(tb[1]) * 1024;
  const gb = v.match(/(\d+)\s*gb/i);
  if (gb) return parseInt(gb[1]);
  return null;
}

// Valid enum values: ibox | resmi_bc | whitelist | digimap | inter | resmi | null
function normalizeWarranty(v: string): string | null {
  const s = v.toLowerCase().trim();
  if (!s || s === "-") return null;
  if (s.includes("ibox")) return "ibox";
  if (s.includes("digimap")) return "digimap";
  if (s.includes("whitelist")) return "whitelist";
  if (s.includes("resmi bc") || s.includes("resmi_bc")) return "resmi_bc";
  if (s.includes("inter") || s === "international") return "inter";
  if (s.includes("resmi") || s.includes("resmi indo")) return "resmi";
  return null;
}

function normalizeCondition(v: string): string {
  const s = v.toLowerCase().trim();
  if ((s.includes("ada") && s.includes("minus")) || s === "minus") return "minus";
  return "no_minus";
}

const STATUS_MAP: Record<string, string> = {
  sold: "sold", terjual: "sold",
  available: "available", tersedia: "available", "baru masuk": "available",
  dipesan: "reserved", reserved: "reserved",
  "coming soon": "coming_soon", coming_soon: "coming_soon",
  service: "service",
  repair: "repair", perbaikan: "repair",
  hilang: "lost", lost: "lost",
  retur: "return", return: "return",
};

// Status yang boleh tidak punya IMEI/SN (unit belum ada fisiknya)
const NO_IMEI_STATUSES = new Set(["coming_soon", "service", "repair"]);

function normalizeStatus(statusJual: string): string {
  const s = statusJual.toLowerCase().trim();
  if (!s) return "available";
  if (s === "terjual" || s === "sold") return "sold";
  return STATUS_MAP[s] ?? "available";
}

function parseDate(v: string): string | null {
  if (!v) return null;
  try {
    const p = v.split("/");
    if (p.length === 3) {
      const d = new Date(`${p[2]}-${p[0].padStart(2, "0")}-${p[1].padStart(2, "0")}`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (_) { /**/ }
  return null;
}

// ── Gemini: normalize product names ──────────────────────────────────────────
async function normalizeProductNames(
  names: string[]
): Promise<Map<string, { series: string; category: string }>> {
  const makeFallback = (n: string) => ({
    series: n.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
    category: n.toLowerCase().includes("iphone") ? "iphone"
      : n.toLowerCase().includes("ipad") ? "ipad"
      : n.toLowerCase().includes("macbook") ? "macbook"
      : n.toLowerCase().includes("watch") ? "watch"
      : n.toLowerCase().includes("airpods") ? "airpods"
      : "accessory",
  });

  const fallback = new Map(names.map((n) => [n, makeFallback(n)]));
  if (!GEMINI_API_KEY || names.length === 0) return fallback;

  try {
    const prompt = `Normalize nama produk Apple/gadget ke format resmi. Kembalikan JSON array saja, tanpa markdown.

Aturan:
- "iphone 11" → {"original":"iphone 11","series":"iPhone 11","category":"iphone"}
- "ipad A16 (gen-11)" / "ipad gen 11" → series: "iPad (Gen 11)", category: "ipad"
- "macbook air m2" → series: "MacBook Air M2", category: "macbook"
- "airpods pro 2" → series: "AirPods Pro 2", category: "airpods"
- "apple watch s9" / "watch series 9" → series: "Apple Watch Series 9", category: "watch"
- Aksesoris non-Apple: category = "accessory", series = nama aslinya (title case)

Input: ${JSON.stringify(names)}

Return JSON array:`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
    });

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean) as { original: string; series: string; category: string }[];

    const map = new Map<string, { series: string; category: string }>();
    for (const r of parsed) {
      // Gemini kadang return null/undefined series — pakai fallback jika itu terjadi
      if (r.series) {
        map.set(r.original, { series: r.series, category: r.category ?? "iphone" });
      }
    }
    for (const n of names) if (!map.has(n)) map.set(n, fallback.get(n)!);
    return map;
  } catch (e) {
    console.warn("Gemini normalize error:", e);
    return fallback;
  }
}

// ── Analyze: cari label status baru ──────────────────────────────────────────
export async function analyzeCSVForImport(csv: string): Promise<{ new_labels: NewLabelInfo[] }> {
  const rows = parseCSV(csv);
  const { data: existingLabels } = await supabase.from("stock_status_labels").select("key");
  const knownKeys = new Set(existingLabels?.map((l) => l.key) ?? []);

  const statusCount = new Map<string, number>();
  for (const row of rows) {
    const s = normalizeStatus(col(row, "status penjualan"));
    if (!knownKeys.has(s)) statusCount.set(s, (statusCount.get(s) ?? 0) + 1);
  }

  return {
    new_labels: [...statusCount.entries()].map(([key, count]) => ({ key, count })),
  };
}

// ── Import utama ──────────────────────────────────────────────────────────────
export async function importStockFromCSV(params: {
  csv: string;
  branch_id: string;
  import_type: ImportType;
  delete_existing: boolean;
  create_new_labels: boolean;
  onProgress?: (pct: number) => void;
}): Promise<ImportResult> {
  const { csv, branch_id, import_type, delete_existing, create_new_labels, onProgress } = params;

  const rows = parseCSV(csv);
  if (rows.length === 0) throw new Error("File tidak mengandung data.");

  onProgress?.(5);

  // 1. Unique series names for Gemini
  const seriesSet = new Set<string>();
  for (const row of rows) {
    const s = col(row, "seri", "series", "nama produk");
    if (s) seriesSet.add(s);
  }
  const nameMap = await normalizeProductNames([...seriesSet]);
  onProgress?.(20);

  // 2. Load existing master_products
  const { data: existingProducts } = await supabase
    .from("master_products")
    .select("id, series, storage_gb, color, warranty_type, category")
    .eq("is_active", true)
    .is("deleted_at", null);

  const productCache = new Map<string, string>();
  for (const p of existingProducts ?? []) {
    productCache.set(
      `${p.series}|${p.storage_gb ?? ""}|${(p.color ?? "").toLowerCase()}|${p.warranty_type ?? ""}`,
      p.id
    );
  }

  // 3. Load status labels
  const { data: statusLabelsData } = await supabase.from("stock_status_labels").select("key");
  const knownStatuses = new Set(
    statusLabelsData?.map((l) => l.key) ?? ["available", "sold", "reserved", "coming_soon", "service", "lost", "return"]
  );

  // 4. Create new status labels if requested
  if (create_new_labels) {
    const toCreate = new Set<string>();
    for (const row of rows) {
      const s = normalizeStatus(col(row, "status penjualan"));
      if (!knownStatuses.has(s)) toCreate.add(s);
    }
    for (const key of toCreate) {
      await supabase.from("stock_status_labels").insert({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        color_hue: 200, color_saturation: 60, color_lightness: 50,
        sort_order: 99, is_active: true, is_system: false,
      } as never);
      knownStatuses.add(key);
    }
  }

  // 5. Delete existing
  if (delete_existing && branch_id) {
    await supabase.from("stock_units").delete().eq("branch_id", branch_id);
  }

  // 6. Load existing IMEIs
  const { data: existingIMEIRows } = await supabase
    .from("stock_units").select("imei").not("imei", "is", null);
  const dbIMEISet = new Set<string>(
    delete_existing ? [] : existingIMEIRows?.map((u) => u.imei as string).filter(Boolean) ?? []
  );
  const csvIMEISet = new Set<string>(); // IMEI yang sudah diproses dari CSV ini

  onProgress?.(30);

  const errors: string[] = [];
  const duplicateIMEIsDB: { imei: string; csv_status: string; db_status: string; product_label: string }[] = [];
  const duplicateIMEIsCSV: { imei: string; status: string; count: number }[] = [];
  const unitBatch: Record<string, unknown>[] = [];
  let newProductsCreated = 0;

  const getOrCreateProduct = async (
    seriesRaw: string, storage: number | null, color: string | null, warranty: string | null, cat: string
  ): Promise<string | null> => {
    const norm = nameMap.get(seriesRaw) ?? { series: seriesRaw, category: cat };
    const colorLower = (color ?? "").toLowerCase();
    const cacheKey = `${norm.series}|${storage ?? ""}|${colorLower}|${warranty ?? ""}`;
    if (productCache.has(cacheKey)) return productCache.get(cacheKey)!;

    // First try to find existing product in DB (avoids unique constraint conflicts)
    {
      let q = (supabase.from("master_products").select("id").eq("series", norm.series).is("deleted_at", null)) as any;
      if (warranty === null) q = q.is("warranty_type", null); else q = q.eq("warranty_type", warranty);
      if (storage === null) q = q.is("storage_gb", null); else q = q.eq("storage_gb", storage);
      if (!color) q = q.is("color", null); else q = q.ilike("color", color);
      const { data: preExisting } = await q.limit(1);
      if (preExisting?.[0]) {
        productCache.set(cacheKey, (preExisting[0] as any).id);
        return (preExisting[0] as any).id;
      }
    }

    const { data: newProd, error } = await supabase.from("master_products").insert({
      series: norm.series, storage_gb: storage, color: color || null,
      warranty_type: warranty, category: norm.category, is_active: true,
    } as never).select("id").single();
    if (error) {
      // Last-resort: broader search by series only, take first match
      const { data: fallback } = await (supabase.from("master_products").select("id").eq("series", norm.series).is("deleted_at", null) as any).limit(1);
      if (fallback?.[0]) {
        productCache.set(cacheKey, (fallback[0] as any).id);
        return (fallback[0] as any).id;
      }
      console.error("master_products insert error:", error.message, { series: norm.series, storage, color, warranty });
      return null;
    }
    productCache.set(cacheKey, (newProd as any).id);
    newProductsCreated++;
    return (newProd as any).id;
  };

  // 7. Process rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    onProgress?.(30 + Math.floor((i / rows.length) * 50));

    try {
      if (import_type === "imei" || import_type === "serial_number") {
        // Baca status dulu — menentukan apakah IMEI wajib
        const rawStatus = normalizeStatus(col(row, "status penjualan"));
        const finalStatus = knownStatuses.has(rawStatus) ? rawStatus : "available";
        const allowNoId = NO_IMEI_STATUSES.has(rawStatus);

        const identifier = col(row, "imei", "serial number", "sn");
        const hasValidId = !!identifier && identifier.length >= 5;

        if (!hasValidId) {
          if (!allowNoId) {
            if (identifier) errors.push(`Baris ${rowNum}: IMEI tidak valid "${identifier}"`);
            continue;
          }
          // allowNoId: lanjut tanpa IMEI (unit belum ada fisiknya)
        }

        // Cek duplikat — hanya untuk unit yang punya IMEI
        if (hasValidId) {
          if (!delete_existing && dbIMEISet.has(identifier)) {
            duplicateIMEIsDB.push({ imei: identifier, csv_status: finalStatus, db_status: "existing", product_label: col(row, "seri", "series") });
            continue;
          }
          if (csvIMEISet.has(identifier)) {
            const ex = duplicateIMEIsCSV.find(d => d.imei === identifier);
            if (ex) ex.count++; else duplicateIMEIsCSV.push({ imei: identifier, status: finalStatus, count: 2 });
            continue;
          }
          csvIMEISet.add(identifier);
        }

        const seriesRaw = col(row, "seri", "series");
        const storage = parseStorage(col(row, "penyimpanan", "penyimpanan (gb)", "storage"));
        const color = col(row, "warna", "color") || null;
        const warranty = normalizeWarranty(col(row, "garansi", "tipe garansi", "warranty"));
        const norm = nameMap.get(seriesRaw) ?? { series: seriesRaw, category: "iphone" };

        const productId = await getOrCreateProduct(seriesRaw, storage, color, warranty, norm.category);
        if (!productId) { errors.push(`Baris ${rowNum}: Gagal membuat produk "${seriesRaw}"`); continue; }

        unitBatch.push({
          product_id: productId,
          branch_id: branch_id || null,
          imei: hasValidId ? identifier : null,
          condition_status: normalizeCondition(col(row, "kondisi", "condition")),
          selling_price: parsePrice(col(row, "harga", "harga jual", "price")),
          stock_status: finalStatus,
          sold_at: finalStatus === "sold"
            ? (parseDate(col(row, "tanggal terjual", "sold date")) ?? new Date().toISOString()) : null,
          received_at: parseDate(col(row, "tanggal masuk stok", "tanggal masuk", "tgl masuk")) ?? new Date().toISOString(),
          status_changed_at: new Date().toISOString(),
          notes: col(row, "catatan", "notes") || null,
        });

      } else if (import_type === "qty") {
        const merk = col(row, "merk", "brand", "merek");
        const namaRaw = col(row, "nama produk", "product", "nama");
        const fullName = merk && namaRaw ? `${merk} ${namaRaw}` : namaRaw || merk;
        if (!fullName.trim()) { errors.push(`Baris ${rowNum}: Nama produk kosong`); continue; }

        const qty = parseInt(col(row, "jumlah stok", "qty", "quantity", "stock")) || 0;
        const productId = await getOrCreateProduct(fullName, null, null, "no_warranty", "accessory");
        if (!productId) { errors.push(`Baris ${rowNum}: Gagal membuat produk "${fullName}"`); continue; }

        unitBatch.push({
          product_id: productId,
          branch_id: branch_id || null,
          qty_available: qty,
          selling_price: parsePrice(col(row, "harga jual", "harga", "price")),
          stock_status: "available",
          received_at: parseDate(col(row, "tgl update stok", "tanggal masuk", "date")) ?? new Date().toISOString(),
          status_changed_at: new Date().toISOString(),
          notes: col(row, "catatan", "notes") || null,
        });
      }
    } catch (e: unknown) {
      errors.push(`Baris ${rowNum}: ${(e as Error).message}`);
    }
  }

  onProgress?.(85);

  // 8. Batch upsert — ignoreDuplicates skips rows with duplicate IMEI instead of failing whole batch
  // Pisah imei-based dan qty-based karena keys berbeda (Supabase REST butuh keys seragam per batch)
  const imeiBatch = unitBatch.filter((u) => (u as any).imei);
  const qtyBatch  = unitBatch.filter((u) => !(u as any).imei);

  let imported = 0;
  const BATCH = 50;

  // Insert IMEI units
  for (let i = 0; i < imeiBatch.length; i += BATCH) {
    const chunk = imeiBatch.slice(i, i + BATCH);
    const { data: inserted, error } = await (supabase
      .from("stock_units") as any)
      .upsert(chunk, { onConflict: "imei", ignoreDuplicates: true })
      .select("id");
    if (error) errors.push(`Insert error (batch ${Math.floor(i / BATCH) + 1}): ${error.message}`);
    else imported += inserted?.length ?? 0;
  }

  // Insert qty units — fallback tanpa qty_available jika kolom belum ada di DB
  for (let i = 0; i < qtyBatch.length; i += BATCH) {
    const chunk = qtyBatch.slice(i, i + BATCH);
    const { data: inserted, error } = await (supabase
      .from("stock_units") as any)
      .insert(chunk)
      .select("id");
    if (error) {
      if (error.message?.includes("qty_available")) {
        // Kolom qty_available belum ada di DB ini — insert tanpa field tersebut
        const chunkWithoutQty = chunk.map(({ qty_available: _, ...rest }: any) => rest);
        const { data: ins2, error: err2 } = await (supabase
          .from("stock_units") as any)
          .insert(chunkWithoutQty)
          .select("id");
        if (err2) errors.push(`Insert qty error: ${err2.message}`);
        else imported += ins2?.length ?? 0;
      } else {
        errors.push(`Insert qty error (batch ${Math.floor(i / BATCH) + 1}): ${error.message}`);
      }
    } else {
      imported += inserted?.length ?? 0;
    }
  }

  onProgress?.(100);

  return {
    total_rows: rows.length,
    imported,
    new_products_created: newProductsCreated,
    duplicates_merged: duplicateIMEIsDB.length + duplicateIMEIsCSV.length,
    errors: errors.slice(0, 50),
    ai_warnings: [],
    duplicate_imeis_db: duplicateIMEIsDB,
    duplicate_imeis_csv: duplicateIMEIsCSV,
  };
}
