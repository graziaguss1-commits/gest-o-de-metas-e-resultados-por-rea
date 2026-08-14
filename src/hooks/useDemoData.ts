import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/** Conta quantos registros de demonstração existem. */
export function useDemoStatus() {
  return useQuery({
    queryKey: ["demo-status"],
    queryFn: async () => {
      const [{ count: metas }, { count: lancamentos }, { count: planos }] = await Promise.all([
        supabase.from("metas").select("id", { count: "exact", head: true }).eq("is_demo", true),
        supabase.from("meta_lancamentos").select("id", { count: "exact", head: true }).eq("is_demo", true),
        supabase.from("planos_acao").select("id", { count: "exact", head: true }).eq("is_demo", true),
      ]);
      return {
        metas: metas ?? 0,
        lancamentos: lancamentos ?? 0,
        planos: planos ?? 0,
        hasDemo: (metas ?? 0) > 0,
      };
    },
  });
}

type SeedMetaTpl = {
  nome: string;
  descricao: string;
  area: string;
  valor_alvo: number;
  unidade: string;
  is_inverse: boolean;
  // série diária (offsetDias relativos a hoje) → valor
  serie: { offsetDias: number; valor: number }[];
};

const NOW = () => new Date();

function daysAgo(d: number): string {
  const dt = NOW();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
}

const SEEDS: SeedMetaTpl[] = [
  {
    nome: "Receita MRR",
    descricao: "Receita recorrente mensal — fonte: financeiro.",
    area: "Comercial",
    valor_alvo: 120000,
    unidade: "R$",
    is_inverse: false,
    serie: [
      { offsetDias: 28, valor: 62000 },
      { offsetDias: 21, valor: 68500 },
      { offsetDias: 14, valor: 75200 },
      { offsetDias: 7, valor: 81800 },
      { offsetDias: 0, valor: 87400 },
    ],
  },
  {
    nome: "NPS Trimestral",
    descricao: "Net Promoter Score do trimestre — pesquisa mensal.",
    area: "CS",
    valor_alvo: 80,
    unidade: "pts",
    is_inverse: false,
    serie: [
      { offsetDias: 25, valor: 65 },
      { offsetDias: 15, valor: 68 },
      { offsetDias: 5, valor: 72 },
    ],
  },
  {
    nome: "Leads Qualificados (MQLs)",
    descricao: "Leads marketing-qualified gerados no mês.",
    area: "Marketing",
    valor_alvo: 500,
    unidade: "leads",
    is_inverse: false,
    serie: [
      { offsetDias: 28, valor: 85 },
      { offsetDias: 21, valor: 168 },
      { offsetDias: 14, valor: 232 },
      { offsetDias: 7, valor: 295 },
      { offsetDias: 0, valor: 340 },
    ],
  },
  {
    nome: "Churn Rate",
    descricao: "Taxa de cancelamento mensal (menor é melhor).",
    area: "CS",
    valor_alvo: 2,
    unidade: "%",
    is_inverse: true,
    serie: [
      { offsetDias: 28, valor: 2.8 },
      { offsetDias: 21, valor: 2.9 },
      { offsetDias: 14, valor: 3.1 },
      { offsetDias: 7, valor: 3.0 },
      { offsetDias: 0, valor: 3.2 },
    ],
  },
  {
    nome: "Uptime do produto",
    descricao: "Disponibilidade % da plataforma — SLA empresarial.",
    area: "Produto",
    valor_alvo: 99.9,
    unidade: "%",
    is_inverse: false,
    serie: [
      { offsetDias: 28, valor: 99.5 },
      { offsetDias: 21, valor: 99.3 },
      { offsetDias: 14, valor: 99.4 },
      { offsetDias: 7, valor: 99.2 },
      { offsetDias: 0, valor: 99.1 },
    ],
  },
  {
    nome: "CAC Marketing",
    descricao: "Custo de aquisição de cliente — canal pago (menor é melhor).",
    area: "Marketing",
    valor_alvo: 250,
    unidade: "R$",
    is_inverse: true,
    serie: [
      { offsetDias: 28, valor: 420 },
      { offsetDias: 21, valor: 405 },
      { offsetDias: 14, valor: 395 },
      { offsetDias: 7, valor: 390 },
      { offsetDias: 0, valor: 380 },
    ],
  },
];

const DEMO_PLANOS: {
  metaIndex: number;
  titulo: string;
  tarefas: { descricao: string; prazoOffset: number }[];
}[] = [
  {
    metaIndex: 3, // Churn Rate
    titulo: "Plano de retenção — reduzir churn em 30 dias",
    tarefas: [
      { descricao: "Mapear top 10 clientes com NPS < 6 e agendar call de saúde", prazoOffset: 5 },
      { descricao: "Lançar fluxo de re-engajamento para contas inativas há 14+ dias", prazoOffset: 12 },
      { descricao: "Implementar pesquisa pulse no primeiro mês de contrato", prazoOffset: 20 },
      { descricao: "Revisar onboarding com foco em time-to-value", prazoOffset: 28 },
    ],
  },
  {
    metaIndex: 5, // CAC Marketing
    titulo: "Sprint de eficiência de mídia",
    tarefas: [
      { descricao: "Pausar 3 campanhas com CAC > R$ 500 e CTR < 0,5%", prazoOffset: 3 },
      { descricao: "Realocar budget para top 2 canais com payback < 4 meses", prazoOffset: 10 },
      { descricao: "Testar 3 novos criativos com proposta de valor por segmento", prazoOffset: 21 },
    ],
  },
];

function daysAhead(d: number): string {
  const dt = NOW();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}


export function useLoadDemoData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) throw new Error("Sessão expirada.");

      // janela: hoje - 30d → hoje + 30d (mês corrente alargado)
      const dataInicio = daysAgo(30);
      const dataFim = (() => {
        const dt = NOW();
        dt.setDate(dt.getDate() + 30);
        return dt.toISOString().slice(0, 10);
      })();

      // Insere metas
      const metasRows = SEEDS.map((s) => ({
        nome: s.nome,
        descricao: s.descricao,
        area: s.area,
        valor_alvo: s.valor_alvo,
        unidade: s.unidade,
        is_inverse: s.is_inverse,
        periodicidade: "mensal" as const,
        data_inicio: dataInicio,
        data_fim: dataFim,
        valor_atual: s.serie[s.serie.length - 1].valor,
        criado_por: uid,
        is_demo: true,
        status: "verde" as const, // recalculado abaixo
      }));

      const createdIds: string[] = [];
      for (const row of metasRows) {
        const { data: id, error } = await supabase.rpc("criar_meta_com_responsaveis", {
          p_meta: row as unknown as Json,
          p_responsaveis: [uid],
        });
        if (error) throw error;
        createdIds.push(id);
      }

      const { data: fetchedMetas, error: mErr } = await supabase
        .from("metas")
        .select("*")
        .in("id", createdIds);
      if (mErr) throw mErr;
      const createdMetas = createdIds.flatMap((id) => {
        const meta = (fetchedMetas ?? []).find((item) => item.id === id);
        return meta ? [meta] : [];
      });
      if (createdMetas.length !== metasRows.length) {
        throw new Error("Não foi possível recuperar todas as metas de demonstração.");
      }

      // Recalcula status de cada uma via RPC
      for (const meta of createdMetas) {
        const { data: status } = await supabase.rpc("calcular_status_meta", {
          p_valor_atual: meta.valor_atual,
          p_valor_alvo: meta.valor_alvo,
          p_data_inicio: meta.data_inicio,
          p_data_fim: meta.data_fim,
          p_is_inverse: meta.is_inverse,
        });
        if (status) {
          await supabase.from("metas").update({ status }).eq("id", meta.id);
        }
      }

      // Insere lançamentos
      const lancRows: {
        meta_id: string;
        valor: number;
        data_lancamento: string;
        lancado_por: string;
        is_demo: boolean;
      }[] = [];
      createdMetas.forEach((meta, idx) => {
        const tpl = SEEDS[idx];
        for (const ponto of tpl.serie) {
          lancRows.push({
            meta_id: meta.id,
            valor: ponto.valor,
            data_lancamento: daysAgo(ponto.offsetDias),
            lancado_por: uid,
            is_demo: true,
          });
        }
      });
      const { error: lErr } = await supabase.from("meta_lancamentos").insert(lancRows);
      if (lErr) throw lErr;

      // Insere planos + tarefas
      for (const planoTpl of DEMO_PLANOS) {
        const meta = createdMetas[planoTpl.metaIndex];
        if (!meta) continue;
        const { data: plano, error: pErr } = await supabase
          .from("planos_acao")
          .insert({
            meta_id: meta.id,
            titulo: planoTpl.titulo,
            criado_por: uid,
            is_demo: true,
          })
          .select()
          .single();
        if (pErr) throw pErr;

        const tarefasRows = planoTpl.tarefas.map((t, ordem) => ({
          plano_id: plano.id,
          descricao: t.descricao,
          prazo: daysAhead(t.prazoOffset),
          ordem,
          concluida: ordem === 0,
        }));

        const { error: tErr } = await supabase.from("plano_tarefas").insert(tarefasRows);
        if (tErr) throw tErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas"] });
      qc.invalidateQueries({ queryKey: ["planos"] });
      qc.invalidateQueries({ queryKey: ["demo-status"] });
    },
  });
}

export function useClearDemoData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Cascade: deletando metas demo, lançamentos/planos vinculados caem junto
      // (mas planos podem ter is_demo independente — deletamos explicitamente também)
      await supabase.from("planos_acao").delete().eq("is_demo", true);
      await supabase.from("meta_lancamentos").delete().eq("is_demo", true);
      await supabase.from("metas").delete().eq("is_demo", true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas"] });
      qc.invalidateQueries({ queryKey: ["planos"] });
      qc.invalidateQueries({ queryKey: ["demo-status"] });
    },
  });
}
