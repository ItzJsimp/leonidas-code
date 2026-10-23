import * as Schema from "effect/Schema";

import { NonNegativeInt, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

/** Sorts unarchived, unsettled threads that have been idle at least `idleMinutes`. */
export const ThreadSweepInput = Schema.Struct({
  /** A project folder the cheap model may run in for threads that need a second opinion. */
  cwd: TrimmedNonEmptyString,
  idleMinutes: NonNegativeInt,
});
export type ThreadSweepInput = typeof ThreadSweepInput.Type;

export const ThreadSweepClass = Schema.Literals(["done", "unfinished", "unsure"]);
export type ThreadSweepClass = typeof ThreadSweepClass.Type;

export const ThreadSweepItem = Schema.Struct({
  threadId: ThreadId,
  projectId: ProjectId,
  title: Schema.String,
  /** ISO time of the last activity. */
  updatedAt: Schema.String,
  verdict: ThreadSweepClass,
  /** Who decided: a text rule, Laya, or the cheap model. */
  source: Schema.Literals(["rule", "laya", "model"]),
  reason: Schema.String,
});
export type ThreadSweepItem = typeof ThreadSweepItem.Type;

export const ThreadSweepResult = Schema.Struct({
  items: Schema.Array(ThreadSweepItem),
  /** False when Laya could not run, so rules and the model decided alone. */
  layaAvailable: Schema.Boolean,
  /** Eligible threads left Unsure because the per-sweep model limit was reached. */
  modelLimitHit: Schema.Boolean,
});
export type ThreadSweepResult = typeof ThreadSweepResult.Type;

/** Writes the prompt that continues one chat in a new chat. */
export const ThreadHandoffInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  threadId: ThreadId,
});
export type ThreadHandoffInput = typeof ThreadHandoffInput.Type;

export const ThreadHandoffResult = Schema.Struct({
  /** Null when no prompt could be written; `reason` then says why in plain words. */
  prompt: Schema.NullOr(Schema.String),
  reason: Schema.String,
});
export type ThreadHandoffResult = typeof ThreadHandoffResult.Type;
