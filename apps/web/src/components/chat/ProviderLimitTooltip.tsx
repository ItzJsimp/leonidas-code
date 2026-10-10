import type { ServerProvider } from "@t3tools/contracts";
import { limitsNotice, remainingPercent } from "@t3tools/shared/usageLimits";
import { formatResetLabel, orderPlanWindows, planWindowLabel } from "../../lib/usageLimitsPopover";

/** Uses the exact instance snapshot, so another account's quota cannot imply readiness. */
export function ProviderLimitTooltip({
  provider,
  now,
}: {
  readonly provider: ServerProvider;
  readonly now: number;
}) {
  const limits = provider.usageLimits;
  if (!limits) {
    return <span>Subscription limits not reported. Quota availability is unknown.</span>;
  }
  const notice = limitsNotice(limits);
  const formatAt = (at: number) =>
    new Date(at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const windows = orderPlanWindows(limits.windows);
  const resetPending = windows.some(
    (window) => window.resetsAt && Date.parse(window.resetsAt) <= now,
  );
  const status = notice
    ? `Quota availability unknown. ${notice}`
    : resetPending
      ? "Quota reset pending confirmation."
      : windows.some((window) => window.usedPercent >= 100)
        ? "A reported limit is reached. Availability may depend on the model."
        : "Reported quota available.";
  return (
    <div className="flex flex-col gap-1">
      {provider.auth.label ? <span>{provider.auth.label}</span> : null}
      <span>{status}</span>
      {limits.unavailable?.reason !== "unsupported"
        ? windows.map((window) => {
            const reset = formatResetLabel(window.resetsAt, now, formatAt);
            return (
              <div key={window.id} className="flex flex-col tabular-nums">
                <span>
                  {planWindowLabel(window)}: {remainingPercent(window)}% remaining
                </span>
                {reset ? <span>{reset}</span> : null}
              </div>
            );
          })
        : null}
      <span>Last checked: {formatAt(Date.parse(limits.checkedAt))}</span>
    </div>
  );
}
