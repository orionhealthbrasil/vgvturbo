import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55") && cleaned.length <= 11) cleaned = "55" + cleaned;
  return cleaned;
}

function normalizeOpenAiKey(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

// Categoriza erros da OpenAI para logging/admin (não enviado ao contato final).
function classifyOpenAiError(status: number, rawBody: string): { code: string; adminMessage: string } {
  let code = "";
  let message = "";
  try {
    const parsed = JSON.parse(rawBody);
    code = parsed?.error?.code || parsed?.error?.type || "";
    message = parsed?.error?.message || "";
  } catch { /* keep raw */ }
  if (code === "insufficient_quota" || /insufficient_quota/i.test(rawBody)) {
    return { code: "insufficient_quota", adminMessage: "Chave da OpenAI sem créditos — adicionar saldo em platform.openai.com/account/billing" };
  }
  if (status === 401 || code === "invalid_api_key") return { code: "invalid_api_key", adminMessage: "Chave da OpenAI inválida — atualize em Squad AI" };
  if (code === "model_not_found" || status === 404) return { code: "model_not_found", adminMessage: "Modelo do agente indisponível para esta chave" };
  if (status === 429) return { code: "rate_limit", adminMessage: "Rate limit OpenAI — tente novamente em instantes" };
  if (status >= 500) return { code: "openai_unavailable", adminMessage: "OpenAI temporariamente indisponível" };
  return { code: "openai_error", adminMessage: message || `OpenAI status ${status}` };
}

type HoursContextSource = "default" | "db" | "partial_db";

interface OperatingHoursContext {
  working_days: number[];
  business_hours_start: string;
  business_hours_end: string;
  weekend_hours_enabled: boolean;
  weekend_hours_start: string;
  weekend_hours_end: string;
}

const DEFAULT_OPERATING_HOURS_CONTEXT: OperatingHoursContext = {
  working_days: [1, 2, 3, 4, 5],
  business_hours_start: "08:00",
  business_hours_end: "18:00",
  weekend_hours_enabled: false,
  weekend_hours_start: "09:00",
  weekend_hours_end: "13:00",
};

function normalizeTime(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value.trim().substring(0, 5)
    : fallback;
}

async function resolveOpenAiKey(supabase: any, organizationId: string) {
  const [orgRes, legacyRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("openai_api_key")
      .eq("id", organizationId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ai_agent_config")
      .select("openai_api_key")
      .eq("organization_id", organizationId)
      .limit(1)
      .maybeSingle(),
  ]);

  const orgKey = normalizeOpenAiKey(orgRes.data?.openai_api_key);
  if (orgKey) {
    return {
      openaiApiKey: orgKey,
      keySource: "organizations" as const,
      keyLookupError: orgRes.error?.message || legacyRes.error?.message || null,
    };
  }

  const legacyKey = normalizeOpenAiKey(legacyRes.data?.openai_api_key);
  if (legacyKey) {
    if (orgRes.error) {
      console.warn(`[ai-agent-respond] Organization key lookup fallback for org ${organizationId}: ${orgRes.error.message}`);
    }

    return {
      openaiApiKey: legacyKey,
      keySource: "ai_agent_config" as const,
      keyLookupError: orgRes.error?.message || legacyRes.error?.message || null,
    };
  }

  if (legacyRes.error) {
    console.warn(`[ai-agent-respond] Legacy key lookup failed for org ${organizationId}: ${legacyRes.error.message}`);
  }

  if (orgRes.error) {
    console.error(`[ai-agent-respond] Failed to resolve organization key for org ${organizationId}: ${orgRes.error.message}`);
    throw orgRes.error;
  }

  return {
    openaiApiKey: null,
    keySource: null,
    keyLookupError: legacyRes.error?.message || null,
  };
}

async function resolveOperatingHoursContext(supabase: any, organizationId: string) {
  const hoursContext: OperatingHoursContext = { ...DEFAULT_OPERATING_HOURS_CONTEXT };
  const hoursContextErrors: string[] = [];
  let usedDbHours = false;
  let hadHoursError = false;

  const [baseHoursRes, workingDaysRes, weekendRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("business_hours_start, business_hours_end")
      .eq("id", organizationId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("working_days")
      .eq("id", organizationId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("weekend_hours_enabled, weekend_hours_start, weekend_hours_end")
      .eq("id", organizationId)
      .limit(1)
      .maybeSingle(),
  ]);

  const registerHoursError = (label: string, message: string) => {
    hadHoursError = true;
    const detail = `${label}: ${message}`;
    hoursContextErrors.push(detail);
    console.warn(`[ai-agent-respond] Hours context fallback for org ${organizationId} (${detail})`);
  };

  if (baseHoursRes.error) {
    registerHoursError("base_hours", baseHoursRes.error.message);
  } else if (baseHoursRes.data) {
    usedDbHours = true;
    hoursContext.business_hours_start = normalizeTime(
      baseHoursRes.data.business_hours_start,
      DEFAULT_OPERATING_HOURS_CONTEXT.business_hours_start,
    );
    hoursContext.business_hours_end = normalizeTime(
      baseHoursRes.data.business_hours_end,
      DEFAULT_OPERATING_HOURS_CONTEXT.business_hours_end,
    );
  }

  if (workingDaysRes.error) {
    registerHoursError("working_days", workingDaysRes.error.message);
  } else if (Array.isArray(workingDaysRes.data?.working_days) && workingDaysRes.data.working_days.length > 0) {
    usedDbHours = true;
    hoursContext.working_days = workingDaysRes.data.working_days;
  }

  if (weekendRes.error) {
    registerHoursError("weekend_hours", weekendRes.error.message);
  } else if (weekendRes.data) {
    usedDbHours = true;
    hoursContext.weekend_hours_enabled = Boolean(weekendRes.data.weekend_hours_enabled);
    hoursContext.weekend_hours_start = normalizeTime(
      weekendRes.data.weekend_hours_start,
      DEFAULT_OPERATING_HOURS_CONTEXT.weekend_hours_start,
    );
    hoursContext.weekend_hours_end = normalizeTime(
      weekendRes.data.weekend_hours_end,
      DEFAULT_OPERATING_HOURS_CONTEXT.weekend_hours_end,
    );
  }

  const hoursContextSource: HoursContextSource = usedDbHours
    ? hadHoursError
      ? "partial_db"
      : "db"
    : "default";

  return { hoursContext, hoursContextSource, hoursContextErrors };
}

// ===== Catalog tools =====

async function executeSearchCatalog(supabase: any, orgId: string, args: { query?: string; listing_type?: string; city?: string; neighborhood?: string; price_min?: number; price_max?: number; limit?: number }): Promise<any[]> {
  let q = supabase.from("products")
    .select("id, name, description, base_price, images, tags, listing_type, city, neighborhood, product_categories(name)")
    .eq("organization_id", orgId).eq("is_available", true);
  if (args.listing_type) q = q.eq("listing_type", args.listing_type);
  if (args.city) q = q.ilike("city", `%${args.city}%`);
  if (args.neighborhood) q = q.ilike("neighborhood", `%${args.neighborhood}%`);
  if (args.price_max != null) q = q.lte("base_price", args.price_max);
  if (args.price_min != null) q = q.gte("base_price", args.price_min);
  if (args.query) q = q.or(`name.ilike.%${args.query}%,description.ilike.%${args.query}%`);
  const { data } = await q.order("base_price", { ascending: true }).limit(args.limit || 5);
  return (data || []).map((p: any) => ({
    id: p.id, name: p.name, description: (p.description || "").slice(0, 300),
    base_price: p.base_price, listing_type: p.listing_type, city: p.city,
    neighborhood: p.neighborhood, tags: p.tags || [], category: p.product_categories?.name || null,
    image_count: Array.isArray(p.images) ? p.images.length : 0,
  }));
}

async function sendCatalogImage(instance: any, phone: string, imageUrl: string, caption?: string): Promise<boolean> {
  const formattedPhone = formatPhone(phone);
  try {
    const resp = await fetch(`${instance.base_url}/send/media`, {
      method: "POST",
      headers: { apikey: instance.api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ number: formattedPhone, type: "image", url: imageUrl, formatJid: true, caption: caption || "" }),
    });
    if (!resp.ok) { console.error("[catalog] image send failed:", resp.status, await resp.text()); return false; }
    return true;
  } catch (err) {
    console.error("[catalog] image send error:", err);
    return false;
  }
}

async function executeSendMediaGallery(supabase: any, orgId: string, contactId: string, phone: string, productId: string, description: string, agent: any): Promise<{ scheduled: number; product_name: string }> {
  const { data: product } = await supabase.from("products")
    .select("id, name, base_price, images").eq("id", productId).eq("organization_id", orgId).maybeSingle();
  if (!product) return { scheduled: 0, product_name: "" };
  const images: { url: string; position: number }[] = Array.isArray(product.images)
    ? [...product.images].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    : [];
  const { data: instance } = await supabase.from("whatsapp_instances").select("instance_name, api_key, base_url").eq("organization_id", orgId).single();
  if (!instance?.base_url) return { scheduled: 0, product_name: product.name };

  // Envia o texto descritivo imediatamente, antes das fotos
  if (description?.trim()) {
    await sendAiReplyParts(supabase, orgId, phone, description, contactId, agent);
  }

  if (images.length === 0) return { scheduled: 0, product_name: product.name };

  // Dispara todas as imagens em paralelo com delay escalonado de 4s entre cada uma.
  // Não aguarda cada fetch completar (Stevo leva 20-30s por imagem e esgotaria o waitUntil).
  const sendAll = async () => {
    await new Promise((r) => setTimeout(r, 2000));
    images.forEach((img, i) => {
      setTimeout(() => {
        sendCatalogImage(instance, phone, img.url)
          .then(() => supabase.from("messages").insert({ contact_id: contactId, organization_id: orgId, content: img.url, message_type: "image", direction: "outbound", status: "sent", sent_by_user_id: null }).catch(() => {}))
          .catch((err: unknown) => console.error(`[catalog] bg image ${i} failed:`, err));
      }, i * 4000);
    });
    // Aguarda tempo suficiente para todos os setTimeout serem registrados
    await new Promise((r) => setTimeout(r, images.length * 4000 + 60000));
  };

  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    (EdgeRuntime as any).waitUntil(sendAll());
  } else {
    sendAll().catch(() => {});
  }
  console.log(`[catalog] scheduled ${images.length} images for product "${product.name}" (fire-and-forget)`);
  return { scheduled: images.length, product_name: product.name };
}

async function executeUpdateLeadFields(supabase: any, contactId: string, fields: Record<string, any>): Promise<void> {
  if (!fields || Object.keys(fields).length === 0) return;
  const { data: current } = await supabase.from("contacts").select("metadata").eq("id", contactId).maybeSingle();
  const existing = current?.metadata?.lead_qualification || {};
  await supabase.from("contacts").update({ metadata: { ...(current?.metadata || {}), lead_qualification: { ...existing, ...fields } } }).eq("id", contactId);
}

const CATALOG_TOOLS = [
  {
    type: "function", function: {
      name: "search_catalog",
      description: "Busca produtos/imóveis no catálogo. Use antes de apresentar qualquer imóvel. Filtre por tipo de negociação, cidade, bairro e faixa de preço.",
      parameters: {
        type: "object", properties: {
          query: { type: "string", description: "Busca por nome/descrição" },
          listing_type: { type: "string", enum: ["sale", "rent", "sale_rent"], description: "sale=venda, rent=aluguel, sale_rent=ambos" },
          city: { type: "string", description: "Cidade" },
          neighborhood: { type: "string", description: "Bairro" },
          price_min: { type: "number" }, price_max: { type: "number" },
          limit: { type: "number", description: "Máximo de resultados (padrão 5)" },
        },
      },
    },
  },
  {
    type: "function", function: {
      name: "send_media_gallery",
      description: "Envia a descrição do imóvel em texto e depois todas as fotos para o cliente. Use APÓS search_catalog identificar o produto. O campo description é obrigatório — é o texto que chegará ao cliente antes das fotos.",
      parameters: {
        type: "object", properties: {
          product_id: { type: "string", description: "ID do produto retornado pelo search_catalog" },
          description: { type: "string", description: "Texto descritivo do imóvel (nome, preço, características) que será enviado ao cliente ANTES das fotos" },
        },
        required: ["product_id", "description"],
      },
    },
  },
  {
    type: "function", function: {
      name: "update_lead_fields",
      description: "Salva dados de qualificação do lead no CRM (orçamento, tipo de interesse, bairro preferido, etc.).",
      parameters: {
        type: "object", properties: {
          fields: {
            type: "object", description: "Campos a salvar, ex: {budget: 4000, interest: 'rent', city: 'Camaçari'}",
            additionalProperties: true,
          },
        },
        required: ["fields"],
      },
    },
  },
];

async function sendWhatsAppMessage(supabase: any, organizationId: string, phone: string, text: string, contactId: string, aiAgentId?: string, agentName?: string | null): Promise<string | null> {
  const { data: instance } = await supabase.from("whatsapp_instances").select("instance_name, api_key, base_url").eq("organization_id", organizationId).single();
  if (!instance?.base_url) { console.error("No WhatsApp instance for org", organizationId); return null; }
  const formattedPhone = formatPhone(phone);
  // Prefix agent name for WhatsApp client visibility
  const whatsappText = agentName ? `*${agentName}:*\n${text}` : text;
  const stevoRes = await fetch(`${instance.base_url}/send/text`, { method: "POST", headers: { "apikey": instance.api_key, "Content-Type": "application/json" }, body: JSON.stringify({ number: formattedPhone, text: whatsappText }) });
  if (!stevoRes.ok) { console.error("Stevo send error:", stevoRes.status, await stevoRes.text()); return null; }
  const stevoData = await stevoRes.json();
  const whatsappMessageId = stevoData?.data?.Info?.ID || stevoData?.data?.key?.id || stevoData?.key?.id || null;
  await supabase.from("messages").insert({ contact_id: contactId, organization_id: organizationId, content: text, message_type: "text", direction: "outbound", status: "sent", whatsapp_message_id: whatsappMessageId, sent_by_user_id: null, ai_agent_id: aiAgentId || null });
  await supabase.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contactId);
  return whatsappMessageId;
}

// ===== Reply splitter =====
// Splits a long AI reply into multiple natural-feeling messages.
// 1) Honors explicit [[SPLIT]] markers from the model
// 2) Falls back to paragraph/sentence splitting when text exceeds targetChars
// 3) Caps at maxParts (excess merged into last)
export function splitAiReply(text: string, opts: { targetChars: number; maxParts: number }): string[] {
  const targetChars = Math.max(80, opts.targetChars || 350);
  const maxParts = Math.max(1, Math.min(8, opts.maxParts || 3));
  const clean = (text || "").trim();
  if (!clean) return [];

  // Preserve fenced code blocks as indivisible
  const codeBlocks: string[] = [];
  const placeheld = clean.replace(/```[\s\S]*?```/g, (m) => {
    codeBlocks.push(m);
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });

  const restore = (s: string) => s.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codeBlocks[Number(i)] || "");

  let parts: string[] = [];
  if (placeheld.includes("[[SPLIT]]")) {
    parts = placeheld.split(/\s*\[\[SPLIT\]\]\s*/).map(p => p.trim()).filter(Boolean);
  } else if (placeheld.length <= targetChars * 1.3) {
    parts = [placeheld];
  } else {
    // Split by paragraphs first
    const paragraphs = placeheld.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const buckets: string[] = [];
    let current = "";
    const pushCurrent = () => { if (current.trim()) buckets.push(current.trim()); current = ""; };

    for (const para of paragraphs) {
      if (para.length > targetChars * 1.3) {
        // Split paragraph by sentences keeping URLs/emails intact
        pushCurrent();
        const sentences = para.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z])/);
        for (const sent of sentences) {
          if ((current + " " + sent).trim().length > targetChars && current) {
            pushCurrent();
          }
          current = current ? `${current} ${sent}` : sent;
        }
        pushCurrent();
      } else {
        if ((current + "\n\n" + para).trim().length > targetChars && current) {
          pushCurrent();
        }
        current = current ? `${current}\n\n${para}` : para;
      }
    }
    pushCurrent();
    parts = buckets;
  }

  // Cap parts: merge excess into last
  if (parts.length > maxParts) {
    const head = parts.slice(0, maxParts - 1);
    const tail = parts.slice(maxParts - 1).join("\n\n");
    parts = [...head, tail];
  }

  return parts.map(restore).map(p => p.trim()).filter(Boolean);
}

async function sendAiReplyParts(
  supabase: any,
  organizationId: string,
  phone: string,
  text: string,
  contactId: string,
  agent: any,
): Promise<string | null> {
  const splitEnabled = agent?.split_long_messages !== false;
  const targetChars = Number(agent?.split_target_chars) || 350;
  const maxParts = Number(agent?.split_max_parts) || 3;
  const delayMs = Math.max(0, Number(agent?.split_delay_ms) || 1200);

  const parts = splitEnabled
    ? splitAiReply(text, { targetChars, maxParts })
    : [text.trim()];

  if (parts.length === 0) return null;

  // Send first part immediately (with agent name prefix)
  const firstId = await sendWhatsAppMessage(supabase, organizationId, phone, parts[0], contactId, agent.id, agent.name || null);

  if (parts.length === 1) return firstId;

  // Schedule the rest in background to not block the HTTP response
  const sendRest = async () => {
    for (let i = 1; i < parts.length; i++) {
      // jitter ±20% to feel more human
      const jitter = delayMs * (0.8 + Math.random() * 0.4);
      await new Promise((r) => setTimeout(r, Math.round(jitter)));
      try {
        // No name prefix on subsequent parts to avoid repetition
        await sendWhatsAppMessage(supabase, organizationId, phone, parts[i], contactId, agent.id, null);
      } catch (e) {
        console.error("[ai-agent-respond] split-send error on part", i, e);
      }
    }
  };

  // @ts-ignore — EdgeRuntime is provided by Supabase Edge runtime
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(sendRest());
  } else {
    // Fallback: fire-and-forget
    sendRest().catch((e) => console.error("[ai-agent-respond] sendRest fallback error", e));
  }

  return firstId;
}

// ===== MCP Tool implementations for conversational agent =====
async function toolSearchContacts(supabase: any, orgId: string, args: any) {
  const query = args.query || "";
  let q = supabase.from("contacts").select("id, name, phone, email, status, funnel_stage").eq("organization_id", orgId).limit(10);
  if (query) q = q.or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
  const { data, error } = await q.order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

async function toolGetContact(supabase: any, orgId: string, args: any) {
  if (!args.contact_id) throw new Error("contact_id is required");
  const [contactRes, tagsRes] = await Promise.all([
    supabase.from("contacts").select("id, name, phone, email, status, funnel_stage, assigned_to, notes").eq("id", args.contact_id).eq("organization_id", orgId).single(),
    supabase.from("contact_tags").select("tag_id, tags(id, name, color)").eq("contact_id", args.contact_id),
  ]);
  if (contactRes.error) throw new Error(contactRes.error.message);
  return { ...contactRes.data, tags: (tagsRes.data || []).map((ct: any) => ct.tags).filter(Boolean) };
}

async function toolAddTag(supabase: any, orgId: string, args: any) {
  if (!args.contact_id || !args.tag_id) throw new Error("contact_id and tag_id are required");
  const { data: c } = await supabase.from("contacts").select("id").eq("id", args.contact_id).eq("organization_id", orgId).single();
  if (!c) throw new Error("Contact not found");
  const { error } = await supabase.from("contact_tags").insert({ contact_id: args.contact_id, tag_id: args.tag_id });
  if (error) throw new Error(error.message);
  return { success: true };
}

async function toolRemoveTag(supabase: any, orgId: string, args: any) {
  if (!args.contact_id || !args.tag_id) throw new Error("contact_id and tag_id are required");
  const { error } = await supabase.from("contact_tags").delete().eq("contact_id", args.contact_id).eq("tag_id", args.tag_id);
  if (error) throw new Error(error.message);
  return { success: true };
}

async function toolListTags(supabase: any, orgId: string) {
  const { data, error } = await supabase.from("tags").select("id, name, color").eq("organization_id", orgId).order("name");
  if (error) throw new Error(error.message);
  return data;
}

async function toolMoveFunnel(supabase: any, orgId: string, args: any) {
  if (!args.contact_id || !args.funnel_stage) throw new Error("contact_id and funnel_stage are required");
  // Get contact's current pipeline
  const { data: contact } = await supabase.from("contacts").select("pipeline_id").eq("id", args.contact_id).eq("organization_id", orgId).single();
  const contactPipelineId = contact?.pipeline_id ?? null;
  // Find stage in contact's pipeline first, fallback to any pipeline
  let stageQuery = supabase.from("funnel_stages").select("slug, pipeline_id").eq("organization_id", orgId).eq("slug", args.funnel_stage);
  if (contactPipelineId) stageQuery = stageQuery.eq("pipeline_id", contactPipelineId);
  const { data: stage } = await stageQuery.maybeSingle();
  if (!stage) throw new Error(`Funnel stage "${args.funnel_stage}" not found`);
  const { data, error } = await supabase.from("contacts").update({ funnel_stage: stage.slug, pipeline_id: stage.pipeline_id }).eq("id", args.contact_id).eq("organization_id", orgId).select("id, funnel_stage, pipeline_id").single();
  if (error) throw new Error(error.message);
  return data;
}

async function toolAssignContact(supabase: any, orgId: string, args: any) {
  if (!args.contact_id) throw new Error("contact_id is required");
  const { data, error } = await supabase.from("contacts").update({ assigned_to: args.user_id || null }).eq("id", args.contact_id).eq("organization_id", orgId).select("id, assigned_to").single();
  if (error) throw new Error(error.message);
  return data;
}

async function toolGetCustomFields(supabase: any, orgId: string, args: any) {
  if (!args.contact_id) throw new Error("contact_id is required");
  const { data, error } = await supabase.from("contact_custom_fields").select("field_name, field_value").eq("contact_id", args.contact_id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return data;
}

async function toolSetCustomField(supabase: any, orgId: string, args: any) {
  if (!args.contact_id || !args.field_name) throw new Error("contact_id and field_name are required");
  const { data: c } = await supabase.from("contacts").select("id").eq("id", args.contact_id).eq("organization_id", orgId).single();
  if (!c) throw new Error("Contact not found");

  // Validate against definition if exists
  const { data: def } = await supabase.from("custom_field_definitions").select("id, field_type, options").eq("organization_id", orgId).eq("name", args.field_name).maybeSingle();
  if (def && args.field_value != null) {
    if (def.field_type === "number" && isNaN(Number(args.field_value))) throw new Error(`Value must be a number`);
    if (def.field_type === "boolean" && !["true","false"].includes(args.field_value)) throw new Error(`Value must be "true" or "false"`);
    if (def.field_type === "select" && Array.isArray(def.options) && !def.options.includes(args.field_value)) throw new Error(`Value must be one of: ${def.options.join(", ")}`);
  }

  const { data: existing } = await supabase.from("contact_custom_fields").select("id").eq("contact_id", args.contact_id).eq("field_name", args.field_name).eq("organization_id", orgId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("contact_custom_fields").update({ field_value: args.field_value ?? null, field_definition_id: def?.id || null }).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("contact_custom_fields").insert({ contact_id: args.contact_id, organization_id: orgId, field_name: args.field_name, field_value: args.field_value ?? null, field_definition_id: def?.id || null });
    if (error) throw new Error(error.message);
  }
  return { success: true, field_name: args.field_name, field_value: args.field_value ?? null };
}

async function toolListFieldDefinitions(supabase: any, orgId: string) {
  const { data, error } = await supabase.from("custom_field_definitions").select("id, name, field_type, options, is_required").eq("organization_id", orgId).order("position");
  if (error) throw new Error(error.message);
  return data;
}

async function toolRegisterAnalysis(supabase: any, orgId: string, args: any) {
  let analysisDate: string | undefined;
  if (args.analysis_date) {
    const parts = (args.analysis_date as string).split("/");
    if (parts.length === 3) analysisDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  const record: any = {
    organization_id: orgId,
    customer_name: args.customer_name,
    phone: args.phone || null,
    lead_source: args.lead_source || null,
    sale_status: args.sale_status || null,
    product_line: args.product_line || null,
    part_searched: args.part_searched || null,
    quantity: args.quantity != null ? Number(args.quantity) : null,
    sale_value: args.sale_value != null ? Number(args.sale_value) : null,
    contact_id: args.contact_id || null,
    created_by: "ai-agent",
  };
  if (analysisDate) record.analysis_date = analysisDate;
  const { data, error } = await supabase.from("conversation_analyses").insert(record).select("id, analysis_date, customer_name, sale_status").single();
  if (error) throw new Error(error.message);
  return { success: true, analysis: data };
}

async function executeMcpTool(supabase: any, orgId: string, name: string, args: any) {
  switch (name) {
    case "search_contacts": return await toolSearchContacts(supabase, orgId, args);
    case "get_contact": return await toolGetContact(supabase, orgId, args);
    case "add_tag": return await toolAddTag(supabase, orgId, args);
    case "remove_tag": return await toolRemoveTag(supabase, orgId, args);
    case "list_tags": return await toolListTags(supabase, orgId);
    case "move_funnel_stage": return await toolMoveFunnel(supabase, orgId, args);
    case "assign_contact": return await toolAssignContact(supabase, orgId, args);
    case "get_custom_fields": return await toolGetCustomFields(supabase, orgId, args);
    case "set_custom_field": return await toolSetCustomField(supabase, orgId, args);
    case "list_custom_field_definitions": return await toolListFieldDefinitions(supabase, orgId);
    case "register_analysis": return await toolRegisterAnalysis(supabase, orgId, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// MCP tools as OpenAI function definitions
const MCP_TOOLS = [
  { type: "function", function: { name: "search_contacts", description: "Buscar contatos por nome/telefone/email no CRM.", parameters: { type: "object", properties: { query: { type: "string", description: "Termo de busca" } } } } },
  { type: "function", function: { name: "get_contact", description: "Ver detalhes de um contato específico.", parameters: { type: "object", properties: { contact_id: { type: "string" } }, required: ["contact_id"] } } },
  { type: "function", function: { name: "list_tags", description: "Listar tags disponíveis na organização.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "add_tag", description: "Adicionar uma tag a este contato ou outro.", parameters: { type: "object", properties: { contact_id: { type: "string" }, tag_id: { type: "string" } }, required: ["contact_id", "tag_id"] } } },
  { type: "function", function: { name: "remove_tag", description: "Remover uma tag de um contato.", parameters: { type: "object", properties: { contact_id: { type: "string" }, tag_id: { type: "string" } }, required: ["contact_id", "tag_id"] } } },
  { type: "function", function: { name: "move_funnel_stage", description: "Mover contato para outra etapa do funil.", parameters: { type: "object", properties: { contact_id: { type: "string" }, funnel_stage: { type: "string" } }, required: ["contact_id", "funnel_stage"] } } },
  { type: "function", function: { name: "assign_contact", description: "Atribuir contato a um membro da equipe.", parameters: { type: "object", properties: { contact_id: { type: "string" }, user_id: { type: "string" } }, required: ["contact_id"] } } },
  { type: "function", function: { name: "get_custom_fields", description: "Ver campos personalizados de um contato.", parameters: { type: "object", properties: { contact_id: { type: "string" } }, required: ["contact_id"] } } },
  { type: "function", function: { name: "set_custom_field", description: "Definir valor de um campo personalizado do contato. Use list_custom_field_definitions para ver campos disponíveis.", parameters: { type: "object", properties: { contact_id: { type: "string" }, field_name: { type: "string", description: "Nome do campo personalizado" }, field_value: { type: "string", description: "Valor (use 'true'/'false' para booleanos)" } }, required: ["contact_id", "field_name", "field_value"] } } },
  { type: "function", function: { name: "list_custom_field_definitions", description: "Listar campos personalizados disponíveis na organização (nome, tipo, opções).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "register_analysis", description: "Registrar análise de conversa. Campos: analysis_date (DD/MM/YYYY), customer_name, phone (com DDD), lead_source (Instagram/Google/Fachada/Indicacao Pessoal/Recompra), sale_status (VENDA/ORCAMENTO/PECA NAO ENCONTRADA/SEM RESPOSTA/NAO TRABALHAMOS COM A PECA/NAO SELECIONOU OPCAO), product_line (LINHA LEVE/LINHA PESADA), part_searched, quantity, sale_value.", parameters: { type: "object", properties: { contact_id: { type: "string" }, analysis_date: { type: "string", description: "DD/MM/YYYY" }, customer_name: { type: "string" }, phone: { type: "string" }, lead_source: { type: "string" }, sale_status: { type: "string" }, product_line: { type: "string" }, part_searched: { type: "string" }, quantity: { type: "number" }, sale_value: { type: "number" } }, required: ["customer_name"] } } },
];

// ===== Squad router: classificador barato pra handoff dinâmico entre agentes =====
// Só é acionado quando a organização tem 2+ agentes conversacionais marcados
// como is_squad_member=true. Custo extra: 1 chamada OpenAI barata, sem tools.
// Falha de qualquer tipo aqui NUNCA bloqueia a resposta — apenas mantém o
// agente atualmente atribuído (fallback seguro).
async function routeSquadAgent(
  supabase: any,
  openaiApiKey: string,
  organizationId: string,
  contactId: string,
  currentAgentId: string | null,
  recentMessages: { role: string; content: string }[],
): Promise<string | null> {
  try {
    const { data: squadAgents, error } = await supabase
      .from("ai_agents")
      .select("id, name, description, department")
      .eq("organization_id", organizationId)
      .eq("category", "conversational")
      .eq("is_active", true)
      .eq("is_squad_member", true)
      .order("position", { ascending: true });

    if (error || !squadAgents || squadAgents.length < 2) {
      return null; // sem squad — segue fluxo normal, zero custo extra de OpenAI
    }

    const currentInSquad = squadAgents.find((a: any) => a.id === currentAgentId);
    // Se o agente atual foi atribuído manualmente por humano e NÃO está no
    // squad, respeita a escolha humana e não rotea.
    if (currentAgentId && !currentInSquad) {
      return null;
    }

    const agentList = squadAgents
      .map((a: any) => `- id: ${a.id} | nome: ${a.name} | setor: ${a.department || "-"} | especialidade: ${a.description || "sem descrição"}`)
      .join("\n");

    const currentLabel = currentInSquad ? `${currentInSquad.name} (id: ${currentInSquad.id})` : "nenhum (primeira mensagem)";

    const routerPrompt = `Você é um roteador de atendimento. Existem estes especialistas disponíveis:
${agentList}

Agente atualmente conversando com o cliente: ${currentLabel}

Decida, com base nas últimas mensagens da conversa, se o atendimento deve PERMANECER com o agente atual ou MUDAR para outro especialista mais adequado.
Troque de agente APENAS se a mensagem mais recente do cliente for claramente sobre o domínio de outro especialista. Em caso de dúvida, ambiguidade, ou continuidade do mesmo assunto, MANTENHA o agente atual.`;

    const routerTools = [
      {
        type: "function",
        function: { name: "keep_current_agent", description: "Mantém o atendimento com o agente atual.", parameters: { type: "object", properties: {} } },
      },
      {
        type: "function",
        function: {
          name: "switch_agent",
          description: "Transfere o atendimento para outro especialista do squad.",
          parameters: {
            type: "object",
            properties: {
              agent_id: { type: "string", enum: squadAgents.map((a: any) => a.id) },
              reason: { type: "string", description: "Motivo curto da troca, para auditoria." },
            },
            required: ["agent_id", "reason"],
          },
        },
      },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: routerPrompt }, ...recentMessages],
        max_tokens: 150,
        temperature: 0,
        tools: routerTools,
        tool_choice: "required",
      }),
    });

    if (!res.ok) {
      console.warn(`[ai-agent-respond][squad-router] OpenAI error ${res.status} — mantendo agente atual`);
      return null;
    }

    const completion = await res.json();
    const toolCall = completion.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;

    if (toolCall.function.name === "switch_agent") {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const targetId = args.agent_id;
      const isValidTarget = squadAgents.some((a: any) => a.id === targetId);
      if (isValidTarget && targetId !== currentAgentId) {
        console.log(`[ai-agent-respond][squad-router] switch ${currentAgentId || "none"} -> ${targetId} | contact=${contactId} | reason=${args.reason || "-"}`);
        return targetId;
      }
    }
    return null; // keep_current_agent, ou switch inválido/redundante
  } catch (e) {
    console.warn("[ai-agent-respond][squad-router] failed, keeping current agent:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth guard: allow service-role (internal webhook calls) OR valid user JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (token !== supabaseKey) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { contact_id, organization_id, message_id, message_content, message_type, media_url } = await req.json();
    if (!contact_id || !organization_id) {
      return new Response(JSON.stringify({ error: "Missing contact_id or organization_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: contact } = await supabase.from("contacts").select("ai_enabled, ai_agent_id, name, phone, organization_id").eq("id", contact_id).single();
    if (!contact?.ai_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI not enabled for contact" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (contact.organization_id !== organization_id) {
      console.error(`[ai-agent-respond] Organization mismatch for contact ${contact_id}: payload=${organization_id}, contact=${contact.organization_id}`);
      return new Response(JSON.stringify({ skipped: true, reason: "Organization mismatch for contact" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SDR one-shot: if the active agent is a SDR/follow-up agent, the customer reply
    // means the cadence is over. Disable AI and DO NOT generate any response.
    if (contact.ai_agent_id) {
      const { data: assignedAgent } = await supabase
        .from("ai_agents")
        .select("id, is_sdr, category")
        .eq("id", contact.ai_agent_id)
        .maybeSingle();
      const isSdrAgent = !!assignedAgent && (assignedAgent.is_sdr === true || assignedAgent.category === "sdr");
      if (isSdrAgent) {
        await supabase.from("contacts").update({ ai_enabled: false, ai_agent_id: null }).eq("id", contact_id);
        console.log(`[ai-agent-respond] SDR agent detected for contact ${contact_id} — AI disabled (one-shot, customer replied).`);
        return new Response(JSON.stringify({ skipped: true, reason: "SDR one-shot — customer replied, AI disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    let agentQuery = supabase.from("ai_agents").select("*").eq("organization_id", organization_id).eq("is_active", true).eq("category", "conversational");
    if (contact.ai_agent_id) agentQuery = agentQuery.eq("id", contact.ai_agent_id);
    let { data: agent } = await agentQuery.order("position", { ascending: true }).limit(1).maybeSingle();
    if (!agent) {
      return new Response(JSON.stringify({ skipped: true, reason: "No active conversational agent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Message batching debounce ===
    // Marca o timestamp desta invocação. Se outra mensagem chegar antes do
    // janela expirar, ela vai sobrescrever last_ai_trigger_at e esta invocação
    // desiste — a mais recente assume o controle e responde por todas.
    const triggerAt = new Date();
    await supabase.from("contacts").update({ last_ai_trigger_at: triggerAt.toISOString() }).eq("id", contact_id);

    const batchWindowMs = Math.max(0, Number(agent.batch_window_ms) || 8000);
    if (batchWindowMs > 0) {
      await new Promise((r) => setTimeout(r, batchWindowMs));

      // Verifica se chegou mensagem mais nova durante a espera
      const { data: freshContact } = await supabase
        .from("contacts")
        .select("last_ai_trigger_at")
        .eq("id", contact_id)
        .single();

      const freshTrigger = freshContact?.last_ai_trigger_at ? new Date(freshContact.last_ai_trigger_at) : null;
      if (freshTrigger && freshTrigger > triggerAt) {
        console.log(`[ai-agent-respond] Debounced — nova mensagem chegou (${freshTrigger.toISOString()} > ${triggerAt.toISOString()}) — descartando invocação anterior para contact=${contact_id}`);
        return new Response(JSON.stringify({ skipped: true, reason: "debounced", newer_trigger: freshTrigger.toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const [
      { openaiApiKey, keySource, keyLookupError },
      { hoursContext, hoursContextSource, hoursContextErrors },
    ] = await Promise.all([
      resolveOpenAiKey(supabase, organization_id),
      resolveOperatingHoursContext(supabase, organization_id),
    ]);

    if (!openaiApiKey) {
      console.log(`[ai-agent-respond] No OpenAI API key configured for org ${organization_id}. keyLookupError=${keyLookupError || "none"}`);
      return new Response(JSON.stringify({ skipped: true, reason: "No OpenAI API key configured", keySource, keyLookupError, hoursContextSource }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`[ai-agent-respond] Context resolved for org ${organization_id}: keySource=${keySource}, hoursContextSource=${hoursContextSource}${hoursContextErrors.length ? `, hoursContextErrors=${hoursContextErrors.join(" | ")}` : ""}`);

    // === Squad router: decide handoff ANTES de montar prompt/tools do agente ===
    {
      const { data: routerHistory } = await supabase
        .from("messages")
        .select("content, direction")
        .eq("contact_id", contact_id)
        .order("created_at", { ascending: false })
        .limit(3);
      const routerMessages = (routerHistory || []).reverse().map((m: any) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content || "",
      }));
      if (message_type === "text" && message_content) {
        routerMessages.push({ role: "user", content: message_content });
      }

      const routedAgentId = await routeSquadAgent(
        supabase,
        openaiApiKey,
        organization_id,
        contact_id,
        contact.ai_agent_id || agent.id,
        routerMessages,
      );

      if (routedAgentId && routedAgentId !== agent.id) {
        const { data: routedAgent } = await supabase
          .from("ai_agents")
          .select("*")
          .eq("id", routedAgentId)
          .eq("organization_id", organization_id)
          .eq("is_active", true)
          .maybeSingle();
        if (routedAgent) {
          agent = routedAgent;
          await supabase.from("contacts").update({ ai_agent_id: routedAgentId }).eq("id", contact_id);
        }
      }
    }

    // === Calculate store open/closed status ===
    const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dayOfWeek = nowBrasilia.getDay(); // 0=Sun, 6=Sat
    const currentTime = `${String(nowBrasilia.getHours()).padStart(2, "0")}:${String(nowBrasilia.getMinutes()).padStart(2, "0")}`;
    const workingDays = hoursContext.working_days;
    const openTime = hoursContext.business_hours_start;
    const closeTime = hoursContext.business_hours_end;
    const isWorkingDay = workingDays.includes(dayOfWeek);
    const isWeekend = !isWorkingDay && hoursContext.weekend_hours_enabled;
    let isOpen = false;
    let scheduleDesc = "";

    const dayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    const workingDayNames = workingDays.map((d: number) => dayNames[d]).join(", ");

    if (isWorkingDay) {
      isOpen = currentTime >= openTime.substring(0, 5) && currentTime < closeTime.substring(0, 5);
      scheduleDesc = `Dias úteis (${workingDayNames}): ${openTime.substring(0, 5)}–${closeTime.substring(0, 5)}`;
    } else if (isWeekend) {
      const wkStart = hoursContext.weekend_hours_start;
      const wkEnd = hoursContext.weekend_hours_end;
      isOpen = currentTime >= wkStart.substring(0, 5) && currentTime < wkEnd.substring(0, 5);
      scheduleDesc = `Dias úteis (${workingDayNames}): ${openTime.substring(0, 5)}–${closeTime.substring(0, 5)}\nFim de semana: ${wkStart.substring(0, 5)}–${wkEnd.substring(0, 5)}`;
    } else {
      scheduleDesc = `Dias úteis (${workingDayNames}): ${openTime.substring(0, 5)}–${closeTime.substring(0, 5)}`;
    }

    // Even on working day, if outside hours, still closed
    if (isWorkingDay && !(currentTime >= openTime.substring(0, 5) && currentTime < closeTime.substring(0, 5))) {
      isOpen = false;
    }

    // Format current date/time
    const dateFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const formattedNow = dateFormatter.format(new Date());

    // Get next open slot if closed
    let nextOpeningStr = "";
    if (!isOpen) {
      const { data: nextSlot, error: nextSlotError } = await supabase.rpc("get_next_open_slot", { p_organization_id: organization_id, p_offset_days: 1 });
      if (nextSlotError) {
        console.warn(`[ai-agent-respond] Could not resolve next open slot for org ${organization_id}: ${nextSlotError.message}`);
      } else if (nextSlot) {
        const nextDate = new Date(nextSlot);
        const nextFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        nextOpeningStr = nextFormatter.format(nextDate);
      }
    }

    const isMediaMsg = (t: string) => ["audio", "image", "video"].includes(t);
    const mediaLabelFor = (t: string) => t === "audio" ? "Áudio transcrito" : t === "image" ? "Imagem - descrição" : "Vídeo - descrição";
    const mediaPlaceholderFor = (t: string) => t === "audio" ? "[áudio enviado pelo cliente, conteúdo não disponível]" : t === "image" ? "[imagem enviada pelo cliente, conteúdo não disponível]" : "[vídeo enviado pelo cliente, conteúdo não disponível]";
    const isDefaultMediaContent = (content: string, t: string) => {
      const normalized = content.trim().toLowerCase();
      return !normalized || normalized === "mídia" || normalized === t || normalized === "audio" || normalized === "áudio" || normalized === "imagem" || normalized === "vídeo" || normalized === "video";
    };
    const getMediaCaptionForAi = (m: any, fallbackCaption = "") => {
      const dbCaption = (m.content || "").trim();
      const payloadCaption = (fallbackCaption || "").trim();
      return !isDefaultMediaContent(dbCaption, m.message_type)
        ? dbCaption
        : !isDefaultMediaContent(payloadCaption, m.message_type)
          ? payloadCaption
          : "";
    };
    const formatMediaForAi = (m: any, fallbackCaption = "") => {
      const mediaPart = m.transcription
        ? `[${mediaLabelFor(m.message_type)}]: ${m.transcription}`
        : mediaPlaceholderFor(m.message_type);
      const caption = getMediaCaptionForAi(m, fallbackCaption);
      return caption
        ? `[Legenda/pergunta do cliente enviada junto com a mídia — PRIORIDADE]: ${caption}\n${mediaPart}`
        : mediaPart;
    };

    // === Espera transcrição da mídia atual ANTES de montar o histórico ===
    // Se a mensagem atual é mídia (áudio/imagem/vídeo), aguardamos até 30s pela
    // transcrição (gerada em paralelo por `transcribe-media`). Só respondemos
    // depois de ter o conteúdo — IA não responde "no escuro" para mídia.
    const isMediaType = message_type && message_type !== "text" && isMediaMsg(message_type);
    let currentMediaMessageId: string | null = null;
    let currentMediaMessage: any = null;
    if (isMediaType) {
      let latestMediaInbound: any = null;
      if (message_id) {
        const { data } = await supabase
          .from("messages")
          .select("id, content, transcription, message_type")
          .eq("id", message_id)
          .eq("contact_id", contact_id)
          .eq("direction", "inbound")
          .maybeSingle();
        latestMediaInbound = data;
      }
      if (!latestMediaInbound) {
        const { data } = await supabase
          .from("messages")
          .select("id, content, transcription, message_type")
          .eq("contact_id", contact_id)
          .eq("direction", "inbound")
          .in("message_type", ["audio", "image", "video"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        latestMediaInbound = data;
      }

      currentMediaMessage = latestMediaInbound;
      currentMediaMessageId = latestMediaInbound?.id || null;

      if (!latestMediaInbound?.id) {
        console.warn(`[ai-agent-respond] Mensagem de mídia atual não encontrada para contact=${contact_id}, message_id=${message_id || "none"} — IA não responderá agora.`);
        return new Response(
          JSON.stringify({ skipped: true, reason: "current_media_message_not_found", message_id: message_id || null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (latestMediaInbound?.id && !latestMediaInbound.transcription) {
        console.log(`[ai-agent-respond] Aguardando transcrição da mensagem ${latestMediaInbound.id} (${latestMediaInbound.message_type})...`);
        let got = false;
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise(r => setTimeout(r, 2000));
          const { data: refreshed } = await supabase
            .from("messages")
            .select("transcription")
            .eq("id", latestMediaInbound.id)
            .single();
          if (refreshed?.transcription) {
            console.log(`[ai-agent-respond] Transcrição pronta após ${(attempt + 1) * 2}s`);
            currentMediaMessage = { ...latestMediaInbound, transcription: refreshed.transcription };
            got = true;
            break;
          }
        }
        if (!got) {
          console.warn(`[ai-agent-respond] Transcrição indisponível após 30s para a mensagem ${latestMediaInbound.id} — IA não responderá agora.`);
          return new Response(
            JSON.stringify({ skipped: true, reason: "transcription_pending", message_id: latestMediaInbound.id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Busca histórico DEPOIS da espera, para garantir que transcrições já estejam disponíveis
    const { data: messages } = await supabase.from("messages").select("id, content, direction, message_type, media_url, created_at, transcription").eq("contact_id", contact_id).order("created_at", { ascending: false }).limit(agent.max_context_messages || 10);
    const chatHistory = (messages || []).reverse()
      .filter((m: any) => !(m.direction === "outbound" && isMediaMsg(m.message_type)))
      .map((m: any) => {
        let content = "";
        if (isMediaMsg(m.message_type)) {
          content = formatMediaForAi(m, currentMediaMessageId === m.id ? message_content : "");
        } else {
          content = m.content || "";
        }
        return { role: m.direction === "inbound" ? "user" : "assistant", content };
      });

    // Build tools: automation trigger + MCP tools (filtradas por especialização do agente)
    const [{ data: automations }, { data: catalogSettings }, { data: orgMembers }] = await Promise.all([
      supabase.from("automations").select("id, name").eq("organization_id", organization_id).eq("is_active", true),
      supabase.from("catalog_settings").select("is_published").eq("organization_id", organization_id).maybeSingle(),
      supabase.from("organization_members").select("user_id, role").eq("organization_id", organization_id),
    ]);
    const catalogEnabled = catalogSettings?.is_published === true;
    const enabledTools: string[] = Array.isArray(agent.enabled_tools) ? agent.enabled_tools : [];
    const baseTools = enabledTools.length > 0 ? MCP_TOOLS.filter((t) => enabledTools.includes(t.function.name)) : MCP_TOOLS;
    const tools: any[] = [...baseTools];
    let teamMembers: { user_id: string; full_name: string | null; role: string }[] = [];
    if (orgMembers && orgMembers.length > 0 && baseTools.some((t) => t.function?.name === "assign_contact")) {
      const { data: memberProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", orgMembers.map((m: any) => m.user_id));
      const nameByUserId = new Map((memberProfiles || []).map((p: any) => [p.user_id, p.full_name]));
      teamMembers = orgMembers.map((m: any) => ({ user_id: m.user_id, full_name: nameByUserId.get(m.user_id) || null, role: m.role }));
    }
    if (catalogEnabled) tools.push(...CATALOG_TOOLS);
    if (automations && automations.length > 0) {
      const desc = automations.map((a: any) => `- "${a.name}" (id: ${a.id})`).join("\n");
      tools.push({
        type: "function",
        function: {
          name: "trigger_automation",
          description: `Transfere o atendimento para um fluxo de automação. Automações disponíveis:\n${desc}`,
          parameters: { type: "object", properties: { automation_id: { type: "string", enum: automations.map((a: any) => a.id) }, farewell_message: { type: "string" } }, required: ["automation_id", "farewell_message"] },
        },
      });
    }

    // System prompt
    let systemPrompt = agent.system_prompt || "Você é um assistente virtual prestativo.";
    systemPrompt += `\n\n## REGRAS DE SEGURANÇA (OBRIGATÓRIAS):
1. Responda APENAS sobre assuntos da empresa. Recuse educadamente temas fora de escopo.
2. NUNCA invente informações sobre produtos, preços ou disponibilidade.
3. NUNCA finja ser humano. Se perguntado, diga que é um assistente virtual.
4. Mantenha tom profissional e cordial.`;
    if (tools.some(t => t.function?.name === "trigger_automation")) {
      systemPrompt += `\n\n## TRANSFERÊNCIA: Use trigger_automation quando o cliente precisar de atendimento humano. Envie despedida antes.`;
    }
    if (baseTools.length > 0) {
      systemPrompt += `\n\n## FERRAMENTAS DO CRM: Você pode executar ações no CRM como adicionar/remover tags, mover no funil, buscar contatos (apenas as ferramentas disponíveis para você). Use quando o contexto da conversa indicar (ex: cliente interessado → adicionar tag "interessado"). O contact_id do cliente atual é: ${contact_id}`;
    }
    if (teamMembers.length > 0) {
      const teamDesc = teamMembers.map((m) => `- ${m.full_name || "Sem nome"} (user_id: ${m.user_id}, papel: ${m.role})`).join("\n");
      systemPrompt += `\n\n## ATRIBUIÇÃO DE RESPONSÁVEL (assign_contact)\nEquipe disponível:\n${teamDesc}\nAssim que o lead estiver qualificado (demonstrou interesse real, respondeu as perguntas de qualificação, ou pediu para falar com alguém/fechar negócio), chame assign_contact com o contact_id do cliente atual e o user_id do responsável adequado da lista acima${teamMembers.length === 1 ? " (único membro da equipe)" : ""}. Não deixe o contato sem responsável ao final do atendimento.`;
    }

    // Business hours / store status block
    systemPrompt += `\n\n## HORÁRIO E STATUS DE FUNCIONAMENTO
Data/hora atual: ${formattedNow} (Brasília)
Status: ${isOpen ? "ABERTO" : "FECHADO"}
Expediente: ${scheduleDesc}`;
    if (!isOpen && nextOpeningStr) {
      systemPrompt += `\nPróxima abertura: ${nextOpeningStr}`;
    }
    const closedInstructions = 'Estamos fechados no momento, mas você já pode adiantar sua demanda (enviar detalhes, dúvidas ou informações relevantes) para agilizar o atendimento quando a equipe retornar.';
    systemPrompt += `\n\nQuando estiver FECHADO: ${closedInstructions}`;

    if (agent.about_company) systemPrompt += `\n\nSobre a empresa:\n${agent.about_company}`;
    if (agent.faq_content) systemPrompt += `\n\nFAQ:\n${agent.faq_content}`;
    if (catalogEnabled) {
      systemPrompt += `\n\n## CATÁLOGO DE PRODUTOS\nA empresa possui catálogo ativo. Use as ferramentas:\n- search_catalog: busca imóveis/produtos por filtros\n- send_media_gallery: envia texto + fotos do imóvel. O campo description é OBRIGATÓRIO — escreva nele o resumo do imóvel (nome, preço, características) E ao final inclua uma pergunta de engajamento como "Esse imóvel se encaixa no que você está buscando?" ou "Gostaria de agendar uma visita?". Esse texto chegará ao cliente antes das fotos.\n- update_lead_fields: salva qualificação do lead no CRM\n\nFLUXO: quando o cliente informar tipo + orçamento, chame search_catalog IMEDIATAMENTE. Ao encontrar imóvel, chame send_media_gallery com o resumo + pergunta. NUNCA envie mensagem avisando que vai buscar antes de buscar.\nATENÇÃO: se o histórico já mostra que você apresentou um imóvel (sua mensagem anterior contém nome, preço e características), NÃO chame send_media_gallery de novo — avance para próximos passos: agendar visita, coletar dados de contato ou responder dúvidas.`;
    }
    systemPrompt += `\n\nNome do cliente: ${contact.name}\nTelefone: ${contact.phone}`;

    if (isMediaType && currentMediaMessage) {
      const currentMediaCaption = getMediaCaptionForAi(currentMediaMessage, message_content);
      systemPrompt += `\n\n## MENSAGEM ATUAL COM MÍDIA (OBRIGATÓRIO)
Esta é a mensagem mais recente do cliente e deve ter prioridade sobre qualquer histórico anterior.
${currentMediaCaption ? `A legenda/pergunta escrita pelo cliente na mídia é: "${currentMediaCaption}"\n` : ""}Ao responder, use a legenda/pergunta da mídia atual como intenção principal do cliente. Não use respostas anteriores do assistente para inferir o assunto atual se elas conflitarem com a mídia atual.`;
    }

    // === Estilo conversacional: dividir respostas longas em várias mensagens ===
    if (agent.split_long_messages !== false) {
      const targetChars = Number(agent.split_target_chars) || 350;
      const maxParts = Number(agent.split_max_parts) || 3;
      systemPrompt += `\n\n## ESTILO DE MENSAGEM (OBRIGATÓRIO)
Responda de forma natural e conversacional, como uma pessoa digitando no WhatsApp. Evite blocos longos de texto.
SEJA BREVE POR PADRÃO: a maioria das respostas de um humano no WhatsApp é curta — uma palavra, uma frase, uma confirmação ("sim", "temos sim", "fechado"). Não justifique, explique ou repita contexto que o cliente já sabe. Só escreva uma resposta mais longa quando o conteúdo exigir de fato (ex: enviar uma tabela/catálogo completo que o cliente pediu, explicar um processo com várias etapas, listar várias opções).
Quando precisar transmitir várias ideias, separe-as em mensagens curtas usando exatamente a marca \`[[SPLIT]]\` entre elas (sem espaços extras na própria marca).
Cada parte deve ter no máximo ~${targetChars} caracteres e o total deve ter no máximo ${maxParts} partes.
Não use [[SPLIT]] dentro de listas, blocos de código, URLs, ou em frases unitárias curtas. Se a resposta toda for curta (<${targetChars} chars), envie em uma só mensagem, sem [[SPLIT]].`;
    }

    // === Exemplos de treinamento: injeta conversas reais para espelhar tom de voz ===
    try {
      const { data: trainingConvs } = await supabase
        .from("ai_training_conversations")
        .select("id, title, ai_training_messages(role, content, position)")
        .eq("organization_id", organization_id)
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (trainingConvs && trainingConvs.length > 0) {
        const examplesBlock = trainingConvs.map((conv: any, ci: number) => {
          const msgs = (conv.ai_training_messages || [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((m: any) => `${m.role === "inbound" ? "Cliente" : "Atendente"}: ${m.content}`)
            .join("\n");
          return `--- Exemplo ${ci + 1}${conv.title ? ` (${conv.title})` : ""} ---\n${msgs}`;
        }).join("\n\n");

        systemPrompt += `\n\n## EXEMPLOS REAIS DE ATENDIMENTO (use como referência de tom e estilo)\nEstes são exemplos reais de conversas da empresa. Use-os como referência para espelhar o tom de voz, a forma de redigir mensagens e o estilo de comunicação dos atendentes. NÃO invente informações baseado nesses exemplos — só o estilo importa.\n\n${examplesBlock}`;
      }
    } catch (e) {
      console.warn("[ai-agent-respond] Failed to load training examples:", e);
    }

    // === Curadoria de análises: injeta regras + exemplos para a tool register_analysis ===
    try {
      const [{ data: curationRules }, { data: curationExamples }] = await Promise.all([
        supabase.from("analysis_curation_rules").select("rules_text").eq("organization_id", organization_id).maybeSingle(),
        supabase.from("analysis_curation_examples").select("conversation_excerpt, wrong_values, correct_values, note").eq("organization_id", organization_id).order("created_at", { ascending: false }).limit(10),
      ]);
      const rulesText = (curationRules?.rules_text || "").trim();
      const examplesBlock = (curationExamples || []).map((ex: any, i: number) => {
        const lines = [`Exemplo ${i + 1}:`];
        if (ex.conversation_excerpt) lines.push(`Conversa: ${String(ex.conversation_excerpt).slice(0, 600)}`);
        if (ex.wrong_values) lines.push(`IA marcou (errado): ${JSON.stringify(ex.wrong_values)}`);
        lines.push(`Correto: ${JSON.stringify(ex.correct_values)}`);
        if (ex.note) lines.push(`Observação: ${ex.note}`);
        return lines.join("\n");
      }).join("\n\n");
      if (rulesText || examplesBlock) {
        systemPrompt += `\n\n## CURADORIA DE ANÁLISES (use ao chamar register_analysis):`;
        if (rulesText) systemPrompt += `\n\nDIRETRIZES DA EQUIPE (sempre seguir):\n${rulesText}`;
        if (examplesBlock) systemPrompt += `\n\nEXEMPLOS DE CORREÇÕES ANTERIORES (aprenda com elas):\n${examplesBlock}`;
      }
    } catch (e) {
      console.warn("[ai-agent-respond] Failed to load curation context:", e);
    }


    const openaiMessages: any[] = [{ role: "system", content: systemPrompt }, ...chatHistory];

    // Handle current message
    // Para mídia, o conteúdo (transcrição) já está embutido no chatHistory — sem duplicação.
    // Só fazemos push aqui para mensagens de texto que ainda não estejam no histórico.
    if (isMediaType && currentMediaMessage) {
      const currentMediaContent = formatMediaForAi(currentMediaMessage, message_content);
      const currentMediaCaption = getMediaCaptionForAi(currentMediaMessage, message_content);
      const currentAlreadyInHistory = chatHistory.some((m: any) => m.role === "user" && m.content === currentMediaContent);
      if (!currentAlreadyInHistory) {
        console.warn(`[ai-agent-respond] Mídia atual ${currentMediaMessage.id} não entrou no histórico limitado; adicionando ao contexto com legenda/transcrição.`);
        openaiMessages.push({ role: "user", content: currentMediaContent });
      } else if (currentMediaCaption) {
        openaiMessages.push({ role: "user", content: `Reforço da mensagem atual: responda à legenda/pergunta enviada junto com a mídia: "${currentMediaCaption}"` });
      }
    } else if (message_type === "text" && message_content) {
      const lastHistoryMsg = chatHistory[chatHistory.length - 1];
      if (!lastHistoryMsg || lastHistoryMsg.content !== message_content) {
        openaiMessages.push({ role: "user", content: message_content });
      }
    }

    // Call OpenAI with tool loop (max 5 iterations for MCP tools)
    const useModel = agent.model || "gpt-4o-mini";

    // === DIAGNÓSTICO: log do que vai ao OpenAI (mídia) ===
    try {
      console.log(`[ai-agent-respond][DIAG] model=${useModel} isMediaType=${isMediaType} message_id=${message_id || "none"} currentMediaMessageId=${currentMediaMessageId || "none"}`);
      if (currentMediaMessage) {
        console.log(`[ai-agent-respond][DIAG] currentMediaMessage.content=${JSON.stringify((currentMediaMessage.content || "").slice(0, 200))}`);
        console.log(`[ai-agent-respond][DIAG] currentMediaMessage.transcription=${JSON.stringify((currentMediaMessage.transcription || "").slice(0, 200))}`);
      }
      const tail = openaiMessages.slice(-4).map((m: any, i: number) => {
        const c = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return `  [${i}] role=${m.role} content=${JSON.stringify((c || "").slice(0, 500))}`;
      }).join("\n");
      console.log(`[ai-agent-respond][DIAG] últimas mensagens enviadas ao OpenAI:\n${tail}`);
    } catch (e) {
      console.warn("[ai-agent-respond][DIAG] log falhou:", e);
    }

    for (let i = 0; i < 5; i++) {
      const openaiBody: any = { model: useModel, messages: openaiMessages, max_tokens: 1024, temperature: 0.7, tools, tool_choice: "auto" };

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(openaiBody),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        const classified = classifyOpenAiError(openaiRes.status, errText);
        console.error(`[ai-agent-respond] OpenAI error (${classified.code}):`, openaiRes.status, classified.adminMessage, errText);
        // Não derruba o webhook (evita 500/retries). Retorna 200 sem enviar mensagem ao contato.
        return new Response(
          JSON.stringify({ skipped: true, reason: classified.code, admin_message: classified.adminMessage }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const completion = await openaiRes.json();
      const choice = completion.choices?.[0];
      const msg = choice?.message;
      openaiMessages.push(msg);

      if (!msg?.tool_calls?.length) {
        // Final text response — send via WhatsApp
        const aiReply = msg?.content;
        if (!aiReply) {
          return new Response(JSON.stringify({ error: "No response from AI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const whatsappMessageId = await sendAiReplyParts(supabase, organization_id, contact.phone, aiReply, contact_id, agent);

        // Event classifier: detect sales/tension and notify manager (fire-and-forget)
        const classifyAndNotify = async () => {
          try {
            const recentForClassify = openaiMessages.slice(-8).map((m: any) => `${m.role === "user" ? "Cliente" : "IA"}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`).join("\n");
            const classifyRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: 'Analise a conversa e retorne JSON: {"event": "sale_detected" | "tension_detected" | "none", "summary": "resumo em 1 frase"}. "sale_detected" quando uma venda foi fechada ou pagamento combinado. "tension_detected" quando o cliente está visivelmente insatisfeito, irritado ou ameaçando cancelar.' },
                  { role: "user", content: recentForClassify },
                ],
                response_format: { type: "json_object" },
                max_tokens: 80,
                temperature: 0,
              }),
            });
            if (!classifyRes.ok) return;
            const classifyData = await classifyRes.json();
            const classified = JSON.parse(classifyData.choices?.[0]?.message?.content || "{}");
            if (!classified.event || classified.event === "none") return;

            // Call system-agent-notify
            await fetch(`${supabaseUrl}/functions/v1/system-agent-notify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
              body: JSON.stringify({
                organization_id,
                event_type: classified.event,
                context: classified.summary || "",
                contact_id,
                conversation_snapshot: recentForClassify,
              }),
            });
          } catch (e) {
            console.error("[ai-agent-respond] event classifier error:", e);
          }
        };

        // @ts-ignore
        if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(classifyAndNotify());
        } else {
          classifyAndNotify().catch(() => {});
        }

        return new Response(JSON.stringify({ success: true, reply: aiReply, whatsapp_message_id: whatsappMessageId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Process tool calls. trigger_automation termina a conversa, então é tratada
      // por último — se vier no mesmo turno que outras tools (ex: add_tag, set_custom_field),
      // essas precisam executar primeiro, senão ficam abandonadas (a function retorna
      // imediatamente ao processar trigger_automation).
      let pendingAutomationCall: { automation_id: string; farewell_message?: string } | null = null;
      for (const toolCall of msg.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments || "{}");

        if (fnName === "trigger_automation") {
          pendingAutomationCall = fnArgs;
          continue;
        }

        // Catalog tools
        if (fnName === "search_catalog") {
          const results = await executeSearchCatalog(supabase, organization_id, fnArgs);
          openaiMessages.push({ role: "tool", tool_call_id: toolCall.id, content: results.length > 0 ? JSON.stringify(results) : JSON.stringify({ message: "Nenhum produto encontrado com esses filtros." }) });
          continue;
        }
        if (fnName === "send_media_gallery") {
          const r = await executeSendMediaGallery(supabase, organization_id, contact_id, contact.phone, fnArgs.product_id, fnArgs.description || "", agent);
          // Descrição já foi enviada e fotos estão na fila — retorna sem novo turno do modelo
          return new Response(JSON.stringify({ success: true, images_scheduled: r.scheduled, product: r.product_name }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (fnName === "update_lead_fields") {
          await executeUpdateLeadFields(supabase, contact_id, fnArgs.fields || {});
          openaiMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: true }) });
          continue;
        }

        // MCP tool — execute and feed result back
        let result: any;
        try {
          result = await executeMcpTool(supabase, organization_id, fnName, fnArgs);
          console.log(`MCP tool ${fnName} executed successfully`);
        } catch (e) {
          result = { error: (e as Error).message };
          console.error(`MCP tool ${fnName} error:`, (e as Error).message);
        }
        openaiMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }

      if (pendingAutomationCall) {
        const { automation_id, farewell_message } = pendingAutomationCall;
        console.log(`AI triggering automation ${automation_id} for contact ${contact_id}`);
        if (farewell_message) await sendWhatsAppMessage(supabase, organization_id, contact.phone, farewell_message, contact_id, agent.id, agent.name || null);
        await supabase.from("contacts").update({ ai_enabled: false }).eq("id", contact_id);
        const automationUrl = `${supabaseUrl}/functions/v1/automation-engine`;
        await fetch(automationUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ contact_id, organization_id, event_type: "manual_trigger", automation_id, message_content: message_content || "" }),
        });
        return new Response(JSON.stringify({ success: true, action: "automation_triggered", automation_id, farewell_message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // If we exhausted iterations, return error
    return new Response(JSON.stringify({ error: "Too many tool call iterations" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-agent-respond error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
