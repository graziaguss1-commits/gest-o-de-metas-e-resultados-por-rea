import {
  authenticateRequest,
  errorResponse,
  jsonResponse,
  normalizeService,
  optionsResponse,
  readJsonBody,
  HttpError,
} from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  try {
    const { userClient } = await authenticateRequest(req, true);
    const body = await readJsonBody(req);
    const service = normalizeService(body.service_name);

    const { data, error } = await userClient.rpc("delete_own_api_key", {
      p_service_name: service,
    });

    if (error) {
      throw new HttpError(500, "Não foi possível remover a chave do Vault.", "vault_delete_failed");
    }

    return jsonResponse({ success: true, removed: Boolean(data) });
  } catch (error) {
    return errorResponse(error, "Não foi possível remover a chave da Anthropic.");
  }
});

