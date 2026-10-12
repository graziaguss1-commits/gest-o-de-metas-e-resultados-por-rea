import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  Loader2,
  Pause,
  Play,
  Star,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgendaPeriodo, type BlocoAgendaDia } from "@/hooks/useAgendaDoDia";
import {
  useAlternarCronometroAgendamento,
  useFinalizarCronometroAgendamento,
} from "@/hooks/useAgendamentos";
import { useMigrarPlanejamentoLocal, usePlanejamentoSemanal } from "@/hooks/usePlanejamentoSemanal";
import { useToggleAction } from "@/hooks/useActions";
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
  fimDoBloco,
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

  const blocosHoje = useMemo(
    () => blocos.filter((b) => b.data === hojeISO && b.tipo !== "google"),
    [blocos, hojeISO],
  );
  const ocupadosGoogle = blocos.filter((b) => b.data === hojeISO && b.tipo === "google").length;
  const metrica = cumprimentoAgenda(blocos, agora);
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
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [timersLocais, setTimersLocais] = useState<Record<string, number>>({});

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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Blocos de hoje</h2>
            {ocupadosGoogle > 0 && <span className="text-[11px] text-muted-foreground">+{ocupadosGoogle} ocupado(s) no Google</span>}
          </div>
          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : blocosHoje.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem blocos hoje.</p>
          ) : (
            <ul className="space-y-2">
              {blocosHoje.map((bloco) => {
                const passou = fimDoBloco(bloco).getTime() <= agora.getTime();
                const agoraNele = !passou && horarioEmMinutos(bloco.inicio) <= agora.getHours() * 60 + agora.getMinutes();
                const bloqueado = bloco.tipo === "plano" && bloco.concluido;
                return (
                  <li key={bloco.id} className={`flex items-center gap-3 rounded-xl border p-3 ${bloco.concluido ? "border-[var(--color-green)]/40 bg-[var(--color-green-bg)]" : agoraNele ? "border-[var(--brand-accent)]" : ""}`}>
                    <div className="w-24 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{bloco.inicio}–{bloco.fim}</div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm font-semibold ${bloco.concluido ? "line-through opacity-70" : ""}`}>{bloco.titulo}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {bloco.detalhe}
                        {prioridadesTop.includes(bloco.tarefaId ?? "") && " · prioridade top"}
                        {!bloco.concluido && passou && " · horário passou"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={bloco.concluido ? "ghost" : "outline"}
                      disabled={bloqueado || concluindoId === bloco.id}
                      onClick={() => marcarFeito(bloco)}
                      className="shrink-0 gap-1.5"
                    >
                      {concluindoId === bloco.id ? <Loader2 className="h-4 w-4 animate-spin" /> : bloco.concluido ? <CheckCircle2 className="h-4 w-4 text-[var(--color-green)]" /> : <Circle className="h-4 w-4" />}
                      {bloco.concluido ? "Feito" : "Marcar feito"}
                    </Button>
                  </li>
                );
              })}
            </ul>
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
