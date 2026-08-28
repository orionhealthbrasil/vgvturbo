import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EditRequest {
  organization_id: string;
  message_id: string;        // Our internal message ID
  contact_id: string;
  new_text: string;          // New message content
}

// Background task to edit on WhatsApp
async function editOnWhatsApp(
  baseUrl: string,
  apiKey: string,
  whatsappMessageId: string,
  phone: string,
  newText: string
): Promise<void> {
  const editUrl = `${baseUrl.replace(/\/$/, '')}/message/edit`;
  
  const editBody = {
    chat: phone,
    messageId: whatsappMessageId,
    message: newText,
  };

  console.log('Background: Calling Stevo edit API:', editUrl, 'with body:', editBody);

  try {
    const stevoResponse = await fetch(editUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(editBody),
    });

    const responseText = await stevoResponse.text();
    console.log('Background: Stevo edit response:', stevoResponse.status, responseText);

    if (!stevoResponse.ok) {
      console.error('Background: Stevo edit failed:', stevoResponse.status, responseText);
    }
  } catch (error) {
    console.error('Background: Stevo API error:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Edit message request from user:', userId);

    // Parse request body
    const body: EditRequest = await req.json();
    const { organization_id, message_id, contact_id, new_text } = body;

    if (!organization_id || !message_id || !contact_id || !new_text?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('role, member_role')
      .eq('organization_id', organization_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      console.error('Membership error:', memberError);
      return new Response(
        JSON.stringify({ error: 'Not a member of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use admin client for all database operations after validating membership
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get the message to check if it's editable
    const { data: message, error: messageError } = await adminClient
      .from('messages')
      .select('id, whatsapp_message_id, direction, organization_id, message_type, content')
      .eq('id', message_id)
      .eq('organization_id', organization_id)
      .single();

    if (messageError || !message) {
      console.error('Message error:', messageError);
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only outbound text messages can be edited
    if (message.direction !== 'outbound') {
      return new Response(
        JSON.stringify({ error: 'Only sent messages can be edited' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.message_type !== 'text') {
      return new Response(
        JSON.stringify({ error: 'Only text messages can be edited' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message.whatsapp_message_id) {
      return new Response(
        JSON.stringify({ error: 'Message not yet sent to WhatsApp' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update message content in our database FIRST (for immediate UI response)
    const { error: updateError } = await adminClient
      .from('messages')
      .update({ content: new_text.trim() })
      .eq('id', message_id)
      .eq('organization_id', organization_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message updated in database:', message_id);

    // Fetch instance and contact info for WhatsApp edit
    const [instanceResult, contactResult] = await Promise.all([
      adminClient
        .from('whatsapp_instances')
        .select('base_url, api_key')
        .eq('organization_id', organization_id)
        .single(),
      adminClient
        .from('contacts')
        .select('phone')
        .eq('id', contact_id)
        .single()
    ]);

    if (!instanceResult.error && instanceResult.data && !contactResult.error && contactResult.data) {
      // Normalize phone number
      let phone = contactResult.data.phone.replace(/\D/g, '');
      if (!phone.endsWith('@s.whatsapp.net')) {
        phone = `${phone}@s.whatsapp.net`;
      }

      // Run WhatsApp edit in background using EdgeRuntime.waitUntil
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(
        editOnWhatsApp(
          instanceResult.data.base_url,
          instanceResult.data.api_key,
          message.whatsapp_message_id,
          phone,
          new_text.trim()
        )
      );
    } else {
      console.error('Could not fetch instance or contact for WhatsApp edit');
    }

    return new Response(
      JSON.stringify({ success: true, new_content: new_text.trim() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
