import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BlocoAgendaDia } from "@/hooks/useAgendaDoDia";
import { horarioEmMinutos } from "@/lib/agenda";
import {
  ALTURA_MINIMA,
  PASSO_ARRASTE,
  PX_POR_HORA,
  PX_POR_MINUTO,
  faixaHoras,
  minutosDestino,
  minutosDoDia,
  posicionarBlocos,
} from "@/lib/grade";
import { coresDoBloco } from "@/lib/coresArea";
import { naoExecutado } from "@/lib/motivos";

/** Hachura dos horários ocupados vindos do Google. */
const HACHURA =
  "repeating-linear-gradient(135deg, var(--muted-bg,hsl(var(--muted))) 0px, var(--muted-bg,hsl(var(--muted))) 6px, transparent 6px, transparent 12px)";

const LARGURA_REGUA = 44;

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
  const [arrastando, setArrastando] = useState<{
    id: string;
    /** Distância do topo do bloco até o ponto onde ele foi segurado. */
    offsetY: number;
    duracao: number;
    minutos: number;
  } | null>(null);
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

  const alvoDoArraste = (e: React.DragEvent, offsetY: number, duracao: number) => {
    const caixa = containerRef.current?.getBoundingClientRect();
    if (!caixa) return null;
    return minutosDestino({
      yCursor: e.clientY - caixa.top,
      offsetY,
      primeiraHora: primeira,
      ultimaHora: ultima,
      duracaoMinutos: duracao,
    });
  };

  const aoPassarArrastando = (e: React.DragEvent) => {
    if (!arrastando) return;
    e.preventDefault();
    const minutos = alvoDoArraste(e, arrastando.offsetY, arrastando.duracao);
    if (minutos != null && minutos !== arrastando.minutos) {
      setArrastando({ ...arrastando, minutos });
    }
  };

  const aoSoltar = (e: React.DragEvent) => {
    if (!arrastando || !onMover) return;
    e.preventDefault();
    const minutos = alvoDoArraste(e, arrastando.offsetY, arrastando.duracao);
    const bloco = blocos.find((b) => b.id === arrastando.id);
    if (bloco && minutos != null) onMover(bloco, comoHora(minutos));
    setArrastando(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: altura }}
      onDragOver={aoPassarArrastando}
      onDrop={aoSoltar}
    >
      {arrastando && (
        <div
          className="pointer-events-none absolute right-0 z-40 rounded-md border-2 border-dashed border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]/50"
          style={{
            top: (arrastando.minutos - primeira * 60) * PX_POR_MINUTO,
            height: Math.max(ALTURA_MINIMA, arrastando.duracao * PX_POR_MINUTO),
            left: LARGURA_REGUA,
          }}
        >
          <span className="absolute -top-2 left-1 rounded bg-[var(--brand-accent)] px-1.5 text-[10px] font-bold tabular-nums text-white">
            {comoHora(arrastando.minutos)}
          </span>
        </div>
      )}

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

        // A área da meta dá a cor; concluído é a mesma cor, mais clara.
        // Bloco não cumprido mantém o âmbar: é um estado que precisa saltar,
        // e a cor da área não pode esconder isso.
        const cores = coresDoBloco(bloco.area, Boolean(bloco.concluido));
        const pintar = !doGoogle && !perdido;

        const estilo = {
          top: topo,
          left: esquerda,
          width: largura,
          ...(aberto ? { minHeight: alturaBloco } : { height: alturaBloco }),
          ...(doGoogle ? { backgroundImage: HACHURA } : {}),
          ...(pintar
            ? {
                background: cores.fundo,
                borderColor: aberto ? "var(--brand-accent)" : cores.borda,
                color: cores.texto,
              }
            : {}),
        } as const;

        const classes = [
          "absolute rounded-lg border px-2.5 py-1.5 text-left transition-shadow",
          aberto ? "z-20 shadow-lg" : "z-10 overflow-hidden",
          doGoogle
            ? "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground"
            : perdido
              ? "border-[var(--color-amber)]/60 bg-[var(--color-amber-bg)]"
              : "",
          aberto && !doGoogle && !pintar ? "border-[var(--brand-accent)]" : "",
        ].join(" ");

        // Bloco do Google não tem ação nenhuma, então não é botão.
        if (doGoogle) {
          return (
            <div key={bloco.id} className={classes} style={estilo}>
              {renderBloco(bloco, { aberto: false })}
            </div>
          );
        }

        const arrastavel = Boolean(onMover) && !doGoogle;
        const duracao = Math.max(
          PASSO_ARRASTE,
          horarioEmMinutos(bloco.fim) - horarioEmMinutos(bloco.inicio),
        );
        const aoArrastar = (e: React.DragEvent) => {
          e.dataTransfer.setData("text/plain", bloco.id);
          e.dataTransfer.effectAllowed = "move";
          // Fecha o bloco: aberto, ele cresce e encobre a faixa de destino.
          onAbrir(null);
          setArrastando({
            id: bloco.id,
            offsetY: e.nativeEvent.offsetY,
            duracao,
            minutos: horarioEmMinutos(bloco.inicio),
          });
        };
        const aoTerminarArraste = () => setArrastando(null);

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
              onDragEnd={aoTerminarArraste}
            >
              {renderBloco(bloco, { aberto: true })}
            </div>
          );
        }

        return (
          <button
            key={bloco.id}
            type="button"
            className={`${classes} w-full ${arrastavel ? "cursor-grab active:cursor-grabbing" : ""} ${arrastando?.id === bloco.id ? "opacity-40" : ""}`}
            style={estilo}
            draggable={arrastavel}
            onDragStart={aoArrastar}
            onDragEnd={aoTerminarArraste}
            // Durante o arraste o hover não abre nada: abrir faria o bloco
            // crescer no meio do movimento.
            onMouseEnter={podeHover && !arrastando ? () => onAbrir(bloco.id) : undefined}
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
