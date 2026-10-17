import { describe, expect, it } from "vite-plus/test";

import { buildTurnLedger, detectCacheBreak, sumTurnLedgers } from "./turnLedger.ts";

describe("buildTurnLedger", () => {
  it("splits input into cache reads and fresh tokens", () => {
    const ledger = buildTurnLedger({
      inputTokens: 10_000,
      cachedInputTokens: 8_000,
      outputTokens: 500,
      reasoningOutputTokens: 200,
    });
    expect(ledger).toMatchObject({
      cacheReadTokens: 8_000,
      freshInputTokens: 2_000,
      thinkingTokens: 200,
      answerTokens: 300,
      totalTokens: 10_500,
      cacheHitRate: 0.8,
    });
  });

  it("reports cache writes separately from fresh input", () => {
    const ledger = buildTurnLedger({
      inputTokens: 10_000,
      cachedInputTokens: 6_000,
      cacheCreationTokens: 3_000,
      outputTokens: 0,
    });
    expect(ledger).toMatchObject({
      cacheReadTokens: 6_000,
      cacheWriteTokens: 3_000,
      freshInputTokens: 1_000,
      cacheHitRate: 0.6,
    });
  });

  it("never lets reads plus writes exceed the input sent", () => {
    const ledger = buildTurnLedger({
      inputTokens: 1_000,
      cachedInputTokens: 800,
      cacheCreationTokens: 800,
      outputTokens: 0,
    });
    expect(ledger.cacheReadTokens).toBe(800);
    expect(ledger.cacheWriteTokens).toBe(200);
    expect(ledger.freshInputTokens).toBe(0);
  });

  it("treats reasoning as part of output and never goes negative", () => {
    const ledger = buildTurnLedger({
      inputTokens: 100,
      cachedInputTokens: 500,
      outputTokens: 10,
      reasoningOutputTokens: 40,
    });
    expect(ledger.cacheReadTokens).toBe(100);
    expect(ledger.freshInputTokens).toBe(0);
    expect(ledger.thinkingTokens).toBe(10);
    expect(ledger.answerTokens).toBe(0);
  });

  it("reports no hit rate for a turn without input", () => {
    expect(
      buildTurnLedger({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 5 }).cacheHitRate,
    ).toBeNull();
  });

  it("splits input into estimated fixed overhead and conversation", () => {
    const ledger = buildTurnLedger({
      inputTokens: 30_000,
      cachedInputTokens: 0,
      outputTokens: 0,
      fixedOverheadTokens: 29_000,
    });
    expect(ledger.fixedOverheadTokens).toBe(29_000);
    expect(ledger.conversationTokens).toBe(1_000);
  });

  it("caps the overhead estimate at the input actually sent", () => {
    const ledger = buildTurnLedger({
      inputTokens: 5_000,
      cachedInputTokens: 0,
      outputTokens: 0,
      fixedOverheadTokens: 29_000,
    });
    expect(ledger.fixedOverheadTokens).toBe(5_000);
    expect(ledger.conversationTokens).toBe(0);
  });

  it("leaves the overhead split unknown when no estimate is given", () => {
    const ledger = buildTurnLedger({ inputTokens: 100, cachedInputTokens: 0, outputTokens: 1 });
    expect(ledger.fixedOverheadTokens).toBeNull();
    expect(ledger.conversationTokens).toBeNull();
  });
});

describe("sumTurnLedgers", () => {
  it("weights the cache hit rate by tokens, not by turn", () => {
    const a = buildTurnLedger({ inputTokens: 1_000, cachedInputTokens: 1_000, outputTokens: 0 });
    const b = buildTurnLedger({ inputTokens: 9_000, cachedInputTokens: 0, outputTokens: 0 });
    const total = sumTurnLedgers([a, b]);
    expect(total.cacheHitRate).toBe(0.1);
    expect(total.cacheWriteTokens).toBe(0);
    expect(total.totalTokens).toBe(10_000);
  });

  it("is empty for no turns", () => {
    expect(sumTurnLedgers([])).toMatchObject({ totalTokens: 0, cacheHitRate: null });
  });
});

describe("detectCacheBreak", () => {
  const turn = (input: number, cached: number, written = 0) =>
    buildTurnLedger({
      inputTokens: input,
      cachedInputTokens: cached,
      cacheCreationTokens: written,
      outputTokens: 10,
    });

  it("flags a big drop in hit rate on a large prompt", () => {
    expect(detectCacheBreak(turn(40_000, 2_000, 30_000), turn(40_000, 36_000))).toEqual({
      previousRate: 0.9,
      currentRate: 0.05,
      rewrittenTokens: 30_000,
    });
  });

  it("stays quiet when the first turn simply has no cache yet", () => {
    expect(detectCacheBreak(turn(40_000, 0, 40_000), null)).toBeNull();
  });

  it("stays quiet when the previous turn was not cached well", () => {
    expect(detectCacheBreak(turn(40_000, 0), turn(40_000, 4_000))).toBeNull();
  });

  it("stays quiet for small prompts", () => {
    expect(detectCacheBreak(turn(2_000, 0), turn(2_000, 1_900))).toBeNull();
  });

  it("stays quiet when the hit rate holds", () => {
    expect(detectCacheBreak(turn(50_000, 40_000), turn(40_000, 36_000))).toBeNull();
  });
});
