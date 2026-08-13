import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { actionQuadrant, actionScore } from "@/hooks/useActions";
import { cn } from "@/lib/utils";

type Props = {
  impacto: number;
  esforco: number;
  onImpactoChange: (value: number) => void;
  onEsforcoChange: (value: number) => void;
  compact?: boolean;
  className?: string;
};

const QUADRANT_STYLE: Record<string, { color: string; soft: string }> = {
  "Fazer primeiro": { color: "var(--color-green)", soft: "var(--color-green-bg)" },
  Planejar: { color: "var(--brand-navy)", soft: "var(--brand-navy-soft)" },
  Encaixar: { color: "var(--brand-accent)", soft: "var(--brand-accent-soft)" },
  Reavaliar: { color: "var(--color-red)", soft: "var(--color-red-bg)" },
};

const QUADRANT_DESCRIPTION: Record<string, string> = {
  "Fazer primeiro": "Alto impacto com menor esforço.",
  Planejar: "Alto impacto que exige mais preparação.",
  Encaixar: "Menor impacto, mas fácil de executar.",
  Reavaliar: "Menor impacto com maior esforço.",
};

export function ImpactoEsforcoPicker({
  impacto,
  esforco,
  onImpactoChange,
  onEsforcoChange,
  compact = false,
  className,
}: Props) {
  const quadrant = actionQuadrant({ impacto, esforco });
  const style = QUADRANT_STYLE[quadrant];

  return (
    <section
      className={cn(
        "rounded-lg border bg-muted/20",
        compact ? "space-y-3 p-3" : "space-y-4 p-4",
        className,
      )}
      aria-label="Avaliação de impacto e esforço"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Impacto × esforço</h4>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Avalie esta ação com a mesma regra usada na matriz de prioridades.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          escala 1–10
        </span>
      </div>

      <Rating
        label="Impacto no resultado"
        value={impacto}
        onChange={onImpactoChange}
        low="Baixo retorno"
        high="Alto retorno"
      />
      <Rating
        label="Esforço para executar"
        value={esforco}
        onChange={onEsforcoChange}
        low="Pouco esforço"
        high="Muito esforço"
      />

      <div className="rounded-lg p-3" style={{ background: style.soft, color: style.color }}>
        <div className="text-[10px] font-bold uppercase tracking-wider">
          Classificação automática
        </div>
        <div className="mt-0.5 font-display text-lg font-semibold">{quadrant}</div>
        <p className="mt-0.5 text-[11px]">{QUADRANT_DESCRIPTION[quadrant]}</p>
        <div className="mt-1 text-[11px]">
          Pontuação estratégica: {actionScore({ impacto, esforco })} de 100
        </div>
      </div>
    </section>
  );
}

function Rating({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  low: string;
  high: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="font-display text-xl font-semibold text-[var(--brand-primary)]">
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={1}
        max={10}
        step={1}
        aria-label={label}
        onValueChange={(values) => onChange(values[0] ?? value)}
      />
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
