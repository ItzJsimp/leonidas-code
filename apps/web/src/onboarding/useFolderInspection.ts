import type { EnvironmentId } from "@t3tools/contracts";
import { useCallback } from "react";

import { filesystemEnvironment } from "../state/filesystem";
import { useAtomQueryRunner } from "../state/use-atom-query-runner";
import { folderInspectionRequest, type FolderInspection } from "./folderInspection.logic";

/**
 * Asks the environment that owns the folder what is in it before onboarding writes there.
 * Never throws: a check that cannot run comes back as `unknown`.
 */
export function useFolderInspection(environmentId: EnvironmentId | undefined) {
  const inspect = useAtomQueryRunner(filesystemEnvironment.inspectFolder, {
    reportFailure: false,
    reportDefect: false,
    refresh: true,
  });

  return useCallback(
    async (folder: string, filesToCheck: readonly string[]): Promise<FolderInspection> => {
      const request = folderInspectionRequest(environmentId, folder, filesToCheck);
      if (!request) return { _tag: "unknown" };
      try {
        const result = await inspect(request);
        return result._tag === "Success" ? result.value : { _tag: "unknown" };
      } catch {
        return { _tag: "unknown" };
      }
    },
    [environmentId, inspect],
  );
}
