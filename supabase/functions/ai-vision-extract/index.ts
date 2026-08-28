import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const organizationId = membership.organization_id;

    const { image_base64, image_url } = await req.json();
    if (!image_base64 && !image_url) {
      return new Response(JSON.stringify({ error: "image_base64 or image_url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve OpenAI key — same two-step fallback as ai-agent-respond
    const [orgRes, legacyRes] = await Promise.all([
      supabase.from("organizations").select("openai_api_key").eq("id", organizationId).maybeSingle(),
      supabase.from("ai_agent_config").select("openai_api_key").eq("organization_id", organizationId).maybeSingle(),
    ]);
    const openaiKey = orgRes.data?.openai_api_key?.trim() || legacyRes.data?.openai_api_key?.trim();
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const imageContent = image_base64
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}`, detail: "high" } }
      : { type: "image_url", image_url: { url: image_url, detail: "high" } };

    const systemPrompt = `Você analisa prints de conversas do WhatsApp e extrai as mensagens em ordem cronológica.

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "messages": [
    { "role": "inbound", "content": "texto da mensagem recebida" },
    { "role": "outbound", "content": "texto da mensagem enviada" }
  ]
}

Regras:
- "inbound" = mensagem recebida (cliente/lead), geralmente aparece à esquerda ou com fundo branco/cinza
- "outbound" = mensagem enviada (empresa/atendente), geralmente aparece à direita ou com fundo verde/azul
- Mantenha a ordem cronológica exata
- Preserve o texto original, incluindo emojis e formatação
- Ignore timestamps, nomes de contato, status de leitura, indicadores de mídia (se for áudio/imagem sem texto, ignore)
- Se não conseguir identificar mensagens claras, retorne {"messages": []}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [{ type: "text", text: "Extraia as mensagens desta conversa:" }, imageContent] },
        ],
        max_tokens: 2000,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[ai-vision-extract] OpenAI error:", res.status, err);
      return new Response(JSON.stringify({ error: `OpenAI error: ${res.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const completion = await res.json();
    const content = completion.choices?.[0]?.message?.content || "{}";
    let parsed: { messages?: { role: string; content: string }[] } = {};
    try { parsed = JSON.parse(content); } catch { parsed = { messages: [] }; }

    return new Response(JSON.stringify({ messages: parsed.messages || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[ai-vision-extract] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
