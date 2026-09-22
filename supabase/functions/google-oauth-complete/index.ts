import { corsHeaders, jsonResponse } from "../_shared/googleCalendarShared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return jsonResponse({
    success: false,
    error: "Este fluxo foi substituído pelo callback seguro do Google.",
    code: "oauth_flow_migrated",
  }, 410);
});
