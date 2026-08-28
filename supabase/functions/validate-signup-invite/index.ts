import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invite_code } = await req.json();

    if (!invite_code || typeof invite_code !== "string") {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing invite_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("organization_invites")
      .select("id, organization_id, invite_type, expires_at, max_uses, use_count, is_active")
      .eq("invite_code", invite_code)
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invite not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data.is_active) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invite inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invite expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (data.max_uses !== null && data.use_count >= data.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invite usage limit reached" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let organization_name: string | null = null;
    if (data.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", data.organization_id)
        .maybeSingle();
      organization_name = org?.name ?? null;
    }

    return new Response(
      JSON.stringify({
        valid: true,
        invite_type: data.invite_type,
        organization_id: data.organization_id,
        organization_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
