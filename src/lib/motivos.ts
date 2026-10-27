import { fimDoBloco, referenciaBloco, type BlocoComOrigem, type BlocoExecucao } from "@/lib/hoje";

export const MOTIVOS = [
  { id: "demanda_equipe", label: "Demanda da equipe" },
  { id: "paciente", label: "Paciente" },
  { id: "sem_clareza", label: "Não tinha clareza" },
  { id: "cansaco", label: "Cansaço" },
  { id: "adiei", label: "Adiei" },
  { id: "outro", label: "Outro" },
] as const;

export type MotivoId = (typeof MOTIVOS)[number]["id"];

/**
 * "Outro" só existe com a descrição escrita: sem texto ele não explica nada,
 * e o banco rejeita (constraint bloco_motivos_outro_com_texto).
 */
export const MOTIVO_EXIGE_TEXTO: MotivoId = "outro";
export const exigeTexto = (motivo: MotivoId) => motivo === MOTIVO_EXIGE_TEXTO;
export const MOTIVO_LABEL: Record<MotivoId, string> = Object.fromEntries(
  MOTIVOS.map((m) => [m.id, m.label]),
) as Record<MotivoId, string>;

// A referência do bloco mudou de casa para lib/hoje, junto do tipo do bloco:
// ela identifica o bloco, e motivo de falta e prioridade do dia são dois usos
// dela, não dois formatos. Continua exportada daqui porque é por aqui que o
// app a importa.
export { referenciaBloco } from "@/lib/hoje";

export const chaveMotivo = (referencia: string, data: string) => `${referencia}|${data}`;

/** Bloco próprio cujo horário terminou e que não foi marcado como feito. */
export function naoExecutado(b: BlocoExecucao, agora: Date) {
  return b.tipo !== "google" && !b.concluido && fimDoBloco(b).getTime() <= agora.getTime();
}

/** Resumo da semana: total não executado e contagem por motivo (mais frequente primeiro). */
export function resumoNaoExecutados(
  blocos: BlocoComOrigem[],
  motivos: Map<string, MotivoId>,
  agora: Date,
) {
  const perdidos = blocos.filter((b) => naoExecutado(b, agora));
  const contagem = new Map<MotivoId, number>();
  let semMotivo = 0;
  perdidos.forEach((b) => {
    const ref = referenciaBloco(b);
    const motivo = ref ? motivos.get(chaveMotivo(ref, b.data)) : undefined;
    if (motivo) contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
    else semMotivo++;
  });
  const porMotivo = [...contagem.entries()]
    .map(([motivo, total]) => ({ motivo, label: MOTIVO_LABEL[motivo], total }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return { total: perdidos.length, semMotivo, porMotivo };
}
