import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanos, useToggleTarefa, type PlanoWithMeta } from "@/hooks/usePlanos";
import { useAgendamentos, useRemoverAgendamento } from "@/hooks/useAgendamentos";
import { useAppSettings } from "@/hooks/useAppSettings";
import { NovoPlanoModal } from "@/components/planos/NovoPlanoModal";
import { AgendarAcaoModal } from "@/components/planos/AgendarAcaoModal";
import { RegistrarRealizadoModal } from "@/components/planos/RegistrarRealizadoModal";
import { capacidadeDoDia, formatTotalHoras, hhmm, horaFim, totalSemana } from "@/lib/agenda";
import type { Tarefa } from "@/lib/metas";

type CalendarTask = PlanoWithMeta["tarefas"][number] & { plano: string; area: string; meta: string | null };

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
};
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, amount: number) => { const d = new Date(date); d.setDate(d.getDate() + amount); return d; };

export default function CalendarPage() {
  const { data: planos, isLoading } = usePlanos();
  const { data: settings } = useAppSettings();
  const toggle = useToggleTarefa();
  const remover = useRemoverAgendamento();
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [novoOpen, setNovoOpen] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)), [anchor]);
  const { data: agendamentos = [] } = useAgendamentos(iso(days[0]), iso(days[6]));

  const [agendar, setAgendar] = useState<{ tarefa: Tarefa; data?: string; agendamentoId?: string; hora?: string; duracao?: number | null } | null>(null);
  const [registrar, setRegistrar] = useState<{ tarefa: Tarefa; data: string } | null>(null);

  const capacidade = settings?.capacidade_diaria_minutos ?? 480;
  const tasks = useMemo<CalendarTask[]>(() => (planos ?? []).flatMap((plano) => plano.tarefas.map((task) => ({ ...task, plano: plano.titulo, area: plano.meta?.area ?? "Sem área", meta: plano.meta?.nome ?? null }))), [planos]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const overdue = tasks.filter((task) => !task.concluida && task.prazo && task.prazo < iso(new Date()));
  const withoutDate = tasks.filter((task) => !task.concluida && !task.prazo);
  const weekLabel = `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
  const minutosSemana = totalSemana(days.map(iso), agendamentos);

  return <AppShell><div className="performance-page space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="eyebrow mb-2">AGENDA E EXECUÇÃO</div><h1 className="font-display text-3xl font-semibold">Calendário estratégico</h1><p className="mt-1 text-sm text-muted-foreground">Programe suas ações por horário e veja se cabem no tempo disponível.</p></div><Button onClick={() => setNovoOpen(true)} className="brand-button"><Plus className="mr-2 h-4 w-4" />Novo plano</Button></header>

    <section className="grid gap-3 sm:grid-cols-4">
      <CalendarMetric label="Ações agendadas" value={String(agendamentos.length)} tone="primary" />
      <CalendarMetric label="Tempo planejado na semana" value={formatTotalHoras(minutosSemana)} tone="accent" />
      <CalendarMetric label="Atrasadas (prazo)" value={String(overdue.length)} tone="red" />
      <CalendarMetric label="Sem data" value={String(withoutDate.length)} tone="accent" />
    </section>

    <div className="performance-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Semana selecionada</div><div className="mt-1 font-display text-lg font-semibold capitalize">{weekLabel}</div><div className="text-xs text-muted-foreground">Capacidade diária configurada: {formatTotalHoras(capacidade)}</div></div><div className="flex items-center gap-1"><Button size="icon" variant="outline" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setAnchor(startOfWeek(new Date()))}>Hoje</Button><Button size="icon" variant="outline" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight className="h-4 w-4" /></Button></div></div>
      {isLoading ? <Skeleton className="h-[440px] w-full" /> : <div className="grid min-w-[900px] grid-cols-7 divide-x overflow-x-auto">
        {days.map((day) => {
          const dia = iso(day);
          const blocos = agendamentos.filter((a) => a.data === dia).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
          const semHora = tasks.filter((task) => task.prazo === dia);
          const cap = capacidadeDoDia(dia, agendamentos, capacidade);
          const today = dia === iso(new Date());
          return <div key={dia} className={`min-h-[430px] p-3 ${today ? "bg-[var(--brand-accent-soft)]/40" : ""}`}>
            <div className="mb-3 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</div><div className={`font-display text-2xl font-semibold ${today ? "text-[var(--brand-accent)]" : ""}`}>{day.getDate()}</div></div>{today && <span className="rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-[9px] font-bold uppercase text-white">Hoje</span>}</div>

            <div className={`mb-3 rounded-lg px-2 py-1.5 text-[10px] ${cap.sobrecarga ? "bg-[var(--color-red-bg,rgba(239,68,68,0.12))] text-[var(--color-red)]" : "bg-muted text-muted-foreground"}`}>
              <div className="font-semibold">{formatTotalHoras(cap.planejado)} planejadas</div>
              <div>{cap.sobrecarga ? `Sobrecarga: ${formatTotalHoras(cap.planejado - cap.capacidade)} acima da capacidade` : `${formatTotalHoras(cap.disponivel)} disponíveis`}</div>
            </div>

            <div className="space-y-2">
              {blocos.length === 0 && semHora.length === 0 && <div className="rounded-xl border border-dashed p-3 text-center text-[11px] text-muted-foreground">Sem ações</div>}
              {blocos.map((bloco) => {
                const task = taskById.get(bloco.tarefa_id);
                if (!task) return null;
                return <div key={bloco.id} className="rounded-xl border bg-card p-2.5">
                  <div className="text-[11px] font-bold tabular-nums text-[var(--brand-primary)]">{hhmm(bloco.hora_inicio)}–{horaFim(hhmm(bloco.hora_inicio), bloco.duracao_minutos)}</div>
                  <div className="mt-0.5 text-xs font-semibold leading-snug">{task.descricao}</div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{task.area}{task.meta ? ` · ${task.meta}` : ""}</div>
                  <div className="mt-2 flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px]" onClick={() => setRegistrar({ tarefa: task, data: bloco.data })}><CheckCircle2 className="mr-1 h-3 w-3" />Registrar</Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" title="Reagendar" onClick={() => setAgendar({ tarefa: task, data: bloco.data, agendamentoId: bloco.id, hora: hhmm(bloco.hora_inicio), duracao: bloco.duracao_minutos })}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" title="Remover do calendário" onClick={async () => { try { await remover.mutateAsync(bloco.id); toast.success("Ocorrência removida"); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao remover"); } }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>;
              })}
              {semHora.map((task) => <div key={task.id} className={`rounded-xl border border-dashed p-2.5 ${task.concluida ? "bg-muted/50 opacity-65" : "bg-card"}`}>
                <div className="flex items-start gap-2"><Checkbox checked={task.concluida} onCheckedChange={(v) => toggle.mutate({ id: task.id, concluida: v === true })} className="mt-0.5" /><div className="min-w-0"><div className={`text-xs font-semibold leading-snug ${task.concluida ? "line-through" : ""}`}>{task.descricao}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Prazo · {task.area}</div></div></div>
                <Button size="sm" variant="ghost" className="mt-1.5 h-6 px-1.5 text-[10px]" onClick={() => setAgendar({ tarefa: task, data: dia })}><CalendarClock className="mr-1 h-3 w-3" />Definir horário</Button>
              </div>)}
            </div>
          </div>;
        })}
      </div>}
    </div>

    <section className="performance-card p-4">
      <h2 className="font-display text-lg font-semibold">Ações disponíveis para agendar</h2>
      <p className="text-xs text-muted-foreground">Escolha uma ação e posicione em data e horário. Sem duração estimada, o app pede a duração antes de agendar.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {tasks.filter((t) => !t.concluida).slice(0, 8).map((t) => <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
          <div className="min-w-0"><div className="truncate text-sm font-medium">{t.descricao}</div><div className="text-xs text-muted-foreground">{t.plano} · {t.duracao_minutos ? `${t.duracao_minutos} min por execução` : "sem duração estimada"}</div></div>
          <Button size="sm" variant="outline" onClick={() => setAgendar({ tarefa: t, data: iso(new Date()) })}><CalendarClock className="mr-1 h-3.5 w-3.5" />Agendar</Button>
        </div>)}
      </div>
    </section>

    {(overdue.length > 0 || withoutDate.length > 0) && <section className="grid gap-4 lg:grid-cols-2">{overdue.length > 0 && <TaskList title="Ações atrasadas" icon={<CircleAlert className="h-4 w-4 text-[var(--color-red)]" />} tasks={overdue} onToggle={(id, value) => toggle.mutate({ id, concluida: value })} />}{withoutDate.length > 0 && <TaskList title="Ações sem data" icon={<CircleAlert className="h-4 w-4 text-[var(--brand-accent)]" />} tasks={withoutDate} onToggle={(id, value) => toggle.mutate({ id, concluida: value })} />}</section>}

    <NovoPlanoModal open={novoOpen} onOpenChange={setNovoOpen} />
    <AgendarAcaoModal open={!!agendar} onOpenChange={(v) => !v && setAgendar(null)} tarefa={agendar?.tarefa ?? null} dataInicial={agendar?.data} agendamentoId={agendar?.agendamentoId} horaInicial={agendar?.hora} duracaoInicial={agendar?.duracao} />
    <RegistrarRealizadoModal open={!!registrar} onOpenChange={(v) => !v && setRegistrar(null)} tarefa={registrar?.tarefa ?? null} dataInicial={registrar?.data} />
  </div></AppShell>;
}

function CalendarMetric({ label, value, tone }: { label: string; value: string; tone: "primary" | "red" | "accent" }) { const color = tone === "red" ? "var(--color-red)" : tone === "accent" ? "var(--brand-accent)" : "var(--brand-primary)"; return <div className="performance-card p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-display mt-1 text-3xl font-semibold" style={{ color }}>{value}</div></div>; }
function TaskList({ title, icon, tasks, onToggle }: { title: string; icon: React.ReactNode; tasks: CalendarTask[]; onToggle: (id: string, value: boolean) => void }) { return <div className="performance-card p-4"><div className="mb-3 flex items-center gap-2"><span>{icon}</span><h2 className="font-display text-lg font-semibold">{title}</h2></div><div className="divide-y">{tasks.slice(0, 6).map((task) => <label key={task.id} className="flex cursor-pointer items-start gap-3 py-3"><Checkbox checked={task.concluida} onCheckedChange={(v) => onToggle(task.id, v === true)} className="mt-0.5" /><div className="min-w-0"><div className="text-sm font-medium">{task.descricao}</div><div className="mt-0.5 text-xs text-muted-foreground">{task.plano}{task.prazo ? ` · ${new Date(`${task.prazo}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</div></div></label>)}</div></div>; }
