import { InboxIcon } from "lucide-react";
import { memo } from "react";

import { useCaptureDrop } from "../capture/useCaptureDrop";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** One click adds this message to the notepad. */
export const MessageCaptureButton = memo(function MessageCaptureButton(props: {
  readonly text: string;
  readonly threadId: string | undefined;
}) {
  const { drop, canDrop } = useCaptureDrop();
  if (props.text.trim().length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Add message to notepad"
            disabled={!canDrop}
            type="button"
            size="xs"
            variant="ghost-muted"
            onClick={() => {
              void drop(props.text).then((result) => {
                if (!result.ok && result.error) {
                  toastManager.add({
                    type: "error",
                    title: "Could not save",
                    description: result.error,
                  });
                }
              });
            }}
          />
        }
      >
        <InboxIcon className="size-3" />
      </TooltipTrigger>
      <TooltipPopup>
        <p>Add to notepad</p>
      </TooltipPopup>
    </Tooltip>
  );
});
