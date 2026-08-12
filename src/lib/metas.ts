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

export function formatDateISOToBR(iso: string): string { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
export function todayISO(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
