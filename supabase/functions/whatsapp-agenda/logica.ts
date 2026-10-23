// Regras puras do aviso diário/lembretes (sem dependências do Deno, testáveis).

export const FUSO = "America/Sao_Paulo";
export const LIMITE_DIARIO = 10;
/** Lembrete sai quando faltam entre 1 e 7 minutos (cron a cada 5 min cobre todo início). */
export const JANELA_LEMBRETE_MIN = 7;

export type Bloco = {
  ref: string;
  titulo: string;
  inicio: string; // HH:MM
  tarefaId?: string;
  concluido?: boolean;
  /** Duracao planejada, usada na regra de sobrecarga do coach. */
  duracaoMinutos?: number;
};

/** Data (YYYY-MM-DD), minutos do dia e segunda-feira no fuso de São Paulo. */
export function agoraEmSaoPaulo(agora: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(agora).map((p) => [p.type, p.value]),
  );
  const data = `${partes.year}-${partes.month}-${partes.day}`;
  const minutos = Number(partes.hour) * 60 + Number(partes.minute);
  const d = new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)));
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return { data, minutos, segunda: d.toISOString().slice(0, 10) };
}

export const minutosDe = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/** Primeiro bloco pendente de uma prioridade top, na ordem das prioridades. */
export function prioridadeDoDia(blocos: Bloco[], topIds: string[]): Bloco | null {
  const pendentes = blocos.filter((b) => !b.concluido).sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (const id of topIds) {
    const b = pendentes.find((x) => x.tarefaId === id);
    if (b) return b;
  }
  return null;
}

/** Blocos de prioridade top que começam dentro da janela do lembrete. */
export function blocosParaLembrar(blocos: Bloco[], topIds: string[], minutosAgora: number): Bloco[] {
  const top = new Set(topIds);
  return blocos.filter((b) => {
    if (!b.tarefaId || !top.has(b.tarefaId) || b.concluido) return false;
    const falta = minutosDe(b.inicio) - minutosAgora;
    return falta > 0 && falta <= JANELA_LEMBRETE_MIN;
  });
}

export function mascararNumero(numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (d.length <= 4) return "****";
  return `${d.slice(0, 4)}${"*".repeat(Math.max(0, d.length - 6))}${d.slice(-2)}`;
}

export function mensagemDiaria(foco: string, prioridade: Bloco | null, primeiro: Bloco | null): string {
  return [
    "☀️ Bom dia! Seu dia no Metas e Resultados:",
    `🎯 Foco da semana: ${foco.trim() || "não definido"}`,
    `⭐ Prioridade top de hoje: ${prioridade ? `${prioridade.titulo} (${prioridade.inicio})` : "nenhuma agendada hoje"}`,
    `⏰ Primeiro bloco: ${primeiro ? `${primeiro.inicio} · ${primeiro.titulo}` : "agenda livre hoje"}`,
  ].join("\n");
}

export function mensagemLembrete(bloco: Bloco): string {
  return `⏰ Em 5 minutos (${bloco.inicio}): ${bloco.titulo}\nÉ uma prioridade top da semana. Bora começar!`;
}
