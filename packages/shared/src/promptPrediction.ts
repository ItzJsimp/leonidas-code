export interface PromptCandidate {
  readonly text: string;
  readonly count: number;
  readonly lastSeen: number;
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
      candidate.text.length > prefix.length &&
      candidate.text.toLocaleLowerCase().startsWith(normalized),
  );
  return match ? prefix + match.text.slice(prefix.length) : null;
}
