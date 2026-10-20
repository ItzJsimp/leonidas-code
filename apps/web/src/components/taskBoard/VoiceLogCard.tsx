import { useAtomValue } from "@effect/atom-react";
import {
  AuthFilesystemWriteScope,
  AuthSettingsWriteScope,
  type VoiceLogDraft,
} from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useEffect, useState } from "react";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { primaryServerSettingsAtom, serverEnvironment } from "../../state/server";
import { useEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import { useEnvironmentQuery } from "../../state/query";
import { voiceLogMemoryReviewQuery, voiceLogMemoryApprove } from "../../state/voiceLogMemory";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { DraftInput } from "../ui/draft-input";

function DraftReview({
  draft,
  canApprove,
  busy,
  decide,
}: {
  draft: VoiceLogDraft;
  canApprove: boolean;
  busy: boolean;
  decide: (selected: number[]) => void;
}) {
  const [selected, setSelected] = useState(() => new Set(draft.lines.map((_, index) => index)));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {draft.day}: chose {draft.modelSelection.model} on {draft.providerLabel}. {draft.reason}.
      </p>
      <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend className="sr-only">Choose memory lines to save</legend>
        {draft.lines.map((line, index) => (
          <label key={index} className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={selected.has(index)}
              onCheckedChange={(checked) =>
                setSelected((previous) => {
                  const next = new Set(previous);
                  if (checked) next.add(index);
                  else next.delete(index);
                  return next;
                })
              }
            />
            {line}
          </label>
        ))}
      </fieldset>
      {!canApprove ? (
        <p className="text-sm text-muted-foreground">
          Connect an AIOS folder and enable memory to approve this draft.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !canApprove || selected.size === 0}
          onClick={() => decide([...selected])}
        >
          Approve {selected.size} {selected.size === 1 ? "line" : "lines"}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => decide([])}>
          Discard draft
        </Button>
      </div>
    </div>
  );
}

export function VoiceLogCard() {
  const environmentId = usePrimaryEnvironmentId();
  const settings = useAtomValue(primaryServerSettingsAtom);
  const options = settings.voiceLogMemory;
  const canChange = useEnvironmentScope(environmentId, AuthSettingsWriteScope);
  const canWrite = useEnvironmentScope(environmentId, AuthFilesystemWriteScope);
  const persist = useAtomCommand(serverEnvironment.updateSettings);
  const approve = useAtomCommand(voiceLogMemoryApprove);
  const query = useEnvironmentQuery(
    environmentId && options.enabled
      ? voiceLogMemoryReviewQuery({ environmentId, input: {} })
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!options.enabled) return;
    const timer = setInterval(query.refresh, 60_000);
    return () => clearInterval(timer);
  }, [options.enabled, query.refresh]);
  async function update(enabled: boolean, skipApps = options.skipApps) {
    if (!environmentId || !canChange || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await persist({
        environmentId,
        input: { patch: { voiceLogMemory: { enabled, skipApps } } },
      });
      if (!AsyncResult.isSuccess(result)) setError("The memory setting was not saved. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function decide(selected: number[]) {
    if (!environmentId || !query.data?.draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await approve({
        environmentId,
        input: { draftId: query.data.draft.id, selected },
      });
      if (AsyncResult.isSuccess(result)) query.refresh();
      else setError("The draft was not saved. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Voice-log memory"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <h2 className="text-sm font-medium">Voice-log memory</h2>
      <p className="text-sm text-muted-foreground">
        At 3:00 AM on this computer, draft memories from up to 200 eligible dictations. Catch up at
        the next launch. Private and older unflagged takes are always skipped.
      </p>
      <p className="text-sm text-muted-foreground">
        This uses your connected Claude or Codex account and its usage allowance. Nothing goes to
        memory/observed/voice-log.md until you approve selected lines.
      </p>
      {options.enabled ? (
        <Button variant="outline" disabled={busy || !canChange} onClick={() => void update(false)}>
          Turn off nightly drafts
        </Button>
      ) : (
        <Button disabled={busy || !canChange} onClick={() => void update(true)}>
          Yes, enable nightly drafts on my account
        </Button>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Skip apps (names separated by commas)
        <DraftInput
          value={options.skipApps.join(", ")}
          disabled={busy || !canChange}
          onCommit={(text) => {
            const skipApps = text
              .split(",")
              .map((app) => app.trim())
              .filter(Boolean);
            if (skipApps.length > 100 || skipApps.some((app) => app.length > 120)) {
              setError("Use at most 100 app names, each under 120 characters.");
              return;
            }
            void update(options.enabled, skipApps);
          }}
        />
      </label>
      {error || query.error || query.data?.problem ? (
        <p role="alert" className="text-sm text-destructive">
          {error ?? query.error ?? query.data?.problem}
        </p>
      ) : null}
      {options.enabled ? (
        <>
          <Button variant="outline" disabled={busy} onClick={query.refresh}>
            Check for draft
          </Button>
          {query.data?.draft ? (
            <DraftReview
              key={query.data.draft.id}
              draft={query.data.draft}
              busy={busy}
              canApprove={canWrite && query.data.canApprove}
              decide={(selected) => void decide(selected)}
            />
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              {query.isPending ? "Checking for a draft..." : "No draft waits for review."}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Off. Dictation history is not read for memory.
        </p>
      )}
    </section>
  );
}
