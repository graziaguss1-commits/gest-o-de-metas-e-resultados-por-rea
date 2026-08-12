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

export const actionScore = (action: Pick<ActionItem, "impacto" | "esforco">) => action.impacto * (11 - action.esforco);
export const actionQuadrant = (action: Pick<ActionItem, "impacto" | "esforco">) => {
  if (action.impacto >= 6 && action.esforco <= 5) return "Fazer primeiro";
  if (action.impacto >= 6 && action.esforco >= 6) return "Planejar";
  if (action.impacto <= 5 && action.esforco <= 5) return "Encaixar";
  return "Reavaliar";
};

const KEY = ["acoes-avulsas"] as const;
const table = () => (supabase as any).from("acoes_avulsas");

export function useActions() {
  return useQuery({ queryKey: KEY, queryFn: async (): Promise<ActionItem[]> => {
    const { data, error } = await table().select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ActionItem[];
  } });
}

export function useCreateAction() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (input: Omit<ActionItem, "id" | "concluida" | "created_at">) => {
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await table().insert({ ...input, criado_por: user.user?.id }).select().single();
    if (error) throw error;
    return data as ActionItem;
  }, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export function useToggleAction() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
    const { error } = await table().update({ concluida }).eq("id", id);
    if (error) throw error;
  }, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
