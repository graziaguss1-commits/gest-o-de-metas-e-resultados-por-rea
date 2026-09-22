import { adminClient } from "../_shared/appUserConnections.ts";
import { callGoogleApi, hasGoogleConnection, revokeGoogleConnection } from "../_shared/googleOAuth.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse } from "../_shared/googleCalendarShared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" }, 401);
  const admin = adminClient();
  try {
    if (await hasGoogleConnection(user.id)) {
      const { data: connection } = await admin
        .from("google_calendar_connections")
        .select("calendar_id,webhook_channel_id,webhook_resource_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: links } = await admin
        .from("google_calendar_event_links")
        .select("google_event_id")
        .eq("user_id", user.id);
      for (const link of links ?? []) {
        await callGoogleApi(
          user.id,
          `/calendar/v3/calendars/${encodeURIComponent(connection?.calendar_id || "primary")}/events/${encodeURIComponent(link.google_event_id)}`,
          { method: "DELETE" },
        ).catch(() => undefined);
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
        ).catch(() => undefined);
      }
    }
    // Também remove credenciais legadas do antigo conector do Lovable.
    await revokeGoogleConnection(user.id).catch(() => undefined);
    await admin.from("google_calendar_event_links").delete().eq("user_id", user.id);
    await admin.from("google_busy_blocks").delete().eq("user_id", user.id);
    await admin.from("google_calendar_oauth_states").delete().eq("user_id", user.id);
    await admin.from("google_calendar_connections").delete().eq("user_id", user.id);
    return jsonResponse({ success: true });
  } catch {
    console.error("google-calendar-disconnect failed");
    return jsonResponse({ success: false, error: "Não foi possível desconectar o Google Agenda.", code: "disconnect_failed" }, 500);
  }
});
