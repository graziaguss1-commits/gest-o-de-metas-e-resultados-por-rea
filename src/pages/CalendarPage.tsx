import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Pencil,
  Plus,
  Trash2,
  BriefcaseBusiness,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePlanos,
  useExecucoes,
  useRegistrarExecucao,
  useToggleTarefa,
  type PlanoWithMeta,
} from "@/hooks/usePlanos";
import {
  useAgendamentos,
  useAlternarCronometroAgendamento,
  useFinalizarCronometroAgendamento,
  useMaterializarRecorrencias,
  useReagendarTarefa,
} from "@/hooks/useAgendamentos";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/hooks/useAuth";
import {
  useCompromissos,
  useAtualizarCompromisso,
} from "@/hooks/useCompromissos";
import {
  useActions,
  useScheduleAction,
  useToggleAction,
  type ActionItem,
} from "@/hooks/useActions";
import { NovoCompromissoModal } from "@/components/calendar/NovoCompromissoModal";
import { HourlyCalendarGrid } from "@/components/calendar/HourlyCalendarGrid";
import { TaskTimerButton } from "@/components/calendar/TaskTimerButton";
import {
  EventoCalendarioModal,
  type EventoCalendarioSelecionado,
} from "@/components/calendar/EventoCalendarioModal";
import { NovoPlanoModal } from "@/components/planos/NovoPlanoModal";
import { AgendarAcaoModal } from "@/components/planos/AgendarAcaoModal";
import { AgendarAcaoAvulsaModal } from "@/components/actions/AgendarAcaoAvulsaModal";
import {
  capacidadeDoDia,
  comparativoTempo,
  configuracaoRecorrenciaCompleta,
  diasRecorrenciaPersistida,
  execucoesEsperadasNaSemana,
  formatCronometro,
  formatTotalHoras,
  hhmm,
  horaFim,
  minutosReaisDoCronometro,
  segundosDoCronometro,
  totalSemana,
} from "@/lib/agenda";
import { getFrequencia, quantidadePorExecucao } from "@/lib/execucao";
import type { Tarefa } from "@/lib/metas";

type CalendarTask = PlanoWithMeta["tarefas"][number] & {
  plano: string;
  area: string;
  meta: string | null;
};

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
};
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, amount: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
};
const dateFromParam = (value: string | null) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return hoje;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return hoje;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export default function CalendarPage() {
  const [searchParams] = useSearchParams();
  const requestedWeek = searchParams.get("semana");
  const { data: planos, isLoading } = usePlanos();
  const { data: execucoes = [] } = useExecucoes();
  const { user } = useAuth();
  const { data: settings } = useAppSettings();
  const { data: actions = [], isLoading: actionsLoading } = useActions();
  const toggle = useToggleTarefa();
  const registrarExecucao = useRegistrarExecucao();
  const toggleAction = useToggleAction();
  const scheduleAction = useScheduleAction();
  const reagendar = useReagendarTarefa();
  const alternarCronometro = useAlternarCronometroAgendamento();
  const finalizarCronometro = useFinalizarCronometroAgendamento();
  const materializar = useMaterializarRecorrencias();
  const [anchor, setAnchor] = useState(() => dateFromParam(requestedWeek));
  const [calendarSpan, setCalendarSpan] = useState<3 | 7>(3);
  const [novoOpen, setNovoOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<"horas" | "compacto">(
    "horas",
  );
  const [compromissoOpen, setCompromissoOpen] = useState(false);
  const [compromissoData, setCompromissoData] = useState<string>();
  const atualizarCompromisso = useAtualizarCompromisso();
  const days = useMemo(
    () => Array.from({ length: calendarSpan }, (_, i) => addDays(anchor, i)),
    [anchor, calendarSpan],
  );
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekDates = useMemo(() => weekDays.map(iso), [weekDays]);
  const queryStart = iso(startOfWeek(days[0]));
  const queryEnd = iso(addDays(startOfWeek(days[days.length - 1]), 6));
  const queryDates = useMemo(() => {
    const datas: string[] = [];
    let atual = new Date(`${queryStart}T12:00:00`);
    const fim = new Date(`${queryEnd}T12:00:00`);
    while (atual <= fim) {
      datas.push(iso(atual));
      atual = addDays(atual, 1);
    }
    return datas;
  }, [queryStart, queryEnd]);
  const { data: agendamentos = [] } = useAgendamentos(queryStart, queryEnd);
  const { data: compromissos = [] } = useCompromissos(
    queryStart,
    queryEnd,
  );

  const [agendar, setAgendar] = useState<{
    tarefa: Tarefa;
    data?: string;
    agendamentoId?: string;
    hora?: string;
    duracao?: number | null;
  } | null>(null);
  const [agendarAvulsa, setAgendarAvulsa] = useState<ActionItem | null>(null);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [timerPendingId, setTimerPendingId] = useState<string | null>(null);
  const [eventoSelecionado, setEventoSelecionado] =
    useState<EventoCalendarioSelecionado | null>(null);

  const capacidade = settings?.capacidade_diaria_minutos ?? 480;
  const tasks = useMemo<CalendarTask[]>(
    () =>
      (planos ?? []).flatMap((plano) =>
        plano.tarefas
          .filter((task) => task.responsavel_id === user?.id)
          .map((task) => ({
            ...task,
            plano: plano.titulo,
            area: plano.meta?.area ?? "Sem área",
            meta: plano.meta?.nome ?? null,
          })),
      ),
    [planos, user?.id],
  );
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const execucaoPorAgendamento = useMemo(
    () =>
      new Map(
        execucoes
          .filter((execucao) => execucao.agendamento_id)
          .map((execucao) => [execucao.agendamento_id as string, execucao]),
      ),
    [execucoes],
  );
  const realMinutesByActionId = useMemo(
    () =>
      new Map(
        [...execucaoPorAgendamento.entries()].map(([id, execucao]) => [
          id,
          execucao.tempo_real_minutos ?? null,
        ]),
      ),
    [execucaoPorAgendamento],
  );
  const inicioSemana = iso(weekDays[0]);
  const fimSemana = iso(weekDays[6]);
  const agendamentosDaSemana = useMemo(
    () =>
      agendamentos.filter(
        (item) => item.data >= inicioSemana && item.data <= fimSemana,
      ),
    [agendamentos, inicioSemana, fimSemana],
  );
  const compromissosDaSemana = useMemo(
    () =>
      compromissos.filter(
        (item) => item.data >= inicioSemana && item.data <= fimSemana,
      ),
    [compromissos, inicioSemana, fimSemana],
  );
  const agendamentosPorTarefa = useMemo(
    () =>
      agendamentosDaSemana.reduce((map, agendamento) => {
        map.set(
          agendamento.tarefa_id,
          (map.get(agendamento.tarefa_id) ?? 0) + 1,
        );
        return map;
      }, new Map<string, number>()),
    [agendamentosDaSemana],
  );
  const temRotinaAutomaticaAtiva = (task: CalendarTask) =>
    configuracaoRecorrenciaCompleta(
      task.frequencia,
      task.duracao_minutos,
      task.horario_preferencial,
      diasRecorrenciaPersistida(task.frequencia, task.dias_semana),
    ) &&
    ["diaria", "semanal", "mensal"].includes(task.frequencia) &&
    (!task.data_inicio || task.data_inicio <= fimSemana) &&
    (!task.data_fim || task.data_fim >= inicioSemana);
  const progressoAgenda = (task: Tarefa, dataReferencia?: string) => {
    const inicio = dataReferencia
      ? startOfWeek(new Date(`${dataReferencia}T12:00:00`))
      : weekStart;
    const datas = Array.from({ length: 7 }, (_, index) =>
      iso(addDays(inicio, index)),
    );
    const [primeiroDia, ultimoDia] = [datas[0], datas[6]];
    const semanaAtual = primeiroDia === inicioSemana;
    const agendadas = semanaAtual
      ? (agendamentosPorTarefa.get(task.id) ?? 0)
      : agendamentos.filter(
          (item) =>
            item.tarefa_id === task.id &&
            item.data >= primeiroDia &&
            item.data <= ultimoDia,
        ).length;
    const necessarias = execucoesEsperadasNaSemana(task, datas);
    return {
      agendadas,
      necessarias,
      faltam: Math.max(0, necessarias - agendadas),
    };
  };
  const availableToSchedule = tasks.filter((task) => {
    const progresso = progressoAgenda(task);
    return (
      !task.concluida &&
      progresso.faltam > 0 &&
      (!temRotinaAutomaticaAtiva(task) || progresso.agendadas > 0)
    );
  });
  const scheduledStandalone = actions.filter((action) =>
    Boolean(
      action.data_agendada &&
      action.hora_inicio &&
      action.duracao_minutos &&
      action.data_agendada >= inicioSemana &&
      action.data_agendada <= fimSemana,
    ),
  );
  const scheduledStandaloneInRange = actions.filter((action) =>
    Boolean(
      action.data_agendada &&
      action.hora_inicio &&
      action.duracao_minutos &&
      action.data_agendada >= queryStart &&
      action.data_agendada <= queryEnd,
    ),
  );
  const standaloneToSchedule = actions.filter(
    (action) =>
      !action.concluida &&
      (!action.data_agendada || !action.hora_inicio || !action.duracao_minutos),
  );
  const overdue = tasks.filter(
    (task) => !task.concluida && task.prazo && task.prazo < iso(new Date()),
  );
  const semAgendamento =
    availableToSchedule.length + standaloneToSchedule.length;
  const periodLabel = `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${days[days.length - 1].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
  const minutosCompromissos = compromissosDaSemana.reduce((total, c) => {
    const [hi, mi] = c.hora_inicio.split(":").map(Number);
    const [hf, mf] = c.hora_fim.split(":").map(Number);
    return total + (hf * 60 + mf - hi * 60 - mi);
  }, 0);
  const minutosAvulsos = scheduledStandalone.reduce(
    (total, action) => total + (action.duracao_minutos ?? 0),
    0,
  );
  const minutosSemana =
    totalSemana(weekDates, agendamentosDaSemana) +
    minutosAvulsos +
    minutosCompromissos;
  const recurrenceSignature = tasks
    .map(
      (task) =>
        `${task.id}:${task.frequencia}:${task.execucoes_planejadas}:${task.data_inicio}:${task.data_fim}:${task.horario_preferencial}:${task.duracao_minutos}:${(task.dias_semana ?? []).join(",")}`,
    )
    .join("|");

  useEffect(() => {
    if (requestedWeek) setAnchor(dateFromParam(requestedWeek));
  }, [requestedWeek]);

  useEffect(() => {
    if (!tasks.length) return;
    materializar.mutate({ tarefas: tasks, datas: queryDates });
    // A semana e a configuração das tarefas determinam as ocorrências; o hook evita duplicatas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryStart, queryEnd, recurrenceSignature]);

  const abrirAcaoDoPlano = (agendamentoId: string) => {
    const agendamento = agendamentos.find((item) => item.id === agendamentoId);
    const tarefa = agendamento ? taskById.get(agendamento.tarefa_id) : null;
    if (agendamento && tarefa) {
      setEventoSelecionado({ tipo: "plano", agendamento, tarefa });
    }
  };
  const abrirAcaoAvulsa = (actionId: string) => {
    const action = actions.find((item) => item.id === actionId);
    if (action) setEventoSelecionado({ tipo: "avulsa", action });
  };
  const abrirCompromisso = (compromissoId: string) => {
    const compromisso = compromissos.find((item) => item.id === compromissoId);
    if (compromisso) setEventoSelecionado({ tipo: "compromisso", compromisso });
  };
  const dataSugeridaParaTarefa = (taskId: string) => {
    const blocos = agendamentosDaSemana.filter(
      (item) => item.tarefa_id === taskId,
    );
    if (blocos.length === 0) return inicioSemana;
    const ultimaData = blocos[blocos.length - 1].data;
    const proxima = iso(addDays(new Date(`${ultimaData}T12:00:00`), 1));
    return proxima <= fimSemana ? proxima : ultimaData;
  };

  const marcarAgendamentoComoFeito = async (agendamentoId: string) => {
    if (execucaoPorAgendamento.has(agendamentoId)) return;
    const agendamento = agendamentos.find(
      (item) => item.id === agendamentoId,
    );
    const tarefa = agendamento
      ? taskById.get(agendamento.tarefa_id)
      : undefined;
    if (!agendamento || !tarefa) return;

    setConcluindoId(agendamentoId);
    try {
      const segundosCronometrados = segundosDoCronometro(agendamento);
      const tempoRealMinutos = minutosReaisDoCronometro(segundosCronometrados);
      if (
        agendamento.cronometro_iniciado_em ||
        segundosCronometrados > 0
      ) {
        await finalizarCronometro.mutateAsync({
          id: agendamento.id,
          segundos: segundosCronometrados,
        });
      }
      await registrarExecucao.mutateAsync({
        tarefaId: tarefa.id,
        agendamentoId,
        quantidade: quantidadePorExecucao(tarefa),
        data: agendamento.data,
        tempoRealMinutos,
      });
      if (getFrequencia(tarefa) === "unica" && !tarefa.concluida) {
        await toggle.mutateAsync({ id: tarefa.id, concluida: true });
      }
      toast.success(
        tempoRealMinutos
          ? `Tarefa finalizada em ${formatCronometro(segundosCronometrados)}. Execução registrada.`
          : "Execução registrada. O resultado da meta continua separado.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível marcar esta execução como feita.",
      );
    } finally {
      setConcluindoId(null);
    }
  };

  const alternarTimer = async (agendamento: (typeof agendamentos)[number]) => {
    setTimerPendingId(agendamento.id);
    try {
      const resultado = await alternarCronometro.mutateAsync(agendamento);
      toast.success(
        resultado.ativo
          ? "Cronômetro iniciado. Pode executar a tarefa."
          : `Cronômetro pausado em ${formatCronometro(resultado.segundos)}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o cronômetro.",
      );
    } finally {
      setTimerPendingId(null);
    }
  };

  return (
    <AppShell>
      <div className="performance-page space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow mb-2">AGENDA E EXECUÇÃO</div>
            <h1 className="font-display text-3xl font-semibold">
              Meu calendário estratégico
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Somente suas ações, pendências e compromissos aparecem nesta
              agenda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCompromissoData(iso(new Date()));
                setCompromissoOpen(true);
              }}
            >
              <BriefcaseBusiness className="mr-2 h-4 w-4" />
              Novo compromisso
            </Button>
            <Button onClick={() => setNovoOpen(true)} className="brand-button">
              <Plus className="mr-2 h-4 w-4" />
              Novo plano
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-5">
          <CalendarMetric
            label="Ações agendadas"
            value={String(
              agendamentosDaSemana.length + scheduledStandalone.length,
            )}
            tone="primary"
          />
          <CalendarMetric
            label="Compromissos"
            value={String(compromissosDaSemana.length)}
            tone="primary"
          />
          <CalendarMetric
            label="Tempo planejado na semana"
            value={formatTotalHoras(minutosSemana)}
            tone="accent"
          />
          <CalendarMetric
            label="Atrasadas (prazo)"
            value={String(overdue.length)}
            tone="red"
          />
          <CalendarMetric
            label="Sem agendamento"
            value={String(semAgendamento)}
            tone="accent"
          />
        </section>

        <section className="performance-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {calendarSpan === 3 ? "Período selecionado" : "Semana selecionada"}
            </div>
            <div className="mt-1 font-display text-lg font-semibold capitalize">
              {periodLabel}
            </div>
            <div className="text-xs text-muted-foreground">
              Capacidade diária configurada: {formatTotalHoras(capacidade)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setAnchor(addDays(anchor, -calendarSpan))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setAnchor(dateFromParam(null))}
            >
              Hoje
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setAnchor(addDays(anchor, calendarSpan))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <div className="mr-2 flex gap-2 border-r pr-4">
            <Button
              size="sm"
              variant={calendarSpan === 3 ? "default" : "outline"}
              onClick={() => setCalendarSpan(3)}
            >
              3 dias
            </Button>
            <Button
              size="sm"
              variant={calendarSpan === 7 ? "default" : "outline"}
              onClick={() => {
                setCalendarSpan(7);
                setAnchor(startOfWeek(anchor));
              }}
            >
              Semana
            </Button>
          </div>
          <Button
            size="sm"
            variant={calendarView === "horas" ? "default" : "outline"}
            onClick={() => setCalendarView("horas")}
          >
            Por horário
          </Button>
          <Button
            size="sm"
            variant={calendarView === "compacto" ? "default" : "outline"}
            onClick={() => setCalendarView("compacto")}
          >
            Compacto
          </Button>
        </div>

        {calendarView === "horas" && (
          <HourlyCalendarGrid
            days={days}
            agendamentos={agendamentos}
            acoesAvulsas={actions}
            compromissos={compromissos}
            taskById={taskById}
            completedActionIds={new Set(execucaoPorAgendamento.keys())}
            realMinutesByActionId={realMinutesByActionId}
            completingActionId={concluindoId}
            timerPendingId={timerPendingId}
            onOpenDay={(data) => {
              setCompromissoData(data);
              setCompromissoOpen(true);
            }}
            onOpenAction={abrirAcaoDoPlano}
            onOpenStandaloneAction={abrirAcaoAvulsa}
            onOpenCommitment={abrirCompromisso}
            onMarkActionDone={marcarAgendamentoComoFeito}
            onToggleTimer={alternarTimer}
            onToggleStandaloneAction={(id, concluida) =>
              toggleAction.mutate({ id, concluida })
            }
            onToggleCommitment={(id, concluido) =>
              atualizarCompromisso.mutate({ id, concluido })
            }
            onMoveAction={(id, data, hora) => {
              const atual = agendamentos.find((item) => item.id === id);
              if (atual)
                reagendar.mutate({
                  id,
                  data,
                  horaInicio: hora,
                  duracaoMinutos: atual.duracao_minutos,
                });
            }}
            onMoveStandaloneAction={(id, data, hora) => {
              const action = actions.find((item) => item.id === id);
              if (action?.duracao_minutos)
                scheduleAction.mutate({
                  id,
                  data,
                  horaInicio: hora,
                  duracaoMinutos: action.duracao_minutos,
                });
            }}
            onMoveCommitment={(id, data, hora) => {
              const atual = compromissos.find((item) => item.id === id);
              if (!atual) return;
              const [hi, mi] = atual.hora_inicio.split(":").map(Number);
              const [hf, mf] = atual.hora_fim.split(":").map(Number);
              const duracao = hf * 60 + mf - hi * 60 - mi;
              const [nh, nm] = hora.split(":").map(Number);
              const fim = nh * 60 + nm + duracao;
              atualizarCompromisso.mutate({
                id,
                data,
                hora_inicio: hora,
                hora_fim: `${String(Math.floor(fim / 60)).padStart(2, "0")}:${String(fim % 60).padStart(2, "0")}`,
              });
            }}
          />
        )}

        <div
          className={`performance-card overflow-hidden ${calendarView === "compacto" ? "" : "hidden"}`}
        >
          {isLoading || actionsLoading ? (
            <Skeleton className="h-[440px] w-full" />
          ) : (
            <div
              className={`grid divide-x overflow-x-auto ${calendarSpan === 3 ? "min-w-[720px]" : "min-w-[1050px]"}`}
              style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(${calendarSpan === 3 ? "220px" : "145px"}, 1fr))`,
              }}
            >
              {days.map((day) => {
                const dia = iso(day);
                const blocos = agendamentos
                  .filter((a) => a.data === dia)
                  .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
                const compromissosDia = compromissos
                  .filter((c) => c.data === dia)
                  .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
                const avulsasDia = scheduledStandaloneInRange
                  .filter((action) => action.data_agendada === dia)
                  .sort((a, b) =>
                    (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? ""),
                  );
                const semHora = tasks.filter(
                  (task) =>
                    task.prazo === dia &&
                    !agendamentos.some(
                      (a) => a.tarefa_id === task.id && a.data === dia,
                    ),
                );
                const capBase = capacidadeDoDia(dia, agendamentos, capacidade);
                const minutosFixos = compromissosDia.reduce((total, c) => {
                  const [hi, mi] = c.hora_inicio.split(":").map(Number);
                  const [hf, mf] = c.hora_fim.split(":").map(Number);
                  return total + (hf * 60 + mf - hi * 60 - mi);
                }, 0);
                const minutosAvulsosDia = avulsasDia.reduce(
                  (total, action) => total + (action.duracao_minutos ?? 0),
                  0,
                );
                const planejadoTotal =
                  capBase.planejado + minutosAvulsosDia + minutosFixos;
                const cap = {
                  ...capBase,
                  planejado: planejadoTotal,
                  disponivel: Math.max(0, capacidade - planejadoTotal),
                  sobrecarga: planejadoTotal > capacidade,
                };
                const today = dia === iso(new Date());
                return (
                  <div
                    key={dia}
                    className={`min-h-[430px] p-3 ${today ? "bg-[var(--brand-accent-soft)]/40" : ""}`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {day
                            .toLocaleDateString("pt-BR", { weekday: "short" })
                            .replace(".", "")}
                        </div>
                        <div
                          className={`font-display text-2xl font-semibold ${today ? "text-[var(--brand-accent)]" : ""}`}
                        >
                          {day.getDate()}
                        </div>
                      </div>
                      {today && (
                        <span className="rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                          Hoje
                        </span>
                      )}
                    </div>

                    <div
                      className={`mb-3 rounded-lg px-2 py-1.5 text-[10px] ${cap.sobrecarga ? "bg-[var(--color-red-bg,rgba(239,68,68,0.12))] text-[var(--color-red)]" : "bg-muted text-muted-foreground"}`}
                    >
                      <div className="font-semibold">
                        {formatTotalHoras(cap.planejado)} planejadas
                      </div>
                      <div>
                        {cap.sobrecarga
                          ? `Sobrecarga: ${formatTotalHoras(cap.planejado - cap.capacidade)} acima da capacidade`
                          : `${formatTotalHoras(cap.disponivel)} disponíveis`}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {blocos.length === 0 &&
                        avulsasDia.length === 0 &&
                        semHora.length === 0 &&
                        compromissosDia.length === 0 && (
                          <button
                            onClick={() => {
                              setCompromissoData(dia);
                              setCompromissoOpen(true);
                            }}
                            className="w-full rounded-xl border border-dashed p-3 text-center text-[11px] text-muted-foreground hover:border-[var(--brand-accent)]"
                          >
                            Adicionar compromisso
                          </button>
                        )}
                      {compromissosDia.map((c) => (
                        <div
                          key={c.id}
                          className={`rounded-xl border-l-4 border-l-[var(--brand-accent)] bg-card p-2.5 ${c.concluido ? "opacity-60" : ""}`}
                        >
                          <div className="text-[11px] font-bold tabular-nums text-[var(--brand-accent)]">
                            {hhmm(c.hora_inicio)}–{hhmm(c.hora_fim)}
                          </div>
                          <div
                            className={`mt-0.5 text-xs font-semibold ${c.concluido ? "line-through" : ""}`}
                          >
                            {c.titulo}
                          </div>
                          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            {c.area} · compromisso
                          </div>
                          <div className="mt-2 flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() =>
                                atualizarCompromisso.mutate({
                                  id: c.id,
                                  concluido: !c.concluido,
                                })
                              }
                            >
                              {c.concluido ? "Reabrir" : "Concluir"}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setEventoSelecionado({
                                  tipo: "compromisso",
                                  compromisso: c,
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {avulsasDia.map((action) => (
                        <div
                          key={action.id}
                          className={`rounded-xl border-l-4 border-l-[var(--color-green)] bg-card p-2.5 ${action.concluida ? "opacity-60" : ""}`}
                        >
                          <div className="text-[11px] font-bold tabular-nums text-[var(--color-green)]">
                            {action.hora_inicio?.slice(0, 5)}–
                            {horaFim(
                              action.hora_inicio?.slice(0, 5) ?? "09:00",
                              action.duracao_minutos ?? 0,
                            )}
                          </div>
                          <div
                            className={`mt-0.5 text-xs font-semibold ${action.concluida ? "line-through" : ""}`}
                          >
                            {action.descricao}
                          </div>
                          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            {action.area} · prioridade avulsa
                          </div>
                          <div className="mt-2 flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() =>
                                toggleAction.mutate({
                                  id: action.id,
                                  concluida: !action.concluida,
                                })
                              }
                            >
                              {action.concluida ? "Reabrir" : "Concluir"}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Reagendar"
                              onClick={() => setAgendarAvulsa(action)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              title="Remover do calendário"
                              onClick={() =>
                                setEventoSelecionado({ tipo: "avulsa", action })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {blocos.map((bloco) => {
                        const task = taskById.get(bloco.tarefa_id);
                        if (!task) return null;
                        const concluido = execucaoPorAgendamento.has(bloco.id);
                        const execucao = execucaoPorAgendamento.get(bloco.id);
                        return (
                          <div
                            key={bloco.id}
                            className={`rounded-xl border bg-card p-2.5 ${concluido ? "border-[var(--color-green)]/40 bg-[var(--color-green-bg)]" : ""}`}
                          >
                            <div className="text-[11px] font-bold tabular-nums text-[var(--brand-primary)]">
                              {hhmm(bloco.hora_inicio)}–
                              {horaFim(
                                hhmm(bloco.hora_inicio),
                                bloco.duracao_minutos,
                              )}
                            </div>
                            <div
                              className={`mt-0.5 text-xs font-semibold leading-snug ${concluido ? "line-through opacity-70" : ""}`}
                            >
                              {task.descricao}
                            </div>
                            <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                              {task.area}
                              {task.meta ? ` · ${task.meta}` : ""}
                            </div>
                            {concluido &&
                              comparativoTempo(
                                task.duracao_minutos,
                                execucao?.tempo_real_minutos,
                              ) && (
                                <div className="mt-1 text-[10px] text-muted-foreground">
                                  {comparativoTempo(
                                    task.duracao_minutos,
                                    execucao?.tempo_real_minutos,
                                  )}
                                </div>
                              )}
                            <div className="mt-2 flex items-center gap-1">
                              {!concluido && (
                                <TaskTimerButton
                                  agendamento={bloco}
                                  pending={
                                    timerPendingId === bloco.id ||
                                    concluindoId === bloco.id
                                  }
                                  onToggle={alternarTimer}
                                />
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[10px]"
                                disabled={
                                  concluido ||
                                  concluindoId === bloco.id ||
                                  timerPendingId === bloco.id
                                }
                                onClick={() => marcarAgendamentoComoFeito(bloco.id)}
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                {concluido
                                  ? "Feito"
                                  : bloco.cronometro_iniciado_em ||
                                      Number(bloco.cronometro_segundos ?? 0) > 0
                                    ? "Finalizar"
                                    : "Marcar feito"}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                title="Reagendar"
                                onClick={() =>
                                  setAgendar({
                                    tarefa: task,
                                    data: bloco.data,
                                    agendamentoId: bloco.id,
                                    hora: hhmm(bloco.hora_inicio),
                                    duracao: bloco.duracao_minutos,
                                  })
                                }
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                title="Remover do calendário"
                                onClick={() =>
                                  setEventoSelecionado({
                                    tipo: "plano",
                                    agendamento: bloco,
                                    tarefa: task,
                                  })
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {semHora.map((task) => (
                        <div
                          key={task.id}
                          className={`rounded-xl border border-dashed p-2.5 ${task.concluida ? "bg-muted/50 opacity-65" : "bg-card"}`}
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={task.concluida}
                              onCheckedChange={(v) =>
                                toggle.mutate({
                                  id: task.id,
                                  concluida: v === true,
                                })
                              }
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <div
                                className={`text-xs font-semibold leading-snug ${task.concluida ? "line-through" : ""}`}
                              >
                                {task.descricao}
                              </div>
                              <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                Prazo · {task.area}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-1.5 h-6 px-1.5 text-[10px]"
                            onClick={() =>
                              setAgendar({ tarefa: task, data: dia })
                            }
                          >
                            <CalendarClock className="mr-1 h-3 w-3" />
                            Definir horário
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {(availableToSchedule.length > 0 ||
          standaloneToSchedule.length > 0) && (
          <section className="performance-card p-4">
            <h2 className="font-display text-lg font-semibold">
              Pendências para agendar nesta semana
            </h2>
            <p className="text-xs text-muted-foreground">
              Aqui aparecem ações de planos e prioridades avulsas que ainda não
              têm um bloco protegido.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {availableToSchedule.slice(0, 8).map((t) => {
                const progresso = progressoAgenda(t);
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-xl border p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {t.descricao}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.plano} ·{" "}
                        {t.duracao_minutos
                          ? `${t.duracao_minutos} min por execução`
                          : "sem duração estimada"}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-[var(--brand-primary)]">
                        {progresso.agendadas} de {progresso.necessarias}{" "}
                        agendadas · faltam {progresso.faltam}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setAgendar({
                          tarefa: t,
                          data: dataSugeridaParaTarefa(t.id),
                        })
                      }
                    >
                      <CalendarClock className="mr-1 h-3.5 w-3.5" />
                      Agendar próxima
                    </Button>
                  </div>
                );
              })}
              {standaloneToSchedule.slice(0, 8).map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between gap-2 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {action.descricao}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Ação avulsa · {action.area}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAgendarAvulsa(action)}
                  >
                    <CalendarClock className="mr-1 h-3.5 w-3.5" />
                    Agendar
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {overdue.length > 0 && (
          <section>
            <TaskList
              title="Ações atrasadas"
              icon={<CircleAlert className="h-4 w-4 text-[var(--color-red)]" />}
              tasks={overdue}
              onToggle={(id, value) => toggle.mutate({ id, concluida: value })}
            />
          </section>
        )}

        <NovoPlanoModal open={novoOpen} onOpenChange={setNovoOpen} />
        <NovoCompromissoModal
          open={compromissoOpen}
          onOpenChange={setCompromissoOpen}
          dataInicial={compromissoData}
        />
        <AgendarAcaoModal
          open={!!agendar}
          onOpenChange={(v) => !v && setAgendar(null)}
          tarefa={agendar?.tarefa ?? null}
          dataInicial={agendar?.data}
          dataMin={queryStart}
          dataMax={queryEnd}
          agendamentoId={agendar?.agendamentoId}
          horaInicial={agendar?.hora}
          duracaoInicial={agendar?.duracao}
          agendadasNaSemana={
            agendar
              ? progressoAgenda(agendar.tarefa, agendar.data).agendadas
              : 0
          }
          execucoesNecessarias={
            agendar
              ? progressoAgenda(agendar.tarefa, agendar.data).necessarias
              : 1
          }
        />
        <AgendarAcaoAvulsaModal
          open={!!agendarAvulsa}
          onOpenChange={(value) => !value && setAgendarAvulsa(null)}
          action={agendarAvulsa}
        />
        <EventoCalendarioModal
          open={!!eventoSelecionado}
          onOpenChange={(value) => !value && setEventoSelecionado(null)}
          evento={eventoSelecionado}
          onReagendarPlano={(agendamento, tarefa) =>
            setAgendar({
              tarefa,
              data: agendamento.data,
              agendamentoId: agendamento.id,
              hora: hhmm(agendamento.hora_inicio),
              duracao: agendamento.duracao_minutos,
            })
          }
          onReagendarAvulsa={setAgendarAvulsa}
        />
      </div>
    </AppShell>
  );
}

function CalendarMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "red" | "accent";
}) {
  const color =
    tone === "red"
      ? "var(--color-red)"
      : tone === "accent"
        ? "var(--brand-accent)"
        : "var(--brand-primary)";
  return (
    <div className="performance-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="font-display mt-1 text-3xl font-semibold"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
function TaskList({
  title,
  icon,
  tasks,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: CalendarTask[];
  onToggle: (id: string, value: boolean) => void;
}) {
  return (
    <div className="performance-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      <div className="divide-y">
        {tasks.slice(0, 6).map((task) => (
          <label
            key={task.id}
            className="flex cursor-pointer items-start gap-3 py-3"
          >
            <Checkbox
              checked={task.concluida}
              onCheckedChange={(v) => onToggle(task.id, v === true)}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium">{task.descricao}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {task.plano}
                {task.prazo
                  ? ` · ${new Date(`${task.prazo}T12:00:00`).toLocaleDateString("pt-BR")}`
                  : ""}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
