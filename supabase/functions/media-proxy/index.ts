import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Public endpoint — slugs are random UUIDs (not guessable), matching the security
  // model used by all major WhatsApp Business platforms for media preview links.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await adminClient
    .from('messages')
    .select('media_url')
    .eq('media_slug', slug)
    .maybeSingle();

  if (error || !data?.media_url) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: data.media_url },
  });
});
