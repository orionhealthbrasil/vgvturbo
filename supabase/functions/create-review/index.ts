import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewPayload {
  organization_id: string;
  salesperson_name: string;
  response_time_minutes: number;
  defect_type: string;
  review_date?: string;
  phone?: string;
  notes?: string;
  evidence_urls?: string[];
  conversation_history?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ReviewPayload = await req.json();
    
    console.log('Received payload:', payload);

    // Validate required fields
    if (!payload.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Campo obrigatório ausente: organization_id (ID da organização)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.salesperson_name) {
      return new Response(
        JSON.stringify({ error: 'Campo obrigatório ausente: salesperson_name (nome do vendedor)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (payload.response_time_minutes === undefined || payload.response_time_minutes === null) {
      return new Response(
        JSON.stringify({ error: 'Campo obrigatório ausente: response_time_minutes (tempo de resposta em minutos)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!payload.defect_type) {
      return new Response(
        JSON.stringify({ error: 'Campo obrigatório ausente: defect_type (categoria). Valores aceitos: Good Service, Long Delay, No Response, Rude/Tone, Incorrect Info, Other' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate organization exists
    const { data: orgExists, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', payload.organization_id)
      .single();

    if (orgError || !orgExists) {
      return new Response(
        JSON.stringify({ error: `Organização não encontrada: ${payload.organization_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate defect_type
    const validDefectTypes = ['Good Service', 'Long Delay', 'No Response', 'Rude/Tone', 'Incorrect Info', 'Other'];
    if (!validDefectTypes.includes(payload.defect_type)) {
      return new Response(
        JSON.stringify({ 
          error: `Categoria inválida: "${payload.defect_type}". Valores aceitos: ${validDefectTypes.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create salesperson by name within the organization
    let salespersonId: string;
    
    const { data: existingSalesperson } = await supabase
      .from('salespeople')
      .select('id')
      .eq('organization_id', payload.organization_id)
      .ilike('name', payload.salesperson_name)
      .single();

    if (existingSalesperson) {
      salespersonId = existingSalesperson.id;
      console.log('Found existing salesperson:', salespersonId);
    } else {
      // Create new salesperson in the organization
      const { data: newSalesperson, error: createError } = await supabase
        .from('salespeople')
        .insert({ 
          name: payload.salesperson_name,
          organization_id: payload.organization_id,
        })
        .select('id')
        .single();
      
      if (createError) {
        console.error('Error creating salesperson:', createError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar vendedor: ' + createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      salespersonId = newSalesperson.id;
      console.log('Created new salesperson:', salespersonId);
    }

    // Create the review
    const reviewData = {
      salesperson_id: salespersonId,
      organization_id: payload.organization_id,
      response_time_minutes: payload.response_time_minutes,
      defect_type: payload.defect_type,
      review_date: payload.review_date || new Date().toISOString().split('T')[0],
      phone: payload.phone || null,
      notes: payload.notes || null,
      evidence_urls: payload.evidence_urls || [],
      conversation_history: payload.conversation_history || null,
    };

    console.log('Creating review:', reviewData);

    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert(reviewData)
      .select()
      .single();

    if (reviewError) {
      console.error('Error creating review:', reviewError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar avaliação: ' + reviewError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Review created successfully:', review.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Avaliação criada com sucesso',
        review_id: review.id,
        salesperson_id: salespersonId
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno: ' + errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
