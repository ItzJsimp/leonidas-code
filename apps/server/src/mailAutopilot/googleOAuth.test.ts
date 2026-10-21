// @effect-diagnostics nodeBuiltinImport:off - the source scan reads this folder with plain fs, and the PKCE check hashes with node:crypto.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";

import { assert, describe, it } from "@effect/vitest";
import { ProviderError } from "@t3tools/mail-autopilot";

import type { FetchLike } from "./gmailRequest.ts";
import {
  GMAIL_SCOPE,
  connectGoogle,
  makeTokenSource,
  type LoopbackSession,
  type OAuthCrypto,
} from "./googleOAuth.ts";

type Redirect = { code: string | null; state: string | null; error: string | null };

let randomCalls = 0;
const crypto: OAuthCrypto = {
  randomBytes: (n) => {
    randomCalls++;
    return Uint8Array.from({ length: n }, (_, i) => (i * 7 + randomCalls * 31) % 256);
  },
  sha256: (data) => new Uint8Array(NodeCrypto.createHash("sha256").update(data).digest()),
};

const reply = (status: number, value: unknown) => ({
  status,
  text: async () => JSON.stringify(value),
});

interface Rig {
  fetchCalls: { url: string; body: URLSearchParams | null; auth: string | undefined }[];
  secrets: Map<string, string>;
  setCalls: { name: string; value: string }[];
  opened: string[];
  closed: number;
  fetch: FetchLike;
  deps: Parameters<typeof connectGoogle>[0];
}

const rig = (
  opts: {
    redirect?: (authUrl: URL) => Redirect | Promise<Redirect>;
    token?: unknown;
    profile?: unknown;
  } = {},
): Rig => {
  const fetchCalls: Rig["fetchCalls"] = [];
  const secrets = new Map<string, string>();
  const setCalls: Rig["setCalls"] = [];
  const state: Rig = {
    fetchCalls,
    secrets,
    setCalls,
    opened: [],
    closed: 0,
    fetch: async (url, init) => {
      fetchCalls.push({
        url,
        body: init.body ? new URLSearchParams(init.body) : null,
        auth: init.headers.Authorization,
      });
      if (url === "https://oauth2.googleapis.com/token") {
        return reply(
          200,
          opts.token ?? {
            access_token: "ACCESS-1",
            refresh_token: "REFRESH-1",
            expires_in: 3600,
            scope: GMAIL_SCOPE,
          },
        );
      }
      if (url.endsWith("/gmail/v1/users/me/profile")) {
        return reply(200, opts.profile ?? { emailAddress: "Gersi@Example.test", historyId: "1" });
      }
      return reply(404, {});
    },
    deps: undefined as never,
  };
  const session: LoopbackSession = {
    redirectUri: "http://127.0.0.1:49152/callback",
    next: async () => {
      const authUrl = new URL(state.opened.at(-1)!);
      return (
        (await opts.redirect?.(authUrl)) ?? {
          code: "CODE-1",
          state: authUrl.searchParams.get("state"),
          error: null,
        }
      );
    },
    close: () => {
      state.closed++;
    },
  };
  state.deps = {
    client: { id: "client-id.apps.example.test", secret: "client-secret" },
    fetch: state.fetch,
    secrets: {
      get: async (name) => secrets.get(name) ?? null,
      set: async (name, value) => {
        setCalls.push({ name, value });
        secrets.set(name, value);
      },
    },
    listener: { start: async () => session },
    crypto,
    openUrl: async (url) => {
      state.opened.push(url);
    },
    timeoutMs: 1000,
    now: () => 0,
  };
  return state;
};

describe("connectGoogle", () => {
  it("builds a PKCE sign-in URL with the one Gmail scope on a loopback redirect", async () => {
    const r = rig();
    await connectGoogle(r.deps);
    const url = new URL(r.opened[0]!);
    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(url.searchParams.get("client_id"), "client-id.apps.example.test");
    assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:49152/callback");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), GMAIL_SCOPE);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.isAtLeast(url.searchParams.get("state")!.length, 16);
  });

  it("sends a verifier that hashes to the challenge", async () => {
    const r = rig();
    await connectGoogle(r.deps);
    const challenge = new URL(r.opened[0]!).searchParams.get("code_challenge")!;
    const exchange = r.fetchCalls.find((c) => c.url === "https://oauth2.googleapis.com/token")!;
    const verifier = exchange.body!.get("code_verifier")!;
    assert.isAtLeast(verifier.length, 43);
    assert.isAtMost(verifier.length, 128);
    assert.equal(NodeCrypto.createHash("sha256").update(verifier).digest("base64url"), challenge);
    assert.equal(exchange.body!.get("code"), "CODE-1");
    assert.equal(exchange.body!.get("grant_type"), "authorization_code");
    assert.equal(exchange.body!.get("redirect_uri"), "http://127.0.0.1:49152/callback");
  });

  it("names the inbox after the signed-in address and stores the refresh token once", async () => {
    const r = rig();
    const result = await connectGoogle(r.deps);
    assert.equal(result.inbox, "gersi@example.test");
    assert.equal(r.setCalls.length, 1);
    assert.include(r.setCalls[0]!.name, "gersi@example.test");
    assert.equal(JSON.parse(r.setCalls[0]!.value).refreshToken, "REFRESH-1");
    assert.notInclude(JSON.stringify(result), "REFRESH-1");
    assert.notInclude(JSON.stringify(result), "ACCESS-1");
  });

  it("rejects a wrong state before it exchanges anything", async () => {
    const r = rig({ redirect: () => ({ code: "CODE-1", state: "forged", error: null }) });
    const err = await connectGoogle(r.deps).catch((e: unknown) => e);
    assert.instanceOf(err, ProviderError);
    assert.equal(r.fetchCalls.length, 0);
    assert.equal(r.setCalls.length, 0);
    assert.equal(r.closed, 1);
  });

  it("rejects a redirect with no code", async () => {
    const r = rig({
      redirect: (u) => ({ code: null, state: u.searchParams.get("state"), error: null }),
    });
    assert.instanceOf(await connectGoogle(r.deps).catch((e: unknown) => e), ProviderError);
    assert.equal(r.fetchCalls.length, 0);
  });

  it("stops when the user cancels on the Google screen", async () => {
    const r = rig({ redirect: () => ({ code: null, state: null, error: "access_denied" }) });
    const err = (await connectGoogle(r.deps).catch((e: unknown) => e)) as ProviderError;
    assert.instanceOf(err, ProviderError);
    assert.match(err.message, /cancel/i);
    assert.equal(r.closed, 1);
  });

  it("stores nothing when Google did not grant the Gmail scope", async () => {
    const r = rig({
      token: { access_token: "A", refresh_token: "R", expires_in: 3600, scope: "openid email" },
    });
    assert.instanceOf(await connectGoogle(r.deps).catch((e: unknown) => e), ProviderError);
    assert.equal(r.setCalls.length, 0);
  });

  it("stores nothing when Google sent no refresh token", async () => {
    const r = rig({ token: { access_token: "A", expires_in: 3600, scope: GMAIL_SCOPE } });
    assert.instanceOf(await connectGoogle(r.deps).catch((e: unknown) => e), ProviderError);
    assert.equal(r.setCalls.length, 0);
  });

  it("stores nothing when the profile call fails", async () => {
    const r = rig({ profile: { nothing: true } });
    assert.instanceOf(await connectGoogle(r.deps).catch((e: unknown) => e), ProviderError);
    assert.equal(r.setCalls.length, 0);
  });

  it("closes the loopback listener when the redirect throws", async () => {
    const r = rig({
      redirect: () => {
        throw new ProviderError("transient", "timed out");
      },
    });
    await connectGoogle(r.deps).catch(() => undefined);
    assert.equal(r.closed, 1);
  });

  it("never calls a revoke address", async () => {
    const r = rig();
    await connectGoogle(r.deps);
    for (const c of r.fetchCalls) assert.notMatch(c.url, /revoke/i);
  });
});

describe("token source", () => {
  const stored = JSON.stringify({ v: 1, refreshToken: "REFRESH-1", scope: GMAIL_SCOPE });
  const make = (extra: { secrets?: Map<string, string>; status?: number; body?: unknown } = {}) => {
    let clock = 0;
    const calls: URLSearchParams[] = [];
    const urls: string[] = [];
    const secrets = extra.secrets ?? new Map([["mail-autopilot-google-sg", stored]]);
    let n = 0;
    const source = makeTokenSource({
      client: { id: "cid", secret: "csecret" },
      inbox: "sg",
      secrets: { get: async (k) => secrets.get(k) ?? null, set: async () => {} },
      fetch: async (url, init) => {
        urls.push(url);
        calls.push(new URLSearchParams(init.body));
        await Promise.resolve();
        return reply(
          extra.status ?? 200,
          extra.body ?? { access_token: `ACCESS-${++n}`, expires_in: 3600 },
        );
      },
      now: () => clock,
    });
    return { source, calls, urls, advance: (ms: number) => (clock += ms) };
  };

  it("refreshes once and then serves the cached token", async () => {
    const t = make();
    assert.equal(await t.source.getAccessToken(), "ACCESS-1");
    assert.equal(await t.source.getAccessToken(), "ACCESS-1");
    assert.equal(t.calls.length, 1);
    assert.equal(t.calls[0]!.get("grant_type"), "refresh_token");
    assert.equal(t.calls[0]!.get("refresh_token"), "REFRESH-1");
    assert.equal(t.calls[0]!.get("client_id"), "cid");
  });

  it("refreshes again near expiry and on force", async () => {
    const t = make();
    await t.source.getAccessToken();
    t.advance(3600_000 - 30_000);
    assert.equal(await t.source.getAccessToken(), "ACCESS-2");
    assert.equal(await t.source.getAccessToken({ force: true }), "ACCESS-3");
  });

  it("shares one refresh between callers at the same time", async () => {
    const t = make();
    const got = await Promise.all([
      t.source.getAccessToken(),
      t.source.getAccessToken(),
      t.source.getAccessToken(),
    ]);
    assert.deepEqual(got, ["ACCESS-1", "ACCESS-1", "ACCESS-1"]);
    assert.equal(t.calls.length, 1);
  });

  it("asks to reconnect when there is no stored sign-in", async () => {
    const t = make({ secrets: new Map() });
    const err = (await t.source.getAccessToken().catch((e: unknown) => e)) as ProviderError;
    assert.equal(err.code, "needsReconnect");
    assert.equal(t.calls.length, 0);
  });

  it("asks to reconnect on invalid_grant, never calls revoke, and then fails fast", async () => {
    const t = make({ status: 400, body: { error: "invalid_grant" } });
    const first = (await t.source.getAccessToken().catch((e: unknown) => e)) as ProviderError;
    assert.equal(first.code, "needsReconnect");
    const second = (await t.source.getAccessToken().catch((e: unknown) => e)) as ProviderError;
    assert.equal(second.code, "needsReconnect");
    assert.equal(t.calls.length, 1);
    for (const u of t.urls) assert.notMatch(u, /revoke/i);
  });

  it("reports a Google outage as transient and tries again next time", async () => {
    const t = make({ status: 503, body: {} });
    const err = (await t.source.getAccessToken().catch((e: unknown) => e)) as ProviderError;
    assert.equal(err.code, "transient");
    await t.source.getAccessToken().catch(() => undefined);
    assert.equal(t.calls.length, 2);
  });
});

describe("source scan", () => {
  it("keeps revoke and send out of the sign-in code", () => {
    const text = NodeFS.readFileSync(new URL("./googleOAuth.ts", import.meta.url), "utf8");
    assert.notMatch(text, /revoke|send|forward/i);
    const node = NodeFS.readFileSync(new URL("./googleOAuthNode.ts", import.meta.url), "utf8");
    assert.notMatch(node, /revoke|send|forward/i);
  });
});
