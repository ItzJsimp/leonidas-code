import { BotIcon, CircleDashedIcon, UserIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "~/lib/utils";

import type { OwnerLens, OwnerLensOption } from "./owner.logic";

const ICONS: Partial<Record<OwnerLens, LucideIcon>> = {
  everyone: UsersIcon,
  mine: UserIcon,
  anyone: CircleDashedIcon,
  agents: BotIcon,
};

/**
 * Whose work the page shows: everyone, the viewer, each teammate, work nobody owns yet, or agent
 * work. It sits above the views because it answers the first question on a shared board.
 */
export const OwnerLensTabs = memo(function OwnerLensTabs(props: {
  readonly options: ReadonlyArray<OwnerLensOption>;
  readonly value: OwnerLens;
  readonly onChange: (lens: OwnerLens) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Whose tasks"
      className="-mx-1 flex min-w-0 flex-wrap items-center gap-1 px-1 pb-0.5"
    >
      {props.options.map((option) => {
        const selected = option.lens === props.value;
        const Icon = ICONS[option.lens];
        return (
          <button
            key={option.lens}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => props.onChange(option.lens)}
            className={cn(
              "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm outline-none transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {Icon ? (
              <Icon aria-hidden className="size-3.5" />
            ) : (
              <span
                aria-hidden
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-3xs font-medium",
                  selected ? "bg-background/20" : "bg-secondary text-secondary-foreground",
                )}
              >
                {option.label.charAt(0).toUpperCase()}
              </span>
            )}
            <span>{option.label}</span>
            <span
              className={cn(
                "tabular-nums text-xs",
                selected ? "text-background/70" : "text-muted-foreground",
              )}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
});
