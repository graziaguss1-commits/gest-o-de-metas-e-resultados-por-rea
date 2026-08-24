import { HttpError } from "./common.ts";

export const ANTHROPIC_MODEL = "claude-sonnet-5";
export const ANTHROPIC_MODEL_LABEL = "Claude Sonnet 5";

const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const INPUT_USD_PER_MILLION = 2;
const OUTPUT_USD_PER_MILLION = 10;

function headers(apiKey: string, withContentType = false) {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    ...(withContentType ? { "content-type": "application/json" } : {}),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 25_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError(504, "A Anthropic demorou para responder. Tente novamente.", "anthropic_timeout");
    }
    throw new HttpError(502, "Não foi possível conectar à Anthropic agora.", "anthropic_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

function anthropicHttpError(status: number) {
  if (status === 401 || status === 403) {
    return new HttpError(422, "A chave da Anthropic é inválida ou foi revogada.", "invalid_api_key");
  }
  if (status === 402) {
    return new HttpError(402, "Sua conta da Anthropic está sem créditos disponíveis.", "insufficient_credits");
  }
  if (status === 429) {
    return new HttpError(429, "O limite de uso da Anthropic foi atingido. Tente novamente em instantes.", "rate_limited");
  }
  if (status === 529 || status >= 500) {
    return new HttpError(503, "A Anthropic está temporariamente indisponível.", "anthropic_overloaded");
  }
  return new HttpError(502, "A Anthropic recusou a solicitação.", "anthropic_error");
}

export async function validateAnthropicKey(apiKey: string) {
  const response = await fetchWithTimeout(
    `${ANTHROPIC_BASE_URL}/models?limit=1`,
    { method: "GET", headers: headers(apiKey) },
    15_000,
  );

  if (!response.ok) throw anthropicHttpError(response.status);
  return true;
}

export type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
  model?: string;
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

export async function createAnthropicMessage(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<AnthropicMessageResponse> {
  const response = await fetchWithTimeout(`${ANTHROPIC_BASE_URL}/messages`, {
    method: "POST",
    headers: headers(apiKey, true),
    body: JSON.stringify(body),
  });

  if (!response.ok) throw anthropicHttpError(response.status);

  try {
    return await response.json() as AnthropicMessageResponse;
  } catch {
    throw new HttpError(502, "A Anthropic retornou uma resposta inválida.", "invalid_anthropic_response");
  }
}

export function estimatedSonnetCost(inputTokens: number, outputTokens: number) {
  return (
    (Math.max(0, inputTokens) * INPUT_USD_PER_MILLION) / 1_000_000
    + (Math.max(0, outputTokens) * OUTPUT_USD_PER_MILLION) / 1_000_000
  );
}

