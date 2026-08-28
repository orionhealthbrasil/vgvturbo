import { useState, useEffect } from 'react';
import { Mail, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEmailSettings, useUpdateEmailSettings } from '@/hooks/useEmailSettings';

export function EmailConfigCard() {
  const { data: settings, isLoading } = useEmailSettings();
  const updateMutation = useUpdateEmailSettings();
  const [showKey, setShowKey] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [replyTo, setReplyTo] = useState('');

  useEffect(() => {
    if (settings) {
      setApiKey(settings.resend_api_key || '');
      setFromEmail(settings.resend_from_email || '');
      setFromName(settings.resend_from_name || '');
      setReplyTo(settings.resend_reply_to || '');
    }
  }, [settings]);

  const isConfigured = !!settings?.resend_api_key;

  const handleSave = () => {
    // Guarda 1: não permitir salvar enquanto ainda carregando
    if (isLoading || settings === undefined) {
      return;
    }

    // Guarda 2: detectar tentativa de apagar dados existentes acidentalmente
    const wouldClearApiKey = !apiKey.trim() && !!settings?.resend_api_key;
    const wouldClearFromEmail = !fromEmail.trim() && !!settings?.resend_from_email;
    if (wouldClearApiKey || wouldClearFromEmail) {
      const confirmed = window.confirm(
        'Você está prestes a apagar dados já salvos (chave de API e/ou e-mail remetente em branco). Tem certeza que deseja continuar?'
      );
      if (!confirmed) return;
    }

    // Guarda 3: detectar autofill com credenciais de login na chave de API
    const trimmedKey = apiKey.trim();
    if (trimmedKey) {
      if (trimmedKey.includes('@')) {
        window.alert('A chave de API parece um e-mail. Provavelmente o navegador preencheu o campo automaticamente. Limpe o campo e cole a chave do Resend (começa com "re_").');
        return;
      }
      if (trimmedKey.length < 10) {
        window.alert('A chave de API está muito curta. Verifique se foi colada corretamente.');
        return;
      }
      if (!trimmedKey.toLowerCase().startsWith('re_')) {
        const confirmed = window.confirm(
          'A chave de API do Resend normalmente começa com "re_". O valor digitado não parece uma chave válida. Salvar mesmo assim?'
        );
        if (!confirmed) return;
      }
    }

    updateMutation.mutate({
      resend_api_key: trimmedKey || null,
      resend_from_email: fromEmail.trim() || null,
      resend_from_name: fromName.trim() || null,
      resend_reply_to: replyTo.trim() || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Configuração de Email
            </CardTitle>
            <CardDescription>
              Configure o envio de emails da sua organização para uso em automações e notificações.
            </CardDescription>
          </div>
          {isConfigured ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertCircle className="w-3 h-3 mr-1" />
              Não configurado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="space-y-5">
          {/* Honeypots para absorver autofill do navegador */}
          <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
          <input type="password" name="password" autoComplete="current-password" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />

        <div className="space-y-2">
          <Label htmlFor="api-key">Chave de API do Resend</Label>
          <div className="flex gap-2">
            <Input
              id="api-key"
              name="resend-api-key"
              type={showKey ? 'text' : 'password'}
              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowKey((s) => !s)}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Obtenha a chave em{' '}
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              resend.com/api-keys
            </a>
            .
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="from-email">Email remetente (From)</Label>
            <Input
              id="from-email"
              name="resend-from-email"
              type="email"
              placeholder="contato@suaempresa.com.br"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
            />
            <p className="text-xs text-muted-foreground">
              Vazio = usa o sandbox <code className="text-xs">onboarding@resend.dev</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="from-name">Nome do remetente</Label>
            <Input
              id="from-name"
              name="resend-from-name"
              placeholder="Equipe Comercial"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
            />
            <p className="text-xs text-muted-foreground">Aparece como nome do remetente.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reply-to">Email de resposta (Reply-To)</Label>
          <Input
            id="reply-to"
            name="resend-reply-to"
            type="email"
            placeholder="atendimento@suaempresa.com.br"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
          />
          <p className="text-xs text-muted-foreground">
            Quando o cliente responder, a resposta cai aqui (geralmente o seu email pessoal).
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Sem domínio verificado no Resend, apenas o sandbox{' '}
            <code>onboarding@resend.dev</code> funciona — e ele só envia para o email cadastrado
            na sua conta Resend. Para enviar a qualquer destinatário, verifique seu domínio no{' '}
            <a
              href="https://resend.com/domains"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              painel do Resend
            </a>
            .
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar configurações
          </Button>
        </div>
        </form>
      </CardContent>
    </Card>
  );
}
