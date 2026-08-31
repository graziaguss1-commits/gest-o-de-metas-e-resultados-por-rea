import { callAsAppUser, exchangeAppUserOAuthCode } from "../_shared/appUserConnector.ts";
import { adminClient, saveConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import { sincronizarUsuario } from "../_shared/googleCalendarSync.ts";
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
    const { code } = await req.json();
    if (typeof code !== "string" || !code) {
      return jsonResponse({ success: false, error: "Código ausente.", code: "missing_code" }, 400);
    }
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
    if (connectorId !== CONNECTOR_ID) {
      return jsonResponse(
        { success: false, error: "OAuth completion returned the wrong connector", code: "connector_mismatch" },
        400,
      );
    }
    await saveConnectionKeyForUser(user.id, connectorId, connectionAPIKey);

    // Garante a linha de conexão e identifica a conta Google (id do calendário
    // principal é o e-mail da conta). Nunca expomos dados de outros usuários.
    const admin = adminClient();
    const { data: existing } = await admin
      .from("google_calendar_connections")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) {
      await admin.from("google_calendar_connections").insert({ user_id: user.id });
    }
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
        path: "/calendar/v3/calendars/primary",
      });
      if (res.ok) {
        const primary = await res.json();
        if (primary?.id) {
          await admin
            .from("google_calendar_connections")
            .update({ google_email: primary.id, updated_at: new Date().toISOString() })
            .eq("user_id", user.id);
        }
      }
    } catch (emailError) {
      console.error("google-oauth-complete: primary calendar lookup failed:", emailError);
    }

    // Primeira sincronização em melhor esforço; falhas não bloqueiam a conexão.
    try {
      await sincronizarUsuario(user.id);
    } catch (syncError) {
      console.error("google-oauth-complete: initial sync failed:", syncError);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("google-oauth-complete error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Erro ao concluir conexão.", code: "oauth_complete_failed" },
      500,
    );
  }
});
