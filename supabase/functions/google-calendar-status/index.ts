import { adminClient, getConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import {
  CONNECTOR_ID,
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
  if (!key) return jsonResponse({ success: true, connected: false });

  const { data: conn } = await adminClient()
    .from("google_calendar_connections")
    .select("google_email, calendar_id, last_sync_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return jsonResponse({
    success: true,
    connected: true,
    google_email: conn?.google_email ?? null,
    calendar_id: conn?.calendar_id ?? "primary",
    last_sync_at: conn?.last_sync_at ?? null,
  });
});
