import { describe, expect, it } from "@effect/vitest";

import { claudeInstallerCommand, parseClaudeVersion } from "./ClaudeInstallation.ts";

describe("claudeInstallerCommand", () => {
  it("runs the official PowerShell installer on Windows", () => {
    const { command, args } = claudeInstallerCommand("win32");
    expect(command).toBe("powershell.exe");
    expect(args.at(-1)).toBe("irm https://claude.ai/install.ps1 | iex");
  });

  it("runs the official shell installer elsewhere", () => {
    const { command, args } = claudeInstallerCommand("darwin");
    expect(command).toBe("bash");
    expect(args.at(-1)).toBe("curl -fsSL https://claude.ai/install.sh | bash");
  });
});

describe("parseClaudeVersion", () => {
  it("reads the version from claude --version", () => {
    expect(parseClaudeVersion("2.1.300 (Claude Code)\n")).toBe("2.1.300");
  });

  it("returns null when no version is printed", () => {
    expect(parseClaudeVersion("command not found")).toBeNull();
  });
});
