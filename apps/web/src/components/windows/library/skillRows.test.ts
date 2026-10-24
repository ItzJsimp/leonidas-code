import type { ServerProviderSkill } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { packRows, skillRows } from "./skillRows";

const skill = (input: Partial<ServerProviderSkill> & Pick<ServerProviderSkill, "name">) =>
  ({
    path: `/skills/${input.name}/SKILL.md`,
    enabled: true,
    ...input,
  }) satisfies ServerProviderSkill;

const SKILLS = [
  skill({ name: "tdd", shortDescription: "Red, green, refactor." }),
  skill({ name: "ux-copy", description: "Write labels and empty states.\nSecond line." }),
  skill({ name: "off", enabled: false, shortDescription: "Turned off." }),
  skill({ name: "TDD", shortDescription: "A copy with another case." }),
  skill({ name: "bare" }),
];

describe("skillRows", () => {
  it("lists each usable skill once with a name and one line", () => {
    expect(skillRows(SKILLS, "")).toEqual([
      { key: "tdd", name: "TDD", line: "Red, green, refactor." },
      { key: "ux-copy", name: "UX Copy", line: "Write labels and empty states." },
      { key: "bare", name: "Bare", line: "No description yet." },
    ]);
  });

  it("filters by name or description, ignoring case and spaces at the ends", () => {
    expect(skillRows(SKILLS, "  EMPTY ").map((row) => row.key)).toEqual(["ux-copy"]);
    expect(skillRows(SKILLS, "refactor").map((row) => row.key)).toEqual(["tdd"]);
  });

  it("returns nothing when no skill matches", () => {
    expect(skillRows(SKILLS, "zzzz")).toEqual([]);
  });

  it("returns nothing for no skills", () => {
    expect(skillRows([], "")).toEqual([]);
  });
});

describe("packRows", () => {
  it("names each starter pack with its skills", () => {
    const rows = packRows();
    const web = rows.find((row) => row.id === "web-apps");
    expect(web?.label).toBe("Apps and tools");
    expect(web?.skills.length).toBeGreaterThan(0);
    expect(web?.skills[0]).toEqual({ name: expect.any(String), line: expect.any(String) });
  });

  it("has no pack without skills and no unknown pack name", () => {
    for (const row of packRows()) {
      expect(row.skills.length).toBeGreaterThan(0);
      expect(row.label.length).toBeGreaterThan(0);
    }
  });
});
