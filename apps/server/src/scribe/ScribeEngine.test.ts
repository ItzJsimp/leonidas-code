import { afterEach, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import { FetchHttpClient } from "effect/http";

// Loaded by path so the server typecheck does not pull the Node-only mock into its Effect rules.
interface MockScribeEngineOptions {
  readonly port?: number;
  readonly fail?: "status" | "events" | "all";
  readonly historyCount?: number;
  readonly processingMs?: number;
  readonly pingMs?: number;
}
const mockPath = "../../../../scripts/mock-scribe-engine.ts";
const { startMockScribeEngine } = (await import(/* @vite-ignore */ mockPath)) as {
  startMockScribeEngine(
    options: MockScribeEngineOptions,
  ): Promise<{ port: number; close(): Promise<void> }>;
};
import { scribeEngineBaseUrl } from "./engineUrl.ts";
import * as ScribeEngine from "./ScribeEngine.ts";

const engines: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(engines.splice(0).map((engine) => engine.close()));
});

const withMock = (options: MockScribeEngineOptions = {}) =>
  Effect.gen(function* () {
    const mock = yield* Effect.promise(() =>
      startMockScribeEngine({ port: 0, processingMs: 20, pingMs: 50, ...options }),
    );
    engines.push(mock);
    return yield* ScribeEngine.makeWith({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      retryEvery: "50 millis",
    });
  }).pipe(Effect.provide(FetchHttpClient.layer));

it.effect("starts and stops a dictation", () =>
  Effect.gen(function* () {
    const engine = yield* withMock();
    expect(yield* engine.start({ mode: "hold" })).toEqual({ state: "listening" });
    expect(yield* engine.stop({ paste: false })).toEqual({ state: "processing" });
  }),
);

it.effect("maps 409 to invalid_state", () =>
  Effect.gen(function* () {
    const engine = yield* withMock();
    const error = yield* Effect.flip(engine.stop({ paste: true }));
    expect(error.reason).toBe("invalid_state");
  }),
);

it.effect("pages history without duplicates", () =>
  Effect.gen(function* () {
    const engine = yield* withMock({ historyCount: 30 });
    const first = yield* engine.listHistory({ limit: 20 });
    expect(first.items).toHaveLength(20);
    expect(first.next).not.toBeNull();
    const second = yield* engine.listHistory({ limit: 20, before: first.next ?? undefined });
    expect(second.items).toHaveLength(10);
    const ids = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(ids.size).toBe(30);
  }),
);

it.effect("maps a store failure to store_error", () =>
  Effect.gen(function* () {
    const engine = yield* withMock({ fail: "all" });
    const error = yield* Effect.flip(engine.listHistory({}));
    expect(error.reason).toBe("store_error");
  }),
);

it.effect("reports offline when no engine listens", () =>
  Effect.gen(function* () {
    const engine = yield* ScribeEngine.makeWith({ baseUrl: "http://127.0.0.1:9" }).pipe(
      Effect.provide(FetchHttpClient.layer),
    );
    const error = yield* Effect.flip(engine.listHistory({}));
    expect(error.reason).toBe("offline");
  }),
);

it.live("streams state, transcript and history events after a dictation", () =>
  Effect.gen(function* () {
    const engine = yield* withMock();
    const fiber = yield* engine.events.pipe(
      Stream.takeUntil((event) => event.type === "history"),
      Stream.runCollect,
      Effect.forkChild,
    );
    yield* Effect.sleep("100 millis");
    yield* engine.start({ mode: "toggle" });
    yield* engine.stop({ paste: true });
    const events = Array.from(yield* Fiber.join(fiber));
    expect(events.map((event) => event.type)).toEqual([
      "connection",
      "state",
      "state",
      "state",
      "state",
      "transcript",
      "history",
    ]);
    // The first state comes from /v1/status right after the connect.
    expect(events[1]).toMatchObject({ type: "state", state: "ready" });
  }),
);

it.live("reports one offline event while the engine is down, then reconnects", () =>
  Effect.gen(function* () {
    const engine = yield* withMock({ fail: "events" });
    const events = Array.from(
      yield* engine.events.pipe(
        Stream.filter((event) => event.type === "connection"),
        Stream.take(3),
        Stream.runCollect,
        Effect.timeout("2 seconds"),
      ),
    );
    // A failing stream connects, drops, and reconnects: link events alternate, never repeat.
    expect(events.map((event) => event.type === "connection" && event.connected)).toEqual([
      true,
      false,
      true,
    ]);
  }),
);

it("ignores comments and unknown events", () => {
  expect(ScribeEngine.parseEventLine(": ping")).toBeNull();
  expect(ScribeEngine.parseEventLine('data: {"type":"nope"}')).toBeNull();
  expect(
    ScribeEngine.parseEventLine('data: {"type":"state","state":"ready","at":"x"}'),
  ).toMatchObject({ type: "state", state: "ready" });
});

it("reads the engine port from the environment, loopback only", () => {
  expect(scribeEngineBaseUrl({})).toBe("http://127.0.0.1:8766");
  expect(scribeEngineBaseUrl({ LEONIDAS_SCRIBE_ENGINE_PORT: "8799" })).toBe(
    "http://127.0.0.1:8799",
  );
  expect(scribeEngineBaseUrl({ LEONIDAS_SCRIBE_ENGINE_PORT: "evil.com" })).toBe(
    "http://127.0.0.1:8766",
  );
});
