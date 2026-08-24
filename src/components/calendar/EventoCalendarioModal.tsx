import { CalendarClock, CalendarX2, Repeat2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCancelarOcorrencia,
  useRemoverAgendamento,
} from "@/hooks/useAgendamentos";
import { useScheduleAction, type ActionItem } from "@/hooks/useActions";
import {
  useExcluirCompromisso,
  type Compromisso,
} from "@/hooks/useCompromissos";
import { useUpdateTarefa } from "@/hooks/usePlanos";
import { formatDuracao, hhmm, horaFim, type Agendamento } from "@/lib/agenda";
import type { Tarefa } from "@/lib/metas";

type TarefaCalendario = Tarefa & {
  area?: string;
  meta?: string | null;
};

export type EventoCalendarioSelecionado =
  | {
      tipo: "plano";
      agendamento: Agendamento;
      tarefa: TarefaCalendario;
    }
  | { tipo: "avulsa"; action: ActionItem }
  | { tipo: "compromisso"; compromisso: Compromisso };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento: EventoCalendarioSelecionado | null;
  onReagendarPlano: (
    agendamento: Agendamento,
    tarefa: TarefaCalendario,
  ) => void;
  onReagendarAvulsa: (action: ActionItem) => void;
};

const recorrente = (frequencia?: string | null) =>
  ["diaria", "semanal", "mensal"].includes(frequencia ?? "");

const dataAmigavel = (data: string) =>
  new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

export function EventoCalendarioModal({
  open,
  onOpenChange,
  evento,
  onReagendarPlano,
  onReagendarAvulsa,
}: Props) {
  const cancelarOcorrencia = useCancelarOcorrencia();
  const removerAgendamento = useRemoverAgendamento();
  const updateTarefa = useUpdateTarefa();
  const scheduleAction = useScheduleAction();
  const excluirCompromisso = useExcluirCompromisso();
  const pending =
    cancelarOcorrencia.isPending ||
    removerAgendamento.isPending ||
    updateTarefa.isPending ||
    scheduleAction.isPending ||
    excluirCompromisso.isPending;

  const fechar = () => onOpenChange(false);
  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    try {
      await acao();
      toast.success(sucesso);
      fechar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a agenda",
      );
    }
  };

  if (!evento) return null;

  const titulo =
    evento.tipo === "plano"
      ? evento.tarefa.descricao
      : evento.tipo === "avulsa"
        ? evento.action.descricao
        : evento.compromisso.titulo;
  const data =
    evento.tipo === "plano"
      ? evento.agendamento.data
      : evento.tipo === "avulsa"
        ? evento.action.data_agendada
        : evento.compromisso.data;
  const inicio =
    evento.tipo === "plano"
      ? hhmm(evento.agendamento.hora_inicio)
      : evento.tipo === "avulsa"
        ? hhmm(evento.action.hora_inicio)
        : hhmm(evento.compromisso.hora_inicio);
  const fim =
    evento.tipo === "plano"
      ? horaFim(inicio, evento.agendamento.duracao_minutos)
      : evento.tipo === "avulsa"
        ? horaFim(inicio, evento.action.duracao_minutos ?? 0)
        : hhmm(evento.compromisso.hora_fim);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Opções do calendário</DialogTitle>
          <DialogDescription>
            Edite o horário ou remova este bloco da sua agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/25 p-4">
          <div className="text-sm font-semibold">{titulo}</div>
          <div className="mt-1 text-xs capitalize text-muted-foreground">
            {data ? dataAmigavel(data) : "Sem data"} · {inicio}–{fim}
            {evento.tipo === "plano"
              ? ` · ${formatDuracao(evento.agendamento.duracao_minutos)}`
              : ""}
          </div>
        </div>

        <div className="space-y-2">
          {evento.tipo === "plano" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={pending}
                onClick={() => {
                  fechar();
                  onReagendarPlano(evento.agendamento, evento.tarefa);
                }}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Alterar dia ou horário
              </Button>

              {recorrente(evento.tarefa.frequencia) ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={pending}
                    onClick={() =>
                      executar(
                        () =>
                          cancelarOcorrencia.mutateAsync(evento.agendamento.id),
                        "Ocorrência removida somente deste dia",
                      )
                    }
                  >
                    <CalendarX2 className="mr-2 h-4 w-4" />
                    Remover somente deste dia
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full justify-start"
                    disabled={pending}
                    onClick={() =>
                      executar(async () => {
                        await updateTarefa.mutateAsync({
                          id: evento.tarefa.id,
                          frequencia: "unica",
                          data_inicio: null,
                          data_fim: null,
                          horario_preferencial: null,
                          dias_semana: null,
                        });
                        await removerAgendamento.mutateAsync(
                          evento.agendamento.id,
                        );
                      }, "Rotina encerrada e removida dos próximos dias")
                    }
                  >
                    <Repeat2 className="mr-2 h-4 w-4" />
                    Parar rotina e remover próximos dias
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full justify-start"
                  disabled={pending}
                  onClick={() =>
                    executar(
                      () =>
                        removerAgendamento.mutateAsync(evento.agendamento.id),
                      "Ação removida do calendário",
                    )
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover do calendário
                </Button>
              )}
            </>
          )}

          {evento.tipo === "avulsa" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={pending}
                onClick={() => {
                  fechar();
                  onReagendarAvulsa(evento.action);
                }}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Alterar dia ou horário
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full justify-start"
                disabled={pending}
                onClick={() =>
                  executar(
                    () =>
                      scheduleAction.mutateAsync({
                        id: evento.action.id,
                        data: null,
                        horaInicio: null,
                        duracaoMinutos: null,
                      }),
                    "Prioridade removida do calendário",
                  )
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover do calendário
              </Button>
            </>
          )}

          {evento.tipo === "compromisso" && (
            <>
              {evento.compromisso.recorrencia !== "nenhuma" && (
                <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Este compromisso é recorrente. A exclusão removerá toda a
                  série.
                </p>
              )}
              <Button
                type="button"
                variant="destructive"
                className="w-full justify-start"
                disabled={pending}
                onClick={() =>
                  executar(
                    () => excluirCompromisso.mutateAsync(evento.compromisso.id),
                    evento.compromisso.recorrencia === "nenhuma"
                      ? "Compromisso excluído"
                      : "Série de compromissos excluída",
                  )
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {evento.compromisso.recorrencia === "nenhuma"
                  ? "Excluir compromisso"
                  : "Excluir toda a série"}
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={fechar}
            disabled={pending}
          >
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
