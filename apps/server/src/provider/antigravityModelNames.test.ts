import { describe, expect, it } from "@effect/vitest";

import { antigravityModelNamesFromConfigs } from "./antigravityLanguageServerLimits.ts";
import {
  antigravityModelIdFromEnum,
  antigravityModelNameFromLabel,
} from "./antigravityModelNames.ts";

describe("antigravityModelNameFromLabel", () => {
  it("keeps the effort tier in the name and prices the untiered model", () => {
    expect(antigravityModelNameFromLabel("Gemini 3.8 Flash (High)")).toEqual({
      model: "gemini-3.8-flash-high",
      rateModel: "gemini-3.8-flash",
    });
    expect(antigravityModelNameFromLabel("gemini-3.1-pro-low")).toEqual({
      model: "gemini-3.1-pro-low",
      rateModel: "gemini-3.1-pro",
    });
  });

  it("folds variant tags that are not effort tiers into the base model", () => {
    expect(antigravityModelNameFromLabel("Gemini 2.5 Flash Thinking")).toEqual({
      model: "gemini-2.5-flash",
    });
    expect(antigravityModelNameFromLabel("Claude Opus 4.6 (Thinking)")).toEqual({
      model: "claude-opus-4-6",
    });
    expect(antigravityModelNameFromLabel("Gemini 3 Pro")).toEqual({ model: "gemini-3-pro" });
  });
});

describe("antigravityModelNamesFromConfigs", () => {
  it("maps MODEL_PLACEHOLDER_M<N> enums to 1000 + N", () => {
    expect(antigravityModelIdFromEnum("MODEL_PLACEHOLDER_M319")).toBe(1319);
    expect(antigravityModelIdFromEnum("MODEL_GOOGLE_GEMINI_2_5_PRO")).toBeNull();
  });

  it("turns client model configs into id to name entries and skips unmappable ones", () => {
    const names = antigravityModelNamesFromConfigs([
      { label: "Gemini 3.8 Flash (High)", modelOrAlias: { model: "MODEL_PLACEHOLDER_M319" } },
      { label: "Claude Sonnet 4.6 (Thinking)", modelOrAlias: { model: "MODEL_PLACEHOLDER_M35" } },
      { label: "Other", modelOrAlias: { model: "MODEL_SOMETHING_ELSE" } },
      { label: null, modelOrAlias: { model: "MODEL_PLACEHOLDER_M7" } },
      { label: "No model" },
    ]);
    expect([...names]).toEqual([
      [1319, { model: "gemini-3.8-flash-high", rateModel: "gemini-3.8-flash" }],
      [1035, { model: "claude-sonnet-4-6" }],
    ]);
  });
});
