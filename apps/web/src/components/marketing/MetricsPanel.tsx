import type { MarketingMetricSnapshot } from "@t3tools/contracts";

import { CHANNEL_LABEL, formatCount, metricTotals } from "./marketing.logic";

/** Totals over each post's newest numbers, in all channels and then per channel. */
export function MetricsPanel(props: { readonly metrics: ReadonlyArray<MarketingMetricSnapshot> }) {
  if (props.metrics.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No numbers yet. They appear after the first sync.
      </p>
    );
  }
  const all = metricTotals(props.metrics);
  const channels = [...new Set(props.metrics.map((snapshot) => snapshot.channel))].toSorted();
  return (
    <div className="flex flex-col gap-4">
      <Kpis totals={all} />
      {channels.map((channel) => (
        <section key={channel} aria-label={CHANNEL_LABEL[channel]} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {CHANNEL_LABEL[channel]}
          </h3>
          <Kpis totals={metricTotals(props.metrics.filter((s) => s.channel === channel))} />
        </section>
      ))}
    </div>
  );
}

function Kpis(props: { readonly totals: ReturnType<typeof metricTotals> }) {
  const { totals } = props;
  const items = [
    ["Posts tracked", totals.posts],
    ["Seen", totals.impressions],
    ["Likes", totals.likes],
    ["Replies", totals.replies],
    ["Reposts", totals.reposts],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-border p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-lg font-medium tabular-nums">{formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
