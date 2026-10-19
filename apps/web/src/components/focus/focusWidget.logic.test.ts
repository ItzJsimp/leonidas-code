import { ProjectId, type FocusSnapshot } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  clampToViewport,
  nudge,
  progressOf,
  resizeTo,
  settleDrag,
  visibleRows,
} from "./focusWidget.logic";

const widget = { width: 300, height: 200 };
const viewport = { width: 1000, height: 800 };

describe("focus widget drag", () => {
  it("clamps inside the viewport with an edge gap", () => {
    expect(clampToViewport({ x: -50, y: 900 }, widget, viewport)).toEqual({ x: 8, y: 592 });
    expect(clampToViewport({ x: 2000, y: -3 }, widget, viewport)).toEqual({ x: 692, y: 8 });
  });

  it("sticks a widget larger than the viewport to the top left", () => {
    expect(clampToViewport({ x: 50, y: 50 }, widget, { width: 200, height: 100 })).toEqual({
      x: 8,
      y: 8,
    });
  });

  it("keeps a floating widget left of a side panel by clamping to the chat column", () => {
    const column = { left: 0, top: 40, width: 600, height: 700 };
    expect(clampToViewport({ x: 900, y: 10 }, widget, column)).toEqual({ x: 292, y: 48 });
    const offset = { left: 200, top: 0, width: 400, height: 700 };
    expect(clampToViewport({ x: 0, y: 0 }, widget, offset)).toEqual({ x: 208, y: 8 });
  });

  it("snaps home near the dock and floats elsewhere", () => {
    const dock = { x: 680, y: 16 };
    expect(settleDrag({ x: 690, y: 20 }, dock, widget, viewport)).toBeNull();
    expect(settleDrag({ x: 400, y: 300 }, dock, widget, viewport)).toEqual({ x: 400, y: 300 });
    expect(settleDrag({ x: 400, y: 300 }, null, widget, viewport)).toEqual({ x: 400, y: 300 });
  });

  it("limits a resize to the minimum and to the chat column", () => {
    const column = { width: 700, height: 500 };
    expect(resizeTo({ width: 100, height: 50 }, column)).toEqual({ width: 260, height: 180 });
    expect(resizeTo({ width: 900, height: 900 }, column)).toEqual({ width: 684, height: 484 });
    expect(resizeTo({ width: 400, height: 300 }, column)).toEqual({ width: 400, height: 300 });
  });

  it("moves with arrow keys only", () => {
    expect(nudge({ x: 10, y: 10 }, "ArrowRight", false)).toEqual({ x: 20, y: 10 });
    expect(nudge({ x: 10, y: 10 }, "ArrowUp", true)).toEqual({ x: 10, y: -30 });
    expect(nudge({ x: 10, y: 10 }, "Enter", false)).toBeNull();
  });
});

describe("focus rows", () => {
  const app = ProjectId.make("app");
  const snapshot: FocusSnapshot = {
    path: "/aios/memory/focus.md",
    member: "me",
    sections: [
      { slug: null, projectId: null, items: [{ id: "g1", text: "General", done: true }] },
      { slug: "app", projectId: app, items: [{ id: "a1", text: "App", done: false }] },
      { slug: "other", projectId: null, items: [{ id: "o1", text: "Other", done: false }] },
    ],
  };

  it("shows the project and Global in project scope, every section in all scope", () => {
    expect(visibleRows(snapshot, "project", app).map((row) => row.id)).toEqual(["g1", "a1"]);
    expect(visibleRows(snapshot, "project", null).map((row) => row.id)).toEqual(["g1"]);
    expect(visibleRows(snapshot, "all", null).map((row) => row.slug)).toEqual([
      null,
      "app",
      "other",
    ]);
    expect(visibleRows(null, "all", null)).toEqual([]);
  });

  it("lists pinned rows first and keeps file order inside each group", () => {
    const pinnedSnapshot = {
      path: "/x",
      member: "jake",
      sections: [
        {
          slug: null,
          projectId: null,
          items: [
            { id: "a", text: "A", done: false },
            { id: "b", text: "B", done: false, pinned: true },
            { id: "c", text: "C", done: false },
            { id: "d", text: "D", done: false, pinned: true },
          ],
        },
      ],
    };
    expect(visibleRows(pinnedSnapshot, "all", null).map((row) => row.id)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("counts progress", () => {
    expect(progressOf(visibleRows(snapshot, "all", null))).toEqual({ done: 1, total: 3 });
  });
});
