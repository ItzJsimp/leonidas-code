import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/**
 * One tooltip for one control. Say what the control does and what it costs.
 * The wrapper is a real box so hover works on disabled controls too.
 */
export function Hint({
  tip,
  children,
  className,
  block = false,
}: {
  readonly tip: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  /** True for form fields that fill the row. */
  readonly block?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<div className={cn(block ? "flex w-full" : "inline-flex", className)} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup side="top" className="max-w-72">
        {tip}
      </TooltipPopup>
    </Tooltip>
  );
}
