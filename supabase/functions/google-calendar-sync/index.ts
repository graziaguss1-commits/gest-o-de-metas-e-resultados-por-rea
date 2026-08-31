import { sincronizarUsuario } from "../_shared/googleCalendarSync.ts";
import {
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
    const stats = await sincronizarUsuario(user.id);
    return jsonResponse({ success: true, ...stats });
  } catch (error) {
    console.error("google-calendar-sync error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Erro ao sincronizar.", code: "sync_failed" },
      500,
    );
  }
});
