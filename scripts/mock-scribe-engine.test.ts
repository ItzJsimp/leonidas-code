// @effect-diagnostics nodeBuiltinImport:off - real loopback HTTP against the mock engine.
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as NodeHttp from "node:http";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { startMockScribeEngine, type MockScribeEngine } from "./mock-scribe-engine.ts";

interface Reply {
  status: number;
  headers: NodeHttp.IncomingHttpHeaders;
  body: any;
}

function call(
  port: number,
  method: string,
  path: string,
  options: { body?: string; headers?: Record<string, string> } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = NodeHttp.request(
      { host: "127.0.0.1", port, method, path, headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: text ? JSON.parse(text) : null,
          });
        });
      },
    );
    req.on("error", reject);
    req.end(options.body);
  });
}

function readEvents(port: number): { events: any[]; stop(): void; done: Promise<void> } {
  const events: any[] = [];
  let stop = () => {};
  const done = new Promise<void>((resolve) => {
    const req = NodeHttp.get({ host: "127.0.0.1", port, path: "/v1/events" }, (res) => {
      let buffer = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) events.push(JSON.parse(line.slice(6)));
        }
      });
      res.on("end", () => resolve());
      res.on("close", () => resolve());
    });
    req.on("error", () => resolve());
    stop = () => req.destroy();
  });
  return { events, stop: () => stop(), done };
}

const waitFor = (check: () => boolean, ms = 3000) =>
  Effect.gen(function* () {
    const end = DateTime.toEpochMillis(DateTime.nowUnsafe()) + ms;
    while (!check()) {
      if (DateTime.toEpochMillis(DateTime.nowUnsafe()) > end) throw new Error("timeout");
      yield* Effect.sleep(10);
    }
  });

describe("mock scribe engine", () => {
  let engine: MockScribeEngine | undefined;
  const boot = async (options: Parameters<typeof startMockScribeEngine>[0] = {}) => {
    engine = await startMockScribeEngine({ port: 0, processingMs: 50, ...options });
    return engine;
  };
  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  it("rejects an Origin header and a wrong Host", async () => {
    const { port } = await boot();
    const origin = await call(port, "GET", "/v1/status", { headers: { Origin: "http://x.test" } });
    expect(origin.status).toBe(403);
    expect(origin.body.error).toBe("forbidden");
    const host = await call(port, "GET", "/v1/status", { headers: { Host: "localhost:1" } });
    expect(host.status).toBe(403);
  });

  it("answers status with the v1.1 shape", async () => {
    const { port } = await boot();
    const r = await call(port, "GET", "/v1/status");
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.body).toMatchObject({
      service: "leonidas-scribe",
      apiVersion: 1,
      state: "ready",
      groqKey: true,
      privateMode: false,
    });
    expect(
      DateTime.toEpochMillis(DateTime.nowUnsafe()) - Date.parse(r.body.sampledAt),
    ).toBeLessThan(5000);
    expect((await call(port, "POST", "/v1/status")).status).toBe(405);
    expect((await call(port, "GET", "/v1/nope")).status).toBe(404);
  });

  it("returns 409 on a second start and 400 on bad JSON", async () => {
    const { port } = await boot();
    const first = await call(port, "POST", "/v1/start", { body: '{"mode":"hold"}' });
    expect(first.body.state).toBe("listening");
    expect((await call(port, "POST", "/v1/start", { body: "{}" })).status).toBe(409);
    expect((await call(port, "POST", "/v1/start", { body: "{nope" })).status).toBe(400);
    expect((await call(port, "POST", "/v1/stop", { body: "{}" })).body.state).toBe("processing");
    expect((await call(port, "POST", "/v1/stop", { body: "{}" })).status).toBe(409);
  });

  it("keeps the credential key as a boolean only", async () => {
    const { port } = await boot();
    expect((await call(port, "PUT", "/v1/credentials/groq", { body: "{}" })).status).toBe(400);
    expect((await call(port, "DELETE", "/v1/credentials/groq")).status).toBe(204);
    expect((await call(port, "GET", "/v1/status")).body.groqKey).toBe(false);
    expect(
      (await call(port, "PUT", "/v1/credentials/groq", { body: '{"key":"gsk_test"}' })).status,
    ).toBe(204);
    expect((await call(port, "GET", "/v1/status")).body.groqKey).toBe(true);
  });

  it.live("runs a full cycle and streams state, transcript and history events", () =>
    Effect.gen(function* () {
      const { port } = yield* Effect.promise(() => boot());
      const stream = readEvents(port);
      yield* Effect.sleep(50);
      yield* Effect.promise(() => call(port, "POST", "/v1/start", { body: '{"mode":"toggle"}' }));
      yield* Effect.promise(() => call(port, "POST", "/v1/stop", { body: '{"paste":true}' }));
      yield* waitFor(() => stream.events.some((e) => e.type === "history"));
      stream.stop();
      yield* Effect.promise(() => stream.done);
      expect(stream.events.map((e) => e.state ?? e.type)).toEqual([
        "listening",
        "processing",
        "ready",
        "transcript",
        "history",
      ]);
      const transcript = stream.events.find((e) => e.type === "transcript");
      expect(transcript).toMatchObject({
        engine: "groq",
        pasted: true,
        service: "leonidas-scribe",
      });
      expect(typeof transcript.raw).toBe("string");
      const item = stream.events.find((e) => e.type === "history").item;
      expect(item.mode).toBe("toggle");
      const page = yield* Effect.promise(() => call(port, "GET", "/v1/history?limit=1"));
      expect(page.body.items[0].id).toBe(item.id);
    }),
  );

  it("pages history with before and no duplicates", async () => {
    const { port } = await boot({ seed: 7 });
    const ids: string[] = [];
    let before: string | null = null;
    let pages = 0;
    do {
      const q: string = `/v1/history?limit=60${before ? `&before=${before}` : ""}`;
      const r: Reply = await call(port, "GET", q);
      expect(r.status).toBe(200);
      for (const item of r.body.items) ids.push(item.id);
      before = r.body.next;
      pages += 1;
    } while (before);
    expect(pages).toBe(4);
    expect(ids).toHaveLength(200);
    expect(new Set(ids).size).toBe(200);
    const all = (await call(port, "GET", "/v1/history?limit=500")).body.items;
    const times = all.map((i: any) => Date.parse(i.at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(all[0]).toMatchObject({ pasted: expect.any(Boolean), words: expect.any(Number) });
  });

  it("filters by mode, is seeded, and deletes an item", async () => {
    const a = await boot({ seed: 3 });
    const first = (await call(a.port, "GET", "/v1/history?mode=hold&limit=500")).body.items;
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((i: any) => i.mode === "hold")).toBe(true);
    const texts = first.map((i: any) => i.cleanedText);
    expect((await call(a.port, "DELETE", `/v1/history/${first[0].id}`)).body.deleted).toBe(true);
    expect((await call(a.port, "DELETE", `/v1/history/${first[0].id}`)).status).toBe(404);
    await a.close();
    const b = await boot({ seed: 3 });
    const again = (await call(b.port, "GET", "/v1/history?mode=hold&limit=500")).body.items;
    expect(again.map((i: any) => i.cleanedText)).toEqual(texts);
  });

  it("serves an empty history with --empty", async () => {
    const { port } = await boot({ empty: true });
    const r = await call(port, "GET", "/v1/history");
    expect(r.body.items).toEqual([]);
    expect(r.body.next).toBeNull();
  });

  it("fails status with --fail status", async () => {
    const { port } = await boot({ fail: "status" });
    const r = await call(port, "GET", "/v1/status");
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("status_unavailable");
    expect((await call(port, "GET", "/v1/history")).status).toBe(200);
  });

  it("closes events at once with --fail events", async () => {
    const { port } = await boot({ fail: "events" });
    const stream = readEvents(port);
    await stream.done;
    expect(stream.events).toEqual([]);
    expect((await call(port, "GET", "/v1/status")).status).toBe(200);
  });

  it("serves, replaces and validates the dictionary like the Rust engine", async () => {
    const { port } = await boot();
    const get = await call(port, "GET", "/v1/dictionary");
    expect(get.status).toBe(200);
    expect(get.body.replacements.length).toBeGreaterThan(0);
    expect(get.body.vocabulary.length).toBeGreaterThan(0);

    const body = { replacements: [{ wrong: "cube", correct: "Kube" }], vocabulary: ["Gersi"] };
    const put = await call(port, "PUT", "/v1/dictionary", { body: JSON.stringify(body) });
    expect(put.status).toBe(200);
    expect(put.body.replacements).toEqual(body.replacements);
    expect((await call(port, "GET", "/v1/dictionary")).body.vocabulary).toEqual(["Gersi"]);

    const bad = async (value: unknown) =>
      (await call(port, "PUT", "/v1/dictionary", { body: JSON.stringify(value) })).body.error;
    expect(await bad({ replacements: [{ wrong: " ", correct: "x" }], vocabulary: [] })).toBe(
      "bad_request",
    );
    expect(await bad({ replacements: [], vocabulary: [], extra: 1 })).toBe("bad_request");
    expect(
      await bad({ replacements: [], vocabulary: Array.from({ length: 801 }, (_, i) => `w${i}`) }),
    ).toBe("bad_request");
    expect((await call(port, "GET", "/v1/dictionary")).body.vocabulary).toEqual(["Gersi"]);
  });

  it("lists suggestions, hides accepted and rejected runs", async () => {
    const { port } = await boot();
    const first = (await call(port, "GET", "/v1/dictionary/suggestions")).body.items;
    expect(first.length).toBeGreaterThanOrEqual(2);
    const [a, b] = first;
    const dict = (await call(port, "GET", "/v1/dictionary")).body;
    await call(port, "PUT", "/v1/dictionary", {
      body: JSON.stringify({
        replacements: [...dict.replacements, { wrong: a.wrong, correct: a.correct }],
        vocabulary: dict.vocabulary,
      }),
    });
    const rej = await call(
      port,
      "DELETE",
      `/v1/dictionary/suggestions/${encodeURIComponent(b.wrong)}`,
    );
    expect(rej.body.rejected).toBe(true);
    const after = (await call(port, "GET", "/v1/dictionary/suggestions")).body.items;
    expect(after.some((s: { wrong: string }) => s.wrong === a.wrong || s.wrong === b.wrong)).toBe(
      false,
    );
    expect((await call(port, "DELETE", "/v1/dictionary/suggestions/%E0%A4%A")).body.error).toBe(
      "bad_request",
    );
  });

  it("serves an empty dictionary and no suggestions with --empty", async () => {
    const { port } = await boot({ empty: true });
    expect((await call(port, "GET", "/v1/dictionary")).body).toMatchObject({
      replacements: [],
      vocabulary: [],
    });
    expect((await call(port, "GET", "/v1/dictionary/suggestions")).body.items).toEqual([]);
  });

  it("fails the dictionary with --fail dictionary and keeps history up", async () => {
    const { port } = await boot({ fail: "dictionary" });
    const r = await call(port, "GET", "/v1/dictionary");
    expect([r.status, r.body.error]).toEqual([500, "store_error"]);
    expect((await call(port, "PUT", "/v1/dictionary", { body: "{}" })).status).toBe(500);
    expect((await call(port, "GET", "/v1/dictionary/suggestions")).status).toBe(500);
    expect((await call(port, "GET", "/v1/history")).status).toBe(200);
  });

  it("serves the 7 settings sections and never the Groq key", async () => {
    const { port } = await boot();
    const r = await call(port, "GET", "/v1/settings");
    expect(Object.keys(r.body.sections)).toEqual([
      "hotkeys",
      "audio",
      "transcription",
      "presets",
      "hud",
      "features",
      "goals",
    ]);
    expect(r.body.sections.transcription.groqKey).toEqual({ set: true });
    await call(port, "DELETE", "/v1/credentials/groq");
    const after = await call(port, "GET", "/v1/settings");
    expect(after.body.sections.transcription.groqKey).toEqual({ set: false });
    expect(JSON.stringify(after.body)).not.toContain("gsk_");
  });

  it("patches one section, reports restartRequired and saves nothing on a bad patch", async () => {
    const { port } = await boot();
    const patch = (section: string, values: unknown) =>
      call(port, "PATCH", "/v1/settings", { body: JSON.stringify({ section, values }) });

    const audio = await patch("audio", { device: "USB Mic" });
    expect(audio.status).toBe(200);
    expect(audio.body).toMatchObject({
      section: "audio",
      values: { device: "USB Mic", maxRecordSeconds: 600, minRecordMs: 250 },
      restartRequired: false,
    });
    expect((await patch("transcription", { polishEnabled: false })).body.restartRequired).toBe(
      false,
    );
    const model = await patch("transcription", { polishModel: "llama-3.3-70b-versatile" });
    expect(model.body.restartRequired).toBe(true);
    expect((await patch("hud", { enabled: false })).body.restartRequired).toBe(true);
    expect((await patch("hud", { enabled: false })).body.restartRequired).toBe(false);
    expect((await patch("presets", { anything: { a: 1 } })).body.values).toEqual({
      anything: { a: 1 },
    });

    for (const [section, values] of [
      ["nope", {}],
      ["audio", { speed: 1 }],
      ["audio", { maxRecordSeconds: "ten" }],
      ["transcription", { groqKey: "gsk_x" }],
      ["hotkeys", { hold: "Ctrl + T" }],
      ["audio", [] as unknown],
    ] as const) {
      expect((await patch(section, values)).body.error).toBe("bad_request");
    }
    const get = await call(port, "GET", "/v1/settings");
    expect(get.body.sections.audio.device).toBe("USB Mic");
    expect(get.body.sections.audio.maxRecordSeconds).toBe(600);
  });

  it("lists input devices with one default", async () => {
    const { port } = await boot();
    const { inputs } = (await call(port, "GET", "/v1/devices")).body;
    expect(inputs.length).toBeGreaterThan(1);
    expect(inputs.filter((d: { default: boolean }) => d.default)).toHaveLength(1);
    expect(inputs.every((d: { id: string; name: string }) => d.id === d.name)).toBe(true);
  });

  it("fails settings and devices with --fail settings and keeps history up", async () => {
    const { port } = await boot({ fail: "settings" });
    expect((await call(port, "GET", "/v1/settings")).body.error).toBe("store_error");
    expect((await call(port, "PATCH", "/v1/settings", { body: "{}" })).status).toBe(500);
    expect((await call(port, "GET", "/v1/devices")).status).toBe(500);
    expect((await call(port, "GET", "/v1/history")).status).toBe(200);
  });

  it("fails everything with --fail all", async () => {
    const { port } = await boot({ fail: "all" });
    expect((await call(port, "GET", "/v1/status")).status).toBe(503);
    const h = await call(port, "GET", "/v1/history");
    expect(h.status).toBe(500);
    expect(h.body.error).toBe("store_error");
    const stream = readEvents(port);
    await stream.done;
    expect(stream.events).toEqual([]);
  });
  it("closes active event streams and releases its port", async () => {
    const first = await boot();
    const stream = readEvents(first.port);
    await call(first.port, "GET", "/v1/status");
    await first.close();
    await stream.done;
    engine = await startMockScribeEngine({ port: first.port, empty: true });
    expect((await call(engine.port, "GET", "/v1/history")).body.items).toEqual([]);
  });
});
