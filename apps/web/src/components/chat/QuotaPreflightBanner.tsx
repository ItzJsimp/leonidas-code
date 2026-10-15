import { EyeIcon, GaugeIcon } from "lucide-react";

import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";
import type { ProviderFailoverTarget } from "./providerFailover";
import type { QuotaPreflightAdvice } from "./quotaPreflight";

export function usageWarningBannerItem(input: {
  readonly instanceId: string;
  readonly label: string;
  readonly usedPercent: number;
  readonly onDismiss: () => void;
}): ComposerBannerStackItem {
  return {
    id: `usage-warning:${input.instanceId}`,
    variant: "warning",
    priority: "notice",
    icon: <GaugeIcon />,
    title: `${input.label}: ${Math.round(input.usedPercent)}% of your usage limit used`,
    actions: (
      <Popover>
        <PopoverTrigger
          openOnHover
          render={<Button size="icon-xs" variant="ghost-muted" aria-label="Change usage warning" />}
        >
          <EyeIcon />
        </PopoverTrigger>
        <PopoverPopup aria-label="Change usage warning" tooltipStyle side="top">
          To change or turn off this warning, open Settings and then General.
        </PopoverPopup>
      </Popover>
    ),
    dismissLabel: "Dismiss",
    onDismiss: input.onDismiss,
  };
}

export function quotaPreflightBannerItem(input: {
  readonly advice: QuotaPreflightAdvice;
  readonly currentInstanceId: string;
  readonly currentLabel: string;
  readonly onUse: (target: ProviderFailoverTarget) => void;
  readonly onDismiss: () => void;
}): ComposerBannerStackItem {
  const { advice, currentInstanceId, currentLabel, onUse, onDismiss } = input;
  const { target } = advice;
  const usedPercent = advice.usedPercent === null ? null : Math.round(advice.usedPercent);
  return {
    id: `quota-preflight:${currentInstanceId}`,
    variant: "warning",
    priority: "notice",
    icon: <GaugeIcon />,
    title: `${currentLabel} is nearly out of usage`,
    description: `${usedPercent === null ? "" : `${usedPercent}% used. `}Send your next message on ${target.label} so this chat keeps going.`,
    actions: (
      <Button size="xs" variant="ghost" onClick={() => onUse(target)}>
        Use {target.label} next
      </Button>
    ),
    dismissLabel: "Dismiss",
    onDismiss,
  };
}
