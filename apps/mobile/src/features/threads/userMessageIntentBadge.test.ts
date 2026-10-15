import { describe, expect, it } from "@effect/vitest";

import { resolveUserMessageIntentBadge } from "./userMessageIntentBadge";

describe("user message intent badge", () => {
  it("does not label ordinary turn-start messages", () => {
    expect(resolveUserMessageIntentBadge(undefined)).toBeNull();
    expect(resolveUserMessageIntentBadge("turn_start")).toBeNull();
  });

  it("labels messages waiting behind the active turn", () => {
    expect(resolveUserMessageIntentBadge("queued_turn")).toEqual({
      label: "waiting",
      accessibilityLabel: "Waiting behind the active reply",
      tone: "queued",
    });
  });

  it("labels messages that steer the active turn", () => {
    expect(resolveUserMessageIntentBadge("steer")).toEqual({
      label: "send now",
      accessibilityLabel: "Sent during the active reply",
      tone: "steer",
    });
  });

  it("preserves the queued origin after promotion to steer", () => {
    expect(resolveUserMessageIntentBadge("promoted_queued_to_steer")).toEqual({
      label: "waiting → send now",
      accessibilityLabel: "Saved as waiting, then sent during the active reply",
      tone: "steer",
    });
  });
});
