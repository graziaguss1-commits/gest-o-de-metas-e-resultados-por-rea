import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  RotateCcw,
  Save,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePlanos } from "@/hooks/usePlanos";
import {
  actionQuadrant,
  actionScore,
  useActions,
  type ActionItem,
} from "@/hooks/useActions";
import {
  useAgendamentos,
  useMaterializarRecorrencias,
} from "@/hooks/useAgendamentos";
import { useAuth } from "@/hooks/useAuth";
import { AgendarAcaoAvulsaModal } from "@/components/actions/AgendarAcaoAvulsaModal";
import { AgendarAcaoModal } from "@/components/planos/AgendarAcaoModal";
import { CapacidadeSemana } from "@/components/planos/CapacidadeSemana";
import { RevisaoIndicadores } from "@/components/metas/RevisaoIndicadores";
import { formatDuracao, hhmm, type Agendamento } from "@/lib/agenda";
import type { Tarefa } from "@/lib/metas";
import { toast } from "sonner";

type PlanningState = {
  wins: string;
  pending: string;
  lesson: string;
  focus: string;
  priorityIds: string[];
  savedAt?: string;
};

type PlanningTaskBase = {
  id: string;
  descricao: string;
  prazo: string | null;
  concluida: boolean;
  plano: string;
  area: string;
  meta: string | null;
  impacto: number;
  esforco: number;
  priorityScore: number;
};

type PlanPlanningTask = Tarefa &
  PlanningTaskBase & {
    origem: "plano";
  };

type StandalonePlanningTask = PlanningTaskBase & {
  origem: "avulsa";
  data_agendada: string | null;
  hora_inicio: string | null;
  duracao_minutos: number | null;
  action: ActionItem;
};

type PlanningTask = PlanPlanningTask | StandalonePlanningTask;

const QUADRANT_STYLE: Record<string, { color: string; soft: string }> = {
  "Fazer primeiro": {
    color: "var(--color-green)",
    soft: "var(--color-green-bg)",
  },
  Planejar: {
    color: "var(--brand-navy)",
    soft: "var(--brand-navy-soft)",
  },
  Encaixar: {
    color: "var(--brand-accent)",
    soft: "var(--brand-accent-soft)",
  },
  Reavaliar: {
    color: "var(--color-red)",
    soft: "var(--color-red-bg)",
  },
};

const emptyState = (): PlanningState => ({
  wins: "",
  pending: "",
  lesson: "",
  focus: "",
  priorityIds: [],
});

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const mondayOf = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
  start.setHours(0, 0, 0, 0);
  return start;
};

/** No ritual de domingo, o alvo é a semana que começa no dia seguinte. */
const defaultPlanningWeek = (base = new Date()) => {
  const start = mondayOf(base);
  return base.getDay() === 0 ? addDays(start, 7) : start;
};

const planningStorageKey = (weekStart: string) =>
  `performance-week-${weekStart}`;

const legacyStorageKey = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now.getTime() - first.getTime()) / 86400000 + first.getDay() + 1) / 7,
  );
  return `performance-week-${now.getFullYear()}-${week}`;
};

function readPlanningState(...keys: Array<string | undefined>): PlanningState {
  for (const key of keys) {
    if (!key) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as
        | PlanningState
        | null;
      if (parsed) {
        return {
          ...emptyState(),
          ...parsed,
          priorityIds: Array.isArray(parsed.priorityIds)
            ? parsed.priorityIds
            : [],
        };
      }
    } catch {
      // Um planejamento local inválido não pode bloquear a semana.
    }
  }
  return emptyState();
}

const weekLabel = (start: Date, end: Date) =>
  `${start.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })} — ${end.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;

const scheduleLabel = (block: Agendamento) => {
  const date = new Date(`${block.data}T12:00:00`);
  const weekday = date
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
  return `${weekday} ${date.getDate()} · ${hhmm(block.hora_inicio)} · ${formatDuracao(block.duracao_minutos)}`;
};

export default function WeeklyPlanningPage() {
  const { data: planos } = usePlanos();
  const { data: actions } = useActions();
  const { user } = useAuth();
  const materializar = useMaterializarRecorrencias();

  const [step, setStep] = useState(1);
  const [weekStart, setWeekStart] = useState(() => defaultPlanningWeek());
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekDates = useMemo(() => weekDays.map(iso), [weekDays]);
  const weekStartISO = weekDates[0];
  const weekEndISO = weekDates[6];
  const defaultWeekISO = useMemo(() => iso(defaultPlanningWeek()), []);
  const [state, setState] = useState<PlanningState>(() =>
    readPlanningState(
      planningStorageKey(iso(defaultPlanningWeek())),
      legacyStorageKey(),
    ),
  );
  const [agendarAvulsa, setAgendarAvulsa] = useState<ActionItem | null>(null);
  const [agendarPlano, setAgendarPlano] = useState<{
    task: PlanPlanningTask;
    block?: Agendamento;
  } | null>(null);

  const { data: agendamentos = [] } = useAgendamentos(
    weekStartISO,
    weekEndISO,
  );

  useEffect(() => {
    setState(
      readPlanningState(
        planningStorageKey(weekStartISO),
        weekStartISO === defaultWeekISO ? legacyStorageKey() : undefined,
      ),
    );
    setStep(1);
  }, [weekStartISO, defaultWeekISO]);

  const ownPlanTasks = useMemo(
    () =>
      (planos ?? []).flatMap((plano) =>
        plano.tarefas.filter((task) => task.responsavel_id === user?.id),
      ),
    [planos, user?.id],
  );

  const tasks = useMemo<PlanningTask[]>(() => {
    const planned = (planos ?? []).flatMap((plano) =>
      plano.tarefas
        .filter(
          (task) => !task.concluida && task.responsavel_id === user?.id,
        )
        .map((task): PlanPlanningTask => {
          const impacto = Number(task.impacto ?? 5);
          const esforco = Number(task.esforco ?? 5);
          return {
            ...task,
            origem: "plano",
            plano: plano.titulo,
            area: plano.meta?.area ?? "Pessoal",
            meta: plano.meta?.nome ?? null,
            impacto,
            esforco,
            priorityScore: actionScore({ impacto, esforco }),
          };
        }),
    );

    const standalone = (actions ?? [])
      .filter((action) => !action.concluida)
      .map(
        (action): StandalonePlanningTask => ({
          id: action.id,
          descricao: action.descricao,
          prazo: action.prazo,
          concluida: action.concluida,
          origem: "avulsa",
          plano: "Ação avulsa",
          area: action.area,
          meta: null,
          impacto: Number(action.impacto),
          esforco: Number(action.esforco),
          priorityScore: actionScore(action),
          data_agendada: action.data_agendada,
          hora_inicio: action.hora_inicio,
          duracao_minutos: action.duracao_minutos,
          action,
        }),
      );

    return [...planned, ...standalone].sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"),
    );
  }, [planos, actions, user?.id]);

  const recurringTasks = useMemo(
    () => tasks.filter((task): task is PlanPlanningTask => task.origem === "plano"),
    [tasks],
  );
  const recurrenceSignature = recurringTasks
    .map(
      (task) =>
        `${task.id}:${task.frequencia}:${task.data_inicio}:${task.data_fim}:${task.horario_preferencial}:${task.duracao_minutos}:${(task.dias_semana ?? []).join(",")}`,
    )
    .join("|");

  useEffect(() => {
    if (!recurringTasks.length) return;
    materializar.mutate({ tarefas: recurringTasks, datas: weekDates });
    // A assinatura contém toda configuração que altera a recorrência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO, recurrenceSignature]);

  const selectedTasks = state.priorityIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is PlanningTask => Boolean(task));

  const blocksByTask = useMemo(() => {
    const map = new Map<string, Agendamento[]>();
    agendamentos.forEach((block) => {
      const current = map.get(block.tarefa_id) ?? [];
      current.push(block);
      map.set(block.tarefa_id, current);
    });
    map.forEach((blocks) =>
      blocks.sort(
        (a, b) =>
          a.data.localeCompare(b.data) ||
          a.hora_inicio.localeCompare(b.hora_inicio),
      ),
    );
    return map;
  }, [agendamentos]);

  const isScheduledInWeek = (task: PlanningTask) => {
    if (task.origem === "plano") {
      return (blocksByTask.get(task.id)?.length ?? 0) > 0;
    }
    return Boolean(
      task.data_agendada &&
        task.hora_inicio &&
        task.duracao_minutos &&
        task.data_agendada >= weekStartISO &&
        task.data_agendada <= weekEndISO,
    );
  };

  const prioritiesWithoutSchedule = selectedTasks.filter(
    (task) => !isScheduledInWeek(task),
  );

  const completed =
    ownPlanTasks.filter((task) => task.concluida).length +
    (actions ?? []).filter((action) => action.concluida).length;
  const all = ownPlanTasks.length + (actions ?? []).length;
  const execution = all ? Math.round((completed / all) * 100) : 0;

  const selectPriority = (id: string) => {
    if (!state.priorityIds.includes(id) && state.priorityIds.length >= 3) {
      toast.error("Escolha no máximo três prioridades para a semana.");
      return;
    }
    setState((current) => ({
      ...current,
      priorityIds: current.priorityIds.includes(id)
        ? current.priorityIds.filter((item) => item !== id)
        : [...current.priorityIds, id],
    }));
  };

  const save = () => {
    if (prioritiesWithoutSchedule.length > 0) {
      toast.error(
        "Defina dia, horário e duração de todas as prioridades antes de confirmar.",
      );
      return;
    }
    const next = { ...state, savedAt: new Date().toISOString() };
    localStorage.setItem(planningStorageKey(weekStartISO), JSON.stringify(next));
    setState(next);
    toast.success("Planejamento salvo e horários enviados ao calendário");
    setStep(4);
  };

  return (
    <AppShell>
      <div className="performance-page mx-auto max-w-5xl space-y-6">
        <header>
          <div className="eyebrow mb-2">RITUAL DE DOMINGO</div>
          <h1 className="font-display text-3xl font-semibold">
            Planejamento semanal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Priorize pelo impacto, proteja os horários e execute o que move o
            resultado.
          </p>
        </header>

        <WeekSelector
          start={weekDays[0]}
          end={weekDays[6]}
          onPrevious={() => setWeekStart((current) => addDays(current, -7))}
          onNext={() => setWeekStart((current) => addDays(current, 7))}
          onDefault={() => setWeekStart(defaultPlanningWeek())}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Execução atual" value={`${execution}%`} />
          <MiniMetric label="Ações concluídas" value={`${completed}/${all}`} />
          <MiniMetric
            label="Prioridades definidas"
            value={`${state.priorityIds.length}/3`}
          />
        </div>

        <div className="flex items-center overflow-x-auto rounded-xl border bg-card p-2">
          {["Revisar", "Priorizar", "Agendar", "Confirmar"].map(
            (label, index) => {
              const number = index + 1;
              const active = step === number;
              const done = step > number;
              return (
                <div key={label} className="flex flex-1 items-center">
                  <button
                    onClick={() => setStep(number)}
                    className={`flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                      active
                        ? "bg-[var(--brand-dark)] text-white"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                        done
                          ? "bg-[var(--color-green)] text-white"
                          : active
                            ? "bg-white/20"
                            : "bg-muted"
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : number}
                    </span>
                    {label}
                  </button>
                  {index < 3 && (
                    <ChevronRight className="mx-1 h-4 w-4 shrink-0 text-muted-foreground/40" />
                  )}
                </div>
              );
            },
          )}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Panel
              icon={<Target className="h-5 w-5" />}
              title="Revisão dos indicadores"
              subtitle="Resultado da meta, execução dos planos e prazo consumido — indicadores independentes."
            >
              <RevisaoIndicadores />
            </Panel>
            <Panel
              icon={<RotateCcw className="h-5 w-5" />}
              title="Revisão da semana"
              subtitle="Antes de acelerar, entenda o que aconteceu."
            >
              <Field
                label="Quais foram suas principais conquistas?"
                value={state.wins}
                onChange={(wins) => setState({ ...state, wins })}
                placeholder="Resultados, entregas e avanços..."
              />
              <Field
                label="O que ficou pendente e por quê?"
                value={state.pending}
                onChange={(pending) => setState({ ...state, pending })}
                placeholder="Pendências, bloqueios e decisões..."
              />
              <Field
                label="Qual foi o principal aprendizado?"
                value={state.lesson}
                onChange={(lesson) => setState({ ...state, lesson })}
                placeholder="O que você fará diferente na próxima semana?"
              />
            </Panel>
            <Next onClick={() => setStep(2)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Panel
              icon={<Target className="h-5 w-5" />}
              title="Matriz impacto × esforço"
              subtitle="O gráfico reúne ações dos seus planos e ações avulsas. Quanto mais acima e à esquerda, maior a prioridade."
            >
              {tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Crie ações e informe impacto e esforço para montar o ranking.
                </div>
              ) : (
                <ImpactMatrix
                  tasks={tasks}
                  selectedIds={state.priorityIds}
                  onToggle={selectPriority}
                />
              )}
            </Panel>

            <Panel
              icon={<Target className="h-5 w-5" />}
              title="Escolha três prioridades"
              subtitle="O ranking usa impacto × (11 − esforço). Selecione até três ações; na próxima etapa você definirá os horários."
            >
              <div className="grid gap-2 md:grid-cols-2">
                {tasks.map((task, index) => {
                  const selected = state.priorityIds.includes(task.id);
                  const quadrant = actionQuadrant(task);
                  const style = QUADRANT_STYLE[quadrant];
                  return (
                    <button
                      key={task.id}
                      onClick={() => selectPriority(task.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]"
                          : "bg-card hover:border-[var(--brand-primary)]/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                            selected
                              ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white"
                              : ""
                          }`}
                        >
                          {selected ? <Check className="h-3 w-3" /> : index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">
                            {task.descricao}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {task.area} · {task.plano}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                            <span className="rounded-full bg-muted px-2 py-1">
                              Impacto {task.impacto}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-1">
                              Esforço {task.esforco}
                            </span>
                            <span
                              className="rounded-full px-2 py-1"
                              style={{ color: style.color, background: style.soft }}
                            >
                              {quadrant}
                            </span>
                            <span className="text-muted-foreground">
                              Score {task.priorityScore}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
            <Next
              disabled={state.priorityIds.length === 0}
              onClick={() => setStep(3)}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Panel
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="Capacidade da agenda"
              subtitle={`Tempo planejado entre ${weekLabel(weekDays[0], weekDays[6])}.`}
            >
              <CapacidadeSemana inicioSemana={weekStartISO} />
            </Panel>

            <Panel
              icon={<CalendarClock className="h-5 w-5" />}
              title="Reserve os horários das prioridades"
              subtitle="A semana só pode ser confirmada quando cada prioridade tiver pelo menos um bloco no calendário."
            >
              <div className="space-y-3">
                {selectedTasks.map((task, index) => {
                  const scheduled = isScheduledInWeek(task);
                  const blocks =
                    task.origem === "plano"
                      ? blocksByTask.get(task.id) ?? []
                      : [];
                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl border p-4 ${
                        scheduled
                          ? "border-[var(--color-green)]/30 bg-[var(--color-green-bg)]/35"
                          : "border-[var(--brand-accent)]/40"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <span className="font-display text-lg text-[var(--brand-accent)]">
                            0{index + 1}
                          </span>
                          <div>
                            <div className="text-sm font-semibold">
                              {task.descricao}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {task.plano} · {actionQuadrant(task)}
                            </div>
                          </div>
                        </div>

                        {task.origem === "avulsa" && (
                          <Button
                            type="button"
                            size="sm"
                            variant={scheduled ? "outline" : "default"}
                            onClick={() => setAgendarAvulsa(task.action)}
                          >
                            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                            {scheduled ? "Alterar horário" : "Definir dia e horário"}
                          </Button>
                        )}

                        {task.origem === "plano" && blocks.length === 0 && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setAgendarPlano({ task })}
                          >
                            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                            Definir dia e horário
                          </Button>
                        )}
                      </div>

                      {task.origem === "avulsa" && scheduled && (
                        <div className="mt-3 rounded-lg bg-background/80 px-3 py-2 text-xs font-medium">
                          {new Date(`${task.data_agendada}T12:00:00`).toLocaleDateString(
                            "pt-BR",
                            { weekday: "short", day: "2-digit", month: "2-digit" },
                          )}{" "}
                          às {hhmm(task.hora_inicio)} · {formatDuracao(task.duracao_minutos)}
                        </div>
                      )}

                      {task.origem === "plano" && blocks.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {blocks.map((block) => (
                            <button
                              key={block.id}
                              type="button"
                              onClick={() => setAgendarPlano({ task, block })}
                              className="rounded-lg border bg-background/80 px-3 py-2 text-left text-xs font-medium transition hover:border-[var(--brand-accent)]"
                              title="Clique para ajustar este horário"
                            >
                              {scheduleLabel(block)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {prioritiesWithoutSchedule.length > 0 && (
                <div className="mt-4 rounded-lg border border-[var(--brand-accent)]/40 bg-[var(--brand-accent-soft)] p-3 text-xs text-[var(--brand-primary)]">
                  Faltam horários para {prioritiesWithoutSchedule.length}{" "}
                  {prioritiesWithoutSchedule.length === 1
                    ? "prioridade"
                    : "prioridades"}
                  . Defina os blocos acima para liberar a confirmação.
                </div>
              )}
            </Panel>

            <Panel
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="Defina a intenção da semana"
              subtitle="Uma frase clara para orientar suas decisões."
            >
              <Field
                label="Ao final desta semana, o que precisa estar diferente?"
                value={state.focus}
                onChange={(focus) => setState({ ...state, focus })}
                placeholder="Ex.: campanha publicada, módulo gravado e três treinos concluídos."
              />
            </Panel>

            <div className="flex justify-end">
              <Button
                onClick={save}
                className="brand-button"
                disabled={
                  !state.focus.trim() || prioritiesWithoutSchedule.length > 0
                }
              >
                <Save className="mr-2 h-4 w-4" />
                Confirmar planejamento
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="performance-card flex flex-col items-center p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-green-bg)] text-[var(--color-green)]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="font-display mt-4 text-2xl font-semibold">
              Semana planejada e agendada
            </h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Você definiu {selectedTasks.length} prioridades para {weekLabel(
                weekDays[0],
                weekDays[6],
              )} e todas possuem horário protegido no calendário.
            </p>
            <div className="mt-6 w-full max-w-xl rounded-xl bg-[var(--brand-light)] p-5 text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-accent)]">
                Foco da semana
              </div>
              <p className="mt-2 text-sm font-medium">{state.focus}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Revisar planejamento
              </Button>
              <Button asChild className="brand-button">
                <Link to={`/calendario?semana=${weekStartISO}`}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Abrir calendário desta semana
                </Link>
              </Button>
            </div>
          </div>
        )}

        <AgendarAcaoAvulsaModal
          open={!!agendarAvulsa}
          onOpenChange={(value) => !value && setAgendarAvulsa(null)}
          action={agendarAvulsa}
          dataInicial={weekStartISO}
          dataMin={weekStartISO}
          dataMax={weekEndISO}
        />
        <AgendarAcaoModal
          open={!!agendarPlano}
          onOpenChange={(value) => !value && setAgendarPlano(null)}
          tarefa={agendarPlano?.task ?? null}
          dataInicial={agendarPlano?.block?.data ?? weekStartISO}
          dataMin={weekStartISO}
          dataMax={weekEndISO}
          agendamentoId={agendarPlano?.block?.id}
          horaInicial={agendarPlano?.block?.hora_inicio}
          duracaoInicial={agendarPlano?.block?.duracao_minutos}
        />
      </div>
    </AppShell>
  );
}

function WeekSelector({
  start,
  end,
  onPrevious,
  onNext,
  onDefault,
}: {
  start: Date;
  end: Date;
  onPrevious: () => void;
  onNext: () => void;
  onDefault: () => void;
}) {
  return (
    <section className="performance-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Semana que está sendo planejada
        </div>
        <div className="font-display mt-1 text-xl font-semibold capitalize">
          {weekLabel(start, end)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          No domingo, o planejamento abre automaticamente a próxima semana.
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onDefault}>
          Semana de referência
        </Button>
        <Button size="icon" variant="outline" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function ImpactMatrix({
  tasks,
  selectedIds,
  onToggle,
}: {
  tasks: PlanningTask[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="relative h-[390px] overflow-hidden rounded-2xl border bg-[var(--brand-light)]">
        <div className="absolute inset-x-1/2 inset-y-0 w-px bg-border" />
        <div className="absolute inset-y-1/2 inset-x-0 h-px bg-border" />
        <QuadrantLabel
          label="FAZER PRIMEIRO"
          className="left-4 top-4"
          color="var(--color-green)"
        />
        <QuadrantLabel
          label="PLANEJAR"
          className="right-4 top-4"
          color="var(--brand-navy)"
        />
        <QuadrantLabel
          label="ENCAIXAR"
          className="bottom-4 left-4"
          color="var(--brand-accent)"
        />
        <QuadrantLabel
          label="REAVALIAR"
          className="bottom-4 right-4"
          color="var(--color-red)"
        />
        <span className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          Impacto →
        </span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          Esforço →
        </span>

        {tasks.map((task, index) => {
          const selected = selectedIds.includes(task.id);
          const quadrant = actionQuadrant(task);
          const style = QUADRANT_STYLE[quadrant];
          return (
            <button
              key={task.id}
              type="button"
              aria-pressed={selected}
              aria-label={`${task.descricao}. Impacto ${task.impacto}, esforço ${task.esforco}, ${quadrant}`}
              title={`${task.descricao} · impacto ${task.impacto} · esforço ${task.esforco} · ${quadrant}`}
              onClick={() => onToggle(task.id)}
              className={`absolute flex h-9 w-9 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-lg transition hover:z-20 hover:scale-125 ${
                selected
                  ? "z-10 scale-110 border-[var(--brand-dark)] ring-4 ring-[var(--brand-accent)]/25"
                  : "border-white"
              }`}
              style={{
                left: `${6 + task.esforco * 8.8}%`,
                bottom: `${5 + task.impacto * 8.8}%`,
                background: style.color,
              }}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Clique nos pontos ou no ranking abaixo para escolher as prioridades.
        Verde indica alto impacto com menor esforço.
      </p>
    </div>
  );
}

function QuadrantLabel({
  label,
  className,
  color,
}: {
  label: string;
  className: string;
  color: string;
}) {
  return (
    <span
      className={`absolute text-[10px] font-bold tracking-[0.14em] ${className}`}
      style={{ color }}
    >
      {label}
    </span>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="performance-card p-5 md:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="mb-5 block last:mb-0">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-24 resize-none"
      />
    </label>
  );
}

function Next({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end">
      <Button onClick={onClick} disabled={disabled} className="brand-button">
        Continuar
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="performance-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-display mt-1 text-2xl font-semibold text-[var(--brand-primary)]">
        {value}
      </div>
    </div>
  );
}
