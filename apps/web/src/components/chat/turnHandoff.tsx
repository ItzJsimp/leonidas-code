import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import type { OrchestrationV2Run, SavedItem } from "@t3tools/contracts";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";

type CountedRun = Pick<
  OrchestrationV2Run,
  "status" | "startedAt" | "workStartedAt" | "restartContinuationOfRunId"
>;

export function countHandoffTurns(runs: ReadonlyArray<CountedRun>) {
  return runs.filter(
    (run) =>
      run.startedAt !== null &&
      run.status !== "queued" &&
      run.status !== "rolled_back" &&
      !run.workStartedAt &&
      !run.restartContinuationOfRunId,
  ).length;
}

export function selectHandoffPrompt(
  items: ReadonlyArray<Pick<SavedItem, "title" | "body" | "status">>,
) {
  return (
    items.find(
      (item) =>
        item.status !== "archived" &&
        item.title.trim().toLowerCase() === "handoff now" &&
        item.body.trim(),
    )?.body ??
    "Use the session-handoff skill to write a handoff for this chat so I can continue in a fresh session."
  );
}

export function useTurnHandoffBanner({
  chatKey,
  turnCount,
  disabled,
  onHandoff,
}: {
  chatKey: string;
  turnCount: number;
  disabled: boolean;
  onHandoff: (stillCurrent: () => boolean) => Promise<boolean>;
}): ComposerBannerStackItem | null {
  const storageKey = `turn-handoff-dismissed:${chatKey}`;
  const storedDismissal = useMemo(() => {
    try {
      return localStorage.getItem(storageKey) === "dismissed";
    } catch {
      return false;
    }
  }, [storageKey]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currentKey = useRef(chatKey);
  useLayoutEffect(() => {
    currentKey.current = chatKey;
  }, [chatKey]);
  return useMemo(() => {
    if (turnCount < 30 || storedDismissal || dismissedKey === chatKey) return null;
    const dismiss = () => {
      setDismissedKey(chatKey);
      try {
        localStorage.setItem(storageKey, "dismissed");
      } catch {
        /* Storage can be disabled; keep this mounted reminder dismissed. */
      }
    };
    return {
      id: "turn-handoff",
      variant: "info",
      icon: <ArrowRightIcon />,
      title: `${turnCount} turns in this thread`,
      description: "Save a handoff at a good stopping point to continue in a fresh thread.",
      dismissLabel: "Dismiss handoff reminder",
      onDismiss: dismiss,
      actions: (
        <Button
          size="xs"
          variant="ghost"
          disabled={disabled || busy}
          onClick={async () => {
            if (busy || disabled) return;
            setBusy(true);
            try {
              if (await onHandoff(() => currentKey.current === chatKey)) dismiss();
            } catch (error) {
              toastManager.add({
                type: "error",
                title: "Could not start the handoff",
                description: error instanceof Error ? error.message : String(error),
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Starting..." : "Handoff now"}
        </Button>
      ),
    };
  }, [chatKey, turnCount, disabled, onHandoff, storedDismissal, dismissedKey, busy, storageKey]);
}
