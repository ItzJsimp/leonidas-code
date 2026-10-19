import type { EnvironmentId } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatElapsed, getClaudeInstallPillView } from "../../onboarding/claudeInstallPill.logic";
import { getOnboardingProviderState } from "../../onboarding/providerReadiness.logic";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";

/**
 * A short note on every wizard step except the AI step. The Claude install runs on the
 * server, so the user can go on while it finishes. This shows that it is still running.
 */
export function ClaudeInstallPill({
  environmentId,
  onOpenAgents,
}: {
  readonly environmentId: EnvironmentId;
  readonly onOpenAgents: () => void;
}) {
  const providers = useAtomValue(serverEnvironment.providersValueAtom(environmentId));
  const claude = providers?.find((provider) => provider.driver === "claudeAgent");
  const claudeReady = claude !== undefined && getOnboardingProviderState(claude) === "ready";
  const installQuery = useEnvironmentQuery(
    claude && !claude.installed
      ? serverEnvironment.providerInstallState({
          environmentId,
          input: { instanceId: claude.instanceId },
        })
      : null,
  );
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const view = getClaudeInstallPillView({ installation: installQuery.data, claudeReady });

  // Probe again once the install ends, so the AI step sees Claude without a click.
  const probed = useRef(false);
  useEffect(() => {
    if (view.kind !== "installed" || probed.current) return;
    probed.current = true;
    void refreshProviders({ environmentId, input: {} });
  }, [view.kind, refreshProviders, environmentId]);

  const [seconds, setSeconds] = useState(0);
  const installing = view.kind === "installing";
  useEffect(() => {
    if (!installing) return;
    setSeconds(0);
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [installing]);

  if (view.kind === "hidden") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-1 mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
    >
      {view.kind === "installing" ? (
        <>
          <Spinner className="size-3.5" />
          <span className="min-w-0 flex-1">
            Claude is installing in the background. You can keep going. {formatElapsed(seconds)}
          </span>
        </>
      ) : view.kind === "installed" ? (
        <>
          <CheckIcon className="size-3.5 text-success" />
          <span className="min-w-0 flex-1">Claude is installed. Sign in to finish.</span>
          <Button size="xs" variant="outline" onClick={onOpenAgents}>
            Sign in
          </Button>
        </>
      ) : (
        <>
          <TriangleAlertIcon className="size-3.5 text-warning" />
          <span className="min-w-0 flex-1">{view.message}</span>
          <Button size="xs" variant="outline" onClick={onOpenAgents}>
            Try again
          </Button>
        </>
      )}
    </div>
  );
}
