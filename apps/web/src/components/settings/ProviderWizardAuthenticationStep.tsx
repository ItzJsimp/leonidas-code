import { useAtomValue } from "@effect/atom-react";
import {
  ProviderDriverKind,
  type EnvironmentId,
  type ProviderInstanceId,
} from "@t3tools/contracts";

import { useEnvironmentQuery } from "../../state/query";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "../../state/server";
import { ClaudeConnectCard } from "../onboarding/ClaudeConnectCard";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { WizardFooter, WizardPanel } from "../ui/wizard";
import { findDuplicateAccount } from "./AddProviderInstanceDialog.logic";
import { ProviderAuthenticationSection } from "./ProviderAuthenticationSection";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./settingsLayout";

const CLAUDE = ProviderDriverKind.make("claudeAgent");

/**
 * Sign-in uses the saved instance's environment and credentials, just like chat.
 * Claude gets the managed one-button job; every other driver reuses the Account row.
 * `onRemove` (add-account flow) offers "Remove this account" on failure or a duplicate login.
 */
export function ProviderWizardAuthenticationStep({
  environmentId,
  environmentLabel,
  instanceId,
  driver,
  displayName,
  providerName,
  onRemove,
  onFinish,
}: {
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly instanceId: ProviderInstanceId;
  readonly driver?: ProviderDriverKind;
  readonly displayName?: string;
  readonly providerName?: string;
  readonly onRemove?: () => void;
  readonly onFinish: () => void;
}) {
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(environmentId)) ?? EMPTY_SERVER_PROVIDERS;
  const provider = providers.find((candidate) => candidate.instanceId === instanceId);
  const isClaude = (driver ?? provider?.driver) === CLAUDE;
  const query = useEnvironmentQuery(
    serverEnvironment.providerAuthState({ environmentId, input: { instanceId } }),
  );
  const auth = query.data;
  const active =
    auth?.phase === "starting" || auth?.phase === "waiting" || auth?.phase === "verifying";
  const signedIn =
    provider?.auth.status === "authenticated" ||
    (provider?.auth.status === "unknown" && auth?.phase === "succeeded");
  const isDiscovering = !signedIn && !query.error && auth?.methods === undefined;
  const canAuthenticate = (auth?.methods?.length ?? 0) > 0;
  const duplicateOf = findDuplicateAccount(providers, instanceId);

  return (
    <>
      <WizardPanel className="min-h-72">
        {isClaude ? (
          <ClaudeConnectCard
            environmentId={environmentId}
            provider={provider}
            instanceId={instanceId}
            {...(displayName === undefined ? {} : { displayName })}
            autoStart
            {...(onRemove === undefined ? {} : { onRemove })}
          />
        ) : (
          <SettingsGroup variant="plain">
            {provider && (canAuthenticate || signedIn) ? (
              <ProviderAuthenticationSection
                environmentId={environmentId}
                environmentLabel={environmentLabel}
                instanceId={instanceId}
                provider={{
                  ...provider,
                  setup: {
                    ...provider.setup,
                    canInstall: provider.setup?.canInstall ?? false,
                    canAuthenticate,
                  },
                }}
                readOnly={false}
              />
            ) : (
              <SettingsRow
                title="Account"
                description={
                  isDiscovering
                    ? "Discovering sign-in methods…"
                    : (query.error ??
                      auth?.message ??
                      "No in-app sign-in advertised. Follow the provider's docs to finish setup.")
                }
                control={
                  isDiscovering ? (
                    <Button disabled size="sm" variant="outline">
                      Sign in
                    </Button>
                  ) : provider?.setup?.documentationUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <a
                          href={provider.setup.documentationUrl}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      Open docs
                    </Button>
                  ) : undefined
                }
              />
            )}
          </SettingsGroup>
        )}
        {duplicateOf !== null ? (
          <Alert variant="warning" className="mt-3">
            <AlertDescription>
              {`This is the same account as '${duplicateOf}'. Use a different ${providerName ?? "account"} login to add a second account.`}
              {onRemove ? (
                <Button className="mt-2" size="xs" variant="outline" onClick={onRemove}>
                  Remove this account
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </WizardPanel>
      <WizardFooter>
        <Button
          size="sm"
          variant={signedIn ? "default" : "outline"}
          disabled={active}
          onClick={onFinish}
        >
          {signedIn ? "Done" : "Skip for now"}
        </Button>
      </WizardFooter>
    </>
  );
}
