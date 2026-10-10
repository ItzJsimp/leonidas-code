import { describe, expect, it } from "vite-plus/test";
import type { ThreadGoal } from "@t3tools/contracts";
import { completeGoalEvaluation } from "./GoalState.ts";

const goal = (overrides: Partial<ThreadGoal> = {}): ThreadGoal =>
  ({
    id: "goal-1",
    condition: "ship it",
    status: "evaluating",
    maxTurns: 20,
    turns: 1,
    tokensUsed: 0,
    noProgressTurns: 0,
    transientFailures: 0,
    lastRunOrdinal: 1,
    evaluationRunId: "run-1",
    lastReason: "",
    evidence: "",
    ...overrides,
  }) as unknown as ThreadGoal;

describe("completeGoalEvaluation", () => {
  it("marks the goal met only on a met verdict", () => {
    const next = completeGoalEvaluation(goal(), {
      result: { verdict: "met", reason: "done", evidence: "x" },
      madeProgress: true,
    });
    expect(next.status).toBe("met");
  });

  it("pauses after three turns without tool progress", () => {
    const next = completeGoalEvaluation(goal({ noProgressTurns: 2 }), {
      result: { verdict: "unmet", reason: "no", evidence: "" },
    });
    expect(next.status).toBe("paused");
  });

  it("keeps retrying transient provider failures without counting them as no progress, then pauses", () => {
    const retry = {
      result: { verdict: "unmet" as const, reason: "t", evidence: "" },
      retryableFailure: true,
    };
    const once = completeGoalEvaluation(goal({ noProgressTurns: 2 }), retry);
    expect(once.status).toBe("active");
    expect(once.noProgressTurns).toBe(2);
    expect(completeGoalEvaluation(goal({ transientFailures: 3 }), retry).status).toBe("paused");
  });

  it("pauses when the token budget is reached", () => {
    const next = completeGoalEvaluation(goal({ tokenBudget: 100 }), {
      result: { verdict: "unmet", reason: "no", evidence: "" },
      tokensUsed: 100,
      madeProgress: true,
    });
    expect(next.status).toBe("paused");
  });
});
