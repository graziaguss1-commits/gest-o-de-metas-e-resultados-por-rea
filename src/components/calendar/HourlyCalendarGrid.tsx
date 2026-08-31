import type { CSSProperties } from "react";
import { Check, Loader2, MoreHorizontal } from "lucide-react";
import type { Agendamento } from "@/lib/agenda";
import type { Compromisso } from "@/hooks/useCompromissos";
import type { ActionItem } from "@/hooks/useActions";
import type { Tarefa } from "@/lib/metas";
import { formatDuracao, hhmm, horaFim } from "@/lib/agenda";
import { TaskTimerButton } from "@/components/calendar/TaskTimerButton";
import type { GoogleBusyBlock } from "@/hooks/useGoogleCalendar";

const START = 6;
const END = 22;
const SLOT = 30;
const SLOT_HEIGHT = 44;
const MIN_EVENT_HEIGHT = 34;
const EVENT_GAP = 4;
const slots = Array.from(
  { length: (END - START) * 2 },
  (_, i) => START * 60 + i * SLOT,
);
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const minutesOf = (value: string) => {
  const [h, m] = hhmm(value).split(":").map(Number);
  return h * 60 + m;
};

type LayoutSeed = {
  key: string;
  top: number;
  height: number;
};

type EventLayout = LayoutSeed & {
  lane: number;
  laneCount: number;
};

/**
 * Blocos muito curtos precisam de uma altura mínima para continuarem
 * clicáveis. Quando essa altura visual invade o próximo horário, distribuímos
 * os itens em colunas para que nenhum título fique escondido atrás de outro.
 */
function calcularLayouts(seeds: LayoutSeed[]) {
  const layouts = new Map<string, EventLayout>();
  const ordenados = [...seeds].sort(
    (a, b) => a.top - b.top || b.height - a.height || a.key.localeCompare(b.key),
  );
  let cluster: LayoutSeed[] = [];
  let fimDoCluster = Number.NEGATIVE_INFINITY;

  const distribuirCluster = () => {
    if (!cluster.length) return;
    const fimPorColuna: number[] = [];
    const atribuicoes = cluster.map((item) => {
      let lane = fimPorColuna.findIndex((fim) => fim <= item.top + 0.5);
      if (lane < 0) lane = fimPorColuna.length;
      fimPorColuna[lane] = item.top + item.height;
      return { item, lane };
    });
    const laneCount = Math.max(1, fimPorColuna.length);
    atribuicoes.forEach(({ item, lane }) =>
      layouts.set(item.key, { ...item, lane, laneCount }),
    );
  };

  ordenados.forEach((item) => {
    if (cluster.length && item.top >= fimDoCluster - 0.5) {
      distribuirCluster();
      cluster = [];
      fimDoCluster = Number.NEGATIVE_INFINITY;
    }
    cluster.push(item);
    fimDoCluster = Math.max(fimDoCluster, item.top + item.height);
  });
  distribuirCluster();
  return layouts;
}

const estiloDoLayout = (layout: EventLayout): CSSProperties => {
  const largura = 100 / layout.laneCount;
  return {
    top: layout.top,
    height: layout.height,
    left: `calc(${layout.lane * largura}% + ${EVENT_GAP}px)`,
    width: `calc(${largura}% - ${EVENT_GAP * 2}px)`,
  };
};

type DragData = {
  kind: "acao" | "acao-avulsa" | "compromisso";
  id: string;
};

type Props = {
  days: Date[];
  agendamentos: Agendamento[];
  acoesAvulsas: ActionItem[];
  compromissos: Compromisso[];
  googleBusy?: GoogleBusyBlock[];
  taskById: Map<string, Tarefa & { area?: string; meta?: string | null }>;
  completedActionIds: Set<string>;
  realMinutesByActionId: Map<string, number | null>;
  completingActionId: string | null;
  timerPendingId: string | null;
  onMoveAction: (id: string, data: string, hora: string) => void;
  onMoveStandaloneAction: (id: string, data: string, hora: string) => void;
  onMoveCommitment: (id: string, data: string, hora: string) => void;
  onOpenAction: (id: string) => void;
  onOpenStandaloneAction: (id: string) => void;
  onOpenCommitment: (id: string) => void;
  onOpenDay: (data: string) => void;
  onMarkActionDone: (id: string) => void;
  onToggleTimer: (agendamento: Agendamento) => void;
  onToggleStandaloneAction: (id: string, concluida: boolean) => void;
  onToggleCommitment: (id: string, concluido: boolean) => void;
};

export function HourlyCalendarGrid({
  days,
  agendamentos,
  acoesAvulsas,
  compromissos,
  googleBusy = [],
  taskById,
  completedActionIds,
  realMinutesByActionId,
  completingActionId,
  timerPendingId,
  onMoveAction,
  onMoveStandaloneAction,
  onMoveCommitment,
  onOpenAction,
  onOpenStandaloneAction,
  onOpenCommitment,
  onOpenDay,
  onMarkActionDone,
  onToggleTimer,
  onToggleStandaloneAction,
  onToggleCommitment,
}: Props) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const drag = (event: React.DragEvent, data: DragData) =>
    event.dataTransfer.setData("application/json", JSON.stringify(data));
  const drop = (event: React.DragEvent, data: string, hora: string) => {
    event.preventDefault();
    try {
      const dragged = JSON.parse(
        event.dataTransfer.getData("application/json"),
      ) as DragData;
      if (dragged.kind === "acao") onMoveAction(dragged.id, data, hora);
      else if (dragged.kind === "acao-avulsa") {
        onMoveStandaloneAction(dragged.id, data, hora);
      } else {
        onMoveCommitment(dragged.id, data, hora);
      }
    } catch {
      // Arrastes externos são ignorados.
    }
  };
  const openWithKeyboard = (event: React.KeyboardEvent, onOpen: () => void) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen();
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div
        className={`grid ${days.length <= 3 ? "min-w-[760px]" : "min-w-[1050px]"}`}
        style={{
          gridTemplateColumns: `64px repeat(${days.length}, minmax(${days.length <= 3 ? "220px" : "135px"}, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-20 border-b border-r bg-card" />
        {days.map((day) => (
          <button
            key={iso(day)}
            onClick={() => onOpenDay(iso(day))}
            className="border-b border-r bg-card p-2 text-center hover:bg-muted"
          >
            <div className="text-[10px] font-bold uppercase text-muted-foreground">
              {day.toLocaleDateString("pt-BR", { weekday: "short" })}
            </div>
            <div className="font-display text-xl font-semibold">
              {day.getDate()}
            </div>
          </button>
        ))}

        <div className="sticky left-0 z-20 border-r bg-card">
          {slots.map((minutes) => (
            <div
              key={minutes}
              className="border-b pr-2 pt-1 text-right text-[10px] text-muted-foreground"
              style={{ height: SLOT_HEIGHT }}
            >
              {minutes % 60 === 0 ? time(minutes) : ""}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const data = iso(day);
          const tasks = agendamentos.filter((item) => item.data === data);
          const standalone = acoesAvulsas.filter(
            (item) =>
              item.data_agendada === data &&
              item.hora_inicio &&
              item.duracao_minutos,
          );
          const fixed = compromissos.filter((item) => item.data === data);
          const google = googleBusy.filter((item) => item.data === data);
          const criarSeed = (
            key: string,
            inicio: string,
            duracaoMinutos: number,
          ): LayoutSeed => ({
            key,
            top:
              ((minutesOf(inicio) - START * 60) / SLOT) * SLOT_HEIGHT,
            height: Math.max(
              MIN_EVENT_HEIGHT,
              (Math.max(1, duracaoMinutos) / SLOT) * SLOT_HEIGHT,
            ),
          });
          const layouts = calcularLayouts([
            ...tasks.map((item) =>
              criarSeed(
                `plano:${item.id}`,
                item.hora_inicio,
                item.duracao_minutos,
              ),
            ),
            ...standalone.map((item) =>
              criarSeed(
                `avulsa:${item.id}`,
                item.hora_inicio as string,
                item.duracao_minutos as number,
              ),
            ),
            ...fixed.map((item) =>
              criarSeed(
                `compromisso:${item.id}`,
                item.hora_inicio,
                minutesOf(item.hora_fim) - minutesOf(item.hora_inicio),
              ),
            ),
            ...google.map((item) =>
              criarSeed(
                `google:${item.id}`,
                item.hora_inicio,
                minutesOf(item.hora_fim) - minutesOf(item.hora_inicio),
              ),
            ),
          ]);

          return (
            <div
              key={data}
              className="relative border-r"
              style={{ height: slots.length * SLOT_HEIGHT }}
            >
              {slots.map((minutes) => (
                <div
                  key={minutes}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => drop(event, data, time(minutes))}
                  className="border-b border-dashed hover:bg-[var(--brand-accent-soft)]"
                  style={{ height: SLOT_HEIGHT }}
                />
              ))}

              {tasks.map((item) => {
                const task = taskById.get(item.tarefa_id);
                if (!task) return null;
                const completed = completedActionIds.has(item.id);
                const realMinutes = realMinutesByActionId.get(item.id) ?? null;
                const completing = completingActionId === item.id;
                const layout = layouts.get(`plano:${item.id}`)!;
                const compacto = item.duracao_minutos < 30;
                const mostrarTextoAcoes =
                  days.length <= 3 && !compacto && layout.laneCount === 1;
                const paddingAcoes = mostrarTextoAcoes
                  ? completed
                    ? "pr-32"
                    : "pr-[250px]"
                  : completed
                    ? "pr-12"
                    : "pr-[72px]";
                const inicio = hhmm(item.hora_inicio);
                const fim = horaFim(inicio, item.duracao_minutos);
                return (
                  <div
                    draggable
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenAction(item.id)}
                    onKeyDown={(event) =>
                      openWithKeyboard(event, () => onOpenAction(item.id))
                    }
                    onDragStart={(event) =>
                      drag(event, { kind: "acao", id: item.id })
                    }
                    key={item.id}
                    className={`absolute z-10 cursor-pointer overflow-hidden rounded-lg border shadow-sm active:cursor-grabbing ${compacto ? "px-1.5 py-1" : "p-2"} ${completed ? "border-[var(--color-green)]/40 bg-[var(--color-green-bg)]" : "border-[var(--brand-primary)]/30 bg-[var(--brand-primary-soft)]"} ${paddingAcoes}`}
                    style={estiloDoLayout(layout)}
                    title={`${inicio}–${fim} · ${task.descricao}. Clique para editar ou excluir; arraste para reagendar.`}
                  >
                    <div
                      className={`absolute right-6 flex items-center gap-1 ${compacto ? "top-1/2 -translate-y-1/2" : "top-1"}`}
                    >
                      {!completed && (
                        <TaskTimerButton
                          agendamento={item}
                          pending={timerPendingId === item.id || completing}
                          showLabel={mostrarTextoAcoes}
                          showElapsed={mostrarTextoAcoes}
                          className={
                            mostrarTextoAcoes
                              ? undefined
                              : "h-5 w-5 justify-center px-0"
                          }
                          onToggle={onToggleTimer}
                        />
                      )}
                      <button
                        type="button"
                        draggable={false}
                        disabled={
                          completed || completing || timerPendingId === item.id
                        }
                        aria-label={
                          completed ? "Execução concluída" : "Finalizar tarefa"
                        }
                        title={
                          completed ? "Execução concluída" : "Finalizar tarefa"
                        }
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onMarkActionDone(item.id);
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        className={`flex items-center justify-center gap-1 rounded-full border text-[9px] font-semibold ${mostrarTextoAcoes ? "h-6 px-1.5" : "h-5 w-5 px-0"} ${completed ? "border-[var(--color-green)]/40 bg-white/70 text-[var(--color-green)]" : "border-border bg-card/90 text-foreground hover:border-[var(--color-green)]"}`}
                      >
                        {completing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {mostrarTextoAcoes && (
                          <span>
                            {completed
                              ? `Feito${realMinutes ? ` · ${formatDuracao(realMinutes)}` : ""}`
                              : item.cronometro_iniciado_em ||
                                  Number(item.cronometro_segundos ?? 0) > 0
                                ? "Finalizar"
                                : "Marcar feito"}
                          </span>
                        )}
                      </button>
                    </div>
                    <MoreHorizontal
                      className={`absolute right-1.5 h-3.5 w-3.5 text-muted-foreground ${compacto ? "top-1/2 -translate-y-1/2" : "top-1.5"}`}
                    />
                    {compacto ? (
                      <div className="flex h-full min-w-0 items-center gap-1.5 leading-none">
                        <span className="shrink-0 text-[9px] font-bold text-[var(--brand-primary)]">
                          {inicio}
                        </span>
                        <span
                          className={`truncate text-[11px] font-semibold ${completed ? "line-through opacity-70" : ""}`}
                        >
                          {task.descricao}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="text-[10px] font-bold text-[var(--brand-primary)]">
                          {inicio}–{fim}
                        </div>
                        <div
                          className={`line-clamp-2 text-xs font-semibold ${completed ? "line-through opacity-70" : ""}`}
                        >
                          {task.descricao}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {standalone.map((action) => {
                const start = action.hora_inicio as string;
                const duration = action.duracao_minutos as number;
                const layout = layouts.get(`avulsa:${action.id}`)!;
                const compacto = duration < 30;
                const mostrarTextoAcoes =
                  days.length <= 3 && !compacto && layout.laneCount === 1;
                const inicio = hhmm(start);
                const fim = horaFim(inicio, duration);
                return (
                  <div
                    draggable
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenStandaloneAction(action.id)}
                    onKeyDown={(event) =>
                      openWithKeyboard(event, () =>
                        onOpenStandaloneAction(action.id),
                      )
                    }
                    onDragStart={(event) =>
                      drag(event, { kind: "acao-avulsa", id: action.id })
                    }
                    key={action.id}
                    className={`absolute z-10 cursor-pointer overflow-hidden rounded-lg border border-[var(--color-green)]/35 bg-[var(--color-green-bg)] shadow-sm active:cursor-grabbing ${compacto ? "px-1.5 py-1" : "p-2"} ${mostrarTextoAcoes ? "pr-24" : "pr-12"} ${action.concluida ? "opacity-60" : ""}`}
                    style={estiloDoLayout(layout)}
                    title={`${inicio}–${fim} · ${action.descricao}. Clique para editar ou excluir; arraste para reagendar.`}
                  >
                    <button
                      type="button"
                      draggable={false}
                      aria-label={
                        action.concluida ? "Reabrir ação" : "Marcar como feito"
                      }
                      title={
                        action.concluida ? "Reabrir ação" : "Marcar como feito"
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleStandaloneAction(action.id, !action.concluida);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      className={`absolute right-6 flex items-center justify-center gap-1 rounded-full border border-[var(--color-green)]/40 bg-card/90 text-[9px] font-semibold text-[var(--color-green)] ${compacto ? "top-1/2 h-5 w-5 -translate-y-1/2 px-0" : "top-1 h-6 px-1.5"}`}
                    >
                      <Check className="h-3 w-3" />
                      {mostrarTextoAcoes && (
                        <span>{action.concluida ? "Feito" : "Marcar feito"}</span>
                      )}
                    </button>
                    <MoreHorizontal
                      className={`absolute right-1.5 h-3.5 w-3.5 text-muted-foreground ${compacto ? "top-1/2 -translate-y-1/2" : "top-1.5"}`}
                    />
                    {compacto ? (
                      <div className="flex h-full min-w-0 items-center gap-1.5 leading-none">
                        <span className="shrink-0 text-[9px] font-bold text-[var(--color-green)]">
                          {inicio}
                        </span>
                        <span
                          className={`truncate text-[11px] font-semibold ${action.concluida ? "line-through" : ""}`}
                        >
                          {action.descricao}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="text-[10px] font-bold text-[var(--color-green)]">
                          {inicio}–{fim}
                        </div>
                        <div
                          className={`line-clamp-2 text-xs font-semibold ${action.concluida ? "line-through" : ""}`}
                        >
                          {action.descricao}
                        </div>
                        <div className="text-[9px] uppercase text-muted-foreground">
                          Prioridade avulsa
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {fixed.map((commitment) => {
                const start = minutesOf(commitment.hora_inicio);
                const end = minutesOf(commitment.hora_fim);
                const duration = Math.max(1, end - start);
                const layout = layouts.get(`compromisso:${commitment.id}`)!;
                const compacto = duration < 30;
                const mostrarTextoAcoes =
                  commitment.recorrencia === "nenhuma" &&
                  days.length <= 3 &&
                  !compacto &&
                  layout.laneCount === 1;
                const inicio = hhmm(commitment.hora_inicio);
                const fim = hhmm(commitment.hora_fim);
                return (
                  <div
                    draggable
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenCommitment(commitment.id)}
                    onKeyDown={(event) =>
                      openWithKeyboard(event, () =>
                        onOpenCommitment(commitment.id),
                      )
                    }
                    onDragStart={(event) =>
                      drag(event, { kind: "compromisso", id: commitment.id })
                    }
                    key={commitment.id}
                    className={`absolute z-10 cursor-pointer overflow-hidden rounded-lg border border-[var(--brand-accent)]/40 bg-[var(--brand-accent-soft)] shadow-sm active:cursor-grabbing ${compacto ? "px-1.5 py-1" : "p-2"} ${mostrarTextoAcoes ? "pr-24" : commitment.recorrencia === "nenhuma" ? "pr-12" : "pr-6"} ${commitment.concluido ? "opacity-60" : ""}`}
                    style={estiloDoLayout(layout)}
                    title={`${inicio}–${fim} · ${commitment.titulo}. Clique para excluir; arraste para reagendar.`}
                  >
                    {commitment.recorrencia === "nenhuma" && (
                      <button
                        type="button"
                        draggable={false}
                        aria-label={
                          commitment.concluido
                            ? "Reabrir compromisso"
                            : "Marcar como feito"
                        }
                        title={
                          commitment.concluido
                            ? "Reabrir compromisso"
                            : "Marcar como feito"
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleCommitment(
                            commitment.id,
                            !commitment.concluido,
                          );
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        className={`absolute right-6 flex items-center justify-center gap-1 rounded-full border border-[var(--brand-accent)]/40 bg-card/90 text-[9px] font-semibold text-[var(--brand-accent)] ${compacto ? "top-1/2 h-5 w-5 -translate-y-1/2 px-0" : "top-1 h-6 px-1.5"}`}
                      >
                        <Check className="h-3 w-3" />
                        {mostrarTextoAcoes && (
                          <span>
                            {commitment.concluido ? "Feito" : "Marcar feito"}
                          </span>
                        )}
                      </button>
                    )}
                    <MoreHorizontal
                      className={`absolute right-1.5 h-3.5 w-3.5 text-muted-foreground ${compacto ? "top-1/2 -translate-y-1/2" : "top-1.5"}`}
                    />
                    {compacto ? (
                      <div className="flex h-full min-w-0 items-center gap-1.5 leading-none">
                        <span className="shrink-0 text-[9px] font-bold text-[var(--brand-accent)]">
                          {inicio}
                        </span>
                        <span
                          className={`truncate text-[11px] font-semibold ${commitment.concluido ? "line-through" : ""}`}
                        >
                          {commitment.titulo}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="text-[10px] font-bold text-[var(--brand-accent)]">
                          {inicio}–{fim}
                        </div>
                        <div
                          className={`line-clamp-2 text-xs font-semibold ${commitment.concluido ? "line-through" : ""}`}
                        >
                          {commitment.titulo}
                        </div>
                        <div className="text-[9px] uppercase text-muted-foreground">
                          {commitment.area}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {google.map((block) => {
                const layout = layouts.get(`google:${block.id}`)!;
                const inicio = hhmm(block.hora_inicio);
                const fim = hhmm(block.hora_fim);
                return (
                  <div
                    key={block.id}
                    aria-hidden="true"
                    className="absolute z-[5] overflow-hidden rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50 px-1.5 py-1"
                    style={estiloDoLayout(layout)}
                    title={`${inicio}–${fim} · Ocupado no Google Agenda (horário reservado)`}
                  >
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {inicio}–{fim} · Google
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="border-t p-2 text-center text-[10px] text-muted-foreground">
        Inicie o cronômetro ao começar, pause quando necessário e finalize para
        registrar o tempo real. Também é possível arrastar o bloco para outro
        horário.
      </div>
    </div>
  );
}
