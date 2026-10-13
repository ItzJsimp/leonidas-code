import { ProviderDriverKind } from "@t3tools/contracts";

import { cn } from "../../lib/utils";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Badge } from "../ui/badge";
import { HEADLINE_PROVIDERS } from "./AddProviderInstanceDialog.logic";
import { providerClients } from "./providerDriverMeta";

const CARD_CLASS =
  "relative flex w-full cursor-pointer items-center gap-3 rounded-lg bg-card px-3 py-3 text-left outline-none ring-1 ring-black/5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/3 dark:ring-white/5 dark:hover:bg-white/5";
const SELECTED_CLASS =
  "bg-primary/8 ring-2 ring-inset ring-primary hover:bg-primary/8 dark:bg-primary/15 dark:ring-primary dark:hover:bg-primary/15";

const HEADLINE_DRIVERS: ReadonlySet<string> = new Set(HEADLINE_PROVIDERS.map((p) => p.driver));

/** Drivers that are neither a headline card nor the ACP registry entry. */
export function listMoreProviders() {
  return providerClients.definitions.filter(
    (option) => !HEADLINE_DRIVERS.has(option.driverKind) && option.driverKind !== "acpRegistry",
  );
}

/** The four big "who do you use?" cards: plain names, one plain sentence each. */
export function HeadlineProviderCards({
  value,
  disabled,
  onSelect,
}: {
  readonly value: ProviderDriverKind;
  readonly disabled: boolean;
  readonly onSelect: (driver: ProviderDriverKind) => void;
}) {
  return (
    <div role="group" aria-label="AI provider" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {HEADLINE_PROVIDERS.flatMap((entry) => {
        const option = providerClients.get(ProviderDriverKind.make(entry.driver));
        if (!option) return [];
        const selected = option.driverKind === value;
        return [
          <button
            key={entry.driver}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            className={cn(CARD_CLASS, "items-start py-3.5", selected && SELECTED_CLASS)}
            onClick={() => onSelect(option.driverKind)}
          >
            <ProviderInstanceIcon
              driverKind={option.driverKind}
              displayName={entry.name}
              iconClassName="mt-0.5 size-5"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{entry.name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {entry.blurb}
              </span>
            </span>
          </button>,
        ];
      })}
    </div>
  );
}

/** Compact buttons for every other provider driver, shown under "More providers". */
export function MoreProviderCards({
  value,
  disabled,
  onSelect,
}: {
  readonly value: ProviderDriverKind;
  readonly disabled: boolean;
  readonly onSelect: (driver: ProviderDriverKind) => void;
}) {
  return (
    <div role="group" aria-label="More providers" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {listMoreProviders().map((option) => (
        <button
          key={option.driverKind}
          type="button"
          aria-pressed={option.driverKind === value}
          disabled={disabled}
          className={cn(CARD_CLASS, option.driverKind === value && SELECTED_CLASS)}
          onClick={() => onSelect(option.driverKind)}
        >
          <ProviderInstanceIcon
            driverKind={option.driverKind}
            displayName={option.label}
            iconClassName="size-4"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {option.label}
          </span>
          {option.badgeLabel ? (
            <Badge variant="warning" size="sm">
              {option.badgeLabel}
            </Badge>
          ) : null}
        </button>
      ))}
    </div>
  );
}
