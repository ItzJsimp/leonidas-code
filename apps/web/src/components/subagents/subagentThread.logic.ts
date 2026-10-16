import type { SubagentCatalogEntry } from "@t3tools/contracts";

export interface ComposerSubagentOption {
  readonly name: string;
  readonly description: string | null;
}

/** Subagents a chat can use: on and valid, one per name, sorted by name. */
export function composerSubagentOptions(
  entries: ReadonlyArray<SubagentCatalogEntry>,
): ReadonlyArray<ComposerSubagentOption> {
  const byName = new Map<string, ComposerSubagentOption>();
  for (const entry of entries) {
    if (!entry.enabled || entry.legacy || entry.error !== null || byName.has(entry.name)) continue;
    byName.set(entry.name, { name: entry.name, description: entry.description });
  }
  return [...byName.values()].toSorted((left, right) => left.name.localeCompare(right.name));
}

/** Options whose name or description holds the query; an empty query keeps all. */
export function searchSubagentOptions(
  options: ReadonlyArray<ComposerSubagentOption>,
  query: string,
): ReadonlyArray<ComposerSubagentOption> {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return options;
  return options.filter(
    (option) =>
      option.name.includes(needle) || (option.description ?? "").toLowerCase().includes(needle),
  );
}

/**
 * The text to send for a thread with `attached`. A message that already names
 * a subagent keeps its own routing; any other message leads with `@attached`,
 * so the attach holds for every turn, not only the next one.
 */
export function withAttachedSubagent(
  text: string,
  attached: string | null,
  knownNames: ReadonlySet<string>,
): string {
  if (attached === null || !knownNames.has(attached)) return text;
  // A blank message stays blank, and a leading /command must stay first for the provider.
  if (text.trim().length === 0 || text.trimStart().startsWith("/")) return text;
  for (const match of text.matchAll(/(^|\s)@([a-z0-9][a-z0-9-]{0,63})(?=\s|$|[.,;:!?])/g)) {
    if (knownNames.has(match[2] ?? "")) return text;
  }
  return `@${attached} ${text}`;
}
