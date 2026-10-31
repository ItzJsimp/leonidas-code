/** "about 12,400 tokens": the card's start cost is an estimate, so round to the hundred. */
export function formatStartCost(tokens: number): string {
  const rounded = Math.max(100, Math.round(tokens / 100) * 100);
  return `about ${rounded.toLocaleString("en-US")} tokens`;
}

/** Readable model name from a catalog id, for example "claude-opus-5-5" to "Claude Opus 5.5". */
export function modelDisplayName(model: string): string {
  const claude = /^claude-([a-z]+)-(\d+)(?:-(\d+))?$/.exec(model);
  if (claude !== null) {
    const family = claude[1]!;
    const version = claude[3] === undefined ? claude[2]! : `${claude[2]}.${claude[3]}`;
    return `Claude ${family[0]!.toUpperCase()}${family.slice(1)} ${version}`;
  }
  return model;
}

/** "full-access" to "Full access", "high" to "High": card values read as words. */
export function formatLabel(value: string): string {
  const words = value.replace(/[-_]+/g, " ").trim();
  return words.length === 0 ? value : `${words[0]!.toUpperCase()}${words.slice(1)}`;
}
