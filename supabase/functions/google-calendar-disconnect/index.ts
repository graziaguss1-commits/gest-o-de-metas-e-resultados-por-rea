import { disconnectAppUser } from "../_shared/appUserConnector.ts";
import {
  adminClient,
  deleteConnectionKeyForUser,
  getConnectionKeyForUser,
} from "../_shared/appUserConnections.ts";
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

  try {
    const key = await getConnectionKeyForUser(user.id, CONNECTOR_ID);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CONNECTOR_ID,
        });
      } catch (gatewayError) {
        console.error("google-calendar-disconnect: gateway revoke failed:", gatewayError);
      }
      await deleteConnectionKeyForUser(user.id, CONNECTOR_ID);
    }

    // Remove apenas os dados do próprio usuário.
    const admin = adminClient();
    await admin.from("google_calendar_event_links").delete().eq("user_id", user.id);
    await admin.from("google_busy_blocks").delete().eq("user_id", user.id);
    await admin.from("google_calendar_connections").delete().eq("user_id", user.id);

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("google-calendar-disconnect error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Erro ao desconectar.", code: "disconnect_failed" },
      500,
    );
  }
});
