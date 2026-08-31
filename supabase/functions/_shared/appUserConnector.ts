/** Helpers server-only do App User Connector. */

export class AppUserConnectorError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "AppUserConnectorError";
  }
}

function requireApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new AppUserConnectorError("connector_not_configured", 500);
  return key;
}

export interface AppUserOAuthAuthorizeParams {
  gatewayBaseUrl: string;
  connectorId: string;
  appUserId: string;
  clientAPIKey: string;
  returnUrl: string;
  credentialsConfiguration?: Record<string, unknown>;
  connectionAPIKey?: string;
}

export interface AppUserOAuthAuthorizeResponse {
  authorizationUrl: string;
  sessionId: string;
}

export async function authorizeAppUserOAuth(
  params: AppUserOAuthAuthorizeParams,
): Promise<AppUserOAuthAuthorizeResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireApiKey()}`,
    "Content-Type": "application/json",
    "X-Client-Api-Key": params.clientAPIKey,
  };
  if (params.connectionAPIKey) headers["X-Connection-Api-Key"] = params.connectionAPIKey;
  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      return_url: params.returnUrl,
      credentials_configuration: params.credentialsConfiguration,
    }),
  });
  if (!res.ok) throw new AppUserConnectorError("oauth_start_failed", res.status);
  const body = await res.json().catch(() => null) as {
    authorization_url?: string;
    session_id?: string;
  } | null;
  if (!body?.authorization_url) {
    throw new AppUserConnectorError("invalid_oauth_response", 502);
  }
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? "" };
}

export interface CallAsAppUserParams {
  gatewayBaseUrl: string;
  connectionAPIKey: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
}

export async function callAsAppUser({
  gatewayBaseUrl,
  connectionAPIKey,
  connectorId,
  path,
  init,
}: CallAsAppUserParams): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", connectionAPIKey);
  return fetch(`${gatewayBaseUrl}/${connectorId}${normalizedPath}`, { ...init, headers });
}

export interface DisconnectAppUserParams {
  gatewayBaseUrl: string;
  connectionAPIKey: string;
  connectorId: string;
}

export async function disconnectAppUser({
  gatewayBaseUrl,
  connectionAPIKey,
  connectorId,
}: DisconnectAppUserParams): Promise<void> {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/connection`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "X-Connection-Api-Key": connectionAPIKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ connector_id: connectorId }),
  });
  if (!res.ok) throw new AppUserConnectorError("disconnect_failed", res.status);
}

export interface ExchangeAppUserOAuthCodeResult {
  connectionAPIKey: string;
  connectorId: string;
}

export async function exchangeAppUserOAuthCode(
  gatewayBaseUrl: string,
  code: string,
): Promise<ExchangeAppUserOAuthCodeResult> {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new AppUserConnectorError("oauth_exchange_failed", res.status);
  const body = await res.json().catch(() => null) as {
    api_key?: string;
    connector_id?: string;
  } | null;
  if (!body?.api_key || !body.connector_id) {
    throw new AppUserConnectorError("invalid_exchange_response", 502);
  }
  return { connectionAPIKey: body.api_key, connectorId: body.connector_id };
}
