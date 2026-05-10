const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const restHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const restGet = async (table: string, query: string) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers: restHeaders });
    return res.json();
  };

  const restPatch = async (table: string, query: string, body: unknown) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
      method: "PATCH",
      headers: { ...restHeaders, Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const adminAuthHeaders = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "Content-Type": "application/json",
  };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "Invalid JSON" }, 400);
  }

  const action = body.action as string;

  try {
    switch (action) {
      case "list_customers":
        return jsonResp(await listCustomers(supabaseUrl, restHeaders, body));
      case "search_customers":
        return jsonResp(await searchCustomers(supabaseUrl, restHeaders, body));
      case "get_customer_detail":
        return jsonResp(await getCustomerDetail(supabaseUrl, restHeaders, body));
      case "create_customer":
        return jsonResp(await createCustomer(supabaseUrl, adminAuthHeaders, restHeaders, body));
      case "verify_email":
        return jsonResp(await verifyEmail(supabaseUrl, adminAuthHeaders, body));
      case "update_email":
        return jsonResp(await updateEmail(supabaseUrl, adminAuthHeaders, body));
      case "update_password":
        return jsonResp(await updatePassword(supabaseUrl, adminAuthHeaders, body));
      case "suspend":
        return jsonResp(await suspendUser(supabaseUrl, restHeaders, adminAuthHeaders, body));
      case "activate":
        return jsonResp(await activateUser(supabaseUrl, restHeaders, adminAuthHeaders, body));
      case "delete":
        return jsonResp(await deleteUser(supabaseUrl, adminAuthHeaders, restHeaders, body));
      case "export_customers":
        return jsonResp(await listCustomers(supabaseUrl, restHeaders, body));
      case "invite_customer_login":
        return jsonResp(await inviteCustomerLogin(supabaseUrl, restHeaders, adminAuthHeaders, body));
      default:
        return jsonResp({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error(`[manage-customer] Error in action=${action}:`, e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Headers { [key: string]: string }

async function listCustomers(supabaseUrl: string, restHeaders: Headers, body: Record<string, unknown>) {
  const branchId = body.branch_id as string | undefined;

  const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      Authorization: restHeaders.Authorization,
      apikey: restHeaders.apikey,
    },
  });
  const authData = await authRes.json();
  const authUsers = authData.users ?? [];

  const profiles: Record<string, { full_name: string | null; phone: string | null; status: string }> = {};
  const profileRows = await fetchRest(supabaseUrl, restHeaders, "user_profiles", "select=id,full_name,phone,status");
  for (const p of profileRows) {
    profiles[p.id] = { full_name: p.full_name, phone: p.phone, status: p.status };
  }

  const adminUserIds = new Set<string>();
  const roleRows = await fetchRest(supabaseUrl, restHeaders, "user_roles", "select=user_id,role");
  for (const r of roleRows) {
    adminUserIds.add(r.user_id);
  }

  let txQuery = "select=id,customer_user_id,customer_name,customer_email,customer_phone,total,status,created_at,branch_id&order=created_at.desc";
  if (branchId) txQuery += `&branch_id=eq.${branchId}`;
  const transactions = await fetchRest(supabaseUrl, restHeaders, "transactions", txQuery);

  const customerMap = new Map<string, {
    id: string; email: string; full_name: string | null; phone: string | null;
    email_confirmed: boolean; email_confirmed_at: string | null;
    created_at: string; last_sign_in_at: string | null;
    profile_status: string; has_account: boolean; source: "website" | "pos";
    tx_count: number; tx_total_value: number; tx_last_at: string | null;
  }>();

  for (const u of authUsers) {
    if (adminUserIds.has(u.id)) continue;

    const profile = profiles[u.id];
    customerMap.set(u.id, {
      id: u.id,
      email: u.email ?? "",
      full_name: profile?.full_name ?? u.user_metadata?.full_name ?? null,
      phone: profile?.phone ?? u.phone ?? null,
      email_confirmed: !!u.email_confirmed_at,
      email_confirmed_at: u.email_confirmed_at ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      profile_status: profile?.status ?? "pending",
      has_account: true,
      source: "website" as const,
      tx_count: 0,
      tx_total_value: 0,
      tx_last_at: null,
    });
  }

  const guestMap = new Map<string, {
    email: string; name: string | null; phone: string | null;
    tx_count: number; tx_total_value: number; tx_last_at: string | null;
    first_at: string;
  }>();

  for (const tx of transactions) {
    if (tx.customer_user_id && customerMap.has(tx.customer_user_id)) {
      const c = customerMap.get(tx.customer_user_id)!;
      c.tx_count++;
      c.tx_total_value += tx.total ?? 0;
      if (!c.tx_last_at || tx.created_at > c.tx_last_at) c.tx_last_at = tx.created_at;
      if (c.source === "website") c.source = "website";
    } else if (!tx.customer_user_id && tx.customer_email) {
      const key = (tx.customer_email ?? "").toLowerCase().trim();
      if (!key) continue;
      const existing = guestMap.get(key);
      if (existing) {
        existing.tx_count++;
        existing.tx_total_value += tx.total ?? 0;
        if (tx.created_at > (existing.tx_last_at ?? "")) existing.tx_last_at = tx.created_at;
        if (!existing.name && tx.customer_name) existing.name = tx.customer_name;
        if (!existing.phone && tx.customer_phone) existing.phone = tx.customer_phone;
      } else {
        guestMap.set(key, {
          email: tx.customer_email,
          name: tx.customer_name,
          phone: tx.customer_phone,
          tx_count: 1,
          tx_total_value: tx.total ?? 0,
          tx_last_at: tx.created_at,
          first_at: tx.created_at,
        });
      }
    } else if (!tx.customer_user_id && tx.customer_phone) {
      const key = `phone:${(tx.customer_phone ?? "").trim()}`;
      if (!key || key === "phone:") continue;
      const existing = guestMap.get(key);
      if (existing) {
        existing.tx_count++;
        existing.tx_total_value += tx.total ?? 0;
        if (tx.created_at > (existing.tx_last_at ?? "")) existing.tx_last_at = tx.created_at;
      } else {
        guestMap.set(key, {
          email: tx.customer_phone ?? "",
          name: tx.customer_name,
          phone: tx.customer_phone,
          tx_count: 1,
          tx_total_value: tx.total ?? 0,
          tx_last_at: tx.created_at,
          first_at: tx.created_at,
        });
      }
    }
  }

  let idx = 0;
  for (const [, g] of guestMap) {
    const matchedRegistered = [...customerMap.values()].find(
      c => c.email.toLowerCase() === g.email.toLowerCase()
    );
    if (matchedRegistered) {
      matchedRegistered.tx_count += g.tx_count;
      matchedRegistered.tx_total_value += g.tx_total_value;
      if (!matchedRegistered.tx_last_at || (g.tx_last_at && g.tx_last_at > matchedRegistered.tx_last_at)) {
        matchedRegistered.tx_last_at = g.tx_last_at;
      }
      continue;
    }
    customerMap.set(`pos_guest_${idx++}`, {
      id: `pos_guest_${idx}`,
      email: g.email,
      full_name: g.name,
      phone: g.phone,
      email_confirmed: false,
      email_confirmed_at: null,
      created_at: g.first_at,
      last_sign_in_at: null,
      profile_status: "none",
      has_account: false,
      source: "pos",
      tx_count: g.tx_count,
      tx_total_value: g.tx_total_value,
      tx_last_at: g.tx_last_at,
    });
  }

  const customers = [...customerMap.values()].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return { customers };
}

async function searchCustomers(supabaseUrl: string, restHeaders: Headers, body: Record<string, unknown>) {
  const keyword = ((body.keyword as string) ?? "").toLowerCase().trim();
  if (!keyword) return { customers: [] };

  const kw = encodeURIComponent(keyword);

  // Run all 3 queries in parallel — no more sequential waterfall
  const [authRes, profileRows, roleRows] = await Promise.all([
    fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      headers: { Authorization: restHeaders.Authorization, apikey: restHeaders.apikey },
    }).then(r => r.json()),
    fetchRest(supabaseUrl, restHeaders, "user_profiles",
      `select=id,full_name,phone,status&or=(full_name.ilike.*${kw}*,phone.ilike.*${kw}*)`),
    fetchRest(supabaseUrl, restHeaders, "user_roles", "select=user_id"),
  ]);

  const adminIds = new Set<string>((roleRows as any[]).map((r: any) => r.user_id));

  // Build a lookup map from the full auth user list (for profile cross-reference)
  const authById = new Map<string, any>();
  for (const u of (authRes.users ?? []) as any[]) authById.set(u.id, u);

  // Auth users matched by email keyword, excluding admins
  const emailMatches = ((authRes.users ?? []) as any[]).filter((u: any) =>
    !adminIds.has(u.id) && (u.email ?? "").toLowerCase().includes(keyword)
  );

  // Profile matches (name or phone), excluding admins
  const profileMap = new Map<string, any>();
  for (const p of profileRows as any[]) {
    if (!adminIds.has(p.id)) profileMap.set(p.id, p);
  }

  // Merge: start with email matches
  const customerMap = new Map<string, { id: string; name: string; email: string | null; phone: string | null }>();
  for (const u of emailMatches) {
    const profile = profileMap.get(u.id);
    customerMap.set(u.id, {
      id: u.id,
      name: profile?.full_name ?? u.user_metadata?.full_name ?? "",
      email: u.email ?? null,
      phone: profile?.phone ?? u.phone ?? null,
    });
  }

  // Add profile-matched users (name/phone) not yet in email matches
  for (const [id, p] of profileMap) {
    if (!customerMap.has(id)) {
      const u = authById.get(id);
      if (u) {
        customerMap.set(id, {
          id,
          name: p.full_name ?? u.user_metadata?.full_name ?? "",
          email: u.email ?? null,
          phone: p.phone ?? u.phone ?? null,
        });
      }
    }
  }

  return { customers: [...customerMap.values()] };
}

async function getCustomerDetail(supabaseUrl: string, restHeaders: Headers, body: Record<string, unknown>) {
  const userId = body.user_id as string;
  if (!userId) return { error: "user_id required" };

  const addresses = await fetchRest(
    supabaseUrl, restHeaders, "customer_addresses",
    `select=id,label,full_name,phone,full_address,province_name,regency_name,district_name,village_name,postal_code,is_default&user_id=eq.${userId}&order=is_default.desc,created_at.desc`
  );

  const transactions = await fetchRest(
    supabaseUrl, restHeaders, "transactions",
    `select=id,transaction_code,total,status,created_at,shipping_courier,shipping_service&customer_user_id=eq.${userId}&order=created_at.desc&limit=50`
  );

  return { addresses, transactions };
}

async function createCustomer(supabaseUrl: string, adminAuthHeaders: Headers, restHeaders: Headers, body: Record<string, unknown>) {
  const email = (body.email as string)?.trim();
  const password = body.password as string;
  const fullName = (body.full_name as string)?.trim() || null;
  const phone = (body.phone as string)?.trim() || null;

  if (!email || !password) return { error: "Email dan password wajib." };

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminAuthHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: "customer" },
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    return { error: data.error_description ?? data.msg ?? data.error ?? "Gagal membuat akun" };
  }

  const userId = data.id;

  await fetch(`${supabaseUrl}/rest/v1/user_profiles`, {
    method: "POST",
    headers: { ...restHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      id: userId,
      email,
      full_name: fullName,
      phone,
      status: "active",
    }),
  });

  return { success: true, user_id: userId };
}

async function inviteCustomerLogin(
  supabaseUrl: string,
  restHeaders: Headers,
  adminAuthHeaders: Headers,
  body: Record<string, unknown>,
) {
  const email = (body.email as string)?.trim()?.toLowerCase();
  if (!email) return { error: "Email wajib diisi." };

  // Check if email already exists as a customer auth user (separate from admin auth)
  const authListRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?per_page=10&filter=email.eq.${encodeURIComponent(email)}`,
    { headers: { Authorization: adminAuthHeaders.Authorization, apikey: adminAuthHeaders.apikey } }
  );
  const authList = await authListRes.json();
  const existingUsers = (authList.users ?? []).filter((u: any) => u.email?.toLowerCase() === email);

  if (existingUsers.length > 0) {
    return { error: `Email ${email} sudah terdaftar. Gunakan halaman edit untuk mengubah data.` };
  }

  // Check if email is registered as admin role
  const profileRows = await fetchRest(supabaseUrl, restHeaders, "user_profiles",
    `select=id,status&email=ilike.${encodeURIComponent(email)}`);
  if (profileRows.length > 0) {
    const existingProfile = profileRows[0];
    if (existingProfile.status === "active") {
      return { error: `Email ${email} sudah digunakan untuk akun lain. Gunakan email berbeda.` };
    }
  }

  // Generate OTP for this email — use magic link / otp to verify ownership
  // Supabase OTP signup flow (creates user if not exists, sends email)
  const otpRes = await fetch(`${supabaseUrl}/auth/v1/otp`, {
    method: "POST",
    headers: {
      Authorization: adminAuthHeaders.Authorization,
      apikey: adminAuthHeaders.apikey,
      "Content-Type": "application/json",
      "x-supabase-js-version": "1",
    },
    body: JSON.stringify({
      email,
      type: "signup",
      options: {
        emailRedirectTo: `${supabaseUrl}/auth/v1/callback?redirect_to=${encodeURIComponent(body.redirect_url ?? "/login")}`,
      },
    }),
  });
  const otpData = await otpRes.json();
  if (!otpRes.ok && otpRes.status !== 200) {
    return { error: otpData.msg ?? otpData.error_description ?? "Gagal mengirim email verifikasi." };
  }

  return {
    success: true,
    message: `Email verifikasi berhasil dikirim ke ${email}. Customer perlu klik link di email untuk membuat password.`,
    email_sent_to: email,
  };
}

async function verifyEmail(supabaseUrl: string, adminAuthHeaders: Headers, body: Record<string, unknown>) {
  const userId = body.user_id as string;
  if (!userId) return { error: "user_id required" };

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminAuthHeaders,
    body: JSON.stringify({ email_confirm: true }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.msg ?? "Gagal verifikasi" };
  return { success: true };
}

async function updateEmail(supabaseUrl: string, adminAuthHeaders: Headers, body: Record<string, unknown>) {
  const userId = body.user_id as string;
  const email = (body.email as string)?.trim();
  if (!userId || !email) return { error: "user_id and email required" };

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminAuthHeaders,
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.msg ?? "Gagal ubah email" };

  await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...adminAuthHeaders, apikey: adminAuthHeaders.apikey, Prefer: "return=minimal", "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return { success: true };
}

async function updatePassword(supabaseUrl: string, adminAuthHeaders: Headers, body: Record<string, unknown>) {
  const userId = body.user_id as string;
  const password = body.password as string;
  if (!userId || !password) return { error: "user_id and password required" };

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminAuthHeaders,
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.msg ?? "Gagal ubah password" };
  return { success: true };
}

async function suspendUser(supabaseUrl: string, restHeaders: Headers, adminAuthHeaders: Headers, body: Record<string, unknown>) {
  const userId = body.user_id as string;
  if (!userId) return { error: "user_id required" };

  await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...restHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ status: "suspended" }),
  });

  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminAuthHeaders,
    body: JSON.stringify({ ban_duration: "876000h" }),
  });

  return { success: true };
}

async function activateUser(supabaseUrl: string, restHeaders: Headers, adminAuthHeaders: Headers, body: Record<string, unknown>) {
  const userId = body.user_id as string;
  if (!userId) return { error: "user_id required" };

  await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...restHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ status: "active" }),
  });

  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminAuthHeaders,
    body: JSON.stringify({ ban_duration: "none" }),
  });

  return { success: true };
}

async function deleteUser(supabaseUrl: string, adminAuthHeaders: Headers, restHeaders: Headers, body: Record<string, unknown>) {
  const userId = body.user_id as string;
  if (!userId) return { error: "user_id required" };

  await fetch(`${supabaseUrl}/rest/v1/customer_addresses?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: { ...restHeaders, Prefer: "return=minimal" },
  });

  await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: "DELETE",
    headers: { ...restHeaders, Prefer: "return=minimal" },
  });

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: adminAuthHeaders,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: (data as Record<string, string>).msg ?? "Gagal hapus user" };
  }

  return { success: true };
}

async function fetchRest(supabaseUrl: string, headers: Headers, table: string, query: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) {
    console.error(`[manage-customer] REST error ${table}:`, await res.text());
    return [];
  }
  return res.json();
}
