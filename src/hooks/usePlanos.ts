import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Plano, Tarefa } from "@/lib/metas";
import { execucaoPlano, type Execucao } from "@/lib/execucao";

const PLANOS_KEY = ["planos"] as const;
const EXEC_KEY = ["execucoes"] as const;

export type PlanoWithMeta = Plano & {
  meta?: {
    id: string;
    nome: string;
    status: "verde" | "amarelo" | "vermelho";
    area: string;
  } | null;
  tarefas: Tarefa[];
};

export function usePlanos() {
  return useQuery({
    queryKey: PLANOS_KEY,
    queryFn: async (): Promise<PlanoWithMeta[]> => {
      const [{ data: planos, error: pErr }, { data: tarefas, error: tErr }, { data: metas }] =
        await Promise.all([
          supabase.from("planos_acao").select("*").order("created_at", { ascending: false }),
          supabase.from("plano_tarefas").select("*").order("ordem", { ascending: true }),
          supabase.from("metas").select("id, nome, status, area"),
        ]);
      if (pErr) throw pErr;
      if (tErr) throw tErr;

      const metaById = new Map((metas ?? []).map((m) => [m.id, m]));
      const tarefasByPlano = new Map<string, Tarefa[]>();
      (tarefas ?? []).forEach((t) => {
        const arr = tarefasByPlano.get(t.plano_id) ?? [];
        arr.push(t as Tarefa);
        tarefasByPlano.set(t.plano_id, arr);
      });

      return (planos ?? []).map((p) => ({
        ...(p as Plano),
        meta: p.meta_id
          ? (metaById.get(p.meta_id) as PlanoWithMeta["meta"]) ?? null
          : null,
        tarefas: tarefasByPlano.get(p.id) ?? [],
      }));
    },
  });
}

/** Todas as execuções registradas (histórico completo, filtrado por período no cliente). */
export function useExecucoes() {
  return useQuery({
    queryKey: EXEC_KEY,
    queryFn: async (): Promise<Execucao[]> => {
      const { data, error } = await supabase
        .from("tarefa_execucoes")
        .select("id, tarefa_id, data_referencia, quantidade, observacao, tempo_real_minutos")
        .order("data_referencia", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, quantidade: Number(e.quantidade) })) as Execucao[];
    },
  });
}

/** Execução consolidada (0..1) dos planos vinculados a uma meta. */
export function useExecucaoDaMeta(metaId: string | undefined) {
  const { data: planos = [] } = usePlanos();
  const { data: execucoes = [] } = useExecucoes();
  const relevantes = planos.filter((p) => p.meta_id === metaId);
  const tarefas = relevantes.flatMap((p) => p.tarefas);
  return {
    planos: relevantes,
    tarefas,
    execucoes,
    pct: tarefas.length ? execucaoPlano(tarefas, execucoes) : null,
  };
}

export type NovoTarefaInput = {
  descricao: string;
  prazo?: string | null;
  frequencia?: string;
  quantidade_planejada?: number;
  unidade?: string;
  impacto?: number;
  esforco?: number;
  responsavel_id?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  /** Estimativa por execução, em minutos. `null` = sem estimativa. */
  duracao_minutos?: number | null;
  horario_preferencial?: string | null;
  dias_semana?: number[] | null;
};


export type NovoPlanoInput = {
  titulo: string;
  meta_id?: string | null;
  tarefas: NovoTarefaInput[];
};

export function useCreatePlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovoPlanoInput) => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;

      const { data: plano, error: pErr } = await supabase
        .from("planos_acao")
        .insert({
          titulo: input.titulo,
          meta_id: input.meta_id ?? null,
          criado_por: uid,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      const taskRows = input.tarefas
        .filter((t) => t.descricao.trim().length > 0)
        .map((t, ordem) => ({
          plano_id: plano.id,
          descricao: t.descricao.trim(),
          prazo: t.prazo || null,
          ordem,
          frequencia: t.frequencia ?? "unica",
          quantidade_planejada: t.quantidade_planejada ?? 1,
          unidade: t.unidade?.trim() ?? "",
          impacto: t.impacto ?? 5,
          esforco: t.esforco ?? 5,
          responsavel_id: t.responsavel_id ?? null,
          data_inicio: t.data_inicio || null,
          data_fim: t.data_fim || null,
          duracao_minutos: t.duracao_minutos ?? null,
          horario_preferencial: t.horario_preferencial || null,
          dias_semana: t.dias_semana ?? null,
        }));


      if (taskRows.length > 0) {
        const { error: tErr } = await supabase.from("plano_tarefas").insert(taskRows);
        if (tErr) throw tErr;
      }
      return plano as Plano;
    },

    onSuccess: () => qc.invalidateQueries({ queryKey: PLANOS_KEY }),
  });
}

export function useToggleTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("plano_tarefas")
        .update({ concluida })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, concluida }) => {
      await qc.cancelQueries({ queryKey: PLANOS_KEY });
      const prev = qc.getQueryData<PlanoWithMeta[]>(PLANOS_KEY);
      if (prev) {
        qc.setQueryData<PlanoWithMeta[]>(
          PLANOS_KEY,
          prev.map((p) => ({
            ...p,
            tarefas: p.tarefas.map((t) => (t.id === id ? { ...t, concluida } : t)),
          })),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(PLANOS_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PLANOS_KEY }),
  });
}

export function useAddTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planoId,
      ordem,
      ...t
    }: NovoTarefaInput & { planoId: string; ordem: number }) => {
      const { error } = await supabase.from("plano_tarefas").insert({
        plano_id: planoId,
        ordem,
        descricao: t.descricao,
        prazo: t.prazo || null,
        frequencia: t.frequencia ?? "unica",
        quantidade_planejada: t.quantidade_planejada ?? 1,
        unidade: t.unidade?.trim() ?? "",
        impacto: t.impacto ?? 5,
        esforco: t.esforco ?? 5,
        responsavel_id: t.responsavel_id ?? null,
        data_inicio: t.data_inicio || null,
        data_fim: t.data_fim || null,
        duracao_minutos: t.duracao_minutos ?? null,
        horario_preferencial: t.horario_preferencial || null,
        dias_semana: t.dias_semana ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANOS_KEY }),
  });
}

/** Atualiza campos de uma ação existente (inclui duração/horário/dias). */
export function useUpdateTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      descricao?: string;
      prazo?: string | null;
      frequencia?: string;
      quantidade_planejada?: number;
      unidade?: string;
      duracao_minutos?: number | null;
      horario_preferencial?: string | null;
      dias_semana?: number[] | null;
    }) => {
      const { error } = await supabase.from("plano_tarefas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANOS_KEY }),
  });
}

/** Registra o realizado de uma ação em uma data (histórico preservado). */
export function useRegistrarExecucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tarefaId,
      quantidade,
      data,
      observacao,
      tempoRealMinutos,
    }: {
      tarefaId: string;
      quantidade: number;
      data: string;
      observacao?: string | null;
      /** Tempo real gasto — nunca substitui a estimativa da ação. */
      tempoRealMinutos?: number | null;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) throw new Error("Sessão expirada — faça login novamente.");
      const { error } = await supabase.from("tarefa_execucoes").insert({
        tarefa_id: tarefaId,
        quantidade,
        data_referencia: data,
        observacao: observacao?.trim() || null,
        tempo_real_minutos: tempoRealMinutos ?? null,
        registrado_por: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXEC_KEY });
      qc.invalidateQueries({ queryKey: PLANOS_KEY });
    },
  });
}


export function useDeletePlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planos_acao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANOS_KEY }),
  });
}
