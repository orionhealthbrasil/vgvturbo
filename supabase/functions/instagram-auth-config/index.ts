// Returns the public Instagram APP_ID so the frontend can build the OAuth URL
// without needing a build-time VITE_ env var. The APP_ID is public information
// (it appears in the OAuth URL anyway), so exposing it via an unauthenticated
// endpoint is safe.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const appId = Deno.env.get("INSTAGRAM_APP_ID") ?? "";

  if (!appId) {
    return new Response(
      JSON.stringify({ error: "INSTAGRAM_APP_ID not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ app_id: appId }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // Cache at the edge for 1h — the APP_ID rarely changes
      "Cache-Control": "public, max-age=3600",
    },
  });
});
