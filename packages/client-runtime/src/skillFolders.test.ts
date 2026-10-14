import type { ServerProviderSkill } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  createSkillFolder,
  deleteSkillFolder,
  renameSkillFolder,
  resolveCommandPlugin,
  resolveSkillFolders,
  resolveSkillPack,
  setSkillInFolder,
  skillsOutsideFolders,
} from "./skillFolders.ts";

const skill = (name: string, extra: Partial<ServerProviderSkill> = {}): ServerProviderSkill => ({
  name,
  path: `/skills/${name}/SKILL.md`,
  enabled: true,
  ...extra,
});

const MATT = "https://github.com/mattpocock/skills (skills/engineering/tdd, MIT)";

describe("resolveSkillPack", () => {
  it("names a known owner and falls back to owner/repo", () => {
    expect(resolveSkillPack({ source: MATT })).toEqual({ id: "mattpocock", name: "Matt Pocock" });
    expect(resolveSkillPack({ source: "https://github.com/acme/tools.git" })).toEqual({
      id: "acme",
      name: "acme/tools",
    });
  });

  it("returns nothing when the source is not a GitHub repo", () => {
    expect(resolveSkillPack({})).toBeUndefined();
    expect(resolveSkillPack({ source: "internal wiki" })).toBeUndefined();
  });
});

describe("resolveSkillFolders", () => {
  const skills = [
    skill("tdd", { source: MATT, category: "code" }),
    skill("pr", { source: MATT, category: "code" }),
    skill("grill-me", { source: MATT, category: "planning" }),
    skill("token-optimizer", { category: "efficiency" }),
    skill("lonely", { category: "pc" }),
  ];

  it("builds pack and category folders and skips folders of one skill", () => {
    const folders = resolveSkillFolders(skills, { folders: [] });
    expect(folders.map((folder) => `${folder.kind}:${folder.name}`)).toEqual([
      "pack:Matt Pocock",
      "category:Code & engineering",
    ]);
    expect(folders[0]?.skills.map((s) => s.name)).toEqual(["tdd", "pr", "grill-me"]);
  });

  it("puts custom folders first, matches names loosely and drops unknown skills", () => {
    const folders = resolveSkillFolders(skills, {
      folders: [
        { id: "a", name: "Audits", skills: ["TDD", "gone", "token-optimizer"] },
        { id: "b", name: "Empty", skills: ["gone"] },
      ],
    });
    expect(folders[0]).toMatchObject({ id: "a", name: "Audits", kind: "custom" });
    expect(folders[0]?.skills.map((s) => s.name)).toEqual(["tdd", "token-optimizer"]);
    expect(folders.some((folder) => folder.id === "b")).toBe(false);
  });

  it("lets one skill sit in several folders and lists the skills no folder holds", () => {
    const folders = resolveSkillFolders(skills, { folders: [] });
    const withTdd = folders.filter((folder) => folder.skills.some((s) => s.name === "tdd"));
    expect(withTdd).toHaveLength(2);
    expect(skillsOutsideFolders(skills, folders).map((s) => s.name)).toEqual([
      "token-optimizer",
      "lonely",
    ]);
  });
});

describe("provider command folders", () => {
  const commands = [
    { name: "cloudflare:wrangler" },
    { name: "cloudflare:basin" },
    { name: "solo:one" },
    { name: "clear" },
  ];

  it("gathers six or more unclaimed commands into one built-in folder", () => {
    const many = [
      ...commands,
      { name: "model" },
      { name: "init" },
      { name: "fast" },
      { name: "config" },
      { name: "doctor" },
    ];
    const folders = resolveSkillFolders([], { folders: [] }, many);
    const builtin = folders.find((folder) => folder.kind === "builtin");
    expect(builtin?.commands.map((c) => c.name)).toEqual([
      "solo:one",
      "clear",
      "model",
      "init",
      "fast",
      "config",
      "doctor",
    ]);
    expect(folders.find((folder) => folder.kind === "plugin")?.commands).toHaveLength(2);
  });

  it("groups namespaced commands into a plugin folder and skips single or plain ones", () => {
    const folders = resolveSkillFolders([], { folders: [] }, commands);
    expect(folders.map((folder) => `${folder.kind}:${folder.name}`)).toEqual([
      "plugin:Cloudflare plugin",
    ]);
    expect(folders[0]?.commands.map((c) => c.name)).toEqual([
      "cloudflare:wrangler",
      "cloudflare:basin",
    ]);
  });

  it("lets a custom folder hold a command by name, but a skill of that name wins", () => {
    const skills = [skill("loop")];
    const folders = resolveSkillFolders(
      skills,
      { folders: [{ id: "a", name: "Mine", skills: ["clear", "loop", "missing"] }] },
      [{ name: "clear" }, { name: "loop" }],
    );
    expect(folders[0]?.skills.map((s) => s.name)).toEqual(["loop"]);
    expect(folders[0]?.commands.map((c) => c.name)).toEqual(["clear"]);
  });

  it("reads the plugin prefix of a command name", () => {
    expect(resolveCommandPlugin({ name: "Cloudflare:wrangler" })).toBe("cloudflare");
    expect(resolveCommandPlugin({ name: "clear" })).toBeUndefined();
    expect(resolveCommandPlugin({ name: ":odd" })).toBeUndefined();
  });
});

describe("folder edits", () => {
  it("creates, renames, fills, empties and deletes a folder", () => {
    let prefs = createSkillFolder({ folders: [] }, "  Tokens  ", ["a", "A", "b"]);
    expect(prefs.folders).toEqual([{ id: "folder-1", name: "Tokens", skills: ["a", "b"] }]);
    prefs = renameSkillFolder(prefs, "folder-1", "Token saving");
    prefs = setSkillInFolder(prefs, "folder-1", "c", true);
    prefs = setSkillInFolder(prefs, "folder-1", "A", false);
    expect(prefs.folders[0]).toEqual({ id: "folder-1", name: "Token saving", skills: ["b", "c"] });
    expect(deleteSkillFolder(prefs, "folder-1").folders).toEqual([]);
  });

  it("ignores a blank name and never reuses an id", () => {
    const empty = { folders: [] };
    expect(createSkillFolder(empty, "   ")).toBe(empty);
    const one = createSkillFolder(empty, "One");
    const two = createSkillFolder(
      deleteSkillFolder(createSkillFolder(one, "Two"), "folder-1"),
      "Three",
    );
    expect(new Set(two.folders.map((folder) => folder.id)).size).toBe(two.folders.length);
  });
});
