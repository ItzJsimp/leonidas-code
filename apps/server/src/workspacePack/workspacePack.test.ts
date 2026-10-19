import { assert, describe, it } from "@effect/vitest";
import type { WorkspacePackWidget } from "@t3tools/contracts";

import type { AiosWorkspaceState } from "../taskBoard/aiosWorkspaces.ts";
import { loadBusinessPack } from "./loadBusinessPack.ts";
import { widgetsForWorkspace, type BusinessPack } from "./workspacePack.ts";

const widget: WorkspacePackWidget = {
  id: "w",
  title: "T",
  kpis: [{ label: "L", value: "1", detail: "d" }],
};
const seen: string[] = [];
const pack: BusinessPack = {
  readWidgets: async (root) => {
    seen.push(root);
    return [widget];
  },
};
const ready = (id: string, type: "personal" | "business", root: string): AiosWorkspaceState => ({
  status: "ready",
  root,
  file: { id, name: id, type, schemaVersion: 1 },
});
const workspaces: ReadonlyArray<AiosWorkspaceState> = [
  ready("leonidas", "personal", "/aios/personal"),
  ready("simplygersi", "business", "/aios/sg"),
  { status: "invalid", root: "/aios/broken", error: "bad" },
];

describe("widgetsForWorkspace", () => {
  it("returns the pack widgets for a business workspace, read from its own root", async () => {
    seen.length = 0;
    const widgets = await widgetsForWorkspace(workspaces, "simplygersi", 0, async () => pack);
    assert.deepEqual(widgets, [widget]);
    assert.deepEqual(seen, ["/aios/sg"]);
  });

  it("returns nothing for a personal workspace and never loads the pack", async () => {
    let loaded = false;
    const widgets = await widgetsForWorkspace(workspaces, "leonidas", 0, async () => {
      loaded = true;
      return pack;
    });
    assert.deepEqual(widgets, []);
    assert.isFalse(loaded);
  });

  it("returns nothing for an unknown id, an unready default and no workspaces", async () => {
    const load = async () => pack;
    assert.deepEqual(await widgetsForWorkspace(workspaces, "nope", 0, load), []);
    assert.deepEqual(await widgetsForWorkspace(workspaces.slice(2), undefined, 0, load), []);
    assert.deepEqual(await widgetsForWorkspace([], undefined, 0, load), []);
  });

  it("returns nothing when the pack is absent", async () => {
    assert.deepEqual(await widgetsForWorkspace(workspaces, "simplygersi", 0, async () => null), []);
  });

  it("returns nothing when the pack throws, so the Home never fails for a widget", async () => {
    const broken: BusinessPack = {
      readWidgets: async () => {
        throw new Error("boom");
      },
    };
    const load = async () => broken;
    assert.deepEqual(await widgetsForWorkspace(workspaces, "simplygersi", 0, load), []);
  });
});

describe("loadBusinessPack", () => {
  it("returns the pack or null, never throws", async () => {
    const loaded = await loadBusinessPack();
    assert.isTrue(loaded === null || typeof loaded.readWidgets === "function");
  });
});
