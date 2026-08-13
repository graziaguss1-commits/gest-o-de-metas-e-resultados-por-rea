import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RecorrenciaCompromisso = "nenhuma" | "semanal" | "quinzenal" | "mensal";

export type Compromisso = {
  id: string;
  serie_id: string;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  area: string;
  observacao: string | null;
  concluido: boolean;
  recorrencia: RecorrenciaCompromisso;
  recorrencia_fim: string | null;
};

export type NovoCompromisso = Omit<Compromisso, "id" | "serie_id" | "concluido">;

type CompromissoBanco = Omit<Compromisso, "serie_id">;
const KEY = ["compromissos"] as const;
const MARCADOR_RECORRENCIA = /^\[\[recorrencia:(semanal|quinzenal|mensal);fim:(\d{4}-\d{2}-\d{2})\]\]\n?/;

const parseData = (valor: string) => new Date(`${valor}T12:00:00`);
const iso = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

function normalizarRegistro(registro: CompromissoBanco): CompromissoBanco {
  const observacao = registro.observacao ?? "";
  const legado = observacao.match(MARCADOR_RECORRENCIA);
  if (!legado) {
    return {
      ...registro,
      recorrencia: registro.recorrencia ?? "nenhuma",
      recorrencia_fim: registro.recorrencia_fim ?? null,
    };
  }
  return {
    ...registro,
    recorrencia: (registro.recorrencia && registro.recorrencia !== "nenhuma"
      ? registro.recorrencia
      : legado[1]) as RecorrenciaCompromisso,
    recorrencia_fim: registro.recorrencia_fim ?? legado[2],
    observacao: observacao.replace(MARCADOR_RECORRENCIA, "") || null,
  };
}

function proximaOcorrencia(data: Date, recorrencia: RecorrenciaCompromisso) {
  const proxima = new Date(data);
  if (recorrencia === "semanal") proxima.setDate(proxima.getDate() + 7);
  if (recorrencia === "quinzenal") proxima.setDate(proxima.getDate() + 14);
  if (recorrencia === "mensal") {
    const dia = proxima.getDate();
    proxima.setDate(1);
    proxima.setMonth(proxima.getMonth() + 1);
    const ultimoDia = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
    proxima.setDate(Math.min(dia, ultimoDia));
  }
  return proxima;
}

function expandirNaJanela(registrosBrutos: CompromissoBanco[], inicio: string, fim: string): Compromisso[] {
  return registrosBrutos.flatMap((registroBruto) => {
    const registro = normalizarRegistro(registroBruto);
    const recorrencia = registro.recorrencia ?? "nenhuma";
    if (recorrencia === "nenhuma") {
      return registro.data >= inicio && registro.data <= fim
        ? [{ ...registro, recorrencia, serie_id: registro.id }]
        : [];
    }

    const limite = registro.recorrencia_fim && registro.recorrencia_fim < fim ? registro.recorrencia_fim : fim;
    const ocorrencias: Compromisso[] = [];
    let atual = parseData(registro.data);
    while (iso(atual) < inicio) atual = proximaOcorrencia(atual, recorrencia);
    while (iso(atual) <= limite) {
      const data = iso(atual);
      ocorrencias.push({
        ...registro,
        id: `${registro.id}@${data}`,
        serie_id: registro.id,
        data,
        recorrencia,
      });
      atual = proximaOcorrencia(atual, recorrencia);
    }
    return ocorrencias;
  }).sort((a, b) => `${a.data}${a.hora_inicio}`.localeCompare(`${b.data}${b.hora_inicio}`));
}

export function useCompromissos(inicio: string, fim: string) {
  return useQuery({
    queryKey: [...KEY, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compromissos")
        .select("*")
        .lte("data", fim)
        .order("data")
        .order("hora_inicio");
      if (error) throw error;
      return expandirNaJanela((data ?? []) as unknown as CompromissoBanco[], inicio, fim);
    },
  });
}

const bancoSemRecorrencia = (input: NovoCompromisso, criadoPor?: string) => ({
  titulo: input.titulo,
  data: input.data,
  hora_inicio: input.hora_inicio,
  hora_fim: input.hora_fim,
  area: input.area,
  observacao: input.observacao,
  criado_por: criadoPor,
});

export function useCriarCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovoCompromisso) => {
      const { data: user } = await supabase.auth.getUser();
      const criadoPor = user.user?.id;

      if (input.recorrencia === "nenhuma") {
        const { error } = await supabase.from("compromissos").insert(bancoSemRecorrencia(input, criadoPor));
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("compromissos").insert({
        ...input,
        criado_por: criadoPor,
      } as never);
      if (!error) return;

      const schemaDesatualizado =
        error.code === "PGRST204" ||
        error.message.toLowerCase().includes("recorrencia") ||
        error.message.toLowerCase().includes("schema cache");
      if (!schemaDesatualizado) throw error;

      const marcador = `[[recorrencia:${input.recorrencia};fim:${input.recorrencia_fim}]]`;
      const observacao = [marcador, input.observacao].filter(Boolean).join("\n");
      const { error: erroFallback } = await supabase.from("compromissos").insert({
        ...bancoSemRecorrencia(input, criadoPor),
        observacao,
      });
      if (erroFallback) throw erroFallback;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

type AtualizacaoCompromisso = Partial<Omit<Compromisso, "id" | "serie_id">> & { id: string };
export function useAtualizarCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: AtualizacaoCompromisso) => {
      const serieId = id.split("@")[0];
      const { error } = await supabase.from("compromissos").update(values as never).eq("id", serieId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useExcluirCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const serieId = id.split("@")[0];
      const { error } = await supabase.from("compromissos").delete().eq("id", serieId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
