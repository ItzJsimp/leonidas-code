import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { describe, expect, it } from "vite-plus/test";

import { resolveShortcutCommand, shortcutLabelForCommand } from "./keybindings";
import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";

const PLATFORM = "Win32";

const TOP_ACTION_COMMANDS = [
  "chat.new",
  "thread.next",
  "modelPicker.toggle",
  "composer.attach",
  "thread.stop",
  "approval.accept",
  "tasks.open",
  "commandPalette.toggle",
  "settings.open",
] as const;

describe("top action shortcuts", () => {
  it("gives every top action a default key", () => {
    for (const command of TOP_ACTION_COMMANDS) {
      expect(
        DEFAULT_KEYBINDINGS.some((rule) => rule.command === command),
        command,
      ).toBe(true);
    }
  });

  it("never reuses one key with the same condition", () => {
    const seen = new Map<string, string>();
    for (const rule of DEFAULT_KEYBINDINGS) {
      const id = `${rule.key}|${rule.when ?? ""}`;
      const existing = seen.get(id);
      // chat.new owns two keys on purpose; one key must still map to one command.
      expect(existing === undefined || existing === rule.command, id).toBe(true);
      seen.set(id, rule.command);
    }
  });

  it("stops a run only while a turn runs", () => {
    const event = { key: ".", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
    expect(
      resolveShortcutCommand(event, DEFAULT_RESOLVED_KEYBINDINGS, {
        platform: PLATFORM,
        context: { turnRunning: false },
      }),
    ).toBeNull();
    expect(
      resolveShortcutCommand(event, DEFAULT_RESOLVED_KEYBINDINGS, {
        platform: PLATFORM,
        context: { turnRunning: true },
      }),
    ).toBe("thread.stop");
  });

  it("approves only while a request is pending", () => {
    const event = { key: "y", ctrlKey: true, metaKey: false, altKey: false, shiftKey: true };
    expect(
      resolveShortcutCommand(event, DEFAULT_RESOLVED_KEYBINDINGS, { platform: PLATFORM }),
    ).toBeNull();
    expect(
      resolveShortcutCommand(event, DEFAULT_RESOLVED_KEYBINDINGS, {
        platform: PLATFORM,
        context: { approvalPending: true },
      }),
    ).toBe("approval.accept");
  });

  it("labels the new shortcuts for tooltips", () => {
    expect(
      shortcutLabelForCommand(DEFAULT_RESOLVED_KEYBINDINGS, "settings.open", {
        platform: PLATFORM,
      }),
    ).toBe("Ctrl+,");
    expect(
      shortcutLabelForCommand(DEFAULT_RESOLVED_KEYBINDINGS, "composer.attach", {
        platform: PLATFORM,
      }),
    ).toBe("Ctrl+Shift+U");
  });
});
