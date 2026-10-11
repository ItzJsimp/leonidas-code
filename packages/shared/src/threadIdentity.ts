import type { OrchestrationV2ActivitySummary } from "@t3tools/contracts";

const TASK_GLYPHS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(design|theme|layout|readability|sidebar|ui|ux)\b/i, "🎨"],
  [/\b(auth|login|account|token|permission|security)\b/i, "🔑"],
  [/\b(test|verify|verification|calibration)\b/i, "🧪"],
  [/\b(bug|fix|repair|crash|error)\b/i, "🔧"],
  [/\b(usage|analytics|context|history|metrics|dashboard)\b/i, "📊"],
  [/\b(speed|performance|latency|optimize)\b/i, "⚡"],
  [/\b(release|ship|deploy|publish|update)\b/i, "🚀"],
  [/\b(review|audit|investigate|research)\b/i, "🔎"],
  [/\b(docs|documentation|guide|readme)\b/i, "📚"],
  [/\b(agent|model|routing|ai)\b/i, "🤖"],
];

/** Presentation only: never rewrites saved titles or duplicates an authored emoji. */
export function threadTopicGlyph(title: string): string | null {
  if (/^\s*(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3)/u.test(title))
    return null;
  return TASK_GLYPHS.find(([pattern]) => pattern.test(title))?.[1] ?? "💬";
}

/** Stable visual fallback when a project has neither a favicon nor a chosen icon. */
export function projectIdentityGlyph(title: string): string {
  if (/\b(aios|ai|agent|model)\b/i.test(title)) return "🧠";
  if (/\b(scribe|write|notes|docs)\b/i.test(title)) return "✍️";
  if (/\b(web|site|browser)\b/i.test(title)) return "🌐";
  if (/\b(app|mobile|ios|android)\b/i.test(title)) return "📱";
  if (/\b(data|db|analytics)\b/i.test(title)) return "📊";
  const glyphs = ["🧩", "🌿", "🛰️", "🛠️", "📦", "🧭"];
  let seed = 0;
  for (const character of title.normalize("NFKC").trim().toLowerCase()) {
    seed = (seed * 31 + (character.codePointAt(0) ?? 0)) % glyphs.length;
  }
  return glyphs[seed]!;
}

/** Attention states outrank the current plan; finished chats carry no stale live step. */
export function threadActivityLine(input: {
  status: string;
  summary?: OrchestrationV2ActivitySummary | null | undefined;
}): { text: string; progress: string | null } | null {
  const attention: Record<string, string> = {
    approval: "Needs your approval",
    input: "Waiting for your answer",
    limited: "Paused at the account usage limit",
    failed: "Stopped after an error",
    waiting: "Waiting for background work",
  };
  const text = attention[input.status];
  if (text) return { text, progress: null };
  if (input.status !== "working") return null;
  const summary = input.summary;
  return {
    text: summary?.text.replace(/\s+/g, " ").trim() || "Working on this task",
    progress: summary?.currentStep ? `${summary.currentStep}/${summary.totalSteps}` : null,
  };
}
