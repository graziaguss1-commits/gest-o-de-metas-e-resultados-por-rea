import { useMemo, useState } from "react";
import { BarChart3, Download, FileText } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProgressBar } from "@/components/metas/ProgressBar";
import { StatusChip } from "@/components/metas/StatusChip";
import { useMetas } from "@/hooks/useMetas";
import {
  AREAS,
  desvioPercentual,
  formatDateISOToBR,
  formatValor,
  progressoReal,
  STATUS_COLOR,
  type MetaWithResponsavel,
  type Status,
} from "@/lib/metas";
import { cn } from "@/lib/utils";

type Periodo = "todos" | "30d" | "trimestre" | "ano";

const PERIODO_LABEL: Record<Periodo, string> = {
  todos: "Todo o histórico",
  "30d": "Últimos 30 dias",
  trimestre: "Último trimestre",
  ano: "Último ano",
};

const PERIODO_DIAS: Record<Periodo, number | null> = {
  todos: null,
  "30d": 30,
  trimestre: 90,
  ano: 365,
};

const STATUS_FILTERS: { value: "todas" | Status; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "verde", label: "No prazo" },
  { value: "amarelo", label: "Em atenção" },
  { value: "vermelho", label: "Em risco" },
];

function metaIntersectsPeriod(meta: MetaWithResponsavel, dias: number | null): boolean {
  if (dias === null) return true;
  const fim = new Date(meta.data_fim).getTime();
  const cutoff = Date.now() - dias * 24 * 60 * 60 * 1000;
  // meta foi (ou está) ativa em algum momento dentro do período
  return fim >= cutoff;
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(metas: MetaWithResponsavel[]) {
  const headers = [
    "Nome",
    "Área",
    "Responsável",
    "Valor atual",
    "Valor alvo",
    "Unidade",
    "Progresso (%)",
    "Desvio (pp)",
    "Status",
    "Periodicidade",
    "Data início",
    "Data fim",
    "É inversa?",
  ];

  const rows = metas.map((m) => {
    const real = Math.round(progressoReal(m.valor_atual, m.valor_alvo, m.is_inverse) * 100);
    return [
      m.nome,
      m.area,
      m.responsavel_nome ?? "",
      m.valor_atual,
      m.valor_alvo,
      m.unidade,
      real,
      desvioPercentual(m),
      m.status,
      m.periodicidade,
      m.data_inicio,
      m.data_fim,
      m.is_inverse ? "Sim" : "Não",
    ].map(csvEscape).join(",");
  });

  const csv = "﻿" + [headers.map(csvEscape).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `metasia-relatorio-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function initials(name?: string | null) {
  if (!name) return "•";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function RelatoriosPage() {
  const { data: metas, isLoading } = useMetas();
  const [area, setArea] = useState<string>("todas");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [status, setStatus] = useState<"todas" | Status>("todas");

  const filtered = useMemo(() => {
    const items = metas ?? [];
    const dias = PERIODO_DIAS[periodo];
    return items.filter((m) => {
      if (area !== "todas" && m.area !== area) return false;
      if (status !== "todas" && m.status !== status) return false;
      if (!metaIntersectsPeriod(m, dias)) return false;
      return true;
    });
  }, [metas, area, periodo, status]);

  const summary = useMemo(() => {
    const total = filtered.length;
    if (total === 0) return { total: 0, verde: 0, amarelo: 0, vermelho: 0, pctVerde: 0, pctAmarelo: 0, pctVermelho: 0 };
    const verde = filtered.filter((m) => m.status === "verde").length;
    const amarelo = filtered.filter((m) => m.status === "amarelo").length;
    const vermelho = filtered.filter((m) => m.status === "vermelho").length;
    return {
      total,
      verde,
      amarelo,
      vermelho,
      pctVerde: Math.round((verde / total) * 100),
      pctAmarelo: Math.round((amarelo / total) * 100),
      pctVermelho: Math.round((vermelho / total) * 100),
    };
  }, [filtered]);

  const chartData = useMemo(() => {
    return AREAS.map((a) => {
      const da = filtered.filter((m) => m.area === a);
      const saudaveis = da.filter((m) => m.status === "verde").length;
      const pct = da.length === 0 ? 0 : Math.round((saudaveis / da.length) * 100);
      return { area: a, total: da.length, saudaveis, pct };
    }).filter((d) => d.total > 0);
  }, [filtered]);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              Visão consolidada de todas as metas — {PERIODO_LABEL[periodo].toLowerCase()}.
            </p>
          </div>
          <Button
            onClick={() => downloadCSV(filtered)}
            disabled={filtered.length === 0}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
        </div>

        {/* Filtros */}
        <div className="metasia-card p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">Área</label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as áreas</SelectItem>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIODO_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => {
                const active = status === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatus(f.value)}
                    className={cn(
                      "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                      active
                        ? "border-transparent text-white"
                        : "border-border bg-card hover:bg-muted/60",
                    )}
                    style={
                      active
                        ? f.value === "todas"
                          ? { backgroundColor: "var(--color-blue)" }
                          : f.value === "verde"
                            ? { backgroundColor: "var(--color-green)" }
                            : f.value === "amarelo"
                              ? { backgroundColor: "var(--color-amber)" }
                              : { backgroundColor: "var(--color-red)" }
                        : undefined
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resumo Executivo */}
        <section className="metasia-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Resumo Executivo
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : summary.total === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta atende aos filtros atuais.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryStat label="Total de metas" value={`${summary.total}`} color="var(--color-blue)" />
              <SummaryStat
                label="No prazo"
                value={`${summary.pctVerde}%`}
                sub={`${summary.verde} de ${summary.total}`}
                color={STATUS_COLOR.verde.fg}
              />
              <SummaryStat
                label="Em atenção"
                value={`${summary.pctAmarelo}%`}
                sub={`${summary.amarelo} de ${summary.total}`}
                color={STATUS_COLOR.amarelo.fg}
              />
              <SummaryStat
                label="Em risco"
                value={`${summary.pctVermelho}%`}
                sub={`${summary.vermelho} de ${summary.total}`}
                color={STATUS_COLOR.vermelho.fg}
              />
            </div>
          )}
        </section>

        {/* Bar chart por área */}
        <section className="metasia-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              % de metas saudáveis por área
            </h2>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              {chartData.length} {chartData.length === 1 ? "área" : "áreas"}
            </span>
          </div>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sem dados para os filtros atuais.
            </p>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="area"
                    fontSize={11}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    fontSize={11}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    width={42}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                      borderRadius: 6,
                    }}
                    formatter={(value: number, _name, props) => {
                      const d = props.payload as { saudaveis: number; total: number };
                      return [`${value}% (${d.saudaveis}/${d.total})`, "Saudáveis"];
                    }}
                  />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => {
                      const color =
                        entry.pct >= 80
                          ? "var(--color-green)"
                          : entry.pct >= 50
                            ? "var(--color-amber)"
                            : "var(--color-red)";
                      return <Cell key={i} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Tabela consolidada */}
        <section className="metasia-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Tabela consolidada
            </h2>
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "meta" : "metas"}
            </span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div
                className="h-12 w-12 mx-auto rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--color-blue-soft)" }}
              >
                <FileText className="h-6 w-6" style={{ color: "var(--color-blue)" }} />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhuma meta atende aos filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Nome
                    </th>
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Área
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
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Prazo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const s = m.status as Status;
                    const real = progressoReal(m.valor_atual, m.valor_alvo, m.is_inverse);
                    const desvio = desvioPercentual(m);
                    return (
                      <tr key={m.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{m.nome}</td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide"
                            style={{ backgroundColor: "var(--color-blue-soft)", color: "var(--color-blue)" }}
                          >
                            {m.area}
                          </span>
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
                            <ProgressBar value={real} status={s} height={6} />
                            <div className="text-[10px] text-muted-foreground">
                              {formatValor(m.valor_atual, m.unidade)} / {formatValor(m.valor_alvo, m.unidade)} ·{" "}
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
                            {desvio > 0 ? "+" : ""}
                            {desvio}pp
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={s} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDateISOToBR(m.data_fim)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="text-3xl font-bold" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
