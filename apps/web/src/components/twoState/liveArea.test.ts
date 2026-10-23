import { describe, expect, it } from "vite-plus/test";

import type { FoldedFeedEvent } from "@t3tools/contracts";

import type { AccessedAiosFile } from "~/agentActivity";

import { areaForFolder, liveArea, shellAiosFiles, touchedFromFeed, withTouched } from "./liveArea";

const file = (relative: string, access: "read" | "write" = "read"): AccessedAiosFile => ({
  path: relative,
  name: relative.split("/").at(-1)!,
  access,
  count: 1,
  folder: relative.includes("/") ? relative.split("/")[0]! : "root",
  relative,
});

describe("liveArea", () => {
  it("lights the area of the newest file the running turn touched", () => {
    const live = liveArea([file("memory/user.md"), file("tasks/a.md", "write")], true);
    expect(live).toEqual({ area: "tasks", path: "tasks/a.md", written: ["tasks"] });
  });

  it("lists every written area once and ignores files outside the areas", () => {
    const live = liveArea(
      [
        file("tasks/a.md", "write"),
        file("AGENTS.md"),
        file("decisions/0001.md", "write"),
        file("tasks/b.md", "write"),
      ],
      true,
    );
    expect(live.written).toEqual(["tasks", "decisions"]);
    expect(live.area).toBe("tasks");
  });

  it("shows nothing live once the turn is over, but keeps the written areas", () => {
    expect(liveArea([file("wiki/page.md", "write")], false)).toEqual({
      area: null,
      path: null,
      written: ["wiki"],
    });
  });

  it("stays idle when the turn touched no AIOS area", () => {
    expect(liveArea([file("AGENTS.md")], true)).toEqual({ area: null, path: null, written: [] });
  });
});

describe("areaForFolder", () => {
  it("maps canon folders to their rail area", () => {
    expect(areaForFolder("memory")).toBe("memory");
    expect(areaForFolder("root")).toBeNull();
    expect(areaForFolder("standards")).toBeNull();
  });
});

describe("withTouched", () => {
  it("raises an area's time to when this app saw the agent write it, then sorts again", () => {
    const areas = [
      { id: "memory", units: 3, changedAt: 2_000 },
      { id: "tasks", units: 9, changedAt: 1_000 },
    ];
    expect(withTouched(areas, { tasks: 5_000 })).toEqual([
      { id: "tasks", units: 9, changedAt: 5_000 },
      { id: "memory", units: 3, changedAt: 2_000 },
    ]);
    expect(withTouched(areas, { tasks: 500 })).toEqual(areas);
  });
});

describe("touchedFromFeed", () => {
  const changed = (ts: string, files: string[]) =>
    ({ type: "aios.changed", ts, target: { files } }) as unknown as FoldedFeedEvent;

  it("keeps the newest aios.changed time per rail area", () => {
    const touched = touchedFromFeed([
      changed("2026-10-21T19:00:00-07:00", ["tasks/a.md", "wiki/p.md", "standards/x.md"]),
      changed("2026-10-21T18:00:00-07:00", ["tasks/b.md", ".agents/skills/plan/SKILL.md"]),
      { type: "agent.finished", ts: "2026-10-21T19:30:00-07:00" } as unknown as FoldedFeedEvent,
    ]);
    expect(touched).toEqual({
      tasks: Date.parse("2026-10-21T19:00:00-07:00"),
      wiki: Date.parse("2026-10-21T19:00:00-07:00"),
      skills: Date.parse("2026-10-21T18:00:00-07:00"),
    });
  });
});

describe("shellAiosFiles", () => {
  it("finds AIOS paths in shell commands and marks writes", () => {
    expect(
      shellAiosFiles([
        "Get-Content memory/user.md",
        String.raw`Set-Content -Path "C:\lcw\P1 test AIOS\tasks\p1.md" -Value "x"`,
        "echo hi > wiki/page.md",
        "npm test",
        String.raw`"C:\Program Files\PowerShell\pwsh.exe" -Command "New-Item -Force -Path decisions | Out-Null; Add-Content -LiteralPath decisions/p1.md -Value 'x'"`,
      ]).map((file) => `${file.access} ${file.relative}`),
    ).toEqual([
      "read memory/user.md",
      "write tasks/p1.md",
      "write wiki/page.md",
      "write decisions/p1.md",
    ]);
  });
});
