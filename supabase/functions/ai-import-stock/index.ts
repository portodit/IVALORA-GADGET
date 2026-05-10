import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
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
function parsePrice(v: string): number | null {
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

function normalizeWarranty(v: string): string {
  const s = v.toLowerCase().trim();
  if (s.includes("ibox") || s === "resmi ibox") return "ibox";
  if (s.includes("bc") || s === "resmi bc") return "bc";
  if (s.includes("inter") || s === "international") return "inter";
  if (s.includes("tam")) return "tam";
  return "no_warranty";
}

function normalizeCondition(v: string): string {
  const s = v.toLowerCase().trim();
  if (s.includes("minus") && (s.includes("ada") || s === "minus")) return "minus";
  return "no_minus";
}

const STATUS_MAP: Record<string, string> = {
  sold: "sold", terjual: "sold",
  available: "available", tersedia: "available", "baru masuk": "available",
  dipesan: "reserved", reserved: "reserved",
  "coming soon": "coming_soon", coming_soon: "coming_soon",
  service: "service",
  hilang: "lost", lost: "lost",
  retur: "return", return: "return",
};

function normalizeStatus(statusJual: string, statusStok: string): string {
  if (statusJual.toLowerCase().trim() === "sold") return "sold";
  return STATUS_MAP[statusStok.toLowerCase().trim()] ?? "available";
}

function parseDate(v: string): string | null {
  if (!v) return null;
  try {
    const p = v.split("/");
    if (p.length === 3) {
      // Excel US format MM/DD/YYYY
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
  const fallback = new Map(
    names.map((n) => [n, {
      series: n.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
      category: n.toLowerCase().includes("iphone") ? "iphone"
        : n.toLowerCase().includes("ipad") ? "ipad"
        : n.toLowerCase().includes("macbook") ? "macbook"
        : n.toLowerCase().includes("watch") ? "watch"
        : n.toLowerCase().includes("airpods") ? "airpods"
        : n.toLowerCase().includes("samsung") ? "samsung"
        : "accessory",
    }])
  );

  if (!GEMINI_API_KEY || names.length === 0) return fallback;

  try {
    const prompt = `Normalize nama produk Apple/gadget ke format resmi. Kembalikan JSON array saja, tanpa markdown.

Aturan:
- "iphone 11" → {"original":"iphone 11","series":"iPhone 11","category":"iphone"}
- "ipad A16 (gen-11)" / "ipad gen 11" → {"original":"...","series":"iPad (Gen 11)","category":"ipad"}
- "macbook air m2" → {"original":"...","series":"MacBook Air M2","category":"macbook"}
- "airpods pro 2" → {"original":"...","series":"AirPods Pro 2","category":"airpods"}
- "apple watch series 9" / "watch s9" → {"original":"...","series":"Apple Watch Series 9","category":"watch"}
- "samsung galaxy s24" → {"original":"...","series":"Samsung Galaxy S24","category":"samsung"}
- Aksesoris non-Apple: category = "accessory"

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
    for (const r of parsed) map.set(r.original, { series: r.series, category: r.category });
    // Fill any missing with fallback
    for (const n of names) if (!map.has(n)) map.set(n, fallback.get(n)!);
    return map;
  } catch (e) {
    console.error("Gemini error:", e);
    return fallback;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { csv, branch_id, mode, import_type, delete_existing, create_new_labels } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rows = parseCSV(csv);
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "File tidak mengandung data." }), {
        status: 400, headers: CORS,
      });
    }

    // ── ANALYZE MODE ──────────────────────────────────────────────────────────
    if (mode === "analyze") {
      const { data: existingLabels } = await supabase.from("stock_status_labels").select("key");
      const knownKeys = new Set(existingLabels?.map((l: any) => l.key) ?? []);

      const statusCount = new Map<string, number>();
      for (const row of rows) {
        const s = normalizeStatus(
          col(row, "status penjualan"),
          col(row, "status stok", "status")
        );
        if (!knownKeys.has(s)) statusCount.set(s, (statusCount.get(s) ?? 0) + 1);
      }

      const new_labels = [...statusCount.entries()].map(([key, count]) => ({ key, count }));
      return new Response(JSON.stringify({ new_labels }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── IMPORT MODE ───────────────────────────────────────────────────────────

    // 1. Unique series names for Gemini
    const seriesSet = new Set<string>();
    for (const row of rows) {
      const s = col(row, "seri", "series", "nama produk");
      if (s) seriesSet.add(s);
    }
    const nameMap = await normalizeProductNames([...seriesSet]);

    // 2. Load existing master_products
    const { data: existingProducts } = await supabase
      .from("master_products")
      .select("id, series, storage_gb, color, warranty_type, category")
      .eq("is_active", true)
      .is("deleted_at", null);

    const productCache = new Map<string, string>();
    for (const p of existingProducts ?? []) {
      productCache.set(`${p.series}|${p.storage_gb ?? ""}|${(p.color ?? "").toLowerCase()}|${p.warranty_type}`, p.id);
    }

    // 3. Load status labels
    const { data: statusLabelsData } = await supabase.from("stock_status_labels").select("key");
    const knownStatuses = new Set(statusLabelsData?.map((l: any) => l.key) ?? ["available","sold","reserved","coming_soon","service","lost","return"]);

    // 4. Create new status labels if requested
    if (create_new_labels) {
      const toCreate = new Set<string>();
      for (const row of rows) {
        const s = normalizeStatus(col(row, "status penjualan"), col(row, "status stok", "status"));
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

    // 5. Delete existing if requested
    if (delete_existing && branch_id) {
      await supabase.from("stock_units").delete().eq("branch_id", branch_id);
    }

    // 6. Load existing IMEIs to detect duplicates
    const { data: existingIMEIRows } = await supabase
      .from("stock_units").select("imei").not("imei", "is", null);
    const existingIMEISet = new Set<string>(
      delete_existing ? [] : existingIMEIRows?.map((u: any) => u.imei).filter(Boolean) ?? []
    );

    const errors: string[] = [];
    const duplicateIMEIs: Array<{ imei: string; csv_status: string; db_status: string; product_label: string }> = [];
    const unitBatch: Record<string, unknown>[] = [];
    let newProductsCreated = 0;

    const getOrCreateProduct = async (
      seriesRaw: string,
      storage: number | null,
      color: string | null,
      warranty: string,
      category: string
    ): Promise<string | null> => {
      const normalized = nameMap.get(seriesRaw) ?? { series: seriesRaw, category };
      const colorLower = (color ?? "").toLowerCase();
      const cacheKey = `${normalized.series}|${storage ?? ""}|${colorLower}|${warranty}`;

      if (productCache.has(cacheKey)) return productCache.get(cacheKey)!;

      const { data: newProd, error } = await supabase.from("master_products").insert({
        series: normalized.series,
        storage_gb: storage,
        color: color || null,
        warranty_type: warranty,
        category: normalized.category,
        is_active: true,
      } as never).select("id").single();

      if (error) return null;
      productCache.set(cacheKey, newProd.id);
      newProductsCreated++;
      return newProd.id;
    };

    // 7. Process rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        if (import_type === "imei" || import_type === "serial_number") {
          const identifier = col(row, "imei", "serial number", "sn");
          if (!identifier || identifier.length < 5) {
            if (identifier !== "") errors.push(`Baris ${rowNum}: IMEI/SN tidak valid "${identifier}"`);
            continue;
          }

          const seriesRaw = col(row, "seri", "series");
          const storage = parseStorage(col(row, "penyimpanan", "penyimpanan (gb)", "storage"));
          const color = col(row, "warna", "color", "warna") || null;
          const warranty = normalizeWarranty(col(row, "garansi", "tipe garansi", "warranty"));
          const normalized = nameMap.get(seriesRaw) ?? { series: seriesRaw, category: "iphone" };

          const productId = await getOrCreateProduct(seriesRaw, storage, color, warranty, normalized.category);
          if (!productId) {
            errors.push(`Baris ${rowNum}: Gagal membuat produk "${seriesRaw}"`);
            continue;
          }

          const statusJual = col(row, "status penjualan");
          const statusStok = col(row, "status stok", "status");
          const rawStatus = normalizeStatus(statusJual, statusStok);
          const finalStatus = knownStatuses.has(rawStatus) ? rawStatus : "available";

          if (!delete_existing && existingIMEISet.has(identifier)) {
            duplicateIMEIs.push({ imei: identifier, csv_status: finalStatus, db_status: "existing", product_label: seriesRaw });
            continue;
          }

          const soldAt = finalStatus === "sold"
            ? (parseDate(col(row, "tanggal terjual", "sold date")) ?? new Date().toISOString())
            : null;

          unitBatch.push({
            product_id: productId,
            branch_id: branch_id || null,
            imei: identifier,
            condition_status: normalizeCondition(col(row, "kondisi", "condition")),
            selling_price: parsePrice(col(row, "harga", "harga jual", "selling price", "price")),
            stock_status: finalStatus,
            sold_at: soldAt,
            received_at: parseDate(col(row, "tanggal masuk stok", "tanggal masuk", "tgl masuk")) ?? new Date().toISOString(),
            status_changed_at: new Date().toISOString(),
            notes: col(row, "catatan", "notes", "keterangan") || null,
          });

          existingIMEISet.add(identifier);

        } else if (import_type === "qty") {
          const merk = col(row, "merk", "brand", "merek");
          const namaRaw = col(row, "nama produk", "product", "nama");
          const fullName = merk && namaRaw ? `${merk} ${namaRaw}` : namaRaw || merk;
          if (!fullName.trim()) {
            errors.push(`Baris ${rowNum}: Nama produk kosong`);
            continue;
          }

          const qty = parseInt(col(row, "jumlah stok", "qty", "quantity", "stock")) || 0;
          const productId = await getOrCreateProduct(fullName, null, null, "no_warranty", "accessory");
          if (!productId) {
            errors.push(`Baris ${rowNum}: Gagal membuat produk "${fullName}"`);
            continue;
          }

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
      } catch (e: any) {
        errors.push(`Baris ${rowNum}: ${e.message}`);
      }
    }

    // 8. Batch insert (50 per batch)
    let imported = 0;
    const BATCH = 50;
    for (let i = 0; i < unitBatch.length; i += BATCH) {
      const chunk = unitBatch.slice(i, i + BATCH);
      const { data: inserted, error } = await supabase.from("stock_units").insert(chunk as never[]).select("id");
      if (error) errors.push(`Insert error: ${error.message}`);
      else imported += inserted?.length ?? chunk.length;
    }

    return new Response(JSON.stringify({
      total_rows: rows.length,
      imported,
      new_products_created: newProductsCreated,
      duplicates_merged: duplicateIMEIs.length,
      errors: errors.slice(0, 30),
      ai_warnings: [],
      duplicate_imeis_db: duplicateIMEIs.slice(0, 10),
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
