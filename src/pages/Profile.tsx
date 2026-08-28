import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Camera, User, ArrowLeft, Building2, Copy, Check, Volume2, VolumeX, MessageCircle, UserCircle, Settings2, Bell, BellOff, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useChatPreferences } from '@/hooks/useChatPreferences';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { useMemberAvailability } from '@/hooks/useMemberAvailability';
import { QuickMessagesManager } from '@/components/profile/QuickMessagesManager';
import { StickersManager } from '@/components/profile/StickersManager';
import { cn } from '@/lib/utils';

type SectionKey = 'sobre' | 'preferencias';
const VALID_SECTIONS: SectionKey[] = ['sobre', 'preferencias'];

const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'sobre', label: 'Sobre', icon: UserCircle },
  { key: 'preferencias', label: 'Preferências', icon: Settings2 },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: orgData } = useUserOrganization();
  const { isSoundEnabled, toggleSound, playNotificationSound } = useNotificationSound();
  const { showSenderName, toggleShowSenderName, unreadOnTop, toggleUnreadOnTop } = useChatPreferences();
  const browserNotif = useBrowserNotifications();
  const { isAvailable, toggleAvailable, isUpdating: isUpdatingAvailability } = useMemberAvailability();

  const handleToggleBrowserNotif = async (checked: boolean) => {
    if (checked) {
      const res = await browserNotif.enable();
      if (res.ok) {
        toast.success('Notificações do navegador ativadas!');
      } else if (res.reason === 'iframe') {
        toast.error('Não é possível ativar dentro do editor Lovable. Abra a app em uma janela própria (URL publicada) e tente de novo.');
      } else if (res.reason === 'denied') {
        toast.error('Permissão negada. Habilite as notificações nas configurações do navegador para este site.');
      } else if (res.reason === 'unsupported') {
        toast.error('Seu navegador não suporta notificações desktop.');
      } else {
        toast.error('Não foi possível ativar as notificações.');
      }
    } else {
      browserNotif.disable();
      toast.success('Notificações do navegador desativadas');
    }
  };

  const handleTestBrowserNotif = () => {
    const res = browserNotif.testNotification();
    if (res.ok) {
      toast.success('Notificação enviada! Se nada apareceu, verifique a Central de Ações do Windows e as permissões do navegador.');
      return;
    }
    if (res.reason === 'iframe') {
      toast.error('Bloqueado pelo navegador dentro de iframes. Abra a app em janela própria (URL publicada).');
    } else if (res.reason === 'denied') {
      toast.error('Permissão negada. Libere notificações para este site nas configurações do navegador.');
    } else if (res.reason === 'default') {
      toast.error('Permissão ainda não concedida. Ative o toggle primeiro.');
    } else if (res.reason === 'unsupported') {
      toast.error('Navegador não suporta notificações desktop.');
    } else {
      toast.error(`Falha ao disparar notificação (${res.reason}).`);
    }
  };

  const openInNewWindow = () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      /* noop */
    }
  };



  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') as SectionKey | null;
  const activeSection: SectionKey = sectionParam && VALID_SECTIONS.includes(sectionParam) ? sectionParam : 'sobre';
  const handleSectionChange = (key: SectionKey) => setSearchParams({ section: key }, { replace: true });

  const [fullName, setFullName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyOrgId = async () => {
    if (!orgData?.organization.id) return;
    try {
      await navigator.clipboard.writeText(orgData.organization.id);
      setCopied(true);
      toast.success('ID da organização copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      if (data?.full_name) setFullName(data.full_name);
      return data;
    },
    enabled: !!user?.id,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { full_name?: string; avatar_url?: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('profiles').update(data).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar perfil. Tente novamente.');
    },
  });

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Por favor, preencha seu nome.');
      return;
    }
    updateProfileMutation.mutate({ full_name: fullName.trim() });
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const compressImage = (file: File, maxWidth = 400, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Could not compress image'));
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem.');
      return;
    }
    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], 'avatar.jpg', { type: 'image/jpeg' });
      const fileName = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      await updateProfileMutation.mutateAsync({ avatar_url: avatarUrl });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da imagem. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Internal sidebar */}
        <aside className="lg:w-60 lg:shrink-0">
          <div className="mb-4 lg:mb-6 px-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              Meu Perfil
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Gerencie suas informações</p>
          </div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = activeSection === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => handleSectionChange(s.key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 lg:w-full',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeSection === 'sobre' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Meu Perfil</CardTitle>
                  <CardDescription>
                    Atualize suas informações pessoais e foto de perfil
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                      <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        onClick={handleAvatarClick}
                        disabled={isUploading}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        {isUploading ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <Camera className="w-6 h-6 text-white" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Clique na foto para alterar (máx. 2MB)
                    </p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={user?.email || ''} disabled className="bg-muted" />
                      <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="Seu nome completo"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Cargo</Label>
                      <Input
                        id="role"
                        type="text"
                        value={
                          orgData?.membership.role === 'owner' ? 'Gestor' :
                          orgData?.membership.member_role === 'admin' ? 'Admin' :
                          orgData?.membership.member_role === 'analyst' ? 'Analista' :
                          orgData?.membership.member_role === 'viewer' ? 'Vendedor' : 'Membro'
                        }
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar Alterações
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {orgData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Organização
                    </CardTitle>
                    <CardDescription>
                      Informações da sua empresa para integração com n8n
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da Empresa</Label>
                      <Input value={orgData.organization.name} disabled className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                      <Label>ID da Organização (para n8n)</Label>
                      <div className="flex gap-2">
                        <Input value={orgData.organization.id} disabled className="bg-muted font-mono text-sm" />
                        <Button type="button" variant="outline" size="icon" onClick={handleCopyOrgId}>
                          {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use este ID no campo <code className="bg-muted px-1 rounded">organization_id</code> das requisições HTTP
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Sua Função na Organização</Label>
                      <Input
                        value={orgData.membership.role === 'owner' ? 'Proprietário' :
                               orgData.membership.role === 'admin' ? 'Administrador' : 'Membro'}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {activeSection === 'preferencias' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    Sons de Notificação
                  </CardTitle>
                  <CardDescription>
                    Configure os sons de alerta para novas mensagens
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="sound-toggle">Ativar sons</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba alertas sonoros para novas mensagens
                      </p>
                    </div>
                    <Switch id="sound-toggle" checked={isSoundEnabled} onCheckedChange={toggleSound} />
                  </div>

                  {isSoundEnabled && (
                    <div className="pt-4 border-t space-y-3">
                      <p className="text-sm text-muted-foreground">Testar sons:</p>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => playNotificationSound('whatsapp')}>
                          <Volume2 className="w-4 h-4 mr-2" />
                          WhatsApp
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => playNotificationSound('internal')}>
                          <Volume2 className="w-4 h-4 mr-2" />
                          Chat Interno
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {browserNotif.isEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    Notificações do Navegador
                  </CardTitle>
                  <CardDescription>
                    Receba alertas pop-up no desktop quando chegarem novas mensagens — funciona mesmo com a aba do VGV Turbo em segundo plano ou o navegador minimizado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!browserNotif.isSupported ? (
                    <p className="text-sm text-muted-foreground">
                      Seu navegador não suporta notificações desktop.
                    </p>
                  ) : (
                    <>
                      {browserNotif.isInIframe && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm space-y-2">
                          <p className="font-medium text-amber-700 dark:text-amber-400">
                            ⚠️ Você está visualizando dentro do editor Lovable.
                          </p>
                          <p className="text-muted-foreground">
                            As notificações do navegador são bloqueadas em iframes. Abra a app em uma janela própria para ativar e testar.
                          </p>
                          <Button type="button" variant="outline" size="sm" onClick={openInNewWindow}>
                            Abrir em nova aba
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="browser-notif-toggle">Ativar notificações no navegador</Label>
                          <p className="text-sm text-muted-foreground">
                            Será solicitada permissão na primeira vez. A aba precisa estar aberta (mesmo em segundo plano).
                          </p>
                        </div>
                        <Switch
                          id="browser-notif-toggle"
                          checked={browserNotif.isEnabled && browserNotif.permission === 'granted'}
                          onCheckedChange={handleToggleBrowserNotif}
                          disabled={browserNotif.isInIframe}
                        />
                      </div>

                      {browserNotif.permission === 'denied' && !browserNotif.isInIframe && (
                        <p className="text-sm text-destructive">
                          Permissão bloqueada. Clique no cadeado da barra de endereço do navegador e libere "Notificações" para este site.
                        </p>
                      )}

                      <div className="pt-4 border-t">
                        <Button type="button" variant="outline" size="sm" onClick={handleTestBrowserNotif}>
                          <Bell className="w-4 h-4 mr-2" />
                          Testar notificação
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          Status: permissão = <span className="font-mono">{browserNotif.permission}</span> · ativado = <span className="font-mono">{String(browserNotif.isEnabled)}</span>
                          {browserNotif.isInIframe ? ' · iframe' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Se o toast acima aparecer mas o popup nativo não: Windows → Configurações → Sistema → Notificações → habilite "Google Chrome" (e desligue "Não perturbe"). No Chrome: <span className="font-mono">chrome://settings/content/notifications</span> → garanta que o site está em "Permitir".
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>


              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isAvailable ? <Power className="w-5 h-5 text-emerald-500" /> : <PowerOff className="w-5 h-5 text-muted-foreground" />}
                    Disponibilidade para atendimento
                  </CardTitle>
                  <CardDescription>
                    Controle se novas conversas serão distribuídas automaticamente para você nas automações (atribuição aleatória, rotativa ou menos ocupado).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="availability-toggle">
                        Status: <span className={cn('font-semibold', isAvailable ? 'text-emerald-600' : 'text-muted-foreground')}>{isAvailable ? 'On (disponível)' : 'Off (indisponível)'}</span>
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Quando Off, você é pulado nas atribuições automáticas. Atribuições manuais ainda funcionam.
                      </p>
                    </div>
                    <Switch
                      id="availability-toggle"
                      checked={isAvailable}
                      disabled={isUpdatingAvailability}
                      onCheckedChange={() => toggleAvailable()}
                    />
                  </div>
                </CardContent>
              </Card>


              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Aparência do Chat
                  </CardTitle>
                  <CardDescription>
                    Personalize como suas mensagens aparecem no chat
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-sender-name">Mostrar meu nome nas bolhas enviadas</Label>
                      <p className="text-sm text-muted-foreground">
                        Exibe seu nome e departamento acima das mensagens que você envia no chat.
                      </p>
                    </div>
                    <Switch id="show-sender-name" checked={showSenderName} onCheckedChange={toggleShowSenderName} />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-0.5">
                      <Label htmlFor="unread-on-top">Conversas não lidas no topo</Label>
                      <p className="text-sm text-muted-foreground">
                        Exibe as conversas com mensagens não lidas no topo da lista de contatos.
                      </p>
                    </div>
                    <Switch id="unread-on-top" checked={unreadOnTop} onCheckedChange={toggleUnreadOnTop} />
                  </div>
                </CardContent>
              </Card>

              <QuickMessagesManager />

              <StickersManager />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
