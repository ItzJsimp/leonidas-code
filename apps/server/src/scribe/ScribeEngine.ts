import {
  ScribeCommandResult,
  type ScribeDeleteHistoryInput,
  ScribeDeleteHistoryResult,
  ScribeEngineError,
  ScribeEngineState,
  ScribeEngineWireEvent,
  ScribeHistoryPage,
  type ScribeListHistoryInput,
  type ScribeLiveEvent,
  type ScribeStartInput,
  type ScribeStopInput,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

import { scribeEngineBaseUrl } from "./engineUrl.ts";

/**
 * The server's only client of the Scribe engine. The browser never calls the
 * engine: the contract rejects any request with an Origin header.
 */
export class ScribeEngine extends Context.Service<
  ScribeEngine,
  {
    readonly start: (
      input: ScribeStartInput,
    ) => Effect.Effect<ScribeCommandResult, ScribeEngineError>;
    readonly stop: (
      input: ScribeStopInput,
    ) => Effect.Effect<ScribeCommandResult, ScribeEngineError>;
    readonly listHistory: (
      input: ScribeListHistoryInput,
    ) => Effect.Effect<ScribeHistoryPage, ScribeEngineError>;
    readonly deleteHistory: (
      input: ScribeDeleteHistoryInput,
    ) => Effect.Effect<ScribeDeleteHistoryResult, ScribeEngineError>;
    /** Engine events plus `connection` events. Reconnects every second while the engine is down. */
    readonly events: Stream.Stream<ScribeLiveEvent>;
  }
>()("t3/scribe/ScribeEngine") {}

const decodeCommand = Schema.decodeUnknownEffect(ScribeCommandResult);
const decodeStatus = Schema.decodeUnknownEffect(
  Schema.Struct({ state: ScribeEngineState, sampledAt: Schema.String }),
);
const decodeDeleted = Schema.decodeUnknownEffect(ScribeDeleteHistoryResult);
const decodePage = Schema.decodeUnknownEffect(ScribeHistoryPage);
const decodeWireEvent = Schema.decodeUnknownOption(Schema.fromJsonString(ScribeEngineWireEvent));

const reasonForStatus = (status: number): ScribeEngineError["reason"] => {
  if (status === 409) return "invalid_state";
  if (status === 404) return "not_found";
  if (status === 500) return "store_error";
  return "http_error";
};

/** One SSE `data:` line to an event, or null for comments, blank lines and unknown events. */
export const parseEventLine = (line: string): ScribeLiveEvent | null => {
  if (!line.startsWith("data:")) return null;
  const decoded = decodeWireEvent(line.slice(5).trim());
  return decoded._tag === "Some" ? decoded.value : null;
};

const isEvent = (event: ScribeLiveEvent | null): event is ScribeLiveEvent => event !== null;

export const makeWith = (options: {
  readonly baseUrl: string;
  readonly retryEvery?: Duration.Input;
}) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const { baseUrl } = options;

    const call = <A>(
      request: HttpClientRequest.HttpClientRequest,
      decode: (body: unknown) => Effect.Effect<A, Schema.SchemaError>,
    ) =>
      Effect.gen(function* () {
        const response = yield* http.execute(request);
        if (response.status >= 400) {
          return yield* new ScribeEngineError({ reason: reasonForStatus(response.status) });
        }
        const body = yield* response.json;
        return yield* decode(body).pipe(
          Effect.mapError(() => new ScribeEngineError({ reason: "invalid_response" })),
        );
      }).pipe(
        Effect.provideService(FetchHttpClient.RequestInit, {
          redirect: "manual",
          cache: "no-store",
        }),
        Effect.scoped,
        Effect.timeout("3 seconds"),
        Effect.mapError((error) =>
          error._tag === "ScribeEngineError"
            ? error
            : new ScribeEngineError({
                reason: error._tag === "TimeoutError" ? "timeout" : "offline",
              }),
        ),
      );

    const start = (input: ScribeStartInput) =>
      call(
        HttpClientRequest.post(`${baseUrl}/v1/start`).pipe(HttpClientRequest.bodyJsonUnsafe(input)),
        decodeCommand,
      );

    const stop = (input: ScribeStopInput) =>
      call(
        HttpClientRequest.post(`${baseUrl}/v1/stop`).pipe(HttpClientRequest.bodyJsonUnsafe(input)),
        decodeCommand,
      );

    const listHistory = (input: ScribeListHistoryInput) => {
      const params: Record<string, string> = {};
      if (input.limit !== undefined) params.limit = String(input.limit);
      if (input.before !== undefined) params.before = input.before;
      if (input.mode !== undefined) params.mode = input.mode;
      return call(
        HttpClientRequest.get(`${baseUrl}/v1/history`).pipe(HttpClientRequest.setUrlParams(params)),
        decodePage,
      );
    };

    const deleteHistory = (input: ScribeDeleteHistoryInput) =>
      call(
        HttpClientRequest.delete(`${baseUrl}/v1/history/${encodeURIComponent(input.id)}`),
        decodeDeleted,
      );

    const connection = (connected: boolean) =>
      Effect.map(DateTime.now, (now): ScribeLiveEvent => ({
        type: "connection",
        connected,
        at: DateTime.formatIso(now),
      }));

    const readState = call(HttpClientRequest.get(`${baseUrl}/v1/status`), decodeStatus).pipe(
      Effect.map((status): ScribeLiveEvent | null => ({
        type: "state",
        state: status.state,
        at: status.sampledAt,
      })),
      Effect.orElseSucceed(() => null),
    );

    const connectOnce: Stream.Stream<ScribeLiveEvent> = Stream.unwrap(
      Effect.gen(function* () {
        const response = yield* http.execute(
          HttpClientRequest.get(`${baseUrl}/v1/events`).pipe(
            HttpClientRequest.setHeader("accept", "text/event-stream"),
          ),
        );
        if (response.status !== 200) return Stream.empty;
        const lines = response.stream.pipe(
          Stream.decodeText(),
          Stream.splitLines,
          Stream.map(parseEventLine),
          Stream.filter(isEvent),
        );
        // The stream sends only changes, so read the current state once after each connect.
        const current = Stream.fromEffect(readState).pipe(
          Stream.filter((event): event is ScribeLiveEvent => event !== null),
        );
        return Stream.concat(Stream.fromEffect(connection(true)), Stream.concat(current, lines));
      }).pipe(
        Effect.provideService(FetchHttpClient.RequestInit, {
          redirect: "manual",
          cache: "no-store",
        }),
      ),
    ).pipe(Stream.catchCause(() => Stream.empty));

    const events = Stream.concat(connectOnce, Stream.fromEffect(connection(false))).pipe(
      Stream.repeat(Schedule.spaced(options.retryEvery ?? "1 second")),
      // Report each link change once, not once per failed retry.
      Stream.changesWith(
        (a, b) => a.type === "connection" && b.type === "connection" && a.connected === b.connected,
      ),
    );

    return ScribeEngine.of({ start, stop, listHistory, deleteHistory, events });
  });

export const layer = Layer.effect(ScribeEngine, makeWith({ baseUrl: scribeEngineBaseUrl() }));
