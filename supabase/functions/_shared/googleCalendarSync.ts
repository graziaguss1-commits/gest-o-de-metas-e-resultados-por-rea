// Sincronização bidirecional Google Agenda <-> Metasia (server-only).
// Eventos externos são reduzidos a intervalos ocupados; nenhum título,
// participante, descrição ou local é persistido ou enviado ao Claude.
import { adminClient } from "./appUserConnections.ts";
import { callGoogleApi, hasGoogleConnection } from "./googleOAuth.ts";
import {
  TIMEZONE,
  googleDateTimeToLocal,
  sha256Hex,
} from "./googleCalendarShared.ts";

const WINDOW_PAST_DAYS = 7;
const WINDOW_FUTURE_DAYS = 60;
const OBSERVACAO_CANCELADA = "Ocorrência cancelada";
const OBSERVACAO_DUPLICADA = "Ocorrência duplicada arquivada";
const enc = encodeURIComponent;

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (value: string) => value.slice(0, 5);
const hhmmss = (value: string) => `${hhmm(value)}:00`;
const parseLocalDate = (value: string) => new Date(`${value}T12:00:00`);

function addDays(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function addMinutesLocal(data: string, hora: string, minutos: number) {
  const [h, m] = hhmm(hora).split(":").map(Number);
  const total = h * 60 + m + Math.max(1, minutos);
  return {
    data: addDays(data, Math.floor(total / 1440)),
    hora: `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`,
  };
}

function endDateForTimes(data: string, inicio: string, fim: string) {
  return hhmm(fim) <= hhmm(inicio) ? addDays(data, 1) : data;
}

function nextOccurrence(data: string, recurrence: string) {
  const current = parseLocalDate(data);
  if (recurrence === "semanal") current.setDate(current.getDate() + 7);
  if (recurrence === "quinzenal") current.setDate(current.getDate() + 14);
  if (recurrence === "mensal") {
    const day = current.getDate();
    current.setDate(1);
    current.setMonth(current.getMonth() + 1);
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    current.setDate(Math.min(day, lastDay));
  }
  return isoDate(current);
}

function laterIso(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().slice(-1)[0] ?? new Date(0).toISOString();
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

type LinkRow = {
  id: string;
  user_id: string;
  origem: "agendamento" | "compromisso" | "acao_avulsa";
  origem_id: string;
  origem_chave: string;
  agendamento_id: string | null;
  google_event_id: string;
  etag: string | null;
  google_updated: string | null;
  source_date: string | null;
  source_updated_at: string | null;
  updated_at: string;
};

type Mirror = {
  origem: LinkRow["origem"];
  origem_id: string;
  origem_chave: string;
  agendamento_id: string | null;
  summary: string;
  data: string;
  data_fim: string;
  hora_inicio: string;
  hora_fim: string;
  updated_at: string;
};

type GoogleConnectionRow = {
  calendar_id?: string | null;
  calendar_timezone?: string | null;
  sync_token?: string | null;
  webhook_channel_id?: string | null;
  webhook_resource_id?: string | null;
  webhook_expiration?: string | null;
};

export type SyncStats = {
  connected: boolean;
  skipped?: boolean;
  busy_upserts?: number;
  busy_removed?: number;
  eventos_criados?: number;
  eventos_atualizados?: number;
  eventos_removidos?: number;
  itens_desagendados?: number;
};

type SyncFailure = Error & { code?: string };

function googleFailure(operation: string, status: number): SyncFailure {
  const error = new Error(`${operation} (${status})`) as SyncFailure;
  error.code = status === 401 || status === 403 ? "reconnect_required" : "google_request_failed";
  return error;
}

async function deterministicEventId(userId: string, key: string) {
  return `m${(await sha256Hex(`${userId}|${key}`)).slice(0, 40)}`;
}

async function cancelLocalMirror(admin: ReturnType<typeof adminClient>, userId: string, link: LinkRow) {
  if (link.origem === "agendamento") {
    await admin
      .from("tarefa_agendamentos")
      .update({ observacao: OBSERVACAO_CANCELADA })
      .eq("id", link.origem_id)
      .eq("criado_por", userId);
    return;
  }
  if (link.origem === "acao_avulsa") {
    await admin
      .from("acoes_avulsas")
      .update({ data_agendada: null, hora_inicio: null, duracao_minutos: null })
      .eq("id", link.origem_id)
      .eq("criado_por", userId);
    return;
  }
  const originalDate = link.origem_chave.includes("@")
    ? link.origem_chave.split("@").pop()
    : link.source_date;
  if (!originalDate) return;
  await admin.from("compromisso_ocorrencias").upsert(
    {
      user_id: userId,
      compromisso_id: link.origem_id,
      data_original: originalDate,
      data: null,
      hora_inicio: null,
      hora_fim: null,
      cancelado: true,
    },
    { onConflict: "user_id,compromisso_id,data_original" },
  );
}

async function applyGoogleMove(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  link: LinkRow,
  event: GoogleEvent,
  timeZone: string,
) {
  if (!event.start?.dateTime || !event.end?.dateTime) return false;
  const inicio = googleDateTimeToLocal(event.start.dateTime, timeZone);
  const fim = googleDateTimeToLocal(event.end.dateTime, timeZone);
  const duration = Math.max(
    1,
    Math.round((Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)) / 60000),
  );

  if (link.origem === "agendamento") {
    const { error } = await admin
      .from("tarefa_agendamentos")
      .update({ data: inicio.data, hora_inicio: hhmmss(inicio.hora), duracao_minutos: duration })
      .eq("id", link.origem_id)
      .eq("criado_por", userId);
    if (error) throw error;
  } else if (link.origem === "acao_avulsa") {
    const { error } = await admin
      .from("acoes_avulsas")
      .update({ data_agendada: inicio.data, hora_inicio: hhmmss(inicio.hora), duracao_minutos: duration })
      .eq("id", link.origem_id)
      .eq("criado_por", userId);
    if (error) throw error;
  } else if (link.origem_chave.includes("@")) {
    const originalDate = link.origem_chave.split("@").pop();
    const { error } = await admin.from("compromisso_ocorrencias").upsert(
      {
        user_id: userId,
        compromisso_id: link.origem_id,
        data_original: originalDate,
        data: inicio.data,
        hora_inicio: hhmmss(inicio.hora),
        hora_fim: hhmmss(fim.hora),
        cancelado: false,
      },
      { onConflict: "user_id,compromisso_id,data_original" },
    );
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("compromissos")
      .update({ data: inicio.data, hora_inicio: hhmmss(inicio.hora), hora_fim: hhmmss(fim.hora) })
      .eq("id", link.origem_id)
      .eq("criado_por", userId);
    if (error) throw error;
  }
  return true;
}

async function syncUnlocked(userId: string, conn: GoogleConnectionRow): Promise<SyncStats> {
  const admin = adminClient();
  const calendarId = String(conn.calendar_id || "primary");
  const timeZone = String(conn.calendar_timezone || TIMEZONE);
  const now = Date.now();
  const timeMin = new Date(now - WINDOW_PAST_DAYS * 86400000);
  const timeMax = new Date(now + WINDOW_FUTURE_DAYS * 86400000);
  const windowStart = isoDate(timeMin);
  const windowEnd = isoDate(timeMax);
  const stats: Required<Omit<SyncStats, "skipped">> = {
    connected: true,
    busy_upserts: 0,
    busy_removed: 0,
    eventos_criados: 0,
    eventos_atualizados: 0,
    eventos_removidos: 0,
    itens_desagendados: 0,
  };

  const { data: originalLinks } = await admin
    .from("google_calendar_event_links")
    .select("*")
    .eq("user_id", userId);
  let links = (originalLinks ?? []) as LinkRow[];
  const linkByGoogleId = new Map(links.map((link) => [link.google_event_id, link]));
  const linkByKey = new Map(links.map((link) => [link.origem_chave, link]));

  // Google -> app. A lista inclui exclusões para que apagar no Google apenas
  // desagende a ocorrência correspondente no app.
  const listEvents = async (
    syncToken: string | null,
  ): Promise<{ items: GoogleEvent[]; nextSyncToken: string | null; full: boolean }> => {
    const events: GoogleEvent[] = [];
    let nextSyncToken: string | null = null;
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "250" });
      if (syncToken) {
        params.set("syncToken", syncToken);
      } else {
        params.set("timeMin", timeMin.toISOString());
        params.set("timeMax", timeMax.toISOString());
        params.set("orderBy", "startTime");
      }
      if (pageToken) params.set("pageToken", pageToken);
      const res = await callGoogleApi(
        userId,
        `/calendar/v3/calendars/${enc(calendarId)}/events?${params.toString()}`,
      );
      if (res.status === 410 && syncToken) return listEvents(null);
      if (!res.ok) throw googleFailure("events_list", res.status);
      const body = await res.json();
      events.push(...((body.items ?? []) as GoogleEvent[]));
      pageToken = body.nextPageToken;
      if (body.nextSyncToken) nextSyncToken = body.nextSyncToken;
    } while (pageToken);
    return { items: events, nextSyncToken, full: !syncToken };
  };

  const listed = await listEvents(conn.sync_token ?? null);
  const activeExternalIds = new Set<string>();
  for (const event of listed.items) {
    const marker = event.extendedProperties?.private?.metasia;
    const linked = linkByGoogleId.get(event.id) || (marker ? linkByKey.get(marker) : undefined);
    if (linked) {
      if (event.status === "cancelled") {
        await cancelLocalMirror(admin, userId, linked);
        await admin.from("google_calendar_event_links").delete().eq("id", linked.id);
        stats.itens_desagendados++;
        continue;
      }
      const googleChanged = !linked.google_updated || (
        event.updated && new Date(event.updated) > new Date(linked.google_updated)
      );
      if (googleChanged && await applyGoogleMove(admin, userId, linked, event, timeZone)) {
        const changedAt = new Date().toISOString();
        await admin.from("google_calendar_event_links").update({
          etag: event.etag ?? null,
          google_updated: event.updated ?? changedAt,
          source_date: event.start?.dateTime
            ? googleDateTimeToLocal(event.start.dateTime, timeZone).data
            : linked.source_date,
          source_updated_at: changedAt,
        }).eq("id", linked.id);
      }
      continue;
    }

    if (event.status === "cancelled" || !event.start?.dateTime || !event.end?.dateTime) {
      const { data: removed } = await admin
        .from("google_busy_blocks")
        .delete()
        .eq("user_id", userId)
        .eq("google_event_id", event.id)
        .select("id");
      stats.busy_removed += removed?.length ?? 0;
      continue;
    }
    activeExternalIds.add(event.id);
    const start = googleDateTimeToLocal(event.start.dateTime, timeZone);
    const end = googleDateTimeToLocal(event.end.dateTime, timeZone);
    const { error } = await admin.from("google_busy_blocks").upsert(
      {
        user_id: userId,
        google_event_id: event.id,
        data: start.data,
        hora_inicio: hhmmss(start.hora),
        hora_fim: hhmmss(end.hora),
      },
      { onConflict: "user_id,google_event_id" },
    );
    if (!error) stats.busy_upserts++;
  }

  if (listed.full) {
    const { data: storedBusy } = await admin
      .from("google_busy_blocks")
      .select("id,google_event_id")
      .eq("user_id", userId)
      .gte("data", windowStart)
      .lte("data", windowEnd);
    for (const block of storedBusy ?? []) {
      if (activeExternalIds.has(block.google_event_id)) continue;
      await admin.from("google_busy_blocks").delete().eq("id", block.id);
      stats.busy_removed++;
    }
  }

  // App -> Google.
  const mirrors: Mirror[] = [];
  const { data: schedules, error: scheduleError } = await admin
    .from("tarefa_agendamentos")
    .select("id,tarefa_id,data,hora_inicio,duracao_minutos,observacao,updated_at")
    .eq("criado_por", userId)
    .gte("data", windowStart)
    .lte("data", windowEnd);
  if (scheduleError) throw scheduleError;
  const visibleSchedules = (schedules ?? []).filter((item) =>
    item.observacao !== OBSERVACAO_CANCELADA && !item.observacao?.startsWith(OBSERVACAO_DUPLICADA)
  );
  const taskIds = [...new Set(visibleSchedules.map((item) => item.tarefa_id))];
  const taskNames = new Map<string, string>();
  if (taskIds.length) {
    const { data: tasks } = await admin.from("plano_tarefas").select("id,descricao").in("id", taskIds);
    (tasks ?? []).forEach((task) => taskNames.set(task.id, task.descricao));
  }
  for (const item of visibleSchedules) {
    const end = addMinutesLocal(item.data, item.hora_inicio, item.duracao_minutos);
    mirrors.push({
      origem: "agendamento",
      origem_id: item.id,
      origem_chave: `agendamento:${item.id}`,
      agendamento_id: item.id,
      summary: taskNames.get(item.tarefa_id) ?? "Ação estratégica",
      data: item.data,
      data_fim: end.data,
      hora_inicio: hhmmss(item.hora_inicio),
      hora_fim: end.hora,
      updated_at: item.updated_at,
    });
  }

  const [{ data: commitments, error: commitmentError }, { data: changes, error: changesError }] = await Promise.all([
    admin
      .from("compromissos")
      .select("id,titulo,data,hora_inicio,hora_fim,recorrencia,recorrencia_fim,updated_at")
      .eq("criado_por", userId),
    admin
      .from("compromisso_ocorrencias")
      .select("compromisso_id,data_original,data,hora_inicio,hora_fim,cancelado,updated_at")
      .eq("user_id", userId),
  ]);
  if (commitmentError) throw commitmentError;
  if (changesError) throw changesError;
  const changesByKey = new Map(
    (changes ?? []).map((change) => [`${change.compromisso_id}|${change.data_original}`, change]),
  );
  for (const commitment of commitments ?? []) {
    const recurrence = commitment.recorrencia ?? "nenhuma";
    if (recurrence === "nenhuma") {
      const change = changesByKey.get(`${commitment.id}|${commitment.data}`);
      if (change?.cancelado) continue;
      const date = change?.data ?? commitment.data;
      if (date < windowStart || date > windowEnd) continue;
      const startTime = change?.hora_inicio ?? commitment.hora_inicio;
      const endTime = change?.hora_fim ?? commitment.hora_fim;
      mirrors.push({
        origem: "compromisso",
        origem_id: commitment.id,
        origem_chave: `compromisso:${commitment.id}`,
        agendamento_id: null,
        summary: commitment.titulo,
        data: date,
        data_fim: endDateForTimes(date, startTime, endTime),
        hora_inicio: hhmmss(startTime),
        hora_fim: hhmmss(endTime),
        updated_at: laterIso(commitment.updated_at, change?.updated_at),
      });
      continue;
    }

    const relevantOriginals = (changes ?? [])
      .filter((change) => change.compromisso_id === commitment.id && !change.cancelado && change.data >= windowStart && change.data <= windowEnd)
      .map((change) => change.data_original);
    const generationStart = [windowStart, ...relevantOriginals].sort()[0];
    const requestedEnd = [windowEnd, ...relevantOriginals].sort().slice(-1)[0];
    const generationEnd = commitment.recorrencia_fim && commitment.recorrencia_fim < requestedEnd
      ? commitment.recorrencia_fim
      : requestedEnd;
    let originalDate = commitment.data;
    while (originalDate < generationStart) originalDate = nextOccurrence(originalDate, recurrence);
    while (originalDate <= generationEnd) {
      const change = changesByKey.get(`${commitment.id}|${originalDate}`);
      const date = change?.data ?? originalDate;
      if (!change?.cancelado && date >= windowStart && date <= windowEnd) {
        const startTime = change?.hora_inicio ?? commitment.hora_inicio;
        const endTime = change?.hora_fim ?? commitment.hora_fim;
        mirrors.push({
          origem: "compromisso",
          origem_id: commitment.id,
          origem_chave: `compromisso:${commitment.id}@${originalDate}`,
          agendamento_id: null,
          summary: commitment.titulo,
          data: date,
          data_fim: endDateForTimes(date, startTime, endTime),
          hora_inicio: hhmmss(startTime),
          hora_fim: hhmmss(endTime),
          updated_at: laterIso(commitment.updated_at, change?.updated_at),
        });
      }
      originalDate = nextOccurrence(originalDate, recurrence);
    }
  }

  const { data: actions, error: actionsError } = await admin
    .from("acoes_avulsas")
    .select("id,descricao,data_agendada,hora_inicio,duracao_minutos,updated_at")
    .eq("criado_por", userId)
    .not("data_agendada", "is", null)
    .not("hora_inicio", "is", null)
    .gte("data_agendada", windowStart)
    .lte("data_agendada", windowEnd);
  if (actionsError) throw actionsError;
  for (const action of actions ?? []) {
    const end = addMinutesLocal(action.data_agendada, action.hora_inicio, action.duracao_minutos ?? 60);
    mirrors.push({
      origem: "acao_avulsa",
      origem_id: action.id,
      origem_chave: `acao_avulsa:${action.id}`,
      agendamento_id: null,
      summary: action.descricao,
      data: action.data_agendada,
      data_fim: end.data,
      hora_inicio: hhmmss(action.hora_inicio),
      hora_fim: end.hora,
      updated_at: action.updated_at,
    });
  }

  const { data: refreshedLinks } = await admin
    .from("google_calendar_event_links")
    .select("*")
    .eq("user_id", userId);
  links = (refreshedLinks ?? []) as LinkRow[];
  const currentByKey = new Map(links.map((link) => [link.origem_chave, link]));

  for (const mirror of mirrors) {
    const eventBody = {
      summary: mirror.summary,
      start: { dateTime: `${mirror.data}T${mirror.hora_inicio}`, timeZone },
      end: { dateTime: `${mirror.data_fim}T${mirror.hora_fim}`, timeZone },
      extendedProperties: { private: { metasia: mirror.origem_chave } },
    };
    const link = currentByKey.get(mirror.origem_chave);
    if (!link) {
      const eventId = await deterministicEventId(userId, mirror.origem_chave);
      let res = await callGoogleApi(
        userId,
        `/calendar/v3/calendars/${enc(calendarId)}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: eventId, ...eventBody }),
        },
      );
      const createdNow = res.ok;
      if (res.status === 409) {
        res = await callGoogleApi(
          userId,
          `/calendar/v3/calendars/${enc(calendarId)}/events/${enc(eventId)}`,
        );
      }
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw googleFailure("event_create", res.status);
        console.error(`Google event create failed (${res.status})`);
        continue;
      }
      const created = await res.json();
      const { error } = await admin.from("google_calendar_event_links").upsert(
        {
          user_id: userId,
          origem: mirror.origem,
          origem_id: mirror.origem_id,
          origem_chave: mirror.origem_chave,
          agendamento_id: mirror.agendamento_id,
          google_event_id: created.id ?? eventId,
          etag: created.etag ?? null,
          google_updated: created.updated ?? null,
          source_date: mirror.data,
          source_updated_at: mirror.updated_at,
        },
        { onConflict: "user_id,origem_chave" },
      );
      if (error) throw error;
      if (createdNow) stats.eventos_criados++;
      continue;
    }

    const sourceReference = link.source_updated_at ?? link.updated_at;
    if (new Date(mirror.updated_at) <= new Date(sourceReference)) continue;
    const res = await callGoogleApi(
      userId,
      `/calendar/v3/calendars/${enc(calendarId)}/events/${enc(link.google_event_id)}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventBody) },
    );
    if (res.status === 404 || res.status === 410) {
      await cancelLocalMirror(admin, userId, link);
      await admin.from("google_calendar_event_links").delete().eq("id", link.id);
      stats.itens_desagendados++;
      continue;
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw googleFailure("event_update", res.status);
      console.error(`Google event update failed (${res.status})`);
      continue;
    }
    const updated = await res.json();
    await admin.from("google_calendar_event_links").update({
      etag: updated.etag ?? null,
      google_updated: updated.updated ?? null,
      source_date: mirror.data,
      source_updated_at: mirror.updated_at,
    }).eq("id", link.id);
    stats.eventos_atualizados++;
  }

  // Itens desagendados/cancelados no app removem somente o espelho no Google.
  const activeKeys = new Set(mirrors.map((mirror) => mirror.origem_chave));
  for (const link of links) {
    if (activeKeys.has(link.origem_chave)) continue;
    if (link.source_date && (link.source_date < windowStart || link.source_date > windowEnd)) continue;
    const res = await callGoogleApi(
      userId,
      `/calendar/v3/calendars/${enc(calendarId)}/events/${enc(link.google_event_id)}`,
      { method: "DELETE" },
    );
    if (res.ok || res.status === 404 || res.status === 410) {
      await admin.from("google_calendar_event_links").delete().eq("id", link.id);
      stats.eventos_removidos++;
    } else if (res.status === 401 || res.status === 403) {
      throw googleFailure("event_delete", res.status);
    }
  }

  // Push real do Google: canal autenticado por id, resource id e token aleatório.
  try {
    const expiration = conn.webhook_expiration ? new Date(conn.webhook_expiration).getTime() : 0;
    if (expiration < now + 86400000) {
      if (conn.webhook_channel_id && conn.webhook_resource_id) {
        await callGoogleApi(
          userId,
          "/calendar/v3/channels/stop",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: conn.webhook_channel_id, resourceId: conn.webhook_resource_id }),
          },
        );
      }
      const channelId = crypto.randomUUID();
      const channelToken = crypto.randomUUID().replaceAll("-", "");
      const address = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-webhook`;
      const res = await callGoogleApi(
        userId,
        `/calendar/v3/calendars/${enc(calendarId)}/events/watch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: channelId, token: channelToken, type: "web_hook", address }),
        },
      );
      if (res.ok) {
        const channel = await res.json();
        await admin.from("google_calendar_connections").update({
          webhook_channel_id: channelId,
          webhook_resource_id: channel.resourceId ?? null,
          webhook_token: channelToken,
          webhook_expiration: channel.expiration ? new Date(Number(channel.expiration)).toISOString() : null,
        }).eq("user_id", userId);
      } else {
        console.error(`Google watch registration failed (${res.status})`);
      }
    }
  } catch {
    console.error("Google watch setup failed");
  }

  await admin.from("google_calendar_connections").update({
    sync_token: listed.nextSyncToken ?? conn.sync_token,
    last_sync_at: new Date().toISOString(),
    needs_reconnect: false,
    last_error_code: null,
  }).eq("user_id", userId);
  return stats;
}

export async function sincronizarUsuario(userId: string): Promise<SyncStats> {
  if (!await hasGoogleConnection(userId)) return { connected: false };
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

  const { data: acquired, error: lockError } = await admin.rpc(
    "acquire_google_calendar_sync_lock",
    { _user_id: userId, _seconds: 120 },
  );
  if (lockError) throw lockError;
  if (!acquired) return { connected: true, skipped: true };

  try {
    return await syncUnlocked(userId, conn);
  } catch (error) {
    const code = (error as SyncFailure)?.code ?? "sync_failed";
    await admin.from("google_calendar_connections").update({
      needs_reconnect: code === "reconnect_required",
      last_error_code: code,
    }).eq("user_id", userId);
    throw error;
  } finally {
    await admin.rpc("release_google_calendar_sync_lock", { _user_id: userId });
  }
}
