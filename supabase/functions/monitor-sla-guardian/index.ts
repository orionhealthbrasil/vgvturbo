// Deterministic SLA Guardian — sem IA.
// Lê contacts.sla_clock_started_at (preenchido por trigger no DB) e dispara
// alertas quando ultrapassa sla_threshold_minutes (em minutos úteis).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ALERTS_PER_CYCLE = 20;

function replaceTemplateVariables(
  template: string,
  customerName: string,
  agentName: string,
  waitTimeMinutes: number
): string {
  return template
    .replace(/\{\{customer_name\}\}/g, customerName)
    .replace(/\{\{agent_name\}\}/g, agentName || 'Não atribuído')
    .replace(/\{\{wait_time\}\}/g, String(Math.round(waitTimeMinutes)));
}

function formatPhoneNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

type AlertDestination = { type: 'phone' | 'group'; value: string; label?: string };

async function sendWhatsAppAlert(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  destination: AlertDestination,
  message: string
): Promise<boolean> {
  try {
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!instance?.base_url || !instance?.api_key) {
      console.log('[sla] WhatsApp instance not configured, skipping send');
      return false;
    }
    const number = destination.type === 'group'
      ? (destination.value.endsWith('@g.us') ? destination.value : `${destination.value}@g.us`)
      : formatPhoneNumber(destination.value);
    if (!number) return false;
    const r = await fetch(`${instance.base_url}/send/text`, {
      method: 'POST',
      headers: { apikey: instance.api_key as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, text: message, formatJid: true }),
    });
    if (!r.ok) {
      console.error('[sla] WhatsApp send failed', r.status, await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[sla] sendWhatsAppAlert threw', e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚨 SLA Guardian (deterministic) starting...');

    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select(`
        id, name, sla_enabled, sla_threshold_minutes, sla_alert_phone, sla_alert_phones,
        sla_alert_destinations,
        sla_alert_template, sla_alert_whatsapp_enabled, sla_excluded_tag_ids
      `)
      .eq('sla_enabled', true);

    if (orgError) throw orgError;
    if (!organizations?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No orgs with SLA', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalProcessed = 0;
    let alertsSent = 0;
    const nowIso = new Date().toISOString();
    // Safety cutoff: ignora cronômetros iniciados há mais de 2 dias.
    // Evita disparo em massa em backfill ou conversas muito antigas.
    const SLA_LOOKBACK_HOURS = 48;
    const cutoffIso = new Date(Date.now() - SLA_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

    for (const org of organizations) {
      if (alertsSent >= MAX_ALERTS_PER_CYCLE) break;
      if (!org.sla_threshold_minutes) continue;

      const { data: openContacts, error: cErr } = await supabase
        .from('contacts')
        .select('id, name, phone, organization_id, assigned_to, sla_clock_started_at, snoozed_until, resume_at, flow_paused_until, status, is_group, pipeline_id, funnel_stage')
        .eq('organization_id', org.id)
        .eq('status', 'open')
        .eq('sla_alert_sent', false)
        .or('is_group.is.null,is_group.eq.false')
        .not('sla_clock_started_at', 'is', null)
        .gte('sla_clock_started_at', cutoffIso);

      if (cErr || !openContacts?.length) continue;

      // Pre-fetch per-stage SLA overrides for this org (one query).
      const { data: stagesRows } = await supabase
        .from('funnel_stages')
        .select('pipeline_id, slug, sla_threshold_minutes')
        .eq('organization_id', org.id);
      const stageThresholdMap = new Map<string, number>();
      for (const s of stagesRows || []) {
        if (s.sla_threshold_minutes != null && s.pipeline_id && s.slug) {
          stageThresholdMap.set(`${s.pipeline_id}::${s.slug}`, Number(s.sla_threshold_minutes));
        }
      }


      const notPaused = openContacts.filter(c => {
        if (c.snoozed_until && c.snoozed_until > nowIso) return false;
        if (c.resume_at && c.resume_at > nowIso) return false;
        if (c.flow_paused_until && c.flow_paused_until > nowIso) return false;
        return true;
      });

      const excludedTagIds: string[] = (org as any).sla_excluded_tag_ids || [];
      let eligible = notPaused;
      if (excludedTagIds.length && notPaused.length) {
        const { data: tagged } = await supabase
          .from('contact_tags').select('contact_id').in('tag_id', excludedTagIds);
        const ex = new Set((tagged || []).map((t: any) => t.contact_id));
        eligible = notPaused.filter(c => !ex.has(c.id));
      }
      if (!eligible.length) continue;

      for (const contact of eligible) {
        if (alertsSent >= MAX_ALERTS_PER_CYCLE) break;
        totalProcessed++;

        // minutos úteis decorridos via função SQL
        const { data: minData, error: minErr } = await supabase.rpc('calculate_business_minutes', {
          p_org_id: org.id,
          p_from: contact.sla_clock_started_at,
          p_to: nowIso,
        });
        if (minErr) {
          console.error('[sla] calculate_business_minutes err', minErr);
          continue;
        }
        const businessMinutes = Number(minData ?? 0);
        // Effective threshold: per-stage override → org default.
        const stageKey = contact.pipeline_id && contact.funnel_stage
          ? `${contact.pipeline_id}::${contact.funnel_stage}`
          : '';
        const effectiveThreshold = stageThresholdMap.get(stageKey) ?? org.sla_threshold_minutes;
        if (!effectiveThreshold || businessMinutes < effectiveThreshold) continue;

        let agentName = 'Não atribuído';
        if (contact.assigned_to) {
          const { data: profile } = await supabase
            .from('profiles').select('full_name').eq('user_id', contact.assigned_to).maybeSingle();
          agentName = profile?.full_name || 'Não atribuído';
        }

        const alertMessage = replaceTemplateVariables(
          org.sla_alert_template || '',
          contact.name,
          agentName,
          businessMinutes
        );

        const { error: nErr } = await supabase.from('sla_notifications').insert({
          organization_id: org.id,
          contact_id: contact.id,
          contact_name: contact.name,
          contact_phone: contact.phone,
          agent_name: agentName,
          assigned_to: contact.assigned_to,
          wait_time_minutes: Math.round(businessMinutes),
          message: alertMessage,
        });
        if (nErr) {
          console.error('[sla] insert notification err', nErr);
          continue;
        }

        await supabase.from('contacts').update({ sla_alert_sent: true }).eq('id', contact.id);
        alertsSent++;

        if (org.sla_alert_whatsapp_enabled) {
          const rawDest = Array.isArray((org as any).sla_alert_destinations) ? (org as any).sla_alert_destinations : [];
          let destinations: AlertDestination[] = rawDest
            .filter((d: any) => d && d.value && (d.type === 'phone' || d.type === 'group'))
            .map((d: any) => ({ type: d.type, value: String(d.value), label: d.label }));
          if (destinations.length === 0) {
            // Backward compatibility fallback
            const phones: string[] = Array.isArray(org.sla_alert_phones) && org.sla_alert_phones.length > 0
              ? org.sla_alert_phones
              : (org.sla_alert_phone ? [org.sla_alert_phone] : []);
            destinations = phones.filter(Boolean).map((p) => ({ type: 'phone' as const, value: p }));
          }
          for (const dest of destinations) {
            await sendWhatsAppAlert(supabase, org.id, dest, alertMessage);
          }
        }
      }
    }

    console.log(`🚨 Done. processed=${totalProcessed} alerts=${alertsSent}`);
    return new Response(
      JSON.stringify({ success: true, processed: totalProcessed, alerts_sent: alertsSent, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('SLA Guardian error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
