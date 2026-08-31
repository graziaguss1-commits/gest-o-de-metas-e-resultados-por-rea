import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Agendamento } from "@/lib/agenda";
import type { Tarefa } from "@/lib/metas";
import { agendarSyncGoogle } from "@/lib/googleSync";
import {
  configuracaoRecorrenciaCompleta,
  dataCorrespondeRecorrencia,
  diasRecorrenciaPersistida,
  hhmm,
  segundosDoCronometro,
} from "@/lib/agenda";

const KEY = ["agendamentos"] as const;
export const OBSERVACAO_OCORRENCIA_CANCELADA = "Ocorrência cancelada";
export const OBSERVACAO_OCORRENCIA_DUPLICADA_ARQUIVADA =
  "Ocorrência duplicada arquivada";

/**
 * Ocorrências agendadas. Buscamos apenas a janela visível (semana atual +
 * margem), evitando materializar recorrências infinitas.
 */
export function useAgendamentos(inicio?: string, fim?: string) {
  return useQuery({
    queryKey: [...KEY, inicio ?? "all", fim ?? "all"],
    queryFn: async (): Promise<Agendamento[]> => {
      let query = supabase
        .from("tarefa_agendamentos")
        .select(
          "id, tarefa_id, data, hora_inicio, duracao_minutos, observacao, cronometro_iniciado_em, cronometro_segundos, cronometro_usuario_id",
        )
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (inicio) query = query.gte("data", inicio);
      if (fim) query = query.lte("data", fim);
      const { data, error } = await query;
      if (error) throw error;
      const visiveis = ((data ?? []) as Agendamento[]).filter(
        (item) =>
          item.observacao !== OBSERVACAO_OCORRENCIA_CANCELADA &&
          !item.observacao?.startsWith(
            OBSERVACAO_OCORRENCIA_DUPLICADA_ARQUIVADA,
          ),
      );
      const unicos = new Map<string, Agendamento>();
      visiveis.forEach((item) => {
        const chave = `${item.tarefa_id}|${item.data}|${hhmm(item.hora_inicio)}`;
        const existente = unicos.get(chave);
        const pontuacao =
          (item.cronometro_iniciado_em ? 1_000_000_000 : 0) +
          Number(item.cronometro_segundos ?? 0);
        const pontuacaoExistente = existente
          ? (existente.cronometro_iniciado_em ? 1_000_000_000 : 0) +
            Number(existente.cronometro_segundos ?? 0)
          : -1;
        if (!existente || pontuacao > pontuacaoExistente) {
          unicos.set(chave, item);
        }
      });
      return [...unicos.values()];
    },
  });
}

/** Inicia, pausa ou continua o cronômetro persistente de uma ocorrência. */
export function useAlternarCronometroAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agendamento: Agendamento) => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) throw new Error("Sessão expirada — faça login novamente.");

      if (agendamento.cronometro_iniciado_em) {
        const segundos = segundosDoCronometro(agendamento);
        const { error } = await supabase
          .from("tarefa_agendamentos")
          .update({
            cronometro_iniciado_em: null,
            cronometro_segundos: segundos,
          })
          .eq("id", agendamento.id);
        if (error) throw error;
        return { ativo: false, segundos };
      }

      const { data: ativos, error: ativosError } = await supabase
        .from("tarefa_agendamentos")
        .select("id")
        .eq("cronometro_usuario_id", uid)
        .not("cronometro_iniciado_em", "is", null)
        .neq("id", agendamento.id)
        .limit(1);
      if (ativosError) throw ativosError;
      if (ativos?.length) {
        throw new Error(
          "Você já tem outra tarefa em andamento. Pause-a antes de iniciar esta.",
        );
      }

      const { error } = await supabase
        .from("tarefa_agendamentos")
        .update({
          cronometro_iniciado_em: new Date().toISOString(),
          cronometro_usuario_id: uid,
        })
        .eq("id", agendamento.id);
      if (error?.code === "23505") {
        throw new Error(
          "Você já tem outra tarefa em andamento. Pause-a antes de iniciar esta.",
        );
      }
      if (error) throw error;
      return {
        ativo: true,
        segundos: Number(agendamento.cronometro_segundos ?? 0),
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Consolida a sessão ativa antes de registrar a execução como concluída. */
export function useFinalizarCronometroAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      segundos,
    }: {
      id: string;
      segundos: number;
    }) => {
      const { error } = await supabase
        .from("tarefa_agendamentos")
        .update({
          cronometro_iniciado_em: null,
          cronometro_segundos: Math.max(0, Math.floor(segundos)),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type AgendarInput = {
  tarefaId: string;
  data: string;
  horaInicio: string;
  duracaoMinutos: number;
  observacao?: string | null;
};

export function useAgendarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AgendarInput) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("tarefa_agendamentos").insert({
        tarefa_id: input.tarefaId,
        data: input.data,
        hora_inicio: input.horaInicio,
        duracao_minutos: input.duracaoMinutos,
        observacao: input.observacao?.trim() || null,
        criado_por: user.user?.id ?? null,
      });
      if (error?.code === "23505") {
        throw new Error("Esta ação já está agendada nesse dia e horário.");
      }
      if (error) throw error;
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useReagendarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      horaInicio,
      duracaoMinutos,
    }: {
      id: string;
      data: string;
      horaInicio: string;
      duracaoMinutos: number;
    }) => {
      const { error } = await supabase
        .from("tarefa_agendamentos")
        .update({
          data,
          hora_inicio: horaInicio,
          duracao_minutos: duracaoMinutos,
        })
        .eq("id", id);
      if (error?.code === "23505") {
        throw new Error("Esta ação já está agendada nesse dia e horário.");
      }
      if (error) throw error;
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useRemoverAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tarefa_agendamentos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/**
 * Mantém uma exceção invisível para que a recorrência não seja recriada ao
 * atualizar a página ou materializar novamente a semana.
 */
export function useCancelarOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tarefa_agendamentos")
        .update({ observacao: OBSERVACAO_OCORRENCIA_CANCELADA })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/**
 * Cria somente as ocorrências recorrentes que faltam na semana visível.
 * Nunca materializa recorrência infinita e ignora dias passados na semana atual.
 */
export function useMaterializarRecorrencias() {
  const qc = useQueryClient();
  return useMutation({
    scope: { id: "materializar-recorrencias" },
    mutationFn: async ({
      tarefas,
      datas,
    }: {
      tarefas: Tarefa[];
      datas: string[];
    }) => {
      if (!datas.length) return 0;
      const inicio = datas[0],
        fim = datas[datas.length - 1];
      const ids = tarefas.map((t) => t.id);
      if (!ids.length) return 0;
      const { data: existentes, error: readError } = await supabase
        .from("tarefa_agendamentos")
        .select("tarefa_id,data")
        .in("tarefa_id", ids)
        .gte("data", inicio)
        .lte("data", fim);
      if (readError) throw readError;
      const chaves = new Set(
        (existentes ?? []).map((a) => `${a.tarefa_id}|${a.data}`),
      );
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: user } = await supabase.auth.getUser();
      const rows = tarefas.flatMap((t) => {
        const dias = diasRecorrenciaPersistida(t.frequencia, t.dias_semana);
        if (
          !configuracaoRecorrenciaCompleta(
            t.frequencia,
            t.duracao_minutos,
            t.horario_preferencial,
            dias,
          )
        ) {
          return [];
        }

        return datas
          .filter((data) => {
            if (
              data < hoje ||
              (t.data_inicio && data < t.data_inicio) ||
              (t.data_fim && data > t.data_fim)
            ) {
              return false;
            }

            const date = new Date(`${data}T12:00:00`);
            return (
              dataCorrespondeRecorrencia(t.frequencia, date, dias) &&
              !chaves.has(`${t.id}|${data}`)
            );
          })
          .map((data) => ({
            tarefa_id: t.id,
            data,
            hora_inicio: t.horario_preferencial!,
            duracao_minutos: t.duracao_minutos!,
            criado_por: user.user?.id ?? null,
            observacao: "Gerado pela recorrência",
          }));
      });
      if (!rows.length) return 0;
      const { error } = await supabase.from("tarefa_agendamentos").insert(rows);
      if (!error) return rows.length;
      if (error.code !== "23505") throw error;

      // Outra aba pode ter materializado parte da mesma janela entre a leitura
      // e a gravação. Nesse caso, tentamos cada ocorrência separadamente: as
      // que já existem são ignoradas e as demais continuam sendo criadas.
      let criadas = 0;
      for (const row of rows) {
        const { error: rowError } = await supabase
          .from("tarefa_agendamentos")
          .insert(row);
        if (!rowError) {
          criadas += 1;
        } else if (rowError.code !== "23505") {
          throw rowError;
        }
      }
      return criadas;
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
