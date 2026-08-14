import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MembroResumo, Plano, Tarefa } from "@/lib/metas";
import { execucaoPlano, type Execucao } from "@/lib/execucao";

const PLANOS_KEY = ["planos"] as const;
const EXEC_KEY = ["execucoes"] as const;

export type PlanoWithMeta = Plano & {
  meta?: {
    id: string;
    nome: string;
    status: "verde" | "amarelo" | "vermelho";
    area: string;
    responsaveis: MembroResumo[];
  } | null;
  tarefas: Tarefa[];
};

async function metaIdDoPlano(planoId: string): Promise<string | null> {
  const { data } = await supabase
    .from("planos_acao")
    .select("meta_id")
    .eq("id", planoId)
    .maybeSingle();
  return data?.meta_id ?? null;
}

/**
 * Em metas do tipo projeto, cada plano vinculado é uma etapa.
 * A etapa é concluída quando o plano possui ações e todas estão concluídas.
 */
async function sincronizarEtapasDaMeta(metaId: string | null | undefined) {
  if (!metaId) return;

  const { data: meta, error: metaError } = await supabase
    .from("metas")
    .select("metric_type,unidade,valor_alvo,valor_atual,data_inicio,data_fim,is_inverse,status")
    .eq("id", metaId)
    .maybeSingle();
  if (metaError || !meta) return;

  const projeto = meta.metric_type === "projeto" || meta.unidade === "etapas";
  if (!projeto) return;

  const { data: planos, error: planosError } = await supabase
    .from("planos_acao")
    .select("id")
    .eq("meta_id", metaId);
  if (planosError) return;

  const ids = (planos ?? []).map((plano) => plano.id);
  let tarefas: Pick<Tarefa, "plano_id" | "concluida">[] = [];
  if (ids.length) {
    const { data, error } = await supabase
      .from("plano_tarefas")
      .select("plano_id,concluida")
      .in("plano_id", ids);
    if (error) return;
    tarefas = (data ?? []) as Pick<Tarefa, "plano_id" | "concluida">[];
  }

  const concluidas = ids.filter((planoId) => {
    const tarefasDoPlano = tarefas.filter((tarefa) => tarefa.plano_id === planoId);
    return tarefasDoPlano.length > 0 && tarefasDoPlano.every((tarefa) => tarefa.concluida);
  }).length;
  const total = ids.length;

  const statusAnterior = meta.status as "verde" | "amarelo" | "vermelho";
  let statusCalculado: "verde" | "amarelo" | "vermelho" =
    total === 0 ? "amarelo" : statusAnterior;

  if (total > 0) {
    const { data } = await supabase.rpc("calcular_status_meta", {
      p_valor_atual: concluidas,
      p_valor_alvo: total,
      p_data_inicio: meta.data_inicio,
      p_data_fim: meta.data_fim,
      p_is_inverse: false,
    });
    statusCalculado =
      (data as "verde" | "amarelo" | "vermelho" | null) ?? statusAnterior;
  }

  if (
    Number(meta.valor_alvo) === total &&
    Number(meta.valor_atual) === concluidas &&
    meta.is_inverse === false &&
    meta.status === statusCalculado
  ) {
    return;
  }

  await supabase
    .from("metas")
    .update({
      valor_alvo: total,
      valor_atual: concluidas,
      is_inverse: false,
      status: statusCalculado,
    })
    .eq("id", metaId);
}

export function usePlanos() {
  return useQuery({
    queryKey: PLANOS_KEY,
    queryFn: async (): Promise<PlanoWithMeta[]> => {
      const [
        { data: planos, error: pErr },
        { data: tarefas, error: tErr },
        { data: metas },
        { data: vinculos, error: vinculosError },
        { data: diretorio, error: diretorioError },
      ] = await Promise.all([
        supabase.from("planos_acao").select("*").order("created_at", { ascending: false }),
        supabase.from("plano_tarefas").select("*").order("ordem", { ascending: true }),
        supabase.from("metas").select("id, nome, status, area, metric_type, unidade"),
        supabase.from("meta_responsaveis").select("meta_id, user_id"),
        supabase.rpc("get_team_directory"),
      ]);
      if (pErr) throw pErr;
      if (tErr) throw tErr;
      if (vinculosError) throw vinculosError;
      if (diretorioError) throw diretorioError;

      const membroPorId = new Map(
        ((diretorio ?? []) as MembroResumo[]).map((membro) => [membro.id, membro]),
      );
      const responsaveisPorMeta = new Map<string, MembroResumo[]>();
      (vinculos ?? []).forEach((vinculo) => {
        const membro = membroPorId.get(vinculo.user_id);
        if (!membro) return;
        const atuais = responsaveisPorMeta.get(vinculo.meta_id) ?? [];
        atuais.push(membro);
        responsaveisPorMeta.set(vinculo.meta_id, atuais);
      });
      const metaById = new Map(
        (metas ?? []).map((meta) => [
          meta.id,
          { ...meta, responsaveis: responsaveisPorMeta.get(meta.id) ?? [] },
        ]),
      );
      const tarefasByPlano = new Map<string, Tarefa[]>();
      (tarefas ?? []).forEach((t) => {
        const arr = tarefasByPlano.get(t.plano_id) ?? [];
        arr.push(t as Tarefa);
        tarefasByPlano.set(t.plano_id, arr);
      });

      const resultado = (planos ?? []).map((p) => ({
        ...(p as Plano),
        meta: p.meta_id
          ? (metaById.get(p.meta_id) as PlanoWithMeta["meta"]) ?? null
          : null,
        tarefas: tarefasByPlano.get(p.id) ?? [],
      }));

      const metasDeProjeto = (metas ?? [])
        .filter((meta) => meta.metric_type === "projeto" || meta.unidade === "etapas")
        .map((meta) => meta.id);
      await Promise.all(metasDeProjeto.map((metaId) => sincronizarEtapasDaMeta(metaId)));
      return resultado;
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
          responsavel_id: t.responsavel_id ?? uid ?? null,
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
      await sincronizarEtapasDaMeta(input.meta_id);
      return plano as Plano;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANOS_KEY });
      qc.invalidateQueries({ queryKey: ["metas"] });
    },
  });
}

export function useUpdatePlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      titulo,
      meta_id,
    }: {
      id: string;
      titulo: string;
      meta_id: string | null;
    }) => {
      const metaAnterior = await metaIdDoPlano(id);
      const { error } = await supabase
        .from("planos_acao")
        .update({ titulo: titulo.trim(), meta_id })
        .eq("id", id);
      if (error) throw error;

      const metasAfetadas = [...new Set([metaAnterior, meta_id].filter(Boolean))] as string[];
      await Promise.all(metasAfetadas.map((meta) => sincronizarEtapasDaMeta(meta)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANOS_KEY });
      qc.invalidateQueries({ queryKey: ["metas"] });
    },
  });
}

export function useToggleTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { data: tarefa } = await supabase
        .from("plano_tarefas")
        .select("plano_id")
        .eq("id", id)
        .maybeSingle();
      const { error } = await supabase
        .from("plano_tarefas")
        .update({ concluida })
        .eq("id", id);
      if (error) throw error;

      if (tarefa?.plano_id) {
        await sincronizarEtapasDaMeta(await metaIdDoPlano(tarefa.plano_id));
      }
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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PLANOS_KEY });
      qc.invalidateQueries({ queryKey: ["metas"] });
    },
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
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
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
        responsavel_id: t.responsavel_id ?? uid ?? null,
        data_inicio: t.data_inicio || null,
        data_fim: t.data_fim || null,
        duracao_minutos: t.duracao_minutos ?? null,
        horario_preferencial: t.horario_preferencial || null,
        dias_semana: t.dias_semana ?? null,
      });
      if (error) throw error;
      await sincronizarEtapasDaMeta(await metaIdDoPlano(planoId));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANOS_KEY });
      qc.invalidateQueries({ queryKey: ["metas"] });
    },
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
      impacto?: number;
      esforco?: number;
      responsavel_id?: string | null;
      data_inicio?: string | null;
      data_fim?: string | null;
      duracao_minutos?: number | null;
      horario_preferencial?: string | null;
      dias_semana?: number[] | null;
    }) => {
      const { data: anterior, error: readError } = await supabase
        .from("plano_tarefas")
        .select("frequencia,data_inicio,data_fim,duracao_minutos,horario_preferencial,dias_semana,responsavel_id")
        .eq("id", id)
        .single();
      if (readError) throw readError;

      const horaAnterior = anterior.horario_preferencial?.slice(0, 5) ?? null;
      const horaNova = patch.horario_preferencial?.slice(0, 5) ?? null;
      const diasAnteriores = JSON.stringify(anterior.dias_semana ?? null);
      const diasNovos = JSON.stringify(patch.dias_semana ?? null);
      const agendaMudou =
        (patch.frequencia !== undefined && patch.frequencia !== anterior.frequencia) ||
        (patch.data_inicio !== undefined && patch.data_inicio !== anterior.data_inicio) ||
        (patch.data_fim !== undefined && patch.data_fim !== anterior.data_fim) ||
        (patch.duracao_minutos !== undefined && patch.duracao_minutos !== anterior.duracao_minutos) ||
        (patch.horario_preferencial !== undefined && horaNova !== horaAnterior) ||
        (patch.dias_semana !== undefined && diasNovos !== diasAnteriores);
      const responsavelMudou =
        patch.responsavel_id !== undefined &&
        patch.responsavel_id !== anterior.responsavel_id;

      if (agendaMudou && responsavelMudou) {
        throw new Error(
          "Altere primeiro a rotina e salve. Depois, reabra a ação para trocar o responsável.",
        );
      }

      const { error } = await supabase.from("plano_tarefas").update(patch).eq("id", id);
      if (error) throw error;

      if (agendaMudou) {
        // Ocorrências futuras geradas automaticamente precisam refletir a
        // nova configuração. Histórico e agendamentos manuais são preservados.
        const hoje = new Date().toISOString().slice(0, 10);
        const { error: agendaError } = await supabase
          .from("tarefa_agendamentos")
          .delete()
          .eq("tarefa_id", id)
          .eq("observacao", "Gerado pela recorrência")
          .gte("data", hoje);
        if (agendaError) throw agendaError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANOS_KEY });
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
    },
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
      const metaId = await metaIdDoPlano(id);
      const { error } = await supabase.from("planos_acao").delete().eq("id", id);
      if (error) throw error;
      await sincronizarEtapasDaMeta(metaId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANOS_KEY });
      qc.invalidateQueries({ queryKey: ["metas"] });
    },
  });
}
