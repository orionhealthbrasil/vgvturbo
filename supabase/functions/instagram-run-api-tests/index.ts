import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TestResult = {
  permission: string;
  endpoint: string;
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
};

async function runTest(permission: string, endpoint: string, url: string, init: RequestInit = {}): Promise<TestResult> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return {
      permission,
      endpoint,
      ok: res.ok && !data?.error,
      status: res.status,
      data: res.ok ? data : undefined,
      error: data?.error?.message,
    };
  } catch (err: any) {
    return { permission, endpoint, ok: false, status: 0, error: err?.message || 'fetch failed' };
  }
}

function hasMessagesSubscription(data: any): boolean {
  const subscriptions = Array.isArray(data?.data) ? data.data : [];
  return subscriptions.some((item: any) => {
    const fields = item?.subscribed_fields;
    return fields === undefined || (Array.isArray(fields) && fields.includes('messages'));
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
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
      .from('organization_members').select('id')
      .eq('user_id', user.id).eq('organization_id', organization_id).single();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: ig } = await adminClient
      .from('instagram_instances')
      .select('page_access_token, ig_user_id')
      .eq('organization_id', organization_id).single();
    if (!ig) {
      return new Response(JSON.stringify({ error: 'Instagram não conectado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = ig.page_access_token;
    const base = 'https://graph.instagram.com/v21.0';
    const results: TestResult[] = [];

    const profileRes = await fetch(`${base}/me?fields=user_id,username&access_token=${token}`);
    const profile = await profileRes.json();
    const igUserId = String(profile?.user_id || ig.ig_user_id || '');

    if (!profileRes.ok || !igUserId) {
      return new Response(JSON.stringify({
        success: false,
        error: profile?.error?.message || 'Não foi possível obter o ID profissional do Instagram',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriptionCheck = await runTest(
      'webhook_messages',
      `GET /${igUserId}/subscribed_apps`,
      `${base}/${igUserId}/subscribed_apps?access_token=${token}`,
    );
    const messagesSubscribed = subscriptionCheck.ok && hasMessagesSubscription(subscriptionCheck.data);
    results.push({
      ...subscriptionCheck,
      ok: messagesSubscribed,
      error: messagesSubscribed ? undefined : 'Webhook de Direct não estava inscrito no campo messages',
    });

    if (!messagesSubscribed) {
      const subscriptionRepair = await runTest(
        'webhook_messages',
        `POST /${igUserId}/subscribed_apps?subscribed_fields=messages`,
        `${base}/${igUserId}/subscribed_apps?subscribed_fields=messages&access_token=${token}`,
        { method: 'POST' },
      );
      results.push(subscriptionRepair);
    }

    // 1) instagram_business_manage_insights -> account insights
    results.push(await runTest(
      'instagram_business_manage_insights',
      `GET /${igUserId}/insights`,
      `${base}/${igUserId}/insights?metric=reach&period=day&metric_type=total_value&access_token=${token}`,
    ));

    // 2) instagram_business_manage_comments -> recent media + comments
    const mediaRes = await runTest(
      'instagram_business_manage_comments',
      `GET /${igUserId}/media (then /{media}/comments)`,
      `${base}/${igUserId}/media?fields=id,caption&limit=1&access_token=${token}`,
    );
    if (mediaRes.ok && mediaRes.data?.data?.[0]?.id) {
      const mediaId = mediaRes.data.data[0].id;
      const commentsRes = await runTest(
        'instagram_business_manage_comments',
        `GET /${mediaId}/comments`,
        `${base}/${mediaId}/comments?access_token=${token}`,
      );
      results.push(commentsRes);
    } else {
      results.push({ ...mediaRes, permission: 'instagram_business_manage_comments' });
    }

    // 3) instagram_business_manage_messages -> conversations
    results.push(await runTest(
      'instagram_business_manage_messages',
      `GET /${igUserId}/conversations`,
      `${base}/${igUserId}/conversations?platform=instagram&access_token=${token}`,
    ));

    // 4) instagram_manage_contents -> media listing (content discovery)
    results.push(await runTest(
      'instagram_manage_contents',
      `GET /${igUserId}/media (content)`,
      `${base}/${igUserId}/media?fields=id,media_type,media_url,permalink,timestamp&limit=5&access_token=${token}`,
    ));

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('run-api-tests error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
