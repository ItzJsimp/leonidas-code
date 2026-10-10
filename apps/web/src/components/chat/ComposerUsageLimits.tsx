import type { EnvironmentId, UsageLimitsReport } from "@t3tools/contracts";
import { limitsNotice } from "@t3tools/shared/usageLimits";
import { GaugeIcon } from "lucide-react";

import { ensureLocalApi } from "../../localApi";
import { Button } from "../ui/button";
import { providerClients } from "../settings/providerDriverMeta";
import { RedactedSensitiveText } from "../settings/RedactedSensitiveText";
import { LimitWindows, ResetCredits, resetCreditsSummary } from "../usage/UsageLimits";
import { ComposerBanner } from "./ComposerBanner";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";

/** Driver name, then the instance when there could be more than one of that driver. */
function accountLabel(account: UsageLimitsReport["accounts"][number]): string {
  if (!account.instanceId) return account.label;
  const driver = providerClients.get(account.driver)?.label ?? String(account.driver);
  const instance =
    account.displayName?.trim() ||
    (String(account.instanceId) !== String(account.driver) ? account.instanceId : "");
  // The default instance is often named after its driver; saying it twice adds nothing.
  return instance && instance.toLowerCase() !== driver.toLowerCase()
    ? `${driver} · ${instance}`
    : driver;
}

/** The account's label (redactable when it is an email) and plan. */
export function AccountSummary({
  account,
}: {
  readonly account: UsageLimitsReport["accounts"][number];
}) {
  const label = accountLabel(account);
  return (
    <>
      {label.includes("@") ? (
        <RedactedSensitiveText
          key={label}
          value={label}
          ariaLabel="Toggle account label visibility"
          revealTooltip="Click to reveal account"
          hideTooltip="Click to hide account"
          className="max-w-full truncate align-bottom font-sans text-xs leading-normal"
        />
      ) : (
        label
      )}
      {account.plan ? ` · ${account.plan}` : null}
    </>
  );
}

/** The single account's label and plan, or the account count. */
export function UsageLimitsSummary({ report }: { readonly report: UsageLimitsReport }) {
  const [first] = report.accounts;
  return report.accounts.length === 1 && first ? (
    <AccountSummary account={first} />
  ) : (
    `${report.accounts.length} accounts`
  );
}

/** The /usage-limits result as a composer notice: it stacks under warnings and dismisses like one. */
export function usageLimitsBannerItem(
  id: string,
  report: UsageLimitsReport,
  environmentId: EnvironmentId,
  onDismiss: () => void,
): ComposerBannerStackItem {
  return {
    id,
    variant: "info",
    priority: "notice",
    icon: <GaugeIcon />,
    title: "Usage limits",
    description: <UsageLimitsSummary report={report} />,
    dismissLabel: "Dismiss usage limits",
    onDismiss,
    children: <UsageLimitsBannerBody report={report} environmentId={environmentId} />,
  };
}

function UsageLimitsBannerBody({
  report,
  environmentId,
}: {
  readonly report: UsageLimitsReport;
  readonly environmentId: EnvironmentId;
}) {
  return (
    <ComposerBanner.Scroll>
      <ComposerBanner.Body className="flex flex-col gap-2 pt-1 pb-1.5 pe-2">
        <UsageLimitsAccounts report={report} environmentId={environmentId} />
      </ComposerBanner.Body>
    </ComposerBanner.Scroll>
  );
}

/**
 * Each account's windows, usage link and reset credits, then the report's
 * notices. Inside a popover pass `redeemable={false}`: the redeem confirm is a
 * dialog, and dialogs stack under popovers, so credits show as a summary only.
 */
export function UsageLimitsAccounts({
  report,
  environmentId,
  redeemable = true,
}: {
  readonly report: UsageLimitsReport;
  readonly environmentId: EnvironmentId;
  readonly redeemable?: boolean;
}) {
  const now = Date.parse(report.createdAt);
  return (
    <>
      {report.accounts.map((account) => {
        const resetCreditInput =
          account.resetCreditInput ??
          (account.instanceId ? { instanceId: account.instanceId } : undefined);
        const notice = limitsNotice(account.limits);
        const externalUsage = account.limits.externalUsage;
        return (
          <div key={account.id} className="flex min-w-0 flex-col gap-1">
            {report.accounts.length > 1 ? (
              <span className="truncate text-xs text-muted-foreground">
                <AccountSummary account={account} />
              </span>
            ) : null}
            {notice ? (
              <span className="text-xs text-muted-foreground">{notice}</span>
            ) : (
              <LimitWindows
                compact
                driver={account.driver}
                windows={account.limits.windows}
                now={now}
              />
            )}
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
            {!redeemable && account.limits.resetCredits?.availableCount ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {resetCreditsSummary(account.limits.resetCredits, now)}
              </span>
            ) : redeemable && resetCreditInput && account.limits.resetCredits ? (
              <ResetCredits
                environmentId={environmentId}
                input={resetCreditInput}
                credits={account.limits.resetCredits}
                now={now}
              />
            ) : null}
          </div>
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
