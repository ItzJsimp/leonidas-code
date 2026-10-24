// @effect-diagnostics globalDate:off - the ICS maths works on epoch numbers and Intl, not DateTime.
/**
 * A small iCalendar (ICS) reader. It reads VEVENT blocks and expands the repeat rules a person
 * sets in Google, Outlook and Apple calendars.
 *
 * shortcut: no RDATE, no BYSETPOS, no "second Tuesday" monthly rules (those repeat on the start
 * day of the month), no VTIMEZONE parsing (zones come from the IANA name or a Windows name table).
 * Upgrade when a real calendar shows a wrong time.
 */

const DAY = 86_400_000;
/** Stops a bad rule from looping. A daily event from 2005 is about 7000 steps. */
const MAX_STEPS = 20_000;

export interface IcsEvent {
  readonly uid: string;
  readonly title: string;
  readonly start: number;
  readonly end: number;
  readonly allDay: boolean;
  readonly location?: string;
  readonly joinUrl?: string;
}

interface Prop {
  readonly name: string;
  readonly params: Readonly<Record<string, string>>;
  readonly value: string;
}

type Zone =
  | { readonly kind: "utc" }
  | { readonly kind: "local" }
  | { readonly kind: "iana"; readonly tz: string };

/** `wall` is a calendar time held as if it were UTC, so day maths has no DST gaps. */
interface DtValue {
  readonly wall: number;
  readonly zone: Zone;
  readonly allDay: boolean;
}

// ---- lines ----------------------------------------------------------------

const unfold = (text: string): string[] =>
  text
    .replace(/\r?\n[ \t]/g, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);

function parseLine(line: string): Prop | null {
  const parts: string[] = [];
  let cur = "";
  let quoted = false;
  let i = 0;
  for (; i < line.length; i++) {
    const c = line.charAt(i);
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === ";") {
      parts.push(cur);
      cur = "";
      continue;
    } else if (!quoted && c === ":") break;
    cur += c;
  }
  if (i >= line.length) return null;
  parts.push(cur);
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: (parts[0] ?? "").toUpperCase(), params, value: line.slice(i + 1) };
}

const unescapeText = (value: string): string =>
  value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

// ---- time zones -----------------------------------------------------------

/** Outlook writes Windows zone names. Only the common ones are listed. */
const WINDOWS_ZONES: Readonly<Record<string, string>> = {
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "Canada Central Standard Time": "America/Regina",
  "Mexico Standard Time": "America/Mexico_City",
  "SA Pacific Standard Time": "America/Bogota",
  "E. South America Standard Time": "America/Sao_Paulo",
  "Argentina Standard Time": "America/Argentina/Buenos_Aires",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  UTC: "UTC",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "Romance Standard Time": "Europe/Paris",
  "E. Europe Standard Time": "Europe/Chisinau",
  "FLE Standard Time": "Europe/Kiev",
  "GTB Standard Time": "Europe/Bucharest",
  "Russian Standard Time": "Europe/Moscow",
  "Turkey Standard Time": "Europe/Istanbul",
  "Israel Standard Time": "Asia/Jerusalem",
  "Arab Standard Time": "Asia/Riyadh",
  "South Africa Standard Time": "Africa/Johannesburg",
  "Egypt Standard Time": "Africa/Cairo",
  "India Standard Time": "Asia/Kolkata",
  "China Standard Time": "Asia/Shanghai",
  "Singapore Standard Time": "Asia/Singapore",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "E. Australia Standard Time": "Australia/Brisbane",
  "New Zealand Standard Time": "Pacific/Auckland",
};

const isIana = (tz: string): boolean => {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz }).resolvedOptions().timeZone.length > 0;
  } catch {
    return false;
  }
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function offsetMs(tz: string, utcMs: number): number {
  let fmt = formatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, fmt);
  }
  const v: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") v[p.type] = Number(p.value);
  }
  const shown = Date.UTC(
    v.year ?? 1970,
    (v.month ?? 1) - 1,
    v.day ?? 1,
    v.hour ?? 0,
    v.minute ?? 0,
    v.second ?? 0,
  );
  return shown - Math.floor(utcMs / 1000) * 1000;
}

/** Turns a calendar time in a zone into a real instant. Two passes settle the DST edge. */
function toEpoch(wall: number, zone: Zone): number {
  if (zone.kind === "utc") return wall;
  if (zone.kind === "local") {
    const d = new Date(wall);
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    ).getTime();
  }
  const first = wall - offsetMs(zone.tz, wall);
  return wall - offsetMs(zone.tz, first);
}

function parseDt(prop: Prop): DtValue | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(prop.value.trim());
  if (!m) return null;
  const wall = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
  );
  if (m[4] === undefined) return { wall, zone: { kind: "local" }, allDay: true };
  if (m[7]) return { wall, zone: { kind: "utc" }, allDay: false };
  const tzid = prop.params.TZID;
  const tz = tzid === undefined ? undefined : isIana(tzid) ? tzid : WINDOWS_ZONES[tzid];
  return { wall, zone: tz ? { kind: "iana", tz } : { kind: "local" }, allDay: false };
}

// ---- repeat rules ---------------------------------------------------------

interface Rule {
  readonly freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  readonly interval: number;
  readonly count: number | null;
  readonly until: DtValue | null;
  /** Monday = 0 ... Sunday = 6. */
  readonly byDay: readonly number[];
}

const DAY_INDEX: Readonly<Record<string, number>> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

function parseRule(value: string): Rule | null {
  const kv: Record<string, string> = {};
  for (const part of value.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) kv[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  const freq = kv.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;
  const byDay = (kv.BYDAY ?? "")
    .split(",")
    .map((d) => DAY_INDEX[d.replace(/^[+-]?\d+/, "").toUpperCase()])
    .filter((d): d is number => d !== undefined)
    .sort((a, b) => a - b);
  return {
    freq,
    interval: Math.max(1, Number(kv.INTERVAL ?? 1) || 1),
    count: kv.COUNT ? Number(kv.COUNT) || null : null,
    until: kv.UNTIL ? parseDt({ name: "UNTIL", params: {}, value: kv.UNTIL }) : null,
    byDay,
  };
}

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** Calendar times (wall clock, as UTC numbers) of every repeat, in order. */
function* occurrences(rule: Rule, start: number): Generator<number> {
  const timeOfDay = start - Math.floor(start / DAY) * DAY;
  const base = new Date(start);
  for (let step = 0; step < MAX_STEPS; step++) {
    if (rule.freq === "DAILY") {
      yield start + step * rule.interval * DAY;
    } else if (rule.freq === "WEEKLY") {
      const dow = (base.getUTCDay() + 6) % 7;
      const weekStart = Math.floor(start / DAY) * DAY - dow * DAY + step * rule.interval * 7 * DAY;
      for (const day of rule.byDay.length > 0 ? rule.byDay : [dow]) {
        const wall = weekStart + day * DAY + timeOfDay;
        if (wall >= start) yield wall;
      }
    } else if (rule.freq === "MONTHLY") {
      const index = base.getUTCMonth() + step * rule.interval;
      const year = base.getUTCFullYear() + Math.floor(index / 12);
      const month = ((index % 12) + 12) % 12;
      if (base.getUTCDate() <= daysInMonth(year, month))
        yield Date.UTC(year, month, base.getUTCDate()) + timeOfDay;
    } else {
      const year = base.getUTCFullYear() + step * rule.interval;
      if (base.getUTCDate() <= daysInMonth(year, base.getUTCMonth())) {
        yield Date.UTC(year, base.getUTCMonth(), base.getUTCDate()) + timeOfDay;
      }
    }
  }
}

// ---- events ---------------------------------------------------------------

const MEETING_URL =
  /https?:\/\/[^\s<>"')\\]*(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com|gotomeeting\.com)[^\s<>"')\\]*/i;

export const findJoinUrl = (...texts: readonly (string | undefined)[]): string | undefined => {
  for (const text of texts) {
    const hit = text ? MEETING_URL.exec(text) : null;
    if (hit) return hit[0];
  }
  return undefined;
};

/** A DURATION such as `PT1H30M` or `P1D`, in ms. */
function parseDuration(value: string): number | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, w, d, h, mi, s] = m.map((n) => Number(n ?? 0));
  return (
    ((w ?? 0) * 7 + (d ?? 0)) * DAY + (h ?? 0) * 3_600_000 + (mi ?? 0) * 60_000 + (s ?? 0) * 1000
  );
}

interface RawEvent {
  readonly uid: string;
  readonly title: string;
  readonly start: DtValue;
  /** Wall-clock length, so a repeat keeps its length across DST. */
  readonly length: number;
  readonly location: string | undefined;
  readonly joinUrl: string | undefined;
  readonly rule: Rule | null;
  readonly exdates: ReadonlySet<number>;
  readonly recurrenceId: number | null;
}

function readEvent(props: readonly Prop[]): RawEvent | null {
  const find = (name: string) => props.find((p) => p.name === name);
  const dtstart = find("DTSTART");
  const start = dtstart ? parseDt(dtstart) : null;
  if (!start || find("STATUS")?.value.toUpperCase() === "CANCELLED") return null;
  const dtend = find("DTEND");
  const end = dtend ? parseDt(dtend) : null;
  const duration = find("DURATION");
  const length = end
    ? end.wall - start.wall
    : ((duration ? parseDuration(duration.value) : null) ?? (start.allDay ? DAY : 0));
  const exdates = new Set<number>();
  for (const prop of props.filter((p) => p.name === "EXDATE")) {
    for (const v of prop.value.split(",")) {
      const dt = parseDt({ ...prop, value: v });
      if (dt) exdates.add(toEpoch(dt.wall, dt.zone));
    }
  }
  const rid = find("RECURRENCE-ID");
  const ridValue = rid ? parseDt(rid) : null;
  const rrule = find("RRULE");
  const location = find("LOCATION")?.value;
  const description = find("DESCRIPTION")?.value;
  return {
    uid: find("UID")?.value ?? `${start.wall}`,
    title: unescapeText(find("SUMMARY")?.value ?? "").trim() || "Busy",
    start,
    length: Math.max(0, length),
    location: location ? unescapeText(location).trim() || undefined : undefined,
    joinUrl: findJoinUrl(
      find("X-GOOGLE-CONFERENCE")?.value,
      find("URL")?.value,
      location,
      description ? unescapeText(description) : undefined,
    ),
    rule: rrule ? parseRule(rrule.value) : null,
    exdates,
    recurrenceId: ridValue ? toEpoch(ridValue.wall, ridValue.zone) : null,
  };
}

export const looksLikeIcs = (text: string): boolean => /^\s*BEGIN:VCALENDAR/i.test(text);

export const countIcsEvents = (text: string): number =>
  (text.match(/^BEGIN:VEVENT\s*$/gim) ?? []).length;

/** Every event that overlaps `[from, to)`, repeats expanded, sorted by start. */
export function expandIcs(text: string, from: number, to: number): IcsEvent[] {
  const raw: RawEvent[] = [];
  let current: Prop[] | null = null;
  for (const line of unfold(text)) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") current = [];
    else if (upper === "END:VEVENT") {
      const event = current ? readEvent(current) : null;
      if (event) raw.push(event);
      current = null;
    } else if (current) {
      const prop = parseLine(line);
      if (prop) current.push(prop);
    }
  }

  // A changed single repeat replaces the generated one with the same start.
  const overridden = new Set(
    raw.filter((e) => e.recurrenceId !== null).map((e) => `${e.uid}|${e.recurrenceId}`),
  );
  const out: IcsEvent[] = [];
  const add = (e: RawEvent, wall: number) => {
    const start = toEpoch(wall, e.start.zone);
    const end = toEpoch(wall + e.length, e.start.zone);
    if ((end > from || start >= from) && start < to) {
      out.push({
        uid: e.uid,
        title: e.title,
        start,
        end,
        allDay: e.start.allDay,
        ...(e.location ? { location: e.location } : {}),
        ...(e.joinUrl ? { joinUrl: e.joinUrl } : {}),
      });
    }
  };

  for (const e of raw) {
    if (!e.rule || e.recurrenceId !== null) {
      add(e, e.start.wall);
      continue;
    }
    const until = e.rule.until
      ? toEpoch(e.rule.until.wall, e.rule.until.zone) + (e.rule.until.allDay ? DAY - 1 : 0)
      : null;
    let n = 0;
    for (const wall of occurrences(e.rule, e.start.wall)) {
      const start = toEpoch(wall, e.start.zone);
      if (
        (e.rule.count !== null && n >= e.rule.count) ||
        start >= to ||
        (until !== null && start > until)
      )
        break;
      n++;
      if (e.exdates.has(start) || overridden.has(`${e.uid}|${start}`)) continue;
      add(e, wall);
    }
  }
  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}
