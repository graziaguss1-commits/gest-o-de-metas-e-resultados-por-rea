import { describe, expect, it } from "vitest";
import { ritmoEmPalavras } from "@/lib/metas";

describe("ritmoEmPalavras", () => {
  it("diz a direção em palavras, sem sinal nem sigla", () => {
    expect(ritmoEmPalavras(-40)).toBe("40 pontos atrás");
    expect(ritmoEmPalavras(12)).toBe("12 pontos à frente");
  });

  it("trata oscilação de até 5 pontos como ritmo normal", () => {
    expect(ritmoEmPalavras(0)).toBe("no ritmo");
    expect(ritmoEmPalavras(4)).toBe("no ritmo");
    expect(ritmoEmPalavras(-4)).toBe("no ritmo");
  });

  it("sai do ritmo a partir de 5 pontos para cada lado", () => {
    expect(ritmoEmPalavras(5)).toBe("5 pontos à frente");
    expect(ritmoEmPalavras(-5)).toBe("5 pontos atrás");
  });
});
