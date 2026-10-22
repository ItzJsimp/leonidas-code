// @effect-diagnostics nodeBuiltinImport:off - marketing is plain files that scripts and Git also read.
// @effect-diagnostics globalDate:off - records are stamped with the caller's wall-clock time.
import {
  completeFeedEvent,
  MarketingApprovalTicket,
  type MarketingActor,
  type MarketingBadRecord,
  MarketingBrand,
  type MarketingChannel,
  MarketingConnections,
  MarketingMetricSnapshot,
  MarketingPost,
  type MarketingPublicAct,
} from "@t3tools/contracts";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { parse as parseYaml } from "yaml";

import { appendFeedEvent } from "../events/feedFile.ts";

/** Layout from ADR-0091. Every path stays inside `<root>/marketing`. */
export const MARKETING_DIR = "marketing";

export class MarketingError extends Error {
  override readonly name = "MarketingError";
}

export interface Read<A> {
  readonly records: ReadonlyArray<A>;
  readonly bad: ReadonlyArray<MarketingBadRecord>;
}

const dir = (root: string, ...parts: Array<string>) => NodePath.join(root, MARKETING_DIR, ...parts);
const rel = (root: string, file: string) => NodePath.relative(root, file).replaceAll("\\", "/");
const hex = (bytes: number) => NodeCrypto.randomBytes(bytes).toString("hex");
const nowIso = () => new Date().toISOString();

function decodeWith<A>(schema: Schema.Codec<A, unknown>) {
  const decode = Schema.decodeUnknownExit(schema);
  return (value: unknown): { ok: true; value: A } | { ok: false; reason: string } => {
    const exit = decode(value);
    return Exit.isSuccess(exit)
      ? { ok: true, value: exit.value }
      : { ok: false, reason: "does not match the schema" };
  };
}

const decodePost = decodeWith(MarketingPost);
const decodeTicket = decodeWith(MarketingApprovalTicket);
const decodeSnapshot = decodeWith(MarketingMetricSnapshot);
const decodeBrand = decodeWith(MarketingBrand);
const decodeConnections = decodeWith(MarketingConnections);

/**
 * Reads every `*.jsonl` in one folder. A bad line is reported and skipped, never fatal.
 * shortcut: sync full reads of every month, fine at about 50 posts a day; read only recent months when a folder passes about 10 MB.
 */
function readFolder<A>(
  root: string,
  folder: string,
  decode: (value: unknown) => { ok: true; value: A } | { ok: false; reason: string },
): Read<A> {
  const base = dir(root, folder);
  if (!NodeFS.existsSync(base)) return { records: [], bad: [] };
  const records: Array<A> = [];
  const bad: Array<MarketingBadRecord> = [];
  for (const name of NodeFS.readdirSync(base)
    .filter((n) => n.endsWith(".jsonl"))
    .toSorted()) {
    const file = NodePath.join(base, name);
    NodeFS.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (line.trim() === "") return;
        let value: unknown;
        try {
          value = JSON.parse(line);
        } catch {
          bad.push({ file: rel(root, file), line: index + 1, reason: "not valid JSON" });
          return;
        }
        const result = decode(value);
        if (result.ok) records.push(result.value);
        else bad.push({ file: rel(root, file), line: index + 1, reason: result.reason });
      });
  }
  return { records, bad };
}

/** Last line for each id wins, in file order. */
function foldById<A extends { readonly id: string }>(read: Read<A>): Read<A> {
  const latest = new Map<string, A>();
  for (const record of read.records) latest.set(record.id, record);
  return { records: [...latest.values()], bad: read.bad };
}

function appendLine(root: string, folder: string, month: string, value: unknown): void {
  const file = dir(root, folder, `${month}.jsonl`);
  NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
  NodeFS.appendFileSync(file, `${JSON.stringify(value)}\n`);
}

const postMonth = (postId: string) => postId.slice(5, 12);

export const readPosts = (root: string) => foldById(readFolder(root, "posts", decodePost));
export const readTickets = (root: string) => foldById(readFolder(root, "approvals", decodeTicket));
export const readMetrics = (root: string) => readFolder(root, "metrics", decodeSnapshot);

/** Brand profiles: `brands/<slug>.md` with YAML frontmatter, the body is the profile. */
export function readBrands(root: string): Read<MarketingBrand> {
  const base = dir(root, "brands");
  if (!NodeFS.existsSync(base)) return { records: [], bad: [] };
  const records: Array<MarketingBrand> = [];
  const bad: Array<MarketingBadRecord> = [];
  for (const name of NodeFS.readdirSync(base)
    .filter((n) => n.endsWith(".md"))
    .toSorted()) {
    const file = NodePath.join(base, name);
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(
      NodeFS.readFileSync(file, "utf8"),
    );
    let front: Record<string, unknown> | null = null;
    try {
      front = match ? (parseYaml(match[1]!) as Record<string, unknown>) : null;
    } catch {
      front = null;
    }
    const result = front
      ? decodeBrand({
          slug: front.slug,
          name: front.name,
          spendCapUsd: front.spend_cap_usd ?? 0,
          channels: front.channels ?? [],
          profile: match![2]!.trim(),
        })
      : ({ ok: false, reason: "no frontmatter" } as const);
    if (result.ok && result.value.slug === name.slice(0, -3)) records.push(result.value);
    else
      bad.push({
        file: rel(root, file),
        reason: result.ok ? "slug does not match the file name" : result.reason,
      });
  }
  return { records, bad };
}

export function readConnections(root: string): MarketingConnections | MarketingBadRecord {
  const file = dir(root, "connections.json");
  if (!NodeFS.existsSync(file)) return { v: 1 };
  try {
    const result = decodeConnections(JSON.parse(NodeFS.readFileSync(file, "utf8")));
    return result.ok ? result.value : { file: rel(root, file), reason: result.reason };
  } catch {
    return { file: rel(root, file), reason: "not valid JSON" };
  }
}

/** The exact content a ticket approves. Any change here voids the ticket. */
export function contentHash(post: MarketingPost): string {
  return NodeCrypto.createHash("sha256")
    .update(JSON.stringify([post.brand, post.channel, post.text, post.scheduledFor ?? null]))
    .digest("hex");
}

export interface DraftInput {
  readonly id?: string | undefined;
  readonly brand: string;
  readonly channel: MarketingChannel;
  readonly text: string;
  readonly scheduledFor?: string | undefined;
}

/** Creates a draft, or appends a new version of one. A posted item is never edited. */
export function saveDraft(root: string, input: DraftInput, author: MarketingActor): MarketingPost {
  if (!readBrands(root).records.some((brand) => brand.slug === input.brand)) {
    throw new MarketingError(
      `No brand profile marketing/brands/${input.brand}.md. Read the brands first.`,
    );
  }
  const now = nowIso();
  const existing = input.id ? readPosts(root).records.find((post) => post.id === input.id) : null;
  if (input.id && !existing) throw new MarketingError(`No post with id ${input.id}.`);
  if (existing?.status === "posted") throw new MarketingError("A posted item cannot be edited.");
  const candidate = {
    v: 1 as const,
    id: existing?.id ?? `post_${now.slice(0, 7)}_${hex(6)}`,
    brand: input.brand,
    channel: input.channel,
    text: input.text,
    status: "draft" as const,
    ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    author,
  };
  const decoded = decodePost(candidate);
  if (!decoded.ok) throw new MarketingError(`The draft is not valid: ${decoded.reason}.`);
  appendLine(root, "posts", postMonth(decoded.value.id), decoded.value);
  return decoded.value;
}

/** Opens a pending ticket for one public act on one post. Agents may ask; they never decide. */
export function requestApproval(
  root: string,
  input: {
    readonly postId: string;
    readonly act: MarketingPublicAct;
    readonly costEstimateUsd: number;
  },
  requestedBy: MarketingActor,
): MarketingApprovalTicket {
  const post = readPosts(root).records.find((candidate) => candidate.id === input.postId);
  if (!post) throw new MarketingError(`No post with id ${input.postId}.`);
  if (post.status !== "draft") throw new MarketingError("Only a draft can ask for approval.");
  const ticket = decodeTicket({
    v: 1,
    id: `apr_${hex(6)}`,
    postId: post.id,
    act: input.act,
    contentHash: contentHash(post),
    costEstimateUsd: input.costEstimateUsd,
    status: "pending",
    requestedAt: nowIso(),
    requestedBy,
  });
  if (!ticket.ok) throw new MarketingError(`The ticket is not valid: ${ticket.reason}.`);
  appendLine(root, "approvals", postMonth(post.id), ticket.value);
  appendFeedEvent(
    root,
    completeFeedEvent({
      level: "needs_you",
      type: "marketing.approval_requested",
      title: `Approve: ${post.brand} ${post.channel} ${input.act}`.slice(0, 80),
      body: `${post.text.slice(0, 400)} (cost about $${input.costEstimateUsd})`,
      actor: { kind: requestedBy.kind, name: requestedBy.name },
      dedupe: `marketing.approval_requested:${ticket.value.id}`,
    }),
  );
  return ticket.value;
}

export type ApprovalCheck =
  | { readonly ok: true; readonly ticket: MarketingApprovalTicket }
  | {
      readonly ok: false;
      readonly reason: "no_post" | "no_ticket" | "pending" | "rejected" | "content_changed";
    };

/**
 * The gate every publish, send and spend path must pass first: an approved ticket for this act
 * whose hash matches the post as it is now.
 */
export function checkApproval(
  root: string,
  postId: string,
  act: MarketingPublicAct,
): ApprovalCheck {
  const post = readPosts(root).records.find((candidate) => candidate.id === postId);
  if (!post) return { ok: false, reason: "no_post" };
  return approvalOf(post, act, readTickets(root).records);
}

/** The same check on records already loaded, so a list reads the files once. */
export function approvalOf(
  post: MarketingPost,
  act: MarketingPublicAct,
  allTickets: ReadonlyArray<MarketingApprovalTicket>,
): ApprovalCheck {
  const tickets = allTickets.filter((ticket) => ticket.postId === post.id && ticket.act === act);
  if (tickets.length === 0) return { ok: false, reason: "no_ticket" };
  const hash = contentHash(post);
  const approved = tickets.filter(
    (ticket) => ticket.status === "approved" && ticket.decidedBy?.kind === "member",
  );
  const match = approved.find((ticket) => ticket.contentHash === hash);
  if (match) return { ok: true, ticket: match };
  if (tickets.some((ticket) => ticket.status === "pending"))
    return { ok: false, reason: "pending" };
  return { ok: false, reason: approved.length > 0 ? "content_changed" : "rejected" };
}

/** Appends snapshots not already saved (same channel, post and time). Returns how many were new. */
export function appendMetrics(
  root: string,
  snapshots: ReadonlyArray<MarketingMetricSnapshot>,
): number {
  const key = (s: MarketingMetricSnapshot) => `${s.channel}|${s.externalId}|${s.at}`;
  const seen = new Set(readMetrics(root).records.map(key));
  let added = 0;
  for (const snapshot of snapshots) {
    if (seen.has(key(snapshot))) continue;
    seen.add(key(snapshot));
    appendLine(root, "metrics", snapshot.at.slice(0, 7), snapshot);
    added += 1;
  }
  return added;
}

/** Resolves a workspace-relative folder and refuses one that leaves the workspace. */
export function insideRoot(root: string, relative: string): string | null {
  const full = NodePath.resolve(root, relative);
  const back = NodePath.relative(NodePath.resolve(root), full);
  return back.startsWith("..") || NodePath.isAbsolute(back) ? null : full;
}
