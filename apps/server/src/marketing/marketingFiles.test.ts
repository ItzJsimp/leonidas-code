// @effect-diagnostics nodeBuiltinImport:off - tests write real marketing files in a temp folder.
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  checkApproval,
  MAX_FILE_BYTES,
  readBrands,
  readPosts,
  readTickets,
  requestApproval,
  saveDraft,
} from "./marketingFiles.ts";

const agent = { kind: "agent", name: "test agent" } as const;
const roots: Array<string> = [];

/** A made-up workspace with one made-up brand. */
function makeWorkspace(): string {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "marketing-"));
  roots.push(root);
  NodeFS.mkdirSync(NodePath.join(root, "marketing", "brands"), { recursive: true });
  NodeFS.writeFileSync(
    NodePath.join(root, "marketing", "brands", "acme-games.md"),
    "---\nslug: acme-games\nname: Acme Games\nspend_cap_usd: 0\nchannels: [x]\n---\n# Acme Games\n\n## Voice do\n- Short lines.\n",
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) NodeFS.rmSync(root, { recursive: true, force: true });
});

/** What the approval screen (next card) will write: a person's decision on a ticket. */
function decide(
  root: string,
  ticketId: string,
  decidedBy: { kind: string; name: string },
  status: "approved" | "rejected" = "approved",
) {
  const ticket = readTickets(root).records.find((t) => t.id === ticketId)!;
  const file = NodePath.join(root, "marketing", "approvals", `${ticket.postId.slice(5, 12)}.jsonl`);
  NodeFS.appendFileSync(
    file,
    `${JSON.stringify({ ...ticket, status, decidedAt: "2026-10-22T20:00:00Z", decidedBy })}\n`,
  );
}

const draft = (root: string, text = "Clean the slime, beat the boss.") =>
  saveDraft(root, { brand: "acme-games", channel: "x", text }, agent);

describe("drafts", () => {
  it("needs a brand profile and keeps the last version of each post", () => {
    const root = makeWorkspace();
    expect(() => saveDraft(root, { brand: "nope", channel: "x", text: "hi" }, agent)).toThrow(
      /No brand profile/,
    );
    const first = draft(root);
    const edited = saveDraft(
      root,
      { id: first.id, brand: first.brand, channel: first.channel, text: "New text." },
      agent,
    );
    const posts = readPosts(root).records;
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ id: first.id, text: "New text.", createdAt: first.createdAt });
    expect(edited.id).toBe(first.id);
    const file = NodePath.join(root, "marketing", "posts", `${first.createdAt.slice(0, 7)}.jsonl`);
    const lines = NodeFS.readFileSync(file, "utf8").trim().split("\n");
    expect(lines.map((line) => JSON.parse(line).id)).toEqual([first.id, first.id]);
  });

  it("reports a file over the size cap and still reads the others", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const big = NodePath.join(root, "marketing", "posts", "2000-01.jsonl");
    NodeFS.writeFileSync(big, "x".repeat(MAX_FILE_BYTES + 1));
    const { records, bad } = readPosts(root);
    expect(records.map((p) => p.id)).toEqual([post.id]);
    expect(bad).toEqual([
      { file: "marketing/posts/2000-01.jsonl", reason: "the file is over 5 MB" },
    ]);
  });

  it("reports a bad brand file and still reads the good one", () => {
    const root = makeWorkspace();
    NodeFS.writeFileSync(NodePath.join(root, "marketing", "brands", "broken.md"), "no frontmatter");
    const { records, bad } = readBrands(root);
    expect(records.map((b) => b.slug)).toEqual(["acme-games"]);
    expect(bad).toEqual([{ file: "marketing/brands/broken.md", reason: "no frontmatter" }]);
  });
});

describe("approval gate", () => {
  it("refuses with no ticket and with a pending ticket", () => {
    const root = makeWorkspace();
    const post = draft(root);
    expect(checkApproval(root, post.id, "publish")).toEqual({ ok: false, reason: "no_ticket" });
    requestApproval(root, { postId: post.id, act: "publish", costEstimateUsd: 0.015 }, agent);
    expect(checkApproval(root, post.id, "publish")).toEqual({ ok: false, reason: "pending" });
  });

  it("passes only for a person's approval of the exact content and the same act", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    decide(root, ticket.id, { kind: "member", name: "Owner" });
    expect(checkApproval(root, post.id, "publish")).toMatchObject({ ok: true });
    expect(checkApproval(root, post.id, "spend")).toEqual({ ok: false, reason: "no_ticket" });
  });

  it("voids the approval when the draft changes after it", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    decide(root, ticket.id, { kind: "member", name: "Owner" });
    saveDraft(
      root,
      { id: post.id, brand: post.brand, channel: post.channel, text: "Changed after approval." },
      agent,
    );
    expect(checkApproval(root, post.id, "publish")).toEqual({
      ok: false,
      reason: "content_changed",
    });

    const again = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    expect(checkApproval(root, post.id, "publish")).toEqual({ ok: false, reason: "pending" });
    decide(root, again.id, { kind: "member", name: "Owner" });
    expect(checkApproval(root, post.id, "publish")).toMatchObject({ ok: true });
  });

  it("voids the approval when the channel or the time changes", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    decide(root, ticket.id, { kind: "member", name: "Owner" });
    const base = { id: post.id, brand: post.brand, text: post.text };
    saveDraft(root, { ...base, channel: "discord" }, agent);
    expect(checkApproval(root, post.id, "publish")).toEqual({
      ok: false,
      reason: "content_changed",
    });
    saveDraft(root, { ...base, channel: "x", scheduledFor: "2026-11-01T17:00:00Z" }, agent);
    expect(checkApproval(root, post.id, "publish")).toEqual({
      ok: false,
      reason: "content_changed",
    });
  });

  it("refuses a rejected ticket", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    decide(root, ticket.id, { kind: "member", name: "Owner" }, "rejected");
    expect(checkApproval(root, post.id, "publish")).toEqual({ ok: false, reason: "rejected" });
  });

  it("ignores an approval line that names an agent", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    decide(root, ticket.id, { kind: "agent", name: "sneaky agent" });
    expect(checkApproval(root, post.id, "publish")).toEqual({ ok: false, reason: "pending" });
    expect(readTickets(root).bad).toHaveLength(1);
  });

  it("asks a person through one needs_you feed event", () => {
    const root = makeWorkspace();
    const post = draft(root);
    requestApproval(root, { postId: post.id, act: "publish", costEstimateUsd: 0.015 }, agent);
    const feed = NodeFS.readdirSync(NodePath.join(root, "events"));
    const lines = NodeFS.readFileSync(NodePath.join(root, "events", feed[0]!), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: "needs_you", type: "marketing.approval_requested" });
  });
});
