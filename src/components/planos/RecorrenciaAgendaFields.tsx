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
  duracao: number | null;
  horario: string;
  dias: number[] | null;
  onDuracaoChange: (duracao: number | null) => void;
  onHorarioChange: (horario: string) => void;
  onDiasChange: (dias: number[] | null) => void;
  compact?: boolean;
};

export function RecorrenciaAgendaFields({
  frequencia,
  duracao,
  horario,
  dias,
  onDuracaoChange,
  onHorarioChange,
  onDiasChange,
  compact = false,
}: Props) {
  const recorrente = frequencia !== "unica";
  const completa = configuracaoRecorrenciaCompleta(
    frequencia,
    duracao,
    horario,
    dias,
  );
  const momento = labelMomentoRecorrencia(frequencia, dias);
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
          {recorrente ? "Quando executar esta rotina?" : "Duração estimada"}
        </div>
        <p className="text-xs text-muted-foreground">
          {recorrente
            ? "Defina o momento que será protegido automaticamente no calendário."
            : "Informe quanto tempo esta ação leva para facilitar o agendamento posterior."}
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
              <Label htmlFor="dia-mes-recorrencia">Dia do mês *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="dia-mes-recorrencia"
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
                  Em meses mais curtos, a rotina será agendada no último dia do mês.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="horario-recorrencia">Horário preferencial *</Label>
            <Input
              id="horario-recorrencia"
              type="time"
              value={horario}
              onChange={(event) => onHorarioChange(event.target.value)}
              className="w-[150px]"
            />
          </div>

          {resumo ? (
            <div className="rounded-lg bg-[var(--brand-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--brand-primary)]">
              Agenda automática: {resumo}
            </div>
          ) : (
            <p className="text-xs font-semibold text-destructive">
              Escolha o dia, o horário e a duração para criar a rotina no calendário.
            </p>
          )}
        </>
      )}
    </section>
  );
}
