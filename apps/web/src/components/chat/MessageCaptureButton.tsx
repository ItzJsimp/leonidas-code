import { InboxIcon } from "lucide-react";
import { memo } from "react";

import { useCaptureDrop } from "../capture/useCaptureDrop";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** One click saves this message to the inbox, remembering which chat it came from. */
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
            aria-label="Save message to inbox"
            disabled={!canDrop}
            type="button"
            size="xs"
            variant="ghost-muted"
            onClick={() => {
              void drop(props.text, props.threadId ? `chat ${props.threadId}` : "chat").then(
                (result) => {
                  if (!result.ok && result.error) {
                    toastManager.add({
                      type: "error",
                      title: "Could not save",
                      description: result.error,
                    });
                  }
                },
              );
            }}
          />
        }
      >
        <InboxIcon className="size-3" />
      </TooltipTrigger>
      <TooltipPopup>
        <p>Save to inbox</p>
      </TooltipPopup>
    </Tooltip>
  );
});
