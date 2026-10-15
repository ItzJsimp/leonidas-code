import type { OrchestrationV2UserMessageInputIntent } from "@t3tools/contracts";

export interface UserMessageIntentBadgePresentation {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly tone: "queued" | "steer";
}

export function resolveUserMessageIntentBadge(
  intent: OrchestrationV2UserMessageInputIntent | undefined,
): UserMessageIntentBadgePresentation | null {
  switch (intent) {
    case "queued_turn":
      return {
        label: "waiting",
        accessibilityLabel: "Waiting behind the active reply",
        tone: "queued",
      };
    case "steer":
      return {
        label: "send now",
        accessibilityLabel: "Sent during the active reply",
        tone: "steer",
      };
    case "promoted_queued_to_steer":
      return {
        label: "waiting → send now",
        accessibilityLabel: "Saved as waiting, then sent during the active reply",
        tone: "steer",
      };
    case "turn_start":
    case undefined:
      return null;
  }
}
