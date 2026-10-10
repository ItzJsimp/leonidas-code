import type { UsageLimitsReport } from "@t3tools/contracts";
import { limitsNotice } from "@t3tools/shared/usageLimits";
import { SparklesIcon } from "lucide-react";

import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import {
  formatTokenCount,
  glanceWindowLabel,
  glanceWindows,
  usageSeverity,
  usedPercentLabel,
} from "../../lib/usageLimitsPopover";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { UsageBar, UsageRing } from "./PlanUsageLimits";

const MAX_GLANCE_ACCOUNTS = 3;

/**
 * The hover summary of the usage control: model, context gauge, and each account's
 * session and weekly bars, with this chat's account first. The click opens the panel.
 */
export function ChatUsageHoverCard({
  modelLabel,
  effortLabel,
  contextWindow,
  accounts,
  activeAccountIds,
}: {
  readonly modelLabel: string;
  readonly effortLabel: string | null;
  readonly contextWindow: ContextWindowSnapshot | null;
  readonly accounts: UsageLimitsReport["accounts"];
  readonly activeAccountIds: ReadonlySet<string>;
}) {
  const percent =
    contextWindow?.usedPercentage == null ? null : usedPercentLabel(contextWindow.usedPercentage);
  const reported = contextWindow !== null && contextWindow.updatedAt !== new Date(0).toISOString();
  const ordered = accounts.toSorted(
    (left, right) => Number(activeAccountIds.has(right.id)) - Number(activeAccountIds.has(left.id)),
  );
  const shown = ordered.slice(0, MAX_GLANCE_ACCOUNTS);

  return (
    <div className="flex w-64 flex-col gap-3 py-1">
      <div className="flex items-center gap-2.5">
        <UsageRing
          percent={reported ? percent : null}
          size={36}
          strokeWidth={4}
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
          <span className="truncate text-sm font-semibold">
            {modelLabel || "No model selected"}
          </span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {effortLabel ? `${effortLabel} · ` : ""}
            {contextWindow && reported && contextWindow.maxTokens
              ? `${formatTokenCount(contextWindow.usedTokens)} / ${formatTokenCount(contextWindow.maxTokens)} context`
              : "Context not reported yet"}
          </span>
        </div>
      </div>
      {shown.length > 0 ? (
        <div className="flex flex-col gap-2.5 border-t pt-2.5">
          {shown.map((account) => {
            const windows = glanceWindows(account.limits.windows);
            const notice = limitsNotice(account.limits);
            return (
              <div key={account.id} className="flex min-w-0 items-start gap-2">
                <ProviderInstanceIcon
                  driverKind={account.driver}
                  displayName={account.displayName ?? account.label}
                  className="mt-0.5"
                  iconClassName="size-3.5"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-xs font-medium">
                    {account.displayName?.trim() || account.label}
                  </span>
                  {notice || windows.length === 0 ? (
                    <span className="text-2xs text-muted-foreground">Limits pending</span>
                  ) : (
                    windows.map((window) => (
                      <div key={window.id} className="flex items-center gap-2">
                        <span className="w-11 shrink-0 text-2xs text-muted-foreground">
                          {glanceWindowLabel(window)}
                        </span>
                        <UsageBar
                          usedPercent={window.usedPercent}
                          label={`${glanceWindowLabel(window)}: ${usedPercentLabel(window.usedPercent)}% used`}
                        />
                        <span className="w-8 shrink-0 text-right text-2xs tabular-nums">
                          {usedPercentLabel(window.usedPercent)}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
          {ordered.length > shown.length ? (
            <span className="text-2xs text-muted-foreground">
              +{ordered.length - shown.length} more accounts
            </span>
          ) : null}
        </div>
      ) : null}
      <span className="text-2xs text-muted-foreground">Click for the full breakdown</span>
    </div>
  );
}
