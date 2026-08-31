import { sincronizarUsuario } from "../_shared/googleCalendarSync.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse } from "../_shared/googleCalendarShared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ success: false, error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" }, 401);
  try {
    const stats = await sincronizarUsuario(user.id);
    return jsonResponse({ success: true, ...stats });
  } catch (error) {
    const reconnect = (error as { code?: string })?.code === "reconnect_required";
    console.error(reconnect ? "google-calendar-sync requires reconnect" : "google-calendar-sync failed");
    return jsonResponse(
      {
        success: false,
        error: reconnect
          ? "A autorização do Google expirou. Reconecte sua conta."
          : "Não foi possível sincronizar com o Google Agenda.",
        code: reconnect ? "reconnect_required" : "sync_failed",
      },
      reconnect ? 409 : 502,
    );
  }
});
