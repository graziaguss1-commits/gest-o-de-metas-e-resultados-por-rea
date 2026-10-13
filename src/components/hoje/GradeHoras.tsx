import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BlocoAgendaDia } from "@/hooks/useAgendaDoDia";
import {
  PX_POR_HORA,
  PX_POR_MINUTO,
  faixaHoras,
  minutosDoDia,
  posicionarBlocos,
} from "@/lib/grade";
import { naoExecutado } from "@/lib/motivos";

/** Hachura dos horários ocupados vindos do Google. */
const HACHURA =
  "repeating-linear-gradient(135deg, var(--muted-bg,hsl(var(--muted))) 0px, var(--muted-bg,hsl(var(--muted))) 6px, transparent 6px, transparent 12px)";

const LARGURA_REGUA = 44;
/** Granularidade do arraste, igual à do calendário. */
const PASSO_MINUTOS = 15;

const comoHora = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

type Props = {
  blocos: BlocoAgendaDia[];
  agora: Date;
  /** Mostra a linha do horário atual (só faz sentido no dia de hoje). */
  mostrarAgora?: boolean;
  abertoId: string | null;
  onAbrir: (id: string | null) => void;
  /** Conteúdo do bloco. `aberto` indica se deve mostrar as ações. */
  renderBloco: (bloco: BlocoAgendaDia, estado: { aberto: boolean }) => ReactNode;
  /** Quando informado, os blocos podem ser arrastados para outro horário. */
  onMover?: (bloco: BlocoAgendaDia, hora: string) => void;
};

/** No desktop o bloco abre ao passar o mouse; no celular, só ao tocar. */
function usePodeHover() {
  const [podeHover, setPodeHover] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const aplicar = () => setPodeHover(mq.matches);
    aplicar();
    mq.addEventListener?.("change", aplicar);
    return () => mq.removeEventListener?.("change", aplicar);
  }, []);
  return podeHover;
}

/**
 * Agenda do dia desenhada como grade de horas, no formato de calendário:
 * uma linha por hora, cada bloco posicionado e dimensionado pelo horário real,
 * sobreposições lado a lado e a linha vermelha do agora.
 *
 * Um bloco por vez fica aberto. Fechado, ocupa exatamente o seu horário;
 * aberto, cresce por cima da faixa seguinte para caber as ações.
 */
export function GradeHoras({
  blocos,
  agora,
  mostrarAgora = true,
  abertoId,
  onAbrir,
  renderBloco,
  onMover,
}: Props) {
  const podeHover = usePodeHover();
  const minutosAgora = minutosDoDia(agora);
  const { primeira, ultima } = faixaHoras(blocos, mostrarAgora ? minutosAgora : null);
  const horas = Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i);
  const altura = (ultima - primeira) * PX_POR_HORA;
  const posicionados = posicionarBlocos(blocos, primeira);
  const topoAgora = (minutosAgora - primeira * 60) * PX_POR_MINUTO;
  const agoraVisivel = mostrarAgora && topoAgora >= 0 && topoAgora <= altura;

  const containerRef = useRef<HTMLDivElement>(null);
  // Um clique fora fecha o bloco aberto, como qualquer popover.
  useEffect(() => {
    if (!abertoId) return;
    const fechar = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onAbrir(null);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [abertoId, onAbrir]);

  const porId = new Map(blocos.map((b) => [b.id, b]));
  const soltar = (e: React.DragEvent, minutos: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const bloco = porId.get(id);
    if (bloco && onMover) onMover(bloco, comoHora(minutos));
  };

  // Faixas de 15 min que recebem o bloco arrastado. Ficam atrás de tudo, e só
  // à direita da régua, para não virar alvo de soltura em cima dos horários.
  const faixas: number[] = [];
  if (onMover) {
    for (let m = primeira * 60; m < ultima * 60; m += PASSO_MINUTOS) faixas.push(m);
  }

  return (
    <div ref={containerRef} className="relative" style={{ height: altura }}>
      {faixas.map((minutos) => (
        <div
          key={minutos}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => soltar(e, minutos)}
          className="absolute right-0 z-0 rounded-sm hover:bg-[var(--brand-accent-soft)]"
          style={{
            top: (minutos - primeira * 60) * PX_POR_MINUTO,
            height: PASSO_MINUTOS * PX_POR_MINUTO,
            left: LARGURA_REGUA,
          }}
        />
      ))}

      {horas.map((hora) => (
        <div
          key={hora}
          className="pointer-events-none absolute left-0 right-0 border-t border-border/60"
          style={{ top: (hora - primeira) * PX_POR_HORA }}
        >
          <span className="absolute -top-2 left-0 text-[11px] font-bold tabular-nums text-muted-foreground">
            {String(hora).padStart(2, "0")}
          </span>
        </div>
      ))}

      {posicionados.map(({ bloco, topo, altura: alturaBloco, coluna, colunas }) => {
        const aberto = abertoId === bloco.id;
        const doGoogle = bloco.tipo === "google";
        const perdido = naoExecutado(bloco, agora);
        const largura = `calc((100% - ${LARGURA_REGUA}px) / ${colunas} - 4px)`;
        const esquerda = `calc(${LARGURA_REGUA}px + (100% - ${LARGURA_REGUA}px) * ${coluna} / ${colunas})`;

        const estilo = {
          top: topo,
          left: esquerda,
          width: largura,
          ...(aberto ? { minHeight: alturaBloco } : { height: alturaBloco }),
          ...(doGoogle ? { backgroundImage: HACHURA } : {}),
        } as const;

        const classes = [
          "absolute rounded-lg border px-2.5 py-1.5 text-left transition-shadow",
          aberto ? "z-20 shadow-lg" : "z-10 overflow-hidden",
          doGoogle
            ? "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground"
            : bloco.concluido
              ? "bg-muted text-muted-foreground"
              : perdido
                ? "border-[var(--color-amber)]/60 bg-[var(--color-amber-bg)]"
                : "bg-card",
          aberto && !doGoogle ? "border-[var(--brand-accent)]" : "",
        ].join(" ");

        // Bloco do Google não tem ação nenhuma, então não é botão.
        if (doGoogle) {
          return (
            <div key={bloco.id} className={classes} style={estilo}>
              {renderBloco(bloco, { aberto: false })}
            </div>
          );
        }

        const arrastavel = Boolean(onMover);
        const aoArrastar = (e: React.DragEvent) =>
          e.dataTransfer.setData("text/plain", bloco.id);

        // Aberto vira container: dentro há botões de verdade, e botão
        // dentro de botão é inválido.
        if (aberto) {
          return (
            <div
              key={bloco.id}
              className={classes}
              style={estilo}
              draggable={arrastavel}
              onDragStart={aoArrastar}
            >
              {renderBloco(bloco, { aberto: true })}
            </div>
          );
        }

        return (
          <button
            key={bloco.id}
            type="button"
            className={`${classes} w-full ${arrastavel ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={estilo}
            draggable={arrastavel}
            onDragStart={aoArrastar}
            onMouseEnter={podeHover ? () => onAbrir(bloco.id) : undefined}
            onClick={() => onAbrir(bloco.id)}
          >
            {renderBloco(bloco, { aberto: false })}
          </button>
        );
      })}

      {agoraVisivel && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-30"
          style={{ top: topoAgora }}
        >
          <div className="h-0.5 bg-[var(--color-red)]" />
          <div className="absolute -top-[5px] left-0 h-3 w-3 rounded-full bg-[var(--color-red)]" />
        </div>
      )}
    </div>
  );
}
