export type DropKind = "task" | "note" | "idea";

export interface DropTriage {
  readonly kind: DropKind;
  /** Only a confident verdict is acted on; the rest stays in the inbox as a suggestion. */
  readonly confident: boolean;
  readonly title: string;
  readonly due: string | null;
}

const PREFIXES: ReadonlyArray<readonly [RegExp, DropKind]> = [
  [/^(?:todo|task|t)\s*[:\-]\s*/i, "task"],
  [/^(?:idea|i)\s*[:\-]\s*/i, "idea"],
  [/^(?:note|n)\s*[:\-]\s*/i, "note"],
];
const REMINDER =
  /^(?:please\s+)?(?:remind me to|don'?t forget to|(?:i\s+)?(?:need|have|got|must|should)\s+to)\s+/i;
const IDEA_LEAD = /^(?:what if|how about|maybe we could|we could|it would be (?:cool|nice))\b/i;
const VERBS = new Set(
  (
    "buy call email text send fix book schedule pay finish review update write ship push merge check " +
    "order cancel renew submit reply clean install upgrade add remove delete create build test deploy " +
    "refactor read plan prepare draft message ask tell print sign follow pick set"
  ).split(" "),
);
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MAX_TASK_WORDS = 14;

const pad2 = (value: number) => String(value).padStart(2, "0");
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

function readDue(text: string, now: number): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isoDay(date) === iso[0] ? iso[0] : null;
  }
  const today = new Date(now);
  const lower = text.toLowerCase();
  if (/\btoday\b/.test(lower)) return isoDay(today);
  if (/\btomorrow\b/.test(lower)) {
    return isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  }
  const wordsIn = lower.split(/[^a-z]+/);
  const day = WEEKDAYS.findIndex((name) => wordsIn.includes(name));
  if (day < 0) return null;
  const ahead = ((day - today.getDay() + 6) % 7) + 1; // next occurrence, never today
  return isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead));
}

const toTitle = (text: string) => {
  const line = text
    .split("\n")[0]!
    .trim()
    .replace(/[.!\s]+$/, "");
  const title = line.length > 120 ? `${line.slice(0, 117).trimEnd()}...` : line;
  return title.charAt(0).toUpperCase() + title.slice(1);
};

/**
 * Sorts a raw drop into a note, idea or task using plain rules, so capture never waits on a
 * model. It is the seam a smarter classifier can replace: only `confident` verdicts are acted on.
 */
export function triageDrop(raw: string, now: number): DropTriage {
  const text = raw.trim();
  for (const [pattern, kind] of PREFIXES) {
    if (pattern.test(text)) {
      const body = text.replace(pattern, "");
      return { kind, confident: true, title: toTitle(body), due: readDue(body, now) };
    }
  }
  const multiline = text.includes("\n");
  const words = text.split(/\s+/).filter(Boolean).length;
  const asked = text.includes("?");
  if (!multiline && !asked && IDEA_LEAD.test(text)) {
    return { kind: "idea", confident: true, title: toTitle(text), due: null };
  }
  const body = text.replace(REMINDER, "");
  const reminded = body !== text;
  const first = body.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!multiline && !asked && words <= MAX_TASK_WORDS && (reminded || VERBS.has(first))) {
    return { kind: "task", confident: true, title: toTitle(body), due: readDue(body, now) };
  }
  return { kind: "note", confident: false, title: toTitle(text), due: null };
}
