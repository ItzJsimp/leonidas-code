// @effect-diagnostics nodeBuiltinImport:off - content is plain files that people, scripts and Git also read.
import {
  CONTENT_STAGES,
  type ContentApproval,
  type ContentBadRecord,
  ContentDeal,
  type ContentScorecard,
  type ContentStage,
  ContentVideo,
} from "@t3tools/contracts";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { parse as parseYaml } from "yaml";

/** Each contracted deal is `deals/<slug>/deal.md`. A `_` folder (like `_lens`) is never a deal. */
export const DEALS_DIR = "deals";
/** Lens files that are not deals: the voice bible, settings and proposed deals. */
export const LENS_DIR = "_lens";

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const VIDEO_FILE = /^(\d{2}-[a-z0-9][a-z0-9-]{0,62})\.md$/;
/** A file over this size is reported, not read, so one huge file cannot stall the server. */
const MAX_FILE_BYTES = 1_000_000;
/** shortcut: a fixed speaking rate of 150 words a minute; measure Gersi's real rate when the learning job has data. */
const WORDS_PER_SECOND = 2.5;
const LOW_HOOK_SCORE = 7;
/** Spoken length further than this share from the target warns. */
const LENGTH_TOLERANCE = 0.2;

export class ContentError extends Error {
  override readonly name = "ContentError";
}

export interface Read<A> {
  readonly records: ReadonlyArray<A>;
  readonly bad: ReadonlyArray<ContentBadRecord>;
}

export const dealDir = (root: string, slug: string) => NodePath.join(root, DEALS_DIR, slug);
export const videoPath = (root: string, deal: string, file: string) =>
  NodePath.join(dealDir(root, deal), `${file}.md`);
const rel = (root: string, file: string) => NodePath.relative(root, file).replaceAll("\\", "/");

function readCapped(file: string): string | null {
  return NodeFS.statSync(file).size > MAX_FILE_BYTES ? null : NodeFS.readFileSync(file, "utf8");
}

function decodeWith<A>(schema: Schema.Codec<A, unknown>) {
  const decode = Schema.decodeUnknownExit(schema);
  return (value: unknown): A | null => {
    const exit = decode(value);
    return Exit.isSuccess(exit) ? exit.value : null;
  };
}
const decodeVideo = decodeWith(ContentVideo);
const decodeDeal = decodeWith(ContentDeal);

export interface Parsed {
  readonly front: Record<string, unknown>;
  readonly body: string;
}

/** YAML frontmatter and the body, line endings made LF. Null when there is no valid frontmatter. */
export function parseFile(text: string): Parsed | null {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replaceAll("\r\n", "\n"));
  if (!match) return null;
  try {
    const front = parseYaml(match[1]!) as unknown;
    return front !== null && typeof front === "object" && !Array.isArray(front)
      ? { front: front as Record<string, unknown>, body: match[2]! }
      : null;
  } catch {
    return null;
  }
}

/** The text under each `## ` heading, keyed by the lower-case heading. */
export function sections(body: string): Map<string, string> {
  const found = new Map<string, string>();
  const parts = body.split(/^## +/m).slice(1);
  for (const part of parts) {
    const newline = part.indexOf("\n");
    const heading = (newline < 0 ? part : part.slice(0, newline)).trim().toLowerCase();
    found.set(heading, newline < 0 ? "" : part.slice(newline + 1).trim());
  }
  return found;
}

const str = (value: unknown) =>
  typeof value === "string" && value.trim() !== ""
    ? value
    : typeof value === "number"
      ? String(value)
      : undefined;
const num = (value: unknown) => (typeof value === "number" ? value : undefined);
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const optional = <K extends string, V>(key: K, value: V | undefined) =>
  value === undefined ? {} : ({ [key]: value } as Record<K, V>);

/** The script text that an approval covers. Line endings and outer space do not count. */
export function scriptHash(script: string): string {
  return NodeCrypto.createHash("sha256")
    .update(script.replaceAll("\r\n", "\n").trim())
    .digest("hex");
}

export interface ApprovalFields {
  readonly deal: string;
  readonly file: string;
  readonly scriptHash: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export function signApproval(key: Uint8Array, fields: ApprovalFields): string {
  return NodeCrypto.createHmac("sha256", key)
    .update(
      [fields.deal, fields.file, fields.scriptHash, fields.approvedBy, fields.approvedAt].join("|"),
    )
    .digest("hex");
}

function approvalOf(
  key: Uint8Array,
  deal: string,
  file: string,
  front: Record<string, unknown>,
  script: string,
): ContentApproval {
  const approvedBy = str(front.approved_by);
  const approvedAt = str(front.approved_at);
  const signedHash = str(front.script_hash);
  const sig = str(front.approval_sig);
  if (!approvedBy) return "none";
  if (!approvedAt || !signedHash || !sig || !/^[0-9a-f]{64}$/.test(sig)) return "unsigned";
  const expected = Buffer.from(
    signApproval(key, { deal, file, scriptHash: signedHash, approvedBy, approvedAt }),
    "hex",
  );
  if (!NodeCrypto.timingSafeEqual(Buffer.from(sig, "hex"), expected)) return "unsigned";
  return signedHash === scriptHash(script) ? "approved" : "content_changed";
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** True when `phrase` is in `text` as whole words, any case. */
const says = (text: string, phrase: string) =>
  phrase.trim() !== "" &&
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase.trim())}(?![\\p{L}\\p{N}])`, "iu").test(text);

export function spokenSeconds(script: string): number {
  const words = script
    .split("\n")
    .map((line) => /^\s*(?:[-*]\s*)?SPOKEN:\s*(.*)$/i.exec(line)?.[1] ?? "")
    .join(" ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return Math.round(words / WORDS_PER_SECOND);
}

export interface Rules {
  readonly bannedWords: ReadonlyArray<string>;
  readonly doNot: ReadonlyArray<string>;
}

/** The server counts length and rule hits itself; an agent cannot report a clean card it did not earn. */
export function scorecard(
  script: string,
  rules: Rules,
  given: { hookScore?: number; targetSeconds?: number; writerModel?: string; criticModel?: string },
): ContentScorecard {
  const seconds = spokenSeconds(script);
  const bannedWords = rules.bannedWords.filter((word) => says(script, word));
  const doNotHits = rules.doNot.filter((phrase) => says(script, phrase));
  const warnings: Array<string> = [];
  if (given.hookScore !== undefined && given.hookScore < LOW_HOOK_SCORE)
    warnings.push(`Hook score ${given.hookScore} is under ${LOW_HOOK_SCORE}.`);
  if (
    given.targetSeconds !== undefined &&
    given.targetSeconds > 0 &&
    Math.abs(seconds - given.targetSeconds) > given.targetSeconds * LENGTH_TOLERANCE
  )
    warnings.push(`Spoken length ${seconds} s is far from the ${given.targetSeconds} s target.`);
  return {
    ...optional("hookScore", given.hookScore),
    spokenSeconds: seconds,
    ...optional("targetSeconds", given.targetSeconds),
    bannedWords,
    doNotHits,
    ...optional("writerModel", given.writerModel),
    ...optional("criticModel", given.criticModel),
    blocks: [
      ...bannedWords.map((word) => `Banned word: "${word}"`),
      ...doNotHits.map((phrase) => `Brand do-not: "${phrase}"`),
    ],
    warnings,
  };
}

/** The voice bible text and its banned words. Empty when the file is missing. */
export function readVoiceBible(root: string): {
  readonly text: string;
  readonly bannedWords: ReadonlyArray<string>;
} {
  const file = NodePath.join(root, DEALS_DIR, LENS_DIR, "voice-bible.md");
  if (!NodeFS.existsSync(file)) return { text: "", bannedWords: [] };
  const text = readCapped(file) ?? "";
  return { text, bannedWords: strings(parseFile(text)?.front.banned_words) };
}

const REVIEW = CONTENT_STAGES.indexOf("script_review");

function readVideo(
  root: string,
  key: Uint8Array,
  deal: string,
  file: string,
  rules: Rules,
): ContentVideo | ContentBadRecord {
  const path = videoPath(root, deal, file);
  const text = readCapped(path);
  const bad = (reason: string): ContentBadRecord => ({ file: rel(root, path), reason });
  if (text === null) return bad("the file is over 1 MB");
  const parsed = parseFile(text);
  if (!parsed) return bad("no frontmatter");
  const { front } = parsed;
  const parts = sections(parsed.body);
  const script = parts.get("script") ?? "";
  const fileStage = front.stage as ContentStage;
  const approval = approvalOf(key, deal, file, front, script);
  // Past review needs a signed approval of this exact script. Without it the video waits in review.
  const stage =
    CONTENT_STAGES.indexOf(fileStage) > REVIEW && approval !== "approved"
      ? "script_review"
      : fileStage;
  const lengthS = num(front.length_s);
  const video = decodeVideo({
    deal,
    file,
    id: str(front.id) ?? `${deal}/${file}`,
    title: str(front.title) ?? file,
    stage,
    ...optional("stageChanged", str(front.stage_changed)),
    ...optional("pen", str(front.pen)),
    approval,
    ...optional("approvedBy", approval === "approved" ? str(front.approved_by) : undefined),
    ...optional("approvedAt", approval === "approved" ? str(front.approved_at) : undefined),
    revision: num(front.revision) ?? 0,
    ...optional("hookType", str(front.hook_type)),
    ...optional("lengthS", lengthS),
    ...optional("due", str(front.due)),
    footage: strings(front.footage),
    idea: parts.get("idea") ?? "",
    script,
    shotList: parts.get("shot list") ?? "",
    notes: parts.get("notes") ?? "",
    scorecard: scorecard(script, rules, {
      ...optional("hookScore", num(front.hook_score)),
      ...optional("targetSeconds", lengthS),
      ...optional("writerModel", str(front.writer_model)),
      ...optional("criticModel", str(front.critic_model)),
    }),
  });
  return video ?? bad("does not match the video schema");
}

function readDealIn(
  root: string,
  key: Uint8Array,
  slug: string,
  bannedWords: ReadonlyArray<string>,
): { deal: ContentDeal | null; bad: Array<ContentBadRecord> } {
  const card = NodePath.join(dealDir(root, slug), "deal.md");
  const text = readCapped(card);
  const parsed = text === null ? null : parseFile(text);
  if (!parsed) {
    return { deal: null, bad: [{ file: rel(root, card), reason: "no frontmatter" }] };
  }
  const doNot = strings(parsed.front.do_not);
  const bad: Array<ContentBadRecord> = [];
  const videos: Array<ContentVideo> = [];
  for (const name of NodeFS.readdirSync(dealDir(root, slug)).toSorted()) {
    const file = VIDEO_FILE.exec(name)?.[1];
    if (!file) continue;
    const read = readVideo(root, key, slug, file, { bannedWords, doNot });
    if ("reason" in read) bad.push(read);
    else videos.push(read);
  }
  const deal = decodeDeal({
    slug,
    brand: str(parsed.front.brand) ?? str(parsed.front.title) ?? slug,
    ...optional("stage", str(parsed.front.stage)),
    ...optional("driveFolderId", str(parsed.front.drive_folder_id)),
    ...optional("productReceived", str(parsed.front.product_received)),
    ...optional("brief", str(parsed.front.brief)),
    doNot,
    videos,
  });
  if (!deal) bad.push({ file: rel(root, card), reason: "does not match the deal schema" });
  return { deal, bad };
}

const isDealFolder = (root: string, slug: string) =>
  SLUG.test(slug) && NodeFS.existsSync(NodePath.join(dealDir(root, slug), "deal.md"));

/**
 * Every folder deal and its videos. Flat `deals/<slug>.md` prospects never show.
 * shortcut: sync full reads of every deal, fine at tens of deals; cache by file mtime past about 200 videos.
 */
export function listDeals(root: string, key: Uint8Array): Read<ContentDeal> {
  const base = NodePath.join(root, DEALS_DIR);
  if (!NodeFS.existsSync(base)) return { records: [], bad: [] };
  const { bannedWords } = readVoiceBible(root);
  const records: Array<ContentDeal> = [];
  const bad: Array<ContentBadRecord> = [];
  for (const entry of NodeFS.readdirSync(base, { withFileTypes: true }).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!entry.isDirectory() || !isDealFolder(root, entry.name)) continue;
    const read = readDealIn(root, key, entry.name, bannedWords);
    if (read.deal) records.push(read.deal);
    bad.push(...read.bad);
  }
  return { records, bad };
}

/** One deal by slug, or null. The slug check keeps every path inside `deals/`. */
export function readDeal(root: string, key: Uint8Array, slug: string): ContentDeal | null {
  if (!isDealFolder(root, slug)) return null;
  return readDealIn(root, key, slug, readVoiceBible(root).bannedWords).deal;
}
