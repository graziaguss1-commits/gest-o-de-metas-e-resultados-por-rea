/**
 * Duração estimada das ações, agendamento por horário e capacidade da agenda.
 *
 * Regras documentadas:
 * 1. `duracao_minutos` é a estimativa POR EXECUÇÃO da ação. É diferente do
 *    prazo/data final (quando a ação deve terminar) e da quantidade planejada.
 * 2. Ações antigas sem estimativa permanecem `null` — nunca inventamos duração.
 * 3. Ocorrências agendadas são registros reais (`tarefa_agendamentos`) criados
 *    apenas para o período visível/escolhido pela usuária. Nada é gerado
 *    automaticamente para o futuro infinito; recorrência diária apenas sugere
 *    os dias da semana em que a ação deveria ser agendada.
 * 4. Tempo real gasto (`tempo_real_minutos`) nunca substitui a estimativa;
 *    serve só para comparação "Estimado 45 min · Real 55 min".
 */

export const DURACAO_PRESETS = [15, 30, 45, 60, 90, 120] as const;

/** 1 = segunda … 7 = domingo (ISO). */
export const DIAS_SEMANA = [
  { valor: 1, curto: "Seg", longo: "Segunda" },
  { valor: 2, curto: "Ter", longo: "Terça" },
  { valor: 3, curto: "Qua", longo: "Quarta" },
  { valor: 4, curto: "Qui", longo: "Quinta" },
  { valor: 5, curto: "Sex", longo: "Sexta" },
  { valor: 6, curto: "Sáb", longo: "Sábado" },
  { valor: 7, curto: "Dom", longo: "Domingo" },
] as const;

export const DIAS_UTEIS = [1, 2, 3, 4, 5];
export const TODOS_OS_DIAS = [1, 2, 3, 4, 5, 6, 7];

/** Dia ISO (1=segunda … 7=domingo) de uma data. */
export function diaISO(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

/** "45 min", "1h", "1h30". Retorna null quando não há estimativa. */
export function formatDuracao(minutos?: number | null): string | null {
  const m = Number(minutos ?? 0);
  if (!Number.isFinite(m) || m <= 0) return null;
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h}h`;
  return `${h}h${String(rest).padStart(2, "0")}`;
}

/** "4h30" para totais da agenda (0 vira "0h"). */
export function formatTotalHoras(minutos: number): string {
  return formatDuracao(minutos) ?? "0h";
}

/** "09:00" + 45 => "09:45" (limitado a 23:59). */
export function horaFim(horaInicio: string, duracaoMinutos: number): string {
  const [h, m] = horaInicio.split(":").map(Number);
  const total = Math.min(h * 60 + m + Math.max(0, duracaoMinutos), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "09:00:00" -> "09:00" */
export function hhmm(hora?: string | null): string {
  return (hora ?? "").slice(0, 5);
}

export type Agendamento = {
  id: string;
  tarefa_id: string;
  data: string;
  hora_inicio: string;
  duracao_minutos: number;
  observacao?: string | null;
};

export type CapacidadeDia = {
  data: string;
  planejado: number;
  capacidade: number;
  disponivel: number;
  sobrecarga: boolean;
};

/** Soma dos minutos agendados em um dia frente à capacidade configurada. */
export function capacidadeDoDia(
  data: string,
  agendamentos: Agendamento[],
  capacidadeMinutos: number,
): CapacidadeDia {
  const planejado = agendamentos
    .filter((a) => a.data === data)
    .reduce((acc, a) => acc + (Number(a.duracao_minutos) || 0), 0);
  return {
    data,
    planejado,
    capacidade: capacidadeMinutos,
    disponivel: Math.max(0, capacidadeMinutos - planejado),
    sobrecarga: planejado > capacidadeMinutos,
  };
}

/** Total de minutos agendados no conjunto de dias informado. */
export function totalSemana(datas: string[], agendamentos: Agendamento[]): number {
  const set = new Set(datas);
  return agendamentos
    .filter((a) => set.has(a.data))
    .reduce((acc, a) => acc + (Number(a.duracao_minutos) || 0), 0);
}

/** "Estimado 45 min · Real 55 min" (ou null quando faltar algum dos dois). */
export function comparativoTempo(
  estimado?: number | null,
  real?: number | null,
): string | null {
  const e = formatDuracao(estimado);
  const r = formatDuracao(real);
  if (!e && !r) return null;
  if (e && r) return `Estimado ${e} · Real ${r}`;
  return e ? `Estimado ${e}` : `Real ${r}`;
}

/** Rótulo dos dias de execução de uma ação recorrente. */
export function labelDiasSemana(dias?: number[] | null): string | null {
  if (!dias || dias.length === 0) return null;
  const ord = [...new Set(dias)].sort((a, b) => a - b);
  if (ord.length === 7) return "Todos os dias";
  if (ord.length === 5 && ord.every((d) => d <= 5)) return "Seg–Sex (dias úteis)";
  return ord
    .map((d) => DIAS_SEMANA.find((x) => x.valor === d)?.curto)
    .filter(Boolean)
    .join(", ");
}
