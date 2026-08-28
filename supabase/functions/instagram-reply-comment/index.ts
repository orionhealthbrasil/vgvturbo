import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReplyPayload {
  organization_id: string;
  comment_id: string; // internal uuid
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { organization_id, comment_id, message }: ReplyPayload = await req.json();

    if (!organization_id || !comment_id || !message || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership } = await userClient
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: comment, error: commentError } = await adminClient
      .from('instagram_comments')
      .select('id, ig_comment_id, organization_id, replied_at')
      .eq('id', comment_id)
      .eq('organization_id', organization_id)
      .single();

    if (commentError || !comment) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (comment.replied_at) {
      return new Response(JSON.stringify({ error: 'Comment already replied' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: igInstance, error: igError } = await adminClient
      .from('instagram_instances')
      .select('page_access_token')
      .eq('organization_id', organization_id)
      .single();

    if (igError || !igInstance?.page_access_token) {
      return new Response(JSON.stringify({ error: 'Instagram not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const replyResponse = await fetch(
      `https://graph.instagram.com/v21.0/${comment.ig_comment_id}/replies`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${igInstance.page_access_token}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      },
    );

    const replyData = await replyResponse.json();

    if (!replyResponse.ok) {
      console.error('Instagram reply error:', JSON.stringify(replyData));
      return new Response(JSON.stringify({ error: `Instagram API: ${replyData?.error?.message || 'Unknown'}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient
      .from('instagram_comments')
      .update({
        replied_at: new Date().toISOString(),
        reply_text: message.trim(),
        replied_by_user_id: user.id,
        ig_reply_id: replyData?.id || null,
      })
      .eq('id', comment.id);

    return new Response(JSON.stringify({ success: true, reply_id: replyData?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Reply error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
