import { assert, describe, it } from "@effect/vitest";
import { ProviderError } from "@t3tools/mail-autopilot";

import { ALLOWED_ROUTES, makeGmailRequest, type FetchLike } from "./gmailRequest.ts";

type Reply = { status: number; body?: string };
const json = (status: number, value: unknown): Reply => ({ status, body: JSON.stringify(value) });

const harness = (replies: Reply[] | ((n: number) => Promise<Reply>)) => {
  const calls: { url: string; method: string; auth: string | undefined }[] = [];
  const tokens: (boolean | undefined)[] = [];
  const sleeps: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization });
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      const r =
        typeof replies === "function"
          ? await replies(calls.length)
          : (replies[calls.length - 1] ?? replies.at(-1)!);
      return { status: r.status, text: async () => r.body ?? "" };
    } finally {
      inFlight--;
    }
  };
  const request = makeGmailRequest({
    fetch: fetchFn,
    getAccessToken: async (opts) => {
      tokens.push(opts?.force);
      return opts?.force ? "fresh" : "tok";
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { request, calls, tokens, sleeps, maxInFlight: () => maxInFlight };
};

const codeOf = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  assert.instanceOf(err, ProviderError);
  return (err as ProviderError).code;
};

describe("gmail request allow-list", () => {
  const base = "/gmail/v1/users/me";
  const allowed: [string, string][] = [
    ["GET", `${base}/profile`],
    ["GET", `${base}/messages?maxResults=50&q=in%3Ainbox`],
    ["GET", `${base}/messages/18f2a-B_c?format=full`],
    ["POST", `${base}/messages/18f2a/modify`],
    ["GET", `${base}/threads/18f2a?format=metadata`],
    ["GET", `${base}/labels`],
    ["POST", `${base}/labels`],
    ["GET", `${base}/history?startHistoryId=1`],
    ["POST", `${base}/drafts`],
    ["GET", `${base}/drafts/r-123?format=full`],
    ["DELETE", `${base}/drafts/r-123`],
  ];

  it.each(allowed)("lets %s %s through", async (method, path) => {
    const h = harness([json(200, {})]);
    await h.request(method, path);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0]?.url, `https://gmail.googleapis.com${path}`);
    assert.equal(h.calls[0]?.auth, "Bearer tok");
  });

  const blocked: [string, string][] = [
    ["POST", `${base}/messages/send`],
    ["POST", `${base}/drafts/send`],
    ["POST", `${base}/drafts/r-123/send`],
    ["POST", `${base}/messages/batchDelete`],
    ["POST", `${base}/messages/batchModify`],
    ["DELETE", `${base}/messages/18f2a`],
    ["POST", `${base}/messages/18f2a/trash`],
    ["PUT", `${base}/drafts/r-123`],
    ["GET", `${base}/messages/a/b`],
    ["GET", `${base}/messages/..%2fsettings`],
    ["GET", `${base}/messages/../settings/forwardingAddresses`],
    ["GET", `/gmail/v1/users/other@example.test/messages`],
    ["GET", `${base}/settings/filters`],
    ["GET", `//evil.example.test${base}/labels`],
  ];

  it.each(blocked)("blocks %s %s before fetch", async (method, path) => {
    const h = harness([json(200, {})]);
    assert.equal(await codeOf(h.request(method, path)), "blocked");
    assert.equal(h.calls.length, 0);
  });

  it("has no route that can deliver mail", () => {
    for (const route of ALLOWED_ROUTES) assert.notMatch(route.source, /send|forward|batch/i);
  });
});

describe("gmail request retry and auth", () => {
  const path = "/gmail/v1/users/me/labels";

  it("retries a 429 and then succeeds", async () => {
    const h = harness([json(429, {}), json(200, { ok: 1 })]);
    assert.deepEqual(await h.request("GET", path), { ok: 1 });
    assert.equal(h.calls.length, 2);
    assert.equal(h.sleeps.length, 1);
  });

  it("retries a 403 rate limit but not a 403 for a missing scope", async () => {
    const limited = { error: { errors: [{ reason: "userRateLimitExceeded" }] } };
    const h = harness([json(403, limited), json(200, {})]);
    await h.request("GET", path);
    assert.equal(h.calls.length, 2);

    const scope = { error: { errors: [{ reason: "insufficientPermissions" }] } };
    const g = harness([json(403, scope)]);
    assert.equal(await codeOf(g.request("GET", path)), "needsReconnect");
    assert.equal(g.calls.length, 1);
  });

  it("stops after four 5xx replies in a row, with growing waits", async () => {
    const h = harness([json(503, {})]);
    assert.equal(await codeOf(h.request("GET", path)), "transient");
    assert.equal(h.calls.length, 4);
    assert.equal(h.sleeps.length, 3);
    assert.isTrue(h.sleeps[0]! < h.sleeps[1]! && h.sleeps[1]! < h.sleeps[2]!);
  });

  it("refreshes the token once on a 401, then asks to reconnect", async () => {
    const ok = harness([json(401, {}), json(200, { ok: 1 })]);
    assert.deepEqual(await ok.request("GET", path), { ok: 1 });
    assert.deepEqual(ok.tokens, [undefined, true]);
    assert.equal(ok.calls[1]?.auth, "Bearer fresh");

    const bad = harness([json(401, {})]);
    assert.equal(await codeOf(bad.request("GET", path)), "needsReconnect");
    assert.equal(bad.calls.length, 2);
    assert.deepEqual(bad.tokens, [undefined, true]);
  });

  it("passes a needsReconnect from the token source straight up", async () => {
    const request = makeGmailRequest({
      fetch: async () => ({ status: 200, text: async () => "{}" }),
      getAccessToken: async () => {
        throw new ProviderError("needsReconnect", "invalid_grant");
      },
      sleep: async () => {},
    });
    assert.equal(await codeOf(request("GET", path)), "needsReconnect");
  });

  it("maps 404 and 400 to typed errors without retrying", async () => {
    const a = harness([json(404, {})]);
    assert.equal(await codeOf(a.request("GET", path)), "not_found");
    assert.equal(a.calls.length, 1);
    const b = harness([json(400, {})]);
    assert.equal(await codeOf(b.request("GET", path)), "invalid");
  });

  it("returns null for an empty body and a typed error for a broken one", async () => {
    assert.isNull(
      await harness([{ status: 204 }]).request("DELETE", "/gmail/v1/users/me/drafts/d1"),
    );
    assert.equal(
      await codeOf(harness([{ status: 200, body: "{not json" }]).request("GET", path)),
      "transient",
    );
  });

  it("keeps at most three calls in flight", async () => {
    const h = harness(async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
      return json(200, {});
    });
    await Promise.all(Array.from({ length: 10 }, () => h.request("GET", path)));
    assert.equal(h.calls.length, 10);
    assert.isAtMost(h.maxInFlight(), 3);
    assert.isAbove(h.maxInFlight(), 1);
  });

  it("sends the body as JSON", async () => {
    let seen = "";
    const request = makeGmailRequest({
      fetch: async (_url, init) => {
        seen = `${init.headers["Content-Type"]}|${init.body}`;
        return { status: 200, text: async () => "{}" };
      },
      getAccessToken: async () => "tok",
      sleep: async () => {},
    });
    await request("POST", "/gmail/v1/users/me/labels", { name: "SG/Pitch" });
    assert.equal(seen, 'application/json|{"name":"SG/Pitch"}');
  });
});
