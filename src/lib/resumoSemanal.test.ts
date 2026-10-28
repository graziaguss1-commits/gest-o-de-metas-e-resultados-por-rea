import { describe, expect, it } from "vitest";
import {
  aderencia,
  aderenciaConjunta,
  janelaAcumulada,
  janelaDaTarefa,
  movimentoMeta,
  aderenciaAcumulada,
  aderenciaPorSemana,
  mediaUltimasSemanas,
  periodosExigidos,
  sequenciaAtual,
} from "@/lib/resumoSemanal";
import type { Execucao, TarefaMensuravel } from "@/lib/execucao";

// Semana de 19/10/2026 (segunda) a 25/10 (domingo).
const SEMANA = { inicio: "2026-10-19", fim: "2026-10-25" };

const tarefa = (extra: Partial<TarefaMensuravel> = {}): TarefaMensuravel => ({
  id: "t1",
  descricao: "Rotina",
  concluida: false,
  frequencia: "diaria",
  quantidade_planejada: 1,
  dias_semana: [1, 2, 3, 4, 5, 6, 7],
  ...extra,
});

const exec = (data: string, quantidade = 1): Execucao => ({
  id: `e-${data}`,
  tarefa_id: "t1",
  data_referencia: data,
  quantidade,
});

describe("periodosExigidos", () => {
  it("todo dia cobra sete dias na semana", () => {
    expect(periodosExigidos(tarefa(), SEMANA)).toHaveLength(7);
  });

  it("respeita os dias da semana configurados", () => {
    const seg_qua_sex = tarefa({ dias_semana: [1, 3, 5] });
    const dias = periodosExigidos(seg_qua_sex, SEMANA).map((p) => p.inicio);
    expect(dias).toEqual(["2026-10-19", "2026-10-21", "2026-10-23"]);
  });

  it("sem dias configurados, rotina diária cobra dias úteis — como a agenda", () => {
    expect(periodosExigidos(tarefa({ dias_semana: null }), SEMANA)).toHaveLength(5);
  });

  it("semanal cobra uma vez por semana", () => {
    const p = periodosExigidos(tarefa({ frequencia: "semanal" }), SEMANA);
    expect(p).toEqual([{ inicio: "2026-10-19", fim: "2026-10-25" }]);
  });

  it("mensal cobra uma vez por mês, recortado pela janela", () => {
    const p = periodosExigidos(tarefa({ frequencia: "mensal" }), {
      inicio: "2026-09-15",
      fim: "2026-10-10",
    });
    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({ inicio: "2026-09-15", fim: "2026-09-30" });
    expect(p[1]).toEqual({ inicio: "2026-10-01", fim: "2026-10-10" });
  });

  it("ação única não tem período a cobrar", () => {
    expect(periodosExigidos(tarefa({ frequencia: "unica" }), SEMANA)).toEqual([]);
  });

  it("janela invertida não cobra nada", () => {
    expect(periodosExigidos(tarefa(), { inicio: "2026-10-25", fim: "2026-10-19" })).toEqual([]);
  });
});

describe("aderencia", () => {
  it("conta os dias cumpridos sobre os exigidos", () => {
    const a = aderencia(tarefa(), [exec("2026-10-19"), exec("2026-10-21")], SEMANA);
    expect(a).toEqual({ exigidos: 7, cumpridos: 2, pct: 2 / 7 });
  });

  it("execução fora da janela não conta", () => {
    const a = aderencia(tarefa(), [exec("2026-10-18")], SEMANA);
    expect(a.cumpridos).toBe(0);
  });

  it("conta o que foi feito mesmo abaixo da quantidade planejada", () => {
    // 3 treinos por semana: fazer 2 vale 2, não zero.
    const treino = tarefa({ frequencia: "semanal", quantidade_planejada: 3 });
    const a = aderencia(treino, [exec("2026-10-19", 2)], SEMANA);
    expect(a).toEqual({ exigidos: 3, cumpridos: 2, pct: 2 / 3 });
  });

  it("não deixa um período forte pagar os outros: tem teto", () => {
    const treino = tarefa({ frequencia: "semanal", quantidade_planejada: 3 });
    const a = aderencia(treino, [exec("2026-10-19", 5)], SEMANA);
    expect(a.cumpridos).toBe(3);
  });

  it("soma registros do mesmo período", () => {
    const treino = tarefa({ frequencia: "semanal", quantidade_planejada: 3 });
    const a = aderencia(treino, [exec("2026-10-19", 1), exec("2026-10-20", 1)], SEMANA);
    expect(a.cumpridos).toBe(2);
  });

  it("ação de quantidade 1 continua valendo 1 por período, como antes", () => {
    const a = aderencia(tarefa(), [exec("2026-10-19"), exec("2026-10-19")], SEMANA);
    expect(a).toEqual({ exigidos: 7, cumpridos: 1, pct: 1 / 7 });
  });

  it("pct é null quando nada era exigido, não 0%", () => {
    const a = aderencia(tarefa({ frequencia: "unica" }), [], SEMANA);
    expect(a.pct).toBeNull();
  });
});

describe("janelaAcumulada", () => {
  const meta = { data_inicio: "2026-09-01", data_fim: "2026-12-31" };

  it("vai do início até hoje, sem incluir dia futuro", () => {
    const j = janelaAcumulada({ data_inicio: "2026-09-10", prazo: null }, meta, "2026-10-21");
    expect(j).toEqual({ inicio: "2026-09-10", fim: "2026-10-21" });
  });

  it("não começa antes da meta", () => {
    const j = janelaAcumulada({ data_inicio: "2026-08-01", prazo: null }, meta, "2026-10-21");
    expect(j.inicio).toBe("2026-09-01");
  });

  it("não passa do fim da meta", () => {
    const encerrada = { data_inicio: "2026-09-01", data_fim: "2026-09-30" };
    const j = janelaAcumulada({ data_inicio: "2026-09-01", prazo: null }, encerrada, "2026-10-21");
    expect(j.fim).toBe("2026-09-30");
  });
});

describe("movimentoMeta", () => {
  const lanc = [
    { data_lancamento: "2026-10-10", valor: 100 },
    { data_lancamento: "2026-10-20", valor: 140 },
    { data_lancamento: "2026-10-24", valor: 155 },
  ];

  it("usa o último lançamento de cada ponta, como o app define valor_atual", () => {
    expect(movimentoMeta(lanc, SEMANA)).toEqual({ antes: 100, depois: 155, delta: 55 });
  });

  it("sem lançamento anterior, parte do zero", () => {
    const so_na_semana = [{ data_lancamento: "2026-10-20", valor: 40 }];
    expect(movimentoMeta(so_na_semana, SEMANA)).toEqual({ antes: null, depois: 40, delta: 40 });
  });

  it("sem lançamento nenhum até o fim, não inventa movimento", () => {
    expect(movimentoMeta([], SEMANA)).toEqual({ antes: null, depois: null, delta: null });
  });

  it("sem lançamento na semana, o movimento é zero e não o valor cheio", () => {
    const antigo = [{ data_lancamento: "2026-10-01", valor: 90 }];
    expect(movimentoMeta(antigo, SEMANA)).toEqual({ antes: 90, depois: 90, delta: 0 });
  });
});

describe("aderenciaConjunta", () => {
  const diaria = tarefa({ id: "d", frequencia: "diaria" });
  const semanal = tarefa({ id: "s", frequencia: "semanal", dias_semana: [1] });
  const execs: Execucao[] = [
    { id: "a", tarefa_id: "d", data_referencia: "2026-10-19", quantidade: 1 },
    { id: "b", tarefa_id: "d", data_referencia: "2026-10-20", quantidade: 1 },
    { id: "c", tarefa_id: "s", data_referencia: "2026-10-21", quantidade: 1 },
  ];

  it("soma exigidos e cumpridos das duas ações", () => {
    // Diária pede 7 na semana e saiu 2; semanal pede 1 e saiu 1.
    const r = aderenciaConjunta([diaria, semanal], execs, SEMANA);
    expect(r.exigidos).toBe(8);
    expect(r.cumpridos).toBe(3);
  });

  it("soma os cumprimentos em vez de tirar média das taxas", () => {
    // A média das taxas daria (2/7 + 1/1) / 2 = 64%, que esconde o buraco
    // da ação diária. O que a semana pediu foi 8 e saíram 3.
    const r = aderenciaConjunta([diaria, semanal], execs, SEMANA);
    expect(r.pct).toBeCloseTo(3 / 8);
  });

  it("semana que não pedia nada devolve null, não 0%", () => {
    const unica = tarefa({ id: "u", frequencia: "unica" });
    expect(aderenciaConjunta([unica], [], SEMANA).pct).toBeNull();
  });
});

describe("janelaDaTarefa", () => {
  const meta = { data_inicio: "2026-10-01", data_fim: "2026-12-31" };

  it("usa a interseção entre a ação e a meta", () => {
    expect(janelaDaTarefa({ data_inicio: "2026-11-01", prazo: "2027-03-01" }, meta))
      .toEqual({ inicio: "2026-11-01", fim: "2026-12-31" });
  });

  it("vai até o fim da meta, não até hoje", () => {
    // É a diferença para janelaAcumulada: aqui se mede o alvo, que inclui
    // o que ainda vai acontecer.
    expect(janelaDaTarefa({ data_inicio: null, prazo: null }, meta)?.fim).toBe("2026-12-31");
  });

  it("ação que termina antes de começar não tem janela", () => {
    expect(janelaDaTarefa({ data_inicio: "2027-01-01", prazo: "2027-02-01" }, meta)).toBeNull();
  });
});

describe("fim da rotina (data_fim) vs fim da ação única (prazo)", () => {
  const meta = { data_inicio: "2026-10-27", data_fim: "2027-12-31" };

  it("para de cobrar a rotina no data_fim dela, não no fim da meta", () => {
    const janela = janelaDaTarefa(
      { data_inicio: "2026-10-27", prazo: null, data_fim: "2026-12-31" },
      meta,
    );
    expect(janela).toEqual({ inicio: "2026-10-27", fim: "2026-12-31" });
  });

  it("continua respeitando o prazo da ação única", () => {
    const janela = janelaDaTarefa(
      { data_inicio: "2026-10-27", prazo: "2026-11-30", data_fim: null },
      meta,
    );
    expect(janela?.fim).toBe("2026-11-30");
  });

  it("sem data própria, o fim da meta segue valendo", () => {
    const janela = janelaDaTarefa(
      { data_inicio: "2026-10-27", prazo: null, data_fim: null },
      meta,
    );
    expect(janela?.fim).toBe("2027-12-31");
  });

  it("a janela acumulada também para no fim da rotina", () => {
    const janela = janelaAcumulada(
      { data_inicio: "2026-10-27", prazo: null, data_fim: "2026-11-10" },
      meta,
      "2026-12-20",
    );
    expect(janela.fim).toBe("2026-11-10");
  });
});

describe("leitura de meta de hábito", () => {
  const meta = { data_inicio: "2026-10-05", data_fim: "2026-12-31" };
  // Diária de segunda a sexta, começando junto com a meta.
  const diaria = tarefa({ id: "t1", frequencia: "diaria", dias_semana: [1, 2, 3, 4, 5], data_inicio: "2026-10-05" });
  // Criada depois: não pode ser cobrada nas semanas anteriores.
  const nova = tarefa({ id: "t2", frequencia: "diaria", dias_semana: [1, 2, 3, 4, 5], data_inicio: "2026-10-19" });

  const feitas = (ids: [string, string][]): Execucao[] =>
    ids.map(([tarefa_id, data], i) => ({ id: `x${i}`, tarefa_id, data_referencia: data, quantidade: 1 }));

  it("não cobra a ação antes de ela existir", () => {
    const semanas = aderenciaPorSemana([nova], [], meta, "2026-10-23");
    expect(semanas.map((s) => s.inicio)).toEqual(["2026-10-19"]);
  });

  it("acumulado compara com o exigido até hoje, não até o fim da meta", () => {
    // 05/10 a 09/10 = 5 dias úteis exigidos; 2 cumpridos.
    const a = aderenciaAcumulada([diaria], feitas([["t1", "2026-10-05"], ["t1", "2026-10-06"]]), meta, "2026-10-09");
    expect(a).toEqual({ exigidos: 5, cumpridos: 2, pct: 2 / 5 });
  });

  it("uma linha por semana, sem semana vazia de exigência", () => {
    const semanas = aderenciaPorSemana([diaria], feitas([["t1", "2026-10-06"]]), meta, "2026-10-16");
    expect(semanas).toHaveLength(2);
    expect(semanas[0]).toMatchObject({ inicio: "2026-10-05", exigidos: 5, cumpridos: 1 });
    expect(semanas[1]).toMatchObject({ inicio: "2026-10-12", cumpridos: 0 });
  });

  it("a média olha só as últimas semanas", () => {
    const semanas = [
      { inicio: "a", exigidos: 5, cumpridos: 0, pct: 0 },
      { inicio: "b", exigidos: 5, cumpridos: 5, pct: 1 },
      { inicio: "c", exigidos: 5, cumpridos: 5, pct: 1 },
    ];
    expect(mediaUltimasSemanas(semanas, 2)).toBe(1);
    expect(mediaUltimasSemanas(semanas, 3)).toBeCloseTo(2 / 3);
  });
});

describe("sequenciaAtual", () => {
  const meta = { data_inicio: "2026-10-05", data_fim: "2026-12-31" };
  const todos = tarefa({ id: "t1", frequencia: "diaria", dias_semana: [1, 2, 3, 4, 5, 6, 7], data_inicio: "2026-10-05" });
  const execs = (datas: string[]): Execucao[] =>
    datas.map((data, i) => ({ id: `e${i}`, tarefa_id: "t1", data_referencia: data, quantidade: 1 }));

  it("conta os dias seguidos cumpridos", () => {
    expect(sequenciaAtual([todos], execs(["2026-10-19", "2026-10-20", "2026-10-21"]), meta, "2026-10-21")).toBe(3);
  });

  it("para no primeiro dia falhado", () => {
    expect(sequenciaAtual([todos], execs(["2026-10-19", "2026-10-21"]), meta, "2026-10-21")).toBe(1);
  });

  it("hoje ainda vazio não zera o que veio antes", () => {
    expect(sequenciaAtual([todos], execs(["2026-10-19", "2026-10-20"]), meta, "2026-10-21")).toBe(2);
  });

  it("dia sem nada exigido não quebra a sequência", () => {
    const uteis = tarefa({ id: "t1", frequencia: "diaria", dias_semana: [1, 2, 3, 4, 5], data_inicio: "2026-10-05" });
    // 17 e 18/10 são sábado e domingo; a sexta e a segunda foram cumpridas.
    expect(sequenciaAtual([uteis], execs(["2026-10-16", "2026-10-19"]), meta, "2026-10-19")).toBe(2);
  });
});
