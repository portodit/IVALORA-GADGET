const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ─── Classic (Checkout) API signature — same HMAC as check-order ─────────────
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
  const b64 = pem
    .replace(/-----BEGIN[\s\S]*?-----/g, "")
    .replace(/-----END[\s\S]*?-----/g, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}

async function signRsa(message: string, key: CryptoKey): Promise<string> {
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(message));
  return bufToBase64(sig);
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

async function getSnapToken(
  clientKey: string, privateKeyPem: string, baseUrl: string,
): Promise<{ token: string; timestamp: string }> {
  const timestamp = snapTimestamp();
  const rsaKey = await importRsaKey(privateKeyPem);
  const signature = await signRsa(`${clientKey}|${timestamp}`, rsaKey);
  const res = await fetch(`${baseUrl}/auth/v1/access-token/b2b`, {
    method: "POST",
    headers: {
      "X-CLIENT-KEY": clientKey,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });
  const json = await res.json();
  if (!res.ok || !json.accessToken) {
    throw new Error(`SNAP token error (${res.status}): ${JSON.stringify(json).slice(0, 200)}`);
  }
  return { token: json.accessToken, timestamp };
}

async function getPartnerServiceIdFromDb(
  channel: string, supabaseUrl: string, supabaseKey: string,
): Promise<string> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/doku_payment_channels?doku_method=eq.${encodeURIComponent(channel)}&select=partner_service_id&limit=1`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const rows = await res.json();
    if (rows?.[0]?.partner_service_id) return rows[0].partner_service_id;
  } catch (e) {
    console.warn(`[PSI] DB lookup failed for ${channel}:`, e);
  }
  return Deno.env.get("DOKU_PARTNER_SERVICE_ID") ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "DOKU credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { invoice_number, transaction_id } = body;

    if (!invoice_number || !transaction_id) {
      return new Response(
        JSON.stringify({ success: false, error: "invoice_number and transaction_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch VA info from DB
    const txRes = await fetch(
      `${supabaseUrl}/rest/v1/transactions?id=eq.${transaction_id}&select=doku_va_number,doku_token_id,doku_payment_url&limit=1`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const txRows = await txRes.json();
    const tx = txRows?.[0];

    const baseUrl = isProd ? "https://api.doku.com" : "https://api-sandbox.doku.com";
    console.log(`[doku-void-checkout] env=${DOKU_ENV} mode=${isProd ? "PRODUCTION" : "SANDBOX"} → ${baseUrl}`);

    // ── Path A: Checkout-Link transaction (has doku_payment_url) ──────────────
    if (tx?.doku_payment_url) {
      console.log(`[doku-void-checkout] Checkout-link transaction — no DOKU cancel API available. VA expires naturally.`);
      return new Response(JSON.stringify({
        success: true,
        message: "VA will expire at doku_expired_date. Callback guard prevents payment on cancelled transactions.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Path B: Direct VA transaction (has doku_va_number, no payment_url) ────
    if (!tx?.doku_va_number) {
      console.warn(`[doku-void-checkout] No VA or payment_url for transaction ${transaction_id} — skipping void`);
      return new Response(JSON.stringify({ success: true, message: "Nothing to void" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try SNAP delete-va (best effort — if SNAP H2H is not activated, cancel still succeeds)
    if (DOKU_PRIVATE_KEY) {
      try {
        const tokenParts = (tx.doku_token_id ?? "").split("|");
        const customerNo = tokenParts[0] ?? "";
        const channel = tokenParts[1] ?? "";
        const psiVal = await getPartnerServiceIdFromDb(channel, supabaseUrl, supabaseKey);
        const partnerServiceId = psiVal.padStart(8, " ");
        const virtualAccountNo = tx.doku_va_number;

        console.log(`[SNAP Void] Attempting delete VA: ${virtualAccountNo} trxId: ${invoice_number}`);

        const { token: accessToken, timestamp } = await getSnapToken(DOKU_CLIENT_ID, DOKU_PRIVATE_KEY, baseUrl);

        const reqBody = {
          partnerServiceId,
          customerNo,
          virtualAccountNo,
          trxId: invoice_number,
          additionalInfo: { channel },
        };

        const bodyString = JSON.stringify(reqBody);
        const path = "/virtual-accounts/bi-snap-va/v1.1/transfer-va/delete-va";
        const signature = await snapApiSignature("DELETE", path, accessToken, bodyString, timestamp, DOKU_SECRET_KEY);

        const externalId = String(Date.now()).slice(-16) + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
        const res = await fetch(`${baseUrl}${path}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "X-TIMESTAMP": timestamp, "X-SIGNATURE": signature,
            "X-PARTNER-ID": DOKU_CLIENT_ID,
            "X-EXTERNAL-ID": externalId,
            "CHANNEL-ID": "H2H", "Content-Type": "application/json",
          },
          body: bodyString,
        });

        const json = await res.json();
        console.log(`[SNAP Void] Response (HTTP ${res.status}):`, JSON.stringify(json).slice(0, 300));

        if (res.ok && String(json.responseCode ?? "").startsWith("200")) {
          console.log(`[SNAP Void] VA deleted successfully: ${virtualAccountNo}`);
        } else {
          console.warn(`[SNAP Void] SNAP delete-va failed (non-fatal): ${json.responseCode} ${json.responseMessage}`);
        }
      } catch (snapErr) {
        console.warn(`[SNAP Void] SNAP delete-va error (non-fatal):`, snapErr instanceof Error ? snapErr.message : snapErr);
      }
    } else {
      console.log(`[doku-void-checkout] No SNAP private key — skipping SNAP void (VA expires naturally)`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Cancel processed. Callback guard prevents payment on cancelled transactions.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[doku-void-checkout] Error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
