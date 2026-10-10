import type {
  EnvironmentId,
  ProviderInstanceId,
  ServerProvider,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { collectProviderUsageLimits } from "@t3tools/shared/usageLimits";
import { GaugeIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { UsageLimitsAccounts, UsageLimitsSummary } from "./ComposerUsageLimits";

/**
 * The header's one-click view of /usage-limits for the thread's provider. The
 * caller renders it only where Limits has data for that provider. Only the
 * open moment is stored: the rows read live provider data while it stays open.
 */
export const ChatHeaderUsageLimits = memo(function ChatHeaderUsageLimits({
  environmentId,
  instanceId,
  providers,
  sources,
}: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly providers: readonly ServerProvider[];
  readonly sources: UsageLimitSourceSnapshots;
}) {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  // Collected only while open, so provider updates cost nothing when closed.
  const report = useMemo(
    () =>
      openedAt === null
        ? null
        : collectProviderUsageLimits(instanceId, providers, sources, openedAt),
    [instanceId, openedAt, providers, sources],
  );
  return (
    <Popover
      open={openedAt !== null}
      onOpenChange={(open) => setOpenedAt(open ? Date.now() : null)}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button aria-label="Show usage limits" size="icon-xs" variant="ghost" />}
            />
          }
        >
          <GaugeIcon aria-hidden />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Usage limits</TooltipPopup>
      </Tooltip>
      <PopoverPopup side="bottom" align="end" width="lg" padding="compact">
        <div className="flex flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <PopoverTitle>Usage limits</PopoverTitle>
            {report ? (
              <span className="truncate text-xs text-muted-foreground">
                <UsageLimitsSummary report={report} />
              </span>
            ) : null}
          </div>
          {report ? (
            <UsageLimitsAccounts report={report} environmentId={environmentId} redeemable={false} />
          ) : (
            <span className="text-xs text-muted-foreground">No usage limits reported.</span>
          )}
        </div>
      </PopoverPopup>
    </Popover>
  );
});
