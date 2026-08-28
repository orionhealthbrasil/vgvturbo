import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getAdminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Converte erros da OpenAI em mensagens amigáveis em PT-BR para o usuário final.
function friendlyOpenAiError(status: number, rawBody: string): string {
  let code = "";
  let message = "";
  try {
    const parsed = JSON.parse(rawBody);
    code = parsed?.error?.code || parsed?.error?.type || "";
    message = parsed?.error?.message || "";
  } catch { /* keep raw */ }

  if (code === "insufficient_quota" || /insufficient_quota/i.test(rawBody)) {
    return "⚠️ A chave da OpenAI configurada está sem créditos. Peça ao administrador para adicionar saldo em https://platform.openai.com/account/billing ou trocar a chave em Squad AI → Chave da OpenAI.";
  }
  if (status === 401 || code === "invalid_api_key" || /invalid.*api.*key/i.test(rawBody)) {
    return "⚠️ A chave da OpenAI configurada é inválida ou foi revogada. Atualize-a em Squad AI → Chave da OpenAI.";
  }
  if (code === "model_not_found" || status === 404) {
    return "⚠️ O modelo selecionado para este agente não está disponível para esta chave da OpenAI. Escolha outro modelo nas configurações do agente.";
  }
  if (status === 429 || code === "rate_limit_exceeded") {
    return "⚠️ Limite de requisições da OpenAI atingido temporariamente. Tente novamente em alguns instantes.";
  }
  if (status >= 500) {
    return "⚠️ A OpenAI está temporariamente indisponível. Tente novamente em alguns instantes.";
  }
  return `⚠️ Erro ao consultar a IA: ${message || `status ${status}`}.`;
}

// Normaliza valores de `direction` (banco usa 'inbound'/'outbound', código legado usava 'in'/'out').
const isInbound = (d?: string | null) => d === "inbound" || d === "in";
const isOutbound = (d?: string | null) => d === "outbound" || d === "out";

function normalizeOpenAiKey(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function resolveOpenAiKey(supabase: any, organizationId: string) {
  const [orgRes, legacyRes] = await Promise.all([
    supabase.from("organizations").select("openai_api_key").eq("id", organizationId).single(),
    supabase.from("ai_agent_config").select("openai_api_key").eq("organization_id", organizationId).limit(1).maybeSingle(),
  ]);

  if (orgRes.error) throw orgRes.error;
  if (legacyRes.error) throw legacyRes.error;

  const orgKey = normalizeOpenAiKey(orgRes.data?.openai_api_key);
  if (orgKey) return { openaiApiKey: orgKey, keySource: "organizations" as const };

  const legacyKey = normalizeOpenAiKey(legacyRes.data?.openai_api_key);
  if (legacyKey) return { openaiApiKey: legacyKey, keySource: "ai_agent_config" as const };

  return { openaiApiKey: null, keySource: null };
}

// ===== TOOL IMPLEMENTATIONS (copied from mcp-server) =====

async function searchContacts(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const query = params.query as string || "";
  const limit = Math.min((params.limit as number) || 20, 100);
  let q = supabase.from("contacts").select("id, name, phone, email, status, funnel_stage, assigned_to, last_message_at, unread_count").eq("organization_id", orgId).limit(limit);
  if (query) q = q.or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
  if (params.status) q = q.eq("status", params.status);
  if (params.funnel_stage) q = q.eq("funnel_stage", params.funnel_stage);
  const { data, error } = await q.order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

async function getContact(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  if (!contactId) throw new Error("contact_id is required");
  const [contactRes, tagsRes, fieldsRes] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contactId).eq("organization_id", orgId).single(),
    supabase.from("contact_tags").select("tag_id, tags(id, name, color)").eq("contact_id", contactId),
    supabase.from("contact_custom_fields").select("field_name, field_value").eq("contact_id", contactId).eq("organization_id", orgId),
  ]);
  if (contactRes.error) throw new Error(contactRes.error.message);
  return { ...contactRes.data, tags: (tagsRes.data || []).map((ct: any) => ct.tags).filter(Boolean), custom_fields: fieldsRes.data || [] };
}

async function createContact(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  if (!params.name || !params.phone) throw new Error("name and phone are required");
  const { data, error } = await supabase.from("contacts").insert({ name: params.name, phone: params.phone, email: (params.email as string) || null, organization_id: orgId, notes: (params.notes as string) || null }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateContact(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  if (!contactId) throw new Error("contact_id is required");
  const updates: Record<string, unknown> = {};
  for (const k of ["name", "phone", "email", "notes", "status", "funnel_stage", "assigned_to"]) {
    if (params[k] !== undefined) updates[k] = params[k];
  }
  const { data, error } = await supabase.from("contacts").update(updates).eq("id", contactId).eq("organization_id", orgId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Formata UMA mensagem do banco numa linha única e narrativa pronta pra LLM.
 * Fonte única de verdade: campo `text`. Elimina ambiguidade de múltiplos campos
 * (content vs transcription vs media_url) que confundem o modelo.
 *
 * Convenções do `text`:
 *   - texto puro            → "<conteúdo>"
 *   - mídia COM transcrição → "[IMAGEM] <descrição>" (+ " | Legenda: <caption>" se houver)
 *   - mídia SEM transcrição → "[IMAGEM SEM DESCRIÇÃO DISPONÍVEL — não invente o conteúdo]"
 */
function formatMessageForLLM(msg: Record<string, unknown>): {
  id: string;
  at: string;
  from: "contact" | "agent" | "system";
  text: string;
} {
  const type = (msg.message_type as string) || "text";
  const direction = (msg.direction as string) || "inbound";
  const transcription = (msg.transcription as string | null) || null;
  const content = (msg.content as string | null) || null;
  const mediaUrl = (msg.media_url as string | null) || null;

  // Origem narrativa: 'contact' = humano que escreveu, 'agent' = vendedor/IA da org
  const from: "contact" | "agent" | "system" =
    isInbound(direction) ? "contact" : "agent";

  let text: string;
  if (type === "text") {
    text = content || "[mensagem vazia]";
  } else {
    const typeLabel: Record<string, string> = {
      audio: "ÁUDIO",
      image: "IMAGEM",
      video: "VÍDEO",
      document: "DOCUMENTO",
      sticker: "STICKER",
    };
    const label = typeLabel[type] || type.toUpperCase();

    if (isOutbound(direction) && mediaUrl) {
      // Mídia enviada pelo atendente — outbound NÃO recebe transcrição por design.
      // Mostrar caption se houver, senão marcar como mídia da equipe sem descrição.
      text = content && content.length > 0
        ? `[${label} ENVIADA PELO ATENDENTE] Legenda: ${content}`
        : `[${label} ENVIADA PELO ATENDENTE — sem legenda]`;
    } else if (transcription && transcription.length > 0) {
      const caption = content && content.length > 0 ? ` | Legenda: ${content}` : "";
      text = `[${label}] ${transcription}${caption}`;
    } else if (mediaUrl) {
      // Inbound do cliente sem transcrição (backfill falhou, grupo silenciado, etc.)
      text = `[${label} DO CLIENTE — descrição indisponível, não invente o conteúdo, diga ao usuário que não consegue acessar este arquivo específico]`;
    } else {
      text = content || `[${label} sem conteúdo]`;
    }
  }

  return {
    id: msg.id as string,
    at: msg.created_at as string,
    from,
    text,
  };
}

async function getConversation(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  if (!contactId) throw new Error("contact_id is required");
  const limit = Math.min((params.limit as number) || 50, 200);
  const { data, error } = await supabase.from("messages").select("id, content, message_type, media_url, direction, status, created_at, sent_by_user_id, transcription").eq("contact_id", contactId).eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).reverse().map(formatMessageForLLM);
}

async function sendMessage(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  const content = params.content as string;
  if (!contactId || !content) throw new Error("contact_id and content are required");
  const { data: contact } = await supabase.from("contacts").select("phone").eq("id", contactId).eq("organization_id", orgId).single();
  if (!contact) throw new Error("Contact not found");
  const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("organization_id", orgId).single();
  if (!instance) throw new Error("WhatsApp not connected");
  const phone = contact.phone.replace(/\D/g, "");
  const response = await fetch(`${instance.base_url}/message/text`, { method: "POST", headers: { "Content-Type": "application/json", apikey: instance.api_key }, body: JSON.stringify({ number: phone, text: content }) });
  if (!response.ok) throw new Error(`Failed to send: ${await response.text()}`);
  const result = await response.json();
  const { data: msg, error } = await supabase.from("messages").insert({ contact_id: contactId, organization_id: orgId, content, direction: "outbound", message_type: "text", status: "sent", whatsapp_message_id: result?.key?.id || null }).select().single();
  if (error) throw new Error(error.message);
  await supabase.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contactId);
  return { message_id: msg.id, status: "sent" };
}

async function listTags(orgId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("tags").select("id, name, color").eq("organization_id", orgId).order("name");
  if (error) throw new Error(error.message);
  return data;
}

async function addTag(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  if (!params.contact_id || !params.tag_id) throw new Error("contact_id and tag_id are required");
  const { data: contact } = await supabase.from("contacts").select("id").eq("id", params.contact_id).eq("organization_id", orgId).single();
  if (!contact) throw new Error("Contact not found");
  const { error } = await supabase.from("contact_tags").insert({ contact_id: params.contact_id, tag_id: params.tag_id });
  if (error) throw new Error(error.message);
  return { success: true };
}

async function removeTag(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  if (!params.contact_id || !params.tag_id) throw new Error("contact_id and tag_id are required");
  const { error } = await supabase.from("contact_tags").delete().eq("contact_id", params.contact_id).eq("tag_id", params.tag_id);
  if (error) throw new Error(error.message);
  return { success: true };
}

async function moveFunnelStage(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  if (!params.contact_id || !params.funnel_stage) throw new Error("contact_id and funnel_stage are required");
  // Get contact's current pipeline
  const { data: contact } = await supabase.from("contacts").select("pipeline_id").eq("id", params.contact_id).eq("organization_id", orgId).single();
  const contactPipelineId = contact?.pipeline_id ?? null;
  // Find stage in contact's pipeline first, fallback to any pipeline
  let stageQuery = supabase.from("funnel_stages").select("slug, pipeline_id").eq("organization_id", orgId).eq("slug", params.funnel_stage);
  if (contactPipelineId) stageQuery = stageQuery.eq("pipeline_id", contactPipelineId);
  const { data: stage } = await stageQuery.maybeSingle();
  if (!stage) throw new Error(`Funnel stage "${params.funnel_stage}" not found`);
  const { data, error } = await supabase.from("contacts").update({ funnel_stage: stage.slug, pipeline_id: stage.pipeline_id }).eq("id", params.contact_id).eq("organization_id", orgId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function assignContact(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  if (!params.contact_id) throw new Error("contact_id is required");
  const { data, error } = await supabase.from("contacts").update({ assigned_to: (params.user_id as string) || null }).eq("id", params.contact_id).eq("organization_id", orgId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function listMembers(orgId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("organization_members").select("user_id, role, member_role, profiles(full_name, email)").eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return data;
}

async function getFunnelStages(orgId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("funnel_stages").select("id, name, slug, color, position, is_final").eq("organization_id", orgId).order("position");
  if (error) throw new Error(error.message);
  return data;
}

async function getDailyStats(orgId: string) {
  const supabase = getAdminClient();
  // "Hoje" deve ser sempre calculado em horário de Brasília (America/Sao_Paulo, UTC-3),
  // não em UTC. Caso contrário, entre 21h e 23:59 BRT a função entra no "amanhã" UTC
  // e retorna 0 mensagens / 0 fechamentos do dia.
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3
  const nowUtcMs = Date.now();
  const brtNow = new Date(nowUtcMs - BRT_OFFSET_MS);
  // Início do dia em BRT (00:00 BRT) expresso em UTC
  const startOfDayBrtAsUtcMs =
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()) +
    BRT_OFFSET_MS;
  const startOfDay = new Date(startOfDayBrtAsUtcMs).toISOString();
  const endOfDay = new Date(startOfDayBrtAsUtcMs + 24 * 60 * 60 * 1000).toISOString();

  const [contacts, messages, closedToday] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", startOfDay).lt("created_at", endOfDay),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "closed").gte("closed_at", startOfDay).lt("closed_at", endOfDay),
  ]);
  return {
    total_contacts: contacts.count || 0,
    messages_today: messages.count || 0,
    closed_today: closedToday.count || 0,
    window: { from: startOfDay, to: endOfDay, timezone: "America/Sao_Paulo" },
  };
}

async function getContactActivityStats(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = typeof params.contact_id === "string" && params.contact_id.trim().length > 0
    ? params.contact_id.trim()
    : null;
  const query = typeof params.query === "string" ? params.query.trim() : "";

  if (!contactId && !query) {
    throw new Error("contact_id or query is required");
  }

  const dateFrom = params.date_from ? spDateToUtcIso(String(params.date_from), false) : null;
  const dateTo = params.date_to ? spDateToUtcIso(String(params.date_to), true) : null;
  if (params.date_from && !dateFrom) throw new Error("date_from must be YYYY-MM-DD");
  if (params.date_to && !dateTo) throw new Error("date_to must be YYYY-MM-DD");

  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nowUtcMs = Date.now();
  const brtNow = new Date(nowUtcMs - BRT_OFFSET_MS);
  const startOfDayBrtAsUtcMs =
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()) +
    BRT_OFFSET_MS;
  const startOfDay = new Date(startOfDayBrtAsUtcMs).toISOString();
  const endOfDay = new Date(startOfDayBrtAsUtcMs + 24 * 60 * 60 * 1000).toISOString();
  const windowFrom = dateFrom || startOfDay;
  const windowTo = dateTo || endOfDay;

  let contactQuery = supabase
    .from("contacts")
    .select("id, name, phone, status, last_message_at")
    .eq("organization_id", orgId)
    .limit(contactId ? 1 : 10);

  if (contactId) {
    contactQuery = contactQuery.eq("id", contactId);
  } else {
    contactQuery = contactQuery.or(`name.ilike.%${query}%,phone.ilike.%${query}%`).order("last_message_at", { ascending: false });
  }

  const { data: contacts, error: contactsError } = await contactQuery;
  if (contactsError) throw new Error(contactsError.message);

  const matches = contacts || [];
  if (matches.length === 0) {
    return {
      matches: [],
      total_matches: 0,
      ambiguous: false,
      window: { from: windowFrom, to: windowTo, timezone: "America/Sao_Paulo" },
    };
  }

  const contactIds = matches.map((contact) => contact.id);
  const { data: messageRows, error: messagesError } = await supabase
    .from("messages")
    .select("contact_id, direction, created_at")
    .eq("organization_id", orgId)
    .in("contact_id", contactIds)
    .gte("created_at", windowFrom)
    .lt("created_at", windowTo);

  if (messagesError) throw new Error(messagesError.message);

  const statsByContact = new Map<string, {
    messages_today: number;
    inbound_today: number;
    outbound_today: number;
    first_message_at_today: string | null;
    last_message_at_today: string | null;
  }>();

  for (const row of messageRows || []) {
    const current = statsByContact.get(row.contact_id) || {
      messages_today: 0,
      inbound_today: 0,
      outbound_today: 0,
      first_message_at_today: null,
      last_message_at_today: null,
    };

    current.messages_today += 1;
    if (isInbound(row.direction)) current.inbound_today += 1;
    if (isOutbound(row.direction)) current.outbound_today += 1;
    if (!current.first_message_at_today || row.created_at < current.first_message_at_today) {
      current.first_message_at_today = row.created_at;
    }
    if (!current.last_message_at_today || row.created_at > current.last_message_at_today) {
      current.last_message_at_today = row.created_at;
    }

    statsByContact.set(row.contact_id, current);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const enrichedMatches = matches.map((contact) => {
    const stats = statsByContact.get(contact.id) || {
      messages_today: 0,
      inbound_today: 0,
      outbound_today: 0,
      first_message_at_today: null,
      last_message_at_today: null,
    };

    return {
      contact_id: contact.id,
      name: contact.name,
      phone: contact.phone,
      status: contact.status,
      last_message_at: contact.last_message_at,
      exact_match: normalizedQuery.length > 0 ? contact.name.trim().toLowerCase() === normalizedQuery : false,
      conversations_today: stats.messages_today > 0 ? 1 : 0,
      had_activity_today: stats.messages_today > 0,
      messages_today: stats.messages_today,
      inbound_today: stats.inbound_today,
      outbound_today: stats.outbound_today,
      first_message_at_today: stats.first_message_at_today,
      last_message_at_today: stats.last_message_at_today,
    };
  });

  return {
    matches: enrichedMatches,
    total_matches: enrichedMatches.length,
    ambiguous: !contactId && enrichedMatches.length > 1,
    window: { from: windowFrom, to: windowTo, timezone: "America/Sao_Paulo" },
  };
}

async function scheduleMessage(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  if (!params.contact_id || !params.content || !params.scheduled_at) throw new Error("contact_id, content and scheduled_at are required");
  const schedDate = new Date(params.scheduled_at as string);
  if (isNaN(schedDate.getTime())) throw new Error("scheduled_at must be a valid ISO 8601 date");
  if (schedDate <= new Date()) throw new Error("scheduled_at must be in the future");
  const { data: contact } = await supabase.from("contacts").select("id").eq("id", params.contact_id).eq("organization_id", orgId).single();
  if (!contact) throw new Error("Contact not found");
  const { data, error } = await supabase.from("scheduled_messages").insert({ contact_id: params.contact_id, organization_id: orgId, message_content: params.content, scheduled_at: params.scheduled_at, scheduled_by: "00000000-0000-0000-0000-000000000000" }).select().single();
  if (error) throw new Error(error.message);
  return { id: data.id, scheduled_at: data.scheduled_at, status: data.status };
}

// (removido: getTodayConversations — substituído por get_conversation_messages com date_from)


// ===== CONVERSATION ANALYSES TOOLS =====

function parseAnalysisDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY
  const parts = str.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

async function createAnalysis(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  if (!params.customer_name) throw new Error("customer_name is required");
  const record: Record<string, unknown> = {
    organization_id: orgId,
    customer_name: params.customer_name as string,
    phone: (params.phone as string) || null,
    lead_source: (params.lead_source as string) || null,
    sale_status: (params.sale_status as string) || null,
    product_line: (params.product_line as string) || null,
    part_searched: (params.part_searched as string) || null,
    quantity: params.quantity != null ? Number(params.quantity) : null,
    sale_value: params.sale_value != null ? Number(params.sale_value) : null,
    contact_id: (params.contact_id as string) || null,
    created_by: "ai-system-agent",
  };
  const parsedDate = parseAnalysisDate(params.analysis_date);
  if (parsedDate) record.analysis_date = parsedDate;
  const { data, error } = await supabase.from("conversation_analyses").insert(record).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function listAnalyses(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const limit = Math.min((params.limit as number) || 50, 200);
  let q = supabase.from("conversation_analyses").select("*").eq("organization_id", orgId).limit(limit);
  const dateFrom = parseAnalysisDate(params.date_from);
  const dateTo = parseAnalysisDate(params.date_to);
  if (dateFrom) q = q.gte("analysis_date", dateFrom);
  if (dateTo) q = q.lte("analysis_date", dateTo);
  if (params.customer_name) q = q.ilike("customer_name", `%${params.customer_name}%`);
  if (params.phone) q = q.ilike("phone", `%${params.phone}%`);
  if (params.sale_status) q = q.eq("sale_status", params.sale_status);
  const { data, error } = await q.order("analysis_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

async function getAnalysis(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const id = params.analysis_id as string;
  if (!id) throw new Error("analysis_id is required");
  const { data, error } = await supabase.from("conversation_analyses").select("*").eq("id", id).eq("organization_id", orgId).single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateAnalysis(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const id = params.analysis_id as string;
  if (!id) throw new Error("analysis_id is required");
  const updates: Record<string, unknown> = {};
  for (const k of ["customer_name", "phone", "lead_source", "sale_status", "product_line", "part_searched", "contact_id"]) {
    if (params[k] !== undefined) updates[k] = params[k];
  }
  if (params.quantity !== undefined) updates.quantity = params.quantity != null ? Number(params.quantity) : null;
  if (params.sale_value !== undefined) updates.sale_value = params.sale_value != null ? Number(params.sale_value) : null;
  const parsedDate = parseAnalysisDate(params.analysis_date);
  if (parsedDate) updates.analysis_date = parsedDate;
  const { data, error } = await supabase.from("conversation_analyses").update(updates).eq("id", id).eq("organization_id", orgId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteAnalysis(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const id = params.analysis_id as string;
  if (!id) throw new Error("analysis_id is required");
  const { error } = await supabase.from("conversation_analyses").delete().eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return { success: true, deleted_id: id };
}

// Converte YYYY-MM-DD (interpretado em America/Sao_Paulo) em ISO UTC.
// `endOfDay=true` retorna o instante 23:59:59.999 daquele dia em SP.
function spDateToUtcIso(dateStr: string, endOfDay = false): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  // SP é UTC-3 (sem DST desde 2019). Construímos a data como se fosse UTC e
  // somamos 3h para obter o instante real em UTC.
  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  const utcEquivalent = new Date(`${dateStr}T${time}Z`);
  if (isNaN(utcEquivalent.getTime())) return null;
  return new Date(utcEquivalent.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

// Dispara transcrição on-demand para mídias que ainda não foram processadas.
// Síncrono mas com timeout curto pra não travar o agente. Atualiza msgs in-place.
async function backfillMissingTranscriptions(
  orgId: string,
  msgs: Array<Record<string, unknown>>,
  log: (stage: string, data?: Record<string, unknown>) => void,
  contact?: { is_archived?: boolean | null; phone?: string | null } | null
): Promise<void> {
  // Grupos silenciados / contatos arquivados não recebem transcrição por design.
  const isGroup = !!contact?.phone?.endsWith("@g.us");
  const isArchived = !!contact?.is_archived;
  if (isGroup || isArchived) {
    log("transcribe_backfill_skipped_context", {
      reason: isGroup ? "group_chat" : "archived_contact",
      phone: contact?.phone || null,
    });
    return;
  }

  const candidates = msgs.filter((m) => {
    const t = m.message_type as string;
    if (!["audio", "image", "video"].includes(t)) return false;
    if (!m.media_url) return false;
    // Outbound NÃO recebe transcrição por design — atendente enviou.
    if (!isInbound(m.direction as string)) return false;
    const trans = m.transcription;
    return !trans || (typeof trans === "string" && trans.length === 0);
  });
  if (candidates.length === 0) return;

  // Limita a no máx 20 transcrições síncronas por chamada (custo/latência).
  // PRIORIZA mídias mais ANTIGAS sem transcrição (provas/comprovantes recebidos no início
  // da conversa). Mídias além desse limite ficam sem transcrição neste turno — agente saberá pelo log.
  const MAX_SYNC = 20;
  const PER_CALL_TIMEOUT_MS = 25000; // gemini-flash + whisper costumam < 10s; 25s é folga
  // Reordena: mais antigas primeiro (created_at asc), pra não perder o início do histórico.
  const sortedCandidates = [...candidates].sort((a, b) => {
    const ta = new Date((a.created_at as string) || 0).getTime();
    const tb = new Date((b.created_at as string) || 0).getTime();
    return ta - tb;
  });
  const toProcess = sortedCandidates.slice(0, MAX_SYNC);
  const skipped = sortedCandidates.length - toProcess.length;

  log("transcribe_backfill_start", {
    candidates: candidates.length,
    will_process: toProcess.length,
    skipped_over_limit: skipped,
  });

  const supabase = getAdminClient();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  await Promise.all(toProcess.map(async (m) => {
    const msgId = m.id as string;
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
      const r = await fetch(`${supabaseUrl}/functions/v1/transcribe-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          message_id: msgId,
          organization_id: orgId,
          media_url: m.media_url,
          message_type: m.message_type,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!r.ok) {
        log("transcribe_backfill_http_error", { msg_id: msgId, status: r.status });
        return;
      }
      const j = await r.json().catch(() => ({}));
      // Releitura do banco — transcribe-media já salvou se conseguiu
      const { data: fresh } = await supabase
        .from("messages")
        .select("transcription")
        .eq("id", msgId)
        .single();
      if (fresh?.transcription) {
        m.transcription = fresh.transcription;
      }
      log("transcribe_backfill_done", {
        msg_id: msgId,
        type: m.message_type,
        duration_ms: Date.now() - start,
        provider: j?.provider || null,
        chars: fresh?.transcription?.length || 0,
        skipped: !!j?.skipped,
        reason: j?.reason || null,
      });
    } catch (e) {
      log("transcribe_backfill_throw", {
        msg_id: msgId,
        error: (e as Error).message,
        duration_ms: Date.now() - start,
      });
    }
  }));
}

async function getConversationMessages(
  orgId: string,
  params: Record<string, unknown>,
  log?: (stage: string, data?: Record<string, unknown>) => void
) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  if (!contactId) throw new Error("contact_id is required");

  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 500);
  const order = (params.order as string) === "asc" ? "asc" : "desc";
  const messageType = params.message_type as string | undefined;
  const dateFrom = params.date_from ? spDateToUtcIso(String(params.date_from), false) : null;
  const dateTo = params.date_to ? spDateToUtcIso(String(params.date_to), true) : null;

  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .select("id, name, phone, is_archived")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .single();
  if (contactErr || !contact) throw new Error("Contact not found");

  let q = supabase
    .from("messages")
    .select("id, content, message_type, media_url, direction, created_at, sent_by_user_id, transcription")
    .eq("contact_id", contactId)
    .eq("organization_id", orgId);

  if (dateFrom) q = q.gte("created_at", dateFrom);
  if (dateTo) q = q.lte("created_at", dateTo);
  if (messageType) q = q.eq("message_type", messageType);

  // Buscamos sempre em DESC para pegar as N mais recentes; invertemos depois se pediu ASC.
  const { data: msgs, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);

  const safeLog = log || (() => {});
  const fetched = (msgs || []) as Array<Record<string, unknown>>;

  // Backfill síncrono: garante que transcrições/descrições cheguem ao agente.
  // Pula automaticamente grupos (@g.us) e contatos arquivados.
  await backfillMissingTranscriptions(orgId, fetched, safeLog, contact);

  // Observabilidade: por mensagem de mídia, registra se a transcrição existe APÓS backfill.
  const mediaStats = fetched
    .filter((m) => ["audio", "image", "video"].includes(m.message_type as string))
    .map((m) => ({
      msg_id: m.id,
      type: m.message_type,
      direction: m.direction,
      has_transcription: !!(m.transcription && (m.transcription as string).length > 0),
      chars: (m.transcription as string | null)?.length || 0,
    }));
  safeLog("get_conversation_messages_media_audit", {
    contact_id: contactId,
    total_msgs: fetched.length,
    media_count: mediaStats.length,
    with_transcription: mediaStats.filter((s) => s.has_transcription).length,
    without_transcription: mediaStats.filter((s) => !s.has_transcription).length,
    sample: mediaStats.slice(0, 5),
  });

  // Auditoria estruturada de direção (cura do bug 'in'/'out' vs 'inbound'/'outbound').
  // Confirma no log que isInbound() está casando com os valores reais do banco.
  const inboundCount = fetched.filter((m) => isInbound(m.direction as string)).length;
  const outboundCount = fetched.filter((m) => isOutbound(m.direction as string)).length;
  safeLog("get_conversation_messages_audit", {
    contact_id: contactId,
    contact_phone: contact.phone,
    contact_archived: !!contact.is_archived,
    is_group: !!contact.phone?.endsWith("@g.us"),
    total: fetched.length,
    inbound: inboundCount,
    outbound: outboundCount,
    unmatched_direction: fetched.length - inboundCount - outboundCount,
    media_total: mediaStats.length,
    media_with_transcription: mediaStats.filter((s) => s.has_transcription).length,
    direction_samples: fetched.slice(0, 3).map((m) => m.direction),
  });

  let enriched = fetched.map(formatMessageForLLM);
  if (order === "asc") enriched = enriched.reverse();

  // ============================================================
  // MEDIA HIGHLIGHTS — bloco destacado para a LLM não perder mídia
  // no meio do array de 50 mensagens. Lista TODA mídia inbound do
  // cliente que tem transcrição, em formato bullet, citando a
  // transcrição literal. Esse é o "atalho" que a LLM lê primeiro.
  // ============================================================
  const mediaHighlights: Array<{
    msg_id: string;
    at: string;
    type: string;
    direction: "from_customer" | "from_agent";
    transcribed_content: string;
  }> = [];

  for (const m of fetched) {
    const type = (m.message_type as string) || "text";
    if (!["audio", "image", "video"].includes(type)) continue;
    const trans = (m.transcription as string | null) || null;
    if (!trans || trans.length === 0) continue;
    // Só destaca inbound (mídia DO CLIENTE) — outbound já tem caption no text
    if (!isInbound(m.direction as string)) continue;
    mediaHighlights.push({
      msg_id: m.id as string,
      at: m.created_at as string,
      type,
      direction: "from_customer",
      transcribed_content: trans,
    });
  }

  // Conta mídias inbound SEM transcrição (pra LLM saber que existem mas não tem texto)
  const mediaInboundMissing = fetched.filter(
    (m) =>
      ["audio", "image", "video"].includes(m.message_type as string) &&
      isInbound(m.direction as string) &&
      (!m.transcription || (m.transcription as string).length === 0)
  ).length;

  safeLog("media_highlights_built", {
    contact_id: contactId,
    highlights_count: mediaHighlights.length,
    inbound_media_missing_transcription: mediaInboundMissing,
  });

  return {
    contact_name: contact.name,
    contact_phone: contact.phone,
    // ⚠️ LEIA ISTO PRIMEIRO: descrições/transcrições literais de TODAS
    // as mídias que o cliente enviou. Essa é a fonte de verdade pra
    // qualquer pergunta sobre imagens, áudios ou vídeos do cliente.
    // Se vazio, o cliente não enviou mídias OU as transcrições falharam.
    media_highlights: mediaHighlights,
    media_highlights_summary: {
      total_inbound_media_with_transcription: mediaHighlights.length,
      total_inbound_media_without_transcription: mediaInboundMissing,
      instruction:
        mediaHighlights.length > 0
          ? "Use o conteúdo de transcribed_content LITERALMENTE como se você tivesse visto/ouvido a mídia. NÃO diga que não consegue ver imagens ou ouvir áudios — você TEM o conteúdo aqui."
          : mediaInboundMissing > 0
          ? "Existem mídias do cliente, mas a transcrição não foi gerada. Avise o usuário e NÃO invente conteúdo."
          : "O cliente não enviou mídias nesta janela.",
    },
    messages: enriched,
    total: enriched.length,
    filters: { limit, order, date_from: params.date_from || null, date_to: params.date_to || null, message_type: messageType || null },
  };
}

// Tool dispatcher
async function executeTool(
  orgId: string,
  toolName: string,
  args: Record<string, unknown>,
  log?: (stage: string, data?: Record<string, unknown>) => void
) {
  switch (toolName) {
    case "search_contacts": return await searchContacts(orgId, args);
    case "get_contact": return await getContact(orgId, args);
    case "get_contact_activity_stats": return await getContactActivityStats(orgId, args);
    case "create_contact": return await createContact(orgId, args);
    case "update_contact": return await updateContact(orgId, args);
    case "get_conversation": return await getConversationMessages(orgId, args, log); // legacy alias → roteia pra versão com backfill
    case "send_message": return await sendMessage(orgId, args);
    case "list_tags": return await listTags(orgId);
    case "add_tag": return await addTag(orgId, args);
    case "remove_tag": return await removeTag(orgId, args);
    case "move_funnel_stage": return await moveFunnelStage(orgId, args);
    case "assign_contact": return await assignContact(orgId, args);
    case "list_members": return await listMembers(orgId);
    case "get_funnel_stages": return await getFunnelStages(orgId);
    case "get_daily_stats": return await getDailyStats(orgId);
    case "schedule_message": return await scheduleMessage(orgId, args);
    case "get_conversation_messages": return await getConversationMessages(orgId, args, log);
    case "create_analysis": return await createAnalysis(orgId, args);
    case "list_analyses": return await listAnalyses(orgId, args);
    case "get_analysis": return await getAnalysis(orgId, args);
    case "update_analysis": return await updateAnalysis(orgId, args);
    case "delete_analysis": return await deleteAnalysis(orgId, args);
    default: throw new Error(`Unknown tool: ${toolName}`);
  }
}

// OpenAI tool definitions
const OPENAI_TOOLS = [
  { type: "function", function: { name: "search_contacts", description: "Buscar contatos por nome, telefone ou email. Filtrar por status ou etapa do funil.", parameters: { type: "object", properties: { query: { type: "string", description: "Termo de busca" }, status: { type: "string", enum: ["open", "closed"] }, funnel_stage: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_contact", description: "Ver detalhes completos de um contato incluindo tags e campos customizados.", parameters: { type: "object", properties: { contact_id: { type: "string" } }, required: ["contact_id"] } } },
  { type: "function", function: { name: "get_contact_activity_stats", description: "Consultar atividade de conversa de um contato específico ou de contatos encontrados por nome/telefone. Use para perguntas como 'quantas conversas a Casseb teve hoje?', 'houve mensagens com cliente X hoje?' e 'quantas mensagens esse contato trocou hoje?'. Se passar `query`, a tool retorna os contatos encontrados com a contagem individual; se vier mais de um match, NÃO some tudo automaticamente — peça desambiguação ao usuário. Prefira esta tool quando a pergunta citar nome de contato, empresa ou telefone.", parameters: { type: "object", properties: { contact_id: { type: "string", description: "UUID exato do contato" }, query: { type: "string", description: "Nome, empresa ou telefone para localizar o contato quando o UUID não for conhecido" }, date_from: { type: "string", description: "Data inicial YYYY-MM-DD (padrão: hoje em America/Sao_Paulo)" }, date_to: { type: "string", description: "Data final YYYY-MM-DD (padrão: fim de hoje em America/Sao_Paulo)" } } } } },
  { type: "function", function: { name: "create_contact", description: "Criar novo contato no CRM.", parameters: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, notes: { type: "string" } }, required: ["name", "phone"] } } },
  { type: "function", function: { name: "update_contact", description: "Atualizar dados do contato.", parameters: { type: "object", properties: { contact_id: { type: "string" }, name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, notes: { type: "string" }, status: { type: "string", enum: ["open", "closed"] }, funnel_stage: { type: "string" }, assigned_to: { type: "string" } }, required: ["contact_id"] } } },
  // (removido: get_conversation legacy — usar get_conversation_messages, que tem backfill de transcrição)
  { type: "function", function: { name: "send_message", description: "Enviar mensagem WhatsApp para um contato.", parameters: { type: "object", properties: { contact_id: { type: "string" }, content: { type: "string" } }, required: ["contact_id", "content"] } } },
  { type: "function", function: { name: "list_tags", description: "Listar todas as tags disponíveis.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "add_tag", description: "Adicionar tag a um contato.", parameters: { type: "object", properties: { contact_id: { type: "string" }, tag_id: { type: "string" } }, required: ["contact_id", "tag_id"] } } },
  { type: "function", function: { name: "remove_tag", description: "Remover tag de um contato.", parameters: { type: "object", properties: { contact_id: { type: "string" }, tag_id: { type: "string" } }, required: ["contact_id", "tag_id"] } } },
  { type: "function", function: { name: "move_funnel_stage", description: "Mover contato para outra etapa do funil.", parameters: { type: "object", properties: { contact_id: { type: "string" }, funnel_stage: { type: "string" } }, required: ["contact_id", "funnel_stage"] } } },
  { type: "function", function: { name: "assign_contact", description: "Atribuir contato a um membro da equipe.", parameters: { type: "object", properties: { contact_id: { type: "string" }, user_id: { type: "string" } }, required: ["contact_id"] } } },
  { type: "function", function: { name: "list_members", description: "Listar membros da equipe.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_funnel_stages", description: "Listar etapas do funil.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_daily_stats", description: "Estatísticas do dia da organização inteira (contatos, mensagens, fechados). NÃO use quando a pergunta citar um contato, empresa, nome próprio ou telefone específico.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "schedule_message", description: "Agendar mensagem WhatsApp.", parameters: { type: "object", properties: { contact_id: { type: "string" }, content: { type: "string" }, scheduled_at: { type: "string" } }, required: ["contact_id", "content", "scheduled_at"] } } },
  { type: "function", function: { name: "get_conversation_messages", description: "Busca mensagens de um contato (padrão: últimas 50, mais recentes primeiro). CADA mensagem retorna no formato `{ id, at, from, text }`. O conteúdo SEMPRE está em `text` (NUNCA em `content`). Mídias inbound vêm com prefixo no `text`: `[IMAGEM] <descrição>`, `[ÁUDIO] <transcrição>` ou `[VÍDEO] <descrição>`. Mídias outbound vêm como `[IMAGEM ENVIADA AO CLIENTE]` etc. Se aparecer `[IMAGEM SEM DESCRIÇÃO DISPONÍVEL — não invente o conteúdo]` (ou ÁUDIO/VÍDEO), a transcrição falhou — diga ao usuário, NÃO invente. Use o `text` literalmente — NÃO diga que não tem acesso a transcrições. Para 'qual a última mensagem', use limit=1. Para ampliar a janela, passe date_from/date_to (YYYY-MM-DD, fuso America/Sao_Paulo).", parameters: { type: "object", properties: { contact_id: { type: "string", description: "UUID do contato (obtido de search_contacts)" }, limit: { type: "number", description: "Quantidade de mensagens (padrão 50, máx 500)" }, order: { type: "string", enum: ["desc", "asc"], description: "Ordem por created_at (padrão desc = mais recentes primeiro)" }, date_from: { type: "string", description: "Data inicial inclusiva YYYY-MM-DD (fuso America/Sao_Paulo)" }, date_to: { type: "string", description: "Data final inclusiva YYYY-MM-DD (fuso America/Sao_Paulo)" }, message_type: { type: "string", enum: ["text", "image", "audio", "video"], description: "Filtrar por tipo de mensagem" } }, required: ["contact_id"] } } },
  { type: "function", function: { name: "create_analysis", description: "Registrar uma nova análise de conversa na planilha de Análises (tabela conversation_analyses). Use para anotar resultados de auditorias, vendas concluídas/perdidas, leads qualificados etc. customer_name é obrigatório.", parameters: { type: "object", properties: { customer_name: { type: "string", description: "Nome do cliente" }, phone: { type: "string", description: "Telefone do cliente" }, lead_source: { type: "string", description: "Origem do lead (ex.: WhatsApp, Instagram, Indicação)" }, sale_status: { type: "string", description: "Status da venda (ex.: ganha, perdida, em negociação)" }, product_line: { type: "string", description: "Linha de produto" }, part_searched: { type: "string", description: "Peça/produto buscado pelo cliente" }, quantity: { type: "number", description: "Quantidade" }, sale_value: { type: "number", description: "Valor da venda em R$" }, analysis_date: { type: "string", description: "Data da análise no formato YYYY-MM-DD ou DD/MM/YYYY (padrão: hoje)" }, contact_id: { type: "string", description: "UUID do contato vinculado (opcional)" } }, required: ["customer_name"] } } },
  { type: "function", function: { name: "list_analyses", description: "Listar análises de conversas registradas, com filtros opcionais por período, cliente, telefone ou status da venda.", parameters: { type: "object", properties: { date_from: { type: "string", description: "Data inicial (YYYY-MM-DD ou DD/MM/YYYY)" }, date_to: { type: "string", description: "Data final (YYYY-MM-DD ou DD/MM/YYYY)" }, customer_name: { type: "string", description: "Filtrar por nome (busca parcial)" }, phone: { type: "string", description: "Filtrar por telefone (busca parcial)" }, sale_status: { type: "string", description: "Filtrar por status exato" }, limit: { type: "number", description: "Máximo de resultados (padrão 50, máx 200)" } } } } },
  { type: "function", function: { name: "get_analysis", description: "Obter detalhes completos de uma análise específica pelo ID.", parameters: { type: "object", properties: { analysis_id: { type: "string", description: "UUID da análise" } }, required: ["analysis_id"] } } },
  { type: "function", function: { name: "update_analysis", description: "Atualizar campos de uma análise existente.", parameters: { type: "object", properties: { analysis_id: { type: "string" }, customer_name: { type: "string" }, phone: { type: "string" }, lead_source: { type: "string" }, sale_status: { type: "string" }, product_line: { type: "string" }, part_searched: { type: "string" }, quantity: { type: "number" }, sale_value: { type: "number" }, analysis_date: { type: "string" }, contact_id: { type: "string" } }, required: ["analysis_id"] } } },
  { type: "function", function: { name: "delete_analysis", description: "Excluir permanentemente uma análise da planilha.", parameters: { type: "object", properties: { analysis_id: { type: "string" } }, required: ["analysis_id"] } } },
];

// ===== Structured logger helpers =====
function truncate(value: unknown, max: number): string {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    if (!s) return "";
    return s.length > max ? s.slice(0, max) + `…(+${s.length - max} chars)` : s;
  } catch {
    return "[unserializable]";
  }
}

function summarizeResult(toolName: string, result: unknown): Record<string, unknown> {
  if (result == null) return { ok: true, value: null };
  if (typeof result === "object" && result !== null && "error" in (result as any)) {
    return { ok: false, error: String((result as any).error) };
  }
  if (Array.isArray(result)) {
    return { ok: true, row_count: result.length, sample: truncate(result[0], 300) };
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    // Common shape: { messages: [], total }
    if (Array.isArray(obj.messages)) {
      return {
        ok: true,
        row_count: (obj.messages as unknown[]).length,
        total: obj.total,
        sample: truncate((obj.messages as unknown[])[0], 300),
      };
    }
    if (Array.isArray(obj.conversations)) {
      return {
        ok: true,
        row_count: (obj.conversations as unknown[]).length,
        total: obj.total,
      };
    }
    return { ok: true, summary: truncate(obj, 500) };
  }
  return { ok: true, value: truncate(result, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const traceId = crypto.randomUUID().slice(0, 8);
  const reqStart = Date.now();
  let agentIdForLog = "?";

  const log = (stage: string, data: Record<string, unknown> = {}) => {
    try {
      console.log(JSON.stringify({ trace_id: traceId, agent: agentIdForLog, stage, ...data }));
    } catch {
      console.log(`[${traceId}] ${stage} (log serialize failed)`);
    }
  };

  try {
    const { agent_id, messages, organization_id } = await req.json();
    if (!agent_id || !messages || !organization_id) {
      return new Response(JSON.stringify({ error: "agent_id, messages, and organization_id are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    agentIdForLog = agent_id;

    // Auth guard: require service-role key OR valid user JWT with org membership
    const supabase = getAdminClient();
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== serviceKey) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: membership } = await supabase.from("organization_members").select("id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const lastUserMsg = [...messages].reverse().find((m: any) => m?.role === "user");
    log("request_in", {
      organization_id,
      message_count: messages.length,
      last_user_message: truncate(lastUserMsg?.content, 500),
      available_tools: OPENAI_TOOLS.map((t: any) => t.function.name),
    });

    // Get agent config + org API key in parallel
    const [agentRes, keyRes] = await Promise.all([
      supabase.from("ai_agents").select("*").eq("id", agent_id).eq("organization_id", organization_id).single(),
      resolveOpenAiKey(supabase, organization_id),
    ]);

    if (agentRes.error || !agentRes.data) {
      log("agent_not_found", { error: agentRes.error?.message });
      return new Response(JSON.stringify({ error: "Agent not found", trace_id: traceId }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId } });
    }

    const agent = agentRes.data;
    const { openaiApiKey, keySource } = keyRes;
    if (!openaiApiKey) {
      log("no_openai_key", {});
      return new Response(
        JSON.stringify({ content: "⚠️ Nenhuma chave da OpenAI configurada. Configure em Squad AI → Chave da OpenAI (compartilhada) para começar a usar os agentes.", tool_calls: [], trace_id: traceId, openai_error: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId } },
      );
    }
    log("agent_loaded", { model: agent.model || "gpt-4o-mini", key_source: keySource, max_context: agent.max_context_messages });

    // Regras de uso de ferramentas (injetadas em todos os agentes para evitar alucinação)
    const TOOL_USAGE_RULES = `\n\n## Regras de uso de ferramentas (obrigatórias)
- Sempre passe \`contact_id\` (UUID retornado por \`search_contacts\`) — NUNCA telefone — para tools que aceitam contact_id.
- Se a pergunta citar um contato/empresa/nome/telefone específico e pedir quantidade de mensagens, atividade ou "quantas conversas teve hoje", use \`get_contact_activity_stats\` — NÃO use \`get_daily_stats\`.
- \`get_daily_stats\` serve SOMENTE para métricas globais da organização inteira.
- Se \`get_contact_activity_stats\` retornar mais de um contato em \`matches\`, NÃO some tudo nem escolha no chute: peça desambiguação ao usuário listando os nomes encontrados.
- Para "qual a última mensagem" de um contato, chame \`get_conversation_messages\` com \`limit=1\` e \`order=desc\`.
- Cada mensagem retornada vem como \`{ id, at, from: "contact"|"agent", text }\`. O campo \`text\` é a ÚNICA fonte de verdade — use-o literalmente ao citar o que foi dito/enviado.

## ⚠️ MÍDIA DO CLIENTE (imagem, áudio, vídeo) — REGRA CRÍTICA
Quando \`get_conversation_messages\` retorna o campo \`media_highlights\`, esse array contém a TRANSCRIÇÃO/DESCRIÇÃO LITERAL de cada mídia que o cliente enviou. Esse é o conteúdo REAL da mídia, extraído por IA de visão/áudio.

REGRAS OBRIGATÓRIAS:
1. Você TEM acesso ao conteúdo das mídias via \`media_highlights[].transcribed_content\`. NUNCA diga "não consigo ver imagens", "não tenho como ouvir áudios", "não posso visualizar comprovantes". Você PODE — está tudo escrito ali.
2. Trate o \`transcribed_content\` como se você tivesse visto/ouvido a mídia diretamente. Se o cliente perguntar "viu meu comprovante?", use os valores, nomes, datas e dados literais que estão no \`transcribed_content\` para responder com confiança (ex.: "sim, recebi seu comprovante de R$ X para o nome Y").
3. Se \`media_highlights\` estiver vazio MAS \`media_highlights_summary.total_inbound_media_without_transcription > 0\`, aí sim diga ao cliente que não conseguiu processar aquele arquivo específico e peça para reenviar.
4. Se \`media_highlights\` estiver vazio E \`total_inbound_media_without_transcription = 0\`, o cliente realmente não enviou mídia nessa janela — diga isso e ofereça ampliar com \`date_from\`.
5. NUNCA invente conteúdo de mídia. Se não está em \`media_highlights\`, não existe pra você.

## Outras regras
- Se \`get_conversation_messages\` retornar \`messages\` vazio, diga isso claramente e ofereça ampliar a janela com \`date_from\`/\`date_to\` (YYYY-MM-DD). NÃO invente conteúdo.
- Resultados de tools NÃO persistem entre requisições — re-materialize no seu \`assistant.content\` o que precisar lembrar (especialmente conteúdo de mídia).
- Não suponha datas: se precisar buscar histórico mais antigo, peça permissão ou use \`date_from\` explicitamente.`;

    // ====== ConversationContextBuilder ======
    // Unidade de medida: TURNOS (1 user + 1 assistant). Tool calls/results são efêmeros
    // — não persistem entre requests, vivem apenas dentro do scratchpad do loop atual.
    type Turn = { user: string; assistant: string };
    type Msg = { role: string; content?: string | null; [k: string]: unknown };

    // 1) TurnSplitter: pareia user→assistant. Descarta tool/tool_call (defensivo: front
    //    já manda só {role, content}, mas garantimos contra payloads bagunçados).
    function splitIntoTurns(history: Msg[]): { turns: Turn[]; currentUser: string | null } {
      const cleaned = (history || []).filter((m) =>
        (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.length > 0
      );
      const turns: Turn[] = [];
      let pendingUser: string | null = null;
      for (const m of cleaned) {
        if (m.role === "user") {
          // Se já havia user pendente sem resposta, descartamos o anterior (raro: usuário enviou 2 seguidas)
          pendingUser = m.content as string;
        } else if (m.role === "assistant" && pendingUser !== null) {
          turns.push({ user: pendingUser, assistant: m.content as string });
          pendingUser = null;
        }
      }
      return { turns, currentUser: pendingUser };
    }

    // 2) TurnWindower: mantém os últimos N turnos completos.
    // 3) TurnSummarizer: resume o overflow em bullets factuais.
    async function summarizeTurns(turnsToSummarize: Turn[]): Promise<string | null> {
      if (turnsToSummarize.length === 0) return null;
      const transcript = turnsToSummarize
        .map((t, i) => `[Turno ${i + 1}]\nUsuário: ${t.user}\nAssistente: ${t.assistant}`)
        .join("\n\n");
      const sumBody = {
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: "Você resume conversas preservando fatos verificáveis. Saída: até 10 bullets em português, cada um com 1 linha. Preserve: nomes próprios, IDs/UUIDs, telefones, datas, decisões tomadas, dados confirmados, perguntas pendentes, descrições/transcrições de mídia citadas." },
          { role: "user", content: `Resuma o contexto factual desta conversa:\n\n${transcript}` },
        ],
      };
      try {
        const sumStart = Date.now();
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(sumBody),
        });
        if (!r.ok) {
          log("summarizer_error", { status: r.status, body: truncate(await r.text(), 400) });
          return null;
        }
        const j = await r.json();
        const content = j.choices?.[0]?.message?.content?.trim() || null;
        log("summarizer_ok", { duration_ms: Date.now() - sumStart, chars: content?.length || 0, turns_in: turnsToSummarize.length });
        return content;
      } catch (e) {
        log("summarizer_throw", { error: (e as Error).message });
        return null;
      }
    }

    // max_turns: reinterpretamos a coluna max_context_messages como turnos.
    // Default 20 turnos (= 40 mensagens user+assistant).
    const maxTurns = Math.max(Number(agent.max_context_messages) || 20, 1);
    const { turns: allTurns, currentUser } = splitIntoTurns(messages);

    let windowedTurns = allTurns;
    let overflowTurns: Turn[] = [];
    if (allTurns.length > maxTurns) {
      overflowTurns = allTurns.slice(0, allTurns.length - maxTurns);
      windowedTurns = allTurns.slice(-maxTurns);
    }

    const summary = await summarizeTurns(overflowTurns);

    log("context_built", {
      raw_messages: Array.isArray(messages) ? messages.length : 0,
      total_turns: allTurns.length,
      max_turns: maxTurns,
      turns_kept: windowedTurns.length,
      turns_summarized: overflowTurns.length,
      summary_chars: summary?.length || 0,
      has_current_user_turn: !!currentUser,
    });

    // 4) Camada 1 (durável): system + summary? + turnos + currentUser
    const systemContent =
      agent.system_prompt +
      (agent.about_company ? `\n\nSobre a empresa:\n${agent.about_company}` : "") +
      (agent.faq_content ? `\n\nFAQ:\n${agent.faq_content}` : "") +
      TOOL_USAGE_RULES;

    const baseContext: any[] = [{ role: "system", content: systemContent }];
    if (summary) {
      baseContext.push({
        role: "system",
        content: `## Resumo dos turnos anteriores (${overflowTurns.length} turnos antigos condensados)\n${summary}`,
      });
    }
    for (const t of windowedTurns) {
      baseContext.push({ role: "user", content: t.user });
      baseContext.push({ role: "assistant", content: t.assistant });
    }
    if (currentUser) {
      baseContext.push({ role: "user", content: currentUser });
    }

    // Camada 2 (efêmera): scratchpad do tool-loop. NADA daqui persiste entre requests.
    const openaiMessages: any[] = [...baseContext];

    // Tool call loop (max 10 iterations)
    const toolResults: { name: string; result: any }[] = [];
    let finalContent = "";
    let iterations = 0;
    let lastFinishReason = "";

    for (let i = 0; i < 10; i++) {
      iterations = i + 1;
      const systemAgentModel = agent.model || "gpt-4o-mini";
      const openaiBody: any = {
        model: systemAgentModel,
        messages: openaiMessages,
        max_tokens: 8192,
        temperature: 0.7,
        tools: OPENAI_TOOLS,
        tool_choice: "auto",
      };
      // GPT-5.6 (sol/terra/luna) defaults reasoning_effort to "medium" when omitted, which
      // is incompatible with function tools on Chat Completions — must be explicitly "none".
      if (systemAgentModel.startsWith("gpt-5.6")) openaiBody.reasoning_effort = "none";

      const openaiStart = Date.now();
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(openaiBody),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        log("openai_error", { iteration: iterations, status: openaiRes.status, body: truncate(errText, 800), duration_ms: Date.now() - openaiStart });
        const friendly = friendlyOpenAiError(openaiRes.status, errText);
        // Retorna 200 com mensagem amigável para a UI renderizar como resposta do agente.
        return new Response(
          JSON.stringify({ content: friendly, tool_calls: [], trace_id: traceId, openai_error: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId } },
        );
      }

      const completion = await openaiRes.json();
      const choice = completion.choices?.[0];
      const msg = choice?.message;
      lastFinishReason = choice?.finish_reason || "";

      log("openai_response", {
        iteration: iterations,
        finish_reason: lastFinishReason,
        tool_call_count: msg?.tool_calls?.length || 0,
        content_chars: (msg?.content || "").length,
        duration_ms: Date.now() - openaiStart,
        usage: completion.usage,
      });

      // Add assistant message to context
      openaiMessages.push(msg);

      // If no tool calls, we have the final response
      if (!msg?.tool_calls?.length) {
        finalContent = msg?.content || "";
        break;
      }

      // Process each tool call
      for (const toolCall of msg.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch (parseErr) {
          log("tool_args_parse_error", { iteration: iterations, tool: fnName, raw_args: truncate(toolCall.function.arguments, 500), error: (parseErr as Error).message });
        }

        log("tool_call", {
          iteration: iterations,
          tool: fnName,
          arguments: truncate(fnArgs, 1000),
        });

        const toolStart = Date.now();
        let result: any;
        try {
          result = await executeTool(organization_id, fnName, fnArgs, log);
          toolResults.push({ name: fnName, result });
          log("tool_result", {
            iteration: iterations,
            tool: fnName,
            duration_ms: Date.now() - toolStart,
            ...summarizeResult(fnName, result),
          });
        } catch (e) {
          const errMsg = (e as Error).message;
          result = { error: errMsg };
          toolResults.push({ name: fnName, result });
          log("tool_error", {
            iteration: iterations,
            tool: fnName,
            duration_ms: Date.now() - toolStart,
            error: errMsg,
            arguments: truncate(fnArgs, 500),
          });
        }

        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    log("request_done", {
      iterations,
      final_finish_reason: lastFinishReason,
      final_content_chars: finalContent.length,
      total_tool_calls: toolResults.length,
      total_duration_ms: Date.now() - reqStart,
    });

    return new Response(JSON.stringify({
      content: finalContent,
      tool_calls: toolResults,
      trace_id: traceId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId } });

  } catch (e) {
    log("unhandled_error", { error: (e as Error).message, stack: truncate((e as Error).stack, 800) });
    return new Response(JSON.stringify({ error: (e as Error).message, trace_id: traceId }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId } });
  }
});
