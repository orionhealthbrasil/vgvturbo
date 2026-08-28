import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCatalogSettings, useUpdateCatalogSettings, type CatalogSettings } from '@/hooks/useCatalog';

interface Props {
  organizationId: string;
}

export function CatalogSettingsCard({ organizationId }: Props) {
  const { data: settings } = useCatalogSettings();
  const update = useUpdateCatalogSettings();
  const [form, setForm] = useState<Partial<CatalogSettings>>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (!settings) return null;

  const publicUrl = `${window.location.origin}/loja/${form.slug || settings.slug}`;

  const uploadImage = async (file: File, field: 'logo_url' | 'banner_url') => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${organizationId}/_catalog_${field}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('catalog-media').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('catalog-media').getPublicUrl(path);
      setForm({ ...form, [field]: pub.publicUrl });
    } catch (e: any) {
      toast.error('Erro ao enviar', { description: e.message });
    }
  };

  const save = async () => {
    const slug = (form.slug || '').trim();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/.test(slug)) {
      toast.error('Slug inválido: use letras, números e hífens (3-50 caracteres).');
      return;
    }
    try {
      await update.mutateAsync(form);
      toast.success('Configurações salvas');
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações da loja</CardTitle>
        <CardDescription>Personalize a página pública do seu catálogo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
          <span className="text-muted-foreground shrink-0">Link público:</span>
          <code className="flex-1 truncate">{publicUrl}</code>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success('Link copiado');
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Slug do link</Label>
            <Input
              value={form.slug || ''}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
              placeholder="minha-loja"
            />
          </div>
          <div>
            <Label>Nome da loja</Label>
            <Input
              value={form.display_name || ''}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Slogan</Label>
            <Input
              value={form.tagline || ''}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="Sua frase de impacto"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Sobre a loja</Label>
            <Textarea
              rows={3}
              value={form.about || ''}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
            />
          </div>
          <div>
            <Label>Cor de destaque</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="color"
                className="w-16 h-10 p-1"
                value={form.theme_color || '#0f172a'}
                onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
              />
              <Input
                value={form.theme_color || ''}
                onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Logo</Label>
            <div className="flex gap-2 items-center">
              {form.logo_url && (
                <img src={form.logo_url} alt="" className="h-10 w-10 object-contain rounded" />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo_url')}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Banner (opcional)</Label>
            <div className="flex gap-2 items-center">
              {form.banner_url && (
                <img src={form.banner_url} alt="" className="h-12 w-24 object-cover rounded" />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'banner_url')}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Modelo da mensagem do WhatsApp</Label>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={form.whatsapp_greeting_template || ''}
              onChange={(e) => setForm({ ...form, whatsapp_greeting_template: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variáveis: <code>{'{itens}'}</code> <code>{'{subtotal}'}</code> <code>{'{nome}'}</code>{' '}
              <code>{'{telefone}'}</code> <code>{'{observacoes}'}</code> <code>{'{order_id}'}</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_published ?? false}
              onCheckedChange={(c) => setForm({ ...form, is_published: c })}
            />
            <span className="text-sm">Loja publicada</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.show_prices ?? true}
              onCheckedChange={(c) => setForm({ ...form, show_prices: c })}
            />
            <span className="text-sm">Mostrar preços</span>
          </div>
        </div>

        <Button onClick={save} disabled={update.isPending}>
          <Save className="h-4 w-4 mr-2" /> Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
