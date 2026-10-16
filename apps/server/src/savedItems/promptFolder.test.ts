import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { describe, expect, it } from "@effect/vitest";
import {
  deleteFolderPrompt,
  freeFileName,
  parseFolderPrompt,
  readFolderPrompts,
  writeFolderPrompt,
} from "./promptFolder.ts";

const tempDir = () => NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "prompt-folder-"));

describe("promptFolder", () => {
  it("reads only type: prompt files and skips index files", () => {
    const dir = tempDir();
    NodeFS.writeFileSync(
      NodePath.join(dir, "a.md"),
      '---\ntype: prompt\ntitle: "Alpha"\ncategory: health\n---\n\nDo alpha.\n',
    );
    NodeFS.writeFileSync(NodePath.join(dir, "b.md"), "---\ntype: note\n---\nNo.\n");
    NodeFS.writeFileSync(NodePath.join(dir, "prompts-index.md"), "---\ntype: prompt\n---\nNo.\n");
    NodeFS.writeFileSync(NodePath.join(dir, "c.md"), "plain text");
    const prompts = readFolderPrompts(dir);
    expect(prompts?.map((p) => [p.file, p.title, p.body, p.tags])).toEqual([
      ["a.md", "Alpha", "Do alpha.", ["health"]],
    ]);
  });

  it("returns null for a missing folder", () => {
    expect(readFolderPrompts(NodePath.join(tempDir(), "nope"))).toBeNull();
  });

  it("falls back to the first heading for the title", () => {
    expect(parseFolderPrompt("x.md", "---\ntype: prompt\n---\n# Heading\nBody", 0)?.title).toBe(
      "Heading",
    );
  });

  it("keeps other frontmatter on write, and creates new files with a free name", () => {
    const dir = tempDir();
    const path = NodePath.join(dir, "a.md");
    NodeFS.writeFileSync(path, '---\ntype: prompt\nowner: shared\ntitle: "Old"\n---\nOld body\n');
    writeFolderPrompt(dir, { file: "a.md", title: "New", body: "New body" });
    expect(NodeFS.readFileSync(path, "utf8")).toBe(
      '---\ntype: prompt\nowner: shared\ntitle: "New"\n---\n\nNew body\n',
    );
    expect(freeFileName(dir, "A")).toBe("a-2.md");
    writeFolderPrompt(dir, { file: "fresh.md", title: "Fresh", body: "Hi" });
    expect(readFolderPrompts(dir)?.find((p) => p.file === "fresh.md")?.title).toBe("Fresh");
    deleteFolderPrompt(dir, "fresh.md");
    expect(NodeFS.existsSync(NodePath.join(dir, "fresh.md"))).toBe(false);
  });
});
