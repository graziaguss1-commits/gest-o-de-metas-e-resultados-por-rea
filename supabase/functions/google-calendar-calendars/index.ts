import { adminClient } from "../_shared/appUserConnections.ts";
import { callGoogleApi, hasGoogleConnection } from "../_shared/googleOAuth.ts";
import {
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
} from "../_shared/googleCalendarShared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" }, 401);
  if (!await hasGoogleConnection(user.id)) {
    return jsonResponse({ success: true, connected: false, calendars: [] });
  }

  const listResponse = await callGoogleApi(
    user.id,
    "/calendar/v3/users/me/calendarList?minAccessRole=writer&maxResults=100",
  );
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
  if (req.method !== "POST") return jsonResponse({ success: true, connected: true, calendars });

  const payload = await req.json().catch(() => ({}));
  const selectedId = payload?.calendar_id;
  const selected = typeof selectedId === "string" ? calendars.find((item) => item.id === selectedId) : null;
  if (!selected) return jsonResponse({ success: false, error: "Calendário inválido.", code: "invalid_calendar" }, 400);

  const admin = adminClient();
  const { data: acquired } = await admin.rpc("acquire_google_calendar_sync_lock", { _user_id: user.id, _seconds: 120 });
  if (!acquired) {
    return jsonResponse({ success: false, error: "Aguarde a sincronização atual terminar e tente novamente.", code: "sync_in_progress" }, 409);
  }
  try {
    const { data: connection } = await admin
      .from("google_calendar_connections")
      .select("calendar_id,webhook_channel_id,webhook_resource_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const oldCalendarId = connection?.calendar_id || "primary";
    if (oldCalendarId === selected.id) {
      await admin.from("google_calendar_connections").update({ calendar_timezone: selected.timeZone }).eq("user_id", user.id);
      return jsonResponse({ success: true, connected: true, calendars, calendar_id: selected.id });
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
      calendar_id: selected.id,
      calendar_timezone: selected.timeZone,
      sync_token: null,
      webhook_channel_id: null,
      webhook_resource_id: null,
      webhook_token: null,
      webhook_expiration: null,
      needs_reconnect: false,
      last_error_code: null,
    }).eq("user_id", user.id);
    await admin.from("google_busy_blocks").delete().eq("user_id", user.id);
    return jsonResponse({ success: true, connected: true, calendars, calendar_id: selected.id });
  } catch {
    console.error("google-calendar-calendars switch failed");
    return jsonResponse({ success: false, error: "Não foi possível trocar o calendário.", code: "calendar_switch_failed" }, 502);
  } finally {
    await admin.rpc("release_google_calendar_sync_lock", { _user_id: user.id });
  }
});
