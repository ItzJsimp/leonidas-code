import type {
  ServerProvider,
  ServerProviderUsageWindow,
  UsageLimitsReport,
} from "@t3tools/contracts";
import { limitsNotice } from "@t3tools/shared/usageLimits";
import { ChevronRightIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { usePrimarySettings } from "../../hooks/useSettings";
import { ensureLocalApi } from "../../localApi";
import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import {
  formatResetLabel,
  formatTokenCount,
  orderPlanWindows,
  planWindowLabel,
  type UsageSeverity,
  usageSeverity,
  usedPercentLabel,
} from "../../lib/usageLimitsPopover";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { barColor, resetCreditsSummary } from "../usage/UsageLimits";
import { AccountSummary } from "./ComposerUsageLimits";

const SEVERITY_FILL: Record<Exclude<UsageSeverity, "normal">, string> = {
  warning: "bg-warning",
  critical: "bg-destructive",
};

const SEVERITY_TEXT: Record<UsageSeverity, string> = {
  normal: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-destructive",
};

/** Context window segments: enough to read 5% steps at popover width. */
const CONTEXT_SEGMENTS = 20;

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

/** A thin used-quota bar; amber and red past the warning thresholds. */
function UsageBar({
  usedPercent,
  label,
  color,
}: {
  readonly usedPercent: number;
  readonly label: string;
  readonly color: string;
}) {
  const used = usedPercentLabel(usedPercent);
  const severity = usageSeverity(used);
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
          className={cn(
            "h-full rounded-full",
            severity === "normal" ? null : SEVERITY_FILL[severity],
          )}
          style={{
            width: `${used}%`,
            ...(severity === "normal" ? { backgroundColor: color } : {}),
          }}
        />
      ) : null}
    </div>
  );
}

function PlanWindowRow({
  window,
  windows,
  driver,
  now,
  formatAt,
}: {
  readonly window: ServerProviderUsageWindow;
  readonly windows: ReadonlyArray<ServerProviderUsageWindow>;
  readonly driver: ServerProvider["driver"];
  readonly now: number;
  readonly formatAt: (at: number) => string;
}) {
  const label = planWindowLabel(window, windows);
  const used = usedPercentLabel(window.usedPercent);
  const resets = formatResetLabel(window.resetsAt, now, formatAt);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-baseline gap-3 text-xs">
        <span className="truncate text-foreground">{label}</span>
        <span className="ms-auto flex shrink-0 items-baseline gap-3 tabular-nums">
          {resets ? <span className="text-muted-foreground">{resets}</span> : null}
          <span className={cn("w-9 text-end font-medium", SEVERITY_TEXT[usageSeverity(used)])}>
            {used}%
          </span>
        </span>
      </div>
      <UsageBar
        usedPercent={window.usedPercent}
        label={`${label}: ${used}% used${resets ? `, ${resets.toLowerCase()}` : ""}`}
        color={barColor(driver)}
      />
    </div>
  );
}

/**
 * The thread's context window as a segmented bar. The chevron discloses the
 * token breakdown when the provider reports one.
 */
export function ContextWindowRow({ usage }: { readonly usage: ContextWindowSnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const percent =
    usage.usedPercentage == null ? null : Math.round(Math.max(0, usage.usedPercentage));
  const severity = percent === null ? "normal" : usageSeverity(percent);
  const filled = percent === null ? 0 : Math.round((percent / 100) * CONTEXT_SEGMENTS);
  const figure =
    usage.maxTokens != null && usage.maxTokens > 0
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        disabled={details.length === 0}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-w-0 items-center gap-2 rounded-sm text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
      >
        <span className="truncate text-foreground">Context window</span>
        <span className="ms-auto shrink-0 text-muted-foreground tabular-nums">{figure}</span>
        {details.length > 0 ? (
          <ChevronRightIcon
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
        ) : null}
      </button>
      {percent !== null ? (
        <div
          role="progressbar"
          aria-label={`Context window: ${percent}% used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="flex h-1 w-full gap-0.5"
        >
          {Array.from({ length: CONTEXT_SEGMENTS }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-full flex-1 rounded-full",
                index < filled
                  ? severity === "normal"
                    ? "bg-foreground/60"
                    : SEVERITY_FILL[severity]
                  : "bg-muted",
              )}
            />
          ))}
        </div>
      ) : null}
      {expanded && details.length > 0 ? (
        <span id={detailsId} className="text-xs text-muted-foreground tabular-nums">
          {details.join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Each account as Claude's "Plan usage limits" block: session, then weekly,
 * then any other windows, one thin bar each. Reset credits show as a summary
 * because the redeem confirm cannot open above a popover.
 */
export function PlanUsageAccounts({ report }: { readonly report: UsageLimitsReport }) {
  const now = Date.parse(report.createdAt);
  const formatAt = useResetMomentFormatter(now);
  const multiple = report.accounts.length > 1;
  return (
    <>
      {report.accounts.map((account) => {
        const notice = limitsNotice(account.limits);
        const externalUsage = account.limits.externalUsage;
        const windows = orderPlanWindows(account.limits.windows);
        return (
          <section key={account.id} className="flex min-w-0 flex-col gap-2">
            <span className="truncate text-xs font-medium text-foreground">
              Plan usage limits
              {multiple ? (
                <span className="font-normal text-muted-foreground">
                  {" · "}
                  <AccountSummary account={account} />
                </span>
              ) : account.plan ? (
                <span className="font-normal text-muted-foreground"> · {account.plan}</span>
              ) : null}
            </span>
            {notice ? (
              <span className="text-xs text-muted-foreground">{notice}</span>
            ) : (
              windows.map((window) => (
                <PlanWindowRow
                  key={window.id}
                  window={window}
                  windows={windows}
                  driver={account.driver}
                  now={now}
                  formatAt={formatAt}
                />
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
