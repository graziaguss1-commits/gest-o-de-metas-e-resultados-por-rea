// Sincronização bidirecional Google Agenda <-> Metasia (server-only).
//
// Regras de privacidade e idempotência:
// - Google -> app: persistimos apenas data/hora início/fim ("ocupado") dos
//   eventos do usuário. Títulos, descrições, local e participantes NUNCA são
//   gravados nem registrados em log.
// - App -> Google: cada origem interna (ocorrência agendada, compromisso e
//   ação avulsa) vira um evento marcado com extendedProperties.private.metasia.
//   Eventos com essa marca são ignorados na importação, evitando loops.
// - google_calendar_event_links vincula 1:1 (origem, origem_id) <-> evento,
//   com etag/updated para atualizar só o que mudou.
// - Janela limitada (7 dias no passado, 60 no futuro) para não criar
//   registros ilimitados.
import { callAsAppUser } from "./appUserConnector.ts";
import { adminClient, getConnectionKeyForUser } from "./appUserConnections.ts";
import {
  CONNECTOR_ID,
  GATEWAY_BASE_URL,
  TIMEZONE,
  googleDateTimeToLocal,
} from "./googleCalendarShared.ts";

const WINDOW_PAST_DAYS = 7;
const WINDOW_FUTURE_DAYS = 60;
const enc = encodeURIComponent;

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hhmmss = (hora: string) => (hora.length === 5 ? `${hora}:00` : hora);

/** Soma minutos a uma data/hora locais, devolvendo data e hora locais. */
function addMinutesLocal(data: string, hora: string, minutos: number) {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const base = new Date(`${data}T12:00:00`);
  base.setDate(base.getDate() + Math.floor(total / 1440));
  const resto = ((total % 1440) + 1440) % 1440;
  return {
    data: isoDate(base),
    hora: `${String(Math.floor(resto / 60)).padStart(2, "0")}:${String(resto % 60).padStart(2, "0")}:00`,
  };
}

type GoogleEvent = {
  id: string;
  status?: string;
  etag?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

type Espelho = {
  origem: "agendamento" | "compromisso" | "acao_avulsa";
  origem_id: string;
  agendamento_id: string | null;
  summary: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  updated_at: string;
};

export type SyncStats = {
  connected: boolean;
  busy_upserts?: number;
  busy_removed?: number;
  eventos_criados?: number;
  eventos_atualizados?: number;
  eventos_removidos?: number;
};

export async function sincronizarUsuario(userId: string): Promise<SyncStats> {
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) return { connected: false };
  const admin = adminClient();

  let { data: conn } = await admin
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) {
    const { data: created, error } = await admin
      .from("google_calendar_connections")
      .insert({ user_id: userId })
      .select()
      .single();
    if (error) throw error;
    conn = created;
  }
  const calendarId: string = conn.calendar_id || "primary";
  const timeZone: string = conn.calendar_timezone || TIMEZONE;

  const now = Date.now();
  const timeMin = new Date(now - WINDOW_PAST_DAYS * 86400000);
  const timeMax = new Date(now + WINDOW_FUTURE_DAYS * 86400000);

  const stats = {
    connected: true,
    busy_upserts: 0,
    busy_removed: 0,
    eventos_criados: 0,
    eventos_atualizados: 0,
    eventos_removidos: 0,
  };

  // ---------- 1) Google -> app: apenas intervalos ocupados ----------
  const listEvents = async (
    syncToken: string | null,
  ): Promise<{ items: GoogleEvent[]; nextSyncToken: string | null }> => {
    const items: GoogleEvent[] = [];
    let nextSyncToken: string | null = null;
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
      if (syncToken) {
        params.set("syncToken", syncToken);
      } else {
        params.set("timeMin", timeMin.toISOString());
        params.set("timeMax", timeMax.toISOString());
        params.set("orderBy", "startTime");
      }
      if (pageToken) params.set("pageToken", pageToken);
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/${enc(calendarId)}/events?${params.toString()}`,
      });
      if (res.status === 410 && syncToken) {
        // syncToken expirado: recomeça com a janela completa.
        return listEvents(null);
      }
      if (!res.ok) {
        throw new Error(`Google events list failed (${res.status})`);
      }
      const body = await res.json();
      items.push(...((body.items ?? []) as GoogleEvent[]));
      pageToken = body.nextPageToken;
      if (body.nextSyncToken) nextSyncToken = body.nextSyncToken;
    } while (pageToken);
    return { items, nextSyncToken };
  };

  const { items, nextSyncToken } = await listEvents(conn.sync_token ?? null);
  for (const event of items) {
    // Eventos criados pelo app não viram blocos "ocupados" (anti-loop).
    if (event.extendedProperties?.private?.metasia) continue;
    if (event.status === "cancelled") {
      await admin
        .from("google_busy_blocks")
        .delete()
        .eq("user_id", userId)
        .eq("google_event_id", event.id);
      stats.busy_removed++;
      continue;
    }
    // Eventos de dia inteiro (start.date) não bloqueiam horário específico.
    if (!event.start?.dateTime || !event.end?.dateTime) continue;
    const inicio = googleDateTimeToLocal(event.start.dateTime, timeZone);
    const fim = googleDateTimeToLocal(event.end.dateTime, timeZone);
    const { error } = await admin.from("google_busy_blocks").upsert(
      {
        user_id: userId,
        google_event_id: event.id,
        data: inicio.data,
        hora_inicio: `${inicio.hora}:00`,
        hora_fim: `${fim.hora}:00`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,google_event_id" },
    );
    if (!error) stats.busy_upserts++;
  }

  // ---------- 2) App -> Google: espelha a agenda interna do usuário ----------
  const janelaInicio = isoDate(timeMin);
  const janelaFim = isoDate(timeMax);
  const espelhos: Espelho[] = [];

  // 2a) Ocorrências agendadas de tarefas de plano.
  const { data: agendamentos, error: agError } = await admin
    .from("tarefa_agendamentos")
    .select("id,tarefa_id,data,hora_inicio,duracao_minutos,updated_at")
    .eq("criado_por", userId)
    .gte("data", janelaInicio)
    .lte("data", janelaFim);
  if (agError) throw agError;

  const tarefaIds = [...new Set((agendamentos ?? []).map((a) => a.tarefa_id))];
  const descricaoPorTarefa = new Map<string, string>();
  if (tarefaIds.length) {
    const { data: tarefas } = await admin
      .from("plano_tarefas")
      .select("id,descricao")
      .in("id", tarefaIds);
    (tarefas ?? []).forEach((t) => descricaoPorTarefa.set(t.id, t.descricao));
  }
  for (const ag of agendamentos ?? []) {
    const fim = addMinutesLocal(ag.data, ag.hora_inicio, ag.duracao_minutos);
    espelhos.push({
      origem: "agendamento",
      origem_id: ag.id,
      agendamento_id: ag.id,
      summary: descricaoPorTarefa.get(ag.tarefa_id) ?? "Ação estratégica",
      data: ag.data,
      hora_inicio: hhmmss(ag.hora_inicio),
      hora_fim: fim.hora,
      updated_at: ag.updated_at,
    });
  }

  // 2b) Compromissos fixos.
  const { data: compromissos, error: compError } = await admin
    .from("compromissos")
    .select("id,titulo,data,hora_inicio,hora_fim,updated_at")
    .eq("criado_por", userId)
    .gte("data", janelaInicio)
    .lte("data", janelaFim);
  if (compError) throw compError;
  for (const c of compromissos ?? []) {
    espelhos.push({
      origem: "compromisso",
      origem_id: c.id,
      agendamento_id: null,
      summary: c.titulo,
      data: c.data,
      hora_inicio: hhmmss(c.hora_inicio),
      hora_fim: hhmmss(c.hora_fim),
      updated_at: c.updated_at,
    });
  }

  // 2c) Ações avulsas com data e hora definidas.
  const { data: acoes, error: acoesError } = await admin
    .from("acoes_avulsas")
    .select("id,descricao,data_agendada,hora_inicio,duracao_minutos,updated_at")
    .eq("criado_por", userId)
    .not("data_agendada", "is", null)
    .not("hora_inicio", "is", null)
    .gte("data_agendada", janelaInicio)
    .lte("data_agendada", janelaFim);
  if (acoesError) throw acoesError;
  for (const a of acoes ?? []) {
    const fim = addMinutesLocal(a.data_agendada, a.hora_inicio, a.duracao_minutos ?? 60);
    espelhos.push({
      origem: "acao_avulsa",
      origem_id: a.id,
      agendamento_id: null,
      summary: a.descricao,
      data: a.data_agendada,
      hora_inicio: hhmmss(a.hora_inicio),
      hora_fim: fim.hora,
      updated_at: a.updated_at,
    });
  }

  const { data: links } = await admin
    .from("google_calendar_event_links")
    .select("*")
    .eq("user_id", userId);
  const linkPorChave = new Map(
    (links ?? []).map((l) => [`${l.origem}:${l.origem_id}`, l]),
  );

  for (const item of espelhos) {
    const body = {
      summary: item.summary,
      start: { dateTime: `${item.data}T${item.hora_inicio}`, timeZone },
      end: { dateTime: `${item.data}T${item.hora_fim}`, timeZone },
      extendedProperties: { private: { metasia: `${item.origem}:${item.origem_id}` } },
    };
    const link = linkPorChave.get(`${item.origem}:${item.origem_id}`);
    if (!link) {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/${enc(calendarId)}/events`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      });
      if (!res.ok) {
        console.error(`Google event create failed (${res.status})`);
        continue;
      }
      const created = await res.json();
      await admin.from("google_calendar_event_links").insert({
        user_id: userId,
        origem: item.origem,
        origem_id: item.origem_id,
        agendamento_id: item.agendamento_id,
        google_event_id: created.id,
        etag: created.etag ?? null,
        google_updated: created.updated ?? null,
      });
      stats.eventos_criados++;
    } else if (new Date(item.updated_at) > new Date(link.updated_at)) {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/${enc(calendarId)}/events/${enc(link.google_event_id)}`,
        init: {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      });
      if (!res.ok) {
        console.error(`Google event update failed (${res.status})`);
        continue;
      }
      const updated = await res.json();
      await admin
        .from("google_calendar_event_links")
        .update({
          etag: updated.etag ?? null,
          google_updated: updated.updated ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id);
      stats.eventos_atualizados++;
    }
  }

  // Itens removidos no app: apagamos apenas o espelho no Google; planos, metas
  // e histórico interno permanecem intactos.
  const chavesAtivas = new Set(espelhos.map((e) => `${e.origem}:${e.origem_id}`));
  const existePorOrigem = async (origem: string, ids: string[]) => {
    if (!ids.length) return new Set<string>();
    const tabela = origem === "compromisso"
      ? "compromissos"
      : origem === "acao_avulsa"
      ? "acoes_avulsas"
      : "tarefa_agendamentos";
    const { data } = await admin.from(tabela).select("id").in("id", ids);
    return new Set((data ?? []).map((r: { id: string }) => r.id));
  };

  const candidatos = (links ?? []).filter(
    (l) => !chavesAtivas.has(`${l.origem}:${l.origem_id}`),
  );
  const porOrigem = new Map<string, string[]>();
  for (const l of candidatos) {
    porOrigem.set(l.origem, [...(porOrigem.get(l.origem) ?? []), l.origem_id]);
  }
  const existentes = new Map<string, Set<string>>();
  for (const [origem, ids] of porOrigem) {
    existentes.set(origem, await existePorOrigem(origem, ids));
  }
  const orfaos = candidatos.filter((l) => !existentes.get(l.origem)?.has(l.origem_id));

  for (const link of orfaos) {
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path: `/calendar/v3/calendars/${enc(calendarId)}/events/${enc(link.google_event_id)}`,
      init: { method: "DELETE" },
    });
    if (res.ok || res.status === 404 || res.status === 410) {
      await admin.from("google_calendar_event_links").delete().eq("id", link.id);
      stats.eventos_removidos++;
    }
  }

  // ---------- 3) Canal de notificações push (melhor esforço) ----------
  try {
    const expiracao = conn.webhook_expiration ? new Date(conn.webhook_expiration).getTime() : 0;
    if (expiracao < now + 86400000) {
      if (conn.webhook_channel_id && conn.webhook_resource_id) {
        await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CONNECTOR_ID,
          path: "/calendar/v3/channels/stop",
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: conn.webhook_channel_id, resourceId: conn.webhook_resource_id }),
          },
        });
      }
      const channelId = crypto.randomUUID();
      const address = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-webhook`;
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/${enc(calendarId)}/events/watch`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: channelId, type: "web_hook", address }),
        },
      });
      if (res.ok) {
        const channel = await res.json();
        await admin
          .from("google_calendar_connections")
          .update({
            webhook_channel_id: channelId,
            webhook_resource_id: channel.resourceId ?? null,
            webhook_expiration: channel.expiration
              ? new Date(Number(channel.expiration)).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } else {
        console.error(`Google watch registration failed (${res.status})`);
      }
    }
  } catch (watchError) {
    console.error("Google watch setup error:", watchError);
  }

  await admin
    .from("google_calendar_connections")
    .update({
      sync_token: nextSyncToken ?? conn.sync_token,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return stats;
}
