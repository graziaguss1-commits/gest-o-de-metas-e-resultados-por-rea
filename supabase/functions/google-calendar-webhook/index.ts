import { adminClient } from "../_shared/appUserConnections.ts";
import { sincronizarUsuario } from "../_shared/googleCalendarSync.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 204 });
  const channelId = req.headers.get("X-Goog-Channel-Id");
  const resourceId = req.headers.get("X-Goog-Resource-Id");
  const channelToken = req.headers.get("X-Goog-Channel-Token");
  if (!channelId || !resourceId || !channelToken) return new Response(null, { status: 400 });

  const { data: connection } = await adminClient()
    .from("google_calendar_connections")
    .select("user_id,webhook_resource_id,webhook_token")
    .eq("webhook_channel_id", channelId)
    .maybeSingle();
  if (
    !connection ||
    connection.webhook_resource_id !== resourceId ||
    connection.webhook_token !== channelToken
  ) return new Response(null, { status: 202 });

  if (req.headers.get("X-Goog-Resource-State") === "sync") {
    return new Response(null, { status: 200 });
  }

  const job = sincronizarUsuario(connection.user_id).catch(() => {
    console.error("google-calendar-webhook sync failed");
  });
  const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(job);
    return new Response(null, { status: 202 });
  }
  await job;
  return new Response(null, { status: 200 });
});
