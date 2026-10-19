import * as Schema from "effect/Schema";

/**
 * Scribe engine: the Rust dictation process. The server is its only client
 * (contract: services/scribe-engine/contract.md). The web app reads it only
 * through the `scribe.*` RPCs below.
 */

export const ScribeEngineState = Schema.Literals(["ready", "listening", "processing", "mic_error"]);
export type ScribeEngineState = typeof ScribeEngineState.Type;

export const ScribeRecordMode = Schema.Literals(["hold", "toggle"]);
export type ScribeRecordMode = typeof ScribeRecordMode.Type;

/** One saved dictation (contract v1.2 proposal, `GET /v1/history`). */
export const ScribeHistoryItem = Schema.Struct({
  id: Schema.String,
  at: Schema.String,
  mode: Schema.String,
  app: Schema.String,
  rawText: Schema.String,
  cleanedText: Schema.String,
  words: Schema.Number,
  metrics: Schema.Struct({
    transcribeMs: Schema.Number,
    polishMs: Schema.Number,
    totalMs: Schema.Number,
  }),
  pasted: Schema.Boolean,
});
export type ScribeHistoryItem = typeof ScribeHistoryItem.Type;

export const ScribeHistoryPage = Schema.Struct({
  items: Schema.Array(ScribeHistoryItem),
  next: Schema.NullOr(Schema.String),
});
export type ScribeHistoryPage = typeof ScribeHistoryPage.Type;

/** Events as the engine sends them on `GET /v1/events` (v1.1 plus the v1.2 `history` event). */
export const ScribeEngineWireEvent = Schema.Union([
  Schema.Struct({ type: Schema.Literal("state"), state: ScribeEngineState, at: Schema.String }),
  Schema.Struct({ type: Schema.Literal("partial"), text: Schema.String, at: Schema.String }),
  Schema.Struct({
    type: Schema.Literal("transcript"),
    text: Schema.String,
    raw: Schema.optional(Schema.String),
    durationMs: Schema.Number,
    pasted: Schema.Boolean,
    engine: Schema.optional(Schema.Literals(["groq", "local"])),
    at: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("error"),
    code: Schema.String,
    message: Schema.String,
    at: Schema.String,
  }),
  Schema.Struct({ type: Schema.Literal("history"), item: ScribeHistoryItem }),
]);
export type ScribeEngineWireEvent = typeof ScribeEngineWireEvent.Type;

/** How the server sees the engine process. `unmanaged` means no supervisor owns it. */
export const ScribeEngineProcess = Schema.Struct({
  status: Schema.Literals(["unmanaged", "starting", "running", "stopped", "crashed"]),
  restarts: Schema.Number,
  lastRestartAt: Schema.NullOr(Schema.String),
});
export type ScribeEngineProcess = typeof ScribeEngineProcess.Type;

/** What `scribe.subscribeEvents` streams: engine events plus server-side link and process events. */
export const ScribeLiveEvent = Schema.Union([
  ScribeEngineWireEvent,
  Schema.Struct({
    type: Schema.Literal("connection"),
    connected: Schema.Boolean,
    at: Schema.String,
  }),
  Schema.Struct({ type: Schema.Literal("process"), process: ScribeEngineProcess }),
]);
export type ScribeLiveEvent = typeof ScribeLiveEvent.Type;

export const ScribeStartInput = Schema.Struct({ mode: ScribeRecordMode });
export type ScribeStartInput = typeof ScribeStartInput.Type;

export const ScribeStopInput = Schema.Struct({ paste: Schema.Boolean });
export type ScribeStopInput = typeof ScribeStopInput.Type;

export const ScribeCommandResult = Schema.Struct({ state: ScribeEngineState });
export type ScribeCommandResult = typeof ScribeCommandResult.Type;

export const ScribeListHistoryInput = Schema.Struct({
  limit: Schema.optional(Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 500 }))),
  before: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
  mode: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
});
export type ScribeListHistoryInput = typeof ScribeListHistoryInput.Type;

export const ScribeDeleteHistoryInput = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
});
export type ScribeDeleteHistoryInput = typeof ScribeDeleteHistoryInput.Type;

export const ScribeDeleteHistoryResult = Schema.Struct({ deleted: Schema.Literal(true) });
export type ScribeDeleteHistoryResult = typeof ScribeDeleteHistoryResult.Type;

/** Contract v1.2 `GET` and `PUT /v1/dictionary`. The engine allows at most 800 vocabulary words. */
export const ScribeDictionary = Schema.Struct({
  replacements: Schema.Array(Schema.Struct({ wrong: Schema.String, correct: Schema.String })),
  vocabulary: Schema.Array(Schema.String).check(Schema.isMaxLength(800)),
});
export type ScribeDictionary = typeof ScribeDictionary.Type;

/** A run of words the engine saw polish fix in 2 or more dictations (`GET /v1/dictionary/suggestions`). */
export const ScribeSuggestionList = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({ wrong: Schema.String, correct: Schema.String, count: Schema.Number }),
  ),
});
export type ScribeSuggestionList = typeof ScribeSuggestionList.Type;

export const ScribeRejectSuggestionInput = Schema.Struct({
  wrong: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
});
export type ScribeRejectSuggestionInput = typeof ScribeRejectSuggestionInput.Type;

export const ScribeRejectSuggestionResult = Schema.Struct({ rejected: Schema.Literal(true) });
export type ScribeRejectSuggestionResult = typeof ScribeRejectSuggestionResult.Type;

export const ScribeEngineErrorReason = Schema.Literals([
  "offline",
  "timeout",
  "invalid_state",
  "invalid_response",
  "bad_request",
  "not_found",
  "store_error",
  "http_error",
]);
export type ScribeEngineErrorReason = typeof ScribeEngineErrorReason.Type;

export class ScribeEngineError extends Schema.TaggedError<ScribeEngineError>()(
  "ScribeEngineError",
  { reason: ScribeEngineErrorReason },
) {}
