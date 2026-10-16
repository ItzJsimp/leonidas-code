import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { useEnvironmentSettings } from "../../hooks/useSettings";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button, InlineButton } from "../ui/button";
import { Input } from "../ui/input";
import { SettingsRow } from "./settingsLayout";

const KEY_URL = "https://artificialanalysis.ai/api-key-management-redirect";

/**
 * The free Artificial Analysis key that adds per-effort numbers to the model picker.
 * Write-only: the saved key is never shown, only whether one is set.
 */
export function BenchmarkKeySettings() {
  const environmentId = usePrimaryEnvironmentId();
  if (!environmentId) return null;
  return <BenchmarkKeyRow environmentId={environmentId} />;
}

function BenchmarkKeyRow({
  environmentId,
}: {
  readonly environmentId: NonNullable<ReturnType<typeof usePrimaryEnvironmentId>>;
}) {
  const saved = useEnvironmentSettings(environmentId, (s) => s.artificialAnalysisApiKey) !== "";
  const updateSettings = useAtomCommand(serverEnvironment.updateSettings, {
    label: "save Artificial Analysis key",
  });
  const catalog = useEnvironmentQuery(
    serverEnvironment.modelBenchmarkCatalog({ environmentId, input: {} }),
  );
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (value: string) => {
    setSaving(true);
    try {
      const result = await updateSettings({
        environmentId,
        input: { patch: { artificialAnalysisApiKey: value } },
      });
      if (result._tag === "Success") {
        setDraft("");
        catalog.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const aaStatus = catalog.data?.sources.find((source) => source.source === "artificialAnalysis");
  const aaCount =
    catalog.data?.entries.filter((entry) => entry.source === "artificialAnalysis").length ?? 0;
  const status = !saved
    ? "No key saved. The picker shows the max-effort score from BenchLM."
    : aaStatus?.state === "ready"
      ? `Working. ${aaCount} model and effort rows loaded.`
      : aaStatus?.state === "stale"
        ? "The last refresh failed. Showing older numbers."
        : catalog.isPending
          ? "Checking the key..."
          : "Saved, but Artificial Analysis did not answer. Check the key.";

  return (
    <SettingsRow
      title="Artificial Analysis key"
      description={
        <>
          Adds scores for each effort level (Low, Medium, High, Max) to the model picker. The key is
          free.{" "}
          <InlineButton render={<a href={KEY_URL} target="_blank" rel="noreferrer noopener" />}>
            Get a key
            <ExternalLinkIcon aria-hidden className="size-3" />
          </InlineButton>
          <span className="mt-1 block">{status}</span>
        </>
      }
      control={
        <form
          className="flex w-full gap-2 sm:w-80"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) void save(draft.trim());
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            size="sm"
            aria-label="Artificial Analysis key"
            placeholder={saved ? "Saved. Type a new key to replace it." : "Paste your key"}
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
          />
          {saved && !draft ? (
            <Button size="xs" variant="outline" disabled={saving} onClick={() => void save("")}>
              Remove
            </Button>
          ) : (
            <Button type="submit" size="xs" disabled={!draft.trim() || saving}>
              Save
            </Button>
          )}
        </form>
      }
    />
  );
}
