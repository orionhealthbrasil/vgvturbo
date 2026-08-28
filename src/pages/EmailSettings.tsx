import { Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmailConfigCard } from '@/components/email/EmailConfigCard';
import { EmailTestCard } from '@/components/email/EmailTestCard';
import { EmailHistoryTable } from '@/components/email/EmailHistoryTable';

export default function EmailSettings() {
  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Email</h1>
          <p className="text-sm text-muted-foreground">
            Configure o envio de emails da sua organização para uso em automações e notificações.
          </p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="test">Testar envio</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="about">Sobre</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <EmailConfigCard />
        </TabsContent>

        <TabsContent value="test">
          <EmailTestCard />
        </TabsContent>

        <TabsContent value="history">
          <EmailHistoryTable />
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>Sobre o envio de emails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Como funciona</h3>
                <p>
                  Usamos o Resend como serviço de envio. Você gerencia sua própria conta e chave de
                  API, e o sistema usa essas credenciais sempre que precisa enviar um email pela sua
                  organização (testes, automações, notificações).
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Verificação de domínio</h3>
                <p>
                  Para enviar emails a partir do seu próprio domínio (ex.{' '}
                  <code>contato@suaempresa.com.br</code>), você precisa verificá-lo no painel do
                  Resend, adicionando registros DNS (SPF, DKIM e MX). Sem essa verificação, apenas o
                  sandbox <code>onboarding@resend.dev</code> funciona — e ele só envia para o email
                  cadastrado na sua conta Resend.
                </p>
                <p className="mt-2">
                  Documentação oficial:{' '}
                  <a
                    href="https://resend.com/docs/dashboard/domains/introduction"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    resend.com/docs/dashboard/domains
                  </a>
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Receber respostas (inbox)</h3>
                <p>
                  Por enquanto, não oferecemos uma caixa de entrada nativa para receber emails. Para
                  capturar respostas dos clientes, configure o campo <strong>Email de resposta
                  (Reply-To)</strong> com seu email pessoal ou comercial. As respostas dos clientes
                  serão entregues diretamente ali.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Uso em automações</h3>
                <p>
                  No Flow Builder, você encontra o nó <strong>Enviar Email</strong> na seção de
                  Ações. Ele suporta variáveis dinâmicas (<code>{'{nome}'}</code>,{' '}
                  <code>{'{email}'}</code>, etc.) tanto no assunto quanto no conteúdo.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
