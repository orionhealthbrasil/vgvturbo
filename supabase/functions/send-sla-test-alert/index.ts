import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TestAlertPayload {
  organization_id: string;
  phone?: string;
  destination?: { type: 'phone' | 'group'; value: string };
  message: string;
}

async function validateUserOrganization(req: Request, organizationId: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { valid: false, error: 'Authorization header required' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  // Check if user is owner or admin of the organization
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (membershipError || !membership) {
    return { valid: false, error: 'User does not belong to this organization' };
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { valid: false, error: 'Only owners and admins can send test alerts' };
  }

  return { valid: true, userId: user.id };
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const payload: TestAlertPayload = await req.json();
    const { organization_id, phone, destination, message } = payload;

    // Resolve destination: prefer typed destination, fallback to phone for backward compat
    const dest = destination ?? (phone ? { type: 'phone' as const, value: phone } : null);

    console.log(`Received test alert request for org ${organization_id} dest=${JSON.stringify(dest)}`);

    if (!organization_id || !dest || !dest.value || !message) {
      return new Response(
        JSON.stringify({ error: 'organization_id, destination, and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user authentication and organization membership (owner/admin only)
    const validation = await validateUserOrganization(req, organization_id);
    if (!validation.valid) {
      console.error('Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get instance settings from database
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: instanceSettings, error: instanceError } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organization_id)
      .single();

    if (instanceError || !instanceSettings) {
      console.error('WhatsApp instance not found:', instanceError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp não configurado. Configure a instância primeiro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { api_key, instance_name, base_url } = instanceSettings;
    const number = dest.type === 'group'
      ? (dest.value.endsWith('@g.us') ? dest.value : `${dest.value}@g.us`)
      : formatPhoneNumber(dest.value);
    
    const sendUrl = `${base_url}/send/text`;
    console.log(`Sending test alert to ${number} (${dest.type}) via instance ${instance_name}`);

    const requestBody = {
      number,
      text: message,
      formatJid: true,
    };

    console.log(`Request body: ${JSON.stringify(requestBody)}`);

    const stevoResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'apikey': api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`Response status: ${stevoResponse.status}`);

    if (!stevoResponse.ok) {
      const errorText = await stevoResponse.text();
      console.error('Stevo send error:', stevoResponse.status, errorText);

      if (stevoResponse.status === 404) {
        return new Response(
          JSON.stringify({
            error: 'Endpoint da Stevo não encontrado (404). Verifique a URL base configurada.',
            details: { url: sendUrl },
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (stevoResponse.status === 400) {
        return new Response(
          JSON.stringify({ error: 'WhatsApp não conectado (400). Conecte a instância e tente novamente.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Falha ao enviar mensagem: ${errorText}` }),
        { status: stevoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stevoData = await stevoResponse.json();
    console.log('Stevo send response:', stevoData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test alert sent successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-sla-test-alert:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
