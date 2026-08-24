import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DiasSemanaPicker } from "@/components/planos/DiasSemanaPicker";
import { DuracaoPicker } from "@/components/planos/DuracaoPicker";
import type { Frequencia } from "@/lib/execucao";
import {
  configuracaoRecorrenciaCompleta,
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
  const recorrente = frequencia !== "unica";
  const completa = configuracaoRecorrenciaCompleta(
    frequencia,
    duracao,
    horario,
    dias,
  );
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
        <Label>Execuções no calendário {periodoExecucao}</Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={execucoes}
          onChange={(event) =>
            onExecucoesChange(
              Math.min(100, Math.max(1, Number(event.target.value) || 1)),
            )
          }
          className="w-[130px]"
        />
        <p className="text-[11px] text-muted-foreground">
          Ex.: prospectar 10 pessoas em um único bloco = 1 execução. Postar 7
          reels em horários separados = 7 execuções.
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
              <Label>Melhor dia da semana *</Label>
              <DiasSemanaPicker
                value={dias}
                onChange={onDiasChange}
                mode="single"
              />
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
              {execucoes > 1
                ? `Primeiro bloco sugerido: ${resumo}. Os demais serão distribuídos no planejamento semanal.`
                : `Agenda automática: ${resumo}`}
            </div>
          ) : (
            <p className="text-xs font-semibold text-destructive">
              Escolha o dia, o horário e a duração para criar a rotina no
              calendário.
            </p>
          )}
        </>
      )}
    </section>
  );
}
