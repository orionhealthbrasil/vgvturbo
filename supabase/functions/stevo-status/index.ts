import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    return { valid: false, error: 'Invalid or expired token' };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (membershipError || !membership) {
    return { valid: false, error: 'User does not belong to this organization' };
  }

  return { valid: true };
}

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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, instance_name, api_key } = await req.json();

    if (!organization_id || !instance_name || !api_key) {
      return new Response(
        JSON.stringify({ error: 'organization_id, instance_name, and api_key are required' }),
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

    console.log(`Checking status for instance: ${instance_name}`);
    console.log(`Base URL (db): ${baseUrl}`);

    const statusUrl = `${baseUrl}/instance/status`;
    console.log(`Status URL: ${statusUrl}`);

    const stevoResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'apikey': api_key,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status response: ${stevoResponse.status}`);

    if (!stevoResponse.ok) {
      if (stevoResponse.status === 404) {
        return new Response(
          JSON.stringify({ state: 'disconnected', exists: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const errorText = await stevoResponse.text();
      console.error('Stevo status error:', stevoResponse.status, errorText);
      return new Response(
        JSON.stringify({ state: 'error', error: errorText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await stevoResponse.json();
    console.log('Stevo status response:', JSON.stringify(data));

    // Stevo can return different formats:
    // 1. { data: { Connected: true, LoggedIn: true, Name: "5511999999999" } }
    //    NOTE: We've seen Connected=true with LoggedIn=false while the UI shows "Desconectado".
    //    So we only treat it as connected when LoggedIn=true.
    // 2. { state: 'open' | 'connected' }
    // 3. { instance: { state: '...' } }
    const isLoggedIn = data?.data?.LoggedIn === true || data?.data?.loggedIn === true;
    
    const state = data.state || data.status || data.instance?.state;
    const normalizedState = state?.toLowerCase?.() || '';
    const isConnectedFromState = normalizedState === 'open' || normalizedState === 'connected';
    
    const isConnected = isLoggedIn || isConnectedFromState;

    // Extract phone number from various possible locations
    const phoneNumber = 
      data?.data?.Name ||
      data?.data?.name ||
      data?.data?.phone ||
      data?.data?.jid?.replace(/@s\.whatsapp\.net/g, '') ||
      data?.instance?.owner ||
      null;

    return new Response(
      JSON.stringify({
        state: isConnected ? 'connected' : 'disconnected',
        exists: true,
        phoneNumber,
        raw: data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in stevo-status:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
