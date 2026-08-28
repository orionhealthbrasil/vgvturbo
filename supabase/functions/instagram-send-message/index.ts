import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendPayload {
  organization_id: string;
  contact_id: string;
  message?: string;
  client_timestamp?: string;
  media_url?: string;
  file_base64?: string;
  file_name?: string;
  file_content_type?: string;
  media_type?: 'image' | 'audio' | 'video' | 'document';
}

async function uploadFileToStorage(
  supabaseAdmin: any,
  contactId: string,
  fileName: string,
  fileBase64: string,
  contentType: string,
): Promise<{ publicUrl: string } | { error: string }> {
  try {
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const safeExtension = fileName.split('.').pop() || 'bin';
    const storagePath = `${contactId}/${Date.now()}.${safeExtension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('chat-media')
      .upload(storagePath, bytes, { contentType, upsert: false });

    if (uploadError) return { error: uploadError.message };

    const { data: urlData } = supabaseAdmin.storage
      .from('chat-media')
      .getPublicUrl(storagePath);

    return { publicUrl: urlData.publicUrl };
  } catch (err: any) {
    return { error: err.message || 'Failed to upload file' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const payload: SendPayload = await req.json();
    const { organization_id, contact_id, message, client_timestamp, media_url, file_base64, file_name, file_content_type, media_type } = payload;

    if (!organization_id || !contact_id || (!message && !media_url && !file_base64)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate user belongs to organization
    const authHeader = req.headers.get('Authorization');
    const internalKey = req.headers.get('x-internal-service-key');
    let userId: string | null = null;

    if (internalKey === SUPABASE_SERVICE_ROLE_KEY || authHeader?.replace('Bearer ', '') === SUPABASE_SERVICE_ROLE_KEY) {
      // Internal/system call
    } else if (authHeader) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;

      const { data: membership } = await userClient
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organization_id)
        .single();

      if (!membership) {
        return new Response(JSON.stringify({ error: 'Not a member of this organization' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Instagram instance for this org
    const { data: igInstance, error: igError } = await adminClient
      .from('instagram_instances')
      .select('page_access_token, page_id, ig_user_id, auth_type')
      .eq('organization_id', organization_id)
      .single();

    if (igError || !igInstance) {
      return new Response(JSON.stringify({ error: 'Instagram not connected for this organization' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get contact to find IG user ID
    const { data: contact, error: contactError } = await adminClient
      .from('contacts')
      .select('phone, channel')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract IG user ID from phone field (stored as ig_XXXXX)
    const igUserId = contact.phone.replace('ig_', '');

    let finalMediaUrl = media_url;
    if (file_base64 && file_name) {
      const uploadResult = await uploadFileToStorage(
        adminClient,
        contact_id,
        file_name,
        file_base64,
        file_content_type || 'application/octet-stream',
      );

      if ('error' in uploadResult) {
        return new Response(JSON.stringify({ error: `Upload failed: ${uploadResult.error}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalMediaUrl = uploadResult.publicUrl;
    }

    const isMediaMessage = Boolean(finalMediaUrl);
    const normalizedMediaType = isMediaMessage ? (media_type || 'image') : 'text';
    const instagramAttachmentType = normalizedMediaType === 'document' ? 'file' : normalizedMediaType;

    // Send message via Instagram Graph API
    // For instagram_login flow: use ig_user_id; for facebook_login: fall back to page_id
    const senderId = igInstance.auth_type === 'instagram_login'
      ? igInstance.ig_user_id
      : (igInstance.page_id || igInstance.ig_user_id);
    const sendResponse = await fetch(
      `https://graph.instagram.com/v21.0/${senderId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${igInstance.page_access_token}`,
        },
        body: JSON.stringify({
          recipient: { id: igUserId },
          message: isMediaMessage
            ? { attachment: { type: instagramAttachmentType, payload: { url: finalMediaUrl, is_reusable: true } } }
            : { text: message },
        }),
      }
    );

    const sendData = await sendResponse.json();

    if (!sendResponse.ok) {
      console.error('Instagram API error:', JSON.stringify(sendData));
      return new Response(JSON.stringify({ error: `Instagram API error: ${sendData?.error?.message || 'Unknown'}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save message in database
    const messageTimestamp = client_timestamp || new Date().toISOString();
    const { error: insertError } = await adminClient
      .from('messages')
      .insert({
        contact_id,
        organization_id,
        content: message || file_name || null,
        message_type: normalizedMediaType,
        media_url: finalMediaUrl || null,
        direction: 'outbound',
        status: 'sent',
        sent_by_user_id: userId,
        whatsapp_message_id: sendData?.message_id || null,
        channel: 'instagram',
        created_at: messageTimestamp,
      });

    if (insertError) {
      console.error('Error saving IG message:', insertError);
    }

    // Update contact
    await adminClient
      .from('contacts')
      .update({
        last_message_at: messageTimestamp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact_id);

    return new Response(JSON.stringify({ success: true, message_id: sendData?.message_id, media_url: finalMediaUrl || null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Instagram send error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
