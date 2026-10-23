import { describe, expect, it } from "vite-plus/test";

import { activeDeveloperTab, DEVELOPER_TABS } from "./developerTabs";

describe("DEVELOPER_TABS", () => {
  it("lists Git, Pull requests and Terminals in that order, in plain words", () => {
    expect(DEVELOPER_TABS.map((tab) => tab.label)).toEqual(["Git", "Pull requests", "Terminals"]);
    for (const tab of DEVELOPER_TABS) expect(tab.label).not.toMatch(/\u2014|MCP|worktree|T3/i);
  });
});

describe("activeDeveloperTab", () => {
  it("picks the tab for the open page", () => {
    expect(activeDeveloperTab("/git")).toBe("git");
    expect(activeDeveloperTab("/pull-requests")).toBe("pull-requests");
    expect(activeDeveloperTab("/developer")).toBe("terminals");
  });
  it("keeps the tab for a page under it", () => {
    expect(activeDeveloperTab("/pull-requests/12")).toBe("pull-requests");
  });
  it("does not match a longer name", () => {
    expect(activeDeveloperTab("/gitlab")).toBe("terminals");
  });
});
