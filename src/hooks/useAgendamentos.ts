import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Agendamento } from "@/lib/agenda";
import type { Tarefa } from "@/lib/metas";
import { configuracaoRecorrenciaCompleta, dataCorrespondeRecorrencia, diasRecorrenciaPersistida } from "@/lib/agenda";

const KEY = ["agendamentos"] as const;

/**
 * Ocorrências agendadas. Buscamos apenas a janela visível (semana atual +
 * margem), evitando materializar recorrências infinitas.
 */
export function useAgendamentos(inicio?: string, fim?: string) {
  return useQuery({
    queryKey: [...KEY, inicio ?? "all", fim ?? "all"],
    queryFn: async (): Promise<Agendamento[]> => {
      let query = supabase
        .from("tarefa_agendamentos")
        .select("id, tarefa_id, data, hora_inicio, duracao_minutos, observacao")
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (inicio) query = query.gte("data", inicio);
      if (fim) query = query.lte("data", fim);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Agendamento[];
    },
  });
}

export type AgendarInput = {
  tarefaId: string;
  data: string;
  horaInicio: string;
  duracaoMinutos: number;
  observacao?: string | null;
};

export function useAgendarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AgendarInput) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("tarefa_agendamentos").insert({
        tarefa_id: input.tarefaId,
        data: input.data,
        hora_inicio: input.horaInicio,
        duracao_minutos: input.duracaoMinutos,
        observacao: input.observacao?.trim() || null,
        criado_por: user.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReagendarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      horaInicio,
      duracaoMinutos,
    }: {
      id: string;
      data: string;
      horaInicio: string;
      duracaoMinutos: number;
    }) => {
      const { error } = await supabase
        .from("tarefa_agendamentos")
        .update({ data, hora_inicio: horaInicio, duracao_minutos: duracaoMinutos })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoverAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefa_agendamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}


/**
 * Cria somente as ocorrências recorrentes que faltam na semana visível.
 * Nunca materializa recorrência infinita e ignora dias passados na semana atual.
 */
export function useMaterializarRecorrencias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefas, datas }: { tarefas: Tarefa[]; datas: string[] }) => {
      if (!datas.length) return 0;
      const inicio = datas[0], fim = datas[datas.length - 1];
      const ids = tarefas.map((t) => t.id);
      if (!ids.length) return 0;
      const { data: existentes, error: readError } = await supabase
        .from("tarefa_agendamentos").select("tarefa_id,data").in("tarefa_id", ids).gte("data", inicio).lte("data", fim);
      if (readError) throw readError;
      const chaves = new Set((existentes ?? []).map((a) => `${a.tarefa_id}|${a.data}`));
      const hoje = new Date().toISOString().slice(0,10);
      const { data: user } = await supabase.auth.getUser();
      const rows = tarefas.flatMap((t) => {
        const dias = diasRecorrenciaPersistida(t.frequencia, t.dias_semana);
        if (
          !configuracaoRecorrenciaCompleta(
            t.frequencia,
            t.duracao_minutos,
            t.horario_preferencial,
            dias,
          )
        ) {
          return [];
        }

        return datas.filter((data) => {
          if (
            data < hoje ||
            (t.data_inicio && data < t.data_inicio) ||
            (t.data_fim && data > t.data_fim)
          ) {
            return false;
          }

          const date = new Date(`${data}T12:00:00`);
          return (
            dataCorrespondeRecorrencia(t.frequencia, date, dias) &&
            !chaves.has(`${t.id}|${data}`)
          );
        }).map((data) => ({
          tarefa_id: t.id, data, hora_inicio: t.horario_preferencial!,
          duracao_minutos: t.duracao_minutos!, criado_por: user.user?.id ?? null,
          observacao: "Gerado pela recorrência",
        }));
      });
      if (!rows.length) return 0;
      const { error } = await supabase.from("tarefa_agendamentos").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
