import { describe, expect, it } from "vite-plus/test";

import {
  classifyAccessPath,
  commandReadPaths,
  firstThought,
  readableCommand,
} from "./agentActivityAccess";

describe("classifyAccessPath", () => {
  it("separates skills, AIOS canon and ordinary project files", () => {
    expect(classifyAccessPath("D:/Leonidas AIOS/.agents/skills/impeccable/SKILL.md")).toEqual({
      area: "skill",
      skill: "impeccable",
    });
    expect(classifyAccessPath("D:/Leonidas AIOS/memory/core.md")).toEqual({
      area: "aios",
      folder: "memory",
      relative: "memory/core.md",
    });
    expect(classifyAccessPath("INTENT.md")).toEqual({
      area: "aios",
      folder: "root",
      relative: "INTENT.md",
    });
    expect(classifyAccessPath("C:/Users/Jacob/.t3/worktrees/app/tasks/x.ts")).toEqual({
      area: "file",
    });
    expect(classifyAccessPath("apps/web/src/a.ts")).toEqual({ area: "file" });
  });
});

describe("commandReadPaths", () => {
  it("finds the files a shell read touches and ignores other commands", () => {
    const command = `"C:/Program Files/PowerShell/7/pwsh.exe" -Command "Get-Content -LiteralPath 'memory/core.md','.agents/skills/a/SKILL.md'"`;
    expect(commandReadPaths(readableCommand(command))).toEqual([
      "memory/core.md",
      ".agents/skills/a/SKILL.md",
    ]);
    expect(commandReadPaths("pnpm test src/a.test.ts")).toEqual([]);
  });
});

describe("firstThought", () => {
  it("prefers a bold heading, else the first line", () => {
    expect(firstThought("**Optimizing scans**\n\nbody")).toBe("Optimizing scans");
    expect(firstThought("Plain first line\nsecond")).toBe("Plain first line");
    expect(firstThought("  ")).toBeNull();
  });
});

describe("readable output", () => {
  it("skips the response banner and the cd prefix", () => {
    expect(firstThought("**Active Mode:** Mode 10\n\nFixing the bar")).toBe("Fixing the bar");
    expect(readableCommand('cd "D:/repo" && gh run list')).toBe("gh run list");
  });

  it("drops the rtk proxy and the local bin path", () => {
    expect(
      readableCommand(
        "rtk proxy .\\\\node_modules\\\\.bin\\\\vp.cmd test run apps/web/src/a.test.tsx",
      ),
    ).toBe("vp test run apps/web/src/a.test.tsx");
    expect(readableCommand("rtk git status")).toBe("git status");
    expect(readableCommand("./node_modules/.bin/tsc --noEmit")).toBe("tsc --noEmit");
    expect(readableCommand("node_modules\\.bin\\vp.exe lint")).toBe("vp lint");
    // A path argument keeps its folders; only the launcher at the start is shortened.
    expect(readableCommand("vp test run node_modules/.bin/x.test.ts")).toBe(
      "vp test run node_modules/.bin/x.test.ts",
    );
    expect(readableCommand("rtk")).toBe("rtk");
  });
});
