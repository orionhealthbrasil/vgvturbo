import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface CheckResult {
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
  finalUrl?: string;
  contentType?: string | null;
}

async function checkUrl(url: string): Promise<CheckResult> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      return { url, ok: false, status: null, error: 'Meta exige HTTPS' };
    }
  } catch {
    return { url, ok: false, status: null, error: 'URL inválida' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // Mimic Meta's crawler — some hosts block default Deno UA
        'User-Agent':
          'Mozilla/5.0 (compatible; MetaURLCheck/1.0; +https://vgvturbo.com.br)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    // Drain body to avoid resource leaks
    await res.text();
    return {
      url,
      ok: res.status === 200,
      status: res.status,
      finalUrl: res.url,
      contentType: res.headers.get('content-type'),
    };
  } catch (e) {
    return {
      url,
      ok: false,
      status: null,
      error: (e as Error).message ?? 'Falha ao buscar a URL',
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const urls: unknown = body?.urls;

    if (!Array.isArray(urls) || urls.length === 0 || urls.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Envie um array "urls" com 1 a 10 URLs.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const list = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
    const results = await Promise.all(list.map(checkUrl));
    const allOk = results.every((r) => r.ok);

    return new Response(JSON.stringify({ allOk, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? 'Erro inesperado' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
