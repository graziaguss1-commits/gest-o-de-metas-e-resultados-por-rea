// Recebe notificações push do Google Calendar e dispara sync incremental do
// usuário dono do canal. O Google chama sem JWT: a função identifica o usuário
// pelo X-Goog-Channel-Id gravado em google_calendar_connections e responde
// sempre rápido; estados "sync" (handshake) são apenas confirmados.
import { adminClient } from "../_shared/appUserConnections.ts";
import { sincronizarUsuario } from "../_shared/googleCalendarSync.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 204 });

  const channelId = req.headers.get("X-Goog-Channel-Id");
  const resourceState = req.headers.get("X-Goog-Resource-State");
  if (!channelId) return new Response(null, { status: 400 });
  if (resourceState === "sync") return new Response(null, { status: 200 });

  try {
    const { data: conn } = await adminClient()
      .from("google_calendar_connections")
      .select("user_id")
      .eq("webhook_channel_id", channelId)
      .maybeSingle();
    if (!conn) return new Response(null, { status: 202 });

    await sincronizarUsuario(conn.user_id);
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("google-calendar-webhook error:", error);
    // 200 evita reentregas agressivas do Google em falhas transitórias.
    return new Response(null, { status: 200 });
  }
});
