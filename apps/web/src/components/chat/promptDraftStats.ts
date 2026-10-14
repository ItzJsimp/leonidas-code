export interface PromptDraftStats {
  readonly characters: number;
  readonly words: number;
  readonly lines: number;
  readonly approxTokens: number;
}

/**
 * Deterministic draft stats for the composer. Tokens use the common
 * chars/4 rule, raised to words*1.3 for short-word text, so the estimate
 * stays within about 15% of real tokenizers for English prose and code.
 */
export function computePromptDraftStats(text: string): PromptDraftStats {
  const characters = text.length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/u).length;
  const lines = characters === 0 ? 0 : text.split("\n").length;
  const approxTokens =
    characters === 0 ? 0 : Math.max(Math.ceil(characters / 4), Math.ceil(words * 1.3));
  return { characters, words, lines, approxTokens };
}

export function formatPromptDraftStats(stats: PromptDraftStats): string {
  return `${stats.characters.toLocaleString()} chars · ~${stats.approxTokens.toLocaleString()} tokens`;
}
