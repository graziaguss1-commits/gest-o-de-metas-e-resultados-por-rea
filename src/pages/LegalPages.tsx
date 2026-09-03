import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

type LegalPageProps = {
  kind: "privacy" | "terms";
};

const UPDATED_AT = "3 de setembro de 2026";

function LegalShell({ kind }: LegalPageProps) {
  const isPrivacy = kind === "privacy";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <header className="bg-gradient-to-br from-[#3A2218] via-[#5C3D2E] to-[#8D552D] px-6 py-10 text-white sm:px-10">
          <Link
            to="/auth"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/80 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar ao aplicativo
          </Link>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            {isPrivacy ? <ShieldCheck className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E4B77D]">Metas e objetivos</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
            {isPrivacy ? "Política de Privacidade" : "Termos de Uso"}
          </h1>
          <p className="mt-3 text-sm text-white/75">Última atualização: {UPDATED_AT}</p>
        </header>

        <div className="space-y-8 px-6 py-9 text-[15px] leading-7 text-muted-foreground sm:px-10 sm:py-12">
          {isPrivacy ? <PrivacyContent /> : <TermsContent />}
        </div>

        <footer className="border-t border-border bg-muted/35 px-6 py-6 text-sm text-muted-foreground sm:px-10">
          Dúvidas sobre este documento? Escreva para{" "}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href="mailto:grazi.aguss1@gmail.com">
            grazi.aguss1@gmail.com
          </a>
          .
        </footer>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PrivacyContent() {
  return (
    <>
      <p>
        Esta Política explica como o aplicativo Metas e objetivos coleta, utiliza, armazena e protege
        informações quando você usa a plataforma e, opcionalmente, conecta sua conta do Google Agenda.
      </p>

      <Section title="1. Responsável e contato">
        <p>
          A responsável pelo tratamento dos dados no aplicativo Metas e objetivos pode ser contatada pelo
          e-mail <strong className="text-foreground">grazi.aguss1@gmail.com</strong>.
        </p>
      </Section>

      <Section title="2. Dados tratados">
        <ul className="list-disc space-y-2 pl-5">
          <li>dados de cadastro e autenticação, como nome, e-mail e identificador da conta;</li>
          <li>metas, planos de ação, tarefas, compromissos, responsáveis, resultados e registros de tempo;</li>
          <li>preferências, configurações e registros técnicos necessários para segurança e funcionamento;</li>
          <li>
            quando autorizado, e-mail e perfil básico do Google, calendários selecionados, identificadores,
            datas e horários de eventos e informações necessárias para a sincronização.
          </li>
        </ul>
      </Section>

      <Section title="3. Finalidades do tratamento">
        <p>Os dados são utilizados para autenticar usuários, organizar metas e agenda, medir execução, gerar relatórios, evitar conflitos de horário, sincronizar eventos e prestar suporte.</p>
        <p>
          Recursos de inteligência artificial somente são acionados por solicitação do usuário. Nesses casos,
          o conteúdo estritamente necessário pode ser enviado ao provedor configurado para gerar a análise ou
          sugestão solicitada.
        </p>
      </Section>

      <Section title="4. Uso dos dados do Google">
        <p>
          A conexão com o Google Agenda é opcional. O aplicativo solicita acesso para visualizar disponibilidade
          e para criar, atualizar ou excluir no calendário escolhido os eventos sincronizados com o aplicativo.
        </p>
        <p>
          Os dados obtidos pelas APIs do Google são usados apenas para oferecer a sincronização e os recursos de
          agenda visíveis ao usuário. Eles não são vendidos, não são usados para publicidade e não são transferidos
          para corretores de dados. O uso e a transferência dessas informações obedecem à Política de Dados do
          Usuário dos Serviços de API do Google, inclusive aos requisitos de Uso Limitado.
        </p>
      </Section>

      <Section title="5. Compartilhamento e operadores">
        <p>
          As informações podem ser processadas por fornecedores essenciais de infraestrutura, autenticação,
          banco de dados, hospedagem, integração e inteligência artificial, sempre na medida necessária para
          prestar a funcionalidade solicitada. Também poderão ser tratadas para cumprir obrigação legal ou
          proteger a segurança da plataforma e de seus usuários.
        </p>
      </Section>

      <Section title="6. Segurança e retenção">
        <p>
          São aplicadas medidas técnicas e organizacionais de controle de acesso, comunicação criptografada e
          proteção de credenciais. Dados de conexão e sincronização permanecem enquanto a integração estiver ativa
          ou pelo período necessário para operar o serviço, cumprir obrigações legais e prevenir abuso.
        </p>
      </Section>

      <Section title="7. Desconexão e exclusão">
        <p>
          Você pode desconectar o Google Agenda nas configurações. A desconexão revoga a integração, remove os
          dados locais de conexão e de sincronização e pode remover do Google Agenda os eventos que foram criados
          pelo aplicativo. Eventos externos originalmente criados no Google não são excluídos pelo aplicativo.
        </p>
        <p>
          Para solicitar acesso, correção, portabilidade, informação, oposição ou exclusão de dados, envie uma
          mensagem para o e-mail de contato. A solicitação será atendida observando a legislação aplicável e as
          obrigações de retenção.
        </p>
      </Section>

      <Section title="8. Dados sensíveis e informações de pacientes">
        <p>
          Esta plataforma é destinada à gestão de metas e produtividade. Não insira prontuários, diagnósticos,
          exames ou outros dados pessoais sensíveis de pacientes, pois o aplicativo não foi concebido como sistema
          de prontuário médico.
        </p>
      </Section>

      <Section title="9. Alterações desta Política">
        <p>
          Esta Política poderá ser atualizada para refletir mudanças legais ou funcionais. A data da versão mais
          recente será informada no início da página e alterações relevantes serão comunicadas quando necessário.
        </p>
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <p>
        Estes Termos regulam o acesso e o uso do aplicativo Metas e objetivos. Ao utilizar a plataforma, você
        declara que leu e concorda com estas condições.
      </p>

      <Section title="1. Finalidade do serviço">
        <p>
          O aplicativo oferece recursos de gestão de metas, planos de ação, tarefas, calendário, execução,
          cronômetro, relatórios e sugestões de planejamento. Ele é uma ferramenta de apoio gerencial e não
          substitui julgamento profissional ou decisão humana.
        </p>
      </Section>

      <Section title="2. Conta e responsabilidades">
        <p>
          Você deve fornecer informações corretas, proteger suas credenciais e utilizar somente contas e dados para
          os quais tenha autorização. É responsável por revisar metas, horários, recorrências e sugestões antes de
          confirmá-los.
        </p>
      </Section>

      <Section title="3. Google Agenda">
        <p>
          A integração é opcional e depende de autorização da conta Google. Quando ativada, a sincronização pode
          criar, atualizar, mover ou excluir eventos correspondentes às tarefas e compromissos do aplicativo.
          Alterações realizadas no Google também podem atualizar ou desagendar o item relacionado na plataforma.
        </p>
        <p>
          Ao desconectar, os eventos criados pelo aplicativo podem ser removidos do Google Agenda. Antes de
          confirmar mudanças relevantes, confira o calendário selecionado e os eventos envolvidos.
        </p>
      </Section>

      <Section title="4. Uso aceitável">
        <p>
          É proibido tentar acessar contas de terceiros, contornar controles de segurança, usar o serviço para
          finalidade ilegal, comprometer a estabilidade da plataforma ou inserir conteúdo que viole direitos de
          terceiros.
        </p>
      </Section>

      <Section title="5. Informações sensíveis">
        <p>
          O aplicativo não é um prontuário médico. Não utilize a plataforma para armazenar dados clínicos,
          diagnósticos, exames ou outras informações sensíveis de pacientes. O usuário é responsável por observar
          a LGPD e as normas profissionais aplicáveis às informações que inserir.
        </p>
      </Section>

      <Section title="6. Disponibilidade e integrações externas">
        <p>
          O serviço pode passar por manutenção ou sofrer indisponibilidades. Recursos dependentes de Google,
          hospedagem, banco de dados ou inteligência artificial também estão sujeitos às condições e à
          disponibilidade desses fornecedores.
        </p>
      </Section>

      <Section title="7. Propriedade intelectual">
        <p>
          A estrutura, identidade visual, textos, componentes e funcionalidades do aplicativo são protegidos pela
          legislação aplicável. Os dados e conteúdos inseridos pelo usuário permanecem sob sua responsabilidade.
        </p>
      </Section>

      <Section title="8. Limitação de responsabilidade">
        <p>
          O aplicativo auxilia o planejamento, mas não garante o cumprimento de metas ou resultados empresariais.
          Na extensão permitida pela lei, a responsável não responde por decisões tomadas exclusivamente com base
          em sugestões automáticas, falhas de serviços de terceiros ou uso em desacordo com estes Termos.
        </p>
      </Section>

      <Section title="9. Encerramento e alterações">
        <p>
          O acesso poderá ser suspenso em caso de violação destes Termos ou risco de segurança. Os Termos poderão
          ser atualizados, com indicação da data da versão vigente e comunicação de mudanças relevantes quando
          necessário.
        </p>
      </Section>

      <Section title="10. Contato">
        <p>
          Dúvidas, solicitações ou comunicações relacionadas ao serviço devem ser enviadas para
          <strong className="text-foreground"> grazi.aguss1@gmail.com</strong>.
        </p>
      </Section>
    </>
  );
}

export const PrivacyPolicyPage = () => <LegalShell kind="privacy" />;
export const TermsOfUsePage = () => <LegalShell kind="terms" />;
