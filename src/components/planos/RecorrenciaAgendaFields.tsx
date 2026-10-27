import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DiasSemanaPicker } from "@/components/planos/DiasSemanaPicker";
import { DuracaoPicker } from "@/components/planos/DuracaoPicker";
import type { Frequencia } from "@/lib/execucao";
import {
  configuracaoRecorrenciaCompleta,
  diasSemanaisCompletos,
  formatDuracao,
  horaFim,
  labelMomentoRecorrencia,
} from "@/lib/agenda";
import type { RecorrenciaMensal } from "@/lib/agenda";
import { cn } from "@/lib/utils";

type Props = {
  frequencia: Frequencia;
  execucoes: number;
  duracao: number | null;
  horario: string;
  dias: number[] | null;
  onDuracaoChange: (duracao: number | null) => void;
  onExecucoesChange: (execucoes: number) => void;
  onHorarioChange: (horario: string) => void;
  onDiasChange: (dias: number[] | null) => void;
  /** Regra da mensal: por dia do mês ou por posição no mês. */
  mensal?: RecorrenciaMensal | null;
  onMensalChange?: (mensal: RecorrenciaMensal) => void;
  compact?: boolean;
};

const SEMANAS = [
  { valor: 1, label: "primeira" },
  { valor: 2, label: "segunda" },
  { valor: 3, label: "terceira" },
  { valor: 4, label: "quarta" },
  { valor: -1, label: "última" },
];

const DIAS_SEMANA = [
  { valor: 1, label: "segunda-feira" },
  { valor: 2, label: "terça-feira" },
  { valor: 3, label: "quarta-feira" },
  { valor: 4, label: "quinta-feira" },
  { valor: 5, label: "sexta-feira" },
  { valor: 6, label: "sábado" },
  { valor: 7, label: "domingo" },
];

export function RecorrenciaAgendaFields({
  frequencia,
  execucoes,
  duracao,
  horario,
  dias,
  onDuracaoChange,
  onExecucoesChange,
  onHorarioChange,
  onDiasChange,
  mensal,
  onMensalChange,
  compact = false,
}: Props) {
  const porDiaDaSemana = mensal?.recorrencia_mensal === "dia_da_semana";
  const fieldId = useId();
  const [execucoesDraft, setExecucoesDraft] = useState(String(execucoes));
  const recorrente = frequencia !== "unica";
  const completa =
    configuracaoRecorrenciaCompleta(
      frequencia,
      duracao,
      horario,
      dias,
      mensal,
    ) && diasSemanaisCompletos(frequencia, execucoes, dias);
  const momento = labelMomentoRecorrencia(frequencia, dias, mensal);
  const periodoExecucao =
    frequencia === "diaria"
      ? "por dia"
      : frequencia === "semanal"
        ? "por semana"
        : frequencia === "mensal"
          ? "por mês"
          : "para concluir";
  const resumo =
    completa && recorrente && momento && duracao
      ? `${momento} · ${horario}–${horaFim(horario, duracao)} · ${formatDuracao(duracao)}`
      : null;

  useEffect(() => {
    setExecucoesDraft(String(execucoes));
  }, [execucoes]);

  const confirmarExecucoes = (value: string) => {
    const numero = Number(value);
    const quantidade = Number.isFinite(numero)
      ? Math.min(100, Math.max(1, Math.round(numero)))
      : 1;
    setExecucoesDraft(String(quantidade));
    onExecucoesChange(quantidade);
  };

  const alterarDiaMes = (value: string) => {
    if (!value) return onDiasChange(null);
    const dia = Math.min(31, Math.max(1, Math.round(Number(value))));
    onDiasChange(Number.isFinite(dia) ? [dia] : null);
  };

  return (
    <section
      className={cn(
        "rounded-lg border bg-muted/30",
        compact ? "space-y-3 p-3" : "space-y-4 p-4",
      )}
    >
      <div>
        <div className="text-sm font-semibold">
          Como esta ação entra na agenda?
        </div>
        <p className="text-xs text-muted-foreground">
          {recorrente
            ? "Separe a quantidade de resultado da quantidade de horários necessários."
            : "Informe quantos blocos serão necessários e quanto tempo cada um leva."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>
          {frequencia === "semanal"
            ? "Quantas vezes por semana?"
            : `Execuções no calendário ${periodoExecucao}`}
        </Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={execucoesDraft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const value = event.target.value;
            setExecucoesDraft(value);
            if (value !== "") confirmarExecucoes(value);
          }}
          onBlur={(event) => confirmarExecucoes(event.target.value)}
          className="w-[130px]"
        />
        <p className="text-[11px] text-muted-foreground">
          {frequencia === "semanal"
            ? "Ex.: treinar 4 vezes na semana = 4. Depois escolha abaixo os 4 dias preferidos."
            : "Ex.: prospectar 10 pessoas em um único bloco = 1 execução. Postar 7 reels em horários separados = 7 execuções."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Duração por execução{recorrente ? " *" : ""}</Label>
        <DuracaoPicker
          value={duracao}
          onChange={onDuracaoChange}
          allowEmpty={!recorrente}
        />
      </div>

      {recorrente && (
        <>
          {frequencia === "diaria" && (
            <div className="space-y-1.5">
              <Label>Dias de execução *</Label>
              <DiasSemanaPicker value={dias} onChange={onDiasChange} />
            </div>
          )}

          {frequencia === "semanal" && (
            <div className="space-y-1.5">
              <Label>
                {execucoes === 1
                  ? "Melhor dia da semana *"
                  : "Dias preferidos da semana *"}
              </Label>
              <DiasSemanaPicker
                value={dias}
                onChange={onDiasChange}
                maxSelections={Math.min(execucoes, 7)}
                showPresets={execucoes === 5 || execucoes === 7}
              />
              <p
                className={cn(
                  "text-[11px]",
                  execucoes <= 7 && (dias?.length ?? 0) !== execucoes
                    ? "font-semibold text-[var(--color-amber)]"
                    : "text-muted-foreground",
                )}
              >
                {execucoes <= 7
                  ? `${dias?.length ?? 0} de ${execucoes} ${execucoes === 1 ? "dia escolhido" : "dias escolhidos"}. Cada dia gera um bloco no calendário.`
                  : `${dias?.length ?? 0} dias preferidos escolhidos. Os blocos restantes serão distribuídos no planejamento semanal.`}
              </p>
            </div>
          )}

          {frequencia === "mensal" && (
            <div className="space-y-2">
              {/* Dia 10 cai num dia da semana diferente a cada mês. Para
                  "toda primeira sexta" não existe número de dia que sirva,
                  então a escolha precisa ser explícita. */}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={porDiaDaSemana ? "outline" : "default"}
                  className="h-8 px-3 text-xs"
                  onClick={() =>
                    onMensalChange?.({ ...mensal, recorrencia_mensal: "dia_do_mes" })
                  }
                >
                  Em um dia do mês
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={porDiaDaSemana ? "default" : "outline"}
                  className="h-8 px-3 text-xs"
                  onClick={() =>
                    onMensalChange?.({
                      recorrencia_mensal: "dia_da_semana",
                      semana_do_mes: mensal?.semana_do_mes ?? 1,
                      dia_semana_mensal: mensal?.dia_semana_mensal ?? 5,
                    })
                  }
                >
                  Em um dia da semana
                </Button>
              </div>

              {porDiaDaSemana ? (
                <div className="space-y-1.5">
                  <Label>Qual dia da semana *</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Semana do mês"
                      value={String(mensal?.semana_do_mes ?? 1)}
                      onChange={(e) =>
                        onMensalChange?.({
                          ...mensal,
                          recorrencia_mensal: "dia_da_semana",
                          semana_do_mes: Number(e.target.value),
                        })
                      }
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      {SEMANAS.map((s) => (
                        <option key={s.valor} value={s.valor}>{s.label}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Dia da semana"
                      value={String(mensal?.dia_semana_mensal ?? 5)}
                      onChange={(e) =>
                        onMensalChange?.({
                          ...mensal,
                          recorrencia_mensal: "dia_da_semana",
                          dia_semana_mensal: Number(e.target.value),
                        })
                      }
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      {DIAS_SEMANA.map((d) => (
                        <option key={d.valor} value={d.valor}>{d.label}</option>
                      ))}
                    </select>
                    <span className="text-xs text-muted-foreground">
                      Ex.: toda primeira sexta do mês
                    </span>
                  </div>
                  {mensal?.semana_do_mes === 5 && (
                    <p className="text-[11px] text-muted-foreground">
                      Em meses sem a quinta ocorrência, a rotina cai na última.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor={`dia-mes-recorrencia-${fieldId}`}>
                    Dia do mês *
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`dia-mes-recorrencia-${fieldId}`}
                      type="number"
                      min={1}
                      max={31}
                      value={dias?.[0] ?? ""}
                      onChange={(event) => alterarDiaMes(event.target.value)}
                      placeholder="Ex.: 10"
                      className="w-[120px]"
                    />
                    <span className="text-xs text-muted-foreground">
                      Ex.: avaliar DRE todo dia 10
                    </span>
                  </div>
                  {(dias?.[0] ?? 0) > 28 && (
                    <p className="text-[11px] text-muted-foreground">
                      Em meses mais curtos, a rotina será agendada no último dia
                      do mês.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`horario-recorrencia-${fieldId}`}>
              Horário preferencial *
            </Label>
            <Input
              id={`horario-recorrencia-${fieldId}`}
              type="time"
              value={horario}
              onChange={(event) => onHorarioChange(event.target.value)}
              className="w-[150px]"
            />
          </div>

          {resumo ? (
            <div className="rounded-lg bg-[var(--brand-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--brand-primary)]">
              {frequencia === "semanal" && (dias?.length ?? 0) > 1
                ? `Agenda automática: ${resumo} · ${dias?.length} blocos por semana.`
                : execucoes > 1
                  ? `Primeiro bloco sugerido: ${resumo}. Os demais serão distribuídos no planejamento semanal.`
                  : `Agenda automática: ${resumo}`}
            </div>
          ) : (
            <p className="text-xs font-semibold text-destructive">
              {frequencia === "semanal" &&
              execucoes <= 7 &&
              (dias?.length ?? 0) !== execucoes
                ? `Escolha ${execucoes} ${execucoes === 1 ? "dia" : "dias"} para criar ${execucoes} ${execucoes === 1 ? "bloco" : "blocos"} por semana.`
                : "Escolha o dia, o horário e a duração para criar a rotina no calendário."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
