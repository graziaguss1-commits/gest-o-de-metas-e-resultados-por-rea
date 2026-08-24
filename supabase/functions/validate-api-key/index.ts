import {
  authenticateRequest,
  createServiceClient,
  errorResponse,
  jsonResponse,
  normalizeService,
  optionsResponse,
  readJsonBody,
  HttpError,
} from "../_shared/common.ts";
import {
  ANTHROPIC_MODEL,
  ANTHROPIC_MODEL_LABEL,
  validateAnthropicKey,
} from "../_shared/anthropic.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  try {
    const { user } = await authenticateRequest(req, true);
    const body = await readJsonBody(req);
    const service = normalizeService(body.service_name);
    const serviceClient = createServiceClient();

    const { data: apiKey, error: readError } = await serviceClient.rpc("read_user_api_key", {
      p_user_id: user.id,
      p_service_name: service,
    });

    if (readError) {
      throw new HttpError(500, "Não foi possível consultar a chave armazenada.", "vault_read_failed");
    }
    if (!apiKey) {
      return jsonResponse({ status: "unconfigured", error: "Nenhuma chave da Anthropic foi configurada." });
    }

    try {
      await validateAnthropicKey(String(apiKey));
    } catch (error) {
      if (error instanceof HttpError && error.code === "invalid_api_key") {
        await serviceClient
          .from("api_keys_registry")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("service_name", service);
        return jsonResponse({ status: "invalid", error: error.message });
      }
      throw error;
    }

    await serviceClient
      .from("api_keys_registry")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("service_name", service);

    return jsonResponse({
      status: "valid",
      provider: service,
      model: ANTHROPIC_MODEL,
      model_label: ANTHROPIC_MODEL_LABEL,
    });
  } catch (error) {
    return errorResponse(error, "Não foi possível testar a conexão com a Anthropic.");
  }
});

