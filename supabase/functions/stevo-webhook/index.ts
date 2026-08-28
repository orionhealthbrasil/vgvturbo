import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Standard Evolution API format
interface StevoMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      url?: string;
      mimetype?: string;
      caption?: string;
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
    };
    videoMessage?: {
      url?: string;
      mimetype?: string;
      caption?: string;
    };
    documentMessage?: {
      url?: string;
      mimetype?: string;
      fileName?: string;
    };
  };
  messageType?: string;
  messageTimestamp?: number;
}

// Stevo v2 format (different structure)
interface StevoV2Message {
  Info: {
    ID: string;
    Chat: string;
    Sender: string;
    SenderAlt?: string;
    RecipientAlt?: string;
    IsFromMe: boolean;
    IsGroup: boolean;
    PushName: string;
    Type: string;
    MediaType?: string;
    Timestamp?: string; // WhatsApp original message timestamp (ISO 8601)
    VerifiedName?: {
      Details?: {
        verifiedName?: string;
      };
    };
  };
  Message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
      contextInfo?: {
        quotedMessage?: {
          conversation?: string;
          imageMessage?: { caption?: string };
          audioMessage?: any;
          videoMessage?: { caption?: string };
          documentMessage?: { fileName?: string };
        };
        stanzaId?: string;
        participant?: string;
      };
    };
    imageMessage?: {
      url?: string;
      caption?: string;
      contextInfo?: {
        quotedMessage?: any;
        stanzaId?: string;
      };
    };
    audioMessage?: {
      url?: string;
      contextInfo?: {
        quotedMessage?: any;
        stanzaId?: string;
      };
    };
    videoMessage?: {
      url?: string;
      caption?: string;
      contextInfo?: {
        quotedMessage?: any;
        stanzaId?: string;
      };
    };
    documentMessage?: {
      url?: string;
      fileName?: string;
      contextInfo?: {
        quotedMessage?: any;
        stanzaId?: string;
      };
    };
    // Contact message (vCard)
    contactMessage?: {
      displayName?: string;
      vcard?: string;
    };
    contactsArrayMessage?: {
      contacts?: Array<{
        displayName?: string;
        vcard?: string;
      }>;
    };
    // Location messages
    locationMessage?: {
      degreesLatitude?: number;
      degreesLongitude?: number;
      name?: string;
      address?: string;
      url?: string;
    };
    liveLocationMessage?: {
      degreesLatitude?: number;
      degreesLongitude?: number;
      caption?: string;
      sequenceNumber?: number;
    };
    // Base64 media (Stevo sends media as base64)
    base64?: string;
  };
}

interface StevoWebhookPayload {
  event: string;
  instance?: string;
  instanceName?: string;
  instanceId?: string;
  data: any;
}

function extractPhoneNumber(jid: string): string {
  // Remove domain suffix and device suffix (e.g. 559191807033:44@s.whatsapp.net -> 559191807033)
  const jidWithoutDomain = jid.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '');
  const jidWithoutDevice = jidWithoutDomain.split(':')[0];
  return jidWithoutDevice.replace(/[^0-9]/g, '');
}

/**
 * Normalize Brazilian mobile phone numbers.
 * Brazilian mobile numbers should be: 55 + DDD(2 digits) + 9 + number(8 digits) = 13 digits
 * Some WhatsApp instances send without the leading 9 after DDD (12 digits).
 * This function returns the canonical 13-digit form for mobile numbers.
 * Also returns alternative forms for contact lookup.
 */
function normalizeBrazilianPhone(phone: string): { normalized: string; alternatives: string[] } {
  // Only handle Brazilian numbers (starting with 55)
  if (!phone.startsWith('55')) {
    return { normalized: phone, alternatives: [] };
  }

  const withoutCountry = phone.slice(2); // Remove '55'
  
  // If 10 digits: DDD(2) + number(8) — could be mobile missing the 9, or a landline
  // Only add the 9 for mobile numbers (first digit after DDD is 6-9)
  // Landlines start with 2-5 and should NOT get a 9 prepended
  if (withoutCountry.length === 10) {
    const ddd = withoutCountry.slice(0, 2);
    const number = withoutCountry.slice(2);
    const firstDigitAfterDDD = number[0];
    
    if (['6', '7', '8', '9'].includes(firstDigitAfterDDD)) {
      // Mobile number missing the 9 — add it
      const withNine = `55${ddd}9${number}`;
      console.log(`[Phone Normalization] Mobile without 9, adding: ${phone} -> ${withNine}`);
      return { normalized: withNine, alternatives: [phone] };
    }
    
    // Landline number (starts with 2-5) — keep as is, no 9 to add
    console.log(`[Phone Normalization] Landline detected, keeping as is: ${phone}`);
    return { normalized: phone, alternatives: [] };
  }
  
  // If 11 digits: DDD(2) + 9 + number(8) — already correct
  // Also generate the version without the 9 for matching
  if (withoutCountry.length === 11 && withoutCountry[2] === '9') {
    const ddd = withoutCountry.slice(0, 2);
    const number = withoutCountry.slice(3); // skip the 9
    const withoutNine = `55${ddd}${number}`;
    return { normalized: phone, alternatives: [withoutNine] };
  }

  return { normalized: phone, alternatives: [] };
}

function getMessageContentV1(message: StevoMessage['message']): { content: string; type: string; mediaUrl?: string } {
  if (!message) {
    return { content: '', type: 'text' };
  }

  if (message.conversation) {
    return { content: message.conversation, type: 'text' };
  }

  if (message.extendedTextMessage?.text) {
    return { content: message.extendedTextMessage.text, type: 'text' };
  }

  if (message.imageMessage) {
    const mediaCaption = extractMediaCaption(message);
    return {
      content: mediaCaption || 'Imagem',
      type: 'image',
      mediaUrl: message.imageMessage.url,
    };
  }

  if (message.audioMessage) {
    return {
      content: 'Áudio',
      type: 'audio',
      mediaUrl: message.audioMessage.url,
    };
  }

  if (message.videoMessage) {
    const mediaCaption = extractMediaCaption(message);
    return {
      content: mediaCaption || 'Vídeo',
      type: 'video',
      mediaUrl: message.videoMessage.url,
    };
  }

  if (message.documentMessage) {
    return {
      content: message.documentMessage.fileName || 'Documento',
      type: 'document',
      mediaUrl: message.documentMessage.url,
    };
  }

  return { content: '', type: 'text' };
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function extractMediaCaption(message: any): string | undefined {
  const directCaption = firstNonEmptyString(
    message?.caption,
    message?.Caption,
    message?.imageMessage?.caption,
    message?.videoMessage?.caption,
    message?.documentMessage?.caption,
    message?.documentWithCaptionMessage?.message?.imageMessage?.caption,
    message?.documentWithCaptionMessage?.message?.videoMessage?.caption,
    message?.viewOnceMessage?.message?.imageMessage?.caption,
    message?.viewOnceMessage?.message?.videoMessage?.caption,
    message?.viewOnceMessageV2?.message?.imageMessage?.caption,
    message?.viewOnceMessageV2?.message?.videoMessage?.caption,
  );
  if (directCaption) return directCaption;

  const skipKeys = new Set(['base64', 'url', 'jpegThumbnail', 'contextInfo', 'quotedMessage', 'messageContextInfo']);
  const scan = (value: any, depth = 0): string | undefined => {
    if (!value || typeof value !== 'object' || depth > 4) return undefined;
    for (const [key, nested] of Object.entries(value)) {
      if (skipKeys.has(key)) continue;
      const normalizedKey = key.toLowerCase();
      if ((normalizedKey === 'caption' || normalizedKey === 'text') && typeof nested === 'string' && nested.trim()) {
        return nested.trim();
      }
      const found = scan(nested, depth + 1);
      if (found) return found;
    }
    return undefined;
  };

  return scan(message);
}

function getMessageContentV2(
  message: StevoV2Message['Message'], 
  info: StevoV2Message['Info'],
  topLevelContextInfo?: { stanzaID?: string; participant?: string; quotedMessage?: any },
  rawData?: any,
): { content: string; type: string; mediaUrl?: string; base64?: string; quotedContent?: string; quotedType?: string; quotedStanzaId?: string } {
  if (!message) {
    return { content: '', type: 'text' };
  }

  // Check if there's base64 media
  const hasBase64 = !!message.base64;
  const mediaType = info.MediaType || info.Type;
  const mediaCaption = extractMediaCaption(message) || extractMediaCaption(rawData);

  // Extract quoted message info if present
  // Check BOTH the message-level contextInfo AND the top-level MessageContextInfo
  let quotedContent: string | undefined;
  let quotedType: string | undefined;
  let quotedStanzaId: string | undefined;

  // First try message-level contextInfo from ALL possible message types
  const contextInfo = message.extendedTextMessage?.contextInfo || 
                     message.imageMessage?.contextInfo || 
                     message.audioMessage?.contextInfo ||
                     message.videoMessage?.contextInfo ||
                     message.documentMessage?.contextInfo ||
                     (message as any).stickerMessage?.contextInfo ||
                     (message as any).contactMessage?.contextInfo ||
                     (message as any).locationMessage?.contextInfo;

  // Log contextInfo sources for debugging group quotes
  if (contextInfo) {
    const ctxKeys = Object.keys(contextInfo).join(',');
    console.log(`[Quote Debug] message-level contextInfo keys: ${ctxKeys}, stanzaId=${(contextInfo as any).stanzaId}, hasQuotedMessage=${!!contextInfo.quotedMessage}`);
    if (contextInfo.quotedMessage) {
      const qmKeys = Object.keys(contextInfo.quotedMessage).join(',');
      console.log(`[Quote Debug] quotedMessage keys: ${qmKeys}`);
    }
  }
  if (topLevelContextInfo) {
    const tlKeys = Object.keys(topLevelContextInfo).join(',');
    console.log(`[Quote Debug] top-level MessageContextInfo keys: ${tlKeys}, stanzaID=${topLevelContextInfo.stanzaID}`);
  }

  // Collect ALL possible contextInfo sources, prioritize ones with actual content
  // Some Evolution API versions put contextInfo at different levels for group messages
  const allContextInfoSources = [
    contextInfo, // message-level (extendedTextMessage, imageMessage, etc.)
    topLevelContextInfo, // top-level MessageContextInfo
  ].filter(Boolean);

  // Find the best contextInfo: one that has quotedMessage with actual content
  let effectiveContextInfo: any = null;
  for (const ctx of allContextInfoSources) {
    if (ctx?.quotedMessage && typeof ctx.quotedMessage === 'object' && Object.keys(ctx.quotedMessage).length > 0) {
      // Filter out quotedMessage that only has metadata keys (messageContextInfo, etc.) 
      // but no actual content keys
      const qmKeys = Object.keys(ctx.quotedMessage);
      const contentKeys = qmKeys.filter(k => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k));
      if (contentKeys.length > 0) {
        effectiveContextInfo = ctx;
        break;
      }
    }
  }

  // If no contextInfo with content-bearing quotedMessage found, try any with quotedMessage
  if (!effectiveContextInfo) {
    for (const ctx of allContextInfoSources) {
      if (ctx?.quotedMessage) {
        effectiveContextInfo = ctx;
        break;
      }
    }
  }

  if (effectiveContextInfo?.quotedMessage) {
    const quoted = effectiveContextInfo.quotedMessage;
    // Handle stanzaId from multiple possible locations:
    // 1. effectiveContextInfo.stanzaID (uppercase, top-level)
    // 2. effectiveContextInfo.stanzaId (lowercase, message-level)
    // 3. contextInfo.stanzaId (always check message-level even if effectiveContextInfo is top-level)
    // 4. topLevelContextInfo.stanzaID (always check top-level even if effectiveContextInfo is message-level)
    quotedStanzaId = (effectiveContextInfo as any).stanzaID || 
                     (effectiveContextInfo as any).stanzaId ||
                     (contextInfo as any)?.stanzaId ||
                     (contextInfo as any)?.stanzaID ||
                     topLevelContextInfo?.stanzaID ||
                     (topLevelContextInfo as any)?.stanzaId;
    
    // Extract quoted content - check all known message types
    if (quoted.conversation) {
      quotedContent = quoted.conversation;
      quotedType = 'text';
    } else if (quoted.extendedTextMessage?.text) {
      quotedContent = quoted.extendedTextMessage.text;
      quotedType = 'text';
    } else if (quoted.imageMessage) {
      quotedContent = quoted.imageMessage.caption || 'Imagem';
      quotedType = 'image';
    } else if (quoted.audioMessage) {
      quotedContent = 'Áudio';
      quotedType = 'audio';
    } else if (quoted.videoMessage) {
      quotedContent = quoted.videoMessage.caption || 'Vídeo';
      quotedType = 'video';
    } else if (quoted.documentMessage) {
      quotedContent = quoted.documentMessage.fileName || 'Documento';
      quotedType = 'document';
    } else if (quoted.stickerMessage) {
      quotedContent = 'Figurinha';
      quotedType = 'sticker';
    } else if (quoted.contactMessage) {
      quotedContent = quoted.contactMessage.displayName || 'Contato';
      quotedType = 'contact';
    } else if (quoted.locationMessage) {
      quotedContent = quoted.locationMessage.name || 'Localização';
      quotedType = 'location';
    } else {
      // Fallback: try to get any text content from unknown structure
      const qmKeys = Object.keys(quoted).filter(k => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k));
      if (qmKeys.length > 0) {
        // Try to find a text field in the first content key
        const firstKey = qmKeys[0];
        const firstVal = quoted[firstKey];
        if (typeof firstVal === 'string') {
          quotedContent = firstVal;
          quotedType = 'text';
        } else if (typeof firstVal === 'object' && firstVal) {
          quotedContent = firstVal.text || firstVal.caption || firstVal.displayName || firstVal.fileName || `[${firstKey.replace('Message', '')}]`;
          quotedType = firstKey.replace('Message', '').toLowerCase() || 'text';
        }
        console.log(`[Quote Debug] Fallback extraction from key "${firstKey}": content="${quotedContent?.substring(0, 50)}", type=${quotedType}`);
      } else {
        console.log(`[Quote Debug] quotedMessage has no content keys, only metadata: ${Object.keys(quoted).join(',')}`);
      }
    }

    if (quotedContent) {
      console.log(`Found quoted message: ${quotedType} - stanzaId: ${quotedStanzaId} - ${quotedContent?.substring(0, 50)}`);
    } else {
      console.log(`[Quote Debug] Could not extract content from quotedMessage. Raw keys: ${JSON.stringify(Object.keys(quoted))}`);
      // Even without content, try to use stanzaId to look up the original message later
      if (quotedStanzaId) {
        console.log(`[Quote Debug] Will attempt DB lookup with stanzaId: ${quotedStanzaId}`);
      }
    }
  }

  if (message.conversation) {
    return { content: message.conversation, type: 'text', quotedContent, quotedType, quotedStanzaId };
  }

  if (message.extendedTextMessage?.text) {
    return { content: message.extendedTextMessage.text, type: 'text', quotedContent, quotedType, quotedStanzaId };
  }

  // Handle media with base64
  if (hasBase64) {
    if (mediaType === 'sticker') {
      return {
        content: 'Figurinha',
        type: 'sticker',
        base64: message.base64,
        quotedContent,
        quotedType,
        quotedStanzaId,
      };
    }

    if (mediaType === 'image') {
      return {
        content: mediaCaption || 'Imagem',
        type: 'image',
        mediaUrl: message.imageMessage?.url,
        base64: message.base64,
        quotedContent,
        quotedType,
        quotedStanzaId,
      };
    }

    if (mediaType === 'audio' || mediaType === 'ptt') {
      return {
        content: 'Áudio',
        type: 'audio',
        mediaUrl: message.audioMessage?.url,
        base64: message.base64,
        quotedContent,
        quotedType,
        quotedStanzaId,
      };
    }

    if (mediaType === 'video') {
      return {
        content: mediaCaption || 'Vídeo',
        type: 'video',
        mediaUrl: message.videoMessage?.url,
        base64: message.base64,
        quotedContent,
        quotedType,
        quotedStanzaId,
      };
    }

    if (mediaType === 'document') {
      return {
        content: message.documentMessage?.fileName || 'Documento',
        type: 'document',
        mediaUrl: message.documentMessage?.url,
        base64: message.base64,
        quotedContent,
        quotedType,
        quotedStanzaId,
      };
    }

    // Default for unknown media type with base64
    console.log(`Unknown media type with base64: ${mediaType}, defaulting to image`);
    return {
      content: 'Mídia',
      type: 'image',
      base64: message.base64,
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  // Handle media with URL (no base64)
  if (message.imageMessage) {
    return {
      content: mediaCaption || 'Imagem',
      type: 'image',
      mediaUrl: message.imageMessage.url,
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  if (message.audioMessage) {
    return {
      content: 'Áudio',
      type: 'audio',
      mediaUrl: message.audioMessage.url,
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  if (message.videoMessage) {
    return {
      content: mediaCaption || 'Vídeo',
      type: 'video',
      mediaUrl: message.videoMessage.url,
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  if (message.documentMessage) {
    return {
      content: message.documentMessage.fileName || 'Documento',
      type: 'document',
      mediaUrl: message.documentMessage.url,
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  // Handle location messages
  if (message.locationMessage) {
    const loc = message.locationMessage;
    const locationData = {
      latitude: loc.degreesLatitude,
      longitude: loc.degreesLongitude,
      name: loc.name || '',
      address: loc.address || '',
      url: loc.url || '',
    };
    return {
      content: JSON.stringify(locationData),
      type: 'location',
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  // Handle live location messages
  if (message.liveLocationMessage) {
    const loc = message.liveLocationMessage;
    const locationData = {
      latitude: loc.degreesLatitude,
      longitude: loc.degreesLongitude,
      name: loc.caption || 'Localização em tempo real',
      address: '',
      url: '',
    };
    return {
      content: JSON.stringify(locationData),
      type: 'location',
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  // Handle contact (vCard) messages
  if (message.contactMessage) {
    const displayName = message.contactMessage.displayName || 'Contato';
    const vcard = message.contactMessage.vcard || '';
    const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s|-/g, '') : '';
    return { 
      content: JSON.stringify({ displayName, phone, vcard }), 
      type: 'contact',
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  // Handle multiple contacts array
  if (message.contactsArrayMessage?.contacts && message.contactsArrayMessage.contacts.length > 0) {
    const contacts = message.contactsArrayMessage.contacts.map(c => {
      const phoneMatch = (c.vcard || '').match(/TEL[^:]*:([+\d\s-]+)/i);
      const phone = phoneMatch ? phoneMatch[1].replace(/\s|-/g, '') : '';
      return { displayName: c.displayName || 'Contato', phone };
    });
    return { 
      content: JSON.stringify({ contacts }), 
      type: 'contacts',
      quotedContent,
      quotedType,
      quotedStanzaId,
    };
  }

  return { content: '', type: 'text', quotedContent, quotedType, quotedStanzaId };
}

// Normalize sticker by re-encoding to plain WebP for compatibility
// Uses dynamic imports to avoid loading heavy codecs on every invocation
async function normalizeSticker(binaryData: Uint8Array): Promise<Uint8Array | null> {
  try {
    // Dynamic import — only loaded when a sticker is actually received
    const [{ default: decodeWebp }, { default: encodeWebp }] = await Promise.all([
      import("https://esm.sh/@jsquash/webp@1.4.0/decode?target=deno"),
      import("https://esm.sh/@jsquash/webp@1.4.0/encode?target=deno"),
    ]);

    const arrayBuffer = new ArrayBuffer(binaryData.length);
    new Uint8Array(arrayBuffer).set(binaryData);
    
    const decoded = await decodeWebp(arrayBuffer);
    if (!decoded) return null;

    const rgba: Uint8ClampedArray =
      decoded.data instanceof Uint8ClampedArray
        ? decoded.data
        : Uint8ClampedArray.from(decoded.data as unknown as ArrayLike<number>);

    const safeRgba = new Uint8ClampedArray(rgba.length);
    safeRgba.set(rgba);

    const imgData = new ImageData(
      safeRgba as unknown as Uint8ClampedArray<ArrayBuffer>,
      decoded.width,
      decoded.height,
    );

    const webpArrayBuffer = await encodeWebp(imgData);
    console.log('Sticker normalized successfully');
    return new Uint8Array(webpArrayBuffer);
  } catch (error) {
    console.error('Sticker normalization failed:', error);
    return null;
  }
}

// Helper function to upload base64 to Supabase Storage
async function uploadBase64ToStorage(
  supabase: any, 
  base64Data: string, 
  organizationId: string, 
  mediaType: string
): Promise<string | null> {
  try {
    // Determine file extension based on media type
    let extension = 'bin';
    let contentType = 'application/octet-stream';
    
    if (mediaType === 'image') {
      extension = 'jpg';
      contentType = 'image/jpeg';
    } else if (mediaType === 'sticker') {
      extension = 'webp';
      contentType = 'image/webp';
    } else if (mediaType === 'audio') {
      extension = 'ogg';
      contentType = 'audio/ogg';
    } else if (mediaType === 'video') {
      extension = 'mp4';
      contentType = 'video/mp4';
    } else if (mediaType === 'document') {
      extension = 'pdf';
      contentType = 'application/pdf';
    }

    // Decode base64 to binary
    let binaryData: Uint8Array = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // For stickers, normalize to plain WebP for compatibility
    if (mediaType === 'sticker') {
      console.log('Normalizing incoming sticker...');
      const normalized = await normalizeSticker(binaryData);
      if (normalized) {
        // Create new Uint8Array to avoid type issues
        binaryData = new Uint8Array(normalized.length);
        binaryData.set(normalized);
        console.log('Sticker normalized, uploading to stickers bucket...');
        
        // Also upload normalized sticker to stickers bucket for future sending
        const stickerFileName = `${organizationId}/received/${Date.now()}.webp`;
        await supabase.storage
          .from('stickers')
          .upload(stickerFileName, binaryData, {
            contentType: 'image/webp',
            upsert: false,
          });
      }
    }

    // Generate unique filename for chat-media
    const fileName = `${organizationId}/${Date.now()}.${extension}`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, binaryData, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName);

    console.log('Media uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Failed to upload media:', error);
    return null;
  }
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
    // FAST PATH: Parse only the event field first to reject irrelevant events
    // before initializing any heavy resources (Supabase client, logging, etc.)
    const payload: StevoWebhookPayload = await req.json();
    const event = payload.event;

    // Accept both MESSAGES_UPSERT (Evolution API standard) and Message (Stevo v2 format)
    const isMessageEvent = 
      event === 'MESSAGES_UPSERT' || 
      event === 'messages.upsert' || 
      event === 'Message' ||
      event === 'message';

    // Accept message deletion events (when someone deletes for everyone on WhatsApp)
    const isDeleteEvent =
      event === 'MESSAGES_DELETE' ||
      event === 'messages.delete' ||
      event === 'MessageRevoke' ||
      event === 'message.revoke';

    if (!isMessageEvent && !isDeleteEvent) {
      // Return immediately — no Supabase client, no logging, minimal compute
      return new Response('ok', { headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const instanceName = payload.instanceName || payload.instance;
    const data = payload.data;

    // Minimal logging — avoid serializing base64 media payloads
    console.log(`Webhook: event=${event} instance=${instanceName}`);

    if (!instanceName) {
      console.error('No instance name in payload');
      return new Response(
        JSON.stringify({ error: 'Instance name required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find organization by instance name from whatsapp_instances table
    const { data: instanceData, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('organization_id, owner_jid')
      .eq('instance_name', instanceName)
      .single();

    if (instanceError || !instanceData) {
      console.error('Instance not found:', instanceName, instanceError);
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = instanceData.organization_id;
    const ownerJid = instanceData.owner_jid || null;
    console.log(`Found organization ${organizationId} for instance ${instanceName} (owner_jid: ${ownerJid})`);

    // Fetch manager phone once for routing decisions
    const { data: orgData } = await supabase
      .from('organizations')
      .select('manager_whatsapp_phone')
      .eq('id', organizationId)
      .maybeSingle();
    const managerPhone = orgData?.manager_whatsapp_phone?.replace(/\D/g, '') || null;

    // Handle message deletion events
    if (isDeleteEvent) {
      console.log('Processing message deletion event:', JSON.stringify(data));
      
      // Extract the WhatsApp message ID from the deletion event
      // Different formats send different payloads:
      // Evolution API: { messageId: "xxx" } or { key: { id: "xxx" } }
      // Stevo v2: { Info: { ID: "xxx" } } or { id: "xxx" } or { messageId: "xxx" }
      const deletedMessageId = 
        data?.key?.id ||
        data?.messageId ||
        data?.message_id ||
        data?.Info?.ID ||
        data?.id ||
        // Sometimes data is an array
        data?.[0]?.key?.id ||
        data?.[0]?.messageId ||
        null;

      if (!deletedMessageId) {
        console.log('No message ID found in delete event, raw data:', JSON.stringify(data));
        return new Response(
          JSON.stringify({ success: true, message: 'No message ID in delete event' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Deleting message with whatsapp_message_id: ${deletedMessageId}`);

      // Find and delete the message from our database
      const { data: deletedMsg, error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('organization_id', organizationId)
        .eq('whatsapp_message_id', deletedMessageId)
        .select('id')
        .maybeSingle();

      if (deleteError) {
        console.error('Failed to delete message:', deleteError);
      } else if (deletedMsg) {
        console.log(`Successfully deleted message ${deletedMsg.id} (whatsapp_id: ${deletedMessageId})`);
      } else {
        console.log(`Message not found for whatsapp_message_id: ${deletedMessageId}`);
      }

      return new Response(
        JSON.stringify({ success: true, deleted: !!deletedMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect format: Stevo v2 has "Info" and "Message" at top level of data
    const isV2Format = data?.Info && data?.Message;

    if (isV2Format) {
      // Process Stevo v2 format
      const info = data.Info as StevoV2Message['Info'];
      const message = data.Message as StevoV2Message['Message'];

      // Extract the WhatsApp message ID (stanzaId) for quote support
      const whatsappMessageId = info.ID || null;

      // Handle protocolMessage (message revoke/delete) BEFORE any other processing
      // When someone deletes a message on WhatsApp, Stevo v2 sends a Message event
      // with Type "protocolMessage" and the revoked message ID inside the payload
      const messageType = info.Type || '';
      const isProtocolMessage = messageType.toLowerCase() === 'protocolmessage' || messageType.toLowerCase() === 'protocol';
      
      if (isProtocolMessage) {
        console.log('Protocol message detected (possible revoke):', JSON.stringify({ Info: info, Message: message }));
        
        // Extract the revoked message ID from the protocol message payload
        // Different possible locations in the payload
        const protocolMsg = (message as any)?.protocolMessage || (message as any);
        const revokedMessageId = 
          protocolMsg?.key?.id ||
          protocolMsg?.revokeMessage?.key?.id ||
          (data as any)?.MessageContextInfo?.stanzaID ||
          null;
        
        if (revokedMessageId) {
          console.log(`Message revoke detected, deleting whatsapp_message_id: ${revokedMessageId}`);
          
          const { data: deletedMsg, error: deleteError } = await supabase
            .from('messages')
            .delete()
            .eq('organization_id', organizationId)
            .eq('whatsapp_message_id', revokedMessageId)
            .select('id')
            .maybeSingle();
          
          if (deleteError) {
            console.error('Failed to delete revoked message:', deleteError);
          } else if (deletedMsg) {
            console.log(`Successfully deleted revoked message ${deletedMsg.id}`);
          } else {
            console.log(`Revoked message not found for whatsapp_id: ${revokedMessageId}`);
          }
        } else {
          console.log('Protocol message without revoked message ID, ignoring');
        }
        
        return new Response(
          JSON.stringify({ success: true, message: 'Protocol message processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determine if this is an outbound message (sent by us via WhatsApp Web or app)
      // Primary check: IsFromMe flag from Stevo
      // Fallback: compare Sender JID with owner_jid (WhatsApp Web messages sometimes have IsFromMe=false)
      let isOutbound = info.IsFromMe === true;
      if (!isOutbound && ownerJid && info.Sender) {
        const senderPhone = extractPhoneNumber(info.Sender);
        const ownerPhone = extractPhoneNumber(ownerJid);
        if (senderPhone && ownerPhone && senderPhone === ownerPhone) {
          isOutbound = true;
          console.log(`Detected outbound via owner_jid match: Sender=${info.Sender}, owner_jid=${ownerJid}`);
        }
      }

      // Detect group messages
      const isGroup = info.IsGroup === true;
      const groupJid = isGroup ? info.Chat : null;
      
      // For group messages, extract the sender's info from Sender field
      // Sender contains the JID of the person who sent the message in the group
      let groupSenderPhone: string | null = null;
      let groupSenderName: string | null = null;
      if (isGroup) {
        const senderJid = info.Sender || '';
        if (senderJid && senderJid.includes('@s.whatsapp.net')) {
          // Keep sender digits as close as possible to original JID (only remove domain/device suffix)
          // to preserve compatibility when building quote participant later.
          groupSenderPhone = extractPhoneNumber(senderJid);
        }
        groupSenderName = info.PushName || null;
        console.log(`Group message from ${groupSenderPhone} (${groupSenderName}) in group ${groupJid}`);
      }

      // For group messages, use group JID directly; for DMs, resolve phone
      let jid = info.Chat;
      let phone = '';
      let phoneAlternatives: string[] = [];
      let contactName: string | null = null;

      if (isGroup) {
        // For groups, the "phone" is the group JID number (without @g.us)
        phone = extractPhoneNumber(jid);
        // PushName in group context is the SENDER's name, not the group name
        // Use a default group name; the actual group subject is not in the webhook payload
        // We'll only set name on creation, not override existing group names
        contactName = `Grupo ${phone}`;
        console.log(`Group contact: phone=${phone}, name=${contactName}, jid=${groupJid}`);
      } else {
        // DM logic - resolve LIDs and normalize phone
        const isLid = jid?.includes('@lid');
        if (isLid) {
          const altJid = info.RecipientAlt || info.SenderAlt;
          if (altJid && altJid.includes('@s.whatsapp.net')) {
            console.log(`LID detected, using alt JID: ${altJid} instead of ${jid}`);
            jid = altJid;
          } else if (info.Sender && info.Sender.includes('@s.whatsapp.net') && !info.IsFromMe) {
            console.log(`LID detected, using Sender JID: ${info.Sender} instead of ${jid}`);
            jid = info.Sender;
          } else {
            console.error(`LID detected with no valid phone alternative - REJECTING message.`);
            return new Response(
              JSON.stringify({ success: false, message: 'LID without valid phone alternative' }),
              { status: 406, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (!jid) {
          console.log('No Chat JID found in v2 message');
          return new Response(
            JSON.stringify({ success: true, message: 'No JID' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const rawPhone = extractPhoneNumber(jid);
        const normalized = normalizeBrazilianPhone(rawPhone);
        phone = normalized.normalized;
        phoneAlternatives = normalized.alternatives;

        const looksLikeRealPhone = phone && phone.length >= 10 && phone.length <= 15 && /^[0-9]+$/.test(phone);
        if (!phone || !looksLikeRealPhone) {
          console.error('Invalid phone number:', phone, 'from JID:', jid);
          return new Response(
            JSON.stringify({ success: false, message: 'Invalid phone' }),
            { status: 406, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const pushName = info.PushName || info.VerifiedName?.Details?.verifiedName;
        const hasRealName = pushName && pushName !== phone && pushName !== rawPhone && !/^\+?\d+$/.test(pushName);
        contactName = !isOutbound && hasRealName ? pushName : null;
      }
      
      // Extract top-level MessageContextInfo (for customer replies to our messages)
      const topLevelContextInfo = data.MessageContextInfo as { stanzaID?: string; participant?: string; quotedMessage?: any } | undefined;
      
      // Debug: Log raw message keys for quote debugging (both DM and group)
      {
        const chatType = isGroup ? 'Group' : 'DM';
        const msgKeys = message ? Object.keys(message).filter(k => k !== 'base64').join(',') : 'null';
        const dataKeys = Object.keys(data).filter(k => !['Message', 'Info'].includes(k)).join(',');
        console.log(`[${chatType} Quote Debug] Message keys: ${msgKeys}, Extra data keys: ${dataKeys}`);
        
        // Deep scan: look for stanzaId or quotedMessage ANYWHERE in the data object
        const dataStr = JSON.stringify(data, (key, value) => {
          if (key === 'base64' || key === 'Message') return undefined; // skip large fields
          return value;
        });
        // Check if stanzaId exists anywhere
        if (dataStr.includes('stanzaId') || dataStr.includes('stanzaID')) {
          console.log(`[${chatType} Quote Debug] stanzaId found somewhere in payload!`);
        }
        if (dataStr.includes('quotedMessage')) {
          console.log(`[${chatType} Quote Debug] quotedMessage found somewhere in payload!`);
        }
        
        // Log ALL top-level data keys with their types
        for (const key of Object.keys(data)) {
          if (key === 'Message' || key === 'Info') continue;
          const val = data[key];
          const preview = typeof val === 'object' ? JSON.stringify(val).substring(0, 300) : String(val).substring(0, 100);
          console.log(`[${chatType} Quote Debug] data.${key} = ${preview}`);
        }
        
        // Also check inside Message for any contextInfo-like fields
        if (message) {
          for (const key of Object.keys(message)) {
            if (key === 'base64') continue;
            const val = (message as any)[key];
            if (typeof val === 'object' && val !== null) {
              const innerKeys = Object.keys(val).join(',');
              if (innerKeys.includes('contextInfo') || innerKeys.includes('stanzaId') || innerKeys.includes('quotedMessage')) {
                console.log(`[${chatType} Quote Debug] message.${key} has quote-related keys: ${innerKeys}`);
                const ci = val.contextInfo;
                if (ci) {
                  console.log(`[${chatType} Quote Debug] message.${key}.contextInfo = ${JSON.stringify(ci).substring(0, 500)}`);
                }
              }
            }
          }
        }
      }
      
      let { content, type, mediaUrl, base64, quotedContent, quotedType, quotedStanzaId } = getMessageContentV2(message, info, topLevelContextInfo, data);

      // If we have base64 data, upload it to storage
      let finalMediaUrl: string | undefined = mediaUrl;
      if (base64 && !mediaUrl) {
        console.log(`Uploading ${type} media to storage...`);
        const uploadedUrl = await uploadBase64ToStorage(supabase, base64, organizationId, type);
        if (uploadedUrl) finalMediaUrl = uploadedUrl;
      }

      if (!content && !finalMediaUrl && !base64) {
        console.log('Skipping v2 message with no content');
        return new Response(
          JSON.stringify({ success: true, message: 'No content' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Processing v2 ${isOutbound ? 'outbound' : 'inbound'} ${isGroup ? 'group' : 'DM'} message from ${phone} (name: ${contactName || 'none'}): ${content}`);

      // Find existing contact - for groups use group_jid, for DMs use phone
      let existingContact: any = null;
      if (isGroup && groupJid) {
        const { data: groupContacts } = await supabase
          .from('contacts')
          .select('id, name, status, funnel_stage, phone, active_flow_id, profile_picture_url, is_group, group_jid, is_archived')
          .eq('organization_id', organizationId)
          .eq('group_jid', groupJid)
          .limit(1);
        existingContact = groupContacts?.[0] || null;
      } else {
        const allPhones = [phone, ...phoneAlternatives];
        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('id, name, status, funnel_stage, phone, active_flow_id, profile_picture_url, is_archived')
          .eq('organization_id', organizationId)
          .in('phone', allPhones);
        existingContact = existingContacts?.find((c: any) => c.phone === phone) || existingContacts?.[0] || null;
      }

      let contactId: string;
      let contactStatus: string;
      let contactFunnelStage: string;

      if (existingContact) {
        // If contact is archived, silently ignore the message
        if (existingContact.is_archived) {
          console.log(`Ignoring message for archived contact ${existingContact.id} (phone: ${phone})`);
          return new Response(
            JSON.stringify({ success: true, message: 'Contact is archived, message ignored' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Contact exists - only update name if we have a better one
        contactId = existingContact.id;
        contactStatus = existingContact.status;
        contactFunnelStage = existingContact.funnel_stage;
        
        // For groups, DON'T overwrite name (user may have renamed it manually)
        // For DMs, only update if current name is just a phone number
        const currentNameIsPhone = existingContact.name === phone || /^\+?\d+$/.test(existingContact.name || '');
        const shouldUpdateName = !isGroup && contactName && currentNameIsPhone;
        
        // Build update payload
        const contactUpdateData: Record<string, any> = {};
        if (shouldUpdateName) {
          contactUpdateData.name = contactName;
          console.log(`Updating contact name from "${existingContact.name}" to "${contactName}"`);
        }
        // If the stored phone differs from the normalized form, update it
        if (!isGroup && existingContact.phone !== phone) {
          contactUpdateData.phone = phone;
          console.log(`Normalizing contact phone from "${existingContact.phone}" to "${phone}"`);
        }
        if (Object.keys(contactUpdateData).length > 0) {
          await supabase
            .from('contacts')
            .update(contactUpdateData)
            .eq('id', contactId);
        }
        
        
        // Fetch profile picture for existing DM contacts that don't have one yet (skip for groups)
        if (!isGroup && !isOutbound && !existingContact.profile_picture_url) {
          try {
            const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
            fetch(`${SUPABASE_URL}/functions/v1/fetch-profile-picture`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                phone,
                organization_id: organizationId,
                contact_id: contactId,
              }),
            }).catch(err => console.error('Failed to fetch profile picture:', err));
          } catch (profilePicError) {
            console.error('Failed to trigger profile picture fetch:', profilePicError);
          }
        }
        
        console.log(`Found existing contact: ${contactId}, status: ${contactStatus}`);
      } else {
        // Create new contact — resolve default pipeline + first stage so it appears in the funnel
        const insertData: any = {
          organization_id: organizationId,
          phone,
          name: contactName || phone,
        };
        if (isGroup && groupJid) {
          insertData.is_group = true;
          insertData.group_jid = groupJid;
        }
        const { data: defaultPipeline } = await supabase
          .from('kanban_pipelines')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_default', true)
          .maybeSingle();
        const defaultPipelineId = defaultPipeline?.id ?? null;
        if (defaultPipelineId) {
          const { data: firstStage } = await supabase
            .from('funnel_stages')
            .select('slug')
            .eq('pipeline_id', defaultPipelineId)
            .order('position')
            .limit(1)
            .maybeSingle();
          insertData.pipeline_id = defaultPipelineId;
          insertData.funnel_stage = firstStage?.slug ?? 'lead';
        }
        const { data: newContact, error: insertError } = await supabase
          .from('contacts')
          .insert(insertData)
          .select('id, name, status, funnel_stage')
          .single();

        if (insertError) {
          // Handle race condition: another request may have created this contact
          if (insertError.code === '23505') {
            console.log(`Duplicate contact detected (race condition or 9th-digit duplicate), fetching existing`);
            let raceContact: any = null;
            if (isGroup && groupJid) {
              const { data: raceData } = await supabase
                .from('contacts')
                .select('id, name, status, funnel_stage')
                .eq('organization_id', organizationId)
                .eq('group_jid', groupJid)
                .single();
              raceContact = raceData;
            } else {
              const allPhones = [phone, ...phoneAlternatives];
              const { data: raceContacts } = await supabase
                .from('contacts')
                .select('id, name, status, funnel_stage, phone')
                .eq('organization_id', organizationId)
                .in('phone', allPhones);
              raceContact = raceContacts?.find((c: any) => c.phone === phone) || raceContacts?.[0] || null;
            }
            if (raceContact) {
              contactId = raceContact.id;
              contactStatus = raceContact.status;
              contactFunnelStage = raceContact.funnel_stage;
              console.log(`Resolved race condition, using contact: ${contactId}`);
            } else {
              console.error('Race condition but contact not found');
              return new Response(
                JSON.stringify({ error: 'Failed to resolve contact' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            console.error('Failed to create contact:', insertError);
            return new Response(
              JSON.stringify({ error: 'Failed to create contact' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          contactId = newContact!.id;
          contactStatus = newContact!.status;
          contactFunnelStage = newContact!.funnel_stage;
          console.log(`Created new contact: ${contactId}, name: ${newContact!.name}`);
        
          // Fetch profile picture for new DM contacts (skip for groups)
          if (!isGroup) {
            try {
              const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
              fetch(`${SUPABASE_URL}/functions/v1/fetch-profile-picture`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  phone,
                  organization_id: organizationId,
                  contact_id: contactId,
                }),
              }).catch(err => console.error('Failed to fetch profile picture:', err));
            } catch (profilePicError) {
              console.error('Failed to trigger profile picture fetch:', profilePicError);
            }
          }
        }
      }

      // Try to find the internal message ID for the quoted message using the WhatsApp stanza ID
      let quotedMessageId: string | null = null;
      if (quotedStanzaId) {
        console.log(`Looking up quoted message with whatsapp_message_id: ${quotedStanzaId}`);
        const { data: quotedMsg } = await supabase
          .from('messages')
          .select('id, content, message_type')
          .eq('organization_id', organizationId)
          .eq('whatsapp_message_id', quotedStanzaId)
          .maybeSingle();
        
        if (quotedMsg) {
          quotedMessageId = quotedMsg.id;
          console.log(`Found quoted message ID: ${quotedMessageId}`);
          if (!quotedContent && quotedMsg.content) {
            quotedContent = quotedMsg.content;
            quotedType = quotedMsg.message_type || 'text';
            console.log(`[Quote Debug] Using DB content as fallback: "${quotedContent?.substring(0, 50)}"`);
          }
        } else {
          console.log(`Quoted message not found by stanzaId: ${quotedStanzaId} — trying content+type fallback`);
        }
      }

      // Fallback: when the outbound echo hasn't arrived yet, whatsapp_message_id is null in DB.
      // Try matching by (contact_id, content, message_type) within the last 10 minutes.
      if (!quotedMessageId && quotedContent && contactId) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: fallbackMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('contact_id', contactId)
          .eq('content', quotedContent)
          .eq('message_type', quotedType || 'text')
          .gte('created_at', tenMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallbackMsg) {
          quotedMessageId = fallbackMsg.id;
          console.log(`[Quote Fallback] Resolved quoted message by content match: ${quotedMessageId}`);
        }
      }

      // Always use server-side time (edge function clock) to avoid clock skew.
      // WhatsApp's info.Timestamp is the sender's device time, which can drift from
      // the outbound message timestamps (browser clock), causing ordering bugs in chat.
      const messageTimestamp = new Date().toISOString();
      console.log(`Using message timestamp: ${messageTimestamp} (WhatsApp original: ${info.Timestamp || 'N/A'})`);

      // Deduplicate: skip if this whatsapp_message_id was already saved
      if (whatsappMessageId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('whatsapp_message_id', whatsappMessageId)
          .limit(1)
          .maybeSingle();

        if (existingMsg) {
          console.log(`Duplicate message detected (whatsapp_message_id: ${whatsappMessageId}), skipping insert`);
          return new Response(
            JSON.stringify({ success: true, message: 'Duplicate message skipped' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Defensive dedupe for outbound echoes: if an outbound message with same content
      // (or same media_url) was inserted in the last 90s for this contact, treat as the same
      // logical message and just attach the wamid (handles cases where Meta API + Stevo coexist
      // and the message was already inserted by another path with a different wamid format).
      if (isOutbound) {
        const sinceIso = new Date(Date.now() - 90_000).toISOString();
        let dedupeQuery = supabase
          .from('messages')
          .select('id, whatsapp_message_id')
          .eq('organization_id', organizationId)
          .eq('contact_id', contactId)
          .eq('direction', 'outbound')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(1);

        if (finalMediaUrl) {
          dedupeQuery = dedupeQuery.eq('media_url', finalMediaUrl);
        } else if (content) {
          dedupeQuery = dedupeQuery.eq('content', content);
        } else {
          dedupeQuery = dedupeQuery.eq('message_type', type);
        }

        const { data: recentOutbound } = await dedupeQuery.maybeSingle();
        if (recentOutbound) {
          console.log(`[Outbound dedupe] Matched recent outbound row ${recentOutbound.id}; updating wamid instead of inserting duplicate`);
          if (whatsappMessageId && !recentOutbound.whatsapp_message_id) {
            await supabase
              .from('messages')
              .update({ whatsapp_message_id: whatsappMessageId })
              .eq('id', recentOutbound.id);
          }
          return new Response(
            JSON.stringify({ success: true, message: 'Outbound echo deduped' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Insert the message (with WhatsApp message ID and group sender info)
      const messageInsertData: any = {
        contact_id: contactId,
        organization_id: organizationId,
        content,
        message_type: type,
        media_url: finalMediaUrl || null,
        direction: isOutbound ? 'outbound' : 'inbound',
        status: isOutbound ? 'sent' : 'delivered',
        quoted_content: quotedContent || null,
        quoted_type: quotedType || null,
        quoted_message_id: quotedMessageId,
        whatsapp_message_id: whatsappMessageId || null,
        created_at: messageTimestamp,
      };
      // Add group sender info
      if (isGroup && !isOutbound) {
        messageInsertData.sender_phone = groupSenderPhone;
        messageInsertData.sender_name = groupSenderName;
      }
      const { data: insertedMsg, error: messageError } = await supabase
        .from('messages')
        .insert(messageInsertData)
        .select('id')
        .single();

      if (messageError) {
        console.error('Failed to insert message:', messageError);
        return new Response(
          JSON.stringify({ error: 'Failed to save message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Run transcription in background without blocking the webhook response
      if (!isOutbound && ['audio', 'image', 'video'].includes(type) && finalMediaUrl && insertedMsg?.id) {
        const transcribePromise = fetch(`${SUPABASE_URL}/functions/v1/transcribe-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            message_id: insertedMsg.id,
            organization_id: organizationId,
            media_url: finalMediaUrl,
            message_type: type,
          }),
        })
          .then(async (response) => {
            if (!response.ok) {
              console.error('Transcribe-media returned error:', response.status, await response.text());
              return;
            }
            console.log(`Transcribe-media triggered for message ${insertedMsg.id}`);
          })
          .catch((err) => console.error('Transcribe-media call failed:', err));

        (globalThis as any).EdgeRuntime?.waitUntil?.(transcribePromise);
      }

      // Update contact's last_message_at and increment unread only for inbound messages
      if (isOutbound) {
        // For outbound messages, just update last_message_at
        await supabase
          .from('contacts')
          .update({
            last_message_at: new Date().toISOString(),
          })
          .eq('id', contactId);
      } else {
        // For inbound messages, also increment unread count and reset SLA alert
        const { data: currentContact } = await supabase
          .from('contacts')
          .select('unread_count')
          .eq('id', contactId)
          .single();

        // Check if this is a closed contact - if so, reopen it and reset funnel_stage
        const isContactClosed = contactStatus === 'closed';

        const updateData: any = {
          last_message_at: new Date().toISOString(),
          unread_count: (currentContact?.unread_count || 0) + 1,
          sla_alert_sent: false, // Reset SLA alert when new inbound message arrives
          sdr_attempt_count: 0, // Lead respondeu — reseta ciclo de follow-up SDR
          sdr_last_triggered_at: null,
        };

        // If contact was closed, reopen it and reset funnel stage (new sales cycle)
        if (isContactClosed) {
          updateData.status = 'open';
          updateData.sale_result = null;
          updateData.closed_at = null;
          // Find first stage of contact's current pipeline instead of hardcoded 'lead'
          const { data: cp } = await supabase.from('contacts').select('pipeline_id').eq('id', contactId).single();
          if (cp?.pipeline_id) {
            const { data: fs } = await supabase.from('funnel_stages').select('slug').eq('pipeline_id', cp.pipeline_id).order('position').limit(1).single();
            if (fs) updateData.funnel_stage = fs.slug;
          }
          if (!updateData.funnel_stage) updateData.funnel_stage = 'lead';
          console.log(`Reopening closed contact ${contactId} and resetting funnel_stage to '${updateData.funnel_stage}'`);
        }

        await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', contactId);

        // Trigger automation engine for inbound messages — only if needed
        // First check: does contact have active flow OR are there active automations?
        const contactHasFlow = !!existingContact?.active_flow_id;
        let shouldTriggerAutomation = contactHasFlow;
        
        if (!shouldTriggerAutomation) {
          // Quick check: any active automations for this org?
          const { count } = await supabase
            .from('automations')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .limit(1);
          shouldTriggerAutomation = (count || 0) > 0;
        }
        
        if (shouldTriggerAutomation) {
          try {
            const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
            // MUST await to prevent Deno runtime from killing the request before it completes
            await fetch(`${SUPABASE_URL}/functions/v1/automation-engine`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                contact_id: contactId,
                organization_id: organizationId,
                message_content: content,
                message_type: type,
                event_type: 'message_received',
              }),
            }).catch(err => console.error('Automation engine call failed:', err));
          } catch (automationError) {
            console.error('Failed to trigger automation engine:', automationError);
          }
        } else {
          console.log('Skipping automation engine: no active flows or automations');
        }

        // Trigger AI agent for inbound messages (if enabled)
        // If sender is the manager, route to manager-dialogue instead
        const isManagerMessage = !isGroup && managerPhone && phone === managerPhone;
        try {
          const AI_SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
          if (isManagerMessage) {
            console.log(`Manager message detected from ${phone} — routing to manager-dialogue`);
            fetch(`${AI_SUPABASE_URL}/functions/v1/manager-dialogue`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'x-internal-service-key': SUPABASE_SERVICE_ROLE_KEY,
              },
              body: JSON.stringify({
                contact_id: contactId,
                organization_id: organizationId,
                message_content: content,
                message_id: insertedMsg.id,
              }),
            }).catch(err => console.error('manager-dialogue call failed:', err));
          } else {
            const aiFunctionUrl = `${AI_SUPABASE_URL}/functions/v1/ai-agent-respond`;
            const aiResponse = await fetch(aiFunctionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'x-internal-service-key': SUPABASE_SERVICE_ROLE_KEY,
              },
              body: JSON.stringify({
                contact_id: contactId,
                organization_id: organizationId,
                message_id: insertedMsg.id,
                message_content: content,
                message_type: type,
                media_url: finalMediaUrl || null,
              }),
            });

            const aiResponseText = await aiResponse.text();
            if (!aiResponse.ok) {
              console.error(`AI agent returned ${aiResponse.status} for contact ${contactId}:`, aiResponseText);
            } else {
              console.log(`AI agent triggered for contact ${contactId}:`, aiResponseText || 'ok');
            }
          }
        } catch (aiError) {
          console.error('Failed to trigger AI agent:', aiError);
        }
      }

      console.log(`V2 ${isOutbound ? 'outbound' : 'inbound'} message saved for contact ${contactId}`);
    } else {
      // Process Evolution API v1 format (array or single message with key structure)
      const messages: StevoMessage[] = Array.isArray(data) ? data : [data as StevoMessage];

      for (const msg of messages) {
        if (msg.key?.fromMe) {
          console.log('Skipping outbound message (v1)');
          continue;
        }

        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid) {
          console.log('Skipping v1 message with no remoteJid');
          continue;
        }

        // Detect group messages in v1 format
        const isGroupV1 = remoteJid.includes('@g.us');
        const groupJidV1 = isGroupV1 ? remoteJid : null;

        // For groups: sender is in msg.key.participant or msg.participant
        const groupSenderJidV1 = isGroupV1
          ? (msg.key?.participant || (msg as any).participant || null)
          : null;
        const groupSenderPhoneV1 = groupSenderJidV1 ? extractPhoneNumber(groupSenderJidV1) : null;
        const groupSenderNameV1 = isGroupV1 ? (msg.pushName || null) : null;

        const rawPhoneV1 = isGroupV1
          ? extractPhoneNumber(remoteJid)   // group JID number (without @g.us)
          : extractPhoneNumber(remoteJid);
        // Normalize Brazilian phone numbers (add/remove 9th digit) - same as v2
        const { normalized: phone, alternatives: phoneAlternatives } = normalizeBrazilianPhone(rawPhoneV1);
        const pushName = msg.pushName;
        // For groups, don't use pushName as contact name (it's the sender, not the group)
        const hasRealName = !isGroupV1 && pushName && pushName !== phone && pushName !== rawPhoneV1 && !/^\+?\d+$/.test(pushName);
        const contactName = hasRealName ? pushName : null;
        const { content, type, mediaUrl } = getMessageContentV1(msg.message);

        if (!content && !mediaUrl) {
          console.log('Skipping v1 message with no content');
          continue;
        }

        if (isGroupV1) {
          console.log(`Processing v1 group message in ${remoteJid} from ${groupSenderPhoneV1} (${groupSenderNameV1}): ${content}`);
        } else {
          console.log(`Processing v1 message from ${phone} (raw: ${rawPhoneV1}, name: ${contactName || 'none'}): ${content}`);
        }

        let existingContact: any = null;
        let allPhonesV1: string[] = [];

        if (isGroupV1 && groupJidV1) {
          // For groups: look up by group_jid
          const { data: groupContactsV1 } = await supabase
            .from('contacts')
            .select('id, name, status, funnel_stage, phone, is_archived, group_jid')
            .eq('organization_id', organizationId)
            .eq('group_jid', groupJidV1)
            .limit(1);
          existingContact = groupContactsV1?.[0] || null;
        } else {
          // For DMs: look up by phone
          allPhonesV1 = [phone, ...phoneAlternatives];
          const { data: existingContactsV1 } = await supabase
            .from('contacts')
            .select('id, name, status, funnel_stage, phone, is_archived')
            .eq('organization_id', organizationId)
            .in('phone', allPhonesV1);
          existingContact = existingContactsV1?.find((c: any) => c.phone === phone) || existingContactsV1?.[0] || null;
        }

        let contactId: string;
        let contactStatus: string;

        if (existingContact) {
          // If contact is archived, silently ignore the message
          if (existingContact.is_archived) {
            console.log(`Ignoring message for archived contact ${existingContact.id} (v1)`);
            continue;
          }

          // Contact exists
          contactId = existingContact.id;
          contactStatus = existingContact.status;

          if (!isGroupV1) {
            // For DMs: update name/phone if needed
            const currentNameIsPhone = existingContact.name === phone || existingContact.name === rawPhoneV1 || /^\+?\d+$/.test(existingContact.name || '');
            const shouldUpdateName = contactName && currentNameIsPhone;
            const contactUpdateDataV1: Record<string, string> = {};
            if (shouldUpdateName) {
              contactUpdateDataV1.name = contactName;
              console.log(`Updating contact name (v1) from "${existingContact.name}" to "${contactName}"`);
            }
            if (existingContact.phone !== phone) {
              contactUpdateDataV1.phone = phone;
              console.log(`Normalizing contact phone (v1) from "${existingContact.phone}" to "${phone}"`);
            }
            if (Object.keys(contactUpdateDataV1).length > 0) {
              await supabase.from('contacts').update(contactUpdateDataV1).eq('id', contactId);
            }
          }

          console.log(`Found existing contact (v1): ${contactId}, status: ${contactStatus}`);
        } else {
          // Create new contact — resolve default pipeline + first stage so it appears in the funnel
          const insertDataV1: any = {
            organization_id: organizationId,
            phone,
            name: contactName || phone,
          };

          if (isGroupV1 && groupJidV1) {
            insertDataV1.is_group = true;
            insertDataV1.group_jid = groupJidV1;
            insertDataV1.name = phone; // Group name = JID number until user renames
          }
          const { data: defaultPipelineV1 } = await supabase
            .from('kanban_pipelines')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('is_default', true)
            .maybeSingle();
          const defaultPipelineIdV1 = defaultPipelineV1?.id ?? null;
          if (defaultPipelineIdV1) {
            const { data: firstStageV1 } = await supabase
              .from('funnel_stages')
              .select('slug')
              .eq('pipeline_id', defaultPipelineIdV1)
              .order('position')
              .limit(1)
              .maybeSingle();
            insertDataV1.pipeline_id = defaultPipelineIdV1;
            insertDataV1.funnel_stage = firstStageV1?.slug ?? 'lead';
          }
          const { data: newContact, error: insertError } = await supabase
            .from('contacts')
            .insert(insertDataV1)
            .select('id, name, status, funnel_stage')
            .single();

          if (insertError) {
            // Handle race condition: another request may have created this contact
            if (insertError.code === '23505') {
              console.log(`Duplicate contact detected v1 (race condition), fetching existing`);
              let raceContact: any = null;
              if (isGroupV1 && groupJidV1) {
                const { data: raceGroups } = await supabase
                  .from('contacts')
                  .select('id, name, status, funnel_stage, group_jid')
                  .eq('organization_id', organizationId)
                  .eq('group_jid', groupJidV1)
                  .limit(1);
                raceContact = raceGroups?.[0] || null;
              } else {
                const { data: raceContacts } = await supabase
                  .from('contacts')
                  .select('id, name, status, funnel_stage, phone')
                  .eq('organization_id', organizationId)
                  .in('phone', allPhonesV1);
                raceContact = raceContacts?.find((c: any) => c.phone === phone) || raceContacts?.[0] || null;
              }
              if (raceContact) {
                contactId = raceContact.id;
                contactStatus = raceContact.status;
                console.log(`Resolved race condition v1, using contact: ${contactId}`);
              } else {
                console.error('Race condition v1 but contact not found');
                continue;
              }
            } else {
              console.error('Failed to create contact (v1):', insertError);
              continue;
            }
          } else {
            contactId = newContact!.id;
            contactStatus = newContact!.status;
            console.log(`Created new contact (v1): ${contactId}, name: ${newContact!.name}`);
          }
        }

        const msgInsertV1: any = {
          contact_id: contactId,
          organization_id: organizationId,
          content,
          message_type: type,
          media_url: mediaUrl || null,
          direction: 'inbound',
          status: 'delivered',
        };
        if (isGroupV1) {
          msgInsertV1.sender_phone = groupSenderPhoneV1;
          msgInsertV1.sender_name = groupSenderNameV1;
        }

        const { data: insertedMsgV1, error: messageError } = await supabase
          .from('messages')
          .insert(msgInsertV1)
          .select('id')
          .single();

        if (messageError) {
          console.error('Failed to insert message:', messageError);
          continue;
        }

        if (['audio', 'image', 'video'].includes(type) && mediaUrl && insertedMsgV1?.id) {
          const transcribePromise = fetch(`${SUPABASE_URL}/functions/v1/transcribe-media`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              message_id: insertedMsgV1.id,
              organization_id: organizationId,
              media_url: mediaUrl,
              message_type: type,
            }),
          })
            .then(async (response) => {
              if (!response.ok) {
                console.error('Transcribe-media returned error (v1):', response.status, await response.text());
                return;
              }
              console.log(`Transcribe-media triggered for v1 message ${insertedMsgV1.id}`);
            })
            .catch((err) => console.error('Transcribe-media call failed (v1):', err));

          (globalThis as any).EdgeRuntime?.waitUntil?.(transcribePromise);
        }

        const { data: currentContact } = await supabase
          .from('contacts')
          .select('unread_count')
          .eq('id', contactId)
          .single();

        // Check if this is a closed contact - if so, reopen it and reset funnel_stage
        const isContactClosed = contactStatus === 'closed';
        
        const updateData: any = {
          last_message_at: new Date().toISOString(),
          unread_count: (currentContact?.unread_count || 0) + 1,
          sla_alert_sent: false, // Reset SLA alert when new inbound message arrives
          sdr_attempt_count: 0, // Lead respondeu — reseta ciclo de follow-up SDR
          sdr_last_triggered_at: null,
        };

        // If contact was closed, reopen it and reset funnel stage (new sales cycle)
        if (isContactClosed) {
          updateData.status = 'open';
          updateData.sale_result = null;
          updateData.closed_at = null;
          // Find first stage of contact's current pipeline instead of hardcoded 'lead'
          const { data: cp } = await supabase.from('contacts').select('pipeline_id').eq('id', contactId).single();
          if (cp?.pipeline_id) {
            const { data: fs } = await supabase.from('funnel_stages').select('slug').eq('pipeline_id', cp.pipeline_id).order('position').limit(1).single();
            if (fs) updateData.funnel_stage = fs.slug;
          }
          if (!updateData.funnel_stage) updateData.funnel_stage = 'lead';
          console.log(`Reopening closed contact ${contactId} (v1) and resetting funnel_stage to '${updateData.funnel_stage}'`);
        }

        await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', contactId);

        // Trigger automation engine for inbound messages (V1 format)
        try {
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
          console.log(`Triggering automation engine for contact ${contactId} (v1)`);
          
          await fetch(`${SUPABASE_URL}/functions/v1/automation-engine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              contact_id: contactId,
              organization_id: organizationId,
              message_content: content,
              message_type: type,
              event_type: 'message_received',
            }),
          });
        } catch (automationError) {
          console.error('Failed to trigger automation engine (v1):', automationError);
        }

        // Trigger AI agent for inbound messages (V1 format)
        // If sender is the manager, route to manager-dialogue instead
        const phoneV1 = extractPhoneNumber(remoteJid);
        const isManagerMessageV1 = !isGroupV1 && managerPhone && phoneV1 === managerPhone;
        try {
          if (isManagerMessageV1) {
            console.log(`Manager message detected from ${phoneV1} (v1) — routing to manager-dialogue`);
            fetch(`${SUPABASE_URL}/functions/v1/manager-dialogue`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'x-internal-service-key': SUPABASE_SERVICE_ROLE_KEY,
              },
              body: JSON.stringify({
                contact_id: contactId,
                organization_id: organizationId,
                message_content: content,
                message_id: insertedMsgV1.id,
              }),
            }).catch(err => console.error('manager-dialogue call failed (v1):', err));
          } else {
            const aiFunctionUrlV1 = `${SUPABASE_URL}/functions/v1/ai-agent-respond`;
            const aiResponseV1 = await fetch(aiFunctionUrlV1, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'x-internal-service-key': SUPABASE_SERVICE_ROLE_KEY,
              },
              body: JSON.stringify({
                contact_id: contactId,
                organization_id: organizationId,
                message_id: insertedMsgV1.id,
                message_content: content,
                message_type: type,
                media_url: mediaUrl || null,
              }),
            });

            const aiResponseTextV1 = await aiResponseV1.text();
            if (!aiResponseV1.ok) {
              console.error(`AI agent returned ${aiResponseV1.status} for contact ${contactId} (v1):`, aiResponseTextV1);
            } else {
              console.log(`AI agent triggered for contact ${contactId} (v1):`, aiResponseTextV1 || 'ok');
            }
          }
        } catch (aiError) {
          console.error('Failed to trigger AI agent (v1):', aiError);
        }

        console.log(`V1 message saved for contact ${contactId}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});