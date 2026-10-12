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
    workingSet.length === 0
      ? "- No file changes were selected."
      : workingSet.map((message) => itemLine(message, 300)).join("\n"),
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
