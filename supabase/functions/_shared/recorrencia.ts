// Regras de repeticao de compromisso, puras e sem dependencia nenhuma.
//
// Mora em _shared porque sao usadas nos DOIS lados: a agenda do app expande as
// ocorrencias na tela e a funcao whatsapp-agenda expande de novo no servidor
// para saber o que mandar. Duas copias dessa conta divergiriam no primeiro mes
// de 31 dias, e o sintoma seria o pior possivel: a tela mostra o compromisso e
// o WhatsApp nao avisa, ou o contrario.

export type Recorrencia = "nenhuma" | "semanal" | "quinzenal" | "mensal" | "mensal_dia_semana";

const ultimoDiaDoMes = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate();

/**
 * Qual ocorrencia daquele dia da semana a data e dentro do mes, de 1 a 5, e
 * se ela e a ULTIMA do mes.
 *
 * As duas respostas importam. "Terceira terca" e posicao fixa; "ultima sexta"
 * muda de numero conforme o mes tem 4 ou 5 sextas. Quem guarda so o numero
 * erra em fevereiro; quem guarda so "ultima" nao sabe expressar "segunda
 * quarta-feira".
 */
export function posicaoNoMes(data: Date): { ordinal: number; ultima: boolean } {
  const dia = data.getDate();
  return {
    ordinal: Math.ceil(dia / 7),
    ultima: dia + 7 > ultimoDiaDoMes(data.getFullYear(), data.getMonth()),
  };
}

/**
 * A data da N-esima ocorrencia de um dia da semana num mes.
 * `ultima` manda pegar a ultima do mes, independentemente do numero.
 */
export function diaDaSemanaNoMes(
  ano: number,
  mes: number,
  diaSemana: number,
  ordinal: number,
  ultima: boolean,
): Date {
  if (ultima) {
    const fim = new Date(ano, mes, ultimoDiaDoMes(ano, mes));
    fim.setDate(fim.getDate() - ((fim.getDay() - diaSemana + 7) % 7));
    return fim;
  }
  const primeiro = new Date(ano, mes, 1);
  const deslocamento = (diaSemana - primeiro.getDay() + 7) % 7;
  const dia = 1 + deslocamento + (ordinal - 1) * 7;
  // Mes sem a 5a ocorrencia cai na 4a, em vez de vazar para o mes seguinte.
  return dia <= ultimoDiaDoMes(ano, mes)
    ? new Date(ano, mes, dia)
    : new Date(ano, mes, dia - 7);
}

/**
 * Proxima ocorrencia depois de `data`.
 *
 * `referencia` e a data da PRIMEIRA ocorrencia da serie: e dela que saem o dia
 * da semana e a posicao no mes. Sem isso, "ultima sexta" viraria "quarta
 * sexta" no primeiro mes de 4 sextas e nunca mais voltaria.
 */
export function proximaOcorrencia(
  data: Date,
  recorrencia: Recorrencia,
  referencia: Date = data,
): Date {
  const proxima = new Date(data);

  if (recorrencia === "semanal") {
    proxima.setDate(proxima.getDate() + 7);
    return proxima;
  }
  if (recorrencia === "quinzenal") {
    proxima.setDate(proxima.getDate() + 14);
    return proxima;
  }
  if (recorrencia === "mensal") {
    const dia = referencia.getDate();
    proxima.setDate(1);
    proxima.setMonth(proxima.getMonth() + 1);
    proxima.setDate(Math.min(dia, ultimoDiaDoMes(proxima.getFullYear(), proxima.getMonth())));
    return proxima;
  }
  if (recorrencia === "mensal_dia_semana") {
    const { ordinal, ultima } = posicaoNoMes(referencia);
    proxima.setDate(1);
    proxima.setMonth(proxima.getMonth() + 1);
    return diaDaSemanaNoMes(
      proxima.getFullYear(),
      proxima.getMonth(),
      referencia.getDay(),
      ordinal,
      ultima,
    );
  }
  return proxima;
}

const DIAS = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const ORDINAIS = ["", "primeira", "segunda", "terceira", "quarta", "quinta"];

/** Como a regra se le na tela: "na última sexta-feira", "na segunda terça-feira". */
export function rotuloMensalPorSemana(data: Date): string {
  const { ordinal, ultima } = posicaoNoMes(data);
  const dia = DIAS[data.getDay()];
  if (ultima) return `na última ${dia}`;
  return `na ${ORDINAIS[ordinal] ?? ordinal + "ª"} ${dia}`;
}
