// Regras puras do aviso diário/lembretes (sem dependências do Deno, testáveis).

export const FUSO = "America/Sao_Paulo";
// Lembrete de TODO bloco mais as 4 mensagens do coach. Um dia cheio dela tem
// uns 12 blocos, entao 25 cobre com folga. O teto existe contra laço
// descontrolado, nao para racionar mensagem legitima.
export const LIMITE_DIARIO = 25;
/** Lembrete sai quando faltam entre 1 e 7 minutos (cron a cada 5 min cobre todo início). */
export const JANELA_LEMBRETE_MIN = 7;

export type Bloco = {
  ref: string;
  titulo: string;
  inicio: string; // HH:MM
  tarefaId?: string;
  concluido?: boolean;
  /** Duracao planejada, usada na regra de sobrecarga do coach. */
  duracaoMinutos?: number;
  /** Texto que a usuaria escreveu na tarefa. Tem prioridade sobre o do coach. */
  primeiroPasso?: string | null;
  versaoMinima?: string | null;
  /** Quantas vezes este bloco ja foi empurrado para outro dia. */
  remarcacoes?: number;
};

/** Data (YYYY-MM-DD), minutos do dia e segunda-feira no fuso de São Paulo. */
export function agoraEmSaoPaulo(agora: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(agora).map((p) => [p.type, p.value]),
  );
  const data = `${partes.year}-${partes.month}-${partes.day}`;
  const minutos = Number(partes.hour) * 60 + Number(partes.minute);
  const d = new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)));
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return { data, minutos, segunda: d.toISOString().slice(0, 10) };
}

export const minutosDe = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/**
 * O bloco que ela marcou como prioridade do dia, se ainda estiver pendente.
 *
 * Null quando ela nao escolheu nada ou quando ja cumpriu: nenhum dos dois e
 * erro, e o chamador nao deve inventar uma prioridade no lugar dela.
 */
export function prioridadeDoDia(blocos: Bloco[], referencia: string | null): Bloco | null {
  if (!referencia) return null;
  return blocos.find((b) => b.ref === referencia && !b.concluido) ?? null;
}

/**
 * Blocos que começam dentro da janela do lembrete.
 *
 * Vale para TODO bloco agendado, nao so para a prioridade: foi escolha dela
 * receber aviso antes de cada um. Em um dia cheio isso e bastante mensagem,
 * e o teto diario de LIMITE_DIARIO existe para o dia nao virar enxurrada.
 */
export function blocosParaLembrar(blocos: Bloco[], minutosAgora: number): Bloco[] {
  return blocos.filter((b) => {
    if (b.concluido) return false;
    const falta = minutosDe(b.inicio) - minutosAgora;
    return falta > 0 && falta <= JANELA_LEMBRETE_MIN;
  });
}

export function mascararNumero(numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (d.length <= 4) return "****";
  return `${d.slice(0, 4)}${"*".repeat(Math.max(0, d.length - 6))}${d.slice(-2)}`;
}

export function mensagemDiaria(foco: string, prioridade: Bloco | null, primeiro: Bloco | null): string {
  return [
    "☀️ Bom dia! Seu dia no Metas e Resultados:",
    `🎯 Foco da semana: ${foco.trim() || "não definido"}`,
    `⭐ Prioridade top de hoje: ${prioridade ? `${prioridade.titulo} (${prioridade.inicio})` : "nenhuma agendada hoje"}`,
    `⏰ Primeiro bloco: ${primeiro ? `${primeiro.inicio} · ${primeiro.titulo}` : "agenda livre hoje"}`,
  ].join("\n");
}

export function mensagemLembrete(bloco: Bloco, ehPrioridade = false): string {
  const fecho = ehPrioridade
    ? "É a prioridade de hoje. Se só uma coisa sair hoje, que seja esta."
    : "Bora começar.";
  return `⏰ Em 5 minutos (${bloco.inicio}): ${bloco.titulo}\n${fecho}`;
}

// ---------------------------------------------------------------------------
// Janelas do coach
//
// Quatro mensagens por dia, cada uma carregando SO o que vem pela frente ate a
// proxima. O dia inteiro numa mensagem so vira lista longa, que e exatamente o
// que a usuaria pediu para nao receber.
//
// Bloco pendente que ficou para tras nao some: ele continua aparecendo nas
// janelas seguintes, porque "o que eu deixei de fazer" e a informacao que ela
// quer ver, e some sozinho quando ela marca.
// ---------------------------------------------------------------------------

export type JanelaId = "manha" | "meio_dia" | "tarde" | "noite";

export type Janela = {
  id: JanelaId;
  /** Minuto do dia em que a mensagem sai. */
  envio: number;
  /** Mostra blocos pendentes que comecam antes deste minuto. */
  ate: number;
  cabecalho: string;
  /** Janela de abertura do dia: sempre envia, mesmo sem bloco a frente. */
  abreODia: boolean;
};

// Os horarios nao sao de 4 em 4 horas: cada mensagem precisa CHEGAR ANTES do
// bloco que ela cobra. 15:30 falava de uma tarefa das 14h que ja tinha
// passado, o que transforma o coach em relatorio de atraso. Por isso 13:30 e
// 18:30, que caem antes dos blocos de 14h e de 19h15.
export const JANELAS: Janela[] = [
  { id: "manha", envio: 7 * 60 + 30, ate: 11 * 60 + 30, abreODia: true,
    cabecalho: "☀️ Bom dia! Seu dia no Metas e Resultados:" },
  { id: "meio_dia", envio: 11 * 60 + 30, ate: 13 * 60 + 30, abreODia: false,
    cabecalho: "🕚 Metas e Resultados · 11:30" },
  { id: "tarde", envio: 13 * 60 + 30, ate: 18 * 60 + 30, abreODia: false,
    cabecalho: "🕜 Metas e Resultados · 13:30" },
  { id: "noite", envio: 18 * 60 + 30, ate: 24 * 60, abreODia: false,
    cabecalho: "🌙 Metas e Resultados · 18:30" },
];

/** Quantos horarios cabem numa mensagem. Acima disso vira lista. */
export const SLOTS_POR_MENSAGEM = 3;
/**
 * Quantos horarios ja vencidos a mensagem relembra.
 *
 * Poucos de proposito: a mensagem serve para ela agir agora, e lista longa de
 * atraso e o oposito disso. Os mais recentes sao os que ainda da para salvar.
 */
export const ATRASADOS_POR_MENSAGEM = 2;

/**
 * Janela que corresponde ao momento da execucao.
 *
 * A tolerancia existe porque o pg_cron nao dispara no segundo exato e a funcao
 * leva algum tempo. Fora dela, null: melhor nao mandar nada do que mandar a
 * mensagem da manha as duas da tarde.
 */
export function janelaDoMomento(minutosAgora: number, tolerancia = 25): Janela | null {
  return JANELAS.find((j) => minutosAgora >= j.envio && minutosAgora < j.envio + tolerancia) ?? null;
}

/** Horario com um ou mais blocos comecando junto. */
export type Slot = { inicio: string; blocos: Bloco[]; duracaoMinutos: number };

/**
 * Horarios pendentes que a janela deve mostrar, agrupados por hora de inicio.
 * Tres tarefas as 10:00 sao um horario so, nao tres avisos.
 */
export function slotsDaJanela(
  blocos: Bloco[],
  janela: Janela,
  minutosAgora = -1,
): { slots: Slot[]; atrasados: Slot[]; restantes: number } {
  const pendentes = blocos
    .filter((b) => !b.concluido && minutosDe(b.inicio) < janela.ate)
    .sort((a, b) => minutosDe(a.inicio) - minutosDe(b.inicio));

  const porHora = new Map<string, Bloco[]>();
  for (const b of pendentes) {
    const lista = porHora.get(b.inicio);
    if (lista) lista.push(b);
    else porHora.set(b.inicio, [b]);
  }

  const todos: Slot[] = [...porHora.entries()].map(([inicio, lista]) => ({
    inicio,
    blocos: lista,
    duracaoMinutos: lista.reduce((t, b) => Math.max(t, b.duracaoMinutos ?? 30), 0),
  }));

  // Horario que ja passou nao pode ser anunciado como se fosse chegar. As
  // 18:30, "⏰ 07:50" se le como compromisso por vir; e pendencia, e a
  // mensagem tem de dizer isso.
  const jaPassou = (s: Slot) => minutosAgora >= 0 && minutosDe(s.inicio) < minutosAgora;
  const frente = todos.filter((s) => !jaPassou(s));
  const atras = todos.filter(jaPassou);

  return {
    slots: frente.slice(0, SLOTS_POR_MENSAGEM),
    atrasados: atras.slice(-ATRASADOS_POR_MENSAGEM),
    restantes: Math.max(0, frente.length - SLOTS_POR_MENSAGEM),
  };
}

/**
 * Rotulo do "tipo de bloco", para a regra de nao repetir frase em 7 dias.
 *
 * O tipo e o TITULO normalizado, nao o id do bloco: "Postar reels" de hoje e
 * "Postar reels" de amanha sao agendamentos diferentes e o mesmo tipo de
 * tarefa. Comparar por id deixaria a frase se repetir todo dia numa rotina,
 * que e justamente onde repetir incomoda mais.
 */
export function tipoDoSlot(slot: Slot): string {
  return slot.blocos
    .map((b) => b.titulo)
    .join(" + ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto que o coach preencheu para um horario. Campo vazio simplesmente nao sai. */
export type LinhasDoSlot = {
  primeiroPasso?: string | null;
  versaoMinima?: string | null;
  frase?: string | null;
};

/**
 * Extrai os campos do que o modelo devolveu.
 *
 * Tolera cerca de codigo e sobra de texto em volta, porque modelo as vezes
 * explica o que fez. O que nao da para ler vira null, e o chamador trata null
 * como "nao usa o coach nesta mensagem" — nunca como mensagem quebrada.
 */
export function extrairSlots(texto: string): Map<string, LinhasDoSlot> | null {
  const bruto = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) return null;

  let dados: unknown;
  try {
    dados = JSON.parse(bruto.slice(inicio, fim + 1));
  } catch {
    return null;
  }

  const lista = (dados as { slots?: unknown })?.slots;
  if (!Array.isArray(lista)) return null;

  const texto1 = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const mapa = new Map<string, LinhasDoSlot>();
  for (const item of lista) {
    const o = item as Record<string, unknown>;
    const hora = typeof o?.hora === "string" ? o.hora.slice(0, 5) : null;
    if (!hora || !/^\d{2}:\d{2}$/.test(hora)) continue;
    mapa.set(hora, {
      primeiroPasso: texto1(o.primeiro_passo),
      versaoMinima: texto1(o.versao_minima),
      frase: texto1(o.frase),
    });
  }
  return mapa.size ? mapa : null;
}

/**
 * Junta o que a usuaria escreveu com o que o coach gerou.
 *
 * O texto dela ganha, sempre. O coach so preenche o que esta vazio — foi a
 * regra que ela definiu: preenche quando tem opiniao, nao trabalha de graca
 * quando nao tem.
 *
 * Horario com mais de uma tarefa fica com o texto do coach, porque o passo
 * escrito numa das tarefas nao vale para o grupo inteiro.
 */
export function mesclarLinhas(
  slots: Slot[],
  doCoach: Map<string, LinhasDoSlot>,
): Map<string, LinhasDoSlot> {
  const saida = new Map<string, LinhasDoSlot>();
  for (const slot of slots) {
    const coach = doCoach.get(slot.inicio) ?? {};
    const unico = slot.blocos.length === 1 ? slot.blocos[0] : null;
    saida.set(slot.inicio, {
      primeiroPasso: (unico?.primeiroPasso ?? "").trim() || coach.primeiroPasso,
      versaoMinima: (unico?.versaoMinima ?? "").trim() || coach.versaoMinima,
      frase: coach.frase,
    });
  }
  return saida;
}

const horas = (minutos: number) => {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  return h ? `${h}h` : `${m} min`;
};

const limpar = (t: string | null | undefined) => (t ?? "").trim();

/**
 * Monta a mensagem final.
 *
 * O modelo devolve campos, nao texto pronto: o formato fica garantido, o texto
 * que a usuaria escreveu na tarefa ganha do gerado, e um campo que vier vazio
 * some em vez de derrubar a mensagem inteira.
 */
export function montarMensagem(args: {
  janela: Janela;
  slots: Slot[];
  /** Horarios que ja venceram e seguem pendentes. */
  atrasados?: Slot[];
  restantes: number;
  linhas: Map<string, LinhasDoSlot>;
  /** So na janela que abre o dia. */
  foco?: string;
  minutosPlanejados?: number;
  capacidadePlanejavel?: number;
  /** Limiar de sobrecarga, em fracao da capacidade planejavel. */
  limiarSobrecarga?: number;
}): string {
  const { janela, slots, restantes, linhas } = args;
  const atrasados = args.atrasados ?? [];
  const partes: string[] = [janela.cabecalho];

  const escrever = (slot: Slot, icone: string, sufixo = "") => {
    const titulo = slot.blocos.map((b) => b.titulo).join(", ");
    const l = linhas.get(slot.inicio) ?? {};
    partes.push("", `${icone} ${slot.inicio} · ${titulo} (${horas(slot.duracaoMinutos)})${sufixo}`);
    if (limpar(l.primeiroPasso)) partes.push(`1️⃣ Primeiro passo: ${limpar(l.primeiroPasso)}`);
    if (limpar(l.versaoMinima)) partes.push(`📉 Versão mínima: ${limpar(l.versaoMinima)}`);
    if (limpar(l.frase)) partes.push(`💭 ${limpar(l.frase)}`);
  };

  if (janela.abreODia) {
    partes.push(`🎯 Foco da semana: ${limpar(args.foco) || "não definido"}`);
    const planejado = args.minutosPlanejados ?? 0;
    const teto = args.capacidadePlanejavel ?? 0;
    if (teto > 0) {
      const pct = Math.round((planejado / teto) * 100);
      const folga = teto - planejado;
      // Numero absoluto junto da porcentagem: se o denominador estiver errado,
      // da para ver na propria mensagem.
      partes.push(
        "",
        `📊 ${planejado} min planejados de ${teto} planejáveis (${pct}%).`,
      );
      const limiar = args.limiarSobrecarga ?? 0.7;
      if (planejado > teto * limiar) {
        partes.push(`⚠️ Acima dos ${Math.round(limiar * 100)}%. Vale mover alguma coisa antes de travar.`);
      } else if (folga > 0) {
        partes.push(`Folga de ${horas(folga)}.`);
      }
    }
  }

  for (const slot of slots) escrever(slot, "⏰");

  if (atrasados.length) {
    partes.push("", slots.length ? "— Ficou para trás —" : "— Ficou para trás hoje —");
    for (const slot of atrasados) escrever(slot, "⏳", " · passou");
  }

  if (!slots.length && !atrasados.length) {
    partes.push("", "Nada pendente pela frente. Dia limpo.");
  }
  if (restantes > 0) partes.push("", `Mais ${restantes} ${restantes === 1 ? "horário" : "horários"} depois disso.`);

  const proxima = JANELAS.find((j) => j.envio > janela.envio);
  if (proxima) partes.push("", `Próxima às ${hhmm(proxima.envio)}.`);

  return partes.join("\n");
}

const hhmm = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/**
 * Semana ativa do plano de evolução do coach, de 1 a 4.
 *
 * Sai da data de início, não de um contador guardado: a semana avança
 * sozinha e não há estado para dessincronizar. Passadas as 4 semanas o
 * plano se encerra e o coach para de cobrar o tema.
 */
export function semanaDoPlano(
  inicio: string | null,
  hoje: string,
): number | null {
  if (!inicio) return null;
  const ini = new Date(`${inicio}T12:00:00`);
  const agora = new Date(`${hoje}T12:00:00`);
  const dias = Math.floor((agora.getTime() - ini.getTime()) / 86400000);
  if (dias < 0) return null;
  const semana = Math.floor(dias / 7) + 1;
  return semana > 4 ? null : semana;
}
