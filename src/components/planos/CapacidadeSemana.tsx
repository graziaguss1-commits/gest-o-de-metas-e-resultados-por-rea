import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useAgendamentos } from "@/hooks/useAgendamentos";
import { useActions } from "@/hooks/useActions";
import { useCompromissos } from "@/hooks/useCompromissos";
import { useAppSettings } from "@/hooks/useAppSettings";
import { capacidadeDoDia, formatTotalHoras, totalSemana } from "@/lib/agenda";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function inicioDaSemana(base = new Date()) {
  const d = new Date(base);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Tempo planejado por dia e na semana, incluindo prioridades avulsas. */
export function CapacidadeSemana({ inicioSemana }: { inicioSemana?: string }) {
  const { data: settings } = useAppSettings();
  const { data: actions = [] } = useActions();
  const dias = useMemo(() => {
    const start = inicioSemana
      ? new Date(`${inicioSemana}T12:00:00`)
      : inicioDaSemana();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [inicioSemana]);
  const { data: agendamentos = [] } = useAgendamentos(iso(dias[0]), iso(dias[6]));
  const { data: compromissos = [] } = useCompromissos(iso(dias[0]), iso(dias[6]));
  const capacidade = settings?.capacidade_diaria_minutos ?? 480;

  const minutosAvulsos = (data: string) =>
    actions
      .filter((action) => action.data_agendada === data)
      .reduce((total, action) => total + (action.duracao_minutos ?? 0), 0);

  const minutosCompromissos = (data: string) =>
    compromissos
      .filter((compromisso) => compromisso.data === data)
      .reduce((total, compromisso) => {
        const [hi, mi] = compromisso.hora_inicio.split(":").map(Number);
        const [hf, mf] = compromisso.hora_fim.split(":").map(Number);
        return total + (hf * 60 + mf - hi * 60 - mi);
      }, 0);

  const capacidadeCompleta = (data: string) => {
    const base = capacidadeDoDia(data, agendamentos, capacidade);
    const planejado =
      base.planejado + minutosAvulsos(data) + minutosCompromissos(data);
    return {
      ...base,
      planejado,
      disponivel: Math.max(0, capacidade - planejado),
      sobrecarga: planejado > capacidade,
    };
  };

  const semana =
    totalSemana(dias.map(iso), agendamentos) +
    dias.reduce(
      (total, dia) =>
        total + minutosAvulsos(iso(dia)) + minutosCompromissos(iso(dia)),
      0,
    );
  const sobrecarregados = dias
    .map((d) => capacidadeCompleta(iso(d)))
    .filter((c) => c.sobrecarga);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-2xl font-semibold">
          {formatTotalHoras(semana)}
        </span>
        <span className="text-sm text-muted-foreground">
          planejadas nesta semana
        </span>
        <span className="text-xs text-muted-foreground">
          · capacidade diária {formatTotalHoras(capacidade)}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-7">
        {dias.map((d) => {
          const cap = capacidadeCompleta(iso(d));
          const pct = Math.min(
            100,
            Math.round((cap.planejado / Math.max(1, capacidade)) * 100),
          );
          return (
            <div key={iso(d)} className="rounded-xl border p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {d
                  .toLocaleDateString("pt-BR", { weekday: "short" })
                  .replace(".", "")}
              </div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatTotalHoras(cap.planejado)}
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: cap.sobrecarga
                      ? "var(--color-red)"
                      : "var(--brand-primary)",
                  }}
                />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {cap.sobrecarga
                  ? "Sobrecarga"
                  : `${formatTotalHoras(cap.disponivel)} livres`}
              </div>
            </div>
          );
        })}
      </div>

      {sobrecarregados.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-red)]/40 p-3 text-xs text-[var(--color-red)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {sobrecarregados.length === 1
              ? "1 dia está"
              : `${sobrecarregados.length} dias estão`}{" "}
            acima da capacidade. Reagende ou reduza ações para o tempo caber na
            agenda.
          </span>
        </div>
      )}
    </div>
  );
}
