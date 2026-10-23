import type {
  MarketingDecideReason,
  MarketingDecideResult,
  MarketingListResult,
  MarketingMetricSnapshot,
  MarketingPost,
} from "@t3tools/contracts";

type QueueItem = MarketingListResult["queue"][number];

/** The queue grouped by brand, in the order the first item of each brand was asked. */
export function groupQueueByBrand(queue: ReadonlyArray<QueueItem>) {
  const groups = new Map<string, QueueItem[]>();
  for (const item of queue) {
    const list = groups.get(item.post.brand) ?? [];
    list.push(item);
    groups.set(item.post.brand, list);
  }
  return [...groups].map(([brand, items]) => ({ brand, items }));
}

/** Plain words for each reason one ticket was not decided. */
export const DECIDE_REASON_TEXT: Record<MarketingDecideReason, string> = {
  no_ticket: "This request is gone.",
  already_decided: "Someone already decided this one.",
  no_post: "The post is gone.",
  not_draft: "The post is already out.",
  content_changed: "The text changed after the request. Ask again.",
};

/** One line for a batch, and the tickets that failed with their reason. */
export function summarizeResults(results: ReadonlyArray<MarketingDecideResult>) {
  const failed = results.flatMap((result) =>
    result.ok
      ? []
      : [{ ticketId: result.ticketId, text: DECIDE_REASON_TEXT[result.reason ?? "no_ticket"] }],
  );
  const done = results.length - failed.length;
  const line =
    failed.length === 0
      ? `${done} ${done === 1 ? "item" : "items"} done.`
      : `${done} done, ${failed.length} not done.`;
  return { done, failed, line };
}

/** The newest snapshot for each channel and external id. */
function latestByPost(metrics: ReadonlyArray<MarketingMetricSnapshot>) {
  const latest = new Map<string, MarketingMetricSnapshot>();
  for (const snapshot of metrics) {
    const key = `${snapshot.channel}|${snapshot.externalId}`;
    const known = latest.get(key);
    if (!known || known.at <= snapshot.at) latest.set(key, snapshot);
  }
  return latest;
}

export type ContentRow = {
  readonly post: MarketingPost;
  readonly approval: MarketingListResult["posts"][number]["approval"];
  readonly latest: MarketingMetricSnapshot | null;
};

/** Posts newest first, each with its latest metric snapshot (same channel and external id). */
export function contentRows(list: MarketingListResult): ReadonlyArray<ContentRow> {
  const latest = latestByPost(list.metrics);
  return list.posts
    .map(({ post, approval }) => ({
      post,
      approval,
      latest: post.externalId ? (latest.get(`${post.channel}|${post.externalId}`) ?? null) : null,
    }))
    .toSorted((a, b) => b.post.updatedAt.localeCompare(a.post.updatedAt));
}

/** Totals over each channel's latest snapshots, so a post counts once. */
export function metricTotals(metrics: ReadonlyArray<MarketingMetricSnapshot>) {
  const latest = latestByPost(metrics);
  const total = { impressions: 0, likes: 0, replies: 0, reposts: 0, posts: latest.size };
  for (const snapshot of latest.values()) {
    total.impressions += snapshot.impressions ?? 0;
    total.likes += snapshot.likes ?? 0;
    total.replies += snapshot.replies ?? 0;
    total.reposts += snapshot.reposts ?? 0;
  }
  return total;
}

export const CHANNEL_LABEL = { x: "X", discord: "Discord", email: "Email" } as const;
export const ACT_LABEL = { publish: "Post", send: "Send", spend: "Spend" } as const;

export const APPROVAL_LABEL = {
  none: "Not asked",
  pending: "Needs approval",
  approved: "Approved",
  rejected: "Rejected",
  content_changed: "Changed after approval",
} as const;

export const formatCount = (value: number | undefined) =>
  value === undefined ? "-" : new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
