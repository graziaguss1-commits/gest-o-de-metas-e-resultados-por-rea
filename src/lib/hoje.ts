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

export type BlocoComOrigem = BlocoExecucao & { origemId: string };

/**
 * Referência estável do bloco, no mesmo formato da função whatsapp-agenda:
 * `ag:<agendamento>`, `av:<ação avulsa>`, `cp:<compromisso>@<data original>`.
 *
 * Mora aqui, junto do tipo do bloco, porque é a identidade dele: motivo de
 * não execução e prioridade do dia são dois usos, não dois formatos.
 */
export function referenciaBloco(b: BlocoComOrigem): string | null {
  if (b.tipo === "plano") return `ag:${b.origemId}`;
  if (b.tipo === "avulsa") return `av:${b.origemId}`;
  if (b.tipo === "compromisso") return `cp:${b.origemId.includes("@") ? b.origemId : `${b.origemId}@${b.data}`}`;
  return null; // Google: não é bloco dela, nunca é prioridade nem falta.
}

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
 * Prioridade do dia: o bloco que ela marcou como a prioridade de hoje.
 *
 * Sem marcação, devolve o próximo bloco pendente com `ehTop: false` — é uma
 * sugestão de por onde seguir, não uma prioridade. A diferença importa: dia
 * sem escolha é estado normal, e a tela não pode fingir que ela escolheu.
 *
 * Marcado e já concluído também devolve null: a prioridade do dia foi
 * cumprida, e insistir nela depois de feita é ruído.
 */
export function escolherPrioridadeDoDia<T extends BlocoComOrigem>(
  blocosHoje: T[],
  referenciaPrioridade: string | null | undefined,
  agora: Date,
): { bloco: T; ehTop: boolean } | null {
  const pendentes = blocosHoje
    .filter((b) => b.tipo !== "google" && !b.concluido)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  if (referenciaPrioridade) {
    const escolhido = pendentes.find((b) => referenciaBloco(b) === referenciaPrioridade);
    if (escolhido) return { bloco: escolhido, ehTop: true };
  }

  const proximo =
    pendentes.find((b) => fimDoBloco(b).getTime() > agora.getTime()) ??
    pendentes[0];
  return proximo ? { bloco: proximo, ehTop: false } : null;
}
