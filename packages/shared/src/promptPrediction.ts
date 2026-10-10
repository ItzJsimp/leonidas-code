export interface PromptCandidate {
  readonly text: string;
  readonly count: number;
  readonly lastSeen: number;
  readonly prefixOnly?: boolean;
}

export interface PromptPredictionMessage {
  readonly role: "user" | "assistant" | "system";
  readonly text: string;
  readonly streaming?: boolean;
}

const ACKNOWLEDGEMENT =
  /^(?:yes|yep|yeah|ok(?:ay)?|sure|no|thanks|thank you|go ahead|continue|do it|ship it)[.!\s]*$/i;
const STOP_WORDS = new Set(
  "a an and are as at be been but by can do for from have i in is it me my of on or our please that the this to we with you your".split(
    " ",
  ),
);

function words(text: string) {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []).filter((word) => !STOP_WORDS.has(word)),
  );
}

function cleanSuggestion(text: string) {
  const cleaned = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*`]/g, "")
    .trim();
  return cleaned.length >= 8 &&
    cleaned.length <= 500 &&
    !ACKNOWLEDGEMENT.test(cleaned) &&
    !/[\r\n]/.test(cleaned)
    ? cleaned
    : null;
}

/** Explicit reply guidance wins; prose and code samples are never treated as instructions. */
function recommendedReply(text: string): string | null {
  const prose = text.replace(/```[\s\S]*?(?:```|$)/g, "").replace(/\*\*/g, "");
  const direct = prose.match(
    /(?:recommended (?:message|prompt|reply|next step|next action)|suggested (?:message|prompt|reply))\s*:\s*([^\n]+)/i,
  );
  if (direct?.[1]) {
    const cleaned = cleanSuggestion(direct[1].replace(/^["“]|["”]$/g, ""));
    if (cleaned) return cleaned;
  }
  const letter = prose.match(/recommended\s*:?\s*\*{0,2}([A-D])\b/i)?.[1]?.toUpperCase();
  if (letter) {
    const option = prose
      .split("\n")
      .find((line) => new RegExp(`^\\s*(?:-\\s*)?\\*{0,2}${letter}\\)`).test(line));
    if (option) {
      const action = cleanSuggestion(
        option
          .replace(/^\s*(?:-\s*)?\*{0,2}[A-D]\)\*{0,2}\s*/, "")
          .replace(/\s*\(?\*?Wins when:.*$/i, ""),
      );
      if (action) return `Go with ${letter}: ${action}`;
    }
  }
  const replies = prose.match(/quick replies\s*:\s*([^\n]+)/i)?.[1];
  if (replies) {
    for (const match of replies.matchAll(/["“]([^"”]+)["”]/g)) {
      const cleaned = cleanSuggestion(match[1]!);
      if (cleaned) return cleaned;
    }
  }
  return null;
}

/** Rank against this thread, without a model request or a global most-frequent fallback. */
export function contextualPromptCandidates(
  history: readonly PromptCandidate[],
  messages: readonly PromptPredictionMessage[],
): PromptCandidate[] {
  const recent = messages.filter((message) => message.role !== "system").slice(-12);
  const latest = recent.at(-1);
  if (latest?.streaming) return [];
  const recommendation =
    latest?.role === "assistant" ? recommendedReply(latest.text.slice(-12_000)) : null;
  const context = words(
    recent
      .slice(-4)
      .map((message) => message.text.slice(-4_000))
      .join(" "),
  );
  const lastUser = recent
    .findLast((message) => message.role === "user")
    ?.text.trim()
    .toLowerCase();
  const pool = [
    ...history,
    ...recent
      .filter((message) => message.role === "user")
      .map((message, index) => ({ text: message.text.trim(), count: 1, lastSeen: index })),
  ];
  const ranked = pool.filter(
    (candidate) =>
      !ACKNOWLEDGEMENT.test(candidate.text) &&
      candidate.text.length >= 3 &&
      candidate.text.length <= 2000 &&
      candidate.text.toLowerCase() !== lastUser &&
      !/[\r\n]/.test(candidate.text),
  );
  ranked.sort((a, b) => {
    const relevance = (candidate: PromptCandidate) =>
      [...words(candidate.text)].filter((word) => context.has(word)).length;
    return relevance(b) - relevance(a) || b.count - a.count || b.lastSeen - a.lastSeen;
  });
  const unique = new Map<string, PromptCandidate>();
  if (recommendation)
    unique.set(recommendation.toLowerCase(), { text: recommendation, count: 1, lastSeen: 0 });
  for (const candidate of ranked)
    if (!unique.has(candidate.text.toLowerCase()))
      unique.set(candidate.text.toLowerCase(), {
        ...candidate,
        prefixOnly: ![...words(candidate.text)].some((word) => context.has(word)),
      });
  return [...unique.values()].slice(0, 256);
}

const AGENT_APPS =
  /^(?:claude|codex|antigravity|cursor|windsurf|t3code|t3 code(?: \(alpha\))?|leonidas(?: code)?)(?:\.exe)?$/i;
const TERMINALS =
  /^(?:windowsterminal|powershell|pwsh|cmd|wezterm-gui|alacritty|conhost|code)(?:\.exe)?$/i;

/** Only finalized dictations addressed to agent apps enter the bounded index. */
export function buildPromptCandidates(history: string): PromptCandidate[] {
  const prompts = new Map<string, PromptCandidate>();
  let lastSeen = 0;
  for (const line of history.split("\n")) {
    lastSeen++;
    try {
      const row: unknown = JSON.parse(line);
      if (typeof row !== "object" || row === null) continue;
      const record = row as Record<string, unknown>;
      if (
        !["hands-free", "ptt", "dictation"].includes(String(record.mode)) ||
        typeof record.app !== "string"
      )
        continue;
      if (!AGENT_APPS.test(record.app) && !(TERMINALS.test(record.app) && record.lens === "agent"))
        continue;
      if (typeof record.cleaned_text !== "string") continue;
      const text = record.cleaned_text.trim();
      if (text.length < 3 || text.length > 2000 || /[\r\n]/.test(text)) continue;
      const key = text.toLocaleLowerCase();
      prompts.set(key, { text, count: (prompts.get(key)?.count ?? 0) + 1, lastSeen });
    } catch {
      // The writer may be midway through its final JSONL record.
    }
  }
  return [...prompts.values()]
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
    .slice(0, 256);
}

export function predictPrompt(
  candidates: readonly PromptCandidate[],
  prefix: string,
): string | null {
  if (/[\r\n]/.test(prefix) || /^[\s]*[/$@]/.test(prefix)) return null;
  const normalized = prefix.toLocaleLowerCase();
  const match = candidates.find(
    (candidate) =>
      !ACKNOWLEDGEMENT.test(candidate.text) &&
      (prefix.trim().length > 0 || !candidate.prefixOnly) &&
      candidate.text.length > prefix.length &&
      candidate.text.toLocaleLowerCase().startsWith(normalized),
  );
  return match ? prefix + match.text.slice(prefix.length) : null;
}
