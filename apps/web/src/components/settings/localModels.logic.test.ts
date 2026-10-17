import type { LocalModelRow } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { fitView, pullPercent, rowAction, sortRows, speedLabel } from "./localModels.logic";

const GB = 1024 ** 3;

const row = (patch: Partial<LocalModelRow> = {}): LocalModelRow => ({
  id: "gemma4:12b-it-q4_K_M",
  name: "Gemma 4 12B",
  installed: false,
  loaded: false,
  sizeBytes: 8 * GB,
  fit: "fits",
  tokensPerSecond: null,
  benchLm: null,
  gate: { allowed: true, reason: null, needsConfirm: false },
  pull: null,
  ...patch,
});

describe("fitView", () => {
  it("names each fit in plain words with a tone", () => {
    expect(fitView("fits")).toMatchObject({ label: "Fits", tone: "success" });
    expect(fitView("tight")).toMatchObject({ label: "Tight", tone: "warning" });
    expect(fitView("too_big")).toMatchObject({ label: "Too big", tone: "error" });
    expect(fitView("unknown")).toMatchObject({ label: "Unknown", tone: "info" });
  });
});

describe("pullPercent", () => {
  it("is null with no pull or no total yet", () => {
    expect(pullPercent(null)).toBeNull();
    expect(
      pullPercent({ status: "starting", completedBytes: 0, totalBytes: 0, error: null }),
    ).toBeNull();
  });
  it("rounds down and caps at 100", () => {
    expect(pullPercent({ status: "x", completedBytes: 333, totalBytes: 1000, error: null })).toBe(
      33,
    );
    expect(pullPercent({ status: "x", completedBytes: 2000, totalBytes: 1000, error: null })).toBe(
      100,
    );
  });
});

describe("speedLabel", () => {
  it("shows not tested until a speed exists", () => {
    expect(speedLabel(null)).toBe("Not tested");
    expect(speedLabel(61.4)).toBe("61 tok/s");
    expect(speedLabel(4.96)).toBe("5.0 tok/s");
  });
});

describe("rowAction", () => {
  it("installed and idle: Run and Delete", () => {
    expect(rowAction(row({ installed: true }))).toEqual({ kind: "installed", canStop: false });
  });
  it("installed and loaded: Stop is offered", () => {
    expect(rowAction(row({ installed: true, loaded: true }))).toEqual({
      kind: "installed",
      canStop: true,
    });
  });
  it("not installed and allowed: Get without confirm", () => {
    expect(rowAction(row())).toEqual({ kind: "get", disabledReason: null, needsConfirm: false });
  });
  it("not installed and over 10 GB: Get with confirm", () => {
    expect(rowAction(row({ gate: { allowed: true, reason: null, needsConfirm: true } }))).toEqual({
      kind: "get",
      disabledReason: null,
      needsConfirm: true,
    });
  });
  it("blocked: Get is disabled with the reason", () => {
    expect(
      rowAction(
        row({ gate: { allowed: false, reason: "Drive D: is a hard disk.", needsConfirm: false } }),
      ),
    ).toEqual({ kind: "get", disabledReason: "Drive D: is a hard disk.", needsConfirm: false });
  });
  it("downloading: Cancel", () => {
    expect(
      rowAction(
        row({ pull: { status: "pulling", completedBytes: 1, totalBytes: 2, error: null } }),
      ),
    ).toEqual({ kind: "pulling" });
  });
  it("a failed pull offers Get again and keeps the error visible", () => {
    expect(
      rowAction(row({ pull: { status: "", completedBytes: 0, totalBytes: 0, error: "boom" } })),
    ).toMatchObject({ kind: "get" });
  });
});

describe("sortRows", () => {
  it("puts installed first, then fits, tight, too big, unknown", () => {
    const rows = [
      row({ id: "a", fit: "too_big" }),
      row({ id: "b", fit: "tight" }),
      row({ id: "c", fit: "fits" }),
      row({ id: "d", fit: "tight", installed: true }),
      row({ id: "e", fit: "unknown" }),
    ];
    expect(sortRows(rows).map((r) => r.id)).toEqual(["d", "c", "b", "a", "e"]);
  });
  it("keeps the input order for equal rows and does not change the input", () => {
    const rows = [row({ id: "x" }), row({ id: "y" })];
    const copy = [...rows];
    expect(sortRows(rows).map((r) => r.id)).toEqual(["x", "y"]);
    expect(rows).toEqual(copy);
  });
});
