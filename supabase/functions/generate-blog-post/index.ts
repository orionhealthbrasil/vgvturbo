// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ORION_CONTEXT } from "./orion-knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const lengthMap: Record<string, { words: number; minutes: number }> = {
  short: { words: 600, minutes: 4 },
  medium: { words: 1200, minutes: 7 },
  long: { words: 2000, minutes: 12 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada nos secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth: validar super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Apenas super admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      topic,
      category = "IA para PMEs",
      tone = "educativo",
      length = "medium",
      keywords = "",
      generate_cover = true,
    } = body;

    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "Tópico é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetWords = lengthMap[length]?.words || 1200;
    const readingMinutes = lengthMap[length]?.minutes || 7;

    const toneLabel =
      tone === "vendas"
        ? "direto e comercial, como dono de negócio falando com outro dono — sem enrolação, com urgência real"
        : tone === "case"
        ? "narrativo, contando história real com diálogos curtos, números e o 'antes e depois' de um cliente"
        : "conversacional e prático, como um consultor experiente explicando pra um amigo num café";

    const systemPrompt = `${ORION_CONTEXT}

---

VOCÊ É: redator sênior do blog da Agência Orion. Escreve sobre IA aplicada a vendas, atendimento e WhatsApp pra empresários brasileiros.

REGRA CRÍTICA DE CONTEÚDO:
Use APENAS funcionalidades, segmentos, dores, ângulos e termos listados no bloco BASE DE CONHECIMENTO acima. Se a pauta sugerir algo que a Orion não faz, adapte pra algo que ela faz. NUNCA invente nome de módulo, sigla ou produto.

VOZ E ESTILO (CRÍTICO):
- Português brasileiro REAL. Nada de "no mundo dos negócios atual", "em um mercado competitivo", "é aqui que entra", "imagine o seguinte", "no cenário atual", "transforme seu negócio", "leve sua empresa ao próximo nível", "soluções inovadoras", "potencialize", "alavancar", "robustez".
- Frases curtas misturadas com frases médias. Evita parágrafos longos.
- Contrações naturais: "tá", "pra", "dá pra", "tá perdendo". Escreve "você" por extenso.
- Pode usar gírias leves de mercado: "perde lead", "esfria", "fura agenda", "no boleto", "fechou", "PIX caiu".
- Tom ${toneLabel}.
- Comece o post com uma cena, dado chocante, pergunta provocativa OU história curta — NUNCA com "Em um mercado cada vez mais...".
- Sem clichê de IA: nada de "revolucionário", "disruptivo", "game changer", "no mundo digital".

CONTEÚDO:
- Foco em resultado de negócio: agendamento, fechamento, ticket médio, retenção, tempo de resposta.
- Use contextos reais e específicos: clínica de estética em Belo Horizonte, advogado trabalhista de SP, dentista do interior de SC, loja de auto-peças, escritório de contabilidade, corretora de seguros, academia de bairro.
- Números concretos quando fizer sentido (R$, %, minutos, leads/mês). Não invente "estudo da Harvard"; use estimativa de mercado ("a gente vê em média...") ou exemplo do dia a dia.
- Markdown: H2 (##) só onde realmente precisa quebrar (3 a 5 no total). Use H3 (###) com parcimônia. Listas curtas. Negrito só em 1-2 pontos por seção. Citações (>) só se for fala/insight forte.
- ~${targetWords} palavras.

SEO (CRÍTICO — siga à risca):
- Identifique a INTENÇÃO de busca da pauta (informacional, comercial ou transacional) e adapte profundidade e CTA.
- KEYWORD PRINCIPAL: deduza da pauta${keywords ? ` (priorize as fornecidas: ${keywords})` : ""}. Use no H1 (título), no slug, nos primeiros 100 caracteres do post, em pelo menos 1 H2, no meta_title e na meta_description. Densidade 1-2% — nunca stuffing.
- TERMOS RELACIONADOS (LSI): espalhe 4-6 sinônimos e termos correlatos ao longo do texto de forma natural.
- FEATURED SNIPPET: o primeiro parágrafo deve responder direto a pergunta central da pauta em 40-60 palavras, de forma autossuficiente (alguém que ler só esse parágrafo já entende a resposta).
- ESCANEABILIDADE: parágrafos de 2-4 linhas. Use bullets ou tabela quando comparar opções, listar passos ou itens. H2s descritivos (não "O que é" genérico — use a keyword).
- E-E-A-T: traga ao menos 1 dado concreto verificável OU exemplo brasileiro específico (cidade + segmento + número) por seção. Evite "estudos mostram" sem fonte.
- META_TITLE: keyword principal o mais à esquerda possível, max 60 chars, com gancho (número, ano, benefício).
- META_DESCRIPTION: max 160 chars, contém keyword + benefício + leve CTA implícito.
- SLUG: 3-5 palavras, contém keyword, sem stopwords desnecessárias.

PROIBIÇÕES ABSOLUTAS:
- Nada de "Conclusão:" como título — a última seção tem título próprio.
- Nada de emoji.
- Nada de "**Em resumo:**", "**Em síntese:**", "**Lembre-se:**".
- Não traduza nomes (mantém WhatsApp, e-mail, lead, pipeline).
- Máximo 1-2 exclamações no post inteiro.`;

    const userPrompt = `Tópico: "${topic}"
Categoria: ${category}
${keywords ? `Palavras-chave SEO (a principal vai no H1, slug, meta_title, meta_desc e primeiro parágrafo): ${keywords}` : "Deduza a keyword principal da pauta e use conforme regras SEO do system prompt."}

Estrutura obrigatória:
1. H1 (title) com a keyword principal e gancho concreto (número, ano, benefício).
2. Primeiro parágrafo (40-60 palavras) respondendo direto a pergunta central da pauta — featured snippet ready. Já contém a keyword.
3. 3-5 seções H2 descritivos (cada um com keyword ou variação LSI quando natural). Pelo menos uma com bullets ou tabela comparativa.
4. Mini-case brasileiro real (cidade + segmento + número de R$/%/min) em uma das seções.
5. Seção final curta com CTA natural pra falar com a Orion no WhatsApp.

Sugestões de links internos: ao longo do texto, marque 2-3 âncoras de tópicos correlatos da Orion usando o formato [texto âncora](#) — eu ligo as URLs depois.

Antes de retornar, cheque mentalmente:
- A keyword aparece no H1, slug, meta_title, meta_desc e primeiro parágrafo?
- O primeiro parágrafo responde a pergunta central por si só?
- Tem clichê de IA, "é aqui que entra", ou frase com cara de tradução? Reescreva.

Retorne via tool call.`;

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        tools: [
          {
            type: "function",
            function: {
              name: "create_blog_post",
              description: "Retorna o post estruturado",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título humano e específico, com promessa concreta ou número. Sem dois pontos genéricos. Max 70 chars." },
                  slug: { type: "string", description: "URL slug em kebab-case sem acentos" },
                  excerpt: { type: "string", description: "1-2 frases que dão vontade de clicar. Sem 'descubra como', 'saiba mais'. Max 180 chars." },
                  content_md: { type: "string", description: "Markdown completo, brasileiro de verdade, sem clichês de IA." },
                  meta_title: { type: "string", description: "Title SEO, max 60 chars" },
                  meta_description: { type: "string", description: "Meta desc SEO, max 160 chars" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-6 tags em minúsculas",
                  },
                  cover_prompt: {
                    type: "string",
                    description:
                      "Prompt em inglês para gerar imagem de capa: cena moderna, profissional, sem texto, paleta verde esmeralda + ciano em fundo escuro navy",
                  },
                },
                required: [
                  "title",
                  "slug",
                  "excerpt",
                  "content_md",
                  "meta_title",
                  "meta_description",
                  "tags",
                  "cover_prompt",
                ],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_blog_post" } },
      }),
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      console.error("OpenAI error:", openaiResp.status, errText);
      return new Response(
        JSON.stringify({ error: `OpenAI: ${openaiResp.status} ${errText.slice(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await openaiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou estrutura válida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const post = JSON.parse(toolCall.function.arguments);
    post.slug = slugify(post.slug || post.title);
    post.category = category;
    post.reading_minutes = readingMinutes;
    post.author_name = "Equipe Orion";
    post.status = "draft";
    post.ai_prompt = { topic, category, tone, length, keywords };

    // Optional cover image (DALL-E 3 — só roda se OPENAI_API_KEY estiver configurada)
    if (generate_cover && post.cover_prompt && OPENAI_API_KEY) {
      try {
        const imgResp = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: post.cover_prompt,
            size: "1792x1024",
            quality: "standard",
            n: 1,
          }),
        });

        if (imgResp.ok) {
          const imgData = await imgResp.json();
          const imgUrl = imgData.data?.[0]?.url;
          if (imgUrl) {
            // Download and upload to bucket
            const imgBlob = await (await fetch(imgUrl)).arrayBuffer();
            const filename = `${post.slug}-${Date.now()}.png`;
            const { error: upErr } = await supabase.storage
              .from("blog-covers")
              .upload(filename, imgBlob, { contentType: "image/png", upsert: true });

            if (!upErr) {
              const { data: pub } = supabase.storage.from("blog-covers").getPublicUrl(filename);
              post.cover_url = pub.publicUrl;
              post.og_image_url = pub.publicUrl;
            } else {
              console.error("Storage upload error:", upErr);
            }
          }
        } else {
          console.error("DALL-E error:", imgResp.status, await imgResp.text());
        }
      } catch (imgErr) {
        console.error("Cover generation failed:", imgErr);
      }
    }

    return new Response(JSON.stringify(post), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-blog-post error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
