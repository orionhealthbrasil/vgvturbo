import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PublicFormRenderer } from '@/components/forms/PublicFormRenderer';
import type { PublicFormView } from '@/types/forms';
import { toast } from 'sonner';

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<PublicFormView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ msg: string; redirect?: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      setLoading(true);
      const { data, error } = await (supabase as any).rpc('get_public_form', { p_slug: slug });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setForm(null);
      } else {
        const row = data[0];
        setForm({
          id: row.id,
          organization_id: row.organization_id,
          title: row.title,
          description: row.description,
          logo_url: row.logo_url,
          primary_color: row.primary_color || '#6366f1',
          thank_you_message: row.thank_you_message,
          redirect_url: row.redirect_url,
          fields: Array.isArray(row.fields) ? row.fields : [],
        });
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleSubmit = async (values: Record<string, any>, honeypot: string) => {
    if (!slug) return;
    setSubmitting(true);
    try {
      const url = `https://atnjikvdbvyvyabsxctj.supabase.co/functions/v1/submit-public-form`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, payload: values, honeypot }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || 'Erro ao enviar');
        return;
      }
      setSubmitted({
        msg: json.thank_you_message || form?.thank_you_message || 'Recebido!',
        redirect: json.redirect_url,
      });
      if (json.redirect_url) {
        setTimeout(() => {
          window.location.href = json.redirect_url;
        }, 2500);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro de rede');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Formulário não encontrado</h1>
          <p className="text-muted-foreground">
            Este link pode estar inativo ou ter sido removido.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: `${form.primary_color}22` }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: form.primary_color }} />
          </div>
          <h1 className="text-2xl font-bold">Obrigado!</h1>
          <p className="text-muted-foreground">{submitted.msg}</p>
          {submitted.redirect && (
            <p className="text-xs text-muted-foreground">Redirecionando...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-lg shadow-lg p-6 md:p-8 border">
          {form.logo_url && (
            <img
              src={form.logo_url}
              alt="logo"
              className="h-16 mx-auto mb-6 object-contain"
            />
          )}
          <h1
            className="text-2xl md:text-3xl font-bold text-center mb-2"
            style={{ color: form.primary_color }}
          >
            {form.title}
          </h1>
          {form.description && (
            <p className="text-sm text-muted-foreground text-center mb-6">
              {form.description}
            </p>
          )}
          <PublicFormRenderer
            fields={form.fields}
            primaryColor={form.primary_color}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Formulário seguro · powered by VGV Turbo
        </p>
      </div>
    </div>
  );
}
