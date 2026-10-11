import { ZapIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { formatTpsLabel, type VelocitySummary } from "./AgentVelocityMeter.logic";
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
            aria-label={`Token counter: ${count} tokens, ${formatTpsLabel(summary.instantaneousTps)}`}
          >
            <ZapIcon aria-hidden />
            <span className="tabular-nums">
              {count} tokens · {formatTpsLabel(summary.instantaneousTps)}
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
            <dt className="text-muted-foreground">Average pace</dt>
            <dd className="text-right">{formatTpsLabel(summary.instantaneousTps)}</dd>
            <dt className="text-muted-foreground">Last 5 turns</dt>
            <dd className="text-right">{formatTpsLabel(summary.rolling5Tps)}</dd>
            <dt className="text-muted-foreground">Last 20 turns</dt>
            <dd className="text-right">{formatTpsLabel(summary.rolling20Tps)}</dd>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {summary.outputTokens === null
              ? "Waiting for the provider to report tokens. Some providers report only after a response or do not report output counts."
              : "Output includes thinking tokens when reported. Pace is output divided by elapsed turn time, including tools and waits; it is not raw model generation speed."}
          </p>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
