import { describe, expect, it } from "vite-plus/test";

import { prefixPromptWithSkill } from "./composerSkillPrefix";

describe("prefixPromptWithSkill", () => {
  it("leads an empty prompt with the skill", () => {
    expect(prefixPromptWithSkill("", "grill-me")).toBe("$grill-me ");
  });

  it("puts the skill before existing text", () => {
    expect(prefixPromptWithSkill("fix the bug", "tdd")).toBe("$tdd fix the bug");
  });

  it("keeps the prompt when that skill already leads it", () => {
    expect(prefixPromptWithSkill("$tdd fix the bug", "tdd")).toBe("$tdd fix the bug");
    expect(prefixPromptWithSkill("$tdd", "tdd")).toBe("$tdd");
  });

  it("does not mistake a longer skill name for the same skill", () => {
    expect(prefixPromptWithSkill("$tdd-extra go", "tdd")).toBe("$tdd $tdd-extra go");
  });
});
