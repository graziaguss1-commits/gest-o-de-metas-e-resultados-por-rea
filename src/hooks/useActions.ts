import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { agendarSyncGoogle } from "@/lib/googleSync";

export type ActionItem = {
  id: string;
  descricao: string;
  area: string;
  impacto: number;
  esforco: number;
  prazo: string | null;
  concluida: boolean;
  data_agendada: string | null;
  hora_inicio: string | null;
  duracao_minutos: number | null;
  created_at: string;
};

type ActionInput = Omit<
  ActionItem,
  | "id"
  | "concluida"
  | "data_agendada"
  | "hora_inicio"
  | "duracao_minutos"
  | "created_at"
>;

export type ActionScheduleInput = {
  id: string;
  data: string | null;
  horaInicio: string | null;
  duracaoMinutos: number | null;
};

export const actionScore = (action: Pick<ActionItem, "impacto" | "esforco">) =>
  action.impacto * (11 - action.esforco);

export const actionQuadrant = (action: Pick<ActionItem, "impacto" | "esforco">) => {
  if (action.impacto >= 6 && action.esforco <= 5) return "Fazer primeiro";
  if (action.impacto >= 6 && action.esforco >= 6) return "Planejar";
  if (action.impacto <= 5 && action.esforco <= 5) return "Encaixar";
  return "Reavaliar";
};

const KEY = ["acoes-avulsas"] as const;
const STORAGE_KEY = "metasia_acoes_avulsas_contingencia";
const SCHEDULE_STORAGE_KEY = "metasia_agenda_acoes_avulsas_contingencia";
const table = () => (supabase as any).from("acoes_avulsas");

type StoredSchedule = Pick<
  ActionItem,
  "data_agendada" | "hora_inicio" | "duracao_minutos"
>;

const normalizar = (action: Partial<ActionItem> & Pick<ActionItem, "id">): ActionItem => ({
  ...(action as ActionItem),
  data_agendada: action.data_agendada ?? null,
  hora_inicio: action.hora_inicio ?? null,
  duracao_minutos: action.duracao_minutos ?? null,
});

function lerLocais(): ActionItem[] {
  try {
    const actions = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ActionItem[];
    return actions.map(normalizar);
  } catch {
    return [];
  }
}

function salvarLocais(actions: ActionItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

function lerAgendasLocais(): Record<string, StoredSchedule> {
  try {
    return JSON.parse(
      localStorage.getItem(SCHEDULE_STORAGE_KEY) ?? "{}",
    ) as Record<string, StoredSchedule>;
  } catch {
    return {};
  }
}

function salvarAgendasLocais(schedules: Record<string, StoredSchedule>) {
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
}

function aplicarAgendasLocais(
  actions: ActionItem[],
  schedules = lerAgendasLocais(),
): ActionItem[] {
  return actions.map((action) =>
    schedules[action.id] ? { ...action, ...schedules[action.id] } : action,
  );
}

function criarLocal(input: ActionInput): ActionItem {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const action: ActionItem = {
    ...input,
    id: `local-${uuid}`,
    concluida: false,
    data_agendada: null,
    hora_inicio: null,
    duracao_minutos: null,
    created_at: new Date().toISOString(),
  };
  salvarLocais([action, ...lerLocais()]);
  return action;
}

const ordenar = (actions: ActionItem[]) =>
  [...actions].sort((a, b) => b.created_at.localeCompare(a.created_at));

async function sincronizarLocais(remotas: ActionItem[]): Promise<ActionItem[]> {
  const locais = lerLocais();
  if (!locais.length) return remotas;

  const { data: user } = await supabase.auth.getUser();
  const rows = locais.map((action) => ({
    descricao: action.descricao,
    area: action.area,
    impacto: action.impacto,
    esforco: action.esforco,
    prazo: action.prazo,
    concluida: action.concluida,
    data_agendada: action.data_agendada,
    hora_inicio: action.hora_inicio,
    duracao_minutos: action.duracao_minutos,
    criado_por: user.user?.id ?? null,
  }));
  const { data, error } = await table().insert(rows).select("*");
  if (error) return ordenar([...locais, ...remotas]);

  salvarLocais([]);
  return ordenar([
    ...((data ?? []) as ActionItem[]).map(normalizar),
    ...remotas,
  ]);
}

/**
 * Mantém o agendamento funcional no preview mesmo quando o front-end chega
 * antes da migration. Quando as colunas estiverem disponíveis, sincroniza.
 */
async function sincronizarAgendasLocais(actions: ActionItem[]): Promise<ActionItem[]> {
  const schedules = lerAgendasLocais();
  const entries = Object.entries(schedules);
  if (!entries.length) return actions;

  const merged = aplicarAgendasLocais(actions, schedules);
  const restantes = { ...schedules };

  await Promise.all(
    entries.map(async ([id, schedule]) => {
      if (id.startsWith("local-")) return;
      const { error } = await table().update(schedule).eq("id", id);
      if (!error) delete restantes[id];
    }),
  );

  salvarAgendasLocais(restantes);
  return merged;
}

export function useActions() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ActionItem[]> => {
      const { data, error } = await table()
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return aplicarAgendasLocais(ordenar(lerLocais()));
      }

      const actions = await sincronizarLocais(
        ((data ?? []) as ActionItem[]).map(normalizar),
      );
      return sincronizarAgendasLocais(actions);
    },
  });
}

export function useCreateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ActionInput) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await table()
        .insert({ ...input, criado_por: user.user?.id ?? null })
        .select()
        .single();

      if (error) return criarLocal(input);
      return normalizar(data as ActionItem);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useToggleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      if (id.startsWith("local-")) {
        salvarLocais(
          lerLocais().map((action) =>
            action.id === id ? { ...action, concluida } : action,
          ),
        );
        return;
      }

      const { error } = await table().update({ concluida }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useScheduleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      horaInicio,
      duracaoMinutos,
    }: ActionScheduleInput) => {
      const schedule: StoredSchedule = {
        data_agendada: data,
        hora_inicio: horaInicio,
        duracao_minutos: duracaoMinutos,
      };

      if (id.startsWith("local-")) {
        salvarLocais(
          lerLocais().map((action) =>
            action.id === id ? { ...action, ...schedule } : action,
          ),
        );
        return;
      }

      const { error } = await table().update(schedule).eq("id", id);
      const schedules = lerAgendasLocais();
      if (error) schedules[id] = schedule;
      else delete schedules[id];
      salvarAgendasLocais(schedules);
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
