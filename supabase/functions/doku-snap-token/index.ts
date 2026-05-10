const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // DOKU calls this endpoint to get an access token (B2B SNAP flow)
  // Respond with a valid OAuth2 token response
  const token = `snap-token-${Date.now()}`;
  const response = {
    accessToken: token,
    tokenType: "Bearer",
    expiresIn: 900,
    additionalInfo: {},
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
