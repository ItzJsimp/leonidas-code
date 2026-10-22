import type { ReactElement, ReactNode } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

/** The app tooltip around one focusable child: every control on these screens explains itself. */
export function Tip({
  text,
  children,
}: {
  readonly text: ReactNode;
  readonly children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup>{text}</TooltipPopup>
    </Tooltip>
  );
}
