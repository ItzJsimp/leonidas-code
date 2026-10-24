import { describe, expect, it } from "vite-plus/test";

import { aiosFilePath, withoutFrontmatter } from "./aiosFile.logic";

describe("aiosFilePath", () => {
  it("joins a root and a relative path with one slash", () => {
    expect(aiosFilePath("D:\\AIOS\\", "logs/a.md")).toBe("D:\\AIOS/logs/a.md");
    expect(aiosFilePath("/home/me/aios", "/wiki/b.md")).toBe("/home/me/aios/wiki/b.md");
  });
});

describe("withoutFrontmatter", () => {
  it("drops a leading frontmatter block and keeps the body", () => {
    expect(withoutFrontmatter("---\ntitle: A\n---\n# A\nText")).toBe("# A\nText");
    expect(withoutFrontmatter("\uFEFF---\r\nx: 1\r\n---\r\nBody")).toBe("Body");
  });

  it("keeps a note with no frontmatter, or a rule later in the text", () => {
    expect(withoutFrontmatter("# A\n---\nB")).toBe("# A\n---\nB");
  });
});
