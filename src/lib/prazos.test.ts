import { describe, expect, it } from "vitest";
import { agruparPorSemanaDePrazo, rotuloSemana } from "@/lib/prazos";

const HOJE = "2026-10-21"; // quarta-feira
const t = (id: string, prazo: string | null, priorityScore: number) => ({
  id,
  prazo,
  priorityScore,
});

describe("rotuloSemana", () => {
  it("usa um mês só quando a semana não vira o mês", () => {
    expect(rotuloSemana("2026-10-19")).toBe("Semana de 19 a 25 de outubro");
  });

  it("escreve os dois meses quando a semana atravessa", () => {
    expect(rotuloSemana("2026-10-26")).toBe(
      "Semana de 26 de outubro a 1 de novembro",
    );
  });
});

describe("agruparPorSemanaDePrazo", () => {
  it("põe as atrasadas no topo", () => {
    const grupos = agruparPorSemanaDePrazo(
      [t("futura", "2026-10-22", 10), t("velha", "2026-08-29", 63)],
      HOJE,
    );
    expect(grupos[0].chave).toBe("atrasadas");
    expect(grupos[0].tarefas.map((x) => x.id)).toEqual(["velha"]);
  });

  it("deixa as sem data por último", () => {
    const grupos = agruparPorSemanaDePrazo(
      [t("sem", null, 99), t("com", "2026-10-22", 1)],
      HOJE,
    );
    expect(grupos[grupos.length - 1].chave).toBe("sem-data");
  });

  it("a semana manda, a pontuação só ordena dentro dela", () => {
    const grupos = agruparPorSemanaDePrazo(
      [
        t("proxima-semana-forte", "2026-10-27", 100),
        t("esta-semana-fraca", "2026-10-22", 5),
      ],
      HOJE,
    );
    // Antes, a de pontuação 100 viria primeiro mesmo vencendo depois.
    expect(grupos.map((g) => g.tarefas[0].id)).toEqual([
      "esta-semana-fraca",
      "proxima-semana-forte",
    ]);
  });

  it("ordena por pontuação dentro do mesmo grupo", () => {
    const grupos = agruparPorSemanaDePrazo(
      [t("fraca", "2026-10-22", 28), t("forte", "2026-10-23", 63)],
      HOJE,
    );
    expect(grupos[0].tarefas.map((x) => x.id)).toEqual(["forte", "fraca"]);
  });

  it("desempata pelo prazo mais próximo", () => {
    const grupos = agruparPorSemanaDePrazo(
      [t("depois", "2026-10-23", 30), t("antes", "2026-10-22", 30)],
      HOJE,
    );
    expect(grupos[0].tarefas.map((x) => x.id)).toEqual(["antes", "depois"]);
  });

  it("prazo de hoje não conta como atrasado", () => {
    const grupos = agruparPorSemanaDePrazo([t("hoje", HOJE, 10)], HOJE);
    expect(grupos[0].chave).not.toBe("atrasadas");
    expect(grupos[0].titulo).toContain("Esta semana");
  });

  it("semanas futuras ficam em ordem crescente", () => {
    const grupos = agruparPorSemanaDePrazo(
      [t("c", "2026-11-10", 1), t("a", "2026-10-22", 1), t("b", "2026-11-03", 1)],
      HOJE,
    );
    expect(grupos.map((g) => g.tarefas[0].id)).toEqual(["a", "b", "c"]);
  });

  it("não cria grupo vazio", () => {
    expect(agruparPorSemanaDePrazo([], HOJE)).toEqual([]);
  });
});

describe("ehSemanaAtual", () => {
  it("marca só o grupo da semana corrente", () => {
    const grupos = agruparPorSemanaDePrazo(
      [t("agora", "2026-10-22", 1), t("depois", "2026-11-03", 1), t("velha", "2026-09-01", 1)],
      HOJE,
    );
    const marcados = grupos.filter((g) => g.ehSemanaAtual).map((g) => g.chave);
    expect(marcados).toEqual(["2026-10-19"]);
  });

  it("atrasadas e sem data nunca são a semana corrente", () => {
    const grupos = agruparPorSemanaDePrazo(
      [t("velha", "2026-09-01", 1), t("sem", null, 1)],
      HOJE,
    );
    expect(grupos.every((g) => !g.ehSemanaAtual)).toBe(true);
  });
});
