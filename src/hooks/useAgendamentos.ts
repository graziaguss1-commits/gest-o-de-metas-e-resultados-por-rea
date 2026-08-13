import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Agendamento } from "@/lib/agenda";

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
