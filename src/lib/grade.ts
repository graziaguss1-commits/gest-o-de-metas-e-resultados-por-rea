import { horarioEmMinutos } from "@/lib/agenda";
import type { BlocoExecucao } from "@/lib/hoje";

/**
 * Altura de uma hora na grade, em pixels.
 *
 * 96px é o número que faz um bloco de 30 min (48px) caber as duas linhas que
 * ele mostra — título e "horário · área" — sem cortar nenhuma. Com menos que
 * isso, quase todo bloco batia na altura mínima e a grade parava de
 * representar a duração real: 20 min e 40 min desenhavam do mesmo tamanho.
 */
export const PX_POR_HORA = 96;
export const PX_POR_MINUTO = PX_POR_HORA / 60;
/**
 * Altura mínima de um bloco fechado. 44px = título (16) + horário (14) +
 * o padding vertical de 12. Abaixo disso, a segunda linha fica cortada ao meio.
 */
export const ALTURA_MINIMA = 44;
/**
 * Quanto tempo um bloco curto ocupa NA TELA, em minutos.
 *
 * Um bloco de 10 min é desenhado com 44px, que é o espaço de ~27 min. Esses
 * minutos a mais existem na tela e precisam entrar na conta de sobreposição,
 * senão o bloco seguinte é desenhado por cima dele.
 */
const MINUTOS_MINIMOS = ALTURA_MINIMA / PX_POR_MINUTO;

type ComHorario = Pick<BlocoExecucao, "id" | "inicio" | "fim">;

export type BlocoPosicionado<T extends ComHorario> = {
  bloco: T;
  /** Distância do topo da grade, em pixels. */
  topo: number;
  /** Altura proporcional à duração, em pixels. */
  altura: number;
  /** Coluna ocupada quando há sobreposição (0 é a primeira). */
  coluna: number;
  /** Quantas colunas o grupo sobreposto tem no total. */
  colunas: number;
};

/**
 * Faixa de horas que a grade desenha: do início do bloco mais cedo ao fim do
 * mais tarde, sempre incluindo a hora atual para a linha do agora aparecer.
 * Sem blocos, mostra o horário comercial.
 */
export function faixaHoras(
  blocos: ComHorario[],
  minutosAgora: number | null = null,
): { primeira: number; ultima: number } {
  if (!blocos.length && minutosAgora == null) return { primeira: 6, ultima: 22 };

  let menor = Number.POSITIVE_INFINITY;
  let maior = Number.NEGATIVE_INFINITY;
  blocos.forEach((b) => {
    menor = Math.min(menor, horarioEmMinutos(b.inicio));
    maior = Math.max(maior, horarioEmMinutos(b.fim));
  });
  if (minutosAgora != null) {
    menor = Math.min(menor, minutosAgora);
    maior = Math.max(maior, minutosAgora);
  }

  const primeira = Math.max(0, Math.floor(menor / 60));
  const ultima = Math.min(24, Math.ceil(maior / 60));
  // Nunca menos de 4 horas visíveis: uma grade de uma hora só não lê como grade.
  if (ultima - primeira < 4) {
    return { primeira, ultima: Math.min(24, primeira + 4) };
  }
  return { primeira, ultima };
}

/**
 * Posiciona os blocos na grade e resolve sobreposições em colunas.
 *
 * Blocos que se cruzam no tempo formam um grupo; dentro do grupo cada bloco
 * entra na primeira coluna livre, e todos do grupo dividem a largura por igual.
 * É a mesma regra do Google Agenda, e é o que faz 21:10 e 21:15 aparecerem
 * lado a lado em vez de um por cima do outro.
 *
 * A sobreposição é medida pelo espaço OCUPADO NA TELA, não pelo horário puro.
 * Duas tarefas de 10 min às 08:30 e às 08:40 não se cruzam no relógio, mas
 * cada uma é desenhada com a altura mínima e invade a faixa da outra. Medindo
 * em pixels, elas vão para colunas vizinhas em vez de empilhar.
 */
export function posicionarBlocos<T extends ComHorario>(
  blocos: T[],
  primeiraHora: number,
): BlocoPosicionado<T>[] {
  const ordenados = [...blocos].sort((a, b) => {
    const diff = horarioEmMinutos(a.inicio) - horarioEmMinutos(b.inicio);
    return diff !== 0 ? diff : horarioEmMinutos(a.fim) - horarioEmMinutos(b.fim);
  });

  const offset = primeiraHora * 60;
  const resultado: BlocoPosicionado<T>[] = [];
  let grupo: BlocoPosicionado<T>[] = [];
  let fimDoGrupo = Number.NEGATIVE_INFINITY;
  let fimPorColuna: number[] = [];

  const fecharGrupo = () => {
    const colunas = fimPorColuna.length || 1;
    grupo.forEach((item) => {
      item.colunas = colunas;
    });
    resultado.push(...grupo);
    grupo = [];
    fimPorColuna = [];
    fimDoGrupo = Number.NEGATIVE_INFINITY;
  };

  ordenados.forEach((bloco) => {
    const inicio = horarioEmMinutos(bloco.inicio);
    const fim = Math.max(horarioEmMinutos(bloco.fim), inicio + 1);
    // Onde o bloco realmente termina na tela.
    const fimVisual = Math.max(fim, inicio + MINUTOS_MINIMOS);

    if (inicio >= fimDoGrupo) fecharGrupo();

    let coluna = fimPorColuna.findIndex((fimDaColuna) => fimDaColuna <= inicio);
    if (coluna === -1) {
      coluna = fimPorColuna.length;
      fimPorColuna.push(fimVisual);
    } else {
      fimPorColuna[coluna] = fimVisual;
    }

    grupo.push({
      bloco,
      topo: (inicio - offset) * PX_POR_MINUTO,
      altura: Math.max(ALTURA_MINIMA, (fim - inicio) * PX_POR_MINUTO),
      coluna,
      colunas: 1,
    });
    fimDoGrupo = Math.max(fimDoGrupo, fimVisual);
  });

  fecharGrupo();
  return resultado;
}

/** Minutos desde a meia-noite, no fuso local. */
export const minutosDoDia = (data: Date) => data.getHours() * 60 + data.getMinutes();

/** Granularidade do arraste: o bloco encaixa de 15 em 15 minutos. */
export const PASSO_ARRASTE = 15;

/**
 * Horário em que o bloco arrastado vai cair, em minutos do dia.
 *
 * O cálculo parte do TOPO do bloco, não do cursor: quem arrasta segura o
 * bloco pelo meio, e usar a posição do cursor jogava o bloco para baixo pela
 * distância entre o topo e o ponto segurado. Por isso `offsetY` é descontado.
 *
 * O resultado encaixa no passo de 15 min e nunca sai da faixa desenhada —
 * um bloco de 2h não pode começar às 21:50 numa grade que termina às 22h.
 */
export function minutosDestino({
  yCursor,
  offsetY,
  primeiraHora,
  ultimaHora,
  duracaoMinutos,
  passo = PASSO_ARRASTE,
}: {
  /** Posição vertical do cursor, relativa ao topo da grade. */
  yCursor: number;
  offsetY: number;
  primeiraHora: number;
  ultimaHora: number;
  duracaoMinutos: number;
  passo?: number;
}): number {
  const bruto = primeiraHora * 60 + (yCursor - offsetY) / PX_POR_MINUTO;
  const encaixado = Math.round(bruto / passo) * passo;
  const maximo = ultimaHora * 60 - duracaoMinutos;
  return Math.min(Math.max(encaixado, primeiraHora * 60), Math.max(primeiraHora * 60, maximo));
}
