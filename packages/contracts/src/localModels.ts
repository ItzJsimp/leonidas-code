import * as Schema from "effect/Schema";

import { NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

/** How well a model fits this PC. "unknown" means the size is not known yet. */
export const LocalModelFit = Schema.Literals(["fits", "tight", "too_big", "unknown"]);
export type LocalModelFit = typeof LocalModelFit.Type;

export const LocalModelGate = Schema.Struct({
  allowed: Schema.Boolean,
  /** Plain words. Set when `allowed` is false. */
  reason: Schema.NullOr(Schema.String),
  /** True when the pull is over 10 GB and the person must confirm first. */
  needsConfirm: Schema.Boolean,
});
export type LocalModelGate = typeof LocalModelGate.Type;

export const LocalModelPull = Schema.Struct({
  status: Schema.String,
  completedBytes: NonNegativeInt,
  totalBytes: NonNegativeInt,
  error: Schema.NullOr(Schema.String),
});
export type LocalModelPull = typeof LocalModelPull.Type;

export const LocalModelRow = Schema.Struct({
  /** Ollama tag, for example "gemma4:12b-it-q4_K_M". */
  id: TrimmedNonEmptyString,
  name: Schema.String,
  installed: Schema.Boolean,
  /** Loaded in memory now (ready for a fast first chat turn). */
  loaded: Schema.Boolean,
  sizeBytes: Schema.NullOr(NonNegativeInt),
  fit: LocalModelFit,
  /** Tokens per second from a speed test. Null until slice 3. */
  tokensPerSecond: Schema.NullOr(Schema.Number),
  benchLm: Schema.NullOr(Schema.Number),
  /** Download rules for a model that is not installed. */
  gate: LocalModelGate,
  /** Set while a download runs or after it failed. */
  pull: Schema.NullOr(LocalModelPull),
});
export type LocalModelRow = typeof LocalModelRow.Type;

export const LocalModelsState = Schema.Struct({
  ollama: Schema.Struct({
    running: Schema.Boolean,
    baseUrl: Schema.String,
    /** Plain words. Set when something else holds the Ollama port, for example WSL. */
    warning: Schema.NullOr(Schema.String),
  }),
  hardware: Schema.Struct({
    gpuName: Schema.NullOr(Schema.String),
    vramBytes: NonNegativeInt,
    ramBytes: NonNegativeInt,
  }),
  /** The drive that holds the model folder. Null when it cannot be found. */
  modelDrive: Schema.NullOr(
    Schema.Struct({
      mount: Schema.String,
      mediaType: Schema.Literals(["ssd", "hdd", "unknown"]),
      freeBytes: NonNegativeInt,
    }),
  ),
  rows: Schema.Array(LocalModelRow),
  now: NonNegativeInt,
});
export type LocalModelsState = typeof LocalModelsState.Type;

export const LocalModelsModelInput = Schema.Struct({ model: TrimmedNonEmptyString });
export type LocalModelsModelInput = typeof LocalModelsModelInput.Type;

export const LocalModelsPullInput = Schema.Struct({
  model: TrimmedNonEmptyString,
  /** True after the person confirmed a pull over 10 GB. */
  confirmed: Schema.optional(Schema.Boolean),
});
export type LocalModelsPullInput = typeof LocalModelsPullInput.Type;

export const LocalModelsStartInput = Schema.Struct({});
export type LocalModelsStartInput = typeof LocalModelsStartInput.Type;

export const LocalModelsAdviceItem = Schema.Struct({
  kind: Schema.Literals(["vram", "ram"]),
  name: Schema.String,
  memoryBytes: NonNegativeInt,
  /** How many processes of this program run. */
  processes: NonNegativeInt,
  /** Plain advice for known programs. Null when there is none. */
  hint: Schema.NullOr(Schema.String),
});
export type LocalModelsAdviceItem = typeof LocalModelsAdviceItem.Type;

export const LocalModelsAdvice = Schema.Struct({
  at: NonNegativeInt,
  /** False on a system where the advisor cannot read memory use. */
  supported: Schema.Boolean,
  items: Schema.Array(LocalModelsAdviceItem),
});
export type LocalModelsAdvice = typeof LocalModelsAdvice.Type;

export const LocalModelsCompareInput = Schema.Struct({
  prompt: TrimmedNonEmptyString.check(Schema.isMaxLength(4000)),
  modelA: TrimmedNonEmptyString,
  modelB: TrimmedNonEmptyString,
});
export type LocalModelsCompareInput = typeof LocalModelsCompareInput.Type;

/** One blind answer. The label is "A" or "B"; the model name stays on the server until the pick. */
export const LocalModelsCompareAnswer = Schema.Struct({
  label: Schema.Literals(["A", "B"]),
  text: Schema.String,
  tokensPerSecond: Schema.NullOr(Schema.Number),
  seconds: Schema.Number,
});
export type LocalModelsCompareAnswer = typeof LocalModelsCompareAnswer.Type;

export const LocalModelsCompareResult = Schema.Struct({
  compareId: TrimmedNonEmptyString,
  answers: Schema.Array(LocalModelsCompareAnswer),
});
export type LocalModelsCompareResult = typeof LocalModelsCompareResult.Type;

export const LocalModelsPickInput = Schema.Struct({
  compareId: TrimmedNonEmptyString,
  pick: Schema.Literals(["A", "B", "tie"]),
});
export type LocalModelsPickInput = typeof LocalModelsPickInput.Type;

export const LocalModelsPickResult = Schema.Struct({
  models: Schema.Struct({ A: Schema.String, B: Schema.String }),
  /** The model the person picked. Null for a tie. */
  winner: Schema.NullOr(Schema.String),
});
export type LocalModelsPickResult = typeof LocalModelsPickResult.Type;

export const LocalModelsActionResult = Schema.Struct({ ok: Schema.Boolean });
export type LocalModelsActionResult = typeof LocalModelsActionResult.Type;

export class LocalModelsError extends Schema.TaggedError<LocalModelsError>()("LocalModelsError", {
  reason: Schema.Literals(["not_allowed", "not_found", "ollama_down", "invalid_input"]),
  detail: Schema.optional(Schema.String),
}) {
  override get message(): string {
    return `Local models failed (${this.reason})${this.detail ? `: ${this.detail}` : ""}.`;
  }
}
