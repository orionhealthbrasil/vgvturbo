import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditRequest {
  contact_id: string;
  organization_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const n8nWebhookUrl = Deno.env.get('N8N_AUDIT_WEBHOOK_URL')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { contact_id, organization_id }: AuditRequest = await req.json();

    // Auth guard: require service-role key OR valid user JWT with org membership
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== supabaseServiceKey) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: membership } = await supabase.from('organization_members').select('id').eq('user_id', user.id).eq('organization_id', organization_id).maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (!contact_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'contact_id and organization_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[audit-conversation] Starting audit for contact ${contact_id}`);

    // Fetch contact, organization, and messages in parallel
    const [contactResult, orgResult, messagesResult] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, name, phone, assigned_to, ai_agent_id')
        .eq('id', contact_id)
        .single(),
      supabase
        .from('organizations')
        .select('name, business_hours_start, business_hours_end, working_days, weekend_hours_enabled, weekend_hours_start, weekend_hours_end, lunch_break_enabled, lunch_break_start, lunch_break_end, lunch_break_days')
        .eq('id', organization_id)
        .single(),
      supabase
        .from('messages')
        .select('content, direction, message_type, created_at, sent_by_user_id, ai_agent_id')
        .eq('contact_id', contact_id)
        .order('created_at', { ascending: true }),
    ]);

    if (contactResult.error || !contactResult.data) {
      console.error('[audit-conversation] Contact not found:', contactResult.error);
      return new Response(
        JSON.stringify({ error: 'Contact not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contact = contactResult.data;
    const org = orgResult.data;
    const messages = messagesResult.data;

    if (!messages || messages.length === 0) {
      console.log('[audit-conversation] No messages to audit');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_messages' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get salesperson/agent name
    let salespersonName = 'Desconhecido';
    if (contact.assigned_to) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', contact.assigned_to)
        .single();
      if (profile?.full_name) salespersonName = profile.full_name;
    } else if (contact.ai_agent_id) {
      // If no human assigned, check if an AI agent handled the conversation
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('name')
        .eq('id', contact.ai_agent_id)
        .single();
      if (agent?.name) salespersonName = `${agent.name} (IA)`;
    }

    // Build raw message history with timestamps
    const messageHistory = messages.map((m) => ({
      direction: m.direction,
      content: m.content,
      message_type: m.message_type,
      created_at: m.created_at,
      is_human: m.direction === 'outbound' ? !!m.sent_by_user_id : null,
      is_ai: m.direction === 'outbound' ? !!m.ai_agent_id : false,
    }));

    // Build payload with all raw data for n8n/AI to process
    const payload = {
      contact_id,
      organization_id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      salesperson_name: salespersonName,
      assigned_to: contact.assigned_to,
      message_count: messages.length,
      messages: messageHistory,
      business_hours: org ? {
        business_hours_start: org.business_hours_start,
        business_hours_end: org.business_hours_end,
        working_days: org.working_days,
        weekend_hours_enabled: org.weekend_hours_enabled,
        weekend_hours_start: org.weekend_hours_start,
        weekend_hours_end: org.weekend_hours_end,
        lunch_break_enabled: org.lunch_break_enabled,
        lunch_break_start: org.lunch_break_start,
        lunch_break_end: org.lunch_break_end,
        lunch_break_days: org.lunch_break_days,
      } : null,
    };

    // Fire-and-forget to n8n
    const n8nPromise = fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(res => {
      console.log(`[audit-conversation] n8n webhook response: ${res.status}`);
    }).catch(err => {
      console.error('[audit-conversation] n8n webhook error:', err);
    });

    // @ts-ignore - EdgeRuntime is provided by Supabase Edge Runtime at execution time
    (globalThis as any).EdgeRuntime?.waitUntil(n8nPromise);

    console.log(`[audit-conversation] Sent ${messages.length} messages to n8n`);

    return new Response(
      JSON.stringify({ success: true, sent_to_n8n: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[audit-conversation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
