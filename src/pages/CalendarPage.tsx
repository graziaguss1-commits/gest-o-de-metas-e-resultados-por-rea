import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Clock3, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanos, useToggleTarefa, type PlanoWithMeta } from "@/hooks/usePlanos";
import { NovoPlanoModal } from "@/components/planos/NovoPlanoModal";

type CalendarTask = PlanoWithMeta["tarefas"][number] & {
  plano: string; area: string; meta: string | null; occurrenceDate: string;
};

const startOfWeek = (date: Date) => {
  const d = new Date(date); const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0, 0, 0, 0); return d;
};
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, amount: number) => { const d = new Date(date); d.setDate(d.getDate() + amount); return d; };
const durationLabel = (minutes?: number | null) => !minutes ? "Sem duração" : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, "0") : ""}`;
const endTime = (start?: string | null, minutes?: number | null) => {
  if (!start || !minutes) return null;
  const [h, m] = start.split(":").map(Number); const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const occursOn = (task: PlanoWithMeta["tarefas"][number], day: Date) => {
  const date = iso(day);
  if (task.data_inicio && date < task.data_inicio) return false;
  if (task.data_fim && date > task.data_fim) return false;
  if (task.frequencia === "diaria") return (task.dias_semana ?? [1,2,3,4,5]).includes(day.getDay());
  if (task.frequencia === "semanal") return day.getDay() === ((task.dias_semana ?? [1])[0] ?? 1);
  if (task.frequencia === "mensal") return day.getDate() === 1;
  return task.prazo === date;
};

export default function CalendarPage() {
  const { data: planos, isLoading } = usePlanos(); const toggle = useToggleTarefa();
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [novoOpen, setNovoOpen] = useState(false); const [capacityHours, setCapacityHours] = useState(8);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)), [anchor]);
  const baseTasks = useMemo(() => (planos ?? []).flatMap((plano) => plano.tarefas.map((task) => ({ ...task, plano: plano.titulo, area: plano.meta?.area ?? "Sem área", meta: plano.meta?.nome ?? null }))), [planos]);
  const tasks = useMemo<CalendarTask[]>(() => days.flatMap((day) => baseTasks.filter((task) => occursOn(task, day)).map((task) => ({ ...task, occurrenceDate: iso(day) }))), [baseTasks, days]);
  const overdue = baseTasks.filter((task) => !task.concluida && task.prazo && task.prazo < iso(new Date()));
  const withoutDate = baseTasks.filter((task) => !task.concluida && task.frequencia === "unica" && !task.prazo);
  const totalWeekMinutes = tasks.reduce((sum, t) => sum + Number(t.duracao_estimada_minutos ?? 0), 0);
  const weekLabel = `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return <AppShell><div className="performance-page space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="eyebrow mb-2">AGENDA E EXECUÇÃO</div><h1 className="font-display text-3xl font-semibold">Calendário estratégico</h1><p className="mt-1 text-sm text-muted-foreground">Reserve blocos reais para executar seus planos de ação.</p></div><Button onClick={() => setNovoOpen(true)} className="brand-button"><Plus className="mr-2 h-4 w-4" />Novo plano</Button></header>
    <section className="grid gap-3 sm:grid-cols-4">
      <CalendarMetric label="Ações da semana" value={String(tasks.length)} tone="primary" />
      <CalendarMetric label="Tempo planejado" value={durationLabel(totalWeekMinutes)} tone="primary" />
      <CalendarMetric label="Atrasadas" value={String(overdue.length)} tone="red" />
      <div className="performance-card p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Capacidade diária</div><div className="mt-2 flex items-center gap-2"><Input type="number" min={1} max={24} value={capacityHours} onChange={(e) => setCapacityHours(Number(e.target.value) || 8)} className="h-8 w-16" /><span className="text-sm">horas</span></div></div>
    </section>
    <div className="performance-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Semana selecionada</div><div className="mt-1 font-display text-lg font-semibold capitalize">{weekLabel}</div></div><div className="flex items-center gap-1"><Button size="icon" variant="outline" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setAnchor(startOfWeek(new Date()))}>Hoje</Button><Button size="icon" variant="outline" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight className="h-4 w-4" /></Button></div></div>
      {isLoading ? <Skeleton className="h-[440px] w-full" /> : <div className="overflow-x-auto"><div className="grid min-w-[900px] grid-cols-7 divide-x">
        {days.map((day) => {
          const dayTasks = tasks.filter((task) => task.occurrenceDate === iso(day)).sort((a,b) => (a.horario_preferencial ?? "99:99").localeCompare(b.horario_preferencial ?? "99:99"));
          const minutes = dayTasks.reduce((sum,t) => sum + Number(t.duracao_estimada_minutos ?? 0), 0);
          const available = capacityHours * 60 - minutes; const overloaded = available < 0; const today = iso(day) === iso(new Date());
          return <div key={iso(day)} className={`min-h-[430px] p-3 ${today ? "bg-[var(--brand-accent-soft)]/40" : ""}`}>
            <div className="mb-3"><div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{day.toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")}</div><div className={`font-display text-2xl font-semibold ${today ? "text-[var(--brand-accent)]" : ""}`}>{day.getDate()}</div></div>{today && <span className="rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-[9px] font-bold uppercase text-white">Hoje</span>}</div>
            <div className={`mt-2 text-[10px] font-semibold ${overloaded ? "text-destructive" : "text-muted-foreground"}`}>{durationLabel(minutes)} planejados · {overloaded ? `${durationLabel(-available)} acima` : `${durationLabel(available)} livres`}</div></div>
            <div className="space-y-2">{dayTasks.length === 0 ? <div className="rounded-xl border border-dashed p-3 text-center text-[11px] text-muted-foreground">Sem ações</div> : dayTasks.map((task) => {
              const end = endTime(task.horario_preferencial, task.duracao_estimada_minutos);
              return <label key={`${task.id}-${task.occurrenceDate}`} className={`block cursor-pointer rounded-xl border p-3 transition hover:shadow-sm ${task.concluida ? "bg-muted/50 opacity-65" : "bg-card"}`}><div className="flex items-start gap-2"><Checkbox checked={task.concluida} onCheckedChange={(v) => toggle.mutate({id:task.id,concluida:v===true})} className="mt-0.5" /><div className="min-w-0"><div className={`text-xs font-semibold leading-snug ${task.concluida ? "line-through" : ""}`}>{task.descricao}</div><div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" />{task.horario_preferencial ? `${task.horario_preferencial.slice(0,5)}${end ? `–${end}` : ""}` : durationLabel(task.duracao_estimada_minutos)}</div><div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">{task.area}</div></div></div></label>;
            })}</div>
          </div>;
        })}
      </div></div>}
    </div>
    {(overdue.length > 0 || withoutDate.length > 0) && <section className="grid gap-4 lg:grid-cols-2">{overdue.length > 0 && <SimpleList title="Ações atrasadas" tasks={overdue} />}{withoutDate.length > 0 && <SimpleList title="Ações sem data" tasks={withoutDate} />}</section>}
    <NovoPlanoModal open={novoOpen} onOpenChange={setNovoOpen} />
  </div></AppShell>;
}
function CalendarMetric({label,value,tone}:{label:string;value:string;tone:"primary"|"red"}){return <div className="performance-card p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-display mt-1 text-3xl font-semibold" style={{color:tone==="red"?"var(--color-red)":"var(--brand-primary)"}}>{value}</div></div>}
function SimpleList({title,tasks}:{title:string;tasks:Array<{id:string;descricao:string;plano:string}>}){return <div className="performance-card p-4"><div className="mb-3 flex items-center gap-2"><CircleAlert className="h-4 w-4 text-[var(--color-red)]"/><h2 className="font-display text-lg font-semibold">{title}</h2></div>{tasks.slice(0,6).map(t=><div key={t.id} className="border-t py-3 text-sm">{t.descricao}<div className="text-xs text-muted-foreground">{t.plano}</div></div>)}</div>}
