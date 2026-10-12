import { describe, expect, it } from "vitest";
import { chaveMotivo, exigeTexto, MOTIVOS, referenciaBloco, resumoNaoExecutados, type MotivoId } from "./motivos";

const agora = new Date(2026, 9, 12, 12, 0);
const b = (id: string, p: Record<string, unknown> = {}) => ({
  id, origemId: id, data: "2026-10-12", inicio: "09:00", fim: "10:00", tipo: "plano" as const, ...p,
});

describe("motivos de blocos não executados", () => {
  it("usa a mesma referência da função de WhatsApp para as três origens", () => {
    expect(referenciaBloco(b("x"))).toBe("ag:x");
    expect(referenciaBloco(b("y", { tipo: "avulsa" }))).toBe("av:y");
    expect(referenciaBloco(b("s@2026-10-05", { tipo: "compromisso" }))).toBe("cp:s@2026-10-05");
    expect(referenciaBloco(b("u", { tipo: "compromisso" }))).toBe("cp:u@2026-10-12");
    expect(referenciaBloco(b("g", { tipo: "google" }))).toBeNull();
  });

  it("conta só blocos passados não feitos, sem Google, ordenando motivos por frequência", () => {
    const motivos = new Map<string, MotivoId>([
      [chaveMotivo("ag:1", "2026-10-12"), "adiei"],
      [chaveMotivo("ag:2", "2026-10-12"), "cansaco"],
      [chaveMotivo("ag:3", "2026-10-12"), "cansaco"],
    ]);
    const r = resumoNaoExecutados([
      b("1"), b("2"), b("3"), b("4"),
      b("5", { concluido: true }),
      b("6", { inicio: "15:00", fim: "16:00" }),
      b("g", { tipo: "google" }),
    ], motivos, agora);
    expect(r.total).toBe(4);
    expect(r.semMotivo).toBe(1);
    expect(r.porMotivo.map((m) => [m.motivo, m.total])).toEqual([["cansaco", 2], ["adiei", 1]]);
  });
});

describe("motivo Outro", () => {
  it("está na lista de motivos oferecidos", () => {
    expect(MOTIVOS.some((m) => m.id === "outro")).toBe(true);
  });

  it("é o único que exige texto escrito", () => {
    const comTexto = MOTIVOS.filter((m) => exigeTexto(m.id)).map((m) => m.id);
    expect(comTexto).toEqual(["outro"]);
  });
});
