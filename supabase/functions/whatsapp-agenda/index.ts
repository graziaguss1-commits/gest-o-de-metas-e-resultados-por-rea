import { createServiceClient, jsonResponse, optionsResponse } from "../_shared/common.ts";
import {
  agoraEmSaoPaulo,
  blocosParaLembrar,
  LIMITE_DIARIO,
  mascararNumero,
  mensagemDiaria,
  mensagemLembrete,
  minutosDe,
  prioridadeDoDia,
  type Bloco,
} from "./logica.ts";

type Db = ReturnType<typeof createServiceClient>;
type Modo = "diario" | "lembretes";

const CANCELADAS = ["Ocorrência cancelada"];

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
async function reservar(db: Db, user_id: string, tipo: string, referencia: string, data: string) {
  const { error } = await db.from("whatsapp_envios").insert({ user_id, tipo, referencia, data, status: "enviando" });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

function proximaData(iso: string, recorrencia: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (recorrencia === "semanal") d.setUTCDate(d.getUTCDate() + 7);
  else if (recorrencia === "quinzenal") d.setUTCDate(d.getUTCDate() + 14);
  else {
    const dia = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dia, ultimo));
  }
  return d.toISOString().slice(0, 10);
}

/** Blocos de hoje do usuário: planos, ações avulsas e compromissos (com ocorrências). */
async function blocosDeHoje(db: Db, uid: string, hoje: string): Promise<Bloco[]> {
  const [ag, av, cp, oc] = await Promise.all([
    db.from("tarefa_agendamentos")
      .select("id, tarefa_id, hora_inicio, observacao, plano_tarefas!inner(descricao, responsavel_id)")
      .eq("data", hoje)
      .eq("plano_tarefas.responsavel_id", uid),
    db.from("acoes_avulsas").select("id, descricao, hora_inicio, concluida")
      .eq("criado_por", uid).eq("data_agendada", hoje).not("hora_inicio", "is", null),
    db.from("compromissos").select("id, titulo, data, hora_inicio, concluido, recorrencia, recorrencia_fim")
      .eq("criado_por", uid).lte("data", hoje),
    db.from("compromisso_ocorrencias").select("compromisso_id, data_original, data, hora_inicio, cancelado").eq("user_id", uid),
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
    const tarefa = a.plano_tarefas as unknown as { descricao: string };
    blocos.push({ ref: `ag:${a.id}`, titulo: tarefa.descricao, inicio: a.hora_inicio.slice(0, 5), tarefaId: a.tarefa_id, concluido: feitos.has(a.id) });
  }
  for (const a of av.data ?? []) {
    blocos.push({ ref: `av:${a.id}`, titulo: a.descricao, inicio: String(a.hora_inicio).slice(0, 5), tarefaId: a.id, concluido: a.concluida });
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
        blocos.push({ ref: `cp:${c.id}@${original}`, titulo: c.titulo, inicio: String(o?.hora_inicio ?? c.hora_inicio).slice(0, 5), concluido: c.concluido });
      }
      if (recorrencia === "nenhuma") break;
      original = proximaData(original, recorrencia);
    }
  }
  // Ocorrências de compromisso movidas para hoje a partir de uma data futura.
  for (const o of oc.data ?? []) {
    if (o.cancelado || o.data !== hoje || o.data_original <= hoje) continue;
    const c = (cp.data ?? []).find((x) => x.id === o.compromisso_id);
    if (c) blocos.push({ ref: `cp:${c.id}@${o.data_original}`, titulo: c.titulo, inicio: String(o.hora_inicio ?? c.hora_inicio).slice(0, 5), concluido: c.concluido });
  }
  return blocos.sort((a, b) => minutosDe(a.inicio) - minutosDe(b.inicio));
}

async function processarUsuario(db: Db, uid: string, modo: Modo, cfg: { base: string; instancia: string; apiKey: string; destino: string }, agora: Date) {
  const sp = agoraEmSaoPaulo(agora);
  const { data: plano, error } = await db.from("planejamento_semanal")
    .select("foco, priority_ids").eq("user_id", uid).eq("semana_inicio", sp.segunda).maybeSingle();
  if (error) throw error;
  const topIds: string[] = plano?.priority_ids ?? [];
  const blocos = await blocosDeHoje(db, uid, sp.data);

  const pendentes: { tipo: string; referencia: string; texto: string }[] = [];
  if (modo === "diario") {
    const primeiro = blocos.find((b) => !b.concluido) ?? null;
    pendentes.push({ tipo: "resumo_diario", referencia: "dia", texto: mensagemDiaria(plano?.foco ?? "", prioridadeDoDia(blocos, topIds), primeiro) });
  } else {
    for (const b of blocosParaLembrar(blocos, topIds, sp.minutos)) {
      pendentes.push({ tipo: "lembrete_bloco", referencia: `${b.ref}|${b.inicio}`, texto: mensagemLembrete(b) });
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
        if (await reservar(db, uid, "erro_configuracao", "evolution", hoje)) {
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
