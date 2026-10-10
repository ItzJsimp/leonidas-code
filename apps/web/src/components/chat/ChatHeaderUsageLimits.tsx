import type {
  ProviderInstanceId,
  ServerProvider,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { collectProviderUsageLimits } from "@t3tools/shared/usageLimits";
import { GaugeIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";

import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import { peakUsedPercent, usageSeverity, usedPercentLabel } from "../../lib/usageLimitsPopover";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ContextWindowRow, PlanUsageAccounts } from "./PlanUsageLimits";

const TRIGGER_TINT = {
  normal: undefined,
  warning: "text-warning",
  critical: "text-destructive",
} as const;

/**
 * The header's one-click view of /usage-limits for the thread's provider,
 * laid out like Claude's usage popover: context window, then plan limits. The
 * caller renders it only where Limits has data for that provider. Only the
 * open moment is stored: the rows read live provider data while it stays open.
 */
export const ChatHeaderUsageLimits = memo(function ChatHeaderUsageLimits({
  instanceId,
  providers,
  sources,
  contextWindow = null,
}: {
  readonly instanceId: ProviderInstanceId;
  readonly providers: readonly ServerProvider[];
  readonly sources: UsageLimitSourceSnapshots;
  /** The thread's context window usage; null hides the row. */
  readonly contextWindow?: ContextWindowSnapshot | null;
}) {
  const navigate = useNavigate();
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  // Collected only while open, so provider updates cost nothing when closed.
  const report = useMemo(
    () =>
      openedAt === null
        ? null
        : collectProviderUsageLimits(instanceId, providers, sources, openedAt),
    [instanceId, openedAt, providers, sources],
  );
  // A single pass over the windows so the closed trigger can warn at a glance.
  const peak = useMemo(
    () => peakUsedPercent(instanceId, providers, sources),
    [instanceId, providers, sources],
  );
  const severity = peak === null ? "normal" : usageSeverity(peak);
  const triggerLabel =
    peak === null ? "Usage limits" : `Usage limits: ${usedPercentLabel(peak)}% used at most`;

  return (
    <Popover
      open={openedAt !== null}
      onOpenChange={(open) => setOpenedAt(open ? Date.now() : null)}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button aria-label={triggerLabel} size="icon-xs" variant="ghost" />}
            />
          }
        >
          <GaugeIcon aria-hidden className={cn(TRIGGER_TINT[severity])} />
        </TooltipTrigger>
        <TooltipPopup side="bottom">{triggerLabel}</TooltipPopup>
      </Tooltip>
      <PopoverPopup
        aria-label="Usage limits"
        side="bottom"
        align="end"
        width="lg"
        padding="compact"
      >
        <div className="flex flex-col gap-3">
          {contextWindow ? (
            <>
              <ContextWindowRow usage={contextWindow} />
              <Separator />
            </>
          ) : null}
          {report ? (
            <PlanUsageAccounts report={report} />
          ) : (
            <span className="text-xs text-muted-foreground">No usage limits reported.</span>
          )}
          <Button
            size="xs"
            variant="ghost-muted"
            className="self-start"
            onClick={() => {
              setOpenedAt(null);
              void navigate({ to: "/usage" });
            }}
          >
            See detailed breakdown
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
});
