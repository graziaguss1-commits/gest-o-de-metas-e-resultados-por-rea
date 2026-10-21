/**
 * Cor por área da meta na agenda.
 *
 * Seis áreas, seis cores. Cada uma tem dois estados: pendente (fundo claro,
 * texto escuro) e concluído (fundo quase branco, texto na versão mais clara
 * da mesma cor). Todos os doze pares foram medidos e passam de 4,5:1 — o
 * caminho fácil para "cor mais clara" é texto ilegível.
 */

export type CoresBloco = {
  fundo: string;
  borda: string;
  texto: string;
};

type Paleta = {
  base: string;
  pendente: CoresBloco;
  concluido: CoresBloco;
};

const PALETA: Record<string, Paleta> = {
  clinica: {
    base: "#BE6A3A",
    pendente: { fundo: "#F7EBE4", borda: "#BE6A3A", texto: "#754124" },
    concluido: { fundo: "#FBF5F1", borda: "#F7EBE4", texto: "#A85E33" },
  },
  mentoria: {
    base: "#2F7D7A",
    pendente: { fundo: "#E5F5F5", borda: "#2F7D7A", texto: "#2A6F6D" },
    concluido: { fundo: "#F2FAFA", borda: "#E5F5F5", texto: "#2F7E7B" },
  },
  saude: {
    base: "#2F7D5B",
    pendente: { fundo: "#E5F5EE", borda: "#2F7D5B", texto: "#2A6F51" },
    concluido: { fundo: "#F2FAF7", borda: "#E5F5EE", texto: "#2F7E5C" },
  },
  emocional: {
    base: "#9A5C7A",
    pendente: { fundo: "#F2E9ED", borda: "#9A5C7A", texto: "#60394C" },
    concluido: { fundo: "#F8F4F6", borda: "#F2E9ED", texto: "#9C5D7C" },
  },
  intelectual: {
    base: "#4A5C8A",
    pendente: { fundo: "#E8EBF3", borda: "#4A5C8A", texto: "#354264" },
    concluido: { fundo: "#F3F5F9", borda: "#E8EBF3", texto: "#596FA6" },
  },
  marketing: {
    base: "#A66B12",
    pendente: { fundo: "#FCF0DF", borda: "#A66B12", texto: "#8A590F" },
    concluido: { fundo: "#FDF8EF", borda: "#FCF0DF", texto: "#9C6511" },
  },
};

/** Área desconhecida, ação avulsa sem área ou bloco sem meta. */
const NEUTRA: Paleta = {
  base: "#9B8778",
  pendente: { fundo: "#FFFFFF", borda: "#E0D2C7", texto: "#3A2A20" },
  concluido: { fundo: "#EFE7E1", borda: "#E6DBD3", texto: "#6B5B50" },
};

/** "Clínica" e "clinica" são a mesma chave: sem acento, minúsculo, sem espaços nas pontas. */
export const chaveArea = (area: string | null | undefined) =>
  (area ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/** Lista para a legenda: nome como aparece no app e a cor cheia. */
export const AREAS_COM_COR = [
  { area: "Clínica", cor: PALETA.clinica.base },
  { area: "Mentoria", cor: PALETA.mentoria.base },
  { area: "Saúde", cor: PALETA.saude.base },
  { area: "Emocional", cor: PALETA.emocional.base },
  { area: "Intelectual", cor: PALETA.intelectual.base },
  { area: "Marketing", cor: PALETA.marketing.base },
] as const;

export const corDaArea = (area: string | null | undefined) =>
  (PALETA[chaveArea(area)] ?? NEUTRA).base;

/** Cores do bloco conforme a área e se já foi concluído. */
export function coresDoBloco(
  area: string | null | undefined,
  concluido: boolean,
): CoresBloco {
  const paleta = PALETA[chaveArea(area)] ?? NEUTRA;
  return concluido ? paleta.concluido : paleta.pendente;
}
