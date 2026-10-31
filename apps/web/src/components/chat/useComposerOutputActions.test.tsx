// @vitest-environment jsdom
import { act, useRef, type RefObject } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import type { ChatComposerHandle } from "./ChatComposer";
import { useComposerOutputActions } from "./useComposerOutputActions";

function fakeComposer(value: string, expandedCursor: number) {
  return {
    readSnapshot: () => ({ value, cursor: expandedCursor, expandedCursor, contextIds: [] }),
    insertTextAtCursor: vi.fn(() => true),
    insertTextAtEnd: vi.fn(() => true),
  };
}

async function fill(composer: ReturnType<typeof fakeComposer>, text: string) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  let fillDockReply: ((text: string) => void) | undefined;
  function Probe() {
    const ref = useRef(composer as unknown as ChatComposerHandle);
    fillDockReply = useComposerOutputActions(
      ref as RefObject<ChatComposerHandle | null>,
      () => {},
    ).fillDockReply;
    return null;
  }
  try {
    await act(() => root.render(<Probe />));
    fillDockReply!(text);
  } finally {
    await act(() => root.unmount());
    vi.unstubAllGlobals();
  }
}

it("fills a Dock reply at the caret when the draft has one", async () => {
  const composer = fakeComposer("Ship it after the tests", 8);
  await fill(composer, "Option A: Keep it");
  expect(composer.insertTextAtCursor).toHaveBeenCalledWith("Option A: Keep it", {
    ensureLeadingBoundary: true,
  });
  expect(composer.insertTextAtEnd).not.toHaveBeenCalled();
});

it("fills at the end when a draft has no caret yet", async () => {
  const composer = fakeComposer("Ship it", 0);
  await fill(composer, "Option B: Stop");
  expect(composer.insertTextAtEnd).toHaveBeenCalledWith("Option B: Stop", {
    ensureLeadingBoundary: true,
  });
  expect(composer.insertTextAtCursor).not.toHaveBeenCalled();
});
