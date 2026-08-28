// Edge function: notify-support-ticket
// Sends an email notification to the agency whenever:
//  - A new support ticket is opened (event: 'new_ticket')
//  - A new message is posted to a ticket by a non-agency sender (event: 'new_message')
// Deployed to external Supabase (atnjikvdbvyvyabsxctj) — manual deploy required.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const NOTIFY_EMAIL = 'agenciaorion2560@gmail.com';
const FROM_EMAIL = 'VGV Turbo Suporte <onboarding@resend.dev>';

interface Payload {
  event?: 'new_ticket' | 'new_message';
  ticket_id: string;
  subject: string;
  // For new_ticket
  first_message?: string;
  // For new_message
  message_content?: string;
  message_type?: string;
  organization_name?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  // Legacy fields (new_ticket)
  created_by_name?: string | null;
  created_by_email?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildNewTicketEmail(body: Payload) {
  const subject = `🆘 Novo Chamado: ${body.subject}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; color: #0f172a;">
      <div style="background: #ffffff; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <h1 style="margin: 0 0 8px; font-size: 22px; color: #1e293b;">🆘 Novo Chamado de Suporte</h1>
        <p style="margin: 0 0 24px; color: #64748b; font-size: 14px;">Um novo chamado foi aberto na plataforma VGV Turbo.</p>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Organização</p>
          <p style="margin: 0 0 18px; font-weight: 600;">${escapeHtml(body.organization_name || 'Desconhecida')}</p>

          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Aberto por</p>
          <p style="margin: 0 0 18px; font-weight: 600;">
            ${escapeHtml(body.created_by_name || body.sender_name || 'Usuário')}${(body.created_by_email || body.sender_email) ? ` &lt;${escapeHtml(body.created_by_email || body.sender_email || '')}&gt;` : ''}
          </p>

          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Assunto</p>
          <p style="margin: 0 0 18px; font-weight: 600;">${escapeHtml(body.subject)}</p>

          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Mensagem</p>
          <div style="background: #f1f5f9; border-left: 3px solid #6366f1; padding: 12px 14px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(body.first_message || '')}</div>
        </div>

        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <a href="https://vgvturbo.lovable.app/super-admin/support"
             style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Abrir Painel de Suporte
          </a>
        </div>

        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
          Ticket ID: ${escapeHtml(body.ticket_id)}
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

function buildNewMessageEmail(body: Payload) {
  const subject = `💬 Nova mensagem no chamado: ${body.subject}`;
  const isMedia = body.message_type && body.message_type !== 'text';
  const previewContent = isMedia
    ? `[${(body.message_type || 'mídia').toUpperCase()}]${body.message_content ? ` ${body.message_content}` : ''}`
    : (body.message_content || '');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; color: #0f172a;">
      <div style="background: #ffffff; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <h1 style="margin: 0 0 8px; font-size: 22px; color: #1e293b;">💬 Nova Mensagem em Chamado</h1>
        <p style="margin: 0 0 24px; color: #64748b; font-size: 14px;">Um cliente respondeu em um chamado aberto.</p>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Organização</p>
          <p style="margin: 0 0 18px; font-weight: 600;">${escapeHtml(body.organization_name || 'Desconhecida')}</p>

          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Enviado por</p>
          <p style="margin: 0 0 18px; font-weight: 600;">
            ${escapeHtml(body.sender_name || 'Usuário')}${body.sender_email ? ` &lt;${escapeHtml(body.sender_email)}&gt;` : ''}
          </p>

          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Chamado</p>
          <p style="margin: 0 0 18px; font-weight: 600;">${escapeHtml(body.subject)}</p>

          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Mensagem</p>
          <div style="background: #f1f5f9; border-left: 3px solid #10b981; padding: 12px 14px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(previewContent || '(sem conteúdo)')}</div>
        </div>

        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <a href="https://vgvturbo.lovable.app/super-admin/support"
             style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Responder no Painel
          </a>
        </div>

        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
          Ticket ID: ${escapeHtml(body.ticket_id)}
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  console.log('[notify-support-ticket] invoked', { method: req.method });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('[notify-support-ticket] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ ok: false, error: 'RESEND_API_KEY not configured', stage: 'config' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body: Payload;
    try {
      body = (await req.json()) as Payload;
    } catch (parseErr) {
      console.error('[notify-support-ticket] invalid JSON body:', parseErr);
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid JSON body', stage: 'parse' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const event = body.event || 'new_ticket';
    console.log('[notify-support-ticket] event received:', event, {
      ticket_id: body.ticket_id,
      subject: body.subject,
      organization_name: body.organization_name,
    });

    if (!body?.ticket_id || !body?.subject) {
      console.error('[notify-support-ticket] missing required fields', {
        has_ticket_id: !!body?.ticket_id,
        has_subject: !!body?.subject,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Missing required fields (ticket_id, subject)',
          stage: 'validation',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let subject: string;
    let html: string;

    if (event === 'new_message') {
      ({ subject, html } = buildNewMessageEmail(body));
    } else {
      if (!body.first_message) {
        console.error('[notify-support-ticket] first_message missing for new_ticket');
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'first_message required for new_ticket',
            stage: 'validation',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      ({ subject, html } = buildNewTicketEmail(body));
    }

    console.log('[notify-support-ticket] calling Resend', {
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject,
    });

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        subject,
        html,
      }),
    });

    const rawText = await resp.text();
    let data: unknown = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    console.log('[notify-support-ticket] Resend response', {
      status: resp.status,
      ok: resp.ok,
      body: data,
      elapsed_ms: Date.now() - startedAt,
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Resend API error',
          stage: 'resend',
          status: resp.status,
          details: data,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        id: (data as { id?: string } | null)?.id,
        event,
        elapsed_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[notify-support-ticket] uncaught error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err), stage: 'exception' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
