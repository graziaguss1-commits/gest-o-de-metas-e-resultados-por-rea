import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CoachPerfil = {
  ativo: boolean;
  contexto: string;
  tom: string;
  regras: string;
  limite_caracteres: number;
};

const KEY = ["coach-perfil"] as const;

/**
 * Perfil do coach. Mora no banco de propósito: assim ajustar o tom ou uma
 * regra é edição de texto nesta tela, e não publicação de função nova.
 */
export function useCoachPerfil() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<CoachPerfil | null> => {
      const { data, error } = await supabase
        .from("coach_perfil")
        .select("ativo, contexto, tom, regras, limite_caracteres")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data as CoachPerfil | null) ?? null;
    },
  });
}

export function useSalvarCoachPerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<CoachPerfil>) => {
      const { error } = await supabase
        .from("coach_perfil")
        .update(patch)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
