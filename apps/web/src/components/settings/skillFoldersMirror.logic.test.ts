import { describe, expect, it } from "vite-plus/test";

import { SKILL_FOLDERS_MIRROR_PATH, serializeSkillFoldersMirror } from "./skillFoldersMirror.logic";

describe("serializeSkillFoldersMirror", () => {
  it("writes folders with stable keys and a trailing newline", () => {
    const text = serializeSkillFoldersMirror({
      folders: [{ id: "f1", name: "Code", skills: ["tdd", "pr"] }],
    });
    expect(text.endsWith("}\n")).toBe(true);
    expect(JSON.parse(text)).toEqual({
      folders: [{ id: "f1", name: "Code", skills: ["tdd", "pr"] }],
    });
    expect(Object.keys(JSON.parse(text).folders[0])).toEqual(["id", "name", "skills"]);
  });

  it("writes an empty list when the user has no folders", () => {
    expect(JSON.parse(serializeSkillFoldersMirror({ folders: [] }))).toEqual({ folders: [] });
  });

  it("targets the shared skills folder", () => {
    expect(SKILL_FOLDERS_MIRROR_PATH).toBe(".agents/skills/folders.json");
  });
});
