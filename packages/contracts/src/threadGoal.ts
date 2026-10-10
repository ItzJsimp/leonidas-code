import * as Schema from "effect/Schema";
import {
  CommandId,
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  RunId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

export const ThreadGoalVerdict = Schema.Struct({
  verdict: Schema.Literals(["met", "unmet", "impossible", "human_required"]),
  reason: TrimmedNonEmptyString.pipe(Schema.check(Schema.isMaxLength(2000))),
  evidence: Schema.String.pipe(Schema.check(Schema.isMaxLength(4000))),
});
export type ThreadGoalVerdict = typeof ThreadGoalVerdict.Type;

export const ThreadGoalCheck = Schema.Struct({
  command: TrimmedNonEmptyString.pipe(Schema.check(Schema.isMaxLength(4000))),
  approved: Schema.Literal(true),
});
export const ThreadGoalControl = Schema.Union([
  Schema.Struct({
    action: Schema.Literal("start"),
    condition: TrimmedNonEmptyString.pipe(Schema.check(Schema.isMaxLength(4000))),
    spendingApproved: Schema.Literal(true),
    maxTurns: Schema.optional(PositiveInt.pipe(Schema.check(Schema.isLessThanOrEqualTo(100)))),
    tokenBudget: Schema.optional(PositiveInt),
    check: Schema.optional(ThreadGoalCheck),
  }),
  Schema.Struct({ action: Schema.Literal("resume"), spendingApproved: Schema.Literal(true) }),
  Schema.Struct({ action: Schema.Literals(["pause", "clear"]) }),
]);
export type ThreadGoalControl = typeof ThreadGoalControl.Type;

/** App-owned goal; independent of a provider's session-local /goal. */
export const ThreadGoal = Schema.Struct({
  id: CommandId,
  condition: TrimmedNonEmptyString,
  status: Schema.Literals(["active", "evaluating", "paused", "met", "impossible"]),
  startedAt: IsoDateTime,
  maxTurns: PositiveInt,
  tokenBudget: Schema.optional(PositiveInt),
  check: Schema.optional(ThreadGoalCheck),
  checkCwd: Schema.optional(Schema.String),
  turns: NonNegativeInt,
  tokensUsed: NonNegativeInt,
  noProgressTurns: NonNegativeInt,
  transientFailures: NonNegativeInt,
  lastRunOrdinal: NonNegativeInt,
  evaluationRunId: Schema.NullOr(RunId),
  lastReason: Schema.String,
  evidence: Schema.String,
});
export type ThreadGoal = typeof ThreadGoal.Type;
