import { LegalLayout } from "./LegalLayout";

const DataDeletion = () => (
  <LegalLayout
    title="Exclusão de Dados do Usuário"
    description="Como solicitar a exclusão dos seus dados pessoais e de integração com Instagram/Meta no VGV Turbo."
    updatedAt="08 de maio de 2026"
  >
    <section>
      <p>
        Esta página descreve como você pode solicitar a exclusão completa dos dados associados à sua
        conta no VGV Turbo, incluindo dados obtidos por meio da integração com Instagram e plataformas
        da Meta.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">Opção 1 — Excluir pelo próprio app</h2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>Faça login em <a href="https://vgvturbo.com.br">vgvturbo.com.br</a>.</li>
        <li>Acesse <strong>Configurações da Organização → Conexões</strong>.</li>
        <li>Clique em <strong>Desconectar Instagram</strong> para revogar o acesso e remover o token armazenado.</li>
        <li>Para excluir toda a conta e dados associados, contate o suporte conforme abaixo.</li>
      </ol>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">Opção 2 — Solicitar por e-mail</h2>
      <p>
        Envie uma solicitação para
        <a href="mailto:orionchat.ia@gmail.com"> orionchat.ia@gmail.com</a> com o assunto
        <strong> "Exclusão de Dados"</strong> contendo:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Seu nome completo;</li>
        <li>E-mail cadastrado no VGV Turbo;</li>
        <li>Nome de usuário do Instagram (se aplicável);</li>
        <li>Confirmação de que deseja excluir todos os dados associados.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">O que será excluído</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Token de acesso do Instagram/Meta armazenado em nossos servidores;</li>
        <li>Identificadores da conta (ig_user_id, username, foto de perfil);</li>
        <li>Mensagens, comentários e mídias sincronizadas via Instagram;</li>
        <li>Dados pessoais cadastrais da conta de usuário e organização (mediante solicitação completa).</li>
      </ul>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">Prazo</h2>
      <p>
        Solicitações são processadas em até <strong>30 dias corridos</strong>. Você receberá uma confirmação
        por e-mail assim que a exclusão for concluída. Backups são mantidos por até 90 dias para fins
        de segurança e, em seguida, descartados.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-semibold">Revogação direta no Instagram</h2>
      <p>
        Você também pode revogar o acesso do VGV Turbo diretamente em sua conta do Instagram acessando:
        <br />
        <strong>Instagram → Configurações → Aplicativos e sites → Ativos → VGV Turbo → Remover</strong>.
      </p>
      <p>
        Após a revogação, deixaremos de receber novos dados, mas a remoção do que já foi armazenado
        deve ser solicitada por uma das opções acima.
      </p>
    </section>
  </LegalLayout>
);

export default DataDeletion;
