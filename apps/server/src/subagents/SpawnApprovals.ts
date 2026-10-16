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
  SubagentSpawnApprovalError,
  type SubagentSpawnApproval,
  type SubagentSpawnApprovals,
  type SubagentSpawnDecision,
  type SubagentSpawnRespondInput,
  type ThreadId,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
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
}

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
