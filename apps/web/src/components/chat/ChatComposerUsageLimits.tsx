import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import {
  ActivityIcon,
  BatteryMediumIcon,
  ChartNoAxesColumnIncreasingIcon,
  CpuIcon,
  GaugeIcon,
  LayersIcon,
  MessageSquareIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import { collectConnectedUsageLimits } from "../../lib/connectedUsageLimits";
import { usageSeverity, usedPercentLabel } from "../../lib/usageLimitsPopover";
import { cn } from "../../lib/utils";
import { environmentPresentations } from "../../state/presentation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Popover, PopoverClose, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ChatUsageHoverCard } from "./ChatUsageHoverCard";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { ContextSummary, PlanUsageAccounts, UsageRing } from "./PlanUsageLimits";

const ICONS = [
  { id: "chart", label: "Usage chart", Icon: ChartNoAxesColumnIncreasingIcon },
  { id: "gauge", label: "Gauge", Icon: GaugeIcon },
  { id: "activity", label: "Activity", Icon: ActivityIcon },
  { id: "battery", label: "Battery", Icon: BatteryMediumIcon },
  { id: "layers", label: "Account layers", Icon: LayersIcon },
] as const;

/**
 * The panel opens in the top-right corner of the window, under the header: the chat
 * column is centred, so the right gutter is the one place it never covers the text.
 * The trigger stays beside Send; only the panel is anchored away from it.
 */
const PANEL_TOP_PX = 56;
const PANEL_EDGE_PX = 12;
const topRightAnchor = {
  getBoundingClientRect: () => new DOMRect(window.innerWidth - PANEL_EDGE_PX, PANEL_TOP_PX, 0, 0),
};

function SectionHeading({
  icon: SectionIcon,
  title,
  count,
}: {
  readonly icon: typeof MessageSquareIcon;
  readonly title: string;
  readonly count?: number;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <SectionIcon aria-hidden className="size-4 text-muted-foreground" />
      {title}
      {count === undefined ? null : (
        <span className="ms-auto text-xs font-normal text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
    </h3>
  );
}

/** Chat details and all connected subscription accounts, in a panel that stays out of the chat. */
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
  const activeAccountIds = useMemo(
    () => new Set(activeAccounts.map((account) => account.id)),
    [activeAccounts],
  );
  // The warning dot follows this chat's account, rather than an unrelated subscription.
  const percentages = activeAccounts.flatMap((account) =>
    account.limits.unavailable ? [] : account.limits.windows.map((window) => window.usedPercent),
  );
  const peak = percentages.length ? Math.max(...percentages) : null;
  const accountSeverity = peak === null ? "normal" : usageSeverity(peak);
  const contextPercent =
    contextWindow?.usedPercentage == null ? null : usedPercentLabel(contextWindow.usedPercentage);
  const contextReported =
    contextWindow !== null && contextWindow.updatedAt !== new Date(0).toISOString();
  const contextSeverity = contextPercent === null ? "normal" : usageSeverity(contextPercent);
  const details = [
    contextReported && contextPercent !== null ? `context ${contextPercent}% used` : null,
    peak !== null ? `current account up to ${usedPercentLabel(peak)}% used` : null,
  ]
    .filter((part) => part !== null)
    .join(", ");
  const label = details ? `Accounts, usage and context: ${details}` : "Accounts, usage and context";
  const Icon =
    ICONS.find((option) => option.id === iconId)?.Icon ?? ChartNoAxesColumnIncreasingIcon;
  const opened = openedAt !== null;
  const openDetails = () => {
    setOpenedAt(null);
    void navigate({ to: "/usage" });
  };

  return (
    <Popover
      open={opened}
      onOpenChange={(open) => {
        setOpenedAt(open ? Date.now() : null);
        if (!open) setChooseIcon(false);
      }}
    >
      <Tooltip disabled={opened}>
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
          <UsageRing
            percent={contextReported ? contextPercent : null}
            size={24}
            strokeWidth={2.5}
            severity={contextSeverity}
          >
            <Icon aria-hidden className="size-3 text-muted-foreground" />
          </UsageRing>
          {accountSeverity !== "normal" ? (
            <span
              aria-hidden
              className={cn(
                "absolute right-0.5 top-0.5 size-2 rounded-full ring-2 ring-background",
                accountSeverity === "critical" ? "bg-destructive" : "bg-warning",
              )}
            />
          ) : null}
        </TooltipTrigger>
        <TooltipPopup side="top" align="end" className="max-w-none">
          <ChatUsageHoverCard
            modelLabel={modelLabel}
            effortLabel={effortLabel}
            contextWindow={contextWindow}
            accounts={report.accounts}
            activeAccountIds={activeAccountIds}
          />
        </TooltipPopup>
      </Tooltip>
      <PopoverPopup
        aria-label="Accounts, usage and context"
        anchor={topRightAnchor}
        side="bottom"
        align="end"
        sideOffset={0}
        padding="compact"
        className="w-[min(26rem,calc(100vw-1.5rem))]"
      >
        <div className="flex max-h-[min(44rem,calc(100dvh-7.5rem))] min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 pb-3 pt-1">
            <span className="text-sm font-semibold">Usage</span>
            <PopoverClose
              render={<Button size="icon-xs" variant="ghost" aria-label="Close usage panel" />}
            >
              <XIcon aria-hidden />
            </PopoverClose>
          </div>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pb-3 [scrollbar-width:thin]">
            <section className="flex min-w-0 flex-col gap-3" aria-label="This chat">
              <SectionHeading icon={MessageSquareIcon} title="This chat" />
              <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-muted/30 p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {activeProvider ? (
                    <ProviderInstanceIcon
                      driverKind={activeProvider.driver}
                      displayName={activeProvider.displayName || String(activeProvider.driver)}
                      iconClassName="size-5"
                    />
                  ) : (
                    <CpuIcon aria-hidden className="size-5 text-muted-foreground" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="break-words text-sm font-semibold">
                      {modelLabel || "Model not selected"}
                    </span>
                    <span className="break-words text-xs text-muted-foreground">
                      {activeProvider?.displayName ||
                        activeProvider?.driver ||
                        "Provider not selected"}
                    </span>
                  </div>
                  {effortLabel ? (
                    <Badge variant="outline" size="sm">
                      {effortLabel}
                    </Badge>
                  ) : null}
                </div>
                {contextWindow ? (
                  <ContextSummary usage={contextWindow} />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Context usage not reported yet.
                  </span>
                )}
              </div>
            </section>
            <Separator />
            <section className="flex min-w-0 flex-col gap-3" aria-label="Connected accounts">
              <SectionHeading
                icon={UsersIcon}
                title="Connected accounts"
                count={report.accounts.length}
              />
              {report.accounts.length ? (
                <PlanUsageAccounts
                  report={report}
                  onOpenDetails={openDetails}
                  activeAccountIds={activeAccountIds}
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
            </section>
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
