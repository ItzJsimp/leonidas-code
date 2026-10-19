import type {
  ServerProviderSkill,
  ServerProviderSlashCommand,
  SkillFolder,
  SkillFolderPrefs,
} from "@t3tools/contracts";

/** Where a folder comes from: the user made it, or it is derived from skill metadata. */
export type SkillFolderKind = "custom" | "pack" | "category" | "plugin" | "builtin";

export interface ResolvedSkillFolder {
  readonly id: string;
  readonly name: string;
  readonly kind: SkillFolderKind;
  readonly skills: ReadonlyArray<ServerProviderSkill>;
  /** Provider slash commands in the folder: plugin commands, built-ins and bundled skills. */
  readonly commands: ReadonlyArray<ServerProviderSlashCommand>;
}

/** How many entries the folder holds, skills and commands together. */
export function skillFolderSize(folder: Pick<ResolvedSkillFolder, "skills" | "commands">): number {
  return folder.skills.length + folder.commands.length;
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
  agents: "AI helpers & messages",
  research: "Research & learning",
  knowledge: "Knowledge & wiki",
  system: "AIOS system",
  money: "Money & clients",
};

/** Fewer leftover provider commands than this stay in the main list. */
const MIN_BUILTIN_FOLDER_SIZE = 6;

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

function skillCategoryLabel(category: string): string {
  const key = category.trim().toLowerCase();
  return CATEGORY_LABELS[key] ?? titleCase(key);
}

/**
 * Every folder the picker can show: the user's own first (in their order), then plugins, packs and
 * categories, each sorted by name. An entry can sit in many folders. A custom folder matches skills
 * and provider commands by name. A folder with nothing the provider currently offers is left out,
 * so a skill from another project never shows an empty row. An automatic folder needs two entries,
 * because a folder of one is only a longer way to find it. A plugin folder holds the commands that
 * share a `plugin:` prefix, such as `cloudflare:wrangler`.
 */
export function resolveSkillFolders(
  skills: ReadonlyArray<ServerProviderSkill>,
  prefs: SkillFolderPrefs,
  commands: ReadonlyArray<ServerProviderSlashCommand> = [],
): ResolvedSkillFolder[] {
  const skillsByKey = new Map(skills.map((skill) => [skillKey(skill.name), skill]));
  const commandsByKey = new Map(commands.map((command) => [skillKey(command.name), command]));
  const custom: ResolvedSkillFolder[] = [];

  for (const folder of prefs.folders) {
    const memberSkills = folder.skills.flatMap((name) => skillsByKey.get(skillKey(name)) ?? []);
    const memberCommands = folder.skills.flatMap(
      (name) => (skillsByKey.has(skillKey(name)) ? [] : commandsByKey.get(skillKey(name))) ?? [],
    );
    if (memberSkills.length + memberCommands.length > 0) {
      custom.push({
        id: folder.id,
        name: folder.name,
        kind: "custom",
        skills: memberSkills,
        commands: memberCommands,
      });
    }
  }

  type Bucket = {
    name: string;
    skills: ServerProviderSkill[];
    commands: ServerProviderSlashCommand[];
  };
  const packs = new Map<string, Bucket>();
  const categories = new Map<string, Bucket>();
  const plugins = new Map<string, Bucket>();
  const bucketFor = (map: Map<string, Bucket>, id: string, name: string): Bucket => {
    const existing = map.get(id);
    if (existing) return existing;
    const created: Bucket = { name, skills: [], commands: [] };
    map.set(id, created);
    return created;
  };
  for (const skill of skills) {
    const pack = resolveSkillPack(skill);
    if (pack) bucketFor(packs, pack.id, pack.name).skills.push(skill);
    if (skill.category) {
      const id = skillKey(skill.category);
      bucketFor(categories, id, skillCategoryLabel(id)).skills.push(skill);
    }
  }
  for (const command of commands) {
    const prefix = resolveCommandPlugin(command);
    if (prefix) bucketFor(plugins, prefix, titleCase(prefix)).commands.push(command);
  }

  const automatic = (source: Map<string, Bucket>, kind: "pack" | "category" | "plugin") =>
    [...source.entries()]
      .filter(([, entry]) => entry.skills.length + entry.commands.length >= 2)
      .map(([id, entry]) => ({
        id: `${kind}:${id}`,
        name: kind === "plugin" ? `${entry.name} plugin` : entry.name,
        kind,
        skills: entry.skills,
        commands: entry.commands,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  // Every provider command that no folder claimed (the harness's built-ins and bundled skills)
  // goes into one folder, but only when there are enough of them to be worth hiding.
  const claimed = new Set([
    ...custom.flatMap((folder) => folder.commands.map((c) => skillKey(c.name))),
    ...[...plugins.values()]
      .filter((entry) => entry.commands.length >= 2)
      .flatMap((entry) => entry.commands.map((c) => skillKey(c.name))),
  ]);
  const leftover = commands.filter((command) => !claimed.has(skillKey(command.name)));
  const builtin: ResolvedSkillFolder[] =
    leftover.length >= MIN_BUILTIN_FOLDER_SIZE
      ? [
          {
            id: "builtin:commands",
            name: "Built-in commands",
            kind: "builtin",
            skills: [],
            commands: leftover,
          },
        ]
      : [];
  return [
    ...custom,
    ...builtin,
    ...automatic(plugins, "plugin"),
    ...automatic(packs, "pack"),
    ...automatic(categories, "category"),
  ];
}

/** The plugin prefix of a namespaced command such as `cloudflare:wrangler`, else undefined. */
export function resolveCommandPlugin(
  command: Pick<ServerProviderSlashCommand, "name">,
): string | undefined {
  const index = command.name.indexOf(":");
  return index > 0 ? command.name.slice(0, index).toLowerCase() : undefined;
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
