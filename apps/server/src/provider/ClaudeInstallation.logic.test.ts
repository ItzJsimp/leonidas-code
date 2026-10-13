import { describe, expect, it } from "@effect/vitest";

import {
  CLAUDE_FAILURES,
  asksForCode,
  classifyInstallerFailure,
  extractSignInUrl,
  installerCommand,
  installerPhaseForLine,
  isDefaultClaudeBinary,
  parseAuthStatus,
  stripAnsi,
  trimDetails,
} from "./ClaudeInstallation.logic.ts";

// ASSUMPTION: this is a plausible rendering of `claude auth login` output. The
// real CLI output was not captured, so the parser only relies on "an https URL
// on a Claude or Anthropic domain" and on code-prompt wording.
const LOGIN_OUTPUT =
  "Opening browser to sign in...\n" +
  "If the browser didn't open, visit: https://claude.ai/oauth/authorize?code=true&client_id=abc&state=xyz.\n" +
  "Paste code here if prompted > ";

describe("extractSignInUrl", () => {
  it("finds the first Claude sign-in link and trims prose punctuation", () => {
    expect(extractSignInUrl(LOGIN_OUTPUT)).toBe(
      "https://claude.ai/oauth/authorize?code=true&client_id=abc&state=xyz",
    );
  });

  it("accepts anthropic and claude.com hosts, and sees through color codes", () => {
    expect(extractSignInUrl("\u001b[36mhttps://console.anthropic.com/login\u001b[0m")).toBe(
      "https://console.anthropic.com/login",
    );
    expect(extractSignInUrl("go to (https://claude.com/cai/oauth/authorize?x=1)")).toBe(
      "https://claude.com/cai/oauth/authorize?x=1",
    );
  });

  it("ignores unrelated and look-alike hosts", () => {
    expect(extractSignInUrl("docs: https://example.com/claude.ai")).toBeNull();
    expect(extractSignInUrl("https://evilclaude.ai/login")).toBeNull();
    expect(extractSignInUrl("no link here")).toBeNull();
  });
});

describe("asksForCode", () => {
  it("detects a paste-the-code prompt", () => {
    expect(asksForCode(LOGIN_OUTPUT)).toBe(true);
    expect(asksForCode("Enter the authorization code:")).toBe(true);
  });

  it("stays quiet for plain progress output", () => {
    expect(asksForCode("Opening browser to sign in...")).toBe(false);
    expect(asksForCode("Login successful.")).toBe(false);
  });
});

describe("parseAuthStatus", () => {
  it("reads loggedIn from the JSON status", () => {
    expect(parseAuthStatus('{"loggedIn": true, "authMethod": "claude.ai"}', 0)).toBe(true);
    expect(parseAuthStatus('{"loggedIn": false}', 1)).toBe(false);
    expect(parseAuthStatus('{"loggedIn": false}', 0)).toBe(false);
  });

  it("falls back to the exit code for text output", () => {
    expect(parseAuthStatus("Logged in as someone", 0)).toBe(true);
    expect(parseAuthStatus("Not logged in", 0)).toBe(false);
    expect(parseAuthStatus("", 1)).toBe(false);
  });
});

describe("failure mapping", () => {
  it("separates network trouble from a broken installer", () => {
    expect(classifyInstallerFailure("irm : Unable to connect to the remote server")).toBe(
      "network",
    );
    expect(classifyInstallerFailure("The request was aborted: Could not create SSL/TLS")).toBe(
      "network",
    );
    expect(classifyInstallerFailure("Access to the path is denied")).toBe("installer");
    expect(classifyInstallerFailure("Unsupported architecture")).toBe("unsupported");
  });

  it("gives every failure one short sentence and at most one recovery", () => {
    for (const failure of Object.values(CLAUDE_FAILURES)) {
      expect(failure.message.split(/[.!?]\s/u).length).toBeLessThanOrEqual(2);
      expect(failure.message).not.toMatch(/PATH|powershell|exit code/iu);
    }
    expect(CLAUDE_FAILURES.network.recovery).toBe("retry");
    expect(CLAUDE_FAILURES.signInTimeout.recovery).toBe("signIn");
  });

  it("keeps technical details short and free of color codes", () => {
    expect(trimDetails("\u001b[31mboom\u001b[0m")).toBe("boom");
    expect(trimDetails("   ")).toBeNull();
    expect(trimDetails("x".repeat(5000))?.length).toBeLessThan(1300);
  });
});

describe("installer plumbing", () => {
  it("runs the official installers unattended without elevation", () => {
    const windows = installerCommand("win32");
    expect(windows?.command).toBe("powershell.exe");
    expect(windows?.args).toEqual(expect.arrayContaining(["-NoProfile", "-NonInteractive"]));
    expect(windows?.args.join(" ")).toContain("https://claude.ai/install.ps1");
    expect(installerCommand("linux")?.args.join(" ")).toContain("https://claude.ai/install.sh");
    expect(installerCommand("freebsd")).toBeNull();
  });

  it("maps installer lines onto coarse phases", () => {
    expect(installerPhaseForLine("Installing Claude Code native build latest...")).toBe(
      "installing",
    );
    expect(installerPhaseForLine("Downloading binary")).toBe("downloading");
    expect(installerPhaseForLine("")).toBeNull();
    expect(stripAnsi("\u001b[1mx\u001b[0m")).toBe("x");
  });

  it("only treats an empty or bare command as the default binary", () => {
    expect(isDefaultClaudeBinary("")).toBe(true);
    expect(isDefaultClaudeBinary("claude")).toBe(true);
    expect(isDefaultClaudeBinary("C:\\tools\\claude.exe")).toBe(false);
  });
});
