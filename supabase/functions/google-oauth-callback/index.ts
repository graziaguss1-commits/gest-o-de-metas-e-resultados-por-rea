import { adminClient } from "../_shared/appUserConnections.ts";
import {
  callGoogleApi,
  exchangeGoogleAuthorizationCode,
  originFromGoogleOAuthState,
} from "../_shared/googleOAuth.ts";
import { sincronizarUsuario } from "../_shared/googleCalendarSync.ts";
import { jsonResponse, sha256Hex } from "../_shared/googleCalendarShared.ts";

function redirectToApp(origin: string, success: boolean, error?: string, warning?: boolean) {
  const target = new URL("/oauth/google-calendar/return", origin);
  target.searchParams.set("success", String(success));
  if (error) target.searchParams.set("error", error);
  if (warning) target.searchParams.set("sync_warning", "true");
  return Response.redirect(target.toString(), 302);
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return jsonResponse({ success: false, code: "method_not_allowed" }, 405);

  const requestUrl = new URL(req.url);
  const state = requestUrl.searchParams.get("state");
  if (!state) return jsonResponse({ success: false, error: "Autorização inválida ou expirada.", code: "invalid_oauth_state" }, 400);

  const origin = originFromGoogleOAuthState(state);
  if (!origin) return jsonResponse({ success: false, error: "Origem de retorno inválida.", code: "invalid_return_origin" }, 400);

  const admin = adminClient();
  const stateHash = await sha256Hex(state);
  const { data: consumed, error: stateError } = await admin
    .from("google_calendar_oauth_states")
    .delete()
    .eq("state_hash", stateHash)
    .gt("expires_at", new Date().toISOString())
    .select("user_id")
    .maybeSingle();

  if (stateError || !consumed?.user_id) {
    return jsonResponse({ success: false, error: "Autorização inválida ou expirada.", code: "invalid_oauth_state" }, 400);
  }

  if (requestUrl.searchParams.get("error")) {
    return redirectToApp(origin, false, "access_denied");
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) return redirectToApp(origin, false, "missing_code");

  try {
    const { data: previousConnection, error: previousConnectionError } = await admin
      .from("google_calendar_connections")
      .select("google_email,calendar_id,calendar_timezone,webhook_channel_id,webhook_resource_id")
      .eq("user_id", consumed.user_id)
      .maybeSingle();
    if (previousConnectionError) throw previousConnectionError;

    await exchangeGoogleAuthorizationCode(consumed.user_id, code);

    const primaryResponse = await callGoogleApi(
      consumed.user_id,
      "/calendar/v3/calendars/primary",
    );
    if (!primaryResponse.ok) throw new Error(`primary_calendar_${primaryResponse.status}`);
    const primary = await primaryResponse.json();
    const googleEmail = typeof primary?.id === "string" ? primary.id : null;
    const sameAccount = Boolean(
      previousConnection?.google_email &&
      googleEmail &&
      previousConnection.google_email === googleEmail,
    );

    if (previousConnection?.webhook_channel_id && previousConnection.webhook_resource_id) {
      await callGoogleApi(consumed.user_id, "/calendar/v3/channels/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: previousConnection.webhook_channel_id,
          resourceId: previousConnection.webhook_resource_id,
        }),
      }).catch(() => undefined);
    }

    // Ao trocar de conta, IDs da agenda antiga não podem ser reaproveitados.
    if (!sameAccount) {
      const [linksCleanup, busyCleanup] = await Promise.all([
        admin.from("google_calendar_event_links").delete().eq("user_id", consumed.user_id),
        admin.from("google_busy_blocks").delete().eq("user_id", consumed.user_id),
      ]);
      if (linksCleanup.error) throw linksCleanup.error;
      if (busyCleanup.error) throw busyCleanup.error;
    }
    const { error: connectionError } = await admin.from("google_calendar_connections").upsert({
      user_id: consumed.user_id,
      google_email: googleEmail,
      calendar_id: sameAccount ? (previousConnection?.calendar_id || "primary") : "primary",
      calendar_timezone: sameAccount
        ? (previousConnection?.calendar_timezone || (typeof primary?.timeZone === "string" ? primary.timeZone : null))
        : (typeof primary?.timeZone === "string" ? primary.timeZone : null),
      sync_token: null,
      webhook_channel_id: null,
      webhook_resource_id: null,
      webhook_token: null,
      webhook_expiration: null,
      needs_reconnect: false,
      last_error_code: null,
    }, { onConflict: "user_id" });
    if (connectionError) throw connectionError;

    let syncWarning = false;
    try {
      await sincronizarUsuario(consumed.user_id);
    } catch {
      syncWarning = true;
      console.error("google-oauth-callback initial sync failed");
    }
    return redirectToApp(origin, true, undefined, syncWarning);
  } catch (error) {
    console.error("google-oauth-callback failed", error instanceof Error ? error.name : "unknown");
    return redirectToApp(origin, false, "oauth_complete_failed");
  }
});
