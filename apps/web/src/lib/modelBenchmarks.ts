import type {
  ModelBenchmarkMetric,
  ModelBenchmarkQuery,
  ModelBenchmarkReport,
  ModelSelection,
} from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";

import { EFFORT_OPTION_IDS } from "../components/chat/runIdentity.logic";
import { isProviderInstancePickerReady, type ProviderInstanceEntry } from "../providerInstances";

/** One model and effort the user can start a chat with right now. */
export interface BenchmarkCandidate {
  readonly key: string;
  readonly providerName: string;
  readonly modelName: string;
  readonly effortLabel: string | null;
  readonly query: ModelBenchmarkQuery;
  readonly selection: ModelSelection;
}

const queryKey = (query: Pick<ModelBenchmarkQuery, "modelId" | "effort">) =>
  `${query.modelId}\u0000${query.effort ?? ""}`;

/**
 * Every ready provider's current models, one candidate per effort level the
 * model's picker offers. Several instances of one driver (four Claude accounts)
 * list a model once; `preferInstanceId`'s instance wins so starting a chat from
 * a row keeps the current account.
 */
export function connectedBenchmarkCandidates(
  entries: ReadonlyArray<ProviderInstanceEntry>,
  preferInstanceId: string | null = null,
): ReadonlyArray<BenchmarkCandidate> {
  const candidates: BenchmarkCandidate[] = [];
  const queries = new Set<string>();
  const ordered = preferInstanceId
    ? entries.toSorted(
        (a, b) =>
          Number(b.instanceId === preferInstanceId) - Number(a.instanceId === preferInstanceId),
      )
    : entries;
  for (const entry of ordered) {
    if (!isProviderInstancePickerReady(entry)) continue;
    for (const model of entry.models) {
      if (model.isLegacy) continue;
      const descriptor = model.capabilities?.optionDescriptors?.find(
        (candidate) =>
          candidate.type === "select" &&
          (EFFORT_OPTION_IDS as ReadonlyArray<string>).includes(candidate.id),
      );
      const efforts =
        descriptor?.type === "select" && descriptor.options.length > 0
          ? descriptor.options.map((option) => ({ descriptorId: descriptor.id, option }))
          : [null];
      for (const effort of efforts) {
        const query: ModelBenchmarkQuery = {
          modelId: model.slug,
          displayName: model.name,
          ...(effort ? { effort: effort.option.id } : {}),
        };
        const key = queryKey(query);
        if (queries.has(key)) continue;
        queries.add(key);
        candidates.push({
          key: `${entry.instanceId}\u0000${key}`,
          providerName: entry.displayName,
          modelName: model.name,
          effortLabel: effort?.option.label ?? null,
          query,
          selection: createModelSelection(
            entry.instanceId,
            model.slug,
            effort ? [{ id: effort.descriptorId, value: effort.option.id }] : null,
          ),
        });
      }
    }
  }
  return candidates;
}

/** Unique queries for the RPC, in first-seen order. */
export function benchmarkQueries(
  candidates: ReadonlyArray<BenchmarkCandidate>,
): ReadonlyArray<ModelBenchmarkQuery> {
  const byKey = new Map<string, ModelBenchmarkQuery>();
  for (const candidate of candidates) byKey.set(queryKey(candidate.query), candidate.query);
  return [...byKey.values()];
}

/** Quartile of a measured row among the measured rows, best first. */
export type BenchmarkTier = "top" | "upper" | "lower" | "bottom";

export interface RankedBenchmarkRow {
  readonly candidate: BenchmarkCandidate;
  /** Null when the source has no number for this model and metric. */
  readonly value: number | null;
  /** False when the value is the model's default run, not this effort. */
  readonly effortMeasured: boolean;
  readonly tier: BenchmarkTier | null;
  /** Bar length, 0 to 1, relative to the largest value shown. */
  readonly fraction: number;
}

/**
 * Candidates ordered best first for one metric. Rows without a value keep
 * their catalog order at the bottom; nothing is interpolated.
 */
export function rankBenchmarkCandidates(
  candidates: ReadonlyArray<BenchmarkCandidate>,
  report: ModelBenchmarkReport,
  metric: ModelBenchmarkMetric,
): ReadonlyArray<RankedBenchmarkRow> {
  const rowsByQuery = new Map(report.rows.map((row) => [queryKey(row.query), row]));
  const measured: Array<Omit<RankedBenchmarkRow, "tier" | "fraction"> & { value: number }> = [];
  const missing: RankedBenchmarkRow[] = [];
  for (const candidate of candidates) {
    const match = rowsByQuery
      .get(queryKey(candidate.query))
      ?.matches.find((entry) => entry.entry.source === metric.source);
    const value = match?.entry.values[metric.key];
    if (match && value !== undefined && Number.isFinite(value)) {
      measured.push({ candidate, value, effortMeasured: match.effortMeasured });
    } else {
      missing.push({ candidate, value: null, effortMeasured: false, tier: null, fraction: 0 });
    }
  }
  measured.sort((a, b) => (metric.higherIsBetter ? b.value - a.value : a.value - b.value));
  const max = Math.max(0, ...measured.map((row) => row.value));
  const last = measured.length - 1;
  return [
    ...measured.map((row, index) => {
      const percentile = last === 0 ? 1 : 1 - index / last;
      const tier: BenchmarkTier =
        percentile >= 0.75
          ? "top"
          : percentile >= 0.5
            ? "upper"
            : percentile >= 0.25
              ? "lower"
              : "bottom";
      return { ...row, tier, fraction: max > 0 ? Math.max(0, row.value) / max : 0 };
    }),
    ...missing,
  ];
}

export type BenchmarkMetricGroup = "score" | "price" | "speed";

export const benchmarkMetricGroup = (metric: ModelBenchmarkMetric): BenchmarkMetricGroup =>
  metric.kind === "latency" ? "speed" : metric.kind;

const UNIT_SUFFIX: Readonly<Record<string, string>> = {
  tokens_per_second: " tok/s",
  seconds: " s",
};

export function formatBenchmarkValue(value: number, metric: ModelBenchmarkMetric): string {
  if (metric.kind === "price") return `$${value < 10 ? value.toFixed(2) : value.toFixed(0)}/M`;
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded}${UNIT_SUFFIX[metric.unit] ?? ""}`;
}
