import { useMemo } from "react";
import { Flame } from "lucide-react";
import { useExecucaoDaMeta } from "@/hooks/usePlanos";
import { isoLocal } from "@/lib/hoje";
import {
  aderenciaDasTarefas,
  aderenciaPorSemana,
  sequenciaAtual,
  type SemanaAderencia,
} from "@/lib/resumoSemanal";
import type { MetaWithResponsavel } from "@/lib/metas";

const rotuloSemana = (iso: string) => {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
};

/** Cor da barra pela distância da meta de aderência. */
const corDaBarra = (pct: number, alvo: number) => {
  if (pct >= alvo) return "var(--color-green)";
  if (pct >= alvo / 2) return "var(--color-amber)";
  return "var(--color-red)";
};

/**
 * Hábito não é pilha para encher até dezembro: é "cumpri esta semana?".
 *
 * Por isso aqui não há linha subindo até o fim da meta. Uma barra por
 * semana com a aderência daquela semana, e a linha da meta atravessando —
 * o que se quer ver é se a semana passou da linha, e se as semanas estão
 * subindo ou caindo.
 */
export function AderenciaSemanal({
  meta,
  compacto = false,
}: {
  meta: MetaWithResponsavel;
  compacto?: boolean;
}) {
  const { tarefas, execucoes } = useExecucaoDaMeta(meta.id);
  const hoje = isoLocal(new Date());
  const alvo = (meta.meta_aderencia ?? 80) / 100;

  const janela = useMemo(
    () => ({ data_inicio: meta.data_inicio, data_fim: meta.data_fim }),
    [meta.data_inicio, meta.data_fim],
  );

  const semanas = useMemo(
    () => aderenciaPorSemana(tarefas, execucoes, janela, hoje),
    [tarefas, execucoes, janela, hoje],
  );

  const estaSemana = useMemo(() => {
    const ultima: SemanaAderencia | undefined = semanas[semanas.length - 1];
    return ultima && ultima.inicio <= hoje ? ultima : null;
  }, [semanas, hoje]);

  const sequencia = useMemo(
    () => sequenciaAtual(tarefas, execucoes, janela, hoje),
    [tarefas, execucoes, janela, hoje],
  );

  const hojeAderencia = useMemo(
    () => aderenciaDasTarefas(tarefas, execucoes, janela, { inicio: hoje, fim: hoje }),
    [tarefas, execucoes, janela, hoje],
  );

  if (semanas.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma semana cobrada ainda — as rotinas desta meta ainda não começaram.
      </p>
    );
  }

  // Só as últimas semanas no card: 20 barras num espaço de 200px viram traços.
  const visiveis = compacto ? semanas.slice(-8) : semanas.slice(-20);
  const altura = compacto ? 64 : 150;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Aderência por semana
        </span>
        <span className="text-[10px] text-muted-foreground">
          linha: meta de {Math.round(alvo * 100)}%
        </span>
      </div>

      <div
        className="relative flex items-end gap-1 border-b"
        style={{ height: altura }}
      >
        {/* Linha da meta: a referência que faz a barra significar alguma coisa. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--brand-accent)]/70"
          style={{ bottom: `${alvo * 100}%` }}
        />
        {visiveis.map((semana) => {
          const pct = semana.pct ?? 0;
          return (
            <div
              key={semana.inicio}
              className="group relative flex flex-1 flex-col justify-end"
              style={{ height: "100%" }}
              title={`Semana de ${rotuloSemana(semana.inicio)}: ${semana.cumpridos} de ${semana.exigidos} · ${Math.round(pct * 100)}%`}
            >
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(pct * 100, pct > 0 ? 3 : 1)}%`,
                  background: pct > 0 ? corDaBarra(pct, alvo) : "hsl(var(--muted))",
                }}
              />
            </div>
          );
        })}
      </div>

      {!compacto && (
        <div className="flex gap-1">
          {visiveis.map((semana) => (
            <span
              key={semana.inicio}
              className="flex-1 text-center text-[9px] text-muted-foreground"
            >
              {rotuloSemana(semana.inicio)}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {estaSemana && (
          <span>
            <span className="text-muted-foreground">Esta semana: </span>
            <strong>
              {estaSemana.cumpridos} de {estaSemana.exigidos}
            </strong>
            <span className="text-muted-foreground">
              {" "}
              · {Math.round((estaSemana.pct ?? 0) * 100)}%
            </span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Flame
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${sequencia > 0 ? "text-[var(--brand-accent)]" : "text-muted-foreground/40"}`}
          />
          <span className="text-muted-foreground">Sequência: </span>
          <strong>
            {sequencia} {sequencia === 1 ? "dia" : "dias"}
          </strong>
        </span>
      </div>

      {/* Dito em voz alta para a sequência não parecer quebrada às 9h. */}
      {hojeAderencia.exigidos > 0 &&
        hojeAderencia.cumpridos < hojeAderencia.exigidos && (
          <p className="text-[10px] text-muted-foreground">
            Hoje ainda está em aberto ({hojeAderencia.cumpridos} de{" "}
            {hojeAderencia.exigidos}) e não conta contra a sequência.
          </p>
        )}
    </div>
  );
}
