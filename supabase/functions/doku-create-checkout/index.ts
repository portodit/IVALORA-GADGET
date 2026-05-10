const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Crypto helpers ───────────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Timestamp format for SNAP: YYYY-MM-DDTHH:mm:ss+07:00 */
function snapTimestamp(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().replace(/\.\d{3}Z$/, "+07:00");
}

/** Import RSA private key from PEM */
async function importRsaKey(pem: string): Promise<CryptoKey> {
  // Handle both PEM with headers and raw base64 (no headers/newlines)
  const b64 = pem.includes("-----")
    ? pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")
    : pem.replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}

/** RSA-SHA256 signature for B2B token request */
async function signRsa(message: string, key: CryptoKey): Promise<string> {
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(message),
  );
  return bufToBase64(sig);
}

/** HMAC-SHA512 signature for SNAP API requests */
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

/** Get SNAP B2B access token */
async function getSnapToken(
  clientKey: string, privateKeyPem: string, baseUrl: string,
): Promise<{ token: string; timestamp: string }> {
  const timestamp = snapTimestamp();
  const rsaKey = await importRsaKey(privateKeyPem);
  const signature = await signRsa(`${clientKey}|${timestamp}`, rsaKey);

  console.log(`[SNAP] sig="${signature}"`);
  const res = await fetch(`${baseUrl}/authorization/v1/access-token/b2b`, {
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
  console.log(`[SNAP] Token response (HTTP ${res.status}):`, JSON.stringify(json).slice(0, 200));
  if (!res.ok || !json.accessToken) {
    throw new Error(`SNAP token error (${res.status}): ${JSON.stringify(json)} | ts=${timestamp} | sig=${signature}`);
  }
  return { token: json.accessToken, timestamp };
}

// ─── DOKU Classic (Checkout) API signature ────────────────────────────────────

/** HTTP Message Signature for DOKU Jokul/Classic Checkout API */
async function generateCheckoutSignature(
  clientId: string, requestId: string, requestTimestamp: string,
  requestTarget: string, bodyString: string, secretKey: string,
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyString));
  const digest = bufToBase64(hashBuffer);
  const componentSignature =
    `Client-Id:${clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${requestTimestamp}\n` +
    `Request-Target:${requestTarget}\n` +
    `Digest:${digest}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(componentSignature));
  return `HMACSHA256=${bufToBase64(sig)}`;
}

/** Extract VA number from DOKU Checkout response (if single VA method was passed) */
function extractVaNumber(json: Record<string, unknown>): string | null {
  try {
    const r = (json as any)?.response;
    // Path 1: response.payment.virtual_account_info
    const v1 = r?.payment?.virtual_account_info?.virtual_account_number;
    if (v1) return String(v1);
    // Path 2: response.virtual_account_info
    const v2 = r?.virtual_account_info?.virtual_account_number;
    if (v2) return String(v2);
    // Path 3: response.payment.payment_info array
    const paymentInfo = r?.payment?.payment_info;
    if (Array.isArray(paymentInfo)) {
      const e = paymentInfo.find((e: any) =>
        e?.key?.toLowerCase?.().includes("account") ||
        e?.key?.toLowerCase?.().includes("number") ||
        e?.key?.toLowerCase?.().includes("virtual")
      );
      if (e?.value) return String(e.value);
    }
    // Path 4: response.payment.virtual_account_number (flat)
    const v4 = r?.payment?.virtual_account_number;
    if (v4) return String(v4);
    // Path 5: nested inside 'additional_info'
    const v5 = r?.payment?.additional_info?.virtual_account_number
      ?? r?.additional_info?.virtual_account_number;
    if (v5) return String(v5);
    console.log("[extractVaNumber] VA not found in response keys:", Object.keys(r?.payment ?? {}));
    return null;
  } catch { return null; }
}

/** Map payment_method_name to SNAP channel code */
function toSnapChannel(pmName: string): string {
  const n = pmName.toLowerCase();
  if (n.includes("bca")) return "VIRTUAL_ACCOUNT_BCA";
  if (n.includes("syariah") || n.includes("bsi")) return "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI";
  if (n.includes("mandiri")) return "VIRTUAL_ACCOUNT_BANK_MANDIRI";
  if (n.includes("bni")) return "VIRTUAL_ACCOUNT_BNI";
  if (n.includes("bri")) return "VIRTUAL_ACCOUNT_BRI";
  if (n.includes("permata")) return "VIRTUAL_ACCOUNT_BANK_PERMATA";
  if (n.includes("cimb")) return "VIRTUAL_ACCOUNT_BANK_CIMB";
  if (n.includes("danamon")) return "VIRTUAL_ACCOUNT_BANK_DANAMON";
  if (n.includes("btn")) return "VIRTUAL_ACCOUNT_BTN";
  if (n.includes("maybank")) return "VIRTUAL_ACCOUNT_MAYBANK";
  if (n.includes("bnc") || n.includes("neo")) return "VIRTUAL_ACCOUNT_BNC";
  if (n.includes("sinarmas")) return "VIRTUAL_ACCOUNT_SINARMAS";
  if (n.includes("bjb") || n.includes("jabar")) return "VIRTUAL_ACCOUNT_BJB";
  if (n.includes("bss") || n.includes("sahabat") || n.includes("sampoerna")) return "VIRTUAL_ACCOUNT_BSS";
  return "VIRTUAL_ACCOUNT_DOKU";
}

// ─── Fallback PSIs (used if DB lookup fails) ─────────────────────────────────
const FALLBACK_PARTNER_SERVICE_IDS: Record<string, string> = {
  "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI": "    6059",
  "VIRTUAL_ACCOUNT_BNC":                  "90341537",
  "VIRTUAL_ACCOUNT_BANK_DANAMON":         "    8922",
  "VIRTUAL_ACCOUNT_SINARMAS":             "    8890",
  "VIRTUAL_ACCOUNT_BTN":                  "   95962",
  "VIRTUAL_ACCOUNT_BNI":                  "98829172",
  "VIRTUAL_ACCOUNT_BJB":                  "   12000",
  "VIRTUAL_ACCOUNT_BANK_CIMB":            "    1899",
  "VIRTUAL_ACCOUNT_BSS":                  "   92400",
  "VIRTUAL_ACCOUNT_BRI":                  "   13925",
  "VIRTUAL_ACCOUNT_BANK_PERMATA":         "    8965",
  "VIRTUAL_ACCOUNT_MAYBANK":              "   78676",
};

// ─── Customer No Prefix per bank (from DOKU merchant portal SNAP configuration)
// virtualAccountNo = partnerServiceId (8 chars) + customerNo (8 chars) = 16 chars
// customerNo must start with this prefix digit — DOKU rejects requests without it
const CUSTOMER_NO_PREFIX: Record<string, string> = {
  "VIRTUAL_ACCOUNT_BNI":                  "3",
  "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI": "9",
  "VIRTUAL_ACCOUNT_BANK_CIMB":            "9",
  "VIRTUAL_ACCOUNT_MAYBANK":              "6",
  "VIRTUAL_ACCOUNT_BANK_DANAMON":         "9",
  "VIRTUAL_ACCOUNT_SINARMAS":             "1",
  "VIRTUAL_ACCOUNT_BRI":                  "0",
  "VIRTUAL_ACCOUNT_BTN":                  "6",
  "VIRTUAL_ACCOUNT_BJB":                  "0",
  // BCA, Mandiri, Permata, BNC: not in merchant SNAP config → fallback to Classic Checkout
};

async function getPartnerServiceIdFromDb(
  channel: string, supabaseUrl: string, supabaseKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/doku_payment_channels?doku_method=eq.${encodeURIComponent(channel)}&select=partner_service_id,is_enabled,snap_supported&limit=1`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const rows = await res.json();
    const row = rows?.[0];
    if (row && !row.is_enabled) {
      console.warn(`[PSI] Channel ${channel} is DISABLED in doku_payment_channels`);
      return null;
    }
    // snap_supported = false → paksa Classic Checkout, skip SNAP
    if (row && row.snap_supported === false) {
      console.log(`[PSI] Channel ${channel} snap_supported=false → fallback ke Classic Checkout`);
      return null;
    }
    if (row?.partner_service_id) return row.partner_service_id;
  } catch (e) {
    console.warn(`[PSI] DB lookup failed for ${channel}:`, e);
  }
  return FALLBACK_PARTNER_SERVICE_IDS[channel] ?? Deno.env.get("DOKU_PARTNER_SERVICE_ID") ?? "";
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Credential selection: production vs sandbox ──────────────────────────
    const DOKU_ENV = (Deno.env.get("DOKU_ENV") ?? "").toLowerCase();
    const isProd = DOKU_ENV === "production";

    const DOKU_CLIENT_ID = isProd
      ? (Deno.env.get("DOKU_PROD_CLIENT_ID") ?? Deno.env.get("DOKU_CLIENT_ID") ?? "")
      : (Deno.env.get("DOKU_CLIENT_ID") ?? "");
    const DOKU_SECRET_KEY = isProd
      ? (Deno.env.get("DOKU_PROD_SECRET_KEY") ?? Deno.env.get("DOKU_SECRET_KEY") ?? "")
      : (Deno.env.get("DOKU_SECRET_KEY") ?? "");
    const DOKU_PRIVATE_KEY = isProd
      ? (Deno.env.get("DOKU_PROD_PRIVATE_KEY") ?? Deno.env.get("DOKU_PRIVATE_KEY") ?? "")
      : (Deno.env.get("DOKU_PRIVATE_KEY") ?? "");

    if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY || !DOKU_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "DOKU credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log(`[DOKU] env=${DOKU_ENV} CLIENT_ID="${DOKU_CLIENT_ID}" KEY_LEN=${DOKU_PRIVATE_KEY.length}`);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: accept service role key OR valid user JWT
    const isServiceRole = (() => {
      try {
        const parts = authHeader?.split(" ")[1]?.split(".");
        if (!parts || parts.length < 2) return false;
        const payload = JSON.parse(atob(parts[1]));
        return payload.role === "service_role";
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

    const body = await req.json();
    const {
      transactionCode, transactionId, total, customerName,
      customerEmail, customerPhone, items = [], paymentMethodTypes,
      customerAddress, customerCity, customerState, customerPostcode,
      isPayLater,
    } = body;

    if (!transactionCode || !total || !customerName) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = isProd ? "https://api.doku.com" : "https://api-sandbox.doku.com";
    console.log(`[DOKU] mode: ${isProd ? "PRODUCTION" : "SANDBOX"} → ${baseUrl}`);

    const notificationUrl = `${supabaseUrl}/functions/v1/doku-callback`;
    const redirectUrl = `https://ivaloragadget.com/admin/transaksi/${transactionId ?? ""}`;

    // ── Helper: DOKU Checkout API (Classic) → returns payment_url ───────────
    const runCheckoutApi = async (pmTypes?: string[]) => {
      const dokuBody: Record<string, unknown> = {
        order: {
          amount: Math.round(total),
          invoice_number: transactionCode,
          currency: "IDR",
          callback_url: redirectUrl,
          callback_url_result: redirectUrl,
          auto_redirect: true,
          line_items: (() => {
            const isPL = isPayLater || (pmTypes?.some((t: string) => t.startsWith("PEER_TO_PEER_")) ?? false);
            const mappedItems = (items as { label: string; price: number; sku?: string; category?: string }[]).map((i, idx) => ({
              id: String(idx + 1),
              name: String(i.label ?? "Item")
                .replace(/[^a-zA-Z0-9 .\-\/+=,_:@%]/g, " ")
                .replace(/\s+/g, " ").trim().substring(0, 255),
              quantity: 1,
              price: Math.round(i.price),
              sku: i.sku || String(idx + 1),
              category: i.category || (isPL ? "Gadget" : "General"),
            }));

            const itemsTotal = mappedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const targetTotal = Math.round(total);
            const diff = targetTotal - itemsTotal;

            if (diff !== 0) {
              // Jika ada selisih (misal item produk + admin fee VA), collapse ke single item
              // agar DOKU tidak gagal validasi sum(line_items) vs order.amount
              return [{
                id: "1",
                name: "Total Pembayaran Transaksi",
                quantity: 1,
                price: targetTotal,
                sku: "TOTAL",
                category: isPL ? "Gadget" : "General",
              }];
            }
            return mappedItems;
          })(),
        },
        payment: {
          payment_due_date: 180,
          ...(pmTypes?.length ? { payment_method_types: pmTypes } : {}),
        },
        customer: {
          id: customerPhone || customerEmail || transactionCode,
          name: customerName || "Customer",
          ...(customerEmail ? { email: customerEmail } : {}),
          ...(customerPhone ? { phone: String(customerPhone || "").replace(/^0/, "62") } : {}),
          ...(isPayLater ? {
            address: customerAddress || "Indonesia",
            city: customerCity || "Surabaya",
            state: customerState || "Jawa Timur",
            postcode: customerPostcode || "60000",
          } : {}),
        },
        additional_info: { notification_url: notificationUrl },
      };
      const bodyStr = JSON.stringify(dokuBody);
      const reqId = crypto.randomUUID();
      const reqTs = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const reqTarget = "/checkout/v1/payment";
      const sig = await generateCheckoutSignature(DOKU_CLIENT_ID, reqId, reqTs, reqTarget, bodyStr, DOKU_SECRET_KEY);
      console.log(`[Checkout] Creating for: ${transactionCode} amount: ${total}`);
      const r = await fetch(`${baseUrl}${reqTarget}`, {
        method: "POST",
        headers: { "Client-Id": DOKU_CLIENT_ID, "Request-Id": reqId, "Request-Timestamp": reqTs, "Signature": sig, "Content-Type": "application/json" },
        body: bodyStr,
      });
      const j = await r.json();
      // Log FULL response — untuk debug field path VA
      console.log(`[Checkout] response (HTTP ${r.status}) FULL:`, JSON.stringify(j));
      if (!r.ok || !j.response?.payment?.url) {
        const errArr = Array.isArray(j.message) ? j.message : [];
        const errMsg = errArr.join("; ") || j.error?.message || j.error_message || JSON.stringify(j).slice(0, 300);
        throw new Error(`DOKU Checkout error (${r.status}): ${errMsg}`);
      }
      const vaNum = extractVaNumber(j);
      if (transactionId) {
        await fetch(`${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}`, {
          method: "PATCH",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            doku_payment_url: j.response.payment.url,
            doku_token_id: j.response.payment.token_id ?? null,
            doku_expired_date: j.response.payment.expired_date ?? null,
            doku_va_number: vaNum ?? null,
          }),
        });
      }
      return {
        payment_url: j.response.payment.url as string,
        token_id: j.response.payment.token_id as string | null,
        expired_date: j.response.payment.expired_date as string | null,
        invoice_number: transactionCode,
        va_number: vaNum,
      };
    };

    // ── Branch: single VA → SNAP VA only (no fallback) ──────────────────────
    // Non-VA methods (e-wallet, multi-channel) → Checkout API
    const channel = toSnapChannel(paymentMethodTypes?.length === 1 ? paymentMethodTypes[0] : "");
    const isSingleVa = paymentMethodTypes?.length === 1 && channel !== "VIRTUAL_ACCOUNT_DOKU";

    let result: { payment_url: string | null; token_id: string | null; expired_date: string | null; invoice_number: string; va_number: string | null };

    if (isSingleVa) {
      // ── SNAP Direct VA — DGPC mode (DOKU Generated Payment Code) ────────────
      // Semua bank di akun ini pakai DGPC: partnerServiceId dikirim, DOKU yang
      // generate customerNo + virtualAccountNo. Merchant TIDAK kirim customerNo.
      let snapTokenResult: { token: string; timestamp: string };
      try {
        snapTokenResult = await getSnapToken(DOKU_CLIENT_ID, DOKU_PRIVATE_KEY, baseUrl);
      } catch (snapTokenErr) {
        const msg = snapTokenErr instanceof Error ? snapTokenErr.message : String(snapTokenErr);
        console.error(`[SNAP] Token failed: ${msg}`);
        const checkoutRes = await runCheckoutApi(paymentMethodTypes);
        result = checkoutRes;
        return new Response(JSON.stringify({ success: true, data: result, _snap_debug: `SNAP TOKEN FAILED: ${msg}`, _env: { isProd, DOKU_ENV } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { token: accessToken, timestamp } = snapTokenResult;
      // Skip SNAP for banks not configured in merchant portal (no customerNo prefix known)
      if (!(channel in CUSTOMER_NO_PREFIX) && !FALLBACK_PARTNER_SERVICE_IDS[channel] && channel !== "VIRTUAL_ACCOUNT_BNC") {
        console.warn(`[SNAP-DGPC] Channel ${channel} not in merchant SNAP config — using Classic Checkout`);
        const checkoutRes = await runCheckoutApi(paymentMethodTypes);
        result = checkoutRes;
        return new Response(JSON.stringify({ success: true, data: result, _snap_debug: `NO_SNAP_CONFIG: ${channel}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const psiFromDb = await getPartnerServiceIdFromDb(channel, supabaseUrl, supabaseKey);
      if (!psiFromDb) {
        console.warn(`[SNAP-DGPC] Channel ${channel} disabled or no PSI — falling back to Checkout`);
        const checkoutRes = await runCheckoutApi(paymentMethodTypes);
        result = checkoutRes;
        return new Response(JSON.stringify({ success: true, data: result, _snap_debug: `PSI NULL: channel=${channel}`, _env: { isProd, DOKU_ENV } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const partnerServiceId = psiFromDb.padStart(8, " ");
      const expiredMs = Date.now() + 180 * 60 * 1000;
      const expiredWib = new Date(expiredMs + 7 * 3600 * 1000);
      const expiredDateStr = expiredWib.toISOString().replace(/\.\d{3}Z$/, "+07:00");

      // v1.1 DGPC: customerNo & virtualAccountNo wajib disertakan.
      // virtualAccountNo = partnerServiceId (8 chars, WITH leading spaces) + customerNo (8 digits) = 16 chars total
      // customerNo MUST start with the bank's Prefix Customer No (from DOKU portal) — DOKU rejects without it
      const trimmedPsiForVa = partnerServiceId.trimStart(); // digits-only portion (untuk response parsing)
      const txHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(transactionCode));
      const txHashBytes = new Uint8Array(txHashBuf);
      const txHashNum = ((txHashBytes[0] << 24) | (txHashBytes[1] << 16) | (txHashBytes[2] << 8) | txHashBytes[3]) >>> 0;
      // prefix (1 digit) + hash-based (7 digits) = 8 chars total
      const prefix = CUSTOMER_NO_PREFIX[channel] ?? "0";
      const customerNo = prefix + String(txHashNum % 10000000).padStart(7, "0");
      // virtualAccountNo = partnerServiceId (WITH spaces) + customerNo (DOKU validates this exact concatenation)
      const virtualAccountNo = partnerServiceId + customerNo;
      console.log(`[SNAP-DGPC] customerNo prefix="${prefix}" customerNo="${customerNo}" va="${virtualAccountNo}"`);

      const reqBody = {
        partnerServiceId,
        customerNo,
        virtualAccountNo,
        virtualAccountName: (customerName || "Customer").substring(0, 255),
        ...(customerEmail ? { virtualAccountEmail: customerEmail } : {}),
        ...(customerPhone ? { virtualAccountPhone: customerPhone } : {}),
        trxId: transactionCode,
        totalAmount: { value: Math.round(total).toFixed(2), currency: "IDR" },
        virtualAccountTrxType: "C", // C = Closed/Fixed Amount (FIX_BILL)
        expiredDate: expiredDateStr,
        additionalInfo: { channel },
      };
      const bodyString = JSON.stringify(reqBody);
      const path = "/virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va";
      const signature = await snapApiSignature("POST", path, accessToken, bodyString, timestamp, DOKU_SECRET_KEY);
      console.log(`[SNAP-DGPC] Creating VA: trxId=${transactionCode} channel=${channel} amount=${total} psi="${partnerServiceId}"`);

      // X-EXTERNAL-ID must be numeric string, unique per day
      const externalId = String(Date.now()).slice(-16) + String(txHashNum).slice(-4);
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "X-TIMESTAMP": timestamp, "X-SIGNATURE": signature,
          "X-PARTNER-ID": DOKU_CLIENT_ID,
          "X-EXTERNAL-ID": externalId,
          "CHANNEL-ID": "H2H", "Content-Type": "application/json",
        },
        body: bodyString,
      });
      const jsonText = await res.text();
      const json = JSON.parse(jsonText);
      console.log(`[SNAP-DGPC] VA response (HTTP ${res.status}):`, jsonText.slice(0, 800));

      // Check for 4000500 Conflict — DOKU may return existing VA data in the response
      const isDuplicate = String(json.responseCode ?? "").startsWith("4000500") || String(json.responseCode ?? "") === "4000500";
      const vad = json.virtualAccountData ?? {};
      const existingVa = String(vad.virtualAccountNo ?? "").trim();

      if (isDuplicate && existingVa) {
        // DOKU already has a VA for this trxId — use the one returned in the conflict response
        console.log(`[SNAP-DGPC] Conflict 4000500 but VA found in response: "${existingVa}" — reusing`);
        const expiredDateFinal = vad.expiredDate ?? expiredDateStr;
        const assignedCustomerNo = String(vad.customerNo ?? customerNo);
        if (transactionId) {
          await fetch(`${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}`, {
            method: "PATCH",
            headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ doku_va_number: existingVa, doku_payment_url: null, doku_token_id: `${assignedCustomerNo}|${channel}`, doku_expired_date: expiredDateFinal }),
          });
        }
        result = { payment_url: null, token_id: null, expired_date: expiredDateFinal, invoice_number: transactionCode, va_number: existingVa };
      } else if (!res.ok || !String(json.responseCode ?? "").startsWith("200")) {
        const snapDebugInfo = `HTTP ${res.status} | channel=${channel} | PSI="${partnerServiceId}" | code=${json.responseCode} | msg=${json.responseMessage} | extId=${externalId}`;
        console.error(`[SNAP-DGPC] SNAP error: ${snapDebugInfo} | full=${jsonText.slice(0,400)}`);
        const checkoutRes = await runCheckoutApi(paymentMethodTypes);
        result = checkoutRes;
        return new Response(JSON.stringify({ success: true, data: result, _snap_debug: snapDebugInfo, _snap_raw: jsonText.slice(0, 400), _env: { isProd, DOKU_ENV } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // SNAP VA created successfully
        const vaNumber = String(vad.virtualAccountNo ?? "").trim();
        const expiredDateFinal = vad.expiredDate ?? expiredDateStr;
        const assignedCustomerNo = String(vad.customerNo ?? customerNo);
        if (transactionId) {
          await fetch(`${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}`, {
            method: "PATCH",
            headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ doku_va_number: vaNumber, doku_payment_url: null, doku_token_id: `${assignedCustomerNo}|${channel}`, doku_expired_date: expiredDateFinal }),
          });
        }
        result = { payment_url: null, token_id: null, expired_date: expiredDateFinal, invoice_number: transactionCode, va_number: vaNumber };
      }
    } else {
      // Non-VA methods (e-wallet, QRIS, multi-channel) → Checkout is the only option
      result = await runCheckoutApi(paymentMethodTypes);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[SNAP] doku-create-checkout error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
