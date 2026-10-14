/**
 * Pairs a provider's model id with a benchmark source's record. Shared so the
 * server's report and the web explorer match the same way: the explorer
 * matches against the full catalog locally, with no per-request model cap.
 */
import type {
  ModelBenchmarkEntry,
  ModelBenchmarkMatch,
  ModelBenchmarkQuery,
  ModelBenchmarkSourceId,
} from "@t3tools/contracts";

const EFFORTS = "minimal|low|medium|high|xhigh|max";
const EFFORT_SUFFIX = new RegExp(`\\s*\\((${EFFORTS})(?: effort)?\\)\\s*$`, "i");
/** "gemini-3.8-flash-high", "o3-mini-high": effort baked into the provider's slug. */
const SLUG_EFFORT = new RegExp(`-(${EFFORTS})$`);

/** "GPT-6 Luna (medium)" -> { base: "GPT-6 Luna", effort: "medium" }. */
export function splitEffort(name: string): { readonly base: string; readonly effort?: string } {
  const match = EFFORT_SUFFIX.exec(name);
  if (!match?.[1]) return { base: name };
  return { base: name.slice(0, match.index), effort: match[1].toLowerCase() };
}

/**
 * "anthropic/Claude Opus 5.5[1m]" -> "claude-opus-5-5". Drops router paths,
 * "Vendor: " label prefixes, ":free"/":batch" routing tags and bracketed or
 * parenthesised notes, none of which name a different model.
 */
export function canonicalModelKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^.*\//, "")
    .replace(/^[^:]*:\s+/, "")
    .replace(/:[a-z0-9-]+$/, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\((?:free|batch|beta|experimental|openrouter)[^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Release dates, moving tags and packaging suffixes that a source's key never carries. */
const VERSION_TAIL = /-(?:latest|preview|exp|it|instruct|\d{4}-?\d{2}-?\d{2}|\d{8}|\d{4})$/;

/**
 * Provider model ids whose canonical form differs from every source's key.
 * Add an entry only after a real mismatch; the canonical form covers the rest.
 */
const MODEL_ALIASES: Readonly<Record<string, string>> = {};

/**
 * Candidate keys, most specific first. A key reached by reading an effort out
 * of the name carries that effort; a query's explicit effort always wins.
 */
export function queryKeys(
  query: ModelBenchmarkQuery,
): ReadonlyArray<{ readonly key: string; readonly effort?: string }> {
  const keys: Array<{ key: string; effort?: string }> = [];
  const add = (key: string, effort: string | undefined) => {
    if (key.length > 0 && !keys.some((item) => item.key === key))
      keys.push(effort ? { key, effort } : { key });
  };
  for (const name of [query.modelId, query.displayName]) {
    if (!name) continue;
    const { base, effort } = splitEffort(name);
    const key = canonicalModelKey(base);
    add(MODEL_ALIASES[key] ?? key, effort);
    let trimmed = key;
    for (let pass = 0; pass < 2 && VERSION_TAIL.test(trimmed); pass++) {
      trimmed = trimmed.replace(VERSION_TAIL, "");
      add(trimmed, effort);
    }
  }
  // Last resort, so a real model named "...-max" still matches itself first.
  for (const item of keys.slice()) {
    const effort = SLUG_EFFORT.exec(item.key)?.[1];
    if (effort) add(item.key.slice(0, -effort.length - 1), item.effort ?? effort);
  }
  return keys;
}

export const entryMatchKey = (entry: ModelBenchmarkEntry) =>
  canonicalModelKey(splitEffort(entry.name).base) || canonicalModelKey(entry.sourceModelKey);

/** Entries grouped by match key, built once per catalog for repeated matching. */
export function indexBenchmarkEntries(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
): ReadonlyMap<string, ReadonlyArray<ModelBenchmarkEntry>> {
  const index = new Map<string, ModelBenchmarkEntry[]>();
  for (const entry of entries) {
    const key = entryMatchKey(entry);
    const list = index.get(key);
    if (list) list.push(entry);
    else index.set(key, [entry]);
  }
  return index;
}

/**
 * The best entry per source for one model: the exact effort when the source
 * measured it, otherwise the model's default run, flagged as not measured.
 */
export function matchBenchmarks(
  query: ModelBenchmarkQuery,
  entries:
    | ReadonlyArray<ModelBenchmarkEntry>
    | ReadonlyMap<string, ReadonlyArray<ModelBenchmarkEntry>>,
): ReadonlyArray<ModelBenchmarkMatch> {
  const keys = queryKeys(query);
  const index = "get" in entries ? entries : indexBenchmarkEntries(entries);
  const bySource = new Map<ModelBenchmarkSourceId, ModelBenchmarkMatch & { rank: number }>();
  keys.forEach(({ key, effort: nameEffort }, keyRank) => {
    const effort = (query.effort ?? nameEffort)?.toLowerCase();
    for (const entry of index.get(key) ?? []) {
      const effortMeasured = effort !== undefined && entry.effort === effort;
      // An entry for a different effort says nothing about the one asked for.
      if (entry.effort !== undefined && !effortMeasured) continue;
      const rank = keyRank * 2 + (effortMeasured || effort === undefined ? 0 : 1);
      const current = bySource.get(entry.source);
      if (current === undefined || rank < current.rank) {
        bySource.set(entry.source, {
          entry,
          effortMeasured: effort === undefined || effortMeasured,
          rank,
        });
      }
    }
  });
  return [...bySource.values()].map(({ entry, effortMeasured }) => ({ entry, effortMeasured }));
}
