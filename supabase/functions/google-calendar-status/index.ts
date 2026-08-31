import { adminClient, getConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import { CONNECTOR_ID, corsHeaders, getAuthenticatedUser, jsonResponse } from "../_shared/googleCalendarShared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" }, 401);
  const key = await getConnectionKeyForUser(user.id, CONNECTOR_ID);
  if (!key) return jsonResponse({ success: true, connected: false, needs_reconnect: false });
  const { data: connection } = await adminClient()
    .from("google_calendar_connections")
    .select("google_email,calendar_id,calendar_timezone,last_sync_at,needs_reconnect")
    .eq("user_id", user.id)
    .maybeSingle();
  return jsonResponse({
    success: true,
    connected: true,
    needs_reconnect: connection?.needs_reconnect ?? false,
    google_email: connection?.google_email ?? null,
    calendar_id: connection?.calendar_id ?? "primary",
    calendar_timezone: connection?.calendar_timezone ?? null,
    last_sync_at: connection?.last_sync_at ?? null,
  });
});
