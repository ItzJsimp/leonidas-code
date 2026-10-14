import type { ModelBenchmarkEntry } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  NO_PICKER_STATS,
  formatPickerCost,
  formatPickerIntelligence,
  formatPickerSpeed,
  pickerModelStats,
} from "./pickerModelStats";

const entry = (name: string, values: Record<string, number>): ModelBenchmarkEntry => ({
  source: "benchLm",
  sourceModelKey: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  values,
});

describe("pickerModelStats", () => {
  it("prefers the Artificial Analysis index over BenchLM overall", () => {
    const stats = pickerModelStats(
      [
        entry("GPT-5.6 Sol", {
          "benchLm:benchmark:artificialAnalysis": 58.89,
          "benchLm:overall": 90,
          "benchLm:speed": 120.4,
          "benchLm:price:input": 2,
          "benchLm:price:output": 10,
        }),
      ],
      { modelId: "gpt-5.6-sol" },
    );
    expect(stats.intelligenceSource).toBe("aa");
    expect(formatPickerIntelligence(stats)).toBe("58.9");
    expect(formatPickerSpeed(stats)).toBe("120 t/s");
    expect(formatPickerCost(stats)).toBe("$2 / $10");
  });

  it("falls back to BenchLM overall when the index is missing", () => {
    const stats = pickerModelStats([entry("Claude Opus 5", { "benchLm:overall": 77 })], {
      modelId: "claude-opus-5",
    });
    expect(stats.intelligenceSource).toBe("overall");
    expect(stats.intelligence).toBe(77);
    expect(formatPickerCost(stats)).toBeNull();
  });

  it("returns empty stats for a model no source knows", () => {
    expect(
      pickerModelStats([entry("Other", { "benchLm:overall": 1 })], { modelId: "new-model" }),
    ).toBe(NO_PICKER_STATS);
  });

  it("keeps cents below ten dollars", () => {
    const stats = pickerModelStats(
      [entry("Cheap", { "benchLm:price:input": 0.15, "benchLm:price:output": 0.6 })],
      { modelId: "cheap" },
    );
    expect(formatPickerCost(stats)).toBe("$0.15 / $0.6");
  });
});
