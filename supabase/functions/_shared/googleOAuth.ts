import {
  adminClient,
  deleteConnectionKeyForUser,
  getConnectionKeyForUser,
  saveConnectionKeyForUser,
} from "./appUserConnections.ts";

const CONNECTOR_ID = "google_calendar";
const GOOGLE_API_BASE_URL = "https://www.googleapis.com";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const REFRESH_MARGIN_MS = 60_000;

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.calendars.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

type StoredGoogleTokens = {
  version: 1;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  scope: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
};

export class GoogleOAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "GoogleOAuthError";
  }
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new GoogleOAuthError(`${name.toLowerCase()}_missing`, 503);
  return value;
}

function clientId() {
  return requiredEnv("GOOGLE_OAUTH_CLIENT_ID");
}

function clientSecret() {
  return requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");
}

export function googleOAuthRedirectUri() {
  return `${requiredEnv("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/google-oauth-callback`;
}

export function assertGoogleOAuthConfigured() {
  clientId();
  clientSecret();
  try {
    const encryptionKey = Uint8Array.from(
      atob(requiredEnv("APP_USER_CONNECTION_KEY_SECRET")),
      (char) => char.charCodeAt(0),
    );
    if (encryptionKey.length !== 32) throw new Error("invalid_length");
  } catch {
    throw new GoogleOAuthError("app_user_connection_key_secret_invalid", 503);
  }
  googleOAuthRedirectUri();
}

function parseStoredTokens(raw: string | null): StoredGoogleTokens | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredGoogleTokens>;
    if (
      value.version !== 1 ||
      typeof value.access_token !== "string" ||
      typeof value.refresh_token !== "string" ||
      typeof value.expires_at !== "number"
    ) return null;
    return {
      version: 1,
      access_token: value.access_token,
      refresh_token: value.refresh_token,
      expires_at: value.expires_at,
      token_type: typeof value.token_type === "string" ? value.token_type : "Bearer",
      scope: typeof value.scope === "string" ? value.scope : "",
    };
  } catch {
    // Chaves antigas lovack_* não são tokens Google e exigem uma nova conexão.
    return null;
  }
}

async function readStoredTokens(userId: string) {
  return parseStoredTokens(await getConnectionKeyForUser(userId, CONNECTOR_ID));
}

async function persistTokens(userId: string, tokens: StoredGoogleTokens) {
  await saveConnectionKeyForUser(userId, CONNECTOR_ID, JSON.stringify(tokens));
}

function normalizeTokenResponse(body: GoogleTokenResponse, previousRefreshToken?: string): StoredGoogleTokens {
  if (!body.access_token || typeof body.expires_in !== "number") {
    throw new GoogleOAuthError("invalid_token_response", 502);
  }
  const refreshToken = body.refresh_token || previousRefreshToken;
  if (!refreshToken) throw new GoogleOAuthError("offline_access_missing", 409);
  return {
    version: 1,
    access_token: body.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + Math.max(60, body.expires_in) * 1000,
    token_type: body.token_type || "Bearer",
    scope: body.scope || "",
  };
}

async function tokenRequest(params: URLSearchParams) {
  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  } catch {
    throw new GoogleOAuthError("google_token_unavailable", 502);
  }
  const body = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok) {
    if (body.error === "invalid_grant") throw new GoogleOAuthError("reconnect_required", 401);
    if (body.error === "invalid_client") throw new GoogleOAuthError("google_oauth_credentials_invalid", 503);
    throw new GoogleOAuthError("google_token_failed", 502);
  }
  return body;
}

async function refreshTokens(tokens: StoredGoogleTokens) {
  const body = await tokenRequest(new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
  }));
  return normalizeTokenResponse(body, tokens.refresh_token);
}

async function freshTokens(userId: string, forceRefresh = false) {
  let tokens = await readStoredTokens(userId);
  if (!tokens) throw new GoogleOAuthError("reconnect_required", 401);
  if (forceRefresh || tokens.expires_at <= Date.now() + REFRESH_MARGIN_MS) {
    tokens = await refreshTokens(tokens);
    await persistTokens(userId, tokens);
  }
  return tokens;
}

function authorizedRequest(tokens: StoredGoogleTokens, path: string, init?: RequestInit) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${tokens.access_token}`);
  headers.set("Accept", "application/json");
  return fetch(`${GOOGLE_API_BASE_URL}${normalizedPath}`, { ...init, headers });
}

async function markReconnect(userId: string) {
  await adminClient().from("google_calendar_connections").update({
    needs_reconnect: true,
    last_error_code: "reconnect_required",
  }).eq("user_id", userId);
}

export function createGoogleOAuthState(origin: string) {
  const encodedOrigin = btoa(origin)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return `${crypto.randomUUID()}.${encodedOrigin}`;
}

export function originFromGoogleOAuthState(state: string) {
  const encodedOrigin = state.split(".", 2)[1];
  if (!encodedOrigin) return null;
  try {
    const base64 = encodedOrigin.replaceAll("-", "+").replaceAll("_", "/")
      .padEnd(Math.ceil(encodedOrigin.length / 4) * 4, "=");
    const origin = atob(base64);
    const url = new URL(origin);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.origin !== origin || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) return null;
    return origin;
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl(state: string) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: googleOAuthRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  }).toString();
  return url.toString();
}

export async function exchangeGoogleAuthorizationCode(userId: string, code: string) {
  const body = await tokenRequest(new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: googleOAuthRedirectUri(),
  }));
  // Com prompt=consent + access_type=offline, uma autorização nova deve
  // devolver seu próprio refresh token. Nunca misturar tokens entre contas.
  const tokens = normalizeTokenResponse(body);
  await persistTokens(userId, tokens);
}

export async function hasGoogleConnection(userId: string) {
  try {
    return Boolean(await readStoredTokens(userId));
  } catch {
    return false;
  }
}

export async function callGoogleApi(userId: string, path: string, init?: RequestInit): Promise<Response> {
  try {
    let tokens = await freshTokens(userId);
    let response = await authorizedRequest(tokens, path, init);
    if (response.status === 401) {
      tokens = await freshTokens(userId, true);
      response = await authorizedRequest(tokens, path, init);
    }
    if (response.status === 401 || response.status === 403) await markReconnect(userId);
    return response;
  } catch (error) {
    if (error instanceof GoogleOAuthError && error.code === "reconnect_required") {
      await markReconnect(userId).catch(() => undefined);
      return new Response(JSON.stringify({ error: "reconnect_required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw error;
  }
}

export async function revokeGoogleConnection(userId: string) {
  const tokens = await readStoredTokens(userId).catch(() => null);
  if (tokens) {
    const token = tokens.refresh_token || tokens.access_token;
    await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }).catch(() => undefined);
  }
  await deleteConnectionKeyForUser(userId, CONNECTOR_ID);
}
