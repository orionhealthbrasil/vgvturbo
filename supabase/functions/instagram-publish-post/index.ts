import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { organization_id, image_url, caption } = await req.json();

    if (!organization_id || !image_url) {
      return new Response(JSON.stringify({ error: 'organization_id and image_url required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership } = await userClient
      .from('organization_members').select('role')
      .eq('user_id', user.id).eq('organization_id', organization_id).single();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: ig, error: igErr } = await adminClient
      .from('instagram_instances')
      .select('ig_user_id, page_access_token')
      .eq('organization_id', organization_id).single();
    if (igErr || !ig) {
      return new Response(JSON.stringify({ error: 'Instagram not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: create media container (use 'me' — IG Business Login token is user-scoped)
    const containerUrl = new URL(`https://graph.instagram.com/v21.0/me/media`);
    containerUrl.searchParams.set('image_url', image_url);
    if (caption) containerUrl.searchParams.set('caption', caption);
    containerUrl.searchParams.set('access_token', ig.page_access_token);

    const containerRes = await fetch(containerUrl.toString(), { method: 'POST' });
    const containerData = await containerRes.json();
    if (!containerRes.ok || !containerData.id) {
      console.error('Container error:', JSON.stringify(containerData));
      return new Response(JSON.stringify({ error: containerData?.error?.message || 'Container creation failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: publish container
    const publishUrl = new URL(`https://graph.instagram.com/v21.0/me/media_publish`);
    publishUrl.searchParams.set('creation_id', containerData.id);
    publishUrl.searchParams.set('access_token', ig.page_access_token);

    const publishRes = await fetch(publishUrl.toString(), { method: 'POST' });
    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
      console.error('Publish error:', JSON.stringify(publishData));
      return new Response(JSON.stringify({ error: publishData?.error?.message || 'Publish failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch permalink
    let permalink: string | null = null;
    try {
      const linkRes = await fetch(
        `https://graph.instagram.com/v21.0/${publishData.id}?fields=permalink&access_token=${ig.page_access_token}`
      );
      const linkData = await linkRes.json();
      permalink = linkData.permalink || null;
    } catch (_) {}

    // Persist
    await adminClient.from('instagram_posts').insert({
      organization_id,
      ig_media_id: publishData.id,
      caption: caption || null,
      media_url: image_url,
      media_type: 'IMAGE',
      permalink,
      published_by_user_id: user.id,
    });

    return new Response(JSON.stringify({ success: true, ig_media_id: publishData.id, permalink }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Publish error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
