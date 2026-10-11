import type { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import {
  ActivityIcon,
  BatteryMediumIcon,
  ChartNoAxesColumnIncreasingIcon,
  ChevronRightIcon,
  GaugeIcon,
  LayersIcon,
  XIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import { collectConnectedUsageLimits } from "../../lib/connectedUsageLimits";
import {
  accountTitle,
  contextWindowFigures,
  formatResetCountdown,
  formatTokenCount,
  limitLabel,
  orderPlanWindows,
  percentText,
  shortPlanName,
  usageSeverity,
  usedPercentLabel,
} from "../../lib/usageLimitsPopover";
import { cn } from "../../lib/utils";
import { environmentPresentations } from "../../state/presentation";
import { Button } from "../ui/button";
import { Popover, PopoverClose, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "../ui/preview-card";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ChatUsageHoverCard } from "./ChatUsageHoverCard";
import { DetailedContextBreakdownView } from "./DetailedContextBreakdownView";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { UsageBar, UsageRing } from "./PlanUsageLimits";

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

/** Chat details and all connected subscription accounts, in a panel that stays out of the chat. */
export const ChatComposerUsageLimits = memo(function ChatComposerUsageLimits({
  environmentId,
  threadId,
  instanceId,
  modelLabel,
  effortLabel,
  contextWindow,
}: {
  readonly environmentId: EnvironmentId;
  readonly threadId?: ThreadId | null;
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
  const [hoverOpen, setHoverOpen] = useState(false);
  const [view, setView] = useState<"summary" | "context-breakdown">("summary");
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

  const otherAccounts = useMemo(
    () => report.accounts.filter((account) => !activeAccountIds.has(account.id)),
    [report.accounts, activeAccountIds],
  );

  const percentages = activeAccounts.flatMap((account) =>
    account.limits.unavailable ? [] : account.limits.windows.map((window) => window.usedPercent),
  );
  const peak = percentages.length ? Math.max(...percentages) : null;
  const accountSeverity = peak === null ? "normal" : usageSeverity(peak);

  const figures = contextWindowFigures(contextWindow);
  const contextPercent =
    figures.state === "reported" && figures.usedPercent != null
      ? usedPercentLabel(figures.usedPercent)
      : null;
  const contextReported = figures.state === "reported";
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

  const handleOpenPanel = () => {
    setHoverOpen(false);
    setOpenedAt(Date.now());
  };

  const now = Date.now();

  return (
    <Popover
      open={opened}
      onOpenChange={(open) => {
        setOpenedAt(open ? Date.now() : null);
        if (!open) {
          setChooseIcon(false);
          setView("summary");
        }
      }}
    >
      <PreviewCard open={hoverOpen && !opened} onOpenChange={setHoverOpen}>
        <PreviewCardTrigger
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
        </PreviewCardTrigger>
        <PreviewCardPopup side="top" align="end">
          <ChatUsageHoverCard
            modelLabel={modelLabel}
            effortLabel={effortLabel}
            contextWindow={contextWindow}
            accounts={report.accounts}
            activeAccountIds={activeAccountIds}
            onOpenFull={handleOpenPanel}
          />
        </PreviewCardPopup>
      </PreviewCard>

      <PopoverPopup
        aria-label="Accounts, usage and context"
        anchor={topRightAnchor}
        side="bottom"
        align="end"
        sideOffset={0}
        padding="compact"
        className="w-[min(26rem,calc(100vw-1.5rem))]"
      >
        {view === "context-breakdown" && threadId ? (
          <DetailedContextBreakdownView
            environmentId={environmentId}
            threadId={threadId}
            onBack={() => setView("summary")}
          />
        ) : (
          <div className="flex max-h-[min(30rem,calc(100dvh-7.5rem))] min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin]">
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <Icon aria-hidden className="size-4 text-muted-foreground" />
                  Context & Usage
                </h3>
                <PopoverClose
                  render={<Button size="icon-xs" variant="ghost" aria-label="Close usage panel" />}
                >
                  <XIcon aria-hidden />
                </PopoverClose>
              </div>

              {/* SECTION 1: Context Window (FIRST!) */}
              <section
                className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/60 bg-muted/15 p-3.5"
                aria-label="Context window"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Context window</span>
                  {contextReported && contextPercent !== null ? (
                    <span className="text-2xs tabular-nums text-muted-foreground">
                      {contextPercent}% used
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                  <span>
                    {figures.state === "reported"
                      ? `${formatTokenCount(figures.usedTokens)} / ${figures.maxTokens ? formatTokenCount(figures.maxTokens) : "unlimited"} tokens`
                      : figures.state === "pending"
                        ? `0 / ${formatTokenCount(figures.maxTokens)} tokens`
                        : "Not reported yet"}
                  </span>
                  {figures.state === "reported" && figures.maxTokens ? (
                    <span>
                      {formatTokenCount(Math.max(0, figures.maxTokens - figures.usedTokens))} left
                    </span>
                  ) : null}
                </div>

                <UsageBar
                  usedPercent={contextPercent ?? 0}
                  label={`Context: ${contextPercent ?? 0}% used`}
                />

                {threadId ? (
                  <button
                    type="button"
                    onClick={() => setView("context-breakdown")}
                    className="mt-1 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                  >
                    <span className="font-medium">Detailed breakdown</span>
                    <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                  </button>
                ) : null}
              </section>

              <Separator />

              {/* SECTION 2: Active Account Limits */}
              <section className="flex min-w-0 flex-col gap-2.5" aria-label="Active account">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Active account</span>
                  {modelLabel ? (
                    <span className="truncate text-2xs text-muted-foreground">{modelLabel}</span>
                  ) : null}
                </div>

                {activeAccounts.length > 0 ? (
                  activeAccounts.map((account) => {
                    const title = accountTitle(
                      { displayName: account.displayName, sourceLabel: account.sourceLabel },
                      account.displayName ?? account.label,
                    );
                    const windows = orderPlanWindows(account.limits.windows);
                    return (
                      <div
                        key={account.id}
                        className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/60 p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ProviderInstanceIcon
                              driverKind={account.driver}
                              displayName={title}
                              iconClassName="size-4"
                            />
                            <span className="truncate text-xs font-semibold text-foreground">
                              {title}
                            </span>
                          </div>
                          {account.plan ? (
                            <span className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs text-muted-foreground">
                              {shortPlanName(account.plan)}
                            </span>
                          ) : null}
                        </div>

                        {windows.length === 0 ? (
                          <span className="text-2xs text-muted-foreground">
                            Limits pending for this account.
                          </span>
                        ) : (
                          windows.map((window) => {
                            const label = limitLabel(window, "panel");
                            const countdown = formatResetCountdown(window.resetsAt, now);
                            const used = usedPercentLabel(window.usedPercent);
                            return (
                              <div key={window.id} className="flex min-w-0 flex-col gap-1">
                                <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs">
                                  <span className="min-w-0 break-words text-muted-foreground">
                                    {label}
                                  </span>
                                  <span className="shrink-0 tabular-nums font-medium text-foreground">
                                    {used}%
                                  </span>
                                </div>
                                <UsageBar
                                  usedPercent={window.usedPercent}
                                  label={`${label}: ${used}% used`}
                                  className="h-1"
                                />
                                {countdown ? (
                                  <span className="text-2xs text-muted-foreground">
                                    {countdown} · {percentText(window.usedPercent, "left")}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                    No active subscription account linked to current model provider.
                  </div>
                )}
              </section>

              {/* SECTION 3: Compact Other Accounts (2-3 visible at once) */}
              {otherAccounts.length > 0 ? (
                <>
                  <Separator />
                  <section className="flex min-w-0 flex-col gap-2" aria-label="Other accounts">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Other accounts</span>
                      <span className="text-2xs text-muted-foreground tabular-nums">
                        {otherAccounts.length}
                      </span>
                    </div>

                    <div className="flex max-h-36 min-w-0 flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
                      {otherAccounts.map((account) => {
                        const title = accountTitle(
                          { displayName: account.displayName, sourceLabel: account.sourceLabel },
                          account.displayName ?? account.label,
                        );
                        const windows = orderPlanWindows(account.limits.windows);
                        return (
                          <div
                            key={account.id}
                            className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/50 p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <ProviderInstanceIcon
                                  driverKind={account.driver}
                                  displayName={title}
                                  iconClassName="size-3.5"
                                />
                                <span className="truncate font-medium text-foreground">
                                  {title}
                                </span>
                              </div>
                              {account.plan ? (
                                <span className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs text-muted-foreground">
                                  {shortPlanName(account.plan)}
                                </span>
                              ) : null}
                            </div>
                            {windows.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {windows.slice(0, 2).map((window) => (
                                  <div key={window.id} className="flex min-w-0 items-center gap-2">
                                    <span className="w-16 shrink-0 truncate text-2xs text-muted-foreground">
                                      {limitLabel(window, "glance")}
                                    </span>
                                    <UsageBar
                                      usedPercent={window.usedPercent}
                                      label={`${limitLabel(window, "glance")}: ${usedPercentLabel(window.usedPercent)}%`}
                                      className="h-1 min-w-0 flex-1"
                                    />
                                    <span className="w-8 shrink-0 text-right text-2xs tabular-nums text-foreground">
                                      {usedPercentLabel(window.usedPercent)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : null}

              <Separator />

              {/* Bottom Actions */}
              <div className="flex shrink-0 flex-col gap-2 pb-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {threadId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setView("context-breakdown")}
                      >
                        Context breakdown
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={openDetails}>
                      Usage overview
                    </Button>
                  </div>
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
                  <div
                    role="group"
                    aria-label="Usage button icon"
                    className="flex items-center gap-2 pt-1"
                  >
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
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
});
