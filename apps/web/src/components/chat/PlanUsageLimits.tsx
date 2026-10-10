import type { ServerProviderUsageWindow, UsageLimitsReport } from "@t3tools/contracts";
import { limitsNotice } from "@t3tools/shared/usageLimits";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { usePrimarySettings } from "../../hooks/useSettings";
import { ensureLocalApi } from "../../localApi";
import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import {
  formatResetLabel,
  formatTokenCount,
  orderPlanWindows,
  planWindowLabel,
  shortPlanName,
  type UsageSeverity,
  usageSeverity,
  usedPercentLabel,
} from "../../lib/usageLimitsPopover";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { resetCreditsSummary } from "../usage/UsageLimits";
import { RedactedSensitiveText } from "../settings/RedactedSensitiveText";
import { AccountSummary } from "./ComposerUsageLimits";

/** Bar fill by severity: blue while there is room, amber from 75%, red from 90%. */
const SEVERITY_FILL: Record<UsageSeverity, string> = {
  normal: "bg-info",
  warning: "bg-warning",
  critical: "bg-destructive",
};

/** Context window segments: fine enough to read 2.5% steps at popover width. */
const CONTEXT_SEGMENTS = 40;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function hour12For(format: string): boolean | undefined {
  if (format === "12-hour") return true;
  if (format === "24-hour") return false;
  return undefined;
}

/** `Sun 9:00 PM` within a week, `Oct 24, 9:00 PM` beyond, in the user's clock style. */
function useResetMomentFormatter(now: number): (at: number) => string {
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  return useMemo(() => {
    const hour12 = hour12For(timestampFormat);
    const time: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      ...(hour12 === undefined ? {} : { hour12 }),
    };
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short", ...time });
    const dated = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      ...time,
    });
    return (at: number) => (at - now < WEEK_MS ? weekday : dated).format(at);
  }, [now, timestampFormat]);
}

/** A 4px used-quota bar coloured by severity. */
function UsageBar({
  usedPercent,
  label,
}: {
  readonly usedPercent: number;
  readonly label: string;
}) {
  const used = usedPercentLabel(usedPercent);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={used}
      className="h-1 w-full overflow-hidden rounded-full bg-muted"
    >
      {used > 0 ? (
        <div
          className={cn("h-full rounded-full", SEVERITY_FILL[usageSeverity(used)])}
          style={{ width: `${used}%` }}
        />
      ) : null}
    </div>
  );
}

function PlanWindowRow({
  window,
  now,
  formatAt,
}: {
  readonly window: ServerProviderUsageWindow;
  readonly now: number;
  readonly formatAt: (at: number) => string;
}) {
  const label = planWindowLabel(window);
  const used = usedPercentLabel(window.usedPercent);
  const resets = formatResetLabel(window.resetsAt, now, formatAt);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="min-w-0 break-words font-semibold text-foreground">{label}</span>
        <span className="ms-auto flex shrink-0 items-baseline gap-2 tabular-nums">
          {resets ? <span className="text-muted-foreground">{resets}</span> : null}
          <span className="text-foreground">{used}%</span>
        </span>
      </div>
      <UsageBar
        usedPercent={window.usedPercent}
        label={`${label}: ${used}% used${resets ? `, ${resets.toLowerCase()}` : ""}`}
      />
    </div>
  );
}

/**
 * The thread's context window: muted label, `used / size (percent)`, a chevron
 * that discloses the token breakdown, and a thin segmented bar.
 */
export function ContextWindowRow({ usage }: { readonly usage: ContextWindowSnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const percent =
    usage.usedPercentage == null ? null : Math.round(Math.max(0, usage.usedPercentage));
  const filled =
    usage.usedPercentage == null
      ? 0
      : Math.min(
          CONTEXT_SEGMENTS,
          // Any usage lights the first segment, as Claude's bar does.
          Math.ceil((Math.max(0, usage.usedPercentage) / 100) * CONTEXT_SEGMENTS),
        );
  const fill = SEVERITY_FILL[percent === null ? "normal" : usageSeverity(percent)];
  const unreported = usage.updatedAt === new Date(0).toISOString();
  const figure =
    unreported && usage.maxTokens != null
      ? `Not reported / ${formatTokenCount(usage.maxTokens)}`
      : usage.maxTokens != null && usage.maxTokens > 0
        ? `${formatTokenCount(usage.usedTokens)} / ${formatTokenCount(usage.maxTokens)}${
            percent === null ? "" : ` (${percent}%)`
          }`
        : `${formatTokenCount(usage.usedTokens)} tokens`;
  const details = [
    usage.remainingTokens != null ? `${formatTokenCount(usage.remainingTokens)} left` : null,
    usage.inputTokens != null ? `${formatTokenCount(usage.inputTokens)} input` : null,
    usage.cachedInputTokens != null ? `${formatTokenCount(usage.cachedInputTokens)} cached` : null,
    usage.outputTokens != null ? `${formatTokenCount(usage.outputTokens)} output` : null,
  ].filter((part) => part !== null);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-w-0 flex-wrap items-center gap-2 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="truncate">Context window</span>
        <span className="ms-auto shrink-0 tabular-nums">{figure}</span>
        <ChevronRightIcon
          aria-hidden
          className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
        />
      </button>
      {percent !== null && !unreported ? (
        <div
          role="progressbar"
          aria-label={`Context window: ${percent}% used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="flex h-1 w-full gap-px"
        >
          {Array.from({ length: CONTEXT_SEGMENTS }, (_, index) => (
            <span
              key={index}
              className={cn("h-full flex-1 rounded-xs", index < filled ? fill : "bg-muted")}
            />
          ))}
        </div>
      ) : null}
      {expanded ? (
        <span id={detailsId} className="text-xs text-muted-foreground tabular-nums">
          {details.length > 0 ? details.join(" · ") : "No token breakdown reported yet."}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Each account as Claude's "Plan usage limits" block: a muted header with the
 * short plan name, then session, weekly and any other windows. Reset credits
 * show as a summary because the redeem confirm cannot open above a popover.
 */
export function PlanUsageAccounts({
  report,
  onOpenDetails,
  activeAccountIds,
}: {
  readonly report: UsageLimitsReport;
  readonly onOpenDetails: () => void;
  readonly activeAccountIds?: ReadonlySet<string>;
}) {
  const now = Date.parse(report.createdAt);
  const formatAt = useResetMomentFormatter(now);
  return (
    <>
      {report.accounts.map((account) => {
        const notice = limitsNotice(account.limits);
        const externalUsage = account.limits.externalUsage;
        const windows = orderPlanWindows(account.limits.windows);
        const { plan, ...unplanned } = account;
        return (
          <section
            key={account.id}
            className="flex min-w-0 flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
          >
            <button
              type="button"
              onClick={onOpenDetails}
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="truncate">
                <AccountSummary account={unplanned} />
                {plan ? ` · ${shortPlanName(plan)}` : null}
              </span>
              {activeAccountIds?.has(account.id) ? (
                <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
                  This chat
                </span>
              ) : null}
              <span className="sr-only">, open detailed breakdown</span>
              <ArrowRightIcon aria-hidden className="ms-auto size-3.5 shrink-0" />
            </button>
            {account.email ? (
              <RedactedSensitiveText
                value={account.email}
                ariaLabel="Toggle account email visibility"
                revealTooltip="Click to reveal account email"
                hideTooltip="Click to hide account email"
                className="self-start max-w-full truncate text-xs text-muted-foreground"
              />
            ) : null}
            <span className="text-xs text-muted-foreground">
              {notice ? "Limits unavailable" : "Connected"} · Checked{" "}
              {formatAt(Date.parse(account.limits.checkedAt))}
            </span>
            {notice ? (
              <span className="text-xs text-muted-foreground">{notice}</span>
            ) : (
              windows.map((window) => (
                <PlanWindowRow key={window.id} window={window} now={now} formatAt={formatAt} />
              ))
            )}
            {account.limits.resetCredits?.availableCount ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {resetCreditsSummary(account.limits.resetCredits, now)}
              </span>
            ) : null}
            {externalUsage ? (
              <Button
                size="sm"
                variant="link"
                className="self-start"
                onClick={() => void ensureLocalApi().shell.openExternal(externalUsage.url)}
              >
                Manage usage
              </Button>
            ) : null}
          </section>
        );
      })}
      {report.notices.map((notice) => (
        <span key={notice} className="text-xs text-muted-foreground">
          {notice}
        </span>
      ))}
    </>
  );
}
