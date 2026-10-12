import styleStandard from "./promptStyleStandard.json" with { type: "json" };

/** Hard ceiling: longer candidates are trimmed at a sentence boundary. Soft target: 1 to 3. */
export const MAX_SUGGESTION_SENTENCES = 2;
export const SOFT_SUGGESTION_SENTENCES = 2;
/** Ranking points lost per sentence beyond the soft target, against one point per shared word. */
const LENGTH_PENALTY = 0.5;

export interface PromptCandidate {
  readonly text: string;
  readonly count: number;
  readonly lastSeen: number;
  readonly prefixOnly?: boolean;
  /** From the shipped style standard; own history wins when the user has typed a prefix. */
  readonly standard?: boolean;
}

export interface PromptPredictionMessage {
  readonly role: "user" | "assistant" | "system";
  readonly text: string;
  readonly streaming?: boolean;
}

const ACKNOWLEDGEMENT =
  /^(?:yes|yep|yeah|ok(?:ay)?|sure|no|thanks|thank you|go ahead|continue|do it|ship it)[.!\s]*$/i;
/** Anonymized phrasing patterns; rebuilt by scripts/extract-prompt-style-standard.ts. */
export const STYLE_STANDARD: readonly string[] = styleStandard.prompts;
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

function sentenceEnds(text: string) {
  return [...text.matchAll(/[.!?]+(?=\s|$)/g)].map((match) => match.index + match[0].length);
}

export function countSentences(text: string) {
  const ends = sentenceEnds(text);
  return ends.length + (ends.length === 0 || (ends.at(-1) ?? 0) < text.trim().length ? 1 : 0);
}

/** Trim at the sixth sentence boundary; shorter text passes through unchanged. */
export function capSentences(text: string) {
  const ends = sentenceEnds(text);
  return ends.length > MAX_SUGGESTION_SENTENCES
    ? text.slice(0, ends[MAX_SUGGESTION_SENTENCES - 1]).trim()
    : text;
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
  prefix = "",
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
  const normalizedPrefix = prefix.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const rank = (source: readonly PromptCandidate[]) => {
    const relevance = (candidate: PromptCandidate) =>
      [...words(candidate.text)].filter((word) => context.has(word)).length -
      LENGTH_PENALTY * Math.max(0, countSentences(candidate.text) - SOFT_SUGGESTION_SENTENCES);
    return source
      .map((candidate) => ({ ...candidate, text: capSentences(candidate.text) }))
      .filter(
        (candidate) =>
          !ACKNOWLEDGEMENT.test(candidate.text) &&
          candidate.text.length >= 3 &&
          candidate.text.length <= 2000 &&
          candidate.text.toLowerCase() !== lastUser &&
          (!normalizedPrefix ||
            candidate.text.toLocaleLowerCase().replace(/\s+/g, " ").startsWith(normalizedPrefix)) &&
          !/[\r\n]/.test(candidate.text),
      )
      .sort((a, b) => relevance(b) - relevance(a) || b.count - a.count || b.lastSeen - a.lastSeen);
  };
  // Own prompts come first; generic style phrases are a fallback when history has no match.
  const own = rank(pool).filter((candidate) => {
    const candidateWords = words(candidate.text);
    return (
      context.size === 0 ||
      candidateWords.size === 0 ||
      [...candidateWords].some((word) => context.has(word))
    );
  });
  const standard = rank(
    STYLE_STANDARD.map((text) => ({ text, count: 0, lastSeen: 0, standard: true })),
  ).filter((candidate) => {
    const candidateWords = words(candidate.text);
    return context.size === 0 || [...candidateWords].some((word) => context.has(word));
  });
  const unique = new Map<string, PromptCandidate>();
  if (recommendation)
    unique.set(recommendation.toLowerCase(), {
      text: capSentences(recommendation),
      count: 1,
      lastSeen: 0,
    });
  // Past prompts only ever complete what the user has started typing. An empty draft is
  // answered by a prediction (the assistant's recommendation or the model), never by a replay.
  const add = (candidate: PromptCandidate | undefined) => {
    if (candidate && !unique.has(candidate.text.toLowerCase()))
      unique.set(candidate.text.toLowerCase(), { ...candidate, prefixOnly: true });
  };
  for (const candidate of own) add(candidate);
  if (own.length === 0) for (const candidate of standard) add(candidate);
  return [...unique.values()].slice(0, 256);
}

/** Add a model-predicted prompt: it answers an empty draft and leads any prefix it extends. */
export function withModelPrediction(
  candidates: readonly PromptCandidate[],
  prediction: string | null,
): readonly PromptCandidate[] {
  const text = prediction ? capSentences(prediction.trim()) : "";
  if (!text || /[\r\n]/.test(text) || ACKNOWLEDGEMENT.test(text)) return candidates;
  const others = candidates.filter(
    (candidate) => candidate.text.toLowerCase() !== text.toLowerCase(),
  );
  // An explicit recommendation from the assistant (leading, not prefix-only) keeps first place.
  const lead = others.findIndex((candidate) => candidate.prefixOnly);
  const at = lead === -1 ? others.length : lead;
  return [...others.slice(0, at), { text, count: 1, lastSeen: 0 }, ...others.slice(at)];
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
      const text = record.cleaned_text
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length < 3) continue;
      const bounded =
        text.length > 500
          ? text
              .slice(0, 500)
              .replace(/\s+\S*$/, "")
              .trim()
          : text;
      const key = bounded.toLocaleLowerCase();
      prompts.set(key, {
        text: capSentences(bounded),
        count: (prompts.get(key)?.count ?? 0) + 1,
        lastSeen,
      });
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
  const normalized = prefix.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const matches = candidates.filter(
    (candidate) =>
      !ACKNOWLEDGEMENT.test(candidate.text) &&
      (prefix.trim().length > 0 || !candidate.prefixOnly) &&
      candidate.text.length > prefix.length &&
      candidate.text.toLocaleLowerCase().replace(/\s+/g, " ").startsWith(normalized),
  );
  const match =
    prefix.trim().length > 0 ? (matches.find((c) => !c.standard) ?? matches[0]) : matches[0];
  if (!match) return null;
  const suffix = match.text.replace(/\s+/g, " ").trim().slice(normalized.length);
  return prefix + (prefix.endsWith(" ") ? suffix.trimStart() : suffix);
}
