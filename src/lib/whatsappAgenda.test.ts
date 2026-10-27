import { describe, expect, it } from "vitest";
import {
  agoraEmSaoPaulo,
  blocosParaLembrar,
  extrairSlots,
  janelaDoMomento,
  JANELAS,
  mascararNumero,
  mensagemLembrete,
  mesclarLinhas,
  montarMensagem,
  slotsDaJanela,
  prioridadeDoDia,
  semanaDoPlano,
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

  it("lembra de todo bloco que começa em até 7 minutos, não só da prioridade", () => {
    // 08:55: faltam 5 min para os dois blocos das 09:00, e ambos avisam.
    expect(blocosParaLembrar(blocos, 8 * 60 + 55).map((b) => b.ref).sort()).toEqual(["a", "b"]);
  });

  it("não lembra cedo demais nem depois da hora", () => {
    expect(blocosParaLembrar(blocos, 8 * 60 + 50)).toEqual([]);
    expect(blocosParaLembrar(blocos, 9 * 60)).toEqual([]);
  });

  it("não lembra do que já foi marcado", () => {
    const feito = blocos.map((b) => ({ ...b, concluido: true }));
    expect(blocosParaLembrar(feito, 8 * 60 + 55)).toEqual([]);
  });

  it("prioridade do dia é a que ela marcou", () => {
    expect(prioridadeDoDia(blocos, "c")?.ref).toBe("c");
  });

  it("sem marcação não existe prioridade, e o código não inventa uma", () => {
    expect(prioridadeDoDia(blocos, null)).toBeNull();
  });

  it("prioridade já cumprida deixa de ser prioridade", () => {
    const feita = blocos.map((b) => (b.ref === "c" ? { ...b, concluido: true } : b));
    expect(prioridadeDoDia(feita, "c")).toBeNull();
  });

  it("marcação apontando para bloco que não está no dia devolve null", () => {
    expect(prioridadeDoDia(blocos, "ag:sumiu")).toBeNull();
  });

  it("o lembrete diz quando o bloco é a prioridade do dia", () => {
    const bloco = blocos[0];
    expect(mensagemLembrete(bloco, true)).toContain("prioridade de hoje");
    expect(mensagemLembrete(bloco, false)).not.toContain("prioridade de hoje");
  });

  it("mascara o número de destino", () => {
    expect(mascararNumero("+55 11 98765-4321")).toBe("5511*******21");
  });
});

describe("semanaDoPlano", () => {
  it("sem data de início, não há plano em curso", () => {
    expect(semanaDoPlano(null, "2026-10-23")).toBeNull();
  });

  it("o próprio dia do início já é a semana 1", () => {
    expect(semanaDoPlano("2026-10-23", "2026-10-23")).toBe(1);
  });

  it("avança de 7 em 7 dias", () => {
    expect(semanaDoPlano("2026-10-23", "2026-10-29")).toBe(1);
    expect(semanaDoPlano("2026-10-23", "2026-10-30")).toBe(2);
    expect(semanaDoPlano("2026-10-23", "2026-11-13")).toBe(4);
  });

  it("encerra depois da quarta semana", () => {
    expect(semanaDoPlano("2026-10-23", "2026-11-20")).toBeNull();
  });

  it("data futura não começa o plano antes da hora", () => {
    expect(semanaDoPlano("2026-11-01", "2026-10-23")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Janelas do coach
// ---------------------------------------------------------------------------

const b = (inicio: string, titulo: string, extra: Partial<Bloco> = {}): Bloco => ({
  ref: `r:${inicio}:${titulo}`,
  titulo,
  inicio,
  duracaoMinutos: 30,
  ...extra,
});

const manha = JANELAS[0];
const meioDia = JANELAS[1];

describe("janelaDoMomento", () => {
  it("reconhece cada horário de envio", () => {
    expect(janelaDoMomento(7 * 60 + 30)?.id).toBe("manha");
    expect(janelaDoMomento(11 * 60 + 30)?.id).toBe("meio_dia");
    expect(janelaDoMomento(13 * 60 + 30)?.id).toBe("tarde");
    expect(janelaDoMomento(18 * 60 + 30)?.id).toBe("noite");
  });

  it("tolera o atraso do cron", () => {
    expect(janelaDoMomento(7 * 60 + 44)?.id).toBe("manha");
  });

  it("fora de qualquer janela não manda nada", () => {
    expect(janelaDoMomento(16 * 60)).toBeNull();
    expect(janelaDoMomento(7 * 60 + 29)).toBeNull();
    // Passada a tolerância, a mensagem da manhã não sai mais.
    expect(janelaDoMomento(8 * 60 + 30)).toBeNull();
  });
});

describe("slotsDaJanela", () => {
  it("agrupa tarefas que começam no mesmo horário", () => {
    const { slots } = slotsDaJanela(
      [b("10:00", "Postar reels"), b("10:00", "Seguir 10 médicos"), b("08:15", "Gratidão")],
      manha,
    );
    expect(slots.map((s) => s.inicio)).toEqual(["08:15", "10:00"]);
    expect(slots[1].blocos).toHaveLength(2);
  });

  it("ignora o que já foi marcado", () => {
    const { slots } = slotsDaJanela(
      [b("08:00", "Feita", { concluido: true }), b("09:00", "Pendente")],
      manha,
    );
    expect(slots.map((s) => s.inicio)).toEqual(["09:00"]);
  });

  it("não mostra o que é de uma janela mais adiante", () => {
    const { slots } = slotsDaJanela([b("14:00", "Pendências da clínica")], manha);
    expect(slots).toHaveLength(0);
  });

  it("a tarefa das 14h chega na mensagem das 13:30, antes de começar", () => {
    const tarde = JANELAS[2];
    expect(tarde.envio).toBeLessThan(14 * 60);
    const { slots } = slotsDaJanela([b("14:00", "Pendências da clínica")], tarde);
    expect(slots.map((s) => s.inicio)).toEqual(["14:00"]);
  });

  it("toda janela avisa antes, nunca depois do próprio bloco", () => {
    // O envio de cada janela tem de ser anterior ao fim dela, senão a
    // mensagem vira relatório do que já passou.
    for (const j of JANELAS) expect(j.envio).toBeLessThan(j.ate);
  });

  it("carrega o atrasado para a janela seguinte", () => {
    // Bloco das 08:00 não marcado continua aparecendo às 11:30.
    const { slots } = slotsDaJanela([b("08:00", "Mural")], meioDia);
    expect(slots.map((s) => s.inicio)).toEqual(["08:00"]);
  });

  it("corta em três horários e conta o resto", () => {
    const { slots, restantes } = slotsDaJanela(
      [b("07:00", "a"), b("08:00", "b"), b("09:00", "c"), b("10:00", "d"), b("11:00", "e")],
      manha,
    );
    expect(slots).toHaveLength(3);
    expect(restantes).toBe(2);
  });
});

describe("mesclarLinhas", () => {
  it("o texto dela ganha do texto do coach", () => {
    const { slots } = slotsDaJanela([b("09:00", "Treinar", { primeiroPasso: "calçar o tênis" })], manha);
    const linhas = mesclarLinhas(
      slots,
      new Map([["09:00", { primeiroPasso: "abrir o app", versaoMinima: "10 min", frase: "vai" }]]),
    );
    expect(linhas.get("09:00")?.primeiroPasso).toBe("calçar o tênis");
    // O que ela não escreveu, o coach preenche.
    expect(linhas.get("09:00")?.versaoMinima).toBe("10 min");
  });

  it("campo em branco dela não vence o do coach", () => {
    const { slots } = slotsDaJanela([b("09:00", "Treinar", { primeiroPasso: "   " })], manha);
    const linhas = mesclarLinhas(slots, new Map([["09:00", { primeiroPasso: "abrir o app" }]]));
    expect(linhas.get("09:00")?.primeiroPasso).toBe("abrir o app");
  });

  it("horário com várias tarefas usa o texto do coach", () => {
    const { slots } = slotsDaJanela(
      [b("10:00", "Reels", { primeiroPasso: "abrir o editor" }), b("10:00", "Seguir médicos")],
      manha,
    );
    const linhas = mesclarLinhas(slots, new Map([["10:00", { primeiroPasso: "escolher o primeiro" }]]));
    expect(linhas.get("10:00")?.primeiroPasso).toBe("escolher o primeiro");
  });
});

describe("montarMensagem", () => {
  const base = {
    slots: slotsDaJanela([b("07:50", "Ativar estado de recurso 1", { duracaoMinutos: 5 })], manha).slots,
    restantes: 0,
    linhas: new Map([["07:50", { primeiroPasso: "dizer a frase em voz alta", versaoMinima: "1 minuto", frase: "dá o tom da manhã" }]]),
  };

  it("monta o horário com as três linhas", () => {
    const txt = montarMensagem({ ...base, janela: manha, foco: "fechar 3 tarefas", minutosPlanejados: 285, capacidadePlanejavel: 504 });
    expect(txt).toContain("⏰ 07:50 · Ativar estado de recurso 1 (5 min)");
    expect(txt).toContain("1️⃣ Primeiro passo: dizer a frase em voz alta");
    expect(txt).toContain("📉 Versão mínima: 1 minuto");
    expect(txt).toContain("💭 dá o tom da manhã");
  });

  it("mostra minutos absolutos junto da porcentagem", () => {
    const txt = montarMensagem({ ...base, janela: manha, foco: "x", minutosPlanejados: 285, capacidadePlanejavel: 504 });
    expect(txt).toContain("285 min planejados de 504 planejáveis (57%)");
    expect(txt).toContain("Folga de 3h39");
    expect(txt).not.toContain("⚠️");
  });

  it("avisa quando passa do limiar", () => {
    const txt = montarMensagem({ ...base, janela: manha, foco: "x", minutosPlanejados: 400, capacidadePlanejavel: 504 });
    expect(txt).toContain("⚠️");
  });

  it("campo vazio some em vez de virar linha em branco", () => {
    const txt = montarMensagem({ ...base, janela: manha, linhas: new Map([["07:50", { frase: "só isso" }]]), foco: "x" });
    expect(txt).not.toContain("Primeiro passo");
    expect(txt).toContain("💭 só isso");
  });

  it("a janela do meio não repete foco nem carga", () => {
    const txt = montarMensagem({ ...base, janela: meioDia, minutosPlanejados: 285, capacidadePlanejavel: 504 });
    expect(txt).not.toContain("Foco da semana");
    expect(txt).not.toContain("planejáveis");
    expect(txt).toContain("Próxima às 13:30.");
  });

  it("a última janela não promete próxima mensagem", () => {
    const txt = montarMensagem({ ...base, janela: JANELAS[3] });
    expect(txt).not.toContain("Próxima às");
  });
});

describe("extrairSlots", () => {
  it("lê o JSON do modelo", () => {
    const m = extrairSlots('{"slots":[{"hora":"07:50","primeiro_passo":"a","versao_minima":"b","frase":"c"}]}');
    expect(m?.get("07:50")).toEqual({ primeiroPasso: "a", versaoMinima: "b", frase: "c" });
  });

  it("tolera cerca de código e texto em volta", () => {
    const m = extrairSlots('Claro!\n```json\n{"slots":[{"hora":"10:00","frase":"vai"}]}\n```');
    expect(m?.get("10:00")?.frase).toBe("vai");
  });

  it("campo vazio vira null, não string vazia", () => {
    const m = extrairSlots('{"slots":[{"hora":"10:00","frase":"   ","primeiro_passo":"x"}]}');
    expect(m?.get("10:00")?.frase).toBeNull();
    expect(m?.get("10:00")?.primeiroPasso).toBe("x");
  });

  it("devolve null quando não dá para ler", () => {
    expect(extrairSlots("desculpe, não consegui")).toBeNull();
    expect(extrairSlots('{"slots":[]}')).toBeNull();
    expect(extrairSlots('{"slots":[{"hora":"amanhã"}]}')).toBeNull();
  });
});
