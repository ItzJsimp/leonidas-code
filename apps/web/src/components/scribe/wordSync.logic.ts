/** The folder the engine syncs words through, read from `settings.sections.features`. */
export function wordSyncDirOf(features: Readonly<Record<string, unknown>>): string {
  const value = features.wordSyncDir;
  return typeof value === "string" ? value.trim() : "";
}

/** A full Windows or POSIX path. Blank is allowed because it turns word sync off. */
export function wordSyncDirError(input: string): string | null {
  const dir = input.trim();
  if (dir === "") return null;
  return /^([A-Za-z]:[\\/]|\\\\|\/)/.test(dir)
    ? null
    : "Enter the full path, for example D:\\Leonidas AIOS\\scribe\\words.";
}
