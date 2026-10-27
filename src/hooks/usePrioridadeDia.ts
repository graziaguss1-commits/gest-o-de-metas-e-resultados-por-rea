import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = ["prioridade-dia"] as const;

/**
 * A prioridade de cada dia do intervalo, indexada pela data.
 *
 * Dia sem entrada é estado normal: ela escolhe a de hoje e volta amanhã.
 * Nada no app cobra os dias vazios.
 */
export function usePrioridadesDia(inicio: string, fim: string) {
  return useQuery({
    queryKey: [...KEY, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prioridade_dia")
        .select("data, referencia")
        .gte("data", inicio)
        .lte("data", fim);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.data, r.referencia]));
    },
  });
}

/**
 * Define ou tira a prioridade de um dia.
 *
 * referencia null apaga. Escolher outra no mesmo dia substitui, porque o
 * banco só aceita uma linha por dia — é a regra "uma por dia" morando no
 * lugar onde ela não pode ser burlada.
 */
export function useDefinirPrioridadeDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { data: string; referencia: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada — faça login novamente.");

      if (!input.referencia) {
        const { error } = await supabase
          .from("prioridade_dia")
          .delete()
          .eq("user_id", uid)
          .eq("data", input.data);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("prioridade_dia").upsert(
        { user_id: uid, data: input.data, referencia: input.referencia },
        { onConflict: "user_id,data" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
