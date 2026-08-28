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
  const IG_APP_ID = Deno.env.get('INSTAGRAM_APP_ID');
  const IG_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET');

  if (!IG_APP_ID || !IG_APP_SECRET) {
    return new Response(JSON.stringify({ error: 'Instagram App not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { code, organization_id, redirect_uri } = await req.json();

    if (!code || !organization_id || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing required fields: code, organization_id, redirect_uri' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate user auth
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
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .single();

    if (!membership || membership.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owners can connect Instagram' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Exchange code for short-lived IG user token (form-encoded POST)
    const formBody = new URLSearchParams({
      client_id: IG_APP_ID,
      client_secret: IG_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri,
      code,
    });

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error_type || !tokenData.access_token) {
      console.error('IG token exchange error:', JSON.stringify(tokenData));
      return new Response(JSON.stringify({ error: `Token exchange failed: ${tokenData?.error_message || tokenData?.error?.message || 'Unknown'}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shortLivedToken = tokenData.access_token;
    // NOTE: tokenData.user_id is the app-scoped ID, NOT the real IG Business ID
    // that Meta sends as `entry.id` in webhooks. We resolve the real one from /me below.
    let igUserId = String(tokenData.user_id);

    // Step 2: Exchange short-lived for long-lived token (60 days)
    // With the new Instagram Business Login API (instagram_business_basic),
    // the initial token may already be long-lived. If the exchange fails, use it directly.
    let longLivedToken = shortLivedToken;
    let expiresIn: number | undefined;

    try {
      // Try GET first (official docs), then POST as fallback
      const longLivedUrl = `https://graph.instagram.com/v21.0/access_token?` +
        `grant_type=ig_exchange_token` +
        `&client_secret=${IG_APP_SECRET}` +
        `&access_token=${shortLivedToken}`;

      let longLivedRes = await fetch(longLivedUrl);
      let longLivedData = await longLivedRes.json();

      // If GET fails, try POST
      if (!longLivedRes.ok || !longLivedData.access_token) {
        console.warn('IG long-lived token GET failed, trying POST:', JSON.stringify(longLivedData));
        const postBody = new URLSearchParams({
          grant_type: 'ig_exchange_token',
          client_secret: IG_APP_SECRET,
          access_token: shortLivedToken,
        });
        longLivedRes = await fetch('https://graph.instagram.com/v21.0/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postBody.toString(),
        });
        longLivedData = await longLivedRes.json();
      }

      if (longLivedRes.ok && longLivedData.access_token) {
        longLivedToken = longLivedData.access_token;
        expiresIn = longLivedData.expires_in;
        console.log('IG long-lived token obtained successfully, expires_in:', expiresIn);
      } else {
        console.warn('IG long-lived token exchange failed (using initial token):', JSON.stringify(longLivedData));
      }
    } catch (exchangeErr) {
      console.warn('IG long-lived token exchange exception (using initial token):', exchangeErr);
    }

    // Step 3: Fetch IG user profile
    // New Instagram Business Login API returns `id` (not `user_id`)
    // Try with profile_picture_url first; fall back without it (some account types don't support it)
    let profile: any = {};
    for (const fields of ['id,username,name,profile_picture_url', 'id,username,name']) {
      const profileRes = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=${fields}&access_token=${longLivedToken}`
      );
      const profileData = await profileRes.json();
      if (profileRes.ok && profileData.id) {
        profile = profileData;
        console.log('IG profile OK with fields=' + fields + ':', JSON.stringify(profileData));
        break;
      }
      console.warn('IG profile fetch failed with fields=' + fields + ':', JSON.stringify(profileData));
    }

    // CRITICAL: replace app-scoped user_id with the real IG Business ID
    // New API returns `id`; older flow returned `user_id`. Accept both.
    const resolvedId = profile?.id || profile?.user_id;
    if (resolvedId) {
      igUserId = String(resolvedId);
      console.log('Resolved real IG user_id from /me:', igUserId);
    }

    // Step 4: Subscribe to webhooks for this IG user
    try {
      const subRes = await fetch(
        `https://graph.instagram.com/v21.0/${igUserId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_reactions,comments,mentions&access_token=${longLivedToken}`,
        { method: 'POST' }
      );
      const subData = await subRes.json();
      if (!subRes.ok) {
        console.error('IG webhook subscription failed:', JSON.stringify(subData));
      } else {
        console.log('IG subscribed to webhook events:', JSON.stringify(subData));
      }
    } catch (subErr) {
      console.error('IG subscription error:', subErr);
    }

    // Step 5: Save instance (upsert)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const { error: upsertError } = await adminClient
      .from('instagram_instances')
      .upsert(
        {
          organization_id,
          ig_user_id: igUserId,
          page_id: null,
          page_access_token: longLivedToken,
          token_expires_at: tokenExpiresAt,
          auth_type: 'instagram_login',
          username: profile.username || null,
          account_name: profile.username || profile.name || null,
          profile_picture_url: profile.profile_picture_url || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' }
      );

    if (upsertError) {
      console.error('Error saving IG instance:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save Instagram connection' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      account_name: profile.username || profile.name,
      profile_picture_url: profile.profile_picture_url,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Instagram OAuth error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
