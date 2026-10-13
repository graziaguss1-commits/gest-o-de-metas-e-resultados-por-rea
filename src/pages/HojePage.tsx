import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarCheck,
  CheckCircle2,
  CircleSlash,
  Circle,
  Loader2,
  Pause,
  Play,
  Star,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GradeHoras } from "@/components/hoje/GradeHoras";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgendaPeriodo, type BlocoAgendaDia } from "@/hooks/useAgendaDoDia";
import {
  useAlternarCronometroAgendamento,
  useFinalizarCronometroAgendamento,
  useReagendarTarefa,
} from "@/hooks/useAgendamentos";
import { useMigrarPlanejamentoLocal, usePlanejamentoSemanal } from "@/hooks/usePlanejamentoSemanal";
import { useMotivosBloco, useRegistrarMotivo } from "@/hooks/useMotivosBloco";
import { chaveMotivo, exigeTexto, MOTIVO_LABEL, MOTIVOS, naoExecutado, referenciaBloco, type MotivoId } from "@/lib/motivos";
import { useScheduleAction, useToggleAction } from "@/hooks/useActions";
import { useAtualizarCompromisso } from "@/hooks/useCompromissos";
import {
  usePlanos,
  useRegistrarExecucao,
  useToggleTarefa,
} from "@/hooks/usePlanos";
import {
  formatCronometro,
  horarioEmMinutos,
  minutosReaisDoCronometro,
  segundosDoCronometro,
} from "@/lib/agenda";
import { getFrequencia, quantidadePorExecucao } from "@/lib/execucao";
import {
  cumprimentoAgenda,
  escolherPrioridadeDoDia,
  isoLocal,
  segundaDaSemana,
} from "@/lib/hoje";

const TIMER_LOCAL = (id: string) => `hoje-timer-${id}`;

function useAgora(intervaloMs = 1000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), intervaloMs);
    return () => window.clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

export default function HojePage() {
  const agora = useAgora();
  const hojeISO = isoLocal(agora);
  const segunda = useMemo(() => segundaDaSemana(new Date(`${hojeISO}T12:00:00`)), [hojeISO]);
  const segundaISO = isoLocal(segunda);
  const domingoISO = isoLocal(new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6));

  const { blocos, isLoading } = useAgendaPeriodo(segundaISO, domingoISO);
  const { data: planos = [] } = usePlanos();
  useMigrarPlanejamentoLocal();
  const { data: planejamento } = usePlanejamentoSemanal(segundaISO);
  const prioridadesTop = useMemo(() => planejamento?.priorityIds ?? [], [planejamento]);

  // Tudo que ocupa o dia, inclusive os horários vindos do Google: a grade
  // precisa mostrá-los, senão um compromisso de fora some da tela.
  const blocosDoDia = useMemo(
    () => blocos.filter((b) => b.data === hojeISO),
    [blocos, hojeISO],
  );
  // Só os blocos próprios entram em métrica, prioridade e motivo.
  const blocosHoje = useMemo(
    () => blocosDoDia.filter((b) => b.tipo !== "google"),
    [blocosDoDia],
  );
  const ocupadosGoogle = blocosDoDia.length - blocosHoje.length;
  const metrica = cumprimentoAgenda(blocos, agora);
  const blocosPerdidos = blocosHoje.filter((b) => naoExecutado(b, agora));
  const { data: motivos } = useMotivosBloco(hojeISO, hojeISO);
  const semMotivo = blocosPerdidos.filter((b) => {
    const ref = referenciaBloco(b);
    return !ref || !motivos?.get(chaveMotivo(ref, b.data));
  }).length;
  const registrarMotivo = useRegistrarMotivo();
  const [obs, setObs] = useState<Record<string, string>>({});
  const [obsAberta, setObsAberta] = useState<string | null>(null);
  const [outroAberto, setOutroAberto] = useState<string | null>(null);
  const [blocoAberto, setBlocoAberto] = useState<string | null>(null);
  const escolherMotivo = (bloco: BlocoAgendaDia, motivo: MotivoId) => {
    const referencia = referenciaBloco(bloco);
    if (!referencia) return;
    const observacao = obs[bloco.id]?.trim();
    // "Outro" sem texto não explica nada, e o banco rejeita.
    if (exigeTexto(motivo) && !observacao) {
      toast.error("Escreva o motivo para salvar como Outro.");
      return;
    }
    registrarMotivo.mutate(
      { referencia, data: bloco.data, motivo, observacao },
      {
        onSuccess: () => {
          toast.success(`Motivo registrado: ${MOTIVO_LABEL[motivo]}.`);
          setOutroAberto(null);
          setObsAberta(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível registrar o motivo."),
      },
    );
  };
  const prioridade = escolherPrioridadeDoDia(blocosHoje, prioridadesTop, agora);

  const taskById = useMemo(() => {
    const mapa = new Map<string, (typeof planos)[number]["tarefas"][number]>();
    planos.forEach((p) => p.tarefas.forEach((t) => mapa.set(t.id, t)));
    return mapa;
  }, [planos]);

  const alternarCronometro = useAlternarCronometroAgendamento();
  const finalizarCronometro = useFinalizarCronometroAgendamento();
  const registrarExecucao = useRegistrarExecucao();
  const toggleTarefa = useToggleTarefa();
  const toggleAction = useToggleAction();
  const atualizarCompromisso = useAtualizarCompromisso();
  const reagendarTarefa = useReagendarTarefa();
  const remarcarAvulsa = useScheduleAction();
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [remarcando, setRemarcando] = useState<{ id: string; data: string; hora: string } | null>(null);
  const [timersLocais, setTimersLocais] = useState<Record<string, number>>({});
  const amanhaISO = isoLocal(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));

  const inicioLocal = (id: string) => {
    if (timersLocais[id]) return timersLocais[id];
    const salvo = Number(localStorage.getItem(TIMER_LOCAL(id)));
    return Number.isFinite(salvo) && salvo > 0 ? salvo : null;
  };

  const marcarFeito = async (bloco: BlocoAgendaDia) => {
    setConcluindoId(bloco.id);
    try {
      if (bloco.tipo === "plano" && bloco.agendamento) {
        if (bloco.concluido) return;
        const tarefa = bloco.tarefaId ? taskById.get(bloco.tarefaId) : undefined;
        if (!tarefa) throw new Error("Ação do plano não encontrada.");
        const segundos = segundosDoCronometro(bloco.agendamento);
        if (bloco.agendamento.cronometro_iniciado_em || segundos > 0) {
          await finalizarCronometro.mutateAsync({ id: bloco.agendamento.id, segundos });
        }
        await registrarExecucao.mutateAsync({
          tarefaId: tarefa.id,
          agendamentoId: bloco.agendamento.id,
          quantidade: quantidadePorExecucao(tarefa),
          data: bloco.data,
          tempoRealMinutos: minutosReaisDoCronometro(segundos),
        });
        if (getFrequencia(tarefa) === "unica" && !tarefa.concluida) {
          await toggleTarefa.mutateAsync({ id: tarefa.id, concluida: true });
        }
      } else if (bloco.tipo === "avulsa") {
        await toggleAction.mutateAsync({ id: bloco.origemId, concluida: !bloco.concluido });
      } else if (bloco.tipo === "compromisso") {
        await atualizarCompromisso.mutateAsync({ id: bloco.origemId, concluido: !bloco.concluido });
      }
      localStorage.removeItem(TIMER_LOCAL(bloco.id));
      if (!bloco.concluido) toast.success("Bloco marcado como feito.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível marcar como feito.");
    } finally {
      setConcluindoId(null);
    }
  };

  /**
   * Tarefa única precisa ser refeita; rotina volta sozinha no próximo dia.
   * Compromisso fica de fora: o bloco não carrega a recorrência, e remarcar
   * um compromisso recorrente moveria a série inteira.
   */
  const ehTarefaUnica = (bloco: BlocoAgendaDia) => {
    if (bloco.tipo === "avulsa") return true;
    if (bloco.tipo !== "plano" || !bloco.tarefaId) return false;
    const tarefa = taskById.get(bloco.tarefaId);
    return tarefa ? getFrequencia(tarefa) === "unica" : false;
  };

  const confirmarRemarcacao = async (bloco: BlocoAgendaDia) => {
    if (!remarcando || remarcando.id !== bloco.id) return;
    const duracao = Math.max(
      5,
      horarioEmMinutos(bloco.fim) - horarioEmMinutos(bloco.inicio),
    );
    const entrada = {
      id: bloco.origemId,
      data: remarcando.data,
      horaInicio: remarcando.hora,
      duracaoMinutos: duracao,
    };
    try {
      if (bloco.tipo === "plano") await reagendarTarefa.mutateAsync(entrada);
      else await remarcarAvulsa.mutateAsync(entrada);
      toast.success("Bloco remarcado.");
      setRemarcando(null);
      setBlocoAberto(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remarcar.");
    }
  };

  /** Arrastar um bloco para outro horário do mesmo dia, como no Calendário. */
  const moverBloco = async (bloco: BlocoAgendaDia, hora: string) => {
    if (bloco.tipo === "google" || hora === bloco.inicio) return;
    const duracao = Math.max(
      5,
      horarioEmMinutos(bloco.fim) - horarioEmMinutos(bloco.inicio),
    );
    try {
      if (bloco.tipo === "plano") {
        await reagendarTarefa.mutateAsync({
          id: bloco.origemId,
          data: bloco.data,
          horaInicio: hora,
          duracaoMinutos: duracao,
        });
      } else if (bloco.tipo === "avulsa") {
        await remarcarAvulsa.mutateAsync({
          id: bloco.origemId,
          data: bloco.data,
          horaInicio: hora,
          duracaoMinutos: duracao,
        });
      } else {
        const fim = horarioEmMinutos(hora) + duracao;
        await atualizarCompromisso.mutateAsync({
          id: bloco.origemId,
          data: bloco.data,
          hora_inicio: hora,
          hora_fim: `${String(Math.floor(fim / 60)).padStart(2, "0")}:${String(fim % 60).padStart(2, "0")}`,
        });
      }
      setBlocoAberto(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível mover o bloco.");
    }
  };

  const alternarTimer = (bloco: BlocoAgendaDia) => {
    if (bloco.tipo === "plano" && bloco.agendamento) {
      alternarCronometro.mutate(bloco.agendamento, {
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível iniciar."),
      });
      return;
    }
    const atual = inicioLocal(bloco.id);
    if (atual) {
      localStorage.removeItem(TIMER_LOCAL(bloco.id));
      setTimersLocais(({ [bloco.id]: _, ...resto }) => resto);
    } else {
      const inicio = Date.now();
      localStorage.setItem(TIMER_LOCAL(bloco.id), String(inicio));
      setTimersLocais((t) => ({ ...t, [bloco.id]: inicio }));
    }
  };

  const dataFormatada = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">Hoje</div>
            <h1 className="font-display text-2xl font-semibold capitalize">{dataFormatada}</h1>
          </div>
          <div className="rounded-2xl border bg-card px-4 py-3 text-right" title="Blocos feitos ÷ blocos da semana cujo horário já terminou">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cumprimento da agenda da semana</div>
            <div className="font-display text-2xl font-semibold tabular-nums">{isLoading ? "—" : metrica.pct == null ? "—" : `${metrica.pct}%`}</div>
            <div className="text-[11px] text-muted-foreground">{metrica.feitos} de {metrica.total} blocos que já passaram</div>
          </div>
        </header>

        {isLoading ? (
          <Skeleton className="h-44 w-full rounded-2xl" />
        ) : prioridade ? (
          <PrioridadeCard
            bloco={prioridade.bloco}
            ehTop={prioridade.ehTop}
            agora={agora}
            inicioLocal={inicioLocal(prioridade.bloco.id)}
            pendente={alternarCronometro.isPending || concluindoId === prioridade.bloco.id}
            onTimer={() => alternarTimer(prioridade.bloco)}
            onFeito={() => marcarFeito(prioridade.bloco)}
          />
        ) : (
          <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-[var(--color-green)]" />
            <p className="mt-2 text-sm font-semibold">
              {blocosHoje.length ? "Tudo feito por hoje." : "Nenhum bloco planejado para hoje."}
            </p>
            {!blocosHoje.length && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/planejamento-semanal"><CalendarCheck className="mr-1.5 h-4 w-4" />Planejar a semana</Link>
              </Button>
            )}
          </div>
        )}

        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Agenda de hoje</h2>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {ocupadosGoogle > 0 && <span>{ocupadosGoogle} ocupado(s) no Google</span>}
              {semMotivo > 0 && (
                <span className="flex items-center gap-1 font-semibold text-[var(--color-amber)]">
                  <CircleSlash className="h-3.5 w-3.5" />
                  {semMotivo} sem motivo
                </span>
              )}
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : blocosDoDia.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem blocos hoje.</p>
          ) : (
            <>
              <GradeHoras
                blocos={blocosDoDia}
                agora={agora}
                abertoId={blocoAberto}
                onAbrir={setBlocoAberto}
                onMover={moverBloco}
                renderBloco={(bloco, { aberto }) => {
                  const ref = referenciaBloco(bloco);
                  const motivo = ref ? motivos?.get(chaveMotivo(ref, bloco.data)) : undefined;
                  const perdido = naoExecutado(bloco, agora);
                  const ehTop = prioridadesTop.includes(bloco.tarefaId ?? "");
                  const bloqueado = bloco.tipo === "plano" && bloco.concluido;
                  // Cronômetro: tarefa de plano guarda no banco e atravessa
                  // dispositivos; avulsa e compromisso contam só neste navegador.
                  const inicio = inicioLocal(bloco.id);
                  const segundos = bloco.agendamento
                    ? segundosDoCronometro(bloco.agendamento, agora.getTime())
                    : inicio
                      ? Math.floor((agora.getTime() - inicio) / 1000)
                      : 0;
                  const timerAtivo = bloco.agendamento
                    ? Boolean(bloco.agendamento.cronometro_iniciado_em)
                    : Boolean(inicio);
                  const minutosMedidos = minutosReaisDoCronometro(segundos);
                  return (
                    <>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-semibold ${aberto ? "" : "truncate"} ${bloco.concluido ? "line-through opacity-70" : ""}`}>
                            {bloco.titulo}
                          </div>
                          <div className={`text-[10px] text-muted-foreground ${aberto ? "" : "truncate"}`}>
                            {bloco.inicio}–{bloco.fim}
                            {ehTop && " · prioridade top"}
                            {bloco.tipo === "google" && " · Google Agenda"}
                          </div>
                        </div>
                        {timerAtivo ? (
                          <span className="shrink-0 text-[11px] font-bold tabular-nums text-[var(--brand-accent)]">
                            {formatCronometro(segundos)}
                          </span>
                        ) : bloco.concluido && minutosMedidos ? (
                          <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                            {minutosMedidos} min
                          </span>
                        ) : null}
                        {aberto && (
                          <button
                            type="button"
                            aria-label="Fechar bloco"
                            className="-mr-1 -mt-0.5 shrink-0 rounded-full px-1.5 text-sm leading-none text-muted-foreground hover:text-foreground"
                            onClick={() => setBlocoAberto(null)}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {aberto && motivo && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5" />{MOTIVO_LABEL[motivo]}
                        </span>
                      )}

                      {aberto && perdido && !motivo && (
                        <div className="mt-2 space-y-2">
                          <p className="text-[11px] text-muted-foreground">O horário passou. O que aconteceu?</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {MOTIVOS.map((m) => (
                              <Button
                                key={m.id}
                                size="sm"
                                variant={exigeTexto(m.id) && outroAberto === bloco.id ? "default" : "outline"}
                                className="h-7 px-2.5 text-[11px]"
                                disabled={registrarMotivo.isPending}
                                onClick={() =>
                                  exigeTexto(m.id)
                                    ? (setOutroAberto(bloco.id), setObsAberta(bloco.id))
                                    : escolherMotivo(bloco, m.id)
                                }
                              >
                                {m.label}
                              </Button>
                            ))}
                          </div>
                          {obsAberta === bloco.id || outroAberto === bloco.id ? (
                            <div className="space-y-1.5">
                              <input
                                autoFocus
                                maxLength={500}
                                placeholder={outroAberto === bloco.id ? "Qual foi o motivo" : "Observação (opcional)"}
                                value={obs[bloco.id] ?? ""}
                                onChange={(e) => setObs((o) => ({ ...o, [bloco.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && outroAberto === bloco.id) escolherMotivo(bloco, "outro");
                                }}
                                className="h-7 w-full rounded-md border bg-background px-2 text-[11px]"
                              />
                              {outroAberto === bloco.id && (
                                <Button
                                  size="sm"
                                  className="h-7 px-2.5 text-[11px]"
                                  disabled={!obs[bloco.id]?.trim() || registrarMotivo.isPending}
                                  onClick={() => escolherMotivo(bloco, "outro")}
                                >
                                  Salvar motivo
                                </Button>
                              )}
                            </div>
                          ) : (
                            <button type="button" className="text-[11px] text-muted-foreground underline-offset-2 hover:underline" onClick={() => setObsAberta(bloco.id)}>+ observação</button>
                          )}
                        </div>
                      )}

                      {aberto && !bloqueado && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 gap-1.5 px-2.5 text-[11px]"
                            disabled={alternarCronometro.isPending}
                            onClick={() => alternarTimer(bloco)}
                          >
                            {timerAtivo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            {timerAtivo ? "Pausar" : segundos > 0 ? "Continuar" : "Iniciar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 px-2.5 text-[11px]"
                            disabled={concluindoId === bloco.id}
                            onClick={() => marcarFeito(bloco)}
                          >
                            {concluindoId === bloco.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Circle className="h-3.5 w-3.5" />}
                            {perdido ? "Fiz depois" : "Concluir"}
                          </Button>
                        </div>
                      )}

                      {aberto && perdido && !bloco.concluido && (
                        <div className="mt-2 border-t pt-2">
                          {!ehTarefaUnica(bloco) ? (
                            <p className="text-[11px] text-muted-foreground">
                              Rotina: volta sozinha no próximo dia. Segue como não cumprida no gráfico e no % da meta.
                            </p>
                          ) : remarcando?.id === bloco.id ? (
                            <div className="space-y-1.5">
                              <p className="text-[11px] text-muted-foreground">Tarefa única: continua pendente até ser feita.</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <input
                                  type="date"
                                  min={hojeISO}
                                  value={remarcando.data}
                                  onChange={(e) => setRemarcando((r) => (r ? { ...r, data: e.target.value } : r))}
                                  className="h-7 rounded-md border bg-background px-2 text-[11px]"
                                />
                                <input
                                  type="time"
                                  value={remarcando.hora}
                                  onChange={(e) => setRemarcando((r) => (r ? { ...r, hora: e.target.value } : r))}
                                  className="h-7 rounded-md border bg-background px-2 text-[11px]"
                                />
                                <Button
                                  size="sm"
                                  className="h-7 px-2.5 text-[11px]"
                                  disabled={!remarcando.data || !remarcando.hora || reagendarTarefa.isPending || remarcarAvulsa.isPending}
                                  onClick={() => confirmarRemarcacao(bloco)}
                                >
                                  Confirmar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setRemarcando(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[11px] text-muted-foreground">Tarefa única: continua pendente até ser feita.</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1.5 px-2.5 text-[11px]"
                                onClick={() => setRemarcando({ id: bloco.id, data: amanhaISO, hora: bloco.inicio })}
                              >
                                <CalendarCheck className="h-3.5 w-3.5" />Remarcar
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                }}
              />
              <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
                Toque num bloco para abrir, arraste para mudar o horário. Registrar o motivo explica o que houve, mas não marca o bloco como feito.
              </p>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function PrioridadeCard({
  bloco,
  ehTop,
  agora,
  inicioLocal,
  pendente,
  onTimer,
  onFeito,
}: {
  bloco: BlocoAgendaDia;
  ehTop: boolean;
  agora: Date;
  inicioLocal: number | null;
  pendente: boolean;
  onTimer: () => void;
  onFeito: () => void;
}) {
  const duracaoSeg = Math.max(0, (horarioEmMinutos(bloco.fim) - horarioEmMinutos(bloco.inicio)) * 60);
  const ativo = bloco.agendamento ? Boolean(bloco.agendamento.cronometro_iniciado_em) : Boolean(inicioLocal);
  const decorrido = bloco.agendamento
    ? segundosDoCronometro(bloco.agendamento, agora.getTime())
    : inicioLocal
      ? Math.floor((agora.getTime() - inicioLocal) / 1000)
      : 0;
  const restante = duracaoSeg - decorrido;
  const pct = duracaoSeg ? Math.min(100, (decorrido / duracaoSeg) * 100) : 0;
  const iniciado = ativo || decorrido > 0;

  return (
    <section className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">
        {ehTop ? <Star className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
        {ehTop ? "Prioridade top do dia" : "Próximo bloco"}
      </div>
      <h2 className="mt-1 font-display text-xl font-semibold">{bloco.titulo}</h2>
      <p className="text-xs text-muted-foreground">{bloco.inicio}–{bloco.fim} · {bloco.detalhe}</p>

      {iniciado && (
        <div className="mt-4">
          <div className="flex items-end justify-between gap-4 tabular-nums">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Já passou</div>
              <div className="font-display text-3xl font-semibold">{formatCronometro(decorrido)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{restante >= 0 ? "Falta para o fim do bloco" : "Passou do bloco"}</div>
              <div className={`font-display text-3xl font-semibold ${restante < 0 ? "text-[var(--color-red)]" : ""}`}>{formatCronometro(Math.abs(restante))}</div>
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full transition-all ${restante < 0 ? "bg-[var(--color-red)]" : "bg-[var(--brand-primary)]"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {iniciado && (bloco.primeiroPasso || bloco.versaoMinima) && (
        <div className="mt-4 space-y-2 rounded-xl border bg-muted/40 p-3">
          {bloco.primeiroPasso && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">Primeiro passo (2 min)</div>
              <p className="text-sm font-medium">{bloco.primeiroPasso}</p>
            </div>
          )}
          {bloco.versaoMinima && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Versão mínima aceitável</div>
              <p className="text-sm font-medium">{bloco.versaoMinima}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="brand-button gap-2" disabled={pendente} onClick={onTimer}>
          {ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {ativo ? "Pausar" : iniciado ? "Continuar" : "Começar"}
        </Button>
        <Button variant="outline" className="gap-2" disabled={pendente} onClick={onFeito}>
          <CheckCircle2 className="h-4 w-4" />Marcar feito
        </Button>
      </div>
    </section>
  );
}
