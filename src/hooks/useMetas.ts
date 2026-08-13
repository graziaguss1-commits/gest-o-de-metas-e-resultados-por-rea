import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Comentario,
  Lancamento,
  Meta,
  MetaInsert,
  MetaUpdate,
  MetaWithResponsavel,
  Status,
} from "@/lib/metas";

const METAS_KEY = ["metas"] as const;

export function useMetas() {
  return useQuery({
    queryKey: METAS_KEY,
    queryFn: async (): Promise<MetaWithResponsavel[]> => {
      const { data, error } = await supabase
        .from("metas_with_responsavel")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as MetaWithResponsavel[]) ?? [];
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
      return (data as MetaWithResponsavel) ?? null;
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<MetaInsert, "criado_por" | "status">) => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;

      // Calcula status inicial via RPC
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

      const { data, error } = await supabase
        .from("metas")
        .insert({
          ...input,
          criado_por: uid,
          status: projetoSemEtapas ? "amarelo" : (statusData as Status) ?? "verde",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Meta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: METAS_KEY });
    },
  });
}

export function useUpdateMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: MetaUpdate }) => {
      const { data, error } = await supabase
        .from("metas")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Meta;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: METAS_KEY });
      qc.invalidateQueries({ queryKey: ["metas", vars.id] });
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
