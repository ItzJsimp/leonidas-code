// @effect-diagnostics nodeBuiltinImport:off - one tiny synchronous stats write per spawn, same as subagentPersona.
/**
 * SpawnApprovals - confirm-tier subagent spawns that wait for the user
 * (ADR-0082). `delegate_task` parks here until the user answers the card;
 * the web streams the open list. State is in memory: a pending spawn dies
 * with the tool call that asked, and "Allow for this thread" lasts until the
 * server restarts.
 *
 * @module SpawnApprovals
 */
import {
  type SubagentActivityStats,
  SubagentSpawnApprovalError,
  type SubagentSpawnApproval,
  type SubagentSpawnApprovals,
  type SubagentSpawnDecision,
  type SubagentSpawnRespondInput,
  type ThreadId,
} from "@t3tools/contracts";
import * as NodeFs from "node:fs";
import * as NodePath from "node:path";

import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

/** A card nobody answers in this long counts as Deny. */
/** "Allow for this thread" grants kept in memory before the oldest is dropped. */
const MAX_THREAD_ALLOWANCES = 500;

export const SPAWN_APPROVAL_TIMEOUT = Duration.minutes(15);

export type SpawnApprovalOutcome = SubagentSpawnDecision | { readonly kind: "timed_out" };

export interface SpawnApprovalsShape {
  /** Open cards: the current list on subscribe, then a new list after each change. */
  readonly pending: Stream.Stream<SubagentSpawnApprovals>;
  /** True when the user chose "Allow for this thread" for this subagent and model. */
  readonly isAllowedForThread: (input: {
    readonly threadId: ThreadId;
    readonly subagent: string;
    readonly model: string;
  }) => Effect.Effect<boolean>;
  /** Shows the card and waits for the answer. Interrupting the caller removes the card. */
  readonly request: (approval: SubagentSpawnApproval) => Effect.Effect<SpawnApprovalOutcome>;
  readonly respond: (
    input: SubagentSpawnRespondInput,
  ) => Effect.Effect<void, SubagentSpawnApprovalError>;
  /** Counts one subagent start with its estimated start tokens. */
  readonly recordSpawn: (estimatedStartTokens: number) => Effect.Effect<void>;
  /** Today's counts for the Studio KPI strip. */
  readonly stats: Effect.Effect<SubagentActivityStats>;
  /**
   * Keeps today's counts in this file: reads them now (same local day only) and
   * writes after each change, so a restart does not reset the KPI strip.
   */
  readonly keepStatsIn: (file: string) => Effect.Effect<void>;
}

interface DayCounts {
  day: string;
  spawns: number;
  waited: number;
  startTokens: number;
}

/** Counts saved for `day`, or null when the file is missing, from another day, or damaged. */
export function parseSavedCounts(raw: string, day: string): DayCounts | null {
  try {
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== "object" || saved === null) return null;
    const record = saved as Record<string, unknown>;
    const count = (key: string) =>
      typeof record[key] === "number" && Number.isFinite(record[key]) && record[key] >= 0
        ? Math.floor(record[key] as number)
        : null;
    const spawns = count("spawns");
    const waited = count("waited");
    const startTokens = count("startTokens");
    if (record.day !== day || spawns === null || waited === null || startTokens === null) {
      return null;
    }
    return { day, spawns, waited, startTokens };
  } catch {
    return null;
  }
}

/** Local calendar day, so "today" resets at the user's midnight. */
const localDay = Effect.map(Clock.currentTimeMillis, (millis) =>
  DateTime.formatIsoDate(DateTime.makeZonedUnsafe(millis, { timeZone: DateTime.zoneMakeLocal() })),
);

const allowanceKey = (threadId: string, subagent: string, model: string) =>
  `${threadId}\u0000${subagent}\u0000${model}`;

export const makeSpawnApprovals = Effect.gen(function* () {
  const open = yield* SubscriptionRef.make<SubagentSpawnApprovals>([]);
  const waiting = new Map<
    string,
    {
      readonly approval: SubagentSpawnApproval;
      readonly answer: Deferred.Deferred<SubagentSpawnDecision>;
    }
  >();
  const allowances = new Set<string>();
  let today: DayCounts = { day: "", spawns: 0, waited: 0, startTokens: 0 };
  let statsFile: string | null = null;
  const forToday = Effect.map(localDay, (day) => {
    if (today.day !== day) today = { day, spawns: 0, waited: 0, startTokens: 0 };
    return today;
  });
  // A failed write only loses the saved count; the live count stays right.
  const saveCounts = () => {
    if (statsFile === null) return;
    try {
      NodeFs.mkdirSync(NodePath.dirname(statsFile), { recursive: true });
      NodeFs.writeFileSync(statsFile, JSON.stringify(today), "utf8");
    } catch {
      // ignore
    }
  };
  const publish = Effect.suspend(() =>
    SubscriptionRef.set(
      open,
      [...waiting.values()].map((entry) => entry.approval),
    ),
  );

  return {
    pending: SubscriptionRef.changes(open),
    isAllowedForThread: ({ threadId, subagent, model }) =>
      Effect.sync(() => allowances.has(allowanceKey(threadId, subagent, model))),
    request: (approval) =>
      Effect.gen(function* () {
        (yield* forToday).waited += 1;
        saveCounts();
        const answer = yield* Deferred.make<SubagentSpawnDecision>();
        waiting.set(approval.id, { approval, answer });
        yield* publish;
        const decision = yield* Deferred.await(answer).pipe(
          Effect.timeoutOption(SPAWN_APPROVAL_TIMEOUT),
        );
        if (Option.isNone(decision)) return { kind: "timed_out" } as const;
        if (decision.value.kind === "allow_thread") {
          allowances.add(allowanceKey(approval.threadId, approval.subagent, approval.model));
          // Oldest grant goes first; a Set keeps insertion order.
          if (allowances.size > MAX_THREAD_ALLOWANCES) {
            allowances.delete(allowances.values().next().value!);
          }
        }
        return decision.value;
      }).pipe(
        Effect.ensuring(
          Effect.andThen(
            Effect.sync(() => waiting.delete(approval.id)),
            publish,
          ),
        ),
      ),
    respond: ({ id, decision }) =>
      Effect.gen(function* () {
        const entry = waiting.get(id);
        if (entry === undefined) {
          return yield* new SubagentSpawnApprovalError({
            message: "This spawn request is no longer waiting.",
          });
        }
        yield* Deferred.succeed(entry.answer, decision);
      }),
    recordSpawn: (estimatedStartTokens) =>
      Effect.map(forToday, (counts) => {
        counts.spawns += 1;
        counts.startTokens += estimatedStartTokens;
        saveCounts();
      }),
    keepStatsIn: (file) =>
      Effect.gen(function* () {
        const day = yield* localDay;
        statsFile = file;
        const saved = yield* Effect.sync(() => {
          try {
            return parseSavedCounts(NodeFs.readFileSync(file, "utf8"), day);
          } catch {
            return null;
          }
        });
        if (saved !== null && today.day === day) {
          // Counts made before the file was known add to the saved ones.
          today = {
            day,
            spawns: saved.spawns + today.spawns,
            waited: saved.waited + today.waited,
            startTokens: saved.startTokens + today.startTokens,
          };
        } else if (saved !== null) {
          today = saved;
        }
      }),
    stats: Effect.map(forToday, (counts) => ({
      spawnsToday: counts.spawns,
      waitedToday: counts.waited,
      meanStartTokensToday:
        counts.spawns === 0 ? null : Math.round(counts.startTokens / counts.spawns),
    })),
  } satisfies SpawnApprovalsShape;
});

/**
 * One broker per server process, shared by `delegate_task` and the web RPCs
 * without extra layer wiring. Tests may provide their own.
 */
export class SpawnApprovals extends Context.Reference<SpawnApprovalsShape>(
  "t3/subagents/SpawnApprovals",
  { defaultValue: () => Effect.runSync(makeSpawnApprovals) },
) {}
