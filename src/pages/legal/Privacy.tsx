import { LegalLayout } from "./LegalLayout";

const Privacy = () => (
  <LegalLayout
    title="Política de Privacidade"
    description="Como o VGV Turbo coleta, usa e protege seus dados pessoais e de seus contatos."
    updatedAt="08 de maio de 2026"
  >
    <section>
      <h2 className="text-2xl font-semibold">1. Quem somos</h2>
      <p>
        O VGV Turbo é uma plataforma de CRM e atendimento omnichannel que permite a empresas
        gerenciar conversas com seus clientes através de canais como WhatsApp e Instagram.
        Esta política descreve como tratamos os dados pessoais coletados durante o uso da plataforma,
        disponível em <a href="https://vgvturbo.com.br">https://vgvturbo.com.br</a>.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">2. Dados que coletamos</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone e organização do usuário responsável pela conta.</li>
        <li><strong>Dados de integração com Instagram:</strong> ID da conta profissional, nome de usuário, foto de perfil e token de acesso fornecido por você via login oficial da Meta.</li>
        <li><strong>Mensagens e conversas:</strong> conteúdo das mensagens trocadas com seus contatos por meio dos canais conectados, necessárias para exibir o histórico de atendimento.</li>
        <li><strong>Dados de contatos:</strong> nome, telefone, e-mail e demais informações que você opte por cadastrar.</li>
        <li><strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo, navegador e logs de uso para fins de segurança e auditoria.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">3. Como usamos seus dados</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Prestar e operar os serviços contratados (atendimento, automações, relatórios).</li>
        <li>Autenticar usuários e proteger a conta contra acessos não autorizados.</li>
        <li>Enviar e receber mensagens em seu nome através das APIs oficiais do WhatsApp e Instagram.</li>
        <li>Gerar métricas e relatórios internos para sua organização.</li>
        <li>Cumprir obrigações legais e regulatórias.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">4. Compartilhamento</h2>
      <p>
        Não vendemos dados pessoais. Compartilhamos informações apenas com prestadores essenciais à
        operação (provedores de hospedagem, banco de dados, e provedores oficiais de mensageria como
        Meta/Instagram), sempre limitados ao mínimo necessário e sob obrigações de confidencialidade.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">5. Base legal (LGPD)</h2>
      <p>
        Tratamos dados com base na execução do contrato com o cliente, no consentimento (quando
        aplicável), no cumprimento de obrigações legais e no legítimo interesse para garantir
        segurança e melhoria contínua do serviço.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">6. Retenção</h2>
      <p>
        Mantemos os dados enquanto a conta estiver ativa ou pelo período necessário para cumprir
        finalidades legais. Após a exclusão da conta, os dados são removidos ou anonimizados em até 90 dias,
        salvo obrigação legal de retenção.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">7. Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção, portabilidade, exclusão ou anonimização dos seus dados,
        bem como revogar consentimentos previamente dados. Para exercer esses direitos, entre em
        contato pelo e-mail <a href="mailto:orionchat.ia@gmail.com">orionchat.ia@gmail.com</a> ou
        consulte nossa página de <a href="/data-deletion">exclusão de dados</a>.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">8. Segurança</h2>
      <p>
        Aplicamos medidas técnicas e organizacionais como criptografia em trânsito (HTTPS), controle
        de acesso por organização (multi-tenant), autenticação obrigatória e armazenamento de tokens
        de forma criptografada.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">9. Alterações</h2>
      <p>
        Esta política pode ser atualizada a qualquer momento. Mudanças relevantes serão comunicadas
        pelos canais oficiais do produto.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">10. Contato</h2>
      <p>
        Em caso de dúvidas sobre esta política, escreva para
        <a href="mailto:orionchat.ia@gmail.com"> orionchat.ia@gmail.com</a>.
      </p>
    </section>
  </LegalLayout>
);

export default Privacy;
