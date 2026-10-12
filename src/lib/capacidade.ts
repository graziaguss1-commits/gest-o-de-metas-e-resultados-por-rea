/**
 * Folga de 30%: a capacidade PLANEJÁVEL é 70% da capacidade diária.
 *
 * Por que: o dia real não cabe no dia planejado. Demanda da equipe, paciente
 * e imprevisto consomem a diferença. Planejar 100% da capacidade garante que
 * a semana estoure, o que vira bloco não executado e culpa — não informação.
 * Reservando 30%, o que foi planejado tem chance de caber.
 */
export const FATOR_PLANEJAVEL = 0.7;

export const CAPACIDADE_DIARIA_PADRAO = 480;

/** Minutos que podem ser planejados num dia, a partir da capacidade configurada. */
export function capacidadePlanejavel(
  capacidadeDiariaMinutos: number | null | undefined,
): number {
  const base = capacidadeDiariaMinutos ?? CAPACIDADE_DIARIA_PADRAO;
  return Math.round(base * FATOR_PLANEJAVEL);
}
