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
      title: "Consider handing off to a fresh chat",
      description: (
        <span className="flex flex-col items-start gap-2">
          <span>
            This chat has used at least 45% of its context window. Prepare a handoff when you reach
            a good stopping point.
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
              Hand off
            </Button>
          ) : null}
        </span>
      ),
      timeout: 0,
      actionProps: {
        children: "Not now",
        onClick: () => toastManager.close(toastId),
      },
    });
  }, [chatKey, shouldNudge, onHandoff]);

  if (contextWindow?.maxTokens != null && contextWindow.maxTokens > 0) return null;
  return (
    <p className="px-4 py-1 text-2xs text-muted-foreground">
      This provider has not reported its context window size. Handoff reminders are unavailable.
    </p>
  );
}
