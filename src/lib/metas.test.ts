import { describe, expect, it } from "vitest";
import { formatProgresso, getMetricType, progressoReal } from "./metas";

describe("medição de metas", () => {
  const meta = {
    valor_atual: 0,
    valor_alvo: 2,
    unidade: "mentorados",
    metric_type: "quantidade",
    is_inverse: false,
  };

  it("exibe 0 de 2 mentorados e 0% de progresso", () => {
    expect(formatProgresso(meta)).toBe("0 de 2 mentorados");
    expect(Math.round(progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse) * 100)).toBe(0);
  });

  it("formata metas financeiras com moeda", () => {
    expect(formatProgresso({ valor_atual: 0, valor_alvo: 1000, unidade: "R$", metric_type: "financeiro" }))
      .toContain("R$");
  });

  it("infere o tipo em metas antigas sem metric_type", () => {
    expect(getMetricType({ unidade: "R$" })).toBe("financeiro");
    expect(getMetricType({ unidade: "%" })).toBe("percentual");
    expect(getMetricType({ unidade: "leads" })).toBe("quantidade");
  });
});
