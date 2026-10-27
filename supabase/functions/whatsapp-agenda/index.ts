// PRIORIDADE_DIA_V4
//
// Marcador de versao para a publicacao. Cada mudanca que precisa ir ao ar
// ganha um marcador novo, e o pedido de deploy manda conferir se ele existe
// no repositorio antes de publicar — assim uma versao velha nunca sobe no
// lugar desta sem ninguem perceber.

import { createServiceClient, jsonResponse, optionsResponse } from "../_shared/common.ts";
import { proximaOcorrencia, type Recorrencia } from "../_shared/recorrencia.ts";
import {
  agoraEmSaoPaulo,
  blocosParaLembrar,
  janelaDoMomento,
  LIMITE_DIARIO,
  mascararNumero,
  mensagemDiaria,
  mensagemLembrete,
  mesclarLinhas,
  minutosDe,
  montarMensagem,
  prioridadeDoDia,
  slotsDaJanela,
  type Bloco,
  type LinhasDoSlot,
  type Slot,
} from "./logica.ts";
import { linhasDoCoach, registrarFrases } from "./coach.ts";

type Db = ReturnType<typeof createServiceClient>;
type Modo = "diario" | "lembretes";

const CANCELADAS = ["Ocorrência cancelada"];

/** Minutos ja planejados no dia, para a regra de sobrecarga do coach. */
function minutosPlanejadosDe(blocos: Bloco[]): number {
  return blocos.reduce((total, b) => total + (b.duracaoMinutos ?? 30), 0);
}

async function log(db: Db, e: { user_id: string | null; tipo: string; referencia?: string; destino?: string | null; status: string; erro?: string }) {
  await db.from("whatsapp_log").insert({
    user_id: e.user_id,
    tipo: e.tipo,
    referencia: e.referencia ?? null,
    destino_mascarado: e.destino ? mascararNumero(e.destino) : null,
    status: e.status,
    erro: e.erro?.slice(0, 500) ?? null,
  });
}

/** Reserva a chave (user, tipo, referência, data). false = já existe → não enviar. */
async function reservar(db: Db, user_id: string, tipo: string, referencia: string, data: string, status = "enviando") {
  const { error } = await db.from("whatsapp_envios").insert({ user_id, tipo, referencia, data, status });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

/**
 * Proxima ocorrencia de uma serie, na mesma regra que a agenda do app usa.
 *
 * `primeira` e a data inicial da serie, nao a ocorrencia corrente: e dela que
 * saem o dia do mes e a posicao no mes ("ultima sexta"). Usar a corrente faria
 * "ultima sexta" virar "quarta sexta" no primeiro mes de 4 sextas, e nunca
 * mais voltar.
 */
function proximaData(iso: string, recorrencia: string, primeira: string) {
  const local = (x: string) => {
    const [a, m, d] = x.split("-").map(Number);
    return new Date(a, m - 1, d);
  };
  const proxima = proximaOcorrencia(
    local(iso),
    recorrencia as Recorrencia,
    local(primeira),
  );
  return `${proxima.getFullYear()}-${String(proxima.getMonth() + 1).padStart(2, "0")}-${String(proxima.getDate()).padStart(2, "0")}`;
}

/** Blocos de hoje do usuário: planos, ações avulsas e compromissos (com ocorrências). */
async function blocosDeHoje(db: Db, uid: string, hoje: string): Promise<Bloco[]> {
  const [ag, av, cp, oc] = await Promise.all([
    db.from("tarefa_agendamentos")
      .select("id, tarefa_id, hora_inicio, duracao_minutos, observacao, remarcacoes, plano_tarefas!inner(descricao, responsavel_id, primeiro_passo, versao_minima)")
      .eq("data", hoje)
      .eq("plano_tarefas.responsavel_id", uid),
    db.from("acoes_avulsas").select("id, descricao, hora_inicio, duracao_minutos, concluida")
      .eq("criado_por", uid).eq("data_agendada", hoje).not("hora_inicio", "is", null),
    db.from("compromissos").select("id, titulo, data, hora_inicio, hora_fim, concluido, recorrencia, recorrencia_fim")
      .eq("criado_por", uid).lte("data", hoje),
    db.from("compromisso_ocorrencias").select("compromisso_id, data_original, data, hora_inicio, hora_fim, cancelado").eq("user_id", uid),
  ]);
  for (const r of [ag, av, cp, oc]) if (r.error) throw r.error;

  const ids = (ag.data ?? []).map((a) => a.id);
  const feitos = new Set<string>();
  if (ids.length) {
    const { data, error } = await db.from("tarefa_execucoes").select("agendamento_id").in("agendamento_id", ids);
    if (error) throw error;
    (data ?? []).forEach((e) => e.agendamento_id && feitos.add(e.agendamento_id));
  }

  const blocos: Bloco[] = [];
  const vistos = new Set<string>();
  for (const a of ag.data ?? []) {
    if (a.observacao && (CANCELADAS.includes(a.observacao) || a.observacao.startsWith("Ocorrência duplicada arquivada"))) continue;
    const chave = `${a.tarefa_id}|${a.hora_inicio.slice(0, 5)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const tarefa = a.plano_tarefas as unknown as {
      descricao: string;
      primeiro_passo: string | null;
      versao_minima: string | null;
    };
    blocos.push({
      ref: `ag:${a.id}`,
      titulo: tarefa.descricao,
      inicio: a.hora_inicio.slice(0, 5),
      tarefaId: a.tarefa_id,
      concluido: feitos.has(a.id),
      duracaoMinutos: Number(a.duracao_minutos ?? 30),
      primeiroPasso: tarefa.primeiro_passo,
      versaoMinima: tarefa.versao_minima,
      remarcacoes: Number(a.remarcacoes ?? 0),
    });
  }
  for (const a of av.data ?? []) {
    blocos.push({ ref: `av:${a.id}`, titulo: a.descricao, inicio: String(a.hora_inicio).slice(0, 5), tarefaId: a.id, concluido: a.concluida, duracaoMinutos: Number(a.duracao_minutos ?? 30) });
  }
  const alt = new Map((oc.data ?? []).map((o) => [`${o.compromisso_id}|${o.data_original}`, o]));
  for (const c of cp.data ?? []) {
    const recorrencia = c.recorrencia ?? "nenhuma";
    let original = c.data;
    let guard = 0;
    while (original <= hoje && guard++ < 1000) {
      if (c.recorrencia_fim && original > c.recorrencia_fim) break;
      const o = alt.get(`${c.id}|${original}`);
      const data = o?.data ?? original;
      if (!o?.cancelado && data === hoje) {
        const ini = String(o?.hora_inicio ?? c.hora_inicio).slice(0, 5);
        const fim = String(o?.hora_fim ?? c.hora_fim ?? "").slice(0, 5);
        blocos.push({ ref: `cp:${c.id}@${original}`, titulo: c.titulo, inicio: ini, concluido: c.concluido, duracaoMinutos: fim ? Math.max(0, minutosDe(fim) - minutosDe(ini)) : 30 });
      }
      if (recorrencia === "nenhuma") break;
      original = proximaData(original, recorrencia, c.data);
    }
  }
  // Ocorrências de compromisso movidas para hoje a partir de uma data futura.
  for (const o of oc.data ?? []) {
    if (o.cancelado || o.data !== hoje || o.data_original <= hoje) continue;
    const c = (cp.data ?? []).find((x) => x.id === o.compromisso_id);
    if (c) {
      const ini = String(o.hora_inicio ?? c.hora_inicio).slice(0, 5);
      const fim = String(o.hora_fim ?? c.hora_fim ?? "").slice(0, 5);
      blocos.push({ ref: `cp:${c.id}@${o.data_original}`, titulo: c.titulo, inicio: ini, concluido: c.concluido, duracaoMinutos: fim ? Math.max(0, minutosDe(fim) - minutosDe(ini)) : 30 });
    }
  }
  return blocos.sort((a, b) => minutosDe(a.inicio) - minutosDe(b.inicio));
}

/**
 * O que ela registrou quando um bloco passou sem ser feito.
 *
 * E a unica informacao no sistema que vem dela, nao da agenda. O coach
 * usava so o que foi marcado, entao chutava o motivo de uma falta que ela
 * ja tinha explicado.
 */
async function motivosRegistrados(db: Db, uid: string, hoje: string, blocos: Bloco[]) {
  const trintaDias = new Date(`${hoje}T12:00:00Z`);
  trintaDias.setUTCDate(trintaDias.getUTCDate() - 30);

  const { data } = await db.from("bloco_motivos")
    .select("referencia, data, motivo, observacao")
    .eq("user_id", uid)
    .gte("data", trintaDias.toISOString().slice(0, 10));

  const linhas = (data ?? []) as {
    referencia: string; data: string; motivo: string; observacao: string | null;
  }[];

  // Titulo de cada referencia, inclusive de blocos que nao estao no dia de
  // hoje. Sem isso so restava a contagem global, e um total de "adiei"
  // somado de todos os blocos vira, na mao do modelo, "voce adiou ISSO 9
  // vezes" — numero certo, tarefa errada.
  const porRef = new Map(blocos.map((b) => [b.ref, b.titulo]));
  const faltando = linhas.map((l) => l.referencia).filter((r) => !porRef.has(r));
  await resolverTitulos(db, faltando, porRef);

  const motivosDeHoje = linhas
    .filter((l) => l.data === hoje && porRef.has(l.referencia))
    .map((l) => ({
      titulo: porRef.get(l.referencia)!,
      motivo: l.motivo,
      observacao: l.observacao,
    }));

  // Por TAREFA: e isso que autoriza falar "voce adiou isso X vezes".
  const porTarefa = new Map<string, Map<string, number>>();
  for (const l of linhas) {
    const titulo = porRef.get(l.referencia);
    if (!titulo) continue;
    const dessa = porTarefa.get(titulo) ?? new Map<string, number>();
    dessa.set(l.motivo, (dessa.get(l.motivo) ?? 0) + 1);
    porTarefa.set(titulo, dessa);
  }
  const motivosPorTarefa = [...porTarefa.entries()].map(([titulo, mapa]) => ({
    titulo,
    motivos: [...mapa.entries()].map(([motivo, vezes]) => ({ motivo, vezes })),
  }));

  const contagem = new Map<string, number>();
  for (const l of linhas) contagem.set(l.motivo, (contagem.get(l.motivo) ?? 0) + 1);
  const motivosDoMes = [...contagem.entries()]
    .map(([motivo, vezes]) => ({ motivo, vezes }))
    .sort((a, b) => b.vezes - a.vezes);

  return { motivosDeHoje, motivosPorTarefa, motivosDoMes };
}

/** Descobre o titulo de referencias de blocos que nao estao no dia de hoje. */
async function resolverTitulos(db: Db, refs: string[], destino: Map<string, string>) {
  const unicas = [...new Set(refs)];
  const ids = (prefixo: string) =>
    unicas.filter((r) => r.startsWith(prefixo)).map((r) => r.slice(prefixo.length).split("@")[0]);

  const [ag, av, cp] = await Promise.all([
    ids("ag:").length
      ? db.from("tarefa_agendamentos").select("id, plano_tarefas!inner(descricao)").in("id", ids("ag:"))
      : Promise.resolve({ data: [] }),
    ids("av:").length
      ? db.from("acoes_avulsas").select("id, descricao").in("id", ids("av:"))
      : Promise.resolve({ data: [] }),
    ids("cp:").length
      ? db.from("compromissos").select("id, titulo").in("id", ids("cp:"))
      : Promise.resolve({ data: [] }),
  ]);

  for (const a of (ag.data ?? []) as { id: string; plano_tarefas: { descricao: string } }[]) {
    destino.set(`ag:${a.id}`, a.plano_tarefas.descricao);
  }
  for (const a of (av.data ?? []) as { id: string; descricao: string }[]) {
    destino.set(`av:${a.id}`, a.descricao);
  }
  const compromissos = (cp.data ?? []) as { id: string; titulo: string }[];
  for (const r of unicas.filter((x) => x.startsWith("cp:"))) {
    const id = r.slice(3).split("@")[0];
    const achado = compromissos.find((c) => c.id === id);
    if (achado) destino.set(r, achado.titulo);
  }
}

async function processarUsuario(db: Db, uid: string, modo: Modo, cfg: { base: string; instancia: string; apiKey: string; destino: string }, agora: Date) {
  const sp = agoraEmSaoPaulo(agora);
  const { data: plano, error } = await db.from("planejamento_semanal")
    .select("foco").eq("user_id", uid).eq("semana_inicio", sp.segunda).maybeSingle();
  if (error) throw error;
  // Uma prioridade por dia, escolhida por ela. Dia sem linha e normal.
  const { data: prio } = await db.from("prioridade_dia")
    .select("referencia").eq("user_id", uid).eq("data", sp.data).maybeSingle();
  const refPrioridade: string | null = prio?.referencia ?? null;
  const blocos = await blocosDeHoje(db, uid, sp.data);

  const pendentes: { tipo: string; referencia: string; texto: string }[] = [];
  // Frases do coach desta mensagem, guardadas so DEPOIS que ela sai: frase
  // que nao chegou nao pode bloquear a mesma frase amanha.
  let frasesParaGuardar: { slots: Slot[]; linhas: Map<string, LinhasDoSlot> } | null = null;
  if (modo === "diario") {
    // Qual das quatro janelas e esta execucao. Fora de qualquer uma delas,
    // nao manda nada: melhor silencio do que a mensagem da manha as 14h.
    const janela = janelaDoMomento(sp.minutos);
    if (!janela) return { enviados: 0, ignorados: 0, abortado: "fora_de_janela" };

    const { slots, atrasados, restantes } = slotsDaJanela(blocos, janela, sp.minutos);
    // Janela do meio sem nada pela frente nao vira mensagem. Mensagem vazia
    // de hora em hora vira papel de parede e ela para de ler.
    if (!janela.abreODia && !slots.length && !atrasados.length) {
      return { enviados: 0, ignorados: 0, abortado: "janela_vazia" };
    }

    const { data: cfgCap } = await db.from("app_settings")
      .select("capacidade_diaria_minutos").eq("id", 1).maybeSingle();
    const capacidadeDiaria = Number(cfgCap?.capacidade_diaria_minutos ?? 480);

    const motivos = await motivosRegistrados(db, uid, sp.data, blocos).catch(
      () => ({ motivosDeHoje: [], motivosDoMes: [] }),
    );
    const doCoach = await linhasDoCoach(db, uid, {
      data: sp.data,
      ...motivos,
      janela,
      foco: plano?.foco ?? "",
      slots: [...slots, ...atrasados],
      restantes,
      concluidos: blocos.filter((b) => b.concluido).map((b) => b.titulo),
      minutosPlanejados: minutosPlanejadosDe(blocos),
      capacidadePlanejavel: Math.round(capacidadeDiaria * 0.7),
    });

    let texto: string;
    if (doCoach) {
      const todos = [...slots, ...atrasados];
      const linhas = mesclarLinhas(todos, doCoach);
      frasesParaGuardar = { slots: todos, linhas };
      texto = montarMensagem({
        janela,
        slots,
        atrasados,
        restantes,
        linhas,
        foco: plano?.foco ?? "",
        minutosPlanejados: minutosPlanejadosDe(blocos),
        capacidadePlanejavel: Math.round(capacidadeDiaria * 0.7),
      });
    } else if (janela.abreODia) {
      // Coach desligado, sem chave ou qualquer falha: segue o texto fixo. A
      // mensagem das 7:30 nao pode deixar de sair porque a IA falhou.
      const primeiro = blocos.find((b) => !b.concluido) ?? null;
      texto = mensagemDiaria(plano?.foco ?? "", prioridadeDoDia(blocos, refPrioridade), primeiro);
    } else {
      // Sem coach nao existe mensagem do meio do dia: desligar o coach
      // devolve exatamente o comportamento antigo, uma mensagem por dia.
      return { enviados: 0, ignorados: 0, abortado: "sem_coach" };
    }

    pendentes.push({
      tipo: "resumo_diario",
      referencia: janela.abreODia ? "dia" : janela.id,
      texto,
    });
  } else {
    for (const b of blocosParaLembrar(blocos, sp.minutos)) {
      pendentes.push({
        tipo: "lembrete_bloco",
        referencia: `${b.ref}|${b.inicio}`,
        texto: mensagemLembrete(b, b.ref === refPrioridade),
      });
    }
  }

  const resultado = { enviados: 0, ignorados: 0 };
  for (const p of pendentes) {
    // 1) Já consta no registro? Não envia.
    const { data: existente, error: exErr } = await db.from("whatsapp_envios").select("id")
      .eq("user_id", uid).eq("tipo", p.tipo).eq("referencia", p.referencia).eq("data", sp.data).maybeSingle();
    if (exErr) throw exErr;
    if (existente) { resultado.ignorados++; continue; }

    // 2) Teto diário.
    const { count, error: cErr } = await db.from("whatsapp_envios").select("id", { count: "exact", head: true })
      .eq("user_id", uid).eq("data", sp.data).in("status", ["enviando", "enviado"]);
    if (cErr) throw cErr;
    if ((count ?? 0) >= LIMITE_DIARIO) {
      await log(db, { user_id: uid, tipo: p.tipo, referencia: p.referencia, destino: cfg.destino, status: "abortado", erro: `Teto de ${LIMITE_DIARIO} mensagens/dia atingido` });
      return { ...resultado, abortado: "limite_diario" };
    }

    // 3) Reserva atômica pela chave única (protege contra execuções simultâneas).
    if (!(await reservar(db, uid, p.tipo, p.referencia, sp.data))) { resultado.ignorados++; continue; }

    // 4) Envio único, sem novas tentativas.
    let erro: string | null = null;
    try {
      const resp = await fetch(`${cfg.base}/message/sendText/${encodeURIComponent(cfg.instancia)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
        body: JSON.stringify({ number: cfg.destino.replace(/\D/g, ""), text: p.texto }),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) erro = `Evolution respondeu HTTP ${resp.status}`;
      await resp.body?.cancel();
    } catch (e) {
      erro = `Falha de rede: ${e instanceof Error ? e.name : "desconhecida"}`;
    }

    await db.from("whatsapp_envios").update({ status: erro ? "erro" : "enviado" })
      .eq("user_id", uid).eq("tipo", p.tipo).eq("referencia", p.referencia).eq("data", sp.data);
    await log(db, { user_id: uid, tipo: p.tipo, referencia: p.referencia, destino: cfg.destino, status: erro ? "erro" : "enviado", erro: erro ?? undefined });
    if (erro) return { ...resultado, abortado: "erro_evolution" };
    resultado.enviados++;
    if (p.tipo === "resumo_diario" && frasesParaGuardar) {
      await registrarFrases(db, uid, sp.data, frasesParaGuardar.slots, frasesParaGuardar.linhas);
    }
  }
  return resultado;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const db = createServiceClient();

  const segredo = req.headers.get("x-cron-secret") ?? "";
  const { data: s } = await db.from("cron_segredos").select("valor").eq("nome", "whatsapp_agenda").maybeSingle();
  if (!s?.valor || segredo.length < 32 || segredo !== s.valor) return jsonResponse({ success: false, error: "unauthorized" }, 401);

  let modo: Modo;
  try {
    const body = await req.json();
    if (body?.modo !== "diario" && body?.modo !== "lembretes") throw new Error();
    modo = body.modo;
  } catch {
    return jsonResponse({ success: false, error: "modo inválido" }, 400);
  }

  const agora = new Date();
  const hoje = agoraEmSaoPaulo(agora).data;

  // Destinatários: administradores ativos (o destino de WhatsApp é único no app).
  const { data: admins, error: aErr } = await db.from("user_roles").select("user_id").eq("role", "admin");
  if (aErr) return jsonResponse({ success: false, error: "falha ao ler usuários" }, 500);
  const resultados: Record<string, unknown> = {};

  const { data: cfgRow } = await db.from("app_settings")
    .select("evolution_configured, evolution_base_url, evolution_instance, whatsapp_destino").eq("id", 1).maybeSingle();
  const { data: apiKey } = await db.rpc("read_vault_secret", { p_key: "metasia_evolution_api_key" });
  const configurada = cfgRow?.evolution_configured && cfgRow.evolution_base_url && cfgRow.evolution_instance && cfgRow.whatsapp_destino && apiKey;

  for (const { user_id: uid } of admins ?? []) {
    try {
      if (!configurada) {
        // Registra uma única vez por dia e para.
        if (await reservar(db, uid, "erro_configuracao", "evolution", hoje, "registrado")) {
          await log(db, { user_id: uid, tipo: modo, status: "erro", destino: cfgRow?.whatsapp_destino, erro: "Evolution API ou número de destino não configurados" });
        }
        resultados[uid] = { abortado: "nao_configurada" };
        continue;
      }
      resultados[uid] = await processarUsuario(db, uid, modo, {
        base: String(cfgRow!.evolution_base_url).replace(/\/+$/, ""),
        instancia: String(cfgRow!.evolution_instance),
        apiKey: String(apiKey),
        destino: String(cfgRow!.whatsapp_destino),
      }, agora);
    } catch (e) {
      await log(db, { user_id: uid, tipo: modo, status: "erro", erro: e instanceof Error ? e.message : "erro interno" });
      resultados[uid] = { abortado: "erro_interno" };
    }
  }
  console.log(`[whatsapp-agenda] modo=${modo} usuarios=${Object.keys(resultados).length}`);
  return jsonResponse({ success: true, modo, resultados });
});
