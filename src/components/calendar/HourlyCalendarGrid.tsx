import type { Agendamento } from "@/lib/agenda";
import type { Compromisso } from "@/hooks/useCompromissos";
import type { ActionItem } from "@/hooks/useActions";
import type { Tarefa } from "@/lib/metas";
import { hhmm, horaFim } from "@/lib/agenda";

const START = 6;
const END = 22;
const SLOT = 30;
const SLOT_HEIGHT = 44;
const slots = Array.from({ length: (END - START) * 2 }, (_, i) => START * 60 + i * SLOT);
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const minutesOf = (value: string) => {
  const [h, m] = hhmm(value).split(":").map(Number);
  return h * 60 + m;
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
  taskById: Map<string, Tarefa & { area?: string; meta?: string | null }>;
  onMoveAction: (id: string, data: string, hora: string) => void;
  onMoveStandaloneAction: (id: string, data: string, hora: string) => void;
  onMoveCommitment: (id: string, data: string, hora: string) => void;
  onOpenDay: (data: string) => void;
};

export function HourlyCalendarGrid({
  days,
  agendamentos,
  acoesAvulsas,
  compromissos,
  taskById,
  onMoveAction,
  onMoveStandaloneAction,
  onMoveCommitment,
  onOpenDay,
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

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div
        className="grid min-w-[1050px]"
        style={{ gridTemplateColumns: "64px repeat(7,minmax(135px,1fr))" }}
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
            <div className="font-display text-xl font-semibold">{day.getDate()}</div>
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
                const top =
                  ((minutesOf(item.hora_inicio) - START * 60) / SLOT) * SLOT_HEIGHT;
                const height = Math.max(
                  34,
                  (item.duracao_minutos / SLOT) * SLOT_HEIGHT,
                );
                return (
                  <div
                    draggable
                    onDragStart={(event) =>
                      drag(event, { kind: "acao", id: item.id })
                    }
                    key={item.id}
                    className="absolute left-1 right-1 z-10 cursor-grab overflow-hidden rounded-lg border border-[var(--brand-primary)]/30 bg-[var(--brand-primary-soft)] p-2 shadow-sm active:cursor-grabbing"
                    style={{ top, height }}
                  >
                    <div className="text-[10px] font-bold text-[var(--brand-primary)]">
                      {hhmm(item.hora_inicio)}–
                      {horaFim(hhmm(item.hora_inicio), item.duracao_minutos)}
                    </div>
                    <div className="line-clamp-2 text-xs font-semibold">
                      {task.descricao}
                    </div>
                  </div>
                );
              })}

              {standalone.map((action) => {
                const start = action.hora_inicio as string;
                const duration = action.duracao_minutos as number;
                const top =
                  ((minutesOf(start) - START * 60) / SLOT) * SLOT_HEIGHT;
                const height = Math.max(34, (duration / SLOT) * SLOT_HEIGHT);
                return (
                  <div
                    draggable
                    onDragStart={(event) =>
                      drag(event, { kind: "acao-avulsa", id: action.id })
                    }
                    key={action.id}
                    className={`absolute left-1 right-1 z-10 cursor-grab overflow-hidden rounded-lg border border-[var(--color-green)]/35 bg-[var(--color-green-bg)] p-2 shadow-sm active:cursor-grabbing ${action.concluida ? "opacity-60" : ""}`}
                    style={{ top, height }}
                  >
                    <div className="text-[10px] font-bold text-[var(--color-green)]">
                      {hhmm(start)}–{horaFim(hhmm(start), duration)}
                    </div>
                    <div
                      className={`line-clamp-2 text-xs font-semibold ${action.concluida ? "line-through" : ""}`}
                    >
                      {action.descricao}
                    </div>
                    <div className="text-[9px] uppercase text-muted-foreground">
                      Prioridade avulsa
                    </div>
                  </div>
                );
              })}

              {fixed.map((commitment) => {
                const start = minutesOf(commitment.hora_inicio);
                const end = minutesOf(commitment.hora_fim);
                const top = ((start - START * 60) / SLOT) * SLOT_HEIGHT;
                const height = Math.max(34, ((end - start) / SLOT) * SLOT_HEIGHT);
                return (
                  <div
                    draggable
                    onDragStart={(event) =>
                      drag(event, { kind: "compromisso", id: commitment.id })
                    }
                    key={commitment.id}
                    className="absolute left-1 right-1 z-10 cursor-grab overflow-hidden rounded-lg border border-[var(--brand-accent)]/40 bg-[var(--brand-accent-soft)] p-2 shadow-sm active:cursor-grabbing"
                    style={{ top, height }}
                  >
                    <div className="text-[10px] font-bold text-[var(--brand-accent)]">
                      {hhmm(commitment.hora_inicio)}–{hhmm(commitment.hora_fim)}
                    </div>
                    <div className="line-clamp-2 text-xs font-semibold">
                      {commitment.titulo}
                    </div>
                    <div className="text-[9px] uppercase text-muted-foreground">
                      {commitment.area}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="border-t p-2 text-center text-[10px] text-muted-foreground">
        Arraste um bloco para outro dia ou horário. Cada linha representa 30 minutos.
      </div>
    </div>
  );
}
