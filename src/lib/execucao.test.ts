import { describe, expect, it } from "vitest";
import {
  diagnosticar,
  execucaoPlano,
  execucaoTarefa,
  gargaloFunil,
  periodoCorrente,
  prazoConsumido,
  taxasFunil,
  type Execucao,
  type TarefaMensuravel,
} from "./execucao";
import { progressoReal } from "./metas";

const hoje = new Date(2026, 7, 13); // 13/08/2026 (quinta)

function tarefa(over: Partial<TarefaMensuravel> = {}): TarefaMensuravel {
  return {
    id: "t1",
    descricao: "Prospectar",
    concluida: false,
    frequencia: "diaria",
    quantidade_planejada: 10,
    unidade: "pessoas prospectadas",
    impacto: 8,
    esforco: 5,
    ...over,
  };
}

describe("execução dos planos", () => {
  it("mostra 7 de 10 pessoas prospectadas · 70%", () => {
    const execs: Execucao[] = [
      { id: "e1", tarefa_id: "t1", data_referencia: "2026-08-13", quantidade: 7 },
    ];
    const r = execucaoTarefa(tarefa(), execs, hoje);
    expect(r.pct).toBeCloseTo(0.7);
    expect(r.texto).toBe("7 de 10 pessoas prospectadas · 70%");
  });

  it("mostra 1 de 1 Reels · 100%", () => {
    const t = tarefa({ id: "t2", descricao: "Reels", quantidade_planejada: 1, unidade: "Reels" });
    const execs: Execucao[] = [
      { id: "e2", tarefa_id: "t2", data_referencia: "2026-08-13", quantidade: 1 },
    ];
    expect(execucaoTarefa(t, execs, hoje).texto).toBe("1 de 1 Reels · 100%");
  });

  it("considera apenas o período corrente, preservando histórico", () => {
    const execs: Execucao[] = [
      { id: "e1", tarefa_id: "t1", data_referencia: "2026-08-10", quantidade: 10 },
    ];
    expect(execucaoTarefa(tarefa(), execs, hoje).pct).toBe(0);
  });

  it("usa o checkbox para tarefas antigas sem registro", () => {
    const t = tarefa({ frequencia: null, quantidade_planejada: null, unidade: null, concluida: true });
    expect(execucaoTarefa(t, [], hoje).pct).toBe(1);
  });

  it("pondera a execução do plano pelo impacto", () => {
    const a = tarefa({ id: "a", impacto: 9 });
    const b = tarefa({ id: "b", impacto: 1, quantidade_planejada: 1 });
    const execs: Execucao[] = [
      { id: "e1", tarefa_id: "a", data_referencia: "2026-08-13", quantidade: 10 },
    ];
    // (1*9 + 0*1) / 10
    expect(execucaoPlano([a, b], execs, hoje)).toBeCloseTo(0.9);
  });

  it("calcula o período semanal de segunda a domingo", () => {
    expect(periodoCorrente("semanal", hoje)).toMatchObject({
      inicio: "2026-08-10",
      fim: "2026-08-16",
    });
  });
});

describe("resultado independe da execução", () => {
  it("meta 1 de 2 mentorados = 50% mesmo com planos 70% e 100%", () => {
    const resultado = progressoReal(1, 2, false);
    const execs: Execucao[] = [
      { id: "e1", tarefa_id: "t1", data_referencia: "2026-08-13", quantidade: 7 },
      { id: "e2", tarefa_id: "t2", data_referencia: "2026-08-13", quantidade: 1 },
    ];
    const planos = execucaoPlano(
      [tarefa(), tarefa({ id: "t2", quantidade_planejada: 1, unidade: "Reels", impacto: 8 })],
      execs,
      hoje,
    );
    expect(resultado).toBe(0.5);
    expect(Math.round(planos * 100)).toBe(85);
    expect(progressoReal(1, 2, false)).toBe(0.5); // execução não altera o resultado
  });
});

describe("prazo e diagnóstico", () => {
  it("calcula o prazo consumido", () => {
    expect(prazoConsumido("2026-08-01", "2026-08-31", hoje)).toBeGreaterThan(0.3);
    expect(prazoConsumido("2026-08-01", "2026-08-31", hoje)).toBeLessThan(0.5);
  });

  it("classifica os quatro cenários", () => {
    expect(diagnosticar(0.6, 0.9, 0.5).chave).toBe("na_rota");
    expect(diagnosticar(0.1, 0.2, 0.6).chave).toBe("falta_execucao");
    expect(diagnosticar(0.1, 0.9, 0.6).chave).toBe("revisar_estrategia");
    expect(diagnosticar(0.9, 0.2, 0.5).chave).toBe("resultado_insustentavel");
  });
});

describe("funil", () => {
  const etapas = [
    { id: "1", nome: "Prospectados", ordem: 0, valor: 100 },
    { id: "2", nome: "Reuniões", ordem: 1, valor: 20 },
    { id: "3", nome: "Propostas", ordem: 2, valor: 10 },
    { id: "4", nome: "Convertidos", ordem: 3, valor: 2 },
  ];

  it("calcula taxas entre etapas", () => {
    expect(taxasFunil(etapas).map((t) => Math.round(t.taxa * 100))).toEqual([20, 50, 20]);
  });

  it("identifica o maior gargalo", () => {
    expect(gargaloFunil(etapas)?.para).toBe("Reuniões");
  });
});
