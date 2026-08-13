import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, History, Plus, Sparkles, Calendar, Pencil } from "lucide-react";
import {
  formatDateISOToBR,
  formatProgresso,
  progressoEsperado,
  progressoReal,
  type MetaWithResponsavel,
  type Status,
} from "@/lib/metas";
import { Button } from "@/components/ui/button";
import { StatusChip } from "./StatusChip";
import { ProgressBar } from "./ProgressBar";
import { ExecucaoConsolidada } from "./ExecucaoConsolidada";
import { cn } from "@/lib/utils";

type Props = {
  meta: MetaWithResponsavel;
  defaultOpen?: boolean;
  onLancarResultado: (meta: MetaWithResponsavel) => void;
  onVerHistorico: (meta: MetaWithResponsavel) => void;
  onEditar?: (meta: MetaWithResponsavel) => void;
};

function initials(name?: string | null) {
  if (!name) return "•";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function MetaCard({ meta, defaultOpen, onLancarResultado, onVerHistorico, onEditar }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  const status = meta.status as Status;
  const real = progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse);
  const esperado = progressoEsperado(meta.data_inicio, meta.data_fim);

  return (
    <div className="metasia-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 flex items-start gap-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base truncate">{meta.nome}</h3>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ backgroundColor: "var(--color-blue-soft)", color: "var(--color-blue)" }}
            >
              {meta.area}
            </span>
            <StatusChip status={status} size="sm" />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: "var(--color-blue)" }}
              >
                {initials(meta.responsavel_nome)}
              </span>
              {meta.responsavel_nome ?? "Sem responsável"}
            </span>
            <span className="capitalize">• {meta.periodicidade}</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateISOToBR(meta.data_inicio)} → {formatDateISOToBR(meta.data_fim)}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform shrink-0 mt-1",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t bg-muted/20">
          <div className="grid md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Progresso</span>
                <span className="text-xs font-medium">
                  {Math.round(real * 100)}% real · {Math.round(esperado * 100)}% esperado
                </span>
              </div>
              <ProgressBar value={real} status={status} height={10} />
              <div className="flex items-baseline justify-between text-sm gap-2">
                <span className="font-bold text-lg">
                  {formatProgresso(meta)} · {Math.round(real * 100)}%
                </span>
                {meta.is_inverse && (
                  <span className="text-[10px] italic text-muted-foreground">
                    (menor é melhor)
                  </span>
                )}
              </div>

            </div>

            <BurnUpMini meta={meta} />
          </div>

          <ExecucaoConsolidada meta={meta} />

          {meta.descricao && (
            <p className="text-sm text-muted-foreground">{meta.descricao}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => onLancarResultado(meta)}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Atualizar resultado
            </Button>
            <Button size="sm" variant="outline" onClick={() => onVerHistorico(meta)}>
              <History className="h-4 w-4 mr-1.5" />
              Histórico de medições
            </Button>
            {onEditar && (
              <Button size="sm" variant="outline" onClick={() => onEditar(meta)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Editar meta
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to={`/metas/${meta.id}/analise`}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Análise IA
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Mini SVG burn-up: linha real (sólida) vs esperada (tracejada). */
function BurnUpMini({ meta }: { meta: MetaWithResponsavel }) {
  const status = meta.status as Status;
  const real = progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse);
  const esperado = progressoEsperado(meta.data_inicio, meta.data_fim);

  const W = 200;
  const H = 72;
  const PAD = 4;

  const x = (t: number) => PAD + t * (W - PAD * 2);
  const y = (v: number) => H - PAD - v * (H - PAD * 2);

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-muted-foreground">Trajetória</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(1)}
          y2={y(1)}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.6"
        />
        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(esperado)}
          y2={y(real)}
          stroke="var(--color-blue)"
          strokeWidth="2"
        />
        <circle cx={x(esperado)} cy={y(real)} r="3" fill="var(--color-blue)" />
        <circle cx={x(1)} cy={y(1)} r="2.5" fill="hsl(var(--muted-foreground))" />
      </svg>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-blue)" }}
          />
          Real
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-px bg-muted-foreground/60 border-t border-dashed" />
          Esperado
        </span>
        <span className="ml-auto" style={{ color: "var(--color-blue)" }}>
          Desvio: {Math.round((real - esperado) * 100)}pp
        </span>
        <span className="opacity-0">.{status}</span>
      </div>
    </div>
  );
}
