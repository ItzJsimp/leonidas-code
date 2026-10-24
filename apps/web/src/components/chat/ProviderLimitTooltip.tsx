import type { ServerProvider } from "@t3tools/contracts";
import { limitsNotice } from "@t3tools/shared/usageLimits";
import { InfoIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  expireElapsedWindow,
  formatResetCountdown,
  orderPlanWindows,
  percentText,
  planWindowLabel,
} from "../../lib/usageLimitsPopover";
import { UsageBar } from "./PlanUsageLimits";

type Status = "ok" | "pending" | "reached" | "unknown";

const STATUS_DOT: Record<Status, string> = {
  ok: "bg-success",
  pending: "bg-warning",
  reached: "bg-destructive",
  unknown: "bg-muted-foreground/50",
};
const STATUS_TEXT: Record<Status, string> = {
  ok: "Available",
  pending: "Reset pending",
  reached: "Limit reached",
  unknown: "Unknown",
};

const formatAt = (at: number) =>
  new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

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
    return (
      <span className="text-xs text-muted-foreground">
        The AI service does not show your limit, so we cannot tell how much you have left.
      </span>
    );
  }
  const notice = limitsNotice(limits);
  const windows =
    limits.unavailable?.reason !== "unsupported" ? orderPlanWindows(limits.windows) : [];
  const resetPending = windows.some(
    (window) => window.resetsAt && Date.parse(window.resetsAt) <= now,
  );
  const status: Status = notice
    ? "unknown"
    : resetPending
      ? "pending"
      : windows.some((window) => window.usedPercent >= 100)
        ? "reached"
        : "ok";

  return (
    <div className="flex w-56 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-2xs text-muted-foreground">
          {provider.auth.label ?? ""}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-2xs font-medium">
          <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_TEXT[status]}
        </span>
      </div>

      {notice ? (
        <div className="flex items-start gap-1.5 rounded-md bg-warning/10 p-2 text-2xs text-warning-foreground">
          <InfoIcon aria-hidden className="mt-px size-3 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : (
        windows.map((raw) => {
          const window = expireElapsedWindow(raw, now);
          const countdown = formatResetCountdown(window.resetsAt, now, true);
          const resetsAt = window.resetsAt ? Date.parse(window.resetsAt) : Number.NaN;
          const label = planWindowLabel(window, windows);
          return (
            <div key={window.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium">{label}</span>
                <span className="shrink-0 tabular-nums">{percentText(window.usedPercent)}</span>
              </div>
              <UsageBar
                usedPercent={window.usedPercent}
                label={`${label}: ${percentText(window.usedPercent)}`}
                className="h-1"
              />
              {countdown ? (
                <span className="text-2xs tabular-nums text-muted-foreground">
                  {countdown === "now" ? "Resets now" : `Resets in ${countdown}`}
                  {Number.isFinite(resetsAt) && resetsAt - now >= 86_400_000
                    ? ` · ${formatAt(resetsAt)}`
                    : ""}
                </span>
              ) : null}
            </div>
          );
        })
      )}

      <span className="border-t border-border/60 pt-1.5 text-2xs text-muted-foreground">
        Checked {formatAt(Date.parse(limits.checkedAt))}
      </span>
    </div>
  );
}
