export type PlanningState = {
  wins: string;
  pending: string;
  lesson: string;
  focus: string;
  /**
   * As ações escolhidas para a semana, numa lista só.
   *
   * Antes eram duas — até 3 "prioridades top" mais as complementares — e isso
   * colidia com a prioridade do dia, que é outra coisa e mora em
   * `prioridade_dia`. Duas listas chamadas "prioridade" na mesma tela faziam
   * uma parecer desmentir a outra. Aqui a semana só diz O QUE entra; QUAL
   * delas se defende em cada dia é decisão do dia.
   */
  acoesIds: string[];
  savedAt?: string;
};

export type PlanejamentoRow = {
  semana_inicio: string;
  priority_ids: string[];
  complementary_ids: string[];
  foco: string;
  wins: string;
  pending: string;
  lesson: string;
  saved_at: string | null;
};

export const emptyPlanningState = (): PlanningState => ({
  wins: "",
  pending: "",
  lesson: "",
  focus: "",
  acoesIds: [],
});

export const LOCAL_PREFIX = "performance-week-";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const ids = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Junta as duas listas antigas numa só, sem repetir id. */
const unir = (...listas: unknown[]): string[] => [
  ...new Set(listas.flatMap((lista) => ids(lista))),
];

/** Normaliza um estado vindo do localStorage (pode estar incompleto). */
export function normalizarEstado(raw: unknown): PlanningState {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    wins: str(o.wins),
    pending: str(o.pending),
    lesson: str(o.lesson),
    focus: str(o.focus),
    // `priorityIds`/`complementaryIds` são o formato antigo: uma semana já
    // planejada não pode perder as escolhas por causa da mudança.
    acoesIds: unir(o.acoesIds, o.priorityIds, o.complementaryIds),
    savedAt: str(o.savedAt) || undefined,
  };
}

export function rowParaEstado(row: PlanejamentoRow): PlanningState {
  return {
    wins: row.wins ?? "",
    pending: row.pending ?? "",
    lesson: row.lesson ?? "",
    focus: row.foco ?? "",
    acoesIds: unir(row.priority_ids, row.complementary_ids),
    savedAt: row.saved_at ?? undefined,
  };
}

export function estadoParaRow(semana: string, s: PlanningState): PlanejamentoRow {
  return {
    semana_inicio: semana,
    // A coluna continua existindo para não precisar de migração e para não
    // apagar o histórico das semanas antigas; o app só não escreve mais nela.
    priority_ids: [],
    complementary_ids: s.acoesIds,
    foco: s.focus,
    wins: s.wins,
    pending: s.pending,
    lesson: s.lesson,
    saved_at: s.savedAt ?? null,
  };
}

/** Semana (segunda-feira) de uma chave local `performance-week-YYYY-MM-DD`; chaves antigas por número de semana são ignoradas. */
export function semanaDaChave(key: string): string | null {
  const m = key.match(/^performance-week-(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getDay() !== 1 || d.getDate() !== Number(m[3])) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
