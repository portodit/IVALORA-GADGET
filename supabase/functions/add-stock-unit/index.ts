// supabase/functions/add-stock-unit/index.ts
// Quick endpoint to add stock unit without RLS restrictions

import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface StockUnitInput {
  product_id: string
  imei: string
  condition_status: "no_minus" | "minus"
  stock_status: string
  branch_id?: string
  received_at?: string
  selling_price?: number
  cost_price?: number
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const body: StockUnitInput = await req.json()

    const { product_id, imei, condition_status, stock_status, branch_id, received_at, selling_price, cost_price } = body

    if (!product_id || !imei) {
      return new Response(JSON.stringify({ error: "product_id and imei are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Check if IMEI already exists
    const { data: existing } = await supabase
      .from("stock_units")
      .select("id, imei")
      .eq("imei", imei)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ error: "IMEI already exists", existing }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Insert stock unit
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("stock_units")
      .insert({
        product_id,
        imei,
        condition_status,
        stock_status,
        branch_id: branch_id || null,
        received_at: received_at || now,
        status_changed_at: now,
        created_at: now,
        updated_at: now,
        selling_price: selling_price || null,
        cost_price: cost_price || null,
      })
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})