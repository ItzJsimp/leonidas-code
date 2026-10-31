import { describe, expect, it } from "vite-plus/test";

import { formatLabel, formatStartCost, modelDisplayName } from "./spawnApproval.logic";

describe("spawn approval card text", () => {
  it("rounds the start cost to the hundred", () => {
    expect(formatStartCost(12_437)).toBe("about 12,400 tokens");
    expect(formatStartCost(12)).toBe("about 100 tokens");
  });

  it("names Claude models and keeps other ids", () => {
    expect(modelDisplayName("claude-opus-5-5")).toBe("Claude Opus 5.5");
    expect(modelDisplayName("claude-fable-5")).toBe("Claude Fable 5");
    expect(modelDisplayName("gpt-6-sol")).toBe("gpt-6-sol");
  });
});

describe("formatLabel", () => {
  it("turns ids into words", () => {
    expect(formatLabel("full-access")).toBe("Full access");
    expect(formatLabel("high")).toBe("High");
  });
});
