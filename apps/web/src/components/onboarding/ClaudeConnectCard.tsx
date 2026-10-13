import {
  AuthProvidersManageScope,
  defaultInstanceIdForDriver,
  type EnvironmentId,
  ProviderDriverKind,
  type ServerProvider,
} from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import { CheckIcon, CircleDotIcon, CircleIcon, ExternalLinkIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import {
  describeClaudeConnect,
  type ClaudeConnectStep,
} from "../../onboarding/claudeConnect.logic";
import { useEnvironmentQuery } from "../../state/query";
import { useEnvironmentScope } from "../../state/session";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { Input } from "../ui/input";

const CLAUDE = ProviderDriverKind.make("claudeAgent");

function StepRow({ step }: { readonly step: ClaudeConnectStep }) {
  // Static glyphs only: no spinner or looping animation while setup runs.
  const Icon = step.status === "done" ? CheckIcon : step.status === "active" ? CircleDotIcon : CircleIcon;
  return (
    <li
      className={
        step.status === "pending"
          ? "flex items-center gap-2 text-xs text-muted-foreground/60"
          : "flex items-center gap-2 text-xs text-foreground"
      }
      aria-current={step.status === "active" ? "step" : undefined}
    >
      <Icon className="size-3.5 shrink-0" />
      {step.label}
    </li>
  );
}

/**
 * One-button Claude setup for the first-run wizard. The server job installs
 * Claude if needed, signs the user in and the card flips to Ready by itself
 * when the provider snapshot says so. The terminal stays available behind an
 * "Advanced" link for people who prefer it.
 */
export function ClaudeConnectCard({
  environmentId,
  provider,
  terminalAvailable,
  terminalOpen,
  onOpenTerminal,
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider | undefined;
  readonly terminalAvailable: boolean;
  readonly terminalOpen: boolean;
  readonly onOpenTerminal: () => void;
}) {
  const instanceId = provider?.instanceId ?? defaultInstanceIdForDriver(CLAUDE);
  const canManage = useEnvironmentScope(environmentId, AuthProvidersManageScope);
  const installQuery = useEnvironmentQuery(
    serverEnvironment.providerInstallState({ environmentId, input: { instanceId } }),
  );
  const install = installQuery.data ?? undefined;
  const options = { reportFailure: false, reportDefect: false };
  const startInstall = useAtomCommand(serverEnvironment.startProviderInstall, options);
  const cancelInstall = useAtomCommand(serverEnvironment.cancelProviderInstall, options);
  const submitCode = useAtomCommand(serverEnvironment.submitProviderInstallCode, options);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, options);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const view = describeClaudeConnect(provider, install);

  // The server refreshes providers itself; this covers a snapshot that raced the event.
  const phase = install?.phase;
  useEffect(() => {
    if (phase === "succeeded") void refreshProviders({ environmentId, input: { instanceId } });
  }, [phase, refreshProviders, environmentId, instanceId]);

  const report = useCallback(
    async <A, E>(request: Promise<AtomCommandResult<A, E>>) => {
      setError(null);
      setBusy(true);
      try {
        const result = await request;
        if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
          const failure = squashAtomCommandFailure(result);
          setError(
            failure instanceof Error && failure.message
              ? failure.message
              : "Couldn't connect Claude. Try again.",
          );
        }
      } catch {
        setError("Couldn't connect Claude. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const connect = () => void report(startInstall({ environmentId, input: { instanceId } }));
  const connectDisabled = busy || !canManage;

  return (
    <div className="rounded-lg border border-border bg-background px-4 py-4">
      <div className="flex items-center gap-3">
        <ProviderInstanceIcon driverKind={CLAUDE} displayName="Claude" iconClassName="size-5" />
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">Claude</span>
          <p className="mt-0.5 text-xs leading-relaxed break-words text-muted-foreground">
            {view.kind === "ready"
              ? "Ready to code."
              : view.kind === "checking"
                ? "Checking..."
                : view.kind === "idle"
                  ? view.headline
                  : view.kind === "failed"
                    ? view.message
                    : (view.message ?? "Connecting Claude.")}
          </p>
        </div>
        <div className="shrink-0">
          {view.kind === "ready" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-foreground">
              <CheckIcon className="size-3.5" />
              Ready
            </span>
          ) : view.kind === "idle" ? (
            <Button size="xs" disabled={connectDisabled} onClick={connect}>
              Connect Claude
            </Button>
          ) : view.kind === "failed" ? (
            <Button size="xs" disabled={connectDisabled} onClick={connect}>
              {view.recoveryLabel}
            </Button>
          ) : view.kind === "running" ? (
            <Button
              size="xs"
              variant="ghost-muted"
              disabled={busy || view.operationId === null}
              onClick={() => {
                if (view.operationId === null) return;
                void report(
                  cancelInstall({ environmentId, input: { instanceId, operationId: view.operationId } }),
                );
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {view.kind === "running" ? (
        <div className="mt-3 space-y-3 pl-8">
          <ol className="space-y-1.5">
            {view.steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ol>
          {view.signInUrl !== null ? (
            <div className="space-y-2">
              <Button
                size="xs"
                onClick={() => void ensureLocalApi().shell.openExternal(view.signInUrl!)}
              >
                <ExternalLinkIcon className="size-3.5" />
                Open sign-in page
              </Button>
              {view.awaitingCode && view.operationId !== null ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = code.trim();
                    if (!value || view.operationId === null) return;
                    void report(
                      submitCode({
                        environmentId,
                        input: { instanceId, operationId: view.operationId, code: value },
                      }),
                    );
                    setCode("");
                  }}
                >
                  <Input
                    aria-label="Sign-in code"
                    placeholder="Paste the code from the sign-in page"
                    value={code}
                    autoComplete="off"
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <Button size="xs" type="submit" disabled={busy || code.trim() === ""}>
                    Submit
                  </Button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {view.kind === "failed" && view.details !== null ? (
        <div className="mt-2 pl-8">
        <Collapsible>
          <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            Details
          </CollapsibleTrigger>
          <CollapsiblePanel animate={false}>
            <pre className="mt-1 max-h-32 overflow-auto text-xs whitespace-pre-wrap text-muted-foreground">
              {view.details}
            </pre>
          </CollapsiblePanel>
        </Collapsible>
      </div>
      ) : null}

      {error !== null ? <p className="mt-2 pl-8 text-xs text-destructive-foreground">{error}</p> : null}
      {!canManage && view.kind !== "ready" ? (
        <p className="mt-2 pl-8 text-xs text-muted-foreground">
          This connection can't change provider settings.
        </p>
      ) : null}

      {view.kind !== "ready" && view.kind !== "running" ? (
        <div className="mt-2 pl-8">
          <Button
            size="xs"
            variant="ghost-muted"
            disabled={terminalOpen || !terminalAvailable}
            onClick={onOpenTerminal}
          >
            Advanced: use a terminal
          </Button>
        </div>
      ) : null}
    </div>
  );
}
