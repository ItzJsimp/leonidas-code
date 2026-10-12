import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { useCallback } from "react";

import { filesystemEnvironment } from "../state/filesystem";
import { projectEnvironment } from "../state/projects";
import { useAtomQueryRunner } from "../state/use-atom-query-runner";
import type { FolderInspection } from "./folderInspection.logic";

function field(error: unknown, key: string): unknown {
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

function isMissingFolder(error: unknown): boolean {
  if (field(error, "failure") !== "read_directory_failed") return false;
  const cause = field(error, "cause");
  if (cause === undefined || cause === null) return true;
  const text = typeof cause === "string" ? cause : String(field(cause, "message") ?? cause);
  const code = field(cause, "code");
  return code === "ENOENT" || /ENOENT|no such file|cannot find/i.test(text);
}

/** Only a failed realpath means the file is absent; any other outcome means something is there. */
function isMissingFile(error: unknown): boolean {
  return (
    field(error, "failure") === "operation_failed" &&
    field(error, "operation") === "realpath-target"
  );
}

/**
 * Looks at the AIOS folder before onboarding writes into it. Never throws:
 * anything unexpected comes back as `unknown`.
 */
export function useFolderInspection(environmentId: EnvironmentId | undefined) {
  const browse = useAtomQueryRunner(filesystemEnvironment.browse, {
    reportFailure: false,
    reportDefect: false,
    refresh: true,
  });
  const readFile = useAtomQueryRunner(projectEnvironment.readFile, {
    reportFailure: false,
    reportDefect: false,
    refresh: true,
  });

  return useCallback(
    async (folder: string, filesToCheck: readonly string[]): Promise<FolderInspection> => {
      const trimmed = folder.trim();
      if (!environmentId || trimmed.length === 0) return { status: "unknown" };
      try {
        const listing = await browse({
          environmentId,
          input: { partialPath: trimmed.replace(/[/\\]+$/, "") + "/" },
        });
        if (listing._tag !== "Success") {
          return isMissingFolder(squashAtomCommandFailure(listing))
            ? { status: "missing" }
            : { status: "unknown" };
        }
        const resolvedPath = listing.value.parentPath;
        const checks = await Promise.all(
          filesToCheck.map(async (relativePath) => {
            const result = await readFile({
              environmentId,
              input: { cwd: resolvedPath, relativePath },
            });
            if (result._tag === "Success") return relativePath;
            return isMissingFile(squashAtomCommandFailure(result)) ? null : relativePath;
          }),
        );
        return {
          status: "exists",
          resolvedPath,
          subfolders: listing.value.entries.map((entry) => entry.name),
          existingFiles: checks.filter((path): path is string => path !== null),
        };
      } catch {
        return { status: "unknown" };
      }
    },
    [browse, environmentId, readFile],
  );
}
