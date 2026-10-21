import { isoLocal, segundaDaSemana } from "@/lib/hoje";

export type ComPrazo = {
  prazo?: string | null;
  priorityScore: number;
};

export type GrupoPrazo<T> = {
  /** Identificador estável do grupo: "atrasadas", "sem-data" ou a segunda-feira. */
  chave: string;
  titulo: string;
  /** Segunda-feira da semana do grupo, quando for um grupo de semana. */
  semanaInicio: string | null;
  tarefas: T[];
};

const comMeioDia = (iso: string) => new Date(`${iso}T12:00:00`);

const diaEMes = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

/** "Semana de 19 a 25 de outubro" — ou com os dois meses, quando a semana vira o mês. */
export function rotuloSemana(segundaISO: string): string {
  const inicio = comMeioDia(segundaISO);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 6);
  if (inicio.getMonth() === fim.getMonth()) {
    return `Semana de ${inicio.getDate()} a ${diaEMes(fim)}`;
  }
  return `Semana de ${diaEMes(inicio)} a ${diaEMes(fim)}`;
}

/**
 * Agrupa tarefas pela semana do prazo e ordena cada grupo pela pontuação.
 *
 * A data passa a mandar no nível da semana, e a pontuação só decide dentro
 * dela — antes a ordem era só pontuação, e uma tarefa que vencia nesta semana
 * podia aparecer abaixo de outra sem prazo nenhum.
 *
 * Ordem dos grupos: atrasadas primeiro, depois as semanas em ordem crescente,
 * e por último as tarefas sem data.
 */
export function agruparPorSemanaDePrazo<T extends ComPrazo>(
  tarefas: T[],
  hojeISO: string,
): GrupoPrazo<T>[] {
  const atrasadas: T[] = [];
  const semData: T[] = [];
  const porSemana = new Map<string, T[]>();
  const semanaDeHoje = isoLocal(segundaDaSemana(comMeioDia(hojeISO)));

  tarefas.forEach((tarefa) => {
    const prazo = tarefa.prazo ?? null;
    if (!prazo) {
      semData.push(tarefa);
      return;
    }
    if (prazo < hojeISO) {
      atrasadas.push(tarefa);
      return;
    }
    const segunda = isoLocal(segundaDaSemana(comMeioDia(prazo)));
    const lista = porSemana.get(segunda);
    if (lista) lista.push(tarefa);
    else porSemana.set(segunda, [tarefa]);
  });

  const ordenar = (lista: T[]) =>
    [...lista].sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"),
    );

  const grupos: GrupoPrazo<T>[] = [];

  if (atrasadas.length) {
    grupos.push({
      chave: "atrasadas",
      titulo: "Atrasadas",
      semanaInicio: null,
      tarefas: ordenar(atrasadas),
    });
  }

  [...porSemana.keys()]
    .sort((a, b) => a.localeCompare(b))
    .forEach((segunda) => {
      grupos.push({
        chave: segunda,
        titulo:
          segunda === semanaDeHoje
            ? `Esta semana · ${rotuloSemana(segunda).replace("Semana de ", "")}`
            : rotuloSemana(segunda),
        semanaInicio: segunda,
        tarefas: ordenar(porSemana.get(segunda) ?? []),
      });
    });

  if (semData.length) {
    grupos.push({
      chave: "sem-data",
      titulo: "Sem data",
      semanaInicio: null,
      tarefas: ordenar(semData),
    });
  }

  return grupos;
}
