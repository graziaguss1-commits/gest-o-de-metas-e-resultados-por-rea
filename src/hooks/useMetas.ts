import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  Comentario,
  Lancamento,
  Meta,
  MetaInsert,
  MetaUpdate,
  MetaWithResponsavel,
  MembroResumo,
  Status,
} from "@/lib/metas";

const METAS_KEY = ["metas"] as const;

async function enriquecerMetas(
  rows: Omit<MetaWithResponsavel, "responsaveis">[],
): Promise<MetaWithResponsavel[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id).filter(Boolean) as string[];
  const [{ data: vinculos, error: vinculosError }, { data: diretorio, error: diretorioError }] =
    await Promise.all([
      supabase.from("meta_responsaveis").select("meta_id, user_id").in("meta_id", ids),
      supabase.rpc("get_team_directory"),
    ]);

  if (vinculosError) throw vinculosError;
  if (diretorioError) throw diretorioError;

  const membros = (diretorio ?? []) as MembroResumo[];
  const membroPorId = new Map(membros.map((membro) => [membro.id, membro]));

  return rows.map((row) => ({
    ...row,
    responsaveis: (vinculos ?? [])
      .filter((vinculo) => vinculo.meta_id === row.id)
      .map((vinculo) => membroPorId.get(vinculo.user_id))
      .filter((membro): membro is MembroResumo => Boolean(membro)),
  }));
}

export function useMetas() {
  return useQuery({
    queryKey: METAS_KEY,
    queryFn: async (): Promise<MetaWithResponsavel[]> => {
      const { data, error } = await supabase
        .from("metas_with_responsavel")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return enriquecerMetas(
        ((data ?? []) as Omit<MetaWithResponsavel, "responsaveis">[]),
      );
    },
  });
}

export function useMeta(id: string | undefined) {
  return useQuery({
    queryKey: ["metas", id],
    enabled: !!id,
    queryFn: async (): Promise<MetaWithResponsavel | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("metas_with_responsavel")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [meta] = await enriquecerMetas([
        data as Omit<MetaWithResponsavel, "responsaveis">,
      ]);
      return meta ?? null;
    },
  });
}

export function useLancamentos(metaId: string | undefined) {
  return useQuery({
    queryKey: ["metas", metaId, "lancamentos"],
    enabled: !!metaId,
    queryFn: async (): Promise<Lancamento[]> => {
      if (!metaId) return [];
      const { data, error } = await supabase
        .from("meta_lancamentos")
        .select("*")
        .eq("meta_id", metaId)
        .order("data_lancamento", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as Lancamento[]) ?? [];
    },
  });
}

export function useComentarios(metaId: string | undefined) {
  return useQuery({
    queryKey: ["metas", metaId, "comentarios"],
    enabled: !!metaId,
    queryFn: async (): Promise<Comentario[]> => {
      if (!metaId) return [];
      const { data, error } = await supabase
        .from("meta_comentarios")
        .select("*")
        .eq("meta_id", metaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as Comentario[]) ?? [];
    },
  });
}

export function useMembros() {
  return useQuery({
    queryKey: ["membros"],
    queryFn: async (): Promise<MembroResumo[]> => {
      const { data, error } = await supabase.rpc("get_team_directory");
      if (error) throw error;
      return (data ?? []) as MembroResumo[];
    },
  });
}

export type CriarMetaInput = Omit<MetaInsert, "criado_por" | "status"> & {
  responsaveis?: string[];
};

export function useCreateMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ responsaveis, ...input }: CriarMetaInput) => {
      let responsaveisEfetivos = responsaveis?.filter(Boolean) ?? [];
      if (responsaveisEfetivos.length === 0) {
        const { data: authData } = await supabase.auth.getUser();
        const fallback = input.responsavel_id ?? authData.user?.id;
        if (fallback) responsaveisEfetivos = [fallback];
      }
      if (responsaveisEfetivos.length === 0) {
        throw new Error("Selecione ao menos um responsável.");
      }

      const { data: statusData, error: statusErr } = await supabase.rpc("calcular_status_meta", {
        p_valor_atual: input.valor_atual ?? 0,
        p_valor_alvo: input.valor_alvo,
        p_data_inicio: input.data_inicio,
        p_data_fim: input.data_fim,
        p_is_inverse: input.is_inverse ?? false,
      });
      if (statusErr) throw statusErr;

      const projetoSemEtapas =
        (input.metric_type === "projeto" || input.unidade === "etapas") &&
        Number(input.valor_alvo) === 0;

      const { data: id, error } = await supabase.rpc("criar_meta_com_responsaveis", {
        p_meta: {
          nome: input.nome,
          descricao: input.descricao ?? null,
          area: input.area,
          valor_alvo: input.valor_alvo,
          valor_atual: input.valor_atual ?? 0,
          unidade: input.unidade,
          periodicidade: input.periodicidade,
          data_inicio: input.data_inicio,
          data_fim: input.data_fim,
          is_inverse: input.is_inverse ?? false,
          is_demo: input.is_demo ?? false,
          metric_type: input.metric_type ?? "quantidade",
          funil_ativo: input.funil_ativo ?? false,
          status: projetoSemEtapas ? "amarelo" : (statusData as Status) ?? "verde",
        },
        p_responsaveis: responsaveisEfetivos,
      });
      if (error) throw error;
      return { id } as Pick<Meta, "id">;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: METAS_KEY });
      qc.invalidateQueries({ queryKey: ["planos"] });
    },
  });
}

export function useUpdateMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      responsaveis,
    }: {
      id: string;
      patch: MetaUpdate;
      responsaveis?: string[];
    }) => {
      if (responsaveis) {
        const { error } = await supabase.rpc("atualizar_meta_com_responsaveis", {
          p_meta_id: id,
          p_patch: patch as Json,
          p_responsaveis: responsaveis,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("metas")
          .update(patch)
          .eq("id", id);
        if (error) throw error;
      }
      return { id } as Pick<Meta, "id">;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: METAS_KEY });
      qc.invalidateQueries({ queryKey: ["metas", vars.id] });
      qc.invalidateQueries({ queryKey: ["planos"] });
    },
  });
}

export type LancarResultadoInput = {
  meta_id: string;
  valor: number;
  data_lancamento: string;
  observacao?: string | null;
};

export function useLancarResultado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LancarResultadoInput) => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) throw new Error("Sessão expirada — faça login novamente.");

      // Carrega meta atual para recalcular status
      const { data: meta, error: metaErr } = await supabase
        .from("metas")
        .select("valor_alvo, data_inicio, data_fim, is_inverse, status")
        .eq("id", input.meta_id)
        .single();
      if (metaErr) throw metaErr;

      // Insere lançamento
      const { data: lanc, error: lancErr } = await supabase
        .from("meta_lancamentos")
        .insert({
          meta_id: input.meta_id,
          valor: input.valor,
          data_lancamento: input.data_lancamento,
          observacao: input.observacao ?? null,
          lancado_por: uid,
        })
        .select()
        .single();
      if (lancErr) throw lancErr;

      // Busca último valor para atualizar valor_atual (último lançamento por data)
      const { data: ultimo } = await supabase
        .from("meta_lancamentos")
        .select("valor")
        .eq("meta_id", input.meta_id)
        .order("data_lancamento", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const valorAtual = (ultimo?.valor as number | undefined) ?? input.valor;

      // Recalcula status
      const { data: novoStatus, error: statusErr } = await supabase.rpc("calcular_status_meta", {
        p_valor_atual: valorAtual,
        p_valor_alvo: meta.valor_alvo as number,
        p_data_inicio: meta.data_inicio as string,
        p_data_fim: meta.data_fim as string,
        p_is_inverse: meta.is_inverse as boolean,
      });
      if (statusErr) throw statusErr;

      const { error: updErr } = await supabase
        .from("metas")
        .update({ valor_atual: valorAtual, status: novoStatus as Status })
        .eq("id", input.meta_id);
      if (updErr) throw updErr;

      return {
        lancamento: lanc as Lancamento,
        statusAnterior: meta.status as Status,
        statusNovo: novoStatus as Status,
      };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: METAS_KEY });
      qc.invalidateQueries({ queryKey: ["metas", vars.meta_id] });
      qc.invalidateQueries({ queryKey: ["metas", vars.meta_id, "lancamentos"] });
    },
  });
}

export function useCreateComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ metaId, conteudo }: { metaId: string; conteudo: string }) => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      const { data, error } = await supabase
        .from("meta_comentarios")
        .insert({ meta_id: metaId, conteudo, autor_id: uid })
        .select()
        .single();
      if (error) throw error;
      return data as Comentario;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["metas", vars.metaId, "comentarios"] });
    },
  });
}
