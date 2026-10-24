import type { ThreadGoal } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { goalActions } from "./threadGoal.logic";

const goal = (patch: Partial<ThreadGoal>) =>
  ({ status: "active", turns: 2, maxTurns: 20, tokensUsed: 10, ...patch }) as ThreadGoal;

describe("goalActions", () => {
  it("offers nothing without a goal", () => {
    expect(goalActions(null)).toEqual({ canPause: false, canResume: false, canClear: false });
  });

  it("pauses a running goal", () => {
    expect(goalActions(goal({ status: "evaluating" }))).toMatchObject({
      canPause: true,
      canResume: false,
      canClear: true,
    });
  });

  it("resumes a paused goal only while turns and tokens remain", () => {
    expect(goalActions(goal({ status: "paused" })).canResume).toBe(true);
    expect(goalActions(goal({ status: "paused", turns: 20 })).canResume).toBe(false);
    expect(goalActions(goal({ status: "paused", tokenBudget: 10 })).canResume).toBe(false);
  });
});
