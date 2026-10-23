import { describe, expect, it } from "vite-plus/test";

import {
  isClaudeSignedOutFailure,
  sharedLoginPeerNames,
  sharedLoginWarning,
  signInInstanceId,
} from "./signInAgain";

const provider = (instanceId: string, email: string | undefined, overrides = {}) => ({
  instanceId,
  driver: "claudeAgent",
  displayName: instanceId,
  enabled: true,
  auth: { status: "authenticated", email },
  ...overrides,
});

describe("sharedLoginPeerNames", () => {
  it("lists other enabled Claude profiles on the same account, ignoring case", () => {
    const providers = [
      provider("a", "Jake@x.com"),
      provider("b", "jake@x.com"),
      provider("c", "other@x.com"),
      provider("d", "jake@x.com", { enabled: false }),
      provider("e", "jake@x.com", { driver: "codex" }),
    ];
    expect(sharedLoginPeerNames(providers, "a")).toEqual(["b"]);
  });

  it("stays quiet without an email or without a peer", () => {
    expect(sharedLoginPeerNames([provider("a", undefined), provider("b", undefined)], "a")).toEqual(
      [],
    );
    expect(sharedLoginPeerNames([provider("a", "x@y.com")], "a")).toEqual([]);
    expect(sharedLoginWarning([])).toBeNull();
  });
});

describe("isClaudeSignedOutFailure", () => {
  it("matches only the signed-out code the server sets", () => {
    expect(isClaudeSignedOutFailure({ code: "claude_signed_out" })).toBe(true);
    expect(isClaudeSignedOutFailure({ code: "api_error_403" })).toBe(false);
    expect(isClaudeSignedOutFailure({ code: null })).toBe(false);
  });
});

describe("signInInstanceId", () => {
  const runs = [
    { id: "run-1", providerInstanceId: "claudeAgent" },
    { id: "run-2", providerInstanceId: "claude_work" },
  ];

  it("returns the provider instance of the failed run", () => {
    expect(signInInstanceId(runs, "run-2")).toBe("claude_work");
  });

  it("returns null when the run is missing or unknown", () => {
    expect(signInInstanceId(runs, null)).toBeNull();
    expect(signInInstanceId(runs, "run-9")).toBeNull();
  });
});

describe("sharedLoginWarning", () => {
  it("names the peers and uses no terminal words", () => {
    const warning = sharedLoginWarning(["b", "c"]) ?? "";
    expect(warning).toContain("Same account as b, c");
    expect(warning).not.toMatch(/terminal|claude auth login/i);
  });
});
