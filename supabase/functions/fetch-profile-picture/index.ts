import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FetchProfilePicturePayload {
  phone: string;
  organization_id: string;
  contact_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload: FetchProfilePicturePayload = await req.json();
    const { phone, organization_id, contact_id } = payload;

    if (!phone || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'phone and organization_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp instance settings (including base_url for per-instance API)
    const { data: instanceData, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organization_id)
      .single();

    if (instanceError || !instanceData) {
      console.error('WhatsApp instance not found:', instanceError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { instance_name, api_key, base_url } = instanceData;

    // Format phone number for API
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55') && formattedPhone.length <= 11) {
      formattedPhone = '55' + formattedPhone;
    }

    // Try multiple endpoint formats since different Stevo/Evolution API versions use different paths
    // Stevo v2 uses /user/avatar, Evolution API uses /chat/fetchProfilePictureUrl/{instance}
    const jid = `${formattedPhone}@s.whatsapp.net`;
    // Stevo v2 API: POST /user/avatar with { number: phone } or { phone: jid }
    const endpointFormats = [
      { url: `${base_url}/user/avatar`, body: { number: formattedPhone } },
      { url: `${base_url}/user/avatar`, body: { phone: jid } },
      { url: `${base_url}/chat/fetchProfilePictureUrl/${instance_name}`, body: { number: formattedPhone } },
    ];

    let profilePictureResult: any = null;
    let lastError = '';

    for (const endpoint of endpointFormats) {
      console.log(`Trying API: ${endpoint.url} for number: ${formattedPhone}`);
      
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': api_key,
          },
          body: JSON.stringify(endpoint.body),
        });

        if (response.ok) {
          profilePictureResult = await response.json();
          console.log('API response:', JSON.stringify(profilePictureResult));
          break;
        } else {
          lastError = `${response.status} ${await response.text()}`;
          console.log(`Endpoint ${endpoint.url} failed: ${lastError}`);
        }
      } catch (err) {
        lastError = String(err);
        console.log(`Endpoint ${endpoint.url} error: ${lastError}`);
      }
    }

    if (!profilePictureResult) {
      console.error('All endpoints failed. Last error:', lastError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile picture', details: lastError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract profile picture URL from response
    // Stevo v2 returns: { data: { url: "..." }, message: "success" }
    // Evolution API returns: { profilePictureUrl: "..." }
    const profilePictureUrl = profilePictureResult.data?.url || profilePictureResult.profilePictureUrl || profilePictureResult.picture || profilePictureResult.url || null;

    if (profilePictureUrl && contact_id) {
      // Update the contact's profile picture
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ profile_picture_url: profilePictureUrl })
        .eq('id', contact_id);

      if (updateError) {
        console.error('Failed to update contact profile picture:', updateError);
      } else {
        console.log(`Updated contact ${contact_id} with profile picture`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        profilePictureUrl,
        contact_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching profile picture:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
