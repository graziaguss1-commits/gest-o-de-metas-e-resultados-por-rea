import { describe, expect, it } from "vitest";
import { cumprimentoAgenda, escolherPrioridadeDoDia, type BlocoExecucao } from "./hoje";

const b = (p: Partial<BlocoExecucao> & { id: string }): BlocoExecucao => ({
  data: "2026-10-12", inicio: "09:00", fim: "10:00", tipo: "plano", ...p,
});

describe("cumprimentoAgenda", () => {
  const agora = new Date(2026, 9, 12, 12, 0);

  it("divide feitos pelos blocos cujo horário já passou, ignorando futuros", () => {
    const r = cumprimentoAgenda([
      b({ id: "1", concluido: true }),
      b({ id: "2", inicio: "10:00", fim: "11:00" }),
      b({ id: "3", inicio: "15:00", fim: "16:00" }),
      b({ id: "4", inicio: "17:00", fim: "18:00" }),
    ], agora);
    expect(r).toEqual({ feitos: 1, total: 2, pct: 50 });
  });

  it("não conta horários ocupados do Google", () => {
    const r = cumprimentoAgenda([b({ id: "1", concluido: true }), b({ id: "g", tipo: "google" })], agora);
    expect(r.total).toBe(1);
  });

  it("sem blocos passados retorna nulo em vez de 0%", () => {
    expect(cumprimentoAgenda([b({ id: "1", inicio: "15:00", fim: "16:00" })], agora).pct).toBeNull();
  });
});

describe("escolherPrioridadeDoDia", () => {
  it("prefere o bloco pendente de uma prioridade top", () => {
    const r = escolherPrioridadeDoDia([
      b({ id: "a", tarefaId: "x", inicio: "08:00" }),
      b({ id: "b", tarefaId: "top", inicio: "14:00", fim: "15:00" }),
    ], ["top"], new Date(2026, 9, 12, 7, 0));
    expect(r?.bloco.id).toBe("b");
    expect(r?.ehTop).toBe(true);
  });
});
