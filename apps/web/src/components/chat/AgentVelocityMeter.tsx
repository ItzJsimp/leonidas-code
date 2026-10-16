import { useThreadContextBreakdown } from "../../state/queries";
import { estimateFixedOverheadTokens, splitInputByOverhead } from "./ContextTrim.logic";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import type { CacheBreak, TurnLedger } from "@t3tools/shared/turnLedger";
import {
  formatCacheBreak,
  formatCacheHitRate,
  formatRollingFill,
  formatToolDuration,
  formatToolWait,
  formatTpsLabel,
  type VelocitySummary,
} from "./AgentVelocityMeter.logic";

/**
 * Speed section of the usage card: one number for the chat (model pace over the last turns).
 * Hover or focus opens the detail panel beside the card: last reply, last 5, 10 and 20 turns.
 * Model pace leaves out time spent on tools, which is shell and file latency, not generation.
 */
export function SpeedSection({ summary }: { summary: VelocitySummary }) {
  const chatTps = summary.rolling10Tps ?? summary.modelStreamTps ?? summary.averageTurnTps;
  const rolling = [
    { window: 5, tps: summary.rolling5Tps },
    { window: 10, tps: summary.rolling10Tps },
    { window: 20, tps: summary.rolling20Tps },
  ];
  const peak = Math.max(1, ...summary.tpsHistory);
  return (
    <section
      className="group/speed relative border-t pt-2 outline-none"
      tabIndex={0}
      aria-label={`Chat speed ${formatTpsLabel(chatTps)}. Show turn details`}
    >
      <div className="flex items-baseline justify-between gap-3 tabular-nums">
        <span className="font-medium text-muted-foreground text-xs">Speed</span>
        <span
          className="font-semibold text-sm"
          title="Average model speed over the last 10 replies, tool waits removed."
        >
          {formatTpsLabel(chatTps)}
        </span>
      </div>
      <div className="hidden group-hover/speed:block group-focus-within/speed:block">
        <div className="absolute right-full bottom-0 pr-2">
          <div className="flex w-60 flex-col gap-2 rounded-lg border bg-popover p-3 text-left shadow-lg">
            <div className="flex items-baseline justify-between gap-3 tabular-nums">
              <span className="text-secondary-label text-2xs">
                {summary.isLive ? "Current reply" : "Last reply"}
              </span>
              <span className="font-semibold text-sm">
                {formatTpsLabel(summary.modelStreamTps ?? summary.averageTurnTps)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {rolling.map(({ window, tps }) => {
                const fill = formatRollingFill(window, summary.totalTurnsTracked);
                return (
                  <div
                    key={window}
                    className="rounded-md bg-muted/50 px-1.5 py-1 text-center"
                    title={`Average over the last ${window} replies`}
                  >
                    <div className="text-secondary-label text-2xs">Last {window}</div>
                    <div className="font-medium text-xs tabular-nums">{formatTpsLabel(tps)}</div>
                    {fill ? <div className="text-muted-foreground/70 text-2xs">{fill}</div> : null}
                  </div>
                );
              })}
            </div>
            {summary.tpsHistory.length > 1 ? (
              <div className="flex h-6 items-end gap-px" aria-hidden>
                {summary.tpsHistory.map((tps, index) => (
                  <div
                    key={index}
                    className="min-h-px flex-1 rounded-sm bg-info/60"
                    style={{ height: `${Math.max(4, (tps / peak) * 100)}%` }}
                  />
                ))}
              </div>
            ) : null}
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-2xs leading-4 tabular-nums">
              <Row label="Whole reply" value={formatTpsLabel(summary.averageTurnTps)} />
              <Row label="Output" value={summary.outputTokens?.toLocaleString() ?? "--"} />
              <Row label="Thinking" value={summary.reasoningTokens?.toLocaleString() ?? "--"} />
              <Row label="Waiting for tools" value={formatToolWait(summary)} />
              <Row label="First output" value={formatToolDuration(summary.firstOutputMs)} />
            </dl>
            <p className="text-pretty text-muted-foreground/70 text-2xs leading-4">
              Estimates. Speed leaves out tool time. Output includes thinking.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Prompt cache section: how much of the last request came from cache. Cached tokens are the
 * cheap part; a low share with many written tokens means the prompt start changed.
 */
export function CacheSection({
  label,
  ledger,
  cachedTokens,
  cacheBreak,
}: {
  label: string;
  ledger: TurnLedger | null;
  cachedTokens: number | null;
  cacheBreak: CacheBreak | null;
}) {
  const input = ledger
    ? ledger.cacheReadTokens + ledger.cacheWriteTokens + ledger.freshInputTokens
    : 0;
  const share = (tokens: number) => `${input > 0 ? (tokens / input) * 100 : 0}%`;
  return (
    <section className="flex flex-col gap-2 border-t pt-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-muted-foreground text-xs">Prompt cache</div>
        <div className="text-secondary-label text-2xs tabular-nums">{label}</div>
      </div>
      {ledger ? (
        <>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/60" aria-hidden>
            <div className="bg-success" style={{ width: share(ledger.cacheReadTokens) }} />
            <div className="bg-warning" style={{ width: share(ledger.cacheWriteTokens) }} />
            <div className="bg-foreground/60" style={{ width: share(ledger.freshInputTokens) }} />
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-2xs leading-4 tabular-nums">
            <Row
              label="Cached"
              title="Tokens read from the cache at the low price."
              value={`${ledger.cacheReadTokens.toLocaleString()} (${formatCacheHitRate(ledger.cacheHitRate)})`}
            />
            <Row
              label="New"
              title="Tokens sent at the full price."
              value={ledger.freshInputTokens.toLocaleString()}
            />
            <Row
              label="Written"
              title="Tokens saved to the cache for later."
              value={ledger.cacheWriteTokens.toLocaleString()}
            />
          </dl>
        </>
      ) : cachedTokens !== null ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 text-2xs leading-4 tabular-nums">
          <Row label="Cached" value={cachedTokens.toLocaleString()} />
        </dl>
      ) : (
        <p className="text-muted-foreground text-2xs">This connection does not report cache use.</p>
      )}
      {cacheBreak ? (
        <p className="text-pretty text-2xs text-warning-foreground leading-4" role="status">
          {formatCacheBreak(cacheBreak)}
        </p>
      ) : null}
    </section>
  );
}

export interface ThreadTarget {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}

/** Fixed overhead against conversation. Reads the thread breakdown only while the popover is open. */
export function OverheadRows({
  threadTarget,
  contextTokens,
}: {
  threadTarget: ThreadTarget | null;
  contextTokens: number | null;
}) {
  const query = useThreadContextBreakdown(threadTarget);
  const split = query.data
    ? contextTokens === null
      ? null
      : splitInputByOverhead(contextTokens, estimateFixedOverheadTokens(query.data))
    : null;
  if (split === null) return null;
  return (
    <>
      <Row label="Setup (estimate)" value={split.fixed.toLocaleString()} />
      <Row label="Chat (estimate)" value={split.conversation.toLocaleString()} />
    </>
  );
}

function Row({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <>
      <dt className="text-secondary-label" title={title}>
        {label}
      </dt>
      <dd className="text-right font-medium text-secondary-label">{value}</dd>
    </>
  );
}
