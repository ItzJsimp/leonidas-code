import { useEffect, useRef } from "react";
import { shouldNudgeContextHandoff, type ContextWindowSnapshot } from "../../lib/contextWindow";
import { toastManager } from "../ui/toast";
import { Button } from "../ui/button";

export function ContextHandoffNudge({
  chatKey,
  contextWindow,
  onHandoff,
}: {
  readonly chatKey: string;
  readonly contextWindow: ContextWindowSnapshot | null;
  readonly onHandoff?: () => void;
}) {
  const shown = useRef(false);
  const shouldNudge = shouldNudgeContextHandoff(contextWindow);

  useEffect(() => {
    if (!shouldNudge || shown.current) return;
    const storageKey = `context-handoff-nudge:${chatKey}`;
    try {
      if (window.localStorage.getItem(storageKey) === "shown") return;
      window.localStorage.setItem(storageKey, "shown");
    } catch {
      // Storage can be disabled; still show only once while this chat is mounted.
    }
    shown.current = true;
    const toastId = toastManager.add({
      type: "info",
      title: "Think about starting a new chat",
      description: (
        <span className="flex flex-col items-start gap-2">
          <span>
            This chat has used at least 45% of its memory. Move to a new chat when you reach a good
            place to stop.
          </span>
          {onHandoff ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                toastManager.close(toastId);
                onHandoff();
              }}
            >
              Move to a new chat
            </Button>
          ) : null}
        </span>
      ),
      timeout: 0,
      actionProps: {
        children: "Ask me later",
        onClick: () => toastManager.close(toastId),
      },
    });
  }, [chatKey, shouldNudge, onHandoff]);

  // No line when the service hides its memory size: the user cannot act on it.
  return null;
}
