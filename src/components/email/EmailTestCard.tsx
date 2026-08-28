import { useState } from 'react';
import { Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEmailSettings, useSendTestEmail } from '@/hooks/useEmailSettings';

export function EmailTestCard() {
  const { data: settings } = useEmailSettings();
  const sendTest = useSendTestEmail();
  const [to, setTo] = useState('');
  const [result, setResult] = useState<
    { success: true; message_id: string | null } | { success: false; error: string } | null
  >(null);

  const isConfigured = !!settings?.resend_api_key;

  const handleSend = async () => {
    setResult(null);
    if (!to.trim()) return;
    try {
      const data = await sendTest.mutateAsync(to.trim());
      setResult({ success: true, message_id: data?.message_id || null });
    } catch (err: any) {
      setResult({ success: false, error: err?.message || 'Erro desconhecido' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Testar envio</CardTitle>
        <CardDescription>
          Envie um email de teste para confirmar que sua configuração está funcionando.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConfigured && (
          <Alert variant="destructive">
            <AlertDescription>
              Configure sua chave de API do Resend na aba <strong>Configuração</strong> antes de testar.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="test-to">Destinatário</Label>
          <Input
            id="test-to"
            type="email"
            placeholder="seu-email@exemplo.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={!isConfigured || sendTest.isPending || !to.trim()}
          className="gap-2"
        >
          {sendTest.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Enviar email de teste
        </Button>

        {result && result.success && (
          <Alert className="border-emerald-500/40">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle>Email enviado com sucesso</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              <p>Verifique a caixa de entrada (e spam) do destinatário.</p>
              {result.message_id && (
                <p>
                  ID da mensagem: <code>{result.message_id}</code>
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {result && result.success === false && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Falha no envio</AlertTitle>
            <AlertDescription className="text-xs">{result.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
