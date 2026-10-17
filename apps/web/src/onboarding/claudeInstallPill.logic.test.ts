import type { ProviderInstallState } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { formatElapsed, getClaudeInstallPillView } from "./claudeInstallPill.logic";

const state = (phase: string, message: string | null = null) =>
  ({ phase, message }) as unknown as ProviderInstallState;

describe("getClaudeInstallPillView", () => {
  it("shows progress while the installer runs", () => {
    for (const phase of ["downloading", "extracting", "verifying"]) {
      expect(getClaudeInstallPillView({ installation: state(phase), claudeReady: false })).toEqual({
        kind: "installing",
      });
    }
  });

  it("asks for sign-in after the install until Claude is ready", () => {
    expect(
      getClaudeInstallPillView({ installation: state("succeeded"), claudeReady: false }).kind,
    ).toBe("installed");
    expect(
      getClaudeInstallPillView({ installation: state("succeeded"), claudeReady: true }).kind,
    ).toBe("hidden");
  });

  it("reports a failed install with its message", () => {
    expect(
      getClaudeInstallPillView({
        installation: state("failed", "No network."),
        claudeReady: false,
      }),
    ).toEqual({ kind: "failed", message: "No network." });
  });

  it("stays hidden before any install", () => {
    expect(getClaudeInstallPillView({ installation: undefined, claudeReady: false }).kind).toBe(
      "hidden",
    );
  });
});

describe("formatElapsed", () => {
  it("formats minutes and seconds", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(83)).toBe("1:23");
  });
});
