import { LegalLayout } from "./LegalLayout";

const Terms = () => (
  <LegalLayout
    title="Termos de Serviço"
    description="Condições de uso da plataforma VGV Turbo."
    updatedAt="08 de maio de 2026"
  >
    <section>
      <h2 className="text-2xl font-semibold">1. Aceitação</h2>
      <p>
        Ao acessar ou usar o VGV Turbo, você concorda com estes Termos de Serviço. Caso não concorde
        com qualquer parte deles, não utilize a plataforma.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">2. Descrição do serviço</h2>
      <p>
        O VGV Turbo é uma plataforma SaaS de CRM e atendimento omnichannel que permite gerenciar
        conversas, automações e equipes em um único painel, com integrações oficiais a canais como
        WhatsApp e Instagram.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">3. Conta e responsabilidades</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Você é responsável por manter a confidencialidade das credenciais da sua conta.</li>
        <li>Você se compromete a fornecer informações verdadeiras durante o cadastro.</li>
        <li>Você é responsável pelo conteúdo das mensagens enviadas através da plataforma e pelo cumprimento das políticas de uso da Meta e do WhatsApp.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">4. Uso aceitável</h2>
      <p>É proibido utilizar o VGV Turbo para:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Enviar spam, mensagens não solicitadas ou conteúdo ilegal.</li>
        <li>Praticar fraudes, golpes ou qualquer atividade que viole leis aplicáveis.</li>
        <li>Burlar limites técnicos, realizar engenharia reversa ou comprometer a segurança da plataforma.</li>
        <li>Violar políticas das plataformas integradas (Meta, WhatsApp, Instagram).</li>
      </ul>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">5. Planos e pagamentos</h2>
      <p>
        Os planos vigentes, valores e formas de pagamento estão descritos na página de assinatura
        ou no contrato comercial. O não pagamento poderá resultar em suspensão ou cancelamento da
        conta.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">6. Suspensão e encerramento</h2>
      <p>
        Podemos suspender ou encerrar contas que violem estes Termos, a Política de Privacidade ou
        as políticas das plataformas integradas, com ou sem aviso prévio, conforme a gravidade.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">7. Limitação de responsabilidade</h2>
      <p>
        O VGV Turbo é fornecido "como está". Não nos responsabilizamos por interrupções de serviços
        de terceiros (como Meta/WhatsApp), perdas indiretas, lucros cessantes ou danos decorrentes
        do uso indevido da plataforma pelo cliente.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">8. Propriedade intelectual</h2>
      <p>
        Todo o software, marca, layout e conteúdo do VGV Turbo são de propriedade exclusiva da empresa.
        Os dados inseridos pelo cliente continuam sendo de sua propriedade.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">9. Alterações</h2>
      <p>
        Podemos alterar estes Termos a qualquer momento. Mudanças relevantes serão comunicadas pelos
        canais oficiais do produto.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">10. Foro e legislação</h2>
      <p>
        Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca da sede da
        empresa para dirimir quaisquer controvérsias.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">11. Contato</h2>
      <p>
        Dúvidas sobre estes Termos? Escreva para
        <a href="mailto:orionchat.ia@gmail.com"> orionchat.ia@gmail.com</a>.
      </p>
    </section>
  </LegalLayout>
);

export default Terms;
