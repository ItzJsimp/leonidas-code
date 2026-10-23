import type { EnvironmentId } from "@t3tools/contracts";
import { useMemo } from "react";

import { ActiveAgentsOverlay } from "~/components/chat/ActiveAgentsBadge";
import { ProviderInstanceIcon } from "~/components/chat/ProviderInstanceIcon";
import { useActiveAgentCounts } from "~/hooks/useActiveAgentCounts";
import { useConnectedUsageAccounts } from "~/hooks/useConnectedUsageAccounts";
import { useNowMinute } from "~/hooks/useNowMinute";
import { usePrimaryEnvironmentId } from "~/state/environments";

import { fiveHourMeter } from "./chatUsageMeter";
import { Tip } from "./Tip";

const MAX_ACCOUNT_ICONS = 4;

/**
 * The right end of the chat header: every connected account with the agents running on it, and
 * the Claude 5-hour meter. Shown in the chat pane only, never on the Command Center.
 */
export function ChatPaneTools() {
  const environmentId = usePrimaryEnvironmentId();
  return environmentId ? <Tools environmentId={environmentId} /> : null;
}

function Tools({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const { active, others } = useConnectedUsageAccounts(environmentId, null);
  const accounts = useMemo(() => [...active, ...others], [active, others]);
  const agentsOn = useActiveAgentCounts();
  const minute = useNowMinute();
  const meter = fiveHourMeter(accounts, Date.parse(`${minute}:00Z`));
  if (accounts.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-2">
      {accounts.slice(0, MAX_ACCOUNT_ICONS).map((account) => {
        const count = agentsOn(account.id);
        const label =
          count > 0
            ? `${account.label}, ${count} active ${count === 1 ? "helper" : "helpers"}`
            : account.label;
        return (
          <Tip key={account.id} text={label}>
            <span
              role="img"
              tabIndex={0}
              aria-label={label}
              className="relative inline-flex size-6 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ProviderInstanceIcon
                driverKind={account.driver}
                displayName={account.label}
                className="size-4"
                iconClassName="size-4"
              />
              <ActiveAgentsOverlay count={count} />
            </span>
          </Tip>
        );
      })}
      {accounts.length > MAX_ACCOUNT_ICONS ? (
        <Tip
          text={accounts
            .slice(MAX_ACCOUNT_ICONS)
            .map((account) => account.label)
            .join(", ")}
        >
          <span
            role="img"
            tabIndex={0}
            aria-label={`${accounts.length - MAX_ACCOUNT_ICONS} more accounts`}
            className="inline-flex h-6 items-center rounded-md bg-muted px-1.5 text-xs text-muted-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-ring"
          >
            +{accounts.length - MAX_ACCOUNT_ICONS}
          </span>
        </Tip>
      ) : null}
      {meter ? (
        <Tip text={meter.tip}>
          <span
            role="img"
            tabIndex={0}
            aria-label={meter.tip}
            data-usage-meter
            data-level={meter.level}
            className="inline-flex items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-ring data-[level=warning]:text-warning-foreground"
          >
            {meter.label}
            <span aria-hidden className="h-1 w-10 overflow-hidden rounded-full bg-muted">
              <span
                className={
                  meter.level === "warning"
                    ? "block h-full bg-warning-foreground"
                    : "block h-full bg-foreground"
                }
                style={{ width: `${meter.fill}%` }}
              />
            </span>
          </span>
        </Tip>
      ) : null}
    </div>
  );
}
