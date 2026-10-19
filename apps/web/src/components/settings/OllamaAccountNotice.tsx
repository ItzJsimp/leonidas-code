import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  defaultInstanceIdForDriver,
  OLLAMA_DRIVER_KIND,
  resolveProviderInstanceEnabled,
  type EnvironmentId,
  type ProviderInstanceConfig,
} from "@t3tools/contracts";
import { useState } from "react";

import {
  useEnvironmentSettings,
  usePersistEnvironmentProviderInstanceMutation,
} from "../../hooks/useSettings";
import { toastManager } from "../ui/toast";
import { Button } from "../ui/button";
import { buildProviderInstanceUpdatePatch } from "./SettingsPanels.logic";

/**
 * A fresh install has the Ollama (local) account off, so installed models never reach the chat
 * picker. This notice shows only while the account is off and turns it on with one click.
 */
export function OllamaAccountNotice({ environmentId }: { environmentId: EnvironmentId }) {
  const settings = useEnvironmentSettings(environmentId);
  const persist = usePersistEnvironmentProviderInstanceMutation(environmentId);
  const [saving, setSaving] = useState(false);
  const instanceId = defaultInstanceIdForDriver(OLLAMA_DRIVER_KIND);
  const instance: ProviderInstanceConfig = settings.providerInstances?.[instanceId] ?? {
    driver: OLLAMA_DRIVER_KIND,
  };
  if (resolveProviderInstanceEnabled(instance)) return null;

  const turnOn = async () => {
    setSaving(true);
    const next: ProviderInstanceConfig = { ...instance, enabled: true };
    const { providerInstances: _unused, ...patch } = buildProviderInstanceUpdatePatch({
      settings,
      instanceId,
      instance: next,
    });
    const result = await persist({ operation: "upsert", instanceId, instance: next }, patch);
    setSaving(false);
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: "Could not turn on Ollama (local)",
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
      <span className="min-w-0">
        The Ollama (local) account is off, so these models are not in the chat picker yet.
      </span>
      <Button size="xs" disabled={saving} onClick={() => void turnOn()}>
        {saving ? "Turning on" : "Turn on"}
      </Button>
    </div>
  );
}
