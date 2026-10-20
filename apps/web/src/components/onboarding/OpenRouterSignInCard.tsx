import { ProviderDriverKind, type EnvironmentId, type ServerProvider } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import {
  getOpenRouterCardView,
  OPENROUTER_FINISHING_MESSAGE,
  OPENROUTER_FREE_NOTE,
  OPENROUTER_INSTALL_NOTE,
  OPENROUTER_WAITING_MESSAGE,
} from "../../onboarding/openRouterSignIn.logic";
import { getOnboardingProviderState } from "../../onboarding/providerReadiness.logic";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";

const START_FAILED = "Could not start OpenRouter sign-in. Try again.";

/**
 * The free path for users with no paid AI plan. One click installs the Claude
 * program if it is missing, then opens OpenRouter in the browser. The key comes
 * back to the app by itself; nothing is pasted.
 */
export function OpenRouterSignInCard({
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
  const installQuery = useEnvironmentQuery(
    provider.installed
      ? null
      : serverEnvironment.providerInstallState({ environmentId, input: { instanceId } }),
  );
  const options = { reportFailure: false, reportDefect: false };
  const startAuth = useAtomCommand(serverEnvironment.startProviderAuth, options);
  const startInstall = useAtomCommand(serverEnvironment.startProviderInstall, options);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, options);
  const [requested, setRequested] = useState(false);
  const [installRequested, setInstallRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = getOpenRouterCardView({
    providerState: getOnboardingProviderState(provider),
    auth: authQuery.data,
    requested,
  });
  const installing =
    installRequested &&
    !provider.installed &&
    installQuery.data?.phase !== "failed" &&
    installQuery.data?.phase !== "cancelled";

  const signIn = useCallback(async () => {
    setRequested(true);
    setError(null);
    const result = await startAuth({ environmentId, input: { instanceId } });
    if (result._tag === "Failure") {
      setRequested(false);
      setError(START_FAILED);
    }
  }, [startAuth, environmentId, instanceId]);

  const install = useCallback(async () => {
    setInstallRequested(true);
    setError(null);
    const result = await startInstall({ environmentId, input: { instanceId } });
    if (result._tag === "Failure") {
      setInstallRequested(false);
      setError("Could not install the Claude program. Try again.");
    }
  }, [startInstall, environmentId, instanceId]);

  // Install finished: probe again, then go on to sign-in without another click.
  const installDone = installQuery.data?.phase === "succeeded";
  const probed = useRef(false);
  useEffect(() => {
    if (!installRequested || !installDone || probed.current) return;
    probed.current = true;
    void refreshProviders({ environmentId, input: {} });
  }, [installRequested, installDone, refreshProviders, environmentId]);
  const signedInAfterInstall = useRef(false);
  useEffect(() => {
    if (!installRequested || !provider.installed || signedInAfterInstall.current) return;
    signedInAfterInstall.current = true;
    void signIn();
  }, [installRequested, provider.installed, signIn]);

  // Open the sign-in page once, as soon as it is known.
  const openedUrl = useRef<string | null>(null);
  const url = view.kind === "waiting" ? view.url : null;
  useEffect(() => {
    if (!requested || url === null || openedUrl.current === url) return;
    openedUrl.current = url;
    void ensureLocalApi()
      .shell.openExternal(url)
      .catch(() => setError("Could not open the browser. Click Open sign-in page."));
  }, [requested, url]);

  const detail =
    error ??
    (view.kind === "ready"
      ? OPENROUTER_FREE_NOTE
      : view.kind === "install"
        ? installing
          ? "Installing the Claude program..."
          : OPENROUTER_INSTALL_NOTE
        : view.kind === "waiting"
          ? OPENROUTER_WAITING_MESSAGE
          : view.kind === "finishing"
            ? OPENROUTER_FINISHING_MESSAGE
            : view.kind === "failed"
              ? view.message
              : OPENROUTER_FREE_NOTE);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-4">
      <ProviderInstanceIcon
        driverKind={ProviderDriverKind.make("openrouter")}
        displayName="OpenRouter"
        iconClassName="size-5"
      />
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">OpenRouter (free)</span>
        <p
          className="mt-0.5 text-xs leading-relaxed break-words text-muted-foreground"
          aria-live="polite"
        >
          {detail}
        </p>
      </div>
      <div className="shrink-0">
        {view.kind === "ready" ? (
          <span className="text-xs font-medium text-success-foreground">Ready</span>
        ) : view.kind === "install" ? (
          <Button size="sm" disabled={installing} onClick={() => void install()}>
            {installing ? "Installing..." : "Start free"}
          </Button>
        ) : view.kind === "waiting" ? (
          view.url !== null ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void ensureLocalApi().shell.openExternal(view.url!)}
            >
              Open sign-in page
            </Button>
          ) : null
        ) : view.kind === "finishing" ? (
          <span className="text-xs text-muted-foreground">Checking...</span>
        ) : (
          <Button size="sm" onClick={() => void signIn()}>
            {view.kind === "failed" || error !== null ? "Try again" : "Sign in free"}
          </Button>
        )}
      </div>
    </div>
  );
}
