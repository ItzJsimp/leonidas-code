import type { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  describeInspection,
  folderInspectionRequest,
  needsConfirmation,
  resolvedFolderPath,
  type FolderInspection,
} from "./folderInspection.logic";

const directory = (
  contents: { directories?: string[]; files?: string[]; existingFiles?: string[] } = {},
): FolderInspection => {
  const directories = contents.directories ?? [];
  const files = contents.files ?? [];
  return {
    _tag: "directory",
    resolvedPath: "/home/me/AIOS",
    directoryCount: directories.length,
    fileCount: files.length,
    directories,
    files,
    existingFiles: contents.existingFiles ?? [],
  };
};

describe("resolvedFolderPath", () => {
  it("returns the path the server resolved, so ~ matches an existing project root", () => {
    const resolved = String.raw`C:\Users\Sam\Documents\My AIOS`;
    expect(
      resolvedFolderPath({ _tag: "missing", resolvedPath: resolved }, "~/Documents/My AIOS"),
    ).toBe(resolved);
  });

  it("falls back to the typed path when the check could not run", () => {
    expect(resolvedFolderPath({ _tag: "unknown" }, "~/AIOS")).toBe("~/AIOS");
  });
});

describe("folderInspection.logic", () => {
  it("writes without asking only into a missing or empty folder", () => {
    expect(needsConfirmation({ _tag: "missing", resolvedPath: "/home/me/AIOS" })).toBe(false);
    expect(needsConfirmation(directory())).toBe(false);
    expect(describeInspection(directory())).toEqual([]);
  });

  it("asks when the folder holds only loose files", () => {
    const inspection = directory({ files: ["notes.txt", "todo.md"] });
    expect(needsConfirmation(inspection)).toBe(true);
    expect(describeInspection(inspection)).toEqual([
      "Folder already has 2 files inside.",
      "Inside: notes.txt, todo.md.",
    ]);
  });

  it("names the target files that would be replaced", () => {
    const inspection = directory({
      directories: [".claude"],
      files: ["CLAUDE.md"],
      existingFiles: ["CLAUDE.md", ".claude/skills/tdd/SKILL.md"],
    });
    expect(needsConfirmation(inspection)).toBe(true);
    expect(describeInspection(inspection)).toEqual([
      "Folder already has 1 folder and 1 file inside.",
      "Inside: .claude/, CLAUDE.md.",
      "These files will be replaced: CLAUDE.md, .claude/skills/tdd/SKILL.md.",
    ]);
  });

  it("asks before writing when the folder cannot be read or checked", () => {
    const unreadable: FolderInspection = {
      _tag: "unreadable",
      resolvedPath: "/home/me/AIOS",
      code: "EACCES",
    };
    expect(needsConfirmation(unreadable)).toBe(true);
    expect(describeInspection(unreadable)).toEqual([
      "Could not read this folder (EACCES), so files in it may be replaced.",
    ]);
    expect(needsConfirmation({ _tag: "unknown" })).toBe(true);
    expect(describeInspection({ _tag: "unknown" })).toEqual([
      "Could not check this folder first, so files in it may be replaced.",
    ]);
    const file: FolderInspection = { _tag: "notDirectory", resolvedPath: "/home/me/AIOS" };
    expect(needsConfirmation(file)).toBe(true);
  });

  it("counts names beyond the server's listing cap", () => {
    const inspection: FolderInspection = {
      _tag: "directory",
      resolvedPath: "/home/me/AIOS",
      directoryCount: 0,
      fileCount: 120,
      directories: [],
      files: ["1", "2", "3", "4", "5", "6", "7"],
      existingFiles: [],
    };
    expect(describeInspection(inspection)[1]).toBe("Inside: 1, 2, 3, 4, 5, 6, and 114 more.");
  });

  it("sends a remote folder path untouched to the environment that owns it", () => {
    const remote = "remote-box" as EnvironmentId;
    const windowsPath = String.raw`C:\Users\me\AIOS\ `.trimEnd();
    expect(
      folderInspectionRequest(remote, `  ${windowsPath} `, ["CLAUDE.md", "CLAUDE.md"]),
    ).toEqual({
      environmentId: remote,
      input: { path: windowsPath, filesToCheck: ["CLAUDE.md"] },
    });
    expect(folderInspectionRequest(undefined, "~/AIOS", [])).toBeNull();
    expect(folderInspectionRequest(remote, "   ", [])).toBeNull();
  });
});
