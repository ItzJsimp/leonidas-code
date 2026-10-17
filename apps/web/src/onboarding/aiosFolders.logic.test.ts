// @effect-diagnostics nodeBuiltinImport:off - reads the committed generated script from disk.
import * as NodeFSP from "node:fs/promises";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  AIOS_FOLDERS_SCRIPT_URL,
  buildAiosFoldersCommand,
  cleanAiosFolderName,
  describeAiosFolder,
  joinAiosFolder,
  renderAiosFoldersScript,
  splitAiosFolder,
} from "./aiosFolders.logic";
import type { FolderInspection } from "./folderInspection.logic";
import { AIOS_PRESET, DEFAULT_AIOS_FOLDER } from "./leonidasSetup.logic";

describe("AIOS folder location and name", () => {
  it("splits the default into the user folder and a name", () => {
    expect(splitAiosFolder(DEFAULT_AIOS_FOLDER)).toEqual({
      location: "~",
      name: "Leonidas AIOS",
    });
  });

  it("splits Windows paths, drive roots and trailing slashes", () => {
    expect(splitAiosFolder(String.raw`C:\Users\Sam\Notes AIOS`)).toEqual({
      location: String.raw`C:\Users\Sam`,
      name: "Notes AIOS",
    });
    expect(splitAiosFolder(String.raw`C:\AIOS`)).toEqual({ location: "C:\\", name: "AIOS" });
    expect(splitAiosFolder("~/AIOS/")).toEqual({ location: "~", name: "AIOS" });
    expect(splitAiosFolder("~")).toEqual({ location: "~", name: "" });
  });

  it("joins with the separator style of the location", () => {
    expect(joinAiosFolder("~/Documents", "Sam AIOS")).toBe("~/Documents/Sam AIOS");
    expect(joinAiosFolder(String.raw`C:\Users\Sam\Documents`, "Sam AIOS")).toBe(
      String.raw`C:\Users\Sam\Documents\Sam AIOS`,
    );
    expect(joinAiosFolder("C:\\", "AIOS")).toBe(String.raw`C:\AIOS`);
    expect(joinAiosFolder("D:", "AIOS")).toBe(String.raw`D:\AIOS`);
  });

  it("round-trips split and join", () => {
    for (const folder of [
      DEFAULT_AIOS_FOLDER,
      String.raw`C:\Users\Sam\My AIOS`,
      "/home/sam/aios",
    ]) {
      const { location, name } = splitAiosFolder(folder);
      expect(joinAiosFolder(location, name)).toBe(folder);
    }
  });

  it("returns null until both a location and a name exist", () => {
    expect(joinAiosFolder("", "AIOS")).toBeNull();
    expect(joinAiosFolder("~/Documents", "   ")).toBeNull();
  });

  it("removes characters Windows refuses from the name", () => {
    expect(cleanAiosFolderName(' Sam: the "best" AIOS?/\\ ')).toBe("Sam the best AIOS");
    expect(cleanAiosFolderName("AIOS. ")).toBe("AIOS");
    expect(joinAiosFolder("~/Documents", "a/b")).toBe("~/Documents/ab");
  });
});

describe("describeAiosFolder", () => {
  const directory = (
    over: Partial<Extract<FolderInspection, { _tag: "directory" }>> = {},
  ): FolderInspection => ({
    _tag: "directory",
    resolvedPath: "C:\\Users\\Sam\\Documents",
    directoryCount: 1,
    fileCount: 1,
    directories: ["Taxes"],
    files: ["notes.txt"],
    existingFiles: [],
    ...over,
  });

  it("says nothing for a missing or empty folder", () => {
    expect(describeAiosFolder({ _tag: "missing", resolvedPath: "x" })).toBeNull();
    expect(describeAiosFolder(directory({ directoryCount: 0, fileCount: 0 }))).toBeNull();
  });

  it("explains a folder that already holds items, without a warning", () => {
    const notice = describeAiosFolder(directory());
    expect(notice?.tone).toBe("info");
    expect(notice?.lines[0]).toBe("This folder already has 2 items in it. That is fine.");
    expect(notice?.lines.join(" ")).not.toMatch(/replaced|anyway/i);
  });

  it("names starter files that already exist", () => {
    const notice = describeAiosFolder(directory({ existingFiles: ["CLAUDE.md"] }));
    expect(notice?.lines.join(" ")).toContain("CLAUDE.md");
    expect(notice?.tone).toBe("info");
  });

  it("keeps a warning when the folder cannot be checked, read, or is a file", () => {
    expect(describeAiosFolder({ _tag: "unknown" })?.tone).toBe("warning");
    expect(describeAiosFolder({ _tag: "unreadable", resolvedPath: "x", code: "EPERM" })?.tone).toBe(
      "warning",
    );
    expect(describeAiosFolder({ _tag: "notDirectory", resolvedPath: "x" })?.tone).toBe("warning");
  });
});

const committedScript = NodeURL.fileURLToPath(
  new URL("../../../../scripts/New-AiosFolders.ps1", import.meta.url),
);

describe("buildAiosFoldersCommand", () => {
  it("runs the published script with the default folder under the user's home", () => {
    expect(buildAiosFoldersCommand("~/AIOS")).toBe(
      `& ([scriptblock]::Create((irm ${AIOS_FOLDERS_SCRIPT_URL}))) -Path (Join-Path $HOME 'AIOS')`,
    );
  });

  it("passes an absolute folder as a quoted literal", () => {
    expect(buildAiosFoldersCommand("D:\\My AIOS")).toContain("-Path 'D:\\My AIOS'");
  });

  it("maps a bare ~ to the home folder and escapes quotes", () => {
    expect(buildAiosFoldersCommand("~")).toMatch(/-Path \$HOME$/);
    expect(buildAiosFoldersCommand("D:\\Jake's AIOS")).toContain("-Path 'D:\\Jake''s AIOS'");
  });
});

describe("renderAiosFoldersScript", () => {
  it("lists every starter path from the preset", () => {
    const script = renderAiosFoldersScript(AIOS_PRESET);

    for (const entry of AIOS_PRESET) expect(script).toContain(`'${entry.path}'`);
  });

  it("escapes single quotes for PowerShell", () => {
    expect(renderAiosFoldersScript([{ path: "it's/" }])).toContain("'it''s/'");
  });

  it("matches the committed scripts/New-AiosFolders.ps1 (run node scripts/generate-aios-folders.ts after a preset change)", async () => {
    // Normalize line endings so a Windows checkout with autocrlf still matches.
    const committed = (await NodeFSP.readFile(committedScript, "utf8")).replace(/\r\n/g, "\n");

    expect(committed).toBe(renderAiosFoldersScript(AIOS_PRESET));
  });
});
