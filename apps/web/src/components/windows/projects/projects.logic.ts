import { changedLabel } from "../../twoState/areaRows";

export interface ProjectGroup {
  readonly key: string;
  readonly name: string;
  /** `environmentId:projectId` of each folder the project covers. */
  readonly memberKeys: ReadonlyArray<string>;
}

export interface ProjectChat {
  readonly id: string;
  readonly environmentId: string;
  readonly projectKey: string;
  /** Last activity, an ISO time. */
  readonly at: string | null;
  readonly archived: boolean;
}

export interface ProjectRow {
  readonly key: string;
  readonly name: string;
  readonly chats: number;
  readonly lastActivity: number | null;
  readonly newest: { readonly environmentId: string; readonly id: string } | null;
}

/** One row per project: its open chats and last activity. Newest activity first, then by name. */
export function projectRows(
  groups: ReadonlyArray<ProjectGroup>,
  chats: ReadonlyArray<ProjectChat>,
): ProjectRow[] {
  const groupOf = new Map<string, string>();
  for (const group of groups) for (const member of group.memberKeys) groupOf.set(member, group.key);
  const byGroup = new Map<string, Array<{ chat: ProjectChat; at: number }>>();
  for (const chat of chats) {
    const key = groupOf.get(chat.projectKey);
    if (key === undefined || chat.archived) continue;
    const list = byGroup.get(key) ?? [];
    list.push({ chat, at: chat.at === null ? 0 : Date.parse(chat.at) });
    byGroup.set(key, list);
  }
  return groups
    .map((group): ProjectRow => {
      const list = byGroup.get(group.key) ?? [];
      const top = list.reduce<(typeof list)[number] | null>(
        (best, item) => (best === null || item.at > best.at ? item : best),
        null,
      );
      return {
        key: group.key,
        name: group.name,
        chats: list.length,
        lastActivity: top && top.at > 0 ? top.at : null,
        newest: top ? { environmentId: top.chat.environmentId, id: top.chat.id } : null,
      };
    })
    .toSorted(
      (a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0) || a.name.localeCompare(b.name),
    );
}

/** "4 chats · Yesterday", or "No chats yet". */
export function activityLabel(chats: number, lastActivity: number | null, now: number): string {
  if (chats === 0) return "No chats yet";
  const count = `${chats} ${chats === 1 ? "chat" : "chats"}`;
  return lastActivity === null ? count : `${count} · ${changedLabel(lastActivity, now)}`;
}
