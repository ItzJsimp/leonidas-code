import { resolveSkillFolders } from "@t3tools/client-runtime/skillFolders";
import { ProviderDriverKind, type ServerProviderSkill } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { ComposerCommandItem } from "./ComposerCommandMenu";
import {
  SKILL_FOLDER_BACK_ITEM_ID,
  applySkillFolderView,
  skillFolderIdFromItemId,
  skillFolderItemId,
} from "./composerSkillFolders.logic";

const MATT = "https://github.com/mattpocock/skills (skills/engineering/tdd)";
const skill = (name: string, extra: Partial<ServerProviderSkill> = {}): ServerProviderSkill => ({
  name,
  path: `/s/${name}/SKILL.md`,
  enabled: true,
  ...extra,
});
const skillItem = (s: ServerProviderSkill): ComposerCommandItem => ({
  id: `skill:claudeAgent:${s.name}`,
  type: "skill",
  provider: ProviderDriverKind.make("claudeAgent"),
  skill: s,
  label: `/skill:${s.name}`,
  description: s.description ?? "",
});
const command: ComposerCommandItem = {
  id: "slash:model",
  type: "slash-command",
  command: "model",
  label: "/model",
  description: "Switch model",
};

const skills = [skill("tdd", { source: MATT }), skill("pr", { source: MATT }), skill("loose")];
const items = [command, ...skills.map(skillItem)];
const folders = resolveSkillFolders(skills, { folders: [] });

describe("applySkillFolderView", () => {
  it("leaves the list alone when there are no folders", () => {
    expect(applySkillFolderView({ items, folders: [], openFolderId: null, query: "" })).toEqual(
      items,
    );
  });

  it("collapses grouped skills into folder rows after the commands", () => {
    const view = applySkillFolderView({ items, folders, openFolderId: null, query: "" });
    expect(view.map((item) => item.id)).toEqual([
      "slash:model",
      skillFolderItemId("pack:mattpocock"),
      "skill:claudeAgent:loose",
    ]);
    expect(view[1]).toMatchObject({
      type: "skill-folder",
      label: "Matt Pocock",
      description: "2 skills · Pack",
    });
  });

  it("keeps every skill reachable while a query is typed", () => {
    expect(applySkillFolderView({ items, folders, openFolderId: null, query: "tdd" })).toEqual(
      items,
    );
  });

  it("lists a Back row and only that folder's skills when a folder is open", () => {
    const view = applySkillFolderView({
      items,
      folders,
      openFolderId: "pack:mattpocock",
      query: "",
    });
    expect(view.map((item) => item.id)).toEqual([
      SKILL_FOLDER_BACK_ITEM_ID,
      "skill:claudeAgent:tdd",
      "skill:claudeAgent:pr",
    ]);
  });

  it("narrows an open folder by the typed query", () => {
    const view = applySkillFolderView({
      items,
      folders,
      openFolderId: "pack:mattpocock",
      query: "tdd",
    });
    expect(view.map((item) => item.id)).toEqual([
      SKILL_FOLDER_BACK_ITEM_ID,
      "skill:claudeAgent:tdd",
    ]);
  });

  it("falls back to the plain view when the open folder no longer exists", () => {
    const view = applySkillFolderView({ items, folders, openFolderId: "gone", query: "" });
    expect(view.some((item) => item.type === "skill-folder")).toBe(true);
  });
});

describe("applySkillFolderView with provider commands", () => {
  const providerItem = (name: string): ComposerCommandItem => ({
    id: `provider-slash-command:claudeAgent:${name}`,
    type: "provider-slash-command",
    provider: ProviderDriverKind.make("claudeAgent"),
    command: { name },
    label: `/${name}`,
    description: "",
  });
  const cmdItems = [
    command,
    providerItem("cloudflare:wrangler"),
    providerItem("cloudflare:basin"),
    providerItem("clear"),
  ];
  const cmdFolders = resolveSkillFolders(
    [],
    { folders: [] },
    cmdItems.flatMap((i) => (i.type === "provider-slash-command" ? [i.command] : [])),
  );

  it("collapses a plugin's commands into one folder row and keeps plain commands", () => {
    const view = applySkillFolderView({
      items: cmdItems,
      folders: cmdFolders,
      openFolderId: null,
      query: "",
    });
    expect(view.map((item) => item.id)).toEqual([
      "slash:model",
      skillFolderItemId("plugin:cloudflare"),
      "provider-slash-command:claudeAgent:clear",
    ]);
    expect(view[1]).toMatchObject({ description: "2 commands · Plugin" });
  });

  it("lists the plugin's commands when its folder is open", () => {
    const view = applySkillFolderView({
      items: cmdItems,
      folders: cmdFolders,
      openFolderId: "plugin:cloudflare",
      query: "",
    });
    expect(view.map((item) => item.id)).toEqual([
      SKILL_FOLDER_BACK_ITEM_ID,
      "provider-slash-command:claudeAgent:cloudflare:wrangler",
      "provider-slash-command:claudeAgent:cloudflare:basin",
    ]);
  });

  it("hides a folder whose commands are not in the menu", () => {
    const view = applySkillFolderView({
      items: [command],
      folders: cmdFolders,
      openFolderId: null,
      query: "",
    });
    expect(view).toEqual([command]);
  });
});

describe("skill folder item ids", () => {
  it("round-trips a folder id and rejects the back row", () => {
    expect(skillFolderIdFromItemId(skillFolderItemId("pack:mattpocock"))).toBe("pack:mattpocock");
    expect(skillFolderIdFromItemId(SKILL_FOLDER_BACK_ITEM_ID)).toBeNull();
    expect(skillFolderIdFromItemId("skill:claudeAgent:tdd")).toBeNull();
  });
});
