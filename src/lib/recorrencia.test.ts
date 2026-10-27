import { describe, expect, it } from "vitest";
import {
  diaDaSemanaNoMes,
  posicaoNoMes,
  proximaOcorrencia,
  rotuloMensalPorSemana,
} from "../../supabase/functions/_shared/recorrencia";

const d = (iso: string) => {
  const [a, m, dia] = iso.split("-").map(Number);
  return new Date(a, m - 1, dia);
};
const iso = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

describe("posicaoNoMes", () => {
  it("30/10/2026 é a 5ª e a última sexta de outubro", () => {
    expect(posicaoNoMes(d("2026-10-30"))).toEqual({ ordinal: 5, ultima: true });
  });

  it("13/10/2026 é a 2ª terça e não é a última", () => {
    expect(posicaoNoMes(d("2026-10-13"))).toEqual({ ordinal: 2, ultima: false });
  });

  it("a 4ª ocorrência é a última quando o mês não tem a 5ª", () => {
    // Novembro/2026 tem 4 sextas: 6, 13, 20 e 27.
    expect(posicaoNoMes(d("2026-11-27"))).toEqual({ ordinal: 4, ultima: true });
  });
});

describe("diaDaSemanaNoMes", () => {
  it("acha a última sexta de novembro de 2026", () => {
    expect(iso(diaDaSemanaNoMes(2026, 10, 5, 5, true))).toBe("2026-11-27");
  });

  it("acha a segunda terça de dezembro de 2026", () => {
    expect(iso(diaDaSemanaNoMes(2026, 11, 2, 2, false))).toBe("2026-12-08");
  });

  it("mês sem a 5ª ocorrência cai na 4ª, não vaza para o mês seguinte", () => {
    const x = diaDaSemanaNoMes(2026, 10, 5, 5, false);
    expect(x.getMonth()).toBe(10);
    expect(iso(x)).toBe("2026-11-27");
  });
});

describe("proximaOcorrencia mensal por dia da semana", () => {
  it("a última sexta anda de mês em mês acompanhando o calendário", () => {
    // Era isso que quebrava: dia 30 em novembro cai numa segunda.
    const inicio = d("2026-10-30");
    let atual = inicio;
    const datas: string[] = [];
    for (let i = 0; i < 3; i++) {
      atual = proximaOcorrencia(atual, "mensal_dia_semana", inicio);
      datas.push(iso(atual));
    }
    expect(datas).toEqual(["2026-11-27", "2026-12-25", "2027-01-29"]);
    // E todas continuam sendo sexta-feira.
    expect(datas.every((x) => d(x).getDay() === 5)).toBe(true);
  });

  it("a referência é sempre a primeira ocorrência da série", () => {
    // Novembro tem 4 sextas. Se a referência virasse a ocorrência corrente,
    // "última" degeneraria para "quarta sexta" e nunca mais voltaria.
    const inicio = d("2026-10-30");
    const nov = proximaOcorrencia(inicio, "mensal_dia_semana", inicio);
    const dez = proximaOcorrencia(nov, "mensal_dia_semana", inicio);
    expect(iso(dez)).toBe("2026-12-25");
  });
});

describe("proximaOcorrencia nas regras antigas", () => {
  it("mensal por dia do mês continua como era", () => {
    expect(iso(proximaOcorrencia(d("2026-01-31"), "mensal", d("2026-01-31")))).toBe("2026-02-28");
  });

  it("mensal volta ao dia original depois de um mês curto", () => {
    const inicio = d("2026-01-31");
    const fev = proximaOcorrencia(inicio, "mensal", inicio);
    expect(iso(proximaOcorrencia(fev, "mensal", inicio))).toBe("2026-03-31");
  });

  it("semanal e quinzenal somam dias", () => {
    expect(iso(proximaOcorrencia(d("2026-10-27"), "semanal"))).toBe("2026-11-03");
    expect(iso(proximaOcorrencia(d("2026-10-27"), "quinzenal"))).toBe("2026-11-10");
  });
});

describe("rotuloMensalPorSemana", () => {
  it("diz em português o que a regra faz", () => {
    expect(rotuloMensalPorSemana(d("2026-10-30"))).toBe("na última sexta-feira");
    expect(rotuloMensalPorSemana(d("2026-10-13"))).toBe("na segunda terça-feira");
  });
});
