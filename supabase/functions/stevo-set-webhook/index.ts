import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: membership } = await userClient
      .from('organization_members')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get instance config
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: instance, error: instanceError } = await adminClient
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organization_id)
      .single();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/stevo-webhook`;

    // Try multiple endpoint formats for different Stevo versions
    const possibleEndpoints = [
      `${instance.base_url}/webhook/set`,
      `${instance.base_url}/webhook`,
      `${instance.base_url}/instance/webhook`,
      `${instance.base_url}/webhook/set/${instance.instance_name}`,
    ];

    console.log(`Setting webhook for ${instance.instance_name} to ${webhookUrl}`);

    const webhookPayload = JSON.stringify({
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      events: [
        'MESSAGES_UPSERT',
        'CONNECTION_UPDATE',
      ],
    });

    let lastResponse: Response | null = null;
    let lastResponseText = '';
    let successEndpoint = '';

    for (const endpoint of possibleEndpoints) {
      console.log(`Trying endpoint: ${endpoint}`);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': instance.api_key,
            'Content-Type': 'application/json',
          },
          body: webhookPayload,
        });

        const responseText = await response.text();
        console.log(`Response from ${endpoint}: ${response.status} - ${responseText}`);

        if (response.ok) {
          lastResponse = response;
          lastResponseText = responseText;
          successEndpoint = endpoint;
          break;
        }

        lastResponse = response;
        lastResponseText = responseText;
      } catch (err) {
        console.error(`Error trying ${endpoint}:`, err);
      }
    }

    if (!lastResponse || !lastResponse.ok) {
      // Also try PUT method on /webhook
      console.log('Trying PUT method on /webhook...');
      try {
        const putResponse = await fetch(`${instance.base_url}/webhook`, {
          method: 'PUT',
          headers: {
            'apikey': instance.api_key,
            'Content-Type': 'application/json',
          },
          body: webhookPayload,
        });
        const putText = await putResponse.text();
        console.log(`PUT /webhook response: ${putResponse.status} - ${putText}`);
        
        if (putResponse.ok) {
          lastResponse = putResponse;
          lastResponseText = putText;
          successEndpoint = `${instance.base_url}/webhook (PUT)`;
        }
      } catch (err) {
        console.error('Error trying PUT /webhook:', err);
      }
    }

    if (!lastResponse?.ok) {
      return new Response(
        JSON.stringify({ 
          error: `Failed to set webhook on all endpoints. Last response: ${lastResponseText}`,
          tried: possibleEndpoints,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(lastResponseText);
    } catch {
      responseData = { raw: lastResponseText };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook configured successfully',
        webhookUrl,
        endpoint: successEndpoint,
        response: responseData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in stevo-set-webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
