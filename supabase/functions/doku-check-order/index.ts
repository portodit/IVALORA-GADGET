const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ─── Classic (Checkout) API signature — GET request, no body ─────────────────
async function classicSignature(
  clientId: string, requestId: string, requestTimestamp: string,
  requestTarget: string, secretKey: string,
): Promise<string> {
  const componentSignature =
    `Client-Id:${clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${requestTimestamp}\n` +
    `Request-Target:${requestTarget}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(componentSignature));
  return `HMACSHA256=${bufToBase64(sig)}`;
}

// ─── SNAP helpers (for Direct VA transactions) ────────────────────────────────
function snapTimestamp(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().replace(/\.\d{3}Z$/, "+07:00");
}

async function importRsaKey(pem: string): Promise<CryptoKey> {
  const b64 = pem.includes("-----")
    ? pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")
    : pem.replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
}

async function snapApiSignature(
  method: string, path: string, accessToken: string,
  bodyString: string, timestamp: string, clientSecret: string,
): Promise<string> {
  const bodyHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyString));
  const bodyHash = Array.from(new Uint8Array(bodyHashBuf))
    .map((b) => b.toString(16).padStart(2, "0")).join("").toLowerCase();
  const sts = `${method}:${path}:${accessToken}:${bodyHash}:${timestamp}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(clientSecret),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sts));
  return bufToBase64(sig);
}

async function getSnapToken(clientKey: string, privateKeyPem: string, baseUrl: string): Promise<{ token: string; timestamp: string }> {
  const timestamp = snapTimestamp();
  const rsaKey = await importRsaKey(privateKeyPem);
  const msgBuf = new TextEncoder().encode(`${clientKey}|${timestamp}`);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", rsaKey, msgBuf);
  const signature = bufToBase64(sigBuf);
  const res = await fetch(`${baseUrl}/authorization/v1/access-token/b2b`, {
    method: "POST",
    headers: { "X-CLIENT-KEY": clientKey, "X-TIMESTAMP": timestamp, "X-SIGNATURE": signature, "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });
  const json = await res.json();
  if (!res.ok || !json.accessToken) throw new Error(`SNAP token error (${res.status}): ${JSON.stringify(json).slice(0, 200)}`);
  return { token: json.accessToken, timestamp };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Credential selection: production vs sandbox ────────────────────────────
  const DOKU_ENV = (Deno.env.get("DOKU_ENV") ?? "").toLowerCase();
  const isProd = DOKU_ENV === "production";

  const DOKU_CLIENT_ID = isProd
    ? (Deno.env.get("DOKU_PROD_CLIENT_ID") ?? Deno.env.get("DOKU_CLIENT_ID") ?? "")
    : (Deno.env.get("DOKU_CLIENT_ID") ?? "");
  const DOKU_SECRET_KEY = isProd
    ? (Deno.env.get("DOKU_PROD_SECRET_KEY") ?? Deno.env.get("DOKU_SECRET_KEY") ?? "")
    : (Deno.env.get("DOKU_SECRET_KEY") ?? "");
  const DOKU_PRIVATE_KEY = isProd
    ? (Deno.env.get("DOKU_PROD_PRIVATE_KEY") ?? Deno.env.get("DOKU_PRIVATE_KEY") ?? undefined)
    : (Deno.env.get("DOKU_PRIVATE_KEY") ?? undefined);
  const DOKU_PARTNER_SERVICE_ID = Deno.env.get("DOKU_PARTNER_SERVICE_ID") ?? "";

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    return new Response(JSON.stringify({ success: false, error: "DOKU credentials not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth — allow service role JWT or valid user JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = (() => {
    try {
      const parts = authHeader.split(" ")[1]?.split(".");
      if (!parts || parts.length < 2) return false;
      return JSON.parse(atob(parts[1])).role === "service_role";
    } catch { return false; }
  })();
  if (!isServiceRole) {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": authHeader, "apikey": supabaseKey },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { invoiceNumber, transactionId } = await req.json();
  if (!invoiceNumber || !transactionId) {
    return new Response(JSON.stringify({ success: false, error: "Missing invoiceNumber or transactionId" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch transaction from DB
  const txRes = await fetch(
    `${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}&select=doku_va_number,doku_token_id,doku_payment_url&limit=1`,
    { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
  );
  const txRows = await txRes.json();
  const tx = txRows?.[0];

  const isSandbox = !isProd;
  const baseUrl = isProd ? "https://api.doku.com" : "https://api-sandbox.doku.com";
  console.log(`[doku-check-order] env=${DOKU_ENV} mode=${isProd ? "PRODUCTION" : "SANDBOX"} → ${baseUrl}`);

  try {
    // ── Path A: SNAP VA Direct (va_number set, no payment_url) ──────────────
    if (tx?.doku_va_number && !tx?.doku_payment_url && DOKU_PRIVATE_KEY) {
      const tokenParts = (tx.doku_token_id ?? "").split("|");
      const customerNo = tokenParts[0] ?? "";
      const channel = tokenParts[1] ?? "VIRTUAL_ACCOUNT_BCA";
      const partnerServiceId = DOKU_PARTNER_SERVICE_ID.padStart(8, " ");
      const virtualAccountNo = tx.doku_va_number;

      const { token: accessToken, timestamp } = await getSnapToken(DOKU_CLIENT_ID, DOKU_PRIVATE_KEY, baseUrl);

      const reqBody = { partnerServiceId, customerNo, virtualAccountNo, inquiryRequestId: crypto.randomUUID(), trxId: invoiceNumber, additionalInfo: { channel } };
      const bodyString = JSON.stringify(reqBody);
      const path = "/virtual-account/v2.0/inquiry-payment-code";
      const signature = await snapApiSignature("POST", path, accessToken, bodyString, timestamp, DOKU_SECRET_KEY);

      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`, "X-TIMESTAMP": timestamp, "X-SIGNATURE": signature,
          "X-PARTNER-ID": DOKU_CLIENT_ID, "X-REQUEST-ID": crypto.randomUUID(),
          "X-EXTERNAL-ID": invoiceNumber.replace(/[^a-zA-Z0-9]/g, "").substring(0, 36),
          "CHANNEL-ID": "PC", "Content-Type": "application/json",
        },
        body: bodyString,
      });
      const json = await res.json();
      console.log(`[SNAP inquiry] HTTP ${res.status}:`, JSON.stringify(json).slice(0, 300));

      if (res.status === 404) {
        return new Response(JSON.stringify({ success: true, isPaid: false, status: "PENDING", va_number: virtualAccountNo }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: `SNAP Inquiry HTTP ${res.status}`, raw: json }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const vaData = json.virtualAccountData ?? json;
      const isPaid = String(vaData.paymentFlagStatus ?? "N").toUpperCase() === "Y";
      const returnedVa = String(vaData.virtualAccountNo ?? virtualAccountNo).trim();
      if (isPaid) {
        await fetch(`${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}`, {
          method: "PATCH",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ status: "paid", confirmed_at: new Date().toISOString() }),
        });
        await fetch(`${supabaseUrl}/rest/v1/stock_units?sold_reference_id=eq.${transactionId}&stock_status=eq.reserved`, {
          method: "PATCH",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ stock_status: "sold", sold_channel: "doku_snap", sold_at: new Date().toISOString() }),
        });
      }
      return new Response(JSON.stringify({ success: true, isPaid, va_number: returnedVa, status: isPaid ? "PAID" : "PENDING", raw: json }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Path B: Classic Checkout order status (payment_url set / no va_number) ─
    const requestTarget = `/orders/v1/status/${invoiceNumber}`;
    const requestId = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const signature = await classicSignature(DOKU_CLIENT_ID, requestId, requestTimestamp, requestTarget, DOKU_SECRET_KEY);

    console.log(`[Classic] Checking order: ${invoiceNumber}`);
    const res = await fetch(`${baseUrl}${requestTarget}`, {
      method: "GET",
      headers: { "Client-Id": DOKU_CLIENT_ID, "Request-Id": requestId, "Request-Timestamp": requestTimestamp, "Signature": signature },
    });
    const json = await res.json();
    console.log(`[Classic] HTTP ${res.status}:`, JSON.stringify(json).slice(0, 400));

    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, error: `DOKU HTTP ${res.status}`, raw: json }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txData = (json as any)?.transaction ?? (json as any)?.response?.transaction ?? {};
    const txStatus = String(txData?.status ?? "").toUpperCase();
    const isPaid = ["SUCCESS", "PAID", "SETTLEMENT", "CAPTURE"].includes(txStatus);

    // Extract VA number if DOKU returned it in the status response
    const vaNumber: string | null = (() => {
      const paths = [
        // Root-level (Classic Checkout response format)
        (json as any)?.virtual_account_info?.virtual_account_number,
        // Nested in transaction
        txData?.payment?.virtual_account_info?.virtual_account_number,
        txData?.virtual_account_info?.virtual_account_number,
        (json as any)?.response?.payment?.virtual_account_info?.virtual_account_number,
        (json as any)?.response?.virtual_account_info?.virtual_account_number,
      ];
      for (const p of paths) if (p) return String(p);
      const arr = txData?.payment?.payment_info ?? txData?.payment_info;
      if (Array.isArray(arr)) {
        const e = arr.find((e: any) => e?.key?.toLowerCase?.().includes("account") || e?.key?.toLowerCase?.().includes("virtual"));
        if (e?.value) return String(e.value);
      }
      return null;
    })();

    const dbPatch: Record<string, unknown> = {};
    if (isPaid) { dbPatch.status = "paid"; dbPatch.confirmed_at = new Date().toISOString(); }
    if (vaNumber) dbPatch.doku_va_number = vaNumber;

    if (Object.keys(dbPatch).length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}`, {
        method: "PATCH",
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify(dbPatch),
      });
      if (isPaid) {
        await fetch(`${supabaseUrl}/rest/v1/stock_units?sold_reference_id=eq.${transactionId}&stock_status=eq.reserved`, {
          method: "PATCH",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ stock_status: "sold", sold_channel: "doku", sold_at: new Date().toISOString() }),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, isPaid, status: txStatus || "PENDING", va_number: vaNumber, raw: json }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[doku-check-order] error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
