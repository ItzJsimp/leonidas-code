import * as Schema from "effect/Schema";

/**
 * Marketing files (ADR-0091 in the AIOS): one `marketing/` folder per workspace.
 * `posts/` and `approvals/` hold one line per version; the last line for an `id` wins.
 * Agents draft and ask; only a person approves a public act (publish, send or spend).
 */

const NonBlank = Schema.String.check(
  Schema.makeFilter((value: string) => value.trim().length > 0, { expected: "a non-blank string" }),
);
const IsoTime = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, {
    expected: "ISO 8601 time with an offset",
  }),
);
export const MarketingBrandSlug = Schema.String.check(
  Schema.isPattern(/^[a-z0-9][a-z0-9-]{0,62}$/, { expected: "a lowercase brand slug" }),
);
export const MarketingPostId = Schema.String.check(
  Schema.isPattern(/^post_\d{4}-\d{2}_[0-9a-f]{12}$/, { expected: "post_YYYY-MM_ plus 12 hex" }),
);

export const MarketingChannel = Schema.Literals(["x", "discord", "email"]);
export type MarketingChannel = typeof MarketingChannel.Type;

export const MarketingActor = Schema.Struct({
  kind: Schema.Literals(["agent", "member"]),
  name: NonBlank,
});
export type MarketingActor = typeof MarketingActor.Type;

/** Slice 1 writes drafts only. `posted` comes from the publish path, after a ticket matches. */
export const MarketingPost = Schema.Struct({
  v: Schema.Literal(1),
  id: MarketingPostId,
  brand: MarketingBrandSlug,
  channel: MarketingChannel,
  text: NonBlank.check(Schema.isMaxLength(10_000)),
  status: Schema.Literals(["draft", "posted"]),
  scheduledFor: Schema.optional(IsoTime),
  createdAt: IsoTime,
  updatedAt: IsoTime,
  author: MarketingActor,
  externalId: Schema.optional(NonBlank),
});
export type MarketingPost = typeof MarketingPost.Type;

export const MarketingPublicAct = Schema.Literals(["publish", "send", "spend"]);
export type MarketingPublicAct = typeof MarketingPublicAct.Type;

export const MarketingApprovalTicket = Schema.Struct({
  v: Schema.Literal(1),
  id: Schema.String.check(Schema.isPattern(/^apr_[0-9a-f]{12}$/, { expected: "apr_ plus 12 hex" })),
  postId: MarketingPostId,
  act: MarketingPublicAct,
  /** SHA-256 of the exact content; an edit after approval no longer matches. */
  contentHash: Schema.String.check(
    Schema.isPattern(/^[0-9a-f]{64}$/, { expected: "a SHA-256 hex" }),
  ),
  costEstimateUsd: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literals(["pending", "approved", "rejected"]),
  requestedAt: IsoTime,
  requestedBy: MarketingActor,
  decidedAt: Schema.optional(IsoTime),
  /** Agents never approve: a decision names a person Member. */
  decidedBy: Schema.optional(Schema.Struct({ kind: Schema.Literal("member"), name: NonBlank })),
  /** HMAC-SHA256 hex of the decision, made with a key only the server holds. Approved needs it. */
  signature: Schema.optional(
    Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/, { expected: "an HMAC-SHA256 hex" })),
  ),
});
export type MarketingApprovalTicket = typeof MarketingApprovalTicket.Type;

export const MarketingDecision = Schema.Literals(["approve", "reject"]);
export type MarketingDecision = typeof MarketingDecision.Type;

/** Why one ticket in a batch was not decided. The other tickets are not affected. */
export const MarketingDecideReason = Schema.Literals([
  "no_ticket",
  "already_decided",
  "no_post",
  "not_draft",
  "content_changed",
]);
export type MarketingDecideReason = typeof MarketingDecideReason.Type;

export const MarketingDecideResult = Schema.Struct({
  ticketId: Schema.String,
  ok: Schema.Boolean,
  reason: Schema.optional(MarketingDecideReason),
});
export type MarketingDecideResult = typeof MarketingDecideResult.Type;

export const MarketingMetricSnapshot = Schema.Struct({
  v: Schema.Literal(1),
  channel: MarketingChannel,
  brand: Schema.optional(MarketingBrandSlug),
  externalId: NonBlank,
  at: IsoTime,
  source: NonBlank,
  impressions: Schema.optional(Schema.Number),
  likes: Schema.optional(Schema.Number),
  replies: Schema.optional(Schema.Number),
  reposts: Schema.optional(Schema.Number),
});
export type MarketingMetricSnapshot = typeof MarketingMetricSnapshot.Type;

export const MarketingBrand = Schema.Struct({
  slug: MarketingBrandSlug,
  name: NonBlank,
  spendCapUsd: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  channels: Schema.Array(MarketingChannel),
  /** The markdown body: customer, voice do, voice don't, banned words. */
  profile: Schema.String,
});
export type MarketingBrand = typeof MarketingBrand.Type;

/** `connections.json`. Never a token: tokens stay in the secrets store. */
export const MarketingConnections = Schema.Struct({
  v: Schema.Literal(1),
  x: Schema.optional(
    Schema.Struct({
      mode: Schema.Literal("draft"),
      brand: Schema.optional(MarketingBrandSlug),
      /** Folder, inside the workspace, where the X agent saves its daily analytics JSON. */
      analyticsDir: NonBlank,
    }),
  ),
});
export type MarketingConnections = typeof MarketingConnections.Type;

/** A line or file the reader skipped, so one bad record never hides the rest. */
export const MarketingBadRecord = Schema.Struct({
  file: Schema.String,
  line: Schema.optional(Schema.Number),
  reason: Schema.String,
});
export type MarketingBadRecord = typeof MarketingBadRecord.Type;

/** What the Marketing screens read. Brand profile text stays on the server: the screens need only the name. */
export const MarketingApprovalState = Schema.Literals([
  "none",
  "pending",
  "approved",
  "rejected",
  "content_changed",
]);
export type MarketingApprovalState = typeof MarketingApprovalState.Type;

export const MarketingListInput = Schema.Struct({ workspaceId: Schema.optional(Schema.String) });
export type MarketingListInput = typeof MarketingListInput.Type;

export const MarketingListResult = Schema.Struct({
  brands: Schema.Array(
    Schema.Struct({ slug: MarketingBrandSlug, name: NonBlank, spendCapUsd: Schema.Number }),
  ),
  /** The oldest pending tickets (at most one decide call can take) with the post each one asks about. */
  queue: Schema.Array(Schema.Struct({ ticket: MarketingApprovalTicket, post: MarketingPost })),
  /** All pending tickets, so a screen can say how many wait beyond `queue`. */
  queueTotal: Schema.Number,
  /** The newest posts, newest first. */
  posts: Schema.Array(Schema.Struct({ post: MarketingPost, approval: MarketingApprovalState })),
  postsTotal: Schema.Number,
  /** The latest snapshots, newest last. */
  metrics: Schema.Array(MarketingMetricSnapshot),
  bad: Schema.Array(MarketingBadRecord),
});
export type MarketingListResult = typeof MarketingListResult.Type;

export const MarketingDecideInput = Schema.Struct({
  workspaceId: Schema.optional(Schema.String),
  decisions: Schema.Array(
    Schema.Struct({
      ticketId: Schema.String.check(
        Schema.isPattern(/^apr_[0-9a-f]{12}$/, { expected: "apr_ plus 12 hex" }),
      ),
      decision: MarketingDecision,
    }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(200)),
});
export type MarketingDecideInput = typeof MarketingDecideInput.Type;

export const MarketingDecideOutput = Schema.Struct({
  results: Schema.Array(MarketingDecideResult),
});
export type MarketingDecideOutput = typeof MarketingDecideOutput.Type;

/** The one error a screen shows in its own words: no AIOS folder is connected. */
export const MARKETING_NO_WORKSPACE = "No workspace is open.";

export class MarketingRpcError extends Schema.TaggedError<MarketingRpcError>()(
  "MarketingRpcError",
  { message: Schema.String },
) {}
