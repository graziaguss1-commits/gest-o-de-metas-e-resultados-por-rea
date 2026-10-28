import { diagnosticar, execucaoResponsavel, prazoConsumido } from "@/lib/execucao";
import { useExecucaoDaMeta } from "@/hooks/usePlanos";
import { isoLocal } from "@/lib/hoje";
import {
  aderenciaAcumulada,
  aderenciaDasTarefas,
  aderenciaPorSemana,
  mediaUltimasSemanas,
} from "@/lib/resumoSemanal";
import {
  ehHabito,
  formatProgresso,
  progressoReal,
  statusDaAderencia,
  type MetaWithResponsavel,
} from "@/lib/metas";
import { AderenciaSemanal } from "./AderenciaSemanal";

type Props = {
  meta: MetaWithResponsavel;
  /** compacto = versão para card; completo = detalhe da meta */
  variant?: "compacto" | "completo";
};

const TOM: Record<"verde" | "amarelo" | "vermelho", { fg: string; bg: string }> = {
  verde: { fg: "var(--color-green)", bg: "var(--color-green-bg)" },
  amarelo: { fg: "var(--color-amber)", bg: "var(--color-amber-bg)" },
  vermelho: { fg: "var(--color-red)", bg: "var(--color-red-bg)" },
};

/**
 * Mostra lado a lado RESULTADO (meta), PLANO EXECUTADO (ações) e PRAZO.
 * São indicadores independentes: executar o plano não altera o resultado.
 */
export function ExecucaoConsolidada({ meta, variant = "compacto" }: Props) {
  const { pct: execPct, tarefas, execucoes } = useExecucaoDaMeta(meta.id);
  const habito = ehHabito(meta);
  const hoje = isoLocal(new Date());
  const janela = { data_inicio: meta.data_inicio, data_fim: meta.data_fim };
  const alvoAderencia = (meta.meta_aderencia ?? 80) / 100;

  /**
   * Hábito é lido por aderência: do que foi pedido ATÉ HOJE, quanto saiu.
   * O progresso contra o alvo do período inteiro tratava o hábito como
   * pilha a encher até dezembro — ficava em 3% por meses e não respondia
   * "estou cumprindo?".
   */
  const acumulada = habito
    ? aderenciaAcumulada(tarefas, execucoes, janela, hoje)
    : null;
  const semanas = habito
    ? aderenciaPorSemana(tarefas, execucoes, janela, hoje)
    : [];
  const mediaRecente = habito ? mediaUltimasSemanas(semanas, 4) : null;
  const hojeAderencia = aderenciaDasTarefas(tarefas, execucoes, janela, {
    inicio: hoje,
    fim: hoje,
  });

  const resultado = habito
    ? (acumulada?.pct ?? 0)
    : progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse);
  const prazo = prazoConsumido(meta.data_inicio, meta.data_fim);
  const diag = diagnosticar(resultado, execPct ?? 0, prazo);
  // No hábito o que colore é o comportamento recente, não o acumulado: o
  // começo ruim não pode pintar de vermelho quem voltou a cumprir.
  const tomHabito = statusDaAderencia(mediaRecente, alvoAderencia);
  const tom = TOM[habito && tomHabito ? tomHabito : diag.tom];
  const desempenhoPorPessoa = (meta.responsaveis ?? []).map((responsavel) => ({
    ...responsavel,
    pct: execucaoResponsavel(tarefas, execucoes, responsavel.id),
    totalAcoes: tarefas.filter((tarefa) => tarefa.responsavel_id === responsavel.id).length,
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Indicador
          titulo={habito ? "Aderência acumulada" : "Resultado da meta"}
          valor={`${Math.round(resultado * 100)}%`}
          detalhe={
            habito && acumulada
              ? `${acumulada.cumpridos} de ${acumulada.exigidos} pedidos até hoje`
              : formatProgresso(meta)
          }
          cor="var(--color-blue)"
        />
        <Indicador
          titulo={habito ? "Últimas 4 semanas" : "Plano executado"}
          valor={
            habito
              ? mediaRecente === null
                ? "—"
                : `${Math.round(mediaRecente * 100)}%`
              : execPct === null
                ? "—"
                : `${Math.round(execPct * 100)}%`
          }
          detalhe={
            habito
              ? `média semanal · meta ${Math.round(alvoAderencia * 100)}%`
              : tarefas.length === 0
                ? "Sem ações vinculadas"
                : `${tarefas.length} ${tarefas.length === 1 ? "ação" : "ações"} no período corrente`
          }
          cor="var(--color-amber)"
        />
        {/* Hábito não se cumpre, se mantém: "prazo consumido" sugeria uma
            linha de chegada que não existe. No lugar dele, o que hoje pede. */}
        {habito ? (
          <Indicador
            titulo="Hoje"
            valor={
              hojeAderencia.exigidos === 0
                ? "—"
                : `${hojeAderencia.cumpridos} de ${hojeAderencia.exigidos}`
            }
            detalhe={
              hojeAderencia.exigidos === 0
                ? "nada pedido hoje"
                : "cumprimentos pedidos hoje"
            }
            cor="hsl(var(--muted-foreground))"
          />
        ) : (
          <Indicador
            titulo="Prazo consumido"
            valor={`${Math.round(prazo * 100)}%`}
            detalhe="do período da meta"
            cor="hsl(var(--muted-foreground))"
          />
        )}
      </div>

      {habito && variant === "completo" && <AderenciaSemanal meta={meta} />}

      {desempenhoPorPessoa.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Execução por responsável
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {desempenhoPorPessoa.map((responsavel) => {
              const percentual = responsavel.pct === null ? null : Math.round(responsavel.pct * 100);
              return (
                <div key={responsavel.id} className="rounded-md bg-muted/35 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium">{responsavel.full_name}</span>
                    <span className="font-bold" style={{ color: "var(--color-amber)" }}>
                      {percentual === null ? "—" : `${percentual}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentual ?? 0}%`,
                        backgroundColor: "var(--color-amber)",
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {responsavel.totalAcoes === 0
                      ? "Sem ações atribuídas"
                      : `${responsavel.totalAcoes} ${responsavel.totalAcoes === 1 ? "ação atribuída" : "ações atribuídas"}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="rounded-lg px-3 py-2.5 text-xs space-y-1"
        style={{ backgroundColor: tom.bg }}
      >
        <div className="font-semibold" style={{ color: tom.fg }}>
          Diagnóstico: {diag.titulo}
        </div>
        <p className="text-muted-foreground">{diag.frase}</p>
        {variant === "completo" && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">O que fazer: </span>
            {diag.recomendacao}
          </p>
        )}
      </div>

      {variant === "completo" && (
        <p className="text-[11px] text-muted-foreground">
          Resultado e execução são indicadores diferentes: concluir ações do plano não altera
          automaticamente o resultado da meta.
        </p>
      )}
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
  cor,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  cor: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </div>
      <div className="text-xl font-bold" style={{ color: cor }}>
        {valor}
      </div>
      <div className="text-[11px] text-muted-foreground truncate">{detalhe}</div>
    </div>
  );
}
