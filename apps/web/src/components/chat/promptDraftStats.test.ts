import { describe, expect, it } from "vite-plus/test";

import { computePromptDraftStats, formatPromptDraftStats } from "./promptDraftStats";

describe("computePromptDraftStats", () => {
  it("returns zeros for an empty draft", () => {
    expect(computePromptDraftStats("")).toEqual({
      characters: 0,
      words: 0,
      lines: 0,
      approxTokens: 0,
    });
  });

  it("counts characters, words, lines and tokens", () => {
    const stats = computePromptDraftStats("fix the bug\nin the composer");
    expect(stats).toEqual({ characters: 27, words: 6, lines: 2, approxTokens: 8 });
    expect(formatPromptDraftStats(stats)).toBe("27 chars · ~8 tokens");
  });
});
