import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN =
  Deno.env.get('INSTAGRAM_VERIFY_TOKEN') ||
  Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') ||
  'vgvturbo_instagram_verify_2024';
const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') || Deno.env.get('META_APP_SECRET') || '';

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!APP_SECRET) return true; // skip if not configured
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice(7);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === expected;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Instagram webhook verified successfully');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  // POST - incoming messages
  if (req.method === 'POST') {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get('x-hub-signature-256');
      const valid = await verifySignature(rawBody, signature);
      if (!valid) {
        console.warn('Invalid X-Hub-Signature-256 — rejecting webhook');
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }
      const body = JSON.parse(rawBody);
      console.log('Instagram webhook received:', JSON.stringify(body).substring(0, 500));

      const entries = body?.entry || [];

      for (const entry of entries) {
        // entry.id may be a Page ID (facebook_login flow) OR an IG user ID (instagram_login flow)
        const entryId = entry.id;

        // Instagram webhooks may arrive in two formats:
        // 1) Messenger-style: entry.messaging[] (production for Instagram Login)
        // 2) Graph-style:    entry.changes[{ field, value }] (Meta test button + some accounts)
        // Normalize both into a single `messaging` array of message events.
        const rawMessaging = entry.messaging || [];
        const changes = entry.changes || [];
        const fromChanges = changes
          .filter((c: any) => c?.field === 'messages' && c?.value)
          .map((c: any) => {
            const v = c.value;
            return {
              sender: v.sender,
              recipient: v.recipient,
              timestamp: typeof v.timestamp === 'string' ? Number(v.timestamp) * 1000 : v.timestamp,
              message: v.message,
              read: v.read,
            };
          });
        const messaging = [...rawMessaging, ...fromChanges];

        const candidateIds = Array.from(new Set([
          entryId,
          ...messaging.flatMap((event: any) => [event.sender?.id, event.recipient?.id]),
        ].filter(Boolean).map(String)));

        let igInstance = null;
        let matchedCandidateId = null;

        for (const candidateId of candidateIds) {
          const { data, error } = await adminClient
            .from('instagram_instances')
            .select('organization_id, page_access_token, page_id, ig_user_id, auth_type')
            .or(`ig_user_id.eq.${candidateId},page_id.eq.${candidateId}`)
            .limit(1);

          if (error) {
            console.error(`Error searching instagram instance for candidate id ${candidateId}:`, error);
            continue;
          }

          if (data?.[0]) {
            igInstance = data[0];
            matchedCandidateId = candidateId;
            break;
          }
        }

        if (!igInstance) {
          console.warn(
            `No instagram instance found for entry id: ${entryId}. Candidate ids: ${candidateIds.join(', ')}. ` +
            `Connect/reconnect Instagram in Conexões so the ig_user_id matches the webhook entry.id.`
          );
          continue;
        }

        console.log(`Instagram instance matched by id: ${matchedCandidateId}`);

        // The "self" id used to detect outbound echoes
        const selfId = igInstance.auth_type === 'instagram_login'
          ? igInstance.ig_user_id
          : (igInstance.page_id || igInstance.ig_user_id);

        const orgId = igInstance.organization_id;
        for (const event of messaging) {
          // Skip echo messages (messages sent by the page itself)
          if (event.message?.is_echo) {
            console.log('Skipping echo message');
            continue;
          }

          // Ignore receipt-only events (read/delivery/reactions/postbacks) — they
          // do NOT carry a `message` payload and should not create a conversation.
          if (event.read || event.delivery || event.reaction || event.postback) {
            console.log('Skipping receipt/postback event (read/delivery/reaction/postback)');
            continue;
          }

          const senderId = event.sender?.id;
          const recipientId = event.recipient?.id;
          const timestamp = event.timestamp;
          const message = event.message;

          if (!message || !senderId) {
            console.log('Skipping event without message payload');
            continue;
          }

          // Determine direction
          const isFromSelf = senderId === selfId;
          const direction = isFromSelf ? 'outbound' : 'inbound';
          const igUserId = isFromSelf ? recipientId : senderId;

          // Get or create contact
          const contact = await getOrCreateContact(adminClient, orgId, igUserId, igInstance.page_access_token);
          if (!contact) {
            console.error('Failed to get/create contact for IG user:', igUserId);
            continue;
          }

          // Determine message type and content
          let content = message.text || null;
          let messageType = 'text';
          let mediaUrl = null;

          // Story replies: Meta sends story data in reply_to.story, not in attachments
          if (message.reply_to?.story) {
            messageType = 'ig_story';
            mediaUrl = message.reply_to.story.url || null;
            console.log(`[ig-webhook] story reply detected, url=${mediaUrl}`);
          }

          if (message.attachments && message.attachments.length > 0) {
            const attachment = message.attachments[0];
            const type = attachment.type;
            mediaUrl = attachment.payload?.url || null;

            console.log(`[ig-webhook] attachment type="${type}" payload=${JSON.stringify(attachment.payload ?? null).substring(0, 200)}`);

            if (type === 'image') {
              messageType = 'image';
            } else if (type === 'video' || type === 'ig_reel' || type === 'reel') {
              messageType = 'ig_reel';
              const reelVideoId = attachment.payload?.reel_video_id;
              if (reelVideoId) {
                // reel_video_id is numeric internal ID — fetch permalink from Graph API
                mediaUrl = await fetchIgPermalink(reelVideoId, igInstance.page_access_token);
              }
              mediaUrl = mediaUrl || attachment.payload?.url || null;
            } else if (type === 'ig_post' || type === 'post') {
              messageType = 'ig_post';
              const postId = attachment.payload?.id;
              if (postId) {
                mediaUrl = await fetchIgPermalink(postId, igInstance.page_access_token);
              }
              mediaUrl = mediaUrl || attachment.payload?.url || attachment.payload?.link || null;
            } else if (type === 'ig_story' || type === 'story') {
              messageType = 'ig_story';
              mediaUrl = attachment.payload?.url || attachment.payload?.link || null;
            } else if (type === 'share') {
              // Shared content — detect type by URL
              const url = attachment.payload?.url || attachment.payload?.link || null;
              if (url?.includes('/reel/')) {
                messageType = 'ig_reel';
                mediaUrl = url;
              } else if (url?.includes('/p/')) {
                messageType = 'ig_post';
                mediaUrl = url;
              } else if (url?.includes('/stories/')) {
                messageType = 'ig_story';
                mediaUrl = url;
              } else {
                messageType = 'text';
                content = content || attachment.payload?.title || url || '[conteúdo compartilhado]';
              }
            } else if (type === 'audio') {
              messageType = 'audio';
            } else if (type === 'file') {
              messageType = 'document';
            } else {
              messageType = 'text';
              content = content || `[${type}]`;
            }
          }

          // Check for duplicate (by ig message id)
          const igMessageId = message.mid;
          if (igMessageId) {
            const { data: existing } = await adminClient
              .from('messages')
              .select('id')
              .eq('whatsapp_message_id', igMessageId)
              .maybeSingle();

            if (existing) {
              console.log('Duplicate IG message, skipping:', igMessageId);
              continue;
            }
          }

          // Insert message
          const createdAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

          const { error: msgError } = await adminClient
            .from('messages')
            .insert({
              contact_id: contact.id,
              organization_id: orgId,
              content,
              message_type: messageType,
              media_url: mediaUrl,
              direction,
              status: 'delivered',
              whatsapp_message_id: igMessageId || null,
              channel: 'instagram',
              created_at: createdAt,
            });

          if (msgError) {
            console.error('Error inserting IG message:', JSON.stringify(msgError), 'payload:', { contact_id: contact.id, direction, messageType, igMessageId });
            continue;
          }
          console.log('IG message inserted successfully for contact', contact.id, 'direction', direction);

          // Update contact
          const updateData: any = {
            last_message_at: createdAt,
            updated_at: new Date().toISOString(),
          };

          if (direction === 'inbound') {
            // Increment unread count
            const { data: currentContact } = await adminClient
              .from('contacts')
              .select('unread_count')
              .eq('id', contact.id)
              .single();

            updateData.unread_count = (currentContact?.unread_count || 0) + 1;
            updateData.status = 'open';
            updateData.sdr_attempt_count = 0;
            updateData.sdr_last_triggered_at = null;
          }

          await adminClient
            .from('contacts')
            .update(updateData)
            .eq('id', contact.id);

          // Trigger automation engine for inbound messages
          if (direction === 'inbound') {
            try {
              const automationUrl = `${SUPABASE_URL}/functions/v1/automation-engine`;
              await fetch(automationUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'x-internal-service-key': SUPABASE_SERVICE_ROLE_KEY,
                },
                body: JSON.stringify({
                  contact_id: contact.id,
                  organization_id: orgId,
                  event_type: 'message_received',
                }),
              });
            } catch (autoErr) {
              console.warn('Automation engine call failed:', autoErr);
            }
          }
        }

        // Handle comments / mentions (sent in entry.changes by Meta)
        for (const change of changes) {
          const field = change.field;
          const value = change.value || {};

          if (field === 'comments') {
            const igCommentId = value.id;
            if (!igCommentId) continue;

            // Skip comments authored by the connected account itself
            // (e.g. our own replies sent via instagram-reply-comment).
            const fromId = value.from?.id ? String(value.from.id) : null;
            const fromUsername = value.from?.username || null;
            const selfIgId = igInstance.ig_user_id ? String(igInstance.ig_user_id) : null;
            if (fromId && selfIgId && fromId === selfIgId) {
              console.log('Skipping self-authored comment:', igCommentId);
              continue;
            }
            // Fallback: match by username from connected instance (if stored)
            const { data: instMeta } = await adminClient
              .from('instagram_instances')
              .select('username')
              .eq('organization_id', orgId)
              .limit(1)
              .maybeSingle();
            if (fromUsername && instMeta?.username && fromUsername.toLowerCase() === String(instMeta.username).toLowerCase()) {
              console.log('Skipping self-authored comment by username match:', igCommentId);
              continue;
            }

            try {
              await adminClient.from('instagram_comments').upsert(
                {
                  organization_id: orgId,
                  ig_comment_id: igCommentId,
                  ig_media_id: value.media?.id || null,
                  parent_comment_id: value.parent_id || null,
                  from_username: value.from?.username || null,
                  from_ig_user_id: value.from?.id || null,
                  text: value.text || null,
                  permalink: value.media?.permalink || null,
                  received_at: new Date().toISOString(),
                },
                { onConflict: 'organization_id,ig_comment_id' }
              );
              console.log('Comment saved:', igCommentId);
            } catch (cErr) {
              console.error('Error saving comment:', cErr);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Instagram webhook error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 200, // Must return 200 to Meta or they'll retry
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});

// Get or create a contact for an Instagram user
async function fetchIgPermalink(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/${mediaId}?fields=permalink&access_token=${accessToken}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.permalink || null;
  } catch {
    return null;
  }
}

async function getOrCreateContact(
  supabase: any,
  orgId: string,
  igUserId: string,
  pageAccessToken: string,
): Promise<{ id: string } | null> {
  // Search by phone field storing IG user ID (prefixed to avoid collision)
  const igPhone = `ig_${igUserId}`;

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('organization_id', orgId)
    .eq('phone', igPhone)
    .eq('channel', 'instagram')
    .maybeSingle();

  if (existing) return existing;

  // Fetch IG user profile from Graph API
  let userName = igUserId;
  let profilePicUrl = null;

  try {
    const profileRes = await fetch(
      `https://graph.instagram.com/v21.0/${igUserId}?fields=name,profile_pic&access_token=${pageAccessToken}`
    );
    if (profileRes.ok) {
      const profile = await profileRes.json();
      userName = profile.name || igUserId;
      profilePicUrl = profile.profile_pic || null;
    }
  } catch (err) {
    console.warn('Failed to fetch IG user profile:', err);
  }

  // Create contact
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      organization_id: orgId,
      phone: igPhone,
      name: userName,
      channel: 'instagram',
      profile_picture_url: profilePicUrl,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    // Handle duplicate race condition
    if (error.code === '23505') {
      const { data: race } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('phone', igPhone)
        .eq('channel', 'instagram')
        .maybeSingle();
      return race;
    }
    console.error('Error creating IG contact:', error);
    return null;
  }

  return newContact;
}
