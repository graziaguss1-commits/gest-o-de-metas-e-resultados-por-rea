// Sincronização bidirecional Google Agenda <-> Metasia (server-only).
//
// Regras de privacidade e idempotência:
// - Google -> app: persistimos apenas data/hora início/fim ("ocupado") dos
//   eventos do usuário. Títulos e descrições NUNCA são gravados.
// - App -> Google: cada tarefa_agendamentos vira um evento marcado com
//   extendedProperties.private.metasia = <agendamento_id>. Eventos com essa
//   marca são ignorados na importação, evitando loops.
// - google_calendar_event_links vincula 1:1 agendamento <-> evento, com etag
//   e timestamps para atualizar só o que mudou.
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
  const listEvents = async (syncToken: string | null): Promise<{ items: GoogleEvent[]; nextSyncToken: string | null }> => {
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
        throw new Error(`Google events list failed (${res.status}): ${await res.text()}`);
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
    const inicio = googleDateTimeToLocal(event.start.dateTime);
    const fim = googleDateTimeToLocal(event.end.dateTime);
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

  // ---------- 2) App -> Google: espelha os agendamentos do usuário ----------
  const { data: agendamentos, error: agError } = await admin
    .from("tarefa_agendamentos")
    .select("id,tarefa_id,data,hora_inicio,duracao_minutos,updated_at")
    .eq("criado_por", userId)
    .gte("data", isoDate(timeMin))
    .lte("data", isoDate(timeMax));
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

  const { data: links } = await admin
    .from("google_calendar_event_links")
    .select("*")
    .eq("user_id", userId);
  const linkPorAgendamento = new Map(
    (links ?? []).filter((l) => l.agendamento_id).map((l) => [l.agendamento_id as string, l]),
  );

  for (const ag of agendamentos ?? []) {
    const inicio = { data: ag.data, hora: ag.hora_inicio };
    const fim = addMinutesLocal(ag.data, ag.hora_inicio, ag.duracao_minutos);
    const body = {
      summary: descricaoPorTarefa.get(ag.tarefa_id) ?? "Ação estratégica",
      start: { dateTime: `${inicio.data}T${inicio.hora}`, timeZone: TIMEZONE },
      end: { dateTime: `${fim.data}T${fim.hora}`, timeZone: TIMEZONE },
      extendedProperties: { private: { metasia: ag.id } },
    };
    const link = linkPorAgendamento.get(ag.id);
    if (!link) {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/${enc(calendarId)}/events`,
        init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      });
      if (!res.ok) {
        console.error(`Google event create failed (${res.status}): ${await res.text()}`);
        continue;
      }
      const created = await res.json();
      await admin.from("google_calendar_event_links").insert({
        user_id: userId,
        agendamento_id: ag.id,
        google_event_id: created.id,
        etag: created.etag ?? null,
        google_updated: created.updated ?? null,
      });
      stats.eventos_criados++;
    } else if (new Date(ag.updated_at) > new Date(link.updated_at)) {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/${enc(calendarId)}/events/${enc(link.google_event_id)}`,
        init: { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      });
      if (!res.ok) {
        console.error(`Google event update failed (${res.status}): ${await res.text()}`);
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

  // Agendamentos excluídos no app: o vínculo fica com agendamento_id nulo
  // (FK ON DELETE SET NULL) e o evento correspondente é removido no Google.
  const orfaos = (links ?? []).filter((l) => !l.agendamento_id);
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
        console.error(`Google watch registration failed (${res.status}): ${await res.text()}`);
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
