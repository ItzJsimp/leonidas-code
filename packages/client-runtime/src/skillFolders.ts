import type { ServerProviderSkill, SkillFolder, SkillFolderPrefs } from "@t3tools/contracts";

/** Where a folder comes from: the user made it, or it is derived from skill metadata. */
export type SkillFolderKind = "custom" | "pack" | "category";

export interface ResolvedSkillFolder {
  readonly id: string;
  readonly name: string;
  readonly kind: SkillFolderKind;
  readonly skills: ReadonlyArray<ServerProviderSkill>;
}

/** Owners whose skill packs people know by a display name. Anything else shows `owner/repo`. */
const PACK_LABELS: Readonly<Record<string, string>> = {
  mattpocock: "Matt Pocock",
  anthropics: "Anthropic",
  "vercel-labs": "Vercel",
  kepano: "Obsidian (kepano)",
  microsoft: "Microsoft",
  cloudflare: "Cloudflare",
};

/** Display names for the AIOS category ids; an unknown id is title-cased. */
const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  design: "Design & UI",
  efficiency: "Token & cost efficiency",
  pc: "PC & Windows",
  code: "Code & engineering",
  planning: "Planning & specs",
  flow: "Daily flow",
  agents: "Agents & prompts",
  research: "Research & learning",
  knowledge: "Knowledge & wiki",
  system: "AIOS system",
  money: "Money & clients",
};

const GITHUB_SOURCE = /github\.com[/:]([\w.-]+)\/([\w.-]+)/i;

function skillKey(name: string): string {
  return name.trim().toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The pack a skill belongs to, from its `source` frontmatter. Undefined when it names no GitHub repo. */
export function resolveSkillPack(
  skill: Pick<ServerProviderSkill, "source">,
): { id: string; name: string } | undefined {
  const match = skill.source ? GITHUB_SOURCE.exec(skill.source) : null;
  if (!match?.[1] || !match[2]) return undefined;
  const owner = match[1].toLowerCase();
  return { id: owner, name: PACK_LABELS[owner] ?? `${match[1]}/${match[2].replace(/\.git$/, "")}` };
}

export function skillCategoryLabel(category: string): string {
  const key = category.trim().toLowerCase();
  return CATEGORY_LABELS[key] ?? titleCase(key);
}

/**
 * Every folder the picker can show: the user's own first (in their order), then packs, then
 * categories, each sorted by name. A skill can sit in many folders. Folders with no skill the
 * provider currently offers are left out, so a skill from another project never shows an empty row.
 * An automatic folder needs two skills, because a folder of one is only a longer way to find it.
 */
export function resolveSkillFolders(
  skills: ReadonlyArray<ServerProviderSkill>,
  prefs: SkillFolderPrefs,
): ResolvedSkillFolder[] {
  const byKey = new Map(skills.map((skill) => [skillKey(skill.name), skill]));
  const resolved: ResolvedSkillFolder[] = [];

  for (const folder of prefs.folders) {
    const members = folder.skills.flatMap((name) => byKey.get(skillKey(name)) ?? []);
    if (members.length > 0) {
      resolved.push({ id: folder.id, name: folder.name, kind: "custom", skills: members });
    }
  }

  const packs = new Map<string, { name: string; skills: ServerProviderSkill[] }>();
  const categories = new Map<string, { name: string; skills: ServerProviderSkill[] }>();
  for (const skill of skills) {
    const pack = resolveSkillPack(skill);
    if (pack) {
      const entry = packs.get(pack.id) ?? { name: pack.name, skills: [] };
      entry.skills.push(skill);
      packs.set(pack.id, entry);
    }
    if (skill.category) {
      const id = skillKey(skill.category);
      const entry = categories.get(id) ?? { name: skillCategoryLabel(id), skills: [] };
      entry.skills.push(skill);
      categories.set(id, entry);
    }
  }
  const automatic = (
    source: Map<string, { name: string; skills: ServerProviderSkill[] }>,
    kind: "pack" | "category",
  ) =>
    [...source.entries()]
      .filter(([, entry]) => entry.skills.length >= 2)
      .map(([id, entry]) => ({ id: `${kind}:${id}`, name: entry.name, kind, skills: entry.skills }))
      .toSorted((left, right) => left.name.localeCompare(right.name));
  return [...resolved, ...automatic(packs, "pack"), ...automatic(categories, "category")];
}

/** Skills that sit in no folder, so the picker can still show them after the folder rows. */
export function skillsOutsideFolders(
  skills: ReadonlyArray<ServerProviderSkill>,
  folders: ReadonlyArray<ResolvedSkillFolder>,
): ServerProviderSkill[] {
  const inFolder = new Set(folders.flatMap((folder) => folder.skills.map((s) => skillKey(s.name))));
  return skills.filter((skill) => !inFolder.has(skillKey(skill.name)));
}

function newFolderId(existing: ReadonlyArray<SkillFolder>): string {
  let index = existing.length + 1;
  const ids = new Set(existing.map((folder) => folder.id));
  while (ids.has(`folder-${index}`)) index += 1;
  return `folder-${index}`;
}

export function createSkillFolder(
  prefs: SkillFolderPrefs,
  name: string,
  skills: ReadonlyArray<string> = [],
): SkillFolderPrefs {
  const trimmed = name.trim();
  if (!trimmed) return prefs;
  const seen = new Set<string>();
  const unique = skills.filter((skill) => {
    const key = skillKey(skill);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    folders: [...prefs.folders, { id: newFolderId(prefs.folders), name: trimmed, skills: unique }],
  };
}

export function renameSkillFolder(
  prefs: SkillFolderPrefs,
  folderId: string,
  name: string,
): SkillFolderPrefs {
  const trimmed = name.trim();
  if (!trimmed) return prefs;
  return {
    folders: prefs.folders.map((folder) =>
      folder.id === folderId ? { ...folder, name: trimmed } : folder,
    ),
  };
}

export function deleteSkillFolder(prefs: SkillFolderPrefs, folderId: string): SkillFolderPrefs {
  return { folders: prefs.folders.filter((folder) => folder.id !== folderId) };
}

export function setSkillInFolder(
  prefs: SkillFolderPrefs,
  folderId: string,
  skillName: string,
  present: boolean,
): SkillFolderPrefs {
  const key = skillKey(skillName);
  return {
    folders: prefs.folders.map((folder) => {
      if (folder.id !== folderId) return folder;
      const without = folder.skills.filter((name) => skillKey(name) !== key);
      return { ...folder, skills: present ? [...without, skillName] : without };
    }),
  };
}
