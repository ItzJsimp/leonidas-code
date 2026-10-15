import { deriveAvailableInstanceId } from "./AddProviderInstanceDialog.logic";

export type ConnectChoice = "claude" | "chatgpt" | "google";

export interface ConnectChoiceInfo {
  readonly id: ConnectChoice;
  readonly title: string;
  readonly plans: string;
  readonly driver: string;
}

export const CONNECT_CHOICES: ReadonlyArray<ConnectChoiceInfo> = [
  { id: "claude", title: "Claude", plans: "Pro, Max or Team plan", driver: "claudeAgent" },
  { id: "chatgpt", title: "ChatGPT", plans: "Plus, Pro or Team plan", driver: "codex" },
  { id: "google", title: "Google Gemini", plans: "Any Google account", driver: "antigravity" },
];

/**
 * Plan for a one-click account. The first Claude or Google account reuses the
 * machine's default sign-in. Later accounts get their own config folder so two
 * accounts never share one login.
 */
export function planQuickConnect(input: {
  readonly choice: Exclude<ConnectChoice, "chatgpt">;
  readonly existingIds: ReadonlySet<string>;
  readonly sameDriverCount: number;
}): {
  readonly instanceId: string;
  readonly displayName: string;
  readonly config: Record<string, unknown> | undefined;
} {
  const info = CONNECT_CHOICES.find((entry) => entry.id === input.choice)!;
  const ordinal = input.sameDriverCount + 1;
  const displayName = ordinal === 1 ? info.title : `${info.title} ${ordinal}`;
  const instanceId = deriveAvailableInstanceId(
    () => (ordinal === 1 ? info.driver : `${info.driver}_${ordinal}`),
    displayName,
    input.existingIds,
  );
  const config =
    input.choice === "claude" && input.sameDriverCount > 0
      ? { homePath: `~/.claude-${instanceId}` }
      : undefined;
  return { instanceId, displayName, config };
}
