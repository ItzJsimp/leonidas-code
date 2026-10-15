import type { SkillFolderPrefs } from "@t3tools/contracts";

/** Where the copy of the user's skill folders lives inside their AIOS, so every engine can read it. */
export const SKILL_FOLDERS_MIRROR_PATH = ".agents/skills/folders.json";

/** The file body for the AIOS copy: stable key order and a trailing newline keep git diffs small. */
export function serializeSkillFoldersMirror(prefs: SkillFolderPrefs): string {
  const folders = prefs.folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    skills: [...folder.skills],
  }));
  return `${JSON.stringify({ folders }, null, 2)}\n`;
}
