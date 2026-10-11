import { expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import { FetchHttpClient, HttpClient, HttpClientError, HttpClientResponse } from "effect/http";

import * as ScribeStatus from "./ScribeStatus.ts";

const snapshot = {
  service: "leonidas-scribe",
  apiVersion: 1,
  state: "ready",
  sampledAt: "1970-01-01T00:00:00.000Z",
};
const withHttp = (http: HttpClient.HttpClient) =>
  Effect.provide(
    ScribeStatus.layer.pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, http))),
  );

it.effect("reads Scribe from the fixed loopback endpoint", () =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    const snapshot = {
      service: "leonidas-scribe",
      apiVersion: 1,
      state: "listening",
      sampledAt: DateTime.formatIso(now),
    };
    const http = HttpClient.make((request) => {
      expect(request.url).toBe("http://127.0.0.1:8766/v1/status");
      expect(request.method).toBe("GET");
      return Effect.succeed(HttpClientResponse.fromWeb(request, Response.json(snapshot)));
    });
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      Effect.provide(
        ScribeStatus.layer.pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, http))),
      ),
    );
    expect(yield* service.get).toEqual({ status: "available", snapshot });
  }),
);

it.effect.each(["ready", "listening", "processing", "mic_error"])("accepts %s", (state) =>
  Effect.gen(function* () {
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(request, Response.json({ ...snapshot, state })),
          ),
        ),
      ),
    );
    expect(yield* service.get).toEqual({ status: "available", snapshot: { ...snapshot, state } });
  }),
);

it.effect.each([
  ["wrong service", { ...snapshot, service: "voice-daemon" }],
  ["wrong version", { ...snapshot, apiVersion: 2 }],
  ["unknown state", { ...snapshot, state: "busy" }],
  ["missing timestamp", { service: "leonidas-scribe", apiVersion: 1, state: "ready" }],
  ["invalid timestamp", { ...snapshot, sampledAt: "yesterday" }],
  ["non-UTC timestamp", { ...snapshot, sampledAt: "1970-01-01T00:00:00+00:00" }],
  ["invalid calendar date", { ...snapshot, sampledAt: "1970-02-30T00:00:00.000Z" }],
] as const)("rejects %s", ([_name, body]) =>
  Effect.gen(function* () {
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(
        HttpClient.make((request) =>
          Effect.succeed(HttpClientResponse.fromWeb(request, Response.json(body))),
        ),
      ),
    );
    expect(yield* service.get).toEqual({ status: "unavailable", reason: "invalid_response" });
  }),
);

it.effect.each([
  ["malformed JSON", () => new Response("{"), "invalid_response"],
  ["oversized streamed body", () => new Response("x".repeat(4097)), "invalid_response"],
  [
    "oversized declared body",
    () => new Response("{}", { headers: { "content-length": "4097" } }),
    "invalid_response",
  ],
  [
    "redirect",
    () => new Response(null, { status: 302, headers: { location: "http://elsewhere.test" } }),
    "http_error",
  ],
  ["unhealthy Scribe", () => new Response(null, { status: 503 }), "http_error"],
] as const)("reports unavailable for %s", ([_name, response, reason]) =>
  Effect.gen(function* () {
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(
        HttpClient.make((request) =>
          Effect.succeed(HttpClientResponse.fromWeb(request, response())),
        ),
      ),
    );
    expect(yield* service.get).toEqual({ status: "unavailable", reason });
  }),
);

it.effect("expires stale cached snapshots instead of extending their freshness", () =>
  Effect.gen(function* () {
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              Response.json({ ...snapshot, sampledAt: "1969-12-31T23:59:56.000Z" }),
            ),
          ),
        ),
      ),
    );
    expect((yield* service.get).status).toBe("available");
    yield* TestClock.adjust("1500 millis");
    expect(yield* service.get).toEqual({ status: "unavailable", reason: "stale" });
  }),
);

it.effect("rejects future snapshots", () =>
  Effect.gen(function* () {
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              Response.json({ ...snapshot, sampledAt: "1970-01-01T00:00:02.000Z" }),
            ),
          ),
        ),
      ),
    );
    expect(yield* service.get).toEqual({ status: "unavailable", reason: "stale" });
  }),
);

it.effect("times out a stalled response within one second", () =>
  Effect.gen(function* () {
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(HttpClient.make(() => Effect.never)),
    );
    const pending = yield* Effect.forkChild(service.get);
    yield* TestClock.adjust("1 second");
    expect(yield* Fiber.join(pending)).toEqual({ status: "unavailable", reason: "timeout" });
  }),
);

it.effect("shares in-flight work and refreshes after two seconds", () =>
  Effect.gen(function* () {
    let requests = 0;
    const gate = yield* Deferred.make<void>();
    const started = yield* Deferred.make<void>();
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(
        HttpClient.make((request) =>
          Effect.gen(function* () {
            requests++;
            yield* Deferred.succeed(started, undefined);
            yield* Deferred.await(gate);
            return HttpClientResponse.fromWeb(request, Response.json(snapshot));
          }),
        ),
      ),
    );
    const pending = yield* Effect.forkChild(
      Effect.all([service.get, service.get, service.get], { concurrency: "unbounded" }),
    );
    yield* Deferred.await(started);
    yield* Deferred.succeed(gate, undefined);
    expect((yield* Fiber.join(pending)).map((result) => result.status)).toEqual([
      "available",
      "available",
      "available",
    ]);
    yield* service.get;
    expect(requests).toBe(1);
    yield* TestClock.adjust("2001 millis");
    yield* service.get;
    expect(requests).toBe(2);
  }),
);

it.effect("reports a stopped endpoint as offline", () =>
  Effect.gen(function* () {
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(
        HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request, cause: "connection refused" }),
            }),
          ),
        ),
      ),
    );
    expect(yield* service.get).toEqual({ status: "unavailable", reason: "offline" });
  }),
);

it.effect("disables redirects in the real fetch adapter", () =>
  Effect.gen(function* () {
    let requests = 0;
    const fetch: typeof globalThis.fetch = async (_input, options) => {
      requests++;
      expect(options?.redirect).toBe("manual");
      return new Response(null, { status: 302, headers: { location: "http://elsewhere.test" } });
    };
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      Effect.provide(
        ScribeStatus.layer.pipe(
          Layer.provide(
            FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))),
          ),
        ),
      ),
    );
    expect(yield* service.get).toEqual({ status: "unavailable", reason: "http_error" });
    expect(requests).toBe(1);
  }),
);

it.effect("includes a stalled body in the one-second timeout", () =>
  Effect.gen(function* () {
    const service = yield* ScribeStatus.ScribeStatus.pipe(
      withHttp(
        HttpClient.make((request) =>
          Effect.succeed(HttpClientResponse.fromWeb(request, new Response(new ReadableStream()))),
        ),
      ),
    );
    const pending = yield* Effect.forkChild(service.get);
    yield* TestClock.adjust("1 second");
    expect(yield* Fiber.join(pending)).toEqual({ status: "unavailable", reason: "timeout" });
  }),
);
