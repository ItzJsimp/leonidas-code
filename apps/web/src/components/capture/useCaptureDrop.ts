import { FOCUS_ITEM_MAX_LENGTH } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useCallback } from "react";

import { toastManager } from "~/components/ui/toast";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { focusUpdate } from "~/state/taskBoard";
import { useAtomCommand } from "~/state/use-atom-command";
import { useFocusWidgetStore } from "../focus/focusWidgetStore";
import { failureText } from "../taskBoard/useTaskActions.logic";

export type CaptureDropResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string | null };

/** A note can have several lines; trim it and cap the length. */
function toNotepadLine(text: string): string {
  return text.trim().slice(0, FOCUS_ITEM_MAX_LENGTH);
}

/**
 * Adds text to the notepad (the Global section of `<AIOS>/memory/focus.md`) and shows the one
 * toast every capture entry point shares, with a button that opens the notepad.
 * `error` is null when the command was interrupted and nothing should be reported.
 */
export function useCaptureDrop() {
  const environmentId = usePrimaryEnvironmentId();
  const runUpdate = useAtomCommand(focusUpdate, { reportFailure: false });

  const drop = useCallback(
    async (text: string): Promise<CaptureDropResult> => {
      const line = toNotepadLine(text);
      if (environmentId === null || line.length === 0) return { ok: false, error: null };
      const result = await runUpdate({
        environmentId,
        input: { op: "add", projectId: null, text: line },
      });
      if (result._tag !== "Success") {
        return {
          ok: false,
          error: isAtomCommandInterrupted(result)
            ? null
            : failureText(squashAtomCommandFailure(result), "Could not save your note. Try again."),
        };
      }
      const toastId = toastManager.add({
        type: "success",
        title: "Added to your notepad",
        timeout: 4000,
        actionProps: {
          children: "Show notepad",
          onClick: () => {
            toastManager.close(toastId);
            useFocusWidgetStore.getState().setVisible(true);
          },
        },
      });
      return { ok: true };
    },
    [environmentId, runUpdate],
  );

  return { drop, canDrop: environmentId !== null };
}
