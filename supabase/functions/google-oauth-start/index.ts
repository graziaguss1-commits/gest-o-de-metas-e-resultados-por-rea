import { authorizeAppUserOAuth } from "../_shared/appUserConnector.ts";
import { adminClient, getConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import {
  CLIENT_KEY_ENV,
  CONNECTOR_ID,
  GATEWAY_BASE_URL,
  GOOGLE_SCOPES,
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
  sha256Hex,
} from "../_shared/googleCalendarShared.ts";

function validOrigin(value: unknown, requestOrigin: string | null) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.origin !== value || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) return null;
    if (requestOrigin && requestOrigin !== url.origin) return null;
    return url.origin;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, code: "method_not_allowed" }, 405);
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" }, 401);

  const clientAPIKey = Deno.env.get(CLIENT_KEY_ENV);
  if (!clientAPIKey) {
    return jsonResponse({ success: false, error: "A integração ainda não está configurada.", code: "client_not_configured" }, 503);
  }

  const admin = adminClient();
  let stateHash: string | null = null;
  try {
    const payload = await req.json().catch(() => ({}));
    const origin = validOrigin(payload?.origin, req.headers.get("Origin"));
    if (!origin) return jsonResponse({ success: false, error: "Origem inválida.", code: "invalid_origin" }, 400);

    const state = crypto.randomUUID();
    stateHash = await sha256Hex(state);
    await admin.from("google_calendar_oauth_states").delete().eq("user_id", user.id);
    const { error: stateError } = await admin.from("google_calendar_oauth_states").insert({
      user_id: user.id,
      state_hash: stateHash,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (stateError) throw stateError;

    const returnUrl = new URL("/oauth/google-calendar/return", origin);
    returnUrl.searchParams.set("gstate", state);
    const connectionAPIKey = await getConnectionKeyForUser(user.id, CONNECTOR_ID);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: user.id,
      clientAPIKey,
      returnUrl: returnUrl.toString(),
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: { scopes: GOOGLE_SCOPES },
    });
    return jsonResponse({ success: true, authorizationUrl });
  } catch {
    if (stateHash) {
      await admin.from("google_calendar_oauth_states").delete().eq("user_id", user.id).eq("state_hash", stateHash);
    }
    console.error("google-oauth-start failed");
    return jsonResponse({ success: false, error: "Não foi possível iniciar a conexão com o Google.", code: "oauth_start_failed" }, 502);
  }
});
