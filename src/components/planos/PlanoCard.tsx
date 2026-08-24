import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusChip } from "@/components/metas/StatusChip";
import {
  useAddTarefa,
  useDeletePlano,
  useDeleteTarefa,
  useExecucoes,
  useRegistrarExecucao,
  useToggleTarefa,
  type PlanoWithMeta,
} from "@/hooks/usePlanos";
import { useAuth } from "@/hooks/useAuth";
import {
  execucaoPlano,
  execucaoTarefa,
  FREQUENCIAS,
  FREQUENCIA_LABEL,
  getFrequencia,
  type Execucao,
  type Frequencia,
} from "@/lib/execucao";
import { todayISO, type MembroResumo, type Tarefa } from "@/lib/metas";
import {
  configuracaoRecorrenciaCompleta,
  diasSemanaisCompletos,
  diasRecorrenciaPersistida,
  formatDuracao,
  hhmm,
  labelMomentoRecorrencia,
} from "@/lib/agenda";
import { AgendarAcaoModal } from "@/components/planos/AgendarAcaoModal";
import { RecorrenciaAgendaFields } from "@/components/planos/RecorrenciaAgendaFields";
import { EditarPlanoModal } from "@/components/planos/EditarPlanoModal";
import { EditarTarefaModal } from "@/components/planos/EditarTarefaModal";
import { ImpactoEsforcoPicker } from "@/components/actions/ImpactoEsforcoPicker";
import {
  nomeResponsavel,
  ResponsavelSelect,
} from "@/components/shared/ResponsaveisPicker";
import { CalendarClock } from "lucide-react";

export function PlanoCard({ plano }: { plano: PlanoWithMeta }) {
  const toggleTarefa = useToggleTarefa();
  const addTarefa = useAddTarefa();
  const deletePlano = useDeletePlano();
  const { data: execucoes = [] } = useExecucoes();
  const { isAdmin, user, profile } = useAuth();
  const responsaveis: MembroResumo[] = plano.meta?.responsaveis?.length
    ? plano.meta.responsaveis
    : user?.id
      ? [
          {
            id: user.id,
            full_name: profile?.full_name ?? "Você",
            avatar_url: profile?.avatar_url ?? null,
          },
        ]
      : [];
  const responsavelPadrao =
    responsaveis.find((responsavel) => responsavel.id === user?.id)?.id ??
    responsaveis[0]?.id ??
    "";
  const podeGerenciarPlano = isAdmin || plano.criado_por === user?.id;
  const [adding, setAdding] = useState(false);
  const [editarPlanoOpen, setEditarPlanoOpen] = useState(false);
  const [nova, setNova] = useState({
    descricao: "",
    prazo: "",
    frequencia: "unica" as Frequencia,
    quantidade: "1",
    execucoes: 1,
    unidade: "",
    impacto: 5,
    esforco: 5,
    duracao: null as number | null,
    horario: "",
    dias: null as number[] | null,
    responsavelId: user?.id ?? "",
  });

  const total = plano.tarefas.length;
  const done = plano.tarefas.filter((t) => t.concluida).length;
  // Execução = média ponderada pelo impacto das ações (ver src/lib/execucao.ts)
  const pct = Math.round(execucaoPlano(plano.tarefas, execucoes) * 100);

  const submitNova = async (e: FormEvent) => {
    e.preventDefault();
    const txt = nova.descricao.trim();
    if (!txt) return;
    const responsavelId = nova.responsavelId || responsavelPadrao;
    if (!responsavelId)
      return toast.error("Selecione quem executará esta ação.");
    if (
      nova.frequencia !== "unica" &&
      !configuracaoRecorrenciaCompleta(
        nova.frequencia,
        nova.duracao,
        nova.horario,
        nova.dias,
      )
    ) {
      return toast.error("Defina o dia, o horário e a duração da rotina.");
    }
    if (!diasSemanaisCompletos(nova.frequencia, nova.execucoes, nova.dias)) {
      return toast.error(
        `Escolha ${nova.execucoes} ${nova.execucoes === 1 ? "dia" : "dias"} para esta rotina semanal.`,
      );
    }
    try {
      await addTarefa.mutateAsync({
        planoId: plano.id,
        descricao: txt,
        ordem: total,
        prazo: nova.frequencia === "unica" ? nova.prazo || null : null,
        data_inicio: nova.frequencia !== "unica" ? todayISO() : null,
        data_fim: nova.frequencia !== "unica" ? nova.prazo || null : null,
        frequencia: nova.frequencia,
        quantidade_planejada: Number(nova.quantidade.replace(",", ".")) || 1,
        execucoes_planejadas: nova.execucoes,
        unidade: nova.unidade,
        impacto: nova.impacto,
        esforco: nova.esforco,
        responsavel_id: responsavelId,
        duracao_minutos: nova.duracao,
        horario_preferencial: nova.horario || null,
        dias_semana: nova.frequencia !== "unica" ? nova.dias : null,
      });
      setNova({
        descricao: "",
        prazo: "",
        frequencia: "unica",
        quantidade: "1",
        execucoes: 1,
        unidade: "",
        impacto: 5,
        esforco: 5,
        duracao: null,
        horario: "",
        dias: null,
        responsavelId: responsavelPadrao,
      });
      setAdding(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao adicionar ação";
      toast.error(message);
    }
  };

  return (
    <div className="metasia-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base truncate">{plano.titulo}</h3>
            {plano.meta && (
              <Link
                to={`/metas/${plano.meta.id}/analise`}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 hover:opacity-80"
                style={{
                  backgroundColor: "var(--color-blue-soft)",
                  color: "var(--color-blue)",
                }}
              >
                {plano.meta.nome}
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            )}
            {plano.meta && <StatusChip status={plano.meta.status} size="sm" />}
          </div>
          <div className="text-xs text-muted-foreground">
            Execução do plano: {pct}% · {done}/{total} marcadas · criado em{" "}
            {new Date(plano.created_at).toLocaleDateString("pt-BR")}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Editar plano"
            aria-label="Editar plano"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setEditarPlanoOpen(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {podeGerenciarPlano && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Excluir plano "{plano.titulo}"?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as ações vinculadas e seus registros de execução serão
                    removidos. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await deletePlano.mutateAsync(plano.id);
                        toast.success("Plano excluído");
                      } catch (e) {
                        const message =
                          e instanceof Error ? e.message : "Erro ao excluir";
                        toast.error(message);
                      }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* execução do plano */}
      <div className="space-y-1">
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "hsl(var(--secondary))" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor:
                pct === 100 ? "var(--color-green)" : "var(--color-amber)",
            }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground text-right">
          Execução (não altera o resultado da meta) · {pct}%
        </div>
      </div>

      {/* ações */}
      {total === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhuma ação ainda. Adicione abaixo.
        </p>
      ) : (
        <ul className="space-y-2">
          {plano.tarefas.map((t) => (
            <TarefaLinha
              key={t.id}
              tarefa={t}
              execucoes={execucoes}
              onToggle={(v) => toggleTarefa.mutate({ id: t.id, concluida: v })}
              responsaveis={responsaveis}
              currentUserId={user?.id ?? null}
              podeExcluir={podeGerenciarPlano}
            />
          ))}
        </ul>
      )}

      {/* nova ação */}
      {adding ? (
        <form onSubmit={submitNova} className="space-y-2 pt-1">
          <Input
            autoFocus
            value={nova.descricao}
            onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
            placeholder="Ex: Prospectar pessoas"
            className="h-8"
          />
          <div className="space-y-1">
            <span className="text-xs font-medium">
              Responsável pela execução *
            </span>
            <ResponsavelSelect
              membros={responsaveis}
              value={nova.responsavelId || responsavelPadrao}
              onChange={(responsavelId) => setNova({ ...nova, responsavelId })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={nova.frequencia}
              onValueChange={(value) => {
                const frequencia = value as Frequencia;
                setNova({
                  ...nova,
                  frequencia,
                  dias: frequencia === "diaria" ? [1, 2, 3, 4, 5] : null,
                });
              }}
            >
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIAS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCIA_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={nova.quantidade}
              onChange={(e) => setNova({ ...nova, quantidade: e.target.value })}
              className="h-8 w-[80px]"
              aria-label="Quantidade planejada"
            />
            <Input
              value={nova.unidade}
              onChange={(e) => setNova({ ...nova, unidade: e.target.value })}
              placeholder="pessoas prospectadas"
              className="h-8 flex-1 min-w-[140px]"
            />
            <Input
              type="date"
              value={nova.prazo}
              onChange={(e) => setNova({ ...nova, prazo: e.target.value })}
              className="h-8 w-[140px]"
            />
          </div>
          <ImpactoEsforcoPicker
            impacto={nova.impacto}
            esforco={nova.esforco}
            onImpactoChange={(impacto) => setNova({ ...nova, impacto })}
            onEsforcoChange={(esforco) => setNova({ ...nova, esforco })}
            compact
          />
          <RecorrenciaAgendaFields
            frequencia={nova.frequencia}
            execucoes={nova.execucoes}
            duracao={nova.duracao}
            horario={nova.horario}
            dias={nova.dias}
            onDuracaoChange={(duracao) => setNova({ ...nova, duracao })}
            onExecucoesChange={(execucoes) => setNova({ ...nova, execucoes })}
            onHorarioChange={(horario) => setNova({ ...nova, horario })}
            onDiasChange={(dias) => setNova({ ...nova, dias })}
            compact
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!nova.descricao.trim()}>
              Adicionar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAdding(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            setNova((atual) => ({
              ...atual,
              responsavelId: atual.responsavelId || responsavelPadrao,
            }));
            setAdding(true);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar ação
        </Button>
      )}

      <EditarPlanoModal
        open={editarPlanoOpen}
        onOpenChange={setEditarPlanoOpen}
        plano={plano}
      />
    </div>
  );
}

function TarefaLinha({
  tarefa,
  execucoes,
  onToggle,
  responsaveis,
  currentUserId,
  podeExcluir,
}: {
  tarefa: Tarefa;
  execucoes: Execucao[];
  onToggle: (v: boolean) => void;
  responsaveis: MembroResumo[];
  currentUserId: string | null;
  podeExcluir: boolean;
}) {
  const registrar = useRegistrarExecucao();
  const deleteTarefa = useDeleteTarefa();
  const [valor, setValor] = useState("");
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const freq = getFrequencia(tarefa);
  const exec = execucaoTarefa(tarefa, execucoes);
  const diasRecorrencia = diasRecorrenciaPersistida(freq, tarefa.dias_semana);
  const momentoRecorrencia = labelMomentoRecorrencia(freq, diasRecorrencia);
  const execucoesAgenda = Math.max(1, Number(tarefa.execucoes_planejadas ?? 1));
  const mensuravel =
    freq !== "unica" ||
    Number(tarefa.quantidade_planejada ?? 1) > 1 ||
    !!tarefa.unidade;
  const podeExecutar =
    !tarefa.responsavel_id || tarefa.responsavel_id === currentUserId;
  const responsavelNome = nomeResponsavel(responsaveis, tarefa.responsavel_id);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    const num = Number(valor.replace(",", "."));
    if (!Number.isFinite(num)) return toast.error("Informe um número.");
    try {
      await registrar.mutateAsync({
        tarefaId: tarefa.id,
        quantidade: num,
        data: todayISO(),
      });
      setValor("");
      toast.success("Execução registrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    }
  };

  return (
    <li className="rounded-lg border bg-card/60 px-3 py-2 space-y-1.5">
      <div className="flex items-start gap-2">
        <Checkbox
          checked={tarefa.concluida}
          onCheckedChange={(v) => podeExecutar && onToggle(v === true)}
          disabled={!podeExecutar}
          title={
            podeExecutar
              ? "Concluir ação"
              : `Somente ${responsavelNome} pode concluir`
          }
          className="mt-0.5"
        />
        <span
          className={`text-sm flex-1 leading-snug ${tarefa.concluida ? "line-through text-muted-foreground" : ""}`}
        >
          {tarefa.descricao}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={podeExecutar ? "Editar ação" : `Ação de ${responsavelNome}`}
          aria-label="Editar ação"
          disabled={!podeExecutar}
          className="h-7 w-7 text-muted-foreground"
          onClick={() => podeExecutar && setEditarOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={
            podeExecutar
              ? "Agendar no calendário"
              : `Agenda de ${responsavelNome}`
          }
          disabled={!podeExecutar}
          className="h-7 w-7 text-muted-foreground"
          onClick={() => podeExecutar && setAgendarOpen(true)}
        >
          <CalendarClock className="h-3.5 w-3.5" />
        </Button>
        {podeExcluir && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Excluir ação"
                aria-label="Excluir ação"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Excluir a ação “{tarefa.descricao}”?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Os horários do calendário e os registros de execução desta
                  ação também serão excluídos. O plano continuará existindo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteTarefa.isPending}
                  onClick={async () => {
                    try {
                      await deleteTarefa.mutateAsync(tarefa.id);
                      toast.success("Ação excluída");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Não foi possível excluir a ação",
                      );
                    }
                  }}
                >
                  {deleteTarefa.isPending ? "Excluindo…" : "Excluir ação"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
          {FREQUENCIA_LABEL[freq]}
          {tarefa.prazo
            ? ` · ${new Date(`${tarefa.prazo}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
            : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-6 text-[11px] text-muted-foreground">
        <span
          className="rounded-full px-2 py-0.5 font-semibold"
          style={{
            backgroundColor: "var(--color-blue-soft)",
            color: "var(--color-blue)",
          }}
        >
          Responsável: {responsavelNome}
        </span>
        {formatDuracao(tarefa.duracao_minutos) ? (
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
            {formatDuracao(tarefa.duracao_minutos)} por execução
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5">
            Sem duração estimada
          </span>
        )}
        {hhmm(tarefa.horario_preferencial) && (
          <span>Horário {hhmm(tarefa.horario_preferencial)}</span>
        )}
        {momentoRecorrencia && <span>{momentoRecorrencia}</span>}
        {execucoesAgenda > 1 && (
          <span className="rounded-full bg-[var(--brand-accent-soft)] px-2 py-0.5 font-semibold text-[var(--brand-primary)]">
            {execucoesAgenda} execuções {FREQUENCIA_LABEL[freq].toLowerCase()}
          </span>
        )}
        {tarefa.prazo && (
          <span>
            Prazo final{" "}
            {new Date(`${tarefa.prazo}T12:00:00`).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      <EditarTarefaModal
        open={editarOpen}
        onOpenChange={setEditarOpen}
        tarefa={tarefa}
        responsaveis={responsaveis}
      />
      <AgendarAcaoModal
        open={agendarOpen}
        onOpenChange={setAgendarOpen}
        tarefa={tarefa}
        dataInicial={todayISO()}
      />

      {mensuravel && (
        <div className="flex items-center gap-2 pl-6 flex-wrap">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-amber)" }}
          >
            {exec.texto}
          </span>
          <span className="text-[10px] text-muted-foreground">
            ({exec.periodoLabel})
          </span>
          {podeExecutar ? (
            <form onSubmit={salvar} className="flex items-center gap-1 ml-auto">
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="realizado"
                inputMode="decimal"
                className="h-7 w-[92px] text-xs"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={!valor}
              >
                Registrar
              </Button>
            </form>
          ) : (
            <span className="ml-auto text-[10px] text-muted-foreground">
              O registro será feito por {responsavelNome}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
