import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-service-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, event_type, context, contact_id, conversation_snapshot } = await req.json();
    if (!organization_id || !event_type || !context) {
      return new Response(JSON.stringify({ error: "organization_id, event_type, context required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get org data: manager phone + OpenAI key
    const [orgRes, agentRes] = await Promise.all([
      supabase.from("organizations").select("manager_whatsapp_phone, openai_api_key").eq("id", organization_id).maybeSingle(),
      supabase.from("ai_agents").select("id, system_prompt, model").eq("organization_id", organization_id).eq("category", "system").eq("is_active", true).maybeSingle(),
    ]);

    const managerPhone = orgRes.data?.manager_whatsapp_phone?.replace(/\D/g, "") || null;
    if (!managerPhone) {
      console.log("[system-agent-notify] No manager phone configured for org", organization_id);
      return new Response(JSON.stringify({ skipped: true, reason: "no_manager_phone" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Throttle: max 1 notification per contact per event type per hour
    if (contact_id) {
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { data: recent } = await supabase
        .from("manager_notifications_log")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("contact_id", contact_id)
        .eq("event_type", event_type)
        .gte("created_at", oneHourAgo)
        .limit(1);
      if (recent && recent.length > 0) {
        console.log("[system-agent-notify] Throttled — already notified for this contact/event in the last hour");
        return new Response(JSON.stringify({ skipped: true, reason: "throttled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Resolve OpenAI key
    const [orgKeyRes, legacyKeyRes] = await Promise.all([
      supabase.from("organizations").select("openai_api_key").eq("id", organization_id).maybeSingle(),
      supabase.from("ai_agent_config").select("openai_api_key").eq("organization_id", organization_id).maybeSingle(),
    ]);
    const openaiKey = orgKeyRes.data?.openai_api_key?.trim() || legacyKeyRes.data?.openai_api_key?.trim();
    if (!openaiKey) {
      console.error("[system-agent-notify] No OpenAI key for org", organization_id);
      return new Response(JSON.stringify({ error: "OpenAI key not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch contact name for context if available
    let contactName = "";
    if (contact_id) {
      const { data: contactData } = await supabase.from("contacts").select("name, phone").eq("id", contact_id).maybeSingle();
      contactName = contactData?.name || contactData?.phone || "";
    }

    const eventLabels: Record<string, string> = {
      sale_detected: "💰 Venda detectada",
      tension_detected: "⚠️ Tensão na conversa",
      automation_trigger: "🤖 Notificação de automação",
      test: "🧪 Teste",
    };
    const eventLabel = eventLabels[event_type] || `📌 ${event_type}`;

    const systemPrompt = agentRes.data?.system_prompt ||
      "Você é um assistente do gestor. Resuma eventos do atendimento de forma clara e objetiva em mensagens curtas de WhatsApp.";

    const userMessage = `${eventLabel}${contactName ? ` — Contato: ${contactName}` : ""}

${context}${conversation_snapshot ? `\n\nTrecho da conversa:\n${conversation_snapshot}` : ""}

Escreva uma notificação curta (máx 3 frases) para o gestor sobre isso. Direto, objetivo, sem introdução. Mencione o nome do contato se relevante.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: agentRes.data?.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 200,
        temperature: 0.5,
      }),
    });

    if (!openaiRes.ok) {
      console.error("[system-agent-notify] OpenAI error:", openaiRes.status, await openaiRes.text());
      return new Response(JSON.stringify({ error: "OpenAI error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const completion = await openaiRes.json();
    const notificationText = completion.choices?.[0]?.message?.content?.trim();
    if (!notificationText) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get WhatsApp instance to send
    const { data: instance } = await supabase.from("whatsapp_instances").select("base_url, api_key").eq("organization_id", organization_id).maybeSingle();
    if (!instance) {
      console.error("[system-agent-notify] No WhatsApp instance for org", organization_id);
      return new Response(JSON.stringify({ error: "No WhatsApp instance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sendRes = await fetch(`${instance.base_url}/message/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: instance.api_key },
      body: JSON.stringify({ number: managerPhone, text: notificationText }),
    });

    if (!sendRes.ok) {
      console.error("[system-agent-notify] WhatsApp send failed:", sendRes.status, await sendRes.text());
      return new Response(JSON.stringify({ error: "WhatsApp send failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log the notification
    await supabase.from("manager_notifications_log").insert({
      organization_id,
      contact_id: contact_id || null,
      event_type,
      summary: notificationText,
    });

    console.log("[system-agent-notify] Notification sent to manager:", managerPhone, "event:", event_type);
    return new Response(JSON.stringify({ success: true, notification: notificationText }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[system-agent-notify] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
