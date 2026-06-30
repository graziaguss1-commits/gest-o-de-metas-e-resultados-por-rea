import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Sparkles, Target, TrendingUp, AlertTriangle, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMetas } from "@/hooks/useMetas";
import {
  AREAS,
  desvioPercentual,
  progressoEsperado,
  progressoReal,
  STATUS_COLOR,
  type MetaWithResponsavel,
  type Status,
} from "@/lib/metas";
import { StatusDot } from "@/components/metas/StatusChip";
import { ProgressBar } from "@/components/metas/ProgressBar";
import { NovaMetaModal } from "@/components/metas/NovaMetaModal";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function initials(name?: string | null) {
  if (!name) return "•";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

const STATUS_RANK: Record<Status, number> = { verde: 0, amarelo: 1, vermelho: 2 };

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: metas, isLoading } = useMetas();
  const [novaOpen, setNovaOpen] = useState(false);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    [],
  );

  const summary = useMemo(() => {
    const all = metas ?? [];
    return {
      total: all.length,
      verde: all.filter((m) => m.status === "verde").length,
      amarelo: all.filter((m) => m.status === "amarelo").length,
      vermelho: all.filter((m) => m.status === "vermelho").length,
    };
  }, [metas]);

  const areaCards = useMemo(() => {
    const all = metas ?? [];
    return AREAS.map((area) => {
      const da = all.filter((m) => m.area === area);
      if (da.length === 0) return null;
      const piorStatus = da.reduce<Status>(
        (acc, m) => (STATUS_RANK[m.status as Status] > STATUS_RANK[acc] ? (m.status as Status) : acc),
        "verde",
      );
      const saudaveis = da.filter((m) => m.status === "verde").length;
      const pctSaudavel = Math.round((saudaveis / da.length) * 100);
      return { area, count: da.length, piorStatus, pctSaudavel, metas: da };
    }).filter(Boolean) as {
      area: string;
      count: number;
      piorStatus: Status;
      pctSaudavel: number;
      metas: MetaWithResponsavel[];
    }[];
  }, [metas]);

  const emAtencao = useMemo(() => {
    return (metas ?? [])
      .filter((m) => m.status === "amarelo" || m.status === "vermelho")
      .sort((a, b) => STATUS_RANK[b.status as Status] - STATUS_RANK[a.status as Status])
      .slice(0, 6);
  }, [metas]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">
              {greeting()}{firstName ? `, ${firstName}` : ""} 👋
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{today}</p>
          </div>
          <Button
            onClick={() => setNovaOpen(true)}
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nova meta
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Total de Metas"
            value={summary.total}
            icon={<Target className="h-4 w-4" />}
            color="var(--color-blue)"
            bg="var(--color-blue-soft)"
            loading={isLoading}
          />
          <SummaryCard
            label="No prazo"
            value={summary.verde}
            icon={<TrendingUp className="h-4 w-4" />}
            color={STATUS_COLOR.verde.fg}
            bg={STATUS_COLOR.verde.bg}
            loading={isLoading}
          />
          <SummaryCard
            label="Em atenção"
            value={summary.amarelo}
            icon={<AlertTriangle className="h-4 w-4" />}
            color={STATUS_COLOR.amarelo.fg}
            bg={STATUS_COLOR.amarelo.bg}
            loading={isLoading}
          />
          <SummaryCard
            label="Em risco"
            value={summary.vermelho}
            icon={<AlertCircle className="h-4 w-4" />}
            color={STATUS_COLOR.vermelho.fg}
            bg={STATUS_COLOR.vermelho.bg}
            loading={isLoading}
          />
        </div>

        {/* Painel de saúde por área */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Painel de Saúde por Área
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : areaCards.length === 0 ? (
            <div className="metasia-card p-8 text-center text-sm text-muted-foreground">
              Crie suas primeiras metas para ver o painel de saúde por área.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {areaCards.map((a) => (
                <AreaCard key={a.area} {...a} />
              ))}
            </div>
          )}
        </section>

        {/* Tabela em atenção */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Metas em Atenção Agora
            </h2>
            {emAtencao.length > 0 && (
              <Link
                to="/metas"
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--color-blue)" }}
              >
                Ver todas →
              </Link>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : emAtencao.length === 0 ? (
            <div
              className="metasia-card p-8 text-center text-sm"
              style={{ borderLeft: `3px solid ${STATUS_COLOR.verde.fg}` }}
            >
              <div className="mb-2 font-medium">Tudo no prazo 🎉</div>
              <div className="text-muted-foreground">
                Nenhuma meta em atenção ou risco no momento.
              </div>
            </div>
          ) : (
            <div className="metasia-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                        Meta
                      </th>
                      <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                        Responsável
                      </th>
                      <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground w-[180px]">
                        Progresso
                      </th>
                      <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                        Desvio
                      </th>
                      <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground w-[120px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {emAtencao.map((m) => {
                      const status = m.status as Status;
                      const real = progressoReal(m.valor_atual, m.valor_alvo, m.is_inverse);
                      const desvio = desvioPercentual(m);
                      return (
                        <tr key={m.id} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <StatusDot status={status} />
                              <span className="font-medium">{m.nome}</span>
                              <span className="text-xs text-muted-foreground">· {m.area}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {m.responsavel_nome ? (
                              <span className="flex items-center gap-1.5 text-xs">
                                <span
                                  className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                  style={{ backgroundColor: "var(--color-blue)" }}
                                >
                                  {initials(m.responsavel_nome)}
                                </span>
                                {m.responsavel_nome}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <ProgressBar value={real} status={status} height={6} />
                              <div className="text-[10px] text-muted-foreground">
                                {Math.round(real * 100)}%
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-semibold"
                              style={{
                                color:
                                  desvio < -20
                                    ? "var(--color-red)"
                                    : desvio < -5
                                      ? "var(--color-amber)"
                                      : "var(--color-green)",
                              }}
                            >
                              {desvio}pp
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="ghost" asChild className="h-8">
                              <Link to={`/metas/${m.id}/analise`}>
                                <Sparkles className="h-3.5 w-3.5 mr-1" />
                                Análise IA
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      <NovaMetaModal open={novaOpen} onOpenChange={setNovaOpen} />
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
  bg,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  loading: boolean;
}) {
  return (
    <div className="metasia-card p-4 flex items-start justify-between gap-2">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <div className="text-3xl font-bold" style={{ color }}>
            {value}
          </div>
        )}
      </div>
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: bg, color }}
      >
        {icon}
      </div>
    </div>
  );
}

function AreaCard({
  area,
  count,
  piorStatus,
  pctSaudavel,
  metas,
}: {
  area: string;
  count: number;
  piorStatus: Status;
  pctSaudavel: number;
  metas: MetaWithResponsavel[];
}) {
  const c = STATUS_COLOR[piorStatus];
  // Mini gráfico: progresso médio das metas da área (real vs esperado)
  const realAvg =
    metas.reduce((s, m) => s + progressoReal(m.valor_atual, m.valor_alvo, m.is_inverse), 0) /
    Math.max(1, metas.length);
  const espAvg =
    metas.reduce((s, m) => s + progressoEsperado(m.data_inicio, m.data_fim), 0) /
    Math.max(1, metas.length);

  return (
    <Link
      to={`/metas?area=${encodeURIComponent(area)}`}
      className="metasia-card p-4 block hover:bg-muted/30 transition-colors"
      style={piorStatus === "vermelho" ? { borderLeft: "3px solid var(--color-red)" } : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <StatusDot status={piorStatus} />
            <h3 className="font-semibold text-sm">{area}</h3>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {count} {count === 1 ? "meta" : "metas"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold" style={{ color: c.fg }}>
            {pctSaudavel}%
          </div>
          <div className="text-[10px] text-muted-foreground">saudáveis</div>
        </div>
      </div>

      <svg viewBox="0 0 200 30" className="w-full h-auto">
        <line
          x1="2" y1="28" x2="198" y2="2"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.5"
        />
        <line
          x1="2"
          y1="28"
          x2={2 + espAvg * 196}
          y2={28 - realAvg * 26}
          stroke={c.fg}
          strokeWidth="2"
        />
        <circle cx={2 + espAvg * 196} cy={28 - realAvg * 26} r="2.5" fill={c.fg} />
      </svg>
    </Link>
  );
}
