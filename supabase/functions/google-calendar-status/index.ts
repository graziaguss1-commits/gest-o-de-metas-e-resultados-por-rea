import { adminClient } from "../_shared/appUserConnections.ts";
import { hasGoogleConnection } from "../_shared/googleOAuth.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse } from "../_shared/googleCalendarShared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" }, 401);
  const { data: connection } = await adminClient()
    .from("google_calendar_connections")
    .select("google_email,calendar_id,calendar_timezone,last_sync_at,needs_reconnect")
    .eq("user_id", user.id)
    .maybeSingle();
  const hasTokens = await hasGoogleConnection(user.id);
  const needsReconnect = connection?.needs_reconnect ?? false;
  return jsonResponse({
    success: true,
    connected: hasTokens || needsReconnect,
    needs_reconnect: needsReconnect,
    google_email: connection?.google_email ?? null,
    calendar_id: connection?.calendar_id ?? "primary",
    calendar_timezone: connection?.calendar_timezone ?? null,
    last_sync_at: connection?.last_sync_at ?? null,
  });
});
