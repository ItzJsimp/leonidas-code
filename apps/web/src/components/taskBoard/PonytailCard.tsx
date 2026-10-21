import { ScissorsIcon } from "lucide-react";

import type { PonytailUsage } from "@t3tools/contracts";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { ponytailUsageQuery } from "~/state/taskBoard";

const FAMILY_LABELS: Record<string, string> = {
  claudeAgent: "Claude",
  codex: "Codex",
  antigravity: "Gemini (Antigravity)",
  openrouter: "OpenRouter",
};

const usd = (n: number) => `$${n.toFixed(2)}`;
const mins = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} min`;
const compact = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1)}B`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
        : `${Math.round(n)}`;
const shortDate = (iso: string) => (iso ? `${iso.slice(5, 7)}-${iso.slice(8, 10)}` : "");

type Totals = PonytailUsage["providers"][number];

/** Sums the account-level provider ids (claudeAgent_justine, claudeAgent_bird) into one family. */
function byFamily(list: ReadonlyArray<Totals>): Map<string, Totals> {
  const out = new Map<string, Totals>();
  for (const p of list) {
    const family = p.provider.split("_")[0] ?? p.provider;
    const sum = out.get(family);
    out.set(family, {
      provider: family,
      turns: (sum?.turns ?? 0) + p.turns,
      inputTokens: (sum?.inputTokens ?? 0) + p.inputTokens,
      cachedInputTokens: (sum?.cachedInputTokens ?? 0) + p.cachedInputTokens,
      outputTokens: (sum?.outputTokens ?? 0) + p.outputTokens,
      agentMinutes: (sum?.agentMinutes ?? 0) + p.agentMinutes,
    });
  }
  return out;
}

const perTurn = (t: Totals | undefined) =>
  t && t.turns > 0
    ? `${compact(t.outputTokens / t.turns)} out · ${mins(t.agentMinutes / t.turns)} per turn · ${t.turns} turns`
    : "no turns";

/** Shows whether Ponytail is on and what its ledger and the app's turn records say. It never estimates a saving. */
export function PonytailCard() {
  const environmentId = usePrimaryEnvironmentId();
  const { data, error } = useEnvironmentQuery(
    environmentId ? ponytailUsageQuery({ environmentId, input: {} }) : null,
  );
  const on = data?.accounts.filter((a) => a.enabled).length ?? 0;
  const before = byFamily(data?.providersBefore ?? []);
  const after = byFamily(data?.providers ?? []);
  const families = [...new Set([...before.keys(), ...after.keys()])];

  return (
    <section
      aria-label="Ponytail"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <ScissorsIcon aria-hidden className="size-4 text-muted-foreground" />
        Ponytail
      </h2>
      {data === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {error ? "Ponytail numbers are not available now. Try again later." : "Loading..."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Ponytail makes agents write the smallest complete change. Its rules reach every
            provider. The plugin is on in {on} of {data.accounts.length} Claude{" "}
            {data.accounts.length === 1 ? "account" : "accounts"} and logs each task.
          </p>
          {families.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                Per turn: the 30 days before {shortDate(data.since)}, then since
              </h3>
              <ul className="flex flex-col divide-y divide-border">
                {families.map((f) => (
                  <li key={f} className="flex flex-col gap-0.5 py-1.5 text-sm">
                    <span>{FAMILY_LABELS[f] ?? f}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      Before: {perTurn(before.get(f))}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      Since: {perTurn(after.get(f))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                The work mix changed too, so a change here does not prove Ponytail caused it.
              </p>
            </div>
          ) : null}
          {data.tasks === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks logged yet. The log fills after a Claude task with the plugin on.
            </p>
          ) : (
            <>
              <h3 className="text-xs font-medium text-muted-foreground">
                Plugin ledger since {shortDate(data.since)}
              </h3>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Tasks (one prompt each)" value={`${data.tasks}`} />
                <Stat label="Cost (plugin figure)" value={usd(data.costUsd)} />
                <Stat label="Agent time" value={mins(data.agentMinutes)} />
                <Stat
                  label="Tests ran"
                  value={data.testsRan === null ? "n/a" : `${data.testsRan} of ${data.tasks}`}
                />
              </dl>
              <p className="text-sm text-muted-foreground">
                {data.skillRuns.tasks} of {data.tasks} tasks were skill runs (audit, handoff). They
                hold {usd(data.skillRuns.costUsd)} of the {usd(data.costUsd)}. Ponytail trims code,
                so it has little to trim there.
              </p>
              <ul className="flex flex-col divide-y divide-border">
                {data.recent.map((t) => (
                  <li
                    key={`${t.started}-${t.name}`}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">{t.name || "Untitled task"}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {t.started.slice(5)} · {usd(t.costUsd)} · {mins(t.agentMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Cost is the plugin&apos;s own calculation. A saving needs a baseline that the ledger
                does not have, so none is shown.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Stat(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="text-sm font-medium tabular-nums">{props.value}</dd>
    </div>
  );
}
