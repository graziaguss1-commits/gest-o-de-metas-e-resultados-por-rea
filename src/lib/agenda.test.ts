import { describe, expect, it } from "vitest";
import {
  capacidadeDoDia,
  comparativoTempo,
  configuracaoRecorrenciaCompleta,
  dataCorrespondeRecorrencia,
  diasSemanaisCompletos,
  diasRecorrenciaPersistida,
  execucoesEsperadasNaSemana,
  execucoesPlanejadasPorPeriodo,
  formatCronometro,
  labelMomentoRecorrencia,
  formatDuracao,
  formatTotalHoras,
  horariosLivres,
  horaFim,
  intervalosConflitam,
  labelDiasSemana,
  minutosReaisDoCronometro,
  segundosDoCronometro,
  totalSemana,
  type Agendamento,
} from "./agenda";

const ag = (
  id: string,
  data: string,
  hora: string,
  dur: number,
): Agendamento => ({
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

  it("identifica conflito sem bloquear horários consecutivos", () => {
    expect(intervalosConflitam("09:00", "11:00", "10:30", "12:00")).toBe(true);
    expect(intervalosConflitam("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });

  it("sugere somente horários em que a duração completa cabe", () => {
    const livres = horariosLivres(
      60,
      [{ inicio: "09:00", fim: "10:30" }],
      "08:00",
      "12:00",
    );
    expect(livres).toEqual(["08:00", "10:30", "11:00"]);
  });

  it("mede capacidade e sobrecarga do dia", () => {
    const ags = [
      ag("1", "2026-01-05", "09:00", 45),
      ag("2", "2026-01-05", "10:00", 120),
    ];
    const cap = capacidadeDoDia("2026-01-05", ags, 480);
    expect(cap.planejado).toBe(165);
    expect(cap.disponivel).toBe(315);
    expect(cap.sobrecarga).toBe(false);
    expect(capacidadeDoDia("2026-01-05", ags, 120).sobrecarga).toBe(true);
  });

  it("soma o tempo planejado da semana", () => {
    const ags = [
      ag("1", "2026-01-05", "09:00", 45),
      ag("2", "2026-01-06", "09:00", 45),
    ];
    expect(totalSemana(["2026-01-05", "2026-01-06"], ags)).toBe(90);
    expect(totalSemana(["2026-01-07"], ags)).toBe(0);
  });

  it("compara estimado e real sem substituir a estimativa", () => {
    expect(comparativoTempo(45, 55)).toBe("Estimado 45 min · Real 55 min");
    expect(comparativoTempo(45, null)).toBe("Estimado 45 min");
    expect(comparativoTempo(null, null)).toBeNull();
  });

  it("mantém e formata o tempo real do cronômetro", () => {
    const inicio = new Date("2026-08-24T12:00:00.000Z").getTime();
    const agendamento = {
      ...ag("timer", "2026-08-24", "09:00", 30),
      cronometro_segundos: 120,
      cronometro_iniciado_em: "2026-08-24T12:00:00.000Z",
    };
    const segundos = segundosDoCronometro(agendamento, inicio + 65_000);
    expect(segundos).toBe(185);
    expect(formatCronometro(segundos)).toBe("00:03:05");
    expect(minutosReaisDoCronometro(segundos)).toBe(3);
    expect(minutosReaisDoCronometro(10)).toBe(1);
  });

  it("rotula os dias de execução", () => {
    expect(labelDiasSemana([1, 2, 3, 4, 5])).toBe("Seg–Sex (dias úteis)");
    expect(labelDiasSemana([1, 2, 3, 4, 5, 6, 7])).toBe("Todos os dias");
    expect(labelDiasSemana([2, 4])).toBe("Ter, Qui");
    expect(labelDiasSemana(null)).toBeNull();
  });
});

describe("recorrências da agenda", () => {
  it("agenda uma rotina semanal apenas no dia escolhido", () => {
    expect(
      dataCorrespondeRecorrencia("semanal", new Date(2026, 7, 13), [4]),
    ).toBe(true);
    expect(
      dataCorrespondeRecorrencia("semanal", new Date(2026, 7, 14), [4]),
    ).toBe(false);
    expect(labelMomentoRecorrencia("semanal", [4])).toBe("Toda quinta");
  });

  it("permite uma rotina em vários dias da mesma semana", () => {
    expect(
      dataCorrespondeRecorrencia("semanal", new Date(2026, 7, 24), [1, 2, 4, 6]),
    ).toBe(true);
    expect(
      dataCorrespondeRecorrencia("semanal", new Date(2026, 7, 26), [1, 2, 4, 6]),
    ).toBe(false);
    expect(labelMomentoRecorrencia("semanal", [1, 2, 4, 6])).toBe(
      "Toda semana: Seg, Ter, Qui, Sáb",
    );
    expect(
      configuracaoRecorrenciaCompleta("semanal", 60, "09:00", [1, 2, 4, 6]),
    ).toBe(true);
    expect(diasSemanaisCompletos("semanal", 4, [1, 2, 4, 6])).toBe(true);
    expect(diasSemanaisCompletos("semanal", 4, [1])).toBe(false);
  });

  it("agenda avaliar DRE todo mês no dia 10", () => {
    expect(
      dataCorrespondeRecorrencia("mensal", new Date(2026, 8, 10), [10]),
    ).toBe(true);
    expect(
      dataCorrespondeRecorrencia("mensal", new Date(2026, 8, 11), [10]),
    ).toBe(false);
    expect(labelMomentoRecorrencia("mensal", [10])).toBe("Todo dia 10");
  });

  it("usa o último dia nos meses que não possuem o dia escolhido", () => {
    expect(
      dataCorrespondeRecorrencia("mensal", new Date(2027, 1, 28), [31]),
    ).toBe(true);
  });

  it("não considera completa uma recorrência sem dia, horário ou duração", () => {
    expect(configuracaoRecorrenciaCompleta("semanal", 60, "09:00", null)).toBe(
      false,
    );
    expect(configuracaoRecorrenciaCompleta("mensal", 60, "09:00", [10])).toBe(
      true,
    );
  });

  it("preserva os padrões das rotinas antigas", () => {
    expect(diasRecorrenciaPersistida("diaria", null)).toEqual([1, 2, 3, 4, 5]);
    expect(diasRecorrenciaPersistida("semanal", null)).toEqual([1]);
    expect(diasRecorrenciaPersistida("mensal", null)).toEqual([1]);
  });

  it("separa volume de resultado da quantidade de blocos na agenda", () => {
    expect(execucoesPlanejadasPorPeriodo({ execucoes_planejadas: 7 })).toBe(7);
    expect(execucoesPlanejadasPorPeriodo({ execucoes_planejadas: null })).toBe(
      1,
    );
  });

  it("multiplica execuções diárias pelos dias escolhidos da semana", () => {
    const semana = [
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ];
    expect(
      execucoesEsperadasNaSemana(
        {
          frequencia: "diaria",
          execucoes_planejadas: 1,
          dias_semana: [1, 2, 3, 4, 5],
        },
        semana,
      ),
    ).toBe(5);
    expect(
      execucoesEsperadasNaSemana(
        { frequencia: "semanal", execucoes_planejadas: 7 },
        semana,
      ),
    ).toBe(7);
  });
});
