import { getApiKeyProvider } from "@t3tools/shared/apiKeyProviders";
import type { EnvironmentId } from "@t3tools/contracts";
import { ArrowRightIcon, ExternalLinkIcon } from "lucide-react";

import { useApiKeyField } from "../settings/useApiKeyField";
import { Button, InlineButton } from "../ui/button";
import { Input } from "../ui/input";

const WIZARD_PROVIDER = getApiKeyProvider("groq")!;

/**
 * Optional first-run step for the free Groq key (Scribe dictation). It saves through the same
 * setting as Settings > API keys, so a key pasted here shows as saved there.
 */
export function ApiKeysStep({
  environmentId,
  onBack,
  onContinue,
}: {
  readonly environmentId: EnvironmentId | undefined;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add a free key for voice
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        {WIZARD_PROVIDER.purpose} {WIZARD_PROVIDER.freeTierNote} You can skip this and add the key
        later in Settings.
      </p>
      {environmentId ? (
        <KeyField environmentId={environmentId} />
      ) : (
        <p className="mt-5 text-xs text-muted-foreground">
          Connect to a computer to save a key. You can add it later in Settings.
        </p>
      )}
      <div className="mt-6 flex items-center justify-between gap-2">
        <Button variant="ghost-muted" onClick={onBack}>
          Back
        </Button>
        <Button autoFocus onClick={onContinue}>
          Continue
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </>
  );
}

function KeyField({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const provider = WIZARD_PROVIDER;
  const { saved, draft, setDraft, busy, testResult, save, test } = useApiKeyField(
    environmentId,
    provider,
  );
  return (
    <div className="mt-5 space-y-3">
      <ol className="list-decimal space-y-0.5 pl-4 text-sm text-muted-foreground">
        {provider.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <InlineButton render={<a href={provider.keyUrl} target="_blank" rel="noreferrer noopener" />}>
        Open page
        <ExternalLinkIcon aria-hidden className="size-3" />
      </InlineButton>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) void save(draft.trim());
        }}
      >
        <Input
          type="password"
          autoComplete="off"
          size="sm"
          className="min-w-0 flex-1"
          aria-label={`${provider.label} key`}
          placeholder={saved ? "Saved. Type a new key to replace it." : "Paste your key"}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          size="xs"
          variant="outline"
          disabled={busy || (!saved && !draft.trim())}
          onClick={() => void test()}
        >
          Test key
        </Button>
        <Button type="submit" size="xs" disabled={!draft.trim() || busy}>
          Save
        </Button>
      </form>
      <p className="text-xs text-muted-foreground" role="status">
        {testResult ? testResult.message : saved ? "A key is saved." : "No key saved."}
      </p>
    </div>
  );
}
