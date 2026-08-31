// Constantes e helpers compartilhados da integração Google Agenda (server-only).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CONNECTOR_ID = "google_calendar";
export const CLIENT_KEY_ENV = "GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY";
export const TIMEZONE = "America/Sao_Paulo";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export { corsHeaders };

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Autentica o chamador pelo JWT do Supabase. Retorna o usuário ou null. */
export async function getAuthenticatedUser(req: Request) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Converte um dateTime ISO do Google para data/hora no fuso do calendário. */
export function googleDateTimeToLocal(dateTime: string, timeZone: string = TIMEZONE) {
  const d = new Date(dateTime);
  const data = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { data, hora };
}
