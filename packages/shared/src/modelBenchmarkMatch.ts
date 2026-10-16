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

const EFFORTS = "minimal|low|medium|high|xhigh|ultra|max";
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
function queryKeys(
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

const entryMatchKey = (entry: ModelBenchmarkEntry) =>
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

/**
 * Every effort run a source measured for one model, plus its run with no effort
 * (an entry whose `effort` is absent). Keys are tried most specific first and
 * the first key that has any entry from `source` wins.
 */
export function benchmarkEffortEntries(
  query: ModelBenchmarkQuery,
  entries:
    | ReadonlyArray<ModelBenchmarkEntry>
    | ReadonlyMap<string, ReadonlyArray<ModelBenchmarkEntry>>,
  source: ModelBenchmarkSourceId,
): ReadonlyArray<ModelBenchmarkEntry> {
  const index = "get" in entries ? entries : indexBenchmarkEntries(entries);
  for (const { key } of queryKeys({ ...query, effort: undefined })) {
    const found = (index.get(key) ?? []).filter((entry) => entry.source === source);
    if (found.length > 0) return found;
  }
  return [];
}

/** 1..5 by quintile of `value` among `pool`; `invert` when lower is better. */
function quintile(value: number, pool: ReadonlyArray<number>, invert: boolean): number {
  if (pool.length === 0) return 3;
  const below = pool.filter((item) => (invert ? item > value : item < value)).length;
  return Math.min(5, 1 + Math.floor((below / pool.length) * 5));
}

const OVERALL = "benchLm:overall";
const SPEED = "benchLm:speed";
const OUTPUT_PRICE = "benchLm:price:output";

/**
 * Route profiles measured from benchmarks, one per slug the source knows:
 * quality from the overall score, speed from output speed and economy from
 * output price, each as a 1-5 quintile across every model the source rates.
 * An axis the source did not measure keeps `fallback`'s guess.
 */
export function benchmarkRouteProfiles<
  P extends { quality: number; speed: number; economy: number },
>(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
  slugs: ReadonlyArray<string>,
  fallback: (slug: string) => P,
): ReadonlyMap<string, P & { known: boolean }> {
  const pool = (key: string) =>
    entries.flatMap((entry) => {
      const value = entry.values[key];
      return value === undefined || (key === OUTPUT_PRICE && value <= 0) ? [] : [value];
    });
  const overall = pool(OVERALL);
  const speed = pool(SPEED);
  const price = pool(OUTPUT_PRICE);
  const index = indexBenchmarkEntries(entries);
  const profiles = new Map<string, P & { known: boolean }>();
  for (const slug of new Set(slugs)) {
    const entry = matchBenchmarks({ modelId: slug }, index)[0]?.entry;
    if (!entry) continue;
    const guess = fallback(slug);
    const score = entry.values[OVERALL];
    const tps = entry.values[SPEED];
    const cost = entry.values[OUTPUT_PRICE];
    profiles.set(slug, {
      ...guess,
      quality: score === undefined ? guess.quality : quintile(score, overall, false),
      speed: tps === undefined ? guess.speed : quintile(tps, speed, false),
      economy: cost === undefined ? guess.economy : cost <= 0 ? 5 : quintile(cost, price, true),
      known: true,
    });
  }
  return profiles;
}
