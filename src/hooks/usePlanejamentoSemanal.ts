import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  estadoParaRow,
  normalizarEstado,
  rowParaEstado,
  semanaDaChave,
  type PlanejamentoRow,
  type PlanningState,
} from "@/lib/planejamento";

const KEY = ["planejamento-semanal"] as const;
const COLS = "semana_inicio, priority_ids, complementary_ids, foco, wins, pending, lesson, saved_at";
const table = () => supabase.from("planejamento_semanal");

/** Planejamento salvo da semana (null quando não existe). */
export function usePlanejamentoSemanal(semanaInicio: string) {
  return useQuery({
    queryKey: [...KEY, semanaInicio],
    queryFn: async (): Promise<PlanningState | null> => {
      const { data, error } = await table()
        .select(COLS)
        .eq("semana_inicio", semanaInicio)
        .maybeSingle();
      if (error) throw error;
      return data ? rowParaEstado(data as PlanejamentoRow) : null;
    },
  });
}

/** Grava (ou atualiza) o planejamento da semana do usuário logado. */
export function useSalvarPlanejamentoSemanal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ semanaInicio, estado }: { semanaInicio: string; estado: PlanningState }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada — faça login novamente.");
      const { error } = await table().upsert(
        { user_id: uid, ...estadoParaRow(semanaInicio, estado) },
        { onConflict: "user_id,semana_inicio" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, { semanaInicio, estado }) => {
      qc.setQueryData([...KEY, semanaInicio], estado);
    },
  });
}

let migracao: Promise<boolean> | null = null;

/**
 * Sobe para o banco todas as semanas guardadas no localStorage que ainda não
 * têm linha no banco e, após sucesso, remove essas chaves locais.
 */
async function migrarPlanejamentosLocais(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return false;
  const locais = new Map<string, { key: string; estado: PlanningState }>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const semana = key ? semanaDaChave(key) : null;
    if (!key || !semana) continue;
    try {
      locais.set(semana, { key, estado: normalizarEstado(JSON.parse(localStorage.getItem(key) ?? "null")) });
    } catch {
      // Conteúdo inválido não é migrado.
    }
  }
  if (!locais.size) return false;
  const { data: existentes, error } = await table()
    .select("semana_inicio")
    .in("semana_inicio", [...locais.keys()]);
  if (error) throw error;
  const jaNoBanco = new Set((existentes ?? []).map((r) => r.semana_inicio));
  const novos = [...locais.entries()].filter(([semana]) => !jaNoBanco.has(semana));
  if (novos.length) {
    const { error: insErr } = await table().upsert(
      novos.map(([semana, { estado }]) => ({ user_id: uid, ...estadoParaRow(semana, estado) })),
      { onConflict: "user_id,semana_inicio", ignoreDuplicates: true },
    );
    if (insErr) throw insErr;
  }
  novos.forEach(([, { key }]) => localStorage.removeItem(key));
  return novos.length > 0;
}

/** Executa a migração local → banco uma vez por sessão do navegador. */
export function useMigrarPlanejamentoLocal() {
  const qc = useQueryClient();
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    if (!migracao) {
      migracao = migrarPlanejamentosLocais().catch((e) => {
        console.warn("[Planejamento] migração local falhou", e);
        migracao = null;
        return false;
      });
    }
    migracao.then((migrou) => {
      if (migrou) qc.invalidateQueries({ queryKey: KEY });
      setPronto(true);
    });
  }, [qc]);
  return pronto;
}
