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
    .select('id, role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (membershipError || !membership) {
    return { valid: false, error: 'User does not belong to this organization' };
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { valid: false, error: 'Insufficient permissions' };
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

    console.log(`Disconnecting instance: ${instance_name}`);
    console.log(`Base URL (db): ${baseUrl}`);

    const disconnectUrl = `${baseUrl}/instance/disconnect`;
    console.log(`Disconnect URL: ${disconnectUrl}`);

    const stevoResponse = await fetch(disconnectUrl, {
      method: 'POST',
      headers: {
        'apikey': api_key,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Disconnect response: ${stevoResponse.status}`);

    if (!stevoResponse.ok) {
      const errorText = await stevoResponse.text();
      console.error('Stevo disconnect error:', stevoResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Falha ao desconectar do WhatsApp' }),
        { status: stevoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await stevoResponse.json();
    console.log('Instance disconnected successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'WhatsApp desconectado', data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in stevo-disconnect:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
