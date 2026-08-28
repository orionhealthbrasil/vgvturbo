import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMediaPayload {
  organization_id: string;
  phone: string;
  contact_id: string;
  media_type: 'image' | 'audio' | 'video' | 'document';
  caption?: string;
  filename?: string;
  // Either provide media_url OR file_base64 + file_name
  media_url?: string;
  file_base64?: string;
  file_name?: string;
  file_content_type?: string;
  // Client-side timestamp (ISO string) to preserve message ordering
  client_timestamp?: string;
  // Quote/reply fields
  quoted_message_id?: string;
  quoted_content?: string;
  quoted_type?: string;
  // Per-user preference: if false, do NOT prepend sender name to caption
  include_sender_name?: boolean;
}

async function getInstanceSettings(supabase: any, organizationId: string) {
  const { data, error } = await supabase
    .from('whatsapp_instances')
    .select('instance_name, api_key, base_url, owner_jid')
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}

// Get the instance's own JID, using cached value or fetching from API
async function getInstanceJid(
  supabase: any,
  organizationId: string,
  baseUrl: string, 
  apiKey: string,
  cachedJid: string | null
): Promise<string | null> {
  // Return cached value if available
  if (cachedJid) {
    console.log('Using cached owner JID:', cachedJid);
    return cachedJid;
  }

  // Fetch from Stevo API - try multiple endpoints
  try {
    // Try fetchInstances first (Evolution API style)
    let response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: { 'apikey': apiKey },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('fetchInstances response:', JSON.stringify(data));
      
      // Try various paths where owner JID might be
      const ownerJid = 
        data?.[0]?.instance?.owner || 
        data?.instance?.owner ||
        data?.[0]?.owner ||
        data?.owner ||
        null;
      
      if (ownerJid) {
        console.log('Fetched owner JID from fetchInstances:', ownerJid);
        await cacheOwnerJid(supabase, organizationId, ownerJid);
        return ownerJid;
      }
    }

    // Try /instance/connectionState as alternative
    response = await fetch(`${baseUrl}/instance/connectionState`, {
      method: 'GET',
      headers: { 'apikey': apiKey },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('connectionState response:', JSON.stringify(data));
      
      // Check for owner/user info in connection state
      const ownerJid = data?.user?.id || data?.instance?.user?.id || null;
      
      if (ownerJid) {
        console.log('Fetched owner JID from connectionState:', ownerJid);
        await cacheOwnerJid(supabase, organizationId, ownerJid);
        return ownerJid;
      }
    }

    console.log('Could not fetch owner JID from any endpoint');
    return null;
  } catch (err) {
    console.error('Error fetching instance JID:', err);
    return null;
  }
}

// Helper to cache owner JID and save it in database
async function cacheOwnerJid(supabase: any, organizationId: string, ownerJid: string) {
  await supabase
    .from('whatsapp_instances')
    .update({ owner_jid: ownerJid })
    .eq('organization_id', organizationId);
  console.log('Cached owner JID in database:', ownerJid);
}

// Extract and cache owner JID from a successful send response
async function extractAndCacheOwnerJid(
  supabase: any,
  organizationId: string,
  sendResponse: any,
  cachedJid: string | null
): Promise<void> {
  if (cachedJid) return; // Already cached
  
  // The Sender field in the response contains our JID (with device suffix like :37)
  // Format: "559191807033:37@s.whatsapp.net"
  const senderJid = sendResponse?.data?.Info?.Sender;
  
  if (senderJid && senderJid.includes('@')) {
    // IMPORTANT: keep the exact Sender JID format returned by the API.
    // For self-quote to render in WhatsApp Web, the provider may require the device-suffixed JID.
    console.log('Extracted owner JID from send response:', senderJid);
    await cacheOwnerJid(supabase, organizationId, senderJid);
  }
}

async function getUserProfile(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
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

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (membershipError || !membership) {
    return { valid: false, error: 'User does not belong to this organization' };
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

// Map internal media types to Stevo media types
function getStevoMediaType(type: string): string {
  switch (type) {
    case 'image':
      return 'image';
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    case 'document':
      return 'document';
    default:
      return 'document';
  }
}

// Upload file to storage using service role (bypasses RLS)
async function uploadFileToStorage(
  supabaseAdmin: any,
  contactId: string,
  fileName: string,
  fileBase64: string,
  contentType: string
): Promise<{ publicUrl: string } | { error: string }> {
  try {
    // Decode base64 to Uint8Array
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique file path
    const fileExt = fileName.split('.').pop() || 'bin';
    const storagePath = `${contactId}/${Date.now()}.${fileExt}`;

    // Upload using service role (bypasses RLS)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('chat-media')
      .upload(storagePath, bytes, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('chat-media')
      .getPublicUrl(storagePath);

    return { publicUrl: urlData.publicUrl };
  } catch (err: any) {
    console.error('Upload error:', err);
    return { error: err.message || 'Failed to upload file' };
  }
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

    const payload: SendMediaPayload = await req.json();
    const { 
      organization_id, 
      phone, 
      contact_id, 
      media_url,
      file_base64,
      file_name,
      file_content_type,
      media_type, 
      caption,
      filename,
      client_timestamp,
      quoted_message_id, 
      quoted_content, 
      quoted_type,
      include_sender_name,
    } = payload;

    if (!organization_id || !phone || !contact_id || !media_type) {
      return new Response(
        JSON.stringify({ error: 'organization_id, phone, contact_id, and media_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Must provide either media_url OR file_base64
    if (!media_url && !file_base64) {
      return new Response(
        JSON.stringify({ error: 'Either media_url or file_base64 is required' }),
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

    // Get instance settings from database
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const instanceSettings = await getInstanceSettings(supabaseAdmin, organization_id);

    if (!instanceSettings) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp não configurado. Configure a instância primeiro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instanceSettings.base_url) {
      return new Response(
        JSON.stringify({ error: 'URL base não configurada. Atualize as configurações da instância.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the final media URL
    let finalMediaUrl = media_url;

    // If file_base64 is provided, upload it first
    if (file_base64 && file_name) {
      console.log(`Uploading file ${file_name} for contact ${contact_id}`);
      const uploadResult = await uploadFileToStorage(
        supabaseAdmin,
        contact_id,
        file_name,
        file_base64,
        file_content_type || 'application/octet-stream'
      );

      if ('error' in uploadResult) {
        return new Response(
          JSON.stringify({ error: `Upload failed: ${uploadResult.error}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      finalMediaUrl = uploadResult.publicUrl;
      console.log(`File uploaded successfully: ${finalMediaUrl}`);
    }

    if (!finalMediaUrl) {
      return new Response(
        JSON.stringify({ error: 'Could not determine media URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { api_key, instance_name, base_url, owner_jid } = instanceSettings;
    const formattedPhone = formatPhoneNumber(phone);
    
    // Determine the target number for the API
    // For groups, look up the group_jid from the contact
    let targetNumber = formattedPhone;
    let isGroupMessage = false;
    
    const { data: contactData } = await supabaseAdmin
      .from('contacts')
      .select('is_group, group_jid')
      .eq('id', contact_id)
      .single();
    
    if (contactData?.is_group && contactData?.group_jid) {
      targetNumber = contactData.group_jid;
      isGroupMessage = true;
      console.log(`Sending media to group: ${targetNumber}`);
    }
    
    // Stevo API endpoint: POST /send/media
    const sendUrl = `${base_url}/send/media`;
    console.log(`Sending ${media_type} to ${targetNumber} via instance ${instance_name}`);
    console.log(`Media URL: ${finalMediaUrl}`);

    // Get the sender's profile name (skip when user disabled the preference)
    const shouldIncludeSenderName = include_sender_name !== false;
    let senderName: string | null = null;
    if (validation.userId && shouldIncludeSenderName) {
      const profile = await getUserProfile(supabaseAdmin, validation.userId);
      if (profile?.full_name) {
        senderName = profile.full_name;
      }
    }

    // Build request body for /send/media endpoint - aligned with Stevo v2 contract
    const requestBody: any = {
      number: targetNumber,
      url: finalMediaUrl,
      type: getStevoMediaType(media_type),
      formatJid: true,
    };

    // Add filename for documents
    if (media_type === 'document' && (filename || file_name)) {
      requestBody.filename = filename || file_name;
    }

    if (quoted_message_id) {
      console.log(`Looking up WhatsApp message ID for quoted message: ${quoted_message_id}`);

      const [quotedMsgResult, contactResult] = await Promise.all([
        supabaseAdmin
          .from('messages')
          .select('whatsapp_message_id, direction, sender_phone, content, message_type, media_url, media_slug, sent_by_user_id')
          .eq('id', quoted_message_id)
          .maybeSingle(),
        supabaseAdmin
          .from('contacts')
          .select('name')
          .eq('id', contact_id)
          .maybeSingle(),
      ]);
      const quotedMsg = quotedMsgResult.data;
      const contactName = contactResult.data?.name || null;

      let quotedSenderName: string | null = null;
      if (quotedMsg?.direction === 'outbound' && quotedMsg.sent_by_user_id) {
        const { data: quotedProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', quotedMsg.sent_by_user_id)
          .maybeSingle();
        quotedSenderName = quotedProfile?.full_name || null;
      }

      if (quotedMsg) {
        // Generate media slug lazily
        let mediaProxyUrl: string | null = null;
        if (quotedMsg.media_url) {
          let slug = quotedMsg.media_slug;
          if (!slug) {
            slug = crypto.randomUUID();
            await supabaseAdmin.from('messages').update({ media_slug: slug }).eq('id', quoted_message_id);
          }
          mediaProxyUrl = `https://vgvturbo.com.br/m/${slug}`;
        }

        const rawContent = quotedMsg.content || quoted_content || '';
        const mediaLabel = quotedMsg.message_type === 'image'
          ? (mediaProxyUrl ? `🖼 ${mediaProxyUrl}` : (rawContent && rawContent !== 'Imagem' ? `🖼 ${rawContent}` : '🖼 Imagem'))
          : quotedMsg.message_type === 'audio' ? '🎵 Áudio'
          : quotedMsg.message_type === 'video'
          ? (mediaProxyUrl ? `🎬 ${mediaProxyUrl}` : (rawContent && rawContent !== 'Vídeo' ? `🎬 ${rawContent}` : '🎬 Vídeo'))
          : quotedMsg.message_type === 'document' ? `📄 ${rawContent || 'Documento'}${mediaProxyUrl ? ` ${mediaProxyUrl}` : ''}`
          : rawContent;
        const preview = mediaLabel.length > 80 ? mediaLabel.slice(0, 80) + '…' : mediaLabel;
        const quoteSender = quotedMsg.direction === 'outbound'
          ? (quotedSenderName || 'Equipe')
          : (contactName || quotedMsg.sender_phone || '');
        const prefixLine = quoteSender ? `_${quoteSender}: ${preview}_` : `_${preview}_`;

        // Caption: quote line + "SenderName: caption" on next line
        const captionBody = senderName
          ? `*${senderName}:* ${caption || ''}`
          : (caption || '');
        requestBody.caption = captionBody ? `${prefixLine}\n${captionBody}` : prefixLine;

        if (quotedMsg.whatsapp_message_id) {
          requestBody.quoted = { messageId: quotedMsg.whatsapp_message_id };
        }
        console.log(`Quote prefix added to caption. whatsapp_message_id: ${quotedMsg.whatsapp_message_id}`);
      } else {
        // No quote found — fall back to normal caption with signature
        if (caption || senderName) {
          requestBody.caption = senderName ? `*${senderName}:*\n${caption || ''}` : caption;
        }
      }
    } else {
      // No quote — normal caption with sender signature
      if (caption || senderName) {
        requestBody.caption = senderName ? `*${senderName}:*\n${caption || ''}` : caption;
      }
    }

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
      console.error('Stevo send media error:', stevoResponse.status, errorText);

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
        JSON.stringify({ error: 'Falha ao enviar mídia via WhatsApp', details: errorText }),
        { status: stevoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stevoData = await stevoResponse.json();
    console.log('Stevo send media response:', stevoData);

    // Try to extract and cache our owner JID from the send response (for future quote operations)
    await extractAndCacheOwnerJid(supabaseAdmin, organization_id, stevoData, owner_jid);

    // Extract WhatsApp message ID from response if available
    const whatsappMessageId = stevoData?.data?.Info?.ID || null;

    // Save message to database (include sender)
    // Use client_timestamp if provided to preserve message ordering
    const messageCreatedAt = client_timestamp || new Date().toISOString();
    
    const { data: messageData, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        contact_id,
        organization_id,
        content: caption || filename || file_name || null,
        message_type: media_type,
        media_url: finalMediaUrl,
        direction: 'outbound',
        status: 'sent',
        created_at: messageCreatedAt,
        whatsapp_message_id: whatsappMessageId,
        quoted_message_id: quoted_message_id || null,
        quoted_content: quoted_content || null,
        quoted_type: quoted_type || null,
        sent_by_user_id: validation.userId || null,
      })
      .select('id')
      .single();

    if (messageError) {
      if ((messageError as any).code === '23505') {
        console.log('Message already inserted by webhook echo (unique violation), skipping');
      } else {
        console.error('Failed to save message:', messageError);
      }
    }

    // Update contact's last_message_at (don't touch unread_count - that's managed by webhook for inbound)
    await supabaseAdmin
      .from('contacts')
      .update({ 
        last_message_at: new Date().toISOString(),
      })
      .eq('id', contact_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageData?.id,
        whatsapp_message_id: whatsappMessageId,
        media_url: finalMediaUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in stevo-send-media:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
