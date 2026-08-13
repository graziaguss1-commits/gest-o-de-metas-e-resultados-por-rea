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
import { DuracaoPicker } from "@/components/planos/DuracaoPicker";
import { DiasSemanaPicker } from "@/components/planos/DiasSemanaPicker";
import { ImpactoEsforcoPicker } from "@/components/actions/ImpactoEsforcoPicker";
import { useUpdateTarefa } from "@/hooks/usePlanos";
import {
  FREQUENCIAS,
  FREQUENCIA_LABEL,
  getFrequencia,
  type Frequencia,
} from "@/lib/execucao";
import { horaFim, labelDiasSemana } from "@/lib/agenda";
import { todayISO, type Tarefa } from "@/lib/metas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: Tarefa;
};

type FormState = {
  descricao: string;
  frequencia: Frequencia;
  quantidade: string;
  unidade: string;
  prazo: string;
  dataInicio: string;
  duracao: number | null;
  horario: string;
  dias: number[] | null;
  impacto: number;
  esforco: number;
};

const estadoDaTarefa = (tarefa: Tarefa): FormState => {
  const frequencia = getFrequencia(tarefa);
  return {
    descricao: tarefa.descricao,
    frequencia,
    quantidade: String(tarefa.quantidade_planejada ?? 1),
    unidade: tarefa.unidade ?? "",
    prazo: frequencia === "unica" ? tarefa.prazo ?? "" : tarefa.data_fim ?? "",
    dataInicio: tarefa.data_inicio ?? todayISO(),
    duracao: tarefa.duracao_minutos ?? null,
    horario: tarefa.horario_preferencial?.slice(0, 5) ?? "",
    dias: tarefa.dias_semana ??
      (frequencia === "diaria" ? [1, 2, 3, 4, 5] : frequencia === "semanal" ? [1] : null),
    impacto: tarefa.impacto ?? 5,
    esforco: tarefa.esforco ?? 5,
  };
};

export function EditarTarefaModal({ open, onOpenChange, tarefa }: Props) {
  const update = useUpdateTarefa();
  const [form, setForm] = useState<FormState>(() => estadoDaTarefa(tarefa));
  const patch = (values: Partial<FormState>) => setForm((current) => ({ ...current, ...values }));

  useEffect(() => {
    if (open) setForm(estadoDaTarefa(tarefa));
  }, [open, tarefa]);

  const alterarFrequencia = (frequencia: Frequencia) => {
    patch({
      frequencia,
      dias:
        frequencia === "diaria"
          ? form.dias ?? [1, 2, 3, 4, 5]
          : frequencia === "semanal"
            ? form.dias ?? [1]
            : null,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.descricao.trim()) return toast.error("Informe a descrição da ação.");
    if (
      form.frequencia === "diaria" &&
      (!form.duracao || !form.horario || !form.dias?.length)
    ) {
      return toast.error("Defina horário, duração e dias da rotina diária.");
    }
    if (
      form.frequencia !== "unica" &&
      form.prazo &&
      form.dataInicio &&
      form.prazo < form.dataInicio
    ) {
      return toast.error("O término da rotina não pode ser anterior ao início.");
    }

    try {
      await update.mutateAsync({
        id: tarefa.id,
        descricao: form.descricao.trim(),
        frequencia: form.frequencia,
        quantidade_planejada: Number(form.quantidade.replace(",", ".")) || 1,
        unidade: form.unidade.trim(),
        prazo: form.frequencia === "unica" ? form.prazo || null : null,
        data_inicio: form.frequencia === "unica" ? null : form.dataInicio || todayISO(),
        data_fim: form.frequencia === "unica" ? null : form.prazo || null,
        duracao_minutos: form.duracao,
        horario_preferencial: form.horario || null,
        dias_semana:
          form.frequencia === "diaria" || form.frequencia === "semanal"
            ? form.dias
            : null,
        impacto: form.impacto,
        esforco: form.esforco,
      });
      toast.success("Ação atualizada e agenda recalculada");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar a ação");
    }
  };

  const recorrente = form.frequencia !== "unica";
  const selecionaDias = form.frequencia === "diaria" || form.frequencia === "semanal";

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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select
                value={form.frequencia}
                onValueChange={(value) => alterarFrequencia(value as Frequencia)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                  onChange={(event) => patch({ dataInicio: event.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{recorrente ? "Rotina ativa até (opcional)" : "Prazo (opcional)"}</Label>
              <Input
                type="date"
                value={form.prazo}
                min={recorrente ? form.dataInicio : undefined}
                onChange={(event) => patch({ prazo: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-semibold">Bloco de agenda</div>
              <p className="text-xs text-muted-foreground">
                Defina quanto tempo essa ação ocupa e o horário preferencial.
              </p>
            </div>
            <DuracaoPicker
              value={form.duracao}
              onChange={(duracao) => patch({ duracao })}
            />
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1.5 text-sm font-medium">
                Horário preferencial{form.frequencia === "diaria" ? " *" : ""}
                <Input
                  type="time"
                  className="w-[140px]"
                  value={form.horario}
                  onChange={(event) => patch({ horario: event.target.value })}
                />
              </label>
              {form.horario && form.duracao && (
                <span className="pb-2 text-sm font-medium text-[var(--brand-primary)]">
                  {form.horario}–{horaFim(form.horario, form.duracao)}
                </span>
              )}
            </div>

            {selecionaDias && (
              <div className="space-y-1.5">
                <Label>
                  {form.frequencia === "diaria" ? "Dias de execução *" : "Dia da semana"}
                </Label>
                <DiasSemanaPicker value={form.dias} onChange={(dias) => patch({ dias })} />
                {labelDiasSemana(form.dias) && (
                  <p className="text-xs text-muted-foreground">
                    {labelDiasSemana(form.dias)}
                  </p>
                )}
              </div>
            )}
          </div>

          <ImpactoEsforcoPicker
            impacto={form.impacto}
            esforco={form.esforco}
            onImpactoChange={(impacto) => patch({ impacto })}
            onEsforcoChange={(esforco) => patch({ esforco })}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
