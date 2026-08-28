/**
 * manager-dialogue: Routes the manager's WhatsApp messages to the system AI agent.
 * Called by stevo-webhook when the inbound sender matches organization.manager_whatsapp_phone.
 */
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

    const { organization_id, contact_id, message_content } = await req.json();
    if (!organization_id || !contact_id || !message_content) {
      return new Response(JSON.stringify({ error: "organization_id, contact_id, message_content required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get system agent for this org
    const { data: agent } = await supabase
      .from("ai_agents")
      .select("id, system_prompt, about_company, faq_content, model, max_context_messages")
      .eq("organization_id", organization_id)
      .eq("category", "system")
      .eq("is_active", true)
      .maybeSingle();

    if (!agent) {
      console.log("[manager-dialogue] No active system agent for org", organization_id);
      return new Response(JSON.stringify({ skipped: true, reason: "no_system_agent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve OpenAI key
    const [orgKeyRes, legacyKeyRes] = await Promise.all([
      supabase.from("organizations").select("openai_api_key").eq("id", organization_id).maybeSingle(),
      supabase.from("ai_agent_config").select("openai_api_key").eq("organization_id", organization_id).maybeSingle(),
    ]);
    const openaiKey = orgKeyRes.data?.openai_api_key?.trim() || legacyKeyRes.data?.openai_api_key?.trim();
    if (!openaiKey) {
      console.error("[manager-dialogue] No OpenAI key");
      return new Response(JSON.stringify({ error: "OpenAI key not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get conversation history for this manager contact (last N messages)
    const maxCtx = Number(agent.max_context_messages) || 20;
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("content, direction, created_at")
      .eq("contact_id", contact_id)
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .limit(maxCtx);

    const historyMessages: { role: string; content: string }[] = (recentMessages || [])
      .reverse()
      .map((m: any) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content || "",
      }))
      .filter((m: any) => m.content);

    // Build system prompt
    const systemContent =
      agent.system_prompt +
      (agent.about_company ? `\n\nSobre a empresa:\n${agent.about_company}` : "") +
      (agent.faq_content ? `\n\nFAQ:\n${agent.faq_content}` : "") +
      `\n\nVocê está respondendo DIRETAMENTE ao gestor da empresa via WhatsApp. O gestor pode pedir relatórios, ações no CRM, ou informações sobre atendimentos. Seja direto e objetivo. Use as ferramentas disponíveis quando necessário para buscar dados reais.`;

    // The last message is already in history (saved by stevo-webhook before calling us).
    // If not yet saved, ensure it's at the end.
    const lastInHistory = historyMessages[historyMessages.length - 1];
    const messageAlreadyInHistory = lastInHistory?.role === "user" && lastInHistory?.content === message_content;
    if (!messageAlreadyInHistory) {
      historyMessages.push({ role: "user", content: message_content });
    }

    const openaiMessages = [
      { role: "system", content: systemContent },
      ...historyMessages,
    ];

    // Call ai-system-agent to handle the conversation with full tool support
    const systemAgentUrl = `${supabaseUrl}/functions/v1/ai-system-agent`;
    const agentRes = await fetch(systemAgentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        "x-internal-service-key": supabaseKey,
      },
      body: JSON.stringify({
        agent_id: agent.id,
        messages: historyMessages,
        organization_id,
      }),
    });

    if (!agentRes.ok) {
      console.error("[manager-dialogue] ai-system-agent error:", agentRes.status, await agentRes.text());
      return new Response(JSON.stringify({ error: "System agent error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const agentResult = await agentRes.json();
    const replyContent = agentResult?.content;

    if (!replyContent) {
      console.log("[manager-dialogue] System agent returned no content (may have used send_message tool)");
      return new Response(JSON.stringify({ success: true, handled_by_tool: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send the reply to manager via WhatsApp
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("base_url, api_key")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!instance) {
      console.error("[manager-dialogue] No WhatsApp instance");
      return new Response(JSON.stringify({ error: "No WhatsApp instance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: contact } = await supabase.from("contacts").select("phone").eq("id", contact_id).maybeSingle();
    const managerPhone = contact?.phone?.replace(/\D/g, "") || "";

    const sendRes = await fetch(`${instance.base_url}/message/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: instance.api_key },
      body: JSON.stringify({ number: managerPhone, text: replyContent }),
    });

    if (!sendRes.ok) {
      console.error("[manager-dialogue] WhatsApp send failed:", sendRes.status);
    } else {
      const sendResult = await sendRes.json();
      await supabase.from("messages").insert({
        contact_id,
        organization_id,
        content: replyContent,
        direction: "outbound",
        message_type: "text",
        status: "sent",
        whatsapp_message_id: sendResult?.key?.id || null,
        sent_by_agent_id: agent.id,
      });
      await supabase.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact_id);
    }

    console.log("[manager-dialogue] Reply sent to manager for org", organization_id);
    return new Response(JSON.stringify({ success: true, reply: replyContent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[manager-dialogue] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
