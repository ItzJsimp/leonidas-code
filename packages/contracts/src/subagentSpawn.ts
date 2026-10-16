import * as Schema from "effect/Schema";
import { NonNegativeInt, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Spawn tiers (ADR-0082): a free-tier model starts a subagent with no prompt;
 * every other model, including any new catalog model, asks the user first.
 */
export const SubagentSpawnTier = Schema.Literals(["free", "confirm"]);
export type SubagentSpawnTier = typeof SubagentSpawnTier.Type;

/** The app's default free tier. Settings edits it; an AIOS model-tiers.json overrides it. */
export const DEFAULT_SUBAGENT_FREE_TIER_MODELS: ReadonlyArray<string> = [
  "claude-haiku-5-5",
  "gpt-6-luna",
  "gemini-3.8-flash-low",
  "gemini-3.8-flash-medium",
];

export const DEFAULT_SUBAGENT_TIER_GOOD_FOR: Record<SubagentSpawnTier, string> = {
  free: "Lookups, summaries, searches and routine edits.",
  confirm: "Design, architecture, hard reasoning and long builds.",
};

/** A confirm-tier spawn that waits for the user. */
export const SubagentSpawnApproval = Schema.Struct({
  id: TrimmedNonEmptyString,
  threadId: ThreadId,
  threadTitle: Schema.String,
  subagent: TrimmedNonEmptyString,
  model: TrimmedNonEmptyString,
  account: Schema.String,
  reason: Schema.String,
  filesInScope: Schema.Array(Schema.String),
  toolCount: NonNegativeInt,
  estimatedStartTokens: NonNegativeInt,
  /** Where the tier came from: the app's map or the AIOS model-tiers.json. */
  tierSource: Schema.Literals(["app", "aios"]),
  goodFor: Schema.String,
  requestedAt: Schema.String,
});
export type SubagentSpawnApproval = typeof SubagentSpawnApproval.Type;

export const SubagentSpawnApprovals = Schema.Array(SubagentSpawnApproval);
export type SubagentSpawnApprovals = typeof SubagentSpawnApprovals.Type;

export const SubagentSpawnDecision = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("allow_once") }),
  Schema.Struct({ kind: Schema.Literal("allow_thread") }),
  Schema.Struct({ kind: Schema.Literal("deny") }),
  Schema.Struct({
    kind: Schema.Literal("redirect"),
    text: TrimmedNonEmptyString.check(Schema.isMaxLength(4_000)),
  }),
]);
export type SubagentSpawnDecision = typeof SubagentSpawnDecision.Type;

export const SubagentSpawnRespondInput = Schema.Struct({
  id: TrimmedNonEmptyString,
  decision: SubagentSpawnDecision,
});
export type SubagentSpawnRespondInput = typeof SubagentSpawnRespondInput.Type;

export class SubagentSpawnApprovalError extends Schema.TaggedError<SubagentSpawnApprovalError>()(
  "SubagentSpawnApprovalError",
  { message: Schema.String },
) {}
