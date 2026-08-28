import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getInstanceBaseUrl(organizationId: string): Promise<string | null> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('base_url')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load base_url from database:', error);
    return null;
  }

  return (data as any)?.base_url ?? null;
}

async function validateUserOrganization(req: Request, organizationId: string): Promise<{ valid: boolean; error?: string }> {
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
    console.error('Auth error:', userError);
    return { valid: false, error: 'Invalid or expired token' };
  }

  console.log(`Authenticated user: ${user.id}`);

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (membershipError || !membership) {
    console.error('Membership error:', membershipError);
    return { valid: false, error: 'User does not belong to this organization' };
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { valid: false, error: 'Insufficient permissions. Only owners and admins can manage WhatsApp.' };
  }

  console.log(`User ${user.id} authorized as ${membership.role} for org ${organizationId}`);
  return { valid: true };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { organization_id, instance_name, api_key } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instance_name || !api_key) {
      return new Response(
        JSON.stringify({ error: 'instance_name and api_key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = await getInstanceBaseUrl(organization_id);
    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: 'URL base não configurada para esta organização. Salve a URL base na página de conexão.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user authentication and organization membership
    const validation = await validateUserOrganization(req, organization_id);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Connecting instance (via apikey): ${instance_name}`);
    console.log(`Base URL (db): ${baseUrl}`);

    // Clear cached owner_jid when reconnecting (number might change)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    await supabaseAdmin
      .from('whatsapp_instances')
      .update({ owner_jid: null })
      .eq('organization_id', organization_id);
    console.log('Cleared cached owner_jid');

    // Step 1: POST /instance/connect — inicia a conexão (sem instance_name no path, padrão StevoManager)
    const connectUrl = `${baseUrl}/instance/connect`;
    console.log(`Connect URL: ${connectUrl}`);

    const connectResponse = await fetch(connectUrl, {
      method: 'POST',
      headers: { 'apikey': api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    console.log(`Connect response: ${connectResponse.status}`);
    if (connectResponse.ok) {
      const connectData = await connectResponse.json().catch(() => ({}));
      console.log('Connect data:', JSON.stringify(connectData));
    }

    // Step 2: GET /instance/qr — busca o QR code (às vezes demora alguns segundos pra gerar)
    const qrUrl = `${baseUrl}/instance/qr`;
    console.log(`QR URL: ${qrUrl}`);

    let qrResponse: Response | null = null;
    let lastQrErrorText = '';

    for (let attempt = 1; attempt <= 8; attempt++) {
      qrResponse = await fetch(qrUrl, {
        method: 'GET',
        headers: { 'apikey': api_key, 'Content-Type': 'application/json' },
      });

      console.log(`QR response status (attempt ${attempt}): ${qrResponse.status}`);

      if (qrResponse.ok) break;

      lastQrErrorText = await qrResponse.text();
      console.error('Stevo QR error:', qrResponse.status, lastQrErrorText);

      // Sessão já logada — não tem QR pra gerar
      if (lastQrErrorText.includes('session already logged in') || lastQrErrorText.includes('already connected')) {
        return new Response(
          JSON.stringify({ status: 'connected', message: 'WhatsApp já está conectado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // QR ainda não disponível — aguardar e tentar de novo
      await delay(1200);
    }

    if (!qrResponse || !qrResponse.ok) {
      const status = qrResponse?.status ?? 500;
      const errorText = lastQrErrorText || 'Falha ao obter QR';

      if (status === 401) {
        return new Response(
          JSON.stringify({ error: 'API Key inválida. Verifique suas credenciais.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erro da API Stevo: ${status} - ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await qrResponse.json();
    console.log('QR response data:', JSON.stringify(data));
    
    // StevoManager real format: { data: { Qrcode: 'data:image/png;base64,...' } }
    // Fallbacks for other possible shapes
    const base64 =
      data?.data?.Qrcode ||
      data?.data?.qrcode ||
      data?.data?.qr ||
      data?.base64 ||
      data?.qrcode?.base64 ||
      data?.qr?.base64 ||
      data?.qrcode ||
      data?.qr ||
      data?.code;
    
    if (base64) {
      return new Response(
        JSON.stringify({
          base64: base64,
          status: 'pending',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Instance might already be connected
    if (data.instance?.state === 'open' || data.state === 'open' || data.status === 'connected') {
      return new Response(
        JSON.stringify({
          status: 'connected',
          message: 'WhatsApp já está conectado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return whatever data we got
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in stevo-connect:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
