import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Webhook, Copy, Trash2, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  usePaymentIntegrations, useCreatePaymentIntegration, useUpdatePaymentIntegration,
  useDeletePaymentIntegration, usePaymentIntegrationEvents, PaymentPlatform, PaymentIntegration,
} from '@/hooks/usePaymentIntegrations';

const WEBHOOK_BASE_URL = 'https://welindpmuqdnuazgaetz.supabase.co/functions/v1/payment-webhook';

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await window.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildSamplePayload(platform: PaymentPlatform) {
  switch (platform) {
    case 'hotmart':
      return {
        id: `test-${Date.now()}`,
        event: 'PURCHASE_APPROVED',
        version: '2.0.0',
        data: {
          product: { name: 'Produto Teste' },
          buyer: {
            name: 'Cliente Teste',
            email: 'teste@example.com',
            checkout_phone: '999999999',
            checkout_phone_code: '11',
          },
          purchase: { price: { value: 97 } },
        },
      };
    case 'stripe':
      return {
        id: `evt_test_${Date.now()}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            amount_total: 9700,
            customer_details: {
              name: 'Cliente Teste',
              email: 'teste@example.com',
              phone: '+5511999999999',
            },
            metadata: { product_name: 'Produto Teste' },
          },
        },
      };
    default:
      return {
        status: 'aprovado',
        name: 'Cliente Teste',
        phone: '11999999999',
        email: 'teste@example.com',
        product: 'Produto Teste',
        value: 97,
      };
  }
}

async function buildTestRequest(integration: PaymentIntegration): Promise<{ rawBody: string; headers: Record<string, string> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const payload = buildSamplePayload(integration.platform);
  const rawBody = JSON.stringify(payload);

  if (integration.platform === 'hotmart' && integration.secret) {
    headers['X-HOTMART-HOTTOK'] = integration.secret;
  } else if (integration.platform === 'stripe' && integration.secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = await hmacSha256Hex(integration.secret, `${timestamp}.${rawBody}`);
    headers['Stripe-Signature'] = `t=${timestamp},v1=${sig}`;
  } else if (integration.secret) {
    headers['X-Webhook-Secret'] = integration.secret;
  }

  return { rawBody, headers };
}

const PLATFORM_LABELS: Record<PaymentPlatform, string> = {
  hotmart: 'Hotmart',
  stripe: 'Stripe',
  kiwify: 'Kiwify',
  eduzz: 'Eduzz',
  monetizze: 'Monetizze',
  generic: 'Genérico',
};

const SECRET_HELP: Record<PaymentPlatform, string> = {
  hotmart: 'Hottok — copie em Hotmart → Ferramentas → Webhook → Autenticação.',
  stripe: 'Signing secret (whsec_...) — copie em Stripe → Developers → Webhooks → sua URL.',
  kiwify: 'Token de verificação, se a Kiwify oferecer (opcional). Suporte genérico — confira o log de eventos pra ajustar.',
  eduzz: 'Token de verificação, se a Eduzz oferecer (opcional). Suporte genérico — confira o log de eventos pra ajustar.',
  monetizze: 'Token de verificação, se a Monetizze oferecer (opcional). Suporte genérico — confira o log de eventos pra ajustar.',
  generic: 'Token opcional. Se preenchido, deve ser enviado pela plataforma no header X-Webhook-Secret ou na URL (?secret=...).',
};

function NewIntegrationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createIntegration = useCreatePaymentIntegration();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<PaymentPlatform>('hotmart');
  const [secret, setSecret] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    createIntegration.mutate(
      { name: name.trim(), platform, secret: secret.trim() || null },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName('');
          setPlatform('hotmart');
          setSecret('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova integração de pagamento</DialogTitle>
          <DialogDescription>Configure uma plataforma externa pra disparar automações quando uma compra for aprovada, reembolsada ou cancelada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Hotmart - Curso X" />
          </div>
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as PaymentPlatform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Secret / token de verificação</Label>
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Cole aqui o token da plataforma" />
            <p className="text-xs text-muted-foreground">{SECRET_HELP[platform]}</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={!name.trim() || createIntegration.isPending}>
            Criar integração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventsList({ integrationId }: { integrationId: string }) {
  const { data: events, isLoading } = usePaymentIntegrationEvents(integrationId);

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Carregando eventos...</p>;
  if (!events || events.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Nenhum evento recebido ainda. Configure a URL na plataforma e faça uma venda de teste.</p>;
  }

  return (
    <div className="space-y-1.5 py-2 max-h-80 overflow-y-auto">
      {events.map((e) => (
        <details key={e.id} className="text-xs border rounded-md p-2">
          <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
            <div className="min-w-0">
              <span className="font-medium">{e.buyer_name || e.buyer_phone || e.buyer_email || 'Sem dados de comprador'}</span>
              {e.product_name && <span className="text-muted-foreground"> — {e.product_name}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={e.status === 'processed' ? 'secondary' : 'destructive'} className="text-[10px]">
                {e.purchase_event || e.status}
              </Badge>
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString('pt-BR')}</span>
            </div>
          </summary>
          {e.error_message && (
            <p className="text-destructive mt-2">{e.error_message}</p>
          )}
          <pre className="mt-2 bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {e.raw_payload ? JSON.stringify(e.raw_payload, null, 2) : 'Sem payload registrado'}
          </pre>
        </details>
      ))}
    </div>
  );
}

function IntegrationCard({ integration }: { integration: PaymentIntegration }) {
  const updateIntegration = useUpdatePaymentIntegration();
  const deleteIntegration = useDeletePaymentIntegration();
  const queryClient = useQueryClient();
  const [showEvents, setShowEvents] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const webhookUrl = `${WEBHOOK_BASE_URL}?token=${integration.webhook_token}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const sendTestEvent = async () => {
    setSendingTest(true);
    try {
      const { rawBody, headers } = await buildTestRequest(integration);
      const res = await fetch(webhookUrl, { method: 'POST', headers, body: rawBody });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast.success('Evento de teste enviado! Veja em "Eventos recentes".');
      } else {
        toast.error(`A integração rejeitou o teste (${res.status}): ${json?.error || 'erro desconhecido'}`);
      }
    } catch (e: any) {
      toast.error(`Falha ao enviar evento de teste: ${e.message}`);
    } finally {
      setSendingTest(false);
      setShowEvents(true);
      queryClient.invalidateQueries({ queryKey: ['payment-integration-events', integration.id] });
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{integration.name}</h3>
          <Badge variant="outline" className="text-xs mt-1">{PLATFORM_LABELS[integration.platform]}</Badge>
        </div>
        <Switch
          checked={integration.is_active}
          onCheckedChange={(v) => updateIntegration.mutate({ id: integration.id, is_active: v })}
        />
      </div>

      <div className="flex items-center gap-2 bg-muted/30 rounded-md p-2">
        <code className="text-xs flex-1 truncate">{webhookUrl}</code>
        <Button size="sm" variant="ghost" onClick={copyUrl}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={sendTestEvent} disabled={sendingTest}>
          <FlaskConical className="w-3.5 h-3.5 mr-1" />
          {sendingTest ? 'Enviando...' : 'Enviar evento de teste'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowEvents((v) => !v)}>
          {showEvents ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
          Eventos recentes
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm('Remover esta integração?')) deleteIntegration.mutate(integration.id);
          }}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        "Enviar evento de teste" manda um pedido de verdade pra esta URL, simulando uma compra aprovada — cria/atualiza um contato chamado "Cliente Teste" e pode disparar suas automações reais. Use só pra testar.
      </p>

      {showEvents && <EventsList integrationId={integration.id} />}
    </Card>
  );
}

export default function PaymentIntegrations() {
  const { data: integrations, isLoading } = usePaymentIntegrations();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Integrações de Pagamento</h1>
          <p className="text-muted-foreground text-sm">
            Receba avisos de compra aprovada/reembolsada/cancelada de plataformas externas e use isso em automações.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova integração
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (integrations ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <Webhook className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Nenhuma integração ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crie uma integração pra receber uma URL de webhook e colar na Hotmart, Stripe ou outra plataforma.
          </p>
          <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nova integração</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations!.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      )}

      <NewIntegrationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
