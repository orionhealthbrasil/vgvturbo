// Follow-up SDR Guardian
// Roda a cada 30 minutos via cron. Varre contatos sem resposta e dispara
// o agente SDR de follow-up configurado para a organização.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Máximo de contatos processados por execução (evita timeout)
const BATCH_LIMIT = 50;

async function callSdrGenerate(
  supabaseUrl: string,
  serviceKey: string,
  contactId: string,
  agentId: string,
): Promise<{ success: boolean; action?: string; reason?: string }> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/ai-sdr-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ contact_id: contactId, agent_id: agentId }),
    });
    const data = await resp.json();
    if (!resp.ok) return { success: false, reason: data?.error || `HTTP ${resp.status}` };
    if (data?.skipped) return { success: false, reason: data?.reason || "skipped" };
    return { success: true, action: data?.action };
  } catch (e) {
    return { success: false, reason: e instanceof Error ? e.message : "fetch error" };
  }
}

async function triggerExhaustedAutomation(
  supabaseUrl: string,
  serviceKey: string,
  contactId: string,
  organizationId: string,
  automationId: string,
): Promise<void> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/automation-engine`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ contact_id: contactId, organization_id: organizationId, automation_id: automationId }),
    });
    if (!resp.ok) {
      console.error(`[followup-sdr-guardian] Exhausted automation failed contact=${contactId}:`, resp.status, await resp.text());
    }
  } catch (e) {
    console.error(`[followup-sdr-guardian] Exhausted automation error contact=${contactId}:`, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const stats = { triggered: 0, exhausted: 0, errors: 0, skipped: 0, orgs_processed: 0 };

  try {
    // 1. Encontra todos os agentes de follow-up ativos em todas as orgs
    const { data: followupAgents, error: agentsErr } = await supabase
      .from("ai_agents")
      .select("id, organization_id, inactivity_trigger_hours, max_followup_attempts, followup_exhausted_automation_id")
      .eq("is_followup", true)
      .eq("is_active", true)
      .eq("category", "sdr")
      .not("inactivity_trigger_hours", "is", null);

    if (agentsErr) {
      console.error("[followup-sdr-guardian] Error loading agents:", agentsErr);
      return new Response(JSON.stringify({ error: agentsErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!followupAgents?.length) {
      return new Response(JSON.stringify({ ...stats, message: "No active follow-up SDR agents found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[followup-sdr-guardian] Found ${followupAgents.length} active follow-up agent(s)`);

    // 2. Para cada agente, varre os contatos qualificados da org
    for (const agent of followupAgents) {
      stats.orgs_processed++;

      const triggerHours = agent.inactivity_trigger_hours as number;
      const maxAttempts = (agent.max_followup_attempts as number) ?? 3;
      const cutoff = new Date(Date.now() - triggerHours * 60 * 60 * 1000).toISOString();

      // Contatos qualificados:
      // - abertos e não arquivados
      // - sem fluxo de automação ativo
      // - sem pausa por humano
      // - última mensagem anterior ao cutoff
      // - sdr_last_triggered_at nulo ou também anterior ao cutoff
      //   (garante que não disparamos duas vezes na mesma janela de inatividade)
      const { data: contacts, error: contactsErr } = await supabase
        .from("contacts")
        .select("id, sdr_attempt_count, sdr_last_triggered_at")
        .eq("organization_id", agent.organization_id)
        .eq("status", "open")
        .eq("is_archived", false)
        .is("active_flow_id", null)
        .eq("automations_paused", false)
        .lt("last_message_at", cutoff)
        .or(`sdr_last_triggered_at.is.null,sdr_last_triggered_at.lt.${cutoff}`)
        .limit(BATCH_LIMIT);

      if (contactsErr) {
        console.error(`[followup-sdr-guardian] Error loading contacts for org ${agent.organization_id}:`, contactsErr);
        stats.errors++;
        continue;
      }

      if (!contacts?.length) {
        console.log(`[followup-sdr-guardian] No qualifying contacts for org ${agent.organization_id}`);
        continue;
      }

      console.log(`[followup-sdr-guardian] Org ${agent.organization_id}: ${contacts.length} qualifying contact(s)`);

      for (const contact of contacts) {
        const attempts = contact.sdr_attempt_count ?? 0;

        // Ciclo de tentativas esgotado
        if (attempts >= maxAttempts) {
          console.log(`[followup-sdr-guardian] Contact ${contact.id} exhausted (${attempts}/${maxAttempts} attempts)`);

          if (agent.followup_exhausted_automation_id) {
            await triggerExhaustedAutomation(
              supabaseUrl,
              serviceKey,
              contact.id,
              agent.organization_id,
              agent.followup_exhausted_automation_id,
            );
          }

          // Reseta o ciclo; sdr_last_triggered_at = now() evita que o próximo
          // run do guardian inicie um novo ciclo antes que a automação de
          // esgotamento tenha chance de agir (ex: fechar o contato)
          await supabase.from("contacts").update({
            sdr_attempt_count: 0,
            sdr_last_triggered_at: new Date().toISOString(),
          }).eq("id", contact.id);

          stats.exhausted++;
          continue;
        }

        // Dispara o SDR
        const result = await callSdrGenerate(supabaseUrl, serviceKey, contact.id, agent.id);

        if (result.success) {
          await supabase.from("contacts").update({
            sdr_last_triggered_at: new Date().toISOString(),
            sdr_attempt_count: attempts + 1,
          }).eq("id", contact.id);

          console.log(`[followup-sdr-guardian] Contact ${contact.id} → action=${result.action} attempt=${attempts + 1}/${maxAttempts}`);
          stats.triggered++;
        } else {
          console.warn(`[followup-sdr-guardian] Contact ${contact.id} skipped: ${result.reason}`);
          stats.skipped++;
        }
      }
    }

    console.log("[followup-sdr-guardian] Done:", stats);
    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[followup-sdr-guardian] Unhandled error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown", stats }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
