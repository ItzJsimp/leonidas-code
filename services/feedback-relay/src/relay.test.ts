import { afterEach, describe, expect, it, vi } from "vitest";

import { buildIssue, handleRequest, parseReport, type KvLike, type RelayEnv } from "./relay";

function memoryKv(): KvLike {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => void store.set(key, value),
  };
}

const env = (): RelayEnv => ({ GITHUB_TOKEN: "t", GITHUB_REPO: "o/r", RATE: memoryKv() });
const INSTALL = "08fe0a43-d58d-4c45-adb9-6994e425460b";
const valid = {
  installId: INSTALL,
  type: "bug",
  text: "Sidebar broken @someone",
  context: { appVersion: "0.34.0", route: "/chat", lastError: "boom" },
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://relay.test/feedback", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("parseReport", () => {
  it("rejects payloads that are not one of ours", () => {
    expect(parseReport(null)).toBeNull();
    expect(parseReport({ ...valid, type: "spam" })).toBeNull();
    expect(parseReport({ ...valid, text: "   " })).toBeNull();
    expect(parseReport({ ...valid, installId: "not an id!" })).toBeNull();
  });

  it("keeps only known context keys and image data URLs", () => {
    const report = parseReport({
      ...valid,
      context: { appVersion: "1", evil: "x" },
      screenshot: "data:image/svg+xml;base64,AAAA",
    });
    expect(report?.context).toEqual({ appVersion: "1" });
    expect(report?.screenshot).toBeNull();
    expect(parseReport({ ...valid, screenshot: "data:image/png;base64,AAAA" })?.screenshot).toEqual(
      { ext: "png", base64: "AAAA" },
    );
  });
});

describe("buildIssue", () => {
  it("labels by type, defangs mentions and never exposes the full install id", () => {
    const issue = buildIssue(parseReport(valid)!, null);
    expect(issue.labels).toEqual(["bug", "needs-triage"]);
    expect(issue.title).toBe("[bug] Sidebar broken @\u200bsomeone");
    expect(issue.body).toContain("| install | 08fe0a43 |");
    expect(issue.body).not.toContain("@someone");
  });
});

describe("handleRequest", () => {
  it("files an issue and returns its number", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ number: 12 }), { status: 201 });
    });
    const response = await handleRequest(post(valid), env());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, issue: 12 });
    expect(calls[0]?.url).toBe("https://api.github.com/repos/o/r/issues");
  });

  it("answers 400 for junk, 404 for other routes and 429 past the per-minute limit", async () => {
    const shared = env();
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ number: 1 }), { status: 201 }),
    );
    expect((await handleRequest(post("not json"), shared)).status).toBe(400);
    expect(
      (await handleRequest(new Request("https://relay.test/x", { method: "POST" }), shared)).status,
    ).toBe(404);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await handleRequest(post(valid), shared)).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("still files the report when the screenshot upload fails", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url.includes("/contents/")
        ? new Response("{}", { status: 500 })
        : new Response(JSON.stringify({ number: 3 }), { status: 201 }),
    );
    const response = await handleRequest(
      post({ ...valid, screenshot: "data:image/png;base64,AAAA" }),
      env(),
    );
    expect(await response.json()).toEqual({ ok: true, issue: 3 });
  });

  it("reports 502 when GitHub refuses the issue", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 403 }));
    expect((await handleRequest(post(valid), env())).status).toBe(502);
  });
});
