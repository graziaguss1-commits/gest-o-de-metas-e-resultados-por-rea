import { useMemo } from "react";
import { useActions } from "@/hooks/useActions";
import { useAgendamentos } from "@/hooks/useAgendamentos";
import { useCompromissos } from "@/hooks/useCompromissos";
import { useGoogleBusyBlocks } from "@/hooks/useGoogleCalendar";
import { useExecucoes, usePlanos } from "@/hooks/usePlanos";
import { hhmm, horaFim, type Agendamento } from "@/lib/agenda";
import { todayISO } from "@/lib/metas";

export type BlocoAgendaDia = {
  id: string;
  /** Data do bloco (YYYY-MM-DD). */
  data: string;
  /** Id do registro de origem (agendamento, ação avulsa, ocorrência de compromisso ou bloco Google). */
  origemId: string;
  titulo: string;
  detalhe: string;
  inicio: string;
  fim: string;
  tipo: "plano" | "avulsa" | "compromisso" | "google";
  concluido?: boolean;
  /** Apenas para blocos de plano. */
  tarefaId?: string;
  agendamento?: Agendamento;
};

type AgendaOptions = {
  excluirAgendamentoId?: string;
  excluirAcaoId?: string;
};

/** Blocos de agenda num intervalo de datas (inclusive), de todas as fontes. */
export function useAgendaPeriodo(
  inicio: string,
  fim: string,
  options: AgendaOptions = {},
) {
  const { data: agendamentos = [], isLoading: carregandoAgendamentos } =
    useAgendamentos(inicio, fim);
  const { data: compromissos = [], isLoading: carregandoCompromissos } =
    useCompromissos(inicio, fim);
  const { data: actions = [], isLoading: carregandoAcoes } = useActions();
  const { data: planos = [], isLoading: carregandoPlanos } = usePlanos();
  const { data: execucoes = [] } = useExecucoes();
  // Horarios ocupados vindos da agenda do Google (sem titulo, so o intervalo).
  const { data: googleBusy = [], isLoading: carregandoGoogle } =
    useGoogleBusyBlocks(inicio, fim);

  const tarefas = useMemo(() => {
    const mapa = new Map<string, { titulo: string; detalhe: string }>();
    planos.forEach((plano) =>
      plano.tarefas.forEach((tarefa) =>
        mapa.set(tarefa.id, {
          titulo: tarefa.descricao,
          detalhe: `${plano.titulo}${plano.meta?.area ? ` · ${plano.meta.area}` : ""}`,
        }),
      ),
    );
    return mapa;
  }, [planos]);

  const agendamentosFeitos = useMemo(
    () =>
      new Set(
        execucoes
          .map((execucao) => execucao.agendamento_id)
          .filter(Boolean) as string[],
      ),
    [execucoes],
  );

  const blocos = useMemo<BlocoAgendaDia[]>(() => {
    const dosPlanos = agendamentos
      .filter((item) => item.id !== options.excluirAgendamentoId)
      .map((item): BlocoAgendaDia => {
        const tarefa = tarefas.get(item.tarefa_id);
        const hInicio = hhmm(item.hora_inicio);
        return {
          id: `plano-${item.id}`,
          data: item.data,
          origemId: item.id,
          titulo: tarefa?.titulo ?? "Plano de ação",
          detalhe: tarefa?.detalhe ?? "Ação planejada",
          inicio: hInicio,
          fim: horaFim(hInicio, item.duracao_minutos),
          tipo: "plano",
          concluido: agendamentosFeitos.has(item.id),
          tarefaId: item.tarefa_id,
          agendamento: item,
        };
      });

    const avulsas = actions
      .filter(
        (action) =>
          action.id !== options.excluirAcaoId &&
          action.data_agendada &&
          action.data_agendada >= inicio &&
          action.data_agendada <= fim &&
          action.hora_inicio &&
          action.duracao_minutos,
      )
      .map((action): BlocoAgendaDia => {
        const hInicio = hhmm(action.hora_inicio);
        return {
          id: `avulsa-${action.id}`,
          data: action.data_agendada as string,
          origemId: action.id,
          titulo: action.descricao,
          detalhe: `${action.area} · ação avulsa`,
          inicio: hInicio,
          fim: horaFim(hInicio, action.duracao_minutos ?? 0),
          tipo: "avulsa",
          concluido: action.concluida,
        };
      });

    const fixos = compromissos.map((compromisso): BlocoAgendaDia => ({
      id: `compromisso-${compromisso.id}`,
      data: compromisso.data,
      origemId: compromisso.id,
      titulo: compromisso.titulo,
      detalhe: `${compromisso.area} · compromisso`,
      inicio: hhmm(compromisso.hora_inicio),
      fim: hhmm(compromisso.hora_fim),
      tipo: "compromisso",
      concluido: compromisso.concluido,
    }));

    const doGoogle = googleBusy.map((bloco): BlocoAgendaDia => ({
      id: `google-${bloco.id}`,
      data: bloco.data,
      origemId: bloco.id,
      titulo: "Horário ocupado",
      detalhe: "Google Agenda",
      inicio: hhmm(bloco.hora_inicio),
      fim: hhmm(bloco.hora_fim),
      tipo: "google",
    }));

    return [...dosPlanos, ...avulsas, ...fixos, ...doGoogle].sort(
      (a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio),
    );
  }, [
    actions,
    agendamentos,
    agendamentosFeitos,
    compromissos,
    fim,
    googleBusy,
    inicio,
    options.excluirAcaoId,
    options.excluirAgendamentoId,
    tarefas,
  ]);

  return {
    blocos,
    isLoading:
      carregandoAgendamentos ||
      carregandoGoogle ||
      carregandoCompromissos ||
      carregandoAcoes ||
      carregandoPlanos,
  };
}

export function useAgendaDoDia(data: string, options: AgendaOptions = {}) {
  const dataConsulta = data || todayISO();
  return useAgendaPeriodo(dataConsulta, dataConsulta, options);
}
