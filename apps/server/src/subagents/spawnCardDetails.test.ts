import type { ModelSelection, ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import { describeAccountUsage, modelSelectionEffort, spawnApprovalId } from "./spawnCardDetails.ts";

const base = { threadId: "t1", instanceId: "claudeAgent", model: "claude-sonnet-5-5" };

describe("spawnApprovalId", () => {
  it("repeats for a retry and differs for another task", () => {
    const first = spawnApprovalId({ ...base, clientRequestId: undefined, task: "fix the drift" });
    expect(spawnApprovalId({ ...base, clientRequestId: undefined, task: "fix the drift" })).toBe(
      first,
    );
    expect(spawnApprovalId({ ...base, clientRequestId: undefined, task: "other" })).not.toBe(first);
  });

  it("uses the client request id when there is one", () => {
    expect(spawnApprovalId({ ...base, clientRequestId: "req-1", task: "a" })).toBe(
      spawnApprovalId({ ...base, clientRequestId: "req-1", task: "b" }),
    );
  });
});

describe("modelSelectionEffort", () => {
  it("reads the effort option", () => {
    const selection = {
      instanceId: "x",
      model: "m",
      options: [{ id: "effort", value: "high" }],
    } as unknown as ModelSelection;
    expect(modelSelectionEffort(selection)).toBe("high");
    expect(modelSelectionEffort({ instanceId: "x", model: "m" } as ModelSelection)).toBeUndefined();
  });
});

describe("describeAccountUsage", () => {
  it("lists each window", () => {
    const provider = {
      usageLimits: {
        windows: [
          { label: "5-hour", usedPercent: 41.2 },
          { label: "Weekly", usedPercent: 40 },
        ],
      },
    } as unknown as ServerProvider;
    expect(describeAccountUsage(provider)).toBe("5-hour 41% used, Weekly 40% used");
    expect(describeAccountUsage(undefined)).toBeUndefined();
  });
});
