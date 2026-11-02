import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { agendarSyncGoogle } from "@/lib/googleSync";
import { planejarEdicaoDeSerie } from "@/lib/edicaoDeSerie";

import { proximaOcorrencia } from "../../supabase/functions/_shared/recorrencia";

export type RecorrenciaCompromisso =
  | "nenhuma"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "mensal_dia_semana";

export type Compromisso = {
  id: string;
  serie_id: string;
  /**
   * A data que identifica esta ocorrencia na tabela de excecoes.
   *
   * Nao e a mesma coisa que `data`: remarcar uma ocorrencia muda `data`, mas
   * a chave continua sendo a original. Sem guardar as duas, marcar como
   * feita uma ocorrencia remarcada gravaria na linha errada.
   */
  data_original: string;
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

export type NovoCompromisso = Omit<
  Compromisso,
  "id" | "serie_id" | "concluido" | "data_original"
>;

type CompromissoBanco = Omit<Compromisso, "serie_id" | "data_original">;
type CompromissoOcorrencia = {
  compromisso_id: string;
  data_original: string;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  cancelado: boolean;
  concluido: boolean;
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

export function expandirNaJanela(
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
        data_original: registro.data,
        data,
        hora_inicio: alteracao?.hora_inicio ?? registro.hora_inicio,
        hora_fim: alteracao?.hora_fim ?? registro.hora_fim,
        concluido: alteracao?.concluido ?? registro.concluido,
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
          data_original: dataOriginal,
          data,
          hora_inicio: alteracao?.hora_inicio ?? registro.hora_inicio,
          hora_fim: alteracao?.hora_fim ?? registro.hora_fim,
          recorrencia,
          // Nunca herda o `concluido` da serie: era isso que riscava a
          // reuniao de todas as semanas quando uma era marcada como feita.
          concluido: alteracao?.concluido ?? false,
        });
      }
      atual = proximaOcorrencia(atual, recorrencia, parseData(registro.data));
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
          .select("compromisso_id,data_original,data,hora_inicio,hora_fim,cancelado,concluido"),
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

export type ChaveOcorrencia = Pick<Compromisso, "serie_id" | "data_original">;

/**
 * Remarca o compromisso DESTE dia em diante, sem tocar no que já passou.
 *
 * Mudar a linha da série mudaria todas as ocorrências, inclusive as
 * antigas: a aula das 15h de duas semanas atrás viraria 16h no histórico.
 * Por isso a série é dividida — a antiga guarda o passado, uma nova começa
 * no corte com o horário novo. `planejarEdicaoDeSerie` decide se há corte;
 * aqui só se executa o que ela decidiu.
 */
export function useRemarcarDaquiEmDiante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      compromisso,
      data,
      hora_inicio,
      hora_fim,
      hoje,
    }: {
      compromisso: ChaveOcorrencia;
      data: string;
      hora_inicio: string;
      hora_fim: string;
      hoje: string;
    }) => {
      const serieId = compromisso.serie_id;
      const novosValores = { data, hora_inicio, hora_fim };

      if (serieId.startsWith("local-")) {
        salvarLocais(
          lerLocais().map((item) =>
            item.id === serieId
              ? ({ ...item, ...novosValores } as CompromissoBanco)
              : item,
          ),
        );
        return { dividiu: false };
      }

      // A serie e lida do banco, e nao do objeto expandido: e o registro que
      // diz onde ela nasce e ate quando vai, e e isso que decide se ha
      // passado a preservar.
      const { data: atual, error: erroLeitura } = await supabase
        .from("compromissos")
        .select("*")
        .eq("id", serieId)
        .maybeSingle();
      if (erroLeitura) throw erroLeitura;
      if (!atual) throw new Error("Compromisso nao encontrado.");
      const base = atual as unknown as CompromissoBanco;

      const atualizarTudo = async () => {
        const { error } = await supabase
          .from("compromissos")
          .update(novosValores as never)
          .eq("id", serieId);
        if (error) throw error;
        return { dividiu: false };
      };

      const plano = planejarEdicaoDeSerie(
        {
          id: serieId,
          data: base.data,
          recorrencia: base.recorrencia ?? "nenhuma",
          recorrencia_fim: base.recorrencia_fim ?? null,
        },
        {
          dataOriginal: compromisso.data_original,
          hoje,
          ...novosValores,
        },
      );
      if (plano.tipo === "atualizar_serie") return atualizarTudo();

      const { data: user } = await supabase.auth.getUser();
      // A nova serie nasce ANTES de a antiga ser cortada: se a criacao
      // falhar, as ocorrencias futuras continuam na antiga em vez de sumirem
      // da agenda.
      const { error: erroInsert } = await supabase.from("compromissos").insert({
        titulo: base.titulo,
        area: base.area,
        observacao: base.observacao,
        recorrencia: base.recorrencia,
        recorrencia_fim: base.recorrencia_fim,
        criado_por: user.user?.id ?? null,
        ...novosValores,
      } as never);
      if (erroInsert) throw erroInsert;

      const { error: erroCorte } = await supabase
        .from("compromissos")
        .update({ recorrencia_fim: plano.fimDaAntiga } as never)
        .eq("id", serieId);
      if (erroCorte) throw erroCorte;
      return { dividiu: true };
    },
    onSuccess: () => {
      agendarSyncGoogle();
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/**
 * A chave da ocorrência a partir do id expandido.
 *
 * Série recorrente usa `serie@data-original`; compromisso único usa o id da
 * série sozinho, e aí a data original é a própria data do bloco. Telas que
 * só carregam o id (a agenda de Hoje) passam por aqui em vez de repetir o
 * `split("@")` — foi o tipo de detalhe que já gravou na linha errada.
 */
export const chaveDaOcorrencia = (
  origemId: string,
  data: string,
): ChaveOcorrencia => {
  const [serie, dataOriginal] = origemId.split("@");
  return { serie_id: serie, data_original: dataOriginal ?? data };
};

/**
 * Marca ou desmarca UMA ocorrência como feita.
 *
 * Antes isso ia para `compromissos.concluido`, que é campo da série: marcar
 * a reunião de segunda riscava todas as reuniões, de agosto a novembro.
 * Agora grava na tabela de exceções, a mesma que já guarda remarcação e
 * cancelamento por dia.
 */
export function useConcluirOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      compromisso,
      concluido,
    }: {
      compromisso: ChaveOcorrencia;
      concluido: boolean;
    }) => {
      if (compromisso.serie_id.startsWith("local-")) {
        salvarLocais(
          lerLocais().map((item) =>
            item.id === compromisso.serie_id
              ? ({ ...item, concluido } as CompromissoBanco)
              : item,
          ),
        );
        return;
      }
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) throw new Error("Sessão expirada — faça login novamente.");
      const { error } = await supabase
        .from("compromisso_ocorrencias")
        .upsert(
          {
            user_id: uid,
            compromisso_id: compromisso.serie_id,
            data_original: compromisso.data_original,
            concluido,
          },
          // A unicidade no banco inclui o user_id; omitir a coluna aqui faria
          // o upsert procurar um índice que não existe e virar insert duplicado.
          { onConflict: "user_id,compromisso_id,data_original" },
        );
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
