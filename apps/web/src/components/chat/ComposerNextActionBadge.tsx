import { CompassIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "~/lib/utils";
import { ComposerBanner } from "./ComposerBanner";

/** Prompt the badge drops into the composer; the agent's next-action skill answers it. */
export const NEXT_ACTION_PROMPT = "next action";

/**
 * Shoulder tab beside the stash tab that fills the composer with "next action", so the skill
 * is reachable without knowing its phrase. It never sends; the user reviews and presses send.
 */
export const ComposerNextActionBadge = memo(function ComposerNextActionBadge(props: {
  /** Push the tab to the right edge when no stash tab does it. */
  alignRight: boolean;
  onFill: () => void;
}) {
  return (
    <ComposerBanner.Root
      density="comfortable"
      width="content"
      data-composer-shoulder-tab
      className={cn(props.alignRight && "ml-auto")}
    >
      <ComposerBanner.Row
        render={<button type="button" />}
        data-tour="composer-next-action"
        aria-label="Next action: ask the agent what to work on next"
        className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
        onPointerDown={(event) => event.preventDefault()}
        onClick={props.onFill}
      >
        <ComposerBanner.Icon>
          <CompassIcon />
        </ComposerBanner.Icon>
        <ComposerBanner.Content>Next action</ComposerBanner.Content>
      </ComposerBanner.Row>
    </ComposerBanner.Root>
  );
});
