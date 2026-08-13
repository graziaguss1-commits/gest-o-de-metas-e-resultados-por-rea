import { describe, expect, it } from "vitest";
import {
  capacidadeDoDia,
  comparativoTempo,
  formatDuracao,
  formatTotalHoras,
  horaFim,
  labelDiasSemana,
  totalSemana,
  type Agendamento,
} from "./agenda";

const ag = (id: string, data: string, hora: string, dur: number): Agendamento => ({
  id,
  tarefa_id: "t1",
  data,
  hora_inicio: hora,
  duracao_minutos: dur,
});

describe("agenda", () => {
  it("formata durações amigáveis", () => {
    expect(formatDuracao(45)).toBe("45 min");
    expect(formatDuracao(60)).toBe("1h");
    expect(formatDuracao(90)).toBe("1h30");
    expect(formatDuracao(null)).toBeNull();
    expect(formatTotalHoras(0)).toBe("0h");
  });

  it("calcula o fim do bloco a partir da duração", () => {
    expect(horaFim("09:00", 45)).toBe("09:45");
    expect(horaFim("23:30", 120)).toBe("23:59");
  });

  it("mede capacidade e sobrecarga do dia", () => {
    const ags = [ag("1", "2026-01-05", "09:00", 45), ag("2", "2026-01-05", "10:00", 120)];
    const cap = capacidadeDoDia("2026-01-05", ags, 480);
    expect(cap.planejado).toBe(165);
    expect(cap.disponivel).toBe(315);
    expect(cap.sobrecarga).toBe(false);
    expect(capacidadeDoDia("2026-01-05", ags, 120).sobrecarga).toBe(true);
  });

  it("soma o tempo planejado da semana", () => {
    const ags = [ag("1", "2026-01-05", "09:00", 45), ag("2", "2026-01-06", "09:00", 45)];
    expect(totalSemana(["2026-01-05", "2026-01-06"], ags)).toBe(90);
    expect(totalSemana(["2026-01-07"], ags)).toBe(0);
  });

  it("compara estimado e real sem substituir a estimativa", () => {
    expect(comparativoTempo(45, 55)).toBe("Estimado 45 min · Real 55 min");
    expect(comparativoTempo(45, null)).toBe("Estimado 45 min");
    expect(comparativoTempo(null, null)).toBeNull();
  });

  it("rotula os dias de execução", () => {
    expect(labelDiasSemana([1, 2, 3, 4, 5])).toBe("Seg–Sex (dias úteis)");
    expect(labelDiasSemana([1, 2, 3, 4, 5, 6, 7])).toBe("Todos os dias");
    expect(labelDiasSemana([2, 4])).toBe("Ter, Qui");
    expect(labelDiasSemana(null)).toBeNull();
  });
});
