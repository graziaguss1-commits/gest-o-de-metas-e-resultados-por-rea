import { describe, expect, it } from "vitest";
import { estadoParaRow, normalizarEstado, rowParaEstado, semanaDaChave } from "./planejamento";

describe("semanaDaChave", () => {
  it("aceita chaves de segunda-feira e ignora as antigas por número de semana", () => {
    expect(semanaDaChave("performance-week-2026-10-12")).toBe("2026-10-12");
    expect(semanaDaChave("performance-week-2026-10-13")).toBeNull();
    expect(semanaDaChave("performance-week-2026-41")).toBeNull();
  });
});

describe("migração do estado local", () => {
  it("junta as duas listas antigas numa só, sem repetir id", () => {
    const local = normalizarEstado({
      priorityIds: ["a", "b", "c", "d"],
      complementaryIds: ["a", "e"],
      focus: "Vendas",
      wins: "w",
    });
    expect(local.acoesIds).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("não perde as escolhas de uma semana salva no formato antigo", () => {
    const estado = rowParaEstado({
      semana_inicio: "2026-10-12",
      priority_ids: ["top1", "top2"],
      complementary_ids: ["comp1"],
      foco: "Vendas",
      wins: "",
      pending: "",
      lesson: "",
      saved_at: null,
    });
    expect(estado.acoesIds).toEqual(["top1", "top2", "comp1"]);
  });

  it("para de escrever em priority_ids, mantendo a ida e volta estável", () => {
    const local = normalizarEstado({ acoesIds: ["a", "b"], focus: "Vendas", wins: "w" });
    const row = estadoParaRow("2026-10-12", local);
    expect(row.priority_ids).toEqual([]);
    expect(row.complementary_ids).toEqual(["a", "b"]);
    expect(rowParaEstado(row)).toEqual(local);
  });
});
