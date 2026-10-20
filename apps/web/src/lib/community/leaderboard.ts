import { COMMUNITY_URL } from "../../components/feedback/feedbackRelay";
import { useUsageAnalyticsStore } from "../usageAnalytics/usageAnalyticsStore";

/** Monday of the week in UTC, as `YYYY-MM-DD`. The Worker groups scores by this key. */
export function weekStart(now: number): string {
  const sinceMonday = (new Date(now).getUTCDay() + 6) % 7;
  return new Date(now - sinceMonday * 86_400_000).toISOString().slice(0, 10);
}

export interface WeeklyStats {
  readonly words: number;
  readonly messages: number;
  readonly activeDays: number;
}

/** Counts only: words dictated, messages sent and days with a dictation this week. */
export function weeklyStats(
  dictations: ReadonlyArray<{ readonly at: string; readonly words: number }>,
  messages: number,
  now: number,
): WeeklyStats {
  const week = weekStart(now);
  const days = new Set<string>();
  let words = 0;
  for (const item of dictations) {
    const day = item.at.slice(0, 10);
    if (day < week) continue;
    days.add(day);
    words += Math.max(0, Math.round(item.words));
  }
  return { words, messages, activeDays: Math.min(days.size, 7) };
}

export interface BoardRow {
  readonly name: string;
  readonly isMe: boolean;
  readonly points: number;
  readonly words: number;
  readonly messages: number;
  readonly activeDays: number;
  readonly tokens: number | null;
}

export type BoardResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

/**
 * The only place the leaderboard talks to the network. Without the leaderboard consent it returns
 * before any request is made.
 */
async function call<T>(path: string, init?: RequestInit): Promise<BoardResult<T>> {
  if (!COMMUNITY_URL) return { ok: false };
  if (useUsageAnalyticsStore.getState().leaderboardConsent !== "granted") return { ok: false };
  try {
    const response = await fetch(`${COMMUNITY_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json" },
    });
    return response.ok ? { ok: true, value: (await response.json()) as T } : { ok: false };
  } catch {
    return { ok: false };
  }
}

const post = (path: string, body: unknown) =>
  call<{ ok: boolean; code?: string }>(path, { method: "POST", body: JSON.stringify(body) });

/** What a friend sees: the nickname only when the member chose to be public. */
function profile() {
  const state = useUsageAnalyticsStore.getState();
  return {
    boardId: state.boardId,
    nickname: state.boardPublic && state.boardNickname ? state.boardNickname : undefined,
  };
}

export async function createBoard(): Promise<string | null> {
  const made = await post("/board", {});
  const code = made.ok ? made.value.code : undefined;
  return code && (await joinBoard(code)) ? code : null;
}

export async function joinBoard(code: string): Promise<boolean> {
  const joined = await post("/board/join", { code: code.trim().toUpperCase(), ...profile() });
  if (joined.ok) useUsageAnalyticsStore.getState().addBoard(code.trim().toUpperCase());
  return joined.ok;
}

export async function pushScore(code: string, stats: WeeklyStats, now: number): Promise<boolean> {
  const { boardId } = profile();
  return (await post("/board/score", { code, boardId, week: weekStart(now), ...stats })).ok;
}

export async function fetchBoard(code: string, now: number): Promise<BoardRow[] | null> {
  const { boardId } = profile();
  const view = await call<{ rows: BoardRow[] }>(
    `/board/${code}?me=${boardId}&week=${weekStart(now)}`,
  );
  return view.ok ? view.value.rows : null;
}

export async function leaveBoard(code: string): Promise<void> {
  const { boardId } = profile();
  const left = await post("/board/leave", { code, boardId });
  if (left.ok) useUsageAnalyticsStore.getState().removeBoard(code);
}
