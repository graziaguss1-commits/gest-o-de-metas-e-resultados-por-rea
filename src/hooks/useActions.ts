import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActionItem = {
  id: string;
  descricao: string;
  area: string;
  impacto: number;
  esforco: number;
  prazo: string | null;
  concluida: boolean;
  created_at: string;
};

type ActionInput = Omit<ActionItem, "id" | "concluida" | "created_at">;

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
const table = () => (supabase as any).from("acoes_avulsas");

function lerLocais(): ActionItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ActionItem[];
  } catch {
    return [];
  }
}

function salvarLocais(actions: ActionItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

function criarLocal(input: ActionInput): ActionItem {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const action: ActionItem = {
    ...input,
    id: `local-${uuid}`,
    concluida: false,
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
    criado_por: user.user?.id ?? null,
  }));
  const { data, error } = await table().insert(rows).select("*");
  if (error) return ordenar([...locais, ...remotas]);

  salvarLocais([]);
  return ordenar([...(data ?? []) as ActionItem[], ...remotas]);
}

export function useActions() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ActionItem[]> => {
      const { data, error } = await table()
        .select("*")
        .order("created_at", { ascending: false });

      // O preview pode receber o front-end antes da migração do banco.
      // Nesse intervalo, a matriz continua funcional neste dispositivo.
      if (error) return ordenar(lerLocais());

      return sincronizarLocais((data ?? []) as ActionItem[]);
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
      return data as ActionItem;
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
          lerLocais().map((action) => action.id === id ? { ...action, concluida } : action),
        );
        return;
      }

      const { error } = await table().update({ concluida }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
