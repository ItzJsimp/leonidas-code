import { Button } from "../ui/button";
import { type ContextWindowSnapshot, formatContextWindowTokens } from "~/lib/contextWindow";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "../ui/preview-card";
import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import { usageSeverity } from "../../lib/usageLimitsPopover";
import {
  formatContextWindowCompactionMessage,
  formatContextWindowCost,
} from "./ContextWindowMeter.logic";
import { Minimize2Icon } from "lucide-react";
import { formatTpsLabel } from "./AgentVelocityMeter.logic";
import { composerFloatingLayerProps } from "./composerEventScope";
import { InputLedger, SpeedSection, type ThreadTarget } from "./AgentVelocityMeter";
import type { VelocitySummary } from "./AgentVelocityMeter.logic";

const SEVERITY_COLOR = {
  normal: "var(--color-info)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
} as const;

function formatPercentage(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

/**
 * The composer's one usage control, beside Send: a context ring with the tokens in context.
 * Hover shows context, speed and input in one card; click shows or hides the usage card over
 * the chat's top-left corner.
 */
export function ContextWindowMeter(props: {
  usage: ContextWindowSnapshot | null;
  velocity?: VelocitySummary | null | undefined;
  modelDisplayName?: string | null;
  onCompact?: (() => void) | undefined;
  compactDisabled?: boolean | undefined;
  compactDisabledReason?: string | null | undefined;
  threadTarget?: ThreadTarget | null | undefined;
}) {
  const { modelDisplayName, onCompact, compactDisabled, compactDisabledReason } = props;
  const { usage, velocity } = props;
  const cardOpen = useClientSettings((settings) => settings.usageOverlayEnabled);
  const updateSettings = useUpdateClientSettings();
  const usedPercentage = formatPercentage(usage?.usedPercentage ?? null);
  const normalizedPercentage = Math.max(0, Math.min(100, usage?.usedPercentage ?? 0));
  const radius = 9.75;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalizedPercentage / 100);
  const totalProcessedTokens = usage?.totalProcessedTokens ?? null;
  const showTotalProcessed = totalProcessedTokens !== null && totalProcessedTokens > 0;
  const usageColor = SEVERITY_COLOR[usageSeverity(normalizedPercentage)];

  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={150}
        closeDelay={onCompact ? 150 : 0}
        render={
          <Button
            size="compact"
            variant="ghost-muted"
            className="shrink-0"
            aria-pressed={cardOpen}
            onClick={() => void updateSettings({ usageOverlayEnabled: !cardOpen })}
            aria-label={`${
              usage === null
                ? "Context window not reported yet"
                : usage.maxTokens !== null && usedPercentage
                  ? `Context window ${usedPercentage} used`
                  : `Context window ${formatContextWindowTokens(usage.usedTokens)} tokens used`
            }${velocity?.modelStreamTps != null || velocity?.averageTurnTps != null ? `, last turn ${formatTpsLabel(velocity.modelStreamTps ?? velocity.averageTurnTps)}` : ""}. ${cardOpen ? "Hide" : "Show"} usage card`}
          >
            <span className="relative flex size-4 items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="-rotate-90 absolute inset-0 size-full transform-gpu mx-0!"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  className="stroke-muted-foreground/24"
                  strokeWidth="3"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke={usageColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-[stroke-dashoffset,stroke] duration-500 ease-out motion-reduce:transition-none"
                />
              </svg>
            </span>
            <span className="text-2xs tabular-nums" aria-hidden>
              {usage === null ? "--" : formatContextWindowTokens(usage.usedTokens)}
            </span>
          </Button>
        }
      />
      <PreviewCardPopup
        {...composerFloatingLayerProps}
        side="top"
        align="end"
        className="w-72 text-left whitespace-normal"
      >
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-muted-foreground text-xs">Context Window</div>
            {usage === null ? (
              <div className="text-secondary-label text-2xs">Not reported yet</div>
            ) : usage.maxTokens !== null && usedPercentage ? (
              <div className="text-secondary-label text-2xs tabular-nums">
                <span>{usedPercentage}</span>
                <span className="mx-1">·</span>
                <span>
                  {formatContextWindowTokens(usage.usedTokens)}/
                  {formatContextWindowTokens(usage.maxTokens ?? null)}
                </span>
              </div>
            ) : (
              <div className="text-secondary-label text-2xs tabular-nums">
                {formatContextWindowTokens(usage.usedTokens)}
              </div>
            )}
          </div>
          {usage !== null && usage.maxTokens !== null ? (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(normalizedPercentage)}
              aria-label="Context window usage"
            >
              <div
                className="h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${normalizedPercentage}%`, backgroundColor: usageColor }}
              />
            </div>
          ) : null}
          {showTotalProcessed ? (
            <div className="flex items-center justify-between gap-3 text-2xs leading-4">
              <span className="text-secondary-label">Total processed</span>
              <span className="font-medium tabular-nums text-secondary-label">
                {formatContextWindowTokens(totalProcessedTokens)}
              </span>
            </div>
          ) : null}
          {usage?.cost != null ? (
            <div className="flex items-center justify-between gap-3 text-2xs leading-4">
              <span className="text-secondary-label">Cost</span>
              <span className="font-medium tabular-nums text-secondary-label">
                {formatContextWindowCost(usage.cost)}
              </span>
            </div>
          ) : null}
          {usage?.compactsAutomatically ? (
            <div className="mt-1 text-pretty text-secondary-label text-2xs font-medium">
              {formatContextWindowCompactionMessage(modelDisplayName, usage.autoCompactThreshold)}
            </div>
          ) : null}
          {velocity ? <SpeedSection summary={velocity} /> : null}
          {velocity?.ledger ? (
            <InputLedger
              ledger={velocity.ledger}
              cacheBreak={velocity.cacheBreak}
              threadTarget={props.threadTarget ?? null}
              contextTokens={usage?.usedTokens ?? null}
            />
          ) : null}
          {onCompact ? (
            <>
              <Button
                size="xs"
                variant="outline"
                className="mt-1 w-full justify-center"
                disabled={compactDisabled}
                onClick={onCompact}
              >
                <Minimize2Icon aria-hidden="true" />
                Compact context
              </Button>
              {compactDisabled && compactDisabledReason ? (
                <div className="text-pretty text-secondary-label text-2xs">
                  {compactDisabledReason}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
