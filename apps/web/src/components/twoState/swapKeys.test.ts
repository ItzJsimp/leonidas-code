import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { describe, expect, it } from "vite-plus/test";

import { resolveShortcutCommand, type ShortcutEventLike } from "~/keybindings";

import { swapKeyLabel, swapTarget } from "./swapKeys";

const press = (key: string, extra: Partial<ShortcutEventLike> = {}): ShortcutEventLike => ({
  key,
  metaKey: false,
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  ...extra,
});

const resolve = (event: ShortcutEventLike, platform: string, turnRunning = false) =>
  resolveShortcutCommand(event, DEFAULT_RESOLVED_KEYBINDINGS, {
    platform,
    context: { turnRunning },
  });

describe("swap and split keys", () => {
  it("swaps with Ctrl+Tab and with the web fallback Ctrl+Shift+.", () => {
    expect(resolve(press("Tab"), "Win32")).toBe("layout.swap");
    expect(resolve(press("Tab"), "MacIntel")).toBe("layout.swap");
    expect(resolve(press(">", { shiftKey: true, code: "Period" } as never), "Win32")).toBe(
      "layout.swap",
    );
  });

  it("toggles the split with Ctrl+\\ (Cmd+\\ on a Mac)", () => {
    expect(resolve(press("\\"), "Win32")).toBe("layout.split");
    expect(resolve(press("\\", { ctrlKey: false, metaKey: true }), "MacIntel")).toBe(
      "layout.split",
    );
  });

  it("keeps Ctrl+. as Stop while a turn runs", () => {
    expect(resolve(press("."), "Win32", true)).toBe("thread.stop");
  });
});

describe("swapTarget", () => {
  const last = { environmentId: "env", threadId: "thr" };

  it("brings the Command Center forward from a chat or any other page", () => {
    expect(swapTarget("code", last)).toEqual({ to: "cc" });
    expect(swapTarget("other", null)).toEqual({ to: "cc" });
  });

  it("returns to the last chat from the Command Center, or stays without one", () => {
    expect(swapTarget("cc", last)).toEqual({ to: "thread", ...last });
    expect(swapTarget("cc", null)).toBeNull();
  });
});

describe("swapKeyLabel", () => {
  it("names the key the build can use", () => {
    expect(swapKeyLabel(true)).toBe("Ctrl Tab");
    expect(swapKeyLabel(false)).toBe("Ctrl Shift .");
  });
});
