import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteRequest {
  organization_id: string;
  message_id: string;        // Our internal message ID
  contact_id: string;
  delete_for_everyone: boolean; // true = delete via WhatsApp API, false = local only
}

// Background task to delete from WhatsApp
async function deleteFromWhatsApp(
  baseUrl: string,
  apiKey: string,
  whatsappMessageId: string,
  phone: string,
  fromMe: boolean
): Promise<void> {
  const deleteUrl = `${baseUrl.replace(/\/$/, '')}/message/delete`;
  
  const deleteBody = {
    chat: phone,
    messageId: whatsappMessageId,
    fromMe,
  };

  console.log('Background: Calling Stevo delete API:', deleteUrl, 'with body:', deleteBody);

  try {
    const stevoResponse = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(deleteBody),
    });

    const responseText = await stevoResponse.text();
    console.log('Background: Stevo delete response:', stevoResponse.status, responseText);

    if (!stevoResponse.ok) {
      console.error('Background: Stevo delete failed:', stevoResponse.status, responseText);
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
    console.log('Delete message request from user:', userId);

    // Parse request body
    const body: DeleteRequest = await req.json();
    const { organization_id, message_id, contact_id, delete_for_everyone } = body;

    if (!organization_id || !message_id || !contact_id) {
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

    // Get the message to check if it has a WhatsApp message ID
    const { data: message, error: messageError } = await adminClient
      .from('messages')
      .select('id, whatsapp_message_id, direction, organization_id')
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

    // Delete message from our database FIRST (for immediate UI response)
    const { error: deleteError } = await adminClient
      .from('messages')
      .delete()
      .eq('id', message_id)
      .eq('organization_id', organization_id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message deleted from database:', message_id);

    // If delete_for_everyone and we have a whatsapp_message_id, call Stevo API in background
    if (delete_for_everyone && message.whatsapp_message_id) {
      console.log('Scheduling background WhatsApp deletion for:', message.whatsapp_message_id);
      
      // Fetch instance and contact info for background task
      const [instanceResult, contactResult] = await Promise.all([
        adminClient
          .from('whatsapp_instances')
          .select('base_url, api_key')
          .eq('organization_id', organization_id)
          .single(),
        adminClient
          .from('contacts')
          .select('phone, is_group, group_jid')
          .eq('id', contact_id)
          .single()
      ]);

      if (!instanceResult.error && instanceResult.data && !contactResult.error && contactResult.data) {
        // For groups use group_jid directly; for DMs append @s.whatsapp.net
        let phone: string;
        if (contactResult.data.is_group && contactResult.data.group_jid) {
          phone = contactResult.data.group_jid; // already has @g.us
        } else {
          const digits = contactResult.data.phone.replace(/\D/g, '');
          phone = `${digits}@s.whatsapp.net`;
        }

        // Run WhatsApp deletion in background using EdgeRuntime.waitUntil
        // This allows us to return immediately while the API call completes
        // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(
          deleteFromWhatsApp(
            instanceResult.data.base_url,
            instanceResult.data.api_key,
            message.whatsapp_message_id,
            phone,
            message.direction === 'outbound'
          )
        );
      } else {
        console.error('Could not fetch instance or contact for background deletion');
      }
    }

    return new Response(
      JSON.stringify({ success: true, deleted_for_everyone: delete_for_everyone }),
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
