import type { ModelCapabilities } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { withDefaultReasoningEffort } from "./composerProviderState";

const caps = {
  optionDescriptors: [
    {
      id: "effort",
      label: "Effort",
      type: "select",
      options: [
        { id: "low", label: "Low" },
        { id: "high", label: "High", isDefault: true },
      ],
    },
  ],
} as unknown as ModelCapabilities;

describe("withDefaultReasoningEffort", () => {
  it("leaves the model alone when no default is set", () => {
    expect(withDefaultReasoningEffort(caps, undefined, null)).toBeUndefined();
  });

  it("starts an unpicked model on the default level", () => {
    expect(withDefaultReasoningEffort(caps, undefined, "low")).toEqual([
      { id: "effort", value: "low" },
    ]);
  });

  it("keeps an explicit pick and skips levels the model lacks", () => {
    const picked = [{ id: "effort", value: "high" }];
    expect(withDefaultReasoningEffort(caps, picked, "low")).toBe(picked);
    expect(withDefaultReasoningEffort(caps, undefined, "medium")).toBeUndefined();
  });
});
