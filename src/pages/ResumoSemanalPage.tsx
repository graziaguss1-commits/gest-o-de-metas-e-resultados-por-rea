import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CircleSlash, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgendaPeriodo } from "@/hooks/useAgendaDoDia";
import { useMotivosBloco } from "@/hooks/useMotivosBloco";
import { useExecucoes, usePlanos } from "@/hooks/usePlanos";
import { useMetas, useTodosLancamentos } from "@/hooks/useMetas";
import { corDaArea } from "@/lib/coresArea";
import { getFrequencia, FREQUENCIA_LABEL } from "@/lib/execucao";
import { cumprimentoAgenda, isoLocal, segundaDaSemana } from "@/lib/hoje";
import { chaveMotivo, MOTIVO_LABEL, naoExecutado, referenciaBloco } from "@/lib/motivos";
import { rotuloSemana } from "@/lib/prazos";
import { aderencia, aderenciaConjunta, janelaAcumulada, movimentoMeta } from "@/lib/resumoSemanal";

const somaDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return isoLocal(d);
};

const pctTexto = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

const numero = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function ResumoSemanalPage() {
  const hojeISO = isoLocal(new Date());
  const [segundaISO, setSegundaISO] = useState(() =>
    isoLocal(segundaDaSemana(new Date())),
  );
  const domingoISO = somaDias(segundaISO, 6);
  // Em useMemo: objeto novo a cada render invalidaria todos os cálculos abaixo.
  const semana = useMemo(
    () => ({ inicio: segundaISO, fim: domingoISO }),
    [segundaISO, domingoISO],
  );
  const anterior = useMemo(
    () => ({ inicio: somaDias(segundaISO, -7), fim: somaDias(segundaISO, -1) }),
    [segundaISO],
  );
  const ehSemanaAtual = segundaISO === isoLocal(segundaDaSemana(new Date()));

  const { blocos, isLoading: carregandoAgenda } = useAgendaPeriodo(
    anterior.inicio,
    domingoISO,
  );
  const { data: planos = [], isLoading: carregandoPlanos } = usePlanos();
  const { data: execucoes = [] } = useExecucoes();
  const { data: metas = [] } = useMetas();
  const { data: lancamentos = [] } = useTodosLancamentos();
  const { data: motivos } = useMotivosBloco(semana.inicio, semana.fim);

  const agora = useMemo(
    () => (ehSemanaAtual ? new Date() : new Date(`${domingoISO}T23:59:59`)),
    [ehSemanaAtual, domingoISO],
  );

  const daSemana = useMemo(
    () => blocos.filter((b) => b.data >= semana.inicio && b.data <= semana.fim),
    [blocos, semana.inicio, semana.fim],
  );
  const daAnterior = useMemo(
    () => blocos.filter((b) => b.data >= anterior.inicio && b.data <= anterior.fim),
    [blocos, anterior.inicio, anterior.fim],
  );

  const metrica = cumprimentoAgenda(daSemana, agora);
  const metricaAnterior = cumprimentoAgenda(
    daAnterior,
    new Date(`${anterior.fim}T23:59:59`),
  );
  const variacao =
    metrica.pct == null || metricaAnterior.pct == null
      ? null
      : metrica.pct - metricaAnterior.pct;

  const perdidos = daSemana.filter((b) => naoExecutado(b, agora));

  /** Toda rotina de plano, com a aderência da semana e a acumulada. */
  const rotinas = useMemo(() => {
    const metaPorId = new Map(metas.map((m) => [m.id, m]));
    return planos
      .flatMap((plano) =>
        plano.tarefas
          .filter((t) => getFrequencia(t) !== "unica")
          .map((tarefa) => {
            const meta = plano.meta ? metaPorId.get(plano.meta.id) : null;
            const janela = janelaAcumulada(
              tarefa,
              meta
                ? { data_inicio: meta.data_inicio, data_fim: meta.data_fim }
                : null,
              ehSemanaAtual ? hojeISO : domingoISO,
            );
            return {
              id: tarefa.id,
              descricao: tarefa.descricao,
              area: plano.meta?.area ?? null,
              frequencia: getFrequencia(tarefa),
              naSemana: aderencia(tarefa, execucoes, semana),
              acumulada: aderencia(tarefa, execucoes, janela),
            };
          }),
      )
      .filter((r) => r.naSemana.exigidos > 0 || r.acumulada.exigidos > 0)
      .sort((a, b) => (a.naSemana.pct ?? 1) - (b.naSemana.pct ?? 1));
  }, [planos, metas, execucoes, semana, ehSemanaAtual, hojeISO, domingoISO]);

  /**
   * Metas de hábito na semana: quantos cumprimentos a semana pediu e quantos
   * saíram. É a leitura que a meta não dá — lá o número é o total até o fim.
   */
  const habitosDaSemana = useMemo(() => {
    return metas
      .filter((m) => m.metric_type === "habito")
      .map((meta) => {
        const tarefas = planos
          .filter((p) => p.meta?.id === meta.id)
          .flatMap((p) => p.tarefas)
          .filter((t) => getFrequencia(t) !== "unica");
        return { meta, aderencia: aderenciaConjunta(tarefas, execucoes, semana) };
      })
      .filter((h) => h.aderencia.exigidos > 0)
      .sort((a, b) => (a.aderencia.pct ?? 1) - (b.aderencia.pct ?? 1));
  }, [metas, planos, execucoes, semana]);

  /** Metas que se moveram na semana, maior movimento primeiro. */
  const movimentos = useMemo(() => {
    const porMeta = new Map<string, { data_lancamento: string; valor: number }[]>();
    lancamentos.forEach((l) => {
      const lista = porMeta.get(l.meta_id) ?? [];
      lista.push({ data_lancamento: l.data_lancamento, valor: Number(l.valor) });
      porMeta.set(l.meta_id, lista);
    });
    return metas
      .map((meta) => ({
        meta,
        mov: movimentoMeta(porMeta.get(meta.id) ?? [], semana),
      }))
      .filter((m) => m.mov.depois != null)
      .sort((a, b) => Math.abs(b.mov.delta ?? 0) - Math.abs(a.mov.delta ?? 0));
  }, [metas, lancamentos, semana]);

  const carregando = carregandoAgenda || carregandoPlanos;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">
              Resumo semanal
            </div>
            <h1 className="font-display text-2xl font-semibold">
              {rotuloSemana(segundaISO)}
            </h1>
            <p className="text-xs text-muted-foreground">
              {ehSemanaAtual
                ? "Semana em andamento: o que ainda não chegou no horário não conta como perdido."
                : "Semana fechada."}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana anterior"
              onClick={() => setSegundaISO(somaDias(segundaISO, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={ehSemanaAtual}
              onClick={() => setSegundaISO(isoLocal(segundaDaSemana(new Date())))}
            >
              Esta semana
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima semana"
              disabled={ehSemanaAtual}
              onClick={() => setSegundaISO(somaDias(segundaISO, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Cumprimento da agenda
            </div>
            <div className="font-display text-3xl font-semibold tabular-nums">
              {carregando ? "—" : pctTexto(metrica.pct)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {metrica.feitos} de {metrica.total} blocos
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Contra a semana anterior
            </div>
            <div className="flex items-center gap-1.5">
              {variacao == null ? (
                <span className="font-display text-3xl font-semibold">—</span>
              ) : (
                <>
                  {variacao > 0 ? (
                    <TrendingUp className="h-5 w-5 text-[var(--color-green)]" />
                  ) : variacao < 0 ? (
                    <TrendingDown className="h-5 w-5 text-[var(--color-red)]" />
                  ) : (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-display text-3xl font-semibold tabular-nums">
                    {variacao > 0 ? "+" : ""}
                    {variacao} pp
                  </span>
                </>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Semana anterior: {pctTexto(metricaAnterior.pct)}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Ficou para trás
            </div>
            <div className="font-display text-3xl font-semibold tabular-nums">
              {carregando ? "—" : perdidos.length}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {perdidos.length === 1 ? "bloco não cumprido" : "blocos não cumpridos"}
            </div>
          </div>
        </section>

        {habitosDaSemana.length > 0 && (
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-1 text-sm font-semibold">Hábitos nesta semana</h2>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Quantos cumprimentos a semana pediu e quantos saíram. Na tela da
              meta o número é o total até o fim; aqui é só esta semana.
            </p>
            <div className="space-y-2">
              {habitosDaSemana.map(({ meta, aderencia: a }) => (
                <div
                  key={meta.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{meta.nome}</div>
                    {meta.area && (
                      <div className="text-[11px] text-muted-foreground">{meta.area}</div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-lg font-semibold">{a.cumpridos}</span>
                    <span className="text-sm text-muted-foreground">de {a.exigidos}</span>
                    {a.pct != null && (
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {Math.round(a.pct * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Rotinas</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">
            A semana mostra o momento; o acumulado vai do início da ação até
            hoje, sem passar do fim da meta. Juntos dizem se a semana foi típica.
          </p>
          {carregando ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rotinas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma rotina cadastrada nos planos de ação.
            </p>
          ) : (
            <ul className="divide-y">
              {rotinas.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: corDaArea(r.area) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.descricao}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {r.area ?? "Sem área"} · {FREQUENCIA_LABEL[r.frequencia]}
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <div className="font-semibold">
                      {r.naSemana.cumpridos} de {r.naSemana.exigidos} na semana
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.acumulada.cumpridos} de {r.acumulada.exigidos} no total ·{" "}
                      {pctTexto(r.acumulada.pct)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <CircleSlash className="h-4 w-4 text-[var(--color-amber)]" />
            <h2 className="text-sm font-semibold">O que ficou para trás</h2>
          </div>
          {carregando ? (
            <Skeleton className="h-16 w-full" />
          ) : perdidos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum bloco perdido nesta semana.
            </p>
          ) : (
            <ul className="divide-y">
              {perdidos.map((bloco) => {
                const ref = referenciaBloco(bloco);
                const motivo = ref
                  ? motivos?.get(chaveMotivo(ref, bloco.data))
                  : undefined;
                return (
                  <li key={bloco.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="w-28 shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                      {new Date(`${bloco.data}T12:00:00`).toLocaleDateString("pt-BR", {
                        weekday: "short",
                        day: "2-digit",
                      })}{" "}
                      {bloco.inicio}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {bloco.titulo}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        motivo
                          ? "bg-muted text-muted-foreground"
                          : "bg-[var(--color-amber-bg)] text-[var(--color-amber)]"
                      }`}
                    >
                      {motivo ? MOTIVO_LABEL[motivo] : "sem motivo registrado"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Quanto as metas andaram</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Diferença entre o último resultado lançado antes da semana e o
            último lançado até o fim dela. Sem lançamento na semana, o
            movimento é zero.
          </p>
          {movimentos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma meta com resultado lançado até aqui.{" "}
              <Link to="/metas" className="underline underline-offset-2">
                Lançar resultado
              </Link>
            </p>
          ) : (
            <ul className="divide-y">
              {movimentos.map(({ meta, mov }) => (
                <li key={meta.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: corDaArea(meta.area) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{meta.nome}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {meta.area} · alvo {numero(Number(meta.valor_alvo))}{" "}
                      {meta.unidade}
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <div className="font-semibold">
                      {mov.delta === 0 ? (
                        <span className="text-muted-foreground">sem movimento</span>
                      ) : (
                        <span
                          style={{
                            color:
                              (mov.delta ?? 0) > 0
                                ? "var(--color-green)"
                                : "var(--color-red)",
                          }}
                        >
                          {(mov.delta ?? 0) > 0 ? "+" : ""}
                          {numero(mov.delta ?? 0)} {meta.unidade}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {mov.antes == null ? "—" : numero(mov.antes)} →{" "}
                      {numero(mov.depois ?? 0)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
