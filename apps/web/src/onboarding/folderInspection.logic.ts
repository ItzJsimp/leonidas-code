import type {
  EnvironmentId,
  FilesystemInspectFolderInput,
  FilesystemInspectFolderResult,
} from "@t3tools/contracts";

/** The server's answer, or `unknown` when the check itself could not run. */
export type FolderInspection = FilesystemInspectFolderResult | { readonly _tag: "unknown" };

const MAX_LISTED_NAMES = 6;

/**
 * The request goes to the environment that owns the folder, with the path exactly as typed:
 * only that server can resolve `~` or a Windows path on its own disk.
 */
export function folderInspectionRequest(
  environmentId: EnvironmentId | undefined,
  folder: string,
  filesToCheck: readonly string[],
): { readonly environmentId: EnvironmentId; readonly input: FilesystemInspectFolderInput } | null {
  const path = folder.trim();
  if (!environmentId || path.length === 0) return null;
  return { environmentId, input: { path, filesToCheck: [...new Set(filesToCheck)] } };
}

/** Only a missing folder or a truly empty one is safe to write into without asking. */
export function needsConfirmation(inspection: FolderInspection): boolean {
  switch (inspection._tag) {
    case "missing":
      return false;
    case "directory":
      return inspection.directoryCount > 0 || inspection.fileCount > 0;
    default:
      return true;
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function listNames(names: readonly string[], total = names.length): string {
  const shown = names.slice(0, MAX_LISTED_NAMES).join(", ");
  const extra = total - Math.min(names.length, MAX_LISTED_NAMES);
  return extra > 0 ? `${shown}, and ${extra} more` : shown;
}

export function describeInspection(inspection: FolderInspection): string[] {
  switch (inspection._tag) {
    case "missing":
      return [];
    case "unknown":
      return ["Could not check this folder first, so files in it may be replaced."];
    case "unreadable":
      return [
        `Could not read this folder${inspection.code ? ` (${inspection.code})` : ""}, so files in it may be replaced.`,
      ];
    case "notDirectory":
      return ["This path is a file, not a folder."];
    case "directory": {
      const { directoryCount, fileCount } = inspection;
      if (directoryCount === 0 && fileCount === 0) return [];
      const parts = [
        directoryCount > 0 ? plural(directoryCount, "folder") : null,
        fileCount > 0 ? plural(fileCount, "file") : null,
      ].filter((part): part is string => part !== null);
      const lines = [`Folder already has ${parts.join(" and ")} inside.`];
      const names = [...inspection.directories.map((name) => `${name}/`), ...inspection.files];
      lines.push(`Inside: ${listNames(names, directoryCount + fileCount)}.`);
      if (inspection.existingFiles.length > 0) {
        lines.push(`These files will be replaced: ${listNames(inspection.existingFiles)}.`);
      }
      return lines;
    }
  }
}
