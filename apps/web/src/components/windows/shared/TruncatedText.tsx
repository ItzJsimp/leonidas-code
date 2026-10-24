import { cn } from "~/lib/utils";

import { Tip } from "../../twoState/Tip";

/** One line that cuts with an ellipsis and gives the full text in a tooltip. */
export function TruncatedText({
  text,
  className,
}: {
  readonly text: string;
  readonly className?: string;
}) {
  return (
    <Tip text={text}>
      <span className={cn("block truncate", className)}>{text}</span>
    </Tip>
  );
}
