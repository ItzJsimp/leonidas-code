/**
 * Community routes: "I'm stuck" reports, the fixed-for-you lookup and the friends leaderboard.
 * Every id is random and made on the device. A stuck report carries state only (screen, action
 * and error codes), never text, paths or keys: each field must match a strict pattern.
 */
import { github, overLimit, reply, type RelayEnv } from "./relay";

export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T>(): Promise<{ results: T[] }>;
      first<T>(): Promise<T | null>;
    };
  };
}

export interface CommunityEnv extends RelayEnv {
  readonly DB: D1Like;
  /** Secret for POST /admin/fixed. Without it the route is closed. */
  readonly ADMIN_TOKEN?: string;
}

const COMMUNITY_PATHS = /^\/(stuck|fixed|board|admin)(\/|$)/;
const MAX_MEMBERS = 20;
const MAX_FIXED_LOOKUP = 20;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_COUNT = 100_000_000;

const HEX32 = /^[0-9a-f]{32}$/;
const VERSION = /^[0-9A-Za-z.+-]{1,32}$/;
const TOKEN = /^[A-Za-z0-9._-]{1,40}$/;
const ERROR_CODE = /^[A-Za-z0-9._-]{1,40}$/;
const SCREEN = /^[a-z0-9/_-]{1,60}$/;
const CODE = /^[A-Z2-9]{8}$/;
const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const NICKNAME = /^[\p{L}\p{N} _.-]{1,20}$/u;

export function isCommunityPath(pathname: string): boolean {
  return COMMUNITY_PATHS.test(pathname);
}

function match(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function optional(value: unknown, pattern: RegExp): string | null | undefined {
  if (value === undefined || value === null) return null;
  return match(value, pattern) ?? undefined;
}

interface StuckReport {
  readonly id: string;
  readonly appVersion: string;
  readonly platform: string;
  readonly screen: string;
  readonly lastAction: string;
  readonly errorCode: string | null;
  readonly provider: string | null;
  readonly source: "button" | "voice";
}

/** Returns a clean report, or null when any field is not a plain code. Extra keys are dropped. */
export function parseStuck(raw: unknown): StuckReport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  const id = match(body.reportId, HEX32);
  const appVersion = match(body.appVersion, VERSION);
  const platform = match(body.platform, TOKEN);
  const screen = match(body.screen, SCREEN);
  const lastAction = match(body.lastAction, TOKEN);
  const errorCode = optional(body.errorCode, ERROR_CODE);
  const provider = optional(body.provider, TOKEN);
  const source = body.source === "voice" ? "voice" : body.source === "button" ? "button" : null;
  if (!id || !appVersion || !platform || !screen || !lastAction || !source) return null;
  if (errorCode === undefined || provider === undefined) return null;
  return { id, appVersion, platform, screen, lastAction, errorCode, provider, source };
}

export function buildStuckIssue(report: StuckReport) {
  const what = report.errorCode ?? report.lastAction;
  const rows = [
    ["screen", report.screen],
    ["last action", report.lastAction],
    ["error", report.errorCode ?? "none"],
    ["provider", report.provider ?? "none"],
    ["version", report.appVersion],
    ["platform", report.platform],
    ["trigger", report.source],
  ].map(([key, value]) => `| ${key} | ${value} |`);
  return {
    title: `[stuck] ${report.screen}: ${what}`,
    body: [
      "A user pressed I'm stuck. This report holds app state only, never their text.",
      "",
      "| State | |",
      "| --- | --- |",
      ...rows,
      "",
      `<!-- stuck-report:${report.id} -->`,
    ].join("\n"),
    labels: ["stuck", "needs-triage"],
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text.length > 20_000 ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT
    ? value
    : null;
}

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function currentWeek(now: number): string {
  const day = new Date(now);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(now - sinceMonday * 86_400_000).toISOString().slice(0, 10);
}

async function postStuck(request: Request, env: CommunityEnv, ip: string): Promise<Response> {
  const report = parseStuck(await readJson(request));
  if (!report) return reply(400, { ok: false });
  if (await overLimit(env.RATE, `stuck:${ip}`, 20, 3_600)) return reply(429, { ok: false });

  await env.DB.prepare(
    "INSERT OR IGNORE INTO stuck_reports (id, created_at, app_version, platform, screen, last_action, error_code, provider, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      report.id,
      Date.now(),
      report.appVersion,
      report.platform,
      report.screen,
      report.lastAction,
      report.errorCode,
      report.provider,
      report.source,
    )
    .run();
  const row = await env.DB.prepare("SELECT issue_number FROM stuck_reports WHERE id = ?")
    .bind(report.id)
    .first<{ issue_number: number | null }>();
  // A retry of the same report must not open a second issue.
  if (row?.issue_number) return reply(200, { ok: true, issue: row.issue_number });

  const issue = await github(env, "/issues", {
    method: "POST",
    body: JSON.stringify(buildStuckIssue(report)),
  });
  if (!issue.ok) {
    console.error("github stuck issue failed", issue.status, (await issue.text()).slice(0, 300));
    return reply(502, { ok: false });
  }
  const created = (await issue.json()) as { number?: number };
  if (created.number) {
    await env.DB.prepare("UPDATE stuck_reports SET issue_number = ? WHERE id = ?")
      .bind(created.number, report.id)
      .run();
  }
  return reply(200, { ok: true, issue: created.number ?? null });
}

/** The caller names its own report ids, so it only ever learns about reports it can name. */
async function getFixed(url: URL, env: CommunityEnv): Promise<Response> {
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => HEX32.test(id))
    .slice(0, MAX_FIXED_LOOKUP);
  if (ids.length === 0) return reply(200, { fixed: [] });
  const marks = ids.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT id, fixed_in FROM stuck_reports WHERE fixed_in IS NOT NULL AND id IN (${marks})`,
  )
    .bind(...ids)
    .all<{ id: string; fixed_in: string }>();
  return reply(200, { fixed: results.map((row) => ({ id: row.id, version: row.fixed_in })) });
}

async function postAdminFixed(request: Request, env: CommunityEnv): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return reply(401, { ok: false });
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const issue = count(body?.issue);
  const version = match(body?.version, VERSION);
  if (!issue || !version) return reply(400, { ok: false });
  await env.DB.prepare(
    "UPDATE stuck_reports SET fixed_in = ?, fixed_at = ? WHERE issue_number = ? AND fixed_in IS NULL",
  )
    .bind(version, Date.now(), issue)
    .run();
  return reply(200, { ok: true });
}

async function memberCount(env: CommunityEnv, code: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE code = ?")
    .bind(code)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

async function isMember(env: CommunityEnv, code: string, boardId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 AS ok FROM members WHERE code = ? AND board_id = ?")
    .bind(code, boardId)
    .first<{ ok: number }>();
  return row !== null;
}

async function boardCreate(env: CommunityEnv, ip: string): Promise<Response> {
  if (await overLimit(env.RATE, `board:${ip}`, 5, 86_400)) return reply(429, { ok: false });
  const code = newCode();
  await env.DB.prepare("INSERT INTO boards (code, created_at) VALUES (?, ?)")
    .bind(code, Date.now())
    .run();
  return reply(200, { ok: true, code });
}

async function boardJoin(request: Request, env: CommunityEnv): Promise<Response> {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const code = match(body?.code, CODE);
  const boardId = match(body?.boardId, HEX32);
  const nickname = optional(body?.nickname, NICKNAME);
  if (!code || !boardId || nickname === undefined) return reply(400, { ok: false });
  const board = await env.DB.prepare("SELECT code FROM boards WHERE code = ?")
    .bind(code)
    .first<{ code: string }>();
  if (!board) return reply(404, { ok: false });
  const already = await isMember(env, code, boardId);
  if (!already && (await memberCount(env, code)) >= MAX_MEMBERS) return reply(409, { ok: false });
  // A repeat join only changes the nickname, so a member can go public or back to anonymous.
  await env.DB.prepare(
    "INSERT INTO members (code, board_id, nickname, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT (code, board_id) DO UPDATE SET nickname = excluded.nickname",
  )
    .bind(code, boardId, nickname, Date.now())
    .run();
  return reply(200, { ok: true });
}

async function boardScore(request: Request, env: CommunityEnv): Promise<Response> {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const code = match(body?.code, CODE);
  const boardId = match(body?.boardId, HEX32);
  const week = match(body?.week, WEEK);
  const xp = count(body?.xp);
  const tokens = count(body?.tokens);
  const skills = count(body?.skills);
  const tasks = count(body?.tasks);
  if (!code || !boardId || !week || xp === null || tokens === null)
    return reply(400, { ok: false });
  if (skills === null || tasks === null) return reply(400, { ok: false });
  // Only a member who joined (so consented on the device) can post a score.
  if (!(await isMember(env, code, boardId))) return reply(403, { ok: false });
  await env.DB.prepare(
    "INSERT INTO scores (code, board_id, week, xp, tokens, skills, tasks, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (code, board_id, week) DO UPDATE SET xp = excluded.xp, tokens = excluded.tokens, skills = excluded.skills, tasks = excluded.tasks, updated_at = excluded.updated_at",
  )
    .bind(code, boardId, week, xp, tokens, skills, tasks, Date.now())
    .run();
  return reply(200, { ok: true });
}

interface BoardRow {
  readonly name: string;
  readonly isMe: boolean;
  readonly xp: number;
  readonly tokens: number;
  readonly skills: number;
  readonly tasks: number;
}

async function boardGet(url: URL, env: CommunityEnv, code: string): Promise<Response> {
  const me = match(url.searchParams.get("me"), HEX32);
  const week = match(url.searchParams.get("week"), WEEK) ?? currentWeek(Date.now());
  const { results: members } = await env.DB.prepare(
    "SELECT board_id, nickname FROM members WHERE code = ? ORDER BY joined_at, rowid",
  )
    .bind(code)
    .all<{ board_id: string; nickname: string | null }>();
  if (members.length === 0) return reply(404, { ok: false });
  // Only a member can read the board: it shows the other members' counts.
  if (!me || !members.some((member) => member.board_id === me)) return reply(403, { ok: false });
  const { results: scores } = await env.DB.prepare(
    "SELECT board_id, xp, tokens, skills, tasks FROM scores WHERE code = ? AND week = ?",
  )
    .bind(code, week)
    .all<{ board_id: string; xp: number; tokens: number; skills: number; tasks: number }>();
  const byId = new Map(scores.map((score) => [score.board_id, score]));
  const rows: BoardRow[] = members.map((member, index) => {
    const score = byId.get(member.board_id);
    return {
      name: member.nickname ?? `Friend ${index + 1}`,
      isMe: member.board_id === me,
      xp: score?.xp ?? 0,
      tokens: score?.tokens ?? 0,
      skills: score?.skills ?? 0,
      tasks: score?.tasks ?? 0,
    };
  });
  rows.sort((a, b) => b.xp - a.xp);
  return reply(200, { ok: true, week, rows });
}

async function boardLeave(request: Request, env: CommunityEnv): Promise<Response> {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const code = match(body?.code, CODE);
  const boardId = match(body?.boardId, HEX32);
  if (!code || !boardId) return reply(400, { ok: false });
  await env.DB.prepare("DELETE FROM scores WHERE code = ? AND board_id = ?")
    .bind(code, boardId)
    .run();
  await env.DB.prepare("DELETE FROM members WHERE code = ? AND board_id = ?")
    .bind(code, boardId)
    .run();
  return reply(200, { ok: true });
}

export async function handleCommunity(request: Request, env: CommunityEnv): Promise<Response> {
  if (request.method === "OPTIONS") return reply(204);
  const url = new URL(request.url);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const route = `${request.method} ${url.pathname}`;
  if (route === "POST /stuck") return postStuck(request, env, ip);
  if (route === "GET /fixed") return getFixed(url, env);
  if (route === "POST /admin/fixed") return postAdminFixed(request, env);
  if (route === "POST /board") return boardCreate(env, ip);
  if (route === "POST /board/join") return boardJoin(request, env);
  if (route === "POST /board/score") return boardScore(request, env);
  if (route === "POST /board/leave") return boardLeave(request, env);
  const board = /^\/board\/([A-Z2-9]{8})$/.exec(url.pathname);
  if (request.method === "GET" && board?.[1]) return boardGet(url, env, board[1]);
  return reply(404);
}
