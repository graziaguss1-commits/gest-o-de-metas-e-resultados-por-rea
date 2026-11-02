import { describe, expect, it } from "vitest";
import { chaveDaOcorrencia, expandirNaJanela } from "@/hooks/useCompromissos";

const serie = (over = {}) =>
  ({
    id: "s1",
    titulo: "Reunião de equipe",
    data: "2026-08-24",
    hora_inicio: "10:00",
    hora_fim: "12:00",
    area: "Clínica",
    observacao: null,
    concluido: false,
    recorrencia: "semanal",
    recorrencia_fim: "2026-11-24",
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const janela = ["2026-11-02", "2026-11-08"] as const;

describe("expandirNaJanela — conclusão por ocorrência", () => {
  it("não risca todas as semanas quando a série está marcada como feita", () => {
    // Era o bug: `concluido` é campo da série, e cada ocorrência o herdava.
    const ocorrencias = expandirNaJanela(
      [serie({ concluido: true })],
      janela[0],
      janela[1],
      [],
    );
    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0].concluido).toBe(false);
  });

  it("marca feita só a ocorrência que tem exceção", () => {
    const ocorrencias = expandirNaJanela([serie()], "2026-10-26", "2026-11-08", [
      {
        compromisso_id: "s1",
        data_original: "2026-11-02",
        data: null,
        hora_inicio: null,
        hora_fim: null,
        cancelado: false,
        concluido: true,
      },
    ]);
    const feitas = ocorrencias.filter((o) => o.concluido).map((o) => o.data);
    expect(feitas).toEqual(["2026-11-02"]);
    expect(ocorrencias.length).toBeGreaterThan(1);
  });

  it("compromisso único continua usando o próprio campo", () => {
    const [unico] = expandirNaJanela(
      [serie({ recorrencia: "nenhuma", data: "2026-11-03", concluido: true })],
      janela[0],
      janela[1],
      [],
    );
    expect(unico.concluido).toBe(true);
  });

  it("leva a data original junto, não a remarcada", () => {
    const ocorrencias = expandirNaJanela([serie()], janela[0], janela[1], [
      {
        compromisso_id: "s1",
        data_original: "2026-11-02",
        data: "2026-11-04",
        hora_inicio: null,
        hora_fim: null,
        cancelado: false,
        concluido: false,
      },
    ]);
    expect(ocorrencias[0]).toMatchObject({
      data: "2026-11-04",
      data_original: "2026-11-02",
    });
  });
});

describe("chaveDaOcorrencia", () => {
  it("separa série e data original do id expandido", () => {
    expect(chaveDaOcorrencia("s1@2026-11-02", "2026-11-04")).toEqual({
      serie_id: "s1",
      data_original: "2026-11-02",
    });
  });

  it("compromisso único usa a data do bloco como chave", () => {
    expect(chaveDaOcorrencia("s1", "2026-11-03")).toEqual({
      serie_id: "s1",
      data_original: "2026-11-03",
    });
  });
});
