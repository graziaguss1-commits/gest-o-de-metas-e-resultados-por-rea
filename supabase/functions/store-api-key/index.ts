import {
  authenticateRequest,
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
    const { userClient } = await authenticateRequest(req, true);
    const body = await readJsonBody(req);
    const service = normalizeService(body.service_name);
    const apiKey = String(body.api_key ?? "").trim();

    if (apiKey.length < 20) {
      throw new HttpError(400, "Informe uma chave da Anthropic válida.", "invalid_key_format");
    }

    // Do not persist a typo or revoked key.
    await validateAnthropicKey(apiKey);

    const { error } = await userClient.rpc("store_own_api_key", {
      p_service_name: service,
      p_secret_value: apiKey,
      p_label: "Claude (Anthropic)",
    });

    if (error) {
      throw new HttpError(500, "Não foi possível armazenar a chave com segurança.", "vault_store_failed");
    }

    return jsonResponse({
      success: true,
      status: "valid",
      provider: service,
      model: ANTHROPIC_MODEL,
      model_label: ANTHROPIC_MODEL_LABEL,
    });
  } catch (error) {
    return errorResponse(error, "Não foi possível salvar a chave da Anthropic.");
  }
});

