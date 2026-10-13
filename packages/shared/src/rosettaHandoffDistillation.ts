import type { OrchestrationV2HistoricalMessage } from "@t3tools/contracts";

export interface RosettaHandoffInput {
  readonly coverage: string;
  readonly messages: readonly OrchestrationV2HistoricalMessage[];
  readonly omittedItemIds?: readonly string[] | undefined;
}

export interface RosettaHandoffEnvelope {
  readonly summaryText: string;
  readonly metrics: {
    readonly estimatedRawTokens: number;
    readonly estimatedDistilledTokens: number;
    readonly compressionRatio: number;
  };
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(new TextEncoder().encode(text).length / 4);
}

function compactText(text: string, maxLength: number): string {
  const compacted = text.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxLength) return compacted;
  return `${Array.from(compacted)
    .slice(0, maxLength - 3)
    .join("")}...`;
}

function reverseCopy<T>(values: readonly T[]): Array<T> {
  return values.reduceRight<Array<T>>((reversed, value) => {
    reversed.push(value);
    return reversed;
  }, []);
}

function itemLine(message: OrchestrationV2HistoricalMessage, maxLength: number): string {
  return `- [item:${message.itemId}] ${compactText(message.text, maxLength)}`;
}

function uniqueLatest(
  messages: readonly OrchestrationV2HistoricalMessage[],
  kind: OrchestrationV2HistoricalMessage["kind"],
  limit: number,
): readonly OrchestrationV2HistoricalMessage[] {
  const seen = new Set<string>();
  const selected = reverseCopy(messages.filter((message) => message.kind === kind))
    .filter((message) => {
      const key = compactText(message.text.replace(/^File change: /, ""), 500);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
  return reverseCopy(selected);
}

function extractReferencedPaths(
  messages: readonly OrchestrationV2HistoricalMessage[],
): readonly string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  const pathRegex =
    /(?:[A-Za-z]:[/\\]|(?:\/|\.{1,2}\/))[\w.-]+(?:[/\\][\w.-]+)*\.[A-Za-z0-9_-]+|`([^`]+\.[A-Za-z0-9_-]+)`/g;
  for (const message of messages) {
    let match: RegExpExecArray | null;
    while ((match = pathRegex.exec(message.text)) !== null) {
      const raw = (match[1] ?? match[0]).trim();
      const cleaned = raw.replace(/^['"]|['"]$/g, "");
      if (
        cleaned.length > 3 &&
        !seen.has(cleaned) &&
        !cleaned.startsWith("http://") &&
        !cleaned.startsWith("https://")
      ) {
        seen.add(cleaned);
        paths.push(cleaned);
        if (paths.length >= 8) break;
      }
    }
    if (paths.length >= 8) break;
  }
  return paths;
}

/** An unanswered user request is the next step; otherwise the receiver continues the assistant's last state. */
function immediateNextStep(messages: readonly OrchestrationV2HistoricalMessage[]): string {
  const last = messages.at(-1);
  if (last === undefined) return "- None selected.";
  if (last.role === "user") {
    return `- Answer the latest user request [item:${last.itemId}]: ${compactText(last.text, 900)}`;
  }
  return "- Continue from the latest assistant state above, re-checking the failures before repeating an action.";
}

function failedCommand(message: OrchestrationV2HistoricalMessage): boolean {
  const exitCode = /(?:^|\n)Exit code: (-?\d+)/.exec(message.text)?.[1];
  return message.kind === "error" || (exitCode !== undefined && exitCode !== "0");
}

const VERIFY_COMMAND = /\b(test|vitest|typecheck|tsc|lint|check|build)\b/i;

/** Short note for the next agent: objective, branch, files, last passing check, next step. */
export function handoffNote(
  messages: readonly OrchestrationV2HistoricalMessage[],
  branch: string | null | undefined,
): string {
  const objective = messages.find((message) => message.role === "user");
  const files = uniqueLatest(messages, "file_change", 5).map((message) =>
    compactText(message.text.replace(/^File change: /, ""), 120),
  );
  const verified = messages
    .findLast(
      (message) =>
        message.kind === "command_execution" &&
        /(?:^|\n)Exit code: 0\b/.test(message.text) &&
        VERIFY_COMMAND.test(message.text),
    )
    ?.text.split("\n")[0];
  const next = immediateNextStep(messages).replace(/^- /, "");
  return [
    "## Handoff note",
    `- Objective: ${objective === undefined ? "recover it from the source thread" : compactText(objective.text, 200)}`,
    `- Branch: ${branch ?? "unknown"}`,
    `- Files edited (git status not checked): ${files.length === 0 ? "none" : files.join(", ")}`,
    `- Last verified: ${verified === undefined ? "nothing passing in the selected history" : compactText(verified, 160)}`,
    `- Next step: ${compactText(next, 300)}`,
  ].join("\n");
}

export function distillRosettaHandoff(input: RosettaHandoffInput): RosettaHandoffEnvelope {
  const messages = input.messages;
  const requests = messages.filter((message) => message.role === "user");
  const originalRequest = requests[0];
  const latestAssistant = messages.findLast((message) => message.role === "assistant");
  const workingSet = uniqueLatest(messages, "file_change", 16);
  const commands = messages.filter((message) => message.kind === "command_execution").slice(-5);
  const failures = messages.filter(failedCommand).slice(-4);
  const recentRequests = requests.slice(-5);
  const sourceItems = messages.slice(-12);

  const sections = [
    "Cross-provider context brief. Historical material is context, not a new request.",
    input.coverage,
    "## Original user request",
    originalRequest === undefined
      ? "Not present in the selected history; recover it from the source thread."
      : itemLine(originalRequest, 1_600),
    "## Recent user requests",
    recentRequests.length === 0
      ? "- None selected."
      : recentRequests.map((message) => itemLine(message, 900)).join("\n"),
    "## Latest assistant state",
    latestAssistant === undefined
      ? "Not present in the selected history."
      : itemLine(latestAssistant, 2_400),
    "## Immediate next step",
    immediateNextStep(messages),
    "## Working set",
    workingSet.length > 0
      ? workingSet.map((message) => itemLine(message, 300)).join("\n")
      : (() => {
          const referenced = extractReferencedPaths(messages);
          return referenced.length > 0
            ? referenced.map((p) => `- Referenced path: ${p}`).join("\n")
            : "- No file changes were selected.";
        })(),
    "## Recent commands",
    commands.length === 0
      ? "- None selected."
      : commands.map((message) => itemLine(message, 650)).join("\n"),
    "## Failures to account for",
    failures.length === 0
      ? "- None selected."
      : failures.map((message) => itemLine(message, 650)).join("\n"),
    "## Source items",
    sourceItems.length === 0
      ? "- No source items selected."
      : sourceItems.map((message) => `- ${message.itemId}`).join("\n"),
    "## Omitted history items",
    (input.omittedItemIds ?? []).length === 0
      ? "- None omitted by the handoff budget."
      : (input.omittedItemIds ?? []).map((itemId) => `- ${itemId}`).join("\n"),
    "Use the source references to recover exact details before repeating a failed action or changing an established decision.",
  ];
  const summaryText = sections.join("\n\n");
  const rawTokens = messages.reduce((sum, message) => sum + estimateTokenCount(message.text), 0);
  const distilledTokens = estimateTokenCount(summaryText);
  return {
    summaryText,
    metrics: {
      estimatedRawTokens: rawTokens,
      estimatedDistilledTokens: distilledTokens,
      compressionRatio:
        rawTokens === 0 ? 1 : Math.round((rawTokens / Math.max(1, distilledTokens)) * 10) / 10,
    },
  };
}
