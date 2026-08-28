import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Callback endpoint for n8n to POST audit results back.
 * 
 * Expected payload from n8n:
 * {
 *   contact_id: string,
 *   organization_id: string,
 *   salesperson_name: string,
 *   contact_phone: string,
 *   conversation_text: string,
 *   response_metrics: { average_time: number, response_count: number, longest_delay: number },
 *   result: {
 *     score: number,
 *     summary: string,
 *     positives: string[],
 *     improvements: string[],
 *     defect_type: string
 *   }
 * }
 */

interface AuditCallbackPayload {
  contact_id: string;
  organization_id: string;
  salesperson_name: string;
  contact_phone: string;
  conversation_text?: string;
  response_metrics: {
    average_time: number;
    response_count: number;
    longest_delay: number;
  };
  result: {
    score: number;
    summary: string;
    positives: string[];
    improvements: string[];
    defect_type: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: AuditCallbackPayload = await req.json();

    const { organization_id, salesperson_name, contact_phone, conversation_text, response_metrics, result } = payload;

    if (!organization_id || !result) {
      return new Response(
        JSON.stringify({ error: 'organization_id and result are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[audit-callback] Received callback for org ${organization_id}, salesperson: ${salesperson_name}`);

    // Find or create salesperson
    const { data: salesperson } = await supabase
      .from('salespeople')
      .select('id')
      .eq('name', salesperson_name)
      .eq('organization_id', organization_id)
      .maybeSingle();

    let salespersonId = salesperson?.id;

    if (!salespersonId) {
      const { data: newSp } = await supabase
        .from('salespeople')
        .insert({ name: salesperson_name, organization_id })
        .select('id')
        .single();
      salespersonId = newSp?.id;
    }

    if (!salespersonId) {
      console.error('[audit-callback] Could not find or create salesperson');
      return new Response(
        JSON.stringify({ error: 'Could not resolve salesperson' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create review record
    const { error: reviewError } = await supabase
      .from('reviews')
      .insert({
        organization_id,
        salesperson_id: salespersonId,
        defect_type: result.defect_type,
        response_time_minutes: response_metrics.average_time,
        notes: `Score: ${result.score}/10\n\n${result.summary}\n\nPontos positivos:\n${result.positives.join('\n')}\n\nMelhorias:\n${result.improvements.join('\n')}\n\n📊 Métricas de Tempo:\n- Tempo médio de resposta: ${response_metrics.average_time} min\n- Número de respostas: ${response_metrics.response_count}\n- Maior tempo de espera: ${response_metrics.longest_delay} min`,
        phone: contact_phone,
        conversation_history: conversation_text?.substring(0, 10000) || null,
      });

    if (reviewError) {
      console.error('[audit-callback] Error creating review:', reviewError);
      return new Response(
        JSON.stringify({ error: 'Failed to create review', details: reviewError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[audit-callback] Review created successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[audit-callback] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
