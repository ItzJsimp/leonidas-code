import { describe, expect, it } from "vite-plus/test";

import { clipGraphemes, clipTitle, firstGrapheme } from "./safeText";

describe("firstGrapheme", () => {
  it("keeps a whole emoji, flag or letter", () => {
    expect(firstGrapheme("🚀 Launch")).toBe("🚀");
    expect(firstGrapheme("👨‍👩‍👧 Home")).toBe("👨‍👩‍👧");
    expect(firstGrapheme("🇺🇸 US")).toBe("🇺🇸");
    expect(firstGrapheme("Leonidas")).toBe("L");
  });

  it("returns an empty string for empty text", () => {
    expect(firstGrapheme("")).toBe("");
  });
});

describe("clipGraphemes", () => {
  it("returns short text unchanged", () => {
    expect(clipGraphemes("abc", 5)).toBe("abc");
  });

  it("never splits an emoji at the cut", () => {
    expect(clipGraphemes("ab🚀cd", 3)).toBe("ab🚀");
    expect(clipGraphemes("🚀🚀🚀", 2)).toBe("🚀🚀");
  });
});

describe("clipTitle", () => {
  it("returns short text unchanged", () => {
    expect(clipTitle("Count the tasks", 60)).toBe("Count the tasks");
  });

  it("cuts back to a whole word and marks the cut", () => {
    expect(clipTitle("open every Markdown file in the tasks folder", 36)).toBe(
      "open every Markdown file in the...",
    );
  });

  it("keeps the cut when one word is longer than the limit", () => {
    expect(clipTitle("abcdefgh", 4)).toBe("abcd...");
  });
});
