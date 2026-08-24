type EdgeErrorPayload = {
  error?: string;
  message?: string;
};

export async function getEdgeFunctionErrorMessage(
  error: unknown,
  data: unknown,
  fallback: string,
) {
  const payload = data as EdgeErrorPayload | null;
  if (payload?.error) return payload.error;
  if (payload?.message) return payload.message;

  const response = (error as { context?: Response } | null)?.context;
  if (response && typeof response.clone === "function") {
    try {
      const responsePayload = await response.clone().json() as EdgeErrorPayload;
      if (responsePayload.error) return responsePayload.error;
      if (responsePayload.message) return responsePayload.message;
    } catch {
      // The Edge Function may have returned an empty or non-JSON error body.
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (message && !message.toLowerCase().includes("edge function returned")) return message;
  return fallback;
}

