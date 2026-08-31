import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { agendarSyncGoogle } from "@/lib/googleSync";

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
type CompromissoOcorrencia = {
  compromisso_id: string;
  data_original: string;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  cancelado: boolean;
};
const KEY = ["compromissos"] as const;
const STORAGE_KEY = "metasia_compromissos_contingencia";

function lerLocais(): CompromissoBanco[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as CompromissoBanco[];
  } catch {
    return [];
  }
}

function salvarLocais(registros: CompromissoBanco[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
}

function salvarLocal(input: NovoCompromisso) {
  const agora = new Date().toISOString();
  const registro = {
    ...input,
    id: `local-${crypto.randomUUID()}`,
    concluido: false,
    created_at: agora,
    updated_at: agora,
  } as CompromissoBanco;
  salvarLocais([...lerLocais(), registro]);
  return registro;
}
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

function expandirNaJanela(
  registrosBrutos: CompromissoBanco[],
  inicio: string,
  fim: string,
  alteracoes: CompromissoOcorrencia[],
): Compromisso[] {
  const alteracaoPorChave = new Map(
    alteracoes.map((item) => [`${item.compromisso_id}|${item.data_original}`, item]),
  );
  return registrosBrutos.flatMap((registroBruto) => {
    const registro = normalizarRegistro(registroBruto);
    const recorrencia = registro.recorrencia ?? "nenhuma";
    if (recorrencia === "nenhuma") {
      const alteracao = alteracaoPorChave.get(`${registro.id}|${registro.data}`);
      if (alteracao?.cancelado) return [];
      const data = alteracao?.data ?? registro.data;
      if (data < inicio || data > fim) return [];
      return [{
        ...registro,
        recorrencia,
        serie_id: registro.id,
        data,
        hora_inicio: alteracao?.hora_inicio ?? registro.hora_inicio,
        hora_fim: alteracao?.hora_fim ?? registro.hora_fim,
      }];
    }

    const originaisMovidosParaJanela = alteracoes
      .filter((item) => item.compromisso_id === registro.id && !item.cancelado && item.data && item.data >= inicio && item.data <= fim)
      .map((item) => item.data_original);
    const limiteDaSerie = registro.recorrencia_fim ?? fim;
    const limiteAlteracoes = [fim, ...originaisMovidosParaJanela].sort().slice(-1)[0];
    const limite = limiteAlteracoes < limiteDaSerie ? limiteAlteracoes : limiteDaSerie;
    const ocorrencias: Compromisso[] = [];
    let atual = parseData(registro.data);
    while (iso(atual) <= limite) {
      const dataOriginal = iso(atual);
      const alteracao = alteracaoPorChave.get(`${registro.id}|${dataOriginal}`);
      const data = alteracao?.data ?? dataOriginal;
      if (!alteracao?.cancelado && data >= inicio && data <= fim) {
        ocorrencias.push({
          ...registro,
          id: `${registro.id}@${dataOriginal}`,
          serie_id: registro.id,
          data,
          hora_inicio: alteracao?.hora_inicio ?? registro.hora_inicio,
          hora_fim: alteracao?.hora_fim ?? registro.hora_fim,
          recorrencia,
        });
      }
      atual = proximaOcorrencia(atual, recorrencia);
    }
    return ocorrencias;
  }).sort((a, b) => `${a.data}${a.hora_inicio}`.localeCompare(`${b.data}${b.hora_inicio}`));
}

export function useCompromissos(inicio: string, fim: string) {
  return useQuery({
    queryKey: [...KEY, inicio, fim],
    queryFn: async () => {
      const [{ data, error }, { data: alteracoes }] = await Promise.all([
        supabase
        .from("compromissos")
        .select("*")
        .order("data")
        .order("hora_inicio"),
        // A migration desta entrega adiciona a tabela antes do deploy do front-end.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("compromisso_ocorrencias")
          .select("compromisso_id,data_original,data,hora_inicio,hora_fim,cancelado"),
      ]);
      const remotos = error ? [] : (data ?? []) as unknown as CompromissoBanco[];
      return expandirNaJanela(
        [...remotos, ...lerLocais()],
        inicio,
        fim,
        (alteracoes ?? []) as CompromissoOcorrencia[],
      );
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
      const payload = input.recorrencia === "nenhuma"
        ? bancoSemRecorrencia(input, criadoPor)
        : { ...input, criado_por: criadoPor };

      const { error } = await supabase.from("compromissos").insert(payload as never);
      if (!error) return { armazenamento: "banco" as const };

      // Contingência: o deploy do front-end pode chegar antes da migração do banco.
      // O compromisso continua funcional neste dispositivo e não bloqueia a agenda.
      salvarLocal(input);
      return { armazenamento: "local" as const };
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

type AtualizacaoCompromisso = Partial<Omit<Compromisso, "id" | "serie_id">> & { id: string };
export function useAtualizarCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: AtualizacaoCompromisso) => {
      const serieId = id.split("@")[0];
      if (serieId.startsWith("local-")) {
        salvarLocais(lerLocais().map((item) => item.id === serieId ? { ...item, ...values } as CompromissoBanco : item));
        return;
      }
      const { error } = await supabase.from("compromissos").update(values as never).eq("id", serieId);
      if (error) throw error;
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useExcluirCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const serieId = id.split("@")[0];
      if (serieId.startsWith("local-")) {
        salvarLocais(lerLocais().filter((item) => item.id !== serieId));
        return;
      }
      const { error } = await supabase.from("compromissos").delete().eq("id", serieId);
      if (error) throw error;
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
