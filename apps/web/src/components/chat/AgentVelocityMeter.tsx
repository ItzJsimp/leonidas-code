import { ZapIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import {
  formatRollingLabel,
  formatToolDuration,
  formatToolWait,
  formatTpsLabel,
  type VelocitySummary,
} from "./AgentVelocityMeter.logic";
import { composerFloatingLayerProps } from "./composerEventScope";

/**
 * Provider-reported output (including reasoning) and pace for the current turn. The headline is the
 * model-stream pace (turn minus tool waits) when a turn has tool waits to remove, because the
 * whole-turn average mixes model speed with shell and file latency; the popover shows both.
 */
export function TokenCounter({ summary }: { summary: VelocitySummary }) {
  const count = summary.outputTokens?.toLocaleString() ?? "—";
  const headlineTps = summary.modelStreamTps ?? summary.averageTurnTps;
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        render={
          <Button
            size="compact"
            variant="ghost-muted"
            className="shrink-0 whitespace-nowrap"
            aria-label={`Token counter: ${count} tokens, model stream pace ${formatTpsLabel(headlineTps)}, whole-turn average ${formatTpsLabel(summary.averageTurnTps)}`}
          >
            <ZapIcon aria-hidden />
            <span className="tabular-nums">
              <span className="hidden sm:inline">{count} tokens · </span>
              {formatTpsLabel(headlineTps)}
            </span>
          </Button>
        }
      />
      <PopoverPopup {...composerFloatingLayerProps} side="top" align="end" width="md">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between font-semibold">
            <span>Token counter</span>
            <span className="text-xs text-muted-foreground">
              {summary.isLive ? "Current turn" : "Last reported turn"}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-2 tabular-nums">
            <dt className="text-muted-foreground">Output tokens</dt>
            <dd className="text-right">{count}</dd>
            <dt className="text-muted-foreground">Thinking tokens</dt>
            <dd className="text-right">
              {summary.reasoningTokens?.toLocaleString() ?? "Not reported"}
            </dd>
            <dt className="text-muted-foreground">Model stream (approx.)</dt>
            <dd className="text-right">{formatTpsLabel(summary.modelStreamTps)}</dd>
            <dt className="text-muted-foreground">Whole-turn average</dt>
            <dd className="text-right">{formatTpsLabel(summary.averageTurnTps)}</dd>
            <dt className="text-muted-foreground">Tool wait</dt>
            <dd className="text-right">{formatToolWait(summary)}</dd>
            <dt className="text-muted-foreground">First output</dt>
            <dd className="text-right">{formatToolDuration(summary.firstOutputMs)}</dd>
            <dt className="text-muted-foreground">Last 5 turns</dt>
            <dd className="text-right">
              {formatRollingLabel(summary.rolling5Tps, 5, summary.totalTurnsTracked)}
            </dd>
            <dt className="text-muted-foreground">Last 10 turns</dt>
            <dd className="text-right">
              {formatRollingLabel(summary.rolling10Tps, 10, summary.totalTurnsTracked)}
            </dd>
            <dt className="text-muted-foreground">Last 20 turns</dt>
            <dd className="text-right">
              {formatRollingLabel(summary.rolling20Tps, 20, summary.totalTurnsTracked)}
            </dd>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {summary.outputTokens === null
              ? "Waiting for the provider to report turn totals. Some providers report only when the turn finishes or do not report output counts."
              : "Output includes thinking tokens when reported. Model stream is output over turn time minus tool waits; the whole-turn average also counts tools and waits. Both are approximations from item timestamps, not token-level timing. Last 5, 10 and 20 turns use the whole-turn average."}
          </p>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
