import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";

import { toastManager } from "~/components/ui/toast";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { useOpenInPreferredEditor } from "~/editorPreferences";
import { userErrorToastFields } from "~/lib/userErrorToast";
import { primaryServerAvailableEditorsAtom } from "~/state/server";

import { aiosFilePath } from "./aiosFile.logic";

/**
 * Opens one file of the active AIOS folder in the user's editor, by its AIOS-relative path
 * (`ideal-state/goals.md`). A failure shows a toast. `root` is null when no AIOS is connected.
 */
export function useOpenAiosFile() {
  const { environmentId, active } = useActiveAiosWorkspace();
  const editors = useAtomValue(primaryServerAvailableEditorsAtom);
  const openInEditor = useOpenInPreferredEditor(environmentId, editors);
  const root = active?.root ?? null;
  const open = useCallback(
    async (relativePath: string) => {
      if (root === null) {
        toastManager.add({
          type: "error",
          title: "No AIOS folder is connected",
          description: "Connect your AIOS folder on the Tasks page, then try again.",
        });
        return;
      }
      const result = await openInEditor(aiosFilePath(root, relativePath));
      if (result._tag === "Success") return;
      toastManager.add({
        type: "error",
        title: `Could not open ${relativePath}`,
        ...userErrorToastFields(squashAtomCommandFailure(result)),
      });
    },
    [openInEditor, root],
  );
  return { open, root };
}
