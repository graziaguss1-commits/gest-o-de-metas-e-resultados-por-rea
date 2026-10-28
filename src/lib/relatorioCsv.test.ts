import { describe, expect, it } from "vitest";
import { csvEscape, montarCSV } from "@/lib/relatorioCsv";
import type { MetaWithResponsavel } from "@/lib/metas";

const meta = (over: Partial<MetaWithResponsavel> = {}) =>
  ({
    id: "1",
    nome: "Faturamento",
    area: "Clínica",
    valor_atual: 50,
    valor_alvo: 100,
    unidade: "R$ mil",
    status: "amarelo",
    periodicidade: "mensal",
    data_inicio: "2026-01-01",
    data_fim: "2026-12-31",
    is_inverse: false,
    responsaveis: [],
    responsavel_nome: null,
    ...over,
  }) as unknown as MetaWithResponsavel;

describe("csvEscape", () => {
  it("protege campo com vírgula, ponto e vírgula ou quebra de linha", () => {
    expect(csvEscape("Clínica, Alphaville")).toBe('"Clínica, Alphaville"');
    expect(csvEscape("a;b")).toBe('"a;b"');
    expect(csvEscape("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });

  it("dobra aspas internas em vez de deixar o campo quebrar", () => {
    expect(csvEscape('Meta "top"')).toBe('"Meta ""top"""');
  });

  it("deixa nulo virar vazio e texto simples passar intacto", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape("Mentoria")).toBe("Mentoria");
  });
});

describe("montarCSV", () => {
  it("abre com BOM para o Excel não quebrar os acentos", () => {
    expect(montarCSV([meta()]).startsWith("﻿")).toBe(true);
  });

  it("gera uma linha por meta, além do cabeçalho", () => {
    const linhas = montarCSV([meta(), meta({ id: "2" })]).split("\n");
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toContain("Nome");
  });

  it("leva o progresso já calculado, não o valor cru", () => {
    expect(montarCSV([meta()])).toContain(",50,100,R$ mil,50,");
  });
});
