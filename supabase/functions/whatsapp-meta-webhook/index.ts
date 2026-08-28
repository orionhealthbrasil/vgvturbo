// WhatsApp Cloud API webhook (Meta oficial via Stevo BSP)
// - Responde 200 OK imediatamente; processamento em background.
// - Identifica organização via tabela `whatsapp_meta_instances` (phone_number_id).
// - Persiste mensagens recebidas (messages) e enviadas pelo celular (message_echoes).
// - Atualiza delivery status (statuses).
//
// Deploy manual no Supabase externo (atnjikvdbvyvyabsxctj).
// Usa as secrets default do próprio projeto (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const DB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function getMainClient() {
  if (!DB_URL || !DB_KEY) {
    console.error(
      "[whatsapp-meta-webhook] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    return null;
  }
  return createClient(DB_URL, DB_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Normaliza telefone BR para 13 dígitos (55 + DDD + 9 + número)
function normalizePhoneBR(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, "");
  if (!p) return null;
  // se não tem 55 na frente, adiciona
  if (!p.startsWith("55")) p = "55" + p;
  // remove eventual 0 logo após 55
  if (p.length >= 4 && p.startsWith("550")) p = "55" + p.slice(3);
  // BR mobile: 55 + DDD(2) + 9 + 8 dígitos = 13
  // se vier com 12 (sem o 9) e for mobile (1º dígito 6-9), insere o 9
  if (p.length === 12) {
    const ddd = p.slice(2, 4);
    const first = p.charAt(4);
    if (["6", "7", "8", "9"].includes(first)) {
      p = "55" + ddd + "9" + p.slice(4);
    }
  }
  return p;
}

function mapMessageType(t: string): string {
  switch (t) {
    case "text":
    case "image":
    case "audio":
    case "video":
    case "document":
    case "sticker":
      return t;
    case "voice":
      return "audio";
    case "contacts":
    case "contact":
      return "contacts";
    default:
      return "text";
  }
}

function extractContent(msg: any): string {
  const t = msg?.type;
  if (t === "text") return msg.text?.body ?? "";
  if (t === "button") return msg.button?.text ?? "";
  if (t === "interactive") {
    return (
      msg.interactive?.button_reply?.title ??
      msg.interactive?.list_reply?.title ??
      ""
    );
  }
  if (t === "location") {
    const lat = msg.location?.latitude;
    const lng = msg.location?.longitude;
    return `📍 ${lat}, ${lng}`;
  }
  // mídia: usa caption se existir
  return msg?.[t]?.caption ?? "";
}

async function resolveOrganization(
  supabase: ReturnType<typeof createClient>,
  phoneNumberId: string,
  wabaId: string | null,
  displayPhone: string | null,
): Promise<{ organizationId: string; accessToken: string | null } | null> {
  const { data, error } = await supabase
    .from("whatsapp_meta_instances")
    .select("id, organization_id, display_phone_number, access_token")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (error) {
    console.error("[whatsapp-meta-webhook] org lookup error", error);
    return null;
  }
  if (!data) {
    console.warn(
      "[whatsapp-meta-webhook] phone_number_id not registered:",
      phoneNumberId,
    );
    return null;
  }

  // hidrata last_event_at e display/waba se vazios
  const updates: Record<string, unknown> = { last_event_at: new Date().toISOString() };
  if (!data.display_phone_number && displayPhone) {
    updates.display_phone_number = displayPhone;
  }
  if (wabaId) updates.waba_id = wabaId;
  await supabase
    .from("whatsapp_meta_instances")
    .update(updates)
    .eq("id", data.id);

  return {
    organizationId: data.organization_id as string,
    accessToken: (data as any).access_token ?? null,
  };
}

// Baixa mídia da Graph API e sobe pro bucket chat-media; retorna URL pública
async function downloadAndStoreMedia(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  mediaId: string,
  accessToken: string,
): Promise<{ url: string | null; mime: string | null }> {
  try {
    // 1) get media URL + mime
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!metaRes.ok) {
      console.error("[meta media] metadata error", metaRes.status, await metaRes.text());
      return { url: null, mime: null };
    }
    const meta = await metaRes.json();
    const mediaUrl: string | undefined = meta?.url;
    const mime: string | undefined = meta?.mime_type;
    if (!mediaUrl) return { url: null, mime: mime ?? null };

    // 2) download bytes (auth required)
    const binRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!binRes.ok) {
      console.error("[meta media] download error", binRes.status);
      return { url: null, mime: mime ?? null };
    }
    const buf = new Uint8Array(await binRes.arrayBuffer());

    // 3) ext
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/aac": "aac",
      "video/mp4": "mp4",
      "video/3gpp": "3gp",
      "application/pdf": "pdf",
    };
    const ext = (mime && extMap[mime.split(";")[0].trim()]) || "bin";
    const path = `${contactId}/${Date.now()}_${mediaId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, buf, {
        contentType: mime ?? "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      console.error("[meta media] upload error", upErr);
      return { url: null, mime: mime ?? null };
    }
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
    return { url: pub.publicUrl, mime: mime ?? null };
  } catch (e) {
    console.error("[meta media] exception", e);
    return { url: null, mime: null };
  }
}

async function upsertContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  phone: string,
  name: string | null,
): Promise<string | null> {
  // tenta encontrar
  const { data: existing } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    // atualiza nome se vier melhor
    if (name && (!existing.name || existing.name === phone)) {
      await supabase.from("contacts").update({ name }).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: organizationId,
      phone,
      name: name || phone,
      channel: "whatsapp",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[whatsapp-meta-webhook] contact insert error", error);
    return null;
  }
  return created.id as string;
}

async function persistMessage(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  contactId: string,
  msg: any,
  direction: "inbound" | "outbound",
  mediaUrl: string | null,
) {
  const wamid: string | undefined = msg?.id;
  if (!wamid) return;

  const { data: dup } = await supabase
    .from("messages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("whatsapp_message_id", wamid)
    .maybeSingle();
  if (dup) return;

  // Use server-side time to avoid clock skew between sender devices and outbound messages.
  // msg.timestamp is the sender's device time (Unix seconds) and can drift vs browser clock.
  const createdAt = new Date().toISOString();

  const messageType = mapMessageType(msg?.type ?? "text");
  const content = extractContent(msg);

  const { error: insErr } = await supabase.from("messages").insert({
    organization_id: organizationId,
    contact_id: contactId,
    direction,
    message_type: messageType,
    content,
    media_url: mediaUrl,
    status: direction === "outbound" ? "sent" : "delivered",
    whatsapp_message_id: wamid,
    channel: "whatsapp",
    created_at: createdAt,
  });

  if (insErr) {
    console.error("[whatsapp-meta-webhook] message insert error", insErr);
    return;
  }

  const updates: Record<string, unknown> = { last_message_at: createdAt };
  if (direction === "inbound") {
    const { data: c } = await supabase
      .from("contacts")
      .select("unread_count, status, pipeline_id")
      .eq("id", contactId)
      .single();
    if (c) {
      updates.unread_count = (c.unread_count ?? 0) + 1;
      updates.sdr_attempt_count = 0;
      updates.sdr_last_triggered_at = null;
      if (c.status === "closed") {
        updates.status = "open";
        updates.sale_result = null;
        updates.closed_at = null;
        // Find first stage of contact's current pipeline instead of hardcoded 'lead'
        if (c.pipeline_id) {
          const { data: fs } = await supabase.from("funnel_stages").select("slug").eq("pipeline_id", c.pipeline_id).order("position").limit(1).single();
          updates.funnel_stage = fs?.slug ?? "lead";
        } else {
          updates.funnel_stage = "lead";
        }
      }
    }
  }
  await supabase.from("contacts").update(updates).eq("id", contactId);
}

async function handleStatuses(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  statuses: any[],
) {
  for (const s of statuses) {
    const wamid = s?.id;
    const status = s?.status; // sent | delivered | read | failed
    if (!wamid || !status) continue;
    const allowed = ["sent", "delivered", "read", "failed"];
    if (!allowed.includes(status)) continue;
    if (status === "failed") {
      console.warn(
        "[whatsapp-meta-webhook] message failed",
        JSON.stringify({ wamid, errors: s?.errors ?? null }).slice(0, 1500),
      );
    }
    await supabase
      .from("messages")
      .update({ status })
      .eq("organization_id", organizationId)
      .eq("whatsapp_message_id", wamid);
  }
}

async function processPayload(payload: any) {
  const supabase = getMainClient();
  if (!supabase) return;

  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const wabaId: string | null = entry?.id ?? null;
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value ?? {};
      const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;
      const displayPhone: string | undefined = value?.metadata?.display_phone_number;
      if (!phoneNumberId) continue;

      const resolved = await resolveOrganization(
        supabase,
        phoneNumberId,
        wabaId,
        displayPhone ?? null,
      );
      if (!resolved) continue;
      const orgId = resolved.organizationId;
      const accessToken = resolved.accessToken;

      // contatos -> nome (primeiro elemento)
      const contactsArr = Array.isArray(value?.contacts) ? value.contacts : [];
      const profileName: string | null = contactsArr[0]?.profile?.name ?? null;

      const mediaTypes = new Set(["image", "audio", "voice", "video", "document", "sticker"]);

      async function resolveMediaUrl(msg: any, contactId: string): Promise<string | null> {
        const t = msg?.type;
        if (!mediaTypes.has(t)) return null;
        const mediaId: string | undefined = msg?.[t]?.id;
        if (!mediaId || !accessToken) return null;
        const { url } = await downloadAndStoreMedia(supabase, contactId, mediaId, accessToken);
        return url;
      }

      // mensagens recebidas
      const incoming = Array.isArray(value?.messages) ? value.messages : [];
      for (const msg of incoming) {
        const phone = normalizePhoneBR(msg?.from);
        if (!phone) continue;
        const contactId = await upsertContact(supabase, orgId, phone, profileName);
        if (!contactId) continue;
        const mediaUrl = await resolveMediaUrl(msg, contactId);
        await persistMessage(supabase, orgId, contactId, msg, "inbound", mediaUrl);
      }

      // echoes (enviadas pelo celular do dono)
      const echoes = Array.isArray(value?.message_echoes)
        ? value.message_echoes
        : [];
      for (const msg of echoes) {
        const phone = normalizePhoneBR(msg?.to);
        if (!phone) continue;
        const contactId = await upsertContact(supabase, orgId, phone, null);
        if (!contactId) continue;
        const mediaUrl = await resolveMediaUrl(msg, contactId);
        await persistMessage(supabase, orgId, contactId, msg, "outbound", mediaUrl);
      }

      // statuses
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      if (statuses.length) await handleStatuses(supabase, orgId, statuses);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await req.text();
    let payload: any = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      console.warn("[whatsapp-meta-webhook] non-JSON payload");
    }

    if (payload) {
      console.log(
        "[whatsapp-meta-webhook] event received",
        JSON.stringify(payload).slice(0, 2000),
      );
      // @ts-ignore EdgeRuntime is provided by Supabase
      EdgeRuntime.waitUntil(
        processPayload(payload).catch((e) =>
          console.error("[whatsapp-meta-webhook] processing error", e),
        ),
      );
    }
  } catch (err) {
    console.error("[whatsapp-meta-webhook] error reading request", err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
