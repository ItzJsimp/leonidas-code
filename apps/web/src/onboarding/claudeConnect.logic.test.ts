import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderInstallState,
  type ServerProvider,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  CLAUDE_BUSY_MESSAGE,
  claudeSteps,
  describeClaudeConnect,
  isSignInUnfinished,
  mapClaudeConnectFailure,
} from "./claudeConnect.logic";

describe("isSignInUnfinished", () => {
  const job = (overrides: Partial<ProviderInstallState>): ProviderInstallState => ({
    driver: ProviderDriverKind.make("claudeAgent"),
    operationId: "op-1",
    phase: "idle",
    downloadedBytes: 0,
    totalBytes: null,
    version: null,
    installedVersion: null,
    canRemove: false,
    message: null,
    ...overrides,
  });

  it("treats a cancelled job and a sign-in failure as unfinished, but not other failures", () => {
    expect(isSignInUnfinished(job({ phase: "cancelled" }))).toBe(true);
    expect(isSignInUnfinished(job({ phase: "failed", recovery: "signIn" }))).toBe(true);
    expect(isSignInUnfinished(job({ phase: "failed", recovery: "retry" }))).toBe(false);
    expect(isSignInUnfinished(job({ phase: "signingIn" }))).toBe(false);
    expect(isSignInUnfinished(undefined)).toBe(false);
  });
});

describe("mapClaudeConnectFailure", () => {
  it("maps a second start while one job runs to the finish-or-cancel message", () => {
    expect(mapClaudeConnectFailure(new Error("Claude setup is already in progress."), "x")).toBe(
      CLAUDE_BUSY_MESSAGE,
    );
    expect(mapClaudeConnectFailure(new Error("Another install is running"), "x")).toBe(
      CLAUDE_BUSY_MESSAGE,
    );
  });

  it("keeps other server messages and falls back for empty or non-error failures", () => {
    expect(mapClaudeConnectFailure(new Error("No network."), "fallback")).toBe("No network.");
    expect(mapClaudeConnectFailure(new Error(""), "fallback")).toBe("fallback");
    expect(mapClaudeConnectFailure("boom", "fallback")).toBe("fallback");
  });
});

const provider = (overrides: Partial<ServerProvider> = {}): ServerProvider => ({
  instanceId: ProviderInstanceId.make("claudeAgent"),
  driver: ProviderDriverKind.make("claudeAgent"),
  enabled: true,
  installed: true,
  version: "2.1.0",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-10-12T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
  ...overrides,
});

const install = (overrides: Partial<ProviderInstallState> = {}): ProviderInstallState => ({
  driver: ProviderDriverKind.make("claudeAgent"),
  operationId: "op-1",
  phase: "idle",
  downloadedBytes: 0,
  totalBytes: null,
  version: null,
  installedVersion: null,
  canRemove: false,
  message: null,
  ...overrides,
});

describe("describeClaudeConnect", () => {
  it("flips to ready from the provider snapshot without any install event", () => {
    expect(describeClaudeConnect(provider(), undefined)).toEqual({ kind: "ready" });
    expect(describeClaudeConnect(provider(), install({ phase: "succeeded" })).kind).toBe("ready");
  });

  it("offers one connect action for a missing or signed-out Claude", () => {
    const missing = describeClaudeConnect(
      provider({ installed: false, status: "error" }),
      undefined,
    );
    expect(missing.kind).toBe("idle");
    const signedOut = describeClaudeConnect(
      provider({ auth: { status: "unauthenticated" }, status: "error" }),
      undefined,
    );
    expect(signedOut).toEqual({ kind: "idle", headline: "Sign in to start coding." });
  });

  it("shows the sign-in link and code box only while the job is signing in", () => {
    const view = describeClaudeConnect(
      provider({ installed: false, status: "error" }),
      install({
        phase: "signingIn",
        message: "Finish signing in to Claude in your browser.",
        signInUrl: "https://claude.ai/oauth/authorize?x=1",
        awaitingCode: true,
      }),
    );
    expect(view).toMatchObject({
      kind: "running",
      signInUrl: "https://claude.ai/oauth/authorize?x=1",
      awaitingCode: true,
      operationId: "op-1",
    });
  });

  it("keeps the running view even if a stale snapshot already says ready", () => {
    expect(describeClaudeConnect(provider(), install({ phase: "verifying" })).kind).toBe("running");
  });

  it("turns a failure into one message with one recovery label", () => {
    expect(
      describeClaudeConnect(
        provider({ installed: false, status: "error" }),
        install({
          phase: "failed",
          message: "Couldn't download Claude. Check your internet connection.",
          recovery: "retry",
          details: "Unable to connect",
        }),
      ),
    ).toEqual({
      kind: "failed",
      message: "Couldn't download Claude. Check your internet connection.",
      recoveryLabel: "Try again",
      details: "Unable to connect",
    });
    const signIn = describeClaudeConnect(
      provider({ installed: false, status: "error" }),
      install({ phase: "failed", message: "Sign-in didn't finish in time.", recovery: "signIn" }),
    );
    expect(signIn).toMatchObject({ kind: "failed", recoveryLabel: "Try signing in again" });
  });
});

describe("claudeSteps", () => {
  it("marks earlier steps done and later steps pending", () => {
    expect(claudeSteps("verifying").map((step) => step.status)).toEqual([
      "done",
      "done",
      "active",
      "pending",
    ]);
    expect(claudeSteps("checking").map((step) => step.status)).toEqual([
      "active",
      "pending",
      "pending",
      "pending",
    ]);
  });
});
