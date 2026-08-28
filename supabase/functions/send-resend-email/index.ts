import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  to: string;
  organization_id: string;
  subject?: string;
  html?: string;
}

const DEFAULT_SUBJECT = 'Email de teste do VGV Turbo';
const DEFAULT_HTML = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; padding: 24px; background:#f9fafb;">
  <div style="max-width: 560px; margin: 0 auto; background:#ffffff; border-radius:12px; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <h2 style="color:#4f46e5; margin-top:0;">✅ Email de teste do VGV Turbo</h2>
    <p style="font-size:15px; color:#374151;">Se você está recebendo este email, sua configuração do Resend está funcionando corretamente.</p>
    <p style="font-size:14px; color:#6b7280; margin-top:24px;">
      Você já pode usar o nó <strong>Enviar Email</strong> nas suas automações.
    </p>
    <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
    <p style="font-size:12px; color:#9ca3af;">VGV Turbo · Envio via Resend</p>
  </div>
</body>
</html>`.trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate JWT and get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { to, organization_id, subject, html } = body;

    if (!to || !organization_id) {
      return new Response(JSON.stringify({ error: 'Missing to or organization_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate basic email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify membership and role
    const { data: member } = await admin
      .from('organization_members')
      .select('role, member_role')
      .eq('user_id', userData.user.id)
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isAuthorized =
      member.role === 'owner' || member.member_role === 'owner' || member.member_role === 'admin';
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Apenas owners/admins podem enviar testes de email' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch resend config
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('resend_api_key, resend_from_email, resend_from_name, resend_reply_to')
      .eq('id', organization_id)
      .single();

    if (orgErr || !org) {
      return new Response(JSON.stringify({ error: 'Organização não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = (org.resend_api_key || '').trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Chave de API Resend não configurada',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromEmail = (org.resend_from_email || '').trim() || 'onboarding@resend.dev';
    const fromName = (org.resend_from_name || '').trim();
    const replyTo = (org.resend_reply_to || '').trim();
    const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    const payload: Record<string, unknown> = {
      from: fromHeader,
      to: [to],
      subject: subject || DEFAULT_SUBJECT,
      html: html || DEFAULT_HTML,
    };
    if (replyTo) payload.reply_to = replyTo;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resendBody = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      const errorDetail =
        resendBody?.message || resendBody?.error || `HTTP ${resendResponse.status}`;

      await admin.from('email_send_history').insert({
        organization_id,
        triggered_by: userData.user.id,
        to_email: to,
        from_email: fromEmail,
        subject: payload.subject as string,
        source: 'test',
        status: 'failed',
        error_message: errorDetail,
      });

      return new Response(
        JSON.stringify({ success: false, error: 'Falha no envio', error_detail: errorDetail }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageId = resendBody?.id || null;

    await admin.from('email_send_history').insert({
      organization_id,
      triggered_by: userData.user.id,
      to_email: to,
      from_email: fromEmail,
      subject: payload.subject as string,
      source: 'test',
      status: 'sent',
      resend_message_id: messageId,
    });

    return new Response(JSON.stringify({ success: true, message_id: messageId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[send-resend-email] error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
