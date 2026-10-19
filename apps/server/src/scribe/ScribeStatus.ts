import { ScribeStatusResult, ScribeStatusSnapshot } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

import { scribeEngineBaseUrl } from "./engineUrl.ts";

class ScribeReadError extends Schema.TaggedError<ScribeReadError>()("ScribeReadError", {
  reason: Schema.Literals(["invalid_response", "stale", "http_error"]),
}) {}

const decodeSnapshot = Schema.decodeUnknownEffect(Schema.fromJsonString(ScribeStatusSnapshot));

export class ScribeStatus extends Context.Service<
  ScribeStatus,
  { readonly get: Effect.Effect<ScribeStatusResult> }
>()("t3/scribe/ScribeStatus") {}

const make = Effect.gen(function* () {
  const http = yield* HttpClient.HttpClient;
  const probe = Effect.gen(function* () {
    const response = yield* http.execute(
      HttpClientRequest.get(`${scribeEngineBaseUrl()}/v1/status`),
    );
    if (response.status !== 200) return yield* new ScribeReadError({ reason: "http_error" });
    if (Number(response.headers["content-length"]) > 4096) {
      return yield* new ScribeReadError({ reason: "invalid_response" });
    }
    const bytes = yield* Stream.runFoldEffect(
      response.stream,
      () => new Uint8Array(),
      (previous, chunk) => {
        if (previous.length + chunk.length > 4096) {
          return Effect.fail(new ScribeReadError({ reason: "invalid_response" }));
        }
        const next = new Uint8Array(previous.length + chunk.length);
        next.set(previous);
        next.set(chunk, previous.length);
        return Effect.succeed(next);
      },
    );
    const text = yield* Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      catch: () => new ScribeReadError({ reason: "invalid_response" }),
    });
    const snapshot = yield* decodeSnapshot(text).pipe(
      Effect.mapError(() => new ScribeReadError({ reason: "invalid_response" })),
    );
    const sampled = DateTime.make(snapshot.sampledAt);
    if (Option.isNone(sampled) || DateTime.formatIso(sampled.value) !== snapshot.sampledAt) {
      return yield* new ScribeReadError({ reason: "invalid_response" });
    }
    return { status: "available", snapshot } as const;
  }).pipe(
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual", cache: "no-store" }),
    Effect.scoped,
    Effect.timeout("1 second"),
    Effect.catch((error) =>
      Effect.succeed({
        status: "unavailable",
        reason:
          error._tag === "ScribeReadError"
            ? error.reason
            : error._tag === "TimeoutError"
              ? "timeout"
              : "offline",
      } as const),
    ),
  );
  const cached = yield* Effect.cachedWithTTL(probe, "2 seconds");
  const get = Effect.gen(function* () {
    const result = yield* cached;
    if (result.status === "unavailable") return result;
    const now = yield* DateTime.now;
    const age =
      now.epochMilliseconds - DateTime.makeUnsafe(result.snapshot.sampledAt).epochMilliseconds;
    // Recheck cached data too: the cache must never extend a snapshot's freshness.
    if (age > 5000 || age < -1000) return { status: "unavailable", reason: "stale" } as const;
    return result;
  });
  return ScribeStatus.of({ get });
});

export const layer = Layer.effect(ScribeStatus, make);
