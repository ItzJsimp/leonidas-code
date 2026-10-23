import { describe, expect, it } from "vite-plus/test";

import { activityLabel, projectRows, type ProjectChat, type ProjectGroup } from "./projects.logic";

const group = (key: string, name: string, ...members: string[]): ProjectGroup => ({
  key,
  name,
  memberKeys: members,
});
const chat = (
  id: string,
  project: string,
  at: string | null,
  extra: Partial<ProjectChat> = {},
): ProjectChat => ({
  id,
  environmentId: "env",
  projectKey: project,
  at,
  archived: false,
  ...extra,
});

describe("projectRows", () => {
  const groups = [
    group("a", "Alpha", "env:1"),
    group("b", "Beta", "env:2", "env:3"),
    group("c", "Gamma", "env:4"),
  ];
  const chats = [
    chat("t1", "env:1", "2026-10-01T10:00:00Z"),
    chat("t2", "env:2", "2026-10-20T10:00:00Z"),
    chat("t3", "env:3", "2026-10-22T10:00:00Z"),
    chat("t4", "env:1", "2026-10-02T10:00:00Z", { archived: true }),
  ];

  it("sorts newest activity first and puts projects with no chats last", () => {
    expect(projectRows(groups, chats).map((row) => row.name)).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("counts the chats of every folder in a group, not archived ones", () => {
    const rows = projectRows(groups, chats);
    expect(rows.find((row) => row.name === "Beta")?.chats).toBe(2);
    expect(rows.find((row) => row.name === "Alpha")?.chats).toBe(1);
    expect(rows.find((row) => row.name === "Gamma")?.chats).toBe(0);
  });

  it("names the newest chat to open, or none", () => {
    const rows = projectRows(groups, chats);
    expect(rows[0]?.newest).toEqual({ environmentId: "env", id: "t3" });
    expect(rows.find((row) => row.name === "Gamma")?.newest).toBeNull();
  });

  it("breaks a tie by name", () => {
    const rows = projectRows([group("z", "Zed", "env:9"), group("y", "Yak", "env:8")], []);
    expect(rows.map((row) => row.name)).toEqual(["Yak", "Zed"]);
  });

  it("returns nothing when there are no projects", () => {
    expect(projectRows([], chats)).toEqual([]);
  });
});

describe("activityLabel", () => {
  it("says no chats yet, or when the last one moved", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    expect(activityLabel(0, null, now)).toBe("No chats yet");
    expect(activityLabel(1, Date.parse("2026-10-23T11:30:00Z"), now)).toBe("1 chat · 30 min ago");
    expect(activityLabel(4, Date.parse("2026-10-22T11:30:00Z"), now)).toBe("4 chats · Yesterday");
  });
});
