import { describe, expect, it } from "vite-plus/test";

import { buildTokenReport, SHORT_ANSWER_MAX_OUTPUT_TOKENS } from "./tokenReport.ts";

describe("buildTokenReport", () => {
  it("returns zeros and no dollar line for an empty period", () => {
    const report = buildTokenReport([], 30, null);
    expect(report).toMatchObject({
      days: 30,
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      listPriceSaved: null,
    });
    expect(report.classes.shortAnswer.turns).toBe(0);
    expect(report.classes.notReported.turns).toBe(0);
  });

  it("puts a short turn without tool calls in the local-capable class", () => {
    const report = buildTokenReport(
      [{ inputTokens: 1000, outputTokens: SHORT_ANSWER_MAX_OUTPUT_TOKENS, toolCalls: 0 }],
      7,
      null,
    );
    expect(report.classes.shortAnswer).toEqual({
      turns: 1,
      inputTokens: 1000,
      cachedInputTokens: 0,
      outputTokens: SHORT_ANSWER_MAX_OUTPUT_TOKENS,
    });
    expect(report.classes.keepCloud.turns).toBe(0);
  });

  it("keeps long turns, tool turns and turns with an unknown tool count on the cloud", () => {
    const report = buildTokenReport(
      [
        { inputTokens: 10, outputTokens: SHORT_ANSWER_MAX_OUTPUT_TOKENS + 1, toolCalls: 0 },
        { inputTokens: 10, outputTokens: 5, toolCalls: 2 },
        { inputTokens: 10, outputTokens: 5, toolCalls: null },
      ],
      30,
      null,
    );
    expect(report.classes.keepCloud.turns).toBe(3);
    expect(report.classes.shortAnswer.turns).toBe(0);
  });

  it("counts a turn with no reported usage as not reported and adds no tokens", () => {
    const report = buildTokenReport(
      [
        { inputTokens: undefined, outputTokens: undefined, toolCalls: 0 },
        { inputTokens: 40, outputTokens: 10, toolCalls: 0 },
      ],
      30,
      null,
    );
    expect(report.classes.notReported.turns).toBe(1);
    expect(report.turns).toBe(2);
    expect(report.inputTokens).toBe(40);
    expect(report.outputTokens).toBe(10);
  });

  it("shows a dollar line only when a list price is set, from local-capable tokens only", () => {
    const rows = [
      { inputTokens: 2_000_000, outputTokens: 100, toolCalls: 0 },
      { inputTokens: 5_000_000, outputTokens: 9_000, toolCalls: 3 },
    ];
    expect(buildTokenReport(rows, 30, null).listPriceSaved).toBeNull();
    const priced = buildTokenReport(rows, 30, { inputPerMillion: 3, outputPerMillion: 15 });
    // 2M input at 3 per million, plus 100 output at 15 per million.
    expect(priced.listPriceSaved).toBeCloseTo(6 + 0.0015, 6);
  });

  it("reports cached input apart and prices only the fresh input", () => {
    const rows = [
      { inputTokens: 2_000_000, cachedInputTokens: 1_500_000, outputTokens: 100, toolCalls: 0 },
    ];
    const report = buildTokenReport(rows, 30, { inputPerMillion: 3, outputPerMillion: 15 });
    expect(report.cachedInputTokens).toBe(1_500_000);
    expect(report.classes.shortAnswer.cachedInputTokens).toBe(1_500_000);
    // 500k fresh input at 3 per million, plus 100 output at 15 per million.
    expect(report.listPriceSaved).toBeCloseTo(1.5 + 0.0015, 6);
  });

  it("has no text field in the result", () => {
    const report = buildTokenReport([{ inputTokens: 1, outputTokens: 1, toolCalls: 0 }], 7, null);
    expect(JSON.stringify(Object.keys(report)).includes("text")).toBe(false);
  });
});
