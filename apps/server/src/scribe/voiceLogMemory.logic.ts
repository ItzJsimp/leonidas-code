// @effect-diagnostics globalDate:off globalDateInEffect:off -- Local calendar cutoffs and fixtures use the operating system time zone.
import type { ScribeHistoryItem } from "@t3tools/contracts";

export function voiceLogWindow(now: number) {
  const until = new Date(now);
  until.setHours(3, 0, 0, 0);
  if (until.getTime() > now) until.setDate(until.getDate() - 1);
  const since = new Date(until);
  since.setDate(since.getDate() - 1);
  return {
    day: `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, "0")}-${String(until.getDate()).padStart(2, "0")}`,
    since: since.getTime(),
    until: until.getTime(),
  };
}

export function voiceLogTexts(
  items: ReadonlyArray<ScribeHistoryItem>,
  skipApps: ReadonlyArray<string>,
  since: number,
  until: number,
) {
  const blocked = skipApps.map((app) => app.trim().toLowerCase()).filter(Boolean);
  const texts: string[] = [];
  let remaining = 40_000;
  for (const item of items) {
    if (item.private !== false) continue;
    const at = Date.parse(item.at);
    if (!Number.isFinite(at) || at < since || at >= until) continue;
    const app = item.app.toLowerCase();
    if (!app || blocked.some((name) => app.includes(name))) continue;
    const text = item.cleanedText.trim().slice(0, Math.min(4000, remaining));
    if (text) {
      texts.push(text);
      remaining -= text.length;
    }
    if (remaining <= 0 || texts.length >= 200) break;
  }
  return texts;
}
