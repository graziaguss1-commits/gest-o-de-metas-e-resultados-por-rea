import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FUNIL_PADRAO, type EtapaFunil } from "@/lib/execucao";

const key = (metaId: string | undefined) => ["funil", metaId] as const;

export function useFunil(metaId: string | undefined) {
  return useQuery({
    queryKey: key(metaId),
    enabled: !!metaId,
    queryFn: async (): Promise<EtapaFunil[]> => {
      if (!metaId) return [];
      const { data, error } = await supabase
        .from("meta_funil_etapas")
        .select("id, nome, ordem, valor")
        .eq("meta_id", metaId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, valor: Number(e.valor) }));
    },
  });
}

/** Ativa/desativa o funil da meta, criando as etapas sugeridas na primeira ativação. */
export function useToggleFunil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ metaId, ativo }: { metaId: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("metas")
        .update({ funil_ativo: ativo })
        .eq("id", metaId);
      if (error) throw error;

      if (ativo) {
        const { count } = await supabase
          .from("meta_funil_etapas")
          .select("id", { count: "exact", head: true })
          .eq("meta_id", metaId);
        if (!count) {
          const { error: insErr } = await supabase.from("meta_funil_etapas").insert(
            FUNIL_PADRAO.map((nome, ordem) => ({ meta_id: metaId, nome, ordem, valor: 0 })),
          );
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key(vars.metaId) });
      qc.invalidateQueries({ queryKey: ["metas"] });
    },
  });
}

export function useSalvarEtapas(metaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etapas: { id?: string; nome: string; ordem: number; valor: number }[]) => {
      if (!metaId) throw new Error("Meta inválida");
      const atuais = await supabase
        .from("meta_funil_etapas")
        .select("id")
        .eq("meta_id", metaId);
      const idsMantidos = etapas.map((e) => e.id).filter(Boolean) as string[];
      const remover = (atuais.data ?? []).map((e) => e.id).filter((id) => !idsMantidos.includes(id));
      if (remover.length) {
        const { error } = await supabase.from("meta_funil_etapas").delete().in("id", remover);
        if (error) throw error;
      }
      for (const e of etapas) {
        if (e.id) {
          const { error } = await supabase
            .from("meta_funil_etapas")
            .update({ nome: e.nome, ordem: e.ordem, valor: e.valor })
            .eq("id", e.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("meta_funil_etapas")
            .insert({ meta_id: metaId, nome: e.nome, ordem: e.ordem, valor: e.valor });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(metaId) }),
  });
}
