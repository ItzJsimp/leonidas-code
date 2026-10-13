import { describe, expect, it } from "vite-plus/test";

import { expandSkills } from "./skillExpansion.ts";

const SKILLS = new Map([
  ["review", "---\nname: review\n---\nReview the code. Focus: $ARGUMENTS"],
  ["tdd", "Write the test first."],
]);

describe("expandSkills", () => {
  it("leaves prose, paths and unknown skills untouched", () => {
    expect(expandSkills("echo $HOME and /src/index.ts and $unknown", SKILLS)).toBeUndefined();
  });

  it.each([
    ["start", "$review $tdd fix the build", ['<skill name="review"/> <skill name="tdd"/> fix']],
    ["middle", "please $review the diff then $tdd it", ['please <skill name="review"/> the diff']],
    [
      "end",
      "fix the build $review $tdd",
      ['fix the build <skill name="review"/> <skill name="tdd"/>'],
    ],
  ])("keeps both skills in place at the %s", (_label, prompt, fragments) => {
    const out = expandSkills(prompt, SKILLS) ?? "";
    for (const fragment of fragments) expect(out).toContain(fragment);
    expect(out).toContain('<skill_instructions name="review">');
    expect(out).toContain('<skill_instructions name="tdd">');
  });

  it("treats typed /name the same as $name", () => {
    const out = expandSkills("/review the diff, then /tdd it", SKILLS) ?? "";
    expect(out).toContain('<skill name="review"/> the diff, then <skill name="tdd"/> it');
  });

  it("fills $ARGUMENTS from the span after the marker and strips frontmatter", () => {
    const out = expandSkills("$review the auth module $tdd", SKILLS) ?? "";
    expect(out).toContain("Focus: the auth module");
    expect(out).not.toContain("name: review");
    expect(out).toContain("Write the test first.");
  });

  it("appends ARGUMENTS when the body has no placeholder", () => {
    expect(expandSkills("$tdd the parser", SKILLS)).toContain("ARGUMENTS: the parser");
  });

  it("inlines a repeated skill once", () => {
    const out = expandSkills("$tdd one, later $tdd two", SKILLS) ?? "";
    expect(out.match(/<skill_instructions name="tdd">/g)).toHaveLength(1);
    expect(out.match(/<skill name="tdd"\/>/g)).toHaveLength(2);
  });
});
