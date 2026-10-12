import type {
  EnvironmentId,
  ModelSelection,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
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
import { connectedBenchmarkCandidates } from "../../lib/modelBenchmarks";
import {
  contextWindowFigures,
  formatTokenCount,
  usageSeverity,
  usedPercentLabel,
} from "../../lib/usageLimitsPopover";
import { cn } from "../../lib/utils";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { environmentPresentations } from "../../state/presentation";
import { Button } from "../ui/button";
import { Popover, PopoverClose, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "../ui/preview-card";
import { Separator } from "../ui/separator";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ChatUsageHoverCard } from "./ChatUsageHoverCard";
import { DetailedContextBreakdownView } from "./DetailedContextBreakdownView";
import { ModelBenchmarksPanel } from "./ModelBenchmarksPanel";
import { ActiveAccount, OtherAccount } from "./UsageOverlayCard";
import { useConnectedUsageAccounts } from "../../hooks/useConnectedUsageAccounts";
import { useNowMinute } from "../../hooks/useNowMinute";
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
  providerEntries,
  onStartChat,
}: {
  readonly environmentId: EnvironmentId;
  readonly threadId?: ThreadId | null;
  readonly instanceId: ProviderInstanceId | null;
  readonly modelLabel: string;
  readonly effortLabel: string | null;
  readonly contextWindow: ContextWindowSnapshot | null;
  /** The environment's provider instances; their ready models fill the Benchmarks tab. */
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
  /** Opens a new chat in the current project with this model; null when there is no project. */
  readonly onStartChat: ((selection: ModelSelection) => void) | null;
}) {
  const navigate = useNavigate();
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const iconId = useClientSettings((settings) => settings.usageControlIcon);
  const updateSettings = useUpdateClientSettings();
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [view, setView] = useState<"summary" | "context-breakdown">("summary");
  const [chooseIcon, setChooseIcon] = useState(false);
  const [tab, setTab] = useState<"usage" | "benchmarks">("usage");
  const benchmarkCandidates = useMemo(
    () => connectedBenchmarkCandidates(providerEntries),
    [providerEntries],
  );

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

  const { active: activeAccounts, others: otherAccounts } = useConnectedUsageAccounts(
    environmentId,
    instanceId,
  );
  const activeAccountIds = useMemo(
    () => new Set(activeAccounts.map((account) => account.id)),
    [activeAccounts],
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

  const minute = useNowMinute();
  const now = Date.parse(`${minute}:00Z`);

  return (
    <Popover
      open={opened}
      onOpenChange={(open) => {
        setOpenedAt(open ? Date.now() : null);
        if (!open) {
          setChooseIcon(false);
          setView("summary");
          setTab("usage");
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
        className={
          tab === "benchmarks"
            ? "w-[min(40rem,calc(100vw-1.5rem))]"
            : "w-[min(21rem,calc(100vw-1.5rem))]"
        }
      >
        {view === "context-breakdown" && threadId ? (
          <DetailedContextBreakdownView
            environmentId={environmentId}
            threadId={threadId}
            onBack={() => setView("summary")}
          />
        ) : (
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              tab === "benchmarks"
                ? "max-h-[min(40rem,calc(100dvh-7.5rem))]"
                : "max-h-[min(30rem,calc(100dvh-7.5rem))]",
            )}
          >
            <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin]">
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

              <ToggleGroup
                aria-label="Panel view"
                className="w-full *:flex-1"
                value={[tab]}
                onValueChange={(next) => {
                  if (next[0] === "usage" || next[0] === "benchmarks") setTab(next[0]);
                }}
              >
                <Toggle value="usage">Usage</Toggle>
                <Toggle value="benchmarks">Benchmarks</Toggle>
              </ToggleGroup>

              {tab === "benchmarks" ? (
                <ModelBenchmarksPanel
                  environmentId={environmentId}
                  candidates={benchmarkCandidates}
                  onStartChat={
                    onStartChat
                      ? (selection) => {
                          setOpenedAt(null);
                          onStartChat(selection);
                        }
                      : null
                  }
                />
              ) : (
                <>
                  {/* SECTION 1: Context Window (FIRST!) */}
                  <section
                    className="flex min-w-0 flex-col rounded-xl border border-border/60 bg-muted/15"
                    aria-label="Context window"
                  >
                    <div className="flex min-w-0 flex-col gap-2 p-2.5">
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="font-semibold text-foreground">Context window</span>
                        {contextReported && contextPercent !== null ? (
                          <span className="tabular-nums font-medium text-foreground">
                            {contextPercent}%
                          </span>
                        ) : null}
                      </div>

                      <UsageBar
                        usedPercent={contextPercent ?? 0}
                        label={`Context: ${contextPercent ?? 0}% used`}
                      />

                      <div className="flex items-center justify-between gap-3 text-2xs tabular-nums text-muted-foreground">
                        <span>
                          {figures.state === "reported"
                            ? `${formatTokenCount(figures.usedTokens)} / ${figures.maxTokens ? formatTokenCount(figures.maxTokens) : "unlimited"} tokens`
                            : figures.state === "pending"
                              ? `Not reported / ${formatTokenCount(figures.maxTokens)} tokens`
                              : "Not reported yet"}
                        </span>
                        {figures.state === "reported" && figures.maxTokens ? (
                          <span>
                            {formatTokenCount(Math.max(0, figures.maxTokens - figures.usedTokens))}{" "}
                            left
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {threadId ? (
                      <button
                        type="button"
                        onClick={() => setView("context-breakdown")}
                        className="group flex cursor-pointer items-center justify-between gap-2 rounded-b-xl border-t border-border/50 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:text-foreground focus-visible:outline-none"
                      >
                        <span>See what is using context</span>
                        <ChevronRightIcon
                          aria-hidden
                          className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                        />
                      </button>
                    ) : null}
                  </section>

                  <Separator />

                  {/* SECTION 2: Active Account Limits */}
                  <section className="flex min-w-0 flex-col gap-2.5" aria-label="Active account">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <span aria-hidden className="size-1.5 rounded-full bg-success" />
                        Active account
                      </span>
                      {modelLabel ? (
                        <span className="truncate text-2xs text-muted-foreground">
                          {modelLabel}
                        </span>
                      ) : null}
                    </div>

                    {activeAccounts.length > 0 ? (
                      activeAccounts.map((account) => (
                        <ActiveAccount key={account.id} account={account} now={now} />
                      ))
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
                          <span className="text-xs font-semibold text-foreground">
                            Other accounts
                          </span>
                          <span className="text-2xs text-muted-foreground tabular-nums">
                            {otherAccounts.length}
                          </span>
                        </div>

                        <div className="flex justify-end gap-2 text-2xs text-muted-foreground">
                          <span className="w-9 text-right">Session</span>
                          <span className="w-9 text-right">Week</span>
                        </div>
                        <ul className="flex flex-col gap-2">
                          {otherAccounts.slice(0, 4).map((account) => (
                            <OtherAccount key={account.id} account={account} />
                          ))}
                        </ul>
                        {otherAccounts.length > 4 ? (
                          <Button size="xs" variant="link" onClick={openDetails}>
                            +{otherAccounts.length - 4} more accounts
                          </Button>
                        ) : null}
                      </section>
                    </>
                  ) : null}

                  <Separator />

                  {/* Bottom Actions */}
                  <div className="flex shrink-0 flex-col gap-2 pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
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
                                  onClick={() =>
                                    void updateSettings({ usageControlIcon: option.id })
                                  }
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
                </>
              )}
            </div>
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
});
