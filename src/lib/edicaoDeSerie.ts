export type EdicaoSolicitada = {
  /** Data da ocorrência que ela abriu para editar. */
  dataOriginal: string;
  /** O primeiro dia que ainda pode mudar. */
  hoje: string;
  /** Novos valores escolhidos no formulário. */
  data: string;
  hora_inicio: string;
  hora_fim: string;
};

export type SerieExistente = {
  id: string;
  data: string;
  recorrencia: string;
  recorrencia_fim: string | null;
};

export type PlanoDeEdicao =
  | { tipo: "atualizar_serie" }
  | {
      tipo: "dividir_serie";
      /** A série antiga para de gerar ocorrências neste dia (inclusive). */
      fimDaAntiga: string;
    };

const diaAnterior = (iso: string) => {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const maior = (a: string, b: string) => (a > b ? a : b);

/**
 * O que fazer quando ela edita o horário de um compromisso que se repete.
 *
 * Mudar a linha da série muda TODAS as ocorrências, inclusive as que já
 * aconteceram — a aula das 15h de duas semanas atrás viraria 16h no
 * histórico, como se sempre tivesse sido assim. O que ela pediu é o
 * contrário: o passado fica como foi.
 *
 * Então a série é DIVIDIDA. A antiga para de gerar no dia anterior ao corte
 * e guarda o passado intacto; uma nova série começa no corte com o horário
 * novo e herda recorrência e data-limite.
 *
 * O corte nunca é anterior a hoje: abrir uma ocorrência antiga para corrigir
 * o horário não pode reescrever as outras antigas junto.
 *
 * Sem passado para proteger — compromisso único, ou a edição caindo na
 * primeira ocorrência — não há o que dividir: a série é atualizada direto,
 * sem deixar um fragmento vazio para trás.
 */
export function planejarEdicaoDeSerie(
  serie: SerieExistente,
  edicao: EdicaoSolicitada,
): PlanoDeEdicao {
  if (serie.recorrencia === "nenhuma") return { tipo: "atualizar_serie" };

  const corte = maior(edicao.dataOriginal, edicao.hoje);
  if (corte <= serie.data) return { tipo: "atualizar_serie" };

  return { tipo: "dividir_serie", fimDaAntiga: diaAnterior(corte) };
}
