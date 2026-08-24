/**
 * Cálculos que separam RESULTADO (meta) de EXECUÇÃO (planos de ação).
 *
 * Regras principais (documentadas propositalmente aqui):
 * 1. O progresso do RESULTADO usa exclusivamente valor_atual / valor_alvo
 *    (ver `progressoReal` em `@/lib/metas`). Concluir tarefas NUNCA altera o resultado.
 * 2. A EXECUÇÃO de um plano é a média PONDERADA PELO IMPACTO (1..10) do percentual
 *    de execução de cada ação do plano no período corrente. Se nenhuma ação tiver
 *    impacto informado, cai para média simples (todos com peso igual).
 * 3. O PRAZO consumido é a fração de tempo decorrida entre data_inicio e data_fim.
 */

export const FREQUENCIAS = ["unica", "diaria", "semanal", "mensal"] as const;
export type Frequencia = (typeof FREQUENCIAS)[number];

export const FREQUENCIA_LABEL: Record<Frequencia, string> = {
  unica: "Única",
  diaria: "Por dia",
  semanal: "Por semana",
  mensal: "Por mês",
};

export type TarefaMensuravel = {
  id: string;
  descricao: string;
  concluida: boolean;
  frequencia?: string | null;
  quantidade_planejada?: number | null;
  /** Quantidade de blocos necessários no calendário por período. */
  execucoes_planejadas?: number | null;
  unidade?: string | null;
  impacto?: number | null;
  esforco?: number | null;
  prazo?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  /** Estimativa de duração por execução (minutos). */
  duracao_minutos?: number | null;
  horario_preferencial?: string | null;
  dias_semana?: number[] | null;
  /** Pessoa creditada pela execução desta ação. */
  responsavel_id?: string | null;
};

export type Execucao = {
  id: string;
  tarefa_id: string;
  data_referencia: string;
  quantidade: number;
  observacao?: string | null;
  /** Tempo real gasto na execução (minutos), opcional. */
  tempo_real_minutos?: number | null;
};

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Período corrente de acompanhamento conforme a frequência da ação. */
export function periodoCorrente(
  frequencia: Frequencia,
  hoje: Date = new Date(),
): { inicio: string; fim: string; label: string } {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (frequencia === "diaria") {
    return { inicio: toISO(d), fim: toISO(d), label: "hoje" };
  }
  if (frequencia === "semanal") {
    const dow = (d.getDay() + 6) % 7; // segunda = 0
    const ini = new Date(d);
    ini.setDate(d.getDate() - dow);
    const fim = new Date(ini);
    fim.setDate(ini.getDate() + 6);
    return { inicio: toISO(ini), fim: toISO(fim), label: "esta semana" };
  }
  if (frequencia === "mensal") {
    const ini = new Date(d.getFullYear(), d.getMonth(), 1);
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { inicio: toISO(ini), fim: toISO(fim), label: "este mês" };
  }
  return { inicio: "0000-01-01", fim: "9999-12-31", label: "no total" };
}

export function getFrequencia(t: Pick<TarefaMensuravel, "frequencia">): Frequencia {
  const f = (t.frequencia ?? "unica") as Frequencia;
  return (FREQUENCIAS as readonly string[]).includes(f) ? f : "unica";
}

export type ExecucaoTarefa = {
  planejado: number;
  realizado: number;
  pct: number;
  periodoLabel: string;
  texto: string;
};

/**
 * Execução da ação no período corrente.
 * Compatibilidade: tarefas antigas (sem quantidade/execuções) usam o checkbox
 * `concluida` como 0% ou 100%.
 */
export function execucaoTarefa(
  tarefa: TarefaMensuravel,
  execucoes: Execucao[] = [],
  hoje: Date = new Date(),
): ExecucaoTarefa {
  const freq = getFrequencia(tarefa);
  const { inicio, fim, label } = periodoCorrente(freq, hoje);
  const planejado = Number(tarefa.quantidade_planejada ?? 1) || 1;
  const doPeriodo = execucoes.filter(
    (e) => e.tarefa_id === tarefa.id && e.data_referencia >= inicio && e.data_referencia <= fim,
  );

  const realizado = doPeriodo.reduce((acc, e) => acc + Number(e.quantidade || 0), 0);
  const semRegistro = doPeriodo.length === 0;
  const pct = semRegistro
    ? tarefa.concluida
      ? 1
      : 0
    : Math.max(0, Math.min(1, realizado / planejado));

  const unidade = (tarefa.unidade ?? "").trim();
  const texto = semRegistro && tarefa.concluida && !unidade
    ? "Concluída"
    : `${fmt(realizado)} de ${fmt(planejado)}${unidade ? ` ${unidade}` : ""} · ${Math.round(pct * 100)}%`;

  return { planejado, realizado, pct, periodoLabel: label, texto };
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Média ponderada pelo impacto das ações (fallback: média simples). */
export function execucaoPlano(
  tarefas: TarefaMensuravel[],
  execucoes: Execucao[] = [],
  hoje: Date = new Date(),
): number {
  if (tarefas.length === 0) return 0;
  let somaPeso = 0;
  let soma = 0;
  for (const t of tarefas) {
    const peso = Number(t.impacto ?? 0) > 0 ? Number(t.impacto) : 1;
    soma += execucaoTarefa(t, execucoes, hoje).pct * peso;
    somaPeso += peso;
  }
  return somaPeso === 0 ? 0 : soma / somaPeso;
}

/**
 * Execução das ações atribuídas a uma pessoa. Retorna null quando ela ainda não
 * possui ações, evitando apresentar 0% como se houvesse atraso.
 */
export function execucaoResponsavel(
  tarefas: TarefaMensuravel[],
  execucoes: Execucao[] = [],
  responsavelId: string,
  hoje: Date = new Date(),
): number | null {
  const atribuidas = tarefas.filter((tarefa) => tarefa.responsavel_id === responsavelId);
  return atribuidas.length ? execucaoPlano(atribuidas, execucoes, hoje) : null;
}

/** Fração do prazo consumida entre início e fim (0..1). */
export function prazoConsumido(dataInicio: string, dataFim: string, hoje: Date = new Date()): number {
  const ini = new Date(`${dataInicio}T00:00:00`).getTime();
  const fim = new Date(`${dataFim}T23:59:59`).getTime();
  const now = hoje.getTime();
  if (fim <= ini) return 1;
  if (now <= ini) return 0;
  if (now >= fim) return 1;
  return (now - ini) / (fim - ini);
}

export type DiagnosticoChave =
  | "na_rota"
  | "falta_execucao"
  | "revisar_estrategia"
  | "resultado_insustentavel";

export type Diagnostico = {
  chave: DiagnosticoChave;
  titulo: string;
  frase: string;
  recomendacao: string;
  tom: "verde" | "amarelo" | "vermelho";
};

/**
 * Diagnóstico gerencial.
 * - Resultado é "adequado" quando o progresso do resultado alcança ao menos 90%
 *   do prazo já consumido (tolerância de 10%).
 * - Execução é "alta" quando >= 70%.
 */
export function diagnosticar(
  resultadoPct: number,
  execucaoPct: number,
  prazoPct: number,
): Diagnostico {
  const esperado = prazoPct * 0.9;
  const resultadoOk = resultadoPct >= esperado;
  const execucaoAlta = execucaoPct >= 0.7;

  if (resultadoOk && execucaoAlta) {
    return {
      chave: "na_rota",
      titulo: "Na rota",
      frase: "Resultado acompanha o prazo e o plano está sendo executado.",
      recomendacao: "Mantenha a rotina atual e registre os resultados semanalmente.",
      tom: "verde",
    };
  }
  if (!resultadoOk && !execucaoAlta) {
    return {
      chave: "falta_execucao",
      titulo: "Falta execução",
      frase: "O resultado está atrasado porque o plano não está sendo cumprido.",
      recomendacao: "Reduza o número de ações e proteja horários fixos para as de maior impacto.",
      tom: "vermelho",
    };
  }
  if (!resultadoOk && execucaoAlta) {
    return {
      chave: "revisar_estrategia",
      titulo: "Revisar estratégia",
      frase: "Você está executando bem, mas as ações não estão gerando resultado.",
      recomendacao: "Troque ou ajuste as ações: revise oferta, público e etapa do funil com maior perda.",
      tom: "amarelo",
    };
  }
  return {
    chave: "resultado_insustentavel",
    titulo: "Resultado pouco sustentável",
    frase: "O resultado veio, mas sem execução consistente do plano.",
    recomendacao: "Padronize as ações que funcionaram para não depender de acaso no próximo período.",
    tom: "amarelo",
  };
}

/* ---------------------------- Funil de conversão --------------------------- */

export const FUNIL_PADRAO = ["Prospectados", "Reuniões", "Propostas", "Convertidos"] as const;

export type EtapaFunil = { id: string; nome: string; ordem: number; valor: number };

export type TaxaFunil = { de: string; para: string; taxa: number };

export function taxasFunil(etapas: EtapaFunil[]): TaxaFunil[] {
  const ord = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const out: TaxaFunil[] = [];
  for (let i = 1; i < ord.length; i++) {
    const anterior = Number(ord[i - 1].valor || 0);
    const atual = Number(ord[i].valor || 0);
    out.push({ de: ord[i - 1].nome, para: ord[i].nome, taxa: anterior === 0 ? 0 : atual / anterior });
  }
  return out;
}

/** Maior gargalo = menor taxa entre etapas consecutivas com volume de entrada. */
export function gargaloFunil(etapas: EtapaFunil[]): TaxaFunil | null {
  const taxas = taxasFunil(etapas);
  if (taxas.length === 0) return null;
  return taxas.reduce((pior, t) => (t.taxa < pior.taxa ? t : pior), taxas[0]);
}
