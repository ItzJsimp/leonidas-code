import { act, createElement } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vite-plus/test";

import { useVisibleInterval } from "./useVisibleInterval";

describe("useVisibleInterval", () => {
  it("ticks only while showing, catches up once on return, and stops when disabled", () => {
    vi.useFakeTimers();
    const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
    vi.stubGlobal("document", document);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const tick = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    function Probe({ enabled = true }) {
      useVisibleInterval(tick, 1_000, enabled);
      return null;
    }
    try {
      act(() => {
        renderer = create(createElement(Probe));
      });
      act(() => vi.advanceTimersByTime(3_000));
      expect(tick).toHaveBeenCalledTimes(3);

      document.visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      act(() => vi.advanceTimersByTime(60_000));
      expect(tick).toHaveBeenCalledTimes(3);

      document.visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      expect(tick).toHaveBeenCalledTimes(4);
      act(() => vi.advanceTimersByTime(1_000));
      expect(tick).toHaveBeenCalledTimes(5);

      act(() => renderer?.update(createElement(Probe, { enabled: false })));
      act(() => vi.advanceTimersByTime(5_000));
      expect(tick).toHaveBeenCalledTimes(5);
    } finally {
      act(() => renderer?.unmount());
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
