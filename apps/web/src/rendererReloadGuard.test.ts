import { describe, expect, it } from "vite-plus/test";

import { isRendererReloadSafe } from "./rendererReloadGuard";

const thread = (status: string | null, archivedAt: string | null = null) => ({
  runtime: status === null ? null : ({ status } as never),
  archivedAt,
});

describe("isRendererReloadSafe", () => {
  it("is safe when no agent runs and no dialog is open", () => {
    expect(
      isRendererReloadSafe({
        threads: [thread(null), thread("idle")],
        confirmDialogActive: false,
      }),
    ).toBe(true);
  });

  it("is not safe while an agent starts, runs or waits for the user", () => {
    for (const status of ["queued", "starting", "running", "waiting"]) {
      expect(isRendererReloadSafe({ threads: [thread(status)], confirmDialogActive: false })).toBe(
        false,
      );
    }
  });

  it("ignores archived threads", () => {
    expect(
      isRendererReloadSafe({
        threads: [thread("running", "2026-10-01T00:00:00Z")],
        confirmDialogActive: false,
      }),
    ).toBe(true);
  });

  it("is not safe while a confirmation dialog is open", () => {
    expect(isRendererReloadSafe({ threads: [], confirmDialogActive: true })).toBe(false);
  });
});
