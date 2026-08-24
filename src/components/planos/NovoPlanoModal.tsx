import { useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMetas } from "@/hooks/useMetas";
import { useAuth } from "@/hooks/useAuth";
import { useCreatePlano } from "@/hooks/usePlanos";
import { FREQUENCIAS, FREQUENCIA_LABEL, type Frequencia } from "@/lib/execucao";
import { RecorrenciaAgendaFields } from "@/components/planos/RecorrenciaAgendaFields";
import { ImpactoEsforcoPicker } from "@/components/actions/ImpactoEsforcoPicker";
import { ResponsavelSelect } from "@/components/shared/ResponsaveisPicker";
import {
  configuracaoRecorrenciaCompleta,
  diasSemanaisCompletos,
  formatDuracao,
  labelMomentoRecorrencia,
} from "@/lib/agenda";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type LinhaTarefa = {
  descricao: string;
  prazo: string;
  frequencia: Frequencia;
  quantidade: string;
  execucoes: number;
  unidade: string;
  impacto: number;
  esforco: number;
  duracao: number | null;
  horario: string;
  dias: number[] | null;
  responsavelId: string;
};

const linhaVazia = (responsavelId = ""): LinhaTarefa => ({
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
  responsavelId,
});

export function NovoPlanoModal({ open, onOpenChange }: Props) {
  const { data: metas = [] } = useMetas();
  const { user, profile } = useAuth();
  const create = useCreatePlano();

  const [titulo, setTitulo] = useState("");
  const [metaId, setMetaId] = useState<string>("__none__");
  const [tarefas, setTarefas] = useState<LinhaTarefa[]>([linhaVazia()]);

  const reset = () => {
    setTitulo("");
    setMetaId("__none__");
    setTarefas([linhaVazia(user?.id ?? "")]);
  };

  const patch = (i: number, p: Partial<LinhaTarefa>) =>
    setTarefas((prev) => prev.map((v, j) => (j === i ? { ...v, ...p } : v)));

  const membrosDoPlano =
    metaId === "__none__"
      ? user?.id
        ? [
            {
              id: user.id,
              full_name: profile?.full_name ?? "Você",
              avatar_url: profile?.avatar_url ?? null,
            },
          ]
        : []
      : (metas.find((meta) => meta.id === metaId)?.responsaveis ?? []);

  const alterarMeta = (nextMetaId: string) => {
    const opcoes =
      nextMetaId === "__none__"
        ? user?.id
          ? [
              {
                id: user.id,
                full_name: profile?.full_name ?? "Você",
                avatar_url: profile?.avatar_url ?? null,
              },
            ]
          : []
        : (metas.find((meta) => meta.id === nextMetaId)?.responsaveis ?? []);
    const preferido =
      opcoes.find((membro) => membro.id === user?.id)?.id ??
      opcoes[0]?.id ??
      "";
    setMetaId(nextMetaId);
    setTarefas((atuais) =>
      atuais.map((tarefa) => ({
        ...tarefa,
        responsavelId: opcoes.some(
          (membro) => membro.id === tarefa.responsavelId,
        )
          ? tarefa.responsavelId
          : preferido,
      })),
    );
  };

  useEffect(() => {
    if (!open || !user?.id) return;
    setTarefas((atuais) =>
      atuais.map((tarefa) =>
        tarefa.responsavelId ? tarefa : { ...tarefa, responsavelId: user.id },
      ),
    );
  }, [open, user?.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return toast.error("Informe o título do plano.");
    const semResponsavel = tarefas.find(
      (tarefa) => tarefa.descricao.trim() && !tarefa.responsavelId,
    );
    if (semResponsavel) {
      return toast.error(
        `Defina quem fará a ação: ${semResponsavel.descricao}`,
      );
    }

    const recorrenciaIncompleta = tarefas.find(
      (t) =>
        t.descricao.trim() &&
        t.frequencia !== "unica" &&
        !configuracaoRecorrenciaCompleta(
          t.frequencia,
          t.duracao,
          t.horario,
          t.dias,
        ),
    );
    if (recorrenciaIncompleta) {
      return toast.error(
        `Complete o dia, o horário e a duração da rotina: ${recorrenciaIncompleta.descricao}`,
      );
    }

    const diasSemanaisIncompletos = tarefas.find(
      (t) =>
        t.descricao.trim() &&
        !diasSemanaisCompletos(t.frequencia, t.execucoes, t.dias),
    );
    if (diasSemanaisIncompletos) {
      return toast.error(
        `Escolha ${diasSemanaisIncompletos.execucoes} dias para a rotina semanal: ${diasSemanaisIncompletos.descricao}`,
      );
    }

    try {
      await create.mutateAsync({
        titulo: titulo.trim(),
        meta_id: metaId === "__none__" ? null : metaId,
        tarefas: tarefas.map((t) => ({
          descricao: t.descricao,
          prazo: t.frequencia === "unica" ? t.prazo || null : null,
          data_inicio:
            t.frequencia !== "unica"
              ? new Date().toISOString().slice(0, 10)
              : null,
          data_fim: t.frequencia !== "unica" ? t.prazo || null : null,
          frequencia: t.frequencia,
          quantidade_planejada: Number(t.quantidade.replace(",", ".")) || 1,
          execucoes_planejadas: t.execucoes,
          unidade: t.unidade,
          impacto: t.impacto,
          esforco: t.esforco,
          responsavel_id: t.responsavelId || null,
          duracao_minutos: t.duracao,
          horario_preferencial: t.horario || null,
          dias_semana: t.frequencia !== "unica" ? t.dias : null,
        })),
      });
      toast.success("Plano criado");
      reset();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao criar plano";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo plano de ação</DialogTitle>
          <DialogDescription>
            Vincule a uma meta (opcional) e adicione até 5 tarefas iniciais.
            Tarefas vazias serão descartadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Sprint de retenção Q2"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Meta vinculada</Label>
            <Select value={metaId} onValueChange={alterarMeta}>
              <SelectTrigger>
                <SelectValue placeholder="Sem meta vinculada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem meta vinculada</SelectItem>
                {metas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Ações do plano</Label>
              <p className="text-xs text-muted-foreground">
                Defina o que será feito, com que frequência e quanto é o
                planejado. Ex.: "Prospectar" · por dia · 10 · pessoas
                prospectadas.
              </p>
            </div>
            {tarefas.map((t, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={t.descricao}
                    onChange={(e) => patch(i, { descricao: e.target.value })}
                    placeholder={`Ação ${i + 1}`}
                  />
                  {tarefas.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setTarefas((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quem executará esta ação? *</Label>
                  <ResponsavelSelect
                    membros={membrosDoPlano}
                    value={t.responsavelId}
                    onChange={(responsavelId) => patch(i, { responsavelId })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={t.frequencia}
                    onValueChange={(value) => {
                      const frequencia = value as Frequencia;
                      patch(i, {
                        frequencia,
                        dias: frequencia === "diaria" ? [1, 2, 3, 4, 5] : null,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 w-[130px]">
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
                    className="w-[80px]"
                    value={t.quantidade}
                    onChange={(e) => patch(i, { quantidade: e.target.value })}
                    aria-label="Quantidade planejada"
                  />
                  <Input
                    className="flex-1 min-w-[150px]"
                    value={t.unidade}
                    onChange={(e) => patch(i, { unidade: e.target.value })}
                    placeholder="pessoas prospectadas, Reels, reuniões…"
                  />
                  <label className="min-w-[150px] flex-1 text-[10px] font-semibold text-muted-foreground">
                    {t.frequencia === "unica"
                      ? "Prazo"
                      : "Rotina ativa até (opcional)"}
                    <Input
                      type="date"
                      className="mt-1 w-full"
                      value={t.prazo}
                      onChange={(e) => patch(i, { prazo: e.target.value })}
                    />
                  </label>
                </div>
                <RecorrenciaAgendaFields
                  frequencia={t.frequencia}
                  execucoes={t.execucoes}
                  duracao={t.duracao}
                  horario={t.horario}
                  dias={t.dias}
                  onDuracaoChange={(duracao) => patch(i, { duracao })}
                  onExecucoesChange={(execucoes) => patch(i, { execucoes })}
                  onHorarioChange={(horario) => patch(i, { horario })}
                  onDiasChange={(dias) => patch(i, { dias })}
                  compact
                />
                <p className="text-[11px] text-muted-foreground">
                  Resumo: {t.quantidade || 0} {t.unidade || "unidades"} ·{" "}
                  {FREQUENCIA_LABEL[t.frequencia].toLowerCase()}
                  {labelMomentoRecorrencia(t.frequencia, t.dias)
                    ? ` · ${labelMomentoRecorrencia(t.frequencia, t.dias)}`
                    : ""}
                  {` · ${t.execucoes} ${t.execucoes === 1 ? "bloco" : "blocos"} no calendário`}
                  {t.duracao
                    ? ` · ${formatDuracao(t.duracao)} por execução`
                    : " · sem duração estimada"}
                  {t.prazo
                    ? ` · rotina ativa até ${t.prazo.split("-").reverse().join("/")}`
                    : ""}
                </p>
                <ImpactoEsforcoPicker
                  impacto={t.impacto}
                  esforco={t.esforco}
                  onImpactoChange={(impacto) => patch(i, { impacto })}
                  onEsforcoChange={(esforco) => patch(i, { esforco })}
                  compact
                />
              </div>
            ))}
            {tarefas.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setTarefas((prev) => [
                    ...prev,
                    linhaVazia(
                      membrosDoPlano.find((membro) => membro.id === user?.id)
                        ?.id ??
                        membrosDoPlano[0]?.id ??
                        "",
                    ),
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar ação
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={create.isPending}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              {create.isPending ? "Criando…" : "Criar plano"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
