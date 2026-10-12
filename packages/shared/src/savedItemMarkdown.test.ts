import { describe, expect, it } from "vite-plus/test";

import { parseSavedItemMarkdown, renderSavedItemMarkdown } from "./savedItemMarkdown.js";

const roundTrip = (item: Parameters<typeof renderSavedItemMarkdown>[0]) => {
  const parsed = parseSavedItemMarkdown(renderSavedItemMarkdown(item));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.item;
};

describe("saved item markdown", () => {
  it("round trips a prompt", () => {
    const item = {
      kind: "prompt",
      title: "Fix the flaky test",
      tags: ["tests", "web"],
      body: "Find why `foo.test.ts` flakes.\n\nThen fix it.",
    } as const;
    expect(roundTrip(item)).toEqual(item);
  });

  it("round trips a note with no tags and an empty title", () => {
    const item = { kind: "note", title: "", tags: [], body: "Remember the milk" } as const;
    expect(roundTrip(item)).toEqual(item);
  });

  it("keeps bodies that contain fences, rules and frontmatter-like text", () => {
    const body = [
      "Here is a sample:",
      "",
      "```md",
      "---",
      "kind: note",
      "---",
      "```",
      "",
      "---",
      "trailing rule",
    ].join("\n");
    const item = { kind: "prompt", title: "Sample", tags: [], body } as const;
    expect(roundTrip(item)).toEqual(item);
  });

  it("keeps titles with quotes, colons and unicode", () => {
    const item = {
      kind: "prompt",
      title: 'Say "hi": it\'s \u00e9\u00e8 time',
      tags: ["a, b", 'q"uote'],
      body: "x",
    } as const;
    expect(roundTrip(item)).toEqual(item);
  });

  it("keeps trailing newlines in the body exactly", () => {
    const item = { kind: "prompt", title: "T", tags: [], body: "line\n\n" } as const;
    expect(roundTrip(item)).toEqual(item);
  });

  it("renders readable markdown an external agent can use as is", () => {
    const text = renderSavedItemMarkdown({
      kind: "prompt",
      title: "Do it",
      tags: ["x"],
      body: "Body text",
    });
    expect(text).toBe(
      [
        "---",
        "leonidas: 1",
        "kind: prompt",
        'title: "Do it"',
        'tags: ["x"]',
        "---",
        "",
        "Body text",
        "",
      ].join("\n"),
    );
  });

  it("accepts Windows line endings from a pasted copy", () => {
    const parsed = parseSavedItemMarkdown(
      '---\r\nleonidas: 1\r\nkind: note\r\ntitle: "N"\r\ntags: []\r\n---\r\n\r\nhello\r\n',
    );
    expect(parsed).toEqual({
      ok: true,
      item: { kind: "note", title: "N", tags: [], body: "hello" },
    });
  });

  it("rejects text that is not exported markdown", () => {
    expect(parseSavedItemMarkdown("just a plain prompt")).toMatchObject({ ok: false });
  });

  it("rejects an unknown format version with a clear error", () => {
    const result = parseSavedItemMarkdown(
      '---\nleonidas: 2\nkind: note\ntitle: ""\ntags: []\n---\n\nx\n',
    );
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain("version 2");
  });

  it("rejects an unsupported kind", () => {
    const result = parseSavedItemMarkdown(
      '---\nleonidas: 1\nkind: task\ntitle: ""\ntags: []\n---\n\nx\n',
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects frontmatter that is never closed", () => {
    expect(parseSavedItemMarkdown("---\nleonidas: 1\nkind: note\n")).toMatchObject({ ok: false });
  });
});
