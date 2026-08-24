/**
 * Duração estimada das ações, agendamento por horário e capacidade da agenda.
 *
 * Regras documentadas:
 * 1. `duracao_minutos` é a estimativa POR EXECUÇÃO da ação. É diferente do
 *    prazo/data final (quando a ação deve terminar) e da quantidade planejada.
 * 2. Ações antigas sem estimativa permanecem `null` — nunca inventamos duração.
 * 3. Ocorrências agendadas são registros reais (`tarefa_agendamentos`) criados
 *    apenas para o período visível/escolhido pela usuária. Nada é gerado
 *    automaticamente para o futuro infinito. Rotinas diárias, semanais e mensais
 *    são materializadas somente dentro da semana que está sendo visualizada.
 * 4. Tempo real gasto (`tempo_real_minutos`) nunca substitui a estimativa;
 *    serve só para comparação "Estimado 45 min · Real 55 min".
 */

export const DURACAO_PRESETS = [15, 30, 45, 60, 90, 120] as const;

/** 1 = segunda … 7 = domingo (ISO). */
export const DIAS_SEMANA = [
  { valor: 1, curto: "Seg", longo: "Segunda" },
  { valor: 2, curto: "Ter", longo: "Terça" },
  { valor: 3, curto: "Qua", longo: "Quarta" },
  { valor: 4, curto: "Qui", longo: "Quinta" },
  { valor: 5, curto: "Sex", longo: "Sexta" },
  { valor: 6, curto: "Sáb", longo: "Sábado" },
  { valor: 7, curto: "Dom", longo: "Domingo" },
] as const;

export const DIAS_UTEIS = [1, 2, 3, 4, 5];
export const TODOS_OS_DIAS = [1, 2, 3, 4, 5, 6, 7];

/** Dia ISO (1=segunda … 7=domingo) de uma data. */
export function diaISO(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

/** "45 min", "1h", "1h30". Retorna null quando não há estimativa. */
export function formatDuracao(minutos?: number | null): string | null {
  const m = Number(minutos ?? 0);
  if (!Number.isFinite(m) || m <= 0) return null;
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h}h`;
  return `${h}h${String(rest).padStart(2, "0")}`;
}

/** "4h30" para totais da agenda (0 vira "0h"). */
export function formatTotalHoras(minutos: number): string {
  return formatDuracao(minutos) ?? "0h";
}

/** "09:00" + 45 => "09:45" (limitado a 23:59). */
export function horaFim(horaInicio: string, duracaoMinutos: number): string {
  const [h, m] = horaInicio.split(":").map(Number);
  const total = Math.min(
    h * 60 + m + Math.max(0, duracaoMinutos),
    23 * 60 + 59,
  );
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "09:00:00" -> "09:00" */
export function hhmm(hora?: string | null): string {
  return (hora ?? "").slice(0, 5);
}

/** Converte "09:30" em minutos desde 00:00. */
export function horarioEmMinutos(hora: string): number {
  const [h, m] = hhmm(hora).split(":").map(Number);
  if (
    !Number.isInteger(h) ||
    !Number.isInteger(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return Number.NaN;
  }
  return h * 60 + m;
}

/** Converte minutos desde 00:00 em "09:30". */
export function minutosEmHorario(minutos: number): string {
  const total = Math.min(23 * 60 + 59, Math.max(0, Math.round(minutos)));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export type IntervaloHorario = {
  inicio: string;
  fim: string;
};

/** Intervalos que apenas se encostam (09:00–10:00 e 10:00–11:00) não conflitam. */
export function intervalosConflitam(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
): boolean {
  const aInicio = horarioEmMinutos(inicioA);
  const aFim = horarioEmMinutos(fimA);
  const bInicio = horarioEmMinutos(inicioB);
  const bFim = horarioEmMinutos(fimB);
  if (![aInicio, aFim, bInicio, bFim].every(Number.isFinite)) return false;
  return aInicio < bFim && aFim > bInicio;
}

/** Retorna todos os inícios livres, em passos de 30 minutos, dentro do expediente visual. */
export function horariosLivres(
  duracaoMinutos: number,
  ocupados: IntervaloHorario[],
  inicioDia = "06:00",
  fimDia = "22:00",
  passo = 30,
): string[] {
  if (!Number.isFinite(duracaoMinutos) || duracaoMinutos <= 0) return [];
  const inicio = horarioEmMinutos(inicioDia);
  const fim = horarioEmMinutos(fimDia);
  if (![inicio, fim].every(Number.isFinite) || inicio >= fim) return [];

  const livres: string[] = [];
  for (let minuto = inicio; minuto + duracaoMinutos <= fim; minuto += passo) {
    const horaInicio = minutosEmHorario(minuto);
    const horaFinal = minutosEmHorario(minuto + duracaoMinutos);
    const conflito = ocupados.some((bloco) =>
      intervalosConflitam(horaInicio, horaFinal, bloco.inicio, bloco.fim),
    );
    if (!conflito) livres.push(horaInicio);
  }
  return livres;
}

export type Agendamento = {
  id: string;
  tarefa_id: string;
  data: string;
  hora_inicio: string;
  duracao_minutos: number;
  observacao?: string | null;
  /** Momento da sessão ativa; nulo quando o cronômetro está pausado. */
  cronometro_iniciado_em?: string | null;
  /** Total já consolidado nas pausas anteriores. */
  cronometro_segundos?: number | null;
  /** Usuário que iniciou o cronômetro desta ocorrência. */
  cronometro_usuario_id?: string | null;
};

/** Total do cronômetro, incluindo a sessão ainda em andamento. */
export function segundosDoCronometro(
  agendamento: Pick<
    Agendamento,
    "cronometro_iniciado_em" | "cronometro_segundos"
  >,
  agoraMs: number = Date.now(),
): number {
  const acumulado = Math.max(0, Number(agendamento.cronometro_segundos ?? 0));
  if (!agendamento.cronometro_iniciado_em) return Math.floor(acumulado);
  const inicio = new Date(agendamento.cronometro_iniciado_em).getTime();
  if (!Number.isFinite(inicio)) return Math.floor(acumulado);
  return Math.floor(acumulado + Math.max(0, agoraMs - inicio) / 1000);
}

/** Exibe o cronômetro em HH:MM:SS. */
export function formatCronometro(segundos: number): string {
  const total = Math.max(0, Math.floor(Number(segundos) || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const restante = total % 60;
  return [horas, minutos, restante]
    .map((valor) => String(valor).padStart(2, "0"))
    .join(":");
}

/** Minutos reais gravados na execução; qualquer uso positivo registra ao menos 1 min. */
export function minutosReaisDoCronometro(segundos: number): number | null {
  if (!Number.isFinite(segundos) || segundos <= 0) return null;
  return Math.max(1, Math.round(segundos / 60));
}

export type CapacidadeDia = {
  data: string;
  planejado: number;
  capacidade: number;
  disponivel: number;
  sobrecarga: boolean;
};

/** Soma dos minutos agendados em um dia frente à capacidade configurada. */
export function capacidadeDoDia(
  data: string,
  agendamentos: Agendamento[],
  capacidadeMinutos: number,
): CapacidadeDia {
  const planejado = agendamentos
    .filter((a) => a.data === data)
    .reduce((acc, a) => acc + (Number(a.duracao_minutos) || 0), 0);
  return {
    data,
    planejado,
    capacidade: capacidadeMinutos,
    disponivel: Math.max(0, capacidadeMinutos - planejado),
    sobrecarga: planejado > capacidadeMinutos,
  };
}

/** Total de minutos agendados no conjunto de dias informado. */
export function totalSemana(
  datas: string[],
  agendamentos: Agendamento[],
): number {
  const set = new Set(datas);
  return agendamentos
    .filter((a) => set.has(a.data))
    .reduce((acc, a) => acc + (Number(a.duracao_minutos) || 0), 0);
}

/** "Estimado 45 min · Real 55 min" (ou null quando faltar algum dos dois). */
export function comparativoTempo(
  estimado?: number | null,
  real?: number | null,
): string | null {
  const e = formatDuracao(estimado);
  const r = formatDuracao(real);
  if (!e && !r) return null;
  if (e && r) return `Estimado ${e} · Real ${r}`;
  return e ? `Estimado ${e}` : `Real ${r}`;
}

/** Rótulo dos dias de execução de uma ação recorrente. */
export function labelDiasSemana(dias?: number[] | null): string | null {
  if (!dias || dias.length === 0) return null;
  const ord = [...new Set(dias)].sort((a, b) => a - b);
  if (ord.length === 7) return "Todos os dias";
  if (ord.length === 5 && ord.every((d) => d <= 5))
    return "Seg–Sex (dias úteis)";
  return ord
    .map((d) => DIAS_SEMANA.find((x) => x.valor === d)?.curto)
    .filter(Boolean)
    .join(", ");
}

/** Dia mensal armazenado em `dias_semana[0]` para manter compatibilidade sem migration. */
export function diaMesRecorrencia(dias?: number[] | null): number | null {
  const dia = Number(dias?.[0]);
  return Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null;
}

/**
 * Compatibilidade com rotinas salvas antes da escolha explícita do momento.
 * Diárias eram seg–sex; semanais eram segunda; mensais eram dia 1.
 */
export function diasRecorrenciaPersistida(
  frequencia?: string | null,
  dias?: number[] | null,
): number[] | null {
  if (dias?.length) return dias;
  if (frequencia === "diaria") return [...DIAS_UTEIS];
  if (frequencia === "semanal" || frequencia === "mensal") return [1];
  return null;
}

/** Confirma se uma rotina possui todos os dados necessários para entrar na agenda. */
export function configuracaoRecorrenciaCompleta(
  frequencia?: string | null,
  duracaoMinutos?: number | null,
  horarioPreferencial?: string | null,
  dias?: number[] | null,
): boolean {
  if (!["diaria", "semanal", "mensal"].includes(frequencia ?? "")) return true;
  if (!duracaoMinutos || duracaoMinutos <= 0 || !horarioPreferencial)
    return false;

  if (frequencia === "mensal") return diaMesRecorrencia(dias) != null;

  const diasValidos = (dias ?? []).filter(
    (dia) => Number.isInteger(dia) && dia >= 1 && dia <= 7,
  );
  return diasValidos.length > 0;
}

/**
 * Em uma rotina semanal de até sete execuções, cada execução precisa de um
 * dia preferido distinto. Acima disso, os blocos extras são posicionados no
 * planejamento semanal.
 */
export function diasSemanaisCompletos(
  frequencia: string,
  execucoes: number,
  dias?: number[] | null,
): boolean {
  if (frequencia !== "semanal") return true;
  const quantidade = execucoesPlanejadasPorPeriodo({
    execucoes_planejadas: execucoes,
  });
  const diasValidos = [...new Set(dias ?? [])].filter(
    (dia) => Number.isInteger(dia) && dia >= 1 && dia <= 7,
  ).length;
  return quantidade <= 7 ? diasValidos === quantidade : diasValidos > 0;
}

/** Verifica se uma data pertence ao padrão diário, semanal ou mensal configurado. */
export function dataCorrespondeRecorrencia(
  frequencia: string,
  date: Date,
  dias?: number[] | null,
): boolean {
  if (frequencia === "mensal") {
    const diaDesejado = diaMesRecorrencia(dias);
    if (!diaDesejado) return false;
    const ultimoDia = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
    ).getDate();
    return date.getDate() === Math.min(diaDesejado, ultimoDia);
  }

  if (frequencia === "diaria" || frequencia === "semanal") {
    return (dias ?? []).includes(diaISO(date));
  }

  return false;
}

export type ConfiguracaoExecucoesAgenda = {
  frequencia?: string | null;
  execucoes_planejadas?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  dias_semana?: number[] | null;
};

/** Quantidade de blocos configurada por período, sempre entre 1 e 100. */
export function execucoesPlanejadasPorPeriodo(
  tarefa: Pick<ConfiguracaoExecucoesAgenda, "execucoes_planejadas">,
): number {
  const quantidade = Math.round(Number(tarefa.execucoes_planejadas ?? 1));
  if (!Number.isFinite(quantidade)) return 1;
  return Math.min(100, Math.max(1, quantidade));
}

/**
 * Converte a configuração da ação na quantidade de blocos exigida pelo
 * planejamento semanal. Em ações diárias, o total é por dia escolhido; nas
 * demais frequências, é o total do próprio período.
 */
export function execucoesEsperadasNaSemana(
  tarefa: ConfiguracaoExecucoesAgenda,
  datasDaSemana: string[],
): number {
  const porPeriodo = execucoesPlanejadasPorPeriodo(tarefa);
  if (tarefa.frequencia !== "diaria") return porPeriodo;

  const dias = diasRecorrenciaPersistida(tarefa.frequencia, tarefa.dias_semana);
  const diasAtivos = datasDaSemana.filter((data) => {
    if (
      (tarefa.data_inicio && data < tarefa.data_inicio) ||
      (tarefa.data_fim && data > tarefa.data_fim)
    ) {
      return false;
    }
    return dataCorrespondeRecorrencia(
      tarefa.frequencia ?? "diaria",
      new Date(`${data}T12:00:00`),
      dias,
    );
  }).length;

  // Se a ação foi escolhida manualmente fora da vigência, ainda exige um
  // bloco; assim ela nunca é confirmada sem horário por acidente.
  return Math.max(1, diasAtivos) * porPeriodo;
}

/** Rótulo gerencial do momento escolhido: "Toda terça" ou "Todo dia 10". */
export function labelMomentoRecorrencia(
  frequencia?: string | null,
  dias?: number[] | null,
): string | null {
  if (frequencia === "mensal") {
    const dia = diaMesRecorrencia(dias);
    if (!dia) return null;
    return `Todo dia ${dia}${dia > 28 ? " (ou no último dia)" : ""}`;
  }

  if (frequencia === "semanal") {
    const diasValidos = [...new Set(dias ?? [])]
      .filter((dia) => Number.isInteger(dia) && dia >= 1 && dia <= 7)
      .sort((a, b) => a - b);
    if (diasValidos.length === 1) {
      const dia = DIAS_SEMANA.find((item) => item.valor === diasValidos[0]);
      return dia ? `Toda ${dia.longo.toLowerCase()}` : null;
    }
    const rotulo = labelDiasSemana(diasValidos);
    return rotulo ? `Toda semana: ${rotulo}` : null;
  }

  if (frequencia === "diaria") return labelDiasSemana(dias);
  return null;
}
