import { describe, expect, it } from "vite-plus/test";

import { LEONIDAS_GOALS } from "./leonidasSetup.logic";
import {
  CORE_SKILLS,
  SKILL_PACKS,
  skillFiles,
  skillMarkdown,
  suggestSkills,
  type BundledSkill,
} from "./skillPacks";

const allSkills = Object.values(SKILL_PACKS).flat();
const everySkill = [...CORE_SKILLS, ...allSkills];

describe("skillPacks", () => {
  it("gives every goal exactly two skills", () => {
    for (const goal of LEONIDAS_GOALS) {
      expect(SKILL_PACKS[goal.id]).toHaveLength(2);
    }
    expect(allSkills).toHaveLength(LEONIDAS_GOALS.length * 2);
  });

  it("uses unique kebab-case names and short descriptions", () => {
    const names = everySkill.map((skill) => skill.name);
    expect(new Set(names).size).toBe(names.length);
    for (const skill of everySkill) {
      expect(skill.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeLessThan(200);
      expect(skill.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("writes frontmatter with name and escaped description", () => {
    const skill: BundledSkill = {
      name: "demo-skill",
      description: 'Say "hi" and use a \\ slash',
      body: "# Demo",
    };
    const markdown = skillMarkdown(skill);
    expect(markdown.startsWith("---\nname: demo-skill\ndescription: ")).toBe(true);
    expect(markdown).toContain('description: "Say \\"hi\\" and use a \\\\ slash"');
    expect(markdown.endsWith("---\n\n# Demo\n")).toBe(true);
  });

  it("builds the SKILL.md path and trims a trailing slash", () => {
    const skill = allSkills[0]!;
    const [file] = skillFiles(skill, ".claude/skills/");
    expect(file?.relativePath).toBe(`.claude/skills/${skill.name}/SKILL.md`);
    expect(file?.contents).toBe(skillMarkdown(skill));
    expect(skillFiles(skill, "skills")[0]?.relativePath).toBe(`skills/${skill.name}/SKILL.md`);
  });

  it("always includes the core skills, then goal skills in order, deduped, ignoring unknown ids", () => {
    const core = CORE_SKILLS.map((s) => s.name);
    expect(core).toEqual(["asd-ste100", "grilling", "grill-me", "session-handoff"]);
    const names = suggestSkills(["learning", "nope", "web-apps", "learning"]).map((s) => s.name);
    expect(names).toEqual([
      ...core,
      ...SKILL_PACKS["learning"]!.map((s) => s.name),
      ...SKILL_PACKS["web-apps"]!.map((s) => s.name),
    ]);
    expect(suggestSkills(["unknown", "toString"]).map((s) => s.name)).toEqual(core);
  });
});
