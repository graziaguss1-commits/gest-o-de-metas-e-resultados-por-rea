import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanos, useToggleTarefa, type PlanoWithMeta } from "@/hooks/usePlanos";
import { NovoPlanoModal } from "@/components/planos/NovoPlanoModal";

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
  const toggle = useToggleTarefa();
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [novoOpen, setNovoOpen] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)), [anchor]);
  const tasks = useMemo<CalendarTask[]>(() => (planos ?? []).flatMap((plano) => plano.tarefas.map((task) => ({ ...task, plano: plano.titulo, area: plano.meta?.area ?? "Sem área", meta: plano.meta?.nome ?? null }))), [planos]);
  const overdue = tasks.filter((task) => !task.concluida && task.prazo && task.prazo < iso(new Date()));
  const withoutDate = tasks.filter((task) => !task.concluida && !task.prazo);
  const weekLabel = `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return <AppShell><div className="performance-page space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="eyebrow mb-2">AGENDA E EXECUÇÃO</div><h1 className="font-display text-3xl font-semibold">Calendário estratégico</h1><p className="mt-1 text-sm text-muted-foreground">Visualize prazos e distribua seus planos de ação ao longo da semana.</p></div><Button onClick={() => setNovoOpen(true)} className="brand-button"><Plus className="mr-2 h-4 w-4" />Novo plano</Button></header>

    <section className="grid gap-3 sm:grid-cols-3">
      <CalendarMetric label="Ações da semana" value={tasks.filter((t) => t.prazo && days.some((d) => iso(d) === t.prazo)).length} tone="primary" />
      <CalendarMetric label="Atrasadas" value={overdue.length} tone="red" />
      <CalendarMetric label="Sem data" value={withoutDate.length} tone="accent" />
    </section>

    <div className="performance-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Semana selecionada</div><div className="mt-1 font-display text-lg font-semibold capitalize">{weekLabel}</div></div><div className="flex items-center gap-1"><Button size="icon" variant="outline" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setAnchor(startOfWeek(new Date()))}>Hoje</Button><Button size="icon" variant="outline" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight className="h-4 w-4" /></Button></div></div>
      {isLoading ? <Skeleton className="h-[440px] w-full" /> : <div className="grid min-w-[900px] grid-cols-7 divide-x overflow-x-auto">
        {days.map((day) => {
          const dayTasks = tasks.filter((task) => task.prazo === iso(day));
          const today = iso(day) === iso(new Date());
          return <div key={iso(day)} className={`min-h-[430px] p-3 ${today ? "bg-[var(--brand-accent-soft)]/40" : ""}`}><div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</div><div className={`font-display text-2xl font-semibold ${today ? "text-[var(--brand-accent)]" : ""}`}>{day.getDate()}</div></div>{today && <span className="rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-[9px] font-bold uppercase text-white">Hoje</span>}</div><div className="space-y-2">{dayTasks.length === 0 ? <div className="rounded-xl border border-dashed p-3 text-center text-[11px] text-muted-foreground">Sem ações</div> : dayTasks.map((task) => <label key={task.id} className={`block cursor-pointer rounded-xl border p-3 transition hover:shadow-sm ${task.concluida ? "bg-muted/50 opacity-65" : "bg-card"}`}><div className="flex items-start gap-2"><Checkbox checked={task.concluida} onCheckedChange={(v) => toggle.mutate({ id: task.id, concluida: v === true })} className="mt-0.5" /><div className="min-w-0"><div className={`text-xs font-semibold leading-snug ${task.concluida ? "line-through" : ""}`}>{task.descricao}</div><div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">{task.area}</div></div></div></label>)}</div></div>;
        })}
      </div>}
    </div>

    {(overdue.length > 0 || withoutDate.length > 0) && <section className="grid gap-4 lg:grid-cols-2">{overdue.length > 0 && <TaskList title="Ações atrasadas" icon={<CircleAlert className="h-4 w-4 text-[var(--color-red)]" />} tasks={overdue} onToggle={(id, value) => toggle.mutate({ id, concluida: value })} />}{withoutDate.length > 0 && <TaskList title="Ações sem data" icon={<CircleAlert className="h-4 w-4 text-[var(--brand-accent)]" />} tasks={withoutDate} onToggle={(id, value) => toggle.mutate({ id, concluida: value })} />}</section>}
    <NovoPlanoModal open={novoOpen} onOpenChange={setNovoOpen} />
  </div></AppShell>;
}

function CalendarMetric({ label, value, tone }: { label: string; value: number; tone: "primary" | "red" | "accent" }) { const color = tone === "red" ? "var(--color-red)" : tone === "accent" ? "var(--brand-accent)" : "var(--brand-primary)"; return <div className="performance-card p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-display mt-1 text-3xl font-semibold" style={{ color }}>{value}</div></div>; }
function TaskList({ title, icon, tasks, onToggle }: { title: string; icon: React.ReactNode; tasks: CalendarTask[]; onToggle: (id: string, value: boolean) => void }) { return <div className="performance-card p-4"><div className="mb-3 flex items-center gap-2"><span>{icon}</span><h2 className="font-display text-lg font-semibold">{title}</h2></div><div className="divide-y">{tasks.slice(0, 6).map((task) => <label key={task.id} className="flex cursor-pointer items-start gap-3 py-3"><Checkbox checked={task.concluida} onCheckedChange={(v) => onToggle(task.id, v === true)} className="mt-0.5" /><div className="min-w-0"><div className="text-sm font-medium">{task.descricao}</div><div className="mt-0.5 text-xs text-muted-foreground">{task.plano}{task.prazo ? ` · ${new Date(`${task.prazo}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</div></div></label>)}</div></div>; }
