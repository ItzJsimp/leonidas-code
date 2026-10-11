import { describe, expect, it } from "@effect/vitest";
import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import { HttpClient, HttpClientResponse } from "effect/http";
import { describeReadinessCause, waitForHttpReady } from "./httpReadiness.ts";

class ReadinessTestError extends Data.TaggedError("ReadinessTestError")<{
  readonly message: string;
}> {}

describe("readiness failure diagnostics", () => {
  it("preserves normal nested failure messages", () => {
    expect(
      describeReadinessCause(
        new Error("Startup failed", { cause: { _tag: "ConnectionError", reason: "refused" } }),
      ),
    ).toEqual({
      name: "Error",
      message: "Startup failed",
      cause: { _tag: "ConnectionError", reason: "refused" },
    });
  });
  it("terminates circular error causes without losing the original message", () => {
    const error = new Error("Startup failed");
    error.cause = error;
    expect(describeReadinessCause(error)).toEqual({
      name: "Error",
      message: "Startup failed",
      cause: "[Circular]",
    });
  });
  it("bounds deeply nested diagnostics and remains JSON serializable", () => {
    let cause: unknown = "root";
    for (let index = 0; index < 100; index++) cause = { cause, message: `failure ${index}` };
    const output = JSON.stringify(describeReadinessCause(cause));
    expect(output).toContain("failure 99");
    expect(output).toContain("[Truncated]");
    expect(output.length).toBeLessThan(1000);
  });
  it("limits branching diagnostics while preserving repeated non-circular children", () => {
    const shared = { message: "shared" };
    expect(describeReadinessCause({ cause: shared, reason: shared })).toEqual({
      cause: shared,
      reason: shared,
    });
    let tree: unknown = shared;
    for (let index = 0; index < 12; index++) tree = { cause: tree, reason: tree };
    expect(JSON.stringify(describeReadinessCause(tree)).length).toBeLessThan(5000);
  });
});

describe("HTTP readiness probe budget", () => {
  it.effect("retries when headers arrive but the response body stalls", () =>
    Effect.gen(function* () {
      const bodyStarted = yield* Deferred.make<void>();
      let attempts = 0;
      const client = HttpClient.make((request) =>
        Effect.sync(() => {
          attempts += 1;
          const response = HttpClientResponse.fromWeb(request, new Response("ready"));
          if (attempts === 1) {
            Object.defineProperty(response, "text", {
              value: Deferred.succeed(bodyStarted, undefined).pipe(Effect.andThen(Effect.never)),
            });
          }
          return response;
        }),
      );
      const ready = yield* waitForHttpReady({
        baseUrl: "http://readiness.example.test/",
        timeoutMs: 5_000,
        intervalMs: 100,
        probeTimeoutMs: 250,
        makeError: () => new ReadinessTestError({ message: "Readiness failed" }),
      }).pipe(Effect.provideService(HttpClient.HttpClient, client), Effect.forkChild);
      yield* Deferred.await(bodyStarted);
      yield* TestClock.adjust("350 millis");
      expect(attempts).toBe(2);
      yield* Fiber.join(ready);
    }).pipe(Effect.provide(TestClock.layer())),
  );
});
