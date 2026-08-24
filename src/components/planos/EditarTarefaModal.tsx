import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecorrenciaAgendaFields } from "@/components/planos/RecorrenciaAgendaFields";
import { ImpactoEsforcoPicker } from "@/components/actions/ImpactoEsforcoPicker";
import { ResponsavelSelect } from "@/components/shared/ResponsaveisPicker";
import { useUpdateTarefa } from "@/hooks/usePlanos";
import {
  FREQUENCIAS,
  FREQUENCIA_LABEL,
  getFrequencia,
  type Frequencia,
} from "@/lib/execucao";
import {
  configuracaoRecorrenciaCompleta,
  diasRecorrenciaPersistida,
} from "@/lib/agenda";
import { todayISO, type MembroResumo, type Tarefa } from "@/lib/metas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: Tarefa;
  responsaveis: MembroResumo[];
};

type FormState = {
  descricao: string;
  frequencia: Frequencia;
  quantidade: string;
  execucoes: number;
  unidade: string;
  prazo: string;
  dataInicio: string;
  duracao: number | null;
  horario: string;
  dias: number[] | null;
  impacto: number;
  esforco: number;
  responsavelId: string;
};

const estadoDaTarefa = (tarefa: Tarefa): FormState => {
  const frequencia = getFrequencia(tarefa);
  return {
    descricao: tarefa.descricao,
    frequencia,
    quantidade: String(tarefa.quantidade_planejada ?? 1),
    execucoes: Number(tarefa.execucoes_planejadas ?? 1),
    unidade: tarefa.unidade ?? "",
    prazo:
      frequencia === "unica" ? (tarefa.prazo ?? "") : (tarefa.data_fim ?? ""),
    dataInicio: tarefa.data_inicio ?? todayISO(),
    duracao: tarefa.duracao_minutos ?? null,
    horario: tarefa.horario_preferencial?.slice(0, 5) ?? "",
    dias: diasRecorrenciaPersistida(frequencia, tarefa.dias_semana),
    impacto: tarefa.impacto ?? 5,
    esforco: tarefa.esforco ?? 5,
    responsavelId: tarefa.responsavel_id ?? "",
  };
};

export function EditarTarefaModal({
  open,
  onOpenChange,
  tarefa,
  responsaveis,
}: Props) {
  const update = useUpdateTarefa();
  const [form, setForm] = useState<FormState>(() => estadoDaTarefa(tarefa));
  const patch = (values: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...values }));

  useEffect(() => {
    if (open) setForm(estadoDaTarefa(tarefa));
  }, [open, tarefa]);

  const alterarFrequencia = (frequencia: Frequencia) => {
    patch({
      frequencia,
      dias: frequencia === "diaria" ? [1, 2, 3, 4, 5] : null,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.descricao.trim())
      return toast.error("Informe a descrição da ação.");
    if (!form.responsavelId)
      return toast.error("Selecione quem executará esta ação.");
    if (
      form.frequencia !== "unica" &&
      !configuracaoRecorrenciaCompleta(
        form.frequencia,
        form.duracao,
        form.horario,
        form.dias,
      )
    ) {
      return toast.error("Defina o dia, o horário e a duração da rotina.");
    }
    if (
      form.frequencia !== "unica" &&
      form.prazo &&
      form.dataInicio &&
      form.prazo < form.dataInicio
    ) {
      return toast.error(
        "O término da rotina não pode ser anterior ao início.",
      );
    }

    try {
      await update.mutateAsync({
        id: tarefa.id,
        descricao: form.descricao.trim(),
        frequencia: form.frequencia,
        quantidade_planejada: Number(form.quantidade.replace(",", ".")) || 1,
        execucoes_planejadas: form.execucoes,
        unidade: form.unidade.trim(),
        prazo: form.frequencia === "unica" ? form.prazo || null : null,
        data_inicio:
          form.frequencia === "unica" ? null : form.dataInicio || todayISO(),
        data_fim: form.frequencia === "unica" ? null : form.prazo || null,
        duracao_minutos: form.duracao,
        horario_preferencial: form.horario || null,
        dias_semana: form.frequencia !== "unica" ? form.dias : null,
        impacto: form.impacto,
        esforco: form.esforco,
        responsavel_id: form.responsavelId,
      });
      toast.success("Ação atualizada e agenda recalculada");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar a ação",
      );
    }
  };

  const recorrente = form.frequencia !== "unica";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar ação</DialogTitle>
          <DialogDescription>
            Ajuste a rotina sem perder o histórico do que já foi realizado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`editar-acao-${tarefa.id}`}>Descrição *</Label>
            <Input
              id={`editar-acao-${tarefa.id}`}
              value={form.descricao}
              onChange={(event) => patch({ descricao: event.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Responsável pela execução *</Label>
            <ResponsavelSelect
              membros={responsaveis}
              value={form.responsavelId}
              onChange={(responsavelId) => patch({ responsavelId })}
            />
            <p className="text-xs text-muted-foreground">
              O progresso desta ação será creditado a essa pessoa.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select
                value={form.frequencia}
                onValueChange={(value) =>
                  alterarFrequencia(value as Frequencia)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIAS.map((frequencia) => (
                    <SelectItem key={frequencia} value={frequencia}>
                      {FREQUENCIA_LABEL[frequencia]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade planejada</Label>
              <Input
                type="number"
                min={1}
                value={form.quantidade}
                onChange={(event) => patch({ quantidade: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Unidade de acompanhamento</Label>
            <Input
              value={form.unidade}
              onChange={(event) => patch({ unidade: event.target.value })}
              placeholder="Ex.: pessoas prospectadas, Reels, reuniões"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {recorrente && (
              <div className="space-y-1.5">
                <Label>Início da rotina</Label>
                <Input
                  type="date"
                  value={form.dataInicio}
                  onChange={(event) =>
                    patch({ dataInicio: event.target.value })
                  }
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>
                {recorrente
                  ? "Rotina ativa até (opcional)"
                  : "Prazo (opcional)"}
              </Label>
              <Input
                type="date"
                value={form.prazo}
                min={recorrente ? form.dataInicio : undefined}
                onChange={(event) => patch({ prazo: event.target.value })}
              />
            </div>
          </div>

          <RecorrenciaAgendaFields
            frequencia={form.frequencia}
            execucoes={form.execucoes}
            duracao={form.duracao}
            horario={form.horario}
            dias={form.dias}
            onDuracaoChange={(duracao) => patch({ duracao })}
            onExecucoesChange={(execucoes) => patch({ execucoes })}
            onHorarioChange={(horario) => patch({ horario })}
            onDiasChange={(dias) => patch({ dias })}
          />

          <ImpactoEsforcoPicker
            impacto={form.impacto}
            esforco={form.esforco}
            onImpactoChange={(impacto) => patch({ impacto })}
            onEsforcoChange={(esforco) => patch({ esforco })}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
