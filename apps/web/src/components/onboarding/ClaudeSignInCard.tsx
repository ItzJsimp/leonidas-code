import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { ProviderDriverKind, type EnvironmentId, type ServerProvider } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import {
  CLAUDE_FINISHING_MESSAGE,
  CLAUDE_WAITING_MESSAGE,
  getClaudeSignInView,
} from "../../onboarding/claudeSignIn.logic";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";

const SIGN_IN_FAILED_MESSAGE = "Could not start Claude sign-in. Try again.";

/**
 * Claude card for a provider that is installed but signed out. One button
 * starts `claude auth login` on the server. Claude opens the browser. The card
 * turns Ready when the provider snapshot shows the account.
 */
export function ClaudeSignInCard({
  environmentId,
  provider,
  displayName,
  autoStart,
  onAutoStartConsumed,
  terminalOpen,
  terminalAvailable,
  onOpenTerminal,
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider;
  readonly displayName: string;
  /** True right after the install terminal closed: sign in without another click. */
  readonly autoStart: boolean;
  readonly onAutoStartConsumed: () => void;
  readonly terminalOpen: boolean;
  readonly terminalAvailable: boolean;
  readonly onOpenTerminal: () => void;
}) {
  const instanceId = provider.instanceId;
  const authQuery = useEnvironmentQuery(
    serverEnvironment.providerAuthState({ environmentId, input: { instanceId } }),
  );
  const options = { reportFailure: false, reportDefect: false };
  const startAuth = useAtomCommand(serverEnvironment.startProviderAuth, options);
  const cancelAuth = useAtomCommand(serverEnvironment.cancelProviderAuth, options);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, options);
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const auth = authQuery.data;
  const view = getClaudeSignInView({ auth, requested });

  const run = useCallback(async (request: () => Promise<{ readonly _tag: string }>) => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    let succeeded = false;
    try {
      const result = await request();
      if (result._tag === "Failure") {
        if (!isAtomCommandInterrupted(result as never)) {
          const failure = squashAtomCommandFailure(result as never);
          setError(failure instanceof Error ? failure.message : SIGN_IN_FAILED_MESSAGE);
        }
      } else {
        succeeded = true;
      }
    } catch {
      setError(SIGN_IN_FAILED_MESSAGE);
    }
    pendingRef.current = false;
    setPending(false);
    return succeeded;
  }, []);

  const signIn = useCallback(async () => {
    setRequested(true);
    const started = await run(() => startAuth({ environmentId, input: { instanceId } }));
    if (!started) setRequested(false);
  }, [run, startAuth, environmentId, instanceId]);

  const cancel = useCallback(async () => {
    const flowId = auth?.flowId;
    setRequested(false);
    if (!flowId) return;
    await run(() => cancelAuth({ environmentId, input: { instanceId, flowId } }));
  }, [auth?.flowId, run, cancelAuth, environmentId, instanceId]);

  const openPage = useCallback(async (url: string) => {
    try {
      await ensureLocalApi().shell.openExternal(url);
    } catch {
      setError("Could not open the sign-in page. Copy it from the Claude window.");
    }
  }, []);

  // Install finished in the terminal: continue into sign-in once.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    onAutoStartConsumed();
    void signIn();
  }, [autoStart, onAutoStartConsumed, signIn]);

  // Refresh the provider list when the server says the sign-in worked.
  const refreshedFlow = useRef<string | null>(null);
  useEffect(() => {
    if (auth?.phase !== "succeeded" || !auth.flowId || refreshedFlow.current === auth.flowId) {
      return;
    }
    refreshedFlow.current = auth.flowId;
    void refreshProviders({ environmentId, input: {} });
  }, [auth?.phase, auth?.flowId, refreshProviders, environmentId]);

  const busy = pending || view.kind === "waiting" || view.kind === "finishing";
  const detail =
    view.kind === "waiting"
      ? CLAUDE_WAITING_MESSAGE
      : view.kind === "finishing"
        ? CLAUDE_FINISHING_MESSAGE
        : (error ?? (view.kind === "failed" ? view.message : "Sign in to use your Claude plan."));

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-4">
      <ProviderInstanceIcon
        driverKind={ProviderDriverKind.make("claudeAgent")}
        displayName={displayName}
        iconClassName="size-5"
      />
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{displayName}</span>
        <p className="mt-0.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
          {detail}
        </p>
        {!busy && terminalAvailable ? (
          <button
            type="button"
            className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
            disabled={terminalOpen}
            onClick={onOpenTerminal}
          >
            Use a terminal instead
          </button>
        ) : null}
      </div>
      <div className="shrink-0">
        {view.kind === "waiting" ? (
          <div className="flex items-center gap-1.5">
            {view.url !== null ? (
              <Button size="sm" variant="outline" onClick={() => void openPage(view.url!)}>
                Open sign-in page
              </Button>
            ) : null}
            {view.canCancel ? (
              <Button
                size="sm"
                variant="ghost-muted"
                disabled={pending}
                onClick={() => void cancel()}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        ) : view.kind === "finishing" ? (
          <span className="text-xs text-muted-foreground">Checking...</span>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => void signIn()}>
            {view.kind === "failed" || error !== null ? "Try again" : "Sign in with Claude"}
          </Button>
        )}
      </div>
    </div>
  );
}
