import * as NodeFS from "node:fs";
import * as NodeSqlite from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildStuckIssue,
  handleCommunity,
  parseStuck,
  type CommunityEnv,
  type D1Like,
} from "./community";
import type { KvLike } from "./relay";

/** The real schema on real SQLite (D1 is SQLite), behind the same prepare/bind surface as D1. */
function sqliteD1(): D1Like {
  const db = new NodeSqlite.DatabaseSync(":memory:");
  db.exec(NodeFS.readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  return {
    prepare: (sql) => ({
      bind: (...values) => {
        const params = values as never[];
        return {
          run: async () => db.prepare(sql).run(...params),
          all: async <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
          first: async <T>() => (db.prepare(sql).get(...params) as T | undefined) ?? null,
        };
      },
    }),
  };
}

function memoryKv(): KvLike {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => void store.set(key, value),
  };
}

const env = (): CommunityEnv => ({
  GITHUB_TOKEN: "t",
  GITHUB_REPO: "o/r",
  RATE: memoryKv(),
  DB: sqliteD1(),
  ADMIN_TOKEN: "admin-secret",
});

const REPORT_A = "a".repeat(32);
const REPORT_B = "b".repeat(32);
const BOARD_ONE = "1".repeat(32);
const BOARD_TWO = "2".repeat(32);
const BOARD_THREE = "3".repeat(32);

const stuck = (reportId: string, extra: Record<string, unknown> = {}) => ({
  reportId,
  appVersion: "1.0.0",
  platform: "win32",
  screen: "settings/models",
  lastAction: "open-settings",
  errorCode: "provider_unreachable",
  provider: "claudeAgent",
  source: "button",
  ...extra,
});

function call(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://relay.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let issueCounter = 0;
function stubGithub() {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ number: ++issueCounter }), { status: 201 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("parseStuck", () => {
  it("accepts plain state codes", () => {
    expect(parseStuck(stuck(REPORT_A))?.screen).toBe("settings/models");
  });

  it("rejects message, path and key shaped values", () => {
    expect(parseStuck(stuck(REPORT_A, { screen: "C:\\Users\\jake\\notes" }))).toBeNull();
    expect(parseStuck(stuck(REPORT_A, { lastAction: "fix my bug in /home/jake" }))).toBeNull();
    expect(parseStuck(stuck(REPORT_A, { errorCode: "sk-ant-abc 123" }))).toBeNull();
    expect(parseStuck(stuck(REPORT_A, { reportId: "not-an-id" }))).toBeNull();
  });

  it("drops fields it does not know", () => {
    const report = parseStuck(stuck(REPORT_A, { message: "hello", path: "/x", apiKey: "k" }));
    expect(Object.keys(report ?? {}).sort()).toEqual([
      "appVersion",
      "errorCode",
      "id",
      "lastAction",
      "platform",
      "provider",
      "screen",
      "source",
    ]);
    expect(JSON.stringify(buildStuckIssue(report!))).not.toMatch(/hello|apiKey/);
  });
});

describe("stuck reports and fixed-for-you", () => {
  it("files one issue per report, even when the app retries", async () => {
    const fetchMock = stubGithub();
    const e = env();
    const first = await handleCommunity(call("/stuck", "POST", stuck(REPORT_A)), e);
    const retry = await handleCommunity(call("/stuck", "POST", stuck(REPORT_A)), e);
    expect(first.status).toBe(200);
    expect(await retry.json()).toEqual(await first.json());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tells only the reporter that their report is fixed", async () => {
    stubGithub();
    const e = env();
    await handleCommunity(call("/stuck", "POST", stuck(REPORT_A)), e);
    await handleCommunity(call("/stuck", "POST", stuck(REPORT_B, { screen: "chat" })), e);
    // Issue 2 was opened for install A, issue 3 for install B in this file's counter.
    const issueA = issueCounter - 1;
    const fix = await handleCommunity(
      call(
        "/admin/fixed",
        "POST",
        { issue: issueA, version: "1.0.1" },
        { authorization: "Bearer admin-secret" },
      ),
      e,
    );
    expect(fix.status).toBe(200);
    const asReporter = await (await handleCommunity(call(`/fixed?ids=${REPORT_A}`), e)).json();
    const asOther = await (await handleCommunity(call(`/fixed?ids=${REPORT_B}`), e)).json();
    expect(asReporter).toEqual({ fixed: [{ id: REPORT_A, version: "1.0.1" }] });
    expect(asOther).toEqual({ fixed: [] });
  });

  it("closes the admin route without the right token", async () => {
    const e = env();
    const body = { issue: 1, version: "1.0.1" };
    expect((await handleCommunity(call("/admin/fixed", "POST", body), e)).status).toBe(401);
    const wrong = { authorization: "Bearer nope" };
    expect((await handleCommunity(call("/admin/fixed", "POST", body, wrong), e)).status).toBe(401);
  });
});

describe("friends leaderboard", () => {
  async function newBoard(e: CommunityEnv): Promise<string> {
    const created = (await (await handleCommunity(call("/board", "POST", {}), e)).json()) as {
      code: string;
    };
    return created.code;
  }

  // 10 words = 1 point, so `words` is also the point count times ten.
  const score = (code: string, boardId: string, points: number) => ({
    code,
    boardId,
    week: "2026-10-19",
    words: points * 10,
    messages: 0,
    activeDays: 0,
  });

  it("shows two opted-in installs on one invite board, anonymous by default", async () => {
    const e = env();
    const code = await newBoard(e);
    await handleCommunity(
      call("/board/join", "POST", { code, boardId: BOARD_ONE, nickname: "Shake" }),
      e,
    );
    await handleCommunity(call("/board/join", "POST", { code, boardId: BOARD_TWO }), e);
    await handleCommunity(call("/board/score", "POST", score(code, BOARD_ONE, 40)), e);
    await handleCommunity(call("/board/score", "POST", score(code, BOARD_TWO, 90)), e);

    const view = await (
      await handleCommunity(call(`/board/${code}?me=${BOARD_ONE}&week=2026-10-19`), e)
    ).json();
    expect(view).toMatchObject({
      rows: [
        { name: "Friend 2", isMe: false, points: 90 },
        { name: "Shake", isMe: true, points: 40 },
      ],
    });
    expect(JSON.stringify(view)).not.toContain(BOARD_TWO);
  });

  it("accepts nothing from an install that never joined", async () => {
    const e = env();
    const code = await newBoard(e);
    await handleCommunity(call("/board/join", "POST", { code, boardId: BOARD_ONE }), e);
    const outsider = await handleCommunity(
      call("/board/score", "POST", score(code, BOARD_THREE, 5)),
      e,
    );
    expect(outsider.status).toBe(403);
    expect((await handleCommunity(call(`/board/${code}?me=${BOARD_THREE}`), e)).status).toBe(403);
    expect((await handleCommunity(call(`/board/${code}`), e)).status).toBe(403);
  });

  it("rejects an unknown code, bad nicknames and a full board", async () => {
    const e = env();
    const join = (body: unknown) => handleCommunity(call("/board/join", "POST", body), e);
    expect((await join({ code: "ZZZZZZZZ", boardId: BOARD_ONE })).status).toBe(404);
    const code = await newBoard(e);
    expect((await join({ code, boardId: BOARD_ONE, nickname: "<script>" })).status).toBe(400);
    for (let index = 0; index < 20; index += 1) {
      const id = index.toString(16).padStart(32, "0");
      expect((await join({ code, boardId: id })).status).toBe(200);
    }
    expect((await join({ code, boardId: BOARD_THREE })).status).toBe(409);
  });

  it("removes a member's rows when they leave", async () => {
    const e = env();
    const code = await newBoard(e);
    await handleCommunity(call("/board/join", "POST", { code, boardId: BOARD_ONE }), e);
    await handleCommunity(call("/board/join", "POST", { code, boardId: BOARD_TWO }), e);
    await handleCommunity(call("/board/score", "POST", score(code, BOARD_ONE, 40)), e);
    await handleCommunity(call("/board/leave", "POST", { code, boardId: BOARD_ONE }), e);
    const view = (await (
      await handleCommunity(call(`/board/${code}?me=${BOARD_TWO}&week=2026-10-19`), e)
    ).json()) as { rows: unknown[] };
    expect(view.rows).toHaveLength(1);
  });
});
