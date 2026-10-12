import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chaveMotivo, type MotivoId } from "@/lib/motivos";

const KEY = ["bloco-motivos"] as const;

/** Motivos registrados no intervalo, indexados por `referencia|data`. */
export function useMotivosBloco(inicio: string, fim: string) {
  return useQuery({
    queryKey: [...KEY, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bloco_motivos")
        .select("referencia, data, motivo")
        .gte("data", inicio)
        .lte("data", fim);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [chaveMotivo(r.referencia, r.data), r.motivo as MotivoId]));
    },
  });
}

export function useRegistrarMotivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { referencia: string; data: string; motivo: MotivoId; observacao?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada — faça login novamente.");
      const { error } = await supabase.from("bloco_motivos").upsert(
        {
          user_id: uid,
          referencia: input.referencia,
          data: input.data,
          motivo: input.motivo,
          observacao: input.observacao?.trim().slice(0, 500) || null,
        },
        { onConflict: "user_id,referencia,data" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
