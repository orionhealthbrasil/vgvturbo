import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Autenticar o usuário que está fazendo a requisição
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }

    // Cliente com a chave do usuário para verificar identidade e role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: corsHeaders });
    }

    const { organization_id, amount, description, credit_subtype } = await req.json();

    if (!organization_id || typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), { status: 400, headers: corsHeaders });
    }
    if (!["purchased", "bonus"].includes(credit_subtype)) {
      return new Response(JSON.stringify({ error: "credit_subtype deve ser 'purchased' ou 'bonus'" }), { status: 400, headers: corsHeaders });
    }

    // Verificar se o usuário é super admin (pode operar em qualquer org)
    const { data: superAdminRole } = await userClient
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    const isSuperAdmin = !!superAdminRole;

    if (!isSuperAdmin) {
      // Verificar que o usuário é admin ou owner da organização
      const { data: membership, error: memberError } = await userClient
        .from("organization_members")
        .select("member_role")
        .eq("organization_id", organization_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberError || !membership) {
        return new Response(JSON.stringify({ error: "Você não é membro desta organização" }), { status: 403, headers: corsHeaders });
      }

      if (!["admin", "owner"].includes(membership.member_role)) {
        return new Response(JSON.stringify({ error: "Apenas super admins podem adicionar créditos" }), { status: 403, headers: corsHeaders });
      }
    }

    // Inserir com service_role para burlar RLS (apenas service_role pode escrever)
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data, error } = await serviceClient
      .from("credit_transactions")
      .insert({
        organization_id,
        amount,
        transaction_type: "credit",
        credit_subtype,
        description: description || (credit_subtype === "bonus" ? "Bônus" : "Recarga — compra"),
        added_by_user_id: user.id,
        metadata: { added_by_email: user.email, credit_subtype },
      })
      .select()
      .single();

    if (error) {
      console.error("[admin-add-credits] insert error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    console.log(`[admin-add-credits] +$${amount} para org ${organization_id} por ${user.email}`);

    return new Response(JSON.stringify({ success: true, transaction: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[admin-add-credits] error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
