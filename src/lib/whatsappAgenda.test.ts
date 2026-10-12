import { describe, expect, it } from "vitest";
import {
  agoraEmSaoPaulo,
  blocosParaLembrar,
  mascararNumero,
  prioridadeDoDia,
  type Bloco,
} from "../../supabase/functions/whatsapp-agenda/logica";

const blocos: Bloco[] = [
  { ref: "a", titulo: "Reunião", inicio: "09:00" },
  { ref: "b", titulo: "Prospecção", inicio: "09:00", tarefaId: "top1" },
  { ref: "c", titulo: "Conteúdo", inicio: "14:00", tarefaId: "top2" },
];

describe("whatsapp-agenda", () => {
  it("10:30 UTC é 07:30 em São Paulo", () => {
    const sp = agoraEmSaoPaulo(new Date("2026-10-14T10:30:00Z"));
    expect(sp.data).toBe("2026-10-14");
    expect(sp.minutos).toBe(7 * 60 + 30);
    expect(sp.segunda).toBe("2026-10-12");
  });

  it("lembra só blocos de prioridade top que começam em até 7 minutos", () => {
    expect(blocosParaLembrar(blocos, ["top1", "top2"], 8 * 60 + 55).map((b) => b.ref)).toEqual(["b"]);
    expect(blocosParaLembrar(blocos, ["top1"], 8 * 60 + 50)).toEqual([]);
    expect(blocosParaLembrar(blocos, ["top1"], 9 * 60)).toEqual([]);
  });

  it("prioridade do dia segue a ordem das prioridades top", () => {
    expect(prioridadeDoDia(blocos, ["top2", "top1"])?.ref).toBe("c");
  });

  it("mascara o número de destino", () => {
    expect(mascararNumero("+55 11 98765-4321")).toBe("5511*******21");
  });
});
