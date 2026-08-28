import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Save, ShieldCheck, PowerOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useCanAccess } from '@/hooks/usePermissions';

const WEBHOOK_URL =
  'https://atnjikvdbvyvyabsxctj.supabase.co/functions/v1/whatsapp-meta-webhook';

interface MetaInstance {
  id: string;
  organization_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  waba_id: string | null;
  access_token: string | null;
  business_name: string | null;
  is_active: boolean;
  last_event_at: string | null;
}

export default function MetaConnection() {
  const { data: orgData, isLoading: orgLoading } = useUserOrganization();
  const orgId = orgData?.organization?.id;
  const queryClient = useQueryClient();
  const { canEdit } = useCanAccess('connection');

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const { data: instance, isLoading } = useQuery({
    queryKey: ['meta-instance', orgId],
    queryFn: async (): Promise<MetaInstance | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('whatsapp_meta_instances' as any)
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (error) {
        console.error('[MetaConnection] load error', error);
        return null;
      }
      return (data as unknown as MetaInstance) ?? null;
    },
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (instance) {
      setPhoneNumberId(instance.phone_number_id);
      setBusinessName(instance.business_name ?? '');
      setWabaId(instance.waba_id ?? '');
      setAccessToken(instance.access_token ?? '');
    }
  }, [instance]);

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organização não encontrada');
      const pid = phoneNumberId.trim();
      if (!pid) throw new Error('Phone Number ID é obrigatório');
      if (!/^\d{6,30}$/.test(pid)) throw new Error('Phone Number ID deve conter apenas números');

      const payload = {
        phone_number_id: pid,
        business_name: businessName.trim() || null,
        waba_id: wabaId.trim() || null,
        access_token: accessToken.trim() || null,
      };

      if (instance) {
        const { error } = await supabase
          .from('whatsapp_meta_instances' as any)
          .update(payload)
          .eq('id', instance.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_meta_instances' as any)
          .insert({ organization_id: orgId, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meta-instance'] });
      toast.success('Configuração salva!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!instance) throw new Error('Nenhuma instância ativa');
      const { error } = await supabase
        .from('whatsapp_meta_instances' as any)
        .update({ is_active: false, access_token: null })
        .eq('id', instance.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meta-instance'] });
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-provider'] });
      toast.success('API Oficial desconectada. Envios voltarão pela API não-oficial.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      toast.success('URL copiada');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const isReceiving = !!instance?.last_event_at &&
    Date.now() - new Date(instance.last_event_at).getTime() < 1000 * 60 * 60 * 24;

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PermissionGuard permission="connection">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">WhatsApp API Oficial</h2>
            <p className="text-sm text-muted-foreground">
              Conexão homologada via Meta Cloud API. Recomendado para alto volume e produção.
            </p>
          </div>
        </div>

        {/* Webhook URL Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">URL de Webhook</CardTitle>
            <CardDescription>
              Esta URL deve ser informada à equipe de suporte para configurar a integração com a Meta. Ela é a mesma para todas as organizações — a identificação é feita pelo Phone Number ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyWebhook}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Configuração da Instância</CardTitle>
                <CardDescription>
                  Informe o Phone Number ID fornecido pelo suporte.
                </CardDescription>
              </div>
              {instance ? (
                isReceiving ? (
                  <Badge className="gap-1.5 bg-status-success hover:bg-status-success/90">
                    <CheckCircle2 className="w-3 h-3" />
                    Recebendo eventos
                  </Badge>
                ) : (
                  <Badge variant="outline">Aguardando primeira mensagem</Badge>
                )
              ) : (
                <Badge variant="outline">Não configurado</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canEdit && (
              <Alert>
                <AlertDescription>
                  Você não tem permissão para editar esta configuração. Entre em contato com um administrador.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                <Input
                  id="phoneNumberId"
                  placeholder="ex: 960916317097542"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Identificador numérico do número conectado.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessName">Nome do Negócio (opcional)</Label>
                <Input
                  id="businessName"
                  placeholder="ex: Minha Empresa"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wabaId">WABA ID</Label>
                <Input
                  id="wabaId"
                  placeholder="ex: 102290129340398"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground">
                  WhatsApp Business Account ID (opcional, preenchido automaticamente).
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="accessToken">Access Token (Permanente)</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="EAAG..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  disabled={!canEdit}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Token permanente fornecido pelo suporte. Necessário para envio de mensagens pela API.
                </p>
              </div>
            </div>

            {instance && (
              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Número conectado</Label>
                  <p className="text-sm font-mono">
                    {instance.display_phone_number ? `+${instance.display_phone_number}` : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Último evento</Label>
                  <p className="text-sm">
                    {instance.last_event_at
                      ? new Date(instance.last_event_at).toLocaleString('pt-BR')
                      : '—'}
                  </p>
                </div>
              </div>
            )}

            {canEdit && (
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending || !phoneNumberId.trim()}
                className="gap-2"
              >
                {save.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar
              </Button>
            )}
            {canEdit && instance && instance.is_active && (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm('Desativar a API Oficial? Os envios passarão a usar a API não-oficial. Você pode reativar a qualquer momento salvando o token novamente.')) {
                    disconnect.mutate();
                  }
                }}
                disabled={disconnect.isPending}
                className="gap-2 ml-2 text-destructive hover:text-destructive"
              >
                {disconnect.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PowerOff className="w-4 h-4" />
                )}
                Desconectar API Oficial
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Como funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Solicite ao suporte a ativação da API oficial e o Phone Number ID do seu número.</li>
              <li>Cole o Phone Number ID acima e salve.</li>
              <li>Envie uma mensagem teste — ela aparecerá no Chat em segundos.</li>
              <li>O envio pelo aplicativo continua disponível normalmente; tudo será sincronizado.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
