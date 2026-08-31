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
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Star,
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
import { useCompromissos } from "@/hooks/useCompromissos";
import { useGoogleBusyBlocks } from "@/hooks/useGoogleCalendar";
import { sincronizarGoogleAgora } from "@/lib/googleSync";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  useAplicarPlanejamentoClaude,
  useGerarPlanejamentoClaude,
  type PlanejamentoClaudeResponse,
  type TarefaPlanejamentoClaude,
} from "@/hooks/usePlanejamentoClaude";
import { useAuth } from "@/hooks/useAuth";
import { AgendarAcaoAvulsaModal } from "@/components/actions/AgendarAcaoAvulsaModal";
import { AgendarAcaoModal } from "@/components/planos/AgendarAcaoModal";
import { CapacidadeSemana } from "@/components/planos/CapacidadeSemana";
import {
  PlanejamentoClaudeModal,
  type PlanejamentoClaudeDraft,
} from "@/components/planos/PlanejamentoClaudeModal";
import { RevisaoIndicadores } from "@/components/metas/RevisaoIndicadores";
import {
  execucoesEsperadasNaSemana,
  formatDuracao,
  hhmm,
  horaFim,
  type Agendamento,
} from "@/lib/agenda";
import type { Tarefa } from "@/lib/metas";
import { toast } from "sonner";

type PlanningState = {
  wins: string;
  pending: string;
  lesson: string;
  focus: string;
  priorityIds: string[];
  complementaryIds: string[];
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
  complementaryIds: [],
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
      const parsed = JSON.parse(
        localStorage.getItem(key) ?? "null",
      ) as PlanningState | null;
      if (parsed) {
        const priorityIds = Array.isArray(parsed.priorityIds)
          ? parsed.priorityIds
          : [];
        return {
          ...emptyState(),
          ...parsed,
          priorityIds,
          complementaryIds: Array.isArray(parsed.complementaryIds)
            ? parsed.complementaryIds.filter((id) => !priorityIds.includes(id))
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
  const { data: settings } = useAppSettings();
  const { user } = useAuth();
  const materializar = useMaterializarRecorrencias();
  const gerarPlanejamento = useGerarPlanejamentoClaude();
  const aplicarPlanejamento = useAplicarPlanejamentoClaude();

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
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [claudeSuggestion, setClaudeSuggestion] =
    useState<PlanejamentoClaudeResponse | null>(null);

  const { data: agendamentos = [] } = useAgendamentos(weekStartISO, weekEndISO);
  const { data: googleBusy = [], refetch: refetchGoogleBusy } = useGoogleBusyBlocks(
    weekStartISO,
    weekEndISO,
  );
  const { data: compromissos = [] } = useCompromissos(
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
    setClaudeOpen(false);
    setClaudeSuggestion(null);

    gerarPlanejamento.reset();
    aplicarPlanejamento.reset();
    // As mutations são estáveis durante a troca da semana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .filter((task) => !task.concluida && task.responsavel_id === user?.id)
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
      .map((action): StandalonePlanningTask => ({
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
      }));

    return [...planned, ...standalone].sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"),
    );
  }, [planos, actions, user?.id]);

  const recurringTasks = useMemo(
    () =>
      tasks.filter((task): task is PlanPlanningTask => task.origem === "plano"),
    [tasks],
  );
  const recurrenceSignature = recurringTasks
    .map(
      (task) =>
        `${task.id}:${task.frequencia}:${task.execucoes_planejadas}:${task.data_inicio}:${task.data_fim}:${task.horario_preferencial}:${task.duracao_minutos}:${(task.dias_semana ?? []).join(",")}`,
    )
    .join("|");

  useEffect(() => {
    if (!recurringTasks.length) return;
    materializar.mutate({ tarefas: recurringTasks, datas: weekDates });
    // A assinatura contém toda configuração que altera a recorrência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO, recurrenceSignature]);

  const topPriorityTasks = state.priorityIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is PlanningTask => Boolean(task));
  const complementaryTasks = state.complementaryIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is PlanningTask => Boolean(task));
  const selectedTasks = [...topPriorityTasks, ...complementaryTasks];

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

  const scheduleStatus = (task: PlanningTask) => {
    const required =
      task.origem === "plano" ? execucoesEsperadasNaSemana(task, weekDates) : 1;
    const scheduled =
      task.origem === "plano"
        ? (blocksByTask.get(task.id)?.length ?? 0)
        : task.data_agendada &&
            task.hora_inicio &&
            task.duracao_minutos &&
            task.data_agendada >= weekStartISO &&
            task.data_agendada <= weekEndISO
          ? 1
          : 0;
    return {
      required,
      scheduled,
      missing: Math.max(0, required - scheduled),
      complete: scheduled >= required,
    };
  };

  const actionsWithoutSchedule = selectedTasks.filter(
    (task) => !scheduleStatus(task).complete,
  );
  const missingExecutions = selectedTasks.reduce(
    (total, task) => total + scheduleStatus(task).missing,
    0,
  );

  const claudeTasks: TarefaPlanejamentoClaude[] = tasks
    .filter((task) => !task.id.startsWith("local-"))
    .map((task) => ({
      id: task.id,
      origem: task.origem,
      descricao: task.descricao,
      area: task.area,
      plano: task.plano,
      meta: task.meta,
      impacto: task.impacto,
      esforco: task.esforco,
      priority_score: task.priorityScore,
      prazo: task.prazo,
      duracao_minutos: task.duracao_minutos ?? null,
      execucoes_faltantes: scheduleStatus(task).missing,
      horario_preferencial:
        task.origem === "plano" ? hhmm(task.horario_preferencial) || null : null,
      dias_semana:
        task.origem === "plano" ? (task.dias_semana ?? []) : [],
      selecionada_como: state.priorityIds.includes(task.id)
        ? "top"
        : state.complementaryIds.includes(task.id)
          ? "complementar"
          : null,
    }));

  const taskLabelById = new Map(tasks.map((task) => [task.id, task.descricao]));
  const busyBlocks = [
    ...agendamentos.map((block) => ({
      data: block.data,
      inicio: hhmm(block.hora_inicio),
      fim: horaFim(hhmm(block.hora_inicio), block.duracao_minutos),
      titulo: taskLabelById.get(block.tarefa_id) ?? "Ação agendada",
      tipo: "acao" as const,
    })),
    ...(actions ?? [])
      .filter(
        (action) =>
          action.data_agendada &&
          action.hora_inicio &&
          action.duracao_minutos &&
          action.data_agendada >= weekStartISO &&
          action.data_agendada <= weekEndISO,
      )
      .map((action) => ({
        data: action.data_agendada!,
        inicio: hhmm(action.hora_inicio),
        fim: horaFim(hhmm(action.hora_inicio), action.duracao_minutos!),
        titulo: action.descricao,
        tipo: "acao" as const,
      })),
    ...compromissos.map((commitment) => ({
      data: commitment.data,
      inicio: hhmm(commitment.hora_inicio),
      fim: hhmm(commitment.hora_fim),
      titulo: commitment.titulo,
      tipo: "compromisso" as const,
    })),
    // Privacidade: do Google só importamos o intervalo ocupado, sem títulos.
    ...googleBusy.map((block) => ({
      data: block.data,
      inicio: hhmm(block.hora_inicio),
      fim: hhmm(block.hora_fim),
      titulo: "Ocupado no Google",
      tipo: "compromisso" as const,
    })),
  ];

  const suggestedScheduleDate = (taskId: string) => {
    const blocks = blocksByTask.get(taskId) ?? [];
    if (blocks.length === 0) return weekStartISO;
    const lastDate = blocks[blocks.length - 1].data;
    const nextDate = iso(addDays(new Date(`${lastDate}T12:00:00`), 1));
    return nextDate <= weekEndISO ? nextDate : lastDate;
  };

  const completed =
    ownPlanTasks.filter((task) => task.concluida).length +
    (actions ?? []).filter((action) => action.concluida).length;
  const all = ownPlanTasks.length + (actions ?? []).length;
  const execution = all ? Math.round((completed / all) * 100) : 0;

  const selectTopPriority = (id: string) => {
    if (!state.priorityIds.includes(id) && state.priorityIds.length >= 3) {
      toast.error(
        "Você já definiu as 3 prioridades top. Retire uma delas ou adicione esta ação como complementar.",
      );
      return;
    }
    setState((current) => ({
      ...current,
      priorityIds: current.priorityIds.includes(id)
        ? current.priorityIds.filter((item) => item !== id)
        : [...current.priorityIds, id],
      complementaryIds: current.complementaryIds.filter((item) => item !== id),
    }));
  };

  const selectComplementary = (id: string) => {
    setState((current) => ({
      ...current,
      priorityIds: current.priorityIds.filter((item) => item !== id),
      complementaryIds: current.complementaryIds.includes(id)
        ? current.complementaryIds.filter((item) => item !== id)
        : [...current.complementaryIds, id],
    }));
  };

  const toggleFromMatrix = (id: string) => {
    if (state.priorityIds.includes(id)) {
      selectTopPriority(id);
      return;
    }
    if (state.complementaryIds.includes(id)) {
      selectComplementary(id);
      return;
    }
    if (state.priorityIds.length < 3) {
      selectTopPriority(id);
      return;
    }
    selectComplementary(id);
  };

  const generateWithClaude = async () => {
    if (!claudeTasks.length) {
      toast.error(
        "Não há ações sincronizadas para o Claude planejar. Atualize a página ou crie uma ação primeiro.",
      );
      return;
    }

    // Sincroniza com o Google antes de planejar, para o Claude enxergar os
    // horários ocupados mais recentes (apenas data/hora, sem conteúdo).
    await sincronizarGoogleAgora();
    const { data: freshBusy } = await refetchGoogleBusy();
    const blocosOcupados = [
      ...busyBlocks.filter((b) => b.titulo !== "Ocupado no Google"),
      ...(freshBusy ?? []).map((block) => ({
        data: block.data,
        inicio: hhmm(block.hora_inicio),
        fim: hhmm(block.hora_fim),
        titulo: "Ocupado no Google",
        tipo: "compromisso" as const,
      })),
    ];

    gerarPlanejamento.reset();
    aplicarPlanejamento.reset();
    setClaudeSuggestion(null);
    setClaudeOpen(true);
    try {
      const suggestion = await gerarPlanejamento.mutateAsync({
        week_start: weekStartISO,
        week_end: weekEndISO,
        capacidade_diaria_minutos:
          settings?.capacidade_diaria_minutos ?? 480,
        revisao: {
          conquistas: state.wins,
          pendencias: state.pending,
          aprendizado: state.lesson,
          foco_atual: state.focus,
        },
        tarefas: claudeTasks,
        blocos_ocupados: blocosOcupados,
      });
      setClaudeSuggestion(suggestion);
    } catch {
      // A mensagem segura da Edge Function é exibida dentro do modal.
    }
  };

  const applyClaudePlan = async (draft: PlanejamentoClaudeDraft) => {
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const agenda = draft.agenda.flatMap((item) => {
      const task = taskById.get(item.task_id);
      return task
        ? [{ ...item, origem: task.origem }]
        : [];
    });

    try {
      await aplicarPlanejamento.mutateAsync({
        weekStart: weekStartISO,
        weekEnd: weekEndISO,
        agenda,
      });
      const validIds = new Set(tasks.map((task) => task.id));
      const topIds = draft.topIds.filter((id) => validIds.has(id)).slice(0, 3);
      const complementaryIds = draft.complementaryIds.filter(
        (id) => validIds.has(id) && !topIds.includes(id),
      );
      const next: PlanningState = {
        ...state,
        focus: draft.focoSemana,
        priorityIds: topIds,
        complementaryIds,
        savedAt: undefined,
      };
      localStorage.setItem(
        planningStorageKey(weekStartISO),
        JSON.stringify(next),
      );
      setState(next);
      setClaudeOpen(false);
      setStep(3);
      toast.success(
        agenda.length > 0
          ? `${agenda.length} ${agenda.length === 1 ? "bloco adicionado" : "blocos adicionados"} ao planejamento. Revise antes de confirmar.`
          : "Prioridades organizadas. Revise os horários que ainda faltam.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível aplicar a proposta no calendário.",
      );
    }
  };

  const save = () => {
    if (actionsWithoutSchedule.length > 0) {
      toast.error(
        `Ainda faltam ${missingExecutions} ${missingExecutions === 1 ? "execução" : "execuções"} no calendário.`,
      );
      return;
    }
    const next = { ...state, savedAt: new Date().toISOString() };
    localStorage.setItem(
      planningStorageKey(weekStartISO),
      JSON.stringify(next),
    );
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
            label="Plano da semana"
            value={`${state.priorityIds.length}/3 top · +${state.complementaryIds.length}`}
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
            <section className="performance-card overflow-hidden border-[var(--brand-accent)]/35 bg-gradient-to-br from-[var(--brand-accent-soft)] via-card to-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold">
                      Planejar minha semana com Claude
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      O Claude cruza impacto × esforço, prazos, recorrências,
                      duração e a agenda já ocupada. Você revisa tudo antes de
                      aplicar.
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Somente os dados necessários desta semana são enviados à
                      Anthropic.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="brand-button shrink-0"
                  onClick={generateWithClaude}
                  disabled={gerarPlanejamento.isPending || claudeTasks.length === 0}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {gerarPlanejamento.isPending
                    ? "Analisando…"
                    : "Montar com Claude"}
                </Button>
              </div>
            </section>

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
                  topIds={state.priorityIds}
                  complementaryIds={state.complementaryIds}
                  onToggle={toggleFromMatrix}
                />
              )}
            </Panel>

            <Panel
              icon={<Target className="h-5 w-5" />}
              title="Defina as prioridades e complete a semana"
              subtitle="Escolha até 3 prioridades top e acrescente outras ações complementares. Na próxima etapa, você reservará os horários de todas elas."
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent-soft)] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary)]">
                    <Star className="h-4 w-4 fill-current" />
                    Prioridades top
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {state.priorityIds.length}/3 escolhidas · proteja primeiro
                    os horários que mais movem o resultado.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Plus className="h-4 w-4" />
                    Ações complementares
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {state.complementaryIds.length} escolhidas · adicione o que
                    couber no tempo disponível da semana.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {tasks.map((task, index) => {
                  const isTop = state.priorityIds.includes(task.id);
                  const isComplementary = state.complementaryIds.includes(
                    task.id,
                  );
                  const expectedBlocks = scheduleStatus(task).required;
                  const quadrant = actionQuadrant(task);
                  const style = QUADRANT_STYLE[quadrant];
                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl border p-4 text-left transition ${
                        isTop
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]"
                          : isComplementary
                            ? "border-[var(--brand-primary)]/30 bg-[var(--brand-light)]"
                            : "bg-card hover:border-[var(--brand-primary)]/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                            isTop
                              ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white"
                              : isComplementary
                                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                                : ""
                          }`}
                        >
                          {isTop ? (
                            <Star className="h-3 w-3 fill-current" />
                          ) : isComplementary ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            index + 1
                          )}
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
                              style={{
                                color: style.color,
                                background: style.soft,
                              }}
                            >
                              {quadrant}
                            </span>
                            <span className="text-muted-foreground">
                              Score {task.priorityScore}
                            </span>
                            {expectedBlocks > 1 && (
                              <span className="rounded-full bg-[var(--brand-accent-soft)] px-2 py-1 text-[var(--brand-primary)]">
                                {expectedBlocks} blocos nesta semana
                              </span>
                            )}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={isTop ? "default" : "outline"}
                              onClick={() => selectTopPriority(task.id)}
                              className={isTop ? "brand-button" : ""}
                            >
                              <Star
                                className={`mr-1.5 h-3.5 w-3.5 ${
                                  isTop ? "fill-current" : ""
                                }`}
                              />
                              {isTop ? "Prioridade top" : "Marcar como top"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={isComplementary ? "secondary" : "ghost"}
                              onClick={() => selectComplementary(task.id)}
                            >
                              {isComplementary ? (
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                              ) : (
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {isComplementary
                                ? "Complementar escolhida"
                                : "Adicionar à semana"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Next
              disabled={selectedTasks.length === 0}
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
              title="Reserve os horários da semana"
              subtitle="Cada prioridade top e ação complementar precisa ter pelo menos um bloco no calendário."
            >
              <div className="space-y-6">
                {[
                  {
                    title: "Prioridades top",
                    description:
                      "Os compromissos mais importantes da semana entram primeiro na agenda.",
                    tasks: topPriorityTasks,
                    isTop: true,
                  },
                  {
                    title: "Ações complementares",
                    description:
                      "Use o restante da capacidade para avançar outras ações relevantes.",
                    tasks: complementaryTasks,
                    isTop: false,
                  },
                ]
                  .filter((group) => group.tasks.length > 0)
                  .map((group) => (
                    <div key={group.title}>
                      <div className="mb-3 flex items-start gap-2">
                        {group.isTop ? (
                          <Star className="mt-0.5 h-4 w-4 fill-current text-[var(--brand-accent)]" />
                        ) : (
                          <Plus className="mt-0.5 h-4 w-4 text-[var(--brand-primary)]" />
                        )}
                        <div>
                          <h3 className="text-sm font-semibold">
                            {group.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {group.description}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {group.tasks.map((task, index) => {
                          const status = scheduleStatus(task);
                          const scheduled = status.complete;
                          const blocks =
                            task.origem === "plano"
                              ? (blocksByTask.get(task.id) ?? [])
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
                                    {group.isTop ? `0${index + 1}` : "+"}
                                  </span>
                                  <div>
                                    <div className="text-sm font-semibold">
                                      {task.descricao}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {task.plano} · {actionQuadrant(task)}
                                    </div>
                                    <div
                                      className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                        status.complete
                                          ? "bg-[var(--color-green-bg)] text-[var(--color-green)]"
                                          : "bg-[var(--brand-accent-soft)] text-[var(--brand-primary)]"
                                      }`}
                                    >
                                      {status.complete && (
                                        <Check className="h-3 w-3" />
                                      )}
                                      {status.scheduled} de {status.required}{" "}
                                      {status.required === 1
                                        ? "execução agendada"
                                        : "execuções agendadas"}
                                    </div>
                                  </div>
                                </div>

                                {task.origem === "avulsa" && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={scheduled ? "outline" : "default"}
                                    onClick={() =>
                                      setAgendarAvulsa(task.action)
                                    }
                                  >
                                    <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                                    {scheduled
                                      ? "Alterar horário"
                                      : "Definir dia e horário"}
                                  </Button>
                                )}

                                {task.origem === "plano" &&
                                  status.missing > 0 && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={
                                        blocks.length > 0
                                          ? "outline"
                                          : "default"
                                      }
                                      onClick={() => setAgendarPlano({ task })}
                                    >
                                      <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                                      {blocks.length === 0
                                        ? "Agendar 1ª execução"
                                        : `Agendar próxima · faltam ${status.missing}`}
                                    </Button>
                                  )}
                              </div>

                              {task.origem === "avulsa" && scheduled && (
                                <div className="mt-3 rounded-lg bg-background/80 px-3 py-2 text-xs font-medium">
                                  {new Date(
                                    `${task.data_agendada}T12:00:00`,
                                  ).toLocaleDateString("pt-BR", {
                                    weekday: "short",
                                    day: "2-digit",
                                    month: "2-digit",
                                  })}{" "}
                                  às {hhmm(task.hora_inicio)} ·{" "}
                                  {formatDuracao(task.duracao_minutos)}
                                </div>
                              )}

                              {task.origem === "plano" && blocks.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {blocks.map((block) => (
                                    <button
                                      key={block.id}
                                      type="button"
                                      onClick={() =>
                                        setAgendarPlano({ task, block })
                                      }
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
                    </div>
                  ))}
              </div>

              {actionsWithoutSchedule.length > 0 && (
                <div className="mt-4 rounded-lg border border-[var(--brand-accent)]/40 bg-[var(--brand-accent-soft)] p-3 text-xs text-[var(--brand-primary)]">
                  Ainda faltam {missingExecutions}{" "}
                  {missingExecutions === 1 ? "execução" : "execuções"} no
                  calendário. Defina os blocos acima para liberar a confirmação.
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
                  !state.focus.trim() || actionsWithoutSchedule.length > 0
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
              Você definiu {topPriorityTasks.length}{" "}
              {topPriorityTasks.length === 1
                ? "prioridade top"
                : "prioridades top"}
              {complementaryTasks.length > 0 && (
                <>
                  {" "}
                  e {complementaryTasks.length}{" "}
                  {complementaryTasks.length === 1
                    ? "ação complementar"
                    : "ações complementares"}
                </>
              )}{" "}
              para {weekLabel(weekDays[0], weekDays[6])}. Todas possuem horário
              protegido no calendário.
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

        <PlanejamentoClaudeModal
          open={claudeOpen}
          onOpenChange={setClaudeOpen}
          loading={gerarPlanejamento.isPending}
          applying={aplicarPlanejamento.isPending}
          error={
            gerarPlanejamento.error instanceof Error
              ? gerarPlanejamento.error.message
              : null
          }
          suggestion={claudeSuggestion}
          tasks={claudeTasks}
          weekStart={weekStartISO}
          weekEnd={weekEndISO}
          onRetry={() => void generateWithClaude()}
          onConfirm={(draft) => void applyClaudePlan(draft)}
        />

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
          dataInicial={
            agendarPlano?.block?.data ??
            (agendarPlano
              ? suggestedScheduleDate(agendarPlano.task.id)
              : weekStartISO)
          }
          dataMin={weekStartISO}
          dataMax={weekEndISO}
          agendamentoId={agendarPlano?.block?.id}
          horaInicial={agendarPlano?.block?.hora_inicio}
          duracaoInicial={agendarPlano?.block?.duracao_minutos}
          agendadasNaSemana={
            agendarPlano ? scheduleStatus(agendarPlano.task).scheduled : 0
          }
          execucoesNecessarias={
            agendarPlano ? scheduleStatus(agendarPlano.task).required : 1
          }
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
  topIds,
  complementaryIds,
  onToggle,
}: {
  tasks: PlanningTask[];
  topIds: string[];
  complementaryIds: string[];
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
          const isTop = topIds.includes(task.id);
          const isComplementary = complementaryIds.includes(task.id);
          const selected = isTop || isComplementary;
          const quadrant = actionQuadrant(task);
          const style = QUADRANT_STYLE[quadrant];
          return (
            <button
              key={task.id}
              type="button"
              aria-pressed={selected}
              aria-label={`${task.descricao}. Impacto ${task.impacto}, esforço ${task.esforco}, ${quadrant}${isTop ? ", prioridade top" : isComplementary ? ", ação complementar" : ""}`}
              title={`${task.descricao} · impacto ${task.impacto} · esforço ${task.esforco} · ${quadrant}${isTop ? " · prioridade top" : isComplementary ? " · ação complementar" : ""}`}
              onClick={() => onToggle(task.id)}
              className={`absolute flex h-9 w-9 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-lg transition hover:z-20 hover:scale-125 ${
                isTop
                  ? "z-10 scale-110 border-[var(--brand-dark)] ring-4 ring-[var(--brand-accent)]/30"
                  : isComplementary
                    ? "z-10 border-[var(--brand-dark)] ring-4 ring-[var(--brand-primary)]/15"
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
        Clique nos pontos para adicioná-los ao planejamento: os 3 primeiros
        entram como prioridades top e os seguintes como complementares. No
        ranking abaixo, você pode trocar a categoria. Verde indica alto impacto
        com menor esforço.
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
