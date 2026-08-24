import { useEffect, useId, useState } from "react";
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
  compact?: boolean;
};

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
  compact = false,
}: Props) {
  const fieldId = useId();
  const [execucoesDraft, setExecucoesDraft] = useState(String(execucoes));
  const recorrente = frequencia !== "unica";
  const completa =
    configuracaoRecorrenciaCompleta(
      frequencia,
      duracao,
      horario,
      dias,
    ) && diasSemanaisCompletos(frequencia, execucoes, dias);
  const momento = labelMomentoRecorrencia(frequencia, dias);
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
                  Em meses mais curtos, a rotina será agendada no último dia do
                  mês.
                </p>
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
