/**
 * Where one turn's tokens went, from the provider-reported usage a turn already
 * carries. `inputTokens` is everything sent (cache reads and writes included). Providers
 * count reasoning inside `outputTokens`, so thinking is a slice of output.
 * Fixed overhead (instructions, skills, tool schemas) is not reported by any
 * provider; callers pass an estimate, and the split is `null` without one.
 */
export interface TurnLedgerInput {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  /** Tokens written to the prompt cache; counted inside `inputTokens`. */
  readonly cacheCreationTokens?: number;
  readonly outputTokens: number;
  readonly reasoningOutputTokens?: number;
  readonly fixedOverheadTokens?: number;
}

export interface TurnLedger {
  readonly freshInputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly thinkingTokens: number;
  readonly answerTokens: number;
  readonly totalTokens: number;
  /** Share of input served from cache, `null` when nothing was sent. */
  readonly cacheHitRate: number | null;
  /** Estimated; part of `inputTokens` the agent was already carrying. */
  readonly fixedOverheadTokens: number | null;
  /** Estimated; input beyond the fixed overhead (history and tool results). */
  readonly conversationTokens: number | null;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export function buildTurnLedger(input: TurnLedgerInput): TurnLedger {
  const inputTokens = Math.max(input.inputTokens, 0);
  const outputTokens = Math.max(input.outputTokens, 0);
  const cacheReadTokens = clamp(input.cachedInputTokens, inputTokens);
  const cacheWriteTokens = clamp(input.cacheCreationTokens ?? 0, inputTokens - cacheReadTokens);
  const thinkingTokens = clamp(input.reasoningOutputTokens ?? 0, outputTokens);
  const fixedOverheadTokens =
    input.fixedOverheadTokens === undefined ? null : clamp(input.fixedOverheadTokens, inputTokens);
  return {
    freshInputTokens: inputTokens - cacheReadTokens - cacheWriteTokens,
    cacheReadTokens,
    cacheWriteTokens,
    thinkingTokens,
    answerTokens: outputTokens - thinkingTokens,
    totalTokens: inputTokens + outputTokens,
    cacheHitRate: rate(cacheReadTokens, inputTokens),
    fixedOverheadTokens,
    conversationTokens: fixedOverheadTokens === null ? null : inputTokens - fixedOverheadTokens,
  };
}

/** Adds turns together; the hit rate is weighted by tokens, not by turn count. */
export function sumTurnLedgers(ledgers: ReadonlyArray<TurnLedger>): TurnLedger {
  let fresh = 0;
  let cached = 0;
  let written = 0;
  let thinking = 0;
  let answer = 0;
  let overhead = 0;
  let conversation = 0;
  let hasSplit = ledgers.length > 0;
  for (const ledger of ledgers) {
    fresh += ledger.freshInputTokens;
    cached += ledger.cacheReadTokens;
    written += ledger.cacheWriteTokens;
    thinking += ledger.thinkingTokens;
    answer += ledger.answerTokens;
    if (ledger.fixedOverheadTokens === null || ledger.conversationTokens === null) {
      hasSplit = false;
    } else {
      overhead += ledger.fixedOverheadTokens;
      conversation += ledger.conversationTokens;
    }
  }
  const input = fresh + cached + written;
  return {
    freshInputTokens: fresh,
    cacheReadTokens: cached,
    cacheWriteTokens: written,
    thinkingTokens: thinking,
    answerTokens: answer,
    totalTokens: input + thinking + answer,
    cacheHitRate: rate(cached, input),
    fixedOverheadTokens: hasSplit ? overhead : null,
    conversationTokens: hasSplit ? conversation : null,
  };
}

const CACHE_BREAK_MIN_INPUT_TOKENS = 5_000;
const CACHE_BREAK_PREVIOUS_RATE = 0.5;
const CACHE_BREAK_DROP = 0.4;

export interface CacheBreak {
  readonly previousRate: number;
  readonly currentRate: number;
  /** Tokens written to the cache again this turn. */
  readonly rewrittenTokens: number;
}

/**
 * Spots a prompt prefix that changed: the previous turn was well cached, this one is not, and the
 * prompt is large enough to cost real money. Quiet on a first turn or a small prompt.
 */
export function detectCacheBreak(
  current: TurnLedger,
  previous: TurnLedger | null,
): CacheBreak | null {
  if (previous === null || current.cacheHitRate === null || previous.cacheHitRate === null) {
    return null;
  }
  const input = current.cacheReadTokens + current.cacheWriteTokens + current.freshInputTokens;
  if (input < CACHE_BREAK_MIN_INPUT_TOKENS) return null;
  if (previous.cacheHitRate < CACHE_BREAK_PREVIOUS_RATE) return null;
  if (previous.cacheHitRate - current.cacheHitRate < CACHE_BREAK_DROP) return null;
  return {
    previousRate: previous.cacheHitRate,
    currentRate: current.cacheHitRate,
    rewrittenTokens: current.cacheWriteTokens,
  };
}
