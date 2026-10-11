import * as Schema from "effect/Schema";

import { IsoDateTime, NonNegativeInt, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderDriverKind } from "./providerInstance.ts";

/**
 * Detailed view of what is consuming a thread's context window.
 *
 * `source` says where the numbers came from: "provider" when every figure is a
 * provider report (Claude SDK getContextUsage), "estimated" when everything is
 * derived from persisted timeline items (about 4 characters per token), and
 * "mixed" when provider categories are combined with estimated files and tool
 * calls. Each row also carries its own `estimated` flag.
 */

export const ThreadContextBreakdownCategoryKind = Schema.Literals([
  "used",
  "free",
  "buffer",
  "deferred",
]);
export type ThreadContextBreakdownCategoryKind = typeof ThreadContextBreakdownCategoryKind.Type;

export const ThreadContextBreakdownCategory = Schema.Struct({
  name: Schema.String,
  kind: ThreadContextBreakdownCategoryKind,
  tokens: NonNegativeInt,
  estimated: Schema.Boolean,
});
export type ThreadContextBreakdownCategory = typeof ThreadContextBreakdownCategory.Type;

export const ThreadContextBreakdownFileOrigin = Schema.Literals([
  "memory",
  "read",
  "edit",
  "other",
]);
export type ThreadContextBreakdownFileOrigin = typeof ThreadContextBreakdownFileOrigin.Type;

export const ThreadContextBreakdownFile = Schema.Struct({
  path: Schema.String,
  tokens: NonNegativeInt,
  estimated: Schema.Boolean,
  readCount: NonNegativeInt,
  lastTurnIndex: Schema.NullOr(NonNegativeInt),
  origin: ThreadContextBreakdownFileOrigin,
});
export type ThreadContextBreakdownFile = typeof ThreadContextBreakdownFile.Type;

export const ThreadContextBreakdownToolCall = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  target: Schema.NullOr(Schema.String),
  tokens: NonNegativeInt,
  estimated: Schema.Boolean,
  turnIndex: Schema.NullOr(NonNegativeInt),
  status: Schema.Literals(["ok", "error", "unknown"]),
});
export type ThreadContextBreakdownToolCall = typeof ThreadContextBreakdownToolCall.Type;

export const ThreadContextBreakdownMcpTool = Schema.Struct({
  name: Schema.String,
  server: Schema.String,
  tokens: NonNegativeInt,
});
export type ThreadContextBreakdownMcpTool = typeof ThreadContextBreakdownMcpTool.Type;

export const ThreadContextBreakdownSkill = Schema.Struct({
  name: Schema.String,
  source: Schema.String,
  tokens: NonNegativeInt,
});
export type ThreadContextBreakdownSkill = typeof ThreadContextBreakdownSkill.Type;

export const ThreadContextBreakdownAgent = Schema.Struct({
  name: Schema.String,
  source: Schema.String,
  tokens: NonNegativeInt,
});
export type ThreadContextBreakdownAgent = typeof ThreadContextBreakdownAgent.Type;

export const ThreadContextBreakdown = Schema.Struct({
  threadId: ThreadId,
  driver: ProviderDriverKind,
  model: Schema.NullOr(Schema.String),
  source: Schema.Literals(["provider", "estimated", "mixed"]),
  capturedAt: IsoDateTime,
  totalTokens: NonNegativeInt,
  maxTokens: Schema.NullOr(NonNegativeInt),
  categories: Schema.Array(ThreadContextBreakdownCategory),
  files: Schema.Array(ThreadContextBreakdownFile),
  toolCalls: Schema.Array(ThreadContextBreakdownToolCall),
  mcpTools: Schema.Array(ThreadContextBreakdownMcpTool),
  skills: Schema.Array(ThreadContextBreakdownSkill),
  agents: Schema.Array(ThreadContextBreakdownAgent),
  /** Plain-language caveats, for example "Per-file sizes are estimated from tool output". */
  notes: Schema.Array(Schema.String),
});
export type ThreadContextBreakdown = typeof ThreadContextBreakdown.Type;

export const ThreadContextBreakdownInput = Schema.Struct({
  threadId: ThreadId,
});
export type ThreadContextBreakdownInput = typeof ThreadContextBreakdownInput.Type;

/**
 * Typed failure for getThreadContextBreakdown. A failed provider call is never
 * an empty success; `retryable` tells the client whether another attempt can
 * help (a busy or restarting session) or not (an unknown thread).
 */
export class ThreadContextBreakdownError extends Schema.TaggedError<ThreadContextBreakdownError>()(
  "ThreadContextBreakdownError",
  {
    threadId: ThreadId,
    reason: Schema.Literals(["thread-not-found", "provider-failed", "unavailable"]),
    retryable: Schema.Boolean,
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}
