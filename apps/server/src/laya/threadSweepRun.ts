import type {
  OrchestrationV2ProjectedTurnItem,
  ThreadSweepItem,
  ThreadSweepResult,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import {
  isSweepEligible,
  scoreWithLaya,
  sweepTails,
  type LayaScorer,
  type SweepResult,
  type ThreadTail,
} from "./threadSweep.ts";

/** At most this many threads go to the model in one sweep, so a big list cannot run up a bill. */
export const MODEL_LIMIT = 12;
const READ_CONCURRENCY = 8;
const MODEL_CONCURRENCY = 3;
const TAIL_WINDOW = 60; // items read from the end of a thread; a longer tool streak reads as "no reply yet"
const TRANSCRIPT_CLIP = 3000;
const WAITING_STATUSES = new Set(["failed", "interrupted", "cancelled", "rolled_back"]);

/** The shell fields the sweep needs for one thread. */
export interface SweepThread {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly archived: boolean;
  readonly settled: boolean;
  readonly pinned: boolean;
  readonly status: string;
  readonly hasPendingRequest: boolean;
  /** Timeline positions run from 0 to this count minus 1. */
  readonly visibleItemCount: number;
}

export interface SweepDeps {
  readonly now: number;
  readonly threads: Effect.Effect<ReadonlyArray<SweepThread>>;
  /** Messages from the end of a thread, oldest first. */
  readonly readItems: (
    threadId: string,
    afterPosition: number,
  ) => Effect.Effect<ReadonlyArray<OrchestrationV2ProjectedTurnItem>>;
  /** The cheap-model opinion for one thread, or null when the model fails. */
  readonly assess: (
    transcript: string,
  ) => Effect.Effect<{ verdict: "done" | "unfinished" | "unsure"; reason: string } | null>;
  readonly score?: LayaScorer;
}

const ACTIVE = new Set(["preparing", "starting", "running", "waiting", "queued"]);

/** The last user message, the last finished assistant message, and which came last. */
export function tailFromItems(items: ReadonlyArray<OrchestrationV2ProjectedTurnItem>): ThreadTail {
  let lastUser = "";
  let lastAssistant = "";
  let endedOn: ThreadTail["endedOn"] = "empty";
  for (const { item } of items) {
    if (item.type === "user_message") {
      lastUser = item.text;
      endedOn = "user";
    } else if (item.type === "assistant_message" && !item.streaming && item.text.trim() !== "") {
      lastAssistant = item.text;
      endedOn = "assistant_text";
    }
  }
  return { lastUser, lastAssistant, endedOn };
}

interface ReadRow {
  readonly thread: SweepThread;
  /** Null when shell facts alone decided, so no text was read. */
  readonly tail: ThreadTail | null;
}

const toItem = (thread: SweepThread, result: SweepResult | ModelResult): ThreadSweepItem => ({
  threadId: thread.id as ThreadSweepItem["threadId"],
  projectId: thread.projectId as ThreadSweepItem["projectId"],
  title: thread.title,
  updatedAt: thread.updatedAt,
  verdict: result.verdict === "abstain" ? "unsure" : result.verdict,
  source: result.source,
  reason: result.reason,
});

interface ModelResult {
  readonly verdict: "done" | "unfinished" | "unsure";
  readonly source: "model";
  readonly reason: string;
}

export const runThreadSweep = (
  deps: SweepDeps,
  input: { readonly idleMinutes: number },
): Effect.Effect<ThreadSweepResult> =>
  Effect.gen(function* () {
    const all = yield* deps.threads;
    const eligible = all.filter(
      (thread) =>
        !ACTIVE.has(thread.status) &&
        isSweepEligible(
          {
            archived: thread.archived,
            settled: thread.settled,
            pinned: thread.pinned,
            running: false,
            updatedAtMs: Date.parse(thread.updatedAt),
          },
          deps.now,
          input.idleMinutes * 60_000,
        ),
    );

    // One read per thread. A pending approval or a failed run is unfinished without reading any text.
    const read: ReadonlyArray<ReadRow> = yield* Effect.forEach(
      eligible,
      (thread): Effect.Effect<ReadRow> =>
        thread.hasPendingRequest || WAITING_STATUSES.has(thread.status)
          ? Effect.succeed({ thread, tail: null })
          : deps
              .readItems(thread.id, Math.max(-1, thread.visibleItemCount - TAIL_WINDOW - 1))
              .pipe(Effect.map((items) => ({ thread, tail: tailFromItems(items) }))),
      { concurrency: READ_CONCURRENCY },
    );

    const items: ThreadSweepItem[] = [];
    const toSweep: Array<{ thread: SweepThread; tail: ThreadTail }> = [];
    for (const row of read) {
      if (row.tail === null) {
        items.push(
          toItem(row.thread, {
            verdict: "unfinished",
            source: "rule",
            reason: row.thread.hasPendingRequest
              ? "waiting for your approval"
              : "the last run did not finish",
          }),
        );
      } else toSweep.push({ thread: row.thread, tail: row.tail });
    }

    const outcome = yield* Effect.promise(() =>
      sweepTails(
        toSweep.map((row) => row.tail),
        deps.score ?? scoreWithLaya,
      ),
    );

    const open: Array<{ thread: SweepThread; tail: ThreadTail }> = [];
    toSweep.forEach((row, index) => {
      const result = outcome.results[index]!;
      if (result.verdict === "abstain" && row.tail.lastAssistant.trim() !== "") open.push(row);
      else items.push(toItem(row.thread, result));
    });

    // The model only sees what the rules and Laya could not decide, up to a fixed limit.
    const forModel = open.slice(0, MODEL_LIMIT);
    const judged = yield* Effect.forEach(
      forModel,
      (row) =>
        deps
          .assess(
            `User: ${row.tail.lastUser.slice(0, TRANSCRIPT_CLIP)}\n\nAssistant: ${row.tail.lastAssistant.slice(-TRANSCRIPT_CLIP)}`,
          )
          .pipe(Effect.map((answer) => ({ row, answer }))),
      { concurrency: MODEL_CONCURRENCY },
    );
    for (const { row, answer } of judged) {
      items.push(
        toItem(
          row.thread,
          answer
            ? { verdict: answer.verdict, source: "model", reason: answer.reason }
            : { verdict: "unsure", source: "model", reason: "the model gave no answer" },
        ),
      );
    }
    for (const row of open.slice(MODEL_LIMIT)) {
      items.push(
        toItem(row.thread, {
          verdict: "abstain",
          source: "rule",
          reason: "not checked: sweep limit reached",
        }),
      );
    }

    return {
      items,
      layaAvailable: outcome.layaAvailable,
      modelLimitHit: open.length > MODEL_LIMIT,
    };
  });
