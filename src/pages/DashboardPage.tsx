import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMetas } from "@/hooks/useMetas";
import {
  formatDateISOToBR,
  formatProgresso,
  progressoEsperado,
  progressoReal,
  STATUS_COLOR,
  type MetaWithResponsavel,
  type Status,
} from "@/lib/metas";
import { ProgressBar } from "@/components/metas/ProgressBar";
import { NovaMetaModal } from "@/components/metas/NovaMetaModal";

type Universo = "Tudo" | "Clínica" | "Mentoria" | "Pessoal";

const UNIVERSOS: Universo[] = ["Tudo", "Clínica", "Mentoria", "Pessoal"];
const STATUS_RANK: Record<Status, number> = { verde: 0, amarelo: 1, vermelho: 2 };
const UNIVERSO_STYLE: Record<Exclude<Universo, "Tudo">, { color: string; soft: string }> = {
  Clínica: { color: "var(--brand-navy)", soft: "var(--brand-navy-soft)" },
  Mentoria: { color: "var(--brand-primary)", soft: "var(--brand-primary-soft)" },
  Pessoal: { color: "var(--brand-accent)", soft: "var(--brand-accent-soft)" },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function universoDaArea(area?: string | null): Exclude<Universo, "Tudo"> {
  const value = (area ?? "").toLowerCase();
  if (/cl[ií]nica|paciente|equipe|opera|financeiro cl[ií]nica/.test(value)) return "Clínica";
  if (/mentoria|conte[uú]do|produto digital|vendas mentoria/.test(value)) return "Mentoria";
  return "Pessoal";
}

function percentualMeta(meta: MetaWithResponsavel) {
  return Math.round(progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse) * 100);
}

function percentualPrazo(meta: MetaWithResponsavel) {
  return Math.round(progressoEsperado(meta.data_inicio, meta.data_fim) * 100);
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: metas, isLoading } = useMetas();
  const [novaOpen, setNovaOpen] = useState(false);
  const [universo, setUniverso] = useState<Universo>("Tudo");

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const today = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }),
    [],
  );

  const filtered = useMemo(() => {
    const all = metas ?? [];
    return universo === "Tudo" ? all : all.filter((meta) => universoDaArea(meta.area) === universo);
  }, [metas, universo]);

  const resumo = useMemo(() => {
    const total = filtered.length;
    const progresso = total
      ? Math.round(filtered.reduce((sum, meta) => sum + percentualMeta(meta), 0) / total)
      : 0;
    const emRisco = filtered.filter((meta) => meta.status === "vermelho").length;
    const atencao = filtered.filter((meta) => meta.status === "amarelo").length;
    const concluidas = filtered.filter((meta) => percentualMeta(meta) >= 100).length;
    const execucao = total ? Math.round((concluidas / total) * 100) : 0;
    return { progresso, emRisco, atencao, execucao };
  }, [filtered]);

  const prioridades = useMemo(
    () => [...filtered]
      .sort((a, b) => {
        const risk = STATUS_RANK[b.status as Status] - STATUS_RANK[a.status as Status];
        return risk || new Date(a.data_fim).getTime() - new Date(b.data_fim).getTime();
      })
      .slice(0, 3),
    [filtered],
  );

  const proximosPrazos = useMemo(
    () => [...filtered]
      .filter((meta) => percentualMeta(meta) < 100)
      .sort((a, b) => new Date(a.data_fim).getTime() - new Date(b.data_fim).getTime())
      .slice(0, 5),
    [filtered],
  );

  const porUniverso = useMemo(() => {
    const all = metas ?? [];
    return (["Clínica", "Mentoria", "Pessoal"] as const).map((nome) => {
      const items = all.filter((meta) => universoDaArea(meta.area) === nome);
      const progresso = items.length
        ? Math.round(items.reduce((sum, meta) => sum + percentualMeta(meta), 0) / items.length)
        : 0;
      const risco = items.filter((meta) => meta.status === "vermelho").length;
      return { nome, items, progresso, risco };
    });
  }, [metas]);

  return (
    <AppShell>
      <div className="performance-page space-y-7">
        <section className="performance-hero">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="eyebrow mb-3">PAINEL DE PERFORMANCE</div>
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                {greeting()}{firstName ? `, ${firstName}` : ""}.
              </h1>
              <p className="mt-2 text-sm text-white/70 capitalize">{today}</p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75">
                Metas, execução e resultados em um só lugar. Veja o que merece sua atenção e avance no que realmente importa.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                <Link to="/planejamento-semanal"><CalendarDays className="mr-2 h-4 w-4" />Planejar semana</Link>
              </Button>
              <Button onClick={() => setNovaOpen(true)} className="brand-button">
                <Plus className="mr-2 h-4 w-4" />Nova meta
              </Button>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border bg-card p-1 shadow-sm">
            {UNIVERSOS.map((item) => (
              <button
                key={item}
                onClick={() => setUniverso(item)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${universo === item ? "bg-[var(--brand-dark)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Visão atual: <strong className="text-foreground">{universo}</strong></span>
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Progresso geral" value={`${resumo.progresso}%`} detail="média das metas" icon={TrendingUp} loading={isLoading} accent="primary" />
          <MetricCard label="Execução" value={`${resumo.execucao}%`} detail="metas concluídas" icon={CheckCircle2} loading={isLoading} accent="green" />
          <MetricCard label="Metas em risco" value={String(resumo.emRisco)} detail="exigem decisão" icon={AlertCircle} loading={isLoading} accent="red" />
          <MetricCard label="Em atenção" value={String(resumo.atencao)} detail="acompanhar de perto" icon={Clock3} loading={isLoading} accent="accent" />
        </section>

        <section>
          <SectionHeading title="Prioridades da semana" subtitle="Seu foco estratégico para os próximos dias" action="Planejar" href="/planejamento-semanal" />
          {isLoading ? <Skeleton className="h-44 w-full" /> : prioridades.length === 0 ? (
            <EmptyState title="Defina o foco da sua semana" text="Crie sua primeira meta e transforme intenção em execução." onCreate={() => setNovaOpen(true)} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {prioridades.map((meta, index) => <PriorityCard key={meta.id} meta={meta} index={index + 1} />)}
            </div>
          )}
        </section>

        <section>
          <SectionHeading title="Performance por universo" subtitle="Equilíbrio entre negócio, crescimento e vida pessoal" />
          <div className="grid gap-3 md:grid-cols-3">
            {porUniverso.map((item) => {
              const style = UNIVERSO_STYLE[item.nome];
              return (
                <button key={item.nome} onClick={() => setUniverso(item.nome)} className="performance-card group p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="mb-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: style.color, background: style.soft }}>{item.nome}</span>
                      <div className="font-display text-3xl font-semibold" style={{ color: style.color }}>{item.progresso}%</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.items.length} {item.items.length === 1 ? "meta ativa" : "metas ativas"}</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1" />
                  </div>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all" style={{ width: `${item.progresso}%`, background: style.color }} /></div>
                  <div className="mt-3 text-xs text-muted-foreground">{item.risco ? `${item.risco} em risco` : "Nenhum ponto crítico"}</div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
          <section>
            <SectionHeading title="Metas em destaque" subtitle="Resultado alcançado comparado ao prazo consumido" action="Ver todas" href="/metas" />
            <div className="performance-card overflow-hidden">
              {isLoading ? <Skeleton className="h-64 w-full" /> : filtered.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma meta neste universo.</div>
              ) : (
                <div className="divide-y">
                  {[...filtered].sort((a, b) => STATUS_RANK[b.status as Status] - STATUS_RANK[a.status as Status]).slice(0, 5).map((meta) => (
                    <GoalRow key={meta.id} meta={meta} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionHeading title="Próximos prazos" subtitle="O que vem pela frente" action="Planos" href="/planos" />
            <div className="performance-card p-2">
              {proximosPrazos.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Sua agenda estratégica está livre.</div>
              ) : proximosPrazos.map((meta) => (
                <Link key={meta.id} to={`/metas/${meta.id}/analise`} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-muted/60">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                    <span className="text-[9px] font-bold uppercase">{new Date(`${meta.data_fim}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                    <span className="text-sm font-bold leading-none">{new Date(`${meta.data_fim}T12:00:00`).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{meta.nome}</div><div className="text-xs text-muted-foreground">{universoDaArea(meta.area)} · {meta.area}</div></div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        </div>

        <NovaMetaModal open={novaOpen} onOpenChange={setNovaOpen} />
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value, detail, icon: Icon, loading, accent }: { label: string; value: string; detail: string; icon: typeof Target; loading: boolean; accent: "primary" | "accent" | "green" | "red" }) {
  const colors = { primary: ["var(--brand-primary)", "var(--brand-primary-soft)"], accent: ["var(--brand-accent)", "var(--brand-accent-soft)"], green: ["var(--color-green)", "var(--color-green-bg)"], red: ["var(--color-red)", "var(--color-red-bg)"] }[accent];
  return <div className="performance-card p-4 md:p-5"><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>{loading ? <Skeleton className="mt-2 h-9 w-16" /> : <div className="font-display mt-2 text-3xl font-semibold" style={{ color: colors[0] }}>{value}</div>}<div className="mt-1 text-xs text-muted-foreground">{detail}</div></div><div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: colors[0], background: colors[1] }}><Icon className="h-4 w-4" /></div></div></div>;
}

function SectionHeading({ title, subtitle, action, href }: { title: string; subtitle: string; action?: string; href?: string }) {
  return <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-display text-xl font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p></div>{action && href && <Link to={href} className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">{action} →</Link>}</div>;
}

function PriorityCard({ meta, index }: { meta: MetaWithResponsavel; index: number }) {
  const universo = universoDaArea(meta.area);
  const style = UNIVERSO_STYLE[universo];
  const progress = percentualMeta(meta);
  return <Link to={`/metas/${meta.id}/analise`} className="performance-card group p-5 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><span className="font-display text-2xl text-muted-foreground/40">0{index}</span><span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: style.color, background: style.soft }}>{universo}</span></div><h3 className="mt-5 line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{meta.nome}</h3><div className="mt-4 flex items-center justify-between text-xs"><span className="text-muted-foreground">Prazo {formatDateISOToBR(meta.data_fim)}</span><span className="font-bold" style={{ color: STATUS_COLOR[meta.status as Status].fg }}>{progress}%</span></div><div className="mt-2"><ProgressBar value={progress / 100} status={meta.status as Status} height={6} /></div></Link>;
}

function GoalRow({ meta }: { meta: MetaWithResponsavel }) {
  const progress = percentualMeta(meta);
  const prazo = percentualPrazo(meta);
  const status = meta.status as Status;
  return <Link to={`/metas/${meta.id}/analise`} className="grid gap-3 p-4 transition hover:bg-muted/30 md:grid-cols-[1fr_140px_120px] md:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status].fg }} /><span className="truncate text-sm font-semibold">{meta.nome}</span></div><div className="mt-1 pl-4 text-xs text-muted-foreground">{universoDaArea(meta.area)} · {formatProgresso(meta)}</div></div><div><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Resultado</span><strong className="text-foreground">{progress}%</strong></div><ProgressBar value={progress / 100} status={status} height={5} /></div><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Prazo</span><strong>{prazo}%</strong></div></Link>;
}

function EmptyState({ title, text, onCreate }: { title: string; text: string; onCreate: () => void }) {
  return <div className="performance-card flex flex-col items-center p-10 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]"><Sparkles className="h-5 w-5" /></div><h3 className="font-display text-lg font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p><Button onClick={onCreate} className="brand-button mt-5"><Plus className="mr-2 h-4 w-4" />Criar meta</Button></div>;
}
