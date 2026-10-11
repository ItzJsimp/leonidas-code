import type { UsageLimitsReport } from "@t3tools/contracts";
import { limitsNotice } from "@t3tools/shared/usageLimits";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";

import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import {
  accountTitle,
  contextWindowFigures,
  formatResetCountdown,
  formatTokenCount,
  glanceLimitRows,
  percentText,
  usageSeverity,
  usedPercentLabel,
} from "../../lib/usageLimitsPopover";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { UsageBar, UsageRing } from "./PlanUsageLimits";

const MAX_GLANCE_ACCOUNTS = 2;

/**
 * The hover summary of the usage control: model, context gauge, and active account's
 * session and weekly bars, with this chat's account first. Cursor can move into the card.
 */
export function ChatUsageHoverCard({
  modelLabel,
  effortLabel,
  contextWindow,
  accounts,
  activeAccountIds,
  onOpenFull,
}: {
  readonly modelLabel: string;
  readonly effortLabel: string | null;
  readonly contextWindow: ContextWindowSnapshot | null;
  readonly accounts: UsageLimitsReport["accounts"];
  readonly activeAccountIds: ReadonlySet<string>;
  readonly onOpenFull?: () => void;
}) {
  const figures = contextWindowFigures(contextWindow);
  const percent =
    figures.state === "reported" && figures.usedPercent != null
      ? usedPercentLabel(figures.usedPercent)
      : null;
  const reported = figures.state === "reported";
  const ordered = accounts.toSorted(
    (left, right) => Number(activeAccountIds.has(right.id)) - Number(activeAccountIds.has(left.id)),
  );
  const shown = ordered.slice(0, MAX_GLANCE_ACCOUNTS);
  const now = Date.now();

  return (
    <div className="flex w-72 max-w-full flex-col gap-3.5 p-1">
      <div className="flex items-center gap-2.5">
        <UsageRing
          percent={reported ? percent : null}
          size={36}
          strokeWidth={3}
          severity={percent === null ? "normal" : usageSeverity(percent)}
          className="text-2xs font-semibold tabular-nums"
        >
          {reported && percent !== null ? (
            `${percent}%`
          ) : (
            <SparklesIcon aria-hidden className="size-3.5" />
          )}
        </UsageRing>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium tracking-tight">
            {modelLabel || "No model selected"}
          </span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {effortLabel ? `${effortLabel} · ` : ""}
            {figures.state === "reported"
              ? `${formatTokenCount(figures.usedTokens)} / ${figures.maxTokens ? formatTokenCount(figures.maxTokens) : "unlimited"} context`
              : figures.state === "pending"
                ? `0 / ${formatTokenCount(figures.maxTokens)} context`
                : "Context not reported yet"}
          </span>
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="flex flex-col gap-3.5 border-t border-border/60 pt-3">
          {shown.map((account) => {
            const rows = glanceLimitRows(account.limits.windows);
            const notice = limitsNotice(account.limits);
            const title = accountTitle(
              { displayName: account.displayName, sourceLabel: account.sourceLabel },
              account.displayName ?? account.label,
            );
            return (
              <div key={account.id} className="flex min-w-0 items-start gap-2">
                <ProviderInstanceIcon
                  driverKind={account.driver}
                  displayName={title}
                  className="mt-0.5"
                  iconClassName="size-3.5"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-medium">{title}</span>
                    {activeAccountIds.has(account.id) ? (
                      <span className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs text-muted-foreground">
                        Active
                      </span>
                    ) : null}
                  </div>
                  {notice || rows.length === 0 ? (
                    <span className="text-2xs text-muted-foreground">
                      {notice ?? "Limits pending"}
                    </span>
                  ) : (
                    rows.map((row) => {
                      if (!row.window) {
                        return (
                          <div
                            key={row.key}
                            className="flex items-center justify-between text-2xs text-muted-foreground"
                          >
                            <span>{row.label}</span>
                            <span>Not reported</span>
                          </div>
                        );
                      }
                      const countdown = formatResetCountdown(row.window.resetsAt, now, true);
                      const leftText = percentText(row.window.usedPercent, "left");
                      const used = usedPercentLabel(row.window.usedPercent);
                      return (
                        <div key={row.key} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-2xs">
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className="tabular-nums text-foreground">
                              {countdown ? `${countdown} · ${leftText}` : leftText}
                            </span>
                          </div>
                          <UsageBar
                            usedPercent={row.window.usedPercent}
                            label={`${row.label}: ${used}% used`}
                            className="h-1"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
          {ordered.length > shown.length ? (
            <button
              type="button"
              onClick={onOpenFull}
              className="self-start rounded-sm text-left text-2xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline cursor-pointer"
            >
              +{ordered.length - shown.length} more accounts
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-border/60 pt-2.5">
        <button
          type="button"
          onClick={onOpenFull}
          className="flex w-full items-center justify-between text-2xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <span>Click for full breakdown</span>
          <ChevronRightIcon aria-hidden className="size-3" />
        </button>
      </div>
    </div>
  );
}
