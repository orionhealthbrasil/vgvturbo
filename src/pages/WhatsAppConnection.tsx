import { useState, useEffect } from 'react';
import { 
  Smartphone, 
  QrCode, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  LogOut, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useCanAccess } from '@/hooks/usePermissions';

type ConnectionStatus = 'loading' | 'connected' | 'disconnected' | 'connecting' | 'not_configured';

interface WhatsAppInstance {
  id: string;
  organization_id: string;
  instance_name: string;
  api_key: string;
  base_url: string;
}

export default function WhatsAppConnection() {
  const { data: orgData, isLoading: orgLoading } = useUserOrganization();
  const queryClient = useQueryClient();
  const { canEdit } = useCanAccess('connection');
  
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Form state
  const [instanceName, setInstanceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://smv2-1.stevo.chat');

  const organizationId = orgData?.organization?.id;

  const fetchApiKey = async (instanceId: string): Promise<string> => {
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_api_key' as any, { p_instance_id: instanceId });
      if (error) {
        console.warn('[WhatsAppConnection] get_whatsapp_api_key RPC failed (function may not exist on this DB). Continuing with empty key.', error);
        return '';
      }
      return (data as unknown as string) || '';
    } catch (err) {
      console.warn('[WhatsAppConnection] get_whatsapp_api_key threw. Continuing with empty key.', err);
      return '';
    }
  };

  const fetchLatestInstance = async (): Promise<WhatsAppInstance | null> => {
    if (!organizationId) return null;

    const { data, error } = await supabase
      .from('whatsapp_instances')
      .select('id, organization_id, instance_name, base_url')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      console.error('[WhatsAppConnection] failed to load instance row', error);
      return null;
    }
    if (!data) return null;
    const key = await fetchApiKey(data.id);
    return { ...data, api_key: key } as WhatsAppInstance;
  };

  // Fetch existing instance settings
  const { data: instanceData, isLoading: instanceLoading } = useQuery({
    queryKey: ['whatsapp-instance', organizationId],
    queryFn: async (): Promise<WhatsAppInstance | null> => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, organization_id, instance_name, base_url')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        console.error('[WhatsAppConnection] failed to load instance row', error);
        return null;
      }
      if (!data) return null;
      const key = await fetchApiKey(data.id);
      return { ...data, api_key: key } as WhatsAppInstance;
    },
    enabled: !!organizationId,
  });

  // Update form when data loads
  useEffect(() => {
    if (instanceData) {
      setInstanceName(instanceData.instance_name);
      setApiKey(instanceData.api_key);
      setBaseUrl(instanceData.base_url || 'https://smv2-1.stevo.chat');
    }
  }, [instanceData]);

  // Save instance settings
  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('Organização não encontrada');
      if (!instanceName.trim()) throw new Error('Nome da instância é obrigatório');
      if (!apiKey.trim()) throw new Error('API Key é obrigatória');

      // Anti-autofill: detectar se o navegador preencheu com email/senha de login
      if (instanceName.includes('@')) {
        throw new Error('O nome da instância parece um e-mail. Verifique se o navegador preencheu o campo automaticamente.');
      }
      if (instanceName.trim().length < 3) {
        throw new Error('Nome da instância muito curto. Verifique se está correto.');
      }
      if (!baseUrl.trim()) throw new Error('URL Base é obrigatória');

      if (instanceData) {
        // Update existing
        const { error } = await supabase
          .from('whatsapp_instances')
          .update({ 
            instance_name: instanceName.trim(), 
            api_key: apiKey.trim(),
            base_url: baseUrl.trim(),
          })
          .eq('id', instanceData.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('whatsapp_instances')
          .insert({ 
            organization_id: organizationId,
            instance_name: instanceName.trim(), 
            api_key: apiKey.trim(),
            base_url: baseUrl.trim(),
          });
        
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-instance'] });
      await queryClient.refetchQueries({ queryKey: ['whatsapp-instance', organizationId] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar configurações');
    },
  });

  // Check connection status on mount and when settings change
  useEffect(() => {
    if (instanceData) {
      checkStatus();
    } else if (!instanceLoading && organizationId) {
      setStatus('not_configured');
    }
  }, [instanceData, instanceLoading, organizationId]);

  const checkStatus = async () => {
    const latest = await fetchLatestInstance();
    if (!latest) {
      setStatus('not_configured');
      return;
    }
    
    setStatus('loading');
    
    try {
      const { data, error } = await supabase.functions.invoke('stevo-status', {
        body: { 
          organization_id: organizationId,
          instance_name: latest.instance_name,
          api_key: latest.api_key,
          base_url: latest.base_url,
        },
      });

      if (error) {
        console.error('Status check error:', error);
        setStatus('disconnected');
        setPhoneNumber(null);
        return;
      }

      if (data.state === 'connected') {
        setStatus('connected');
        setQrCode(null);
        // Extract phone number from response
        if (data.phoneNumber) {
          setPhoneNumber(data.phoneNumber);
        }
      } else {
        setStatus('disconnected');
        setPhoneNumber(null);
      }
    } catch (err) {
      console.error('Status check failed:', err);
      setStatus('disconnected');
      setPhoneNumber(null);
    }
  };

  const generateQrCode = async () => {
    const latest = await fetchLatestInstance();
    if (!latest) {
      toast.error('Configure a instância primeiro');
      return;
    }

    setIsGenerating(true);
    setQrCode(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('stevo-connect', {
        body: { 
          organization_id: organizationId,
          instance_name: latest.instance_name,
          api_key: latest.api_key,
          base_url: latest.base_url,
        },
      });

      if (error) {
        console.error('QR generation error:', error);
        toast.error('Erro ao gerar QR Code');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data.base64) {
        setQrCode(data.base64);
        setStatus('connecting');
        toast.success('QR Code gerado! Escaneie com seu WhatsApp');
        
        // Start polling for connection status
        startStatusPolling();
      } else if (data.status === 'connected') {
        setStatus('connected');
        toast.success('WhatsApp já está conectado!');
      }
    } catch (err) {
      console.error('QR generation failed:', err);
      toast.error('Erro ao conectar com a API');
    } finally {
      setIsGenerating(false);
    }
  };

  const startStatusPolling = () => {
    if (!organizationId) return;
    
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds total
    
    const interval = setInterval(async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        clearInterval(interval);
        toast.error('Tempo expirado. Gere um novo QR Code.');
        setQrCode(null);
        setStatus('disconnected');
        return;
      }

      try {
        const latest = await fetchLatestInstance();
        if (!latest) return;

        const { data } = await supabase.functions.invoke('stevo-status', {
          body: { 
            organization_id: organizationId,
            instance_name: latest.instance_name,
            api_key: latest.api_key,
            base_url: latest.base_url,
          },
        });

        if (data?.state === 'connected') {
          clearInterval(interval);
          setStatus('connected');
          setQrCode(null);
          toast.success('WhatsApp conectado com sucesso!');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  const disconnect = async () => {
    const latest = await fetchLatestInstance();
    if (!latest) return;

    setIsDisconnecting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('stevo-disconnect', {
        body: { 
          organization_id: organizationId,
          instance_name: latest.instance_name,
          api_key: latest.api_key,
          base_url: latest.base_url,
        },
      });

      if (error || data?.error) {
        console.error('Disconnect error:', error || data?.error);
        toast.error(data?.error || 'Erro ao desconectar');
        return;
      }

      setStatus('disconnected');
      setQrCode(null);
      toast.success('WhatsApp desconectado');
    } catch (err) {
      console.error('Disconnect failed:', err);
      toast.error('Erro ao desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'loading':
        return (
          <Badge variant="outline" className="gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verificando...
          </Badge>
        );
      case 'connected':
        return (
          <Badge className="gap-1.5 bg-primary hover:bg-primary/90">
            <Wifi className="w-3 h-3" />
            Conectado
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="secondary" className="gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Aguardando escaneamento...
          </Badge>
        );
      case 'not_configured':
        return (
          <Badge variant="outline" className="gap-1.5">
            <Settings className="w-3 h-3" />
            Não configurado
          </Badge>
        );
      case 'disconnected':
      default:
        return (
          <Badge variant="destructive" className="gap-1.5">
            <WifiOff className="w-3 h-3" />
            Desconectado
          </Badge>
        );
    }
  };

  if (orgLoading || instanceLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <Skeleton className="h-8 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <PermissionGuard permission="connection">
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-status-success/10">
          <Smartphone className="w-6 h-6 text-status-success" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Conexão WhatsApp</h1>
          <p className="text-muted-foreground">
            Conecte seu WhatsApp Business para receber e enviar mensagens
          </p>
        </div>
      </div>

      {/* Instance Settings Card - Only show for users with edit permission */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurações da Instância</CardTitle>
            <CardDescription>
              Informe os dados da sua instância WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            {/* Honeypot fields to absorb browser autofill */}
            <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
            <input type="password" name="password" autoComplete="current-password" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  name="wa-instance-name"
                  placeholder="minha-instancia"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                />
                <p className="text-xs text-muted-foreground">
                  Nome da instância configurada pelo administrador
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="apiKey">Chave de API</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    name="wa-api-token"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sua-api-key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Chave de autenticação da API
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="baseUrl">URL Base da API</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://smv2-1.stevo.chat"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL do servidor Stevo (ex: https://smv2-1.stevo.chat ou https://smv2-9.stevo.chat)
                </p>
              </div>
            </div>

            <Button 
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending || !instanceName.trim() || !apiKey.trim() || !baseUrl.trim()}
              className="gap-2"
            >
              {saveSettings.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar Configurações
            </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Status da Conexão</CardTitle>
              {instanceData && (
                <CardDescription>
                  Instância: {instanceData.instance_name}
                </CardDescription>
              )}
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Not Configured State */}
          {status === 'not_configured' && (
            <Alert className="border-muted">
              <Settings className="w-4 h-4" />
              <AlertDescription>
                Configure as credenciais da instância acima para começar.
              </AlertDescription>
            </Alert>
          )}

          {/* Connected State */}
          {status === 'connected' && (
            <div className="space-y-4">
              <Alert className="border-status-success/30 bg-status-success/10">
                <CheckCircle2 className="w-4 h-4 text-status-success" />
                <AlertDescription className="text-foreground">
                  Seu WhatsApp está conectado e pronto para receber mensagens.
                  {phoneNumber && (
                    <span className="block mt-1 font-medium">
                      Número conectado: +{phoneNumber}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={checkStatus}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Atualizar Status
                </Button>
                {canEdit && (
                  <Button 
                    variant="destructive" 
                    onClick={disconnect}
                    disabled={isDisconnecting}
                    className="gap-2"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                    Desconectar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Disconnected State */}
          {status === 'disconnected' && !qrCode && instanceData && (
            <div className="space-y-4">
              <Alert className="border-status-warning/30 bg-status-warning/10">
                <AlertCircle className="w-4 h-4 text-status-warning" />
                <AlertDescription className="text-foreground">
                  WhatsApp não conectado. {canEdit ? 'Gere um QR Code para conectar.' : 'Entre em contato com um administrador.'}
                </AlertDescription>
              </Alert>
              
              {canEdit && (
                <Button 
                  onClick={generateQrCode}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  Gerar QR Code
                </Button>
              )}
            </div>
          )}

          {/* QR Code Display - Only for users with edit permission */}
          {canEdit && (status === 'connecting' || qrCode) && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-6">
                {qrCode ? (
                  <div className="p-4 bg-white rounded-xl shadow-lg">
                    <img 
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64"
                    />
                  </div>
                ) : (
                  <Skeleton className="w-64 h-64" />
                )}
                
                <div className="text-center space-y-1">
                  <p className="font-medium">Escaneie o QR Code</p>
                  <p className="text-sm text-muted-foreground">
                    Abra o WhatsApp no seu celular → Menu (⋮) → Aparelhos conectados → Conectar um aparelho
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button 
                  variant="outline" 
                  onClick={generateQrCode}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Atualizar QR Code
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setQrCode(null);
                    setStatus('disconnected');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {status === 'loading' && !qrCode && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions Card - Only show for users with edit permission */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Como conectar</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Informe o nome da instância e a chave de API nos campos acima</li>
              <li>Clique em "Salvar Configurações"</li>
              <li>Clique em "Gerar QR Code"</li>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em Menu (⋮) → Aparelhos conectados → Conectar</li>
              <li>Escaneie o QR Code exibido na tela</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
    </PermissionGuard>
  );
}
