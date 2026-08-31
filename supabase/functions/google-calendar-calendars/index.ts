// Lista os calendários do próprio usuário e permite escolher o destino do
// espelhamento. GET = listar; POST { calendar_id } = selecionar.
import { callAsAppUser } from "../_shared/appUserConnector.ts";
import { adminClient, getConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import {
  CONNECTOR_ID,
  GATEWAY_BASE_URL,
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
} from "../_shared/googleCalendarShared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return jsonResponse(
      { success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" },
      401,
    );
  }

  const key = await getConnectionKeyForUser(user.id, CONNECTOR_ID);
  if (!key) return jsonResponse({ success: true, connected: false, calendars: [] });

  try {
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path: "/calendar/v3/users/me/calendarList?minAccessRole=writer&maxResults=100",
    });
    if (!res.ok) {
      return jsonResponse(
        { success: false, error: `Falha ao listar calendários (${res.status}).`, code: "list_failed" },
        502,
      );
    }
    const body = await res.json();
    const calendars = ((body.items ?? []) as Array<Record<string, unknown>>).map((c) => ({
      id: String(c.id),
      summary: String(c.summary ?? c.id),
      primary: Boolean(c.primary),
      timeZone: typeof c.timeZone === "string" ? c.timeZone : null,
    }));

    if (req.method !== "POST") {
      return jsonResponse({ success: true, connected: true, calendars });
    }

    const payload = await req.json().catch(() => ({}));
    const calendarId = payload?.calendar_id;
    if (typeof calendarId !== "string" || !calendarId) {
      return jsonResponse({ success: false, error: "Calendário inválido.", code: "invalid_calendar" }, 400);
    }
    const escolhido = calendars.find((c) => c.id === calendarId);
    if (!escolhido) {
      return jsonResponse(
        { success: false, error: "Calendário não encontrado na sua conta.", code: "calendar_not_found" },
        400,
      );
    }

    // Troca de destino: limpa estado de sync e vínculos antigos (os eventos já
    // criados no calendário anterior permanecem lá, intocados).
    const admin = adminClient();
    await admin
      .from("google_calendar_connections")
      .update({
        calendar_id: escolhido.id,
        calendar_timezone: escolhido.timeZone,
        sync_token: null,
        webhook_channel_id: null,
        webhook_resource_id: null,
        webhook_expiration: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    await admin.from("google_calendar_event_links").delete().eq("user_id", user.id);
    await admin.from("google_busy_blocks").delete().eq("user_id", user.id);

    return jsonResponse({ success: true, connected: true, calendars, calendar_id: escolhido.id });
  } catch (error) {
    console.error("google-calendar-calendars error:", error);
    return jsonResponse(
      { success: false, error: "Erro ao consultar calendários.", code: "calendars_failed" },
      500,
    );
  }
});
