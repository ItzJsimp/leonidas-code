import { describe, expect, it } from "vite-plus/test";

import {
  addFocusItem,
  changeFocusItem,
  parseFocus,
  sectionItems,
  serializeFocus,
} from "./focusFile.ts";

const SAMPLE = [
  "# Focus",
  "",
  "Notes kept by hand.",
  "",
  "## Global",
  "- [ ] Call the bank",
  "- [x] Pay rent",
  "",
  "## leonidas-code",
  "- [ ] Ship the focus widget",
  "some hand note",
  "* [X] Review PR",
  "",
].join("\r\n");

describe("focus file", () => {
  it("parses sections, items and keeps unknown lines", () => {
    const doc = parseFocus(SAMPLE);
    expect(doc.preamble).toEqual(["# Focus", "", "Notes kept by hand."]);
    expect(doc.sections.map((section) => section.slug)).toEqual([null, "leonidas-code"]);
    expect(sectionItems(doc.sections[1]!).map(({ text, done }) => ({ text, done }))).toEqual([
      { text: "Ship the focus widget", done: false },
      { text: "Review PR", done: true },
    ]);
    const out = serializeFocus(doc);
    expect(out).toContain("some hand note");
    expect(serializeFocus(parseFocus(out))).toBe(out);
  });

  it("starts an empty file with a title and the Global section first", () => {
    let doc = parseFocus("");
    doc = addFocusItem(doc, "app", "Project line");
    doc = addFocusItem(doc, null, "  General   line ");
    expect(serializeFocus(doc)).toBe(
      "# Focus\n\n## Global\n- [ ] General line\n\n## app\n- [ ] Project line\n",
    );
  });

  it("ticks and removes by id, and gives repeated text separate ids", () => {
    let doc = parseFocus("## Global\n- [ ] Same\n- [ ] Same\n");
    const [first, second] = sectionItems(doc.sections[0]!);
    expect(first!.id).not.toBe(second!.id);
    doc = changeFocusItem(doc, second!.id, { done: true })!;
    expect(sectionItems(doc.sections[0]!).map((item) => item.done)).toEqual([false, true]);
    doc = changeFocusItem(doc, first!.id, null)!;
    expect(serializeFocus(doc)).toContain("## Global\n- [x] Same\n");
    expect(changeFocusItem(doc, "global:missing", null)).toBeNull();
  });

  it("keeps an id when other lines are added before it", () => {
    const doc = parseFocus("## app\n- [ ] Keep me\n");
    const id = sectionItems(doc.sections[0]!)[0]!.id;
    const grown = parseFocus("## app\n- [ ] New\n- [ ] Keep me\n");
    expect(sectionItems(grown.sections[0]!).find((item) => item.text === "Keep me")?.id).toBe(id);
  });
});
