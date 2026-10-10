import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import {
  formatToolDuration,
  formatTpsLabel,
  type VelocitySummary,
} from "./AgentVelocityMeter.logic";
import { ZapIcon, ActivityIcon, ClockIcon } from "lucide-react";
import { composerFloatingLayerProps } from "./composerEventScope";

function MiniSparkline({ data }: { data: ReadonlyArray<number> }) {
  if (data.length < 2) return null;
  const width = 180;
  const height = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible text-cyan-500 stroke-current fill-none"
    >
      <polyline
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function AgentVelocityMeter(props: { summary: VelocitySummary; className?: string }) {
  const { summary } = props;
  const displayTps = summary.instantaneousTps ?? summary.rolling10Tps;
  if (displayTps === null && summary.totalToolCallsTracked === 0) {
    return null;
  }

  const isFast = displayTps !== null && displayTps >= 50;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        render={
          <Button
            size="icon-sm"
            variant="ghost-muted"
            className="flex items-center gap-1 px-1.5 h-7 w-auto min-w-[3.5rem] rounded-md text-2xs tabular-nums text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label={`Agent execution speed: ${formatTpsLabel(displayTps)}`}
          >
            <ZapIcon
              className={`size-3.5 ${isFast ? "text-cyan-400 fill-cyan-400/20" : "text-amber-400"}`}
            />
            <span className="font-semibold text-2xs">
              {displayTps !== null ? Math.round(displayTps) : "--"}
              <span className="text-3xs text-muted-foreground ml-0.5">t/s</span>
            </span>
          </Button>
        }
      />
      <PopoverPopup
        {...composerFloatingLayerProps}
        tooltipStyle
        side="top"
        align="end"
        padding="none"
        width="sm"
        className="w-72 p-3 text-left whitespace-normal bg-popover/95 backdrop-blur-md border border-border/80 shadow-xl rounded-xl"
      >
        <div className="flex flex-col gap-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <ZapIcon className="size-3.5 text-cyan-400" />
              <span>Agent Execution Velocity</span>
            </div>
            <span className="text-3xs uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Live Tracker
            </span>
          </div>

          {/* Current & Instantaneous Speed */}
          <div className="flex items-baseline justify-between pt-0.5">
            <span className="text-2xs text-muted-foreground font-medium">Current Speed</span>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {formatTpsLabel(summary.instantaneousTps)}
            </span>
          </div>

          {/* Rolling Multi-Window Breakdown */}
          <div className="grid grid-cols-3 gap-1.5 bg-muted/30 p-1.5 rounded-lg border border-border/30 text-center">
            <div className="flex flex-col p-1 rounded bg-background/50">
              <span className="text-3xs text-muted-foreground uppercase font-semibold">Last 5</span>
              <span className="text-xs font-bold tabular-nums text-cyan-400 mt-0.5">
                {formatTpsLabel(summary.rolling5Tps)}
              </span>
            </div>
            <div className="flex flex-col p-1 rounded bg-background/50">
              <span className="text-3xs text-muted-foreground uppercase font-semibold">
                Last 10
              </span>
              <span className="text-xs font-bold tabular-nums text-purple-400 mt-0.5">
                {formatTpsLabel(summary.rolling10Tps)}
              </span>
            </div>
            <div className="flex flex-col p-1 rounded bg-background/50">
              <span className="text-3xs text-muted-foreground uppercase font-semibold">
                Last 20
              </span>
              <span className="text-xs font-bold tabular-nums text-emerald-400 mt-0.5">
                {formatTpsLabel(summary.rolling20Tps)}
              </span>
            </div>
          </div>

          {/* Tool Latency Cadence */}
          {summary.avgToolDurationMs !== null ? (
            <div className="flex items-center justify-between text-2xs pt-1 border-t border-border/30">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ClockIcon className="size-3" />
                <span>Tool Roundtrip Cadence</span>
              </div>
              <span className="font-semibold tabular-nums text-foreground">
                {formatToolDuration(summary.avgToolDurationMs)} / call
              </span>
            </div>
          ) : null}

          {/* Sparkline */}
          {summary.tpsHistory.length >= 2 ? (
            <div className="flex flex-col gap-1 pt-1 border-t border-border/30">
              <div className="flex items-center justify-between text-3xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ActivityIcon className="size-2.5" />
                  <span>Velocity Trend (Last {summary.tpsHistory.length} turns)</span>
                </div>
              </div>
              <div className="flex items-center justify-center py-1">
                <MiniSparkline data={summary.tpsHistory} />
              </div>
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
