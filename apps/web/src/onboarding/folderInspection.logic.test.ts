import { describe, expect, it } from "vite-plus/test";

import {
  describeInspection,
  needsConfirmation,
  type FolderInspection,
} from "./folderInspection.logic";

const exists = (subfolders: string[], existingFiles: string[]): FolderInspection => ({
  status: "exists",
  resolvedPath: "/home/me/AIOS",
  subfolders,
  existingFiles,
});

describe("folderInspection.logic", () => {
  it("only asks when an existing folder has content", () => {
    expect(needsConfirmation({ status: "missing" })).toBe(false);
    expect(needsConfirmation({ status: "unknown" })).toBe(false);
    expect(needsConfirmation(exists([], []))).toBe(false);
    expect(needsConfirmation(exists(["a"], []))).toBe(true);
    expect(needsConfirmation(exists([], ["CLAUDE.md"]))).toBe(true);
  });

  it("describes folders and files in plain lines", () => {
    expect(describeInspection(exists(["a", "b", "c"], ["CLAUDE.md", "AGENTS.md"]))).toEqual([
      "Folder already exists with 3 folders inside.",
      "These files will be replaced: CLAUDE.md, AGENTS.md.",
    ]);
    expect(describeInspection(exists(["a"], []))).toEqual([
      "Folder already exists with 1 folder inside.",
    ]);
    expect(describeInspection({ status: "missing" })).toEqual([]);
  });

  it("caps listed file names at six", () => {
    const files = ["1", "2", "3", "4", "5", "6", "7", "8"];
    expect(describeInspection(exists([], files))).toEqual([
      "Folder already exists.",
      "These files will be replaced: 1, 2, 3, 4, 5, 6, and 2 more.",
    ]);
  });
});
