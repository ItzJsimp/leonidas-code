/**
 * Pure readers for the public benchmark feeds, and the matcher that pairs a
 * provider's model id with a source's record. Feeds are read leniently: a
 * field a source drops or renames becomes a missing value, never a failure.
 */
import type {
  ModelBenchmarkEntry,
  ModelBenchmarkMatch,
  ModelBenchmarkMetric,
  ModelBenchmarkQuery,
  ModelBenchmarkSourceId,
} from "@t3tools/contracts";

export interface ParsedBenchmarkSource {
  readonly metrics: ReadonlyArray<ModelBenchmarkMetric>;
  readonly entries: ReadonlyArray<ModelBenchmarkEntry>;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const recordAt = (value: unknown, key: string): UnknownRecord | undefined => {
  const child = isRecord(value) ? value[key] : undefined;
  return isRecord(child) ? child : undefined;
};
const itemsOf = (value: unknown, key: string): ReadonlyArray<UnknownRecord> => {
  const items = isRecord(value) ? value[key] : undefined;
  return Array.isArray(items) ? items.filter(isRecord) : [];
};
const numberAt = (value: unknown, key: string): number | undefined => {
  const field = isRecord(value) ? value[key] : undefined;
  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
};
const stringAt = (value: unknown, key: string): string | undefined => {
  const field = isRecord(value) ? value[key] : undefined;
  return typeof field === "string" && field.trim().length > 0 ? field.trim() : undefined;
};

const EFFORT_SUFFIX = /\s*\((minimal|low|medium|high|xhigh|max)(?: effort)?\)\s*$/i;

/** "GPT-6 Luna (medium)" -> { base: "GPT-6 Luna", effort: "medium" }. */
export function splitEffort(name: string): { readonly base: string; readonly effort?: string } {
  const match = EFFORT_SUFFIX.exec(name);
  if (!match?.[1]) return { base: name };
  return { base: name.slice(0, match.index), effort: match[1].toLowerCase() };
}

/** "anthropic/Claude Opus 5.5[1m]" -> "claude-opus-5-5". */
export function canonicalModelKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^[a-z0-9-]+\//, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Release dates and moving tags that a source's key never carries. */
const VERSION_TAIL = /-(?:latest|preview|\d{4}-?\d{2}-?\d{2}|\d{8})$/;

/**
 * Provider model ids whose canonical form differs from every source's key.
 * Add an entry only after a real mismatch; the canonical form covers the rest.
 */
const MODEL_ALIASES: Readonly<Record<string, string>> = {};

function queryKeys(query: ModelBenchmarkQuery): ReadonlyArray<string> {
  const keys: string[] = [];
  const add = (key: string) => {
    if (key.length > 0 && !keys.includes(key)) keys.push(key);
  };
  for (const name of [query.modelId, query.displayName]) {
    if (!name) continue;
    const key = canonicalModelKey(name);
    add(MODEL_ALIASES[key] ?? key);
    add(key.replace(VERSION_TAIL, ""));
  }
  return keys;
}

const entryKey = (entry: ModelBenchmarkEntry) =>
  canonicalModelKey(splitEffort(entry.name).base) || canonicalModelKey(entry.sourceModelKey);

/**
 * The best entry per source for one model: the exact effort when the source
 * measured it, otherwise the model's default run, flagged as not measured.
 */
export function matchBenchmarks(
  query: ModelBenchmarkQuery,
  entries: ReadonlyArray<ModelBenchmarkEntry>,
): ReadonlyArray<ModelBenchmarkMatch> {
  const keys = queryKeys(query);
  const effort = query.effort?.toLowerCase();
  const bySource = new Map<ModelBenchmarkSourceId, ModelBenchmarkMatch & { rank: number }>();
  for (const entry of entries) {
    const keyRank = keys.indexOf(entryKey(entry));
    if (keyRank < 0) continue;
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
  return [...bySource.values()].map(({ entry, effortMeasured }) => ({ entry, effortMeasured }));
}

const BENCHLM_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  agentic: "Agentic",
  coding: "Coding",
  reasoning: "Reasoning",
  multimodalGrounded: "Multimodal",
  knowledge: "Knowledge",
  multilingual: "Multilingual",
  instructionFollowing: "Instruction following",
  math: "Math",
};

export interface BenchLmFeeds {
  readonly models: unknown;
  readonly pricing: unknown;
  readonly speed: unknown;
  readonly benchmarks: unknown;
}

/**
 * Reads BenchLM's static files: the published overall score, category scores
 * and every individual benchmark it carries (which include Arena, Vals and
 * LiveBench results), joined with its price and speed tables by model key.
 */
export function parseBenchLm(feeds: BenchLmFeeds): ParsedBenchmarkSource {
  const source = "benchLm" as const;
  const metrics = new Map<string, ModelBenchmarkMetric>();
  const addMetric = (metric: Omit<ModelBenchmarkMetric, "source">) => {
    if (!metrics.has(metric.key)) metrics.set(metric.key, { ...metric, source });
  };

  const benchmarkInfo = new Map<string, { label: string; category: string | undefined }>();
  for (const item of itemsOf(feeds.benchmarks, "items")) {
    const key = stringAt(item, "benchmarkKey");
    const label = stringAt(item, "name");
    if (key && label) benchmarkInfo.set(key, { label, category: stringAt(item, "category") });
  }

  const pricing = new Map(
    itemsOf(feeds.pricing, "items").flatMap((item) => {
      const key = stringAt(item, "canonicalModelKey");
      return key ? [[key, item] as const] : [];
    }),
  );
  const speed = new Map(
    itemsOf(feeds.speed, "items").flatMap((item) => {
      const key = stringAt(item, "canonicalModelKey");
      return key ? [[key, item] as const] : [];
    }),
  );

  const entries: ModelBenchmarkEntry[] = [];
  for (const model of itemsOf(feeds.models, "items")) {
    const key = stringAt(model, "canonicalModelKey") ?? stringAt(model, "slug");
    const name = stringAt(model, "model");
    if (!key || !name) continue;
    const values: Record<string, number> = {};

    const overall = numberAt(model, "displayScore");
    if (overall !== undefined) {
      values["benchLm:overall"] = overall;
      addMetric({
        key: "benchLm:overall",
        label: "BenchLM overall",
        kind: "score",
        unit: "score",
        higherIsBetter: true,
      });
    }
    const categories = recordAt(recordAt(model, "scores"), "displayCategoryScores") ?? {};
    for (const category of Object.keys(categories)) {
      const value = numberAt(categories, category);
      if (value === undefined) continue;
      const metricKey = `benchLm:category:${category}`;
      values[metricKey] = value;
      addMetric({
        key: metricKey,
        label: BENCHLM_CATEGORY_LABELS[category] ?? category,
        kind: "score",
        unit: "score",
        higherIsBetter: true,
        category,
      });
    }
    const benchmarks = recordAt(model, "benchmarks") ?? {};
    for (const category of Object.keys(benchmarks)) {
      const group = recordAt(benchmarks, category) ?? {};
      for (const benchmarkKey of Object.keys(group)) {
        const value = numberAt(group, benchmarkKey);
        // Only benchmarks BenchLM describes: undescribed keys are helper fields.
        const info = benchmarkInfo.get(benchmarkKey);
        if (value === undefined || !info) continue;
        const metricKey = `benchLm:benchmark:${benchmarkKey}`;
        values[metricKey] = value;
        addMetric({
          key: metricKey,
          label: info.label,
          kind: "score",
          unit: "score",
          higherIsBetter: true,
          category: info.category ?? category,
        });
      }
    }

    const price = pricing.get(key);
    const inputPrice = numberAt(price, "inputPrice");
    const outputPrice = numberAt(price, "outputPrice");
    if (inputPrice !== undefined) {
      values["benchLm:price:input"] = inputPrice;
      addMetric({
        key: "benchLm:price:input",
        label: "Input price",
        kind: "price",
        unit: "usd_per_mtok",
        higherIsBetter: false,
      });
    }
    if (outputPrice !== undefined) {
      values["benchLm:price:output"] = outputPrice;
      addMetric({
        key: "benchLm:price:output",
        label: "Output price",
        kind: "price",
        unit: "usd_per_mtok",
        higherIsBetter: false,
      });
    }
    const run = speed.get(key);
    const tokensPerSecond = numberAt(run, "tokensPerSecond");
    const ttft = numberAt(run, "ttft");
    if (tokensPerSecond !== undefined) {
      values["benchLm:speed"] = tokensPerSecond;
      addMetric({
        key: "benchLm:speed",
        label: "Output speed",
        kind: "speed",
        unit: "tokens_per_second",
        higherIsBetter: true,
      });
    }
    if (ttft !== undefined) {
      values["benchLm:ttft"] = ttft;
      addMetric({
        key: "benchLm:ttft",
        label: "Time to first token",
        kind: "latency",
        unit: "seconds",
        higherIsBetter: false,
      });
    }

    // BenchLM lists some effort variants with no numbers yet; they would hide the measured default.
    if (Object.keys(values).length === 0) continue;
    const { effort } = splitEffort(name);
    entries.push({
      source,
      sourceModelKey: key,
      name,
      ...(stringAt(model, "creator") ? { creator: stringAt(model, "creator") } : {}),
      ...(effort ? { effort } : {}),
      values,
      ...(stringAt(model, "url") ? { url: stringAt(model, "url") } : {}),
    });
  }
  return { metrics: [...metrics.values()], entries };
}
