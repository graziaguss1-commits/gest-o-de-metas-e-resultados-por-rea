export type PlanningState = {
  wins: string;
  pending: string;
  lesson: string;
  focus: string;
  priorityIds: string[];
  complementaryIds: string[];
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
  priorityIds: [],
  complementaryIds: [],
});

export const LOCAL_PREFIX = "performance-week-";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const ids = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Normaliza um estado vindo do localStorage (pode estar incompleto). */
export function normalizarEstado(raw: unknown): PlanningState {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const priorityIds = ids(o.priorityIds).slice(0, 3);
  return {
    wins: str(o.wins),
    pending: str(o.pending),
    lesson: str(o.lesson),
    focus: str(o.focus),
    priorityIds,
    complementaryIds: ids(o.complementaryIds).filter((id) => !priorityIds.includes(id)),
    savedAt: str(o.savedAt) || undefined,
  };
}

export function rowParaEstado(row: PlanejamentoRow): PlanningState {
  return {
    wins: row.wins ?? "",
    pending: row.pending ?? "",
    lesson: row.lesson ?? "",
    focus: row.foco ?? "",
    priorityIds: row.priority_ids ?? [],
    complementaryIds: row.complementary_ids ?? [],
    savedAt: row.saved_at ?? undefined,
  };
}

export function estadoParaRow(semana: string, s: PlanningState): PlanejamentoRow {
  return {
    semana_inicio: semana,
    priority_ids: s.priorityIds,
    complementary_ids: s.complementaryIds,
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
