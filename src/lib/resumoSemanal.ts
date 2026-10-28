import { diaISO, diasRecorrenciaPersistida } from "@/lib/agenda";
import { getFrequencia, type Execucao, type TarefaMensuravel } from "@/lib/execucao";

export type Janela = { inicio: string; fim: string };

const comMeioDia = (iso: string) => new Date(`${iso}T12:00:00`);
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Maior e menor de duas datas ISO (comparação lexicográfica serve no formato ISO). */
const maior = (a: string, b: string) => (a > b ? a : b);
const menor = (a: string, b: string) => (a < b ? a : b);

/**
 * Quando a ação deixa de ser cobrada.
 *
 * Ação única guarda a data em `prazo`; rotina guarda em `data_fim` — é assim
 * que os formulários salvam. Olhar só `prazo` fazia a rotina parecer eterna:
 * a cobrança seguia até o fim da META, inflando o alvo do hábito com
 * períodos que a rotina nunca ia alcançar.
 */
const fimDaTarefa = (
  tarefa: Pick<TarefaMensuravel, "prazo" | "data_fim">,
): string | null => tarefa.prazo ?? tarefa.data_fim ?? null;

/**
 * Períodos em que a ação deveria ter sido cumprida dentro da janela.
 *
 * Um período é a unidade de cobrança da rotina: para "por dia" é cada dia que
 * a recorrência pede, para "por semana" é cada semana, para "por mês" cada
 * mês. A execução pode ser registrada em qualquer dia do período.
 *
 * Os dias da recorrência saem de `diasRecorrenciaPersistida`, o mesmo helper
 * que a agenda usa — sem isso a cobrança aqui diria uma coisa e a agenda
 * outra. Ação única não tem período: ela não se repete.
 */
export function periodosExigidos(
  tarefa: Pick<TarefaMensuravel, "frequencia" | "dias_semana">,
  janela: Janela,
): Janela[] {
  const freq = getFrequencia(tarefa);
  if (freq === "unica" || janela.fim < janela.inicio) return [];
  const dias = diasRecorrenciaPersistida(freq, tarefa.dias_semana) ?? [];

  if (freq === "diaria") {
    const periodos: Janela[] = [];
    for (
      let d = comMeioDia(janela.inicio);
      toISO(d) <= janela.fim;
      d.setDate(d.getDate() + 1)
    ) {
      if (dias.includes(diaISO(d))) {
        const iso = toISO(d);
        periodos.push({ inicio: iso, fim: iso });
      }
    }
    return periodos;
  }

  if (freq === "semanal") {
    const periodos: Janela[] = [];
    const d = comMeioDia(janela.inicio);
    d.setDate(d.getDate() - ((diaISO(d) + 6) % 7)); // recua até a segunda
    for (; toISO(d) <= janela.fim; d.setDate(d.getDate() + 7)) {
      const domingo = new Date(d);
      domingo.setDate(d.getDate() + 6);
      const inicio = maior(toISO(d), janela.inicio);
      const fim = menor(toISO(domingo), janela.fim);
      if (inicio <= fim) periodos.push({ inicio, fim });
    }
    return periodos;
  }

  // mensal
  const periodos: Janela[] = [];
  const d = comMeioDia(janela.inicio);
  d.setDate(1);
  for (; toISO(d) <= janela.fim; d.setMonth(d.getMonth() + 1)) {
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
    const inicio = maior(toISO(d), janela.inicio);
    const fim = menor(toISO(ultimo), janela.fim);
    if (inicio <= fim) periodos.push({ inicio, fim });
  }
  return periodos;
}

export type Aderencia = {
  exigidos: number;
  cumpridos: number;
  /** null quando nada era exigido na janela — 0% ali seria mentira. */
  pct: number | null;
};

/**
 * Quantos cumprimentos a janela pediu e quantos saíram.
 *
 * A unidade é o CUMPRIMENTO, não o período: uma rotina de 3 treinos por
 * semana pede 3 por semana, e cada treino conta. Antes a conta era
 * tudo-ou-nada por período — a semana só valia com os 3 — e isso zerava
 * quem treinou 2. Sete treinos reais apareciam como zero, que é o oposto
 * do que um medidor de hábito deve fazer.
 *
 * O teto por período impede o contrário: cinco treinos numa semana que
 * pede 3 contam 3, não 5, senão uma semana forte pagaria a semana vazia e
 * a rotina deixaria de ser rotina.
 *
 * Para as ações de quantidade 1 — a maioria — nada muda: min(n, 1) por
 * período é exatamente o "cumpriu ou não" de antes.
 */
export function aderencia(
  tarefa: TarefaMensuravel,
  execucoes: Execucao[],
  janela: Janela,
): Aderencia {
  const periodos = periodosExigidos(tarefa, janela);
  const planejado = Number(tarefa.quantidade_planejada ?? 1) || 1;
  const doTarefa = execucoes.filter((e) => e.tarefa_id === tarefa.id);

  const cumpridos = periodos.reduce((total, p) => {
    const soma = doTarefa
      .filter((e) => e.data_referencia >= p.inicio && e.data_referencia <= p.fim)
      .reduce((acc, e) => acc + Number(e.quantidade || 0), 0);
    return total + Math.min(soma, planejado);
  }, 0);

  const exigidos = periodos.length * planejado;
  return {
    exigidos,
    cumpridos,
    pct: exigidos ? cumpridos / exigidos : null,
  };
}

/**
 * Janela acumulada da ação: do início até hoje, sem passar do fim da meta.
 *
 * Começa no que vier depois entre o início da meta e o início da ação, e
 * termina no que vier antes entre hoje e o fim da meta — dia futuro não pode
 * ser cobrado como perdido.
 */
export function janelaAcumulada(
  tarefa: Pick<TarefaMensuravel, "data_inicio" | "prazo" | "data_fim">,
  meta: { data_inicio?: string | null; data_fim?: string | null } | null,
  hojeISO: string,
): Janela {
  const inicio = maior(
    tarefa.data_inicio ?? meta?.data_inicio ?? hojeISO,
    meta?.data_inicio ?? tarefa.data_inicio ?? hojeISO,
  );
  const limite = menor(meta?.data_fim ?? hojeISO, fimDaTarefa(tarefa) ?? hojeISO);
  return { inicio, fim: menor(hojeISO, maior(limite, inicio)) };
}

export type MovimentoMeta = {
  antes: number | null;
  depois: number | null;
  delta: number | null;
};

/**
 * Quanto a meta andou na janela.
 *
 * O app define o valor de uma meta como o ÚLTIMO lançamento (ver
 * useMetas), não como a soma deles. Então o valor numa data é o último
 * lançamento até aquela data, e o movimento é a diferença entre as pontas.
 */
export function movimentoMeta(
  lancamentos: { data_lancamento: string; valor: number | string }[],
  janela: Janela,
): MovimentoMeta {
  const ordenados = [...lancamentos].sort((a, b) =>
    a.data_lancamento.localeCompare(b.data_lancamento),
  );
  const ultimoAte = (limite: string, inclusivo: boolean) => {
    const validos = ordenados.filter((l) =>
      inclusivo ? l.data_lancamento <= limite : l.data_lancamento < limite,
    );
    const ultimo = validos[validos.length - 1];
    return ultimo ? Number(ultimo.valor) : null;
  };
  const antes = ultimoAte(janela.inicio, false);
  const depois = ultimoAte(janela.fim, true);
  return {
    antes,
    depois,
    delta: depois == null ? null : depois - (antes ?? 0),
  };
}

/**
 * Janela cheia da ação dentro da meta, incluindo o que ainda está por vir.
 *
 * `janelaAcumulada` corta em hoje porque serve para cobrar o que passou.
 * Esta não corta: serve para dizer quantos cumprimentos a meta pede do
 * começo ao fim, que é o alvo.
 */
export function janelaDaTarefa(
  tarefa: Pick<TarefaMensuravel, "data_inicio" | "prazo" | "data_fim">,
  meta: { data_inicio?: string | null; data_fim?: string | null } | null,
): Janela | null {
  const inicio = maior(tarefa.data_inicio ?? meta?.data_inicio ?? "", meta?.data_inicio ?? "");
  const fim = menor(fimDaTarefa(tarefa) ?? meta?.data_fim ?? "", meta?.data_fim ?? "");
  if (!inicio || !fim || fim < inicio) return null;
  return { inicio, fim };
}

/**
 * Aderência somada de várias ações — a leitura de uma meta de hábito.
 *
 * Soma exigidos e cumpridos em vez de tirar a média das taxas: uma ação
 * diária e uma mensal não valem o mesmo, e a média das porcentagens
 * esconderia isso. O que conta é quantos cumprimentos a semana pediu e
 * quantos saíram.
 */
export function aderenciaConjunta(
  tarefas: TarefaMensuravel[],
  execucoes: Execucao[],
  janela: Janela,
): Aderencia {
  let exigidos = 0;
  let cumpridos = 0;
  for (const tarefa of tarefas) {
    const a = aderencia(tarefa, execucoes, janela);
    exigidos += a.exigidos;
    cumpridos += a.cumpridos;
  }
  return { exigidos, cumpridos, pct: exigidos ? cumpridos / exigidos : null };
}
