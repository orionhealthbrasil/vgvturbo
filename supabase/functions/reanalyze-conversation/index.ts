import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SALE_STATUS = ['VENDA','ORCAMENTO','PECA NAO ENCONTRADA','SEM RESPOSTA','NAO TRABALHAMOS COM A PECA','NAO SELECIONOU OPCAO'];
const PRODUCT_LINES = ['LINHA LEVE','LINHA PESADA'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Auth via user JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { analysis_id } = await req.json();
    if (!analysis_id) {
      return new Response(JSON.stringify({ error: 'analysis_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: analysis, error: aErr } = await supabase
      .from('conversation_analyses').select('*').eq('id', analysis_id).single();
    if (aErr || !analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify admin/owner
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role, member_role')
      .eq('user_id', userId)
      .eq('organization_id', analysis.organization_id)
      .maybeSingle();
    const isAdmin = membership && (
      membership.role === 'owner' || membership.role === 'admin' || membership.member_role === 'admin'
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!analysis.contact_id) {
      return new Response(JSON.stringify({ error: 'Analysis has no linked contact' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Limit messages to the day of the analysis (America/Sao_Paulo).
    // This prevents the AI from scoring delays based on conversations from previous days/months.
    const analysisDateStr: string = analysis.analysis_date; // YYYY-MM-DD
    // 00:00 BRT = 03:00 UTC ; +1 day at 03:00 UTC
    const dayStartUtc = new Date(`${analysisDateStr}T03:00:00.000Z`).toISOString();
    const dayEndUtc = new Date(new Date(`${analysisDateStr}T03:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

    const { data: messages } = await supabase
      .from('messages')
      .select('direction, content, message_type, created_at')
      .eq('contact_id', analysis.contact_id)
      .gte('created_at', dayStartUtc)
      .lt('created_at', dayEndUtc)
      .order('created_at', { ascending: true })
      .limit(500);

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma mensagem encontrada no dia da análise' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch curation rules + examples
    const [{ data: rulesRow }, { data: examples }] = await Promise.all([
      supabase.from('analysis_curation_rules').select('rules_text').eq('organization_id', analysis.organization_id).maybeSingle(),
      supabase.from('analysis_curation_examples').select('*').eq('organization_id', analysis.organization_id).order('created_at', { ascending: false }).limit(10),
    ]);

    const rulesText = (rulesRow?.rules_text || '').trim();
    const examplesBlock = (examples || []).map((ex: any, i: number) => {
      const lines = [`Exemplo ${i + 1}:`];
      if (ex.conversation_excerpt) lines.push(`Conversa: ${String(ex.conversation_excerpt).slice(0, 800)}`);
      if (ex.wrong_values) lines.push(`IA marcou (errado): ${JSON.stringify(ex.wrong_values)}`);
      lines.push(`Correto: ${JSON.stringify(ex.correct_values)}`);
      if (ex.note) lines.push(`Observação: ${ex.note}`);
      return lines.join('\n');
    }).join('\n\n');

    const conversationText = messages.map((m: any) =>
      `[${m.direction === 'inbound' ? 'Cliente' : 'Atendente'}] ${(m.content ?? '').toString().slice(0, 500)}`
    ).join('\n');

    const [yyyy, mm, dd] = analysisDateStr.split('-');
    const dayLabel = `${dd}/${mm}/${yyyy}`;

    const systemPrompt = [
      'Você é um analista de conversas de vendas. Analise a conversa e retorne um JSON estruturado com os campos solicitados.',
      `IMPORTANTE: A análise é referente APENAS ao dia ${dayLabel}. Considere somente as mensagens fornecidas (todas são desse dia). Não pontue atrasos, demoras ou eventos baseados em datas anteriores — eles não fazem parte do escopo desta análise.`,
      `Status de venda válidos: ${SALE_STATUS.join(', ')}.`,
      `Linhas de produto válidas: ${PRODUCT_LINES.join(', ')}.`,
      rulesText ? `\nDIRETRIZES DA EQUIPE (sempre seguir):\n${rulesText}` : '',
      examplesBlock ? `\nEXEMPLOS DE CORREÇÕES ANTERIORES (aprenda com elas):\n${examplesBlock}` : '',
    ].filter(Boolean).join('\n');

    const tools = [{
      type: 'function',
      function: {
        name: 'register_analysis',
        description: 'Registrar análise da conversa.',
        parameters: {
          type: 'object',
          properties: {
            customer_name: { type: 'string' },
            phone: { type: 'string' },
            lead_source: { type: 'string' },
            sale_status: { type: 'string', enum: SALE_STATUS },
            product_line: { type: 'string', enum: PRODUCT_LINES },
            part_searched: { type: 'string' },
            quantity: { type: 'number' },
            sale_value: { type: 'number' },
          },
          required: ['customer_name'],
        },
      },
    }];

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Cliente atual: ${analysis.customer_name} (${analysis.phone || 'sem telefone'}).\nDia da análise: ${dayLabel}.\n\nConversa do dia ${dayLabel} (${messages.length} mensagens):\n${conversationText}\n\nUse a função register_analysis para retornar a análise atualizada.` },
        ],
        tools,
        tool_choice: { type: 'function', function: { name: 'register_analysis' } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: 'Rate limit excedido. Tente novamente em alguns instantes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const t = await aiRes.text();
      console.error('AI gateway error', aiRes.status, t);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: 'AI did not return structured analysis' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const newValues = JSON.parse(toolCall.function.arguments);

    // Save original snapshot before overwriting
    const original = {
      customer_name: analysis.customer_name,
      phone: analysis.phone,
      lead_source: analysis.lead_source,
      sale_status: analysis.sale_status,
      product_line: analysis.product_line,
      part_searched: analysis.part_searched,
      quantity: analysis.quantity,
      sale_value: analysis.sale_value,
    };

    const updates: any = {
      ...newValues,
      quantity: newValues.quantity != null ? Number(newValues.quantity) : null,
      sale_value: newValues.sale_value != null ? Number(newValues.sale_value) : null,
      original_values: { ...(analysis.original_values || {}), reanalyzed_from: original, reanalyzed_at: new Date().toISOString() },
      corrected_by: userId,
      corrected_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase.from('conversation_analyses').update(updates).eq('id', analysis_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ success: true, updated: newValues }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('reanalyze-conversation error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
