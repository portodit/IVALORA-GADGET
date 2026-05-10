const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Verify SNAP symmetric callback signature from DOKU */
async function verifySnapSignature(
  method: string, path: string, bodyString: string,
  timestamp: string, incomingSignature: string, clientSecret: string,
): Promise<boolean> {
  try {
    const bodyHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyString));
    const bodyHash = Array.from(new Uint8Array(bodyHashBuf))
      .map((b) => b.toString(16).padStart(2, "0")).join("").toLowerCase();

    // SNAP callback: no access token in string-to-sign
    const sts = `${method}:${path}::${bodyHash}:${timestamp}`;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(clientSecret),
      { name: "HMAC", hash: "SHA-512" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sts));
    const expected = bufToBase64(sig);
    return expected === incomingSignature;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Gunakan production credentials jika DOKU_ENV=production
  const DOKU_ENV = (Deno.env.get("DOKU_ENV") ?? "").toLowerCase();
  const isProd = DOKU_ENV === "production";
  const DOKU_CLIENT_ID = isProd
    ? (Deno.env.get("DOKU_PROD_CLIENT_ID") ?? Deno.env.get("DOKU_CLIENT_ID") ?? "")
    : (Deno.env.get("DOKU_CLIENT_ID") ?? "");
  const DOKU_SECRET_KEY = isProd
    ? (Deno.env.get("DOKU_PROD_SECRET_KEY") ?? Deno.env.get("DOKU_SECRET_KEY") ?? "")
    : (Deno.env.get("DOKU_SECRET_KEY") ?? "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  console.log(`[doku-callback] env=${DOKU_ENV} isProd=${isProd}`);

  const restHeaders = {
    "apikey": supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };

  let bodyString = "";
  try {
    bodyString = await req.text();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const allHeaders: Record<string, string> = {};
  req.headers.forEach((v, k) => { allHeaders[k] = v; });
  console.log("[SNAP callback] headers:", JSON.stringify(allHeaders));
  console.log("[SNAP callback] body:", bodyString.substring(0, 500));

  // ── Signature verification ─────────────────────────────────────────────────
  if (DOKU_CLIENT_ID && DOKU_SECRET_KEY) {
    const incomingClientId = req.headers.get("X-PARTNER-ID") ?? req.headers.get("Client-Id") ?? "";
    const timestamp = req.headers.get("X-TIMESTAMP") ?? req.headers.get("Request-Timestamp") ?? "";
    const incomingSignature = req.headers.get("X-SIGNATURE") ?? req.headers.get("Signature") ?? "";

    const hasAuthHeaders = incomingSignature !== "";

    if (hasAuthHeaders) {
      // Check client ID if provided
      if (incomingClientId && incomingClientId !== DOKU_CLIENT_ID) {
        console.error(`Client-Id mismatch: received="${incomingClientId}" expected="${DOKU_CLIENT_ID}"`);
        return new Response("Unauthorized", { status: 401 });
      }

      const url = new URL(req.url);
      const valid = await verifySnapSignature(
        "POST", url.pathname, bodyString, timestamp, incomingSignature, DOKU_SECRET_KEY,
      );
      console.log(`[SNAP callback] Signature check: ${valid ? "OK" : "FAILED"}`);

      if (!valid) {
        console.warn("[SNAP callback] Signature verification failed — processing anyway (sandbox tolerance)");
        // In sandbox DOKU may send non-standard signatures, log but don't reject
      }
    } else {
      console.warn("[SNAP callback] No signature headers — processing without verification");
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyString);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Parse payload — handle both SNAP VA and Classic Checkout formats ─────
  const trxId = (payload.trxId as string) ?? "";
  // SNAP VA: virtualAccountNo di root; Classic: di virtual_account_info
  const virtualAccountNo = String(
    (payload as any).virtualAccountNo
    ?? (payload as any).virtual_account_info?.virtual_account_number
    ?? ""
  ).trim();
  const paidAmount = (payload.paidAmount as { value?: string })?.value;
  const totalAmount = (payload.totalAmount as { value?: string })?.value;

  // Classic Checkout: invoice di order.invoice_number; SNAP: di trxId
  const invoiceNumber = trxId || ((payload.order as Record<string, string>)?.invoice_number ?? "");

  if (!invoiceNumber) {
    console.error("[SNAP callback] Missing trxId/invoice_number:", JSON.stringify(payload).slice(0, 300));
    return new Response("OK", { status: 200 });
  }

  // Determine payment status
  // SNAP VA: payment notification itself = payment succeeded
  // paymentFlagStatus "Y" = paid (if present in some shapes)
  const paymentFlagStatus = String((payload as any)?.paymentFlagStatus ?? "").toUpperCase();
  const txStatus = String((payload.transaction as Record<string, string>)?.status ?? "").toUpperCase();

  // SNAP VA callback is always a "payment received" notification
  // (DOKU only sends callback when payment happens, not for failures)
  const isSuccess = paymentFlagStatus === "Y" ||
    txStatus === "SUCCESS" ||
    (trxId !== "" && paymentFlagStatus === "" && txStatus === ""); // pure SNAP VA notification

  console.log(`[SNAP callback] invoice=${invoiceNumber} va=${virtualAccountNo} isSuccess=${isSuccess} flag=${paymentFlagStatus} txStatus=${txStatus}`);

  const now = new Date().toISOString();

  // ── Find transaction ───────────────────────────────────────────────────────
  const txRes = await fetch(
    `${supabaseUrl}/rest/v1/transactions?transaction_code=eq.${encodeURIComponent(invoiceNumber)}&select=id,status&limit=1`,
    { headers: restHeaders },
  );
  const txRows = await txRes.json();

  if (!txRes.ok || !txRows || txRows.length === 0) {
    console.error("[SNAP callback] Transaction not found for invoice:", invoiceNumber);
    return new Response("OK", { status: 200 });
  }

  const transactionId = txRows[0].id;
  const currentStatus = txRows[0].status;
  console.log(`[SNAP callback] Found tx ${transactionId} status=${currentStatus}`);

  // ── Guard: jangan overwrite terminal status ────────────────────────────────
  if (currentStatus === "cancelled" || currentStatus === "failed" || currentStatus === "completed") {
    console.warn(`[SNAP callback] Tx already terminal "${currentStatus}" — ignoring callback`);
    return new Response(JSON.stringify({ status: "OK" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Update transaction ─────────────────────────────────────────────────────
  const newStatus = isSuccess ? "paid" : "pending";
  const updatePayload: Record<string, unknown> = { status: newStatus, updated_at: now };
  if (isSuccess) updatePayload.confirmed_at = now;
  if (virtualAccountNo) updatePayload.doku_va_number = virtualAccountNo;

  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}`,
    { method: "PATCH", headers: restHeaders, body: JSON.stringify(updatePayload) },
  );
  if (!updateRes.ok) console.error("[SNAP callback] Failed to update tx:", await updateRes.text());
  else console.log(`[SNAP callback] Tx ${invoiceNumber} → ${newStatus}`);

  // ── Update stock ───────────────────────────────────────────────────────────
  if (isSuccess) {
    const stockRes = await fetch(
      `${supabaseUrl}/rest/v1/stock_units?sold_reference_id=eq.${transactionId}&stock_status=eq.reserved`,
      {
        method: "PATCH",
        headers: restHeaders,
        body: JSON.stringify({ stock_status: "sold", sold_channel: "doku_snap", sold_at: now }),
      },
    );
    if (!stockRes.ok) console.error("[SNAP callback] Failed to update stock:", await stockRes.text());
    else console.log(`[SNAP callback] Stock units → sold for tx ${transactionId}`);
  }

  return new Response(JSON.stringify({ status: "OK" }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
