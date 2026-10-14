import type { ResolvedSkillFolder } from "@t3tools/client-runtime/skillFolders";
import { skillsOutsideFolders } from "@t3tools/client-runtime/skillFolders";
import type { ServerProviderSkill } from "@t3tools/contracts";

import type { ComposerCommandItem } from "./ComposerCommandMenu";
import { searchSlashCommandItems } from "./composerSlashCommandSearch";

type SkillItem = Extract<ComposerCommandItem, { type: "skill" }>;

export const SKILL_FOLDER_BACK_ITEM_ID = "skill-folder:back";

export function skillFolderItemId(folderId: string): string {
  return `skill-folder:${folderId}`;
}

/** The folder id behind a folder row's item id, or null for any other item. */
export function skillFolderIdFromItemId(itemId: string): string | null {
  return itemId.startsWith("skill-folder:") && itemId !== SKILL_FOLDER_BACK_ITEM_ID
    ? itemId.slice("skill-folder:".length)
    : null;
}

const KIND_LABEL = { custom: "Mine", pack: "Pack", category: "Category" } as const;

function folderItem(folder: ResolvedSkillFolder): ComposerCommandItem {
  const count = folder.skills.length;
  return {
    id: skillFolderItemId(folder.id),
    type: "skill-folder",
    folder: { id: folder.id, name: folder.name, kind: folder.kind, skillCount: count },
    label: folder.name,
    description: `${count} ${count === 1 ? "skill" : "skills"} · ${KIND_LABEL[folder.kind]}`,
  };
}

/**
 * Reshapes the slash menu into folders. With no folder open and no query, the skills that sit in a
 * folder collapse into folder rows placed after the commands, and the rest stay as plain skills.
 * Inside an open folder the menu lists a Back row and that folder's skills; typing narrows them.
 * With a query and no folder open, the list is untouched so search still reaches every skill.
 */
export function applySkillFolderView(input: {
  items: ReadonlyArray<ComposerCommandItem>;
  folders: ReadonlyArray<ResolvedSkillFolder>;
  openFolderId: string | null;
  query: string;
}): ComposerCommandItem[] {
  const { items, folders, openFolderId, query } = input;
  if (folders.length === 0) return [...items];

  const skillItems = items.filter((item): item is SkillItem => item.type === "skill");
  const open = openFolderId ? folders.find((folder) => folder.id === openFolderId) : undefined;
  if (open) {
    const inside = new Set(open.skills.map((skill) => skill.name.trim().toLowerCase()));
    const members = skillItems.filter((item) => inside.has(item.skill.name.trim().toLowerCase()));
    return [
      {
        id: SKILL_FOLDER_BACK_ITEM_ID,
        type: "skill-folder-back",
        label: "Back to all skills",
        description: open.name,
      },
      ...searchSlashCommandItems(members, query),
    ];
  }
  if (query.trim()) return [...items];

  const grouped: ServerProviderSkill[] = skillsOutsideFolders(
    skillItems.map((item) => item.skill),
    folders,
  );
  const loose = new Set(grouped.map((skill) => skill.name.trim().toLowerCase()));
  const nonSkills = items.filter((item) => item.type !== "skill");
  const looseSkills = skillItems.filter((item) => loose.has(item.skill.name.trim().toLowerCase()));
  return [...nonSkills, ...folders.map(folderItem), ...looseSkills];
}
