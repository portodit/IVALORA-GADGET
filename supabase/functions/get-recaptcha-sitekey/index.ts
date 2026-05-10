import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // Return the reCAPTCHA site key (public key, safe to expose)
    // If no key configured, return null — reCAPTCHA will be skipped gracefully
    const siteKey = Deno.env.get("RECAPTCHA_SITE_KEY") ?? null;

    return new Response(
      JSON.stringify({ siteKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    // Gracefully degrade: return null so the client skips reCAPTCHA
    return new Response(
      JSON.stringify({ siteKey: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
