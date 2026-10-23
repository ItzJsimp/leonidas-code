import {
  MARKETING_NO_WORKSPACE,
  MarketingRpcError,
  type MarketingDecideInput,
  type MarketingDecideOutput,
  type MarketingListResult,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { approvalKey } from "./approvalKey.ts";
import * as MarketingFiles from "./marketingFiles.ts";

/** Metric snapshots sent to a screen; the rest stay in the month files. */
const MAX_METRICS = 200;
/** Posts sent to a screen, newest first. */
const MAX_POSTS = 500;
/** The queue sent to a screen: the most one decide call takes (see MarketingDecideInput). */
const MAX_QUEUE = 200;
/** Bad records sent to a screen. */
const MAX_BAD = 50;

const rpcError = (message: string) => new MarketingRpcError({ message });

const withRoot = <A, E>(
  resolveRoot: Effect.Effect<string | null, E>,
  work: (root: string, key: Uint8Array) => A,
) =>
  Effect.gen(function* () {
    const root = yield* Effect.mapError(resolveRoot, () => rpcError(MARKETING_NO_WORKSPACE));
    if (root === null) return yield* rpcError(MARKETING_NO_WORKSPACE);
    const key = yield* Effect.mapError(approvalKey, () => rpcError("Could not read the key."));
    return yield* Effect.try({
      try: () => work(root, key),
      catch: (error) =>
        rpcError(
          error instanceof MarketingFiles.MarketingError
            ? error.message
            : "Marketing files failed.",
        ),
    });
  });

/** Everything the screens show, read once from the workspace files. */
export function list<E>(resolveRoot: Effect.Effect<string | null, E>) {
  return withRoot(resolveRoot, (root, key): MarketingListResult => {
    const brands = MarketingFiles.readBrands(root);
    const posts = MarketingFiles.readPosts(root);
    const tickets = MarketingFiles.readTickets(root);
    const metrics = MarketingFiles.readMetrics(root);
    const byId = new Map(posts.records.map((post) => [post.id, post]));
    const pending = tickets.records
      .filter((ticket) => ticket.status === "pending")
      .flatMap((ticket) => {
        const post = byId.get(ticket.postId);
        return post && post.status === "draft" ? [{ ticket, post }] : [];
      })
      .toSorted((a, b) => a.ticket.requestedAt.localeCompare(b.ticket.requestedAt));
    const newest = posts.records.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      brands: brands.records.map(({ slug, name, spendCapUsd }) => ({ slug, name, spendCapUsd })),
      queue: pending.slice(0, MAX_QUEUE),
      queueTotal: pending.length,
      postsTotal: posts.records.length,
      posts: newest.slice(0, MAX_POSTS).map((post) => {
        const check = MarketingFiles.approvalOf(key, post, "publish", tickets.records);
        return {
          post,
          approval: check.ok
            ? ("approved" as const)
            : check.reason === "no_post" || check.reason === "no_ticket"
              ? ("none" as const)
              : check.reason,
        };
      }),
      metrics: metrics.records.slice(-MAX_METRICS),
      bad: [...brands.bad, ...posts.bad, ...tickets.bad, ...metrics.bad].slice(0, MAX_BAD),
    };
  });
}

/** Signs a person's decisions. The caller's scope check is what keeps agents out. */
export function decide<E>(
  resolveRoot: Effect.Effect<string | null, E>,
  input: MarketingDecideInput,
  member: string,
) {
  return withRoot(resolveRoot, (root, key): MarketingDecideOutput => ({
    results: MarketingFiles.decideTickets(root, key, input.decisions, member),
  }));
}
