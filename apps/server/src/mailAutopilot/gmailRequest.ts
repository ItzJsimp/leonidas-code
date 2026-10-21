import { ProviderError, type ProviderErrorCode } from "@t3tools/mail-autopilot";

const GMAIL_ORIGIN = "https://gmail.googleapis.com";
const ME = "\\/gmail\\/v1\\/users\\/me";
const ID = "[A-Za-z0-9_-]+";

/**
 * The only calls the autopilot may make, as `METHOD /path`. Read, label and draft calls only.
 * Everything else is refused before it leaves the process. The token itself can do more than this
 * list, so this list is the fence.
 */
export const ALLOWED_ROUTES: readonly RegExp[] = [
  new RegExp(`^GET ${ME}\\/profile$`),
  new RegExp(`^GET ${ME}\\/messages$`),
  new RegExp(`^GET ${ME}\\/messages\\/${ID}$`),
  new RegExp(`^POST ${ME}\\/messages\\/${ID}\\/modify$`),
  new RegExp(`^GET ${ME}\\/threads\\/${ID}$`),
  new RegExp(`^GET ${ME}\\/labels$`),
  new RegExp(`^POST ${ME}\\/labels$`),
  new RegExp(`^GET ${ME}\\/history$`),
  new RegExp(`^POST ${ME}\\/drafts$`),
  new RegExp(`^GET ${ME}\\/drafts\\/${ID}$`),
  new RegExp(`^DELETE ${ME}\\/drafts\\/${ID}$`),
];

/** Query text must be plain printable ASCII with no fragment. */
const SAFE_QUERY = /^[!"$-~]*$/;

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; text(): Promise<string> }>;

export interface GmailRequestDeps {
  readonly fetch: FetchLike;
  /** `force` asks for a fresh token. Throws a `needsReconnect` ProviderError when sign-in is gone. */
  readonly getAccessToken: (opts?: { force?: boolean }) => Promise<string>;
  readonly sleep: (ms: number) => Promise<void>;
  readonly maxInFlight?: number;
}

export type GmailRequest = (method: string, path: string, body?: unknown) => Promise<unknown>;

const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

const reasonsOf = (text: string): string[] => {
  try {
    const parsed = JSON.parse(text) as { error?: { errors?: { reason?: unknown }[] } };
    return (parsed.error?.errors ?? []).map((e) => String(e.reason));
  } catch {
    return [];
  }
};

const assertAllowed = (method: string, path: string): void => {
  const [pathname = "", query = ""] = path.split(/\?(.*)/s);
  if (!ALLOWED_ROUTES.some((re) => re.test(`${method} ${pathname}`)) || !SAFE_QUERY.test(query)) {
    throw new ProviderError("blocked", `gmail call not allowed: ${method} ${pathname}`);
  }
};

export const makeGmailRequest = (deps: GmailRequestDeps): GmailRequest => {
  const limit = deps.maxInFlight ?? 3;
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = async () => {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
  };
  const release = () => {
    active--;
    waiting.shift()?.();
  };

  return async (method, path, body) => {
    assertAllowed(method, path);
    let refresh = false;
    let refreshed = false;
    for (let attempt = 0; ;) {
      const token = await deps.getAccessToken(refresh ? { force: true } : undefined);
      refresh = false;
      await acquire();
      let res: { status: number; text(): Promise<string> };
      try {
        res = await deps.fetch(`${GMAIL_ORIGIN}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } finally {
        release();
      }
      const text = await res.text();

      if (res.status >= 200 && res.status < 300) {
        if (text === "") return null;
        try {
          return JSON.parse(text) as unknown;
        } catch {
          throw new ProviderError("transient", "gmail returned a reply that is not JSON");
        }
      }
      if (res.status === 401) {
        if (refreshed) throw new ProviderError("needsReconnect", "gmail rejected the token");
        refreshed = true;
        refresh = true;
        continue;
      }
      const rateLimited =
        res.status === 429 ||
        (res.status === 403 && reasonsOf(text).some((r) => RATE_LIMIT_REASONS.has(r)));
      if (rateLimited || res.status >= 500) {
        const code: ProviderErrorCode = rateLimited ? "rate_limited" : "transient";
        if (attempt >= MAX_RETRIES) throw new ProviderError(code, `gmail status ${res.status}`);
        await deps.sleep(BASE_DELAY_MS * 2 ** attempt);
        attempt++;
        continue;
      }
      if (res.status === 403) throw new ProviderError("needsReconnect", "gmail refused the scope");
      if (res.status === 404) throw new ProviderError("not_found", "gmail has no such item");
      if (res.status === 400) throw new ProviderError("invalid", "gmail rejected the request");
      throw new ProviderError("transient", `gmail status ${res.status}`);
    }
  };
};
