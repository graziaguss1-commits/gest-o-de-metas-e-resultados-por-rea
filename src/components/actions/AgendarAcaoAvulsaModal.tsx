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
import {
  useScheduleAction,
  type ActionItem,
} from "@/hooks/useActions";
import { formatDuracao, hhmm, horaFim } from "@/lib/agenda";
import { todayISO } from "@/lib/metas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ActionItem | null;
  dataInicial?: string;
  dataMin?: string;
  dataMax?: string;
};

export function AgendarAcaoAvulsaModal({
  open,
  onOpenChange,
  action,
  dataInicial,
  dataMin,
  dataMax,
}: Props) {
  const schedule = useScheduleAction();
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [duracao, setDuracao] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const dataExistente = action?.data_agendada;
    const dentroDaSemana = Boolean(
      dataExistente &&
        (!dataMin || dataExistente >= dataMin) &&
        (!dataMax || dataExistente <= dataMax),
    );
    setData(dentroDaSemana ? dataExistente! : dataInicial ?? dataMin ?? todayISO());
    setHora(hhmm(action?.hora_inicio ?? "") || "09:00");
    setDuracao(action?.duracao_minutos ?? null);
  }, [open, action, dataInicial, dataMin, dataMax]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!action) return;
    if (!data) return toast.error("Escolha o dia da execução.");
    if ((dataMin && data < dataMin) || (dataMax && data > dataMax)) {
      return toast.error("Escolha um dia dentro da semana que está sendo planejada.");
    }
    if (!hora) return toast.error("Escolha o horário de início.");
    if (!duracao || duracao <= 0) {
      return toast.error("Informe quanto tempo esta ação deve ocupar.");
    }

    try {
      await schedule.mutateAsync({
        id: action.id,
        data,
        horaInicio: hora,
        duracaoMinutos: duracao,
      });
      toast.success(
        action.data_agendada
          ? "Horário da prioridade atualizado"
          : "Prioridade adicionada ao calendário",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível agendar a prioridade",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {action?.data_agendada ? "Reagendar prioridade" : "Colocar na semana"}
          </DialogTitle>
          <DialogDescription>
            {action?.descricao} — transforme esta prioridade em um bloco protegido na agenda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="avulsa-data">Dia da execução</Label>
              <Input
                id="avulsa-data"
                type="date"
                value={data}
                min={dataMin}
                max={dataMax}
                onChange={(event) => setData(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avulsa-hora">Horário de início</Label>
              <Input
                id="avulsa-hora"
                type="time"
                value={hora}
                onChange={(event) => setHora(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tempo reservado</Label>
            <DuracaoPicker value={duracao} onChange={setDuracao} allowEmpty={false} />
          </div>

          {duracao ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              Bloco na agenda:{" "}
              <strong>
                {hora}–{horaFim(hora, duracao)}
              </strong>{" "}
              <span className="text-muted-foreground">
                ({formatDuracao(duracao)})
              </span>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {action?.data_agendada ? "Cancelar" : "Deixar para depois"}
            </Button>
            <Button
              type="submit"
              className="brand-button"
              disabled={schedule.isPending}
            >
              {schedule.isPending
                ? "Salvando…"
                : action?.data_agendada
                  ? "Atualizar horário"
                  : "Adicionar ao calendário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
