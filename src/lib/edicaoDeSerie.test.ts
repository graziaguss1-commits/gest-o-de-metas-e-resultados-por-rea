import { describe, expect, it } from "vitest";
import { planejarEdicaoDeSerie } from "@/lib/edicaoDeSerie";

const serie = {
  id: "s1",
  data: "2026-08-24",
  recorrencia: "semanal",
  recorrencia_fim: "2026-12-31",
};

const edicao = (over = {}) => ({
  dataOriginal: "2026-11-09",
  hoje: "2026-11-02",
  data: "2026-11-09",
  hora_inicio: "16:00",
  hora_fim: "18:00",
  ...over,
});

describe("planejarEdicaoDeSerie", () => {
  it("divide a série no dia editado, preservando o passado", () => {
    expect(planejarEdicaoDeSerie(serie, edicao())).toEqual({
      tipo: "dividir_serie",
      fimDaAntiga: "2026-11-08",
    });
  });

  it("nunca corta antes de hoje, mesmo editando uma ocorrência antiga", () => {
    // Abrir a aula do mês passado para corrigir o horário não pode
    // reescrever as outras do mês passado junto.
    expect(
      planejarEdicaoDeSerie(serie, edicao({ dataOriginal: "2026-09-14" })),
    ).toEqual({ tipo: "dividir_serie", fimDaAntiga: "2026-11-01" });
  });

  it("editar a primeira ocorrência não deixa fragmento vazio para trás", () => {
    const novinha = { ...serie, data: "2026-11-09" };
    expect(planejarEdicaoDeSerie(novinha, edicao())).toEqual({
      tipo: "atualizar_serie",
    });
  });

  it("compromisso único é atualizado direto", () => {
    expect(
      planejarEdicaoDeSerie({ ...serie, recorrencia: "nenhuma" }, edicao()),
    ).toEqual({ tipo: "atualizar_serie" });
  });

  it("atravessa a virada de mês sem inventar dia 00", () => {
    expect(
      planejarEdicaoDeSerie(serie, edicao({ dataOriginal: "2026-12-01", hoje: "2026-12-01" })),
    ).toEqual({ tipo: "dividir_serie", fimDaAntiga: "2026-11-30" });
  });
});
