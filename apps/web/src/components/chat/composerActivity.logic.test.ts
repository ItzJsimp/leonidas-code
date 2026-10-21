import { describe, expect, it } from "vite-plus/test";

import type { ActivityNow } from "../../agentActivity";
import { activityBarView, activityStepLabel } from "./composerActivity.logic";

const now = (overrides: Partial<ActivityNow>): ActivityNow => ({
  text: "",
  label: "Running",
  target: "vp test run a.test.ts",
  kind: "command",
  running: true,
  failed: false,
  itemId: "item",
  full: null,
  since: null,
  alsoRunning: 0,
  ...overrides,
});

describe("activityBarView", () => {
  it("keeps a running command neutral until it runs long", () => {
    expect(activityBarView(now({}), false)).toMatchObject({
      verb: "Running",
      tone: "neutral",
      icon: "running",
      mono: true,
    });
    expect(activityBarView(now({}), true)).toMatchObject({
      verb: "Still running",
      tone: "warning",
      icon: "long",
    });
  });

  it("uses red only for a failed action and never warns while thinking", () => {
    expect(
      activityBarView(now({ running: false, failed: true, label: "Ran" }), true),
    ).toMatchObject({ verb: "Failed", tone: "error" });
    expect(
      activityBarView(now({ kind: "think", label: "Thinking", target: "Planning" }), true),
    ).toMatchObject({ verb: "Thinking", tone: "neutral", mono: false });
  });

  it("shows a finished action with its own icon", () => {
    expect(
      activityBarView(now({ running: false, label: "Read", kind: "read", target: "a.ts" }), false),
    ).toMatchObject({ verb: "Read", icon: "kind", mono: false });
  });
});

describe("activityStepLabel", () => {
  it("names the current step, or offers details without a plan", () => {
    expect(activityStepLabel({ currentStep: 1, completedSteps: 0, totalSteps: 3 })).toBe(
      "Step 1 of 3",
    );
    expect(activityStepLabel({ currentStep: null, completedSteps: 3, totalSteps: 3 })).toBe(
      "Step 3 of 3",
    );
    expect(activityStepLabel({ currentStep: null, completedSteps: 0, totalSteps: 0 })).toBe(
      "Details",
    );
  });
});
