import type { ServerProviderUsageWindow, UsageLimitsReport } from "@t3tools/contracts";
import { subscriptionEstimateSummary } from "@t3tools/shared/subscriptionEstimate";
import { limitsNotice } from "@t3tools/shared/usageLimits";
import { ChevronRightIcon, InfoIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { limitText, useLimitView } from "../../hooks/useLimitView";
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
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { resetCreditsSummary } from "../usage/UsageLimits";
import { RedactedSensitiveText } from "../settings/RedactedSensitiveText";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { AccountSummary } from "./ComposerUsageLimits";

/** Bar fill by severity: blue while half or more is left, amber under 50% left, red under 10%. */
const SEVERITY_FILL: Record<UsageSeverity, string> = {
  normal: "bg-info",
  warning: "bg-warning",
  critical: "bg-destructive",
};
const SEVERITY_STROKE: Record<UsageSeverity, string> = {
  normal: "stroke-info",
  warning: "stroke-warning",
  critical: "stroke-destructive",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function hour12For(format: string): boolean | undefined {
  if (format === "12-hour") return true;
  if (format === "24-hour") return false;
  return undefined;
}

/** `Sun 9:00 PM` within a week, `Oct 24, 9:00 PM` beyond, in the user's clock style. */
export function useResetMomentFormatter(now: number): (at: number) => string {
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

/**
 * A quota bar coloured by severity. It drains: the fill is what is left, so a nearly spent
 * window is a small sliver. `fill="used"` fills with consumption instead (the context window).
 */
export function UsageBar({
  usedPercent,
  label,
  className,
  fill = "left",
}: {
  readonly usedPercent: number;
  readonly label: string;
  readonly className?: string;
  readonly fill?: "left" | "used";
}) {
  const used = usedPercentLabel(usedPercent);
  const shown = fill === "left" ? 100 - used : used;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      {shown > 0 ? (
        <div
          className={cn("h-full min-w-1 rounded-full", SEVERITY_FILL[usageSeverity(used)])}
          style={{ width: `${shown}%` }}
        />
      ) : null}
    </div>
  );
}

/** A circular quota gauge (drains like `UsageBar`); children sit in its centre. A static SVG. */
export function UsageRing({
  percent,
  size,
  strokeWidth,
  severity,
  className,
  children,
  fill: fillMode = "left",
}: {
  readonly fill?: "left" | "used";
  readonly percent: number | null;
  readonly size: number;
  readonly strokeWidth: number;
  readonly severity: UsageSeverity;
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const used = percent === null ? null : Math.max(0, Math.min(100, percent));
  const fill = used === null ? 0 : fillMode === "left" ? 100 - used : used;
  const circle = {
    cx: size / 2,
    cy: size / 2,
    r: radius,
    fill: "none",
    strokeWidth,
  } as const;
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden
        width={size}
        height={size}
        className="absolute inset-0 mx-0! size-full -rotate-90"
      >
        <circle {...circle} className="stroke-muted" />
        {fill > 0 ? (
          <circle
            {...circle}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fill / 100)}
            className={SEVERITY_STROKE[severity]}
          />
        ) : null}
      </svg>
      {children}
    </span>
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
  const [view] = useLimitView();
  const label = planWindowLabel(window);
  const used = usedPercentLabel(window.usedPercent);
  const resets = formatResetLabel(window.resetsAt, now, formatAt);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 break-words font-medium text-foreground">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-foreground">
          {limitText(window.usedPercent, view)}
        </span>
      </div>
      <UsageBar
        fill={view}
        usedPercent={window.usedPercent}
        label={`${label}: ${used}% used${resets ? `, ${resets.toLowerCase()}` : ""}`}
      />
      {window.tokenEstimate ? (
        <span className="text-2xs text-muted-foreground">
          {subscriptionEstimateSummary(window.tokenEstimate)}
          {window.tokenEstimate.capacityTokens === undefined ? null : (
            <span className="block">
              Approximate local token equivalent; workload and outside usage affect it.
            </span>
          )}
        </span>
      ) : null}
      {resets ? <span className="text-2xs text-muted-foreground">{resets}</span> : null}
    </div>
  );
}

/**
 * The thread's context window as a gauge: a ring with the percent used, the token
 * figure beside it, and the breakdown (left, input, cached, output) as plain chips.
 */
export function ContextSummary({ usage }: { readonly usage: ContextWindowSnapshot }) {
  const percent =
    usage.usedPercentage == null ? null : Math.round(Math.max(0, usage.usedPercentage));
  const unreported = usage.updatedAt === new Date(0).toISOString();
  const severity = percent === null ? "normal" : usageSeverity(percent);
  const figure =
    unreported && usage.maxTokens != null
      ? `Not reported / ${formatTokenCount(usage.maxTokens)}`
      : usage.maxTokens != null && usage.maxTokens > 0
        ? `${formatTokenCount(usage.usedTokens)} / ${formatTokenCount(usage.maxTokens)} tokens`
        : `${formatTokenCount(usage.usedTokens)} tokens`;
  const chips = [
    usage.remainingTokens != null ? `${formatTokenCount(usage.remainingTokens)} left` : null,
    usage.inputTokens != null ? `${formatTokenCount(usage.inputTokens)} input` : null,
    usage.cachedInputTokens != null ? `${formatTokenCount(usage.cachedInputTokens)} cached` : null,
    usage.outputTokens != null ? `${formatTokenCount(usage.outputTokens)} output` : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <UsageRing
        fill="used"
        percent={unreported ? null : percent}
        size={52}
        strokeWidth={5}
        severity={severity}
        className="text-sm font-semibold tabular-nums"
      >
        {percent !== null && !unreported ? `${percent}%` : "–"}
      </UsageRing>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">Context window</span>
          <span className="text-xs text-muted-foreground tabular-nums">{figure}</span>
        </div>
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-md bg-muted px-1.5 py-0.5 text-2xs tabular-nums text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One card per connected account: provider mark, name and plan, a redacted email,
 * then session, weekly and any other windows. Reset credits show as a summary
 * because the redeem confirm cannot open above a popover.
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
            className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <ProviderInstanceIcon
                driverKind={account.driver}
                displayName={account.displayName ?? account.label}
                className="mt-0.5"
                iconClassName="size-4"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="min-w-0 truncate text-sm font-semibold">
                    <AccountSummary account={unplanned} />
                  </span>
                  {plan ? (
                    <Badge variant="outline" size="sm">
                      {shortPlanName(plan)}
                    </Badge>
                  ) : null}
                  {activeAccountIds?.has(account.id) ? (
                    <Badge variant="info" size="sm">
                      This chat
                    </Badge>
                  ) : null}
                </div>
                {account.email ? (
                  <RedactedSensitiveText
                    value={account.email}
                    ariaLabel="Toggle account email visibility"
                    revealTooltip="Click to reveal account email"
                    hideTooltip="Click to hide account email"
                    className="self-start"
                  />
                ) : null}
              </div>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Open detailed breakdown"
                onClick={onOpenDetails}
              >
                <ChevronRightIcon aria-hidden />
              </Button>
            </div>
            {notice ? (
              <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
                <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
                <span className="min-w-0 break-words">{notice}</span>
              </div>
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
            <div className="flex min-w-0 items-center justify-between gap-2 text-2xs text-muted-foreground">
              <span className="truncate">
                {notice ? "Limits unavailable" : "Connected"} · Checked{" "}
                {formatAt(Date.parse(account.limits.checkedAt))}
              </span>
              {externalUsage ? (
                <Button
                  size="xs"
                  variant="link"
                  onClick={() => void ensureLocalApi().shell.openExternal(externalUsage.url)}
                >
                  Manage usage
                </Button>
              ) : null}
            </div>
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
