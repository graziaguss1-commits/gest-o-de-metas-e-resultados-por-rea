import { createClient } from "npm:@supabase/supabase-js@2.105.3";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "request_failed") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function optionsResponse() {
  return new Response("ok", { headers: corsHeaders });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export function createServiceClient() {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function authenticateRequest(req: Request, adminOnly = false) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "Sua sessão expirou. Entre novamente.", "unauthorized");
  }

  const userClient = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    throw new HttpError(401, "Sua sessão expirou. Entre novamente.", "unauthorized");
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("is_active, is_approved")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile?.is_active || !profile?.is_approved) {
    throw new HttpError(403, "Seu acesso ao sistema não está ativo.", "inactive_user");
  }

  if (adminOnly) {
    const { data: role, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || role?.role !== "admin") {
      throw new HttpError(403, "Apenas administradores podem configurar o Claude.", "admin_required");
    }
  }

  return { user: authData.user, userClient };
}

export async function readJsonBody(req: Request) {
  try {
    return await req.json() as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Dados enviados em formato inválido.", "invalid_json");
  }
}

export function normalizeService(value: unknown) {
  const service = String(value ?? "").trim().toLowerCase();
  if (["anthropic", "claude", "claude ai"].includes(service)) return "anthropic";
  throw new HttpError(400, "Selecione Claude (Anthropic).", "unsupported_service");
}

export function errorResponse(error: unknown, fallback: string) {
  const safeError = error instanceof HttpError
    ? error
    : new HttpError(500, fallback, "internal_error");

  // Never log request bodies, prompts or secret values.
  console.error(`[${safeError.code}] ${safeError.message}`);
  return jsonResponse(
    { success: false, error: safeError.message, code: safeError.code },
    safeError.status,
  );
}

