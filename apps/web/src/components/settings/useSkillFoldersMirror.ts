import type { EnvironmentId, SkillFolderPrefs } from "@t3tools/contracts";
import { useCallback } from "react";

import { projectEnvironment } from "~/state/projects";
import { useAtomCommand } from "~/state/use-atom-command";
import { SKILL_FOLDERS_MIRROR_PATH, serializeSkillFoldersMirror } from "./skillFoldersMirror.logic";

/**
 * Returns a function that copies the user's skill folders into their AIOS after each change.
 * It does nothing when no AIOS folder is confirmed. The copy is best effort: the app setting stays
 * the source of truth, so a failed write never blocks the edit.
 */
export function useSkillFoldersMirror(environmentId: EnvironmentId | null, aiosRoot: string) {
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  return useCallback(
    (prefs: SkillFolderPrefs) => {
      if (environmentId === null || aiosRoot.trim().length === 0) return;
      void writeFile({
        environmentId,
        input: {
          cwd: aiosRoot,
          relativePath: SKILL_FOLDERS_MIRROR_PATH,
          contents: serializeSkillFoldersMirror(prefs),
        },
      });
    },
    [environmentId, aiosRoot, writeFile],
  );
}
