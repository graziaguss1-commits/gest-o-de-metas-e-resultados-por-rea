import { horarioEmMinutos } from "@/lib/agenda";

export type BlocoExecucao = {
  id: string;
  data: string;
  inicio: string;
  fim: string;
  tipo: "plano" | "avulsa" | "compromisso" | "google";
  concluido?: boolean;
  tarefaId?: string;
};

export const isoLocal = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Segunda-feira da semana da data (mesma regra do planejamento semanal). */
export function segundaDaSemana(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Momento em que o bloco termina, no fuso local. */
export function fimDoBloco(bloco: Pick<BlocoExecucao, "data" | "fim">): Date {
  const [ano, mes, dia] = bloco.data.split("-").map(Number);
  const minutos = horarioEmMinutos(bloco.fim);
  return new Date(ano, mes - 1, dia, Math.floor(minutos / 60), minutos % 60);
}

/**
 * Cumprimento da agenda: blocos feitos ÷ blocos cujo horário já terminou.
 * Blocos futuros não entram no denominador; ocupados do Google não contam.
 * Um bloco feito antes do horário terminar conta no numerador e denominador.
 */
export function cumprimentoAgenda(blocos: BlocoExecucao[], agora: Date) {
  const proprios = blocos.filter((b) => b.tipo !== "google");
  const considerados = proprios.filter(
    (b) => fimDoBloco(b).getTime() <= agora.getTime() || b.concluido,
  );
  const feitos = considerados.filter((b) => b.concluido).length;
  const total = considerados.length;
  return {
    feitos,
    total,
    pct: total > 0 ? Math.round((feitos / total) * 100) : null,
  };
}

/**
 * Prioridade do dia: primeiro bloco pendente de hoje de uma prioridade top
 * (na ordem das prioridades); sem isso, o próximo bloco pendente do dia.
 */
export function escolherPrioridadeDoDia<T extends BlocoExecucao>(
  blocosHoje: T[],
  prioridadesTop: string[],
  agora: Date,
): { bloco: T; ehTop: boolean } | null {
  const pendentes = blocosHoje
    .filter((b) => b.tipo !== "google" && !b.concluido)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (const id of prioridadesTop) {
    const bloco = pendentes.find((b) => b.tarefaId === id);
    if (bloco) return { bloco, ehTop: true };
  }
  const proximo =
    pendentes.find((b) => fimDoBloco(b).getTime() > agora.getTime()) ??
    pendentes[0];
  return proximo ? { bloco: proximo, ehTop: false } : null;
}
