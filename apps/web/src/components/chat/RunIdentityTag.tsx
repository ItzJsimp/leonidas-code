import { ZapIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import type { RunIdentity } from "./runIdentity.logic";

/**
 * Which agent and account ran a turn: model, effort and the configured account
 * name, as one quiet pill under the response. Always visible so a glance at the
 * thread shows who did the work, including after a failover or handoff.
 */
export function RunIdentityTag({
  identity,
  className,
}: {
  readonly identity: RunIdentity;
  readonly className?: string;
}) {
  const { provider, modelLabel, effortLabel, fastMode, accountLabel, accentColor } = identity;
  const summary = [modelLabel, effortLabel, accountLabel].filter(Boolean).join(" · ");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            data-run-identity-tag="true"
            className={cn(
              "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 py-0.5 ps-1.5 pe-2 text-2xs text-muted-foreground",
              className,
            )}
          />
        }
      >
        {provider ? (
          <ProviderInstanceIcon
            driverKind={provider.driver}
            displayName={accountLabel ?? provider.driver}
            accentColor={accentColor}
            acpRegistryIconUrl={provider.iconUrl}
            iconClassName="size-3"
          />
        ) : null}
        <span className="truncate font-medium text-foreground/80">{modelLabel}</span>
        {fastMode ? <ZapIcon aria-label="Fast mode" className="size-2.5 shrink-0" /> : null}
        {effortLabel ? (
          <>
            <span aria-hidden className="opacity-40">
              ·
            </span>
            <span className="shrink-0">{effortLabel}</span>
          </>
        ) : null}
        {accountLabel ? (
          <>
            <span aria-hidden className="opacity-40">
              ·
            </span>
            <span className="inline-flex min-w-0 items-center gap-1">
              {accentColor ? (
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              ) : null}
              <span className="truncate">{accountLabel}</span>
            </span>
          </>
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="top">{`Ran on ${summary}${fastMode ? " · fast mode" : ""}`}</TooltipPopup>
    </Tooltip>
  );
}
