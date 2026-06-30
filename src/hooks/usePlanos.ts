import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Plano, Tarefa } from "@/lib/metas";

const PLANOS_KEY = ["planos"] as const;

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

export type NovoTarefaInput = { descricao: string; prazo?: string | null };

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
        .map((t) => ({ descricao: t.descricao.trim(), prazo: t.prazo || null }))
        .filter((t) => t.descricao.length > 0)
        .map((t, ordem) => ({ plano_id: plano.id, descricao: t.descricao, prazo: t.prazo, ordem }));

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
      descricao,
      ordem,
      prazo,
    }: {
      planoId: string;
      descricao: string;
      ordem: number;
      prazo?: string | null;
    }) => {
      const { error } = await supabase
        .from("plano_tarefas")
        .insert({ plano_id: planoId, descricao, ordem, prazo: prazo || null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANOS_KEY }),
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
