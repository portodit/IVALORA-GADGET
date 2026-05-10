import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Parse body
  let branchId: string | null = null;
  let dryRun = false;
  if (req.method === "POST" || req.method === "GET") {
    try {
      const url = new URL(req.url);
      dryRun = url.searchParams.get("dry") === "true";
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        branchId = body.branch_id ?? null;
        dryRun = body.dry_run === true || dryRun;
      }
    } catch (_) { /* ignore parse errors */ }
  }

  // 1. Get all active iPhone master_products
  let q = supabase
    .from("master_products")
    .select("id, series, category, color, storage_gb, warranty_type")
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("category", "iphone")
    .order("series")
    .order("storage_gb");

  const { data: masters, error: mErr } = await q;
  if (mErr) {
    return new Response(JSON.stringify({ error: mErr.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  if (!masters || masters.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada master product iPhone aktif" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // Helper: categorize warranty_type into groups
  function getWarrantyGroup(wt: string | null): string {
    if (wt === "resmi_bc") return "RESMI BEACUKAI";
    if (wt === "digimap" || wt === "ibox" || wt === "resmi") return "RESMI INDONESIA";
    if (wt === "inter") return "INTER";
    if (wt === "whitelist") return "WHITELIST";
    return "LAINNYA";
  }

  // Helper: generate unique key for grouping (series + warranty_group)
  function getGroupKey(series: string, warrantyGroup: string): string {
    return `${series}||${warrantyGroup}`;
  }

  // Helper: get default thumbnail by series name
function getDefaultThumbnail(series: string): string {
  const name = series.toLowerCase();
  if (name.includes('iphone')) return 'https://placehold.co/400x300/e5e7eb/6b7280?text=iPhone';
  if (name.includes('ipad')) return 'https://placehold.co/400x300/e5e7eb/6b7280?text=iPad';
  if (name.includes('macbook')) return 'https://placehold.co/400x300/e5e7eb/6b7280?text=MacBook';
  if (name.includes('apple watch')) return 'https://placehold.co/400x300/e5e7eb/6b7280?text=Apple+Watch';
  if (name.includes('airpod')) return 'https://placehold.co/400x300/e5e7eb/6b7280?text=AirPods';
  if (name.includes('charger') || name.includes('cable') || name.includes('adaptor') || name.includes('case')) return 'https://placehold.co/400x300/e5e7eb/6b7280?text=Accessory';
  return 'https://placehold.co/400x300/e5e7eb/6b7280?text=Product';
}
  function buildDisplayName(series: string, warrantyGroup: string, storages: number[]): string {
    const sortedStorages = [...storages].sort((a, b) => a - b);
    const storageText = sortedStorages.map(s => `${s}GB`).join("/");
    return `${series} ${storageText} ${warrantyGroup} FULLSET`;
  }

  // 2. Group masters by series + warranty_group
  const groupMap: Record<string, {
    series: string;
    warrantyGroup: string;
    productIds: string[];
    colors: string[];
    storages: number[];
    warrantyTypes: string[];
  }> = {};

  for (const m of masters) {
    const wt = m.warranty_type ?? "unknown";
    const wg = getWarrantyGroup(wt);
    const key = getGroupKey(m.series, wg);

    if (!groupMap[key]) {
      groupMap[key] = {
        series: m.series,
        warrantyGroup: wg,
        productIds: [],
        colors: [],
        storages: [],
        warrantyTypes: [],
      };
    }

    const g = groupMap[key];
    g.productIds.push(m.id);
    if (m.color && !g.colors.includes(m.color)) g.colors.push(m.color);
    if (m.storage_gb && !g.storages.includes(m.storage_gb)) g.storages.push(m.storage_gb);
    if (!g.warrantyTypes.includes(wt)) g.warrantyTypes.push(wt);
  }

  // 3. Get existing catalog entries (skip if already exists)
  const { data: existingCats } = await supabase
    .from("catalog_products")
    .select("id, catalog_series, catalog_warranty_type");

  // Create unique key for existing catalog items
  const existingKeys = new Set<string>();
  for (const c of (existingCats ?? [])) {
    const wg = c.catalog_warranty_type ?? "unknown";
    existingKeys.add(getGroupKey(c.catalog_series ?? "", wg));
  }

  // 4. Get stock aggregates for price hints
  let stockQ = supabase
    .from("stock_units")
    .select("product_id, selling_price, condition_status")
    .eq("stock_status", "available");
  if (branchId) stockQ = stockQ.eq("branch_id", branchId);

  const { data: rawStock } = await stockQ;
  const aggMap: Record<string, { total: number; no_minus: number; min_price: number | null }> = {};
  for (const unit of (rawStock ?? [])) {
    if (!aggMap[unit.product_id]) aggMap[unit.product_id] = { total: 0, no_minus: 0, min_price: null };
    const a = aggMap[unit.product_id];
    a.total++;
    if (unit.condition_status === "no_minus") a.no_minus++;
    const p = Number(unit.selling_price);
    if (p > 0) a.min_price = a.min_price === null ? p : Math.min(a.min_price, p);
  }

  // 5. Build catalog entries to create
  const toCreate: {
    catalog_series: string;
    catalog_warranty_type: string;
    product_id: string;
    display_name: string;
    short_description: string;
    thumbnail_url: string | null;
    gallery_urls: string[];
    catalog_status: "draft";
    branch_id: string | null;
  }[] = [];

  const skipped: string[] = [];
  const created: string[] = [];

  for (const [key, g] of Object.entries(groupMap)) {
    // Skip if already exists in catalog
    if (existingKeys.has(key)) {
      skipped.push(buildDisplayName(g.series, g.warrantyGroup, g.storages));
      continue;
    }

    // Use first master product as primary reference
    const primaryProductId = g.productIds[0];

    // Build display name with storage and warranty group
    const displayName = buildDisplayName(g.series, g.warrantyGroup, g.storages);

    // Build short description
    const sortedStorages = [...g.storages].sort((a, b) => a - b);
    const storageText = sortedStorages.map(s => `${s}GB`).join(" / ");
    const colorText = g.colors.join(", ");

    toCreate.push({
      catalog_series: g.series,
      catalog_warranty_type: g.warrantyGroup,
      product_id: primaryProductId,
      display_name: displayName,
      short_description: `${g.series} tersedia dalam pilihan storage ${storageText}. Tersedia warna: ${colorText}. FULLSET include charger, kabel, dan aksesoris bawaan.`,
      thumbnail_url: getDefaultThumbnail(g.series),
      gallery_urls: [],
      catalog_status: "draft",
      branch_id: branchId,
    });

    created.push(displayName);
  }

  // 6. Handle dry-run vs execute
  const url = new URL(req.url);
  if (url.searchParams.get("dry") === "true" || dryRun) {
    return new Response(JSON.stringify({
      dry_run: true,
      to_create: toCreate.length,
      to_skip: skipped.length,
      items: toCreate.map(c => ({
        display_name: c.display_name,
        catalog_series: c.catalog_series,
        catalog_warranty_type: c.catalog_warranty_type,
        colors: groupMap[getGroupKey(c.catalog_series, c.catalog_warranty_type)]?.colors ?? [],
        storages: groupMap[getGroupKey(c.catalog_series, c.catalog_warranty_type)]?.storages ?? [],
      })),
      skipped_items: skipped,
    }), { headers: { "Content-Type": "application/json" } });
  }

  if (toCreate.length === 0) {
    return new Response(JSON.stringify({
      message: "Semua seri iPhone sudah ada di katalog",
      created: 0,
      skipped: skipped.length,
      skipped_items: skipped,
    }), { headers: { "Content-Type": "application/json" } });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("catalog_products")
    .insert(toCreate)
    .select("id, display_name");

  if (insErr) {
    return new Response(JSON.stringify({ error: insErr.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    message: `Berhasil membuat ${(inserted ?? []).length} entri katalog`,
    created: (inserted ?? []).length,
    created_names: created,
    skipped: skipped.length,
    skipped_items: skipped,
    errors: [],
  }), { headers: { "Content-Type": "application/json" } });
});