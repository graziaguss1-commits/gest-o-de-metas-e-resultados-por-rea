import { adminClient } from "../_shared/appUserConnections.ts";
import { callGoogleApi, hasGoogleConnection } from "../_shared/googleOAuth.ts";
import {
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
} from "../_shared/googleCalendarShared.ts";

type GoogleEventColor = {
  background?: unknown;
  foreground?: unknown;
};

function parseEventColors(body: unknown) {
  const event = (body as { event?: Record<string, GoogleEventColor> } | null)?.event ?? {};
  return Object.entries(event)
    .map(([id, color]) => ({
      id,
      background: typeof color.background === "string" ? color.background : "#039BE5",
      foreground: typeof color.foreground === "string" ? color.foreground : "#FFFFFF",
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

async function recolorManagedEvents(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  calendarId: string,
  colorId: string | null,
) {
  const { data: links, error } = await admin
    .from("google_calendar_event_links")
    .select("id,google_event_id")
    .eq("user_id", userId);
  if (error) throw error;

  let recolored = 0;
  let failures = 0;
  let reconnect = false;
  for (const link of links ?? []) {
    const response = await callGoogleApi(
      userId,
      `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(link.google_event_id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorId }),
      },
    );
    if (response.ok) {
      recolored++;
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      await admin.from("google_calendar_event_links").delete().eq("id", link.id);
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      reconnect = true;
      break;
    }
    failures++;
  }
  return { recolored, failures, reconnect };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" }, 401);
  if (!await hasGoogleConnection(user.id)) {
    return jsonResponse({ success: true, connected: false, calendars: [] });
  }

  const [listResponse, colorsResponse] = await Promise.all([
    callGoogleApi(
      user.id,
      "/calendar/v3/users/me/calendarList?minAccessRole=writer&maxResults=100",
    ),
    callGoogleApi(user.id, "/calendar/v3/colors"),
  ]);
  if (!listResponse.ok) {
    const reconnect = listResponse.status === 401 || listResponse.status === 403;
    return jsonResponse({
      success: false,
      error: reconnect ? "Reconecte sua conta Google." : "Não foi possível listar os calendários.",
      code: reconnect ? "reconnect_required" : "list_failed",
    }, reconnect ? 409 : 502);
  }
  const body = await listResponse.json();
  const calendars = ((body.items ?? []) as Array<Record<string, unknown>>).map((calendar) => ({
    id: String(calendar.id),
    summary: String(calendar.summary ?? calendar.id),
    primary: Boolean(calendar.primary),
    timeZone: typeof calendar.timeZone === "string" ? calendar.timeZone : null,
  }));
  const colorsBody = colorsResponse.ok ? await colorsResponse.json().catch(() => null) : null;
  const eventColors = parseEventColors(colorsBody);
  const admin = adminClient();
  const { data: connection } = await admin
    .from("google_calendar_connections")
    .select("calendar_id,event_color_id,webhook_channel_id,webhook_resource_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (req.method !== "POST") {
    return jsonResponse({
      success: true,
      connected: true,
      calendars,
      event_colors: eventColors,
      event_color_id: connection?.event_color_id ?? null,
    });
  }

  const payload = await req.json().catch(() => ({}));
  const hasCalendarSelection = Object.prototype.hasOwnProperty.call(payload, "calendar_id");
  const hasColorSelection = Object.prototype.hasOwnProperty.call(payload, "event_color_id");
  if (hasCalendarSelection === hasColorSelection) {
    return jsonResponse({ success: false, error: "Configuração inválida.", code: "invalid_request" }, 400);
  }

  const selectedId = payload?.calendar_id;
  const selected = hasCalendarSelection && typeof selectedId === "string"
    ? calendars.find((item) => item.id === selectedId)
    : null;
  if (hasCalendarSelection && !selected) {
    return jsonResponse({ success: false, error: "Calendário inválido.", code: "invalid_calendar" }, 400);
  }

  const requestedColorId = payload?.event_color_id;
  const colorId = requestedColorId === null
    ? null
    : typeof requestedColorId === "string"
      ? requestedColorId
      : undefined;
  if (hasColorSelection && (colorId === undefined || (colorId !== null && !eventColors.some((color) => color.id === colorId)))) {
    return jsonResponse({ success: false, error: "Cor inválida.", code: "invalid_event_color" }, 400);
  }

  const { data: acquired } = await admin.rpc("acquire_google_calendar_sync_lock", { _user_id: user.id, _seconds: 120 });
  if (!acquired) {
    return jsonResponse({ success: false, error: "Aguarde a sincronização atual terminar e tente novamente.", code: "sync_in_progress" }, 409);
  }
  try {
    if (hasColorSelection) {
      const { error: updateError } = await admin
        .from("google_calendar_connections")
        .upsert(
          { user_id: user.id, event_color_id: colorId },
          { onConflict: "user_id" },
        );
      if (updateError) throw updateError;

      const result = await recolorManagedEvents(
        admin,
        user.id,
        connection?.calendar_id || "primary",
        colorId ?? null,
      );
      if (result.reconnect) {
        await admin.from("google_calendar_connections").update({
          needs_reconnect: true,
          last_error_code: "reconnect_required",
        }).eq("user_id", user.id);
        return jsonResponse({
          success: false,
          error: "A autorização do Google expirou. Reconecte sua conta.",
          code: "reconnect_required",
        }, 409);
      }
      return jsonResponse({
        success: true,
        event_color_id: colorId,
        recolored_events: result.recolored,
        recolor_failures: result.failures,
      });
    }

    const selectedCalendar = selected;
    if (!selectedCalendar) {
      return jsonResponse({ success: false, error: "Calendário inválido.", code: "invalid_calendar" }, 400);
    }
    const oldCalendarId = connection?.calendar_id || "primary";
    if (oldCalendarId === selectedCalendar.id) {
      await admin.from("google_calendar_connections").update({ calendar_timezone: selectedCalendar.timeZone }).eq("user_id", user.id);
      return jsonResponse({ success: true, connected: true, calendars, calendar_id: selectedCalendar.id });
    }

    const { data: links } = await admin
      .from("google_calendar_event_links")
      .select("id,google_event_id")
      .eq("user_id", user.id);
    for (const link of links ?? []) {
      const deletion = await callGoogleApi(
        user.id,
        `/calendar/v3/calendars/${encodeURIComponent(oldCalendarId)}/events/${encodeURIComponent(link.google_event_id)}`,
        { method: "DELETE" },
      );
      if (!(deletion.ok || deletion.status === 404 || deletion.status === 410)) {
        return jsonResponse({ success: false, error: "Não foi possível mover todos os eventos. Tente novamente.", code: "calendar_move_failed" }, 502);
      }
      await admin.from("google_calendar_event_links").delete().eq("id", link.id);
    }

    if (connection?.webhook_channel_id && connection.webhook_resource_id) {
      await callGoogleApi(
        user.id,
        "/calendar/v3/channels/stop",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: connection.webhook_channel_id, resourceId: connection.webhook_resource_id }),
        },
      );
    }
    await admin.from("google_calendar_connections").update({
      calendar_id: selectedCalendar.id,
      calendar_timezone: selectedCalendar.timeZone,
      sync_token: null,
      webhook_channel_id: null,
      webhook_resource_id: null,
      webhook_token: null,
      webhook_expiration: null,
      needs_reconnect: false,
      last_error_code: null,
    }).eq("user_id", user.id);
    await admin.from("google_busy_blocks").delete().eq("user_id", user.id);
    return jsonResponse({ success: true, connected: true, calendars, calendar_id: selectedCalendar.id });
  } catch {
    console.error(hasColorSelection ? "google-calendar-calendars color update failed" : "google-calendar-calendars switch failed");
    return jsonResponse({
      success: false,
      error: hasColorSelection ? "Não foi possível atualizar a cor dos eventos." : "Não foi possível trocar o calendário.",
      code: hasColorSelection ? "event_color_update_failed" : "calendar_switch_failed",
    }, 502);
  } finally {
    await admin.rpc("release_google_calendar_sync_lock", { _user_id: user.id });
  }
});
