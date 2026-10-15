import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useCallback } from "react";

import { toastManager } from "~/components/ui/toast";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { inboxDrop, inboxUndo, taskBoardWorkspaceQuery } from "~/state/taskBoard";
import { useAtomCommand } from "~/state/use-atom-command";
import { failureText } from "../taskBoard/useTaskActions.logic";

export type CaptureDropResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string | null };

/**
 * Saves text to the inbox and shows the one toast every capture entry point shares, with Undo.
 * `error` is null when the command was interrupted and nothing should be reported.
 */
export function useCaptureDrop() {
  const environmentId = usePrimaryEnvironmentId();
  const workspace = useEnvironmentQuery(
    environmentId ? taskBoardWorkspaceQuery({ environmentId, input: {} }) : null,
  );
  const runDrop = useAtomCommand(inboxDrop, { reportFailure: false });
  const runUndo = useAtomCommand(inboxUndo, { reportFailure: false });
  const actor = workspace.data?.member ?? "Leonidas Code";

  const drop = useCallback(
    async (text: string, source?: string): Promise<CaptureDropResult> => {
      if (environmentId === null || text.trim().length === 0) return { ok: false, error: null };
      const result = await runDrop({
        environmentId,
        input: { text: text.trim(), ...(source ? { source } : {}), actor },
      });
      if (result._tag !== "Success") {
        return {
          ok: false,
          error: isAtomCommandInterrupted(result)
            ? null
            : failureText(squashAtomCommandFailure(result), "Could not save your note. Try again."),
        };
      }
      const id = result.value.id;
      const toastId = toastManager.add({
        type: "success",
        title: result.value.kind === "task" ? "Added to your tasks" : "Saved to your inbox",
        ...(result.value.filedTask ? { description: result.value.filedTask } : {}),
        timeout: 4000,
        actionProps: {
          children: "Undo",
          onClick: () => {
            toastManager.close(toastId);
            void runUndo({ environmentId, input: { id } });
          },
        },
      });
      return { ok: true };
    },
    [actor, environmentId, runDrop, runUndo],
  );

  return { drop, canDrop: environmentId !== null };
}
