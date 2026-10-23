// @effect-diagnostics nodeBuiltinImport:off - tests write real marketing files in a temp folder.
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  checkApproval,
  decideTickets,
  isSignedApproval,
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

const KEY = new Uint8Array(32).fill(7);
const OTHER_KEY = new Uint8Array(32).fill(9);

/** A person's decision through the real signing path. */
const approve = (root: string, ticketId: string, decision: "approve" | "reject" = "approve") =>
  decideTickets(root, KEY, [{ ticketId, decision }], "Owner")[0]!;

/** A hand-written decision line, as an agent that can write files would make it. */
function forge(
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
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({
      ok: false,
      reason: "no_ticket",
    });
    requestApproval(root, { postId: post.id, act: "publish", costEstimateUsd: 0.015 }, agent);
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({ ok: false, reason: "pending" });
  });

  it("passes only for a person's approval of the exact content and the same act", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    approve(root, ticket.id);
    expect(checkApproval(root, KEY, post.id, "publish")).toMatchObject({ ok: true });
    expect(checkApproval(root, KEY, post.id, "spend")).toEqual({ ok: false, reason: "no_ticket" });
  });

  it("voids the approval when the draft changes after it", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    approve(root, ticket.id);
    saveDraft(
      root,
      { id: post.id, brand: post.brand, channel: post.channel, text: "Changed after approval." },
      agent,
    );
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({
      ok: false,
      reason: "content_changed",
    });

    const again = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({ ok: false, reason: "pending" });
    approve(root, again.id);
    expect(checkApproval(root, KEY, post.id, "publish")).toMatchObject({ ok: true });
  });

  it("voids the approval when the channel or the time changes", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    approve(root, ticket.id);
    const base = { id: post.id, brand: post.brand, text: post.text };
    saveDraft(root, { ...base, channel: "discord" }, agent);
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({
      ok: false,
      reason: "content_changed",
    });
    saveDraft(root, { ...base, channel: "x", scheduledFor: "2026-11-01T17:00:00Z" }, agent);
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({
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
    approve(root, ticket.id, "reject");
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({ ok: false, reason: "rejected" });
  });

  it("ignores an approval line that names an agent", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    forge(root, ticket.id, { kind: "agent", name: "sneaky agent" });
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({ ok: false, reason: "pending" });
    expect(readTickets(root).bad).toHaveLength(1);
  });

  it("refuses a hand-written approved line from a person-shaped record", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    forge(root, ticket.id, { kind: "member", name: "Owner" });
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({ ok: false, reason: "pending" });
  });

  it("refuses a signature made with another key, or copied from another ticket", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const [a, b] = [0, 1].map(() =>
      requestApproval(root, { postId: post.id, act: "publish", costEstimateUsd: 0 }, agent),
    );
    decideTickets(root, OTHER_KEY, [{ ticketId: a!.id, decision: "approve" }], "Owner");
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({ ok: false, reason: "pending" });
    approve(root, b!.id);
    const signed = readTickets(root).records.find((t) => t.id === b!.id)!;
    const file = NodePath.join(root, "marketing", "approvals", `${post.id.slice(5, 12)}.jsonl`);
    // Copy b's signature onto a: the signature names the ticket, so it must not verify.
    NodeFS.appendFileSync(
      file,
      `${JSON.stringify({ ...readTickets(root).records.find((t) => t.id === a!.id)!, signature: signed.signature })}\n`,
    );
    const a2 = readTickets(root).records.find((t) => t.id === a!.id)!;
    expect(a2.status).toBe("approved");
    expect(isSignedApproval(KEY, a2)).toBe(false);
  });
});

describe("decideTickets", () => {
  it("signs one ticket per item, each with its own hash", () => {
    const root = makeWorkspace();
    const one = draft(root, "One.");
    const two = draft(root, "Two.");
    const [t1, t2] = [one, two].map((post) =>
      requestApproval(root, { postId: post.id, act: "publish", costEstimateUsd: 0 }, agent),
    );
    const results = decideTickets(
      root,
      KEY,
      [t1!, t2!].map((t) => ({ ticketId: t.id, decision: "approve" as const })),
      "Owner",
    );
    expect(results).toEqual([
      { ticketId: t1!.id, ok: true },
      { ticketId: t2!.id, ok: true },
    ]);
    const tickets = readTickets(root).records;
    expect(tickets.map((t) => t.status)).toEqual(["approved", "approved"]);
    expect(new Set(tickets.map((t) => t.contentHash)).size).toBe(2);
    expect(tickets.every((t) => isSignedApproval(KEY, t))).toBe(true);
    expect(checkApproval(root, KEY, one.id, "publish")).toMatchObject({ ok: true });
  });

  it("refuses a stale hash, and one bad ticket does not stop the others", () => {
    const root = makeWorkspace();
    const old = draft(root, "Before.");
    const fresh = draft(root, "Fresh.");
    const stale = requestApproval(
      root,
      { postId: old.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    const good = requestApproval(
      root,
      { postId: fresh.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    saveDraft(root, { id: old.id, brand: old.brand, channel: old.channel, text: "After." }, agent);
    const results = decideTickets(
      root,
      KEY,
      [
        { ticketId: stale.id, decision: "approve" },
        { ticketId: "apr_000000000000", decision: "approve" },
        { ticketId: good.id, decision: "approve" },
      ],
      "Owner",
    );
    expect(results).toEqual([
      { ticketId: stale.id, ok: false, reason: "content_changed" },
      { ticketId: "apr_000000000000", ok: false, reason: "no_ticket" },
      { ticketId: good.id, ok: true },
    ]);
  });

  it("writes a signed rejection, and an approved ticket cannot flip", () => {
    const root = makeWorkspace();
    const post = draft(root);
    const ticket = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    expect(approve(root, ticket.id, "reject")).toEqual({ ticketId: ticket.id, ok: true });
    expect(checkApproval(root, KEY, post.id, "publish")).toEqual({ ok: false, reason: "rejected" });
    expect(approve(root, ticket.id)).toEqual({
      ticketId: ticket.id,
      ok: false,
      reason: "already_decided",
    });
    const next = requestApproval(
      root,
      { postId: post.id, act: "publish", costEstimateUsd: 0 },
      agent,
    );
    approve(root, next.id);
    expect(approve(root, next.id, "reject")).toMatchObject({
      ok: false,
      reason: "already_decided",
    });
    expect(checkApproval(root, KEY, post.id, "publish")).toMatchObject({ ok: true });
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
