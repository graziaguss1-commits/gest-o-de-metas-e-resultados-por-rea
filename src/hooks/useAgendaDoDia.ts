import { useMemo } from "react";
import { useActions } from "@/hooks/useActions";
import { useAgendamentos } from "@/hooks/useAgendamentos";
import { useCompromissos } from "@/hooks/useCompromissos";
import { useGoogleBusyBlocks } from "@/hooks/useGoogleCalendar";
import { usePlanos } from "@/hooks/usePlanos";
import { hhmm, horaFim } from "@/lib/agenda";
import { todayISO } from "@/lib/metas";

export type BlocoAgendaDia = {
  id: string;
  titulo: string;
  detalhe: string;
  inicio: string;
  fim: string;
  tipo: "plano" | "avulsa" | "compromisso" | "google";
  concluido?: boolean;
};

type AgendaOptions = {
  excluirAgendamentoId?: string;
  excluirAcaoId?: string;
};

export function useAgendaDoDia(data: string, options: AgendaOptions = {}) {
  const dataConsulta = data || todayISO();
  const { data: agendamentos = [], isLoading: carregandoAgendamentos } =
    useAgendamentos(dataConsulta, dataConsulta);
  const { data: compromissos = [], isLoading: carregandoCompromissos } =
    useCompromissos(dataConsulta, dataConsulta);
  const { data: actions = [], isLoading: carregandoAcoes } = useActions();
  const { data: planos = [], isLoading: carregandoPlanos } = usePlanos();
  // Horarios ocupados vindos da agenda do Google (sem titulo, so o intervalo).
  // Sem isto o painel mostrava apenas os blocos do proprio app e sugeria
  // horarios que na verdade ja estavam ocupados.
  const { data: googleBusy = [], isLoading: carregandoGoogle } =
    useGoogleBusyBlocks(dataConsulta, dataConsulta);

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

  const blocos = useMemo<BlocoAgendaDia[]>(() => {
    const dosPlanos = agendamentos
      .filter((item) => item.id !== options.excluirAgendamentoId)
      .map((item): BlocoAgendaDia => {
        const tarefa = tarefas.get(item.tarefa_id);
        const inicio = hhmm(item.hora_inicio);
        return {
          id: `plano-${item.id}`,
          titulo: tarefa?.titulo ?? "Plano de ação",
          detalhe: tarefa?.detalhe ?? "Ação planejada",
          inicio,
          fim: horaFim(inicio, item.duracao_minutos),
          tipo: "plano",
        };
      });

    const avulsas = actions
      .filter(
        (action) =>
          action.id !== options.excluirAcaoId &&
          action.data_agendada === dataConsulta &&
          action.hora_inicio &&
          action.duracao_minutos,
      )
      .map((action): BlocoAgendaDia => {
        const inicio = hhmm(action.hora_inicio);
        return {
          id: `avulsa-${action.id}`,
          titulo: action.descricao,
          detalhe: `${action.area} · ação avulsa`,
          inicio,
          fim: horaFim(inicio, action.duracao_minutos ?? 0),
          tipo: "avulsa",
          concluido: action.concluida,
        };
      });

    const fixos = compromissos.map((compromisso): BlocoAgendaDia => ({
      id: `compromisso-${compromisso.id}`,
      titulo: compromisso.titulo,
      detalhe: `${compromisso.area} · compromisso`,
      inicio: hhmm(compromisso.hora_inicio),
      fim: hhmm(compromisso.hora_fim),
      tipo: "compromisso",
      concluido: compromisso.concluido,
    }));

    const doGoogle = googleBusy.map((bloco): BlocoAgendaDia => ({
      id: `google-${bloco.id}`,
      titulo: "Horário ocupado",
      detalhe: "Google Agenda",
      inicio: hhmm(bloco.hora_inicio),
      fim: hhmm(bloco.hora_fim),
      tipo: "google",
    }));

    return [...dosPlanos, ...avulsas, ...fixos, ...doGoogle].sort((a, b) =>
      a.inicio.localeCompare(b.inicio),
    );
  }, [
    actions,
    agendamentos,
    compromissos,
    dataConsulta,
    googleBusy,
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
