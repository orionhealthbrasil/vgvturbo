// supabase/functions/submit-public-form/index.ts
// Public endpoint for lead form submissions. verify_jwt = false.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// In-memory rate limit (per edge instance). Map<ip+slug, {count, resetAt}>
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string, slug: string): boolean {
  const key = `${ip}:${slug}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

// Brazilian phone normalization → 13 digits (55 + DDD + 9 + number)
function normalizeBrPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  let local = digits;
  if (local.startsWith('55')) local = local.substring(2);
  if (local.length === 10) {
    // missing 9
    const ddd = local.substring(0, 2);
    const rest = local.substring(2);
    const first = rest[0];
    if (['6', '7', '8', '9'].includes(first)) {
      return `55${ddd}9${rest}`;
    }
    return `55${local}`; // landline
  }
  if (local.length === 11) {
    return `55${local}`;
  }
  if (local.length >= 12 && digits.startsWith('55')) {
    return digits;
  }
  return null;
}

interface SubmitBody {
  slug: string;
  payload: Record<string, any>;
  honeypot?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { slug, payload, honeypot } = body || ({} as SubmitBody);

  // Honeypot
  if (honeypot && honeypot.trim().length > 0) {
    console.log('[submit-public-form] honeypot triggered, slug=', slug);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!slug || typeof slug !== 'string') {
    return new Response(JSON.stringify({ error: 'slug obrigatório' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown';

  if (!checkRateLimit(ip, slug)) {
    return new Response(JSON.stringify({ error: 'Muitas submissões. Aguarde alguns instantes.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Load form by slug
  const { data: forms, error: formErr } = await supabase
    .from('lead_forms')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .limit(1);

  if (formErr || !forms || forms.length === 0) {
    return new Response(JSON.stringify({ error: 'Formulário não encontrado ou inativo' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const form = forms[0];
  const fields: Array<{ key: string; label: string; type: string; required?: boolean; customFieldId?: string | null }> =
    Array.isArray(form.fields) ? form.fields : [];

  // Validate required fields
  for (const f of fields) {
    if (f.required) {
      const v = payload?.[f.key];
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        return new Response(
          JSON.stringify({ error: `Campo obrigatório ausente: ${f.label}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // Extract canonical fields (name, phone, email)
  const nameField = fields.find((f) => f.type === 'text' && /nome|name/i.test(f.label));
  const phoneField = fields.find((f) => f.type === 'phone');
  const emailField = fields.find((f) => f.type === 'email');

  const rawName: string =
    (nameField && payload[nameField.key]) ||
    payload['nome'] ||
    payload['name'] ||
    'Lead via formulário';
  const rawPhone: string =
    (phoneField && payload[phoneField.key]) ||
    payload['telefone'] ||
    payload['phone'] ||
    '';
  const rawEmail: string | null =
    (emailField && payload[emailField.key]) || payload['email'] || null;

  const phone = normalizeBrPhone(rawPhone);
  if (!phone) {
    return new Response(JSON.stringify({ error: 'Telefone inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Insert raw submission first (status=received)
  const { data: submissionRow, error: subErr } = await supabase
    .from('form_submissions')
    .insert({
      form_id: form.id,
      organization_id: form.organization_id,
      payload,
      ip_address: ip,
      user_agent: req.headers.get('user-agent'),
      status: 'received',
    })
    .select('id')
    .single();

  if (subErr || !submissionRow) {
    console.error('[submit-public-form] failed to insert submission', subErr);
    return new Response(JSON.stringify({ error: 'Falha interna' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const submissionId = submissionRow.id;

  try {
    // Find or create contact
    let contactId: string | null = null;
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('organization_id', form.organization_id)
      .eq('phone', phone)
      .limit(1);

    if (existing && existing.length > 0) {
      contactId = existing[0].id;
      const updates: Record<string, any> = {};
      if (!existing[0].name || existing[0].name === 'Sem nome') updates.name = rawName;
      if (rawEmail && !existing[0].email) updates.email = rawEmail;
      if (Object.keys(updates).length > 0) {
        await supabase.from('contacts').update(updates).eq('id', contactId);
      }
    } else {
      // Determine assigned_to
      let assignedTo: string | null = null;
      if (form.assignment_strategy === 'fixed' && form.assigned_to) {
        assignedTo = form.assigned_to;
      } else if (form.assignment_strategy === 'round_robin') {
        // Find the viewer with the oldest most recent assignment in this org
        const { data: viewers } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', form.organization_id)
          .eq('member_role', 'viewer');

        if (viewers && viewers.length > 0) {
          const userIds = viewers.map((v: any) => v.user_id);
          // Get last assignment per user
          const { data: lastAssigns } = await supabase
            .from('contacts')
            .select('assigned_to, created_at')
            .in('assigned_to', userIds)
            .eq('organization_id', form.organization_id)
            .order('created_at', { ascending: false })
            .limit(200);

          const lastByUser = new Map<string, string>();
          (lastAssigns || []).forEach((c: any) => {
            if (c.assigned_to && !lastByUser.has(c.assigned_to)) {
              lastByUser.set(c.assigned_to, c.created_at);
            }
          });
          // Pick the user with no assignment first, else the oldest
          let chosen: string | null = null;
          for (const uid of userIds) {
            if (!lastByUser.has(uid)) {
              chosen = uid;
              break;
            }
          }
          if (!chosen) {
            chosen = userIds.sort((a, b) =>
              (lastByUser.get(a) || '').localeCompare(lastByUser.get(b) || '')
            )[0];
          }
          assignedTo = chosen;
        }
      }

      const insertContact: Record<string, any> = {
        organization_id: form.organization_id,
        name: rawName,
        phone,
        email: rawEmail,
        channel: 'whatsapp',
        funnel_stage: form.funnel_stage || 'lead',
        pipeline_id: form.pipeline_id,
        kanban_column_id: form.kanban_column_id,
        assigned_to: assignedTo,
        notes: `Origem: formulário (${form.title})`,
      };

      const { data: createdContact, error: cErr } = await supabase
        .from('contacts')
        .insert(insertContact)
        .select('id')
        .single();

      if (cErr || !createdContact) {
        console.error('[submit-public-form] contact create failed', cErr);
        await supabase
          .from('form_submissions')
          .update({ status: 'failed', error_message: cErr?.message || 'contact create failed' })
          .eq('id', submissionId);
        return new Response(JSON.stringify({ error: 'Falha ao criar contato' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      contactId = createdContact.id;
    }

    // Apply default tags (create missing tags)
    if (Array.isArray(form.default_tags) && form.default_tags.length > 0 && contactId) {
      for (const tagName of form.default_tags) {
        if (!tagName || typeof tagName !== 'string') continue;
        // find or create tag
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('organization_id', form.organization_id)
          .ilike('name', tagName)
          .limit(1);

        let tagId: string | null = existingTag && existingTag.length > 0 ? existingTag[0].id : null;
        if (!tagId) {
          const { data: created } = await supabase
            .from('tags')
            .insert({ organization_id: form.organization_id, name: tagName, color: '#6366f1' })
            .select('id')
            .single();
          tagId = created?.id ?? null;
        }
        if (tagId) {
          await supabase
            .from('contact_tags')
            .upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: 'contact_id,tag_id' });
        }
      }
    }

    // Map customFieldId fields
    for (const f of fields) {
      if (f.customFieldId && payload[f.key] !== undefined && contactId) {
        const value = payload[f.key];
        await supabase
          .from('contact_custom_fields')
          .upsert(
            {
              contact_id: contactId,
              organization_id: form.organization_id,
              field_definition_id: f.customFieldId,
              field_name: f.label,
              field_value: value === null || value === undefined ? '' : String(value),
            },
            { onConflict: 'contact_id,field_definition_id' as any }
          );
      }
    }

    // Update submission as processed
    await supabase
      .from('form_submissions')
      .update({ status: 'processed', contact_id: contactId })
      .eq('id', submissionId);

    // Increment counter (best-effort)
    await supabase
      .from('lead_forms')
      .update({ submission_count: (form.submission_count ?? 0) + 1 })
      .eq('id', form.id);

    // Trigger automation engine in background
    const enginePayload = {
      contact_id: contactId,
      organization_id: form.organization_id,
      event_type: 'form_submitted',
      form_id: form.id,
    };

    // @ts-ignore EdgeRuntime
    EdgeRuntime.waitUntil(
      fetch(`${SUPABASE_URL}/functions/v1/automation-engine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(enginePayload),
      }).catch((e) => console.error('[submit-public-form] engine fire failed', e))
    );

    return new Response(
      JSON.stringify({
        ok: true,
        thank_you_message: form.thank_you_message,
        redirect_url: form.redirect_url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[submit-public-form] unexpected', err);
    await supabase
      .from('form_submissions')
      .update({ status: 'failed', error_message: err?.message || 'unexpected' })
      .eq('id', submissionId);
    return new Response(JSON.stringify({ error: 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
