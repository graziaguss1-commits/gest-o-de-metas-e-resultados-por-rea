import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ListChecks,
  Plus,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BurnUpChart } from "@/components/metas/BurnUpChart";
import { ExecucaoConsolidada } from "@/components/metas/ExecucaoConsolidada";
import { FunilMeta } from "@/components/metas/FunilMeta";
import { StatusChip } from "@/components/metas/StatusChip";
import {
  useComentarios,
  useCreateComentario,
  useLancamentos,
  useMeta,
} from "@/hooks/useMetas";
import { useAnaliseMeta } from "@/hooks/useAnaliseMeta";
import { useAddTarefa, useCreatePlano, usePlanos } from "@/hooks/usePlanos";
import { PlanoCard } from "@/components/planos/PlanoCard";
import {
  desvioPercentual,
  formatDateISOToBR,
  formatValor,
  formatNumero,
  getMetricType,
  progressoEsperado,
  progressoReal,
  type Status,
} from "@/lib/metas";
import { useAuth } from "@/hooks/useAuth";

function initials(name?: string | null) {
  if (!name) return "•";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function aiModelLabel(model?: string) {
  if (!model) return "Claude";
  if (model === "claude-sonnet-5" || model.startsWith("claude-sonnet-5-")) {
    return "Claude Sonnet 5";
  }
  return model;
}

function formatUsd(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value ?? 0);
}

export default function AnaliseMetaPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: meta, isLoading: loadingMeta } = useMeta(id);
  const { data: lancamentos = [] } = useLancamentos(id);
  const { data: comentarios = [] } = useComentarios(id);
  const analise = useAnaliseMeta();
  const criarPlano = useCreatePlano();
  const addTarefa = useAddTarefa();
  const { data: todosPlanos = [] } = usePlanos();
  const planosDaMeta = useMemo(
    () => todosPlanos.filter((p) => p.meta_id === id),
    [todosPlanos, id],
  );
  const planoAlvo = planosDaMeta[0] ?? null; // mais recente (lista já vem desc)
  const [addedIdx, setAddedIdx] = useState<Set<number>>(new Set());

  const gerarAnalise = () => {
    if (!meta) return;
    setAddedIdx(new Set());
    analise.mutate({ meta, lancamentos });
  };

  const adicionarAcao = async (idx: number, acao: { titulo: string; contexto: string }) => {
    const descricao = acao.contexto ? `${acao.titulo}\n${acao.contexto}` : acao.titulo;
    try {
      if (planoAlvo) {
        await addTarefa.mutateAsync({
          planoId: planoAlvo.id,
          descricao,
          ordem: planoAlvo.tarefas.length + idx,
        });
        toast.success("Tarefa adicionada ao plano");
      } else {
        await criarPlano.mutateAsync({
          titulo: `Plano IA · ${meta?.nome ?? ""}`.trim(),
          meta_id: id ?? null,
          tarefas: [{ descricao }],
        });
        toast.success("Plano criado com esta sugestão");
      }
      setAddedIdx((prev) => new Set(prev).add(idx));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao adicionar tarefa";
      toast.error(message);
    }
  };

  const adicionarTodas = async () => {
    if (!analise.data) return;
    const pendentes = analise.data.acoes
      .map((a, i) => ({ a, i }))
      .filter(({ i }) => !addedIdx.has(i));
    if (pendentes.length === 0) return;
    try {
      if (planoAlvo) {
        for (const { a, i } of pendentes) {
          const descricao = a.contexto ? `${a.titulo}\n${a.contexto}` : a.titulo;
          await addTarefa.mutateAsync({
            planoId: planoAlvo.id,
            descricao,
            ordem: planoAlvo.tarefas.length + i,
          });
        }
        toast.success(`${pendentes.length} tarefas adicionadas ao plano`);
      } else {
        await criarPlano.mutateAsync({
          titulo: `Plano IA · ${meta?.nome ?? ""}`.trim(),
          meta_id: id ?? null,
          tarefas: pendentes.map(({ a }) => ({
            descricao: a.contexto ? `${a.titulo}\n${a.contexto}` : a.titulo,
          })),
        });
        toast.success("Plano criado com as sugestões da IA");
      }
      setAddedIdx(new Set(analise.data.acoes.map((_, i) => i)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao adicionar tarefas";
      toast.error(message);
    }
  };


  if (loadingMeta) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  if (!meta) {
    return (
      <AppShell>
        <div className="metasia-card p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">Meta não encontrada.</p>
          <Button asChild variant="outline">
            <Link to="/metas">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar para metas
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const status = meta.status as Status;
  const real = progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse);
  const esperado = progressoEsperado(meta.data_inicio, meta.data_fim);
  const desvio = desvioPercentual(meta);
  const metricType = getMetricType(meta);
  const valorFmt = (v: number) =>
    metricType === "financeiro" || metricType === "percentual"
      ? formatValor(v, meta.unidade)
      : `${formatNumero(v)} ${meta.unidade}`.trim();

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2">
                <Link to="/metas">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Minhas Metas
                </Link>
              </Button>
              <StatusChip status={status} size="sm" />
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ backgroundColor: "var(--color-blue-soft)", color: "var(--color-blue)" }}
              >
                {meta.area}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{meta.nome}</h1>
            {meta.descricao && (
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{meta.descricao}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{valorFmt(meta.valor_atual)}</div>
            <div className="text-xs text-muted-foreground">
              de {valorFmt(meta.valor_alvo)} ·{" "}
              <span style={{ color: desvio < -20 ? "var(--color-red)" : desvio < -5 ? "var(--color-amber)" : "var(--color-green)" }}>
                {desvio}pp
              </span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
          {/* esquerda */}
          <div className="space-y-4">
            <ExecucaoConsolidada meta={meta} variant="completo" />

            <BurnUpChart
              meta={meta}
              lancamentos={lancamentos}
              previsaoFinal={analise.data?.previsao_final}
            />

            <FunilMeta meta={meta} />

            <div className="metasia-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Histórico de lançamentos</h3>
              </div>
              {lancamentos.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum lançamento ainda — use "Lançar resultado" na sidebar.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="w-[100px]">Desvio</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...lancamentos].reverse().map((l) => {
                      const esp =
                        ((new Date(l.data_lancamento).getTime() -
                          new Date(meta.data_inicio).getTime()) /
                          Math.max(
                            1,
                            new Date(meta.data_fim).getTime() -
                              new Date(meta.data_inicio).getTime(),
                          )) *
                        meta.valor_alvo;
                      const d = meta.valor_alvo
                        ? Math.round(((l.valor - esp) / meta.valor_alvo) * 100)
                        : 0;
                      const dPos = meta.is_inverse ? -d : d;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs">
                            {formatDateISOToBR(l.data_lancamento)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {valorFmt(l.valor)}
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-xs font-medium"
                              style={{ color: dPos < 0 ? "var(--color-red)" : "var(--color-green)" }}
                            >
                              {dPos > 0 ? "+" : ""}
                              {dPos}pp
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {l.observacao ?? "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="metasia-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ListChecks className="h-4 w-4" style={{ color: "var(--color-blue)" }} />
                  Planos de Ação · {planosDaMeta.length}
                </h3>
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <Link to="/planos">Ver todos</Link>
                </Button>
              </div>
              {planosDaMeta.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum plano vinculado a esta meta ainda. Crie um a partir da análise da IA ao lado ou em{" "}
                  <Link to="/planos" className="underline" style={{ color: "var(--color-blue)" }}>
                    Planos de Ação
                  </Link>.
                </div>
              ) : (
                <div className="p-3 space-y-3">
                  {planosDaMeta.map((p) => (
                    <PlanoCard key={p.id} plano={p} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* direita: painel IA */}

          <div className="space-y-4">
            <div className="metasia-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: "var(--color-blue)" }} />
                  <h3 className="font-bold text-sm uppercase tracking-wider">
                    Análise de Saúde
                  </h3>
                </div>
                {analise.data?.model && (
                  <div className="text-right shrink-0">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-block"
                      style={{ backgroundColor: "var(--color-green-bg)", color: "var(--color-green)" }}
                    >
                      {aiModelLabel(analise.data.model)}
                    </span>
                    {analise.data.gerado_em && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(analise.data.gerado_em).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {analise.isPending ? (
                <div className="py-8 text-center space-y-2">
                  <div className="inline-block animate-spin h-6 w-6 rounded-full border-2 border-muted border-t-foreground" />
                  <p className="text-sm text-muted-foreground">A IA está analisando…</p>
                </div>
              ) : analise.isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">
                    {analise.error instanceof Error
                      ? analise.error.message
                      : "Erro ao gerar análise"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={gerarAnalise}
                  >
                    Tentar novamente
                  </Button>
                  {analise.error instanceof Error
                    && analise.error.message.includes("Configurações") && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/configuracoes/integrations">Configurar Claude</Link>
                      </Button>
                    )}
                </div>
              ) : analise.data ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      {analise.data.vai_bater ? (
                        <>
                          <CheckCircle2
                            className="h-4 w-4"
                            style={{ color: "var(--color-green)" }}
                          />
                          <span className="font-semibold" style={{ color: "var(--color-green)" }}>
                            Previsão: vai bater a meta
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle
                            className="h-4 w-4"
                            style={{ color: "var(--color-red)" }}
                          />
                          <span className="font-semibold" style={{ color: "var(--color-red)" }}>
                            Previsão: não bate a meta
                          </span>
                        </>
                      )}
                      <span className="text-muted-foreground">
                        ({valorFmt(analise.data.previsao_final)})
                      </span>
                    </div>
                    <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                      {analise.data.diagnostico}
                    </div>
                    {analise.data.provider === "anthropic" && analise.data.usage && (
                      <div className="text-[10px] text-muted-foreground">
                        Gerado pela API da Anthropic ·{" "}
                        {(analise.data.usage.input_tokens + analise.data.usage.output_tokens).toLocaleString("pt-BR")} tokens ·{" "}
                        custo estimado {formatUsd(analise.data.usage.custo_estimado_usd)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Sugestões da IA
                      </div>
                      {analise.data.acoes.some((_, i) => !addedIdx.has(i)) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={adicionarTodas}
                          disabled={addTarefa.isPending || criarPlano.isPending}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Adicionar todas
                        </Button>
                      )}
                    </div>
                    {analise.data.acoes.map((a, i) => {
                      const added = addedIdx.has(i);
                      return (
                        <div
                          key={i}
                          className="rounded-md border p-2.5 flex items-start gap-2 bg-muted/30"
                        >
                          <span
                            className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                            style={{ backgroundColor: "var(--color-blue)" }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-snug">{a.titulo}</div>
                            <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                              {a.contexto}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={added ? "ghost" : "outline"}
                            className="h-7 px-2 shrink-0"
                            onClick={() => adicionarAcao(i, a)}
                            disabled={added || addTarefa.isPending || criarPlano.isPending}
                            title={
                              planoAlvo
                                ? `Adicionar ao plano "${planoAlvo.titulo}"`
                                : "Criar plano com esta tarefa"
                            }
                          >
                            {added ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1" style={{ color: "var(--color-green)" }} />
                                <span className="text-xs">Adicionada</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs">Adicionar</span>
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-muted-foreground pt-1">
                      {planoAlvo ? (
                        <>
                          As tarefas vão para o plano{" "}
                          <Link to="/planos" className="underline" style={{ color: "var(--color-blue)" }}>
                            {planoAlvo.titulo}
                          </Link>
                          .
                        </>
                      ) : (
                        <>Nenhum plano vinculado ainda — ao adicionar, um novo plano será criado.</>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-3">

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const { data, error } = await import("@/integrations/supabase/client").then(
                            ({ supabase }) =>
                              supabase.functions.invoke("resumo-slack", {
                                body: {
                                  tipo: "alerta",
                                  metas: [
                                    {
                                      id: meta.id,
                                      nome: meta.nome,
                                      area: meta.area,
                                      status: meta.status,
                                      valor_atual: meta.valor_atual,
                                      valor_alvo: meta.valor_alvo,
                                      unidade: meta.unidade,
                                      diagnostico: analise.data!.diagnostico.slice(0, 280),
                                    },
                                  ],
                                },
                              }),
                          );
                          if (error) throw error;
                          if ((data as { ok?: boolean })?.ok) {
                            toast.success("Resumo enviado para o Slack");
                          } else {
                            toast.warning(
                              (data as { message?: string })?.message ??
                                "Não foi possível enviar agora. Verifique se o webhook está configurado em /configuracoes.",
                            );
                          }
                        } catch (e) {
                          const message = e instanceof Error ? e.message : "Erro ao enviar para Slack";
                          toast.error(message);
                        }
                      }}
                    >
                      <Send className="h-4 w-4 mr-1.5" />
                      Gerar resumo para Slack
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Receba um diagnóstico em linguagem executiva, com 3 ações recomendadas e
                    previsão de fechamento.
                  </p>
                  <div className="text-xs space-y-1">
                    <div>
                      Progresso real:{" "}
                      <span className="font-semibold">{Math.round(real * 100)}%</span>
                    </div>
                    <div>
                      Progresso esperado:{" "}
                      <span className="font-semibold">{Math.round(esperado * 100)}%</span>
                    </div>
                    <div>
                      Desvio:{" "}
                      <span className="font-semibold" style={{ color: desvio < 0 ? "var(--color-red)" : "var(--color-green)" }}>
                        {desvio}pp
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={gerarAnalise}
                    style={{ backgroundColor: "var(--color-blue)", color: "white" }}
                    className="w-full hover:opacity-90"
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Gerar análise
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comentários */}
        <ComentariosSection metaId={meta.id} />
      </div>
    </AppShell>
  );
}

function ComentariosSection({ metaId }: { metaId: string }) {
  const { data: comentarios = [] } = useComentarios(metaId);
  const { profile } = useAuth();
  const createComentario = useCreateComentario();
  const [texto, setTexto] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    try {
      await createComentario.mutateAsync({ metaId, conteudo: t });
      setTexto("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao publicar";
      toast.error(message);
    }
  };

  return (
    <section className="metasia-card p-5 space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Comentários · {comentarios.length}
      </h3>

      {comentarios.length > 0 ? (
        <div className="space-y-3">
          {comentarios.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div
                className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: "var(--color-navy-3)" }}
              >
                {c.autor_id === profile?.id ? initials(profile?.full_name) : "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-0.5">
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="text-sm whitespace-pre-wrap">{c.conteudo}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum comentário ainda. Seja o primeiro a registrar contexto sobre esta meta.
        </p>
      )}

      <form onSubmit={submit} className="space-y-2 pt-2 border-t">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Adicione um comentário…"
          rows={2}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!texto.trim() || createComentario.isPending}
            size="sm"
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90"
          >
            {createComentario.isPending ? "Publicando…" : "Comentar"}
          </Button>
        </div>
      </form>
    </section>
  );
}
