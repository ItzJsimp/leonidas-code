import { GaugeIcon } from "lucide-react";

import { Button } from "../ui/button";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";
import type { ProviderFailoverTarget } from "./providerFailover";
import type { QuotaPreflightAdvice } from "./quotaPreflight";

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
