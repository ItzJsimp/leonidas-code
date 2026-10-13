import { describe, expect, it } from "vite-plus/test";
import { parseOutputDock, workedForMs } from "./outputDock.ts";

const reply = `🎯 **Focus:** \`Code\` · **Step:** \`Build\`

Built it.
---
### 🎯 TL;DR
- Ready.
### ⚡ Immediate Next Actions
- [ ] 🤖 **Leonidas:** Run tests.
- [x] 👤 **You:** Review changes.
### ❓ Input & Decisions Needed
- **A)** Keep it. *(Wins when: simple)*
- **B)** Extend it. *(Wins when: needed)*
➡️ **Recommended: A** · Smallest change.
💬 Quick Replies: "Keep it" | "Extend it"`;

describe("output Dock", () => {
  it("separates body and ordered sections and preserves action ownership", () => {
    const dock = parseOutputDock(reply)!;
    expect(dock.body).toContain("Built it.");
    expect(dock.body).not.toContain("TL;DR");
    expect(dock.sections.map((s) => s.kind)).toEqual(["summary", "actions", "decisions"]);
    expect(dock.sections[1]!.items).toEqual([
      { kind: "action", text: "🤖 **Leonidas:** Run tests.", checked: false },
      { kind: "action", text: "👤 **You:** Review changes.", checked: true },
    ]);
    expect(dock.sections[2]!.items.map((i) => i.kind)).toEqual([
      "option",
      "option",
      "markdown",
      "replies",
    ]);
    expect(dock.sections[2]!.items.at(-1)).toEqual({
      kind: "replies",
      replies: ["Keep it", "Extend it"],
    });
  });
  it("handles CRLF, omitted sections and completion", () => {
    expect(parseOutputDock(reply.replaceAll("\n", "\r\n"))?.sections).toEqual(
      parseOutputDock(reply)?.sections,
    );
    expect(
      parseOutputDock(
        "Done\n---\n### 🎯 TL;DR\n- Done\n### 🏁 Session Complete\n✅ Objective achieved",
      )?.sections[1]?.kind,
    ).toBe("complete");
  });
  it("keeps quoted headings inside fences as ordinary Markdown", () => {
    expect(parseOutputDock("```md\n" + reply + "\n```")).toBeNull();
    expect(parseOutputDock("~~~md\n" + reply + "\n~~~")).toBeNull();
  });
  it.each([
    "",
    "hello",
    reply.replace("### 🎯 TL;DR", "### Summary"),
    reply.replace("### ❓ Input & Decisions Needed", "### Other"),
    reply + "\n### New topic\nmore",
    reply.replace("### ⚡ Immediate Next Actions", "### 🎯 TL;DR"),
  ])("falls back for incomplete or malformed Docks", (text) => {
    expect(parseOutputDock(text)).toBeNull();
  });
  it("keeps action examples inside code fences inert", () => {
    const dock = parseOutputDock(
      "Body\n### 🎯 TL;DR\n- Ready\n### ⚡ Immediate Next Actions\n```md\n- [ ] 🤖 **Leonidas:** Do not run\n``` ",
    )!;
    expect(dock.sections[1]!.items.map((i) => i.kind)).toEqual(["markdown"]);
  });
  it("keeps shorter and different fence markers inside a longer example inert", () => {
    const dock = parseOutputDock(
      "Body\n### 🎯 TL;DR\n- Ready\n### ⚡ Immediate Next Actions\n\n````md\n```\n~~~\n- [ ] 🤖 **Leonidas:** Do not run\n`````\n- [ ] 👤 **You:** Review",
    )!;
    expect(dock.sections[1]!.items.map((item) => item.kind)).toEqual(["markdown", "action"]);
  });
  it("uses finished run timestamps only", () => {
    expect(workedForMs("2026-10-13T00:00:00Z", "2026-10-13T00:01:12Z")).toBe(72000);
    expect(workedForMs(null, "2026-10-13T00:01:12Z")).toBeNull();
    expect(workedForMs("bad", "bad")).toBeNull();
    expect(workedForMs("2026-10-13T00:01:12Z", "2026-10-13T00:00:00Z")).toBeNull();
  });
});
