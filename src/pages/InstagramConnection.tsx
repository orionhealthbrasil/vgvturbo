import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, CheckCircle2, AlertCircle, Loader2, Unplug, ExternalLink, FlaskConical, XCircle, MessageCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useCanAccess } from '@/hooks/usePermissions';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';



export default function InstagramConnection() {
  const { data: orgData, isLoading: orgLoading } = useUserOrganization();
  const queryClient = useQueryClient();
  const { canEdit } = useCanAccess('connection');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data: igAppId, isLoading: appIdLoading } = useQuery({
    queryKey: ['instagram-app-id'],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.functions.invoke('instagram-auth-config');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.app_id || '';
    },
    staleTime: 60 * 60 * 1000,
  });

  const orgId = orgData?.organization?.id;

  const { data: igInstance, isLoading: instanceLoading } = useQuery({
    queryKey: ['instagram-instance', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('instagram_instances')
        .select('id, organization_id, ig_user_id, page_id, token_expires_at, account_name, profile_picture_url, created_at, updated_at, auth_type, username')
        .eq('organization_id', orgId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && orgId) {
      handleOAuthCallback(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [orgId]);

  const handleOAuthCallback = async (code: string) => {
    setIsConnecting(true);
    try {
      const redirectUri = `https://vgvturbo.com.br/instagram`;
      const { data, error } = await supabase.functions.invoke('instagram-oauth-callback', {
        body: { code, organization_id: orgId, redirect_uri: redirectUri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Instagram @${data.account_name} conectado!`);
      queryClient.invalidateQueries({ queryKey: ['instagram-instance'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao conectar Instagram');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = () => {
    if (!igAppId) {
      toast.error('Instagram App ID não configurado');
      return;
    }
    const redirectUri = `https://vgvturbo.com.br/instagram`;
    const scopes = [
      'instagram_business_basic',
      'instagram_business_manage_messages',
    ].join(',');
    const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${igAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (!orgId || !igInstance) return;
    setIsDisconnecting(true);
    try {
      const { error } = await supabase.from('instagram_instances').delete().eq('organization_id', orgId);
      if (error) throw error;
      toast.success('Instagram desconectado');
      queryClient.invalidateQueries({ queryKey: ['instagram-instance'] });
    } catch {
      toast.error('Erro ao desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isLoading = orgLoading || instanceLoading;
  const isConnected = !!igInstance;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Instagram</h1>
        <p className="text-muted-foreground">
          Conecte sua conta Business para gerenciar Direct Messages.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
            <Instagram className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Instagram Business</CardTitle>
            <CardDescription>Conexão e status da conta</CardDescription>
          </div>
          {isConnected ? (
            <Badge className="bg-green-500 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
            </Badge>
          ) : (
            <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Desconectado</Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Avatar>
                  <AvatarImage src={igInstance.profile_picture_url || undefined} />
                  <AvatarFallback><Instagram className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">@{igInstance.account_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Conectado em {new Date(igInstance.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <PermissionGuard permission="connection" requireEdit>
                  <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting}>
                    Reconectar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isDisconnecting}>
                    {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!appIdLoading && !igAppId && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Instagram App ID não configurado no backend (secret <code>INSTAGRAM_APP_ID</code>).</AlertDescription>
                </Alert>
              )}
              <PermissionGuard permission="connection" requireEdit>
                <Button onClick={handleConnect} disabled={isConnecting || !igAppId}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Instagram className="h-4 w-4 mr-2" />}
                  Conectar Instagram
                </Button>
              </PermissionGuard>
              <div className="text-sm text-muted-foreground">
                Você precisa de uma conta Instagram Business ou Creator. Login direto, sem precisar de Facebook.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && orgId && (
        <Card className="hover:bg-muted/30 transition-colors">
          <Link to="/instagram/comentarios" className="block">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Comentários do Instagram</CardTitle>
                <CardDescription>
                  Veja e responda comentários nos seus posts diretamente daqui.
                </CardDescription>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
          </Link>
        </Card>
      )}

      {isConnected && orgId && <ApiTestsCard orgId={orgId} />}

    </div>
  );
}

// ----- API Tests card (App Review helper) -----
function ApiTestsCard({ orgId }: { orgId: string }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const runTests = async () => {
    setRunning(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-run-api-tests', {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.results || []);
      const okCount = (data.results || []).filter((r: any) => r.ok).length;
      toast.success(`${okCount}/${data.results?.length || 0} chamadas bem-sucedidas`);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao executar testes');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4" /> Testes de API (App Review)
        </CardTitle>
        <CardDescription>
          Dispara chamadas reais para as 4 permissões pendentes do Instagram. Use isso para liberar a submissão no App Review da Meta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PermissionGuard permission="connection" requireEdit>
          <Button onClick={runTests} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
            Executar testes de API
          </Button>
        </PermissionGuard>

        {results && (
          <div className="space-y-2 pt-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                {r.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.permission}</p>
                  <p className="text-xs text-muted-foreground">{r.endpoint}</p>
                  {r.error && (
                    <p className="text-xs text-destructive mt-1 break-words">{r.error}</p>
                  )}
                </div>
                <Badge variant={r.ok ? 'default' : 'destructive'}>{r.status || 'erro'}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
