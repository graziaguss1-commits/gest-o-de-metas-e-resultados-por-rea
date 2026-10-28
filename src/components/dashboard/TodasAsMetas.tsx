import { useMemo, useState } from "react";
import { ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProgressBar } from "@/components/metas/ProgressBar";
import { StatusChip } from "@/components/metas/StatusChip";
import { baixarCSV, nomesResponsaveis } from "@/lib/relatorioCsv";
import {
  desvioPercentual,
  formatDateISOToBR,
  formatValor,
  progressoReal,
  ritmoEmPalavras,
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

const STATUS_FILTERS: { value: "todas" | Status; label: string; cor?: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "verde", label: "No prazo", cor: "var(--color-green)" },
  { value: "amarelo", label: "Em atenção", cor: "var(--color-amber)" },
  { value: "vermelho", label: "Em risco", cor: "var(--color-red)" },
];

function dentroDoPeriodo(meta: MetaWithResponsavel, dias: number | null) {
  if (dias === null) return true;
  // Meta que ainda estava de pé em algum momento da janela.
  return new Date(meta.data_fim).getTime() >= Date.now() - dias * 86400000;
}

function iniciais(nome?: string | null) {
  if (!nome) return "•";
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * A lista completa, com filtros e exportação — o que era a aba Resultados.
 *
 * Virou seção daqui porque a aba repetia os cartões de status do painel e
 * o resto dela (tabela e CSV) não justificava uma tela própria. Fica
 * fechada por padrão: o painel acima responde "o que eu faço agora", e
 * esta parte é para quando ela quer ver tudo ou levar o arquivo.
 *
 * Recebe as metas JÁ filtradas pelo universo escolhido no topo da página —
 * dois filtros de área brigando na mesma tela foi o que se quis evitar.
 */
export function TodasAsMetas({ metas }: { metas: MetaWithResponsavel[] }) {
  const [aberta, setAberta] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [status, setStatus] = useState<"todas" | Status>("todas");

  const filtradas = useMemo(
    () =>
      metas.filter(
        (m) =>
          (status === "todas" || m.status === status) &&
          dentroDoPeriodo(m, PERIODO_DIAS[periodo]),
      ),
    [metas, periodo, status],
  );

  return (
    <section className="performance-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            aberta && "rotate-90",
          )}
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">Todas as metas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lista completa, com filtro de período e status — e o arquivo para
            levar a uma reunião.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {metas.length} {metas.length === 1 ? "meta" : "metas"}
        </span>
      </button>

      {aberta && (
        <div className="border-t">
          <div className="flex flex-wrap items-end gap-3 border-b p-4">
            <div className="min-w-[180px] space-y-1.5">
              <label
                htmlFor="filtro-periodo"
                className="text-xs font-medium text-muted-foreground"
              >
                Período
              </label>
              <Select
                value={periodo}
                onValueChange={(v) => setPeriodo(v as Periodo)}
              >
                <SelectTrigger id="filtro-periodo" className="h-9">
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

            <div className="min-w-[220px] flex-1 space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Status
              </span>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((f) => {
                  const ativo = status === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setStatus(f.value)}
                      aria-pressed={ativo}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        ativo
                          ? "border-transparent text-white"
                          : "border-border bg-card hover:bg-muted/60",
                      )}
                      style={
                        ativo
                          ? { backgroundColor: f.cor ?? "var(--brand-dark)" }
                          : undefined
                      }
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => baixarCSV(filtradas)}
              disabled={filtradas.length === 0}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {filtradas.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma meta com esses filtros.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    {[
                      "Nome",
                      "Área",
                      "Responsável",
                      "Resultado",
                      "Ritmo",
                      "Status",
                      "Prazo",
                    ].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                          h === "Resultado" && "w-[180px]",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((m) => {
                    const s = m.status as Status;
                    const real = progressoReal(
                      m.valor_atual,
                      m.valor_alvo,
                      m.is_inverse,
                    );
                    const desvio = desvioPercentual(m);
                    const responsavel = nomesResponsaveis(m);
                    return (
                      <tr key={m.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{m.nome}</td>
                        <td className="px-4 py-3">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                            style={{
                              backgroundColor: "var(--color-blue-soft)",
                              color: "var(--color-blue)",
                            }}
                          >
                            {m.area}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {responsavel ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                style={{ backgroundColor: "var(--color-blue)" }}
                              >
                                {iniciais(responsavel)}
                              </span>
                              {responsavel}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <ProgressBar value={real} status={s} height={6} />
                            <div className="text-[10px] text-muted-foreground">
                              {formatValor(m.valor_atual, m.unidade)} /{" "}
                              {formatValor(m.valor_alvo, m.unidade)} ·{" "}
                              {Math.round(real * 100)}%
                            </div>
                          </div>
                        </td>
                        {/* "Ritmo" em palavras no lugar de "-40pp": a sigla
                            não dizia nada e o sinal sozinho não revelava se
                            aquilo era bom ou ruim. */}
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
                            {ritmoEmPalavras(desvio)}
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
        </div>
      )}
    </section>
  );
}
