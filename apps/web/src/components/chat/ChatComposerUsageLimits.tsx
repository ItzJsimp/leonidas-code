import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import {
  ActivityIcon,
  BatteryMediumIcon,
  ChartNoAxesColumnIncreasingIcon,
  GaugeIcon,
  LayersIcon,
  XIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import { collectConnectedUsageLimits } from "../../lib/connectedUsageLimits";
import { usageSeverity, usedPercentLabel } from "../../lib/usageLimitsPopover";
import { cn } from "../../lib/utils";
import { environmentPresentations } from "../../state/presentation";
import { Button } from "../ui/button";
import { Popover, PopoverClose, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ContextWindowRow, PlanUsageAccounts } from "./PlanUsageLimits";

const ICONS = [
  { id: "chart", label: "Usage chart", Icon: ChartNoAxesColumnIncreasingIcon },
  { id: "gauge", label: "Gauge", Icon: GaugeIcon },
  { id: "activity", label: "Activity", Icon: ActivityIcon },
  { id: "battery", label: "Battery", Icon: BatteryMediumIcon },
  { id: "layers", label: "Account layers", Icon: LayersIcon },
] as const;
const TRIGGER_TINT = {
  normal: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-destructive",
} as const;

/** Chat details and all connected subscription accounts in a bounded composer popover. */
export const ChatComposerUsageLimits = memo(function ChatComposerUsageLimits({
  environmentId,
  instanceId,
  modelLabel,
  effortLabel,
  contextWindow,
}: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId | null;
  readonly modelLabel: string;
  readonly effortLabel: string | null;
  readonly contextWindow: ContextWindowSnapshot | null;
}) {
  const navigate = useNavigate();
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const iconId = useClientSettings((settings) => settings.usageControlIcon);
  const updateSettings = useUpdateClientSettings();
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [chooseIcon, setChooseIcon] = useState(false);
  const report = useMemo(
    () =>
      collectConnectedUsageLimits(
        new Map(
          [...presentations].filter(
            ([, presentation]) =>
              presentation.connection.phase === "connected" ||
              presentation.connection.phase === "available",
          ),
        ),
        openedAt ?? 0,
      ),
    [presentations, openedAt],
  );
  const activeProvider = presentations
    .get(environmentId)
    ?.serverConfig?.providers.find((provider) => provider.instanceId === instanceId);
  const activeEmail = activeProvider?.auth.email?.trim().toLowerCase();
  const activeAccounts = report.accounts.filter(
    (account) =>
      account.driver === activeProvider?.driver &&
      (activeEmail
        ? account.email?.trim().toLowerCase() === activeEmail
        : activeProvider?.usageLimits?.credentialFingerprint
          ? account.limits.credentialFingerprint ===
            activeProvider.usageLimits.credentialFingerprint
          : account.id === `${environmentId}:${instanceId}`),
  );
  // The trigger warns about this chat's account, rather than an unrelated subscription.
  const percentages = activeAccounts.flatMap((account) =>
    account.limits.unavailable ? [] : account.limits.windows.map((window) => window.usedPercent),
  );
  const peak = percentages.length ? Math.max(...percentages) : null;
  const severity = peak === null ? "normal" : usageSeverity(peak);
  const label =
    peak === null
      ? "Accounts, usage and context"
      : `Accounts, usage and context: current account up to ${usedPercentLabel(peak)}% used`;
  const Icon =
    ICONS.find((option) => option.id === iconId)?.Icon ?? ChartNoAxesColumnIncreasingIcon;
  const openDetails = () => {
    setOpenedAt(null);
    void navigate({ to: "/usage" });
  };

  return (
    <Popover
      open={openedAt !== null}
      onOpenChange={(open) => {
        setOpenedAt(open ? Date.now() : null);
        if (!open) setChooseIcon(false);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  aria-label={label}
                  size="icon-sm"
                  variant="ghost"
                  className="relative"
                />
              }
            />
          }
        >
          <Icon aria-hidden className={cn(TRIGGER_TINT[severity])} />
          {severity !== "normal" ? (
            <span
              aria-hidden
              className={cn(
                "absolute right-1 top-1 size-1.5 rounded-full",
                severity === "critical" ? "bg-destructive" : "bg-warning",
              )}
            />
          ) : null}
        </TooltipTrigger>
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
      <PopoverPopup
        aria-label="Accounts, usage and context"
        side="top"
        align="end"
        width="lg"
        padding="compact"
      >
        <div className="flex max-h-[min(32rem,65dvh)] min-w-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 pb-3 pt-1">
            <span className="text-sm font-semibold">Accounts & usage</span>
            <PopoverClose
              render={<Button size="icon-xs" variant="ghost" aria-label="Close usage panel" />}
            >
              <XIcon aria-hidden />
            </PopoverClose>
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-3 [scrollbar-width:thin]">
            <section className="flex min-w-0 flex-col gap-2" aria-label="This chat">
              <div className="text-sm font-semibold">This chat</div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="break-words font-medium">
                  {modelLabel || "Model not selected"}
                </span>
                {effortLabel ? (
                  <span className="text-xs text-muted-foreground">{effortLabel}</span>
                ) : null}
              </div>
              <span className="break-words text-xs text-muted-foreground">
                {activeProvider?.displayName || activeProvider?.driver || "Provider not selected"}
              </span>
              {contextWindow ? (
                <ContextWindowRow usage={contextWindow} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  Context usage not reported yet.
                </span>
              )}
            </section>
            <Separator />
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>Connected accounts</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {report.accounts.length}
              </span>
            </div>
            {report.accounts.length ? (
              <PlanUsageAccounts
                report={report}
                onOpenDetails={openDetails}
                activeAccountIds={new Set(activeAccounts.map((account) => account.id))}
              />
            ) : (
              <span className="text-xs text-muted-foreground">
                No connected accounts reported yet.
              </span>
            )}
            {!report.accounts.length
              ? report.notices.map((notice) => (
                  <span key={notice} className="text-xs text-warning">
                    {notice}
                  </span>
                ))
              : null}
          </div>
          <Separator />
          <div className="flex shrink-0 flex-col gap-2 pt-3 pb-1">
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="secondary" onClick={openDetails}>
                Detailed breakdown
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={chooseIcon}
                onClick={() => setChooseIcon((value) => !value)}
              >
                Change icon
              </Button>
            </div>
            {chooseIcon ? (
              <div role="group" aria-label="Usage button icon" className="flex items-center gap-2">
                {ICONS.map((option) => (
                  <Tooltip key={option.id}>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon-sm"
                          variant={option.id === iconId ? "secondary" : "ghost"}
                          aria-label={option.label}
                          aria-pressed={option.id === iconId}
                          onClick={() => void updateSettings({ usageControlIcon: option.id })}
                        />
                      }
                    >
                      <option.Icon aria-hidden />
                    </TooltipTrigger>
                    <TooltipPopup side="top">{option.label}</TooltipPopup>
                  </Tooltip>
                ))}
                <span className="text-xs text-muted-foreground">
                  {ICONS.find((option) => option.id === iconId)?.label}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
});
