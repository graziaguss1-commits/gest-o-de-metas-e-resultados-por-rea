import { describe, expect, it } from "vitest";
import {
  cumprimentoAgenda,
  escolherPrioridadeDoDia,
  referenciaBloco,
  type BlocoComOrigem,
} from "./hoje";

const b = (p: Partial<BlocoComOrigem> & { id: string }): BlocoComOrigem => ({
  data: "2026-10-12", inicio: "09:00", fim: "10:00", tipo: "plano",
  origemId: p.id, ...p,
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

describe("referenciaBloco", () => {
  it("usa um prefixo por origem", () => {
    expect(referenciaBloco(b({ id: "1", tipo: "plano" }))).toBe("ag:1");
    expect(referenciaBloco(b({ id: "2", tipo: "avulsa" }))).toBe("av:2");
    expect(referenciaBloco(b({ id: "3", tipo: "compromisso" }))).toBe("cp:3@2026-10-12");
  });

  it("bloco do Google não tem referência: não é dela", () => {
    expect(referenciaBloco(b({ id: "g", tipo: "google" }))).toBeNull();
  });
});

describe("escolherPrioridadeDoDia", () => {
  const manha = new Date(2026, 9, 12, 7, 0);

  it("devolve o bloco que ela marcou, mesmo sendo mais tarde", () => {
    const r = escolherPrioridadeDoDia([
      b({ id: "a", inicio: "08:00" }),
      b({ id: "b", inicio: "14:00", fim: "15:00" }),
    ], "ag:b", manha);
    expect(r?.bloco.id).toBe("b");
    expect(r?.ehTop).toBe(true);
  });

  it("sem marcação, sugere o próximo e avisa que não é escolha dela", () => {
    const r = escolherPrioridadeDoDia([
      b({ id: "a", inicio: "08:00" }),
      b({ id: "b", inicio: "14:00", fim: "15:00" }),
    ], null, manha);
    expect(r?.bloco.id).toBe("a");
    expect(r?.ehTop).toBe(false);
  });

  it("prioridade já concluída deixa de ser cobrada", () => {
    const r = escolherPrioridadeDoDia([
      b({ id: "a", inicio: "08:00" }),
      b({ id: "b", inicio: "14:00", fim: "15:00", concluido: true }),
    ], "ag:b", manha);
    expect(r?.bloco.id).toBe("a");
    expect(r?.ehTop).toBe(false);
  });

  it("marcação apontando para bloco que saiu do dia não quebra", () => {
    const r = escolherPrioridadeDoDia([b({ id: "a", inicio: "08:00" })], "ag:sumiu", manha);
    expect(r?.bloco.id).toBe("a");
    expect(r?.ehTop).toBe(false);
  });

  it("dia sem bloco pendente não tem prioridade", () => {
    expect(escolherPrioridadeDoDia([], "ag:b", manha)).toBeNull();
  });
});
