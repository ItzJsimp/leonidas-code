import { describe, expect, it } from "vite-plus/test";

import { actionLabels, getLatestGate, saveGate, sendGate } from "./gitActions.logic";
import type { LaneStatus } from "./gitLane.logic";

const clean: LaneStatus = {
  isRepo: true,
  hasPrimaryRemote: true,
  isDefaultRef: false,
  refName: "feat/x",
  hasWorkingTreeChanges: false,
  workingTree: { files: [] },
  hasUpstream: true,
  aheadCount: 0,
  behindCount: 0,
};
const { aheadCount: _ahead, ...noAhead } = clean;
const dirty: LaneStatus = { ...clean, hasWorkingTreeChanges: true, workingTree: { files: [1, 2] } };

describe("saveGate", () => {
  it("waits for the status", () => {
    expect(saveGate(null)).toMatchObject({ allowed: false });
  });
  it("refuses when nothing changed", () => {
    expect(saveGate(clean)).toEqual({
      allowed: false,
      reason: "Nothing to save. No files have changed.",
    });
  });
  it("allows when files changed", () => {
    expect(saveGate(dirty)).toEqual({ allowed: true });
  });
});

describe("sendGate", () => {
  it("refuses with no GitHub remote", () => {
    expect(sendGate({ ...clean, hasPrimaryRemote: false })).toMatchObject({ allowed: false });
  });
  it("refuses when nothing is waiting to be sent", () => {
    expect(sendGate(clean)).toMatchObject({
      allowed: false,
      reason: "Everything you saved is already online.",
    });
  });
  it("allows when saved work is not sent yet", () => {
    expect(sendGate({ ...clean, aheadCount: 2 })).toEqual({ allowed: true, confirmMain: false });
  });
  it("allows the first send of a new branch", () => {
    expect(sendGate({ ...noAhead, hasUpstream: false })).toEqual({
      allowed: true,
      confirmMain: false,
    });
  });
  it("tells you to get latest first when behind", () => {
    expect(sendGate({ ...clean, aheadCount: 1, behindCount: 3 })).toMatchObject({
      allowed: false,
      reason: "GitHub has 3 newer saves. Get latest first, then send.",
    });
  });
  it("asks for a confirm on main", () => {
    expect(sendGate({ ...clean, isDefaultRef: true, refName: "main", aheadCount: 1 })).toEqual({
      allowed: true,
      confirmMain: true,
    });
  });
  it("refuses on a detached head", () => {
    expect(sendGate({ ...clean, refName: null, aheadCount: 1 })).toMatchObject({ allowed: false });
  });
});

describe("getLatestGate", () => {
  it("refuses with no GitHub remote or upstream", () => {
    expect(getLatestGate({ ...clean, hasPrimaryRemote: false })).toMatchObject({ allowed: false });
    expect(getLatestGate({ ...clean, hasUpstream: false })).toMatchObject({ allowed: false });
  });
  it("refuses when already up to date", () => {
    expect(getLatestGate(clean)).toMatchObject({
      allowed: false,
      reason: "You already have the latest.",
    });
  });
  it("refuses on a dirty folder and names the count", () => {
    expect(getLatestGate({ ...dirty, behindCount: 1 })).toEqual({
      allowed: false,
      reason: "2 files have changes that are not saved. Save them first, so nothing is lost.",
    });
  });
  it("allows on a clean folder that is behind", () => {
    expect(getLatestGate({ ...clean, behindCount: 2 })).toEqual({ allowed: true });
  });
});

describe("actionLabels", () => {
  it("uses plain words for beginners and Git verbs for advanced", () => {
    expect(actionLabels("beginner")).toMatchObject({
      save: "Save",
      send: "Send to GitHub",
      getLatest: "Get latest",
    });
    expect(actionLabels("advanced")).toMatchObject({
      save: "Commit",
      send: "Push",
      getLatest: "Pull",
    });
  });
});
