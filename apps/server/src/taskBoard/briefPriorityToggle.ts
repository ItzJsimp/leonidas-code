// Ticks one priority in a daily brief. Pure text work; the service owns the file read and write.

/** Only a daily brief can be changed: `logs/briefings/YYYY-MM-DD-briefing.md`. */
export const BRIEF_PATH = /^logs\/briefings\/\d{4}-\d{2}-\d{2}-briefing\.md$/;

const CHECKBOX = /^(\s*- \[)( |x)(\] )/;

export type BriefToggleFailure = "not_a_priority" | "line_missing" | "line_ambiguous";

export type BriefToggleResult =
  | { readonly ok: true; readonly text: string; readonly line: string }
  | { readonly ok: false; readonly reason: BriefToggleFailure };

/**
 * Sets the checkbox of the one line that equals `line` (leading spaces and a trailing CR aside).
 * Every other byte of `text` stays the same. Fails when no line or more than one line matches,
 * because then the file changed since the caller read it, or the target is not clear.
 */
export function toggleBriefLine(text: string, line: string, done: boolean): BriefToggleResult {
  const wanted = line.trim();
  if (!CHECKBOX.test(wanted)) return { ok: false, reason: "not_a_priority" };
  const lines = text.split("\n");
  const hits: number[] = [];
  lines.forEach((raw, index) => {
    if (raw.replace(/\r$/, "").trim() === wanted) hits.push(index);
  });
  if (hits.length === 0) return { ok: false, reason: "line_missing" };
  if (hits.length > 1) return { ok: false, reason: "line_ambiguous" };
  const index = hits[0]!;
  const next = lines[index]!.replace(CHECKBOX, `$1${done ? "x" : " "}$3`);
  lines[index] = next;
  return { ok: true, text: lines.join("\n"), line: next.replace(/\r$/, "").trim() };
}
