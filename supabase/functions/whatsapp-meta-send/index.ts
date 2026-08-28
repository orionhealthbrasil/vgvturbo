// Meta WhatsApp Cloud API — Send (texto + mídia)
// Endpoint: POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_VERSION = 'v21.0';

interface SendPayload {
  organization_id: string;
  contact_id: string;
  phone: string;
  // texto
  message?: string;
  // mídia
  media_type?: 'image' | 'audio' | 'video' | 'document' | 'sticker';
  media_url?: string;
  file_base64?: string;
  file_name?: string;
  file_content_type?: string;
  caption?: string;
  filename?: string;
  // comuns
  client_timestamp?: string;
  quoted_message_id?: string;
  quoted_content?: string;
  quoted_type?: string;
  include_sender_name?: boolean;
}

function formatPhone(phone: string): string {
  let p = (phone || '').replace(/\D/g, '');
  if (!p.startsWith('55') && p.length <= 11) p = '55' + p;
  return p;
}

async function validateUser(req: Request, organizationId: string) {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { valid: false, error: 'Authorization header required' };

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { valid: false, error: 'Invalid token' };

  const { data: m } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (!m) return { valid: false, error: 'User not in organization' };
  return { valid: true, userId: user.id };
}

function guessMime(fileName: string, fallback: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
    ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
    amr: 'audio/amr',
    mp4: 'video/mp4', '3gp': 'video/3gpp',
    pdf: 'application/pdf',
  };
  return map[ext] || fallback || 'application/octet-stream';
}

async function uploadFile(
  supabaseAdmin: any,
  contactId: string,
  fileName: string,
  base64: string,
  contentType: string,
): Promise<{ url: string; mime: string }> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let ext = (fileName.split('.').pop() || 'bin').toLowerCase();
  // Normaliza áudio webm para extensão ogg (Meta não aceita webm)
  if (ext === 'webm') ext = 'ogg';
  const finalMime = guessMime(`x.${ext}`, contentType);
  const path = `${contactId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from('chat-media')
    .upload(path, bytes, { contentType: finalMime, upsert: false });
  if (error) throw new Error(`upload: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('chat-media').getPublicUrl(path);
  return { url: data.publicUrl, mime: finalMime };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const payload: SendPayload = await req.json();
    const {
      organization_id, contact_id, phone,
      message, media_type, media_url, file_base64, file_name, file_content_type,
      caption, filename, client_timestamp,
      quoted_message_id, quoted_content, quoted_type,
      include_sender_name,
    } = payload;

    if (!organization_id || !contact_id || !phone) {
      return new Response(JSON.stringify({ error: 'organization_id, contact_id e phone obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = await validateUser(req, organization_id);
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // instância Meta
    const { data: instance } = await admin
      .from('whatsapp_meta_instances')
      .select('phone_number_id, access_token')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!instance?.phone_number_id || !instance?.access_token) {
      return new Response(JSON.stringify({ error: 'WhatsApp oficial não configurado para esta organização.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // assinatura do remetente
    let senderName: string | null = null;
    if (include_sender_name !== false && auth.userId) {
      const { data: prof } = await admin
        .from('profiles').select('full_name').eq('user_id', auth.userId).maybeSingle();
      if (prof?.full_name) senderName = prof.full_name;
    }

    // Resolve URL pública para mídia (upload se necessário)
    let finalMediaUrl = media_url || null;
    if (media_type && !finalMediaUrl && file_base64 && file_name) {
      const uploaded = await uploadFile(
        admin, contact_id, file_name, file_base64,
        file_content_type || 'application/octet-stream',
      );
      finalMediaUrl = uploaded.url;
    }

    // Lookup wamid quando há quote
    let contextWamid: string | null = null;
    if (quoted_message_id) {
      const { data: q } = await admin
        .from('messages')
        .select('whatsapp_message_id')
        .eq('id', quoted_message_id)
        .maybeSingle();
      if (q?.whatsapp_message_id) contextWamid = q.whatsapp_message_id;
    }

    const to = formatPhone(phone);
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${instance.phone_number_id}/messages`;

    // Monta corpo
    const body: any = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
    if (contextWamid) body.context = { message_id: contextWamid };

    let internalType: string;
    let mediaUrlToSave: string | null = null;
    let contentToSave: string | null = null;

    if (media_type) {
      if (!finalMediaUrl && !file_base64) {
        return new Response(JSON.stringify({ error: 'media_url ou file_base64 requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      internalType = media_type;
      mediaUrlToSave = finalMediaUrl;
      const cap = caption
        ? (senderName ? `*${senderName}:*\n${caption}` : caption)
        : undefined;
      contentToSave = caption || filename || file_name || null;

      body.type = media_type;
      const mediaObj: any = {};

      // Para áudio: força upload via /media (Meta valida estrito) e envia por id.
      if (media_type === 'audio') {
        let bytes: Uint8Array | null = null;
        let mime = file_content_type || 'audio/ogg';
        if (file_base64) {
          const bin = atob(file_base64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else if (finalMediaUrl) {
          const r = await fetch(finalMediaUrl);
          if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
        }
        if (!bytes) {
          return new Response(JSON.stringify({ error: 'Falha ao ler bytes do áudio' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Normaliza mime para algo que a Meta aceita
        const m = mime.toLowerCase();
        if (m.includes('webm') || m.includes('opus') || m.includes('ogg')) mime = 'audio/ogg';
        else if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) mime = m.includes('aac') ? 'audio/aac' : 'audio/mp4';
        else if (m.includes('mpeg') || m.includes('mp3')) mime = 'audio/mpeg';
        else if (m.includes('amr')) mime = 'audio/amr';
        else mime = 'audio/ogg';

        const extMap: Record<string, string> = {
          'audio/mpeg': 'mp3',
          'audio/mp4': 'm4a',
          'audio/aac': 'aac',
          'audio/ogg': 'ogg',
          'audio/amr': 'amr',
        };
        const ext = extMap[mime] || mime.split('/')[1] || 'bin';
        const fd = new FormData();
        fd.append('messaging_product', 'whatsapp');
        fd.append('type', mime);
        fd.append('file', new Blob([bytes], { type: mime }), `audio.${ext}`);

        const upUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${instance.phone_number_id}/media`;
        const upRes = await fetch(upUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${instance.access_token}` },
          body: fd,
        });
        const upText = await upRes.text();
        console.log('[meta-send] upload-media ←', upRes.status, upText);
        if (!upRes.ok) {
          return new Response(JSON.stringify({
            error: 'Falha ao fazer upload do áudio na Meta',
            details: upText,
          }), { status: upRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const upJson = JSON.parse(upText);
        mediaObj.id = upJson.id;
      } else {
        if (!finalMediaUrl) {
          return new Response(JSON.stringify({ error: 'media_url requerido' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        mediaObj.link = finalMediaUrl;
      }

      if (['image', 'video', 'document'].includes(media_type) && cap) mediaObj.caption = cap;
      if (media_type === 'document' && (filename || file_name)) mediaObj.filename = filename || file_name;
      body[media_type] = mediaObj;
    } else {
      if (!message) {
        return new Response(JSON.stringify({ error: 'message ou media_type requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      internalType = 'text';
      const finalText = senderName ? `*${senderName}:*\n${message}` : message;
      contentToSave = finalText;
      body.type = 'text';
      body.text = { preview_url: false, body: finalText };
    }

    console.log('[meta-send] →', url, JSON.stringify(body));

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instance.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const respText = await resp.text();
    console.log('[meta-send] ← status', resp.status, respText);

    if (!resp.ok) {
      return new Response(JSON.stringify({
        error: 'Falha ao enviar via WhatsApp Oficial',
        details: respText,
      }), { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let metaData: any = {};
    try { metaData = JSON.parse(respText); } catch (_) { /* ignore */ }
    const wamid: string | null = metaData?.messages?.[0]?.id ?? null;

    // Always use server-side time to avoid clock skew with inbound messages
    const createdAt = new Date().toISOString();

    const { data: msgRow, error: msgErr } = await admin
      .from('messages')
      .insert({
        organization_id,
        contact_id,
        content: contentToSave,
        message_type: internalType,
        media_url: mediaUrlToSave,
        direction: 'outbound',
        status: 'sent',
        channel: 'whatsapp',
        created_at: createdAt,
        whatsapp_message_id: wamid,
        quoted_message_id: quoted_message_id || null,
        quoted_content: quoted_content || null,
        quoted_type: quoted_type || null,
        sent_by_user_id: auth.userId || null,
      })
      .select('id')
      .single();

    if (msgErr) console.error('[meta-send] save message error', msgErr);

    await admin
      .from('contacts')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', contact_id);

    return new Response(JSON.stringify({
      success: true,
      message_id: msgRow?.id,
      whatsapp_message_id: wamid,
      media_url: mediaUrlToSave,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[meta-send] error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
