export type FeedbackType = "bug" | "idea" | "suggestion";

export const FEEDBACK_TYPES: ReadonlyArray<{ readonly id: FeedbackType; readonly label: string }> =
  [
    { id: "bug", label: "Bug" },
    { id: "idea", label: "Idea" },
    { id: "suggestion", label: "Suggestion" },
  ];

/** Largest pasted screenshot we send, as a data URL; the relay enforces its own cap too. */
export const MAX_SCREENSHOT_CHARS = 2_000_000;
export const MAX_FEEDBACK_CHARS = 4_000;

const BUG_WORDS =
  /\b(bug|broken|crash(?:es|ed)?|error|fail(?:s|ed|ing)?|doesn'?t work|not working|won'?t|can'?t|cannot|stuck|freez(?:e|es|ing)|frozen|blank|missing|wrong|slow|lag(?:s|gy)?|glitch)\b/i;
const IDEA_WORDS =
  /\b(idea|what if|it would be (?:cool|nice|great)|would love|feature|add (?:a|an|support)|i wish|could we)\b/i;

/** Cheap first guess so most reports need no extra click; the chips stay one tap away. */
export function guessFeedbackType(text: string): FeedbackType {
  if (BUG_WORDS.test(text)) return "bug";
  if (IDEA_WORDS.test(text)) return "idea";
  return "suggestion";
}

/** Everything sent with a report. Never includes chat content, logs or paths. */
export interface FeedbackReport {
  readonly installId: string;
  readonly name?: string;
  readonly type: FeedbackType;
  readonly text: string;
  readonly screenshot?: string;
  readonly context: {
    readonly appVersion: string;
    readonly platform: string;
    readonly route: string;
    readonly source: string;
    readonly submittedAt: string;
    readonly provider?: string;
    readonly model?: string;
    readonly lastError?: string;
  };
}

const MAX_ERROR_CHARS = 500;
// Built with the backslash character so the pattern reads without escape soup.
const BS = String.fromCharCode(92);
const WINDOWS_USER_DIR = new RegExp(
  `[A-Za-z]:[/${BS}${BS}]+Users[/${BS}${BS}]+[^/${BS}${BS}${BS}s"']+`,
  "gi",
);
/** Errors older than this are unlikely to relate to the report. */
export const LAST_ERROR_MAX_AGE_MS = 10 * 60_000;

/** Strips user folders and key-like tokens so an error line is safe to put in a report. */
export function redactErrorText(text: string): string {
  return text
    .replace(WINDOWS_USER_DIR, "~")
    .replace(/\/(?:Users|home)\/[^/\s"']+/g, "~")
    .replace(/\b(?:sk|pk|ghp|gho|xox[a-z])[-_][A-Za-z0-9_-]{16,}/g, "[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer [redacted]")
    .slice(0, MAX_ERROR_CHARS);
}

/** Top-level screen only: chat routes start with an environment id, so they collapse to "/chat". */
function screenName(route: string): string {
  const first = route.split(/[?#]/)[0]?.split("/")[1] ?? "";
  return /^[0-9a-f-]{32,}$/i.test(first) ? "/chat" : `/${first}`;
}

export function buildFeedbackReport(input: {
  readonly installId: string;
  readonly name: string;
  readonly type: FeedbackType;
  readonly text: string;
  readonly screenshot: string | null;
  readonly source: string;
  readonly appVersion: string;
  readonly platform: string;
  readonly route: string;
  readonly now: Date;
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly lastError?: { readonly text: string; readonly at: number } | null;
}): FeedbackReport {
  const recentError =
    input.lastError && input.now.getTime() - input.lastError.at <= LAST_ERROR_MAX_AGE_MS
      ? redactErrorText(input.lastError.text)
      : "";
  const name = input.name.trim();
  return {
    installId: input.installId,
    ...(name ? { name: name.slice(0, 80) } : {}),
    type: input.type,
    text: input.text.trim().slice(0, MAX_FEEDBACK_CHARS),
    ...(input.screenshot && input.screenshot.length <= MAX_SCREENSHOT_CHARS
      ? { screenshot: input.screenshot }
      : {}),
    context: {
      appVersion: input.appVersion,
      platform: input.platform,
      route: screenName(input.route),
      source: input.source,
      submittedAt: input.now.toISOString(),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(recentError ? { lastError: recentError } : {}),
    },
  };
}
