import { ZapIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import {
  formatRollingLabel,
  formatTpsLabel,
  type VelocitySummary,
} from "./AgentVelocityMeter.logic";
import { composerFloatingLayerProps } from "./composerEventScope";

/** Provider-reported output (including reasoning) and average pace for the current turn. */
export function TokenCounter({ summary }: { summary: VelocitySummary }) {
  const count = summary.outputTokens?.toLocaleString() ?? "—";
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
            aria-label={`Token counter: ${count} tokens, average turn throughput ${formatTpsLabel(summary.averageTurnTps)}`}
          >
            <ZapIcon aria-hidden />
            <span className="tabular-nums">
              <span className="hidden sm:inline">{count} tokens · </span>
              {formatTpsLabel(summary.averageTurnTps)}
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
            <dt className="text-muted-foreground">Average turn throughput</dt>
            <dd className="text-right">{formatTpsLabel(summary.averageTurnTps)}</dd>
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
              : "Output includes thinking tokens when reported. Average turn throughput is output divided by elapsed turn time, including tools and waits; it is not raw model generation speed."}
          </p>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
