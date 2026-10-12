export type FolderInspection =
  | { readonly status: "missing" }
  | {
      readonly status: "exists";
      readonly resolvedPath: string;
      readonly subfolders: readonly string[];
      readonly existingFiles: readonly string[];
    }
  | { readonly status: "unknown" };

const MAX_LISTED_NAMES = 6;

export function needsConfirmation(inspection: FolderInspection): boolean {
  return (
    inspection.status === "exists" &&
    (inspection.subfolders.length > 0 || inspection.existingFiles.length > 0)
  );
}

function listNames(names: readonly string[]): string {
  const shown = names.slice(0, MAX_LISTED_NAMES).join(", ");
  const extra = names.length - MAX_LISTED_NAMES;
  return extra > 0 ? `${shown}, and ${extra} more` : shown;
}

export function describeInspection(inspection: FolderInspection): string[] {
  if (inspection.status !== "exists") return [];
  const lines: string[] = [];
  const count = inspection.subfolders.length;
  if (count > 0) {
    lines.push(`Folder already exists with ${count} ${count === 1 ? "folder" : "folders"} inside.`);
  } else if (inspection.existingFiles.length > 0) {
    lines.push("Folder already exists.");
  }
  if (inspection.existingFiles.length > 0) {
    lines.push(`These files will be replaced: ${listNames(inspection.existingFiles)}.`);
  }
  return lines;
}
