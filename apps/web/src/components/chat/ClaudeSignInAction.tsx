import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ServerProvider } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import { getClaudeSignInView } from "../../onboarding/claudeSignIn.logic";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { getChatSignInState } from "./chatSignIn.logic";

const SIGN_IN_FAILED_MESSAGE = "Could not start Claude sign-in. Try again.";

/**
 * Sign in button under a failed chat message when the Claude login expired.
 * It starts the same browser sign-in as the setup card and turns into
 * "Send your message again" when the provider shows the account again.
 */
export function ClaudeSignInAction({
  environmentId,
  provider,
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider;
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

  // Refresh the provider list when the server says the sign-in worked.
  const refreshedFlow = useRef<string | null>(null);
  useEffect(() => {
    if (auth?.phase !== "succeeded" || !auth.flowId || refreshedFlow.current === auth.flowId) {
      return;
    }
    refreshedFlow.current = auth.flowId;
    void refreshProviders({ environmentId, input: {} });
  }, [auth?.phase, auth?.flowId, refreshProviders, environmentId]);

  const state = getChatSignInState({
    view: getClaudeSignInView({ auth, requested }),
    requested,
    authenticated: provider.auth.status === "authenticated",
    error,
  });
  if (state.kind === "hidden") return null;

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <p className="min-w-0 flex-1 font-medium text-foreground/90" aria-live="polite">
        {state.detail}
      </p>
      {state.kind === "ready" ? (
        <Button size="xs" disabled={pending} onClick={() => void signIn()}>
          {state.label}
        </Button>
      ) : null}
      {state.kind === "waiting" ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {state.url !== null ? (
            <Button size="xs" variant="outline" onClick={() => void openPage(state.url!)}>
              Open sign-in page
            </Button>
          ) : null}
          {state.canCancel ? (
            <Button
              size="xs"
              variant="ghost-muted"
              disabled={pending}
              onClick={() => void cancel()}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
