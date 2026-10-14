/**
 * What the benchmark explorer adds on top of public scores: the user's own
 * results, what they can run right now, a personal blind-test rating, new
 * models worth a look, and effort curves. Pure functions over plain data.
 */
import type { ModelBenchmarkEntry, ModelRunStat } from "@t3tools/contracts";
import {
  indexBenchmarkEntries,
  matchBenchmarks,
  splitEffort,
} from "@t3tools/shared/modelBenchmarkMatch";
import * as Schema from "effect/Schema";

import { effortRank, type ExplorerPoint } from "./benchmarkExplorer";
import { quotaRank, type BenchmarkCandidate } from "./modelBenchmarks";

// ---------------------------------------------------------------------------
// 1. The user's own chats
// ---------------------------------------------------------------------------

export interface EntryRunStat {
  readonly runs: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly retried: number;
  /** Completed share of runs that ended on their own (user cancels excluded). */
  readonly successRate: number | null;
  /** Run-weighted median wall time across the merged model ids, in seconds. */
  readonly medianSeconds: number | null;
}

/** The user's run stats folded onto the catalog entries they describe. */
export function runStatsByEntry(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
  stats: ReadonlyArray<ModelRunStat>,
): ReadonlyMap<string, EntryRunStat> {
  const index = indexBenchmarkEntries(entries);
  const merged = new Map<
    string,
    {
      runs: number;
      completed: number;
      failed: number;
      cancelled: number;
      retried: number;
      timed: number;
      timeSum: number;
    }
  >();
  for (const stat of stats) {
    const entry = matchBenchmarks(
      { modelId: stat.model, ...(stat.effort ? { effort: stat.effort } : {}) },
      index,
    )[0]?.entry;
    if (!entry) continue;
    const slot = merged.get(entry.sourceModelKey) ?? {
      runs: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      retried: 0,
      timed: 0,
      timeSum: 0,
    };
    slot.runs += stat.runs;
    slot.completed += stat.completed;
    slot.failed += stat.failed;
    slot.cancelled += stat.cancelled;
    slot.retried += stat.retried;
    if (stat.medianSeconds !== undefined) {
      slot.timed += stat.completed;
      slot.timeSum += stat.medianSeconds * stat.completed;
    }
    merged.set(entry.sourceModelKey, slot);
  }
  return new Map(
    [...merged].map(([key, slot]) => {
      const ended = slot.completed + slot.failed;
      return [
        key,
        {
          runs: slot.runs,
          completed: slot.completed,
          failed: slot.failed,
          cancelled: slot.cancelled,
          retried: slot.retried,
          successRate: ended === 0 ? null : slot.completed / ended,
          medianSeconds: slot.timed === 0 ? null : slot.timeSum / slot.timed,
        },
      ];
    }),
  );
}

// ---------------------------------------------------------------------------
// 2. What you can run right now
// ---------------------------------------------------------------------------

/**
 * The strongest model on `metricKey` the user can start now: available,
 * with quota left (or metered). Ties go to the one with more quota.
 */
export function bestRunnableNow(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
  connected: ReadonlyMap<string, BenchmarkCandidate>,
  metricKey: string,
): { readonly entry: ModelBenchmarkEntry; readonly candidate: BenchmarkCandidate } | null {
  let best: { entry: ModelBenchmarkEntry; candidate: BenchmarkCandidate; score: number } | null =
    null;
  for (const entry of entries) {
    const candidate = connected.get(entry.sourceModelKey);
    const score = entry.values[metricKey];
    if (!candidate || score === undefined || quotaRank(candidate.quota) < 0) continue;
    if (
      best === null ||
      score > best.score ||
      (score === best.score && quotaRank(candidate.quota) > quotaRank(best.candidate.quota))
    ) {
      best = { entry, candidate, score };
    }
  }
  return best ? { entry: best.entry, candidate: best.candidate } : null;
}

// ---------------------------------------------------------------------------
// 4. Blind tests and a personal rating
// ---------------------------------------------------------------------------

const ArenaContestant = Schema.Struct({
  label: Schema.String,
  entryKey: Schema.String,
  name: Schema.String,
  threadId: Schema.String,
});

const ArenaMatch = Schema.Struct({
  id: Schema.String,
  prompt: Schema.String,
  createdAt: Schema.String,
  contestants: Schema.Array(ArenaContestant),
  /** A contestant's label, "tie", or absent until the user votes. */
  winner: Schema.optional(Schema.String),
});
export type ArenaMatch = typeof ArenaMatch.Type;

export const ArenaState = Schema.Struct({
  ratings: Schema.Record(
    Schema.String,
    Schema.Struct({ elo: Schema.Number, games: Schema.Number }),
  ),
  matches: Schema.Array(ArenaMatch),
});
export type ArenaState = typeof ArenaState.Type;

export const ARENA_STORAGE_KEY = "leonidas:benchmark-arena:v1";
export const EMPTY_ARENA: ArenaState = { ratings: {}, matches: [] };
const START_ELO = 1000;
/** Large K: a personal rating sees few games, so each vote should move it visibly. */
const K = 32;
const MAX_MATCHES = 50;

export const contestantLabel = (index: number) => String.fromCharCode(65 + index);

/**
 * Records a vote and updates every pair in the match: the winner beats each
 * other contestant; a tie draws every pair. Votes are counted once.
 */
export function recordArenaVote(state: ArenaState, matchId: string, winner: string): ArenaState {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.winner !== undefined) return state;
  const ratings = { ...state.ratings };
  const rating = (key: string) => ratings[key] ?? { elo: START_ELO, games: 0 };
  const { contestants } = match;
  for (let i = 0; i < contestants.length; i++) {
    for (let j = i + 1; j < contestants.length; j++) {
      const a = contestants[i]!;
      const b = contestants[j]!;
      const scoreA =
        winner === "tie" ? 0.5 : winner === a.label ? 1 : winner === b.label ? 0 : null;
      if (scoreA === null) continue;
      const ra = rating(a.entryKey);
      const rb = rating(b.entryKey);
      const expectedA = 1 / (1 + 10 ** ((rb.elo - ra.elo) / 400));
      const delta = K * (scoreA - expectedA);
      ratings[a.entryKey] = { elo: ra.elo + delta, games: ra.games + 1 };
      ratings[b.entryKey] = { elo: rb.elo - delta, games: rb.games + 1 };
    }
  }
  return {
    ratings,
    matches: state.matches.map((item) => (item.id === matchId ? { ...item, winner } : item)),
  };
}

export function addArenaMatch(state: ArenaState, match: ArenaMatch): ArenaState {
  return { ...state, matches: [match, ...state.matches].slice(0, MAX_MATCHES) };
}

// ---------------------------------------------------------------------------
// 5. New challengers and effort curves
// ---------------------------------------------------------------------------

export const CatalogSeen = Schema.Struct({
  keys: Schema.Array(Schema.String),
  takenAt: Schema.String,
});
export type CatalogSeen = typeof CatalogSeen.Type;
export const CATALOG_SEEN_STORAGE_KEY = "leonidas:benchmark-catalog-seen:v1";

/**
 * Models that appeared since the user last looked and beat the best model
 * they can run on `metricKey`. Nothing on the first visit: everything is new.
 */
export function newChallengers(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
  seen: CatalogSeen | null,
  metricKey: string,
  bestAvailableScore: number | null,
): ReadonlyArray<ModelBenchmarkEntry> {
  if (!seen) return [];
  const known = new Set(seen.keys);
  return entries
    .filter((entry) => {
      const score = entry.values[metricKey];
      return (
        !known.has(entry.sourceModelKey) &&
        score !== undefined &&
        (bestAvailableScore === null || score > bestAvailableScore)
      );
    })
    .toSorted((a, b) => (b.values[metricKey] ?? 0) - (a.values[metricKey] ?? 0));
}

/**
 * Points of one model at several efforts, lightest first, so the chart can
 * draw how much score each step of effort buys and what it costs.
 */
export function effortCurves(
  points: ReadonlyArray<ExplorerPoint>,
): ReadonlyArray<ReadonlyArray<ExplorerPoint>> {
  const byBase = new Map<string, ExplorerPoint[]>();
  for (const point of points) {
    const base = splitEffort(point.entry.name).base.trim().toLowerCase();
    byBase.set(base, [...(byBase.get(base) ?? []), point]);
  }
  return [...byBase.values()]
    .filter((group) => group.length > 1 && group.some((point) => point.entry.effort !== undefined))
    .map((group) => group.toSorted((a, b) => effortRank(a.entry) - effortRank(b.entry)));
}
