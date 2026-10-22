import { ProviderError } from "@t3tools/mail-autopilot";

import { makeGmailRequest, type FetchLike } from "./gmailRequest.ts";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_SKEW_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

export interface GoogleClient {
  readonly id: string;
  /** Google wants this for desktop clients too, though it is not a real secret. Keep it out of the repo. */
  readonly secret?: string;
}

/** What Google redirects back with. Exactly one of `code` and `error` is normally set. */
export interface LoopbackRedirect {
  readonly code: string | null;
  readonly state: string | null;
  readonly error: string | null;
}

/** One sign-in attempt on `127.0.0.1`. It answers one request, then closes. */
export interface LoopbackSession {
  readonly redirectUri: string;
  next(timeoutMs: number): Promise<LoopbackRedirect>;
  close(): void;
}

export interface OAuthCrypto {
  randomBytes(n: number): Uint8Array;
  sha256(data: string): Uint8Array;
}

/** The ServerSecretStore, seen as text. */
export interface SecretText {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
}

export interface ConnectDeps {
  readonly client: GoogleClient;
  readonly fetch: FetchLike;
  readonly secrets: SecretText;
  readonly listener: { start(): Promise<LoopbackSession> };
  readonly crypto: OAuthCrypto;
  /** Opens the Google page in the user's browser. */
  readonly openUrl: (url: string) => Promise<void>;
  readonly timeoutMs?: number;
  /** Milliseconds. Supplied by the caller so this file stays free of clocks. */
  readonly now: () => number;
}

export interface TokenSource {
  getAccessToken(opts?: { force?: boolean }): Promise<string>;
  /** Forget the cached token and any "reconnect needed" state, after a new sign-in. */
  reset(): void;
}

const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

export const secretNameFor = (inbox: string): string =>
  `mail-autopilot-google-${inbox.replaceAll(/[^A-Za-z0-9._@-]/g, "_")}`;

interface TokenReply {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresInMs: number;
  readonly scope: string;
}

const form = (client: GoogleClient, params: Record<string, string>): string =>
  new URLSearchParams({
    client_id: client.id,
    ...(client.secret ? { client_secret: client.secret } : {}),
    ...params,
  }).toString();

/** One call to the token address. Maps Google's answers to typed errors. */
const tokenCall = async (
  fetchFn: FetchLike,
  client: GoogleClient,
  params: Record<string, string>,
): Promise<TokenReply> => {
  let res: { status: number; text(): Promise<string> };
  try {
    res = await fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form(client, params),
    });
  } catch {
    throw new ProviderError("transient", "could not reach Google");
  }
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(await res.text()) as Record<string, unknown>;
  } catch {
    // leave body empty: handled by the status checks below
  }
  if (res.status === 400 && body.error === "invalid_grant") {
    throw new ProviderError("needsReconnect", "Google sign-in expired or was removed");
  }
  if (res.status >= 500 || res.status === 429) {
    throw new ProviderError("transient", `Google token status ${res.status}`);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new ProviderError("invalid", `Google refused the request (${res.status})`);
  }
  if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
    throw new ProviderError("transient", "unexpected Google token reply");
  }
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
    expiresInMs: body.expires_in * 1000,
    scope: typeof body.scope === "string" ? body.scope : "",
  };
};

/**
 * One-click Google sign-in: PKCE on a loopback address, scope `gmail.modify` only.
 * The refresh token is written through `secrets.set` and goes nowhere else.
 * Returns the signed-in address, which becomes the inbox id.
 */
export const connectGoogle = async (
  deps: ConnectDeps,
): Promise<{ inbox: string; scope: string }> => {
  const session = await deps.listener.start();
  try {
    const verifier = b64url(deps.crypto.randomBytes(32));
    const challenge = b64url(deps.crypto.sha256(verifier));
    const state = b64url(deps.crypto.randomBytes(16));
    const authUrl = new URL(AUTH_URL);
    authUrl.search = new URLSearchParams({
      client_id: deps.client.id,
      redirect_uri: session.redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      access_type: "offline",
      prompt: "consent",
    }).toString();
    await deps.openUrl(authUrl.toString());

    const redirect = await session.next(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (redirect.error) {
      throw new ProviderError(
        "invalid",
        redirect.error === "access_denied"
          ? "sign-in was cancelled"
          : `Google stopped the sign-in: ${redirect.error}`,
      );
    }
    if (redirect.state !== state || !redirect.code) {
      throw new ProviderError("invalid", "sign-in reply did not match this request");
    }

    const tokens = await tokenCall(deps.fetch, deps.client, {
      grant_type: "authorization_code",
      code: redirect.code,
      code_verifier: verifier,
      redirect_uri: session.redirectUri,
    });
    if (!tokens.scope.split(" ").includes(GMAIL_SCOPE)) {
      throw new ProviderError("invalid", "Gmail access was not granted");
    }
    if (!tokens.refreshToken) {
      throw new ProviderError("invalid", "Google gave no long-lived sign-in");
    }

    const profile = await makeGmailRequest({
      fetch: deps.fetch,
      getAccessToken: async () => tokens.accessToken,
      sleep: async () => {},
    })("GET", "/gmail/v1/users/me/profile");
    const email = (profile as { emailAddress?: unknown } | null)?.emailAddress;
    if (typeof email !== "string" || email === "") {
      throw new ProviderError("transient", "Gmail did not say who signed in");
    }
    const inbox = email.toLowerCase();

    await deps.secrets.set(
      secretNameFor(inbox),
      JSON.stringify({ v: 1, refreshToken: tokens.refreshToken, scope: tokens.scope }),
    );
    return { inbox, scope: tokens.scope };
  } finally {
    session.close();
  }
};

export interface TokenSourceDeps {
  readonly client: GoogleClient;
  readonly inbox: string;
  readonly secrets: SecretText;
  readonly fetch: FetchLike;
  readonly now: () => number;
}

/** Gives out access tokens for one inbox. Callers at the same time share one refresh. */
export const makeTokenSource = (deps: TokenSourceDeps): TokenSource => {
  let cached: { token: string; expiresAt: number } | null = null;
  let inflight: Promise<string> | null = null;
  let mustReconnect = false;

  const refresh = async (): Promise<string> => {
    const raw = await deps.secrets.get(secretNameFor(deps.inbox));
    let refreshToken: unknown;
    try {
      refreshToken =
        raw === null ? undefined : (JSON.parse(raw) as { refreshToken?: unknown }).refreshToken;
    } catch {
      refreshToken = undefined;
    }
    if (typeof refreshToken !== "string" || refreshToken === "") {
      throw new ProviderError("needsReconnect", "no saved Google sign-in for this inbox");
    }
    try {
      const reply = await tokenCall(deps.fetch, deps.client, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      cached = { token: reply.accessToken, expiresAt: deps.now() + reply.expiresInMs };
      return reply.accessToken;
    } catch (err) {
      if (err instanceof ProviderError && err.code === "needsReconnect") {
        mustReconnect = true;
        cached = null;
      }
      throw err;
    }
  };

  return {
    async getAccessToken(opts) {
      if (mustReconnect) throw new ProviderError("needsReconnect", "Google sign-in is gone");
      if (!opts?.force && cached && deps.now() < cached.expiresAt - EXPIRY_SKEW_MS) {
        return cached.token;
      }
      inflight ??= refresh().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    reset() {
      cached = null;
      mustReconnect = false;
    },
  };
};
