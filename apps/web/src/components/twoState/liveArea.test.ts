import { describe, expect, it } from "vite-plus/test";

import type { AccessedAiosFile } from "~/agentActivity";

import { areaForFolder, liveArea, withTouched } from "./liveArea";

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
