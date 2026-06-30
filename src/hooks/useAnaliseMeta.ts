import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento, MetaWithResponsavel } from "@/lib/metas";

export type AnaliseIA = {
  diagnostico: string;
  acoes: { titulo: string; contexto: string }[];
  previsao_final: number;
  vai_bater: boolean;
};

export function useAnaliseMeta() {
  return useMutation({
    mutationFn: async ({
      meta,
      lancamentos,
    }: {
      meta: MetaWithResponsavel;
      lancamentos: Lancamento[];
    }): Promise<AnaliseIA> => {
      // Carrega planos de ação vinculados a esta meta + tarefas, para a IA
      // avaliar coerência e sugerir novas ações sem repetir o que já existe.
      const { data: planosRows } = await supabase
        .from("planos_acao")
        .select("id, titulo, created_at")
        .eq("meta_id", meta.id);

      const planoIds = (planosRows ?? []).map((p) => p.id);
      const { data: tarefasRows } = planoIds.length
        ? await supabase
            .from("plano_tarefas")
            .select("plano_id, descricao, concluida, prazo, ordem")
            .in("plano_id", planoIds)
            .order("ordem", { ascending: true })
        : { data: [] as { plano_id: string; descricao: string; concluida: boolean; prazo: string | null; ordem: number }[] };

      const planos = (planosRows ?? []).map((p) => ({
        titulo: p.titulo,
        criado_em: p.created_at,
        tarefas: (tarefasRows ?? [])
          .filter((t) => t.plano_id === p.id)
          .map((t) => ({
            descricao: t.descricao,
            concluida: t.concluida,
            prazo: t.prazo,
          })),
      }));

      const { data, error } = await supabase.functions.invoke("analise-meta", {
        body: {
          meta_id: meta.id,
          meta_nome: meta.nome,
          area: meta.area,
          unidade: meta.unidade,
          periodicidade: meta.periodicidade,
          valor_atual: meta.valor_atual,
          valor_alvo: meta.valor_alvo,
          data_inicio: meta.data_inicio,
          data_fim: meta.data_fim,
          is_inverse: meta.is_inverse,
          historico: lancamentos.map((l) => ({
            data: l.data_lancamento,
            valor: l.valor,
          })),
          planos,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      return data as AnaliseIA;
    },
  });
}


export function useCreatePlanoFromAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      metaId,
      titulo,
      acoes,
    }: {
      metaId: string;
      titulo: string;
      acoes: { titulo: string; contexto: string }[];
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;

      const { data: plano, error: pErr } = await supabase
        .from("planos_acao")
        .insert({ meta_id: metaId, titulo, criado_por: uid })
        .select()
        .single();
      if (pErr) throw pErr;

      if (acoes.length > 0) {
        const rows = acoes.map((a, i) => ({
          plano_id: plano.id,
          descricao: a.contexto ? `${a.titulo}\n${a.contexto}` : a.titulo,
          ordem: i,
        }));
        const { error: tErr } = await supabase.from("plano_tarefas").insert(rows);
        if (tErr) throw tErr;
      }

      return plano;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planos"] });
    },
  });
}
