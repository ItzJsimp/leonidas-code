/**
 * Pure helpers for the managed Claude setup: reading the CLI's output,
 * deciding what went wrong, and phrasing it for a person who never opens a
 * terminal. The service in ClaudeInstallation.ts owns the processes.
 */

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/gu;

export const stripAnsi = (text: string) => text.replace(ANSI, "");

const SIGN_IN_HOSTS = ["claude.ai", "claude.com", "anthropic.com"];

/**
 * First sign-in link in the CLI's output. Tolerant by design: any https URL on
 * a Claude or Anthropic domain counts, so wording changes in the CLI do not
 * break the button. Trailing punctuation from prose is trimmed.
 */
export function extractSignInUrl(output: string): string | null {
  for (const match of stripAnsi(output).matchAll(/https:\/\/[^\s"'<>`]+/gu)) {
    const candidate = match[0].replace(/[.,;:!?)\]}]+$/u, "");
    try {
      const host = new URL(candidate).hostname.toLowerCase();
      if (SIGN_IN_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
        return candidate;
      }
    } catch {
      // Not a URL; keep scanning.
    }
  }
  return null;
}

/** True when the CLI asks the user to paste a code from the sign-in page. */
export function asksForCode(output: string): boolean {
  return /\b(?:paste|enter|type)\b[^\n]{0,60}\bcode\b|\bcode\b[^\n]{0,40}\b(?:here|below)\b/iu.test(
    stripAnsi(output),
  );
}

/** `claude auth status` prints JSON with `loggedIn` and exits non-zero when signed out. */
export function parseAuthStatus(stdout: string, exitCode: number): boolean {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (typeof parsed === "object" && parsed !== null && "loggedIn" in parsed) {
      return parsed.loggedIn === true;
    }
  } catch {
    // Older or text output falls through to the exit code.
  }
  return exitCode === 0 && !/not\s+(?:logged|signed)\s+in/iu.test(stdout);
}

export type ClaudeInstallFailureKind =
  | "network"
  | "installer"
  | "unsupported"
  | "notFound"
  | "verify"
  | "signInTimeout"
  | "signInFailed";

export interface ClaudeInstallFailure {
  readonly message: string;
  readonly recovery: "retry" | "signIn" | null;
}

/** One plain sentence and at most one recovery action per failure. */
export const CLAUDE_FAILURES: Readonly<Record<ClaudeInstallFailureKind, ClaudeInstallFailure>> = {
  network: {
    message: "Couldn't download Claude. Check your internet connection.",
    recovery: "retry",
  },
  installer: { message: "Claude's installer didn't finish.", recovery: "retry" },
  unsupported: {
    message: "Claude can't be installed automatically on this computer.",
    recovery: null,
  },
  notFound: { message: "Claude installed but can't be found.", recovery: "retry" },
  verify: { message: "Claude installed but didn't start.", recovery: "retry" },
  signInTimeout: { message: "Sign-in didn't finish in time.", recovery: "signIn" },
  signInFailed: { message: "Claude sign-in didn't complete.", recovery: "signIn" },
};

/** Classify installer output; the raw text is kept only as collapsed details. */
export function classifyInstallerFailure(output: string): ClaudeInstallFailureKind {
  const text = stripAnsi(output);
  if (
    /could not resolve|name or service not known|unable to connect|connection (?:was )?(?:closed|refused|reset)|timed out|timeout|ssl|tls|certificate|remote name|network|offline|unreachable|getaddrinfo/iu.test(
      text,
    )
  ) {
    return "network";
  }
  if (/unsupported|not supported/iu.test(text)) return "unsupported";
  return "installer";
}

/** Keep details short enough for a collapsed panel and free of ANSI noise. */
export function trimDetails(output: string, limit = 1_200): string | null {
  const text = stripAnsi(output).trim();
  if (!text) return null;
  return text.length > limit ? `...${text.slice(-limit)}` : text;
}

/** The installer prints its own steps; map them onto the coarse phases. */
export function installerPhaseForLine(line: string): "downloading" | "installing" | null {
  const text = stripAnsi(line);
  if (/install(?:ing|ed)?\b|setting up|checking installation/iu.test(text)) return "installing";
  if (/download/iu.test(text)) return "downloading";
  return null;
}

export interface InstallerCommand {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

/**
 * The official native installers, run unattended. Windows PowerShell 5.1 needs
 * TLS 1.2 enabled explicitly. No elevation is requested; both land in the
 * user's own `.local/bin`.
 */
export function installerCommand(platform: NodeJS.Platform): InstallerCommand | null {
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; irm https://claude.ai/install.ps1 | iex",
      ],
    };
  }
  if (platform === "darwin" || platform === "linux") {
    return { command: "bash", args: ["-c", "curl -fsSL https://claude.ai/install.sh | bash"] };
  }
  return null;
}

/** Where the native installer puts `claude`, ahead of any PATH lookup. */
export function knownClaudeBinaries(
  platform: NodeJS.Platform,
  home: string,
  join: (...parts: string[]) => string,
): ReadonlyArray<string> {
  return platform === "win32"
    ? [join(home, ".local", "bin", "claude.exe")]
    : [join(home, ".local", "bin", "claude")];
}

/** The default instance binds to PATH; an absolute path means someone chose it. */
export const isDefaultClaudeBinary = (binaryPath: string) =>
  binaryPath.trim() === "" || binaryPath.trim() === "claude";
