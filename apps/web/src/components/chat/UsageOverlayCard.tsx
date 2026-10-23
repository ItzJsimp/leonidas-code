import type {
  EnvironmentId,
  ModelSelection,
  ProviderInstanceId,
  ThreadId,
  UsageLimitsReport,
} from "@t3tools/contracts";
import { refreshUsageLimits } from "@t3tools/client-runtime/state/usage";
import { limitsNotice } from "@t3tools/shared/usageLimits";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import { useConnectedUsageAccounts } from "../../hooks/useConnectedUsageAccounts";
import { type LimitView, useLimitView } from "../../hooks/useLimitView";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useUpdateClientSettings } from "../../hooks/useSettings";
import { connectedBenchmarkCandidates } from "../../lib/modelBenchmarks";
import type { ProviderInstanceEntry } from "../../providerInstances";
import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import {
  accountTitle,
  contextWindowFigures,
  formatResetCountdown,
  formatTokenCount,
  glanceLimitRows,
  limitsFreshness,
  percentText,
  usageSeverity,
  usedPercentLabel,
} from "../../lib/usageLimitsPopover";
import { cn } from "../../lib/utils";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { useThreadContextBreakdown } from "../../state/queries";
import { Button } from "../ui/button";
import { RefreshIcon } from "../ui/refresh-icon";
import { Dialog, DialogPanel, DialogPopup } from "../ui/dialog";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { DetailedContextBreakdownView } from "./DetailedContextBreakdownView";
import { barSegments } from "./ContextBreakdown.logic";
import { deriveTrimSuggestions } from "./ContextTrim.logic";
import { deriveWasteFindings } from "./ContextWaste.logic";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { UsageBar, UsageRing } from "./PlanUsageLimits";
import type { StartBenchmarkArena } from "./BenchmarkExplorer";
import { UsageBenchmarks } from "./UsageBenchmarks";

type Account = UsageLimitsReport["accounts"][number];

/** How often the open card re-reads account limits; the server caches probes inside this. */
const LIMITS_REFRESH_MS = 5 * 60_000;

/** After a window resets, wait this long before the automatic re-read. */
const RESET_REFRESH_DELAY_MS = 5_000;
const MAX_RESET_REFRESH_DELAY_MS = 24 * 60 * 60_000;

const MAX_CONTEXT_SEGMENTS = 8;
const MAX_TRIM_ROWS = 3;
const TRIM_KIND_LABEL = {
  mcp: "Tool",
  skill: "Skill",
  agent: "Helper",
  memory: "File",
  "tool-results": "Shorten:",
} as const;
const sumTokens = (rows: ReadonlyArray<{ readonly tokens: number }> | undefined) =>
  rows?.reduce((total, row) => total + row.tokens, 0) ?? 0;

function titleOf(account: Account): string {
  return accountTitle(
    { displayName: account.displayName, sourceLabel: account.sourceLabel },
    account.displayName ?? account.label,
  );
}

/** What fills the context window, fetched only while this card is on screen. */
function ContextSegments({
  environmentId,
  threadId,
  usedTokens,
  onOpenDetails,
}: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly usedTokens: number;
  readonly onOpenDetails: () => void;
}) {
  const query = useThreadContextBreakdown({ environmentId, threadId });
  const { refresh } = query;
  // Re-read after each reported usage change so the split follows the conversation.
  useEffect(() => {
    refresh();
  }, [usedTokens, refresh]);

  const segments = useMemo(
    () => (query.data ? barSegments(query.data.categories, query.data.maxTokens) : []),
    [query.data],
  );
  const trim = useMemo(() => (query.data ? deriveTrimSuggestions(query.data) : []), [query.data]);
  const waste = useMemo(() => (query.data ? deriveWasteFindings(query.data) : []), [query.data]);
  const used = segments.filter((segment) => segment.kind === "used" && segment.tokens > 0);
  if (used.length === 0) return null;
  const top = used.slice(0, MAX_CONTEXT_SEGMENTS);
  // Skills, MCP tools and agents are not always their own provider category.
  const named = new Set(top.map((segment) => segment.name.toLowerCase()));
  const extras: Array<{ name: string; label?: string; title?: string; tokens: number }> = [
    { name: "Skills", tokens: sumTokens(query.data?.skills) },
    {
      name: "Connected tools",
      label: "Tools",
      title: "Tools",
      tokens: sumTokens(query.data?.mcpTools),
    },
    { name: "Agents", label: "Helpers", tokens: sumTokens(query.data?.agents) },
  ].filter(
    (extra) =>
      extra.tokens > 0 &&
      !named.has(extra.name.toLowerCase()) &&
      !(extra.title && named.has(extra.title.toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted/60">
        {segments
          .filter((segment) => segment.width > 0)
          .map((segment) => (
            <div
              key={segment.name}
              className={cn(segment.fill, "min-w-0.5 opacity-80")}
              style={{ width: `${segment.width}%` }}
            />
          ))}
      </div>
      <ul className="flex flex-col gap-0.5 text-2xs text-muted-foreground">
        {top.map((segment) => (
          <li key={segment.name} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", segment.fill)} />
            <span className="min-w-0 flex-1 truncate">{segment.name}</span>
            <span className="tabular-nums text-foreground">{formatTokenCount(segment.tokens)}</span>
          </li>
        ))}
        {extras.map((extra) => (
          <li key={extra.name} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            <span
              className="min-w-0 flex-1 truncate"
              title={extra.title === "MCP tools" ? "These use MCP servers." : extra.title}
            >
              {extra.label ?? extra.name}
            </span>
            <span className="tabular-nums text-foreground">{formatTokenCount(extra.tokens)}</span>
          </li>
        ))}
      </ul>
      {trim.length > 0 ? (
        <div className="flex flex-col gap-0.5 border-t border-border/50 pt-1.5">
          <span className="text-2xs font-medium text-foreground">Trim: loaded every turn</span>
          <ul className="flex flex-col gap-0.5 text-2xs text-muted-foreground">
            {trim.slice(0, MAX_TRIM_ROWS).map((item) => (
              <li key={item.key} className="flex min-w-0 items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger render={<span className="min-w-0 flex-1 truncate" />}>
                    {TRIM_KIND_LABEL[item.kind]} {item.label}
                    {item.unused ? " (not used in this chat)" : ""}
                  </TooltipTrigger>
                  <TooltipPopup>{item.label}</TooltipPopup>
                </Tooltip>
                <span className="tabular-nums text-foreground">
                  {item.estimated ? "~" : ""}
                  {formatTokenCount(item.tokens)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {waste.length > 0 ? (
        <div className="flex flex-col gap-0.5 border-t border-border/50 pt-1.5">
          <span className="text-2xs font-medium text-foreground">Waste: repeated work</span>
          <ul className="flex flex-col gap-0.5 text-2xs text-muted-foreground">
            {waste.map((item) => (
              <li key={item.key} className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="tabular-nums text-foreground">
                  ~{formatTokenCount(item.tokens)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onOpenDetails}
        className="cursor-pointer self-start text-2xs text-muted-foreground transition-colors hover:text-foreground"
      >
        See the full list
      </button>
    </div>
  );
}

/** One connected account: name, active marker, then its session and weekly bars (draining). */
function AccountLimits({
  account,
  active,
  now,
  view,
}: {
  readonly account: Account;
  readonly active: boolean;
  readonly now: number;
  readonly view: LimitView;
}) {
  const title = titleOf(account);
  const rows = glanceLimitRows(account.limits.windows, now);
  const notice = limitsNotice(account.limits);
  return (
    <div className="flex min-w-0 items-start gap-2">
      <ProviderInstanceIcon
        driverKind={account.driver}
        displayName={title}
        className="mt-0.5"
        iconClassName="size-3.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium">{title}</span>
          {active ? (
            <span className="flex shrink-0 items-center gap-1 text-2xs text-muted-foreground">
              Active
            </span>
          ) : null}
        </div>
        {notice || rows.length === 0 ? (
          <span className="text-2xs text-muted-foreground">{notice ?? "Limits pending"}</span>
        ) : (
          rows.map((row) => {
            if (!row.window) {
              return (
                <div
                  key={row.key}
                  className="flex items-center justify-between text-2xs text-muted-foreground"
                >
                  <span>{row.label}</span>
                  <span>Not shown</span>
                </div>
              );
            }
            const countdown = formatResetCountdown(row.window.resetsAt, now, true);
            const leftText = percentText(row.window.usedPercent, view);
            return (
              <div key={row.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums text-foreground">
                    {countdown ? `${countdown} · ${leftText}` : leftText}
                  </span>
                </div>
                <UsageBar
                  fill={view}
                  usedPercent={row.window.usedPercent}
                  label={`${row.label}: ${leftText}`}
                  className="h-1"
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * The one usage card: model, effort, the context window and what fills it, then every
 * connected account's session and weekly bars with this chat's account first. The composer's
 * context ring toggles it. It is part of the layout, never over the chat: wide chat areas
 * show the whole card as a left rail with the chat beside it, narrow ones show a one-line pill
 * above the chat that expands in place on click. A side panel opening cannot cover chat text.
 */
export const UsageOverlayCard = memo(function UsageOverlayCard({
  environmentId,
  threadId,
  instanceId,
  modelLabel,
  effortLabel,
  contextWindow,
  providerEntries,
  onStartChat,
  onStartArena,
}: {
  readonly environmentId: EnvironmentId;
  /** Null for drafts, which have no server-side context to break down yet. */
  readonly threadId: ThreadId | null;
  readonly instanceId: ProviderInstanceId | null;
  readonly modelLabel: string;
  readonly effortLabel: string | null;
  readonly contextWindow: ContextWindowSnapshot | null;
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
  /** Null when no project is active, which hides the row action. */
  readonly onStartChat: ((selection: ModelSelection) => void) | null;
  readonly onStartArena: StartBenchmarkArena | null;
}) {
  const navigate = useNavigate();
  const updateSettings = useUpdateClientSettings();
  const { active, others } = useConnectedUsageAccounts(environmentId, instanceId);
  const [expanded, setExpanded] = useState(false);
  const [view, toggleView] = useLimitView();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const minute = useNowMinute();
  const now = Date.parse(`${minute}:00Z`);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  // Re-read every account's limits from their source while the card is open and
  // the window is visible, so the numbers follow the provider without a click.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshProviders({ environmentId, input: {} });
      }
    }, LIMITS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [environmentId, refreshProviders]);

  const figures = contextWindowFigures(contextWindow);
  const percent =
    figures.state === "reported" && figures.usedPercent != null
      ? usedPercentLabel(figures.usedPercent)
      : null;
  const severity = percent === null ? "normal" : usageSeverity(percent);
  const primary = active[0] ?? null;
  const activeIds = useMemo(() => new Set(active.map((account) => account.id)), [active]);
  const accounts = useMemo(() => [...active, ...others], [active, others]);
  const refreshNow = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshUsageLimits(environmentId, () => refreshProviders({ environmentId, input: {} }));
    } catch {
      // The bars keep their last numbers; the freshness line shows they are old.
    } finally {
      setRefreshing(false);
    }
  };
  const nextReset = useMemo(() => {
    const times = accounts
      .flatMap((account) => account.limits.windows)
      .map((window) => (window.resetsAt === undefined ? Number.NaN : Date.parse(window.resetsAt)))
      .filter((at) => at > now);
    return times.length > 0 ? Math.min(...times) : null;
  }, [accounts, now]);
  // A window that resets while the card is open is gone from the provider's answer: re-read once.
  useEffect(() => {
    if (nextReset === null) return;
    const delay = Math.min(
      Math.max(nextReset + RESET_REFRESH_DELAY_MS - now, RESET_REFRESH_DELAY_MS),
      MAX_RESET_REFRESH_DELAY_MS,
    );
    const timer = setTimeout(() => {
      void refreshUsageLimits(
        environmentId,
        () => refreshProviders({ environmentId, input: {} }),
        true,
      ).catch(() => undefined);
    }, delay);
    return () => clearTimeout(timer);
  }, [nextReset, now, environmentId, refreshProviders]);
  const benchmarkCandidates = useMemo(
    () => connectedBenchmarkCandidates(providerEntries, instanceId),
    [providerEntries, instanceId],
  );

  const freshness = limitsFreshness(
    accounts.map((account) => account.limits.checkedAt),
    now,
  );

  const contextLine =
    figures.state === "reported"
      ? `${formatTokenCount(figures.usedTokens)} / ${figures.maxTokens ? formatTokenCount(figures.maxTokens) : "unlimited"}`
      : figures.state === "pending"
        ? `Not shown / ${formatTokenCount(figures.maxTokens)}`
        : "Not shown yet";
  const leftLine =
    figures.state === "reported" && figures.maxTokens
      ? `${formatTokenCount(Math.max(0, figures.maxTokens - figures.usedTokens))} left`
      : null;

  return (
    <div
      data-usage-overlay
      className="pointer-events-none z-30 mt-2 ml-3 max-w-[calc(100%-1.5rem)] shrink-0 self-start"
    >
      {/* Narrow column: one line, expands in place. */}
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Show memory and accounts"
          className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-background/90 py-1 pr-3 pl-1.5 text-xs shadow-sm backdrop-blur transition-colors hover:bg-muted/60 @7xl:hidden"
        >
          <UsageRing
            fill="used"
            percent={percent}
            size={20}
            strokeWidth={2.5}
            severity={severity}
          />
          <span className="tabular-nums font-medium">
            {percent === null ? "Context" : `${percent}%`}
          </span>
          {primary ? (
            <ProviderInstanceIcon
              driverKind={primary.driver}
              displayName={titleOf(primary)}
              iconClassName="size-3.5"
            />
          ) : null}
          <ChevronDownIcon aria-hidden className="size-3 text-muted-foreground" />
        </button>
      ) : null}

      <section
        aria-label="Memory and accounts"
        className={cn(
          "pointer-events-auto w-80 max-w-full max-h-[40dvh] @7xl:max-h-[calc(100dvh-10rem)] [scrollbar-width:thin] overflow-y-auto flex-col gap-3 rounded-xl border border-border/60 bg-background/90 p-3 shadow-md backdrop-blur",
          expanded ? "flex" : "hidden @7xl:flex",
        )}
      >
        {/* Context */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <UsageRing
              fill="used"
              percent={percent}
              size={34}
              strokeWidth={3}
              severity={severity}
              className="text-2xs font-semibold tabular-nums"
            >
              {percent === null ? "–" : `${percent}%`}
            </UsageRing>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold leading-tight">
                {modelLabel || "No model selected"}
              </span>
              <span className="truncate text-2xs text-muted-foreground">
                {effortLabel ? `${effortLabel} · ` : ""}
                Chat memory
              </span>
            </div>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Hide this card"
              className={cn("@7xl:hidden", expanded ? "" : "hidden")}
              onClick={() => setExpanded(false)}
            >
              <ChevronUpIcon aria-hidden />
            </Button>
          </div>
          {threadId && figures.state === "reported" ? null : (
            <UsageBar
              fill="used"
              usedPercent={percent ?? 0}
              label={`Chat memory: ${percent ?? 0}% used`}
            />
          )}
          <div className="flex items-center justify-between text-2xs tabular-nums text-muted-foreground">
            <span>{figures.state === "reported" ? `${contextLine} tokens` : contextLine}</span>
            {leftLine ? <span>{leftLine}</span> : null}
          </div>
          {threadId ? (
            <ContextSegments
              environmentId={environmentId}
              threadId={threadId}
              usedTokens={figures.state === "reported" ? figures.usedTokens : 0}
              onOpenDetails={() => setDetailsOpen(true)}
            />
          ) : null}
        </div>

        {/* Every connected account, this chat's first */}
        {accounts.length > 0 ? (
          <div className="flex flex-col gap-3.5 border-t border-border/60 pt-3">
            {accounts.map((account) => (
              <AccountLimits
                key={account.id}
                account={account}
                active={activeIds.has(account.id)}
                now={now}
                view={view}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 p-2.5 text-2xs text-muted-foreground">
            This chat uses an AI service with no AI account signed in. Add an AI account in
            Settings.
          </p>
        )}

        <UsageBenchmarks
          environmentId={environmentId}
          candidates={benchmarkCandidates}
          onStartChat={onStartChat}
          onStartArena={onStartArena}
        />

        {freshness ? (
          <span
            className={cn(
              "text-2xs",
              freshness.stale ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {freshness.stale ? `${freshness.label} · may be out of date` : freshness.label}
          </span>
        ) : null}

        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-2xs">
          <button
            type="button"
            onClick={() => void navigate({ to: "/usage" })}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            See all usage
          </button>
          <button
            type="button"
            onClick={toggleView}
            aria-label={`Showing percent ${view}. Switch to percent ${view === "used" ? "left" : "used"}`}
            className="ms-auto me-1 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            Show {view === "used" ? "% left" : "% used"}
          </button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Refresh usage now"
            disabled={refreshing}
            onClick={() => void refreshNow()}
          >
            <RefreshIcon size="xs" refreshing={refreshing} />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Turn off this card"
            onClick={() => void updateSettings({ usageOverlayEnabled: false })}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
      </section>
      {threadId ? (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogPopup className="max-w-2xl">
            <DialogPanel>
              <DetailedContextBreakdownView
                environmentId={environmentId}
                threadId={threadId}
                onBack={() => setDetailsOpen(false)}
              />
            </DialogPanel>
          </DialogPopup>
        </Dialog>
      ) : null}
    </div>
  );
});
