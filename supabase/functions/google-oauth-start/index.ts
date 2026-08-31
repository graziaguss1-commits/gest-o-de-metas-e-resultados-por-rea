import { authorizeAppUserOAuth } from "../_shared/appUserConnector.ts";
import { getConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import {
  CLIENT_KEY_ENV,
  CONNECTOR_ID,
  GATEWAY_BASE_URL,
  GOOGLE_SCOPES,
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

  const clientAPIKey = Deno.env.get(CLIENT_KEY_ENV);
  if (!clientAPIKey) {
    return jsonResponse(
      { success: false, error: `${CLIENT_KEY_ENV} is not set`, code: "client_not_configured" },
      500,
    );
  }

  try {
    const { origin } = await req.json();
    const base = typeof origin === "string" && origin.startsWith("http") ? origin : null;
    if (!base) {
      return jsonResponse({ success: false, error: "Origem inválida.", code: "invalid_origin" }, 400);
    }
    const returnUrl = new URL("/oauth/google-calendar/return", base).toString();

    // Reconnect: passa a chave existente para o gateway confirmar posse.
    const connectionAPIKey = await getConnectionKeyForUser(user.id, CONNECTOR_ID);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: user.id,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: { scopes: GOOGLE_SCOPES },
    });
    return jsonResponse({ success: true, authorizationUrl });
  } catch (error) {
    console.error("google-oauth-start error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Erro ao iniciar conexão.", code: "oauth_start_failed" },
      500,
    );
  }
});
