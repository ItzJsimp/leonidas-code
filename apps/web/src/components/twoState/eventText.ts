/** Plain words for feed events. Pure functions: no backticks, no exit codes, local 12-hour time. */

const pad = (value: number) => String(value).padStart(2, "0");

/** `4:40 AM` from the local clock. Built by hand so no locale adds odd spaces. */
const clock = (date: Date) => {
  const hour = date.getHours();
  return `${hour % 12 || 12}:${pad(date.getMinutes())} ${hour < 12 ? "AM" : "PM"}`;
};

const TIME =
  /\b(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:\s?(UTC|Z|[+-]\d{2}:\d{2}))?/g;
const EXIT = /(?:[,;:]?\s*(?:with\s+)?)\(?\bexit(?: code)? (\d+)\)?/gi;

function localTime(
  match: string,
  y: string,
  mo: string,
  d: string,
  h: string,
  mi: string,
  s = "0",
  zone?: string,
) {
  const parts = [Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)] as const;
  let date: Date;
  if (zone === undefined) date = new Date(...parts);
  else {
    const utc = Date.UTC(...parts);
    const offset =
      zone.length > 1 && zone !== "UTC"
        ? (zone[0] === "-" ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)))
        : 0;
    date = new Date(utc - offset * 60_000);
  }
  return Number.isNaN(date.getTime()) ? match : clock(date);
}

/** Cleans one piece of event text. */
export function plainText(text: string): string {
  return text
    .replaceAll("`", "")
    .replace(EXIT, (_match, code: string, at: number, whole: string) => {
      const word = Number(code) === 0 ? "finished" : "failed";
      const before = whole.slice(0, at).trimEnd();
      if (before === "") return word;
      return /(fail|error)\w*$/i.test(before) ? "" : ` (${word})`;
    })
    .replace(TIME, localTime);
}

const FILE_NAME = /^(?:[\w.-]+\/)*([\w.-]+)\.[A-Za-z0-9]{1,5}$/;

/** A title that is only a file name becomes a sentence: `2026-10-23-weekly_review.md` -> `Weekly review`. */
export function plainEventTitle(title: string): string {
  const stem = FILE_NAME.exec(title.trim())?.[1]?.replace(/^\d{4}-\d{2}-\d{2}[-_]?/, "");
  if (stem === undefined || stem === "") return plainText(title);
  const words = stem.replace(/[-_.]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function plainEventBody(body: string | undefined): string | null {
  const text = body === undefined ? "" : plainText(body).trim();
  return text === "" ? null : text;
}

/** The reason line. A failure always gets one, so the row says why and not only that it broke. */
export function plainEventCause(event: {
  readonly level: string;
  readonly body?: string | undefined;
}): string | null {
  return plainEventBody(event.body) ?? (event.level === "failed" ? "No cause was recorded." : null);
}
