// @effect-diagnostics nodeBuiltinImport:off - tests write real analytics files in a temp folder.
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { syncMetrics } from "./connectors.ts";
import { readMetrics } from "./marketingFiles.ts";

const roots: Array<string> = [];
afterEach(() => {
  for (const root of roots.splice(0)) NodeFS.rmSync(root, { recursive: true, force: true });
});

/** A made-up workspace whose X agent saved three days: one good, one broken, one wrong shape. */
function workspace(analyticsDir = "x-analytics") {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "marketing-x-"));
  roots.push(root);
  NodeFS.mkdirSync(NodePath.join(root, "marketing"), { recursive: true });
  NodeFS.writeFileSync(
    NodePath.join(root, "marketing", "connections.json"),
    JSON.stringify({ v: 1, x: { mode: "draft", brand: "acme-games", analyticsDir } }),
  );
  const dir = NodePath.join(root, "x-analytics");
  NodeFS.mkdirSync(dir);
  const post = (id: string, impressions: number) => ({
    id,
    text: "made up",
    public_metrics: {
      impression_count: impressions,
      like_count: 3,
      reply_count: 1,
      retweet_count: 0,
    },
  });
  NodeFS.writeFileSync(
    NodePath.join(dir, "2026-10-20.json"),
    JSON.stringify({ data: [post("111", 120), post("222", 40), { id: "333" }] }),
  );
  NodeFS.writeFileSync(NodePath.join(dir, "2026-10-21.json"), "{ not json");
  NodeFS.writeFileSync(NodePath.join(dir, "2026-10-22.json"), JSON.stringify({ errors: ["rate"] }));
  return root;
}

const feedLines = (root: string) =>
  NodeFS.readdirSync(NodePath.join(root, "events")).flatMap((name) =>
    NodeFS.readFileSync(NodePath.join(root, "events", name), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line)),
  );

describe("X connector in draft mode", () => {
  it("keeps the good records, skips and reports every bad one", () => {
    const root = workspace();
    const result = syncMetrics(root);
    expect(result.added).toBe(2);
    expect(result.errors.map((e) => e.reason)).toEqual([
      "post without an id or public_metrics",
      "not valid JSON",
      "no data list (not an X posts response)",
    ]);
    expect(readMetrics(root).records).toMatchObject([
      { externalId: "111", impressions: 120, brand: "acme-games", at: "2026-10-20T00:00:00Z" },
      { externalId: "222", impressions: 40 },
    ]);
    const feed = feedLines(root);
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ level: "failed", type: "marketing.connector_error" });
  });

  it("adds nothing on a second run", () => {
    const root = workspace();
    syncMetrics(root);
    expect(syncMetrics(root).added).toBe(0);
    expect(readMetrics(root).records).toHaveLength(2);
  });

  it("refuses an analytics folder outside the workspace", () => {
    const root = workspace("../elsewhere");
    expect(syncMetrics(root)).toEqual({
      added: 0,
      errors: [{ file: "../elsewhere", reason: "the folder is outside the workspace" }],
    });
  });

  it("reports a broken connections file and stops there", () => {
    const root = workspace();
    NodeFS.writeFileSync(NodePath.join(root, "marketing", "connections.json"), "{");
    expect(syncMetrics(root).errors).toEqual([
      { file: "marketing/connections.json", reason: "not valid JSON" },
    ]);
  });
});
