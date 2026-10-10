import type { ThreadGoal, ThreadGoalVerdict } from "@t3tools/contracts";

export function completeGoalEvaluation(
  goal: ThreadGoal,
  input: {
    result?: ThreadGoalVerdict | undefined;
    pauseReason?: string | undefined;
    tokensUsed?: number | undefined;
    madeProgress?: boolean | undefined;
    retryableFailure?: boolean | undefined;
  },
): ThreadGoal {
  const tokensUsed = goal.tokensUsed + (input.tokensUsed ?? 0);
  const noProgressTurns = input.retryableFailure
    ? goal.noProgressTurns
    : input.madeProgress
      ? 0
      : goal.noProgressTurns + 1;
  const transientFailures = input.retryableFailure ? goal.transientFailures + 1 : 0;
  const result = input.result;
  const pauseReason =
    input.pauseReason ??
    (transientFailures > 3 ? "Paused after three transient provider retries." : undefined) ??
    (goal.tokenBudget !== undefined && tokensUsed >= goal.tokenBudget
      ? "Token budget reached."
      : result?.verdict === "human_required"
        ? `Pending human check: ${result.reason}`
        : result?.verdict !== "met" &&
            result?.verdict !== "impossible" &&
            goal.turns >= goal.maxTurns
          ? "Turn cap reached."
          : result?.verdict !== "met" && result?.verdict !== "impossible" && noProgressTurns >= 3
            ? "Paused after three turns without successful tool work."
            : undefined);
  return {
    ...goal,
    tokensUsed,
    noProgressTurns,
    transientFailures,
    evaluationRunId: null,
    status: pauseReason
      ? "paused"
      : result?.verdict === "met"
        ? "met"
        : result?.verdict === "impossible"
          ? "impossible"
          : "active",
    lastReason: pauseReason ?? result?.reason ?? "Evaluation unavailable.",
    evidence: result?.evidence ?? "",
  };
}

export function goalWorkPrompt(goal: ThreadGoal): string {
  return [
    `Work toward this goal: ${goal.condition}`,
    goal.lastReason ? `Latest check: ${goal.lastReason}` : "",
    "Continue remaining executable work after an individual tool rejection. Save a concrete external blocker once and complete independent work. Report human-only checks as pending, with evidence; do not invent success.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
