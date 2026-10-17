/**
 * Token report: how many cloud tokens a local model could have taken. It reads counts only,
 * never message text. A turn the provider did not report adds no tokens and is never guessed.
 */
import type { LocalModelsTokenReport } from "@t3tools/contracts";

/** A turn with no tool calls and at most this many output tokens is a short answer. */
export const SHORT_ANSWER_MAX_OUTPUT_TOKENS = 300;

export interface TokenReportRow {
  readonly inputTokens: number | undefined;
  readonly outputTokens: number | undefined;
  /** Null when the number of tool calls is not known. */
  readonly toolCalls: number | null;
}

export interface ListPrice {
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

export function buildTokenReport(
  rows: ReadonlyArray<TokenReportRow>,
  days: 7 | 30,
  price: ListPrice | null,
): LocalModelsTokenReport {
  const shortAnswer = { turns: 0, inputTokens: 0, outputTokens: 0 };
  const keepCloud = { turns: 0, inputTokens: 0, outputTokens: 0 };
  let notReported = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const row of rows) {
    if (row.inputTokens === undefined && row.outputTokens === undefined) {
      notReported += 1;
      continue;
    }
    const input = row.inputTokens ?? 0;
    const output = row.outputTokens ?? 0;
    inputTokens += input;
    outputTokens += output;
    // An unknown tool count stays on the cloud: the report never guesses in its own favour.
    const local = row.toolCalls === 0 && output <= SHORT_ANSWER_MAX_OUTPUT_TOKENS;
    const target = local ? shortAnswer : keepCloud;
    target.turns += 1;
    target.inputTokens += input;
    target.outputTokens += output;
  }
  return {
    days,
    turns: rows.length,
    inputTokens,
    outputTokens,
    classes: { shortAnswer, keepCloud, notReported: { turns: notReported } },
    listPriceSaved:
      price === null
        ? null
        : (shortAnswer.inputTokens * price.inputPerMillion +
            shortAnswer.outputTokens * price.outputPerMillion) /
          1_000_000,
  };
}
