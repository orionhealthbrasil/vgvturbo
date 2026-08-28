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
  const v = value?.trim();
  return v ? v : null;
}

async function resolveOpenAiKey(supabase: any, organizationId: string): Promise<string | null> {
  const [orgRes, legacyRes] = await Promise.all([
    supabase.from("organizations").select("openai_api_key").eq("id", organizationId).maybeSingle(),
    supabase.from("ai_agent_config").select("openai_api_key").eq("organization_id", organizationId).maybeSingle(),
  ]);
  return normalizeOpenAiKey(orgRes.data?.openai_api_key) || normalizeOpenAiKey(legacyRes.data?.openai_api_key);
}

function buildOperatingHoursLine(org: any): string {
  const days = org?.working_days || [1, 2, 3, 4, 5];
  const start = (org?.business_hours_start || "08:00").substring(0, 5);
  const end = (org?.business_hours_end || "18:00").substring(0, 5);
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dow = now.getDay();
  const hh = now.getHours() + now.getMinutes() / 60;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const open = days.includes(dow) && hh >= sh + sm / 60 && hh < eh + em / 60;
  const dayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Data e hora atuais (fuso de São Paulo / Brasília): ${dayNames[dow]}, ${dateStr} às ${timeStr}.\nStatus da empresa neste momento: ${open ? "ABERTO" : "FECHADO"}.\nHorário de funcionamento: ${start} às ${end}.`;
}

// ===== WhatsApp senders =====

async function getWhatsAppInstance(supabase: any, orgId: string): Promise<any | null> {
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("instance_name, api_key, base_url")
    .eq("organization_id", orgId)
    .single();
  return instance?.base_url ? instance : null;
}

async function sendWhatsApp(supabase: any, orgId: string, contactId: string, phone: string, message: string): Promise<boolean> {
  const instance = await getWhatsAppInstance(supabase, orgId);
  if (!instance) {
    console.error("[ai-sdr-generate] No WhatsApp instance/base_url for org", orgId);
    return false;
  }
  const formattedPhone = formatPhone(phone);
  const resp = await fetch(`${instance.base_url}/send/text`, {
    method: "POST",
    headers: { apikey: instance.api_key, "Content-Type": "application/json" },
    body: JSON.stringify({ number: formattedPhone, text: message }),
  });
  if (!resp.ok) {
    console.error("[ai-sdr-generate] WhatsApp send failed:", resp.status, await resp.text());
    return false;
  }
  await supabase.from("messages").insert({
    contact_id: contactId,
    organization_id: orgId,
    content: message,
    message_type: "text",
    direction: "outbound",
    status: "sent",
    sent_by_user_id: null,
  });
  await supabase.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contactId);
  return true;
}

async function sendWhatsAppImage(
  supabase: any,
  orgId: string,
  contactId: string,
  phone: string,
  imageUrl: string,
  caption?: string,
): Promise<boolean> {
  const instance = await getWhatsAppInstance(supabase, orgId);
  if (!instance) return false;
  const formattedPhone = formatPhone(phone);
  let resp: Response;
  try {
    resp = await fetch(`${instance.base_url}/send/media`, {
      method: "POST",
      headers: { apikey: instance.api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ number: formattedPhone, type: "image", url: imageUrl, caption: caption || "" }),
    });
  } catch (err) {
    console.error("[ai-sdr-generate] WhatsApp image send error:", err);
    return false;
  }
  if (!resp.ok) {
    console.error("[ai-sdr-generate] WhatsApp image send failed:", resp.status, await resp.text());
    return false;
  }
  await supabase.from("messages").insert({
    contact_id: contactId,
    organization_id: orgId,
    content: caption || imageUrl,
    message_type: "image",
    direction: "outbound",
    status: "sent",
    sent_by_user_id: null,
  });
  return true;
}

async function sendInstagram(supabase: any, orgId: string, contactId: string, message: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/instagram-send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ contact_id: contactId, organization_id: orgId, message }),
    });
    return resp.ok;
  } catch (e) {
    console.error("[ai-sdr-generate] Instagram send error:", e);
    return false;
  }
}

// ===== Reply splitter =====
function splitAiReply(text: string, opts: { targetChars: number; maxParts: number }): string[] {
  const targetChars = Math.max(80, opts.targetChars || 350);
  const maxParts = Math.max(1, Math.min(8, opts.maxParts || 3));
  const clean = (text || "").trim();
  if (!clean) return [];
  const codeBlocks: string[] = [];
  const placeheld = clean.replace(/```[\s\S]*?```/g, (m) => { codeBlocks.push(m); return ` CODE${codeBlocks.length - 1} `; });
  const restore = (s: string) => s.replace(/ CODE(\d+) /g, (_, i) => codeBlocks[Number(i)] || "");
  let parts: string[] = [];
  if (placeheld.includes("[[SPLIT]]")) {
    parts = placeheld.split(/\s*\[\[SPLIT\]\]\s*/).map(p => p.trim()).filter(Boolean);
  } else if (placeheld.length <= targetChars * 1.3) {
    parts = [placeheld];
  } else {
    const paragraphs = placeheld.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const buckets: string[] = [];
    let current = "";
    const pushCurrent = () => { if (current.trim()) buckets.push(current.trim()); current = ""; };
    for (const para of paragraphs) {
      if (para.length > targetChars * 1.3) {
        pushCurrent();
        const sentences = para.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z])/);
        for (const sent of sentences) {
          if ((current + " " + sent).trim().length > targetChars && current) pushCurrent();
          current = current ? `${current} ${sent}` : sent;
        }
        pushCurrent();
      } else {
        if ((current + "\n\n" + para).trim().length > targetChars && current) pushCurrent();
        current = current ? `${current}\n\n${para}` : para;
      }
    }
    pushCurrent();
    parts = buckets;
  }
  if (parts.length > maxParts) {
    const head = parts.slice(0, maxParts - 1);
    const tail = parts.slice(maxParts - 1).join("\n\n");
    parts = [...head, tail];
  }
  return parts.map(restore).map(p => p.trim()).filter(Boolean);
}

async function sendReplyParts(
  supabase: any,
  orgId: string,
  contactId: string,
  channel: string,
  phone: string,
  fullText: string,
  agent: any,
): Promise<boolean> {
  const splitEnabled = agent?.split_long_messages !== false;
  const targetChars = Number(agent?.split_target_chars) || 350;
  const maxParts = Number(agent?.split_max_parts) || 3;
  const delayMs = Math.max(0, Number(agent?.split_delay_ms) || 1200);
  const parts = splitEnabled ? splitAiReply(fullText, { targetChars, maxParts }) : [fullText.trim()];
  if (parts.length === 0) return false;

  const sendOne = (m: string) => channel === "instagram"
    ? sendInstagram(supabase, orgId, contactId, m)
    : sendWhatsApp(supabase, orgId, contactId, phone, m);

  const firstOk = await sendOne(parts[0]);
  if (!firstOk || parts.length === 1) return firstOk;

  const sendRest = async () => {
    for (let i = 1; i < parts.length; i++) {
      const jitter = delayMs * (0.8 + Math.random() * 0.4);
      await new Promise((r) => setTimeout(r, Math.round(jitter)));
      try { await sendOne(parts[i]); } catch (e) { console.error("[ai-sdr-generate] split-send error", i, e); }
    }
  };
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(sendRest());
  } else {
    sendRest().catch((e) => console.error("[ai-sdr-generate] sendRest fallback", e));
  }
  return true;
}

// ===== Catalog tool executors =====

async function executeSearchCatalog(
  supabase: any,
  orgId: string,
  args: { query?: string; category?: string; price_min?: number; price_max?: number; tags?: string[]; listing_type?: string; city?: string; neighborhood?: string; limit?: number },
): Promise<any[]> {
  let q = supabase
    .from("products")
    .select("id, name, description, base_price, compare_at_price, images, tags, has_variants, category_id, listing_type, city, neighborhood, product_categories(name)")
    .eq("organization_id", orgId)
    .eq("is_available", true)
    .limit(Math.min(args.limit || 5, 10));

  if (args.price_min != null) q = q.gte("base_price", args.price_min);
  if (args.price_max != null) q = q.lte("base_price", args.price_max);
  if (args.query) q = q.ilike("name", `%${args.query}%`);
  if (args.tags && args.tags.length > 0) q = q.overlaps("tags", args.tags);
  if (args.listing_type) q = q.eq("listing_type", args.listing_type);
  if (args.city) q = q.ilike("city", `%${args.city}%`);
  if (args.neighborhood) q = q.ilike("neighborhood", `%${args.neighborhood}%`);
  if (args.category) {
    const { data: cat } = await supabase
      .from("product_categories")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", `%${args.category}%`)
      .maybeSingle();
    if (cat?.id) q = q.eq("category_id", cat.id);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[ai-sdr-generate] search_catalog error:", error);
    return [];
  }

  // Simplify images for AI: return only URLs in order
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.base_price),
    compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
    category: p.product_categories?.name || null,
    listing_type: p.listing_type || 'sale',
    city: p.city || null,
    neighborhood: p.neighborhood || null,
    tags: p.tags || [],
    has_variants: p.has_variants,
    image_count: Array.isArray(p.images) ? p.images.length : 0,
    images: Array.isArray(p.images)
      ? [...p.images].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).map((img: any) => img.url)
      : [],
  }));
}

async function executeSendMediaGallery(
  supabase: any,
  orgId: string,
  contact: any,
  args: { product_id: string; intro_message?: string },
): Promise<{ sent: number; product_name: string }> {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, description, base_price, images")
    .eq("id", args.product_id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error || !product) {
    console.error("[ai-sdr-generate] send_media_gallery: product not found", args.product_id);
    return { sent: 0, product_name: "" };
  }

  const images: { url: string; position: number }[] = Array.isArray(product.images)
    ? [...product.images].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    : [];

  if (images.length === 0) {
    console.warn("[ai-sdr-generate] send_media_gallery: no images for product", args.product_id);
    return { sent: 0, product_name: product.name };
  }

  const MAX_IMAGES = 2;
  const imagesToSend = images.slice(0, MAX_IMAGES);
  const priceFormatted = `R$ ${Number(product.base_price).toFixed(2).replace(".", ",")}`;

  // Send images via EdgeRuntime.waitUntil so the instance stays alive after the HTTP
  // response is returned — text arrives immediately, images send in background.
  const sendImagesInBackground = async () => {
    for (let i = 0; i < imagesToSend.length; i++) {
      const img = imagesToSend[i];
      const caption = i === 0 ? `${product.name} — ${priceFormatted}` : undefined;
      if (i > 0) await new Promise((r) => setTimeout(r, 3000));
      await sendWhatsAppImage(supabase, orgId, contact.id, contact.phone, img.url, caption)
        .catch((err: unknown) => console.error("[ai-sdr-generate] background image send failed:", err));
    }
  };

  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    (EdgeRuntime as any).waitUntil(sendImagesInBackground());
  } else {
    sendImagesInBackground().catch(() => {});
  }

  console.log(`[ai-sdr-generate] send_media_gallery: scheduled ${imagesToSend.length} images (fire-and-forget) for "${product.name}"`);
  return { sent: imagesToSend.length, product_name: product.name };
}

async function executeUpdateLeadFields(
  supabase: any,
  contactId: string,
  fields: Record<string, any>,
): Promise<void> {
  if (!fields || Object.keys(fields).length === 0) return;

  // Merge into existing metadata
  const { data: current } = await supabase
    .from("contacts")
    .select("metadata")
    .eq("id", contactId)
    .maybeSingle();

  const existing = current?.metadata || {};
  const updated = {
    ...existing,
    lead_qualification: {
      ...(existing.lead_qualification || {}),
      ...fields,
      updated_at: new Date().toISOString(),
    },
  };

  await supabase.from("contacts").update({ metadata: updated }).eq("id", contactId);
  console.log(`[ai-sdr-generate] update_lead_fields: saved for contact ${contactId}`, fields);
}

// ===== Tool definitions =====
function buildTools(
  automations: { id: string; name: string }[],
  catalogEnabled: boolean,
) {
  const automationList = automations.length > 0
    ? `Automações disponíveis:\n${automations.map(a => `- "${a.name}" (id: ${a.id})`).join("\n")}`
    : "Nenhuma automação ativa configurada.";

  const base = [
    {
      type: "function",
      function: {
        name: "send_message",
        description: "Envia uma mensagem de texto para o lead. Use para apresentações, perguntas de qualificação, confirmações, alternativas de produto ou qualquer comunicação textual.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Texto da mensagem. Natural, em português brasileiro, como um vendedor humano escreveria no WhatsApp. Sem markdown. Use [[SPLIT]] para separar partes se necessário.",
            },
          },
          required: ["message"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "close_conversation",
        description: "Fecha a conversa sem enviar mensagem. Use quando o lead claramente não tem interesse ou a conversa chegou a um encerramento natural.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "trigger_automation",
        description: `Dispara uma automação para este contato. Use para transferir para humano ou executar um fluxo específico. ${automationList}`,
        parameters: {
          type: "object",
          properties: {
            automation_id: {
              type: "string",
              description: "UUID da automação a disparar.",
            },
          },
          required: ["automation_id"],
        },
      },
    },
  ];

  if (!catalogEnabled) return base;

  const catalogTools = [
    {
      type: "function",
      function: {
        name: "search_catalog",
        description: "Busca produtos/itens no catálogo da empresa com base em filtros. Use ANTES de recomendar qualquer produto para garantir que ele existe e está disponível. Retorna lista com id, nome, descrição, preço, imagens e tags.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Busca por nome ou palavras-chave do produto (ex: 'camisa', 'apartamento 2 quartos', 'SUV').",
            },
            category: {
              type: "string",
              description: "Nome da categoria para filtrar (ex: 'Roupas', 'Imóveis residenciais', 'Carros').",
            },
            price_min: {
              type: "number",
              description: "Preço mínimo em reais.",
            },
            price_max: {
              type: "number",
              description: "Preço máximo em reais.",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags para filtrar (ex: ['gospel', '2-quartos', 'piscina']).",
            },
            listing_type: {
              type: "string",
              enum: ["sale", "rent", "sale_rent"],
              description: "Filtrar por tipo de negociação: 'sale' (venda), 'rent' (aluguel), 'sale_rent' (ambos).",
            },
            city: {
              type: "string",
              description: "Cidade do imóvel (ex: 'Belém', 'Ananindeua').",
            },
            neighborhood: {
              type: "string",
              description: "Bairro do imóvel (ex: 'Nazaré', 'Umarizal', 'Marco').",
            },
            limit: {
              type: "number",
              description: "Quantidade máxima de resultados (padrão 5, máximo 10).",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "send_media_gallery",
        description: "Envia TODAS as fotos de um produto/imóvel/item específico para o lead. Use após identificar o produto de interesse pelo search_catalog. Envia as imagens em sequência com um pequeno intervalo entre elas.",
        parameters: {
          type: "object",
          properties: {
            product_id: {
              type: "string",
              description: "UUID do produto obtido pelo search_catalog.",
            },
            intro_message: {
              type: "string",
              description: "Mensagem de texto opcional a enviar ANTES das fotos (ex: 'Aqui estão as fotos do apartamento que separei pra você 👇').",
            },
          },
          required: ["product_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_lead_fields",
        description: "Registra informações de qualificação do lead no sistema CRM. Use para salvar dados importantes coletados durante a conversa: orçamento, tipo de interesse, produto preferido, etc. Pode ser chamado várias vezes ao longo da conversa.",
        parameters: {
          type: "object",
          properties: {
            fields: {
              type: "object",
              description: "Campos a salvar. Exemplos: { budget_min: 200000, budget_max: 400000, interest_type: 'compra', preferred_product_id: 'uuid', notes: 'prefere zona sul, 2 quartos' }",
              additionalProperties: true,
            },
          },
          required: ["fields"],
        },
      },
    },
  ];

  return [...base, ...catalogTools];
}

// ===== Tool executors (base) =====
async function executeCloseConversation(supabase: any, contactId: string): Promise<void> {
  await supabase.from("contacts").update({
    status: "closed",
    closed_at: new Date().toISOString(),
  }).eq("id", contactId);
  console.log(`[ai-sdr-generate] Conversation closed for contact ${contactId}`);
}

async function executeTriggerAutomation(
  supabase: any,
  contactId: string,
  organizationId: string,
  automationId: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/automation-engine`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ contact_id: contactId, organization_id: organizationId, automation_id: automationId }),
    });
    if (!resp.ok) {
      console.error("[ai-sdr-generate] trigger_automation failed:", resp.status, await resp.text());
    } else {
      console.log(`[ai-sdr-generate] Automation ${automationId} triggered for contact ${contactId}`);
    }
  } catch (e) {
    console.error("[ai-sdr-generate] trigger_automation error:", e);
  }
}

// ===== Main handler =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { contact_id, agent_id, additional_instructions } = body;

    if (!contact_id || !agent_id) {
      return new Response(JSON.stringify({ error: "contact_id and agent_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load contact
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("id, name, phone, channel, organization_id, ai_enabled, ai_agent_id, status, funnel_stage, metadata")
      .eq("id", contact_id)
      .single();
    if (contactErr || !contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load agent
    const { data: agent, error: agentErr } = await supabase
      .from("ai_agents")
      .select("id, name, system_prompt, about_company, faq_content, model, category, organization_id, is_active, split_long_messages, split_target_chars, split_max_parts, split_delay_ms")
      .eq("id", agent_id)
      .single();
    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (agent.organization_id !== contact.organization_id) {
      return new Response(JSON.stringify({ error: "Agent/contact org mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!agent.is_active) {
      console.log("[ai-sdr-generate] Agent inactive, skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "agent inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Debounce: wait for the user to finish typing ──
    // If another inbound message arrives during the wait, this invocation is stale — abort.
    const DEBOUNCE_MS = Number(Deno.env.get("AI_DEBOUNCE_MS") || 5000);

    const getLastInboundAt = async (): Promise<string | null> => {
      const { data } = await supabase
        .from("messages")
        .select("created_at")
        .eq("contact_id", contact_id)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at ?? null;
    };

    const snapshotBefore = await getLastInboundAt();
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS));
    const snapshotAfter = await getLastInboundAt();

    if (snapshotAfter !== snapshotBefore) {
      console.log(`[ai-sdr-generate] debounce skip: new message arrived during wait (contact=${contact_id})`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "debounce: newer inbound message arrived" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load org, automations and catalog settings in parallel
    const [{ data: org }, { data: automations }, { data: catalogSettings }] = await Promise.all([
      supabase.from("organizations")
        .select("name, working_days, business_hours_start, business_hours_end")
        .eq("id", contact.organization_id)
        .single(),
      supabase.from("automations")
        .select("id, name")
        .eq("organization_id", contact.organization_id)
        .eq("is_active", true)
        .order("name")
        .limit(20),
      supabase.from("catalog_settings")
        .select("is_published, display_name")
        .eq("organization_id", contact.organization_id)
        .maybeSingle(),
    ]);

    const catalogEnabled = catalogSettings?.is_published === true;

    // Resolve OpenAI key
    const openaiKey = await resolveOpenAiKey(supabase, contact.organization_id);
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI key not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load last 50 messages
    const { data: rawMessages } = await supabase
      .from("messages")
      .select("content, message_type, direction, transcription, created_at")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const history = (rawMessages || []).reverse().map((m: any) => {
      let content = m.content || "";
      if (m.transcription) {
        content = m.message_type === "audio"
          ? `[Áudio transcrito]: ${m.transcription}`
          : `[${m.message_type} - descrição]: ${m.transcription}`;
      } else if (!content && m.message_type !== "text") {
        content = `[${m.message_type}]`;
      }
      const who = m.direction === "inbound" ? "CLIENTE" : "EMPRESA";
      return `${who}: ${content}`;
    }).join("\n");

    // Build system prompt
    let systemPrompt = agent.system_prompt || "Você é um SDR especialista em retomar conversas com leads.";
    if (agent.about_company) systemPrompt += `\n\nSobre a empresa: ${agent.about_company}`;
    if (agent.faq_content) systemPrompt += `\n\nFAQ: ${agent.faq_content}`;
    const hoursLine = buildOperatingHoursLine(org);
    if (hoursLine) systemPrompt += `\n\n${hoursLine}`;

    // Lead qualification context from metadata
    const leadQual = contact.metadata?.lead_qualification;
    if (leadQual) {
      systemPrompt += `\n\nDados de qualificação já coletados deste lead:\n${JSON.stringify(leadQual, null, 2)}`;
    }

    systemPrompt += `\n\nVocê está analisando uma conversa com o lead "${contact.name}". `;

    if (catalogEnabled) {
      systemPrompt += `A empresa possui um catálogo de produtos ativo. Você tem acesso às ferramentas:\n` +
        `- search_catalog: busca produtos por filtros (use para encontrar itens relevantes ao interesse do lead)\n` +
        `- send_media_gallery: envia TODAS as fotos de um produto específico (use após identificar o produto pelo search_catalog)\n` +
        `- update_lead_fields: salva dados de qualificação do lead no CRM (orçamento, interesse, produto favorito, etc.)\n` +
        `- send_message: envia mensagem de texto\n` +
        `- close_conversation: fecha sem mensagem\n` +
        `- trigger_automation: dispara automação\n\n` +
        `Fluxo ideal com catálogo: qualifique o interesse → use search_catalog para encontrar produtos adequados → use send_media_gallery para mostrar as fotos → salve a qualificação com update_lead_fields → transfira para humano quando o lead estiver pronto.\n` +
        `Você pode encadear múltiplas ferramentas na mesma interação (ex: search_catalog + send_media_gallery + update_lead_fields + send_message).`;
    } else {
      systemPrompt += `Leia o histórico e decida a melhor ação:\n` +
        `- send_message: retomar contato com mensagem natural\n` +
        `- close_conversation: encerramento natural ou desinteresse claro\n` +
        `- trigger_automation: executar fluxo específico`;
    }

    systemPrompt += `\n\nVocê DEVE chamar pelo menos uma ferramenta. Não responda em texto puro.`;

    if (agent.split_long_messages !== false) {
      const targetChars = Number(agent.split_target_chars) || 350;
      const maxParts = Number(agent.split_max_parts) || 3;
      systemPrompt += `\n\nSe usar send_message com texto longo, use \`[[SPLIT]]\` para separar partes. Máx ~${targetChars} chars por parte, total de ${maxParts} partes.`;
    }

    if (additional_instructions) {
      systemPrompt += `\n\nInstruções adicionais: ${additional_instructions}`;
    }

    const userPrompt = history.length > 0
      ? `Histórico recente (mais antigo primeiro):\n\n${history}\n\nAnalise e decida a ação.`
      : `Ainda não há histórico com este lead. Use send_message para uma primeira abordagem natural.`;

    const tools = buildTools(automations || [], catalogEnabled);

    // ===== Multi-turn tool execution loop =====
    // Allows: search_catalog → get results → send_media_gallery + update_lead_fields + send_message
    const MAX_ITERATIONS = 6;
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let finalAction = "none";
    let lastToolName = "";
    let totalToolCalls = 0;
    let galleryAlreadySent = false;

    const sdrModel = agent.model || "gpt-4o-mini";
    // GPT-5.6 (sol/terra/luna) defaults reasoning_effort to "medium" when omitted, which
    // is incompatible with function tools on Chat Completions — must be explicitly "none".
    const isGpt56 = sdrModel.startsWith("gpt-5.6");

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`[ai-sdr-generate] Iteration ${iteration + 1}/${MAX_ITERATIONS} contact=${contact.id}`);

      const sdrBody: any = {
        model: sdrModel,
        messages,
        tools,
        tool_choice: "required",
        temperature: 0.7,
        max_tokens: 600,
      };
      if (isGpt56) sdrBody.reasoning_effort = "none";

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(sdrBody),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        let code = "";
        try { code = JSON.parse(errText)?.error?.code || ""; } catch {}
        const isQuota = code === "insufficient_quota" || /insufficient_quota/i.test(errText);
        const isAuth = aiResp.status === 401 || code === "invalid_api_key";
        const reason = isQuota
          ? "Chave da OpenAI sem créditos — adicione saldo em platform.openai.com/account/billing"
          : isAuth
            ? "Chave da OpenAI inválida — atualize em Squad AI"
            : `OpenAI status ${aiResp.status}`;
        console.error(`[ai-sdr-generate] OpenAI error (${code || aiResp.status}): ${reason}`, errText);
        return new Response(JSON.stringify({ skipped: true, reason, code }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResp.json();
      const assistantMessage = aiData.choices?.[0]?.message;
      messages.push(assistantMessage);

      const toolCalls: any[] = assistantMessage?.tool_calls || [];

      // Fallback: model returned text without tool call
      if (toolCalls.length === 0) {
        const fallbackText = assistantMessage?.content?.trim();
        if (fallbackText && iteration === 0) {
          console.warn("[ai-sdr-generate] Model did not use tool call, falling back to send_message");
          await sendReplyParts(supabase, contact.organization_id, contact.id, contact.channel, contact.phone, fallbackText, agent);
          finalAction = "send_message_fallback";
        }
        break;
      }

      // Process all tool calls in this iteration
      const toolResults: any[] = [];
      let shouldBreak = false;

      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        let toolArgs: any = {};
        try { toolArgs = JSON.parse(tc.function.arguments || "{}"); } catch {}
        totalToolCalls++;
        lastToolName = toolName;

        console.log(`[ai-sdr-generate] Tool: ${toolName}`, JSON.stringify(toolArgs).substring(0, 200));

        // ── Data tools (return result, continue loop) ──
        if (toolName === "search_catalog") {
          const results = await executeSearchCatalog(supabase, contact.organization_id, toolArgs);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: results.length > 0
              ? JSON.stringify(results)
              : JSON.stringify({ message: "Nenhum produto encontrado com esses filtros." }),
          });
          continue;
        }

        if (toolName === "update_lead_fields") {
          await executeUpdateLeadFields(supabase, contact.id, toolArgs.fields || {});
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: true }) });
          continue;
        }

        // ── Action tools (execute and mark done) ──
        if (toolName === "send_media_gallery") {
          if (galleryAlreadySent) {
            // Prevent retry — return fake success so AI moves on to send_message
            toolResults.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ success: true, images_sent: 0, note: "gallery already sent" }),
            });
            continue;
          }
          const result = await executeSendMediaGallery(supabase, contact.organization_id, contact, toolArgs);
          galleryAlreadySent = true;
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ success: result.sent > 0, images_sent: result.sent, product: result.product_name }),
          });
          finalAction = "send_media_gallery";
          // Don't break yet — AI may also want to send a text message after gallery
          continue;
        }

        if (toolName === "send_message") {
          const message = (toolArgs.message || "").replace(/^["']|["']$/g, "").trim();
          if (message) {
            await sendReplyParts(supabase, contact.organization_id, contact.id, contact.channel, contact.phone, message, agent);
            await supabase.from("contacts").update({ ai_enabled: true, ai_agent_id: agent.id }).eq("id", contact.id);
          }
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: !!message }) });
          finalAction = finalAction === "send_media_gallery" ? "send_media_gallery+message" : "send_message";
          shouldBreak = true;
          continue;
        }

        if (toolName === "close_conversation") {
          await executeCloseConversation(supabase, contact.id);
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: true }) });
          finalAction = "close_conversation";
          shouldBreak = true;
          continue;
        }

        if (toolName === "trigger_automation") {
          const automationId = toolArgs.automation_id;
          if (automationId) {
            await executeTriggerAutomation(supabase, contact.id, contact.organization_id, automationId);
          }
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: !!automationId }) });
          finalAction = "trigger_automation";
          shouldBreak = true;
          continue;
        }

        // Unknown tool
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: `Unknown tool: ${toolName}` }) });
      }

      // Add tool results to message history
      for (const tr of toolResults) messages.push(tr);

      if (shouldBreak) break;

      // If only data tools were called and no action yet, loop to get next decision
      // Safety: if we've done too many loops without a terminal action, stop
      if (iteration === MAX_ITERATIONS - 1) {
        console.warn("[ai-sdr-generate] Max iterations reached without terminal action");
      }
    }

    console.log(`[ai-sdr-generate] Done. action=${finalAction} tool_calls=${totalToolCalls} contact=${contact.id}`);

    return new Response(
      JSON.stringify({ success: true, action: finalAction, tool_calls: totalToolCalls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("[ai-sdr-generate] Unhandled error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
