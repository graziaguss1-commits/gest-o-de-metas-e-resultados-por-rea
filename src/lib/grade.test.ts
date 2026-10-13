import { describe, expect, it } from "vitest";
import {
  ALTURA_MINIMA,
  PX_POR_HORA,
  faixaHoras,
  minutosDestino,
  posicionarBlocos,
} from "@/lib/grade";

const bloco = (id: string, inicio: string, fim: string) => ({ id, inicio, fim });

describe("faixaHoras", () => {
  it("usa horário comercial quando não há nada no dia", () => {
    expect(faixaHoras([])).toEqual({ primeira: 6, ultima: 22 });
  });

  it("cobre do primeiro ao último bloco", () => {
    const faixa = faixaHoras([bloco("a", "06:00", "06:40"), bloco("b", "21:15", "21:45")]);
    expect(faixa).toEqual({ primeira: 6, ultima: 22 });
  });

  it("inclui a hora atual mesmo fora dos blocos", () => {
    const faixa = faixaHoras([bloco("a", "09:00", "09:30")], 23 * 60 + 10);
    expect(faixa.ultima).toBe(24);
  });

  it("garante no mínimo quatro horas visíveis", () => {
    const faixa = faixaHoras([bloco("a", "10:00", "10:30")]);
    expect(faixa.ultima - faixa.primeira).toBeGreaterThanOrEqual(4);
  });
});

describe("posicionarBlocos", () => {
  it("posiciona pelo horário, em pixels proporcionais", () => {
    const [primeiro] = posicionarBlocos([bloco("a", "07:00", "08:00")], 6);
    expect(primeiro.topo).toBe(PX_POR_HORA);
    expect(primeiro.altura).toBe(PX_POR_HORA);
  });

  it("não deixa bloco curto sumir", () => {
    const [curto] = posicionarBlocos([bloco("a", "07:00", "07:05")], 6);
    expect(curto.altura).toBe(ALTURA_MINIMA);
  });

  it("divide em colunas quando dois blocos se sobrepõem", () => {
    const posicionados = posicionarBlocos(
      [bloco("a", "21:10", "21:40"), bloco("b", "21:15", "21:45")],
      21,
    );
    expect(posicionados.map((p) => p.coluna)).toEqual([0, 1]);
    expect(posicionados.every((p) => p.colunas === 2)).toBe(true);
  });

  it("mantém largura cheia quando os blocos apenas se encostam", () => {
    const posicionados = posicionarBlocos(
      [bloco("a", "10:00", "10:30"), bloco("b", "10:30", "11:00")],
      10,
    );
    expect(posicionados.every((p) => p.colunas === 1)).toBe(true);
  });

  it("reaproveita a coluna livre depois que o bloco anterior termina", () => {
    const posicionados = posicionarBlocos(
      [
        bloco("longo", "09:00", "11:00"),
        bloco("curto1", "09:10", "09:40"),
        bloco("curto2", "10:00", "10:30"),
      ],
      9,
    );
    const porId = new Map(posicionados.map((p) => [p.bloco.id, p]));
    expect(porId.get("curto1")?.coluna).toBe(1);
    // curto2 começa depois de curto1 terminar, então volta para a mesma coluna.
    expect(porId.get("curto2")?.coluna).toBe(1);
    expect(porId.get("longo")?.colunas).toBe(2);
  });
});

describe("minutosDestino", () => {
  const base = { primeiraHora: 6, ultimaHora: 22, duracaoMinutos: 30 };

  it("usa o topo do bloco, descontando onde ele foi segurado", () => {
    // Bloco de 30 min (28px). Segurado no meio (14px) e solto com o cursor
    // na altura das 10:00 => o topo cai nas 10:00, não nas 10:15.
    const yCursor = (10 - 6) * PX_POR_HORA + 14;
    expect(minutosDestino({ ...base, yCursor, offsetY: 14 })).toBe(10 * 60);
  });

  it("sem desconto, o mesmo gesto erraria o horário", () => {
    const yCursor = (10 - 6) * PX_POR_HORA + 14;
    expect(minutosDestino({ ...base, yCursor, offsetY: 0 })).toBe(10 * 60 + 15);
  });

  it("encaixa de 15 em 15 minutos", () => {
    const yCursor = (9 - 6) * PX_POR_HORA + 5;
    expect(minutosDestino({ ...base, yCursor, offsetY: 0 }) % 15).toBe(0);
  });

  it("não deixa o bloco começar antes da grade", () => {
    expect(minutosDestino({ ...base, yCursor: -500, offsetY: 0 })).toBe(6 * 60);
  });

  it("não deixa o bloco terminar depois da grade", () => {
    const destino = minutosDestino({
      ...base,
      duracaoMinutos: 120,
      yCursor: 10000,
      offsetY: 0,
    });
    expect(destino).toBe(22 * 60 - 120);
  });
});
