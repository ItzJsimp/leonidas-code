/**
 * Claude keeps each login in its own config directory, and the CLI blanks a
 * login whose refresh token was rejected. Two directories holding the same
 * account tend to do that to each other, because refresh tokens rotate on use.
 */

const CLAUDE_DRIVER = "claudeAgent";

interface LoginProvider {
  readonly instanceId: string;
  readonly driver: string;
  readonly displayName?: string | undefined;
  readonly enabled: boolean;
  readonly auth: { readonly status: string; readonly email?: string | undefined };
}

/** The server sets this failure code on an expired Claude login. Same literal in ClaudeAdapterV2. */
const CLAUDE_SIGNED_OUT_FAILURE_CODE = "claude_signed_out";

export function isClaudeSignedOutFailure(failure: { readonly code: string | null }): boolean {
  return failure.code === CLAUDE_SIGNED_OUT_FAILURE_CODE;
}

/** The provider instance that ran the failed turn, or null when the run is unknown. */
export function signInInstanceId(
  runs: ReadonlyArray<{ readonly id: string; readonly providerInstanceId: string }>,
  runId: string | null,
): string | null {
  if (runId === null) return null;
  return runs.find((run) => run.id === runId)?.providerInstanceId ?? null;
}

/** The server's signed-out message quotes the config dir as a JSON string. */
const CONFIG_DIR_IN_MESSAGE = /CLAUDE_CONFIG_DIR set to ("(?:[^"\\]|\\.)*")/u;

/**
 * The terminal command that signs a Claude profile back in, or null when the
 * failure is not a Claude sign-in problem. Without a config dir in the message
 * the default profile is meant, so the bare command is right.
 */
export function signInCommandForFailure(message: string): string | null {
  if (!message.includes("claude auth login")) return null;
  const quoted = CONFIG_DIR_IN_MESSAGE.exec(message)?.[1];
  if (quoted === undefined) return "claude auth login";
  let configDir: unknown;
  try {
    configDir = JSON.parse(quoted);
  } catch {
    return "claude auth login";
  }
  if (typeof configDir !== "string" || configDir.length === 0) return "claude auth login";
  return /^[A-Za-z]:[\\/]/u.test(configDir) || configDir.startsWith("\\\\")
    ? `$env:CLAUDE_CONFIG_DIR="${configDir}"; claude auth login`
    : `CLAUDE_CONFIG_DIR=${JSON.stringify(configDir)} claude auth login`;
}

/**
 * Names of the other enabled Claude profiles signed in as the same account.
 * Same account twice is only a risk, not proof of a copy, so callers word it
 * as a warning.
 */
export function sharedLoginPeerNames(
  providers: ReadonlyArray<LoginProvider>,
  instanceId: string,
): ReadonlyArray<string> {
  const self = providers.find((provider) => provider.instanceId === instanceId);
  const email = self?.auth.email?.trim().toLowerCase();
  if (self === undefined || self.driver !== CLAUDE_DRIVER || !self.enabled || !email) return [];
  return providers
    .filter(
      (provider) =>
        provider.instanceId !== instanceId &&
        provider.driver === CLAUDE_DRIVER &&
        provider.enabled &&
        provider.auth.email?.trim().toLowerCase() === email,
    )
    .map((provider) => provider.displayName?.trim() || provider.instanceId);
}

export function sharedLoginWarning(peerNames: ReadonlyArray<string>): string | null {
  if (peerNames.length === 0) return null;
  return `Same account as ${peerNames.join(", ")}. If you copied one AI account from the other, they sign each other out. Give each one its own sign-in with claude auth login.`;
}
