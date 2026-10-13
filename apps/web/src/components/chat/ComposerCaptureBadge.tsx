import { InboxIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "~/lib/utils";
import { ComposerBanner } from "./ComposerBanner";

/** Shoulder tab that opens the quick-capture box without touching the draft in the composer. */
export const ComposerCaptureBadge = memo(function ComposerCaptureBadge(props: {
  /** Push the tab to the right edge when no stash tab does it. */
  alignRight: boolean;
  shortcutLabel: string | null;
  onOpen: () => void;
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
        data-tour="composer-capture"
        aria-label="Quick capture: save a note, idea or task"
        title={props.shortcutLabel ? `Quick capture (${props.shortcutLabel})` : "Quick capture"}
        className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
        onPointerDown={(event) => event.preventDefault()}
        onClick={props.onOpen}
      >
        <ComposerBanner.Icon>
          <InboxIcon />
        </ComposerBanner.Icon>
        <ComposerBanner.Content>Capture</ComposerBanner.Content>
      </ComposerBanner.Row>
    </ComposerBanner.Root>
  );
});
