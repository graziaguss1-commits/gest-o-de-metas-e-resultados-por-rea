import { describe, expect, it } from "vitest";
import { prazoEmPalavras } from "@/lib/metas";

const HOJE = new Date(2026, 9, 27); // 27/10/2026

describe("prazoEmPalavras", () => {
  it("responde a pergunta que importa: ainda dá tempo?", () => {
    expect(prazoEmPalavras("2026-10-31", HOJE)).toBe("faltam 4 dias");
    expect(prazoEmPalavras("2026-09-25", HOJE)).toBe("venceu há 32 dias");
  });

  it("trata hoje e ontem sem plural errado", () => {
    expect(prazoEmPalavras("2026-10-27", HOJE)).toBe("vence hoje");
    expect(prazoEmPalavras("2026-10-28", HOJE)).toBe("falta 1 dia");
    expect(prazoEmPalavras("2026-10-26", HOJE)).toBe("venceu ontem");
  });

  it("vira mês quando o número de dias deixa de ajudar", () => {
    expect(prazoEmPalavras("2027-03-31", HOJE)).toBe("faltam 5 meses");
    expect(prazoEmPalavras("2026-07-31", HOJE)).toBe("venceu há 3 meses");
  });

  it("não depende da hora do dia em que a tela foi aberta", () => {
    const manha = new Date(2026, 9, 27, 6, 0);
    const noite = new Date(2026, 9, 27, 23, 30);
    expect(prazoEmPalavras("2026-10-31", manha)).toBe(prazoEmPalavras("2026-10-31", noite));
  });
});
