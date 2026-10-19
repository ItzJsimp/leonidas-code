import { describe, expect, it } from "vite-plus/test";

import {
  addFocusItem,
  changeFocusItem,
  moveFocusItem,
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

  it("edits the text of one item and leaves its tick and the other lines alone", () => {
    let doc = parseFocus("## Global\n- [x] Old text\n- [ ] Other\n");
    const id = sectionItems(doc.sections[0]!)[0]!.id;
    doc = changeFocusItem(doc, id, { text: "New  text\nwith a break" })!;
    expect(serializeFocus(doc)).toContain("- [x] New text\n  with a break\n- [ ] Other");
  });

  it("reads and writes multi-line notes as indented continuation lines", () => {
    const text = "## Global\n- [ ] First line\n  second line\n  third line\n- [ ] Next\n";
    const doc = parseFocus(text);
    expect(sectionItems(doc.sections[0]!).map((item) => item.text)).toEqual([
      "First line\nsecond line\nthird line",
      "Next",
    ]);
    expect(serializeFocus(doc)).toContain(text);
    const added = addFocusItem(doc, null, "A\n\n  B  c ");
    expect(serializeFocus(added)).toContain("- [ ] A\n  B c\n");
  });

  it("pins and unpins without changing the id, and keeps the mark in the file", () => {
    let doc = parseFocus("## Global\n- [ ] Plain\n- [ ] \u{1F4CC} Pinned already\n");
    const [plain, pinned] = sectionItems(doc.sections[0]!);
    expect(pinned!.pinned).toBe(true);
    expect(pinned!.text).toBe("Pinned already");
    doc = changeFocusItem(doc, plain!.id, { pinned: true })!;
    expect(sectionItems(doc.sections[0]!)[0]!.id).toBe(plain!.id);
    expect(serializeFocus(doc)).toContain("- [ ] \u{1F4CC} Plain\n");
    doc = changeFocusItem(doc, plain!.id, { pinned: false })!;
    expect(serializeFocus(doc)).toContain("- [ ] Plain\n");
  });

  it("moves an item up or down inside its section and stops at the ends", () => {
    let doc = parseFocus("## Global\n- [ ] A\nhand note\n- [ ] B\n- [ ] C\n");
    const [a, , c] = sectionItems(doc.sections[0]!);
    doc = moveFocusItem(doc, c!.id, "up")!;
    expect(sectionItems(doc.sections[0]!).map((item) => item.text)).toEqual(["A", "C", "B"]);
    doc = moveFocusItem(doc, a!.id, "up")!;
    expect(sectionItems(doc.sections[0]!).map((item) => item.text)).toEqual(["A", "C", "B"]);
    doc = moveFocusItem(doc, a!.id, "down")!;
    expect(sectionItems(doc.sections[0]!).map((item) => item.text)).toEqual(["C", "A", "B"]);
    expect(moveFocusItem(doc, "global:missing", "up")).toBeNull();
  });

  it("keeps an id when other lines are added before it", () => {
    const doc = parseFocus("## app\n- [ ] Keep me\n");
    const id = sectionItems(doc.sections[0]!)[0]!.id;
    const grown = parseFocus("## app\n- [ ] New\n- [ ] Keep me\n");
    expect(sectionItems(grown.sections[0]!).find((item) => item.text === "Keep me")?.id).toBe(id);
  });
});
