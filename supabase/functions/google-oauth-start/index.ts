import { adminClient } from "../_shared/appUserConnections.ts";
import {
  assertGoogleOAuthConfigured,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  GoogleOAuthError,
} from "../_shared/googleOAuth.ts";
import {
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

  const admin = adminClient();
  let stateHash: string | null = null;
  try {
    assertGoogleOAuthConfigured();
    const payload = await req.json().catch(() => ({}));
    const origin = validOrigin(payload?.origin, req.headers.get("Origin"));
    if (!origin) return jsonResponse({ success: false, error: "Origem inválida.", code: "invalid_origin" }, 400);

    const state = createGoogleOAuthState(origin);
    stateHash = await sha256Hex(state);
    await admin.from("google_calendar_oauth_states").delete().eq("user_id", user.id);
    const { error: stateError } = await admin.from("google_calendar_oauth_states").insert({
      user_id: user.id,
      state_hash: stateHash,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (stateError) throw stateError;

    const authorizationUrl = buildGoogleAuthorizationUrl(state);
    return jsonResponse({ success: true, authorizationUrl });
  } catch (error) {
    if (stateHash) {
      await admin.from("google_calendar_oauth_states").delete().eq("user_id", user.id).eq("state_hash", stateHash);
    }
    const notConfigured = error instanceof GoogleOAuthError && error.status === 503;
    console.error(notConfigured ? "google-oauth-start not configured" : "google-oauth-start failed");
    return jsonResponse({
      success: false,
      error: notConfigured
        ? "A integração Google ainda não foi ativada no GitHub."
        : "Não foi possível iniciar a conexão com o Google.",
      code: notConfigured ? "google_not_configured" : "oauth_start_failed",
    }, notConfigured ? 503 : 502);
  }
});
