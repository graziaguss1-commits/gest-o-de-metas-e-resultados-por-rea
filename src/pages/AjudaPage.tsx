import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FAQ = { q: string; a: React.ReactNode };

const blueLink = { color: "var(--color-blue)" } as const;

const FAQS: FAQ[] = [
  {
    q: "Como faço o onboarding inicial da plataforma?",
    a: (
      <>
        No primeiro acesso a plataforma abre o assistente de configuração em 4
        passos: <strong>perfil</strong>, <strong>empresa</strong>,{" "}
        <strong>notificações no Slack</strong> e <strong>primeira meta</strong>.
        Você pode pular etapas opcionais e refazer tudo depois em{" "}
        <Link to="/configuracoes/onboarding" className="font-medium" style={blueLink}>
          Configurações → Onboarding
        </Link>
        .
      </>
    ),
  },
  {
    q: "Como cadastrar uma nova meta?",
    a: (
      <>
        Vá em{" "}
        <Link to="/metas" className="font-medium" style={blueLink}>
          Minhas Metas
        </Link>{" "}
        e clique em <strong>Nova meta</strong>. Preencha nome, área, responsável,
        valor alvo + unidade, periodicidade e a janela de datas. Marque "meta
        inversa" quando menor for melhor (ex: churn, tempo de resposta). O status
        é calculado automaticamente — você não precisa defini-lo manualmente.
      </>
    ),
  },
  {
    q: "Como lançar um resultado em uma meta?",
    a: (
      <>
        Use o botão <strong>Lançar resultado</strong> na sidebar ou abra a meta e
        clique em <strong>Novo lançamento</strong>. Informe a <em>data</em>, o{" "}
        <em>valor</em> realizado e, se quiser, uma observação. A barra de
        progresso, o status e a Análise IA são atualizados em tempo real.
      </>
    ),
  },
  {
    q: "Como funciona o cálculo de status (verde, amarelo, vermelho)?",
    a: (
      <>
        Comparamos o <strong>progresso real</strong> (quanto você já entregou)
        com o <strong>progresso esperado</strong> (quanto deveria ter entregue
        até hoje, em trajetória linear do início ao fim da meta).
        <ul className="list-disc pl-5 mt-2 space-y-0.5">
          <li>
            <span style={{ color: "var(--color-green)" }}>●</span>{" "}
            <strong>Verde</strong> — desvio melhor que -5%
          </li>
          <li>
            <span style={{ color: "var(--color-amber)" }}>●</span>{" "}
            <strong>Amarelo</strong> — desvio entre -5% e -20%
          </li>
          <li>
            <span style={{ color: "var(--color-red)" }}>●</span>{" "}
            <strong>Vermelho</strong> — desvio pior que -20%
          </li>
        </ul>
        Em metas inversas a lógica inverte: quanto mais perto do alvo de redução,
        melhor.
      </>
    ),
  },
  {
    q: "O que é uma meta inversa?",
    a: (
      <>
        Meta onde <strong>menor é melhor</strong>. Exemplos: <em>churn</em>,{" "}
        <em>tempo médio de resposta</em>, <em>CAC</em>,{" "}
        <em>custos operacionais</em>. Quando você marca o toggle{" "}
        <strong>"Meta inversa"</strong> na criação, a barra de progresso e o
        cálculo de status invertem: o objetivo é reduzir o valor até atingir (ou
        ficar abaixo do) valor alvo.
      </>
    ),
  },
  {
    q: "Como a IA analisa o desempenho da minha meta?",
    a: (
      <>
        Abra a meta em <strong>Análise IA</strong> e clique em{" "}
        <strong>Gerar análise</strong>. Enviamos para a IA: nome, área, alvo,
        atual, datas, se é inversa e o histórico de lançamentos. Você recebe:
        <ul className="list-disc pl-5 mt-2 space-y-0.5">
          <li>Diagnóstico em 2-3 parágrafos sobre saúde, ritmo e riscos</li>
          <li>3 ações recomendadas (título + contexto)</li>
          <li>Previsão do valor final na data de término</li>
          <li>Veredicto "vai bater" / "não bate"</li>
        </ul>
        Se quiser, clique em{" "}
        <strong>Criar plano de ação com essas sugestões</strong> para
        transformar as ações em um plano com tarefas.
      </>
    ),
  },
  {
    q: "Como criar e acompanhar planos de ação?",
    a: (
      <>
        Em{" "}
        <Link to="/planos" className="font-medium" style={blueLink}>
          Planos de Ação
        </Link>{" "}
        clique em <strong>Novo plano</strong>, vincule a uma meta, adicione as
        tarefas e defina o prazo de cada uma. Cada tarefa pode ser concluída
        diretamente no card, e o progresso do plano é calculado automaticamente.
      </>
    ),
  },
  {
    q: "Como configurar alertas no Slack?",
    a: (
      <>
        Em duas etapas:
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>
            Em{" "}
            <Link to="/configuracoes/integrations" className="font-medium" style={blueLink}>
              Integrações
            </Link>{" "}
            → Slack, cole o Incoming Webhook do seu workspace (gerado em
            api.slack.com/apps). A URL fica criptografada no Vault.
          </li>
          <li>
            Em{" "}
            <Link to="/configuracoes/notificacoes" className="font-medium" style={blueLink}>
              Notificações
            </Link>
            , ative os gatilhos: alerta automático em risco, threshold de desvio
            e resumo semanal.
          </li>
        </ol>
      </>
    ),
  },
  {
    q: "Como gerencio minha equipe e permissões?",
    a: (
      <>
        Admins acessam{" "}
        <Link to="/configuracoes/team" className="font-medium" style={blueLink}>
          Configurações → Equipe
        </Link>{" "}
        para aprovar novos cadastros, alterar roles (admin, supervisor, agent),
        desativar e reativar usuários. Novos cadastros ficam pendentes até a
        aprovação de um admin.
      </>
    ),
  },
  {
    q: "Como uso os dados de demonstração?",
    a: (
      <>
        Em{" "}
        <Link to="/configuracoes/demonstration" className="font-medium" style={blueLink}>
          Configurações → Demonstração
        </Link>{" "}
        você popula a plataforma com metas, lançamentos e planos fictícios para
        explorar todas as telas. Pode limpar a qualquer momento sem afetar dados
        reais.
      </>
    ),
  },
  {
    q: "O que vejo em Relatórios?",
    a: (
      <>
        Em{" "}
        <Link to="/relatorios" className="font-medium" style={blueLink}>
          Relatórios
        </Link>{" "}
        você acompanha o panorama agregado: metas por status, evolução do
        portfólio, desempenho por área e por responsável. Use os filtros de
        período para recortes específicos.
      </>
    ),
  },
];

export default function AjudaPage() {
  return (
    <AppShell>
      <div className="space-y-5 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Ajuda</h1>
          <p className="text-sm text-muted-foreground">
            Respostas para as dúvidas mais comuns sobre o MetasIA.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="metasia-card border px-4"
            >
              <AccordionTrigger className="text-left font-semibold text-sm hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </AppShell>
  );
}
