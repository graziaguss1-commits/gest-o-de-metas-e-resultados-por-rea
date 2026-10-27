import { describe, expect, it } from "vitest";
import {
  aderencia,
  aderenciaConjunta,
  janelaAcumulada,
  janelaDaTarefa,
  movimentoMeta,
  periodosExigidos,
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

  it("não cumpre o dia com quantidade abaixo da planejada", () => {
    const meta3 = tarefa({ quantidade_planejada: 3 });
    expect(aderencia(meta3, [exec("2026-10-19", 2)], SEMANA).cumpridos).toBe(0);
    expect(aderencia(meta3, [exec("2026-10-19", 3)], SEMANA).cumpridos).toBe(1);
  });

  it("soma registros do mesmo período", () => {
    const meta3 = tarefa({ quantidade_planejada: 3 });
    const a = aderencia(meta3, [exec("2026-10-19", 1), exec("2026-10-19", 2)], SEMANA);
    expect(a.cumpridos).toBe(1);
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
