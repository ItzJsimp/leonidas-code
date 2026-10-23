import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { describe, expect, it } from "vite-plus/test";

import { resolveShortcutCommand, type ShortcutEventLike } from "~/keybindings";

import { swapAction, swapKeyLabel } from "./swapKeys";

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

describe("swapAction", () => {
  const last = { environmentId: "env", threadId: "thr" };

  it("moves focus to the other pane in a split", () => {
    expect(swapAction({ mode: "split", show: "left", focused: "chat", lastThread: last })).toEqual({
      kind: "focus",
      pane: "left",
    });
    expect(swapAction({ mode: "split", show: "left", focused: "left", lastThread: null })).toEqual({
      kind: "focus",
      pane: "chat",
    });
  });

  it("goes to the chat pane when focus is in neither pane", () => {
    expect(swapAction({ mode: "split", show: "chat", focused: null, lastThread: null })).toEqual({
      kind: "focus",
      pane: "chat",
    });
  });

  it("opens the Command Center from the chat when one pane shows", () => {
    expect(swapAction({ mode: "single", show: "chat", focused: null, lastThread: last })).toEqual({
      kind: "cc",
    });
  });

  it("returns to the last chat from a rail page, or to the chat start page without one", () => {
    expect(swapAction({ mode: "single", show: "left", focused: null, lastThread: last })).toEqual({
      kind: "thread",
      ...last,
    });
    expect(swapAction({ mode: "single", show: "left", focused: null, lastThread: null })).toEqual({
      kind: "start",
    });
  });
});

describe("swapKeyLabel", () => {
  it("names the key the build can use", () => {
    expect(swapKeyLabel(true)).toBe("Ctrl Tab");
    expect(swapKeyLabel(false)).toBe("Ctrl Shift .");
  });
});
