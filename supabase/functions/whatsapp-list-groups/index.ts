// Lists WhatsApp groups available on the organization's connected instance.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Group {
  id: string;
  subject: string;
  size?: number;
  pictureUrl?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate membership
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership } = await userClient
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch instance via service role
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: instance } = await admin
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (!instance?.base_url || !instance?.api_key || !instance?.instance_name) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp não configurado para esta organização.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `${instance.base_url}/group/list`;
    console.log('[whatsapp-list-groups] GET', url);

    const r = await fetch(url, {
      method: 'GET',
      headers: { apikey: instance.api_key as string },
    });

    if (!r.ok) {
      const text = await r.text();
      console.error('[whatsapp-list-groups] upstream error', r.status, text);
      return new Response(
        JSON.stringify({ error: `Falha ao buscar grupos (${r.status}). Verifique se o WhatsApp está conectado.` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const raw = await r.json();
    // Stevo API v2 returns { data: [...] } with PascalCase fields
    const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.groups ?? []);

    const groups: Group[] = list
      .map((g: any): Group => ({
        id: g.JID ?? g.id ?? g.remoteJid ?? g.jid ?? '',
        subject: g.Name ?? g.subject ?? g.name ?? g.title ?? '(sem nome)',
        size: g.ParticipantCount ?? g.Participants?.length ?? g.size ?? g.participantsCount,
        pictureUrl: g.pictureUrl ?? g.profilePicUrl ?? null,
      }))
      .filter((g) => g.id && g.id.endsWith('@g.us'))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    return new Response(JSON.stringify({ groups }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[whatsapp-list-groups] error', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
