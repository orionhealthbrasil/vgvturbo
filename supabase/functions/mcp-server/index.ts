import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SHA-256 hash helper
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Create admin Supabase client
function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// Validate API key and return org_id
async function authenticateRequest(req: Request): Promise<string | null> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const keyHash = await hashKey(apiKey);
  const supabase = getAdminClient();

  const { data } = await supabase.rpc("validate_api_key", { p_key_hash: keyHash });
  if (!data) return null;

  // Update last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash);

  return data;
}

// ===== TOOL IMPLEMENTATIONS =====

async function searchContacts(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const query = params.query as string || "";
  const limit = Math.min((params.limit as number) || 20, 100);

  let q = supabase
    .from("contacts")
    .select("id, name, phone, email, status, funnel_stage, assigned_to, created_at, last_message_at, unread_count")
    .eq("organization_id", orgId)
    .limit(limit);

  if (query) {
    q = q.or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
  }

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

  // Fetch contact, tags, and custom fields in parallel to avoid nested schema issues
  const [contactRes, tagsRes, fieldsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("contact_tags")
      .select("tag_id, tags(id, name, color)")
      .eq("contact_id", contactId),
    supabase
      .from("contact_custom_fields")
      .select("field_name, field_value")
      .eq("contact_id", contactId)
      .eq("organization_id", orgId),
  ]);

  if (contactRes.error) throw new Error(contactRes.error.message);

  const tags = (tagsRes.data || []).map((ct: any) => ct.tags).filter(Boolean);
  const custom_fields = fieldsRes.data || [];

  return { ...contactRes.data, tags, custom_fields };
}

async function createContact(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const name = params.name as string;
  const phone = params.phone as string;
  if (!name || !phone) throw new Error("name and phone are required");

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      name,
      phone,
      email: (params.email as string) || null,
      organization_id: orgId,
      notes: (params.notes as string) || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function updateContact(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  if (!contactId) throw new Error("contact_id is required");

  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.phone !== undefined) updates.phone = params.phone;
  if (params.email !== undefined) updates.email = params.email;
  if (params.notes !== undefined) updates.notes = params.notes;
  if (params.status !== undefined) updates.status = params.status;
  if (params.funnel_stage !== undefined) updates.funnel_stage = params.funnel_stage;
  if (params.assigned_to !== undefined) updates.assigned_to = params.assigned_to;

  const { data, error } = await supabase
    .from("contacts")
    .update(updates)
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function getConversation(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  if (!contactId) throw new Error("contact_id is required");
  const limit = Math.min((params.limit as number) || 50, 200);

  const { data, error } = await supabase
    .from("messages")
    .select("id, content, message_type, media_url, transcription, direction, status, created_at, sent_by_user_id")
    .eq("contact_id", contactId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  // Inject transcription into content for media messages so the AI can understand them
  const enriched = (data || []).map((m: any) => {
    if (m.message_type !== "text" && m.transcription) {
      const label = m.message_type === "audio" ? "Transcrição do áudio" : `Descrição (${m.message_type})`;
      return { ...m, content: m.content ? `${m.content}\n[${label}]: ${m.transcription}` : `[${label}]: ${m.transcription}` };
    }
    return m;
  });
  return enriched.reverse();
}

async function sendMessage(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  const content = params.content as string;
  if (!contactId || !content) throw new Error("contact_id and content are required");

  // Get contact phone
  const { data: contact } = await supabase
    .from("contacts")
    .select("phone")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .single();

  if (!contact) throw new Error("Contact not found");

  // Get WhatsApp instance
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("organization_id", orgId)
    .single();

  if (!instance) throw new Error("WhatsApp not connected");

  // Send via Stevo API
  const phone = contact.phone.replace(/\D/g, "");
  const response = await fetch(`${instance.base_url}/message/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: instance.api_key,
    },
    body: JSON.stringify({
      number: phone,
      text: content,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Failed to send message: ${errBody}`);
  }

  const result = await response.json();

  // Save to database
  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      contact_id: contactId,
      organization_id: orgId,
      content,
      direction: "outbound",
      message_type: "text",
      status: "sent",
      whatsapp_message_id: result?.key?.id || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Update contact last_message_at
  await supabase
    .from("contacts")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", contactId);

  return { message_id: msg.id, status: "sent" };
}

async function listTags(orgId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("organization_id", orgId)
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

async function addTag(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  const tagId = params.tag_id as string;
  if (!contactId || !tagId) throw new Error("contact_id and tag_id are required");

  // Verify contact belongs to org
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .single();

  if (!contact) throw new Error("Contact not found");

  const { error } = await supabase
    .from("contact_tags")
    .insert({ contact_id: contactId, tag_id: tagId });

  if (error) throw new Error(error.message);
  return { success: true };
}

async function removeTag(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  const tagId = params.tag_id as string;
  if (!contactId || !tagId) throw new Error("contact_id and tag_id are required");

  const { error } = await supabase
    .from("contact_tags")
    .delete()
    .eq("contact_id", contactId)
    .eq("tag_id", tagId);

  if (error) throw new Error(error.message);
  return { success: true };
}

async function moveFunnelStage(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  const stageSlug = params.funnel_stage as string;
  if (!contactId || !stageSlug) throw new Error("contact_id and funnel_stage are required");
  // Get contact's current pipeline
  const { data: contact } = await supabase.from("contacts").select("pipeline_id").eq("id", contactId).eq("organization_id", orgId).single();
  const contactPipelineId = contact?.pipeline_id ?? null;
  // Find stage in contact's pipeline first, fallback to any pipeline
  let stageQuery = supabase.from("funnel_stages").select("slug, pipeline_id").eq("organization_id", orgId).eq("slug", stageSlug);
  if (contactPipelineId) stageQuery = stageQuery.eq("pipeline_id", contactPipelineId);
  const { data: stage } = await stageQuery.maybeSingle();
  if (!stage) throw new Error(`Funnel stage "${stageSlug}" not found`);
  const { data, error } = await supabase
    .from("contacts")
    .update({ funnel_stage: stage.slug, pipeline_id: stage.pipeline_id })
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function assignContact(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  const userId = (params.user_id as string) || null;
  if (!contactId) throw new Error("contact_id is required");

  const { data, error } = await supabase
    .from("contacts")
    .update({ assigned_to: userId })
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function listMembers(orgId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, member_role, profiles(full_name, email)")
    .eq("organization_id", orgId);

  if (error) throw new Error(error.message);
  return data;
}

async function getFunnelStages(orgId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("funnel_stages")
    .select("id, name, slug, color, position, is_final")
    .eq("organization_id", orgId)
    .order("position");

  if (error) throw new Error(error.message);
  return data;
}

async function getDailyStats(orgId: string) {
  const supabase = getAdminClient();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  const [contacts, messages, closedToday] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", startOfDay),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "closed").gte("closed_at", startOfDay),
  ]);

  return {
    total_contacts: contacts.count || 0,
    messages_today: messages.count || 0,
    closed_today: closedToday.count || 0,
  };
}

async function scheduleMessage(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  const content = params.content as string;
  const scheduledAt = params.scheduled_at as string;
  if (!contactId || !content || !scheduledAt) throw new Error("contact_id, content and scheduled_at are required");

  // Validate date is in the future
  const schedDate = new Date(scheduledAt);
  if (isNaN(schedDate.getTime())) throw new Error("scheduled_at must be a valid ISO 8601 date");
  if (schedDate <= new Date()) throw new Error("scheduled_at must be in the future");

  // Verify contact belongs to org
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .single();

  if (!contact) throw new Error("Contact not found");

  const { data, error } = await supabase
    .from("scheduled_messages")
    .insert({
      contact_id: contactId,
      organization_id: orgId,
      message_content: content,
      scheduled_at: scheduledAt,
      scheduled_by: "00000000-0000-0000-0000-000000000000", // MCP API caller
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, scheduled_at: data.scheduled_at, status: data.status };
}

async function getTodayConversations(orgId: string) {
  const supabase = getAdminClient();
  
  // Start of day in São Paulo timezone (UTC-3)
  const now = new Date();
  const spOffset = -3 * 60;
  const spNow = new Date(now.getTime() + (spOffset + now.getTimezoneOffset()) * 60000);
  const startOfDay = new Date(spNow);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayUTC = new Date(startOfDay.getTime() - (spOffset + now.getTimezoneOffset()) * 60000 + 3 * 60 * 60000);

  // Get ALL messages today using pagination (Supabase default limit is 1000)
  const PAGE_SIZE = 1000;
  let allMsgs: { contact_id: string; direction: string; created_at: string }[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from("messages")
      .select("contact_id, direction, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", startOfDayUTC.toISOString())
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!batch || batch.length === 0) {
      hasMore = false;
    } else {
      allMsgs = allMsgs.concat(batch);
      offset += PAGE_SIZE;
      if (batch.length < PAGE_SIZE) hasMore = false;
    }
  }

  if (allMsgs.length === 0) return { conversations: [], total: 0 };
  const msgs = allMsgs;

  // Aggregate per contact
  const statsMap: Record<string, { inbound: number; outbound: number; last_message_at: string }> = {};
  for (const m of msgs as any[]) {
    if (!statsMap[m.contact_id]) {
      statsMap[m.contact_id] = { inbound: 0, outbound: 0, last_message_at: m.created_at };
    }
    if (m.direction === "inbound") statsMap[m.contact_id].inbound++;
    else statsMap[m.contact_id].outbound++;
    statsMap[m.contact_id].last_message_at = m.created_at;
  }

  const contactIds = Object.keys(statsMap);

  // Fetch contact details
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, phone, assigned_to, funnel_stage, status")
    .in("id", contactIds);

  // Fetch assigned agent names
  const assignedIds = [...new Set((contacts || []).filter((c: any) => c.assigned_to).map((c: any) => c.assigned_to))];
  const profilesRes = assignedIds.length > 0
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", assignedIds)
    : { data: [] };

  const profileMap: Record<string, string> = {};
  ((profilesRes as any).data || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name || "Sem nome"; });

  const contactMap: Record<string, any> = {};
  (contacts || []).forEach((c: any) => { contactMap[c.id] = c; });

  const conversations = contactIds.map((cid) => {
    const contact = contactMap[cid] || { name: "Desconhecido", phone: "", assigned_to: null, funnel_stage: "", status: "" };
    const stats = statsMap[cid];
    return {
      contact_id: cid,
      contact_name: contact.name,
      contact_phone: contact.phone,
      status: contact.status,
      funnel_stage: contact.funnel_stage,
      assigned_to: contact.assigned_to ? (profileMap[contact.assigned_to] || contact.assigned_to) : null,
      messages_inbound: stats.inbound,
      messages_outbound: stats.outbound,
      messages_total: stats.inbound + stats.outbound,
      last_message_at: stats.last_message_at,
    };
  }).sort((a, b) => b.messages_total - a.messages_total);

  return { conversations, total: conversations.length };
}
async function getConversationsByDate(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const dateStr = params.date as string;
  if (!dateStr) throw new Error("date is required (YYYY-MM-DD)");

  // Parse date in São Paulo timezone (UTC-3)
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid date format. Use YYYY-MM-DD");

  const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0)); // 00:00 SP = 03:00 UTC
  const endOfDayUTC = new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0)); // next day 00:00 SP

  // Paginated fetch
  const PAGE_SIZE = 1000;
  let allMsgs: { contact_id: string; direction: string; created_at: string }[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from("messages")
      .select("contact_id, direction, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", startOfDayUTC.toISOString())
      .lt("created_at", endOfDayUTC.toISOString())
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!batch || batch.length === 0) {
      hasMore = false;
    } else {
      allMsgs = allMsgs.concat(batch);
      offset += PAGE_SIZE;
      if (batch.length < PAGE_SIZE) hasMore = false;
    }
  }

  if (allMsgs.length === 0) return { date: dateStr, conversations: [], total: 0 };

  // Aggregate per contact
  const statsMap: Record<string, { inbound: number; outbound: number; last_message_at: string }> = {};
  for (const m of allMsgs) {
    if (!statsMap[m.contact_id]) {
      statsMap[m.contact_id] = { inbound: 0, outbound: 0, last_message_at: m.created_at };
    }
    if (m.direction === "inbound") statsMap[m.contact_id].inbound++;
    else statsMap[m.contact_id].outbound++;
    statsMap[m.contact_id].last_message_at = m.created_at;
  }

  const contactIds = Object.keys(statsMap);

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, phone, assigned_to, funnel_stage, status")
    .in("id", contactIds);

  const assignedIds = [...new Set((contacts || []).filter((c: any) => c.assigned_to).map((c: any) => c.assigned_to))];
  const profilesRes = assignedIds.length > 0
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", assignedIds)
    : { data: [] };

  const profileMap: Record<string, string> = {};
  ((profilesRes as any).data || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name || "Sem nome"; });

  const contactMap: Record<string, any> = {};
  (contacts || []).forEach((c: any) => { contactMap[c.id] = c; });

  const conversations = contactIds.map((cid) => {
    const contact = contactMap[cid] || { name: "Desconhecido", phone: "", assigned_to: null, funnel_stage: "", status: "" };
    const stats = statsMap[cid];
    return {
      contact_id: cid,
      contact_name: contact.name,
      contact_phone: contact.phone,
      status: contact.status,
      funnel_stage: contact.funnel_stage,
      assigned_to: contact.assigned_to ? (profileMap[contact.assigned_to] || contact.assigned_to) : null,
      messages_inbound: stats.inbound,
      messages_outbound: stats.outbound,
      messages_total: stats.inbound + stats.outbound,
      last_message_at: stats.last_message_at,
    };
  }).sort((a, b) => b.messages_total - a.messages_total);

  return { date: dateStr, conversations, total: conversations.length };
}

async function getConversationMessages(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  if (!contactId) throw new Error("contact_id is required");

  // Date parameter (optional, defaults to today)
  const dateStr = params.date as string | undefined;
  let startOfDayUTC: Date;
  let endOfDayUTC: Date | null = null;

  if (dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) throw new Error("Invalid date format. Use YYYY-MM-DD");
    startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
    endOfDayUTC = new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0));
  } else {
    const now = new Date();
    const spOffset = -3 * 60;
    const spNow = new Date(now.getTime() + (spOffset + now.getTimezoneOffset()) * 60000);
    const startOfDay = new Date(spNow);
    startOfDay.setHours(0, 0, 0, 0);
    startOfDayUTC = new Date(startOfDay.getTime() - (spOffset + now.getTimezoneOffset()) * 60000 + 3 * 60 * 60000);
  }

  // Verify contact belongs to org
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .single();

  if (!contact) throw new Error("Contact not found");

  let q = supabase
    .from("messages")
    .select("id, content, message_type, media_url, transcription, direction, created_at, sent_by_user_id")
    .eq("contact_id", contactId)
    .eq("organization_id", orgId)
    .gte("created_at", startOfDayUTC.toISOString());

  if (endOfDayUTC) {
    q = q.lt("created_at", endOfDayUTC.toISOString());
  }

  const { data: msgs, error } = await q
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  // Fetch agent names
  const userIds = [...new Set((msgs || []).filter((m: any) => m.sent_by_user_id).map((m: any) => m.sent_by_user_id))];
  const profilesRes = userIds.length > 0
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
    : { data: [] };

  const profileMap: Record<string, string> = {};
  ((profilesRes as any).data || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name || "Sem nome"; });

  const messages = (msgs || []).map((m: any) => {
    let content = m.content;
    if (m.message_type !== "text" && m.transcription) {
      const label = m.message_type === "audio" ? "Transcrição do áudio" : `Descrição (${m.message_type})`;
      content = content ? `${content}\n[${label}]: ${m.transcription}` : `[${label}]: ${m.transcription}`;
    }
    return {
      id: m.id,
      direction: m.direction,
      message_type: m.message_type,
      content,
      created_at: m.created_at,
      agent_name: m.sent_by_user_id ? (profileMap[m.sent_by_user_id] || null) : null,
    };
  });

  return {
    contact_name: contact.name,
    contact_phone: contact.phone,
    messages,
    total: messages.length,
  };
}

// ===== Custom Fields Tools =====

async function listCustomFieldDefinitions(orgId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("custom_field_definitions")
    .select("id, name, field_type, options, is_required, position")
    .eq("organization_id", orgId)
    .order("position");
  if (error) throw new Error(error.message);
  return data;
}

async function getCustomFields(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  if (!contactId) throw new Error("contact_id is required");

  const { data, error } = await supabase
    .from("contact_custom_fields")
    .select("field_name, field_value, field_definition_id")
    .eq("contact_id", contactId)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return data;
}

async function setCustomField(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const contactId = params.contact_id as string;
  const fieldName = params.field_name as string;
  const fieldValue = params.field_value as string | null;
  if (!contactId || !fieldName) throw new Error("contact_id and field_name are required");

  // Verify contact belongs to org
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .single();
  if (!contact) throw new Error("Contact not found");

  // Find field definition if exists
  const { data: def } = await supabase
    .from("custom_field_definitions")
    .select("id, field_type, options")
    .eq("organization_id", orgId)
    .eq("name", fieldName)
    .maybeSingle();

  // Validate value against type if definition exists
  if (def && fieldValue !== null) {
    if (def.field_type === "number" && isNaN(Number(fieldValue))) {
      throw new Error(`Value for "${fieldName}" must be a number`);
    }
    if (def.field_type === "boolean" && !["true", "false"].includes(fieldValue)) {
      throw new Error(`Value for "${fieldName}" must be "true" or "false"`);
    }
    if (def.field_type === "select" && Array.isArray(def.options) && !def.options.includes(fieldValue)) {
      throw new Error(`Value for "${fieldName}" must be one of: ${(def.options as string[]).join(", ")}`);
    }
  }

  // Upsert
  const { data: existing } = await supabase
    .from("contact_custom_fields")
    .select("id")
    .eq("contact_id", contactId)
    .eq("field_name", fieldName)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("contact_custom_fields")
      .update({ field_value: fieldValue, field_definition_id: def?.id || null })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("contact_custom_fields")
      .insert({
        contact_id: contactId,
        organization_id: orgId,
        field_name: fieldName,
        field_value: fieldValue,
        field_definition_id: def?.id || null,
      });
    if (error) throw new Error(error.message);
  }

  return { success: true, field_name: fieldName, field_value: fieldValue };
}

async function upsertContact(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();
  const phone = params.phone as string;
  if (!phone) throw new Error("phone is required");

  // Resolve funnel stage + pipeline_id before touching the contact
  let funnelStageSlug: string | null = null;
  let pipelineId: string | null = null;
  if (params.funnel_stage) {
    const stageSlug = params.funnel_stage as string;
    const { data: stage } = await supabase
      .from("funnel_stages")
      .select("slug, pipeline_id")
      .eq("organization_id", orgId)
      .eq("slug", stageSlug)
      .maybeSingle();
    if (!stage) throw new Error(`Funnel stage "${stageSlug}" not found. Use get_funnel_stages to list available stages.`);
    funnelStageSlug = stage.slug;
    pipelineId = stage.pipeline_id;
  }

  // Look up existing contact by phone within org
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("phone", phone)
    .maybeSingle();

  const fields: Record<string, unknown> = {};
  if (params.name !== undefined) fields.name = params.name;
  if (params.email !== undefined) fields.email = params.email;
  if (params.notes !== undefined) fields.notes = params.notes;
  if (params.status !== undefined) fields.status = params.status;
  if (params.assigned_to !== undefined) fields.assigned_to = params.assigned_to;
  if (funnelStageSlug) {
    fields.funnel_stage = funnelStageSlug;
    fields.pipeline_id = pipelineId;
  }

  if (existing) {
    // Update
    const { data, error } = await supabase
      .from("contacts")
      .update(fields)
      .eq("id", existing.id)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { action: "updated", contact: data };
  } else {
    // Create — name is required for new contacts
    if (!params.name) throw new Error("name is required when creating a new contact");
    const { data, error } = await supabase
      .from("contacts")
      .insert({ organization_id: orgId, phone, ...fields })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { action: "created", contact: data };
  }
}

async function registerAnalysis(orgId: string, params: Record<string, unknown>) {
  const supabase = getAdminClient();

  // Parse date from DD/MM/YYYY to YYYY-MM-DD
  let analysisDate: string | null = null;
  if (params.analysis_date) {
    const parts = (params.analysis_date as string).split("/");
    if (parts.length === 3) {
      analysisDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }

  // Accept seller_name (preferred) or created_by; fallback to "mcp" if neither provided
  const attendant =
    (typeof params.seller_name === "string" && params.seller_name.trim()) ||
    (typeof params.created_by === "string" && params.created_by.trim()) ||
    "mcp";

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
    created_by: attendant,
  };

  if (analysisDate) record.analysis_date = analysisDate;

  const { data, error } = await supabase
    .from("conversation_analyses")
    .insert(record)
    .select("id, analysis_date, customer_name, sale_status")
    .single();

  if (error) throw new Error(error.message);
  return { success: true, analysis: data };
}

// ===== MCP PROTOCOL =====

const TOOLS = [
  {
    name: "search_contacts",
    description: "Search contacts by name, phone, or email. Filter by status or funnel stage.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (name, phone, or email)" },
        status: { type: "string", enum: ["open", "closed"], description: "Filter by status" },
        funnel_stage: { type: "string", description: "Filter by funnel stage slug" },
        limit: { type: "number", description: "Max results (default 20, max 100)" },
      },
    },
  },
  {
    name: "get_contact",
    description: "Get full details of a contact including tags and custom fields.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact in the CRM.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Contact name" },
        phone: { type: "string", description: "Phone number with country code" },
        email: { type: "string", description: "Email address (optional)" },
        notes: { type: "string", description: "Notes about the contact (optional)" },
      },
      required: ["name", "phone"],
    },
  },
  {
    name: "update_contact",
    description: "Update contact details (name, phone, email, notes, status, funnel_stage, assigned_to).",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        notes: { type: "string" },
        status: { type: "string", enum: ["open", "closed"] },
        funnel_stage: { type: "string" },
        assigned_to: { type: "string", description: "User UUID to assign to" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "get_conversation",
    description: "Get conversation history (messages) for a contact.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        limit: { type: "number", description: "Max messages (default 50, max 200)" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "send_message",
    description: "Send a WhatsApp text message to a contact.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        content: { type: "string", description: "Message text" },
      },
      required: ["contact_id", "content"],
    },
  },
  {
    name: "list_tags",
    description: "List all available tags in the organization.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_tag",
    description: "Add a tag to a contact.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        tag_id: { type: "string", description: "Tag UUID" },
      },
      required: ["contact_id", "tag_id"],
    },
  },
  {
    name: "remove_tag",
    description: "Remove a tag from a contact.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        tag_id: { type: "string", description: "Tag UUID" },
      },
      required: ["contact_id", "tag_id"],
    },
  },
  {
    name: "move_funnel_stage",
    description: "Move a contact to a different funnel stage.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        funnel_stage: { type: "string", description: "Funnel stage slug (e.g. 'lead', 'negotiation', 'closed')" },
      },
      required: ["contact_id", "funnel_stage"],
    },
  },
  {
    name: "assign_contact",
    description: "Assign a contact to a team member (or unassign by passing null).",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        user_id: { type: "string", description: "User UUID to assign to (omit to unassign)" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "list_members",
    description: "List all team members in the organization.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_funnel_stages",
    description: "List all funnel stages in the organization.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_daily_stats",
    description: "Get daily statistics (total contacts, messages today, closed today).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "schedule_message",
    description: "Schedule a WhatsApp text message to be sent at a specific date/time.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        content: { type: "string", description: "Message text" },
        scheduled_at: { type: "string", description: "ISO 8601 datetime for when to send (must be in the future)" },
      },
      required: ["contact_id", "content", "scheduled_at"],
    },
  },
  {
    name: "get_today_conversations",
    description: "List all conversations that had activity today (São Paulo timezone). Shows contact info, message counts, and assigned agent.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_conversations_by_date",
    description: "List all conversations that had activity on a specific date (São Paulo timezone). Accepts a date parameter in YYYY-MM-DD format. Shows contact info, message counts, and assigned agent.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format (São Paulo timezone)" },
      },
      required: ["date"],
    },
  },
  {
    name: "get_conversation_messages",
    description: "Get messages for a specific contact on a given date (São Paulo timezone). Defaults to today if no date provided. Shows message content, direction, and agent name.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        date: { type: "string", description: "Date in YYYY-MM-DD format (optional, defaults to today)" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "list_custom_field_definitions",
    description: "List all custom field definitions for the organization. Shows available fields with their types (text, number, boolean, select) and options.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_custom_fields",
    description: "Get all custom field values for a specific contact.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "set_custom_field",
    description: "Set a custom field value for a contact. The field_name must match an existing field definition. Values are validated against the field type.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        field_name: { type: "string", description: "Name of the custom field" },
        field_value: { type: "string", description: "Value to set (null to clear). For boolean fields use 'true'/'false'. For select fields, must be one of the defined options." },
      },
      required: ["contact_id", "field_name"],
    },
  },
  {
    name: "upsert_contact",
    description: "Create or update a contact identified by phone number. If a contact with that phone already exists in the org it is updated; otherwise a new one is created. Use funnel_stage (slug) to place the contact in the correct pipeline step — the pipeline_id is resolved automatically.",
    inputSchema: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Phone number with country code (used as lookup key)" },
        name: { type: "string", description: "Contact name (required when creating, optional when updating)" },
        email: { type: "string", description: "Email address (optional)" },
        notes: { type: "string", description: "Notes (optional)" },
        status: { type: "string", enum: ["open", "closed"], description: "Contact status (optional)" },
        funnel_stage: { type: "string", description: "Funnel stage slug — use get_funnel_stages to list available slugs" },
        assigned_to: { type: "string", description: "User UUID to assign to (optional)" },
      },
      required: ["phone"],
    },
  },
  {
    name: "register_analysis",
    description: "Register a conversation analysis record. Use after reviewing a customer conversation. Fields: analysis_date (DD/MM/YYYY), customer_name, phone (with DDD), lead_source (Instagram/Google/Fachada/Indicacao Pessoal/Recompra), sale_status (VENDA/ORCAMENTO/PECA NAO ENCONTRADA/SEM RESPOSTA/NAO TRABALHAMOS COM A PECA/NAO SELECIONOU OPCAO), product_line (LINHA LEVE/LINHA PESADA), part_searched, quantity (number), sale_value (numeric), seller_name (atendente que conduziu a conversa — sempre informe quando souber).",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Contact UUID (optional, for linking)" },
        analysis_date: { type: "string", description: "Date in DD/MM/YYYY format (defaults to today)" },
        customer_name: { type: "string", description: "Customer name" },
        phone: { type: "string", description: "Phone with DDD" },
        lead_source: { type: "string", description: "Lead source: Instagram, Google, Fachada, Indicacao Pessoal, Recompra" },
        sale_status: { type: "string", description: "Sale status: VENDA, ORCAMENTO, PECA NAO ENCONTRADA, SEM RESPOSTA, NAO TRABALHAMOS COM A PECA, NAO SELECIONOU OPCAO" },
        product_line: { type: "string", description: "Product line: LINHA LEVE, LINHA PESADA" },
        part_searched: { type: "string", description: "Part/product the customer was looking for" },
        quantity: { type: "number", description: "Quantity (usually 1 for sales)" },
        sale_value: { type: "number", description: "Sale value (numeric)" },
        seller_name: { type: "string", description: "Nome do atendente/vendedor que conduziu a conversa. Será gravado na coluna 'Atendente' do registro." },
        created_by: { type: "string", description: "Alias para seller_name (use seller_name de preferência)." },
      },
      required: ["customer_name"],
    },
  },
];

// Tool dispatcher
async function executeTool(orgId: string, toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case "search_contacts": return await searchContacts(orgId, args);
    case "get_contact": return await getContact(orgId, args);
    case "create_contact": return await createContact(orgId, args);
    case "update_contact": return await updateContact(orgId, args);
    case "get_conversation": return await getConversation(orgId, args);
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
    case "get_today_conversations": return await getTodayConversations(orgId);
    case "get_conversations_by_date": return await getConversationsByDate(orgId, args);
    case "get_conversation_messages": return await getConversationMessages(orgId, args);
    case "list_custom_field_definitions": return await listCustomFieldDefinitions(orgId);
    case "get_custom_fields": return await getCustomFields(orgId, args);
    case "set_custom_field": return await setCustomField(orgId, args);
    case "upsert_contact": return await upsertContact(orgId, args);
    case "register_analysis": return await registerAnalysis(orgId, args);
    default: throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Handle JSON-RPC request
async function handleJsonRpc(orgId: string, body: { jsonrpc: string; id?: number | string; method: string; params?: Record<string, unknown> }) {
  const { id, method, params } = body;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "vgvturbo-mcp", version: "1.0.0" },
      },
    };
  }

  if (method === "notifications/initialized") {
    return null; // No response for notifications
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    };
  }

  if (method === "tools/call") {
    const toolName = params?.name as string;
    const toolArgs = (params?.arguments as Record<string, unknown>) || {};

    try {
      const result = await executeTool(orgId, toolName, toolArgs);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authenticate
  const orgId = await authenticateRequest(req);
  if (!orgId) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Invalid or missing API key. Pass it in the x-api-key header." } }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const response = await handleJsonRpc(orgId, body);

    if (response === null) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("MCP Server error:", err);
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
