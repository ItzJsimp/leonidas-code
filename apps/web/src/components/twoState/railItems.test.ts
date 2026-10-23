import { describe, expect, it } from "vite-plus/test";

import { activeRailId, railItems } from "./railItems";

const ids = (items: ReadonlyArray<{ readonly id: string }>) => items.map((item) => item.id);

const BASE = [
  "command-center",
  "chat",
  "scribe",
  "inbox",
  "today",
  "tasks",
  "projects",
  "memory",
  "library",
  "content",
  "images",
];

describe("railItems", () => {
  it("shows 11 main icons by default, in order", () => {
    const { main } = railItems({ business: false, builder: false });
    expect(ids(main)).toEqual(BASE);
  });

  it("adds Team after Images for a business workspace", () => {
    const { main } = railItems({ business: true, builder: false });
    expect(ids(main)).toEqual([...BASE, "team"]);
  });

  it("adds Developer for a builder", () => {
    const { main } = railItems({ business: false, builder: true });
    expect(ids(main)).toEqual([...BASE, "developer"]);
  });

  it("shows both extras, Team first", () => {
    const { main } = railItems({ business: true, builder: true });
    expect(ids(main)).toEqual([...BASE, "team", "developer"]);
    expect(main).toHaveLength(13);
  });

  it("always has Usage then Settings at the bottom", () => {
    for (const business of [false, true]) {
      for (const builder of [false, true]) {
        expect(ids(railItems({ business, builder }).bottom)).toEqual(["usage", "settings"]);
      }
    }
  });

  it("points each icon at its page and gives a plain tooltip", () => {
    const { main, bottom } = railItems({ business: true, builder: true });
    expect(main.find((item) => item.id === "inbox")).toMatchObject({
      to: "/inbox",
      tooltip: "Inbox: everything that needs you or finished",
    });
    expect(main.find((item) => item.id === "chat")?.tooltip.startsWith("Leonidas Chat")).toBe(true);
    expect(main.find((item) => item.id === "content")?.to).toBe("/marketing");
    expect(bottom.map((item) => item.to)).toEqual(["/usage", "/settings"]);
    expect(main.find((item) => item.id === "developer")?.alsoActiveOn).toEqual([
      "/git",
      "/pull-requests",
    ]);
    for (const item of [...main, ...bottom]) {
      expect(`${item.label}${item.tooltip}`).not.toMatch(/\u2014|\bcode\b|MCP|worktree|T3/i);
    }
  });
});

describe("activeRailId", () => {
  it("marks the icon for the open page", () => {
    expect(activeRailId("/inbox", false)).toBe("inbox");
    expect(activeRailId("/settings/general", false)).toBe("settings");
    expect(activeRailId("/marketing", false)).toBe("content");
  });
  it("marks Chat for the index page and for any chat", () => {
    expect(activeRailId("/", false)).toBe("chat");
    expect(activeRailId("/env/thread", true)).toBe("chat");
  });
  it("marks nothing for a page the rail does not list", () => {
    expect(activeRailId("/pair", false)).toBeNull();
  });
  it("marks Memory on the brain map page", () => {
    expect(activeRailId("/brain", false)).toBe("memory");
    expect(activeRailId("/brain/x", false)).toBe("memory");
  });
  it("marks Developer on the Git and pull request pages", () => {
    expect(activeRailId("/git", false)).toBe("developer");
    expect(activeRailId("/pull-requests", false)).toBe("developer");
    expect(activeRailId("/developer", false)).toBe("developer");
  });
  it("marks Settings on This PC and on every settings page", () => {
    expect(activeRailId("/system-care", false)).toBe("settings");
    expect(activeRailId("/settings/appearance", false)).toBe("settings");
    expect(activeRailId("/settings/open-source-licenses", false)).toBe("settings");
  });
  it("matches whole path parts only, never a longer name", () => {
    expect(activeRailId("/gitlab", false)).toBeNull();
    expect(activeRailId("/brainstorm", false)).toBeNull();
    expect(activeRailId("/system-carefree", false)).toBeNull();
  });
});
