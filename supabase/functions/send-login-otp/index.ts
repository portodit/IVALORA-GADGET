import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateOtp(): string {
  const digits = "0123456789";
  let otp = "";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) {
    otp += digits[arr[i] % 10];
  }
  return otp;
}

async function sendEmailSmtp(to: string, otp: string): Promise<void> {
  const smtpUser = Deno.env.get("SMTP_USER")!;
  const smtpPass = Deno.env.get("SMTP_PASS")!;

  const emailBody = [
    `From: "Ivalora Gadget" <${smtpUser}>`,
    `To: ${to}`,
    `Subject: Kode Verifikasi Login - Ivalora Gadget`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #18181b; padding: 24px 32px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Ivalora Gadget RMS</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 8px; font-size: 18px; color: #18181b;">Kode Verifikasi Login</h2>
      <p style="color: #71717a; font-size: 14px; margin: 0 0 24px;">Gunakan kode berikut untuk masuk ke panel admin.</p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #18181b; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #71717a; font-size: 13px; margin: 0;">Kode ini berlaku selama <strong>5 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
    </div>
  </div>
</body>
</html>`,
  ].join("\r\n");

  // Encode to base64url
  const encoder = new TextEncoder();
  const encoded = btoa(String.fromCharCode(...encoder.encode(emailBody)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  // Use Gmail API via OAuth2 — but simpler: use fetch to Gmail SMTP via Nodemailer-compatible approach
  // Actually use direct SMTP via Deno TCP (Gmail port 587)
  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: smtpUser,
        password: smtpPass,
      },
    },
  });

  await client.send({
    from: `Ivalora Gadget <${smtpUser}>`,
    to,
    subject: "Kode Verifikasi Login - Ivalora Gadget",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #18181b; padding: 24px 32px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Ivalora Gadget RMS</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 8px; font-size: 18px; color: #18181b;">Kode Verifikasi Login</h2>
      <p style="color: #71717a; font-size: 14px; margin: 0 0 24px;">Gunakan kode berikut untuk masuk ke panel admin.</p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #18181b; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #71717a; font-size: 13px; margin: 0;">Kode ini berlaku selama <strong>5 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
    </div>
  </div>
</body>
</html>`,
  });

  await client.close();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate caller
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { user_id, email } = await req.json();
    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (user.id !== user_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store OTP in user metadata
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: {
        login_otp: otp,
        login_otp_expires: expiresAt,
      },
    });

    if (updateErr) {
      console.error("Failed to store OTP:", updateErr);
      throw new Error("Failed to generate OTP");
    }

    // Rate limiting update
    await supabase
      .from("user_profiles")
      .update({ last_resend_at: new Date().toISOString() })
      .eq("id", user_id);

    // Send email via Gmail SMTP
    await sendEmailSmtp(email, otp);
    console.log(`OTP sent to ${email} (expires ${expiresAt})`);

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-login-otp error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
