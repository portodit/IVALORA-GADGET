import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, code } = await req.json();
    if (!user_id || !code) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get user metadata to check OTP
    const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(user_id);
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const storedOtp = user.user_metadata?.login_otp;
    const expiresAt = user.user_metadata?.login_otp_expires;

    if (!storedOtp || !expiresAt) {
      return new Response(
        JSON.stringify({ error: "Kode OTP tidak ditemukan. Silakan minta kode baru." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check expiry
    if (new Date(expiresAt) < new Date()) {
      // Clear expired OTP
      await supabase.auth.admin.updateUserById(user_id, {
        user_metadata: { login_otp: null, login_otp_expires: null },
      });
      return new Response(
        JSON.stringify({ error: "Kode OTP sudah kedaluwarsa. Silakan minta kode baru." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify code
    if (storedOtp !== code) {
      return new Response(
        JSON.stringify({ error: "Kode OTP salah" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Clear OTP after successful verification
    await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: { login_otp: null, login_otp_expires: null },
    });

    console.log(`OTP verified for user ${user_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("verify-login-otp error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
