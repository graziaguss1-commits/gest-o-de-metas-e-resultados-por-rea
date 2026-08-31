import { callAsAppUser, exchangeAppUserOAuthCode } from "../_shared/appUserConnector.ts";
import { adminClient, saveConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import { sincronizarUsuario } from "../_shared/googleCalendarSync.ts";
import {
  CONNECTOR_ID,
  GATEWAY_BASE_URL,
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
  sha256Hex,
} from "../_shared/googleCalendarShared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, code: "method_not_allowed" }, 405);
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" }, 401);

  const admin = adminClient();
  try {
    const { code, state } = await req.json().catch(() => ({}));
    if (typeof code !== "string" || !code || typeof state !== "string" || !state) {
      return jsonResponse({ success: false, error: "Autorização inválida ou expirada.", code: "invalid_oauth_return" }, 400);
    }
    const stateHash = await sha256Hex(state);
    const { data: consumed } = await admin
      .from("google_calendar_oauth_states")
      .delete()
      .eq("user_id", user.id)
      .eq("state_hash", stateHash)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (!consumed) {
      return jsonResponse({ success: false, error: "Autorização inválida ou expirada.", code: "invalid_oauth_state" }, 400);
    }

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
    if (connectorId !== CONNECTOR_ID) {
      return jsonResponse({ success: false, error: "A autorização retornou uma integração incorreta.", code: "connector_mismatch" }, 400);
    }
    await saveConnectionKeyForUser(user.id, connectorId, connectionAPIKey);
    await admin.from("google_calendar_connections").upsert(
      { user_id: user.id, needs_reconnect: false, last_error_code: null },
      { onConflict: "user_id" },
    );

    const primaryResponse = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: "/calendar/v3/calendars/primary",
    });
    if (primaryResponse.ok) {
      const primary = await primaryResponse.json();
      await admin.from("google_calendar_connections").update({
        google_email: typeof primary?.id === "string" ? primary.id : null,
        calendar_timezone: typeof primary?.timeZone === "string" ? primary.timeZone : null,
      }).eq("user_id", user.id);
    }

    let syncWarning = false;
    try {
      await sincronizarUsuario(user.id);
    } catch {
      syncWarning = true;
      console.error("google-oauth-complete initial sync failed");
    }
    return jsonResponse({ success: true, sync_warning: syncWarning });
  } catch {
    console.error("google-oauth-complete failed");
    return jsonResponse({ success: false, error: "Não foi possível concluir a conexão com o Google.", code: "oauth_complete_failed" }, 502);
  }
});
