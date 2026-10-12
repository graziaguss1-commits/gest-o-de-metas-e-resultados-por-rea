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
  it("preserva prioridades, foco e revisão ida e volta do banco", () => {
    const local = normalizarEstado({ priorityIds: ["a", "b", "c", "d"], complementaryIds: ["a", "e"], focus: "Vendas", wins: "w" });
    expect(local.priorityIds).toEqual(["a", "b", "c"]);
    expect(local.complementaryIds).toEqual(["e"]);
    expect(rowParaEstado(estadoParaRow("2026-10-12", local))).toEqual(local);
  });
});
