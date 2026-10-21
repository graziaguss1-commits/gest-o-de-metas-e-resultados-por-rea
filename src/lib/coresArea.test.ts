import { describe, expect, it } from "vitest";
import { AREAS_COM_COR, chaveArea, coresDoBloco } from "@/lib/coresArea";

const hex2rgb = (h: string) => {
  const v = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
};
const lum = (rgb: number[]) => {
  const [r, g, b] = rgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [la, lb] = [lum(hex2rgb(a)), lum(hex2rgb(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

describe("chaveArea", () => {
  it("ignora acento, caixa e espaços", () => {
    expect(chaveArea("Clínica")).toBe("clinica");
    expect(chaveArea("  SAÚDE ")).toBe("saude");
  });

  it("vira string vazia quando não há área", () => {
    expect(chaveArea(null)).toBe("");
    expect(chaveArea(undefined)).toBe("");
  });
});

describe("coresDoBloco", () => {
  it("dá cores diferentes para áreas diferentes", () => {
    const clinica = coresDoBloco("Clínica", false);
    const saude = coresDoBloco("Saúde", false);
    expect(clinica.fundo).not.toBe(saude.fundo);
  });

  it("concluído usa a mesma família, mais clara", () => {
    const pendente = coresDoBloco("Clínica", false);
    const concluido = coresDoBloco("Clínica", true);
    expect(concluido.fundo).not.toBe(pendente.fundo);
    // Mais claro = luminância maior.
    expect(lum(hex2rgb(concluido.fundo))).toBeGreaterThan(
      lum(hex2rgb(pendente.fundo)),
    );
    expect(lum(hex2rgb(concluido.texto))).toBeGreaterThan(
      lum(hex2rgb(pendente.texto)),
    );
  });

  it("cai na cor neutra quando a área é desconhecida", () => {
    const semArea = coresDoBloco(null, false);
    const inventada = coresDoBloco("Jardinagem", false);
    expect(inventada).toEqual(semArea);
  });

  it("todos os pares passam em 4,5:1, nos dois estados", () => {
    const areas = [...AREAS_COM_COR.map((a) => a.area), null];
    areas.forEach((area) => {
      [false, true].forEach((concluido) => {
        const { fundo, texto } = coresDoBloco(area, concluido);
        expect(
          contraste(fundo, texto),
          `${area ?? "sem área"} · ${concluido ? "concluído" : "pendente"}`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  it("a legenda cobre as seis áreas, sem cor repetida", () => {
    expect(AREAS_COM_COR).toHaveLength(6);
    const cores = new Set(AREAS_COM_COR.map((a) => a.cor));
    expect(cores.size).toBe(6);
  });
});
