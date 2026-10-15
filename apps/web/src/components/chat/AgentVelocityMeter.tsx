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
 * Speed section of the composer usage card: provider-reported output and pace for the latest
 * turn, then rolling averages. The headline is model pace (turn minus tool waits) because the
 * overall average mixes model speed with shell and file latency.
 */
export function SpeedSection({ summary }: { summary: VelocitySummary }) {
  const rolling = [
    { window: 5, tps: summary.rolling5Tps },
    { window: 10, tps: summary.rolling10Tps },
    { window: 20, tps: summary.rolling20Tps },
  ];
  return (
    <section className="flex flex-col gap-2 border-t pt-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-muted-foreground text-xs">Speed</div>
        <div className="text-secondary-label text-2xs">
          {summary.isLive ? "Current turn" : "Last turn"}
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3 tabular-nums">
        <span className="font-semibold text-sm">
          {formatTpsLabel(summary.modelStreamTps ?? summary.averageTurnTps)}
        </span>
        <span className="text-secondary-label text-2xs">
          {formatTpsLabel(summary.averageTurnTps)} overall
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {rolling.map(({ window, tps }) => {
          const fill = formatRollingFill(window, summary.totalTurnsTracked);
          return (
            <div key={window} className="rounded-md bg-muted/50 px-1.5 py-1 text-center">
              <div className="text-secondary-label text-2xs">Last {window}</div>
              <div className="font-medium text-xs tabular-nums">{formatTpsLabel(tps)}</div>
              {fill ? <div className="text-muted-foreground/70 text-2xs">{fill}</div> : null}
            </div>
          );
        })}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-2xs leading-4 tabular-nums">
        <Row label="Output" value={summary.outputTokens?.toLocaleString() ?? "Not reported"} />
        <Row label="Thinking" value={summary.reasoningTokens?.toLocaleString() ?? "Not reported"} />
        <Row label="Tool wait" value={formatToolWait(summary)} />
        <Row label="First output" value={formatToolDuration(summary.firstOutputMs)} />
      </dl>
      <p className="text-pretty text-muted-foreground/70 text-2xs leading-4">
        Approximate. Headline pace skips tool waits; output includes thinking.
      </p>
    </section>
  );
}

/**
 * Where the latest reporting turn's input went. Cache reads are the cheap part; a low hit rate
 * with high writes means the prompt prefix changed and the cache restarted.
 */
export function InputLedger({
  ledger,
  cacheBreak,
  threadTarget = null,
  contextTokens = null,
}: {
  ledger: TurnLedger;
  cacheBreak: CacheBreak | null;
  threadTarget?: ThreadTarget | null;
  /** Tokens now in the context window. Turn input adds up every model call, so it is no base. */
  contextTokens?: number | null;
}) {
  const input = ledger.cacheReadTokens + ledger.cacheWriteTokens + ledger.freshInputTokens;
  const share = (tokens: number) => `${input > 0 ? (tokens / input) * 100 : 0}%`;
  return (
    <section className="flex flex-col gap-2 border-t pt-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-muted-foreground text-xs">Input</div>
        <div className="text-secondary-label text-2xs tabular-nums">{input.toLocaleString()}</div>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/60" aria-hidden>
        <div className="bg-success" style={{ width: share(ledger.cacheReadTokens) }} />
        <div className="bg-warning" style={{ width: share(ledger.cacheWriteTokens) }} />
        <div className="bg-foreground/60" style={{ width: share(ledger.freshInputTokens) }} />
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-2xs leading-4 tabular-nums">
        <Row
          label="Cache reads"
          value={`${ledger.cacheReadTokens.toLocaleString()} (${formatCacheHitRate(ledger.cacheHitRate)})`}
        />
        <Row label="Cache writes" value={ledger.cacheWriteTokens.toLocaleString()} />
        <Row label="Fresh" value={ledger.freshInputTokens.toLocaleString()} />
        <OverheadRows threadTarget={threadTarget} contextTokens={contextTokens} />
      </dl>
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
function OverheadRows({
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
      <Row label="Setup in context (estimate)" value={split.fixed.toLocaleString()} />
      <Row label="Chat in context (estimate)" value={split.conversation.toLocaleString()} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-secondary-label">{label}</dt>
      <dd className="text-right font-medium text-secondary-label">{value}</dd>
    </>
  );
}
