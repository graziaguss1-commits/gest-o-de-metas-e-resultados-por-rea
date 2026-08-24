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
import { DuracaoPicker } from "@/components/planos/DuracaoPicker";
import { AgendaDiaPreview } from "@/components/calendar/AgendaDiaPreview";
import { useAgendarTarefa, useReagendarTarefa } from "@/hooks/useAgendamentos";
import { useAgendaDoDia } from "@/hooks/useAgendaDoDia";
import { useUpdateTarefa } from "@/hooks/usePlanos";
import {
  formatDuracao,
  hhmm,
  horaFim,
  intervalosConflitam,
} from "@/lib/agenda";
import type { Tarefa } from "@/lib/metas";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefa: Tarefa | null;
  /** Data pré-selecionada (YYYY-MM-DD). */
  dataInicial?: string;
  /** Limita o agendamento à semana que está sendo planejada. */
  dataMin?: string;
  dataMax?: string;
  /** Quando informado, o modal reagenda a ocorrência existente. */
  agendamentoId?: string;
  horaInicial?: string;
  duracaoInicial?: number | null;
};

export function AgendarAcaoModal({
  open,
  onOpenChange,
  tarefa,
  dataInicial,
  dataMin,
  dataMax,
  agendamentoId,
  horaInicial,
  duracaoInicial,
}: Props) {
  const agendar = useAgendarTarefa();
  const reagendar = useReagendarTarefa();
  const updateTarefa = useUpdateTarefa();

  const [data, setData] = useState(dataInicial ?? "");
  const [hora, setHora] = useState(horaInicial ?? "09:00");
  const [duracao, setDuracao] = useState<number | null>(duracaoInicial ?? null);
  const [salvarNaAcao, setSalvarNaAcao] = useState(false);
  const { blocos, isLoading: agendaLoading } = useAgendaDoDia(data, {
    excluirAgendamentoId: agendamentoId,
  });
  const conflito =
    duracao && hora
      ? blocos.find((bloco) =>
          intervalosConflitam(
            hora,
            horaFim(hora, duracao),
            bloco.inicio,
            bloco.fim,
          ),
        )
      : undefined;

  useEffect(() => {
    if (!open) return;
    setData(dataInicial ?? "");
    setHora(hhmm(horaInicial ?? tarefa?.horario_preferencial ?? "") || "09:00");
    const d = duracaoInicial ?? tarefa?.duracao_minutos ?? null;
    setDuracao(d);
    setSalvarNaAcao(!tarefa?.duracao_minutos);
  }, [open, dataInicial, horaInicial, duracaoInicial, tarefa]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tarefa) return;
    if (!data) return toast.error("Escolha a data.");
    if ((dataMin && data < dataMin) || (dataMax && data > dataMax)) {
      return toast.error(
        "Escolha um dia dentro da semana que está sendo planejada.",
      );
    }
    if (!hora) return toast.error("Escolha o horário de início.");
    if (!duracao || duracao <= 0) {
      return toast.error(
        "Informe a duração estimada antes de posicionar em horário.",
      );
    }
    if (agendaLoading) return toast.error("Aguarde sua agenda carregar.");
    if (conflito) {
      return toast.error(
        `Esse horário conflita com ${conflito.titulo} (${conflito.inicio}–${conflito.fim}).`,
      );
    }
    try {
      if (agendamentoId) {
        await reagendar.mutateAsync({
          id: agendamentoId,
          data,
          horaInicio: hora,
          duracaoMinutos: duracao,
        });
      } else {
        await agendar.mutateAsync({
          tarefaId: tarefa.id,
          data,
          horaInicio: hora,
          duracaoMinutos: duracao,
        });
      }
      if (salvarNaAcao && duracao !== tarefa.duracao_minutos) {
        await updateTarefa.mutateAsync({
          id: tarefa.id,
          duracao_minutos: duracao,
        });
      }
      toast.success(agendamentoId ? "Ocorrência reagendada" : "Ação agendada");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao agendar");
    }
  };

  const pending = agendar.isPending || reagendar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>
            {agendamentoId ? "Reagendar ocorrência" : "Agendar no calendário"}
          </DialogTitle>
          <DialogDescription>
            {tarefa?.descricao} — escolha a data e veja sua agenda antes de
            definir o melhor horário.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_370px]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ag-data">Data</Label>
                  <Input
                    id="ag-data"
                    type="date"
                    value={data}
                    min={dataMin}
                    max={dataMax}
                    onChange={(e) => setData(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ag-hora">Início</Label>
                  <Input
                    id="ag-hora"
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Duração estimada por execução</Label>
                <DuracaoPicker
                  value={duracao}
                  onChange={setDuracao}
                  allowEmpty={false}
                />
              </div>

              {duracao ? (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    conflito
                      ? "border-[var(--color-red)]/40 bg-[var(--color-red-bg)]"
                      : "bg-muted/20"
                  }`}
                >
                  Bloco selecionado:{" "}
                  <strong>
                    {hora}–{horaFim(hora, duracao)}
                  </strong>{" "}
                  <span className="text-muted-foreground">
                    ({formatDuracao(duracao)})
                  </span>
                </div>
              ) : null}

              {!tarefa?.duracao_minutos && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={salvarNaAcao}
                    onChange={(e) => setSalvarNaAcao(e.target.checked)}
                  />
                  Salvar esta duração como estimativa padrão da ação
                </label>
              )}
            </div>

            <AgendaDiaPreview
              data={data}
              hora={hora}
              duracao={duracao}
              tituloNovoBloco={tarefa?.descricao ?? "Novo bloco"}
              blocos={blocos}
              isLoading={agendaLoading}
              conflito={conflito}
              onSelectHora={setHora}
            />
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
              disabled={pending || agendaLoading || Boolean(conflito)}
              className="brand-button"
            >
              {pending ? "Salvando…" : agendamentoId ? "Reagendar" : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
