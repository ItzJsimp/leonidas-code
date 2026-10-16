import { describe, expect, it } from "vite-plus/test";

import { findSubagentMentions, routeSubagentMentions } from "./subagentMentions.ts";

const known = (name: string) => name === "frontend-designer" || name === "executor";

describe("subagent mentions", () => {
  it("finds a known mention once, in order", () => {
    expect(findSubagentMentions("@executor then @frontend-designer, and @executor", known)).toEqual(
      ["executor", "frontend-designer"],
    );
  });

  it("ignores unknown names, file paths and email addresses", () => {
    expect(findSubagentMentions("@nobody look at @src/index.ts and a@executor.com", known)).toEqual(
      [],
    );
  });

  it("returns the text unchanged when nothing is mentioned", () => {
    expect(routeSubagentMentions("plain request", known)).toBe("plain request");
  });

  it("keeps the user words and adds one routing note", () => {
    const out = routeSubagentMentions("@frontend-designer polish the card", known);
    expect(out.startsWith("@frontend-designer polish the card\n")).toBe(true);
    expect(out).toContain('subagent: "frontend-designer"');
    expect(out.match(/<subagent-route>/g)).toHaveLength(1);
  });
});
