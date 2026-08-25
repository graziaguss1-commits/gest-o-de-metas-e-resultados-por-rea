import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctions";

export type OrigemTarefaPlanejamento = "plano" | "avulsa";

export type TarefaPlanejamentoClaude = {
  id: string;
  origem: OrigemTarefaPlanejamento;
  descricao: string;
  area: string;
  plano: string;
  meta: string | null;
  impacto: number;
  esforco: number;
  priority_score: number;
  prazo: string | null;
  duracao_minutos: number | null;
  execucoes_faltantes: number;
  horario_preferencial: string | null;
  dias_semana: number[];
  selecionada_como: "top" | "complementar" | null;
};

export type BlocoOcupadoClaude = {
  data: string;
  inicio: string;
  fim: string;
  titulo: string;
  tipo: "acao" | "compromisso";
};

export type PlanejamentoClaudeInput = {
  week_start: string;
  week_end: string;
  capacidade_diaria_minutos: number;
  revisao: {
    conquistas: string;
    pendencias: string;
    aprendizado: string;
    foco_atual: string;
  };
  tarefas: TarefaPlanejamentoClaude[];
  blocos_ocupados: BlocoOcupadoClaude[];
};

export type AgendaClaudeItem = {
  task_id: string;
  data: string;
  hora_inicio: string;
  duracao_minutos: number;
  motivo: string;
};

export type PlanejamentoClaudeResponse = {
  success: true;
  resumo: string;
  foco_semana: string;
  prioridades_top: string[];
  complementares: string[];
  agenda: AgendaClaudeItem[];
  alertas: string[];
  provider: "anthropic";
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    custo_estimado_usd: number;
  };
  gerado_em: string;
};

export function useGerarPlanejamentoClaude() {
  return useMutation({
    mutationFn: async (
      input: PlanejamentoClaudeInput,
    ): Promise<PlanejamentoClaudeResponse> => {
      const { data, error } = await supabase.functions.invoke(
        "planejar-semana",
        { body: input },
      );

      if (error || !data?.success) {
        const message = await getEdgeFunctionErrorMessage(
          error,
          data,
          "Não foi possível planejar a semana com o Claude.",
        );
        throw new Error(message);
      }

      return data as PlanejamentoClaudeResponse;
    },
  });
}

export type AplicarPlanejamentoClaudeInput = {
  weekStart: string;
  weekEnd: string;
  agenda: Array<
    AgendaClaudeItem & {
      origem: OrigemTarefaPlanejamento;
    }
  >;
};

type WeeklyPlanningRpcClient = {
  rpc: (
    fn: "aplicar_planejamento_semanal",
    args: {
      p_inicio: string;
      p_fim: string;
      p_agenda: Array<Record<string, string | number>>;
    },
  ) => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

/**
 * Aplica todos os blocos em uma única transação no banco. A função SQL
 * revalida a responsabilidade por cada ação antes de escrever a agenda.
 */
export function useAplicarPlanejamentoClaude() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AplicarPlanejamentoClaudeInput) => {
      const rpcClient = supabase as unknown as WeeklyPlanningRpcClient;
      const { data, error } = await rpcClient.rpc(
        "aplicar_planejamento_semanal",
        {
          p_inicio: input.weekStart,
          p_fim: input.weekEnd,
          p_agenda: input.agenda.map((item) => ({
            task_id: item.task_id,
            origem: item.origem,
            data: item.data,
            hora_inicio: item.hora_inicio,
            duracao_minutos: item.duracao_minutos,
          })),
        },
      );
      if (error) throw error;
      return data as {
        agendamentos_criados?: number;
        acoes_avulsas_atualizadas?: number;
        duplicados_ignorados?: number;
      } | null;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agendamentos"] }),
        queryClient.invalidateQueries({ queryKey: ["acoes-avulsas"] }),
      ]);
    },
  });
}
