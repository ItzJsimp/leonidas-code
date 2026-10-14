import type { ResolvedSkillFolder } from "@t3tools/client-runtime/skillFolders";
import { skillFolderSize } from "@t3tools/client-runtime/skillFolders";

import type { ComposerCommandItem } from "./ComposerCommandMenu";
import { searchSlashCommandItems } from "./composerSlashCommandSearch";

type SkillItem = Extract<ComposerCommandItem, { type: "skill" }>;
type CommandItem = Extract<ComposerCommandItem, { type: "provider-slash-command" }>;
type FolderMember = SkillItem | CommandItem;

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

const KIND_LABEL = {
  custom: "Mine",
  pack: "Pack",
  category: "Category",
  plugin: "Plugin",
  builtin: "Built-in",
} as const;

function folderItem(folder: ResolvedSkillFolder): ComposerCommandItem {
  const count = skillFolderSize(folder);
  const noun =
    folder.commands.length === 0
      ? count === 1
        ? "skill"
        : "skills"
      : folder.skills.length === 0
        ? count === 1
          ? "command"
          : "commands"
        : count === 1
          ? "item"
          : "items";
  return {
    id: skillFolderItemId(folder.id),
    type: "skill-folder",
    folder: { id: folder.id, name: folder.name, kind: folder.kind, skillCount: count },
    label: folder.name,
    description: `${count} ${noun} · ${KIND_LABEL[folder.kind]}`,
  };
}

function isFolderMember(item: ComposerCommandItem): item is FolderMember {
  return item.type === "skill" || item.type === "provider-slash-command";
}

function memberKey(item: FolderMember): string {
  return `${item.type}:${(item.type === "skill" ? item.skill.name : item.command.name).trim().toLowerCase()}`;
}

function folderMemberKeys(folder: ResolvedSkillFolder): Set<string> {
  return new Set([
    ...folder.skills.map((skill) => `skill:${skill.name.trim().toLowerCase()}`),
    ...folder.commands.map(
      (command) => `provider-slash-command:${command.name.trim().toLowerCase()}`,
    ),
  ]);
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
  const { items, openFolderId, query } = input;
  const members = items.filter(isFolderMember);
  // Provider commands are absent mid-prompt, so a folder whose members are all gone is not shown.
  const present = new Set(members.map(memberKey));
  const folders = input.folders.filter((folder) =>
    [...folderMemberKeys(folder)].some((key) => present.has(key)),
  );
  if (folders.length === 0) return [...items];

  const open = openFolderId ? folders.find((folder) => folder.id === openFolderId) : undefined;
  if (open) {
    const inside = folderMemberKeys(open);
    return [
      {
        id: SKILL_FOLDER_BACK_ITEM_ID,
        type: "skill-folder-back",
        label: "Back to all skills",
        description: open.name,
      },
      ...searchSlashCommandItems(
        members.filter((item) => inside.has(memberKey(item))),
        query,
      ),
    ];
  }
  if (query.trim()) return [...items];

  const grouped = new Set(folders.flatMap((folder) => [...folderMemberKeys(folder)]));
  const builtIns = items.filter((item) => !isFolderMember(item));
  const loose = members.filter((item) => !grouped.has(memberKey(item)));
  return [...builtIns, ...folders.map(folderItem), ...loose];
}
