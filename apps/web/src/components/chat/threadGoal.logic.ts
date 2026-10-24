import type { ThreadGoal } from "@t3tools/contracts";

/** Which goal actions apply to the goal as it is now. */
export function goalActions(goal: ThreadGoal | null) {
  return {
    canPause: goal?.status === "active" || goal?.status === "evaluating",
    canResume:
      goal?.status === "paused" &&
      goal.turns < goal.maxTurns &&
      (goal.tokenBudget === undefined || goal.tokensUsed < goal.tokenBudget),
    canClear: goal !== null,
  };
}
