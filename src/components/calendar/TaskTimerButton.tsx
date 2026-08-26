import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCronometro,
  segundosDoCronometro,
  type Agendamento,
} from "@/lib/agenda";

type Props = {
  agendamento: Agendamento;
  pending?: boolean;
  showLabel?: boolean;
  showElapsed?: boolean;
  className?: string;
  onToggle: (agendamento: Agendamento) => void;
};

/** Controle visual do cronômetro. O estado oficial permanece no banco. */
export function TaskTimerButton({
  agendamento,
  pending = false,
  showLabel = true,
  showElapsed = true,
  className,
  onToggle,
}: Props) {
  const ativo = Boolean(agendamento.cronometro_iniciado_em);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    setAgora(Date.now());
    if (!ativo) return;
    const interval = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [ativo, agendamento.cronometro_iniciado_em]);

  const segundos = segundosDoCronometro(agendamento, agora);
  const possuiTempo = segundos > 0;
  const tempo = formatCronometro(segundos);
  const label = ativo
    ? `Pausar · ${tempo}`
    : possuiTempo
      ? `Continuar · ${tempo}`
      : "Iniciar";

  return (
    <button
      type="button"
      draggable={false}
      disabled={pending}
      aria-label={label}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(agendamento);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn(
        "flex h-6 items-center gap-1 rounded-full border px-1.5 text-[9px] font-semibold transition-colors disabled:opacity-60",
        ativo
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
          : "border-border bg-card/90 text-foreground hover:border-[var(--brand-primary)]",
        className,
      )}
    >
      {ativo ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      {(showLabel || (possuiTempo && showElapsed)) && (
        <span>{showLabel ? label : tempo}</span>
      )}
    </button>
  );
}
