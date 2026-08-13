import type { Database } from "@/integrations/supabase/types";

export type Meta = Database["public"]["Tables"]["metas"]["Row"];
export type MetaInsert = Database["public"]["Tables"]["metas"]["Insert"];
export type MetaUpdate = Database["public"]["Tables"]["metas"]["Update"];
export type MetaWithResponsavel = Database["public"]["Views"]["metas_with_responsavel"]["Row"];
export type Lancamento = Database["public"]["Tables"]["meta_lancamentos"]["Row"];
export type Comentario = Database["public"]["Tables"]["meta_comentarios"]["Row"];
export type Plano = Database["public"]["Tables"]["planos_acao"]["Row"];
export type Tarefa = Database["public"]["Tables"]["plano_tarefas"]["Row"];
export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];

export type Status = "verde" | "amarelo" | "vermelho";

export const AREAS = [
  "Clínica",
  "Mentoria",
  "Pessoal",
  "Saúde",
  "Financeiro pessoal",
  "Espiritual",
  "Intelectual",
  "Conjugal",
  "Família",
  "Social",
  "Emocional",
  "Patrimônio",
  "Outro",
] as const;
export type Area = (typeof AREAS)[number];

export const PERIODICIDADES = ["mensal", "trimestral", "anual"] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

/** Tipos de medição suportados por uma meta. */
export const METRIC_TYPES = [
  "quantidade",
  "financeiro",
  "percentual",
  "projeto",
  "habito",
  "tempo",
] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

type MetricConfig = {
  label: string;
  alvoLabel: string;
  ajuda: string;
  alvoPlaceholder: string;
  /** Unidade fixa quando pode ser inferida automaticamente. */
  unidadeFixa?: string;
  /** Rótulo do campo de unidade quando o usuário precisa informá-la. */
  unidadeLabel?: string;
  unidadePlaceholder?: string;
  unidadeAjuda?: string;
  /** Opções fechadas de unidade (ex.: tempo). */
  unidadeOpcoes?: readonly string[];
  prefixo?: string;
  sufixo?: string;
};

export const METRIC_CONFIG: Record<MetricType, MetricConfig> = {
  quantidade: {
    label: "Quantidade",
    alvoLabel: "Quantidade-alvo",
    ajuda: "Conta quantos itens você quer atingir (pessoas, entregas, conteúdos).",
    alvoPlaceholder: "2",
    unidadeLabel: "O que será contado?",
    unidadePlaceholder: "mentorados",
    unidadeAjuda: "Exemplos: mentorados, pacientes, conteúdos.",
  },
  financeiro: {
    label: "Financeiro",
    alvoLabel: "Valor-alvo",
    ajuda: "Metas em dinheiro: faturamento, custo, investimento.",
    alvoPlaceholder: "120000",
    unidadeFixa: "R$",
    prefixo: "R$",
  },
  percentual: {
    label: "Percentual",
    alvoLabel: "Percentual-alvo",
    ajuda: "Metas de taxa: conversão, ocupação, churn.",
    alvoPlaceholder: "85",
    unidadeFixa: "%",
    sufixo: "%",
  },
  projeto: {
    label: "Projeto por etapas",
    alvoLabel: "Total de etapas",
    ajuda: "O progresso avança conforme as etapas concluídas.",
    alvoPlaceholder: "8",
    unidadeFixa: "etapas",
    sufixo: "etapas",
  },
  habito: {
    label: "Hábito/frequência",
    alvoLabel: "Frequência-alvo",
    ajuda: "Repetições dentro de um período (treinos, leituras, ligações).",
    alvoPlaceholder: "3",
    unidadeLabel: "Frequência (contexto)",
    unidadePlaceholder: "vezes por semana",
    unidadeAjuda: "Exemplos: vezes por semana, vezes por mês.",
  },
  tempo: {
    label: "Tempo",
    alvoLabel: "Tempo-alvo",
    ajuda: "Metas de duração: horas de estudo, dias sem falha, minutos de resposta.",
    alvoPlaceholder: "40",
    unidadeLabel: "Unidade de tempo",
    unidadeOpcoes: ["horas", "dias", "minutos"] as const,
  },
};

/** Deduz o tipo de medição a partir da unidade (compatibilidade com metas antigas). */
export function inferMetricType(unidade: string | null | undefined): MetricType {
  const u = (unidade ?? "").trim().toLowerCase();
  if (u === "r$" || u === "brl") return "financeiro";
  if (u === "%") return "percentual";
  if (u === "etapas" || u === "etapa") return "projeto";
  if (["horas", "hora", "dias", "dia", "minutos", "minuto"].includes(u)) return "tempo";
  if (u.includes("por semana") || u.includes("por mês") || u.includes("por mes") || u.includes("por dia"))
    return "habito";
  return "quantidade";
}

export function getMetricType(
  meta: { metric_type?: string | null; unidade: string },
): MetricType {
  const t = meta.metric_type as MetricType | null | undefined;
  return t && (METRIC_TYPES as readonly string[]).includes(t) ? t : inferMetricType(meta.unidade);
}


export const STATUS_LABEL: Record<Status, string> = { verde: "No prazo", amarelo: "Em atenção", vermelho: "Em risco" };
export const STATUS_COLOR: Record<Status, { fg: string; bg: string }> = {
  verde: { fg: "var(--color-green)", bg: "var(--color-green-bg)" },
  amarelo: { fg: "var(--color-amber)", bg: "var(--color-amber-bg)" },
  vermelho: { fg: "var(--color-red)", bg: "var(--color-red-bg)" },
};

export function progressoReal(valorAtual: number, valorAlvo: number, isInverse: boolean): number {
  if (valorAlvo === 0) return valorAtual === 0 ? 1 : 0;
  if (isInverse) return Math.max(0, Math.min(1, 1 - valorAtual / valorAlvo));
  return Math.max(0, Math.min(1, valorAtual / valorAlvo));
}

export function progressoEsperado(dataInicio: string, dataFim: string): number {
  const inicio = new Date(dataInicio).getTime();
  const fim = new Date(dataFim).getTime();
  const hoje = Date.now();
  if (fim <= inicio) return 1;
  if (hoje <= inicio) return 0;
  if (hoje >= fim) return 1;
  return (hoje - inicio) / (fim - inicio);
}

export function desvioPercentual(meta: Pick<Meta, "valor_atual" | "valor_alvo" | "data_inicio" | "data_fim" | "is_inverse">): number {
  return Math.round((progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse) - progressoEsperado(meta.data_inicio, meta.data_fim)) * 100);
}

export function formatValor(valor: number, unidade: string): string {
  const u = unidade.trim();
  if (u === "R$" || u.toLowerCase() === "brl") return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: valor % 1 === 0 ? 0 : 2 });
  if (u === "%") return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${u}`.trim();
}

/** Só o número, sem unidade (útil para "0 de 2 mentorados"). */
export function formatNumero(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/**
 * Texto de progresso conforme o tipo de medição.
 * Ex.: "0 de 2 mentorados", "R$ 0 de R$ 120.000", "0% de 85%".
 */
export function formatProgresso(
  meta: { valor_atual: number; valor_alvo: number; unidade: string; metric_type?: string | null },
): string {
  const tipo = getMetricType(meta);
  if (tipo === "financeiro" || tipo === "percentual") {
    return `${formatValor(meta.valor_atual, meta.unidade)} de ${formatValor(meta.valor_alvo, meta.unidade)}`;
  }
  const u = meta.unidade.trim();
  return `${formatNumero(meta.valor_atual)} de ${formatNumero(meta.valor_alvo)}${u ? ` ${u}` : ""}`;
}



export function formatDateISOToBR(iso: string): string { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
export function todayISO(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
