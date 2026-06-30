import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Lancamento, MetaWithResponsavel } from "@/lib/metas";
import { formatDateISOToBR, formatValor, progressoReal, todayISO } from "@/lib/metas";

type Props = {
  meta: MetaWithResponsavel;
  lancamentos: Lancamento[];
  previsaoFinal?: number | null;
};

type Point = {
  data: string;
  real?: number;
  esperado: number;
  previsao?: number;
};

function dateToTs(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).getTime();
}

function tsToISO(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function buildSeries(meta: MetaWithResponsavel, lancamentos: Lancamento[], previsao?: number | null): Point[] {
  const start = dateToTs(meta.data_inicio);
  const end = dateToTs(meta.data_fim);
  const today = dateToTs(todayISO());

  // valor esperado em uma data t (linha que sai de 0 e atinge alvo no fim)
  const expectedAt = (ts: number) => {
    if (ts <= start) return 0;
    if (ts >= end) return meta.valor_alvo;
    const k = (ts - start) / (end - start);
    return meta.valor_alvo * k;
  };

  // pontos reais: 0 no início + cada lançamento (cumulativo apenas se quisermos burn-up real;
  // o spec usa "valor real do período" como o valor atual da meta, então plotamos valor de cada lançamento)
  const realPoints: Point[] = [];
  realPoints.push({ data: meta.data_inicio, real: 0, esperado: 0 });
  for (const l of lancamentos) {
    realPoints.push({
      data: l.data_lancamento,
      real: l.valor,
      esperado: expectedAt(dateToTs(l.data_lancamento)),
    });
  }

  // ponto "hoje" se ainda não foi ultrapassado o fim
  if (today < end && (realPoints.length === 0 || dateToTs(realPoints[realPoints.length - 1].data) < today)) {
    realPoints.push({
      data: tsToISO(today),
      real: meta.valor_atual,
      esperado: expectedAt(today),
    });
  }

  // ponto fim com esperado = alvo
  realPoints.push({ data: meta.data_fim, esperado: meta.valor_alvo });

  // previsão (sombreada) — linha que vai do "hoje" até a previsao_final no fim
  if (previsao != null && Number.isFinite(previsao) && today < end) {
    const todayPoint = realPoints.find((p) => p.data === tsToISO(today));
    if (todayPoint) todayPoint.previsao = meta.valor_atual;
    realPoints.push({ data: meta.data_fim, esperado: meta.valor_alvo, previsao });
  }

  return realPoints.sort((a, b) => dateToTs(a.data) - dateToTs(b.data));
}

type TooltipPayloadItem = {
  payload: Point;
};

type BurnUpTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  meta: MetaWithResponsavel;
};

function BurnUpTooltip({ active, payload, label, meta }: BurnUpTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  const dataFormatada = label ? formatDateISOToBR(label) : "—";

  const desvio =
    point.real != null && point.esperado !== 0
      ? Math.round(((point.real - point.esperado) / point.esperado) * 100)
      : null;

  return (
    <div className="bg-white border border-border rounded-lg shadow-elevation-3 p-3 min-w-[12rem] font-sans text-xs">
      <div className="font-semibold text-foreground mb-2 text-[11px] uppercase tracking-wide">
        {dataFormatada}
      </div>
      <div className="space-y-1.5">
        {point.real != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--color-blue)" }}
              />
              Real
            </span>
            <span className="font-medium text-foreground">
              {formatValor(point.real, meta.unidade)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block w-3 h-px border-t border-dashed border-muted-foreground" />
            Esperado
          </span>
          <span className="font-medium text-foreground">
            {formatValor(point.esperado, meta.unidade)}
          </span>
        </div>
        {desvio != null && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/50">
            <span className="text-muted-foreground">Desvio</span>
            <span
              className="font-semibold"
              style={{
                color:
                  desvio < 0 ? "var(--color-red)" : desvio > 0 ? "var(--color-green)" : "var(--color-amber)",
              }}
            >
              {desvio > 0 ? "+" : ""}
              {desvio}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function BurnUpChart({ meta, lancamentos, previsaoFinal }: Props) {
  const data = buildSeries(meta, lancamentos, previsaoFinal);
  const real = progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse);

  return (
    <div className="metasia-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Trajetória da meta</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--color-blue)" }}
            />
            Real
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-px border-t border-dashed border-muted-foreground" />
            Esperado
          </span>
          {previsaoFinal != null && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-sm opacity-50"
                style={{ backgroundColor: "var(--color-blue)" }}
              />
              Previsão
            </span>
          )}
          <span className="text-muted-foreground ml-2">
            {Math.round(real * 100)}% concluído
          </span>
        </div>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.5} />
            <XAxis
              dataKey="data"
              tickFormatter={(v) => v.slice(5)}
              fontSize={11}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              fontSize={11}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) =>
                meta.unidade === "R$"
                  ? `R$${Math.round(v / 1000)}k`
                  : `${v}${meta.unidade === "%" ? "%" : ""}`
              }
              width={56}
            />
            <ReferenceLine
              x={todayISO()}
              stroke="var(--color-amber)"
              strokeDasharray="2 2"
              label={{
                value: "hoje",
                fontSize: 10,
                fill: "var(--color-amber)",
                position: "insideTopRight",
              }}
            />
            <Line
              type="monotone"
              dataKey="esperado"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 5, fill: "hsl(var(--muted-foreground))", stroke: "white", strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="real"
              stroke="var(--color-blue)"
              strokeWidth={2.5}
              dot={{ fill: "var(--color-blue)", r: 3 }}
              activeDot={{ r: 6, fill: "var(--color-blue)", stroke: "white", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
            {previsaoFinal != null && (
              <Area
                type="monotone"
                dataKey="previsao"
                stroke="var(--color-blue)"
                strokeOpacity={0.5}
                strokeDasharray="3 3"
                fill="var(--color-blue)"
                fillOpacity={0.08}
                connectNulls
                isAnimationActive={false}
                activeDot={{ r: 5, fill: "var(--color-blue)", fillOpacity: 0.7, stroke: "white", strokeWidth: 2 }}
              />
            )}
            <Tooltip
              content={<BurnUpTooltip meta={meta} />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
              wrapperStyle={{ outline: "none", zIndex: 50 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
