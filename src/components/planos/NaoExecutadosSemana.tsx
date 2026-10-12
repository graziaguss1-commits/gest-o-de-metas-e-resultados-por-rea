import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useAgendaPeriodo } from "@/hooks/useAgendaDoDia";
import { useMotivosBloco } from "@/hooks/useMotivosBloco";
import { isoLocal } from "@/lib/hoje";
import { resumoNaoExecutados } from "@/lib/motivos";

/** Blocos não executados na semana anterior à semana planejada, por motivo. */
export function NaoExecutadosSemana({ weekStart }: { weekStart: Date }) {
  const inicio = isoLocal(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7));
  const fim = isoLocal(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 1));
  const { blocos, isLoading } = useAgendaPeriodo(inicio, fim);
  const { data: motivos, isLoading: carregandoMotivos } = useMotivosBloco(inicio, fim);
  const resumo = useMemo(
    () => resumoNaoExecutados(blocos, motivos ?? new Map(), new Date()),
    [blocos, motivos],
  );

  if (isLoading || carregandoMotivos) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando a semana anterior…</div>;
  }
  if (resumo.total === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum bloco deixou de ser executado na semana passada.</p>;
  }
  const max = Math.max(resumo.semMotivo, ...resumo.porMotivo.map((m) => m.total), 1);
  const linhas = [...resumo.porMotivo, ...(resumo.semMotivo ? [{ motivo: "sem", label: "Sem motivo registrado", total: resumo.semMotivo }] : [])];
  return (
    <div>
      <div className="font-display text-3xl font-semibold">{resumo.total}</div>
      <p className="text-xs text-muted-foreground">
        {resumo.total === 1 ? "bloco não executado" : "blocos não executados"} na semana passada
      </p>
      <ul className="mt-4 space-y-2">
        {linhas.map((m) => (
          <li key={m.motivo} className="grid grid-cols-[150px_1fr_32px] items-center gap-3 text-sm">
            <span className={m.motivo === "sem" ? "text-muted-foreground" : "font-medium"}>{m.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span className={`block h-full rounded-full ${m.motivo === "sem" ? "bg-muted-foreground/40" : "bg-[var(--brand-accent)]"}`} style={{ width: `${(m.total / max) * 100}%` }} />
            </span>
            <span className="text-right font-bold tabular-nums">{m.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
