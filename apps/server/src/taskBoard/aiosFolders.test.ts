// @effect-diagnostics nodeBuiltinImport:off - temp AIOS folders are plain Node fixtures.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";

import { describeNote, readFolder } from "./aiosFolders.ts";

let root: string;

const write = (path: string, text: string) => {
  const full = NodePath.join(root, path);
  NodeFS.mkdirSync(NodePath.dirname(full), { recursive: true });
  NodeFS.writeFileSync(full, text);
};

beforeEach(() => {
  root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-folders-"));
});

afterEach(() => {
  NodeFS.rmSync(root, { recursive: true, force: true });
});

describe("describeNote", () => {
  it("prefers frontmatter, then the first heading and paragraph, then the file name", () => {
    expect(
      describeNote(
        "decisions/0010-git.md",
        '---\ntitle: "Git replaces the log"\ndate: 2026-10-02\ndescription: Commits are the log.\n---\n# Other\n',
      ),
    ).toEqual({
      title: "Git replaces the log",
      date: "2026-10-02",
      summary: "Commits are the log.",
    });
    expect(
      describeNote(
        "logs/briefings/2026-10-23-briefing.md",
        "# Daily **brief**\n\n> [!note] skip\n\nSlept 6 hours. See [the plan](../x.md)\nand rest.\n\nMore.",
      ),
    ).toEqual({
      title: "Daily brief",
      date: "2026-10-23",
      summary: "Slept 6 hours. See the plan and rest.",
    });
    expect(describeNote("wiki/time-blocking.md", "")).toEqual({
      title: "time blocking",
      date: null,
      summary: "",
    });
  });
});

describe("readFolder", () => {
  it("lists notes newest first by the date they name, skips index files, and counts all", async () => {
    write("logs/briefings/2026-10-21-briefing.md", "# Old\n");
    write("logs/briefings/2026-10-23-briefing.md", "# New\n");
    write("logs/sessions/2026-10-22-session.md", "# Mid\n");
    write("logs/logs-index.md", "# Index\n");
    const list = await readFolder(root, "logs");
    expect(list.total).toBe(3);
    expect(list.items.map((item) => item.path)).toEqual([
      "logs/briefings/2026-10-23-briefing.md",
      "logs/sessions/2026-10-22-session.md",
      "logs/briefings/2026-10-21-briefing.md",
    ]);
  });

  it("returns an empty list for a missing folder", async () => {
    expect(await readFolder(root, "wiki")).toEqual({ root, folder: "wiki", items: [], total: 0 });
  });
});
