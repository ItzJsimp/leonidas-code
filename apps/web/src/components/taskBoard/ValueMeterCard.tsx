import { useAtomValue } from "@effect/atom-react";
import { AuthSettingsWriteScope, UsageDay, UsageProviderKind } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useMemo, useState } from "react";
import { usePrimaryEnvironmentId } from "../../state/environments";
import {
  primaryServerProvidersAtom,
  primaryServerSettingsAtom,
  serverEnvironment,
} from "../../state/server";
import { useEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import { useUsage } from "../../state/usage";
import { DraftInput } from "../ui/draft-input";
import { buildValueMeter } from "./valueMeter.logic";

const usd = (value: number | null) => (value === null ? "Unknown" : `$${value.toFixed(2)}`);

export function ValueMeterCard() {
  const environmentId = usePrimaryEnvironmentId();
  const settings = useAtomValue(primaryServerSettingsAtom);
  const providers = useAtomValue(primaryServerProvidersAtom);
  const canWrite = useEnvironmentScope(environmentId, AuthSettingsWriteScope);
  const persist = useAtomCommand(serverEnvironment.updateSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = `${month}-${String(now.getDate()).padStart(2, "0")}`;
  const window = useMemo(
    () => ({
      sinceDay: UsageDay.make(`${month}-01`),
      untilDay: UsageDay.make(today),
      timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    [month, today],
  );
  const usage = useUsage(window);
  const paid = settings.subscriptionPaidUsd[month] ?? {};
  const sources = [
    ...new Set(
      usage.environments.flatMap((entry) => (entry.summary ? [entry.summary.pricing.source] : [])),
    ),
  ];
  const pricingSource = sources.join(", ") || "model rate table";
  const totals = usage.shown?.merged.providers ?? [];
  const known = providers.flatMap((provider) => {
    const kind = provider.driver === "claudeAgent" ? "claude" : provider.driver;
    return UsageProviderKind.literals.includes(kind as UsageProviderKind)
      ? [kind as UsageProviderKind]
      : [];
  });
  const rows = buildValueMeter({
    providers: totals,
    providerKinds: known,
    models: usage.shown?.merged.models ?? [],
    paid,
    pricingSource,
  });
  async function save(provider: string, text: string) {
    if (!environmentId || !canWrite || saving || text.trim() === "") return;
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a paid amount of zero or more.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await persist({
        environmentId,
        input: { patch: { subscriptionPaidUsd: { [month]: { ...paid, [provider]: amount } } } },
      });
      if (!AsyncResult.isSuccess(result)) setError("The paid amount was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      aria-label="Value meter"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <h2 className="text-sm font-medium">Value meter</h2>
      <p className="text-sm text-muted-foreground">
        Month to date ({month}), USD. Enter what you paid this month.
      </p>
      {usage.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading provider usage...
        </p>
      ) : null}
      {usage.isPartial ? (
        <p role="status" className="text-sm text-muted-foreground">
          Some providers are still reporting. Estimates are partial.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {usage.environments.some((entry) => entry.error) ? (
        <p role="status" className="text-sm text-muted-foreground">
          Some usage is unavailable. Open Usage to check each source.
        </p>
      ) : null}
      <fieldset disabled={!canWrite || saving} className="min-w-0">
        <legend className="sr-only">Monthly paid amounts by provider</legend>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.provider} className="grid gap-2 py-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                {row.provider} paid (source: you)
                <DraftInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.paidUsd?.toString() ?? ""}
                  placeholder="Not entered"
                  aria-label={`${row.provider} paid this month in USD`}
                  onCommit={(text) => void save(row.provider, text)}
                />
              </label>
              <div className="text-sm">
                <p>List-price value: {usage.shown ? usd(row.valueUsd) : "Unknown"}</p>
                <p className="text-xs text-muted-foreground">
                  estimate:{" "}
                  {sources.length === 0
                    ? "model rate table"
                    : sources.map((source, index) => (
                        <span key={source}>
                          {index > 0 ? ", " : ""}
                          {/^https?:\/\//.test(source) ? (
                            <a
                              href={source}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-4"
                            >
                              model rate table
                            </a>
                          ) : (
                            source
                          )}
                        </span>
                      ))}{" "}
                  and provider usage records
                </p>
                {row.unpricedRecords > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {row.unpricedRecords} records have no price. Value is partial.
                  </p>
                ) : null}
              </div>
              <div className="text-sm">
                <p>Savings: {usage.shown ? usd(row.savingsUsd) : "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{row.savingsSource}</p>
              </div>
            </li>
          ))}
        </ul>
      </fieldset>
      {rows.length === 0 && !usage.isPending ? (
        <p className="text-sm text-muted-foreground">
          Connect an AI account to see its value here.
        </p>
      ) : null}
    </section>
  );
}
