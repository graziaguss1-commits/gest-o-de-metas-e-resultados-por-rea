import { horarioEmMinutos } from "@/lib/agenda";
import type { BlocoExecucao } from "@/lib/hoje";

/** Altura de uma hora na grade, em pixels. */
export const PX_POR_HORA = 56;
export const PX_POR_MINUTO = PX_POR_HORA / 60;
/** Altura mínima de um bloco fechado, para o título caber mesmo em bloco de 15 min. */
export const ALTURA_MINIMA = 30;

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

    if (inicio >= fimDoGrupo) fecharGrupo();

    let coluna = fimPorColuna.findIndex((fimDaColuna) => fimDaColuna <= inicio);
    if (coluna === -1) {
      coluna = fimPorColuna.length;
      fimPorColuna.push(fim);
    } else {
      fimPorColuna[coluna] = fim;
    }

    grupo.push({
      bloco,
      topo: (inicio - offset) * PX_POR_MINUTO,
      altura: Math.max(ALTURA_MINIMA, (fim - inicio) * PX_POR_MINUTO),
      coluna,
      colunas: 1,
    });
    fimDoGrupo = Math.max(fimDoGrupo, fim);
  });

  fecharGrupo();
  return resultado;
}

/** Minutos desde a meia-noite, no fuso local. */
export const minutosDoDia = (data: Date) => data.getHours() * 60 + data.getMinutes();
